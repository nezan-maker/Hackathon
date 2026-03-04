import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Circle, Droplets, Gauge, Thermometer, Wind } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../lib/api';
import { getRealtimeSocket } from '../lib/realtime';
import { useTheme } from '../context/ThemeContext';
import { getChartPalette } from '../lib/chartTheme';

interface BackendPump {
  _id: string;
  name: string;
  serial_id: string;
  capacity: number;
  purchasedAt?: string | null;
  registeredAt?: string | null;
}

interface PumpTelemetryResponse {
  generatedAt?: string;
  latest?: {
    pressure?: number | null;
    flow?: number | null;
    temperature?: number | null;
    speed?: number | null;
  };
  series?: {
    pressure?: TelemetrySeriesPoint[];
    flow?: TelemetrySeriesPoint[];
    temperature?: TelemetrySeriesPoint[];
    speed?: TelemetrySeriesPoint[];
  };
}

interface LatestTelemetrySnapshot {
  pressure: number | null;
  flow: number | null;
  temperature: number | null;
  speed: number | null;
  generatedAt: string;
}

interface TelemetrySeriesPoint {
  value: number;
  timestamp: string;
}

interface PumpSeriesSnapshot {
  pressure: TelemetrySeriesPoint[];
  flow: TelemetrySeriesPoint[];
  temperature: TelemetrySeriesPoint[];
  speed: TelemetrySeriesPoint[];
}

interface CombinedChartPoint {
  time: string;
  pressure?: number;
  flow?: number;
  temperature?: number;
  speed?: number;
}

const emptyLatestTelemetry = {
  pressure: null,
  flow: null,
  temperature: null,
  speed: null,
};
const emptyPumpSeries: PumpSeriesSnapshot = {
  pressure: [],
  flow: [],
  temperature: [],
  speed: [],
};

const toTimeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const buildCombinedChartData = (series: PumpSeriesSnapshot, max = 40): CombinedChartPoint[] => {
  const allPoints = [
    ...series.pressure.map((point) => ({ ...point, metric: 'pressure' as const })),
    ...series.flow.map((point) => ({ ...point, metric: 'flow' as const })),
    ...series.temperature.map((point) => ({ ...point, metric: 'temperature' as const })),
    ...series.speed.map((point) => ({ ...point, metric: 'speed' as const })),
  ]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-120);

  const byTimestamp = new Map<string, CombinedChartPoint>();
  allPoints.forEach((point) => {
    const existing = byTimestamp.get(point.timestamp) || {
      time: toTimeLabel(point.timestamp),
    };
    existing[point.metric] = Number(point.value.toFixed(2));
    byTimestamp.set(point.timestamp, existing);
  });

  return Array.from(byTimestamp.values()).slice(-max);
};

export function Dashboard() {
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [pumps, setPumps] = useState<BackendPump[]>([]);
  const [latestBySerialId, setLatestBySerialId] = useState<Record<string, LatestTelemetrySnapshot>>({});
  const [seriesBySerialId, setSeriesBySerialId] = useState<Record<string, PumpSeriesSnapshot>>({});
  const [telemetryErrors, setTelemetryErrors] = useState<Record<string, string>>({});
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);

  useEffect(() => {
    const loadPumpTelemetryByPump = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<{ pumps?: BackendPump[] }>('/my-pumps');
        const ownedPumps = data.pumps ?? [];
        setPumps(ownedPumps);

        const registeredPumps = ownedPumps.filter((pump) => Boolean(pump.registeredAt));
        if (registeredPumps.length === 0) {
          setLatestBySerialId({});
          setSeriesBySerialId({});
          setTelemetryErrors({});
          return;
        }

        const telemetryResults = await Promise.all(
          registeredPumps.map(async (pump) => {
            try {
              const telemetry = await apiFetch<PumpTelemetryResponse>(
                `/telemetry/pump/${encodeURIComponent(pump.serial_id)}?limit=120`,
              );
              return {
                serial_id: pump.serial_id,
                latest: {
                  pressure: telemetry.latest?.pressure ?? null,
                  flow: telemetry.latest?.flow ?? null,
                  temperature: telemetry.latest?.temperature ?? null,
                  speed: telemetry.latest?.speed ?? null,
                  generatedAt: telemetry.generatedAt || new Date().toISOString(),
                },
                series: {
                  pressure: telemetry.series?.pressure ?? [],
                  flow: telemetry.series?.flow ?? [],
                  temperature: telemetry.series?.temperature ?? [],
                  speed: telemetry.series?.speed ?? [],
                },
                error: '',
              };
            } catch (telemetryError) {
              return {
                serial_id: pump.serial_id,
                latest: null,
                series: null,
                error:
                  telemetryError instanceof Error
                    ? telemetryError.message
                    : 'Unable to load telemetry',
              };
            }
          }),
        );

        const nextLatestBySerialId: Record<string, LatestTelemetrySnapshot> = {};
        const nextSeriesBySerialId: Record<string, PumpSeriesSnapshot> = {};
        const nextTelemetryErrors: Record<string, string> = {};

        telemetryResults.forEach((result) => {
          if (result.latest && result.series) {
            nextLatestBySerialId[result.serial_id] = result.latest;
            nextSeriesBySerialId[result.serial_id] = result.series;
            return;
          }
          if (result.error) {
            nextTelemetryErrors[result.serial_id] = result.error;
          }
        });

        setLatestBySerialId(nextLatestBySerialId);
        setSeriesBySerialId(nextSeriesBySerialId);
        setTelemetryErrors(nextTelemetryErrors);
      } catch (err) {
        setPumps([]);
        setLatestBySerialId({});
        setSeriesBySerialId({});
        setTelemetryErrors({});
        setError(err instanceof Error ? err.message : 'Unable to load pump dashboard');
      } finally {
        setLoading(false);
      }
    };

    void loadPumpTelemetryByPump();
  }, []);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void getRealtimeSocket()
      .then((socket) => {
        if (!active) return;
        setConnected(Boolean(socket.connected));

        const handleConnect = () => setConnected(true);
        const handleDisconnect = () => setConnected(false);

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        cleanup = () => {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
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

  const registeredPumps = useMemo(
    () => pumps.filter((pump) => Boolean(pump.registeredAt)),
    [pumps],
  );
  const purchasedCount = pumps.length;
  const registeredCount = registeredPumps.length;
  const pendingRegistrationCount = Math.max(0, purchasedCount - registeredCount);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Pump Telemetry Dashboard</h1>
          <p className="text-slate-600">
            Telemetry is now organized by pump. Open a registered pump to see its own live data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <p className="flex items-center gap-2">
              <Circle className={`h-3 w-3 ${connected ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500'}`} />
              {connected ? 'Realtime Connected' : 'Realtime Disconnected'}
            </p>
          </div>
          <Link
            to="/pumps"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Pumps Page
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="text-sm font-medium text-slate-600">Purchased Pumps</p>
          <p className="text-3xl font-bold text-slate-900">{purchasedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="text-sm font-medium text-slate-600">Registered Pumps</p>
          <p className="text-3xl font-bold text-slate-900">{registeredCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <p className="text-sm font-medium text-slate-600">Pending Registration</p>
          <p className="text-3xl font-bold text-slate-900">{pendingRegistrationCount}</p>
        </div>
      </div>

      {!loading && registeredPumps.length === 0 && (
        <div className="rounded-xl border border-slate-100 bg-white p-8 shadow-lg">
          <p className="mb-3 text-slate-700">
            You do not have any registered pumps yet. Register a purchased pump to view per-pump telemetry.
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

      {registeredPumps.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {registeredPumps.map((pump) => {
            const latest = latestBySerialId[pump.serial_id];
            const series = seriesBySerialId[pump.serial_id] || emptyPumpSeries;
            const telemetryError = telemetryErrors[pump.serial_id];
            const latestValues = latest
              ? latest
              : { ...emptyLatestTelemetry, generatedAt: '' };
            const chartData = buildCombinedChartData(series);

            return (
              <div key={pump._id} className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-900">{pump.name}</h3>
                  <p className="text-sm text-slate-500">
                    Serial {pump.serial_id} • {pump.capacity.toLocaleString()} L
                  </p>
                </div>

                {telemetryError && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {telemetryError}
                  </div>
                )}

                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 inline-flex items-center gap-2 text-xs text-slate-600">
                      <Gauge className="h-3.5 w-3.5" />
                      Pressure
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {latestValues.pressure !== null ? `${latestValues.pressure.toFixed(2)} PSI` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 inline-flex items-center gap-2 text-xs text-slate-600">
                      <Wind className="h-3.5 w-3.5" />
                      Flow
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {latestValues.flow !== null ? `${latestValues.flow.toFixed(2)}` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 inline-flex items-center gap-2 text-xs text-slate-600">
                      <Thermometer className="h-3.5 w-3.5" />
                      Temperature
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {latestValues.temperature !== null ? `${latestValues.temperature.toFixed(2)} °C` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 inline-flex items-center gap-2 text-xs text-slate-600">
                      <Droplets className="h-3.5 w-3.5" />
                      Speed
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {latestValues.speed !== null ? `${latestValues.speed.toFixed(2)} %` : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <h4 className="mb-3 text-sm font-semibold text-slate-700">Telemetry Trend</h4>
                  <div className="h-56">
                    {chartData.length === 0 ? (
                      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                        No telemetry points yet for this pump.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                          <XAxis
                            dataKey="time"
                            tick={{ fill: chartPalette.axisText, fontSize: 12 }}
                            axisLine={{ stroke: chartPalette.axis }}
                            tickLine={{ stroke: chartPalette.axis }}
                            minTickGap={18}
                          />
                          <YAxis
                            tick={{ fill: chartPalette.axisText, fontSize: 12 }}
                            axisLine={{ stroke: chartPalette.axis }}
                            tickLine={{ stroke: chartPalette.axis }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: chartPalette.tooltipBg,
                              borderColor: chartPalette.tooltipBorder,
                              borderRadius: '0.75rem',
                              color: chartPalette.tooltipText,
                            }}
                            labelStyle={{ color: chartPalette.tooltipLabel, fontWeight: 600 }}
                            itemStyle={{ color: chartPalette.tooltipText }}
                          />
                          <Legend wrapperStyle={{ color: chartPalette.axisText }} />
                          <Line
                            type="monotone"
                            dataKey="pressure"
                            name="Pressure"
                            stroke={chartPalette.pressure}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="flow"
                            name="Flow"
                            stroke={chartPalette.flow}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="temperature"
                            name="Temperature"
                            stroke={chartPalette.temperature}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="speed"
                            name="Speed"
                            stroke={chartPalette.speed}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <p className="mb-4 text-xs text-slate-500">
                  Last telemetry sync:{' '}
                  {latestValues.generatedAt
                    ? new Date(latestValues.generatedAt).toLocaleString()
                    : 'No telemetry yet'}
                </p>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/pumps/${pump._id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    View Telemetry
                  </Link>
                  <Link
                    to={`/control?serial_id=${encodeURIComponent(pump.serial_id)}`}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open Controls
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
