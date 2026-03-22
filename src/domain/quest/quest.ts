/**
 * Quest, QuestLeg, Objective — the quest progression model.
 * Pure domain entities. No framework imports.
 */

import type { SessionId } from "@/domain/player/player-session";
import type { PlaceCandidate } from "@/domain/place/place-candidate";
import type { InventoryItem } from "@/domain/inventory/inventory-item";

export type QuestId = string & { readonly __brand: unique symbol };
export type QuestLegId = string & { readonly __brand: unique symbol };

export type QuestStatus = "active" | "completed" | "failed" | "expired";
export type LegStatus = "locked" | "active" | "reached" | "completed" | "skipped";

/** What the player needs to do for a quest leg. */
export interface Objective {
  readonly description: string; // e.g. "Run to Lake Merritt Pergola"
  readonly targetPlace: PlaceCandidate;
  readonly geofenceRadiusMeters: number;
}

/** A single leg/step within a quest. */
export interface QuestLeg {
  readonly id: QuestLegId;
  readonly questId: QuestId;
  readonly sequenceIndex: number;
  readonly status: LegStatus;
  readonly objective: Objective;
  readonly rewardItem: InventoryItem;
  readonly reachedAt: Date | null;
  readonly completedAt: Date | null;
}

/** A multi-leg quest assigned to a run session. */
export interface Quest {
  readonly id: QuestId;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly narrative: string;
  readonly status: QuestStatus;
  readonly legs: readonly QuestLeg[];
  readonly currentLegIndex: number;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

/** Get the currently active leg, or null if none. */
export function activeLeg(quest: Quest): QuestLeg | null {
  const leg = quest.legs[quest.currentLegIndex];
  return leg?.status === "active" ? leg : null;
}
