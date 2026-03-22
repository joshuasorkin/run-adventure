import { NextRequest, NextResponse } from "next/server";
import { questConfigSchema } from "@/validation/quest-generation-schemas";
import { generateDynamicQuest } from "@/application/generate-quest";
import { getState } from "@/infrastructure/persistence/in-memory-store";
import type { SessionId } from "@/domain/player/player-session";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = questConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sessionId, startLocation, maxDistanceMeters, questGoal, objectiveCount } = parsed.data;

  // Verify session exists
  const state = getState();
  if (!state.session || state.session.id !== sessionId) {
    return NextResponse.json(
      { error: `No active session with id ${sessionId}` },
      { status: 400 },
    );
  }

  try {
    const result = await generateDynamicQuest(sessionId as SessionId, {
      startLocation,
      maxDistanceMeters,
      questGoal,
      objectiveCount,
    });

    const quest = result.quest;
    const firstLeg = quest.legs[0];

    return NextResponse.json(
      {
        questId: quest.id,
        questTitle: quest.title,
        narrative: quest.narrative,
        firstObjective: firstLeg?.objective.description ?? null,
        legCount: quest.legs.length,
        placesFound: result.placesFound,
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quest generation failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
