/**
 * startSession use case — begins a new run.
 * Quest generation is now separate (via generate-quest use case).
 * Alpha fallback: when MAP_PROVIDER=fixture, attaches the hardcoded quest.
 */

import { v4 as uuid } from "uuid";
import type { SessionId, PlayerId } from "@/domain/player/player-session";
import { createSession } from "@/domain/player/player-session";
import { createAlphaQuest } from "@/application/alpha-quest-chain";
import {
  resetState,
  setSession,
  setQuest,
} from "@/infrastructure/persistence/in-memory-store";
import { env } from "@/infrastructure/config/env";

export interface StartSessionResult {
  readonly sessionId: SessionId;
  readonly questTitle: string | null;
  readonly firstObjective: string | null;
}

export function startSession(playerId?: string): StartSessionResult {
  // Reset all state and start fresh
  resetState();

  const session = createSession(
    uuid() as SessionId,
    (playerId ?? uuid()) as PlayerId,
  );
  setSession(session);

  // Alpha fallback: attach hardcoded quest when using fixture provider
  if (env.MAP_PROVIDER === "fixture") {
    const quest = createAlphaQuest(session.id);
    setQuest(quest);

    return {
      sessionId: session.id,
      questTitle: quest.title,
      firstObjective: quest.legs[0].objective.description,
    };
  }

  // Dynamic mode: quest will be generated separately via /api/quest/generate
  return {
    sessionId: session.id,
    questTitle: null,
    firstObjective: null,
  };
}
