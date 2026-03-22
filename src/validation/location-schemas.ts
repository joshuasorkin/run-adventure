import { z } from "zod";

export const locationSampleInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1000),
  altitude: z.number().nullable(),
  speed: z.number().min(0).nullable(),
  heading: z.number().min(0).max(360).nullable(),
  timestamp: z.string().datetime(),
});

export const ingestLocationSchema = z.object({
  sessionId: z.string().uuid(),
  points: z.array(locationSampleInputSchema).min(1).max(50),
  idempotencyKey: z.string().min(1).max(128),
});

export type IngestLocationInput = z.infer<typeof ingestLocationSchema>;

export const ingestLocationResponseSchema = z.object({
  processed: z.number(),
  rejected: z.number(),
  questUpdate: z
    .object({
      questId: z.string().uuid(),
      legStatus: z.string(),
      itemCollected: z.string().nullable(),
    })
    .nullable(),
});
