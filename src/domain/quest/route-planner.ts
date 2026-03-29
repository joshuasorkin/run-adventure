/**
 * Route planner — orders places for a quest route using greedy nearest-neighbor.
 * Pure domain logic. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import type { PlaceCandidate } from "@/domain/place/place-candidate";
import { haversineDistance } from "@/domain/location/geo";
import type { DistanceFn } from "@/domain/location/geo";

/**
 * Order places by greedy nearest-neighbor starting from `start`.
 * Returns a new array with the same places in visit order.
 */
export function planRoute(
  start: Coordinates,
  places: readonly PlaceCandidate[],
  distanceFn: DistanceFn = haversineDistance,
): PlaceCandidate[] {
  if (places.length === 0) return [];

  const remaining = [...places];
  const ordered: PlaceCandidate[] = [];
  let current: Coordinates = start;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = distanceFn(current, remaining[i].location);
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
  distanceFn: DistanceFn = haversineDistance,
): number {
  if (orderedPlaces.length === 0) return 0;

  let total = distanceFn(start, orderedPlaces[0].location);

  for (let i = 1; i < orderedPlaces.length; i++) {
    total += distanceFn(
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
  distanceFn: DistanceFn = haversineDistance,
): boolean {
  return computeRouteDistance(start, orderedPlaces, distanceFn) <= maxDistanceMeters;
}

/**
 * 2-opt local improvement on an ordered route.
 * Iteratively reverses segments to reduce total distance.
 * Returns a new array (does not mutate input).
 *
 * For the small route sizes in this app (2-10 stops), this converges
 * in microseconds and typically saves 5-15% on suboptimal orderings.
 */
export function improveRoute2Opt(
  start: Coordinates,
  orderedPlaces: readonly PlaceCandidate[],
  distanceFn: DistanceFn = haversineDistance,
): PlaceCandidate[] {
  if (orderedPlaces.length <= 2) return [...orderedPlaces];

  const route = [...orderedPlaces];
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const oldDist = segmentCost(start, route, i, j, distanceFn);
        reverse(route, i, j);
        const newDist = segmentCost(start, route, i, j, distanceFn);

        if (newDist < oldDist - 0.5) {
          // Keep the reversal
          improved = true;
        } else {
          // Revert
          reverse(route, i, j);
        }
      }
    }
  }

  return route;
}

/**
 * Compute the cost of the edges entering and leaving the segment [i, j].
 * This is the portion of total distance affected by reversing that segment.
 */
function segmentCost(
  start: Coordinates,
  route: readonly PlaceCandidate[],
  i: number,
  j: number,
  distanceFn: DistanceFn = haversineDistance,
): number {
  const prevCoord = i === 0 ? start : route[i - 1].location;
  const entryEdge = distanceFn(prevCoord, route[i].location);

  const exitEdge = j < route.length - 1
    ? distanceFn(route[j].location, route[j + 1].location)
    : 0;

  return entryEdge + exitEdge;
}

/** Reverse a segment of the route array in place. */
function reverse(route: PlaceCandidate[], i: number, j: number): void {
  let left = i;
  let right = j;
  while (left < right) {
    [route[left], route[right]] = [route[right], route[left]];
    left++;
    right--;
  }
}
