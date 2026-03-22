/**
 * ingestLocation use case — the core game loop.
 *
 * 1. Check idempotency
 * 2. Validate & persist GPS samples
 * 3. Check proximity to active quest leg target
 * 4. If within geofence: reach target → collect item → advance quest
 * 5. Return updated state
 */

import { v4 as uuid } from "uuid";
import type { LocationSample, LocationSampleId, Coordinates } from "@/domain/location/location-sample";
import type { SessionId } from "@/domain/player/player-session";
import type { Quest } from "@/domain/quest/quest";
import { activeLeg } from "@/domain/quest/quest";
import { checkProximity } from "@/domain/location/geofence";
import { checkVelocity } from "@/domain/location/velocity-check";
import { transitionQuest } from "@/domain/quest/quest-state-machine";
import type { GameEvent } from "@/domain/event/game-event";
import {
  getState,
  addLocationSample,
  setQuest,
  addInventoryItem,
  addEvent,
  hasProcessedKey,
  markKeyProcessed,
} from "@/infrastructure/persistence/in-memory-store";

export interface LocationInput {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
  readonly altitude: number | null;
  readonly speed: number | null;
  readonly heading: number | null;
  readonly timestamp: string; // ISO 8601
}

export interface IngestResult {
  readonly processed: number;
  readonly rejected: number;
  readonly questUpdate: QuestUpdate | null;
  readonly events: readonly GameEvent[];
}

export interface QuestUpdate {
  readonly type: "TARGET_REACHED" | "ITEM_COLLECTED" | "LEG_COMPLETED" | "QUEST_COMPLETED" | "LEG_ACTIVATED";
  readonly legIndex: number;
  readonly itemName: string | null;
  readonly nextObjective: string | null;
  readonly questCompleted: boolean;
}

export function ingestLocation(
  sessionId: SessionId,
  points: readonly LocationInput[],
  idempotencyKey: string,
): IngestResult {
  // 1. Idempotency check
  if (hasProcessedKey(idempotencyKey)) {
    return { processed: 0, rejected: 0, questUpdate: null, events: [] };
  }

  const state = getState();
  if (!state.session || state.session.id !== sessionId) {
    throw new Error(`No active session with id ${sessionId}`);
  }

  let processed = 0;
  let rejected = 0;
  const emittedEvents: GameEvent[] = [];
  let questUpdate: QuestUpdate | null = null;

  // 2. Process each GPS point
  for (const point of points) {
    // Velocity check against last known location
    const lastSample = state.locationHistory[state.locationHistory.length - 1];
    if (lastSample) {
      const velocityResult = checkVelocity(
        { latitude: lastSample.latitude, longitude: lastSample.longitude, timestamp: lastSample.timestamp },
        { latitude: point.latitude, longitude: point.longitude, timestamp: new Date(point.timestamp) },
      );
      if (!velocityResult.isValid) {
        rejected++;
        continue;
      }
    }

    // Persist location sample
    const sample: LocationSample = {
      id: uuid() as LocationSampleId,
      sessionId,
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy,
      altitude: point.altitude,
      speed: point.speed,
      heading: point.heading,
      timestamp: new Date(point.timestamp),
      receivedAt: new Date(),
    };
    addLocationSample(sample);
    processed++;

    // 3. Proximity check against active quest leg
    if (state.quest && state.quest.status === "active") {
      const leg = activeLeg(state.quest);
      if (leg) {
        const playerCoords: Coordinates = {
          latitude: point.latitude,
          longitude: point.longitude,
        };
        const targetCoords = leg.objective.targetPlace.location;
        const radius = leg.objective.geofenceRadiusMeters;

        const proximity = checkProximity(playerCoords, targetCoords, radius);

        if (proximity.isWithinGeofence) {
          // 4. Run the full progression: reach → collect → advance
          questUpdate = progressQuest(state.quest, emittedEvents);
        }
      }
    }
  }

  // Mark idempotency key
  markKeyProcessed(idempotencyKey);

  // Persist events
  for (const event of emittedEvents) {
    addEvent(event);
  }

  return { processed, rejected, questUpdate, events: emittedEvents };
}

/**
 * Progress quest through reach → collect → advance (or complete).
 * Mutates the in-memory store. Returns a QuestUpdate summary.
 */
function progressQuest(
  quest: Quest,
  events: GameEvent[],
): QuestUpdate {
  const leg = activeLeg(quest)!;
  const now = new Date();

  // Step 1: REACH_TARGET
  let result = transitionQuest(quest, {
    type: "REACH_TARGET",
    legId: leg.id,
    placeId: leg.objective.targetPlace.id,
    timestamp: now,
  });
  events.push(...result.events);
  quest = result.quest;

  // Step 2: COLLECT_ITEM
  result = transitionQuest(quest, {
    type: "COLLECT_ITEM",
    legId: leg.id,
    itemId: leg.rewardItem.id,
    placeId: leg.objective.targetPlace.id,
    timestamp: now,
  });
  events.push(...result.events);
  quest = result.quest;

  // Add item to inventory
  addInventoryItem(leg.rewardItem, leg.objective.targetPlace.id);

  // Step 3: Check if quest is complete or activate next leg
  const allDone = quest.legs.every(
    (l) => l.status === "completed" || l.status === "skipped",
  );

  if (allDone) {
    result = transitionQuest(quest, { type: "COMPLETE_QUEST", timestamp: now });
    events.push(...result.events);
    quest = result.quest;
    setQuest(quest);

    return {
      type: "QUEST_COMPLETED",
      legIndex: quest.currentLegIndex,
      itemName: leg.rewardItem.name,
      nextObjective: null,
      questCompleted: true,
    };
  }

  // Activate next leg
  const nextIndex = quest.currentLegIndex + 1;
  if (nextIndex < quest.legs.length) {
    result = transitionQuest(quest, { type: "ACTIVATE_LEG", legIndex: nextIndex });
    events.push(...result.events);
    quest = result.quest;
  }

  setQuest(quest);

  const nextLeg = activeLeg(quest);
  return {
    type: "LEG_ACTIVATED",
    legIndex: quest.currentLegIndex,
    itemName: leg.rewardItem.name,
    nextObjective: nextLeg?.objective.description ?? null,
    questCompleted: false,
  };
}
