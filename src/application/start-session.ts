/**
 * startSession use case — begins a new run.
 * Quest generation is always separate (via /api/quest/generate).
 */

import { v4 as uuid } from "uuid";
import type { SessionId, PlayerId } from "@/domain/player/player-session";
import { createSession } from "@/domain/player/player-session";
import {
  resetState,
  setSession,
} from "@/infrastructure/persistence/in-memory-store";

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

  return {
    sessionId: session.id,
    questTitle: null,
    firstObjective: null,
  };
}
