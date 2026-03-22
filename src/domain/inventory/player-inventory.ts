/**
 * PlayerInventory — the items a player has collected.
 * Pure domain entity. No framework imports.
 */

import type { PlayerId } from "@/domain/player/player-session";
import type { ItemId, InventoryItem } from "@/domain/inventory/inventory-item";
import type { PlaceId } from "@/domain/place/place-candidate";
import type { QuestId } from "@/domain/quest/quest";

export interface InventoryEntry {
  readonly item: InventoryItem;
  readonly quantity: number;
  readonly firstCollectedAt: Date;
  readonly lastCollectedAt: Date;
  readonly collectedAtPlaceId: PlaceId;
  readonly collectedDuringQuestId: QuestId;
}

export interface PlayerInventory {
  readonly playerId: PlayerId;
  readonly entries: readonly InventoryEntry[];
}
