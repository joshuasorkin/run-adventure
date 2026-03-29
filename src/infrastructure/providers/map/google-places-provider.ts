/**
 * Google Places API (New) provider — implements MapProvider via direct fetch.
 * Infrastructure layer. Normalizes Google responses to domain PlaceCandidates.
 */

import { v4 as uuid } from "uuid";
import type { Coordinates } from "@/domain/location/location-sample";
import type { PlaceCandidate, PlaceId } from "@/domain/place/place-candidate";
import type { MapProvider, NearbyPlacesQuery } from "./map-provider";
import { googleTypeToDomainCategory } from "./place-type-mapping";

const PLACES_API_BASE = "https://places.googleapis.com/v1/places";

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
}

interface NearbySearchResponse {
  places?: GooglePlace[];
}

export class GooglePlacesProvider implements MapProvider {
  readonly name = "google";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY is required for GooglePlacesProvider");
    }
  }

  async findNearbyPlaces(query: NearbyPlacesQuery): Promise<PlaceCandidate[]> {
    // Map domain categories to Google Places types for the search
    const includedTypes = query.categories.length > 0
      ? query.categories.map(String)
      : undefined;

    const body: Record<string, unknown> = {
      locationRestriction: {
        circle: {
          center: {
            latitude: query.center.latitude,
            longitude: query.center.longitude,
          },
          radius: Math.min(query.radiusMeters, 50000), // API max is 50km
        },
      },
      maxResultCount: Math.min(query.maxResults, 20), // API max per request
    };

    if (includedTypes && includedTypes.length > 0) {
      body.includedTypes = includedTypes;
    }

    const res = await fetch(`${PLACES_API_BASE}:searchNearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.types",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Google Places API error ${res.status}: ${errorText}`);
    }

    const data: NearbySearchResponse = await res.json();
    if (!data.places) return [];

    return data.places
      .filter((p) => p.location && p.displayName?.text)
      .map((p) => this.toPlaceCandidate(p));
  }

  async getPlaceDetails(externalId: string): Promise<PlaceCandidate | null> {
    const res = await fetch(`${PLACES_API_BASE}/${externalId}`, {
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,types",
      },
    });

    if (!res.ok) return null;

    const place: GooglePlace = await res.json();
    if (!place.location || !place.displayName?.text) return null;

    return this.toPlaceCandidate(place);
  }

  async reverseGeocode(location: Coordinates): Promise<string | null> {
    // Try up to 2 times (initial + 1 retry) to handle transient failures
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&result_type=street_address|route&key=${this.apiKey}`,
        );
        if (!res.ok) {
          console.warn(`[reverse-geocode] HTTP ${res.status}: ${await res.text().catch(() => "")}`);
          continue;
        }

        const data = await res.json();
        if (data.status === "ZERO_RESULTS" && attempt === 0) {
          // Retry without result_type filter for less precise results
          console.log("[reverse-geocode] No street_address results, retrying without filter...");
          break; // Fall through to unfiltered retry below
        }
        if (data.status !== "OK") {
          console.warn(`[reverse-geocode] API status: ${data.status}, error: ${data.error_message ?? "none"}`);
          continue;
        }

        const result = data.results?.[0];
        if (!result) {
          console.warn("[reverse-geocode] No results returned");
          continue;
        }

        console.log(`[reverse-geocode] Resolved to: ${result.formatted_address}`);
        return result.formatted_address ?? null;
      } catch (err) {
        console.warn(`[reverse-geocode] Attempt ${attempt + 1} failed:`, err);
      }
    }

    // Final fallback: try without result_type filter
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${this.apiKey}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status === "OK" && data.results?.[0]) {
          console.log(`[reverse-geocode] Fallback resolved to: ${data.results[0].formatted_address}`);
          return data.results[0].formatted_address ?? null;
        }
      }
    } catch {
      // Give up
    }

    console.warn("[reverse-geocode] All attempts failed");
    return null;
  }

  private toPlaceCandidate(place: GooglePlace): PlaceCandidate {
    const primaryType = place.types?.[0] ?? "other";
    const category = googleTypeToDomainCategory(primaryType);

    return {
      id: uuid() as PlaceId,
      externalId: place.id,
      providerSource: "google",
      name: place.displayName!.text,
      category,
      location: {
        latitude: place.location!.latitude,
        longitude: place.location!.longitude,
      },
      address: place.formattedAddress ?? null,
      isAccessible: true,
      isOutdoor: true, // Conservative default — safety filtering can refine
      radiusMeters: 35, // Default geofence radius
    };
  }
}
