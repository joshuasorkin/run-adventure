/**
 * sendCheer use case — spectator sends an encouragement message to the runner.
 *
 * 1. Verify active session exists
 * 2. Check rate limit (5 messages per 30s per sender)
 * 3. Create and persist CheerMessage
 */

import { v4 as uuid } from "uuid";
import type { SessionId } from "@/domain/player/player-session";
import type { CheerMessage, CheerMessageId } from "@/domain/cheer/cheer-message";
import { getState, addCheerMessage } from "@/infrastructure/persistence/in-memory-store";

const RATE_WINDOW_MS = 30_000;
const RATE_LIMIT = 5;

// senderName:sessionId → timestamps of recent sends
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(senderName: string, sessionId: SessionId): boolean {
  const key = `${senderName}:${sessionId}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? [];
  const recent = bucket.filter((t) => now - t < RATE_WINDOW_MS);
  rateBuckets.set(key, recent);
  return recent.length < RATE_LIMIT;
}

function recordSend(senderName: string, sessionId: SessionId): void {
  const key = `${senderName}:${sessionId}`;
  const bucket = rateBuckets.get(key) ?? [];
  bucket.push(Date.now());
  rateBuckets.set(key, bucket);
}

export interface SendCheerResult {
  message: CheerMessage;
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many messages. Please wait a moment.");
    this.name = "RateLimitError";
  }
}

export function sendCheer(
  sessionId: SessionId,
  senderName: string,
  text: string,
): SendCheerResult {
  const state = getState();
  if (!state.session || state.session.id !== sessionId) {
    throw new Error("No active session");
  }

  if (!checkRateLimit(senderName, sessionId)) {
    throw new RateLimitError();
  }

  const message: CheerMessage = {
    id: uuid() as CheerMessageId,
    sessionId,
    senderName,
    text,
    sentAt: new Date(),
  };

  addCheerMessage(message);
  recordSend(senderName, sessionId);

  return { message };
}
