import { describe, it, expect } from "vitest";
import { questConfigSchema } from "@/validation/quest-generation-schemas";
import {
  MIN_DISTANCE_METERS,
  MAX_DISTANCE_METERS,
  MIN_OBJECTIVE_COUNT,
  MAX_OBJECTIVE_COUNT,
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_QUEST_GOAL,
  DEFAULT_OBJECTIVE_COUNT,
} from "@/domain/quest/quest-config";
import { v4 as uuid } from "uuid";

const VALID_INPUT = {
  sessionId: uuid(),
  startLocation: { latitude: 37.81, longitude: -122.25 },
  maxDistanceMeters: 3000,
  questGoal: "rescue the princess",
  objectiveCount: 4,
};

describe("questConfigSchema", () => {
  it("accepts a fully valid input", () => {
    const result = questConfigSchema.safeParse(VALID_INPUT);
    expect(result.success).toBe(true);
  });

  it("applies defaults when optional fields are omitted", () => {
    const result = questConfigSchema.safeParse({
      sessionId: VALID_INPUT.sessionId,
      startLocation: VALID_INPUT.startLocation,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxDistanceMeters).toBe(DEFAULT_MAX_DISTANCE_METERS);
      expect(result.data.questGoal).toBe(DEFAULT_QUEST_GOAL);
      expect(result.data.objectiveCount).toBe(DEFAULT_OBJECTIVE_COUNT);
    }
  });

  // --- sessionId ---

  it("rejects non-UUID sessionId", () => {
    const result = questConfigSchema.safeParse({ ...VALID_INPUT, sessionId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing sessionId", () => {
    const { sessionId, ...rest } = VALID_INPUT;
    const result = questConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // --- startLocation ---

  it("rejects latitude below -90", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      startLocation: { latitude: -91, longitude: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects latitude above 90", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      startLocation: { latitude: 91, longitude: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude below -180", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      startLocation: { latitude: 0, longitude: -181 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude above 180", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      startLocation: { latitude: 0, longitude: 181 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts edge coordinate values", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      startLocation: { latitude: -90, longitude: 180 },
    });
    expect(result.success).toBe(true);
  });

  // --- maxDistanceMeters ---

  it("rejects distance below minimum", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxDistanceMeters: MIN_DISTANCE_METERS - 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects distance above maximum", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxDistanceMeters: MAX_DISTANCE_METERS + 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts distance at minimum boundary", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxDistanceMeters: MIN_DISTANCE_METERS,
    });
    expect(result.success).toBe(true);
  });

  it("accepts distance at maximum boundary", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxDistanceMeters: MAX_DISTANCE_METERS,
    });
    expect(result.success).toBe(true);
  });

  it("accepts 10-mile conversion value (16093)", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxDistanceMeters: 16093,
    });
    expect(result.success).toBe(true);
  });

  // --- maxRouteLength ---

  it("accepts request without maxRouteLength (optional)", () => {
    const { maxRouteLength, ...noRoute } = { ...VALID_INPUT, maxRouteLength: undefined };
    const result = questConfigSchema.safeParse(noRoute);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxRouteLength).toBeUndefined();
    }
  });

  it("accepts maxRouteLength within bounds", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxRouteLength: 5000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxRouteLength).toBe(5000);
    }
  });

  it("rejects maxRouteLength below minimum", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxRouteLength: MIN_DISTANCE_METERS - 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxRouteLength above maximum", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      maxRouteLength: MAX_DISTANCE_METERS + 1,
    });
    expect(result.success).toBe(false);
  });

  // --- questGoal ---

  it("rejects empty quest goal", () => {
    const result = questConfigSchema.safeParse({ ...VALID_INPUT, questGoal: "" });
    expect(result.success).toBe(false);
  });

  it("rejects quest goal over 200 chars", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      questGoal: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts quest goal at 200 chars", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      questGoal: "x".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  // --- objectiveCount ---

  it("rejects objective count below minimum", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      objectiveCount: MIN_OBJECTIVE_COUNT - 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects objective count above maximum", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      objectiveCount: MAX_OBJECTIVE_COUNT + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer objective count", () => {
    const result = questConfigSchema.safeParse({
      ...VALID_INPUT,
      objectiveCount: 3.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts objective count at boundaries", () => {
    const minResult = questConfigSchema.safeParse({
      ...VALID_INPUT,
      objectiveCount: MIN_OBJECTIVE_COUNT,
    });
    const maxResult = questConfigSchema.safeParse({
      ...VALID_INPUT,
      objectiveCount: MAX_OBJECTIVE_COUNT,
    });
    expect(minResult.success).toBe(true);
    expect(maxResult.success).toBe(true);
  });
});
