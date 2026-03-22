# CLAUDE.md

## Mission
Build and maintain this codebase as a production-grade location-based running adventure game.
Prioritize correctness, safety, testability, and architecture integrity over speed.

## Current sprint: Alpha dogfood (2026-03-21)
Goal: Runnable alpha for a real run around Adams Point / Grand Lake tonight.
Prove the game loop feels fun on foot. Engineering completeness is secondary.

### In scope
- Hardcoded quest chain with real Adams Point / Grand Lake POIs
- Browser geolocation streaming to server
- Server-side proximity detection (haversine + configurable radius)
- Item auto-collection when within radius
- Quest leg advancement on collection
- Minimal mobile-friendly UI: objective text, distance to target, inventory
- Browser TTS (`speechSynthesis`) for hands-free announcements
- In-memory server state (no database)
- One integration test replaying a GPS trace through the quest chain

### Deferred to post-alpha
- Prisma / PostgreSQL / SQLite persistence
- Playwright E2E tests
- Full test coverage beyond domain unit tests + one integration test
- Google Maps / OSM route generation and provider abstraction
- Auth, error handling edge cases, polish
- PWA offline support
- Observability / structured logging beyond console

## Operating rules
- Read `architecture.md` before starting any substantial task.
- Read relevant workflow specs in `docs/workflows/` before changing behavior.
- If code changes alter architecture, domain boundaries, workflows, or data contracts, update docs in the same task.
- Do not introduce hidden coupling.
- Do not bypass schemas, tests, or typed contracts for convenience.
- Ask: is this domain logic, application orchestration, infrastructure, or presentation?
- Keep those layers separate.
- docs/roadmap.md contains projected development phases. These are planning documents only. Do not implement roadmap items unless explicitly instructed. Do not proactively suggest working on future phases.

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
- One integration test replaying GPS trace through full quest chain
- Manual dogfood test on a real run — core loop validated

### Friends & family milestone (current)
- Integration test covering dynamic quest generation from real place data
- Test that verifies Place API coordinates match expected venues
- Session telemetry logging so we can review tester runs after the fact
- Manual testing on at least one iOS device before handing out links

### Post-alpha (deferred)
- Full integration tests for all API/application flows
- Playwright coverage for user-visible flows
- Comprehensive fixture-based simulation

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