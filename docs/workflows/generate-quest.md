# docs/workflows/generate-quest.md

## Intent
When a runner configures and starts a quest, the system generates a dynamic quest
using an LLM for thematic planning and Google Places API for real nearby locations.

## Preconditions
- Active session exists
- OpenAI API key configured (OPENAI_API_KEY)
- Google Maps API key configured (GOOGLE_MAPS_API_KEY)

## Trigger
User fills out the quest configuration form and taps "Start Quest".

## Steps
1. Client sends POST `/api/session` to create a new session
2. Client sends POST `/api/quest/generate` with:
   - sessionId
   - startLocation (GPS coordinates)
   - maxDistanceMeters
   - questGoal (free text)
   - objectiveCount
3. Server calls OpenAI GPT-4o-mini with the quest goal
4. LLM returns structured quest plan: title, narrative, and per-leg Google Places types + objectives + items
5. For each place type, server calls Google Places API Nearby Search around startLocation
6. If fewer places found than objectiveCount:
   - Retry LLM at higher temperature (0.7) for more creative place-type suggestions
   - Retry search with those new types
7. Server orders found places using nearest-neighbor routing from startLocation
8. Server checks total route distance ≤ maxDistanceMeters
   - If over budget: retry with smaller search radius (0.7x, max 3 retries)
9. Server builds QuestLegTemplates from ordered places + LLM-generated text
10. Server calls generateQuest() to create the quest domain object
11. Quest stored in memory, response returned to client
12. Client navigates to /run page

## Edge cases
- No places found for any type: return 422 with descriptive error
- Route exceeds max distance after all retries: proceed with best-effort route
- LLM returns invalid JSON: validated by Zod, throws if malformed
- Google Places API rate limit or error: skip that leg type, continue with others
- GPS unavailable: client falls back to default location (Adams Point)
- Missing API keys: server returns error at startup or on first request

## Required tests
- Full orchestration with mocked LLM + mocked Places API
- Generates quest with correct number of legs
- Handles fewer places than requested gracefully
- Route ordering produces nearest-neighbor sequence
- Route budget check works correctly
