/**
 * Geofence / proximity detection.
 * Pure domain logic. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import { haversineDistance, calculateBearing } from "@/domain/location/geo";

export interface ProximityResult {
  readonly isWithinGeofence: boolean;
  readonly distanceMeters: number;
  readonly bearing: number;
}

/**
 * Check if a player location is within the geofence radius of a target.
 */
export function checkProximity(
  playerLocation: Coordinates,
  targetLocation: Coordinates,
  radiusMeters: number,
): ProximityResult {
  const distanceMeters = haversineDistance(playerLocation, targetLocation);
  const bearing = calculateBearing(playerLocation, targetLocation);

  return {
    isWithinGeofence: distanceMeters <= radiusMeters,
    distanceMeters,
    bearing,
  };
}

/**
 * Check if any point in a sequence crosses a geofence.
 * Returns the first crossing point's index, or -1 if none.
 * This handles the case where a runner passes through a geofence
 * between two GPS samples.
 */
export function findFirstGeofenceCrossing(
  points: readonly Coordinates[],
  targetLocation: Coordinates,
  radiusMeters: number,
): number {
  for (let i = 0; i < points.length; i++) {
    const result = checkProximity(points[i], targetLocation, radiusMeters);
    if (result.isWithinGeofence) {
      return i;
    }
  }
  return -1;
}
