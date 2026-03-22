/**
 * RoutingProvider — abstract interface for pedestrian routing.
 * Used for route hints and safety checks (e.g., unsafe road crossings).
 */

import type { Coordinates } from "@/domain/location/location-sample";
import type { RouteHint } from "@/domain/quest/route-hint";

export interface RoutingProvider {
  readonly name: string;

  /** Get a walking route between two points. */
  getWalkingRoute(from: Coordinates, to: Coordinates): Promise<RouteHint>;

  /** Check if the pedestrian route requires crossing unsafe roads. */
  hasSafeRoute(from: Coordinates, to: Coordinates): Promise<boolean>;
}
