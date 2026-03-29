import { describe, it, expect } from "vitest";
import {
  scoreCandidate,
  scoreCandidatePool,
  DEFAULT_SCORING_WEIGHTS,
} from "@/domain/quest/candidate-scorer";
import { makePlaceCandidate, ADAMS_POINT_CENTER } from "@tests/fixtures/factories";
import type { Coordinates } from "@/domain/location/location-sample";

const START: Coordinates = ADAMS_POINT_CENTER;
const MAX_DISTANCE = 3000;

describe("scoreCandidate", () => {
  it("gives higher proximity score to places closer to start", () => {
    const near = makePlaceCandidate({
      name: "Near",
      location: { latitude: 37.8106, longitude: -122.2535 }, // ~10m from start
    });
    const far = makePlaceCandidate({
      name: "Far",
      location: { latitude: 37.8200, longitude: -122.2600 }, // ~1200m from start
    });

    const nearScored = scoreCandidate(near, "b1", 0.8, START, MAX_DISTANCE, []);
    const farScored = scoreCandidate(far, "b2", 0.8, START, MAX_DISTANCE, []);

    expect(nearScored.score).toBeGreaterThan(farScored.score);
  });

  it("gives higher score to places with higher thematic strength", () => {
    const place = makePlaceCandidate();

    const high = scoreCandidate(place, "b1", 1.0, START, MAX_DISTANCE, []);
    const low = scoreCandidate(place, "b2", 0.2, START, MAX_DISTANCE, []);

    expect(high.score).toBeGreaterThan(low.score);
  });

  it("penalizes places near existing places (novelty)", () => {
    const place = makePlaceCandidate({
      location: { latitude: 37.8106, longitude: -122.2535 },
    });
    const neighbor = makePlaceCandidate({
      location: { latitude: 37.8106, longitude: -122.25351 }, // ~1m away
    });

    const alone = scoreCandidate(place, "b1", 0.8, START, MAX_DISTANCE, []);
    const clustered = scoreCandidate(place, "b1", 0.8, START, MAX_DISTANCE, [neighbor]);

    expect(alone.score).toBeGreaterThan(clustered.score);
  });

  it("does not penalize itself as a neighbor", () => {
    const place = makePlaceCandidate({
      externalId: "same-place",
      location: { latitude: 37.8106, longitude: -122.2535 },
    });
    const self = makePlaceCandidate({
      externalId: "same-place",
      location: { latitude: 37.8106, longitude: -122.2535 },
    });

    const scored = scoreCandidate(place, "b1", 0.8, START, MAX_DISTANCE, [self]);
    const alone = scoreCandidate(place, "b1", 0.8, START, MAX_DISTANCE, []);

    expect(scored.score).toBe(alone.score);
  });

  it("returns 0 proximity for places at or beyond maxDistance", () => {
    const farAway = makePlaceCandidate({
      location: { latitude: 37.84, longitude: -122.28 }, // ~4km away
    });

    const scored = scoreCandidate(farAway, "b1", 0.5, START, 1000, []);

    // Proximity should be 0 (clamped), so score = thematic * 0.4 + 0 + novelty * 0.2
    expect(scored.score).toBeCloseTo(0.5 * 0.4 + 1.0 * 0.2, 1);
  });

  it("records distanceFromStart on the result", () => {
    const place = makePlaceCandidate({
      location: { latitude: 37.8110, longitude: -122.2540 },
    });

    const scored = scoreCandidate(place, "b1", 0.8, START, MAX_DISTANCE, []);

    expect(scored.distanceFromStart).toBeGreaterThan(0);
    expect(scored.distanceFromStart).toBeLessThan(200);
  });

  it("preserves bucketId and thematicStrength", () => {
    const place = makePlaceCandidate();
    const scored = scoreCandidate(place, "my-bucket", 0.65, START, MAX_DISTANCE, []);

    expect(scored.bucketId).toBe("my-bucket");
    expect(scored.thematicStrength).toBe(0.65);
  });

  it("handles zero thematic strength", () => {
    const place = makePlaceCandidate();
    const scored = scoreCandidate(place, "b1", 0, START, MAX_DISTANCE, []);

    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.thematicStrength).toBe(0);
  });
});

describe("scoreCandidatePool", () => {
  it("scores all candidates in the pool", () => {
    const pool = [
      { place: makePlaceCandidate({ name: "A" }), bucketId: "b1", thematicStrength: 0.9 },
      { place: makePlaceCandidate({ name: "B" }), bucketId: "b2", thematicStrength: 0.5 },
    ];

    const scored = scoreCandidatePool(pool, START, MAX_DISTANCE);

    expect(scored).toHaveLength(2);
    expect(scored[0].bucketId).toBe("b1");
    expect(scored[1].bucketId).toBe("b2");
  });

  it("computes novelty against all other pool members", () => {
    const loc = { latitude: 37.8106, longitude: -122.2535 };
    const pool = [
      { place: makePlaceCandidate({ name: "A", location: loc }), bucketId: "b1", thematicStrength: 0.8 },
      { place: makePlaceCandidate({ name: "B", location: loc }), bucketId: "b2", thematicStrength: 0.8 },
    ];

    const scored = scoreCandidatePool(pool, START, MAX_DISTANCE);

    // Both should have novelty penalty since they're at the same location
    const alonePlaceScore = scoreCandidate(pool[0].place, "b1", 0.8, START, MAX_DISTANCE, []);
    expect(scored[0].score).toBeLessThan(alonePlaceScore.score);
  });
});
