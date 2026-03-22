/**
 * Integration test: dynamic quest generation with mocked LLM and Places API.
 * Verifies the full orchestration: LLM → places search → route plan → quest build.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { startSession } from "@/application/start-session";
import { resetState, getState } from "@/infrastructure/persistence/in-memory-store";
import type { SessionId } from "@/domain/player/player-session";
import type { QuestConfig } from "@/domain/quest/quest-config";

// Mock the OpenAI quest planner
vi.mock("@/infrastructure/providers/llm/openai-quest-planner", () => ({
  generateQuestPlan: vi.fn().mockResolvedValue({
    title: "The Wellness Patrol",
    narrative: "A mysterious force threatens the neighborhood. Restore balance by visiting key locations.",
    legs: [
      {
        googlePlacesType: "pharmacy",
        objectiveText: "Acquire healing supplies at the apothecary",
        itemName: "Healing Tonic",
        itemDescription: "A shimmering vial of restorative elixir.",
        itemRarity: "common",
      },
      {
        googlePlacesType: "park",
        objectiveText: "Commune with nature at the sacred grove",
        itemName: "Grove Medallion",
        itemDescription: "A wooden medallion infused with forest energy.",
        itemRarity: "uncommon",
      },
      {
        googlePlacesType: "library",
        objectiveText: "Seek ancient knowledge at the hall of wisdom",
        itemName: "Scroll of Insight",
        itemDescription: "A glowing scroll with forgotten truths.",
        itemRarity: "rare",
      },
    ],
  }),
}));

// Mock the Google Places provider
vi.mock("@/infrastructure/providers/map/google-places-provider", () => {
  const { v4: uuid } = require("uuid");

  class MockGooglePlacesProvider {
    name = "google";
    constructor(_apiKey: string) {}
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

describe("Dynamic quest generation", () => {
  let sessionId: SessionId;

  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    const result = startSession();
    sessionId = result.sessionId;
  });

  it("generates a quest with places from the mocked providers", async () => {
    // Import after mocks are set up
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
    expect(result.placesFound).toBe(3);

    // Quest is stored in state
    const state = getState();
    expect(state.quest).not.toBeNull();
    expect(state.quest!.id).toBe(result.quest.id);
  });

  it("generates a quest even when fewer places are found than requested", async () => {
    const { generateDynamicQuest } = await import("@/application/generate-quest");

    // Request 5 objectives but only 3 place types will return results
    const config: QuestConfig = {
      startLocation: { latitude: 37.8100, longitude: -122.2500 },
      maxDistanceMeters: 5000,
      questGoal: "city wellness sweep",
      objectiveCount: 5,
    };

    const result = await generateDynamicQuest(sessionId, config);

    // Should succeed with the 3 places it found
    expect(result.quest.legs.length).toBeLessThanOrEqual(5);
    expect(result.quest.legs.length).toBeGreaterThan(0);
  });
});
