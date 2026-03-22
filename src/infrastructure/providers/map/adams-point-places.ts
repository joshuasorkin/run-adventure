/**
 * Hardcoded PlaceCandidates for Adams Point / Grand Lake area, Oakland CA.
 * Real coordinates manually verified. All outdoor, publicly accessible.
 */

import type { PlaceCandidate } from "@/domain/place/place-candidate";
import type { PlaceId } from "@/domain/place/place-candidate";

function placeId(id: string): PlaceId {
  return id as PlaceId;
}

export const OAKTOWN_SPICE_SHOP: PlaceCandidate = {
  id: placeId("place-oaktown-spice"),
  externalId: "fixture-oaktown-spice",
  providerSource: "fixture",
  name: "Oaktown Spice Shop",
  category: "landmark",
  location: { latitude: 37.80900, longitude: -122.25053 },
  address: "546 Grand Ave, Oakland, CA 94610",
  isAccessible: true,
  isOutdoor: true, // sidewalk pass-by, no entry required
  radiusMeters: 35,
};

export const GRAND_LAKE_THEATER: PlaceCandidate = {
  id: placeId("place-grand-lake-theater"),
  externalId: "fixture-grand-lake-theater",
  providerSource: "fixture",
  name: "Grand Lake Theater",
  category: "landmark",
  location: { latitude: 37.81159, longitude: -122.24733 },
  address: "3200 Grand Ave, Oakland, CA 94610",
  isAccessible: true,
  isOutdoor: true, // marquee is on the sidewalk
  radiusMeters: 40,
};

export const LAKE_MERRITT_PERGOLA: PlaceCandidate = {
  id: placeId("place-lake-merritt-pergola"),
  externalId: "fixture-lake-merritt-pergola",
  providerSource: "fixture",
  name: "Lake Merritt Pergola",
  category: "landmark",
  location: { latitude: 37.80838, longitude: -122.24957 },
  address: "Lake Merritt, Oakland, CA",
  isAccessible: true,
  isOutdoor: true,
  radiusMeters: 30,
};

export const FAIRYLAND_ENTRANCE: PlaceCandidate = {
  id: placeId("place-fairyland"),
  externalId: "fixture-fairyland",
  providerSource: "fixture",
  name: "Children's Fairyland Entrance",
  category: "landmark",
  location: { latitude: 37.80888, longitude: -122.26021 },
  address: "699 Bellevue Ave, Oakland, CA 94610",
  isAccessible: true,
  isOutdoor: true, // entrance gate area
  radiusMeters: 35,
};

export const ADAMS_POINT_PLACES: readonly PlaceCandidate[] = [
  OAKTOWN_SPICE_SHOP,
  GRAND_LAKE_THEATER,
  LAKE_MERRITT_PERGOLA,
  FAIRYLAND_ENTRANCE,
];
