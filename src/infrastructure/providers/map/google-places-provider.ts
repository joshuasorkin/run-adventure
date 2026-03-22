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
    // Not needed for quest generation — return null
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
