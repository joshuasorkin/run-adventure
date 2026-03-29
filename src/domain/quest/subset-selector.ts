/**
 * Subset selector — picks the best combination of places for a quest route.
 * Enumerates candidate combinations (one per objective bucket), scores each
 * combination's route, and returns the best feasible (or best overall) subset.
 * Pure domain logic. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import type { ScoredCandidate } from "./candidate-scorer";
import { planRoute, computeRouteDistance } from "./route-planner";
import { improveRoute2Opt } from "./route-planner";
import { haversineDistance } from "@/domain/location/geo";
import type { DistanceFn } from "@/domain/location/geo";

export interface SelectionResult {
  /** The selected candidates in route order. */
  readonly selected: readonly ScoredCandidate[];
  /** Total route distance in meters (start → place1 → ... → placeN). */
  readonly routeDistance: number;
  /** True if the route fits within maxRouteLength. */
  readonly isFeasible: boolean;
}

/** Hard cap on combinations evaluated to prevent runaway computation. */
const MAX_EVALUATIONS = 100_000;

/**
 * Select exactly `count` candidates, at most one per distinct bucket,
 * maximizing total score subject to route length constraint.
 *
 * Returns the best feasible combination. If no combination satisfies the
 * route budget, returns the best overall combination with isFeasible=false.
 */
export function selectBestSubset(
  start: Coordinates,
  candidates: readonly ScoredCandidate[],
  count: number,
  maxRouteLength: number,
  distanceFn: DistanceFn = haversineDistance,
): SelectionResult {
  // Group candidates by bucket
  const bucketMap = new Map<string, ScoredCandidate[]>();
  for (const c of candidates) {
    const group = bucketMap.get(c.bucketId) ?? [];
    group.push(c);
    bucketMap.set(c.bucketId, group);
  }

  // Sort buckets by best candidate score (descending) for better pruning
  const buckets = Array.from(bucketMap.values())
    .map((group) => group.sort((a, b) => b.score - a.score))
    .sort((a, b) => b[0].score - a[0].score);

  // If we have fewer buckets than requested count, cap count
  const effectiveCount = Math.min(count, buckets.length);
  if (effectiveCount === 0) {
    return { selected: [], routeDistance: 0, isFeasible: true };
  }

  // Choose which buckets to use. If we have more buckets than count,
  // we need to pick which buckets as well. For simplicity and performance,
  // if buckets.length > count, take the top `count` buckets by best score.
  // This loses some combinations but keeps the space manageable.
  const selectedBuckets = buckets.length > effectiveCount
    ? buckets.slice(0, effectiveCount)
    : buckets;

  let bestFeasible: { combo: ScoredCandidate[]; score: number; distance: number } | null = null;
  let bestOverall: { combo: ScoredCandidate[]; score: number; distance: number } | null = null;
  let evaluations = 0;

  // Enumerate combinations: pick one candidate from each selected bucket
  function enumerate(
    bucketIdx: number,
    current: ScoredCandidate[],
    usedPlaceIds: Set<string>,
    currentScore: number,
  ): void {
    if (evaluations >= MAX_EVALUATIONS) return;

    if (bucketIdx === selectedBuckets.length) {
      if (current.length < effectiveCount) return;

      evaluations++;
      const places = current.map((c) => c.place);
      const routed = improveRoute2Opt(start, planRoute(start, places, distanceFn), distanceFn);
      const distance = computeRouteDistance(start, routed, distanceFn);

      // Map routed places back to their ScoredCandidates in route order
      const orderedCombo = routed.map(
        (p) => current.find((c) => c.place.id === p.id)!,
      );

      if (distance <= maxRouteLength) {
        if (!bestFeasible || currentScore > bestFeasible.score) {
          bestFeasible = { combo: orderedCombo, score: currentScore, distance };
        }
      }

      if (!bestOverall || currentScore > bestOverall.score) {
        bestOverall = { combo: orderedCombo, score: currentScore, distance };
      }

      return;
    }

    const bucket = selectedBuckets[bucketIdx];
    for (const candidate of bucket) {
      if (evaluations >= MAX_EVALUATIONS) return;
      if (usedPlaceIds.has(candidate.place.externalId)) continue;

      usedPlaceIds.add(candidate.place.externalId);
      current.push(candidate);

      enumerate(bucketIdx + 1, current, usedPlaceIds, currentScore + candidate.score);

      current.pop();
      usedPlaceIds.delete(candidate.place.externalId);
    }
  }

  enumerate(0, [], new Set(), 0);

  // Capture into locals so TypeScript can narrow the type
  const feasible = bestFeasible as { combo: ScoredCandidate[]; score: number; distance: number } | null;
  const overall = bestOverall as { combo: ScoredCandidate[]; score: number; distance: number } | null;

  if (feasible) {
    return {
      selected: feasible.combo,
      routeDistance: feasible.distance,
      isFeasible: true,
    };
  }

  if (overall) {
    return {
      selected: overall.combo,
      routeDistance: overall.distance,
      isFeasible: false,
    };
  }

  return { selected: [], routeDistance: 0, isFeasible: true };
}
