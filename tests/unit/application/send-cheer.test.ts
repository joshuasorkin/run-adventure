import { describe, it, expect, beforeEach } from "vitest";
import { sendCheer, RateLimitError } from "@/application/send-cheer";
import {
  resetState,
  setSession,
  getCheerMessagesSince,
} from "@/infrastructure/persistence/in-memory-store";
import { makeSession } from "@tests/fixtures/factories";
import type { SessionId } from "@/domain/player/player-session";
import type { CheerMessageId } from "@/domain/cheer/cheer-message";

describe("sendCheer", () => {
  const session = makeSession();

  beforeEach(() => {
    resetState();
    setSession(session);
  });

  it("creates a cheer message and stores it", () => {
    const result = sendCheer(session.id, "Maria", "Keep going!");
    expect(result.message.senderName).toBe("Maria");
    expect(result.message.text).toBe("Keep going!");
    expect(result.message.sessionId).toBe(session.id);

    const stored = getCheerMessagesSince(null);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(result.message.id);
  });

  it("throws when no active session", () => {
    resetState();
    expect(() => sendCheer(session.id, "Maria", "Hello")).toThrow(
      "No active session",
    );
  });

  it("throws when session ID does not match", () => {
    const wrongId = "00000000-0000-0000-0000-000000000000" as SessionId;
    expect(() => sendCheer(wrongId, "Maria", "Hello")).toThrow(
      "No active session",
    );
  });

  it("enforces rate limit after 5 messages", () => {
    for (let i = 0; i < 5; i++) {
      sendCheer(session.id, "Spammer", `msg ${i}`);
    }
    expect(() => sendCheer(session.id, "Spammer", "one more")).toThrow(
      RateLimitError,
    );
  });

  it("allows different senders independently", () => {
    for (let i = 0; i < 5; i++) {
      sendCheer(session.id, "Alice", `msg ${i}`);
    }
    // Alice is rate-limited but Bob is not
    expect(() => sendCheer(session.id, "Alice", "blocked")).toThrow(
      RateLimitError,
    );
    expect(() =>
      sendCheer(session.id, "Bob", "still ok"),
    ).not.toThrow();
  });
});

describe("getCheerMessagesSince", () => {
  const session = makeSession();

  beforeEach(() => {
    resetState();
    setSession(session);
  });

  it("returns all messages when cursor is null", () => {
    sendCheer(session.id, "A", "msg1");
    sendCheer(session.id, "B", "msg2");
    const all = getCheerMessagesSince(null);
    expect(all).toHaveLength(2);
  });

  it("returns only messages after cursor", () => {
    const r1 = sendCheer(session.id, "A", "msg1");
    sendCheer(session.id, "B", "msg2");
    sendCheer(session.id, "C", "msg3");

    const after = getCheerMessagesSince(r1.message.id);
    expect(after).toHaveLength(2);
    expect(after[0].senderName).toBe("B");
    expect(after[1].senderName).toBe("C");
  });

  it("returns all messages when cursor ID is unknown", () => {
    sendCheer(session.id, "A", "msg1");
    const unknownId = "00000000-0000-0000-0000-000000000099" as CheerMessageId;
    const result = getCheerMessagesSince(unknownId);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when cursor is the last message", () => {
    const r1 = sendCheer(session.id, "A", "msg1");
    const after = getCheerMessagesSince(r1.message.id);
    expect(after).toHaveLength(0);
  });
});
