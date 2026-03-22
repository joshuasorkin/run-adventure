# Roadmap

> **This document is for planning context only.**
> Do not implement any roadmap item unless explicitly instructed.
> Phases and priorities will shift based on user feedback from real testing.

## Current state

Alpha v1 complete. Core game loop works: GPS streaming → proximity detection → item collection → quest leg advancement. Tested on a real run around Adams Point / Grand Lake, Oakland. Coordinates for venues were inaccurate (hardcoded), but the progression system behaved correctly. One hardcoded quest chain. Web app only, requires ngrok to test on phone.

## What we learned from the first test run

The most compelling part of the experience was having a reason to run a new route. The treasure-hunt discovery mechanic — being sent to a place you wouldn't have gone otherwise — is the core value proposition. Narrative and items are vehicles for route discovery, not the primary draw.

## Projected phases

### Phase 1: Fix the map

**Goal:** Venues are real and coordinates are accurate.

- Replace hardcoded POI coordinates with Google Places API (or Overpass/Nominatim)
- Dynamic quest generation: given a starting location, find real nearby places in interesting categories and build a route from them
- Even a simple approach (pick 3-4 places within 1.5km in varied directions) is a large upgrade
- Validate that generated routes feel walkable/runnable and don't send players into dead ends

### Phase 2: Make it shareable

**Goal:** A friend can open a link on their phone and start a quest with no assistance from me.

- Deploy backend to a hosted service (Railway, Fly.io, Render, or similar)
- Minimal onboarding flow: open link → tap start → GPS permission → first objective
- No accounts or signup — maybe just a name so testers are distinguishable in logs
- Test on iOS Safari (borrow a device or ask a tester to report back)
- Add server-side session telemetry: GPS traces, quest assignments, collections, completions, abandonments

### Phase 3: Screen-off / pocket mode

**Goal:** The app stays active while the phone is in a pocket and the screen is off.

- Attempt web-based keep-alive first: Wake Lock API, Web Locks API, silent audio playback
- Field-test on Android to see if screen-off survives a 10-15 minute run
- If web keep-alive is too unreliable: build a thin Android wrapper (WebView + foreground location service) that hosts the existing web UI but handles GPS natively
- Full native Android rewrite is deferred unless the wrapper approach fails
- TTS narration should work through headphones without screen interaction

### Phase 4: Make it replayable

**Goal:** Testers want to run with it more than once.

- This phase is deliberately vague — what makes it replayable depends on feedback
- Possible directions: longer quests, themed quests, variety in the same area, quests in new neighborhoods, social/competitive elements, difficulty progression
- Do not pre-build any of these — wait for real tester input

## Deliberately deferred

These are things we know we'll eventually want but are not worth building until the core experience is validated with real users:

- User accounts and authentication
- Leaderboards or social features
- Polished visual design
- Full native Android app (beyond the wrapper if needed)
- Complex AI-driven narrative generation
- Multiple simultaneous quests
- Offline / intermittent connectivity mode
- Quest editor or authoring tools

## Target audience for friends & family alpha

3-5 people in the SF Bay Area who run or walk regularly. Mix of Android and iOS if possible. Success metric: do they want to use it a second time?