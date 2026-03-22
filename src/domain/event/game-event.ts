/**
 * Game events — discriminated union for all domain events.
 * Includes CollectionEvent and ProgressEvent from architecture.md.
 * Pure domain types. No framework imports.
 */

import type { SessionId } from "@/domain/player/player-session";
import type { LocationSampleId } from "@/domain/location/location-sample";
import type { QuestId, QuestLegId } from "@/domain/quest/quest";
import type { ItemId } from "@/domain/inventory/inventory-item";
import type { PlaceId } from "@/domain/place/place-candidate";

export type GameEventId = string & { readonly __brand: unique symbol };
export type IdempotencyKey = string;

/** CollectionEvent — player collected an item by passing a target. */
export interface CollectionEvent {
  readonly type: "ITEM_COLLECTED";
  readonly questId: QuestId;
  readonly legId: QuestLegId;
  readonly itemId: ItemId;
  readonly placeId: PlaceId;
  readonly timestamp: Date;
}

/** ProgressEvent — quest or leg state advanced. */
export type ProgressEvent =
  | { readonly type: "QUEST_GENERATED"; readonly questId: QuestId; readonly sessionId: SessionId; readonly timestamp: Date }
  | { readonly type: "LEG_ACTIVATED"; readonly questId: QuestId; readonly legId: QuestLegId; readonly timestamp: Date }
  | { readonly type: "TARGET_REACHED"; readonly questId: QuestId; readonly legId: QuestLegId; readonly placeId: PlaceId; readonly timestamp: Date }
  | { readonly type: "LEG_COMPLETED"; readonly questId: QuestId; readonly legId: QuestLegId; readonly timestamp: Date }
  | { readonly type: "QUEST_COMPLETED"; readonly questId: QuestId; readonly timestamp: Date };

/** All domain events. */
export type GameEvent =
  | { readonly type: "SESSION_STARTED"; readonly sessionId: SessionId; readonly timestamp: Date }
  | { readonly type: "SESSION_ENDED"; readonly sessionId: SessionId; readonly timestamp: Date }
  | { readonly type: "LOCATION_RECORDED"; readonly sessionId: SessionId; readonly sampleId: LocationSampleId; readonly timestamp: Date }
  | CollectionEvent
  | ProgressEvent
  | { readonly type: "VELOCITY_VIOLATION"; readonly sessionId: SessionId; readonly speedMs: number; readonly timestamp: Date };

/** Stored event with idempotency key for duplicate protection. */
export interface StoredGameEvent {
  readonly id: GameEventId;
  readonly idempotencyKey: IdempotencyKey;
  readonly event: GameEvent;
  readonly processedAt: Date;
}
