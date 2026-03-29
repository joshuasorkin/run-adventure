import { NextRequest } from "next/server";
import { z } from "zod";
import { generateDynamicQuest } from "@/application/generate-quest";
import { startSession } from "@/application/start-session";
import type { SessionId } from "@/domain/player/player-session";
import {
  MIN_DISTANCE_METERS,
  MAX_DISTANCE_METERS,
  MIN_OBJECTIVE_COUNT,
  MAX_OBJECTIVE_COUNT,
  MIN_ROUTE_LENGTH_METERS,
  MAX_ROUTE_LENGTH_METERS,
} from "@/domain/quest/quest-config";

const previewSchema = z.object({
  startLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  maxDistanceMeters: z.number().min(MIN_DISTANCE_METERS).max(MAX_DISTANCE_METERS),
  maxRouteLength: z.number().min(MIN_ROUTE_LENGTH_METERS).max(MAX_ROUTE_LENGTH_METERS).optional(),
  questGoal: z.string().min(1).max(500),
  objectiveCount: z.number().int().min(MIN_OBJECTIVE_COUNT).max(MAX_OBJECTIVE_COUNT),
});

/**
 * POST /api/quest/generate-preview
 * Streams progress via SSE, then sends the final quest result.
 * Creates a throwaway session — intended for testing, not gameplay.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { startLocation, maxDistanceMeters, maxRouteLength, questGoal, objectiveCount } = parsed.data;
  const { sessionId } = startSession();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const result = await generateDynamicQuest(
          sessionId as SessionId,
          { startLocation, maxDistanceMeters, maxRouteLength, questGoal, objectiveCount },
          (step, totalSteps, message) => {
            sendEvent("progress", { step, totalSteps, message });
          },
        );

        const quest = result.quest;
        sendEvent("result", {
          questTitle: quest.title,
          narrative: quest.narrative,
          placesFound: result.placesFound,
          routeDistanceMeters: result.routeDistanceMeters,
          routeBudgetWarning: result.routeBudgetWarning ?? null,
          legDistances: result.legDistances,
          startLocation,
          legs: quest.legs.map((leg) => ({
            sequenceIndex: leg.sequenceIndex,
            objective: leg.objective.description,
            targetPlace: {
              name: leg.objective.targetPlace.name,
              category: leg.objective.targetPlace.category,
              address: leg.objective.targetPlace.address,
              location: leg.objective.targetPlace.location,
            },
            geofenceRadiusMeters: leg.objective.geofenceRadiusMeters,
            rewardItem: {
              name: leg.rewardItem.name,
              description: leg.rewardItem.description,
              rarity: leg.rewardItem.rarity,
            },
          })),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Quest generation failed";
        sendEvent("error", { error: message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
