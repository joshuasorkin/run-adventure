# docs/workflows/start-session.md

## Intent
When a runner taps "Start Run", a new session and quest are created so the run page can begin GPS tracking and quest progression.

## Preconditions
- No prior session required (alpha: single-player, in-memory state)
- Server is running

## Trigger
User taps "Start Run" on the home screen.

## Steps
1. Client sends POST `/api/session` with JSON body (optional `playerId`)
2. Server resets all in-memory state (alpha: one session at a time)
3. Server creates a new `PlayerSession` with a generated UUID
4. Server generates the hardcoded alpha quest chain (4 legs around Adams Point / Grand Lake)
5. Server stores session and quest in the in-memory store
6. Server returns `{ sessionId, questTitle, firstObjective }` with status 201
7. Client stores `sessionId` in `sessionStorage`
8. Client navigates to `/run`
9. Run page reads `sessionId` from `sessionStorage`
10. Run page fetches initial quest state and inventory from server
11. Run page starts `watchPosition` for GPS streaming
12. Run page announces first objective via TTS (if enabled)

## Edge cases
- Request body missing or invalid JSON: server ignores body, creates session without playerId
- `playerId` field missing or not a UUID: server creates session with generated playerId
- `sessionStorage` unavailable: run page shows "No active session" error with link back to start
- Network failure on POST: client shows error message, re-enables Start Run button
- Server restart between session creation and run page load: run page fetches return empty state

## Required tests
- session created successfully with valid response shape
- session created when body is empty or malformed
- previous state is reset when new session starts
- quest chain has exactly 4 legs with correct targets
- idempotency: starting a new session replaces the old one cleanly
