/**
 * RouteHint — suggested route segment for a quest leg.
 * Pure domain entity. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";

export interface RouteHint {
  readonly from: Coordinates;
  readonly to: Coordinates;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly polyline: readonly Coordinates[];
}
