import { z } from "zod";
import { coordinatesSchema } from "./common-schemas";
import {
  MIN_OBJECTIVE_COUNT,
  MAX_OBJECTIVE_COUNT,
  MIN_DISTANCE_METERS,
  MAX_DISTANCE_METERS,
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_QUEST_GOAL,
  DEFAULT_OBJECTIVE_COUNT,
} from "@/domain/quest/quest-config";

export const questConfigSchema = z.object({
  sessionId: z.string().uuid(),
  startLocation: coordinatesSchema,
  maxDistanceMeters: z
    .number()
    .min(MIN_DISTANCE_METERS)
    .max(MAX_DISTANCE_METERS)
    .default(DEFAULT_MAX_DISTANCE_METERS),
  questGoal: z
    .string()
    .min(1)
    .max(200)
    .default(DEFAULT_QUEST_GOAL),
  objectiveCount: z
    .number()
    .int()
    .min(MIN_OBJECTIVE_COUNT)
    .max(MAX_OBJECTIVE_COUNT)
    .default(DEFAULT_OBJECTIVE_COUNT),
});

export type QuestConfigInput = z.infer<typeof questConfigSchema>;
