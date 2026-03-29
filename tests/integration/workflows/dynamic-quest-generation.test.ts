/**
 * Integration test: dynamic quest generation with mocked LLM and Places API.
 * Verifies the full 6-step orchestration: theme plan → candidate pool → scoring →
 * subset selection → routing → narrative generation → quest build.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { startSession } from "@/application/start-session";
import { resetState, getState } from "@/infrastructure/persistence/in-memory-store";
import type { SessionId } from "@/domain/player/player-session";
import type { QuestConfig } from "@/domain/quest/quest-config";

// Mock the OpenAI quest planner — two-phase LLM calls
vi.mock("@/infrastructure/providers/llm/openai-quest-planner", () => ({
  generateThemePlan: vi.fn().mockResolvedValue({
    titleSeed: "The Wellness Patrol",
    narrativePremise: "A mysterious force threatens the neighborhood.",
    buckets: [
      {
        bucketId: "bucket-1",
        placeTypes: ["pharmacy"],
        narrativeHint: "acquire healing supplies",
        thematicStrength: 0.9,
      },
      {
        bucketId: "bucket-2",
        placeTypes: ["park"],
        narrativeHint: "commune with nature",
        thematicStrength: 0.8,
      },
      {
        bucketId: "bucket-3",
        placeTypes: ["library"],
        narrativeHint: "seek ancient knowledge",
        thematicStrength: 0.7,
      },
      {
        bucketId: "bucket-4",
        placeTypes: ["cafe", "bakery"],
        narrativeHint: "gather provisions",
        thematicStrength: 0.5,
      },
    ],
  }),
  generateNarrative: vi.fn().mockResolvedValue({
    title: "The Wellness Patrol",
    narrative: "Restore balance by visiting key locations in the neighborhood.",
    legs: [
      {
        objectiveText: "Run to CVS Pharmacy and acquire healing supplies",
        itemName: "Healing Tonic",
        itemDescription: "A shimmering vial of restorative elixir.",
        itemRarity: "common",
      },
      {
        objectiveText: "Commune with nature at Lakeside Park",
        itemName: "Grove Medallion",
        itemDescription: "A wooden medallion infused with forest energy.",
        itemRarity: "uncommon",
      },
      {
        objectiveText: "Seek ancient knowledge at Oakland Public Library",
        itemName: "Scroll of Insight",
        itemDescription: "A glowing scroll with forgotten truths.",
        itemRarity: "rare",
      },
    ],
  }),
  // Keep legacy export for type compatibility
  generateQuestPlan: vi.fn(),
}));

// Mock the Google Routes provider — return empty matrix (falls back to haversine)
vi.mock("@/infrastructure/providers/routing/google-routes-provider", () => ({
  buildWalkingDistanceMatrix: vi.fn().mockResolvedValue(new Map()),
  matrixDistanceFn: vi.fn(),
}));

// Mock the Google Places provider
vi.mock("@/infrastructure/providers/map/google-places-provider", () => {
  const { v4: uuid } = require("uuid");

  class MockGooglePlacesProvider {
    name = "google";
    constructor(_apiKey: string) {}
    async reverseGeocode() { return "123 Test St, Oakland, CA"; }
    async findNearbyPlaces(query: { categories: string[] }) {
      const type = query.categories[0];
      const places: Record<string, unknown[]> = {
        pharmacy: [
          {
            id: uuid(),
            externalId: "gp-pharmacy-1",
            providerSource: "google",
            name: "CVS Pharmacy",
            category: "pharmacy",
            location: { latitude: 37.8095, longitude: -122.2510 },
            address: "123 Main St",
            isAccessible: true,
            isOutdoor: true,
            radiusMeters: 35,
          },
          {
            id: uuid(),
            externalId: "gp-pharmacy-2",
            providerSource: "google",
            name: "Walgreens",
            category: "pharmacy",
            location: { latitude: 37.8090, longitude: -122.2505 },
            address: "456 Oak Ave",
            isAccessible: true,
            isOutdoor: true,
            radiusMeters: 35,
          },
        ],
        park: [
          {
            id: uuid(),
            externalId: "gp-park-1",
            providerSource: "google",
            name: "Lakeside Park",
            category: "park",
            location: { latitude: 37.8080, longitude: -122.2530 },
            address: "456 Lake Dr",
            isAccessible: true,
            isOutdoor: true,
            radiusMeters: 35,
          },
        ],
        library: [
          {
            id: uuid(),
            externalId: "gp-library-1",
            providerSource: "google",
            name: "Oakland Public Library",
            category: "library",
            location: { latitude: 37.8110, longitude: -122.2480 },
            address: "789 Grand Ave",
            isAccessible: true,
            isOutdoor: true,
            radiusMeters: 35,
          },
        ],
        cafe: [
          {
            id: uuid(),
            externalId: "gp-cafe-1",
            providerSource: "google",
            name: "Blue Bottle Coffee",
            category: "cafe",
            location: { latitude: 37.8100, longitude: -122.2520 },
            address: "321 Lakeshore Ave",
            isAccessible: true,
            isOutdoor: true,
            radiusMeters: 35,
          },
        ],
        bakery: [
          {
            id: uuid(),
            externalId: "gp-bakery-1",
            providerSource: "google",
            name: "Arizmendi Bakery",
            category: "bakery",
            location: { latitude: 37.8105, longitude: -122.2515 },
            address: "654 Grand Ave",
            isAccessible: true,
            isOutdoor: true,
            radiusMeters: 35,
          },
        ],
      };
      return places[type] ?? [];
    }
  }

  return { GooglePlacesProvider: MockGooglePlacesProvider };
});

// Mock env to provide API keys
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

describe("Dynamic quest generation (v2 — pool + select + narrativize)", () => {
  let sessionId: SessionId;

  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    const result = startSession();
    sessionId = result.sessionId;
  });

  it("generates a quest with places from the mocked providers", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    const config: QuestConfig = {
      startLocation: { latitude: 37.8100, longitude: -122.2500 },
      maxDistanceMeters: 3000,
      questGoal: "city wellness sweep",
      objectiveCount: 3,
    };

    const result = await generateDynamicQuest(sessionId, config);

    expect(result.quest).toBeDefined();
    expect(result.quest.title).toBe("The Wellness Patrol");
    expect(result.quest.status).toBe("active");
    expect(result.quest.legs).toHaveLength(3);
    expect(result.quest.legs[0].status).toBe("active");
    expect(result.quest.legs[1].status).toBe("locked");
    expect(result.quest.legs[2].status).toBe("locked");
    expect(result.placesFound).toBeGreaterThan(0);
    expect(result.routeDistanceMeters).toBeGreaterThan(0);

    // Quest is stored in state
    const state = getState();
    expect(state.quest).not.toBeNull();
    expect(state.quest!.id).toBe(result.quest.id);
  });

  it("uses narrative from the second LLM call (actual places)", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");
    const { generateNarrative } = await import(
      "@/infrastructure/providers/llm/openai-quest-planner"
    );

    const config: QuestConfig = {
      startLocation: { latitude: 37.8100, longitude: -122.2500 },
      maxDistanceMeters: 3000,
      questGoal: "city wellness sweep",
      objectiveCount: 3,
    };

    await generateDynamicQuest(sessionId, config);

    // Verify generateNarrative was called with actual place objects
    expect(generateNarrative).toHaveBeenCalledTimes(1);
    const narrativeCall = (generateNarrative as ReturnType<typeof vi.fn>).mock.calls[0];
    const placesArg = narrativeCall[0];
    expect(Array.isArray(placesArg)).toBe(true);
    // 2 outbound + 1 home = 3 places
    expect(placesArg.length).toBe(3);
    // Each place should be a real PlaceCandidate with a name
    expect(placesArg[0].name).toBeDefined();
    // Last place should be the home/start location
    expect(placesArg[placesArg.length - 1].externalId).toBe("home-start");
  });

  it("generates a quest even when fewer places are found than requested", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    // Request 5 objectives but only 4 buckets with places
    const config: QuestConfig = {
      startLocation: { latitude: 37.8100, longitude: -122.2500 },
      maxDistanceMeters: 5000,
      questGoal: "city wellness sweep",
      objectiveCount: 5,
    };

    const result = await generateDynamicQuest(sessionId, config);

    // Should succeed with however many places were found
    expect(result.quest.legs.length).toBeLessThanOrEqual(5);
    expect(result.quest.legs.length).toBeGreaterThan(0);
  });

  it("reports routeDistanceMeters in the result", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    const config: QuestConfig = {
      startLocation: { latitude: 37.8100, longitude: -122.2500 },
      maxDistanceMeters: 3000,
      questGoal: "city wellness sweep",
      objectiveCount: 3,
    };

    const result = await generateDynamicQuest(sessionId, config);

    expect(typeof result.routeDistanceMeters).toBe("number");
    expect(result.routeDistanceMeters).toBeGreaterThan(0);
  });
});
