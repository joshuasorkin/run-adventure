/**
 * Rank PlaceCandidates for quest suitability.
 * Pure domain logic. No framework imports.
 */

import type { PlaceCandidate } from "@/domain/place/place-candidate";
import type { Coordinates } from "@/domain/location/location-sample";
import { haversineDistance } from "@/domain/location/geo";

export interface ScoredPlace {
  readonly place: PlaceCandidate;
  readonly score: number;
  readonly distanceMeters: number;
}

/**
 * Score and rank places by suitability for a quest leg.
 *
 * Scoring factors:
 * - Distance from player (closer is slightly better, but not too close)
 * - Sweet spot: 200-800m away gets the highest distance score
 */
export function scorePlaces(
  playerLocation: Coordinates,
  places: readonly PlaceCandidate[],
): ScoredPlace[] {
  return places
    .map((place) => {
      const distanceMeters = haversineDistance(playerLocation, place.location);
      const score = computeDistanceScore(distanceMeters);
      return { place, score, distanceMeters };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Distance score: peaks at 200-800m, drops off for very close or very far.
 * Returns a value between 0 and 1.
 */
function computeDistanceScore(distanceMeters: number): number {
  const MIN_INTERESTING = 100; // too close is boring
  const SWEET_LOW = 200;
  const SWEET_HIGH = 800;
  const MAX_REASONABLE = 2000; // beyond this, too far for a run leg

  if (distanceMeters < MIN_INTERESTING) {
    return 0.3 * (distanceMeters / MIN_INTERESTING);
  }
  if (distanceMeters <= SWEET_LOW) {
    return 0.3 + 0.7 * ((distanceMeters - MIN_INTERESTING) / (SWEET_LOW - MIN_INTERESTING));
  }
  if (distanceMeters <= SWEET_HIGH) {
    return 1.0;
  }
  if (distanceMeters <= MAX_REASONABLE) {
    return 1.0 - 0.7 * ((distanceMeters - SWEET_HIGH) / (MAX_REASONABLE - SWEET_HIGH));
  }
  return 0.1;
}
