/**
 * Integration test: spectate API returns correct data for various game states.
 * Tests the data assembly logic that powers the /api/spectate endpoint.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { startSession } from "@/application/start-session";
import { createAlphaQuest } from "@/application/alpha-quest-chain";
import { ingestLocation } from "@/application/ingest-location";
import {
  getState,
  resetState,
  setQuest,
  addLocationSample,
  addInventoryItem,
} from "@/infrastructure/persistence/in-memory-store";
import { haversineDistance } from "@/domain/location/geo";
import type { SessionId } from "@/domain/player/player-session";
import type { SpectateResponse } from "@/validation/spectate-schemas";
import { spectateResponseSchema } from "@/validation/spectate-schemas";
import {
  makeLocationSample,
  makeItem,
  makePlaceId,
} from "@tests/fixtures/factories";
import gpsTrace from "@tests/fixtures/adams-point/gps-trace.json";

/** Assemble spectate response from in-memory state (mirrors the API route logic). */
function assembleSpectateResponse(): SpectateResponse {
  const state = getState();

  const trail = state.locationHistory.map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
    timestamp: s.timestamp.toISOString(),
  }));

  const lastLocation = trail.length > 0 ? trail[trail.length - 1] : null;

  const inventory = Array.from(state.inventory.values()).map((rec) => ({
    name: rec.item.name,
    description: rec.item.description,
    rarity: rec.item.rarity,
    quantity: rec.quantity,
  }));

  let totalDistanceMeters = 0;
  for (let i = 1; i < state.locationHistory.length; i++) {
    const prev = state.locationHistory[i - 1];
    const curr = state.locationHistory[i];
    totalDistanceMeters += haversineDistance(
      { latitude: prev.latitude, longitude: prev.longitude },
      { latitude: curr.latitude, longitude: curr.longitude },
    );
  }
  totalDistanceMeters = Math.round(totalDistanceMeters);

  return {
    session: state.session
      ? { id: state.session.id, status: state.session.status }
      : null,
    quest: state.quest
      ? {
          id: state.quest.id,
          title: state.quest.title,
          narrative: state.quest.narrative,
          status: state.quest.status,
          currentLegIndex: state.quest.currentLegIndex,
          legs: state.quest.legs.map((leg) => ({
            id: leg.id,
            sequenceIndex: leg.sequenceIndex,
            status: leg.status,
            objective: leg.objective.description,
            targetPlaceName: leg.objective.targetPlace.name,
            targetLocation: leg.objective.targetPlace.location,
            geofenceRadiusMeters: leg.objective.geofenceRadiusMeters,
          })),
        }
      : null,
    trail,
    lastLocation,
    totalDistanceMeters,
    inventory,
  };
}

describe("Spectate data assembly", () => {
  beforeEach(() => {
    resetState();
  });

  it("returns null session and quest when no session exists", () => {
    const response = assembleSpectateResponse();

    expect(response.session).toBeNull();
    expect(response.quest).toBeNull();
    expect(response.trail).toEqual([]);
    expect(response.lastLocation).toBeNull();
    expect(response.inventory).toEqual([]);

    // Should match the Zod schema
    const parsed = spectateResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });

  it("returns session without quest before quest generation", () => {
    const { sessionId } = startSession();
    const response = assembleSpectateResponse();

    expect(response.session).not.toBeNull();
    expect(response.session!.id).toBe(sessionId);
    expect(response.session!.status).toBe("active");
    expect(response.quest).toBeNull();
    expect(response.trail).toEqual([]);
  });

  it("returns quest data with all legs after quest generation", () => {
    const { sessionId } = startSession();
    setQuest(createAlphaQuest(sessionId));

    const response = assembleSpectateResponse();

    expect(response.quest).not.toBeNull();
    expect(response.quest!.title).toBe("The Grand Lake Expedition");
    expect(response.quest!.status).toBe("active");
    expect(response.quest!.legs).toHaveLength(4);
    expect(response.quest!.legs[0].status).toBe("active");
    expect(response.quest!.legs[1].status).toBe("locked");

    // Each leg should have location data
    for (const leg of response.quest!.legs) {
      expect(leg.targetLocation.latitude).toBeTypeOf("number");
      expect(leg.targetLocation.longitude).toBeTypeOf("number");
      expect(leg.targetPlaceName).toBeTypeOf("string");
      expect(leg.geofenceRadiusMeters).toBeGreaterThan(0);
    }
  });

  it("includes GPS trail from location history", () => {
    const { sessionId } = startSession();

    const sample1 = makeLocationSample({
      sessionId,
      latitude: 37.81,
      longitude: -122.25,
      timestamp: new Date("2025-06-15T10:00:00Z"),
    });
    const sample2 = makeLocationSample({
      sessionId,
      latitude: 37.811,
      longitude: -122.251,
      timestamp: new Date("2025-06-15T10:01:00Z"),
    });

    addLocationSample(sample1);
    addLocationSample(sample2);

    const response = assembleSpectateResponse();

    expect(response.trail).toHaveLength(2);
    expect(response.trail[0].latitude).toBe(37.81);
    expect(response.trail[0].longitude).toBe(-122.25);
    expect(response.trail[1].latitude).toBe(37.811);
    expect(response.trail[1].longitude).toBe(-122.251);

    // lastLocation should be the most recent point
    expect(response.lastLocation).not.toBeNull();
    expect(response.lastLocation!.latitude).toBe(37.811);

    // totalDistanceMeters should be computed from consecutive points
    // Two points ~130m apart (0.001° lat + 0.001° lng near Oakland)
    expect(response.totalDistanceMeters).toBeGreaterThan(100);
    expect(response.totalDistanceMeters).toBeLessThan(200);
  });

  it("returns zero distance with no location history", () => {
    startSession();
    const response = assembleSpectateResponse();
    expect(response.totalDistanceMeters).toBe(0);
  });

  it("includes inventory items", () => {
    startSession();

    const item = makeItem({ name: "Crystal Shard", description: "A glowing shard.", rarity: "rare" });
    addInventoryItem(item, makePlaceId());

    const response = assembleSpectateResponse();

    expect(response.inventory).toHaveLength(1);
    expect(response.inventory[0].name).toBe("Crystal Shard");
    expect(response.inventory[0].rarity).toBe("rare");
    expect(response.inventory[0].quantity).toBe(1);
  });

  it("validates against Zod schema for a full active quest with trail and inventory", () => {
    const { sessionId } = startSession();
    setQuest(createAlphaQuest(sessionId));

    // Add some GPS points
    addLocationSample(makeLocationSample({ sessionId, latitude: 37.81, longitude: -122.25 }));
    addLocationSample(makeLocationSample({ sessionId, latitude: 37.811, longitude: -122.251 }));

    // Add an inventory item
    addInventoryItem(makeItem(), makePlaceId());

    const response = assembleSpectateResponse();
    const parsed = spectateResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });

  it("reflects quest completion after full GPS trace replay", () => {
    const { sessionId } = startSession();
    setQuest(createAlphaQuest(sessionId));

    const baseTime = new Date("2025-06-15T18:00:00Z");
    for (let i = 0; i < gpsTrace.length; i++) {
      const point = gpsTrace[i];
      ingestLocation(
        sessionId,
        [{
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          altitude: null,
          speed: null,
          heading: null,
          timestamp: new Date(baseTime.getTime() + i * 30_000).toISOString(),
        }],
        `spectate-trace-${i}`,
      );
    }

    const response = assembleSpectateResponse();

    expect(response.quest!.status).toBe("completed");
    expect(response.quest!.legs.every((l) => l.status === "completed")).toBe(true);
    expect(response.trail.length).toBeGreaterThan(0);
    expect(response.inventory.length).toBe(4);

    // Full response should still validate
    const parsed = spectateResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });
});
