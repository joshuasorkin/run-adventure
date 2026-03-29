"use client";

import { useEffect, useRef, useState } from "react";

type DiagramSection = {
  id: string;
  title: string;
  description: string;
  definition: string;
};

const diagrams: DiagramSection[] = [
  {
    id: "layers",
    title: "System Layers",
    description:
      "High-level architecture showing the four primary layers and their dependencies.",
    definition: `graph TB
      subgraph Presentation["Presentation Layer · src/app/"]
        Pages["Pages\\n/ · /configure · /run"]
        API["API Routes\\n/api/session · /api/location\\n/api/quest · /api/inventory"]
      end

      subgraph Validation["Validation Layer · src/validation/"]
        Schemas["Zod Schemas\\nsession · location · quest\\nquest-generation · common"]
      end

      subgraph Application["Application Layer · src/application/"]
        StartSession["startSession"]
        GenerateQuest["generateDynamicQuest"]
        IngestLocation["ingestLocation"]
        AlphaQuest["alphaQuestChain"]
      end

      subgraph Domain["Domain Layer · src/domain/"]
        Core["Core Entities\\nPlayerSession · Quest · QuestLeg\\nInventoryItem · LocationSample"]
        Geo["Geo Engine\\nhaversine · geofence\\nvelocity · bearing"]
        QuestEngine["Quest Engine\\nstate machine · route planner\\ncandidate scorer · subset selector\\nquest generator · theme schema"]
        Safety["Safety\\nfilterSafePlaces"]
      end

      subgraph Infrastructure["Infrastructure Layer · src/infrastructure/"]
        Store["In-Memory Store\\nGameState singleton"]
        GooglePlaces["Google Places\\nAPI Provider"]
        OpenAI["OpenAI LLM\\nGPT-4o-mini"]
        Config["Config & Logging\\nenv · constants · pino"]
      end

      Pages --> API
      API --> Schemas
      API --> Application
      Application --> Domain
      Application --> Infrastructure
      Infrastructure -.->|implements| Domain

      style Presentation fill:#1e3a5f,stroke:#3b82f6,color:#e0e0e0
      style Validation fill:#3b1f5e,stroke:#8b5cf6,color:#e0e0e0
      style Application fill:#1a3c34,stroke:#22c55e,color:#e0e0e0
      style Domain fill:#3b3a1a,stroke:#eab308,color:#e0e0e0
      style Infrastructure fill:#3b1a1a,stroke:#ef4444,color:#e0e0e0`,
  },
  {
    id: "quest-pipeline",
    title: "Quest Generation Pipeline",
    description:
      "The six-step dynamic quest generation flow, from user config to playable quest.",
    definition: `graph LR
      Config["User Config\\nstart location, distance,\\ngoal, objective count"]
      Phase1["Phase 1: LLM\\nTheme Plan\\n(GPT-4o-mini)"]
      Places["Phase 2:\\nGoogle Places\\ncandidate pool"]
      Score["Phase 3:\\nDomain Scoring\\nthematic + proximity\\n+ novelty"]
      Select["Phase 4:\\nSubset Selection\\ncombinatorial search\\nroute budget"]
      Route["Phase 5:\\nRoute Planning\\nnearest-neighbor\\n+ 2-opt"]
      Phase2["Phase 6: LLM\\nNarrative\\n(GPT-4o-mini)"]
      Quest["Playable Quest\\ntitle, narrative,\\nlegs, objectives"]

      Config --> Phase1
      Phase1 -->|"ThemeSchema\\nobjective buckets"| Places
      Places -->|"PlaceCandidate list\\nmultiple per type"| Score
      Score -->|"ScoredCandidate list\\nranked pool"| Select
      Select -->|SelectionResult\\nbest N places| Route
      Route -->|ordered stops| Phase2
      Phase2 -->|NarrativeResponse\\ntitle, legs, items| Quest

      style Config fill:#1e3a5f,stroke:#3b82f6,color:#e0e0e0
      style Phase1 fill:#3b1f5e,stroke:#8b5cf6,color:#e0e0e0
      style Places fill:#1a3c34,stroke:#22c55e,color:#e0e0e0
      style Score fill:#3b3a1a,stroke:#eab308,color:#e0e0e0
      style Select fill:#3b3a1a,stroke:#eab308,color:#e0e0e0
      style Route fill:#3b3a1a,stroke:#eab308,color:#e0e0e0
      style Phase2 fill:#3b1f5e,stroke:#8b5cf6,color:#e0e0e0
      style Quest fill:#1e3a5f,stroke:#3b82f6,color:#e0e0e0`,
  },
  {
    id: "gameplay-loop",
    title: "Gameplay Loop",
    description:
      "Real-time GPS ingestion, proximity detection, and quest state progression.",
    definition: `graph TD
      GPS["Browser GPS\\nwatchPosition()"]
      Batch["Batch Samples\\n≥5m movement filter\\n~5s send interval"]
      Ingest["POST /api/location\\ningestLocation()"]
      Idemp{"Idempotency\\ncheck"}
      Velocity{"Velocity\\ncheck"}
      Persist["Persist\\nGPS samples"]
      Proximity{"Proximity\\ncheck\\n(haversine)"}
      Geofence{"Within\\ngeofence?\\n(30m default)"}
      StateMachine["Quest State Machine\\nREACH → COLLECT → ADVANCE"]
      Events["Game Events\\nTARGET_REACHED\\nITEM_COLLECTED\\nLEG_COMPLETED"]
      NextLeg{"More\\nlegs?"}
      Complete["QUEST_COMPLETED"]
      Continue["Activate next leg"]
      UI["Update UI\\nmap + overlay + TTS"]

      GPS --> Batch
      Batch --> Ingest
      Ingest --> Idemp
      Idemp -->|duplicate| UI
      Idemp -->|new| Velocity
      Velocity -->|too fast| UI
      Velocity -->|valid| Persist
      Persist --> Proximity
      Proximity --> Geofence
      Geofence -->|no| UI
      Geofence -->|yes| StateMachine
      StateMachine --> Events
      Events --> NextLeg
      NextLeg -->|no| Complete
      NextLeg -->|yes| Continue
      Complete --> UI
      Continue --> UI

      style GPS fill:#1e3a5f,stroke:#3b82f6,color:#e0e0e0
      style Batch fill:#1e3a5f,stroke:#3b82f6,color:#e0e0e0
      style Ingest fill:#1a3c34,stroke:#22c55e,color:#e0e0e0
      style StateMachine fill:#3b3a1a,stroke:#eab308,color:#e0e0e0
      style Events fill:#3b1f5e,stroke:#8b5cf6,color:#e0e0e0
      style UI fill:#1e3a5f,stroke:#3b82f6,color:#e0e0e0
      style Complete fill:#15803d,stroke:#22c55e,color:#e0e0e0`,
  },
  {
    id: "domain-model",
    title: "Domain Model",
    description:
      "Core entities and value objects with their relationships.",
    definition: `classDiagram
      class PlayerSession {
        +SessionId id
        +PlayerId playerId
        +SessionStatus status
        +Date startedAt
      }

      class Quest {
        +QuestId id
        +SessionId sessionId
        +string title
        +string narrative
        +QuestStatus status
        +QuestLeg[] legs
      }

      class QuestLeg {
        +QuestLegId id
        +int sequenceIndex
        +LegStatus status
        +Objective objective
        +PlaceCandidate targetPlace
        +InventoryItem rewardItem
        +number geofenceRadiusMeters
      }

      class PlaceCandidate {
        +PlaceId id
        +string name
        +Coordinates location
        +PlaceCategory category
        +boolean isAccessible
        +boolean isOutdoor
      }

      class LocationSample {
        +LocationSampleId id
        +SessionId sessionId
        +Coordinates coords
        +number accuracy
        +Date timestamp
      }

      class InventoryItem {
        +ItemId id
        +string name
        +string description
        +ItemRarity rarity
      }

      class ThemeSchema {
        +string premise
        +string tone
        +ObjectiveBucket[] buckets
      }

      class ScoredCandidate {
        +PlaceCandidate place
        +number thematicScore
        +number proximityScore
        +number noveltyScore
        +number totalScore
      }

      class GameEvent {
        +GameEventId id
        +string type
        +SessionId sessionId
        +Date timestamp
      }

      PlayerSession "1" --> "*" Quest : owns
      Quest "1" --> "*" QuestLeg : contains
      QuestLeg "1" --> "1" PlaceCandidate : targets
      QuestLeg "1" --> "1" InventoryItem : rewards
      PlayerSession "1" --> "*" LocationSample : tracks
      PlayerSession "1" --> "*" GameEvent : emits
      ThemeSchema "1" --> "*" ScoredCandidate : produces
      ScoredCandidate "1" --> "1" PlaceCandidate : wraps`,
  },
  {
    id: "api-routes",
    title: "API Routes & Data Flow",
    description:
      "HTTP endpoints, their validation schemas, and the application use cases they invoke.",
    definition: `graph LR
      subgraph Client["Client (Browser)"]
        ConfigPage["/configure"]
        RunPage["/run"]
      end

      subgraph Routes["API Routes"]
        PostSession["POST /api/session"]
        PostGenerate["POST /api/quest/generate"]
        PostPreview["POST /api/quest/generate-preview\\n(SSE stream)"]
        GetQuest["GET /api/quest"]
        PostLocation["POST /api/location"]
        GetInventory["GET /api/inventory"]
      end

      subgraph UseCases["Application Use Cases"]
        UC_Start["startSession()"]
        UC_Generate["generateDynamicQuest()"]
        UC_Ingest["ingestLocation()"]
      end

      subgraph Store["In-Memory Store"]
        State["GameState\\nsession · quest\\ninventory · events\\nlocationHistory"]
      end

      ConfigPage -->|"playerId"| PostSession
      ConfigPage -->|"config (SSE)"| PostPreview
      ConfigPage -->|"config"| PostGenerate
      RunPage -->|"GPS batch"| PostLocation
      RunPage -->|"poll"| GetQuest
      RunPage -->|"poll"| GetInventory

      PostSession --> UC_Start
      PostGenerate --> UC_Generate
      PostPreview --> UC_Generate
      PostLocation --> UC_Ingest
      GetQuest --> State
      GetInventory --> State

      UC_Start --> State
      UC_Generate --> State
      UC_Ingest --> State

      style Client fill:#1e3a5f,stroke:#3b82f6,color:#e0e0e0
      style Routes fill:#1a3c34,stroke:#22c55e,color:#e0e0e0
      style UseCases fill:#3b3a1a,stroke:#eab308,color:#e0e0e0
      style Store fill:#3b1a1a,stroke:#ef4444,color:#e0e0e0`,
  },
  {
    id: "quest-state-machine",
    title: "Quest State Machine",
    description:
      "State transitions for quest legs and overall quest progression.",
    definition: `stateDiagram-v2
      state "Quest States" as QuestStates {
        [*] --> active: QUEST_GENERATED
        active --> completed: all legs done
        active --> failed: FAIL_QUEST
        active --> expired: EXPIRE_QUEST
        completed --> [*]
        failed --> [*]
        expired --> [*]
      }

      state "Leg States" as LegStates {
        [*] --> locked: created
        locked --> leg_active: ACTIVATE_LEG
        leg_active --> reached: REACH_TARGET\\n(within geofence)
        reached --> leg_completed: COLLECT_ITEM
        leg_active --> skipped: SKIP_LEG
        leg_completed --> [*]
        skipped --> [*]
      }

      note right of LegStates
        On leg completion:
        next leg auto-activates
        (locked → active)
      end note`,
  },
];

function MermaidDiagram({ definition, id }: { definition: string; id: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        // @ts-expect-error - mermaid loaded from CDN
        const mermaid = window.mermaid;
        if (!mermaid || !containerRef.current) return;

        const { svg } = await mermaid.render(`mermaid-${id}`, definition);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render diagram");
        }
      }
    }

    // Wait for mermaid to be loaded
    const check = setInterval(() => {
      // @ts-expect-error - mermaid loaded from CDN
      if (window.mermaid) {
        clearInterval(check);
        render();
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(check);
    };
  }, [definition, id]);

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 text-sm text-red-300">
        Diagram render error: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-x-auto transition-opacity duration-300 ${rendered ? "opacity-100" : "opacity-0"}`}
    />
  );
}

export default function ArchitecturePage() {
  const [activeTab, setActiveTab] = useState(diagrams[0].id);
  const [mermaidReady, setMermaidReady] = useState(false);

  useEffect(() => {
    // Load mermaid from CDN
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = () => {
      // @ts-expect-error - mermaid loaded from CDN
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          primaryColor: "#1e3a5f",
          primaryTextColor: "#e0e0e0",
          primaryBorderColor: "#3b82f6",
          lineColor: "#6b7280",
          secondaryColor: "#1a3c34",
          tertiaryColor: "#3b3a1a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "14px",
        },
        flowchart: { curve: "basis", padding: 16 },
        sequence: { mirrorActors: false },
      });
      setMermaidReady(true);
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  const activeDiagram = diagrams.find((d) => d.id === activeTab)!;

  return (
    <main className="min-h-dvh p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <a
          href="/"
          className="text-[var(--muted)] text-sm hover:text-[var(--fg)] transition-colors"
        >
          &larr; Back
        </a>
        <h1 className="text-3xl font-bold mt-2">System Architecture</h1>
        <p className="text-[var(--muted)] mt-1">
          Interactive diagrams of the Run Adventure system design.
        </p>
      </header>

      {/* Tab navigation */}
      <nav className="flex gap-1 overflow-x-auto pb-2 mb-6 border-b border-white/10">
        {diagrams.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveTab(d.id)}
            className={`px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === d.id
                ? "bg-white/10 text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--fg)] hover:bg-white/5"
            }`}
          >
            {d.title}
          </button>
        ))}
      </nav>

      {/* Active diagram */}
      <section>
        <h2 className="text-xl font-semibold mb-1">{activeDiagram.title}</h2>
        <p className="text-[var(--muted)] text-sm mb-6">
          {activeDiagram.description}
        </p>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 min-h-[400px] flex items-center justify-center">
          {!mermaidReady ? (
            <div className="text-[var(--muted)] animate-pulse">
              Loading diagrams...
            </div>
          ) : (
            <MermaidDiagram
              key={activeDiagram.id}
              id={activeDiagram.id}
              definition={activeDiagram.definition}
            />
          )}
        </div>
      </section>

      {/* Legend */}
      <footer className="mt-8 text-xs text-[var(--muted)] flex flex-wrap gap-6">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#1e3a5f] border border-[#3b82f6] inline-block" />
          Presentation
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#3b1f5e] border border-[#8b5cf6] inline-block" />
          LLM / Events
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#1a3c34] border border-[#22c55e] inline-block" />
          Application / API
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#3b3a1a] border border-[#eab308] inline-block" />
          Domain
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#3b1a1a] border border-[#ef4444] inline-block" />
          Infrastructure
        </span>
      </footer>
    </main>
  );
}
