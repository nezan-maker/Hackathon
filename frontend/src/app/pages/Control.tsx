import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  AlertTriangle,
  Circle,
  Gauge,
  MapPin,
  Play,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { getRealtimeSocket } from "../lib/realtime";
import { PumpLoadingIndicator } from "../components/PumpLoadingIndicator";

interface BackendPump {
  _id: string;
  name: string;
  serial_id: string;
  capacity: number;
  purchasedAt?: string | null;
  registeredAt?: string | null;
}

interface NearestRiver {
  _id: string;
  river_id: number;
  river_name: string;
  lat: number;
  lon: number;
  discharge_id: number;
  discharge_value: string;
  distance_km: number;
}

type LocationSource = "browser" | "session" | "ip";

type BrowserLocationResult =
  | { status: "available"; lat: number; lon: number }
  | { status: "denied" }
  | { status: "unavailable"; message: string };

export function Control() {
  const [searchParams] = useSearchParams();
  const serialIdFromQuery = (searchParams.get("serial_id") || "").trim();

  const [pumps, setPumps] = useState<BackendPump[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedSerialId, setSelectedSerialId] = useState("");
  const [speed, setSpeed] = useState(50);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [nearestRivers, setNearestRivers] = useState<NearestRiver[]>([]);
  const [selectedRiverId, setSelectedRiverId] = useState("");
  const [riverFeedback, setRiverFeedback] = useState("");
  const [riverError, setRiverError] = useState("");
  const [loadingRivers, setLoadingRivers] = useState(false);
  const [sendingRiverSelection, setSendingRiverSelection] = useState(false);
  const [riverUserLocation, setRiverUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [riverLocationSource, setRiverLocationSource] =
    useState<LocationSource | null>(null);
  const [connected, setConnected] = useState(false);

  const registeredPumps = useMemo(
    () => pumps.filter((pump) => Boolean(pump.registeredAt)),
    [pumps],
  );

  const selectedPump = useMemo(
    () =>
      registeredPumps.find(
        (pump) => String(pump.serial_id) === String(selectedSerialId),
      ) || null,
    [registeredPumps, selectedSerialId],
  );

  const selectedRiver = useMemo(
    () =>
      nearestRivers.find(
        (river) => String(river.river_id) === String(selectedRiverId),
      ) || null,
    [nearestRivers, selectedRiverId],
  );

  const resolveBrowserLocation =
    useCallback(async (): Promise<BrowserLocationResult> => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        return {
          status: "unavailable",
          message: "Browser geolocation is not supported in this environment.",
        };
      }

      if (
        "permissions" in navigator &&
        typeof navigator.permissions.query === "function"
      ) {
        try {
          const permission = await navigator.permissions.query({
            name: "geolocation" as PermissionName,
          });
          if (permission.state === "denied") {
            return { status: "denied" };
          }
        } catch {
          // Ignore permission API errors and continue with geolocation attempt.
        }
      }

      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              status: "available",
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            });
          },
          (geoError) => {
            if (geoError.code === geoError.PERMISSION_DENIED) {
              resolve({ status: "denied" });
              return;
            }

            if (geoError.code === geoError.TIMEOUT) {
              resolve({
                status: "unavailable",
                message:
                  "Timed out while getting browser location. Please try again.",
              });
              return;
            }

            resolve({
              status: "unavailable",
              message:
                "Unable to read browser location. Please ensure location services are available.",
            });
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0,
          },
        );
      });
    }, []);

  const loadNearestRivers = useCallback(async () => {
    setLoadingRivers(true);
    setRiverError("");
    try {
      const browserLocation = await resolveBrowserLocation();
      let endpoint = "/remote/rivers/nearest";

      if (browserLocation.status === "available") {
        const params = new URLSearchParams({
          lat: String(browserLocation.lat),
          lon: String(browserLocation.lon),
        });
        endpoint = `${endpoint}?${params.toString()}`;
      } else if (browserLocation.status === "denied") {
        endpoint = `${endpoint}?browser_location_denied=true`;
      } else {
        setNearestRivers([]);
        setRiverUserLocation(null);
        setRiverLocationSource(null);
        setRiverError(browserLocation.message);
        return;
      }

      const response = await apiFetch<{
        user_location?: { lat: number; lon: number };
        location_source?: LocationSource;
        rivers?: NearestRiver[];
      }>(endpoint);
      setNearestRivers(response.rivers ?? []);
      setRiverUserLocation(response.user_location ?? null);
      setRiverLocationSource(response.location_source ?? null);
    } catch (err) {
      setNearestRivers([]);
      setRiverUserLocation(null);
      setRiverLocationSource(null);
      setRiverError(
        err instanceof Error ? err.message : "Failed to load nearest rivers",
      );
    } finally {
      setLoadingRivers(false);
    }
  }, [resolveBrowserLocation]);

  useEffect(() => {
    const loadPumps = async () => {
      setLoadingPumps(true);
      setError("");
      try {
        const data = await apiFetch<{ pumps?: BackendPump[] }>("/my-pumps");
        setPumps(data.pumps ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load your pumps",
        );
        setPumps([]);
      } finally {
        setLoadingPumps(false);
      }
    };

    void loadPumps();
  }, []);

  useEffect(() => {
    void loadNearestRivers();
  }, [loadNearestRivers]);

  useEffect(() => {
    if (registeredPumps.length === 0) {
      setSelectedSerialId("");
      return;
    }

    const hasCurrent = registeredPumps.some(
      (pump) => String(pump.serial_id) === String(selectedSerialId),
    );
    if (hasCurrent) return;

    const queryMatch = registeredPumps.find(
      (pump) => String(pump.serial_id) === String(serialIdFromQuery),
    );
    setSelectedSerialId(queryMatch?.serial_id || registeredPumps[0].serial_id);
  }, [registeredPumps, selectedSerialId, serialIdFromQuery]);

  useEffect(() => {
    if (!selectedRiverId) return;

    const stillAvailable = nearestRivers.some(
      (river) => String(river.river_id) === String(selectedRiverId),
    );
    if (!stillAvailable) {
      setSelectedRiverId("");
      setRiverFeedback("");
    }
  }, [nearestRivers, selectedRiverId]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void getRealtimeSocket()
      .then((socket) => {
        if (!active) return;
        setConnected(Boolean(socket.connected));

        const handleConnect = () => setConnected(true);
        const handleDisconnect = () => setConnected(false);

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);

        cleanup = () => {
          socket.off("connect", handleConnect);
          socket.off("disconnect", handleDisconnect);
        };
      })
      .catch(() => {
        setConnected(false);
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const sendCommand = async (message: string) => {
    if (!selectedSerialId) {
      setError("Select a registered pump first");
      return;
    }

    setSending(true);
    setError("");
    setFeedback("");

    try {
      const response = await apiFetch<{ message?: string }>("/remote/control", {
        method: "POST",
        body: JSON.stringify({
          pump_id: selectedSerialId,
          message,
        }),
      });

      setFeedback(response.message ?? "Command sent successfully");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send control command",
      );
    } finally {
      setSending(false);
    }
  };

  const sendRiverSelection = async (riverId: string) => {
    if (!selectedSerialId) {
      setRiverError("Select a registered pump first");
      return;
    }

    if (!riverId) {
      setRiverError("Select a river first");
      return;
    }

    setSendingRiverSelection(true);
    setRiverError("");
    setRiverFeedback("");

    try {
      const response = await apiFetch<{ message?: string }>(
        "/remote/rivers/select",
        {
          method: "POST",
          body: JSON.stringify({
            pump_id: selectedSerialId,
            river_id: riverId,
          }),
        },
      );

      setRiverFeedback(response.message ?? "River selection sent successfully");
    } catch (err) {
      setRiverError(
        err instanceof Error ? err.message : "Failed to send river selection",
      );
    } finally {
      setSendingRiverSelection(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            Pump Control
          </h1>
          <p className="text-slate-600">
            Send ON/OFF and speed commands to{" "}
            <span className="font-semibold">esp_hardware</span>.
          </p>
        </div>
        <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:w-auto">
          <p className="flex items-center gap-2">
            <Circle
              className={`h-3 w-3 ${connected ? "fill-emerald-500 text-emerald-500" : "fill-amber-500 text-amber-500"}`}
            />
            {connected ? "Realtime Connected" : "Realtime Disconnected"}
          </p>
        </div>
      </div>

      {loadingPumps && (
        <div className="mb-4">
          <PumpLoadingIndicator size="md" label="Loading registered pumps" />
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}
      {feedback && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
          {feedback}
        </div>
      )}

      {!loadingPumps && registeredPumps.length === 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-8 shadow-lg">
          <p className="mb-3 text-slate-700">
            You do not have any registered pumps yet. Register a purchased pump
            first.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/register-pump"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Register Pump
            </Link>
            <Link
              to="/pumps"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open Pumps Page
            </Link>
          </div>
        </div>
      )}

      {!loadingPumps && registeredPumps.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-lg sm:p-8">
          <div className="mb-6">
            <label
              htmlFor="control-pump"
              className="mb-2 block text-sm font-semibold text-slate-800"
            >
              Registered Pump
            </label>
            <select
              id="control-pump"
              value={selectedSerialId}
              onChange={(event) => setSelectedSerialId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {registeredPumps.map((pump) => (
                <option key={pump._id} value={pump.serial_id}>
                  {pump.name} ({pump.serial_id}) -{" "}
                  {pump.capacity.toLocaleString()} L
                </option>
              ))}
            </select>
            {selectedPump && (
              <div className="mt-2 text-sm text-slate-600">
                <span className="font-medium">{selectedPump.name}</span>{" "}
                selected.
                <Link
                  to={`/pumps/${selectedPump._id}`}
                  className="mt-1 block text-blue-600 hover:text-blue-700 hover:underline sm:ml-2 sm:mt-0 sm:inline"
                >
                  View telemetry
                </Link>
              </div>
            )}
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => void sendCommand("ON")}
              disabled={sending || !selectedSerialId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300 sm:w-auto"
            >
              <Play className="h-4 w-4" />
              Switch ON
            </button>
            <button
              onClick={() => void sendCommand("OFF")}
              disabled={sending || !selectedSerialId}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300 sm:w-auto"
            >
              <Square className="h-4 w-4" />
              Switch OFF
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <label
                htmlFor="speed-range"
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Motor Speed
              </label>
              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                <Gauge className="h-4 w-4" />
                {speed}%
              </span>
            </div>
            <input
              id="speed-range"
              type="range"
              min="0"
              max="100"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="w-full accent-blue-600"
            />
            <button
              onClick={() => void sendCommand(`SPEED:${speed}`)}
              disabled={sending || !selectedSerialId}
              className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
            >
              Apply Speed
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-semibold text-cyan-900">
                Nearest Rivers (Top 5)
              </p>
              {riverUserLocation && (
                <p className="inline-flex flex-wrap items-center gap-1 text-xs text-cyan-800">
                  <MapPin className="h-3.5 w-3.5" />
                  {riverLocationSource === "browser"
                    ? "Browser GPS"
                    : riverLocationSource === "ip"
                      ? "Server IP fallback"
                      : "Session location"}
                  : {riverUserLocation.lat.toFixed(4)},{" "}
                  {riverUserLocation.lon.toFixed(4)}
                </p>
              )}
            </div>

            {loadingRivers && (
              <PumpLoadingIndicator size="sm" label="Finding nearest rivers" />
            )}

            {!loadingRivers && riverError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p>{riverError}</p>
                <button
                  type="button"
                  onClick={() => void loadNearestRivers()}
                  className="mt-2 inline-flex rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  Retry river lookup
                </button>
              </div>
            )}

            {!loadingRivers && !riverError && nearestRivers.length === 0 && (
              <p className="text-sm text-cyan-900">
                No rivers are available for your current session location.
              </p>
            )}

            {!loadingRivers && !riverError && nearestRivers.length > 0 && (
              <>
                <label
                  htmlFor="river-select"
                  className="mb-2 block text-sm font-medium text-cyan-900"
                >
                  Select River Source
                </label>
                <select
                  id="river-select"
                  value={selectedRiverId}
                  onChange={(event) => {
                    const nextRiverId = event.target.value;
                    setSelectedRiverId(nextRiverId);
                    setRiverError("");
                    if (!nextRiverId) {
                      setRiverFeedback("");
                      return;
                    }
                    void sendRiverSelection(nextRiverId);
                  }}
                  disabled={sendingRiverSelection || !selectedSerialId}
                  className="w-full rounded-lg border border-cyan-300 bg-white px-4 py-3 text-slate-900 focus:border-transparent focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-100"
                >
                  <option value="">Choose a river to send to hardware</option>
                  {nearestRivers.map((river) => (
                    <option key={river._id} value={river.river_id}>
                      {river.river_name} ({river.distance_km.toFixed(2)} km
                      away)
                    </option>
                  ))}
                </select>

                {selectedRiver && (
                  <p className="mt-2 break-words text-xs text-cyan-900">
                    Sending: {selectedRiver.river_name} | lat{" "}
                    {selectedRiver.lat} | lon {selectedRiver.lon} | discharge{" "}
                    {selectedRiver.discharge_value}
                  </p>
                )}

                {riverFeedback && (
                  <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {riverFeedback}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              Commands are sent as ON, OFF, SPEED: &lt; 0-100 &gt; , and chosen
              water source to your purchased pump.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
