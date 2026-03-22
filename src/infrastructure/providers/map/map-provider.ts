/**
 * MapProvider — abstract interface for map/place data retrieval.
 * No domain code may depend on a specific maps SDK response shape.
 * Provider-specific data is normalized to PlaceCandidate before domain use.
 */

import type { Coordinates } from "@/domain/location/location-sample";
import type { PlaceCandidate, PlaceCategory } from "@/domain/place/place-candidate";

export interface NearbyPlacesQuery {
  readonly center: Coordinates;
  readonly radiusMeters: number;
  readonly categories: readonly PlaceCategory[];
  readonly maxResults: number;
}

export interface MapProvider {
  readonly name: string;

  /** Find nearby places matching the query criteria. */
  findNearbyPlaces(query: NearbyPlacesQuery): Promise<PlaceCandidate[]>;

  /** Get details for a specific place by its provider-specific external ID. */
  getPlaceDetails(externalId: string): Promise<PlaceCandidate | null>;

  /** Reverse geocode a location to a human-readable address. */
  reverseGeocode(location: Coordinates): Promise<string | null>;
}
