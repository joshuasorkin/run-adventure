import { z } from "zod";

export const spectateQuerySchema = z.object({
  session: z.string().uuid().optional(),
});

export const spectateTrailPointSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timestamp: z.string().datetime(),
});

export const spectateLegSchema = z.object({
  id: z.string().uuid(),
  sequenceIndex: z.number(),
  status: z.enum(["locked", "active", "reached", "completed", "skipped"]),
  objective: z.string(),
  targetPlaceName: z.string(),
  targetLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  geofenceRadiusMeters: z.number(),
});

export const spectateResponseSchema = z.object({
  session: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
    })
    .nullable(),
  quest: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      narrative: z.string(),
      status: z.enum(["active", "completed", "failed", "expired"]),
      currentLegIndex: z.number(),
      legs: z.array(spectateLegSchema),
    })
    .nullable(),
  trail: z.array(spectateTrailPointSchema),
  lastLocation: spectateTrailPointSchema.nullable(),
  totalDistanceMeters: z.number(),
  inventory: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      rarity: z.string(),
      quantity: z.number(),
    }),
  ),
});

export type SpectateResponse = z.infer<typeof spectateResponseSchema>;
