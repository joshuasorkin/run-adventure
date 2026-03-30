# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # TypeScript strict mode check (tsc --noEmit)
npm test                 # Run all tests once (vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report (v8)
```

Run a single test file:
```bash
npx vitest run tests/unit/domain/geo.test.ts
```

Run tests matching a pattern:
```bash
npx vitest run -t "proximity"
```

Environment setup (fixture mode needs no API keys):
```bash
cp .env.example .env
npm install
```

## Mission
Build and maintain this codebase as a production-grade location-based running adventure game.
Prioritize correctness, safety, testability, and architecture integrity over speed.

## Current milestone: Friends & family
Goal: Dynamic quest generation from real places, deployable to Fly.io, testable by 3-5 people on their own phones.

### What's working
- Dynamic quest generation via two-phase LLM pipeline + Google Places API
- Browser geolocation streaming to server
- Server-side proximity detection (haversine + configurable radius)
- Item auto-collection when within geofence radius
- Quest leg advancement on collection
- Mobile-first UI: configure page (map picker, goal, distance, objective count) + run page (map, objective, distance overlay, inventory, progress)
- Google Maps on both configure and run pages (`@vis.gl/react-google-maps`)
- Browser TTS for hands-free announcements
- Wake Lock API to prevent screen auto-lock during runs
- In-memory server state (no database)
- Deployed to Fly.io (`run-adventure.fly.dev`)

### In scope now
- Fix bugs found during real-device testing
- Session telemetry for reviewing tester runs
- iOS Safari compatibility testing
- Polish for handoff to testers

### Deferred
- Prisma / PostgreSQL / SQLite persistence
- Playwright E2E tests
- Auth, error handling edge cases
- PWA offline support
- Observability / structured logging beyond console
- Native app wrapper for background GPS

## Operating rules
- Read `architecture.md` before starting any substantial task.
- Read relevant workflow specs in `docs/workflows/` before changing behavior.
- If code changes alter architecture, domain boundaries, workflows, or data contracts, update docs in the same task.
- Do not introduce hidden coupling.
- Do not bypass schemas, tests, or typed contracts for convenience.
- Ask: is this domain logic, application orchestration, infrastructure, or presentation?
- Keep those layers separate.
- `docs/roadmap.md` contains projected development phases. These are planning documents only. Do not implement roadmap items unless explicitly instructed.

## Required documentation updates
Update `architecture.md` whenever any of these change:
- bounded contexts / modules
- data flow between client, server, and persistence
- public API contracts
- event model
- provider abstractions
- testing strategy
- major dependencies
- deployment shape

Update workflow specs whenever any user-visible or domain-visible behavior changes.

## Required engineering standards
- TypeScript strict mode
- Zod validation at every external boundary
- No untyped request bodies
- No direct provider calls from UI components
- No business rules inside React components
- No map-provider-specific logic outside the provider adapter layer
- All location/quest progression logic must be deterministic under test fixtures
- Event handling must be idempotent where duplicate GPS submissions are possible

## Testing policy
### Alpha milestone (complete)
- Unit tests for core domain logic (geo, geofence, state machine)
- One integration test replaying GPS trace through hardcoded quest chain
- Manual dogfood test on a real run

### Friends & family milestone (current)
- Unit tests: route planner, candidate scorer, subset selector, quest generator, quest config schema, place type mapping
- Integration tests: dynamic quest generation with mocked two-phase LLM + Places API
- Integration tests: error paths (no places, API errors, over-budget, reduced count)
- Manual testing on real devices with live API keys

### Deferred
- Full integration tests for all API/application flows
- Playwright E2E tests
- Comprehensive simulation harness

Before closing a task:
- run relevant tests
- report what changed
- report what docs changed
- report remaining risks / TODOs

## Architecture policy
Preferred layers:
- `src/domain/*` for entities, value objects, pure rules
- `src/application/*` for use cases and orchestration
- `src/infrastructure/*` for DB, providers, external APIs
- `src/presentation/*` or `src/app/*` for UI and route handlers

Avoid framework leakage into domain code.

## Safety policy
Do not generate gameplay that assumes:
- private property access
- building entry
- unsafe crossings
- exact GPS precision
- uninterrupted connectivity

Use proximity-based completion and conservative thresholds.

## Workflow policy
Behavioral changes must be reflected in:
- `docs/workflows/*.md`
- relevant test files
- `architecture.md` if structure or flow changed

## Task completion checklist
Before declaring a task done:
1. architecture reviewed
2. workflow spec reviewed
3. code changed
4. tests added/updated
5. docs updated
6. risks noted
