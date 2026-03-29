import { describe, it, expect } from "vitest";
import { selectBestSubset } from "@/domain/quest/subset-selector";
import { makePlaceCandidate, ADAMS_POINT_CENTER } from "@tests/fixtures/factories";
import type { ScoredCandidate } from "@/domain/quest/candidate-scorer";
import type { Coordinates } from "@/domain/location/location-sample";

const START: Coordinates = ADAMS_POINT_CENTER;

function makeScored(
  bucketId: string,
  name: string,
  location: Coordinates,
  score: number,
): ScoredCandidate {
  return {
    place: makePlaceCandidate({ name, location }),
    bucketId,
    thematicStrength: 0.8,
    distanceFromStart: 100,
    score,
  };
}

// Close places for feasible routes
const CLOSE_A = { latitude: 37.8106, longitude: -122.2536 }; // ~15m from start
const CLOSE_B = { latitude: 37.8108, longitude: -122.2538 }; // ~40m from start
const CLOSE_C = { latitude: 37.8110, longitude: -122.2540 }; // ~75m from start

// Far place for infeasible routes
const FAR = { latitude: 37.8300, longitude: -122.2700 }; // ~2.5km from start

describe("selectBestSubset", () => {
  it("returns empty result for empty candidates", () => {
    const result = selectBestSubset(START, [], 3, 5000);
    expect(result.selected).toHaveLength(0);
    expect(result.isFeasible).toBe(true);
  });

  it("selects one candidate per bucket", () => {
    const candidates: ScoredCandidate[] = [
      makeScored("b1", "Park A", CLOSE_A, 0.9),
      makeScored("b2", "Lib B", CLOSE_B, 0.8),
      makeScored("b3", "Cafe C", CLOSE_C, 0.7),
    ];

    const result = selectBestSubset(START, candidates, 3, 5000);

    expect(result.selected).toHaveLength(3);
    const bucketIds = result.selected.map((s) => s.bucketId);
    expect(new Set(bucketIds).size).toBe(3);
  });

  it("does not select duplicate places across buckets", () => {
    const sharedPlace = makePlaceCandidate({ name: "Shared", location: CLOSE_A });
    const candidates: ScoredCandidate[] = [
      { place: sharedPlace, bucketId: "b1", thematicStrength: 0.9, distanceFromStart: 15, score: 0.9 },
      { place: sharedPlace, bucketId: "b2", thematicStrength: 0.8, distanceFromStart: 15, score: 0.8 },
      makeScored("b2", "Alt B", CLOSE_B, 0.6),
    ];

    const result = selectBestSubset(START, candidates, 2, 5000);

    expect(result.selected).toHaveLength(2);
    const placeIds = result.selected.map((s) => s.place.externalId);
    expect(new Set(placeIds).size).toBe(2);
  });

  it("prefers feasible combinations over higher-scoring infeasible ones", () => {
    const candidates: ScoredCandidate[] = [
      makeScored("b1", "Close A", CLOSE_A, 0.5), // low score but close
      makeScored("b1", "Far A", FAR, 0.95),       // high score but far
      makeScored("b2", "Close B", CLOSE_B, 0.5),
    ];

    // Budget only allows close places
    const result = selectBestSubset(START, candidates, 2, 200);

    expect(result.isFeasible).toBe(true);
    const names = result.selected.map((s) => s.place.name);
    expect(names).toContain("Close A");
    expect(names).toContain("Close B");
  });

  it("returns best infeasible when no combination fits the budget", () => {
    const candidates: ScoredCandidate[] = [
      makeScored("b1", "Far A", FAR, 0.9),
      makeScored("b2", "Far B", { latitude: 37.8350, longitude: -122.2750 }, 0.8),
    ];

    const result = selectBestSubset(START, candidates, 2, 10); // impossibly small budget

    expect(result.isFeasible).toBe(false);
    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.routeDistance).toBeGreaterThan(10);
  });

  it("handles fewer buckets than requested count", () => {
    const candidates: ScoredCandidate[] = [
      makeScored("b1", "Only A", CLOSE_A, 0.9),
      makeScored("b1", "Alt A", CLOSE_B, 0.7),
    ];

    // Request 3 but only 1 bucket exists
    const result = selectBestSubset(START, candidates, 3, 5000);

    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].place.name).toBe("Only A"); // picks best from bucket
  });

  it("picks the higher-scoring candidate from within a bucket", () => {
    const candidates: ScoredCandidate[] = [
      makeScored("b1", "Low", CLOSE_A, 0.3),
      makeScored("b1", "High", CLOSE_B, 0.9),
      makeScored("b2", "Other", CLOSE_C, 0.5),
    ];

    const result = selectBestSubset(START, candidates, 2, 5000);

    const b1Selected = result.selected.find((s) => s.bucketId === "b1");
    expect(b1Selected?.place.name).toBe("High");
  });

  it("reports route distance in meters", () => {
    const candidates: ScoredCandidate[] = [
      makeScored("b1", "A", CLOSE_A, 0.8),
      makeScored("b2", "B", CLOSE_B, 0.7),
    ];

    const result = selectBestSubset(START, candidates, 2, 5000);

    expect(result.routeDistance).toBeGreaterThan(0);
    expect(result.routeDistance).toBeLessThan(500);
  });

  it("completes quickly for moderately large input", () => {
    // 6 buckets × 4 candidates each = 4^6 = 4096 combinations
    const candidates: ScoredCandidate[] = [];
    for (let b = 0; b < 6; b++) {
      for (let c = 0; c < 4; c++) {
        candidates.push(
          makeScored(
            `bucket-${b}`,
            `Place-${b}-${c}`,
            {
              latitude: 37.8105 + b * 0.001 + c * 0.0003,
              longitude: -122.2534 + b * 0.001 + c * 0.0003,
            },
            0.5 + Math.random() * 0.5,
          ),
        );
      }
    }

    const t0 = performance.now();
    const result = selectBestSubset(START, candidates, 6, 5000);
    const elapsed = performance.now() - t0;

    expect(result.selected).toHaveLength(6);
    expect(elapsed).toBeLessThan(1000); // should be well under 1s
  });
});
