/**
 * QuestConfig — value object for quest generation parameters.
 * Pure domain. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";

export interface QuestConfig {
  readonly startLocation: Coordinates;
  readonly maxDistanceMeters: number;
  readonly questGoal: string;
  readonly objectiveCount: number;
}

export const DEFAULT_MAX_DISTANCE_METERS = 1609; // 1 mile
export const DEFAULT_QUEST_GOAL = "city wellness sweep";
export const DEFAULT_OBJECTIVE_COUNT = 4;

export const MIN_OBJECTIVE_COUNT = 2;
export const MAX_OBJECTIVE_COUNT = 10;
export const MIN_DISTANCE_METERS = 400;
export const MAX_DISTANCE_METERS = 16000; // ~10 miles
