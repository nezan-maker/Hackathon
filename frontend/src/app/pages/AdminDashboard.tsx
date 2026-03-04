import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Droplets,
  AlertTriangle,
  PlusCircle,
  RefreshCw,
  Activity,
  Circle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../lib/api';
import { getRealtimeSocket } from '../lib/realtime';
import { useTheme } from '../context/ThemeContext';
import { getChartPalette } from '../lib/chartTheme';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

interface AdminStats {
  users: number;
  admins: number;
  pumps: number;
  availablePumps: number;
  purchasedPumps: number;
  registeredPumps: number;
  alertsTotal: number;
  alertsActive: number;
  alertsAcknowledged: number;
  alertsResolved: number;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

interface AdminPump {
  _id: string;
  name: string;
  serial_id: string;
  url?: string;
  createdByAdmin?: boolean;
  imageProvider?: string;
  capacity: number;
  userId?: string | null;
  owner?: {
    name: string;
    email: string;
  } | null;
  purchasedAt?: string | null;
  registeredAt?: string | null;
  price_usd: number;
  createdAt: string;
}

interface AdminAlert {
  id: string;
  pumpId: string;
  pumpName: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  timestamp: string;
}

interface AdminTelemetryEvent {
  metric: string;
  pump_id: string;
  value: number | null;
  timestamp: string;
}

interface AdminOverviewResponse {
  stats: AdminStats;
  recent: {
    users: AdminUser[];
    pumps: AdminPump[];
    alerts: AdminAlert[];
  };
  telemetry: {
    pressure: AdminTelemetryEvent[];
    flow: AdminTelemetryEvent[];
    temperature: AdminTelemetryEvent[];
    speed: AdminTelemetryEvent[];
  };
  generatedAt: string;
}

interface AdminPumpsResponse {
  pumps: AdminPump[];
}

interface NewPumpForm {
  name: string;
  capacity: string;
  url: string;
  serial_id: string;
}

type PumpCatalogStatus = 'available' | 'purchased' | 'registered';

const initialForm: NewPumpForm = {
  name: '',
  capacity: '',
  url: '',
  serial_id: '',
};

const isCloudinaryUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    return host === 'cloudinary.com' || host.endsWith('.cloudinary.com');
  } catch {
    return false;
  }
};

export function AdminDashboard() {
  const { resolvedTheme } = useTheme();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<AdminAlert[]>([]);
  const [pumps, setPumps] = useState<AdminPump[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [connected, setConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<Array<{ type: string; text: string; timestamp: string }>>([]);
  const [form, setForm] = useState<NewPumpForm>(initialForm);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [overview, pumpList] = await Promise.all([
        apiFetch<AdminOverviewResponse>('/admin/overview'),
        apiFetch<AdminPumpsResponse>('/admin/pumps'),
      ]);

      setStats(overview.stats);
      setRecentUsers(overview.recent.users ?? []);
      setRecentAlerts(overview.recent.alerts ?? []);
      setPumps(pumpList.pumps ?? []);
      setGeneratedAt(overview.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadAdminData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void getRealtimeSocket()
      .then((socket) => {
        if (!active) return;
        setConnected(Boolean(socket.connected));

        const onConnect = () => setConnected(true);
        const onDisconnect = () => setConnected(false);

        const onSensorUpdate = (payload: { pumpId?: string; metric?: string; value?: number | string }) => {
          if (!payload.pumpId || !payload.metric) return;
          const text = `Sensor ${payload.metric} from pump ${payload.pumpId}: ${String(payload.value ?? 'n/a')}`;
          setLiveEvents((current) => [
            { type: 'sensor', text, timestamp: new Date().toISOString() },
            ...current.slice(0, 29),
          ]);
        };

        const onAlertNew = (payload: { pumpName?: string; severity?: string; message?: string }) => {
          const text = `Alert (${payload.severity || 'warning'}) - ${payload.pumpName || 'Pump'}: ${payload.message || 'Alert raised'}`;
          setLiveEvents((current) => [
            { type: 'alert', text, timestamp: new Date().toISOString() },
            ...current.slice(0, 29),
          ]);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('sensor:update', onSensorUpdate);
        socket.on('alert:new', onAlertNew);

        cleanup = () => {
          socket.off('connect', onConnect);
          socket.off('disconnect', onDisconnect);
          socket.off('sensor:update', onSensorUpdate);
          socket.off('alert:new', onAlertNew);
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

  const handleCreatePump = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const name = form.name.trim();
    const capacity = Number(form.capacity);
    const url = form.url.trim();
    if (!name || !Number.isFinite(capacity) || capacity <= 0 || !isCloudinaryUrl(url)) {
      setError('Valid name, positive capacity and Cloudinary image URL are required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch<{ message?: string }>('/admin/pumps', {
        method: 'POST',
        body: JSON.stringify({
          name,
          capacity,
          url,
          serial_id: form.serial_id.trim() || undefined,
        }),
      });

      setSuccess(response.message ?? 'Pump added');
      setForm(initialForm);
      await loadAdminData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add pump');
    } finally {
      setSubmitting(false);
    }
  };

  const pumpDistribution = useMemo(
    () => [
      { label: 'Available', count: stats?.availablePumps ?? 0 },
      { label: 'Purchased', count: stats?.purchasedPumps ?? 0 },
      { label: 'Registered', count: stats?.registeredPumps ?? 0 },
    ],
    [stats],
  );

  const alertDistribution = useMemo(
    () => [
      { label: 'Active', count: stats?.alertsActive ?? 0 },
      { label: 'Ack', count: stats?.alertsAcknowledged ?? 0 },
      { label: 'Resolved', count: stats?.alertsResolved ?? 0 },
    ],
    [stats],
  );
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);
  const getPumpStatusClassName = (status: PumpCatalogStatus) => {
    switch (status) {
      case 'registered':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200';
      case 'purchased':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200';
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Admin Control Center</h1>
          <p className="text-slate-600">Monitor the full platform and manage pump catalog inventory.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <span className="mr-2 inline-flex items-center gap-1">
              <Circle className={`h-3 w-3 ${connected ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500'}`} />
              {connected ? 'Realtime Connected' : 'Realtime Disconnected'}
            </span>
          </span>
          <button
            onClick={() => void loadAdminData()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {generatedAt && <p className="mb-4 text-xs text-slate-500">Last full sync: {new Date(generatedAt).toLocaleString()}</p>}
      {loading && (
        <div className="mb-4">
          <PumpLoadingIndicator size="md" label="Loading admin overview" />
        </div>
      )}
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {success && <p className="mb-4 text-emerald-700">{success}</p>}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-xl bg-indigo-600 p-3">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600">Users</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.users ?? 0}</p>
          <p className="text-sm text-slate-500">{stats?.admins ?? 0} admins</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-xl bg-blue-600 p-3">
              <Droplets className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600">Pump Catalog</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.pumps ?? 0}</p>
          <p className="text-sm text-slate-500">{stats?.availablePumps ?? 0} available</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-xl bg-emerald-600 p-3">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600">Registered Pumps</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.registeredPumps ?? 0}</p>
          <p className="text-sm text-slate-500">{stats?.purchasedPumps ?? 0} purchased</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-xl bg-red-600 p-3">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600">Active Alerts</p>
          <p className="text-3xl font-bold text-slate-900">{stats?.alertsActive ?? 0}</p>
          <p className="text-sm text-slate-500">{stats?.alertsTotal ?? 0} total</p>
        </div>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Pump Inventory Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pumpDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: chartPalette.axisText, fontSize: 12 }}
                  axisLine={{ stroke: chartPalette.axis }}
                  tickLine={{ stroke: chartPalette.axis }}
                />
                <YAxis
                  allowDecimals={false}
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
                <Bar dataKey="count" fill={chartPalette.pressure} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Alert Status Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: chartPalette.axisText, fontSize: 12 }}
                  axisLine={{ stroke: chartPalette.axis }}
                  tickLine={{ stroke: chartPalette.axis }}
                />
                <YAxis
                  allowDecimals={false}
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
                <Bar dataKey="count" fill={chartPalette.critical} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Add Pump to Catalog</h2>
        <form onSubmit={handleCreatePump} className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="pump-name" className="mb-2 block text-sm font-semibold text-slate-900">
              Pump Name
            </label>
            <input
              id="pump-name"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              placeholder="Industrial Pump X"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="pump-capacity" className="mb-2 block text-sm font-semibold text-slate-900">
              Capacity (L)
            </label>
            <input
              id="pump-capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm((current) => ({ ...current, capacity: e.target.value }))}
              placeholder="5000"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="pump-url" className="mb-2 block text-sm font-semibold text-slate-900">
              Cloudinary Image URL
            </label>
            <input
              id="pump-url"
              value={form.url}
              onChange={(e) => setForm((current) => ({ ...current, url: e.target.value }))}
              placeholder="https://res.cloudinary.com/<cloud>/image/upload/..."
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="pump-serial" className="mb-2 block text-sm font-semibold text-slate-900">
              Serial ID (Optional)
            </label>
            <input
              id="pump-serial"
              value={form.serial_id}
              onChange={(e) => setForm((current) => ({ ...current, serial_id: e.target.value }))}
              placeholder="Auto-generated if empty"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
            >
              <PlusCircle className="h-4 w-4" />
              {submitting ? 'Adding...' : 'Add Pump'}
            </button>
          </div>
        </form>
      </div>

      <div className="mb-8 rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Catalog Pumps</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-2 py-3">Name</th>
                <th className="px-2 py-3">Serial</th>
                <th className="px-2 py-3">Capacity</th>
                <th className="px-2 py-3">Price</th>
                <th className="px-2 py-3">Owner</th>
                <th className="px-2 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pumps.slice(0, 60).map((pump) => {
                const status: PumpCatalogStatus = pump.registeredAt
                  ? 'registered'
                  : pump.purchasedAt
                    ? 'purchased'
                    : 'available';

                return (
                  <tr key={pump._id} className="border-b border-slate-100">
                    <td className="px-2 py-3 text-sm text-slate-900">{pump.name}</td>
                    <td className="px-2 py-3 text-sm text-slate-600">{pump.serial_id}</td>
                    <td className="px-2 py-3 text-sm text-slate-600">{pump.capacity.toLocaleString()} L</td>
                    <td className="px-2 py-3 text-sm text-slate-600">${pump.price_usd.toFixed(2)}</td>
                    <td className="px-2 py-3 text-sm text-slate-600">{pump.owner?.email || 'Unassigned'}</td>
                    <td className="px-2 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs ${getPumpStatusClassName(status)}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Recent Alerts</h2>
          <div className="space-y-3">
            {recentAlerts.slice(0, 12).map((alert) => (
              <div key={alert.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{alert.pumpName}</p>
                <p className="text-xs text-slate-600">{alert.message}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {alert.severity} • {alert.status} • {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
            {recentAlerts.length === 0 && <p className="text-sm text-slate-500">No recent alerts.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-bold text-slate-900">Recent Users</h2>
          <div className="space-y-3">
            {recentUsers.slice(0, 12).map((user) => (
              <div key={user.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{user.name || user.email}</p>
                <p className="text-xs text-slate-600">{user.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {user.role} • joined {new Date(user.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-sm text-slate-500">No users found.</p>}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-100 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Live Event Feed</h2>
        <div className="space-y-2">
          {liveEvents.slice(0, 20).map((event, index) => (
            <div key={`${event.timestamp}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2">
              <Activity className={`h-4 w-4 ${event.type === 'alert' ? 'text-red-600' : 'text-blue-600'}`} />
              <p className="text-sm text-slate-700">{event.text}</p>
              <span className="ml-auto text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          {liveEvents.length === 0 && (
            <p className="text-sm text-slate-500">Waiting for sensor/alert events...</p>
          )}
        </div>
      </div>
    </div>
  );
}
