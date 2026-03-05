import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  Gauge,
  Activity,
  AlertTriangle,
  Droplets,
  Play,
  Square,
  Thermometer,
  Circle,
} from 'lucide-react';
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
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getRealtimeSocket } from '../lib/realtime';
import { getChartPalette } from '../lib/chartTheme';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

interface BackendPump {
  _id: string;
  name: string;
  serial_id: string;
  capacity: number;
  url?: string;
  userId?: string | null;
  purchasedAt?: string | null;
  registeredAt?: string | null;
}

interface TelemetrySeriesPoint {
  metric: 'pressure' | 'flow' | 'temperature' | 'speed';
  value: number;
  timestamp: string;
}

interface PumpTelemetryResponse {
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

interface CombinedChartPoint {
  time: string;
  pressure?: number;
  flow?: number;
  temperature?: number;
  speed?: number;
}

const limitSeries = (points: TelemetrySeriesPoint[], max = 120) =>
  points.length > max ? points.slice(points.length - max) : points;

const toTimeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const buildCombinedChartData = (
  pressure: TelemetrySeriesPoint[],
  flow: TelemetrySeriesPoint[],
  temperature: TelemetrySeriesPoint[],
  speed: TelemetrySeriesPoint[],
): CombinedChartPoint[] => {
  const sortedPoints = [...pressure, ...flow, ...temperature, ...speed]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-120);

  const byTimestamp = new Map<string, CombinedChartPoint>();
  sortedPoints.forEach((point) => {
    const key = point.timestamp;
    const existing = byTimestamp.get(key) || {
      time: toTimeLabel(point.timestamp),
    };
    existing[point.metric] = Number(point.value.toFixed(2));
    byTimestamp.set(key, existing);
  });

  return Array.from(byTimestamp.values()).slice(-40);
};

const metricFromTopic = (topic?: string): TelemetrySeriesPoint['metric'] | null => {
  if (!topic) return null;
  if (topic.startsWith('/pump/pressure')) return 'pressure';
  if (topic.startsWith('/pump/flow')) return 'flow';
  if (topic.startsWith('/pump/temp')) return 'temperature';
  if (topic.startsWith('/pump/speed')) return 'speed';
  return null;
};

export function PumpDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [pump, setPump] = useState<BackendPump | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(50);
  const [controlLoading, setControlLoading] = useState(false);
  const [controlMessage, setControlMessage] = useState('');
  const [connected, setConnected] = useState(false);

  const [pressureSeries, setPressureSeries] = useState<TelemetrySeriesPoint[]>([]);
  const [flowSeries, setFlowSeries] = useState<TelemetrySeriesPoint[]>([]);
  const [temperatureSeries, setTemperatureSeries] = useState<TelemetrySeriesPoint[]>([]);
  const [speedSeries, setSpeedSeries] = useState<TelemetrySeriesPoint[]>([]);

  const [latestValues, setLatestValues] = useState({
    pressure: null as number | null,
    flow: null as number | null,
    temperature: null as number | null,
    speed: null as number | null,
  });

  useEffect(() => {
    const loadPump = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<{ pumps?: BackendPump[] }>('/my-pumps');
        const found = (data.pumps ?? []).find((item) => item._id === id);
        if (!found) {
          setError('Pump not found in your purchased pumps');
          setPump(null);
        } else {
          setPump(found);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pump details');
      } finally {
        setLoading(false);
      }
    };

    void loadPump();
  }, [id]);

  useEffect(() => {
    const loadPumpTelemetry = async () => {
      if (!pump?.serial_id) return;
      try {
        const data = await apiFetch<PumpTelemetryResponse>(
          `/telemetry/pump/${encodeURIComponent(pump.serial_id)}?limit=120`,
        );
        setPressureSeries(data.series?.pressure ?? []);
        setFlowSeries(data.series?.flow ?? []);
        setTemperatureSeries(data.series?.temperature ?? []);
        setSpeedSeries(data.series?.speed ?? []);
        setLatestValues({
          pressure: data.latest?.pressure ?? null,
          flow: data.latest?.flow ?? null,
          temperature: data.latest?.temperature ?? null,
          speed: data.latest?.speed ?? null,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load pump telemetry');
      }
    };

    void loadPumpTelemetry();
  }, [pump?.serial_id]);

  useEffect(() => {
    if (!pump?.serial_id) return;

    let active = true;
    let cleanup: (() => void) | null = null;

    void getRealtimeSocket()
      .then((socket) => {
        if (!active) return;
        setConnected(Boolean(socket.connected));

        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        const onSensorUpdate = (payload: {
          pumpId?: string;
          metric?: string;
          topic?: string;
          value?: number | string;
          timestamp?: string;
        }) => {
          if (!payload.pumpId || String(payload.pumpId) !== String(pump.serial_id)) {
            return;
          }

          const metric = (payload.metric as TelemetrySeriesPoint['metric']) || metricFromTopic(payload.topic);
          const numericValue = Number(payload.value);
          if (!metric || !Number.isFinite(numericValue)) return;

          const point: TelemetrySeriesPoint = {
            metric,
            value: numericValue,
            timestamp: payload.timestamp || new Date().toISOString(),
          };

          if (metric === 'pressure') {
            setPressureSeries((current) => limitSeries([...current, point]));
            setLatestValues((current) => ({ ...current, pressure: point.value }));
          } else if (metric === 'flow') {
            setFlowSeries((current) => limitSeries([...current, point]));
            setLatestValues((current) => ({ ...current, flow: point.value }));
          } else if (metric === 'temperature') {
            setTemperatureSeries((current) => limitSeries([...current, point]));
            setLatestValues((current) => ({ ...current, temperature: point.value }));
          } else if (metric === 'speed') {
            setSpeedSeries((current) => limitSeries([...current, point]));
            setLatestValues((current) => ({ ...current, speed: point.value }));
          }
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('sensor:update', onSensorUpdate);

        cleanup = () => {
          socket.off('connect', onConnect);
          socket.off('disconnect', onDisconnect);
          socket.off('sensor:update', onSensorUpdate);
        };
      })
      .catch(() => {
        setConnected(false);
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [pump?.serial_id]);

  const ownership = useMemo(() => {
    if (!pump?.userId) return 'available';
    if (user?.id && String(pump.userId) === String(user.id)) {
      return pump.registeredAt ? 'registered-mine' : 'purchased-mine';
    }
    return 'purchased-other';
  }, [pump?.registeredAt, pump?.userId, user?.id]);

  const statusLabel = useMemo(() => {
    if (ownership === 'registered-mine') return 'Registered';
    if (ownership === 'purchased-mine') return 'Purchased';
    if (ownership === 'purchased-other') return 'Unavailable';
    return 'Available';
  }, [ownership]);

  const controlEnabled = ownership === 'registered-mine';
  const statusClass =
    ownership === 'registered-mine'
      ? 'bg-green-100 text-green-800'
      : ownership === 'purchased-mine'
        ? 'bg-blue-100 text-blue-800'
        : ownership === 'purchased-other'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-gray-100 text-gray-800';

  const combinedChartData = useMemo(
    () => buildCombinedChartData(pressureSeries, flowSeries, temperatureSeries, speedSeries),
    [pressureSeries, flowSeries, temperatureSeries, speedSeries],
  );
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);

  const sendRemoteCommand = async (message: string) => {
    if (!pump) return;
    if (!controlEnabled) {
      setControlMessage('Remote control is only available for pumps you purchased and registered.');
      return;
    }
    setControlLoading(true);
    setControlMessage('');
    try {
      const response = await apiFetch<{ message?: string }>('/remote/control', {
        method: 'POST',
        body: JSON.stringify({
          pump_id: pump.serial_id,
          message,
        }),
      });
      setControlMessage(response.message ?? 'Command sent');
    } catch (err) {
      setControlMessage(err instanceof Error ? err.message : 'Failed to send command');
    } finally {
      setControlLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <button
        onClick={() => navigate('/pumps')}
        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Pumps
      </button>

      {loading && <PumpLoadingIndicator size="lg" label="Loading pump details" />}

      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {!loading && pump && (
        <>
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="mb-2 text-2xl text-gray-900 sm:text-3xl">{pump.name}</h1>
              <p className="break-all text-gray-600">Serial: {pump.serial_id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-lg px-4 py-2 text-sm whitespace-nowrap ${statusClass}`}
              >
                {statusLabel}
              </span>
              <span className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 sm:w-auto">
                <span className="mr-2 inline-flex items-center gap-1">
                  <Circle className={`h-3 w-3 ${connected ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500'}`} />
                  {connected ? 'Live' : 'Offline'}
                </span>
              </span>
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-white p-4 shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <Gauge className="h-5 w-5 text-orange-600" />
                <span className="text-sm text-gray-600">Pressure</span>
              </div>
              <p className="text-2xl text-gray-900">
                {latestValues.pressure !== null ? `${latestValues.pressure.toFixed(2)} PSI` : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <span className="text-sm text-gray-600">Flow</span>
              </div>
              <p className="text-2xl text-gray-900">
                {latestValues.flow !== null ? `${latestValues.flow.toFixed(2)}` : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-red-600" />
                <span className="text-sm text-gray-600">Temperature</span>
              </div>
              <p className="text-2xl text-gray-900">
                {latestValues.temperature !== null ? `${latestValues.temperature.toFixed(2)} °C` : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-md">
              <div className="mb-2 flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-gray-600">Capacity</span>
              </div>
              <p className="text-2xl text-gray-900">{pump.capacity.toLocaleString()} L</p>
            </div>
          </div>

          <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl text-gray-900">Live Telemetry</h2>
            <div className="h-80">
              {combinedChartData.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
                  <Gauge className="mb-3 h-6 w-6 text-slate-500 dark:text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                    No telemetry points yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                    Start or register this pump to see pressure, flow, temperature, and speed trends.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedChartData}>
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

          <div className="rounded-xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl text-gray-900">Remote Control</h2>
            {!controlEnabled && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Purchase and register this pump with your account to enable remote control.
              </div>
            )}
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => void sendRemoteCommand('ON')}
                  disabled={controlLoading || !controlEnabled}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:bg-green-300 sm:w-auto"
                >
                  <Play className="h-4 w-4" />
                  Start
                </button>
                <button
                  onClick={() => void sendRemoteCommand('OFF')}
                  disabled={controlLoading || !controlEnabled}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:bg-red-300 sm:w-auto"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              </div>

              <div>
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="speed-control" className="text-sm text-gray-700">
                    Speed
                  </label>
                  <span className="text-sm text-gray-700">{speed}%</span>
                </div>
                <input
                  id="speed-control"
                  type="range"
                  min="0"
                  max="100"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <button
                  onClick={() => void sendRemoteCommand(`SPEED:${speed}`)}
                  disabled={controlLoading || !controlEnabled}
                  className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300 sm:w-auto"
                >
                  Apply Speed
                </button>
              </div>

              {controlMessage && (
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p className="break-words">{controlMessage}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
