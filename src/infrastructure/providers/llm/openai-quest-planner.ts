/**
 * OpenAI quest planner — uses GPT-4o-mini for quest generation.
 * Infrastructure layer. Two-phase approach:
 *   1. generateThemePlan() — theme skeleton with objective buckets
 *   2. generateNarrative() — final narrative for actual selected places
 *
 * Also retains the legacy generateQuestPlan() for backward compatibility.
 */

import OpenAI from "openai";
import { z } from "zod";
import type { QuestConfig } from "@/domain/quest/quest-config";
import type { ItemRarity } from "@/domain/inventory/inventory-item";
import type { PlaceCandidate } from "@/domain/place/place-candidate";
import type { ThemeSchema, ObjectiveBucket } from "@/domain/quest/theme-schema";

// ============================================================
// Phase 1: Theme Plan — generates objective buckets with fallback types
// ============================================================

const VALID_GOOGLE_PLACES_TYPES =
  "restaurant, park, library, pharmacy, cafe, bakery, gym, store, museum, book_store, pet_store, electronics_store, sporting_goods_store, hardware_store, supermarket, convenience_store, clothing_store, florist, fire_station, post_office, school, hospital, bar, movie_theater, shopping_mall, playground, church, art_gallery, university, grocery_store";

// --- Zod schema for theme plan response ---

const objectiveBucketResponseSchema = z.object({
  bucketId: z.string(),
  placeTypes: z.array(z.string()).min(1).max(3),
  narrativeHint: z.string(),
  thematicStrength: z.number().min(0).max(1),
});

const themePlanResponseSchema = z.object({
  titleSeed: z.string(),
  narrativePremise: z.string(),
  buckets: z.array(objectiveBucketResponseSchema),
});

// --- JSON schema for OpenAI structured output ---

const THEME_PLAN_JSON_SCHEMA = {
  name: "theme_plan",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      titleSeed: {
        type: "string" as const,
        description: "Working quest title (3-8 words)",
      },
      narrativePremise: {
        type: "string" as const,
        description: "1-2 sentence quest premise/backstory",
      },
      buckets: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            bucketId: {
              type: "string" as const,
              description: "Unique identifier for this bucket (e.g. 'bucket-1')",
            },
            placeTypes: {
              type: "array" as const,
              items: { type: "string" as const },
              description:
                "1-3 valid Google Places API types, ordered by preference (primary + fallbacks)",
            },
            narrativeHint: {
              type: "string" as const,
              description:
                "Short narrative hint for this objective (e.g. 'acquire a signal dampener')",
            },
            thematicStrength: {
              type: "number" as const,
              description:
                "How central this bucket is to the quest theme (0.0 = tangential, 1.0 = core)",
            },
          },
          required: ["bucketId", "placeTypes", "narrativeHint", "thematicStrength"],
          additionalProperties: false,
        },
      },
    },
    required: ["titleSeed", "narrativePremise", "buckets"],
    additionalProperties: false,
  },
};

function buildThemeSystemPrompt(bucketCount: number): string {
  return `You are a quest designer for a location-based running adventure game. The player runs to real places in their neighborhood to collect items and complete objectives.

Given a quest goal, generate a THEME PLAN with exactly ${bucketCount} objective buckets. Each bucket describes a type of real-world place the player might visit. You are generating MORE buckets than the player will actually visit — the system will select the best subset based on what's available nearby.

Rules:
- Each bucket must have 1-3 Google Places types (primary type + fallbacks), ordered by preference.
- Use DIFFERENT primary types across buckets (minimize overlap).
- Use only valid Google Places API types: ${VALID_GOOGLE_PLACES_TYPES}.
- narrativeHint should be a short action phrase that stays tightly focused on the quest goal's LITERAL subject matter. For example:
  - Goal "Restore the Tang Dynasty" → "recover Li Bai's lost wine cup", "find a recipe for Tang-era Hu cake" (not "acquire healing supplies")
  - Goal "Find my pants" → "recover the missing zipper pull", "interrogate the tailor about the inseam" (not "acquire a ticket stub of nostalgia")
  Use vocabulary, objects, concepts, and details that are DIRECTLY about the topic — not loosely associated or metaphorical.
- thematicStrength (0-1) indicates how central this bucket is to the quest theme. Core objectives = 0.8-1.0, supporting = 0.5-0.7, tangential = 0.2-0.4.
- titleSeed is a working title (3-8 words).
- narrativePremise is a 1-2 sentence quest backstory that references specific details from the quest goal's subject matter.`;
}

/**
 * Phase 1: Generate a theme plan with objective buckets.
 * Returns more buckets than needed so the selector can choose the best subset.
 */
export async function generateThemePlan(
  config: QuestConfig,
  apiKey: string,
  temperature = 0.5,
): Promise<ThemeSchema> {
  const bucketCount = Math.ceil(config.objectiveCount * 1.5);
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: THEME_PLAN_JSON_SCHEMA,
    },
    messages: [
      {
        role: "system",
        content: buildThemeSystemPrompt(bucketCount),
      },
      {
        role: "user",
        content: `Quest goal: "${config.questGoal}"\nNumber of objectives the player will complete: ${config.objectiveCount}\nGenerate ${bucketCount} candidate buckets.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response for theme plan");
  }

  const parsed = JSON.parse(content);
  return themePlanResponseSchema.parse(parsed);
}

// ============================================================
// Phase 2: Narrative — generates story for actual selected places
// ============================================================

export interface NarrativeResponse {
  readonly title: string;
  readonly narrative: string;
  readonly legs: readonly {
    readonly objectiveText: string;
    readonly itemName: string;
    readonly itemDescription: string;
    readonly itemRarity: ItemRarity;
  }[];
}

const narrativeLegSchema = z.object({
  objectiveText: z.string(),
  itemName: z.string(),
  itemDescription: z.string(),
  itemRarity: z.enum(["common", "uncommon", "rare", "legendary"]),
});

const narrativeResponseSchema = z.object({
  title: z.string(),
  narrative: z.string(),
  legs: z.array(narrativeLegSchema),
});

const NARRATIVE_JSON_SCHEMA = {
  name: "quest_narrative",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      title: {
        type: "string" as const,
        description: "Final quest title (3-8 words)",
      },
      narrative: {
        type: "string" as const,
        description: "1-3 sentence quest narrative arc",
      },
      legs: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            objectiveText: {
              type: "string" as const,
              description:
                "Action-oriented objective mentioning the ACTUAL place name (e.g., 'Run to CVS Pharmacy and acquire the healing tonic')",
            },
            itemName: {
              type: "string" as const,
              description: "Thematic reward item name (2-4 words)",
            },
            itemDescription: {
              type: "string" as const,
              description: "Flavor text for the item (1 sentence)",
            },
            itemRarity: {
              type: "string" as const,
              enum: ["common", "uncommon", "rare", "legendary"],
            },
          },
          required: ["objectiveText", "itemName", "itemDescription", "itemRarity"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "narrative", "legs"],
    additionalProperties: false,
  },
};

/**
 * Phase 2: Generate narrative for the actual selected and ordered places.
 * The LLM writes objectives that reference real place names.
 */
export async function generateNarrative(
  places: readonly PlaceCandidate[],
  themePremise: string,
  questGoal: string,
  apiKey: string,
  temperature = 0.3,
): Promise<NarrativeResponse> {
  const client = new OpenAI({ apiKey });

  const lastIdx = places.length - 1;
  const placeList = places
    .map((p, i) => {
      if (i === lastIdx) {
        const hasNamedPlace = p.name !== p.address && p.address != null;
        if (hasNamedPlace) {
          return `${i + 1}. RETURN HOME — use this real place name: "${p.name}"`;
        }
        const addr = p.address ?? p.name;
        return `${i + 1}. RETURN HOME — invent a fictional place name from this address: "${addr}" (DO NOT use the raw address as the place name)`;
      }
      return `${i + 1}. "${p.name}" (${p.category})`;
    })
    .join("\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: NARRATIVE_JSON_SCHEMA,
    },
    messages: [
      {
        role: "system",
        content: `You are a quest narrator for a location-based running adventure game. The player will run to real places in order. Write engaging objectives and reward items for each stop.

CRITICAL: Item names are parts of, clues about, or components of the quest goal's subject — NOT items you would normally find at the place. The place is just where the item happens to be hidden. Ask yourself: "Is this item ABOUT the quest goal, or is it ABOUT the place?" If it's about the place, rewrite it.

Examples:
  Goal "Find my pants" at a library → "The Torn Back Pocket" (part of the pants found tucked in a book), NOT "Borrowed Book"
  Goal "Find my pants" at a gym → "The Brass Zipper Pull" (a pants component found in the locker room), NOT "Gym Towel"
  Goal "Find my pants" at a theater → "The Grass-Stained Knee Patch" (evidence from the pants), NOT "Ticket Stub"
  Goal "Restore the Tang Dynasty" at a cafe → "Du Fu's Poetry Fragment" (a real Tang poet's work), NOT "Artisan Latte"

Rules:
- Each objectiveText MUST mention the actual place name AND describe finding/recovering a quest-goal-related item there (e.g., "Run to Oakland Public Library — a torn pocket was found pressed between the pages of a returned book").
- Every item name must be a component, fragment, clue, or artifact directly related to the quest goal's subject matter. For "find my pants": belt loops, rivets, zipper pulls, fabric swatches, thread, pockets, cuffs, waistband, inseam measurements, laundry tags. For "Restore the Tang Dynasty": specific poets, emperors, artworks, dishes, inventions, battles, policies.
- Item descriptions: one sentence explaining what this item is and how it advances the quest (not how it relates to the place).
- Increase rarity as the quest progresses: early stops common/uncommon, later stops rare/legendary.
- The narrative should read as a coherent story about the quest goal, with each stop advancing toward resolution.
- THE FINAL STOP is always the player's starting location (marked "RETURN HOME" with its street address). It must provide NARRATIVE RESOLUTION — the quest goal is achieved here. The player returns home with all gathered clues/components and completes the quest.
- For the final stop's location name in the objectiveText, there are two cases:
  A) If the final stop has a NAMED PLACE, use its real name directly. Do NOT reimagine it. Examples:
    - "KP Asian Market" → "Return to KP Asian Market and..."
    - "Peet's Coffee" → "Return to Peet's Coffee and..."
  B) If the final stop has only a STREET ADDRESS (no named place), invent a fictional location name derived from the STREET NAME or NUMBER — NOT from the quest goal. The player needs to recognize the real address from the fictional name. The fictional name must NOT contain "Street", "Ave", "Blvd", "St", or any address format. Examples:
    - Address "702 43rd St" → "Temple of the 702" or "The 43rd Parallel Command Center" (derived from "702" and "43rd")
    - Address "2370 Telegraph Ave" → "The Telegraphic Fortress" or "Station 2370" (derived from "Telegraph" and "2370")
    - Address "131 La Salle Ave" → "The La Salle Sanctum" or "Fort 131" (derived from "La Salle" and "131")
    - Address "15 Santa Ray Ave" → "Santa Ray Sanctuary" (derived from "Santa Ray")
    - Address "88 Pine St" → "The Pine Citadel" or "Tower of 88 Pines" (derived from "Pine" and "88")
    WRONG: "Valor's Sanctuary" for address "131 La Salle Ave" — this comes from the quest goal, not the address. The player cannot find "La Salle" in the name.
    WRONG: "Cyber Fortress of 2370 Telegraph Ave" — contains "Ave".
    RIGHT: "The La Salle Sanctum" — derived from the street name, recognizable to the player.
- Generate exactly ${places.length} legs, one per place, in the order given.`,
      },
      {
        role: "user",
        content: `Quest goal: "${questGoal}"
Theme premise: "${themePremise}"

The player will visit these places in order:
${placeList}

Generate a title, narrative, and one leg per place.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response for narrative");
  }

  const parsed = JSON.parse(content);
  return narrativeResponseSchema.parse(parsed);
}

// ============================================================
// Legacy: Single-call quest plan (kept for backward compatibility)
// ============================================================

export interface QuestLegPlan {
  readonly googlePlacesType: string;
  readonly objectiveText: string;
  readonly itemName: string;
  readonly itemDescription: string;
  readonly itemRarity: ItemRarity;
}

export interface QuestPlan {
  readonly title: string;
  readonly narrative: string;
  readonly legs: readonly QuestLegPlan[];
}

const questLegPlanSchema = z.object({
  googlePlacesType: z.string(),
  objectiveText: z.string(),
  itemName: z.string(),
  itemDescription: z.string(),
  itemRarity: z.enum(["common", "uncommon", "rare", "legendary"]),
});

const questPlanResponseSchema = z.object({
  title: z.string(),
  narrative: z.string(),
  legs: z.array(questLegPlanSchema),
});

const QUEST_PLAN_JSON_SCHEMA = {
  name: "quest_plan",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const, description: "Quest title (3-8 words)" },
      narrative: {
        type: "string" as const,
        description: "1-2 sentence quest narrative/backstory",
      },
      legs: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            googlePlacesType: {
              type: "string" as const,
              description: `A valid Google Places API type (e.g. ${VALID_GOOGLE_PLACES_TYPES})`,
            },
            objectiveText: {
              type: "string" as const,
              description:
                "Action-oriented objective for this leg (e.g. 'Acquire the enchanted compass from...')",
            },
            itemName: {
              type: "string" as const,
              description: "Thematic reward item name (2-4 words)",
            },
            itemDescription: {
              type: "string" as const,
              description: "Flavor text for the item (1 sentence)",
            },
            itemRarity: {
              type: "string" as const,
              enum: ["common", "uncommon", "rare", "legendary"],
            },
          },
          required: [
            "googlePlacesType",
            "objectiveText",
            "itemName",
            "itemDescription",
            "itemRarity",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "narrative", "legs"],
    additionalProperties: false,
  },
};

function buildSystemPrompt(objectiveCount: number): string {
  return `You are a quest designer for a location-based running adventure game. The player runs to real places in their neighborhood to collect items and complete objectives.

Given a quest goal, generate a quest plan with exactly ${objectiveCount} legs. Each leg sends the player to a different type of real-world place.

Rules:
- Each leg must use a DIFFERENT googlePlacesType (no repeats).
- Use only valid Google Places API types from this list: ${VALID_GOOGLE_PLACES_TYPES}.
- objectiveText should be action-oriented and thematic ("Run to the [place] and acquire...", "Seek the [item] at...").
- Item names should be thematic and fun (2-4 words).
- Item descriptions should be one-sentence flavor text.
- Make creative but plausible connections between the quest goal and the place types. A "rescue the unicorns" quest might visit a pet_store (to find clues about magical creatures) or a pharmacy (to get healing potions).
- Increase rarity as the quest progresses: early legs common/uncommon, later legs rare/legendary.`;
}

/** @deprecated Use generateThemePlan() + generateNarrative() instead. */
export async function generateQuestPlan(
  config: QuestConfig,
  apiKey: string,
  temperature = 0.3,
): Promise<QuestPlan> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    max_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: QUEST_PLAN_JSON_SCHEMA,
    },
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(config.objectiveCount),
      },
      {
        role: "user",
        content: `Quest goal: "${config.questGoal}"\nNumber of objectives: ${config.objectiveCount}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = JSON.parse(content);
  const validated = questPlanResponseSchema.parse(parsed);

  return validated;
}
