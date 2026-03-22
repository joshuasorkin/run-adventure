/**
 * Safety / accessibility guards for place selection.
 * Pure domain logic. No framework imports.
 */

import type { PlaceCandidate } from "@/domain/place/place-candidate";

/**
 * Filter out places that are unsafe or inaccessible for runners.
 * Only outdoor, publicly accessible places pass.
 */
export function filterSafePlaces(places: readonly PlaceCandidate[]): PlaceCandidate[] {
  return places.filter(
    (p) => p.isAccessible && p.isOutdoor,
  );
}
