/**
 * Integration test: replays a GPS trace through the hardcoded alpha quest chain.
 * Verifies full progression: start → ingest → collect all 4 items → quest complete.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { startSession } from "@/application/start-session";
import { ingestLocation } from "@/application/ingest-location";
import { getState, resetState } from "@/infrastructure/persistence/in-memory-store";
import type { SessionId } from "@/domain/player/player-session";
import gpsTrace from "@tests/fixtures/adams-point/gps-trace.json";

describe("Full run workflow: Adams Point quest chain", () => {
  let sessionId: SessionId;

  beforeEach(() => {
    resetState();
    const result = startSession();
    sessionId = result.sessionId;
  });

  it("completes all 4 legs when replaying the GPS trace", () => {
    const state = getState();

    // Verify initial state
    expect(state.quest).not.toBeNull();
    expect(state.quest!.status).toBe("active");
    expect(state.quest!.legs).toHaveLength(4);
    expect(state.quest!.legs[0].status).toBe("active");
    expect(state.quest!.legs[1].status).toBe("locked");

    // Replay each GPS point with 30-second intervals.
    // Points are ~100-200m apart, so 30s gives ~3-7 m/s (running pace).
    const baseTime = new Date("2025-06-15T18:00:00Z");

    for (let i = 0; i < gpsTrace.length; i++) {
      const point = gpsTrace[i];
      const timestamp = new Date(baseTime.getTime() + i * 30_000);

      ingestLocation(
        sessionId,
        [
          {
            latitude: point.latitude,
            longitude: point.longitude,
            accuracy: point.accuracy,
            altitude: null,
            speed: null,
            heading: null,
            timestamp: timestamp.toISOString(),
          },
        ],
        `trace-${i}`,
      );
    }

    // Verify final state
    const finalState = getState();
    expect(finalState.quest!.status).toBe("completed");
    expect(finalState.quest!.completedAt).not.toBeNull();

    // All legs completed
    for (const leg of finalState.quest!.legs) {
      expect(leg.status).toBe("completed");
    }

    // All 4 items collected
    expect(finalState.inventory.size).toBe(4);

    // Verify specific items
    const itemNames = Array.from(finalState.inventory.values()).map(
      (r) => r.item.name,
    );
    expect(itemNames).toContain("Mystic Cinnamon");
    expect(itemNames).toContain("Silver Ticket Stub");
    expect(itemNames).toContain("Pergola Scroll");
    expect(itemNames).toContain("Fairyland Key");

    // Event history should include collection and progression events
    const eventTypes = finalState.events.map((e) => e.type);
    expect(eventTypes.filter((t) => t === "ITEM_COLLECTED")).toHaveLength(4);
    expect(eventTypes.filter((t) => t === "LEG_COMPLETED")).toHaveLength(4);
    expect(eventTypes.filter((t) => t === "QUEST_COMPLETED")).toHaveLength(1);
  });

  it("does not double-collect on duplicate idempotency keys", () => {
    const point = gpsTrace[3]; // AT Oaktown Spice Shop

    // Send the same point twice with the same idempotency key
    ingestLocation(
      sessionId,
      [
        {
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          altitude: null,
          speed: null,
          heading: null,
          timestamp: new Date("2025-06-15T18:00:15Z").toISOString(),
        },
      ],
      "dup-key-1",
    );

    const result = ingestLocation(
      sessionId,
      [
        {
          latitude: point.latitude,
          longitude: point.longitude,
          accuracy: point.accuracy,
          altitude: null,
          speed: null,
          heading: null,
          timestamp: new Date("2025-06-15T18:00:20Z").toISOString(),
        },
      ],
      "dup-key-1", // same key
    );

    // Second call should be a no-op
    expect(result.processed).toBe(0);

    // Only one item should be collected
    const state = getState();
    expect(state.inventory.size).toBe(1);
  });

  it("does not collect when outside geofence", () => {
    // Send a point that's near but not within the spice shop's 35m radius
    // The spice shop is at 37.80977, -122.25488
    // This point is ~100m away
    ingestLocation(
      sessionId,
      [
        {
          latitude: 37.81050,
          longitude: -122.25400,
          accuracy: 10,
          altitude: null,
          speed: null,
          heading: null,
          timestamp: new Date("2025-06-15T18:00:05Z").toISOString(),
        },
      ],
      "far-point-1",
    );

    const state = getState();
    expect(state.inventory.size).toBe(0);
    expect(state.quest!.legs[0].status).toBe("active"); // still active, not reached
  });
});
