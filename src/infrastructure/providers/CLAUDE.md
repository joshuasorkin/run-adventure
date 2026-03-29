# src/infrastructure/providers/

External service adapters. All providers implement domain-defined interfaces so domain code never depends on provider-specific types.

## map/
- **map-provider.ts** — `MapProvider` interface: `findNearbyPlaces(query)` returning `PlaceCandidate[]`.
- **google-places-provider.ts** — `GooglePlacesProvider`. Calls Google Places API (New) via direct `fetch()`. Searches by place type within a radius. Normalizes results to `PlaceCandidate`.
- **place-type-mapping.ts** — Bidirectional mapping between Google Places types and domain `PlaceCategory` values. Used by the Google provider to translate types.
- **adams-point-places.ts** — Hardcoded PlaceCandidate fixtures for Adams Point / Grand Lake POIs. Used by the alpha quest chain and as fixture fallback.

## llm/
- **openai-quest-planner.ts** — Two exported functions for the two-phase LLM pipeline:
  - `generateThemePlan(config, apiKey)` → `ThemeSchema` (objective buckets with place types, narrative hints, thematic strengths). Temperature 0.5.
  - `generateNarrative(places, premise, goal, apiKey)` → `{ title, narrative, legs[] }` with per-stop objectives and reward items. Temperature 0.3.
  - Also exports deprecated `generateQuestPlan()` (legacy, unused in production).

## routing/
- **routing-provider.ts** — `RoutingProvider` interface (deferred, minimal).
- **google-routes-provider.ts** — `buildWalkingDistanceMatrix(start, places, apiKey)` computes street-level walking distances via Google Routes API `computeRouteMatrix`. `matrixDistanceFn()` wraps the matrix as a `DistanceFn` for domain code. Falls back to haversine on API failure.
