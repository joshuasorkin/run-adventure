import { z } from "zod";

export const startSessionSchema = z.object({
  playerId: z.string().uuid(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;

export const sessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(["active", "paused", "completed", "abandoned"]),
  startedAt: z.string().datetime(),
});
