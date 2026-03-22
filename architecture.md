# architecture.md

## Purpose
Real-world running adventure game driven by live player location and nearby places.

## Alpha milestone (2026-03-21)
Minimal playable loop: hardcoded quest chain around Adams Point / Grand Lake,
in-memory state, browser geolocation, proximity collection, TTS announcements.

## Friends & family milestone (current)
Dynamic quest generation: user configures start location, goal, distance, and
objective count. LLM generates thematic quest plan, Google Places API finds real
nearby locations, route planner orders them within distance budget.

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
- LLM provider adapter (OpenAI GPT-4o-mini for quest plan generation)
- simulation/test harness
- observability (console logging for alpha; structured logging deferred)

## Domain model
- PlayerSession
- LocationSample
- Quest
- QuestLeg
- QuestConfig
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
- route total distance must respect user's max distance budget

## Boundaries
### Domain (`src/domain/`)
Pure rules for pass detection, collection, progression, quest state, and route planning.
No imports from Next.js, React, or infrastructure modules.

### Application (`src/application/`)
Coordinates use cases:
- ingestLocation
- generateDynamicQuest (LLM + Places API orchestration)
- startSession (session-only; quest attached separately)
- alpha quest chain (fixture fallback)

### Infrastructure (`src/infrastructure/`)
- In-memory game store — DB repositories deferred to post-alpha
- Google Places API provider (via direct fetch)
- Fixture provider (hardcoded Adams Point places, fallback)
- OpenAI LLM provider (GPT-4o-mini, structured JSON output)
- Place type mapping (Google → domain PlaceCategory)
- Config (constants + env)
- Logging (console for alpha)

### Presentation (`src/app/`)
- Mobile-first React UI
- Quest configuration page (`/configure`) with Google Maps picker
- Run page (`/run`) with GPS tracking, progress, inventory, TTS
- API route handlers (Zod-validated)
- Browser TTS integration (`speechSynthesis` API)

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
around the user's start location. Normalizes results to `PlaceCandidate`.

### Fixture provider (fallback)
Hardcoded Adams Point / Grand Lake POIs for `MAP_PROVIDER=fixture` mode.
Deterministic and testable.

### LLM provider (OpenAI)
GPT-4o-mini generates structured quest plans from free-text goals.
Uses `response_format: json_schema` for guaranteed valid JSON output.
Temperature escalation (0.3 → 0.7) when creative type suggestions are needed.

## Data contracts
Zod schemas at every API boundary:
- `src/validation/session-schemas.ts` — session start/response
- `src/validation/location-schemas.ts` — GPS batch ingestion
- `src/validation/quest-schemas.ts` — quest state response
- `src/validation/quest-generation-schemas.ts` — quest generation config
- `src/validation/common-schemas.ts` — coordinates, uuid, pagination

## Workflows
- [start-session](docs/workflows/start-session.md)
- [generate-quest](docs/workflows/generate-quest.md)
- [collect-item-by-passing-target](docs/workflows/collect-item-by-passing-target.md)

## Testing strategy
### Alpha (complete)
- unit: pure domain rules (geo, geofence, velocity, state machine, place filter)
- integration: one test replaying GPS trace through hardcoded quest chain
- manual: dogfood on a real run around Adams Point

### Friends & family (current)
- unit: route planner (nearest-neighbor, distance, budget)
- integration: dynamic quest generation with mocked LLM + Places API
- manual: test on real devices with live API keys

### Deferred to post-alpha
- Full integration tests for all API/application flows
- Playwright E2E tests
- Comprehensive simulation harness

## Known risks
- `sessionStorage` is cleared if the browser tab closes or the page is force-refreshed mid-run. Session recovery is deferred to post-alpha.
- LLM may generate place types with no nearby results; mitigated by temperature escalation retry.
- Route may exceed distance budget; mitigated by shrinking search radius (max 3 retries).

## Open decisions
- PWA offline support strategy
- Route rendering strategy (Mapbox GL JS vs Leaflet vs Google Maps)
- Online/offline GPS buffering
- Auth model
