import { describe, it, expect } from "vitest";
import { generateQuest } from "@/domain/quest/quest-generator";
import { makePlaceCandidate, makeItem, makeSessionId } from "@tests/fixtures/factories";
import type { QuestLegTemplate } from "@/domain/quest/quest-generator";

const SESSION_ID = makeSessionId();

function makeTemplate(overrides: Partial<QuestLegTemplate> = {}): QuestLegTemplate {
  return {
    place: makePlaceCandidate(),
    objectiveText: "Run to the test place",
    rewardItem: makeItem(),
    ...overrides,
  };
}

describe("generateQuest", () => {
  it("throws when given zero leg templates", () => {
    expect(() => generateQuest(SESSION_ID, "Title", "Narrative", [])).toThrow(
      "Quest must have at least one leg",
    );
  });

  it("creates a quest with status 'active'", () => {
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", [makeTemplate()]);
    expect(quest.status).toBe("active");
  });

  it("sets the first leg to active and the rest to locked", () => {
    const templates = [makeTemplate(), makeTemplate(), makeTemplate()];
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", templates);

    expect(quest.legs[0].status).toBe("active");
    expect(quest.legs[1].status).toBe("locked");
    expect(quest.legs[2].status).toBe("locked");
  });

  it("assigns sequential indices to legs", () => {
    const templates = [makeTemplate(), makeTemplate(), makeTemplate()];
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", templates);

    expect(quest.legs[0].sequenceIndex).toBe(0);
    expect(quest.legs[1].sequenceIndex).toBe(1);
    expect(quest.legs[2].sequenceIndex).toBe(2);
  });

  it("sets currentLegIndex to 0", () => {
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", [makeTemplate()]);
    expect(quest.currentLegIndex).toBe(0);
  });

  it("stores title and narrative", () => {
    const quest = generateQuest(SESSION_ID, "The Great Quest", "A grand adventure.", [
      makeTemplate(),
    ]);
    expect(quest.title).toBe("The Great Quest");
    expect(quest.narrative).toBe("A grand adventure.");
  });

  it("stores the session ID", () => {
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", [makeTemplate()]);
    expect(quest.sessionId).toBe(SESSION_ID);
  });

  it("assigns a createdAt timestamp", () => {
    const before = new Date();
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", [makeTemplate()]);
    const after = new Date();

    expect(quest.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(quest.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("sets completedAt to null", () => {
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", [makeTemplate()]);
    expect(quest.completedAt).toBeNull();
  });

  it("wires each leg's objective to its template's place and text", () => {
    const place = makePlaceCandidate({ name: "Magic Fountain", radiusMeters: 40 });
    const template = makeTemplate({
      place,
      objectiveText: "Collect the enchanted water",
    });
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", [template]);

    const leg = quest.legs[0];
    expect(leg.objective.description).toBe("Collect the enchanted water");
    expect(leg.objective.targetPlace.name).toBe("Magic Fountain");
    expect(leg.objective.geofenceRadiusMeters).toBe(40);
  });

  it("wires each leg's reward item from its template", () => {
    const item = makeItem({ name: "Golden Feather", rarity: "rare" });
    const template = makeTemplate({ rewardItem: item });
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", [template]);

    expect(quest.legs[0].rewardItem.name).toBe("Golden Feather");
    expect(quest.legs[0].rewardItem.rarity).toBe("rare");
  });

  it("assigns unique IDs to each leg", () => {
    const templates = [makeTemplate(), makeTemplate(), makeTemplate()];
    const quest = generateQuest(SESSION_ID, "Title", "Narrative", templates);
    const ids = quest.legs.map((l) => l.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("works with a single leg template", () => {
    const quest = generateQuest(SESSION_ID, "Solo", "Just one.", [makeTemplate()]);
    expect(quest.legs).toHaveLength(1);
    expect(quest.legs[0].status).toBe("active");
  });
});
