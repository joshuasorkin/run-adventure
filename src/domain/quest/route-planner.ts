/**
 * Route planner — orders places for a quest route using greedy nearest-neighbor.
 * Pure domain logic. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import type { PlaceCandidate } from "@/domain/place/place-candidate";
import { haversineDistance } from "@/domain/location/geo";

/**
 * Order places by greedy nearest-neighbor starting from `start`.
 * Returns a new array with the same places in visit order.
 */
export function planRoute(
  start: Coordinates,
  places: readonly PlaceCandidate[],
): PlaceCandidate[] {
  if (places.length === 0) return [];

  const remaining = [...places];
  const ordered: PlaceCandidate[] = [];
  let current: Coordinates = start;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(current, remaining[i].location);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push(next);
    current = next.location;
  }

  return ordered;
}

/**
 * Compute total route distance: start → place1 → place2 → ... → placeN.
 * Returns distance in meters.
 */
export function computeRouteDistance(
  start: Coordinates,
  orderedPlaces: readonly PlaceCandidate[],
): number {
  if (orderedPlaces.length === 0) return 0;

  let total = haversineDistance(start, orderedPlaces[0].location);

  for (let i = 1; i < orderedPlaces.length; i++) {
    total += haversineDistance(
      orderedPlaces[i - 1].location,
      orderedPlaces[i].location,
    );
  }

  return Math.round(total);
}

/**
 * Check if a route fits within a distance budget.
 */
export function isRouteWithinBudget(
  start: Coordinates,
  orderedPlaces: readonly PlaceCandidate[],
  maxDistanceMeters: number,
): boolean {
  return computeRouteDistance(start, orderedPlaces) <= maxDistanceMeters;
}
