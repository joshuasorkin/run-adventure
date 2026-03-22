/**
 * OpenAI quest planner — uses GPT-4o-mini to generate quest plans from user goals.
 * Infrastructure layer. Converts free-text goals into structured quest plans
 * with Google Places types, objectives, and reward items.
 */

import OpenAI from "openai";
import { z } from "zod";
import type { QuestConfig } from "@/domain/quest/quest-config";
import type { ItemRarity } from "@/domain/inventory/inventory-item";

// --- Quest plan types ---

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

// --- Zod schema for validating LLM output ---

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

// --- JSON schema for OpenAI structured output ---

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
              description:
                "A valid Google Places API type (e.g. restaurant, park, library, pharmacy, cafe, bakery, gym, store, museum, book_store, pet_store, electronics_store, sporting_goods_store, hardware_store, supermarket, convenience_store, clothing_store, florist, fire_station, post_office, school, hospital, bar, movie_theater, shopping_mall)",
            },
            objectiveText: {
              type: "string" as const,
              description: "Action-oriented objective for this leg (e.g. 'Acquire the enchanted compass from...')",
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

// --- System prompt ---

function buildSystemPrompt(objectiveCount: number): string {
  return `You are a quest designer for a location-based running adventure game. The player runs to real places in their neighborhood to collect items and complete objectives.

Given a quest goal, generate a quest plan with exactly ${objectiveCount} legs. Each leg sends the player to a different type of real-world place.

Rules:
- Each leg must use a DIFFERENT googlePlacesType (no repeats).
- Use only valid Google Places API types from this list: restaurant, park, library, pharmacy, cafe, bakery, gym, store, museum, book_store, pet_store, electronics_store, sporting_goods_store, hardware_store, supermarket, convenience_store, clothing_store, florist, fire_station, post_office, school, hospital, bar, movie_theater, shopping_mall, playground, church, art_gallery, university, grocery_store.
- objectiveText should be action-oriented and thematic ("Run to the [place] and acquire...", "Seek the [item] at...").
- Item names should be thematic and fun (2-4 words).
- Item descriptions should be one-sentence flavor text.
- Make creative but plausible connections between the quest goal and the place types. A "rescue the unicorns" quest might visit a pet_store (to find clues about magical creatures) or a pharmacy (to get healing potions).
- Increase rarity as the quest progresses: early legs common/uncommon, later legs rare/legendary.`;
}

// --- Provider ---

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
