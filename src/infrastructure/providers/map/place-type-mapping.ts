/**
 * Maps between Google Places API types and domain PlaceCategory.
 * Infrastructure layer — isolates provider-specific type names from domain.
 */

import type { PlaceCategory } from "@/domain/place/place-candidate";

const GOOGLE_TO_DOMAIN: Record<string, PlaceCategory> = {
  // Outdoor / recreation
  park: "park",
  playground: "playground",
  hiking_area: "trailhead",
  national_park: "park",
  dog_park: "park",
  garden: "garden",
  botanical_garden: "garden",
  marina: "landmark",
  sports_complex: "gym",
  stadium: "landmark",
  swimming_pool: "gym",
  fitness_center: "gym",
  gym: "gym",

  // Cultural / landmark
  museum: "museum",
  art_gallery: "museum",
  library: "library",
  church: "landmark",
  mosque: "landmark",
  synagogue: "landmark",
  hindu_temple: "landmark",
  place_of_worship: "landmark",
  city_hall: "landmark",
  courthouse: "landmark",
  monument: "statue",
  historical_landmark: "landmark",
  tourist_attraction: "landmark",
  performing_arts_theater: "theater",
  movie_theater: "theater",

  // Food & drink
  restaurant: "restaurant",
  cafe: "cafe",
  coffee_shop: "cafe",
  bakery: "bakery",
  bar: "bar",
  ice_cream_shop: "cafe",
  meal_delivery: "restaurant",
  meal_takeaway: "restaurant",
  fast_food_restaurant: "restaurant",

  // Shopping
  store: "store",
  shopping_mall: "store",
  supermarket: "market",
  grocery_store: "market",
  convenience_store: "store",
  book_store: "store",
  clothing_store: "store",
  pet_store: "store",
  hardware_store: "store",
  electronics_store: "store",
  sporting_goods_store: "store",
  shoe_store: "store",
  jewelry_store: "store",
  furniture_store: "store",
  home_goods_store: "store",
  florist: "store",
  gift_shop: "store",
  market: "market",

  // Services
  pharmacy: "pharmacy",
  school: "school",
  university: "school",
  primary_school: "school",
  secondary_school: "school",
  hospital: "landmark",
  fire_station: "landmark",
  police: "landmark",
  post_office: "landmark",

  // Transit
  bus_station: "landmark",
  train_station: "landmark",
  subway_station: "landmark",
  light_rail_station: "landmark",
};

/**
 * Convert a Google Places API type string to a domain PlaceCategory.
 * Returns "other" for unrecognized types.
 */
export function googleTypeToDomainCategory(googleType: string): PlaceCategory {
  return GOOGLE_TO_DOMAIN[googleType] ?? "other";
}

/**
 * Convert a domain PlaceCategory to likely Google Places types for search.
 * Returns an array since one domain category can map to multiple Google types.
 */
export function domainCategoryToGoogleTypes(category: PlaceCategory): string[] {
  const types: string[] = [];
  for (const [googleType, domainCategory] of Object.entries(GOOGLE_TO_DOMAIN)) {
    if (domainCategory === category) {
      types.push(googleType);
    }
  }
  return types.length > 0 ? types : [category];
}
