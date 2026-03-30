/**
 * Test entity factories — create domain objects with sensible defaults.
 * Override any field by passing a partial.
 */

import { v4 as uuid } from "uuid";
import type { PlayerSession, SessionId, PlayerId } from "@/domain/player/player-session";
import type { LocationSample, LocationSampleId, Coordinates } from "@/domain/location/location-sample";
import type { PlaceCandidate, PlaceId, PlaceCategory } from "@/domain/place/place-candidate";
import type { Quest, QuestLeg, QuestId, QuestLegId } from "@/domain/quest/quest";
import type { InventoryItem, ItemId } from "@/domain/inventory/inventory-item";
import type { ObjectiveBucket, ThemeSchema } from "@/domain/quest/theme-schema";
import type { ScoredCandidate } from "@/domain/quest/candidate-scorer";

// --- Coordinates ---

/** Adams Point, Oakland — center of test area */
export const ADAMS_POINT_CENTER: Coordinates = {
  latitude: 37.8105,
  longitude: -122.2534,
};

/** Lake Merritt Pergola */
export const LAKE_MERRITT_PERGOLA: Coordinates = {
  latitude: 37.80838,
  longitude: -122.24957,
};

/** Fairyland entrance */
export const FAIRYLAND_ENTRANCE: Coordinates = {
  latitude: 37.8083,
  longitude: -122.2603,
};

// --- Factories ---

export function makeSessionId(): SessionId {
  return uuid() as SessionId;
}

export function makePlayerId(): PlayerId {
  return uuid() as PlayerId;
}

export function makeSession(overrides: Partial<PlayerSession> = {}): PlayerSession {
  return {
    id: makeSessionId(),
    playerId: makePlayerId(),
    status: "active",
    startedAt: new Date("2025-06-15T10:00:00Z"),
    endedAt: null,
    lastLocationAt: null,
    distanceMeters: 0,
    activeQuestId: null,
    ...overrides,
  };
}

export function makeSampleId(): LocationSampleId {
  return uuid() as LocationSampleId;
}

export function makeLocationSample(overrides: Partial<LocationSample> = {}): LocationSample {
  return {
    id: makeSampleId(),
    sessionId: makeSessionId(),
    latitude: ADAMS_POINT_CENTER.latitude,
    longitude: ADAMS_POINT_CENTER.longitude,
    accuracy: 10,
    altitude: null,
    speed: null,
    heading: null,
    timestamp: new Date("2025-06-15T10:00:00Z"),
    receivedAt: new Date("2025-06-15T10:00:01Z"),
    ...overrides,
  };
}

export function makePlaceId(): PlaceId {
  return uuid() as PlaceId;
}

export function makePlaceCandidate(overrides: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    id: makePlaceId(),
    externalId: `fixture-${uuid().slice(0, 8)}`,
    providerSource: "fixture",
    name: "Test Place",
    category: "landmark" as PlaceCategory,
    location: LAKE_MERRITT_PERGOLA,
    address: "Oakland, CA",
    isAccessible: true,
    isOutdoor: true,
    radiusMeters: 30,
    ...overrides,
  };
}

export function makeItemId(): ItemId {
  return uuid() as ItemId;
}

export function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: makeItemId(),
    name: "Mystic Feather",
    description: "A shimmering feather found near the lake.",
    rarity: "common",
    iconKey: "feather",
    ...overrides,
  };
}

export function makeQuestId(): QuestId {
  return uuid() as QuestId;
}

export function makeQuestLegId(): QuestLegId {
  return uuid() as QuestLegId;
}

export function makeQuestLeg(overrides: Partial<QuestLeg> = {}): QuestLeg {
  const questId = makeQuestId();
  return {
    id: makeQuestLegId(),
    questId,
    sequenceIndex: 0,
    status: "locked",
    objective: {
      description: "Run to the Pergola",
      targetPlace: makePlaceCandidate(),
      geofenceRadiusMeters: 30,
    },
    rewardItem: makeItem(),
    approachNarration: [],
    reachedAt: null,
    completedAt: null,
    ...overrides,
  };
}

// --- Theme / Scoring Factories ---

let bucketCounter = 0;

export function makeObjectiveBucket(overrides: Partial<ObjectiveBucket> = {}): ObjectiveBucket {
  bucketCounter++;
  return {
    bucketId: `bucket-${bucketCounter}`,
    placeTypes: ["park"],
    narrativeHint: "explore the area",
    thematicStrength: 0.8,
    ...overrides,
  };
}

export function makeThemeSchema(overrides: Partial<ThemeSchema> = {}): ThemeSchema {
  return {
    titleSeed: "The Grand Quest",
    narrativePremise: "A mysterious adventure awaits.",
    buckets: [makeObjectiveBucket(), makeObjectiveBucket({ placeTypes: ["library"] })],
    ...overrides,
  };
}

export function makeScoredCandidate(
  overrides: Partial<ScoredCandidate> = {},
): ScoredCandidate {
  return {
    place: makePlaceCandidate(),
    bucketId: `bucket-${bucketCounter++}`,
    thematicStrength: 0.8,
    distanceFromStart: 200,
    score: 0.7,
    ...overrides,
  };
}

// --- Quest Factories ---

export function makeQuest(overrides: Partial<Quest> = {}): Quest {
  const id = overrides.id ?? makeQuestId();
  const sessionId = overrides.sessionId ?? makeSessionId();

  const defaultLegs: QuestLeg[] = [
    makeQuestLeg({ questId: id, sequenceIndex: 0, status: "active" }),
    makeQuestLeg({ questId: id, sequenceIndex: 1, status: "locked" }),
  ];

  return {
    id,
    sessionId,
    title: "The Lakeside Expedition",
    narrative: "Explore the shores of Lake Merritt.",
    status: "active",
    legs: defaultLegs,
    currentLegIndex: 0,
    createdAt: new Date("2025-06-15T10:00:00Z"),
    completedAt: null,
    ...overrides,
  };
}
