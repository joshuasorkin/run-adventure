import { z } from "zod";

export const sendCheerSchema = z.object({
  sessionId: z.string().uuid(),
  senderName: z.string().trim().min(1).max(30),
  text: z.string().trim().min(1).max(200),
});

export type SendCheerInput = z.infer<typeof sendCheerSchema>;

export const cheerQuerySchema = z.object({
  after: z.string().uuid().optional(),
});

export const cheerMessageViewSchema = z.object({
  id: z.string().uuid(),
  senderName: z.string(),
  text: z.string(),
  sentAt: z.string().datetime(),
});

export const cheerMessagesResponseSchema = z.object({
  messages: z.array(cheerMessageViewSchema),
});
