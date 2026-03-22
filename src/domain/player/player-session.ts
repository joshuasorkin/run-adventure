/**
 * PlayerSession — a single run from start to end.
 * Pure domain entity. No framework imports.
 */

export type SessionId = string & { readonly __brand: unique symbol };
export type PlayerId = string & { readonly __brand: unique symbol };

export type SessionStatus = "active" | "paused" | "completed" | "abandoned";

export interface PlayerSession {
  readonly id: SessionId;
  readonly playerId: PlayerId;
  readonly status: SessionStatus;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
  readonly lastLocationAt: Date | null;
  readonly distanceMeters: number;
  readonly activeQuestId: string | null;
}

export function createSession(
  id: SessionId,
  playerId: PlayerId,
): PlayerSession {
  return {
    id,
    playerId,
    status: "active",
    startedAt: new Date(),
    endedAt: null,
    lastLocationAt: null,
    distanceMeters: 0,
    activeQuestId: null,
  };
}
