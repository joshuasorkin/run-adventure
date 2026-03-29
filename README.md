# Run Adventure

A location-based running adventure game. Get a dynamically generated quest based on real places near you, then run to each objective to collect items and complete the story.

Built with Next.js, Google Maps/Places API, and OpenAI.

## Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [npm](https://www.npmjs.com/)
- A [Google Cloud](https://console.cloud.google.com/) project with these APIs enabled:
  - Maps JavaScript API (client-side map display)
  - Places API (server-side quest generation)
  - Routes API (server-side distance calculation)
- An [OpenAI](https://platform.openai.com/) API key

### API key setup

You need two Google API keys with different restrictions:

| Key | Used for | Restriction |
|-----|----------|-------------|
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Map display in the browser | HTTP referrer (your domain + localhost), Maps JavaScript API only |
| `GOOGLE_MAPS_API_KEY` | Server-side Places & Routes calls | IP restriction (your server), Places API + Routes API only |

Separating keys limits blast radius if either is compromised.

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/joshuasorkin/run-adventure.git
cd run-adventure
npm ci
```

### 2. Configure environment

Copy the example env file and fill in your keys:

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```
OPENAI_API_KEY=sk-...
GOOGLE_MAPS_API_KEY=AIza...
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...
MAP_PROVIDER=google
```

All other variables have sensible defaults. See [Environment variables](#environment-variables) for the full list.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The configure page lets you pick a starting location, set a distance, and generate a quest.

### 4. Run tests

```bash
npm test
```

## Deploy to Fly.io

### 1. Install the Fly CLI

Follow the [Fly.io install guide](https://fly.io/docs/flyctl/install/).

### 2. Launch (first time only)

```bash
fly launch
```

This creates your app on Fly.io. The included `fly.toml` and `Dockerfile` handle the rest.

### 3. Set secrets

Server-side secrets (runtime):

```bash
fly secrets set OPENAI_API_KEY=sk-...
fly secrets set GOOGLE_MAPS_API_KEY=AIza...
```

### 4. Add keys to your shell profile

The Google Maps client key must be passed as a build arg because Next.js inlines `NEXT_PUBLIC_*` variables at build time. Run the setup script to add your keys to your shell profile so deploys pick them up automatically:

```bash
bash scripts/setup-env.sh
source ~/.bashrc  # or ~/.zshrc — the script will tell you which file it updated
```

### 5. Deploy

```bash
npm run deploy
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | (empty) | OpenAI API key for quest narrative generation |
| `GOOGLE_MAPS_API_KEY` | (empty) | Server-side key for Places & Routes APIs |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | (empty) | Client-side key for Maps JavaScript API |
| `MAP_PROVIDER` | `fixture` | Map provider: `google`, `osm`, or `fixture` |
| `DATABASE_URL` | `file:./dev.db` | Database connection string |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `GEOFENCE_RADIUS_METERS` | `30` | Distance (m) to trigger item collection |
| `MAX_RUNNING_SPEED_MS` | `12` | Max valid GPS speed in m/s (filters errant readings) |
| `GPS_ACCURACY_THRESHOLD_METERS` | `50` | Minimum GPS accuracy to accept a reading |
| `GPS_SMOOTHING_WINDOW` | `3` | Number of GPS points for smoothing |

## Project structure

```
src/
  domain/         Pure business rules (no framework imports)
  application/    Use-case orchestration
  infrastructure/ External APIs, providers, persistence
  app/            Next.js pages and route handlers
  validation/     Zod schemas for all boundaries
docs/
  workflows/      Behavioral specs for major user flows
  roadmap.md      Projected development phases
```

See `architecture.md` for detailed system design.

## License

MIT
