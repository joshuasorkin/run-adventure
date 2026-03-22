import { z } from "zod";

export const questLegResponseSchema = z.object({
  id: z.string().uuid(),
  sequenceIndex: z.number(),
  status: z.enum(["locked", "active", "reached", "completed", "skipped"]),
  objective: z.string(),
  targetPlaceName: z.string(),
  targetLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  rewardItemName: z.string(),
  geofenceRadiusMeters: z.number(),
});

export const questResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  narrative: z.string(),
  status: z.enum(["active", "completed", "failed", "expired"]),
  currentLegIndex: z.number(),
  legs: z.array(questLegResponseSchema),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
