# docs/workflows/run-gameplay.md

## Intent
While the runner is on the run page, the app continuously tracks their GPS position, sends it to the server, and auto-collects quest items when the runner passes near target locations.

## Preconditions
- Active session exists (sessionId in sessionStorage)
- Quest has been generated and stored server-side
- Browser supports Geolocation API

## Trigger
Run page mounts and reads sessionId from sessionStorage.

## Steady-state loop
1. Browser `watchPosition` fires with a new GPS reading
2. Client updates the player marker on the map immediately
3. Client checks if player has moved ≥ 5m since last server send (skip if not)
4. Client sends POST `/api/location` with `{ sessionId, points: [gpsPoint], idempotencyKey }`
5. Server validates the request (Zod schema)
6. Server checks idempotency key — if already processed, returns `{ processed: 0 }`
7. Server runs velocity check against last known position (rejects teleports)
8. Server persists the location sample
9. Server checks proximity of the new position to the active quest leg's target (haversine distance vs. geofence radius)
10. **Approach narration check** (before geofence): if the active leg has `approachNarration` lines, the server computes which 50m distance tier the runner is in. If they've crossed into a new tier (closer to target) and at least 15 seconds have passed since the last narration, the server includes the narration text in the response. If the runner moves away (wrong turn), the tier index is silently decremented so re-approaching replays the appropriate tier.
11. **If within geofence**: server runs the progression sequence:
    - REACH_TARGET → COLLECT_ITEM → add to inventory → LEG_COMPLETED
    - If more legs remain: ACTIVATE_LEG (next leg)
    - If all legs done: QUEST_COMPLETED
12. Server returns `{ processed, rejected, questUpdate, approachNarration, events }`
13. Client checks for `approachNarration` — if present and TTS enabled, speaks the narration text and adds to event log
14. Client checks for `questUpdate` — if present:
    - Announces collection/next objective via TTS
    - Adds to event log
15. Client refreshes quest state (GET `/api/quest`) and inventory (GET `/api/inventory`)
16. Client updates UI: objective text, distance overlay, progress bar, inventory list

## Map behavior
- Google Map shows player position (blue dot) and current target (red pin)
- GPS trail polyline (blue) renders the runner's actual path as they move
- Trail points are accumulated client-side each time a GPS point passes the 5m movement threshold
- Map auto-follows player position by default
- User can pan/zoom freely; this disables auto-follow
- "Re-center" button appears when auto-follow is off; tapping it re-enables follow
- Distance-to-target overlay in bottom-right corner of map

## Sharing
- "Share" button in header copies a spectate URL to clipboard (`/spectate?session=<id>`)
- See [spectate workflow](spectate.md) for the spectator experience

## Wake Lock
- Wake Lock API is requested when GPS tracking starts (prevents screen auto-lock)
- Released when the user taps "End run & start new quest" or the component unmounts
- If the browser releases the lock (tab hidden), it is re-acquired when the tab becomes visible again

## Quest completion
- When all legs are completed, server marks quest as completed
- Client shows "Quest Complete!" banner with option to start a new quest
- Map remains visible showing the full GPS trail and all objective markers (numbered, green)
- Map auto-fits bounds to encompass the entire trail and all objectives
- Distance overlay is hidden (no active target)
- TTS announces completion

## End run (user-initiated)
- User taps "End run & start new quest"
- Client clears GPS watch, releases wake lock, removes sessionId from sessionStorage
- Client navigates to `/configure`

## Session recovery
- If POST `/api/location` returns 400 "No active session" (server restarted):
  - Client auto-creates a new session via POST `/api/session`
  - Stores new sessionId, resets GPS tracking state
  - Note: the quest is lost; user sees empty quest state

## Edge cases
- GPS unavailable: error message shown, no tracking
- GPS error mid-run: status updated, tracking continues when signal returns
- Network error sending GPS: logged, skipped, retried on next position
- Duplicate idempotency key: server returns processed=0, no side effects
- Velocity check fails (teleport): point rejected, not persisted
- Quest already completed: no proximity checks, completion banner shown

## Required tests
- Full GPS trace replay completes all legs (integration test)
- Duplicate idempotency keys do not double-collect
- Points outside geofence do not trigger collection
- Velocity check rejects impossible movements
