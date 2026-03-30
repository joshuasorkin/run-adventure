/**
 * Tests for distance-based approach narration:
 * - computeApproachTier() pure function
 * - Approach narration delivery via ingestLocation()
 * - Wrong turn (retreat + re-approach) behavior
 */

import { describe, it, expect, beforeEach } from "vitest";
import { computeApproachTier, ingestLocation } from "@/application/ingest-location";
import {
  resetState,
  setSession,
  setQuest,
  getApproachState,
} from "@/infrastructure/persistence/in-memory-store";
import {
  makeSession,
  makePlaceCandidate,
  makeItem,
} from "@tests/fixtures/factories";
import type { SessionId } from "@/domain/player/player-session";
import type { Quest, QuestLeg, QuestLegId, QuestId } from "@/domain/quest/quest";
import { v4 as uuid } from "uuid";

// --- computeApproachTier unit tests ---

describe("computeApproachTier", () => {
  it("returns -1 when totalTiers is 0", () => {
    expect(computeApproachTier(200, 0)).toBe(-1);
  });

  it("returns -1 when runner is beyond all tiers", () => {
    // 5 tiers covers thresholds at 250, 200, 150, 100, 50m
    // Beyond 250m → tier -1
    expect(computeApproachTier(300, 5)).toBe(-1);
    expect(computeApproachTier(250, 5)).toBe(-1);
  });

  it("returns tier 0 (farthest) when just crossing the outermost threshold", () => {
    // 5 tiers: tier 0 fires when distance < 250m
    expect(computeApproachTier(249, 5)).toBe(0);
  });

  it("returns correct tiers at exact 50m boundaries", () => {
    // 5 tiers for 300m leg
    expect(computeApproachTier(199, 5)).toBe(1); // crossed below 200m
    expect(computeApproachTier(149, 5)).toBe(2); // crossed below 150m
    expect(computeApproachTier(99, 5)).toBe(3);  // crossed below 100m
    expect(computeApproachTier(49, 5)).toBe(4);  // crossed below 50m
  });

  it("returns last tier when very close", () => {
    expect(computeApproachTier(10, 5)).toBe(4);
    expect(computeApproachTier(0, 5)).toBe(4);
  });

  it("clamps to totalTiers - 1", () => {
    // Even at distance 0, should not exceed totalTiers - 1
    expect(computeApproachTier(0, 3)).toBe(2);
  });

  it("handles single tier", () => {
    // 1 tier: fires when distance < 50m
    expect(computeApproachTier(60, 1)).toBe(-1);
    expect(computeApproachTier(49, 1)).toBe(0);
  });

  it("handles many tiers for long distances", () => {
    // 15 tiers for ~800m leg
    expect(computeApproachTier(749, 15)).toBe(0);  // just crossed into outermost tier
    expect(computeApproachTier(49, 15)).toBe(14);   // closest tier
  });
});

// --- Integration: approach narration via ingestLocation ---

function makeTestQuest(session: { id: SessionId }, approachNarration: string[]): Quest {
  const qId = uuid() as QuestId;
  // Target at a known location: 37.8105, -122.2534
  const targetPlace = makePlaceCandidate({
    name: "Test Place",
    location: { latitude: 37.8105, longitude: -122.2534 },
  });
  const leg: QuestLeg = {
    id: uuid() as QuestLegId,
    questId: qId,
    sequenceIndex: 0,
    status: "active",
    objective: {
      description: "Find the Test Orb",
      targetPlace,
      geofenceRadiusMeters: 30,
    },
    rewardItem: makeItem(),
    approachNarration,
    reachedAt: null,
    completedAt: null,
  };

  return {
    id: qId,
    sessionId: session.id,
    title: "Test Quest",
    narrative: "A test quest",
    status: "active",
    legs: [leg],
    currentLegIndex: 0,
    createdAt: new Date(),
    completedAt: null,
  };
}

describe("approach narration in ingestLocation", () => {
  const session = makeSession();
  const narration = [
    "A faint hum echoes from afar.",      // tier 0 (farthest, ~250m)
    "The hum grows louder.",               // tier 1 (~200m)
    "Energy crackles in the air.",         // tier 2 (~150m)
    "The orb's glow is visible ahead.",    // tier 3 (~100m)
    "The orb pulses with immense power.",  // tier 4 (closest, ~50m)
  ];

  beforeEach(() => {
    resetState();
    setSession(session);
  });

  it("returns null narration when runner is too far away", () => {
    const quest = makeTestQuest(session, narration);
    setQuest(quest);

    // Send a point ~400m away (well beyond all tiers)
    const result = ingestLocation(session.id, [{
      latitude: 37.8140,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date().toISOString(),
    }], "key-far");

    expect(result.approachNarration).toBeNull();
  });

  it("returns tier narration when runner crosses a threshold", () => {
    const quest = makeTestQuest(session, narration);
    setQuest(quest);

    // Send a point ~200m away (should trigger tier 1)
    // 200m north of target: ~0.0018 degrees latitude
    const result = ingestLocation(session.id, [{
      latitude: 37.8123,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date().toISOString(),
    }], "key-200m");

    expect(result.approachNarration).not.toBeNull();
    // Should be one of the narration tiers
    expect(narration).toContain(result.approachNarration);
  });

  it("returns null narration when quest has no approach narration", () => {
    const quest = makeTestQuest(session, []);
    setQuest(quest);

    const result = ingestLocation(session.id, [{
      latitude: 37.8115,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date().toISOString(),
    }], "key-no-narration");

    expect(result.approachNarration).toBeNull();
  });

  it("does not re-announce the same tier on repeated GPS points", () => {
    const quest = makeTestQuest(session, narration);
    setQuest(quest);

    // First point at ~120m
    const result1 = ingestLocation(session.id, [{
      latitude: 37.81158,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
    }], "key-a");

    expect(result1.approachNarration).not.toBeNull();

    // Second point at ~115m (same tier band) — 16s later to clear pacing
    const result2 = ingestLocation(session.id, [{
      latitude: 37.81155,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date("2025-01-01T00:00:16Z").toISOString(),
    }], "key-b");

    expect(result2.approachNarration).toBeNull();
  });

  it("silently downgrades tier on wrong turn, re-announces on re-approach", () => {
    const quest = makeTestQuest(session, narration);
    setQuest(quest);

    // Approach to ~120m (triggers a tier)
    ingestLocation(session.id, [{
      latitude: 37.81158,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date("2025-01-01T00:00:00Z").toISOString(),
    }], "key-1");

    const approachBefore = getApproachState(0);
    const tierBefore = approachBefore.lastAnnouncedTierIndex;
    expect(tierBefore).toBeGreaterThanOrEqual(0);

    // Move away to ~300m (beyond all tiers) — allow 60s to stay under velocity limit
    ingestLocation(session.id, [{
      latitude: 37.8132,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date("2025-01-01T00:01:00Z").toISOString(),
    }], "key-2");

    const approachAfterRetreat = getApproachState(0);
    expect(approachAfterRetreat.lastAnnouncedTierIndex).toBeLessThan(tierBefore);

    // Re-approach to ~120m again (should re-announce) — allow 60s
    const result3 = ingestLocation(session.id, [{
      latitude: 37.81158,
      longitude: -122.2534,
      accuracy: 10,
      altitude: null,
      speed: null,
      heading: null,
      timestamp: new Date("2025-01-01T00:02:00Z").toISOString(),
    }], "key-3");

    expect(result3.processed).toBe(1);
    const approachAfterReapproach = getApproachState(0);
    expect(approachAfterReapproach.lastAnnouncedTierIndex).toBeGreaterThan(approachAfterRetreat.lastAnnouncedTierIndex);
    expect(result3.approachNarration).not.toBeNull();
  });
});
