import { describe, it, expect } from "vitest";
import {
  transitionQuest,
  InvalidTransitionError,
} from "@/domain/quest/quest-state-machine";
import {
  makeQuest,
  makeQuestLeg,
  makeQuestId,
  makePlaceId,
  makeItemId,
  makeQuestLegId,
} from "@tests/fixtures/factories";
import type { Quest, QuestLeg } from "@/domain/quest/quest";

const NOW = new Date("2025-06-15T10:05:00Z");

describe("transitionQuest", () => {
  describe("ACTIVATE_LEG", () => {
    it("activates a locked leg", () => {
      const questId = makeQuestId();
      const leg0 = makeQuestLeg({ questId, sequenceIndex: 0, status: "completed", completedAt: NOW });
      const leg1 = makeQuestLeg({ questId, sequenceIndex: 1, status: "locked" });
      const quest = makeQuest({ id: questId, legs: [leg0, leg1], currentLegIndex: 0 });

      const result = transitionQuest(quest, { type: "ACTIVATE_LEG", legIndex: 1 });

      expect(result.quest.currentLegIndex).toBe(1);
      expect(result.quest.legs[1].status).toBe("active");
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("LEG_ACTIVATED");
    });

    it("throws for out-of-bounds index", () => {
      const quest = makeQuest();
      expect(() =>
        transitionQuest(quest, { type: "ACTIVATE_LEG", legIndex: 99 }),
      ).toThrow(InvalidTransitionError);
    });

    it("throws if leg is not locked", () => {
      const quest = makeQuest(); // leg 0 is already active
      expect(() =>
        transitionQuest(quest, { type: "ACTIVATE_LEG", legIndex: 0 }),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("REACH_TARGET", () => {
    it("transitions active leg to reached", () => {
      const quest = makeQuest();
      const legId = quest.legs[0].id;
      const placeId = makePlaceId();

      const result = transitionQuest(quest, {
        type: "REACH_TARGET",
        legId,
        placeId,
        timestamp: NOW,
      });

      expect(result.quest.legs[0].status).toBe("reached");
      expect(result.quest.legs[0].reachedAt).toEqual(NOW);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("TARGET_REACHED");
    });

    it("throws if leg is not active", () => {
      const quest = makeQuest();
      const lockedLegId = quest.legs[1].id;

      expect(() =>
        transitionQuest(quest, {
          type: "REACH_TARGET",
          legId: lockedLegId,
          placeId: makePlaceId(),
          timestamp: NOW,
        }),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("COLLECT_ITEM", () => {
    it("transitions reached leg to completed and emits 2 events", () => {
      const questId = makeQuestId();
      const leg = makeQuestLeg({ questId, sequenceIndex: 0, status: "reached", reachedAt: NOW });
      const quest = makeQuest({ id: questId, legs: [leg, makeQuestLeg({ questId, sequenceIndex: 1 })] });

      const itemId = quest.legs[0].rewardItem.id;
      const placeId = quest.legs[0].objective.targetPlace.id;

      const result = transitionQuest(quest, {
        type: "COLLECT_ITEM",
        legId: leg.id,
        itemId,
        placeId,
        timestamp: NOW,
      });

      expect(result.quest.legs[0].status).toBe("completed");
      expect(result.quest.legs[0].completedAt).toEqual(NOW);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe("ITEM_COLLECTED");
      expect(result.events[1].type).toBe("LEG_COMPLETED");
    });

    it("throws if leg is not in reached status", () => {
      const quest = makeQuest(); // leg 0 is active, not reached

      expect(() =>
        transitionQuest(quest, {
          type: "COLLECT_ITEM",
          legId: quest.legs[0].id,
          itemId: makeItemId(),
          placeId: makePlaceId(),
          timestamp: NOW,
        }),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("COMPLETE_QUEST", () => {
    it("completes quest when all legs are completed", () => {
      const questId = makeQuestId();
      const legs: QuestLeg[] = [
        makeQuestLeg({ questId, sequenceIndex: 0, status: "completed", completedAt: NOW }),
        makeQuestLeg({ questId, sequenceIndex: 1, status: "completed", completedAt: NOW }),
      ];
      const quest = makeQuest({ id: questId, legs, currentLegIndex: 1 });

      const result = transitionQuest(quest, { type: "COMPLETE_QUEST", timestamp: NOW });

      expect(result.quest.status).toBe("completed");
      expect(result.quest.completedAt).toEqual(NOW);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe("QUEST_COMPLETED");
    });

    it("allows completion with skipped legs", () => {
      const questId = makeQuestId();
      const legs: QuestLeg[] = [
        makeQuestLeg({ questId, sequenceIndex: 0, status: "completed", completedAt: NOW }),
        makeQuestLeg({ questId, sequenceIndex: 1, status: "skipped" }),
      ];
      const quest = makeQuest({ id: questId, legs, currentLegIndex: 1 });

      const result = transitionQuest(quest, { type: "COMPLETE_QUEST", timestamp: NOW });
      expect(result.quest.status).toBe("completed");
    });

    it("throws if not all legs are done", () => {
      const quest = makeQuest(); // has locked and active legs

      expect(() =>
        transitionQuest(quest, { type: "COMPLETE_QUEST", timestamp: NOW }),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("SKIP_LEG", () => {
    it("skips an active leg", () => {
      const quest = makeQuest();
      const legId = quest.legs[0].id;

      const result = transitionQuest(quest, {
        type: "SKIP_LEG",
        legId,
        reason: "timeout",
      });

      expect(result.quest.legs[0].status).toBe("skipped");
    });

    it("throws if leg is not active", () => {
      const quest = makeQuest();
      const lockedLegId = quest.legs[1].id;

      expect(() =>
        transitionQuest(quest, {
          type: "SKIP_LEG",
          legId: lockedLegId,
          reason: "timeout",
        }),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("FAIL_QUEST / EXPIRE_QUEST", () => {
    it("fails an active quest", () => {
      const quest = makeQuest();
      const result = transitionQuest(quest, {
        type: "FAIL_QUEST",
        reason: "session_ended",
      });
      expect(result.quest.status).toBe("failed");
    });

    it("expires an active quest", () => {
      const quest = makeQuest();
      const result = transitionQuest(quest, { type: "EXPIRE_QUEST" });
      expect(result.quest.status).toBe("expired");
    });

    it("throws when trying to fail an already completed quest", () => {
      const quest = makeQuest({ status: "completed" });
      expect(() =>
        transitionQuest(quest, { type: "FAIL_QUEST", reason: "test" }),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("full leg lifecycle", () => {
    it("walks through locked -> active -> reached -> completed", () => {
      const questId = makeQuestId();
      const leg = makeQuestLeg({ questId, sequenceIndex: 0, status: "locked" });
      let quest = makeQuest({
        id: questId,
        legs: [leg],
        currentLegIndex: 0,
      });

      // Activate
      let result = transitionQuest(quest, { type: "ACTIVATE_LEG", legIndex: 0 });
      quest = result.quest;
      expect(quest.legs[0].status).toBe("active");

      // Reach target
      const placeId = quest.legs[0].objective.targetPlace.id;
      result = transitionQuest(quest, {
        type: "REACH_TARGET",
        legId: quest.legs[0].id,
        placeId,
        timestamp: NOW,
      });
      quest = result.quest;
      expect(quest.legs[0].status).toBe("reached");

      // Collect item
      const itemId = quest.legs[0].rewardItem.id;
      result = transitionQuest(quest, {
        type: "COLLECT_ITEM",
        legId: quest.legs[0].id,
        itemId,
        placeId,
        timestamp: NOW,
      });
      quest = result.quest;
      expect(quest.legs[0].status).toBe("completed");
    });
  });
});
