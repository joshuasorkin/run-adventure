/**
 * Integration test: error and retry paths for dynamic quest generation (v2).
 * Covers no-places-found, partial failures, over-budget warning, and reduced count fallback.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { startSession } from "@/application/start-session";
import { resetState } from "@/infrastructure/persistence/in-memory-store";
import type { SessionId } from "@/domain/player/player-session";
import type { QuestConfig } from "@/domain/quest/quest-config";

// Track LLM calls
const generateThemePlanMock = vi.fn();
const generateNarrativeMock = vi.fn();

vi.mock("@/infrastructure/providers/llm/openai-quest-planner", () => ({
  generateThemePlan: (...args: unknown[]) => generateThemePlanMock(...args),
  generateNarrative: (...args: unknown[]) => generateNarrativeMock(...args),
  generateQuestPlan: vi.fn(),
}));

// Track Places API calls
const findNearbyPlacesMock = vi.fn();

vi.mock("@/infrastructure/providers/map/google-places-provider", () => {
  class MockGooglePlacesProvider {
    name = "google";
    constructor(_apiKey: string) {}
    async reverseGeocode() { return "123 Test St, Oakland, CA"; }
    async findNearbyPlaces(query: { categories: string[] }) {
      return findNearbyPlacesMock(query);
    }
  }
  return { GooglePlacesProvider: MockGooglePlacesProvider };
});

// Mock the Google Routes provider — return empty matrix (falls back to haversine)
vi.mock("@/infrastructure/providers/routing/google-routes-provider", () => ({
  buildWalkingDistanceMatrix: vi.fn().mockResolvedValue(new Map()),
  matrixDistanceFn: vi.fn(),
}));

vi.mock("@/infrastructure/config/env", () => ({
  env: {
    DATABASE_URL: "file:./dev.db",
    MAP_PROVIDER: "google",
    GOOGLE_MAPS_API_KEY: "test-google-key",
    OPENAI_API_KEY: "test-openai-key",
    LOG_LEVEL: "info",
    GEOFENCE_RADIUS_METERS: 30,
    MAX_RUNNING_SPEED_MS: 12,
    GPS_ACCURACY_THRESHOLD_METERS: 50,
    GPS_SMOOTHING_WINDOW: 3,
  },
}));

const BASE_CONFIG: QuestConfig = {
  startLocation: { latitude: 37.81, longitude: -122.25 },
  maxDistanceMeters: 3000,
  questGoal: "test quest",
  objectiveCount: 3,
};

function makeThemePlan(bucketCount: number) {
  return {
    titleSeed: "Test Quest",
    narrativePremise: "A test adventure.",
    buckets: Array.from({ length: bucketCount }, (_, i) => ({
      bucketId: `bucket-${i}`,
      placeTypes: [["pharmacy", "park", "library", "cafe", "bakery"][i] ?? "store"],
      narrativeHint: `Objective ${i + 1}`,
      thematicStrength: 0.8 - i * 0.1,
    })),
  };
}

function makeNarrative(legCount: number) {
  return {
    title: "Test Quest",
    narrative: "A test adventure.",
    legs: Array.from({ length: legCount }, (_, i) => ({
      objectiveText: `Visit place ${i + 1}`,
      itemName: `Item ${i + 1}`,
      itemDescription: `Description ${i + 1}`,
      itemRarity: "common" as const,
    })),
  };
}

function makePlaceResult(type: string, index: number) {
  const { v4: uuid } = require("uuid");
  return {
    id: uuid(),
    externalId: `gp-${type}-${index}`,
    providerSource: "google",
    name: `${type} Place ${index}`,
    category: type,
    location: { latitude: 37.81 + index * 0.001, longitude: -122.25 + index * 0.001 },
    address: `${index} Test St`,
    isAccessible: true,
    isOutdoor: true,
    radiusMeters: 35,
  };
}

describe("Dynamic quest generation — error and retry paths (v2)", () => {
  let sessionId: SessionId;

  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    const result = startSession();
    sessionId = result.sessionId;
  });

  it("throws when no places are found for any bucket", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    generateThemePlanMock.mockResolvedValue(makeThemePlan(4));
    findNearbyPlacesMock.mockResolvedValue([]); // No places ever

    await expect(generateDynamicQuest(sessionId, BASE_CONFIG)).rejects.toThrow(
      "Could not find any matching places nearby",
    );
  });

  it("succeeds with partial places when some buckets return no results", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    generateThemePlanMock.mockResolvedValue(makeThemePlan(4));
    generateNarrativeMock.mockImplementation((places: unknown[]) =>
      makeNarrative(Array.isArray(places) ? places.length : 1),
    );

    // Only pharmacy returns a place
    findNearbyPlacesMock.mockImplementation((query: { categories: string[] }) => {
      const type = query.categories[0];
      if (type === "pharmacy") return [makePlaceResult("pharmacy", 1)];
      return [];
    });

    const result = await generateDynamicQuest(sessionId, BASE_CONFIG);

    expect(result.quest.legs.length).toBeGreaterThan(0);
    expect(result.placesFound).toBeGreaterThan(0);
  });

  it("handles Places API errors gracefully and continues with other buckets", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    generateThemePlanMock.mockResolvedValue(makeThemePlan(4));
    generateNarrativeMock.mockImplementation((places: unknown[]) =>
      makeNarrative(Array.isArray(places) ? places.length : 1),
    );

    // First type throws, others succeed
    findNearbyPlacesMock.mockImplementation((query: { categories: string[] }) => {
      const type = query.categories[0];
      if (type === "pharmacy") throw new Error("Google API rate limit");
      if (type === "park") return [makePlaceResult("park", 1)];
      if (type === "library") return [makePlaceResult("library", 2)];
      return [];
    });

    const result = await generateDynamicQuest(sessionId, BASE_CONFIG);

    // Should succeed with the buckets that didn't error (2 outbound + 1 home)
    expect(result.quest.legs.length).toBe(3);
  });

  it("deduplicates places across buckets by externalId", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    generateThemePlanMock.mockResolvedValue(makeThemePlan(3));
    generateNarrativeMock.mockImplementation((places: unknown[]) =>
      makeNarrative(Array.isArray(places) ? places.length : 1),
    );

    // All buckets return the same place (same externalId)
    const samePlace = makePlaceResult("pharmacy", 1);
    findNearbyPlacesMock.mockImplementation(() => [samePlace]);

    const result = await generateDynamicQuest(sessionId, BASE_CONFIG);

    // Only one outbound place (deduplicated) + 1 home = 2 legs
    expect(result.quest.legs).toHaveLength(2);
  });

  it("reports routeBudgetWarning when route exceeds maxRouteLength", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    generateThemePlanMock.mockResolvedValue(makeThemePlan(4));
    generateNarrativeMock.mockImplementation((places: unknown[]) =>
      makeNarrative(Array.isArray(places) ? places.length : 1),
    );

    // Return distant places that will exceed a tight budget
    findNearbyPlacesMock.mockImplementation((query: { categories: string[] }) => {
      const type = query.categories[0];
      if (type === "pharmacy") return [makePlaceResult("pharmacy", 10)]; // ~1.1km away
      if (type === "park") return [makePlaceResult("park", 20)];        // ~2.2km away
      if (type === "library") return [makePlaceResult("library", 30)];  // ~3.3km away
      return [];
    });

    const result = await generateDynamicQuest(sessionId, {
      ...BASE_CONFIG,
      maxRouteLength: 10, // impossibly small route budget
    });

    expect(result.routeBudgetWarning).toBeDefined();
    expect(result.routeBudgetWarning).toContain("exceeds");
  });

  it("reduces objectiveCount when no feasible combo at full count", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    generateThemePlanMock.mockResolvedValue(makeThemePlan(4));
    generateNarrativeMock.mockImplementation((places: unknown[]) =>
      makeNarrative(Array.isArray(places) ? places.length : 1),
    );

    // One close place and two far places
    findNearbyPlacesMock.mockImplementation((query: { categories: string[] }) => {
      const type = query.categories[0];
      if (type === "pharmacy") return [makePlaceResult("pharmacy", 1)];  // close
      if (type === "park") return [makePlaceResult("park", 1)];          // close
      if (type === "library") {
        return [{
          ...makePlaceResult("library", 50),
          location: { latitude: 37.86, longitude: -122.30 }, // ~7km away
        }];
      }
      return [];
    });

    // Route budget allows 2 close stops but not the far one
    const result = await generateDynamicQuest(sessionId, {
      ...BASE_CONFIG,
      objectiveCount: 3,
      maxRouteLength: 500,
    });

    // Should reduce to 2 objectives (close places only) and succeed
    expect(result.quest.legs.length).toBeLessThanOrEqual(3);
    expect(result.quest.legs.length).toBeGreaterThan(0);
  });
});
