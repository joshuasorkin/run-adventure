import { describe, it, expect } from "vitest";
import { sendCheerSchema, cheerQuerySchema } from "@/validation/cheer-schemas";

describe("sendCheerSchema", () => {
  const valid = {
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    senderName: "Maria",
    text: "Keep going!",
  };

  it("accepts valid input", () => {
    expect(sendCheerSchema.safeParse(valid).success).toBe(true);
  });

  it("trims whitespace from senderName and text", () => {
    const result = sendCheerSchema.parse({
      ...valid,
      senderName: "  Maria  ",
      text: "  Go!  ",
    });
    expect(result.senderName).toBe("Maria");
    expect(result.text).toBe("Go!");
  });

  it("rejects empty senderName", () => {
    expect(
      sendCheerSchema.safeParse({ ...valid, senderName: "" }).success,
    ).toBe(false);
  });

  it("rejects whitespace-only senderName", () => {
    expect(
      sendCheerSchema.safeParse({ ...valid, senderName: "   " }).success,
    ).toBe(false);
  });

  it("rejects senderName over 30 chars", () => {
    expect(
      sendCheerSchema.safeParse({ ...valid, senderName: "A".repeat(31) })
        .success,
    ).toBe(false);
  });

  it("rejects empty text", () => {
    expect(
      sendCheerSchema.safeParse({ ...valid, text: "" }).success,
    ).toBe(false);
  });

  it("rejects text over 200 chars", () => {
    expect(
      sendCheerSchema.safeParse({ ...valid, text: "A".repeat(201) }).success,
    ).toBe(false);
  });

  it("rejects non-uuid sessionId", () => {
    expect(
      sendCheerSchema.safeParse({ ...valid, sessionId: "not-a-uuid" }).success,
    ).toBe(false);
  });
});

describe("cheerQuerySchema", () => {
  it("accepts empty object", () => {
    expect(cheerQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid uuid after param", () => {
    expect(
      cheerQuerySchema.safeParse({
        after: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });

  it("rejects non-uuid after param", () => {
    expect(
      cheerQuerySchema.safeParse({ after: "not-a-uuid" }).success,
    ).toBe(false);
  });
});
