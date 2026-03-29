"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import MapPolyline from "../components/MapPolyline";
import type { SpectateResponse } from "@/validation/spectate-schemas";

const POLL_INTERVAL_MS = 3000;

// --- Types ---

type SpectateQuest = NonNullable<SpectateResponse["quest"]>;
type SpectateLeg = SpectateQuest["legs"][number];

// --- Map helpers ---

function SpectateMapBounds({
  trail,
  legs,
}: {
  trail: google.maps.LatLngLiteral[];
  legs: SpectateLeg[];
}) {
  const map = useMap();
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (!map) return;
    // Re-fit when trail grows substantially or on first load
    if (trail.length < 2 && legs.length === 0) return;
    if (trail.length - lastCountRef.current < 5 && lastCountRef.current > 0) return;

    const bounds = new google.maps.LatLngBounds();
    trail.forEach((p) => bounds.extend(p));
    legs.forEach((leg) =>
      bounds.extend({ lat: leg.targetLocation.latitude, lng: leg.targetLocation.longitude }),
    );
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 40);
      lastCountRef.current = trail.length;
    }
  }, [map, trail, legs]);

  return null;
}

// --- Main component (needs Suspense for useSearchParams) ---

function SpectateContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [data, setData] = useState<SpectateResponse | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trail: google.maps.LatLngLiteral[] = (data?.trail ?? []).map((p) => ({
    lat: p.latitude,
    lng: p.longitude,
  }));

  const playerPos = data?.lastLocation
    ? { lat: data.lastLocation.latitude, lng: data.lastLocation.longitude }
    : null;

  const fetchData = useCallback(async () => {
    try {
      const url = sessionParam
        ? `/api/spectate?session=${sessionParam}`
        : "/api/spectate";
      const res = await fetch(url);
      if (!res.ok) {
        setError(`Server error: ${res.status}`);
        return;
      }
      const json: SpectateResponse = await res.json();
      setData(json);
      setLastUpdate(new Date());
      setError(null);
    } catch {
      setError("Failed to connect to server");
    }
  }, [sessionParam]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (error && !data) {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <p className="text-[var(--danger)] text-lg">{error}</p>
      </main>
    );
  }

  if (!data?.session || !data?.quest) {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">No Active Run</h1>
        <p className="text-[var(--muted)]">
          There&apos;s no quest in progress right now. Check back when a runner starts!
        </p>
      </main>
    );
  }

  const quest = data.quest;
  const questCompleted = quest.status === "completed";
  const completedLegs = quest.legs.filter((l) => l.status === "completed").length;
  const activeLeg = quest.legs.find(
    (l) => l.status === "active" || l.status === "reached",
  );

  return (
    <main className="flex flex-col min-h-dvh p-4 gap-4 max-w-lg mx-auto">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{quest.title}</h1>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${questCompleted ? "bg-[var(--accent)]" : "bg-red-500 animate-pulse"}`}
            />
            <span className="text-xs text-[var(--muted)]">
              {questCompleted ? "Completed" : "Live"}
            </span>
          </div>
        </div>
        {lastUpdate && (
          <p className="text-xs text-[var(--muted)]">
            Updated {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </header>

      {/* Quest Complete Banner */}
      {questCompleted && (
        <div className="bg-[var(--accent)] text-black rounded-2xl p-4 text-center">
          <p className="text-xl font-bold">Quest Complete!</p>
        </div>
      )}

      {/* Current Objective */}
      {!questCompleted && activeLeg && (
        <section className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-[var(--muted)] text-xs uppercase tracking-wide mb-1">
            Current Objective
          </p>
          <p className="text-lg font-semibold">{activeLeg.objective}</p>
          <p className="text-[var(--muted)] text-sm mt-1">
            Target: {activeLeg.targetPlaceName}
          </p>
        </section>
      )}

      {/* Map */}
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
        <section className="rounded-2xl overflow-hidden">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}>
            <div className="w-full h-64">
              <Map
                defaultCenter={playerPos ?? { lat: 37.81, lng: -122.25 }}
                defaultZoom={15}
                mapId="spectate-map"
                disableDefaultUI={true}
                zoomControl={true}
                gestureHandling="greedy"
              >
                {/* GPS trail */}
                <MapPolyline path={trail} />
                {/* Player position */}
                {playerPos && (
                  <AdvancedMarker position={playerPos}>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: "#4285F4",
                        border: "3px solid white",
                        boxShadow: "0 0 6px rgba(66,133,244,0.6)",
                      }}
                    />
                  </AdvancedMarker>
                )}
                {/* Objective markers */}
                {quest.legs.map((leg, i) => (
                  <AdvancedMarker
                    key={leg.id}
                    position={{
                      lat: leg.targetLocation.latitude,
                      lng: leg.targetLocation.longitude,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        backgroundColor:
                          leg.status === "completed"
                            ? "#22c55e"
                            : leg.status === "active" || leg.status === "reached"
                              ? "#eab308"
                              : "#6b7280",
                        border: "2px solid white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: leg.status === "completed" ? "black" : "white",
                      }}
                    >
                      {i + 1}
                    </div>
                  </AdvancedMarker>
                ))}
                <SpectateMapBounds trail={trail} legs={quest.legs} />
              </Map>
            </div>
          </APIProvider>
        </section>
      )}

      {/* Quest Progress */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <p className="text-[var(--muted)] text-xs uppercase tracking-wide mb-2">
          Quest Progress
        </p>
        <div className="flex gap-2">
          {quest.legs.map((leg) => (
            <div
              key={leg.id}
              className={`flex-1 h-2 rounded-full ${
                leg.status === "completed"
                  ? "bg-[var(--accent)]"
                  : leg.status === "active" || leg.status === "reached"
                    ? "bg-[var(--accent-dim)]"
                    : "bg-zinc-700"
              }`}
            />
          ))}
        </div>
        <p className="text-[var(--muted)] text-xs mt-2">
          {completedLegs} of {quest.legs.length} objectives completed
        </p>
      </section>

      {/* Inventory */}
      {data.inventory.length > 0 && (
        <section className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-[var(--muted)] text-xs uppercase tracking-wide mb-2">
            Inventory ({data.inventory.length})
          </p>
          <div className="flex flex-col gap-2">
            {data.inventory.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-[var(--muted)] text-xs">
                    {item.description}
                  </p>
                </div>
                <span className="text-[var(--accent)] text-sm font-bold">
                  x{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Distance traveled */}
      {data.totalDistanceMeters > 0 && (
        <section className="bg-zinc-900 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold tabular-nums">
            {data.totalDistanceMeters < 1000
              ? `${data.totalDistanceMeters}m`
              : `${(data.totalDistanceMeters / 1000).toFixed(2)}km`}
          </p>
          <p className="text-[var(--muted)] text-sm">distance traveled</p>
        </section>
      )}
    </main>
  );
}

export default function SpectatePage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center min-h-dvh">
          <p className="text-[var(--muted)] animate-pulse">Loading...</p>
        </main>
      }
    >
      <SpectateContent />
    </Suspense>
  );
}
