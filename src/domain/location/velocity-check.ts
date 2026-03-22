/**
 * Velocity sanity checks for GPS samples.
 * Pure domain logic. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import { haversineDistance } from "@/domain/location/geo";

export interface VelocityCheckResult {
  readonly isValid: boolean;
  readonly speedMs: number;
  readonly reason?: string;
}

/**
 * Check whether the velocity between two consecutive GPS samples is plausible.
 *
 * @param previous - coordinates + timestamp of the previous sample
 * @param current  - coordinates + timestamp of the current sample
 * @param maxSpeedMs - maximum plausible speed in m/s (default: 12 ≈ 27 mph)
 * @param minIntervalMs - minimum time gap to consider valid (default: 500ms)
 */
export function checkVelocity(
  previous: Coordinates & { timestamp: Date },
  current: Coordinates & { timestamp: Date },
  maxSpeedMs: number = 12,
  minIntervalMs: number = 500,
): VelocityCheckResult {
  const timeDeltaMs =
    current.timestamp.getTime() - previous.timestamp.getTime();

  if (timeDeltaMs < minIntervalMs) {
    return {
      isValid: false,
      speedMs: 0,
      reason: "points_too_close_in_time",
    };
  }

  const distance = haversineDistance(previous, current);
  const speedMs = distance / (timeDeltaMs / 1000);

  if (speedMs > maxSpeedMs) {
    return {
      isValid: false,
      speedMs,
      reason: "exceeds_max_speed",
    };
  }

  return { isValid: true, speedMs };
}
