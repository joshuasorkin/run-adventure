# Spectate Workflow

## Purpose
Allows a third party to watch a runner's quest progress in real-time via a shared link.

## Trigger
Runner taps "Share" button on the run page, copies the spectate URL, and sends it to a friend.

## URL format
`/spectate?session=<sessionId>`

The `session` param is included for future multi-session support. Currently the server
uses a singleton in-memory store, so the spectator sees the one active session regardless.

## Data flow

1. Spectator opens `/spectate?session=<id>` in their browser.
2. Page fetches `GET /api/spectate` on mount.
3. Page polls `/api/spectate` every 3 seconds.
4. API returns bundled response:
   - `session` — id and status
   - `quest` — title, narrative, status, legs with objectives/targets/status
   - `trail` — array of `{ latitude, longitude, timestamp }` from server's locationHistory
   - `lastLocation` — most recent GPS point (for player marker)
   - `inventory` — collected items with name, description, rarity, quantity

## Display
- Google Map with:
  - GPS trail polyline (blue)
  - Player position marker (blue dot at last known location)
  - Numbered objective markers (green = completed, yellow = active, gray = locked)
  - Auto-fit bounds on initial load and periodically as trail grows
- Quest progress bar (same style as run page)
- Current objective (during active quest)
- Inventory list
- Live/completed status indicator
- GPS point count

## Completion
When quest status is `completed`, the page shows a completion banner and the full
trail with all objective markers.

## Limitations (alpha)
- Singleton store: only one active session visible at a time.
- Polling-based: 3-second update interval, not real-time push.
- No authentication: anyone with the link can view.
- Trail data is full history each poll (no incremental fetch yet).
