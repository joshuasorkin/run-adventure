/**
 * CheerMessage — a spectator-to-runner encouragement message.
 * Pure domain type. No framework imports.
 */

import type { SessionId } from "@/domain/player/player-session";

export type CheerMessageId = string & { readonly __brand: unique symbol };

export interface CheerMessage {
  readonly id: CheerMessageId;
  readonly sessionId: SessionId;
  readonly senderName: string;
  readonly text: string;
  readonly sentAt: Date;
}
