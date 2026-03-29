/**
 * Candidate scorer — computes composite scores for place candidates.
 * Used during subset selection to rank candidates by thematic fit,
 * proximity, and spatial novelty.
 * Pure domain logic. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import type { PlaceCandidate } from "@/domain/place/place-candidate";
import { haversineDistance } from "@/domain/location/geo";
import type { DistanceFn } from "@/domain/location/geo";

/** A place candidate annotated with its score and bucket metadata. */
export interface ScoredCandidate {
  readonly place: PlaceCandidate;
  readonly bucketId: string;
  readonly thematicStrength: number;
  readonly distanceFromStart: number;
  readonly score: number;
}

export interface ScoringWeights {
  readonly thematic: number;
  readonly proximity: number;
  readonly novelty: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  thematic: 0.4,
  proximity: 0.4,
  novelty: 0.2,
};

/** Distance (meters) below which two places are penalized as a cluster. */
const NOVELTY_RADIUS_METERS = 100;

/**
 * Score a single candidate place.
 *
 * Components:
 * - **Thematic** (0-1): the bucket's thematic strength, passed through directly.
 * - **Proximity** (0-1): 1.0 at the start location, linearly decreasing to 0.0 at maxDistance.
 * - **Novelty** (0-1): 1.0 if no other place is within NOVELTY_RADIUS_METERS, reduced
 *   by 0.3 for each nearby neighbor (floored at 0).
 */
export function scoreCandidate(
  place: PlaceCandidate,
  bucketId: string,
  thematicStrength: number,
  start: Coordinates,
  maxDistance: number,
  existingPlaces: readonly PlaceCandidate[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  distanceFn: DistanceFn = haversineDistance,
): ScoredCandidate {
  const distanceFromStart = distanceFn(start, place.location);

  // Proximity: 1.0 at start, 0.0 at maxDistance, clamped to [0, 1]
  const proximityScore = Math.max(0, Math.min(1, 1 - distanceFromStart / maxDistance));

  // Novelty: penalize 0.3 per neighbor within NOVELTY_RADIUS_METERS
  let nearbyCount = 0;
  for (const other of existingPlaces) {
    if (other.externalId === place.externalId) continue;
    if (haversineDistance(place.location, other.location) < NOVELTY_RADIUS_METERS) {
      nearbyCount++;
    }
  }
  const noveltyScore = Math.max(0, 1 - nearbyCount * 0.3);

  const score =
    weights.thematic * thematicStrength +
    weights.proximity * proximityScore +
    weights.novelty * noveltyScore;

  return {
    place,
    bucketId,
    thematicStrength,
    distanceFromStart,
    score,
  };
}

/**
 * Score an entire candidate pool. Each candidate is scored against all other
 * places in the pool for novelty computation.
 */
export function scoreCandidatePool(
  pool: readonly { place: PlaceCandidate; bucketId: string; thematicStrength: number }[],
  start: Coordinates,
  maxDistance: number,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  distanceFn: DistanceFn = haversineDistance,
): ScoredCandidate[] {
  const allPlaces = pool.map((c) => c.place);

  return pool.map((candidate) =>
    scoreCandidate(
      candidate.place,
      candidate.bucketId,
      candidate.thematicStrength,
      start,
      maxDistance,
      allPlaces,
      weights,
      distanceFn,
    ),
  );
}
