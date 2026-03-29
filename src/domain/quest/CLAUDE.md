# src/domain/quest/

Pure domain logic for quest lifecycle. No framework imports.

## Files

- **quest-config.ts** — `QuestConfig` value object: startLocation, maxDistanceMeters, maxRouteLength (optional), questGoal, objectiveCount. Also exports constants (MIN/MAX bounds, defaults).
- **theme-schema.ts** — `ThemeSchema` and `ObjectiveBucket` value objects. Output of the first LLM call (theme plan). Each bucket has place types, narrative hint, and thematic strength.
- **candidate-scorer.ts** — `scoreCandidate()` and `scoreCandidatePool()`. Composite score: thematic strength (0.4) + proximity to start (0.4) + spatial novelty (0.2). Input: PlaceCandidates with bucket metadata. Output: `ScoredCandidate[]`.
- **subset-selector.ts** — `selectBestSubset()`. Picks exactly N places (one per bucket) that minimize route distance while staying within budget. Enumerates combinations with early pruning, 100K eval cap, greedy fallback.
- **route-planner.ts** — `planRoute()` (nearest-neighbor), `improveRoute2Opt()`, `computeRouteDistance()`, `isRouteWithinBudget()`. Pure geometry, operates on PlaceCandidate arrays. All functions accept an optional `DistanceFn` parameter (defaults to haversine) for street-distance-aware routing.
- **quest-generator.ts** — `generateQuest()`. Takes a title, narrative, and leg templates → produces a `Quest` with first leg active, rest locked. Also `makeAlphaItem()` helper.
- **quest.ts** — `Quest` and `QuestLeg` types. `activeLeg()` helper.
- **quest-state-machine.ts** — `transitionQuest()`. Handles events: REACH_TARGET, COLLECT_ITEM, LEG_COMPLETED, ACTIVATE_LEG, COMPLETE_QUEST. Returns new quest + emitted events.
- **route-hint.ts** — `RouteHint` value object (deferred, minimal).

## Data flow during quest generation
```
QuestConfig → theme-schema (LLM) → candidate-scorer → subset-selector → route-planner → quest-generator → Quest
```

## Data flow during gameplay
```
GPS point → geofence check → quest-state-machine (transition) → updated Quest
```
