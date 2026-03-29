import { NextResponse } from "next/server";
import { getState } from "@/infrastructure/persistence/in-memory-store";
import { haversineDistance } from "@/domain/location/geo";
import type { SpectateResponse } from "@/validation/spectate-schemas";

export async function GET() {
  const state = getState();

  const trail = state.locationHistory.map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
    timestamp: s.timestamp.toISOString(),
  }));

  const lastLocation =
    trail.length > 0 ? trail[trail.length - 1] : null;

  // Compute total distance from consecutive location samples
  let totalDistanceMeters = 0;
  for (let i = 1; i < state.locationHistory.length; i++) {
    const prev = state.locationHistory[i - 1];
    const curr = state.locationHistory[i];
    totalDistanceMeters += haversineDistance(
      { latitude: prev.latitude, longitude: prev.longitude },
      { latitude: curr.latitude, longitude: curr.longitude },
    );
  }
  totalDistanceMeters = Math.round(totalDistanceMeters);

  const inventory = Array.from(state.inventory.values()).map((rec) => ({
    name: rec.item.name,
    description: rec.item.description,
    rarity: rec.item.rarity,
    quantity: rec.quantity,
  }));

  const response: SpectateResponse = {
    session: state.session
      ? { id: state.session.id, status: state.session.status }
      : null,
    quest: state.quest
      ? {
          id: state.quest.id,
          title: state.quest.title,
          narrative: state.quest.narrative,
          status: state.quest.status,
          currentLegIndex: state.quest.currentLegIndex,
          legs: state.quest.legs.map((leg) => ({
            id: leg.id,
            sequenceIndex: leg.sequenceIndex,
            status: leg.status,
            objective: leg.objective.description,
            targetPlaceName: leg.objective.targetPlace.name,
            targetLocation: leg.objective.targetPlace.location,
            geofenceRadiusMeters: leg.objective.geofenceRadiusMeters,
          })),
        }
      : null,
    trail,
    lastLocation,
    totalDistanceMeters,
    inventory,
  };

  return NextResponse.json(response);
}
