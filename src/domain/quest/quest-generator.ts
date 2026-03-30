/**
 * Quest generator — builds a Quest from a sequence of PlaceCandidates.
 * Pure domain logic. No framework imports.
 */

import { v4 as uuid } from "uuid";
import type { SessionId } from "@/domain/player/player-session";
import type { PlaceCandidate } from "@/domain/place/place-candidate";
import type { InventoryItem, ItemId } from "@/domain/inventory/inventory-item";
import type { Quest, QuestLeg, QuestId, QuestLegId } from "@/domain/quest/quest";

function questId(): QuestId {
  return uuid() as QuestId;
}
function legId(): QuestLegId {
  return uuid() as QuestLegId;
}
function itemId(): ItemId {
  return uuid() as ItemId;
}

export interface QuestLegTemplate {
  readonly place: PlaceCandidate;
  readonly objectiveText: string;
  readonly rewardItem: InventoryItem;
  readonly approachNarration?: readonly string[];
}

/**
 * Generate a quest from an ordered list of leg templates.
 * First leg starts active, rest are locked.
 */
export function generateQuest(
  sessionId: SessionId,
  title: string,
  narrative: string,
  legTemplates: readonly QuestLegTemplate[],
): Quest {
  if (legTemplates.length === 0) {
    throw new Error("Quest must have at least one leg");
  }

  const qId = questId();

  const legs: QuestLeg[] = legTemplates.map((template, index) => ({
    id: legId(),
    questId: qId,
    sequenceIndex: index,
    status: index === 0 ? "active" : "locked",
    objective: {
      description: template.objectiveText,
      targetPlace: template.place,
      geofenceRadiusMeters: template.place.radiusMeters,
    },
    rewardItem: template.rewardItem,
    approachNarration: template.approachNarration ?? [],
    reachedAt: null,
    completedAt: null,
  }));

  return {
    id: qId,
    sessionId,
    title,
    narrative,
    status: "active",
    legs,
    currentLegIndex: 0,
    createdAt: new Date(),
    completedAt: null,
  };
}

/** Helper to make a simple item for the alpha quest chain. */
export function makeAlphaItem(name: string, description: string): InventoryItem {
  return {
    id: itemId(),
    name,
    description,
    rarity: "common",
    iconKey: name.toLowerCase().replace(/\s+/g, "-"),
  };
}
