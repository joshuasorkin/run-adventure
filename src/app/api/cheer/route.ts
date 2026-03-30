import { NextRequest, NextResponse } from "next/server";
import { sendCheerSchema, cheerQuerySchema } from "@/validation/cheer-schemas";
import { sendCheer, RateLimitError } from "@/application/send-cheer";
import { getCheerMessagesSince } from "@/infrastructure/persistence/in-memory-store";
import type { SessionId } from "@/domain/player/player-session";
import type { CheerMessageId } from "@/domain/cheer/cheer-message";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = sendCheerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = sendCheer(
      parsed.data.sessionId as SessionId,
      parsed.data.senderName,
      parsed.data.text,
    );
    return NextResponse.json(
      {
        id: result.message.id,
        senderName: result.message.senderName,
        text: result.message.text,
        sentAt: result.message.sentAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": "10" } },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const afterParam = request.nextUrl.searchParams.get("after") ?? undefined;
  const parsed = cheerQuerySchema.safeParse({ after: afterParam });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const afterId = (parsed.data.after as CheerMessageId) ?? null;
  const messages = getCheerMessagesSince(afterId);

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      senderName: m.senderName,
      text: m.text,
      sentAt: m.sentAt.toISOString(),
    })),
  });
}
