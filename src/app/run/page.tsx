"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import MapPolyline from "../components/MapPolyline";

// --- Types (presentation-only, mirroring API response shapes) ---

interface QuestLegView {
  id: string;
  sequenceIndex: number;
  status: string;
  objective: string;
  targetPlaceName: string;
  targetLocation: { latitude: number; longitude: number };
  rewardItemName: string;
  geofenceRadiusMeters: number;
}

interface QuestView {
  id: string;
  title: string;
  narrative: string;
  status: string;
  currentLegIndex: number;
  legs: QuestLegView[];
}

interface QuestApiResponse {
  quest: QuestView | null;
  currentObjective: string | null;
  currentTarget: {
    name: string;
    location: { latitude: number; longitude: number };
    radiusMeters: number;
  } | null;
  distanceToTarget: number | null;
}

interface InventoryItemView {
  name: string;
  description: string;
  rarity: string;
  quantity: number;
  collectedAt: string;
}

interface QuestUpdateView {
  type: string;
  legIndex: number;
  itemName: string | null;
  nextObjective: string | null;
  questCompleted: boolean;
}

// --- TTS helper (no business logic, just browser API) ---

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// --- Distance helper ---

function computeTrailDistance(trail: google.maps.LatLngLiteral[]): number {
  let total = 0;
  for (let i = 1; i < trail.length; i++) {
    const prev = trail[i - 1];
    const curr = trail[i];
    const dLat = (curr.lat - prev.lat) * 111_320;
    const dLng = (curr.lng - prev.lng) * 111_320 * Math.cos(curr.lat * (Math.PI / 180));
    total += Math.sqrt(dLat * dLat + dLng * dLng);
  }
  return Math.round(total);
}

// --- Map helpers ---

function MapBoundsFitter({
  trail,
  legs,
}: {
  trail: google.maps.LatLngLiteral[];
  legs: QuestLegView[];
}) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!map || fittedRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    trail.forEach((p) => bounds.extend(p));
    legs.forEach((leg) =>
      bounds.extend({ lat: leg.targetLocation.latitude, lng: leg.targetLocation.longitude }),
    );
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 40);
      fittedRef.current = true;
    }
  }, [map, trail, legs]);

  return null;
}

// --- Component ---

export default function RunPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [quest, setQuest] = useState<QuestView | null>(null);
  const [currentObjective, setCurrentObjective] = useState<string | null>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItemView[]>([]);
  const [gpsStatus, setGpsStatus] = useState<string>("Waiting for GPS...");
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [playerPos, setPlayerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [targetLocation, setTargetLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapFollowing, setMapFollowing] = useState(true);

  const [trail, setTrail] = useState<google.maps.LatLngLiteral[]>([]);
  const [shareCopied, setShareCopied] = useState(false);

  const batchRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastAnnouncedLegRef = useRef<number>(-1);
  const lastSentRef = useRef<{ lat: number; lng: number } | null>(null);

  /** Minimum meters of movement before sending a new location to the server. */
  const MIN_MOVE_METERS = 5;

  const addLog = useCallback((msg: string) => {
    setEventLog((prev) => [msg, ...prev].slice(0, 20));
  }, []);

  // Fetch quest state from server
  const fetchQuestState = useCallback(async () => {
    try {
      const res = await fetch("/api/quest");
      if (!res.ok) return;
      const data: QuestApiResponse = await res.json();
      setQuest(data.quest);
      setCurrentObjective(data.currentObjective);
      setDistanceToTarget(data.distanceToTarget);
      setTargetName(data.currentTarget?.name ?? null);
      setTargetLocation(data.currentTarget?.location ?? null);
    } catch {
      // Silently retry on next poll
    }
  }, []);

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      if (!res.ok) return;
      const data = await res.json();
      setInventory(data.items);
    } catch {
      // Silently retry
    }
  }, []);

  // Send GPS point to server
  const sendLocation = useCallback(
    async (position: GeolocationPosition) => {
      if (!sessionId) return;

      // Sanitize values: some Android devices report -1 or NaN instead of null
      const raw = position.coords;
      const safeNum = (v: number | null): number | null =>
        v == null || !Number.isFinite(v) || v < 0 ? null : v;

      const point = {
        latitude: raw.latitude,
        longitude: raw.longitude,
        accuracy: raw.accuracy,
        altitude: raw.altitude != null && Number.isFinite(raw.altitude) ? raw.altitude : null,
        speed: safeNum(raw.speed),
        heading: safeNum(raw.heading),
        timestamp: new Date(position.timestamp).toISOString(),
      };

      setGpsStatus(
        `GPS: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} (±${Math.round(point.accuracy)}m)`,
      );
      // Always update player position for map display (even if below move threshold)
      setPlayerPos({ lat: point.latitude, lng: point.longitude });

      // Skip if we haven't moved enough since last send
      if (lastSentRef.current) {
        const dlat = point.latitude - lastSentRef.current.lat;
        const dlng = point.longitude - lastSentRef.current.lng;
        // Rough meter estimate: 1° lat ≈ 111,320m, 1° lng ≈ 111,320m * cos(lat)
        const mLat = dlat * 111_320;
        const mLng = dlng * 111_320 * Math.cos(point.latitude * (Math.PI / 180));
        const dist = Math.sqrt(mLat * mLat + mLng * mLng);
        if (dist < MIN_MOVE_METERS) return;
      }

      lastSentRef.current = { lat: point.latitude, lng: point.longitude };
      setTrail((prev) => [...prev, { lat: point.latitude, lng: point.longitude }]);
      batchRef.current++;
      const key = `${sessionId}:${batchRef.current}`;

      try {
        const res = await fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            points: [point],
            idempotencyKey: key,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          // Stale session after server restart — auto-recover
          if (res.status === 400 && errBody.includes("No active session")) {
            addLog("Session expired, creating new session...");
            try {
              const sRes = await fetch("/api/session", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "ngrok-skip-browser-warning": "true",
                },
                body: "{}",
              });
              if (sRes.ok) {
                const sData = await sRes.json();
                sessionStorage.setItem("sessionId", sData.sessionId);
                setSessionId(sData.sessionId);
                lastSentRef.current = null;
                batchRef.current = 0;
                addLog("New session created, resuming GPS tracking");
                await Promise.all([fetchQuestState(), fetchInventory()]);
              }
            } catch {
              addLog("Failed to create new session");
            }
            return;
          }
          addLog(`Location send failed: ${res.status} ${errBody.slice(0, 120)}`);
          return;
        }

        const data = await res.json();

        if (data.questUpdate) {
          const update: QuestUpdateView = data.questUpdate;
          handleQuestUpdate(update);
        }

        // Refresh quest state and inventory
        await Promise.all([fetchQuestState(), fetchInventory()]);
      } catch (err) {
        addLog(`Network error sending GPS`);
      }
    },
    [sessionId, addLog, fetchQuestState, fetchInventory],
  );

  // Handle quest progression events
  const handleQuestUpdate = useCallback(
    (update: QuestUpdateView) => {
      if (update.itemName) {
        const msg = `Collected: ${update.itemName}!`;
        addLog(msg);
        if (ttsEnabled) speak(msg);
      }

      if (update.questCompleted) {
        const msg = "Quest complete! Congratulations!";
        addLog(msg);
        if (ttsEnabled) speak(msg);
      } else if (update.nextObjective) {
        const msg = `Next: ${update.nextObjective}`;
        addLog(msg);
        if (ttsEnabled) speak(update.nextObjective);
      }
    },
    [addLog, ttsEnabled],
  );

  // Initialize session and GPS on mount
  useEffect(() => {
    const sid = sessionStorage.getItem("sessionId");
    if (!sid) {
      setError("No active session. Go back and start a run.");
      return;
    }
    setSessionId(sid);
  }, []);

  // Start GPS watching once we have a session
  useEffect(() => {
    if (!sessionId) return;

    // Initial fetch
    fetchQuestState();
    fetchInventory();

    // Announce first objective via TTS
    fetchQuestState().then(() => {
      // Small delay to let state settle
      setTimeout(() => {
        const obj = document.getElementById("current-objective")?.textContent;
        if (obj && ttsEnabled && lastAnnouncedLegRef.current === -1) {
          speak(`Quest started. ${obj}`);
          lastAnnouncedLegRef.current = 0;
        }
      }, 500);
    });

    if (!navigator.geolocation) {
      setError("Geolocation not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => sendLocation(position),
      (err) => {
        setGpsStatus(`GPS Error: ${err.message}`);
        addLog(`GPS error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      },
    );

    watchIdRef.current = watchId;
    addLog("GPS tracking started");

    // Request wake lock to keep screen on during the run
    const requestWakeLock = () => {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        navigator.wakeLock.request("screen").then((lock) => {
          wakeLockRef.current = lock;
          lock.addEventListener("release", () => { wakeLockRef.current = null; });
          addLog("Screen wake lock active");
        }).catch(() => {
          // Wake lock not available or denied — not critical
        });
      }
    };
    requestWakeLock();

    // Re-acquire wake lock when tab becomes visible again (browser releases it on hide)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionId, sendLocation, fetchQuestState, fetchInventory, addLog, ttsEnabled]);

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <p className="text-[var(--danger)] text-lg">{error}</p>
        <a href="/" className="text-[var(--accent)] mt-4 underline">
          Back to start
        </a>
      </main>
    );
  }

  const questCompleted = quest?.status === "completed";

  return (
    <main className="flex flex-col min-h-dvh p-4 gap-4 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{quest?.title ?? "Loading..."}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const url = `${window.location.origin}/spectate?session=${sessionId}`;
              navigator.clipboard.writeText(url).then(() => {
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              });
            }}
            className="text-sm px-3 py-1 rounded-lg border border-[var(--muted)]"
          >
            {shareCopied ? "Copied!" : "Share"}
          </button>
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="text-sm px-3 py-1 rounded-lg border border-[var(--muted)]"
          >
            TTS {ttsEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      {/* Quest Complete Banner */}
      {questCompleted && (
        <div className="bg-[var(--accent)] text-black rounded-2xl p-6 text-center">
          <p className="text-2xl font-bold mb-2">Quest Complete!</p>
          <p className="text-sm">You&apos;ve finished {quest?.title ?? "the quest"}.</p>
          <a
            href="/"
            className="inline-block mt-4 bg-black text-[var(--accent)] px-6 py-2 rounded-xl font-bold"
          >
            New Run
          </a>
        </div>
      )}

      {/* Current Objective */}
      {!questCompleted && (
        <section className="bg-zinc-900 rounded-2xl p-4">
          <p className="text-[var(--muted)] text-xs uppercase tracking-wide mb-1">
            Current Objective
          </p>
          <p id="current-objective" className="text-lg font-semibold">
            {currentObjective ?? "Loading..."}
          </p>
          {targetName && (
            <p className="text-[var(--muted)] text-sm mt-1">
              Target: {targetName}
            </p>
          )}
        </section>
      )}

      {/* Map with distance overlay */}
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
        <section className="rounded-2xl overflow-hidden relative">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}>
            <div className="w-full h-56">
              <Map
                defaultCenter={
                  playerPos ?? { lat: 37.81, lng: -122.25 }
                }
                {...(!questCompleted && mapFollowing && playerPos ? { center: playerPos } : {})}
                defaultZoom={15}
                mapId="run-map"
                disableDefaultUI={true}
                zoomControl={true}
                gestureHandling="greedy"
                onDragstart={() => setMapFollowing(false)}
              >
                {/* GPS trail */}
                <MapPolyline path={trail} />
                {/* Player marker (blue dot) */}
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
                {/* During run: show current target only */}
                {!questCompleted && targetLocation && (
                  <AdvancedMarker
                    position={{
                      lat: targetLocation.latitude,
                      lng: targetLocation.longitude,
                    }}
                  />
                )}
                {/* On completion: show all leg targets with numbered markers */}
                {questCompleted && quest?.legs.map((leg, i) => (
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
                        backgroundColor: "#22c55e",
                        border: "2px solid white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "black",
                      }}
                    >
                      {i + 1}
                    </div>
                  </AdvancedMarker>
                ))}
                {/* Auto-fit bounds on completion */}
                {questCompleted && <MapBoundsFitter trail={trail} legs={quest?.legs ?? []} />}
              </Map>
            </div>
          </APIProvider>
          {/* Re-center button (shown when user has panned away during active run) */}
          {!questCompleted && !mapFollowing && (
            <button
              onClick={() => setMapFollowing(true)}
              className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs font-medium text-white"
            >
              Re-center
            </button>
          )}
          {/* Distance overlay (only during active run) */}
          {!questCompleted && (
            <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm rounded-xl px-3 py-1.5 text-right">
              <p className="text-2xl font-bold tabular-nums leading-tight">
                {distanceToTarget != null && Number.isFinite(distanceToTarget)
                  ? distanceToTarget < 1000
                    ? `${distanceToTarget}m`
                    : `${(distanceToTarget / 1000).toFixed(1)}km`
                  : "—"}
              </p>
              <p className="text-[var(--muted)] text-xs">to target</p>
            </div>
          )}
        </section>
      )}
      {/* Fallback distance display when no map key */}
      {!questCompleted && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
        <section className="bg-zinc-900 rounded-2xl p-4 text-center">
          <p className="text-4xl font-bold tabular-nums">
            {distanceToTarget != null && Number.isFinite(distanceToTarget)
              ? distanceToTarget < 1000
                ? `${distanceToTarget}m`
                : `${(distanceToTarget / 1000).toFixed(1)}km`
              : "—"}
          </p>
          <p className="text-[var(--muted)] text-sm">to target</p>
        </section>
      )}

      {/* Distance Traveled */}
      {trail.length > 1 && (
        <section className="bg-zinc-900 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold tabular-nums">
            {(() => {
              const d = computeTrailDistance(trail);
              return d < 1000 ? `${d}m` : `${(d / 1000).toFixed(2)}km`;
            })()}
          </p>
          <p className="text-[var(--muted)] text-sm">distance traveled</p>
        </section>
      )}

      {/* Quest Progress */}
      {quest && !questCompleted && (
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
            Leg {quest.currentLegIndex + 1} of {quest.legs.length}
          </p>
        </section>
      )}

      {/* Inventory */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <p className="text-[var(--muted)] text-xs uppercase tracking-wide mb-2">
          Inventory {inventory.length > 0 && `(${inventory.length})`}
        </p>
        {inventory.length === 0 ? (
          <p className="text-[var(--muted)] text-sm">No items yet. Start running!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {inventory.map((item) => (
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
        )}
      </section>

      {/* GPS Status */}
      <p className="text-[var(--muted)] text-xs text-center">{gpsStatus}</p>

      {/* New Quest Button */}
      <button
        onClick={() => {
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
          }
          if (wakeLockRef.current) {
            wakeLockRef.current.release();
            wakeLockRef.current = null;
          }
          sessionStorage.removeItem("sessionId");
          window.location.href = "/configure";
        }}
        className="text-[var(--muted)] text-sm underline text-center py-2"
      >
        End run &amp; start new quest
      </button>

      {/* Event Log */}
      <section className="bg-zinc-900 rounded-2xl p-4">
        <p className="text-[var(--muted)] text-xs uppercase tracking-wide mb-2">
          Event Log
        </p>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {eventLog.length === 0 ? (
            <p className="text-[var(--muted)] text-xs">Waiting for events...</p>
          ) : (
            eventLog.map((msg, i) => (
              <p key={i} className="text-xs text-[var(--muted)]">
                {msg}
              </p>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
