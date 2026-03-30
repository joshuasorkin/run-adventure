# architecture.md

## Purpose
Real-world running adventure game driven by live player location and nearby places.

## Alpha milestone (2026-03-21)
Minimal playable loop: hardcoded quest chain around Adams Point / Grand Lake,
in-memory state, browser geolocation, proximity collection, TTS announcements.

## Friends & family milestone (current)
Dynamic quest generation via a two-phase pipeline:
1. LLM generates a theme schema with candidate objective buckets (1.5x outbound count)
2. Google Places API builds a broad candidate pool (multiple results per type)
3. Domain scoring ranks candidates by thematic fit, proximity, and spatial novelty
4. Combinatorial subset selection picks the best route-feasible combination (N-1 outbound stops)
5. Start location is reverse-geocoded and appended as the final "return home" stop
6. Google Routes API computes walking distances for the selected route
7. Second LLM call generates narrative tailored to the actual selected places (including home)

## Product flow
User configures quest on `/configure` page -> server generates quest via LLM + Places API ->
client captures location via `watchPosition()` -> sends GPS batch to server API ->
server ingests points -> evaluates proximity to active quest leg target ->
if within geofence radius, auto-collects item and advances quest ->
returns updated state to client -> client renders + announces via TTS.

## Top-level modules
- client app (Next.js React, mobile-first)
- API / application layer (Next.js route handlers + use-case orchestration)
- domain engine (pure TypeScript, zero framework imports)
- persistence (in-memory store; DB deferred to post-alpha)
- map/place provider adapter (Google Places API + fixture fallback)
- LLM provider adapter (OpenAI GPT-4o-mini, two-phase: theme plan + narrative)
- simulation/test harness
- observability (console logging for alpha; structured logging deferred)

## Domain model
- PlayerSession
- LocationSample
- Quest
- QuestLeg
- QuestConfig (includes optional maxRouteLength)
- ThemeSchema, ObjectiveBucket
- ScoredCandidate
- Objective
- PlaceCandidate
- InventoryItem
- CollectionEvent
- ProgressEvent
- RouteHint

## Key invariants
- duplicate GPS points must not duplicate collection
- collection is proximity/pass-based, not check-in based
- quests are generated only from allowed place categories
- provider-specific data is normalized before domain use
- narrative is generated AFTER place selection (not before)
- the final quest stop is always the player's starting location (return home); the LLM reimagines the address as a thematic location name
- route budget is enforced during subset selection, not post-hoc
- `maxDistanceMeters` = search radius for individual places; `maxRouteLength` = total route budget
- route distance reported to the user is walking (street) distance via Google Routes API, not haversine
- haversine is used for initial scoring/selection; street distance is computed post-selection for final reporting

## Boundaries
### Domain (`src/domain/`)
Pure rules for pass detection, collection, progression, quest state, route planning,
candidate scoring, and subset selection.
No imports from Next.js, React, or infrastructure modules.

### Application (`src/application/`)
Coordinates use cases:
- ingestLocation
- generateDynamicQuest (theme plan → candidate pool → scoring → selection → narrative)
- startSession (session-only; quest attached separately)
- alpha quest chain (fixture fallback)

### Infrastructure (`src/infrastructure/`)
- In-memory game store — DB repositories deferred to post-alpha
- Google Places API provider (via direct fetch)
- Fixture provider (hardcoded Adams Point places, fallback)
- OpenAI LLM provider (GPT-4o-mini, structured JSON output, two-phase)
- Place type mapping (Google → domain PlaceCategory)
- Config (constants + env)
- Logging (console for alpha)

### Presentation (`src/app/`)
- Mobile-first React UI
- Quest configuration page (`/configure`) with Google Maps picker
- Run page (`/run`) with GPS tracking, GPS trail polyline, progress, inventory, TTS, share button
- Spectator page (`/spectate`) — read-only live view of a runner's progress via polling, with cheer messaging (spectator → runner TTS)
- Architecture diagram page (`/architecture`) with Mermaid-rendered system diagrams
- Shared components: `MapPolyline` (imperative `google.maps.Polyline` wrapper via `useMap()`)
- API route handlers (Zod-validated)
- Browser TTS integration (`speechSynthesis` API) — quest events, approach narration, spectator cheers

## Persistence: alpha approach
Server-side in-memory store holding active session, quest state, and inventory.
State resets on server restart. This is acceptable for alpha/friends & family.

### Deferred to post-alpha
- Prisma schema (already drafted in `prisma/schema.prisma`)
- SQLite for local dev, PostgreSQL for production
- Repository pattern with domain/persistence mappers

## Provider abstraction
Map and place retrieval must go through an adapter interface.
No domain code may depend directly on a specific maps SDK response shape.

### Google Places API provider
Uses Places API (New) via direct HTTP fetch. Searches for nearby places by type
around the user's start location. Returns multiple candidates per type for
pool-based selection. Normalizes results to `PlaceCandidate`.

### Fixture provider (fallback)
Hardcoded Adams Point / Grand Lake POIs for `MAP_PROVIDER=fixture` mode.
Deterministic and testable.

### LLM provider (OpenAI)
Two-phase GPT-4o-mini integration:
1. `generateThemePlan()` — generates objective buckets with fallback place types and thematic strength scores. Uses `response_format: json_schema`. Temperature 0.5.
2. `generateNarrative()` — generates final title, narrative arc, per-stop objectives, and reward items for the actual selected places. Temperature 0.3.

### Routing provider (Google Routes API)
`buildWalkingDistanceMatrix()` computes street-level walking distances between consecutive route waypoints. Called post-selection (not during scoring) to minimize API cost. Falls back to haversine on failure. Domain functions accept an optional `DistanceFn` parameter for testability.

## Data contracts
Zod schemas at every API boundary:
- `src/validation/session-schemas.ts` — session start/response
- `src/validation/location-schemas.ts` — GPS batch ingestion
- `src/validation/quest-schemas.ts` — quest state response
- `src/validation/quest-generation-schemas.ts` — quest generation config (includes optional `maxRouteLength`)
- `src/validation/spectate-schemas.ts` — spectator API response (session, quest, trail, inventory)
- `src/validation/cheer-schemas.ts` — cheer message send/receive (spectator → runner messaging)
- `src/validation/common-schemas.ts` — coordinates, uuid, pagination

## Workflows
- [start-session](docs/workflows/start-session.md)
- [generate-quest](docs/workflows/generate-quest.md)
- [run-gameplay](docs/workflows/run-gameplay.md)
- [collect-item-by-passing-target](docs/workflows/collect-item-by-passing-target.md)
- [spectate](docs/workflows/spectate.md)

## Testing strategy
### Alpha (complete)
- unit: pure domain rules (geo, geofence, velocity, state machine, place filter)
- integration: one test replaying GPS trace through hardcoded quest chain
- manual: dogfood on a real run around Adams Point

### Friends & family (current)
- unit: route planner (nearest-neighbor, 2-opt, distance, budget)
- unit: candidate scorer (thematic, proximity, novelty)
- unit: subset selector (combinatorial selection, budget enforcement)
- unit: quest generator (leg initialization, state machine)
- unit: Zod schema validation (bounds, defaults, optional fields)
- unit: place type mapping (Google ↔ domain category)
- integration: dynamic quest generation with mocked two-phase LLM + Places API
- integration: error paths (no places, API errors, over-budget warning, reduced count)
- manual: test on real devices with live API keys

### Deferred to post-alpha
- Full integration tests for all API/application flows
- Playwright E2E tests
- Comprehensive simulation harness

## Known risks
- `sessionStorage` is cleared if the browser tab closes or the page is force-refreshed mid-run. Session recovery is deferred to post-alpha.
- Two LLM calls + one Routes API call per quest generation adds ~2-3s latency. Theme call is small; narrative call is comparable to the previous single call; Routes API call is fast (~200ms).
- LLM may generate place types with no nearby results; mitigated by 1-3 fallback types per bucket and broad candidate pool.
- Route may exceed distance budget; mitigated by combinatorial subset selection with route constraint. Over-budget quests return a warning instead of failing silently.
- Combination explosion for high objective counts (10 objectives × 5 candidates = ~10M combos); mitigated by early pruning and 100K evaluation cap with greedy fallback.

## Open decisions
- PWA offline support strategy
- Route rendering strategy (Mapbox GL JS vs Leaflet vs Google Maps)
- Online/offline GPS buffering
- Auth model
