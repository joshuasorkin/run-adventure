import { describe, it, expect } from "vitest";
import { planRoute, computeRouteDistance, isRouteWithinBudget, improveRoute2Opt } from "@/domain/quest/route-planner";
import { makePlaceCandidate } from "@tests/fixtures/factories";
import type { Coordinates } from "@/domain/location/location-sample";

const START: Coordinates = { latitude: 37.8100, longitude: -122.2500 };

// Places arranged in a rough line: A (close), B (medium), C (far)
const PLACE_A = makePlaceCandidate({
  name: "Place A",
  location: { latitude: 37.8102, longitude: -122.2502 }, // ~25m from start
});

const PLACE_B = makePlaceCandidate({
  name: "Place B",
  location: { latitude: 37.8120, longitude: -122.2510 }, // ~230m from start
});

const PLACE_C = makePlaceCandidate({
  name: "Place C",
  location: { latitude: 37.8140, longitude: -122.2530 }, // ~510m from start
});

describe("planRoute", () => {
  it("returns empty array for no places", () => {
    expect(planRoute(START, [])).toEqual([]);
  });

  it("returns single place as-is", () => {
    const result = planRoute(START, [PLACE_B]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Place B");
  });

  it("orders places by nearest-neighbor from start", () => {
    // Given places in reverse order (C, B, A), nearest-neighbor from START should pick A first
    const result = planRoute(START, [PLACE_C, PLACE_B, PLACE_A]);
    expect(result[0].name).toBe("Place A");
    expect(result[1].name).toBe("Place B");
    expect(result[2].name).toBe("Place C");
  });

  it("does not mutate the input array", () => {
    const input = [PLACE_C, PLACE_A];
    planRoute(START, input);
    expect(input[0].name).toBe("Place C");
    expect(input[1].name).toBe("Place A");
  });
});

describe("computeRouteDistance", () => {
  it("returns 0 for no places", () => {
    expect(computeRouteDistance(START, [])).toBe(0);
  });

  it("returns distance from start to single place", () => {
    const dist = computeRouteDistance(START, [PLACE_B]);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(300);
  });

  it("sums consecutive segments", () => {
    const ordered = planRoute(START, [PLACE_A, PLACE_B, PLACE_C]);
    const total = computeRouteDistance(START, ordered);
    // Total should be roughly start→A + A→B + B→C
    expect(total).toBeGreaterThan(400);
    expect(total).toBeLessThan(600);
  });
});

describe("isRouteWithinBudget", () => {
  it("returns true when route is within budget", () => {
    const ordered = planRoute(START, [PLACE_A, PLACE_B]);
    expect(isRouteWithinBudget(START, ordered, 5000)).toBe(true);
  });

  it("returns false when route exceeds budget", () => {
    const ordered = planRoute(START, [PLACE_A, PLACE_B, PLACE_C]);
    expect(isRouteWithinBudget(START, ordered, 10)).toBe(false);
  });
});

describe("improveRoute2Opt", () => {
  it("returns empty array for empty input", () => {
    expect(improveRoute2Opt(START, [])).toEqual([]);
  });

  it("returns single place unchanged", () => {
    const result = improveRoute2Opt(START, [PLACE_A]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Place A");
  });

  it("returns two places unchanged (nothing to swap)", () => {
    const result = improveRoute2Opt(START, [PLACE_A, PLACE_B]);
    expect(result).toHaveLength(2);
  });

  it("does not increase route distance", () => {
    const ordered = planRoute(START, [PLACE_A, PLACE_B, PLACE_C]);
    const improved = improveRoute2Opt(START, ordered);

    const origDist = computeRouteDistance(START, ordered);
    const improvedDist = computeRouteDistance(START, improved);

    expect(improvedDist).toBeLessThanOrEqual(origDist);
  });

  it("improves a known-suboptimal ordering", () => {
    // Deliberately put places in a zigzag: start → C → A → B
    // which should be worse than start → A → B → C
    const suboptimal = [PLACE_C, PLACE_A, PLACE_B];
    const improved = improveRoute2Opt(START, suboptimal);

    const origDist = computeRouteDistance(START, suboptimal);
    const improvedDist = computeRouteDistance(START, improved);

    expect(improvedDist).toBeLessThan(origDist);
  });

  it("does not mutate the input array", () => {
    const input = [PLACE_C, PLACE_A, PLACE_B];
    improveRoute2Opt(START, input);
    expect(input[0].name).toBe("Place C");
    expect(input[1].name).toBe("Place A");
    expect(input[2].name).toBe("Place B");
  });

  it("preserves all places in the result", () => {
    const input = [PLACE_C, PLACE_A, PLACE_B];
    const result = improveRoute2Opt(START, input);

    const names = result.map((p) => p.name).sort();
    expect(names).toEqual(["Place A", "Place B", "Place C"]);
  });
});
