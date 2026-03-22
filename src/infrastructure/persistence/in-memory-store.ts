/**
 * In-memory game store for the alpha milestone.
 * Holds active session, quest state, inventory, and location history.
 * State resets on server restart. Acceptable for dogfooding.
 *
 * Post-alpha: replace with Prisma repositories.
 */

import type { PlayerSession, SessionId, PlayerId } from "@/domain/player/player-session";
import type { LocationSample } from "@/domain/location/location-sample";
import type { Quest, QuestId } from "@/domain/quest/quest";
import type { InventoryItem, ItemId } from "@/domain/inventory/inventory-item";
import type { PlaceId } from "@/domain/place/place-candidate";
import type { GameEvent, IdempotencyKey } from "@/domain/event/game-event";

export interface InventoryRecord {
  readonly item: InventoryItem;
  readonly quantity: number;
  readonly collectedAtPlaceId: PlaceId;
  readonly collectedAt: Date;
}

export interface GameState {
  session: PlayerSession | null;
  quest: Quest | null;
  inventory: Map<ItemId, InventoryRecord>;
  locationHistory: LocationSample[];
  events: GameEvent[];
  processedKeys: Set<IdempotencyKey>;
}

function createEmptyState(): GameState {
  return {
    session: null,
    quest: null,
    inventory: new Map(),
    locationHistory: [],
    events: [],
    processedKeys: new Set(),
  };
}

// Singleton in-memory store
let state: GameState = createEmptyState();

export function getState(): GameState {
  return state;
}

export function resetState(): void {
  state = createEmptyState();
}

export function setSession(session: PlayerSession): void {
  state.session = session;
}

export function setQuest(quest: Quest): void {
  state.quest = quest;
}

export function addLocationSample(sample: LocationSample): void {
  state.locationHistory.push(sample);
}

export function addInventoryItem(
  item: InventoryItem,
  placeId: PlaceId,
): void {
  const existing = state.inventory.get(item.id);
  if (existing) {
    state.inventory.set(item.id, {
      ...existing,
      quantity: existing.quantity + 1,
      collectedAt: new Date(),
    });
  } else {
    state.inventory.set(item.id, {
      item,
      quantity: 1,
      collectedAtPlaceId: placeId,
      collectedAt: new Date(),
    });
  }
}

export function addEvent(event: GameEvent): void {
  state.events.push(event);
}

export function hasProcessedKey(key: IdempotencyKey): boolean {
  return state.processedKeys.has(key);
}

export function markKeyProcessed(key: IdempotencyKey): void {
  state.processedKeys.add(key);
}
