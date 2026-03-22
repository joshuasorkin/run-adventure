/**
 * generateDynamicQuest use case — orchestrates LLM + Places API + route planning
 * to build a quest from user configuration.
 */

import { v4 as uuid } from "uuid";
import type { SessionId } from "@/domain/player/player-session";
import type { QuestConfig } from "@/domain/quest/quest-config";
import type { Quest } from "@/domain/quest/quest";
import type { PlaceCandidate } from "@/domain/place/place-candidate";
import type { ItemId } from "@/domain/inventory/inventory-item";
import type { QuestLegTemplate } from "@/domain/quest/quest-generator";
import { generateQuest } from "@/domain/quest/quest-generator";
import { planRoute, isRouteWithinBudget } from "@/domain/quest/route-planner";
import {
  generateQuestPlan,
  type QuestPlan,
  type QuestLegPlan,
} from "@/infrastructure/providers/llm/openai-quest-planner";
import { GooglePlacesProvider } from "@/infrastructure/providers/map/google-places-provider";
import { env } from "@/infrastructure/config/env";
import { setQuest } from "@/infrastructure/persistence/in-memory-store";

const MAX_RETRIES = 3;
const RADIUS_SHRINK_FACTOR = 0.7;

export interface GenerateQuestResult {
  readonly quest: Quest;
  readonly placesFound: number;
}

export async function generateDynamicQuest(
  sessionId: SessionId,
  config: QuestConfig,
): Promise<GenerateQuestResult> {
  const placesProvider = new GooglePlacesProvider(env.GOOGLE_MAPS_API_KEY);

  // Step 1: Get quest plan from LLM
  let plan = await generateQuestPlan(config, env.OPENAI_API_KEY, 0.3);

  // Step 2: Search for places near the start location
  let searchRadius = config.maxDistanceMeters / 2;
  let matchedLegs: { legPlan: QuestLegPlan; place: PlaceCandidate }[] = [];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    matchedLegs = await findPlacesForLegs(
      placesProvider,
      plan,
      config,
      searchRadius,
    );

    if (matchedLegs.length >= config.objectiveCount) {
      break;
    }

    // Not enough places found — retry with higher temperature for more creative types
    if (attempt === 0) {
      plan = await generateQuestPlan(config, env.OPENAI_API_KEY, 0.7);
      matchedLegs = await findPlacesForLegs(
        placesProvider,
        plan,
        config,
        searchRadius,
      );

      if (matchedLegs.length >= config.objectiveCount) {
        break;
      }
    }

    // Shrink radius on subsequent retries
    searchRadius = searchRadius * RADIUS_SHRINK_FACTOR;
  }

  if (matchedLegs.length === 0) {
    throw new Error(
      "Could not find any matching places nearby. Try increasing the max distance or choosing a different goal.",
    );
  }

  // Use as many legs as we found, up to objectiveCount
  const selectedLegs = matchedLegs.slice(0, config.objectiveCount);
  const selectedPlaces = selectedLegs.map((l) => l.place);

  // Step 3: Order places by nearest-neighbor route
  const orderedPlaces = planRoute(config.startLocation, selectedPlaces);

  // Step 4: Check route fits within budget
  if (!isRouteWithinBudget(config.startLocation, orderedPlaces, config.maxDistanceMeters)) {
    // Try with smaller radius
    let budgetOk = false;
    let retryRadius = searchRadius * RADIUS_SHRINK_FACTOR;

    for (let i = 0; i < MAX_RETRIES && !budgetOk; i++) {
      const retryLegs = await findPlacesForLegs(
        placesProvider,
        plan,
        config,
        retryRadius,
      );

      if (retryLegs.length > 0) {
        const retryPlaces = retryLegs.slice(0, config.objectiveCount).map((l) => l.place);
        const retryOrdered = planRoute(config.startLocation, retryPlaces);

        if (isRouteWithinBudget(config.startLocation, retryOrdered, config.maxDistanceMeters)) {
          // Rebuild selectedLegs with the closer places
          selectedLegs.length = 0;
          selectedLegs.push(...retryLegs.slice(0, config.objectiveCount));
          orderedPlaces.length = 0;
          orderedPlaces.push(...retryOrdered);
          budgetOk = true;
        }
      }

      retryRadius *= RADIUS_SHRINK_FACTOR;
    }

    if (!budgetOk) {
      // Proceed anyway with whatever we have — the route may be slightly over budget
      // but it's better than failing entirely
    }
  }

  // Step 5: Build QuestLegTemplates in route order
  const legTemplates: QuestLegTemplate[] = orderedPlaces.map((place) => {
    const legMatch = selectedLegs.find((l) => l.place.id === place.id);
    const legPlan = legMatch?.legPlan ?? plan.legs[0];

    return {
      place,
      objectiveText: legPlan.objectiveText,
      rewardItem: {
        id: uuid() as ItemId,
        name: legPlan.itemName,
        description: legPlan.itemDescription,
        rarity: legPlan.itemRarity,
        iconKey: legPlan.itemName.toLowerCase().replace(/\s+/g, "-"),
      },
    };
  });

  // Step 6: Generate the quest using existing domain function
  const quest = generateQuest(sessionId, plan.title, plan.narrative, legTemplates);
  setQuest(quest);

  return {
    quest,
    placesFound: matchedLegs.length,
  };
}

/**
 * For each leg in the quest plan, search for a nearby place of the specified type.
 * Returns matched legs with their found places.
 */
async function findPlacesForLegs(
  provider: GooglePlacesProvider,
  plan: QuestPlan,
  config: QuestConfig,
  searchRadius: number,
): Promise<{ legPlan: QuestLegPlan; place: PlaceCandidate }[]> {
  const matched: { legPlan: QuestLegPlan; place: PlaceCandidate }[] = [];
  const usedPlaceIds = new Set<string>();

  for (const legPlan of plan.legs) {
    try {
      const places = await provider.findNearbyPlaces({
        center: config.startLocation,
        radiusMeters: searchRadius,
        categories: [legPlan.googlePlacesType as never], // Pass as-is; Google API handles the type
        maxResults: 5,
      });

      // Pick the first place we haven't already used
      const available = places.find((p) => !usedPlaceIds.has(p.externalId));
      if (available) {
        usedPlaceIds.add(available.externalId);
        matched.push({ legPlan, place: available });
      }
    } catch {
      // Skip this leg type if the search fails — try the next one
      continue;
    }
  }

  return matched;
}
