import { NextRequest, NextResponse } from "next/server";
import { startSessionSchema } from "@/validation/session-schemas";
import { startSession } from "@/application/start-session";

export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body missing or not valid JSON — fine for alpha, proceed without playerId
  }

  const parsed = startSessionSchema.safeParse(body);

  if (!parsed.success) {
    // For alpha: allow starting without a playerId
    const result = startSession();
    return NextResponse.json(result, { status: 201 });
  }

  const result = startSession(parsed.data.playerId);
  return NextResponse.json(result, { status: 201 });
}
