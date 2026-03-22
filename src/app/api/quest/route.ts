import { NextResponse } from "next/server";
import { getState } from "@/infrastructure/persistence/in-memory-store";
import { haversineDistance } from "@/domain/location/geo";
import { activeLeg } from "@/domain/quest/quest";

export async function GET() {
  const state = getState();

  if (!state.quest) {
    return NextResponse.json({ quest: null }, { status: 200 });
  }

  const quest = state.quest;
  const currentLeg = activeLeg(quest);

  // Compute distance from last known location to current target
  let distanceToTarget: number | null = null;
  if (currentLeg && state.locationHistory.length > 0) {
    const lastLoc = state.locationHistory[state.locationHistory.length - 1];
    distanceToTarget = haversineDistance(
      { latitude: lastLoc.latitude, longitude: lastLoc.longitude },
      currentLeg.objective.targetPlace.location,
    );
  }

  return NextResponse.json({
    quest: {
      id: quest.id,
      title: quest.title,
      narrative: quest.narrative,
      status: quest.status,
      currentLegIndex: quest.currentLegIndex,
      legs: quest.legs.map((leg) => ({
        id: leg.id,
        sequenceIndex: leg.sequenceIndex,
        status: leg.status,
        objective: leg.objective.description,
        targetPlaceName: leg.objective.targetPlace.name,
        targetLocation: leg.objective.targetPlace.location,
        rewardItemName: leg.rewardItem.name,
        geofenceRadiusMeters: leg.objective.geofenceRadiusMeters,
      })),
    },
    currentObjective: currentLeg?.objective.description ?? null,
    currentTarget: currentLeg
      ? {
          name: currentLeg.objective.targetPlace.name,
          location: currentLeg.objective.targetPlace.location,
          radiusMeters: currentLeg.objective.geofenceRadiusMeters,
        }
      : null,
    distanceToTarget: distanceToTarget !== null ? Math.round(distanceToTarget) : null,
  });
}
