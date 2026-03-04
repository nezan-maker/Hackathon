import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Wrench,
  CheckCircle,
  Filter,
  Circle,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiFetch } from '../lib/api';
import { getRealtimeSocket } from '../lib/realtime';
import { useTheme } from '../context/ThemeContext';
import { getChartPalette } from '../lib/chartTheme';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

type AlertType = 'overpressure' | 'dry-run' | 'sensor-failure' | 'maintenance';
type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertStatus = 'active' | 'acknowledged' | 'resolved';

interface AlertItem {
  id: string;
  pumpId: string;
  pumpName: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  status: AlertStatus;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

const formatTimestamp = (value: string) => new Date(value).toLocaleString();

export function Alerts() {
  const { resolvedTheme } = useTheme();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<{ alerts?: AlertItem[] }>('/alerts');
        setAlerts(data.alerts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadAlerts();
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

        const handleAlertNew = (payload: {
          id?: string;
          pumpId?: string;
          pumpName?: string;
          type?: AlertType;
          severity?: AlertSeverity;
          status?: AlertStatus;
          message?: string;
          timestamp?: string;
        }) => {
          if (!payload.id || !payload.pumpId) return;

          const next: AlertItem = {
            id: payload.id,
            pumpId: String(payload.pumpId),
            pumpName: payload.pumpName || `Pump ${String(payload.pumpId)}`,
            type: payload.type || 'sensor-failure',
            severity: payload.severity || 'warning',
            message: payload.message || 'Alert received',
            timestamp: payload.timestamp || new Date().toISOString(),
            status: payload.status || 'active',
            acknowledgedAt: null,
            resolvedAt: null,
          };

          setAlerts((current) => [next, ...current]);
        };

        const handleAlertUpdated = (payload: {
          id?: string;
          status?: AlertStatus;
          acknowledgedAt?: string | null;
          resolvedAt?: string | null;
        }) => {
          if (!payload.id || !payload.status) return;
          const { id, status } = payload;

          setAlerts((current) => {
            let hasMatch = false;
            const next = current.map((item) => {
              if (item.id !== id) return item;
              hasMatch = true;
              return {
                ...item,
                status,
                acknowledgedAt:
                  payload.acknowledgedAt !== undefined
                    ? payload.acknowledgedAt
                    : item.acknowledgedAt,
                resolvedAt:
                  payload.resolvedAt !== undefined ? payload.resolvedAt : item.resolvedAt,
              };
            });
            return hasMatch ? next : current;
          });
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('alert:new', handleAlertNew);
        socket.on('alert:updated', handleAlertUpdated);

        cleanup = () => {
          socket.off('connect', handleConnect);
          socket.off('disconnect', handleDisconnect);
          socket.off('alert:new', handleAlertNew);
          socket.off('alert:updated', handleAlertUpdated);
        };
      })
      .catch((err) => {
        setConnected(false);
        setError((current) =>
          current || (err instanceof Error ? err.message : 'Realtime alerts unavailable'),
        );
      });

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const updateAlertStatus = async (id: string, action: 'acknowledge' | 'resolve') => {
    setError('');
    try {
      await apiFetch<{ message?: string }>(`/alerts/${id}/${action}`, {
        method: 'POST',
      });
      setAlerts((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: action === 'acknowledge' ? 'acknowledged' : 'resolved',
                acknowledgedAt:
                  action === 'acknowledge' ? new Date().toISOString() : item.acknowledgedAt,
                resolvedAt: action === 'resolve' ? new Date().toISOString() : item.resolvedAt,
              }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to ${action} alert`);
    }
  };

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
        const matchesStatus = filterStatus === 'all' || alert.status === filterStatus;
        return matchesSeverity && matchesStatus;
      }),
    [alerts, filterSeverity, filterStatus],
  );

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'overpressure':
        return AlertOctagon;
      case 'dry-run':
        return AlertTriangle;
      case 'sensor-failure':
        return AlertCircle;
      case 'maintenance':
        return Wrench;
      default:
        return AlertCircle;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-amber-500/10 dark:border-amber-500/30';
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-slate-800/50 dark:border-slate-700';
    }
  };

  const getSeverityIconColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-300';
      case 'warning':
        return 'text-yellow-600 dark:text-amber-300';
      case 'info':
        return 'text-blue-600 dark:text-blue-300';
      default:
        return 'text-gray-600 dark:text-slate-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800 dark:bg-red-500/20 dark:text-red-200">Active</span>;
      case 'acknowledged':
        return <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800 dark:bg-amber-500/20 dark:text-amber-200">Acknowledged</span>;
      case 'resolved':
        return <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200">Resolved</span>;
      default:
        return null;
    }
  };

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  const severityChartData = useMemo(
    () => [
      { severity: 'Critical', count: alerts.filter((a) => a.severity === 'critical').length },
      { severity: 'Warning', count: alerts.filter((a) => a.severity === 'warning').length },
      { severity: 'Info', count: alerts.filter((a) => a.severity === 'info').length },
    ],
    [alerts],
  );
  const chartPalette = useMemo(() => getChartPalette(resolvedTheme), [resolvedTheme]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl text-gray-900">Realtime System Alerts</h1>
          <p className="text-gray-600">Monitor and manage all MQTT-triggered notifications</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <p className="flex items-center gap-2">
            <Circle className={`h-3 w-3 ${connected ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500'}`} />
            {connected ? 'Realtime Connected' : 'Realtime Disconnected'}
          </p>
        </div>
      </div>

      {loading && (
        <div className="mb-4">
          <PumpLoadingIndicator size="md" label="Loading alerts" />
        </div>
      )}
      {error && <p className="mb-4 text-red-600">{error}</p>}

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-gray-600">Active Alerts</p>
              <p className="text-3xl text-gray-900">{activeCount}</p>
            </div>
            <div className="rounded-lg bg-red-100 p-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-gray-600">Critical</p>
              <p className="text-3xl text-gray-900">{criticalCount}</p>
            </div>
            <div className="rounded-lg bg-red-100 p-3">
              <AlertOctagon className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-gray-600">Resolved</p>
              <p className="text-3xl text-gray-900">{resolvedCount}</p>
            </div>
            <div className="rounded-lg bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl text-gray-900">Alert Severity Distribution</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={severityChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
              <XAxis
                dataKey="severity"
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

      <div className="mb-6 rounded-xl bg-white p-4 shadow-md">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-gray-700">Filters:</span>
          </div>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredAlerts.map((alert) => {
          const Icon = getAlertIcon(alert.type);
          return (
            <div key={alert.id} className={`rounded-xl border p-6 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start gap-4">
                <div className={`rounded-lg bg-white p-3 ${getSeverityIconColor(alert.severity)}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h3 className="mb-1 text-lg text-gray-900">{alert.pumpName}</h3>
                      <p className="text-sm text-gray-600">Pump ID: {alert.pumpId}</p>
                    </div>
                    {getStatusBadge(alert.status)}
                  </div>
                  <p className="mb-3 text-gray-800">{alert.message}</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="capitalize">{alert.type.replace('-', ' ')}</span>
                      <span>•</span>
                      <span className="capitalize">{alert.severity}</span>
                      <span>•</span>
                      <span>{formatTimestamp(alert.timestamp)}</span>
                    </div>
                    {alert.status !== 'resolved' && (
                      <div className="flex gap-2">
                        {alert.status === 'active' && (
                          <button
                            onClick={() => void updateAlertStatus(alert.id, 'acknowledge')}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => void updateAlertStatus(alert.id, 'resolve')}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAlerts.length === 0 && !loading && (
        <div className="rounded-xl bg-white p-12 text-center shadow-md">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
          <h2 className="mb-2 text-2xl text-gray-900">No Alerts Found</h2>
          <p className="text-gray-600">No alerts match your current filters</p>
        </div>
      )}
    </div>
  );
}
