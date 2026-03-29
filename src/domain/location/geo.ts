/**
 * Pure geographic math utilities.
 * No framework imports. No side effects.
 */

import type { Coordinates } from "@/domain/location/location-sample";

/** A function that returns distance in meters between two coordinates. */
export type DistanceFn = (a: Coordinates, b: Coordinates) => number;

const EARTH_RADIUS_METERS = 6_371_008.8;

/** Convert degrees to radians. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees. */
function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine distance between two WGS84 coordinates.
 * Returns distance in meters.
 */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);

  const h =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon * sinHalfDLon;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Initial bearing from point a to point b.
 * Returns bearing in degrees [0, 360).
 */
export function calculateBearing(a: Coordinates, b: Coordinates): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Smooth GPS jitter using a weighted moving average.
 * Points with accuracy above the threshold are excluded.
 * Returns a new array (does not mutate input).
 */
export function smoothGpsJitter(
  points: readonly Coordinates[],
  windowSize: number = 3,
): Coordinates[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];

  const result: Coordinates[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, start + windowSize);
    const window = points.slice(start, end);

    // Weight more recent points higher: weight = position + 1
    let totalWeight = 0;
    let latSum = 0;
    let lonSum = 0;

    for (let j = 0; j < window.length; j++) {
      const weight = j + 1;
      latSum += window[j].latitude * weight;
      lonSum += window[j].longitude * weight;
      totalWeight += weight;
    }

    result.push({
      latitude: latSum / totalWeight,
      longitude: lonSum / totalWeight,
    });
  }

  return result;
}
