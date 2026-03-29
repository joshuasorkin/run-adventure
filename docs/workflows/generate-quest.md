# docs/workflows/generate-quest.md

## Intent
When a runner configures and starts a quest, the system generates a dynamic quest
using a two-phase LLM pipeline and Google Places API with pool-based selection.

## Preconditions
- Active session exists
- OpenAI API key configured (OPENAI_API_KEY)
- Google Maps API key configured (GOOGLE_MAPS_API_KEY)

## Trigger
User fills out the quest configuration form and taps "Start Quest".

## Distance constraints
- `maxDistanceMeters` — radius within which any candidate place must fall (search radius)
- `maxRouteLength` — total route distance budget (optional, defaults to `maxDistanceMeters`)

## Steps
1. Client sends POST `/api/session` to create a new session
2. Client sends POST `/api/quest/generate` with:
   - sessionId
   - startLocation (GPS coordinates)
   - maxDistanceMeters
   - maxRouteLength (optional)
   - questGoal (free text)
   - objectiveCount
3. **Theme plan (LLM call 1)**: Server calls GPT-4o-mini to generate a theme schema with ~1.5x objectiveCount candidate buckets. Each bucket has 1-3 Google Places types (primary + fallbacks), a narrative hint, and a thematic strength score.
4. **Build candidate pool**: For each bucket, for each place type in the bucket, server calls Google Places API Nearby Search around startLocation (up to 5 results per type, max 20 total queries). Filters to within maxDistanceMeters of start. Deduplicates by place ID.
5. **Score candidates**: Each candidate receives a composite score: thematic strength (0.4) + proximity to start (0.4) + spatial novelty (0.2). Novelty penalizes places clustered within 100m of each other.
6. **Select best subset**: Server enumerates combinations (one candidate per bucket, exactly objectiveCount places). For each combination: nearest-neighbor route + 2-opt improvement, check route ≤ maxRouteLength. Keeps the best feasible combination.
   - If no feasible combo: reduce objectiveCount by 1 and retry
   - If still no feasible combo: return best over-budget with `routeBudgetWarning`
7. **Route**: Selected places are ordered via nearest-neighbor + 2-opt local improvement.
8. **Narrative (LLM call 2)**: Server calls GPT-4o-mini with actual place names, categories, and visit order. LLM generates: final title, narrative arc, per-stop objectives mentioning real place names, reward items with increasing rarity.
9. Server calls generateQuest() to create the quest domain object (first leg active, rest locked).
10. Quest stored in memory, response returned to client including routeDistanceMeters and optional routeBudgetWarning.
11. Client navigates to /run page.

## Edge cases
- No places found for any bucket: return 422 with descriptive error
- Route exceeds maxRouteLength: return quest with `routeBudgetWarning` in response
- LLM returns invalid JSON: validated by Zod, throws if malformed
- Google Places API rate limit or error: skip that bucket type, continue with others
- GPS unavailable: client falls back to default location (Adams Point)
- Missing API keys: server returns error at startup or on first request
- Fewer places than objectiveCount: quest built with however many were found
- Second LLM returns fewer legs than places: fallback to generic objective text

## Required tests
- Full orchestration with mocked two-phase LLM + mocked Places API
- Quest narrative comes from second LLM call (actual places)
- Handles fewer places than requested gracefully
- Route ordering produces improved nearest-neighbor sequence
- Over-budget produces routeBudgetWarning
- Reduced objectiveCount fallback works
- No places found throws descriptive error
- Places API errors handled gracefully
- Deduplication by externalId
