/**
 * PlaceCandidate — a real-world place that could serve as a quest target.
 * Normalized from provider-specific data before entering the domain.
 * Pure domain entity. No framework imports.
 */

import type { Coordinates } from "@/domain/location/location-sample";

export type PlaceId = string & { readonly __brand: unique symbol };

export type PlaceCategory =
  | "park"
  | "landmark"
  | "statue"
  | "fountain"
  | "trailhead"
  | "viewpoint"
  | "playground"
  | "bridge"
  | "mural"
  | "bench_area"
  | "plaza"
  | "garden"
  | "restaurant"
  | "cafe"
  | "store"
  | "library"
  | "museum"
  | "gym"
  | "pharmacy"
  | "market"
  | "theater"
  | "bar"
  | "bakery"
  | "school"
  | "other";

export interface PlaceCandidate {
  readonly id: PlaceId;
  readonly externalId: string; // provider-specific ID
  readonly providerSource: string; // "google" | "osm" | "fixture"
  readonly name: string;
  readonly category: PlaceCategory;
  readonly location: Coordinates;
  readonly address: string | null;
  readonly isAccessible: boolean; // publicly accessible on foot
  readonly isOutdoor: boolean; // no building entry required
  readonly radiusMeters: number; // geofence radius for this place
}
