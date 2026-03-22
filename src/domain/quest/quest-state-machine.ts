/**
 * Quest state machine — pure function transitions.
 * Given current quest state + action, returns new quest state + emitted events.
 * No framework imports. No side effects. Fully deterministic.
 *
 * Leg: locked → active → reached → completed (or active → skipped)
 * Quest: active → completed (all legs done) | failed | expired
 */

import type {
  Quest,
  QuestLeg,
  QuestId,
  QuestLegId,
  LegStatus,
  QuestStatus,
} from "@/domain/quest/quest";
import type { PlaceId } from "@/domain/place/place-candidate";
import type { ItemId } from "@/domain/inventory/inventory-item";
import type { GameEvent } from "@/domain/event/game-event";

// --- Actions ---

export type QuestAction =
  | { readonly type: "ACTIVATE_LEG"; readonly legIndex: number }
  | { readonly type: "REACH_TARGET"; readonly legId: QuestLegId; readonly placeId: PlaceId; readonly timestamp: Date }
  | { readonly type: "COLLECT_ITEM"; readonly legId: QuestLegId; readonly itemId: ItemId; readonly placeId: PlaceId; readonly timestamp: Date }
  | { readonly type: "SKIP_LEG"; readonly legId: QuestLegId; readonly reason: string }
  | { readonly type: "COMPLETE_QUEST"; readonly timestamp: Date }
  | { readonly type: "FAIL_QUEST"; readonly reason: string }
  | { readonly type: "EXPIRE_QUEST" };

// --- Result ---

export interface QuestTransitionResult {
  readonly quest: Quest;
  readonly events: readonly GameEvent[];
}

// --- Errors ---

export class InvalidTransitionError extends Error {
  constructor(
    public readonly questId: QuestId,
    public readonly action: QuestAction,
    public readonly reason: string,
  ) {
    super(
      `Invalid transition on quest ${questId}: ${action.type} — ${reason}`,
    );
    this.name = "InvalidTransitionError";
  }
}

// --- Transition function ---

export function transitionQuest(
  quest: Quest,
  action: QuestAction,
): QuestTransitionResult {
  switch (action.type) {
    case "ACTIVATE_LEG":
      return activateLeg(quest, action.legIndex);
    case "REACH_TARGET":
      return reachTarget(quest, action.legId, action.placeId, action.timestamp);
    case "COLLECT_ITEM":
      return collectItem(quest, action.legId, action.itemId, action.placeId, action.timestamp);
    case "SKIP_LEG":
      return skipLeg(quest, action.legId);
    case "COMPLETE_QUEST":
      return completeQuest(quest, action.timestamp);
    case "FAIL_QUEST":
      return failQuest(quest, action.reason);
    case "EXPIRE_QUEST":
      return expireQuest(quest);
  }
}

// --- Internal transitions ---

function activateLeg(
  quest: Quest,
  legIndex: number,
): QuestTransitionResult {
  assertQuestStatus(quest, "active");

  const leg = quest.legs[legIndex];
  if (!leg) {
    throw new InvalidTransitionError(quest.id, { type: "ACTIVATE_LEG", legIndex }, "leg index out of bounds");
  }
  if (leg.status !== "locked") {
    throw new InvalidTransitionError(quest.id, { type: "ACTIVATE_LEG", legIndex }, `leg status is ${leg.status}, expected locked`);
  }

  const updatedLeg: QuestLeg = { ...leg, status: "active" };
  const updatedQuest: Quest = {
    ...quest,
    currentLegIndex: legIndex,
    legs: replaceLeg(quest.legs, legIndex, updatedLeg),
  };

  return {
    quest: updatedQuest,
    events: [
      {
        type: "LEG_ACTIVATED",
        questId: quest.id,
        legId: leg.id,
        timestamp: new Date(),
      },
    ],
  };
}

function reachTarget(
  quest: Quest,
  legId: QuestLegId,
  placeId: PlaceId,
  timestamp: Date,
): QuestTransitionResult {
  assertQuestStatus(quest, "active");

  const { leg, index } = findLeg(quest, legId);
  if (leg.status !== "active") {
    throw new InvalidTransitionError(quest.id, { type: "REACH_TARGET", legId, placeId, timestamp }, `leg status is ${leg.status}, expected active`);
  }

  const updatedLeg: QuestLeg = { ...leg, status: "reached", reachedAt: timestamp };
  const updatedQuest: Quest = {
    ...quest,
    legs: replaceLeg(quest.legs, index, updatedLeg),
  };

  return {
    quest: updatedQuest,
    events: [
      {
        type: "TARGET_REACHED",
        questId: quest.id,
        legId,
        placeId,
        timestamp,
      },
    ],
  };
}

function collectItem(
  quest: Quest,
  legId: QuestLegId,
  itemId: ItemId,
  placeId: PlaceId,
  timestamp: Date,
): QuestTransitionResult {
  assertQuestStatus(quest, "active");

  const { leg, index } = findLeg(quest, legId);
  if (leg.status !== "reached") {
    throw new InvalidTransitionError(
      quest.id,
      { type: "COLLECT_ITEM", legId, itemId, placeId, timestamp },
      `leg status is ${leg.status}, expected reached`,
    );
  }

  const updatedLeg: QuestLeg = { ...leg, status: "completed", completedAt: timestamp };
  const updatedQuest: Quest = {
    ...quest,
    legs: replaceLeg(quest.legs, index, updatedLeg),
  };

  const events: GameEvent[] = [
    {
      type: "ITEM_COLLECTED",
      questId: quest.id,
      legId,
      itemId,
      placeId,
      timestamp,
    },
    {
      type: "LEG_COMPLETED",
      questId: quest.id,
      legId,
      timestamp,
    },
  ];

  return { quest: updatedQuest, events };
}

function skipLeg(
  quest: Quest,
  legId: QuestLegId,
): QuestTransitionResult {
  assertQuestStatus(quest, "active");

  const { leg, index } = findLeg(quest, legId);
  if (leg.status !== "active") {
    throw new InvalidTransitionError(quest.id, { type: "SKIP_LEG", legId, reason: "" }, `leg status is ${leg.status}, expected active`);
  }

  const updatedLeg: QuestLeg = { ...leg, status: "skipped" };
  const updatedQuest: Quest = {
    ...quest,
    legs: replaceLeg(quest.legs, index, updatedLeg),
  };

  return { quest: updatedQuest, events: [] };
}

function completeQuest(quest: Quest, timestamp: Date): QuestTransitionResult {
  assertQuestStatus(quest, "active");

  const allDone = quest.legs.every(
    (l) => l.status === "completed" || l.status === "skipped",
  );
  if (!allDone) {
    throw new InvalidTransitionError(quest.id, { type: "COMPLETE_QUEST", timestamp }, "not all legs are completed or skipped");
  }

  const updatedQuest: Quest = {
    ...quest,
    status: "completed",
    completedAt: timestamp,
  };

  return {
    quest: updatedQuest,
    events: [
      {
        type: "QUEST_COMPLETED",
        questId: quest.id,
        timestamp,
      },
    ],
  };
}

function failQuest(quest: Quest, reason: string): QuestTransitionResult {
  assertQuestStatus(quest, "active");
  return {
    quest: { ...quest, status: "failed" },
    events: [],
  };
}

function expireQuest(quest: Quest): QuestTransitionResult {
  assertQuestStatus(quest, "active");
  return {
    quest: { ...quest, status: "expired" },
    events: [],
  };
}

// --- Helpers ---

function assertQuestStatus(quest: Quest, expected: QuestStatus): void {
  if (quest.status !== expected) {
    throw new InvalidTransitionError(
      quest.id,
      { type: "FAIL_QUEST", reason: "status_check" },
      `quest status is ${quest.status}, expected ${expected}`,
    );
  }
}

function findLeg(
  quest: Quest,
  legId: QuestLegId,
): { leg: QuestLeg; index: number } {
  const index = quest.legs.findIndex((l) => l.id === legId);
  if (index === -1) {
    throw new InvalidTransitionError(
      quest.id,
      { type: "FAIL_QUEST", reason: "leg_not_found" },
      `leg ${legId} not found`,
    );
  }
  return { leg: quest.legs[index], index };
}

function replaceLeg(
  legs: readonly QuestLeg[],
  index: number,
  updated: QuestLeg,
): QuestLeg[] {
  const result = [...legs];
  result[index] = updated;
  return result;
}
