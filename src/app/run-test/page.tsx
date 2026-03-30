"use client";

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";

const MapPicker = lazy(() => import("../configure/MapPicker"));
import {
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_QUEST_GOAL,
  DEFAULT_OBJECTIVE_COUNT,
  MIN_ROUTE_LENGTH_METERS,
  MAX_ROUTE_LENGTH_METERS,
  DEFAULT_ROUTE_LENGTH_METERS,
} from "@/domain/quest/quest-config";

const DISTANCE_OPTIONS = [
  { label: "¼ mi", meters: 402 },
  { label: "½ mi", meters: 805 },
  { label: "1 mi", meters: 1609 },
  { label: "2 mi", meters: 3219 },
  { label: "3 mi", meters: 4828 },
  { label: "5 mi", meters: 8047 },
  { label: "10 mi", meters: 16093 },
];

const RARITY_COLORS: Record<string, string> = {
  common: "text-zinc-400",
  uncommon: "text-green-400",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-yellow-400",
};

interface LegResult {
  sequenceIndex: number;
  objective: string;
  targetPlace: {
    name: string;
    category: string;
    address: string;
    location: { latitude: number; longitude: number };
  };
  geofenceRadiusMeters: number;
  rewardItem: {
    name: string;
    description: string;
    rarity: string;
  };
  approachNarration: string[];
}

interface QuestResult {
  questTitle: string;
  narrative: string;
  placesFound: number;
  routeDistanceMeters: number;
  routeBudgetWarning: string | null;
  legDistances: number[];
  startLocation: { latitude: number; longitude: number };
  legs: LegResult[];
}

function googleMapsWalkingUrl(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&travelmode=walking`;
}

function formatForClipboard(
  inputs: { startLocation: { latitude: number; longitude: number }; maxDistanceMeters: number; maxRouteLength: number; questGoal: string; objectiveCount: number },
  result: QuestResult,
): string {
  return JSON.stringify(
    {
      inputs: {
        startLocation: inputs.startLocation,
        maxDistanceMeters: inputs.maxDistanceMeters,
        maxRouteLength: inputs.maxRouteLength,
        questGoal: inputs.questGoal,
        objectiveCount: inputs.objectiveCount,
      },
      outputs: {
        questTitle: result.questTitle,
        narrative: result.narrative,
        routeDistanceMeters: result.routeDistanceMeters,
        routeBudgetWarning: result.routeBudgetWarning,
        legs: result.legs.map((leg, i) => ({
          stop: i + 1,
          place: leg.targetPlace.name,
          category: leg.targetPlace.category,
          address: leg.targetPlace.address,
          objective: leg.objective,
          reward: {
            name: leg.rewardItem.name,
            description: leg.rewardItem.description,
            rarity: leg.rewardItem.rarity,
          },
        })),
      },
    },
    null,
    2,
  );
}

export default function RunTestPage() {
  const [startLocation, setStartLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [maxDistanceMeters, setMaxDistanceMeters] = useState(DEFAULT_MAX_DISTANCE_METERS);
  const [maxRouteLength, setMaxRouteLength] = useState(DEFAULT_ROUTE_LENGTH_METERS);
  const [questGoal, setQuestGoal] = useState(DEFAULT_QUEST_GOAL);
  const [objectiveCount, setObjectiveCount] = useState(DEFAULT_OBJECTIVE_COUNT);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuestResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ step: number; totalSteps: number; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  // Get GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setStartLocation({ latitude: 37.8105, longitude: -122.2534 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setStartLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setStartLocation({ latitude: 37.8105, longitude: -122.2534 }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  async function handleGenerate() {
    if (!startLocation) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setCopied(false);
    setSelectedStop(null);
    startTimeRef.current = Date.now();

    try {
      const res = await fetch("/api/quest/generate-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startLocation, maxDistanceMeters, maxRouteLength, questGoal, objectiveCount }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (currentEvent === "progress") {
              setProgress(data);
            } else if (currentEvent === "result") {
              setElapsed(Date.now() - startTimeRef.current);
              setResult(data);
            } else if (currentEvent === "error") {
              throw new Error(data.error);
            }
            currentEvent = "";
          } else if (line !== "") {
            // Incomplete line — put back in buffer
            buffer += line + "\n";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  async function handleCopy() {
    if (!result || !startLocation) return;
    const text = formatForClipboard(
      { startLocation, maxDistanceMeters, maxRouteLength, questGoal, objectiveCount },
      result,
    );
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex flex-col min-h-dvh p-4 gap-4 max-w-2xl mx-auto">
      <header>
        <h1 className="text-xl font-bold">Quest Generation Tester</h1>
        <p className="text-[var(--muted)] text-xs">
          Generate quests and inspect all waypoints without running the route.
        </p>
      </header>

      {/* Config form */}
      <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-3">
        {/* Location */}
        <div className="text-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[var(--muted)] w-16 shrink-0">Start</span>
            {startLocation ? (
              <span className="tabular-nums text-xs text-[var(--muted)]">
                {startLocation.latitude.toFixed(5)}, {startLocation.longitude.toFixed(5)}
              </span>
            ) : (
              <span className="text-[var(--muted)]">Getting GPS...</span>
            )}
          </div>
          {startLocation && mapsApiKey ? (
            <Suspense
              fallback={
                <div className="w-full h-36 bg-zinc-800 rounded-xl flex items-center justify-center text-[var(--muted)] text-xs">
                  Loading map...
                </div>
              }
            >
              <MapPicker
                apiKey={mapsApiKey}
                center={startLocation}
                onChange={setStartLocation}
              />
            </Suspense>
          ) : null}
        </div>

        {/* Distance */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)] w-16 shrink-0">Radius</span>
          <div className="flex flex-wrap gap-1.5">
            {DISTANCE_OPTIONS.map((opt) => (
              <button
                key={opt.meters}
                onClick={() => setMaxDistanceMeters(opt.meters)}
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  maxDistanceMeters === opt.meters
                    ? "bg-[var(--accent)] text-black"
                    : "bg-zinc-800 text-[var(--fg)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max Route Length */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)] w-16 shrink-0">Route</span>
          <input
            type="range"
            min={MIN_ROUTE_LENGTH_METERS}
            max={MAX_ROUTE_LENGTH_METERS}
            step={1609}
            value={maxRouteLength}
            onChange={(e) => setMaxRouteLength(Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="tabular-nums text-xs w-12 text-right">
            {(maxRouteLength / 1609).toFixed(0)} mi
          </span>
        </div>

        {/* Goal */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)] w-16 shrink-0">Goal</span>
          <input
            type="text"
            value={questGoal}
            onChange={(e) => setQuestGoal(e.target.value)}
            placeholder="e.g., protect the city from aliens"
            maxLength={500}
            className="flex-1 bg-zinc-800 text-[var(--fg)] rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        {/* Objective count */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--muted)] w-16 shrink-0">Stops</span>
          <button
            onClick={() => setObjectiveCount(Math.max(2, objectiveCount - 1))}
            className="w-7 h-7 rounded bg-zinc-800 text-sm font-bold"
          >
            −
          </button>
          <span className="text-lg font-bold tabular-nums w-6 text-center">{objectiveCount}</span>
          <button
            onClick={() => setObjectiveCount(Math.min(10, objectiveCount + 1))}
            className="w-7 h-7 rounded bg-zinc-800 text-sm font-bold"
          >
            +
          </button>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!startLocation || generating}
          className="bg-[var(--accent)] text-black font-bold text-sm px-4 py-2.5 rounded-xl
                     disabled:opacity-50 active:scale-95 transition-transform w-full"
        >
          {generating ? "Generating..." : "Generate Quest"}
        </button>

        {/* Progress indicator */}
        {generating && progress && (
          <div className="bg-zinc-800 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
            <span className="text-[var(--accent)] font-mono font-bold shrink-0">
              {progress.step}/{progress.totalSteps}
            </span>
            <span className="text-[var(--muted)]">{progress.message}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[var(--danger)] text-sm break-words">{error}</p>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-4">
          {/* Quest header */}
          <div className="bg-zinc-900 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold">{result.questTitle}</h2>
              <button
                onClick={handleCopy}
                className="shrink-0 bg-zinc-800 text-xs font-medium px-2.5 py-1 rounded-lg
                           hover:bg-zinc-700 active:scale-95 transition-all"
              >
                {copied ? "Copied!" : "Copy JSON"}
              </button>
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">{result.narrative}</p>
            <div className="flex gap-4 mt-3 text-xs text-[var(--muted)]">
              <span>{result.legs.length} stops</span>
              <span>{result.placesFound} places found</span>
              <span>{(result.routeDistanceMeters / 1000).toFixed(1)} km route</span>
              {elapsed != null && <span>{(elapsed / 1000).toFixed(1)}s</span>}
            </div>
            {result.routeBudgetWarning && (
              <p className="text-yellow-400 text-xs mt-2">{result.routeBudgetWarning}</p>
            )}
          </div>

          {/* Map */}
          {process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
            <div className="rounded-2xl overflow-hidden">
              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}>
                <div className="w-full h-64">
                  <Map
                    defaultCenter={{
                      lat: result.legs[0]?.targetPlace.location.latitude ?? startLocation!.latitude,
                      lng: result.legs[0]?.targetPlace.location.longitude ?? startLocation!.longitude,
                    }}
                    defaultZoom={14}
                    mapId="run-test-map"
                    disableDefaultUI={true}
                    zoomControl={true}
                    gestureHandling="greedy"
                    onClick={() => setSelectedStop(null)}
                  >
                    {/* Start location marker */}
                    {startLocation && (
                      <AdvancedMarker
                        position={{ lat: startLocation.latitude, lng: startLocation.longitude }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            backgroundColor: "#4285F4",
                            border: "3px solid white",
                            boxShadow: "0 0 6px rgba(66,133,244,0.6)",
                          }}
                        />
                      </AdvancedMarker>
                    )}
                    {/* Stop markers */}
                    {result.legs.map((leg, i) => (
                      <AdvancedMarker
                        key={i}
                        position={{
                          lat: leg.targetPlace.location.latitude,
                          lng: leg.targetPlace.location.longitude,
                        }}
                        onClick={() => setSelectedStop(selectedStop === i ? null : i)}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            backgroundColor: selectedStop === i ? "var(--accent)" : "#ef4444",
                            color: selectedStop === i ? "black" : "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            border: "2px solid white",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                            cursor: "pointer",
                          }}
                        >
                          {i + 1}
                        </div>
                      </AdvancedMarker>
                    ))}
                    {/* Info window for selected stop */}
                    {selectedStop !== null && result.legs[selectedStop] && (
                      <InfoWindow
                        position={{
                          lat: result.legs[selectedStop].targetPlace.location.latitude,
                          lng: result.legs[selectedStop].targetPlace.location.longitude,
                        }}
                        onCloseClick={() => setSelectedStop(null)}
                        headerContent={
                          <strong style={{ fontSize: 13 }}>
                            {selectedStop + 1}. {result.legs[selectedStop].targetPlace.name}
                          </strong>
                        }
                      >
                        <div style={{ maxWidth: 220, fontSize: 12, lineHeight: 1.4, color: "#333" }}>
                          <p style={{ margin: "4px 0" }}>{result.legs[selectedStop].objective}</p>
                          <p style={{ margin: "4px 0", color: "#888" }}>
                            Reward: {result.legs[selectedStop].rewardItem.name} ({result.legs[selectedStop].rewardItem.rarity})
                          </p>
                          <p style={{ margin: "2px 0", color: "#999", fontSize: 11 }}>
                            {result.legs[selectedStop].rewardItem.description}
                          </p>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>
                </div>
              </APIProvider>
            </div>
          )}

          {/* Legs */}
          {result.legs.map((leg, i) => (
            <div key={i} className="bg-zinc-900 rounded-2xl p-4">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="bg-zinc-700 text-xs font-bold px-2 py-0.5 rounded">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-sm">{leg.targetPlace.name}</h3>
                <span className="text-xs text-[var(--muted)]">{leg.targetPlace.category}</span>
              </div>

              <p className="text-sm mb-2">{leg.objective}</p>

              <div className="text-xs text-[var(--muted)] mb-3">
                {leg.targetPlace.address}
                <span className="mx-1.5">&middot;</span>
                {leg.targetPlace.location.latitude.toFixed(5)}, {leg.targetPlace.location.longitude.toFixed(5)}
                <span className="mx-1.5">&middot;</span>
                {leg.geofenceRadiusMeters}m radius
              </div>

              {/* Distance to next stop */}
              {result.legDistances[i] != null && (
                <div className="text-xs text-[var(--muted)] mb-3 flex items-center gap-1.5">
                  <span>
                    {i === 0 ? "From start" : `From stop ${i}`}: {result.legDistances[i]}m
                    ({(result.legDistances[i] / 1609).toFixed(2)} mi)
                  </span>
                  <span>&middot;</span>
                  <a
                    href={googleMapsWalkingUrl(
                      i === 0
                        ? result.startLocation
                        : result.legs[i - 1].targetPlace.location,
                      leg.targetPlace.location,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] underline"
                  >
                    Verify on Google Maps
                  </a>
                </div>
              )}

              <div className="border-t border-zinc-800 pt-2 flex items-center gap-2">
                <span className={`text-sm font-medium ${RARITY_COLORS[leg.rewardItem.rarity] ?? "text-zinc-400"}`}>
                  {leg.rewardItem.name}
                </span>
                <span className="text-xs text-[var(--muted)]">({leg.rewardItem.rarity})</span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-0.5">{leg.rewardItem.description}</p>

              {/* Approach Narration */}
              {leg.approachNarration.length > 0 && (
                <div className="border-t border-zinc-800 pt-2 mt-3">
                  <p className="text-xs font-semibold text-[var(--muted)] mb-1">
                    Approach Narration ({leg.approachNarration.length} tiers)
                  </p>
                  <div className="flex flex-col gap-1">
                    {leg.approachNarration.map((line, j) => {
                      const tierDistance = (leg.approachNarration.length - j) * 50;
                      return (
                        <p key={j} className="text-xs text-zinc-400">
                          <span className="text-[var(--muted)] tabular-nums">{tierDistance}m</span>
                          {" "}{line}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Generate another */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-zinc-800 text-[var(--fg)] font-medium text-sm px-4 py-2.5 rounded-xl
                       disabled:opacity-50 active:scale-95 transition-transform w-full"
          >
            {generating ? "Generating..." : "Generate Another"}
          </button>
        </div>
      )}
    </main>
  );
}
