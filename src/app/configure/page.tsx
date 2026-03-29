"use client";

import { useState, useEffect, Suspense, lazy } from "react";
import {
  DEFAULT_MAX_DISTANCE_METERS,
  DEFAULT_QUEST_GOAL,
  DEFAULT_OBJECTIVE_COUNT,
  MIN_ROUTE_LENGTH_METERS,
  MAX_ROUTE_LENGTH_METERS,
  DEFAULT_ROUTE_LENGTH_METERS,
} from "@/domain/quest/quest-config";

const MapPicker = lazy(() => import("./MapPicker"));

const DISTANCE_OPTIONS = [
  { label: "¼ mile", meters: 402 },
  { label: "½ mile", meters: 805 },
  { label: "1 mile", meters: 1609 },
  { label: "2 miles", meters: 3219 },
  { label: "3 miles", meters: 4828 },
  { label: "5 miles", meters: 8047 },
  { label: "10 miles", meters: 16093 },
];

const LOADING_MESSAGES = [
  "Scouting the neighborhood...",
  "Plotting your route...",
  "Gathering quest items...",
  "Consulting the oracle...",
  "Mapping ancient trails...",
];

export default function ConfigurePage() {
  const [startLocation, setStartLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [maxDistanceMeters, setMaxDistanceMeters] = useState(
    DEFAULT_MAX_DISTANCE_METERS,
  );
  const [maxRouteLength, setMaxRouteLength] = useState(DEFAULT_ROUTE_LENGTH_METERS);
  const [questGoal, setQuestGoal] = useState(DEFAULT_QUEST_GOAL);
  const [objectiveCount, setObjectiveCount] = useState(DEFAULT_OBJECTIVE_COUNT);
  const [generating, setGenerating] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

  // Get user's current GPS position on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStartLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        setGpsError(`GPS error: ${err.message}`);
        // Fallback to Adams Point, Oakland
        setStartLocation({ latitude: 37.8105, longitude: -122.2534 });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Rotate loading messages
  useEffect(() => {
    if (!generating) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, [generating]);

  async function handleGenerate() {
    if (!startLocation) return;

    setGenerating(true);
    setError(null);
    setLoadingMsg(LOADING_MESSAGES[0]);

    try {
      // Step 1: Create session
      const sessionRes = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: "{}",
      });

      const sessionText = await sessionRes.text();
      if (!sessionRes.ok) throw new Error(`Session failed: ${sessionText}`);

      let sessionData: { sessionId?: string };
      try {
        sessionData = JSON.parse(sessionText);
      } catch {
        throw new Error(`Invalid session response: ${sessionText.slice(0, 120)}`);
      }

      if (!sessionData.sessionId) throw new Error("No sessionId returned");

      const sessionId = sessionData.sessionId;
      sessionStorage.setItem("sessionId", sessionId);

      // Step 2: Generate quest
      const genRes = await fetch("/api/quest/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          sessionId,
          startLocation,
          maxDistanceMeters,
          maxRouteLength,
          questGoal,
          objectiveCount,
        }),
      });

      const genText = await genRes.text();
      if (!genRes.ok) {
        let detail = genText;
        try {
          const parsed = JSON.parse(genText);
          detail = parsed.error ?? genText;
        } catch { /* use raw text */ }
        throw new Error(detail);
      }

      // Success — navigate to run page
      window.location.href = "/run";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setGenerating(false);
    }
  }

  // Loading overlay
  if (generating) {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full mb-6" />
        <p className="text-lg font-semibold">{loadingMsg}</p>
        <p className="text-[var(--muted)] text-sm mt-2">
          This may take 10-15 seconds
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-dvh p-4 gap-5 max-w-lg mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Configure Quest</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Set your starting point, distance, and quest theme.
        </p>
      </header>

      {/* Start Location */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <label className="text-[var(--muted)] text-xs uppercase tracking-wide block mb-2">
          Start
        </label>
        {startLocation && mapsApiKey ? (
          <Suspense
            fallback={
              <div className="w-full h-48 bg-zinc-800 rounded-xl flex items-center justify-center text-[var(--muted)] text-sm">
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
        ) : startLocation ? (
          <p className="text-sm">
            {startLocation.latitude.toFixed(5)}, {startLocation.longitude.toFixed(5)}
            {!mapsApiKey && (
              <span className="text-[var(--muted)] block text-xs mt-1">
                Set NEXT_PUBLIC_GOOGLE_MAPS_KEY to show map
              </span>
            )}
          </p>
        ) : (
          <p className="text-[var(--muted)] text-sm">
            {gpsError ?? "Getting your location..."}
          </p>
        )}
      </section>

      {/* Max Distance */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <label className="text-[var(--muted)] text-xs uppercase tracking-wide block mb-2">
          Max Distance
        </label>
        <div className="flex flex-wrap gap-2">
          {DISTANCE_OPTIONS.map((opt) => (
            <button
              key={opt.meters}
              onClick={() => setMaxDistanceMeters(opt.meters)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                maxDistanceMeters === opt.meters
                  ? "bg-[var(--accent)] text-black"
                  : "bg-zinc-800 text-[var(--fg)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Max Route Length */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <label className="text-[var(--muted)] text-xs uppercase tracking-wide block mb-2">
          Max Route Length
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={MIN_ROUTE_LENGTH_METERS}
            max={MAX_ROUTE_LENGTH_METERS}
            step={1609}
            value={maxRouteLength}
            onChange={(e) => setMaxRouteLength(Number(e.target.value))}
            className="flex-1 accent-[var(--accent)]"
          />
          <span className="text-lg font-bold tabular-nums w-12 text-right">
            {(maxRouteLength / 1609).toFixed(0)} mi
          </span>
        </div>
        <p className="text-[var(--muted)] text-xs mt-1">
          Total walking distance budget for the entire route.
        </p>
      </section>

      {/* Quest Goal */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <label
          htmlFor="quest-goal"
          className="text-[var(--muted)] text-xs uppercase tracking-wide block mb-2"
        >
          Goal
        </label>
        <input
          id="quest-goal"
          type="text"
          value={questGoal}
          onChange={(e) => setQuestGoal(e.target.value)}
          placeholder="e.g., protect the city from aliens"
          maxLength={200}
          className="w-full bg-zinc-800 text-[var(--fg)] rounded-lg px-3 py-2 text-sm
                     outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </section>

      {/* Objective Count */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <label
          htmlFor="objective-count"
          className="text-[var(--muted)] text-xs uppercase tracking-wide block mb-2"
        >
          Number of objectives to complete
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setObjectiveCount(Math.max(2, objectiveCount - 1))}
            className="w-10 h-10 rounded-lg bg-zinc-800 text-lg font-bold"
          >
            −
          </button>
          <span className="text-2xl font-bold tabular-nums w-8 text-center">
            {objectiveCount}
          </span>
          <button
            onClick={() => setObjectiveCount(Math.min(10, objectiveCount + 1))}
            className="w-10 h-10 rounded-lg bg-zinc-800 text-lg font-bold"
          >
            +
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <p className="text-[var(--danger)] text-sm break-words">{error}</p>
      )}

      {/* Start Quest Button */}
      <button
        onClick={handleGenerate}
        disabled={!startLocation || generating}
        className="bg-[var(--accent)] text-black font-bold text-lg px-8 py-4 rounded-2xl
                   disabled:opacity-50 active:scale-95 transition-transform w-full"
      >
        Start Quest
      </button>

      <p className="text-[var(--muted)] text-xs text-center">
        Requires location permission. Run outdoors safely.
      </p>
    </main>
  );
}
