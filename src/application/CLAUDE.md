# src/application/

Use-case orchestration layer. Composes domain logic + infrastructure calls. No UI or framework code.

## Use cases

- **start-session.ts** — `startSession()`. Creates a new PlayerSession, resets all in-memory state. Returns sessionId. Does NOT attach a quest — quest generation is a separate step.
- **generate-quest.ts** — `generateDynamicQuest()`. The main 8-step pipeline:
  1. LLM generates theme plan (objective buckets for N-1 outbound stops)
  2. Google Places API builds candidate pool (multiple results per type)
  3. Domain scorer ranks candidates (thematic + proximity + novelty)
  4. Subset selector picks best route-feasible combination (N-1 outbound stops)
  5. Start location reverse-geocoded and appended as final "return home" stop
  6. Google Routes API computes walking (street) distances for the full route
  7. LLM generates narrative for all places (outbound + home); home stop gets address reimagined as a thematic location
  8. Build final quest object
  Returns `{ quest, placesFound, routeDistanceMeters, routeBudgetWarning?, legDistances }`. Route distance is street distance when available, haversine fallback.
- **ingest-location.ts** — `ingestLocation()`. The core gameplay loop: validates GPS points, checks velocity, persists samples, runs proximity detection against active quest target, triggers collection/progression if within geofence.
- **alpha-quest-chain.ts** — `createAlphaQuest()`. Hardcoded 4-leg quest around Adams Point / Grand Lake. Used only by the full-run-workflow integration test. Not called in production.
