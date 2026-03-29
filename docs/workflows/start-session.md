# docs/workflows/start-session.md

## Intent
When a runner starts a new quest, a session is created to track their run. The session is quest-free — the quest is generated separately via the generate-quest workflow.

## Preconditions
- No prior session required (single-player, in-memory state)
- Server is running

## Trigger
User taps "Start Quest" on the configure page. The client calls POST `/api/session` as the first step before calling POST `/api/quest/generate`.

## Steps
1. Client sends POST `/api/session` with JSON body (optional `playerId`)
2. Server resets all in-memory state (one session at a time)
3. Server creates a new `PlayerSession` with a generated UUID
4. Server stores session in the in-memory store (no quest attached)
5. Server returns `{ sessionId, questTitle: null, firstObjective: null }` with status 201
6. Client stores `sessionId` in `sessionStorage`
7. Client proceeds to generate a quest via the [generate-quest](generate-quest.md) workflow

## Session recovery (run page)
If the run page sends a GPS point and gets a 400 "No active session" error (e.g., after server restart), it auto-creates a new session. Note: the dynamic quest is lost on server restart since state is in-memory. Recovery creates a bare session with no quest.

## Edge cases
- Request body missing or invalid JSON: server ignores body, creates session without playerId
- `playerId` field missing or not a UUID: server creates session with generated playerId
- `sessionStorage` unavailable: run page shows "No active session" error with link back to configure
- Network failure on POST: client shows error message, re-enables Start Quest button
- Server restart: in-memory state is lost; session recovery creates new session but quest must be regenerated

## Required tests
- Session created successfully with valid response shape
- Session created when body is empty or malformed
- Previous state is reset when new session starts
- No quest is attached to session (questTitle and firstObjective are null)
