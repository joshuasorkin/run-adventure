import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  MAP_PROVIDER: z.enum(["google", "osm", "fixture"]).default("fixture"),
  GOOGLE_MAPS_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  GEOFENCE_RADIUS_METERS: z.coerce.number().positive().default(30),
  MAX_RUNNING_SPEED_MS: z.coerce.number().positive().default(12),
  GPS_ACCURACY_THRESHOLD_METERS: z.coerce.number().positive().default(50),
  GPS_SMOOTHING_WINDOW: z.coerce.number().int().min(1).default(3),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(formatted, null, 2)}`
    );
  }
  return result.data;
}

export const env = loadEnv();
