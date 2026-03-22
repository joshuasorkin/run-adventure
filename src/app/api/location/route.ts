import { NextRequest, NextResponse } from "next/server";
import { ingestLocationSchema } from "@/validation/location-schemas";
import { ingestLocation } from "@/application/ingest-location";
import type { SessionId } from "@/domain/player/player-session";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ingestLocationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = ingestLocation(
      parsed.data.sessionId as SessionId,
      parsed.data.points,
      parsed.data.idempotencyKey,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
