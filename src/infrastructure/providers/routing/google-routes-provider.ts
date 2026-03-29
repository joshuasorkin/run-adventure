/**
 * Google Routes API provider — computes walking distances between places.
 * Used to build a distance matrix for street-distance-aware routing.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import type { DistanceFn } from "@/domain/location/geo";
import { haversineDistance } from "@/domain/location/geo";

interface RouteMatrixElement {
  originIndex: number;
  destinationIndex: number;
  distanceMeters: number;
}

/**
 * Build a walking distance matrix for an ordered set of waypoints.
 * Only computes consecutive pairs (start→0, 0→1, 1→2, ...) to minimize API cost.
 *
 * Returns a Map keyed by "originIdx-destIdx" with street distance in meters.
 * On failure, falls back to haversine for that pair.
 */
export async function buildWalkingDistanceMatrix(
  start: Coordinates,
  places: readonly Coordinates[],
  apiKey: string,
): Promise<Map<string, number>> {
  const matrix = new Map<string, number>();
  if (places.length === 0) return matrix;

  // Build all waypoints: [start, ...places]
  const waypoints = [start, ...places];

  // We need distances for consecutive pairs: 0→1, 1→2, ..., (n-1)→n
  const origins: { waypoint: { location: { latLng: { latitude: number; longitude: number } } }; routeModifiers: { avoidFerries: boolean } }[] = [];
  const destinations: { waypoint: { location: { latLng: { latitude: number; longitude: number } } } }[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    origins.push({
      waypoint: {
        location: {
          latLng: { latitude: waypoints[i].latitude, longitude: waypoints[i].longitude },
        },
      },
      routeModifiers: { avoidFerries: true },
    });
    destinations.push({
      waypoint: {
        location: {
          latLng: { latitude: waypoints[i + 1].latitude, longitude: waypoints[i + 1].longitude },
        },
      },
    });
  }

  try {
    const response = await fetch(
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters",
        },
        body: JSON.stringify({
          origins,
          destinations,
          travelMode: "WALK",
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        `[google-routes] Matrix API returned ${response.status}: ${await response.text()}`,
      );
      // Fall back to haversine for all pairs
      for (let i = 0; i < waypoints.length - 1; i++) {
        matrix.set(`${i}-${i + 1}`, haversineDistance(waypoints[i], waypoints[i + 1]));
      }
      return matrix;
    }

    const elements: RouteMatrixElement[] = await response.json();
    console.log(`[google-routes] Received ${elements.length} matrix elements`);

    // Pre-fill with haversine so any missing pair has a fallback
    for (let i = 0; i < waypoints.length - 1; i++) {
      matrix.set(`${i}-${i + 1}`, haversineDistance(waypoints[i], waypoints[i + 1]));
    }

    // Overwrite with actual street distances.
    // The matrix API returns all origin×destination pairs. We only want the
    // diagonal: origin[i] → destination[i], which corresponds to the
    // consecutive waypoint pair waypoints[i] → waypoints[i+1].
    for (const el of elements) {
      if (el.distanceMeters != null && el.originIndex === el.destinationIndex) {
        const key = `${el.originIndex}-${el.originIndex + 1}`;
        matrix.set(key, el.distanceMeters);
      }
    }
  } catch (err) {
    console.warn("[google-routes] Matrix API call failed, using haversine fallback:", err);
    for (let i = 0; i < waypoints.length - 1; i++) {
      matrix.set(`${i}-${i + 1}`, haversineDistance(waypoints[i], waypoints[i + 1]));
    }
  }

  return matrix;
}

/**
 * Create a DistanceFn backed by a pre-computed distance matrix.
 * The matrix maps waypoint indices (in the ordered route) to street distances.
 * Falls back to haversine for coordinate pairs not in the matrix.
 */
export function matrixDistanceFn(
  waypoints: readonly Coordinates[],
  matrix: Map<string, number>,
): DistanceFn {
  return (a: Coordinates, b: Coordinates): number => {
    // Find indices for a and b in the waypoints array
    const idxA = waypoints.findIndex(
      (w) => w.latitude === a.latitude && w.longitude === a.longitude,
    );
    const idxB = waypoints.findIndex(
      (w) => w.latitude === b.latitude && w.longitude === b.longitude,
    );

    if (idxA >= 0 && idxB >= 0) {
      const key = `${idxA}-${idxB}`;
      const dist = matrix.get(key);
      if (dist != null) return dist;

      // Try reverse direction
      const reverseKey = `${idxB}-${idxA}`;
      const reverseDist = matrix.get(reverseKey);
      if (reverseDist != null) return reverseDist;
    }

    return haversineDistance(a, b);
  };
}
