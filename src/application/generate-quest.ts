/**
 * generateDynamicQuest use case — orchestrates the 6-step quest generation pipeline:
 *   1. LLM generates theme schema with objective buckets
 *   2. Google Places API builds a candidate pool
 *   3. Candidates are scored (thematic + proximity + novelty)
 *   4. Best subset is selected via combinatorial search
 *   5. Selected places are routed (nearest-neighbor + 2-opt)
 *   6. LLM generates narrative for the actual selected places
 */

import { v4 as uuid } from "uuid";
import type { SessionId } from "@/domain/player/player-session";
import type { QuestConfig } from "@/domain/quest/quest-config";
import { MIN_OBJECTIVE_COUNT } from "@/domain/quest/quest-config";
import type { Quest } from "@/domain/quest/quest";
import type { PlaceCandidate, PlaceId } from "@/domain/place/place-candidate";
import type { ItemId } from "@/domain/inventory/inventory-item";
import type { Coordinates } from "@/domain/location/location-sample";
import type { QuestLegTemplate } from "@/domain/quest/quest-generator";
import type { ObjectiveBucket } from "@/domain/quest/theme-schema";
import { generateQuest } from "@/domain/quest/quest-generator";
import { scoreCandidatePool } from "@/domain/quest/candidate-scorer";
import { selectBestSubset } from "@/domain/quest/subset-selector";
import {
  generateThemePlan,
  generateNarrative,
} from "@/infrastructure/providers/llm/openai-quest-planner";
import { GooglePlacesProvider } from "@/infrastructure/providers/map/google-places-provider";
import type { MapProvider } from "@/infrastructure/providers/map/map-provider";
import { haversineDistance } from "@/domain/location/geo";
import {
  buildWalkingDistanceMatrix,
  matrixDistanceFn,
} from "@/infrastructure/providers/routing/google-routes-provider";
import { env } from "@/infrastructure/config/env";
import { setQuest } from "@/infrastructure/persistence/in-memory-store";

/** Maximum number of Places API queries per quest generation. */
const MAX_PLACE_QUERIES = 20;

/** Minimum distance (meters) a candidate must be from start to avoid "run to where you are". */
const MIN_DISTANCE_FROM_START = 50;

export interface GenerateQuestResult {
  readonly quest: Quest;
  readonly placesFound: number;
  readonly routeDistanceMeters: number;
  readonly routeBudgetWarning?: string;
  /** Per-leg walking distances in meters (start→leg0, leg0→leg1, ...). */
  readonly legDistances: readonly number[];
}

export type ProgressCallback = (step: number, totalSteps: number, message: string) => void;

export async function generateDynamicQuest(
  sessionId: SessionId,
  config: QuestConfig,
  onProgress?: ProgressCallback,
): Promise<GenerateQuestResult> {
  const report = onProgress ?? (() => {});
  const placesProvider = new GooglePlacesProvider(env.GOOGLE_MAPS_API_KEY);
  const maxRouteLength = config.maxRouteLength ?? config.maxDistanceMeters;

  // Step 1: Generate theme schema from LLM
  report(1, 8, "Designing quest theme...");
  console.log("[generate-quest] Step 1: Generating theme plan...");
  // Request buckets for outbound stops only (final stop is always the start location)
  const themeConfig = { ...config, objectiveCount: config.objectiveCount - 1 };
  const theme = await generateThemePlan(themeConfig, env.OPENAI_API_KEY, 0.5);
  console.log(
    `[generate-quest] Theme: "${theme.titleSeed}", ${theme.buckets.length} buckets`,
  );

  // Step 2: Build candidate pool from Places API
  report(2, 8, `Searching for places (${theme.buckets.length} categories)...`);
  console.log("[generate-quest] Step 2: Building candidate pool...");
  const pool = await buildCandidatePool(
    placesProvider,
    theme.buckets,
    config.startLocation,
    config.maxDistanceMeters,
  );
  console.log(`[generate-quest] Pool: ${pool.length} candidates from ${theme.buckets.length} buckets`);

  if (pool.length === 0) {
    throw new Error(
      "Could not find any matching places nearby. Try increasing the max distance or choosing a different goal.",
    );
  }

  // Step 3: Score all candidates
  report(3, 8, `Scoring ${pool.length} candidate places...`);
  const scored = scoreCandidatePool(
    pool,
    config.startLocation,
    config.maxDistanceMeters,
  );

  // Step 4: Select best subset (N-1 places; the final stop is always the start location)
  report(4, 8, "Selecting best route combination...");
  console.log("[generate-quest] Step 4: Selecting best subset...");
  const outboundCount = config.objectiveCount - 1; // reserve 1 slot for return-home
  let selection = selectBestSubset(
    config.startLocation,
    scored,
    outboundCount,
    maxRouteLength,
  );

  // Fallback: reduce objective count by 1 if no feasible combo
  if (!selection.isFeasible && outboundCount > 1) {
    console.log("[generate-quest] No feasible combo, reducing objective count by 1...");
    const reduced = selectBestSubset(
      config.startLocation,
      scored,
      outboundCount - 1,
      maxRouteLength,
    );
    if (reduced.isFeasible || reduced.selected.length > selection.selected.length) {
      selection = reduced;
    }
  }

  if (selection.selected.length === 0) {
    throw new Error(
      "Could not find any matching places nearby. Try increasing the max distance or choosing a different goal.",
    );
  }

  // Resolve the start location for the final "return home" stop.
  // Try to find a named place at the start (within 50m), otherwise reverse geocode.
  report(5, 8, "Resolving start address...");

  let homePlaceName: string | null = null;
  let homeAddress: string | null = null;

  // Check if there's a named place right at the start location
  try {
    const nearStart = await placesProvider.findNearbyPlaces({
      center: config.startLocation,
      radiusMeters: 50,
      categories: [] as never[],
      maxResults: 1,
    });
    if (nearStart.length > 0) {
      const nearest = nearStart[0];
      const dist = haversineDistance(config.startLocation, nearest.location);
      if (dist < 50) {
        homePlaceName = nearest.name;
        homeAddress = nearest.address;
        console.log(`[generate-quest] Found named place at start: "${homePlaceName}" (${dist.toFixed(0)}m away)`);
      }
    }
  } catch {
    // Not critical — fall through to reverse geocode
  }

  // If no named place, reverse geocode for the street address
  if (!homeAddress) {
    homeAddress = await placesProvider.reverseGeocode(config.startLocation);
    console.log(`[generate-quest] Start address: ${homeAddress ?? "(unknown)"}`);
  }

  // Build the home place name: prefer named place, then address, then coordinates
  const homeName = homePlaceName
    ?? homeAddress
    ?? `${config.startLocation.latitude.toFixed(4)}, ${config.startLocation.longitude.toFixed(4)}`;

  const homePlace: PlaceCandidate = {
    id: uuid() as PlaceId,
    externalId: "home-start",
    providerSource: "synthetic",
    name: homeName,
    category: "other",
    location: config.startLocation,
    address: homeAddress,
    isAccessible: true,
    isOutdoor: true,
    radiusMeters: 35,
  };

  const orderedPlaces = [...selection.selected.map((s) => s.place), homePlace];

  console.log(
    `[generate-quest] Selected ${orderedPlaces.length} places (${orderedPlaces.length - 1} + home), route: ${selection.routeDistance}m (haversine), feasible: ${selection.isFeasible}`,
  );

  // Step 6: Compute walking distances for selected route (including return home)
  report(6, 8, "Computing walking distances...");
  console.log("[generate-quest] Step 6: Computing walking distance matrix...");

  let finalRouteDistance = selection.routeDistance;
  let isFeasible = selection.isFeasible;
  const placeCoords = orderedPlaces.map((p) => p.location);
  const waypoints = [config.startLocation, ...placeCoords];

  // Initialize leg distances with haversine
  let legDistances: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    legDistances.push(Math.round(haversineDistance(waypoints[i], waypoints[i + 1])));
  }

  try {
    const matrix = await buildWalkingDistanceMatrix(
      config.startLocation,
      placeCoords,
      env.GOOGLE_MAPS_API_KEY,
    );

    // Overwrite with street distances
    legDistances = [];
    let streetTotal = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const d = matrix.get(`${i}-${i + 1}`) ?? haversineDistance(waypoints[i], waypoints[i + 1]);
      legDistances.push(Math.round(d));
      streetTotal += d;
    }
    finalRouteDistance = Math.round(streetTotal);
    isFeasible = finalRouteDistance <= maxRouteLength;

    console.log(
      `[generate-quest] Street distance: ${finalRouteDistance}m (haversine was ${selection.routeDistance}m), feasible: ${isFeasible}`,
    );
  } catch (err) {
    console.warn("[generate-quest] Walking distance matrix failed, using haversine:", err);
  }

  // Step 7: Generate narrative for actual places
  report(7, 8, `Writing narrative for ${orderedPlaces.length} stops...`);
  console.log("[generate-quest] Step 7: Generating narrative...");
  const narrative = await generateNarrative(
    orderedPlaces,
    theme.narrativePremise,
    config.questGoal,
    env.OPENAI_API_KEY,
    0.3,
  );

  // Step 8: Build quest
  report(8, 8, "Building quest...");

  // Build QuestLegTemplates from narrative + ordered places
  const legTemplates: QuestLegTemplate[] = orderedPlaces.map((place, i) => {
    const leg = narrative.legs[i];
    return {
      place,
      objectiveText: leg?.objectiveText ?? `Visit ${place.name}`,
      rewardItem: {
        id: uuid() as ItemId,
        name: leg?.itemName ?? "Mystery Item",
        description: leg?.itemDescription ?? "A mysterious reward.",
        rarity: leg?.itemRarity ?? "common",
        iconKey: (leg?.itemName ?? "mystery").toLowerCase().replace(/\s+/g, "-"),
      },
    };
  });

  const quest = generateQuest(
    sessionId,
    narrative.title,
    narrative.narrative,
    legTemplates,
  );
  setQuest(quest);

  const routeBudgetWarning = !isFeasible
    ? `Route is ${finalRouteDistance}m, which exceeds the ${maxRouteLength}m budget. Consider increasing max distance.`
    : undefined;

  return {
    quest,
    placesFound: pool.length,
    routeDistanceMeters: finalRouteDistance,
    routeBudgetWarning,
    legDistances,
  };
}

/**
 * Query Places API for each bucket's place types. Collects multiple candidates
 * per type, filters to within maxDistance of center, deduplicates by externalId.
 */
async function buildCandidatePool(
  provider: MapProvider,
  buckets: readonly ObjectiveBucket[],
  center: Coordinates,
  maxDistance: number,
): Promise<Array<{ place: PlaceCandidate; bucketId: string; thematicStrength: number }>> {
  const pool: Array<{ place: PlaceCandidate; bucketId: string; thematicStrength: number }> = [];
  const seenExternalIds = new Set<string>();
  let queryCount = 0;

  for (const bucket of buckets) {
    for (const placeType of bucket.placeTypes) {
      if (queryCount >= MAX_PLACE_QUERIES) break;
      queryCount++;

      try {
        const places = await provider.findNearbyPlaces({
          center,
          radiusMeters: maxDistance,
          categories: [placeType as never],
          maxResults: 5,
        });

        for (const place of places) {
          // Filter: must be within maxDistance of start, but not too close
          const dist = haversineDistance(center, place.location);
          if (dist > maxDistance) continue;
          if (dist < MIN_DISTANCE_FROM_START) continue;

          // Deduplicate by externalId
          if (seenExternalIds.has(place.externalId)) continue;
          seenExternalIds.add(place.externalId);

          pool.push({
            place,
            bucketId: bucket.bucketId,
            thematicStrength: bucket.thematicStrength,
          });
        }
      } catch (err) {
        console.warn(
          `[generate-quest] Places search failed for type "${placeType}" in bucket "${bucket.bucketId}":`,
          err,
        );
        continue;
      }
    }
  }

  return pool;
}
