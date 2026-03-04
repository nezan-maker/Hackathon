import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, Circle, Gauge, Play, SlidersHorizontal, Square } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getRealtimeSocket } from '../lib/realtime';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

interface BackendPump {
  _id: string;
  name: string;
  serial_id: string;
  capacity: number;
  purchasedAt?: string | null;
  registeredAt?: string | null;
}

export function Control() {
  const [searchParams] = useSearchParams();
  const serialIdFromQuery = (searchParams.get('serial_id') || '').trim();

  const [pumps, setPumps] = useState<BackendPump[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedSerialId, setSelectedSerialId] = useState('');
  const [speed, setSpeed] = useState(50);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const registeredPumps = useMemo(
    () => pumps.filter((pump) => Boolean(pump.registeredAt)),
    [pumps],
  );

  const selectedPump = useMemo(
    () =>
      registeredPumps.find((pump) => String(pump.serial_id) === String(selectedSerialId)) || null,
    [registeredPumps, selectedSerialId],
  );

  useEffect(() => {
    const loadPumps = async () => {
      setLoadingPumps(true);
      setError('');
      try {
        const data = await apiFetch<{ pumps?: BackendPump[] }>('/my-pumps');
        setPumps(data.pumps ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load your pumps');
        setPumps([]);
      } finally {
        setLoadingPumps(false);
      }
    };

    void loadPumps();
  }, []);

  useEffect(() => {
    if (registeredPumps.length === 0) {
      setSelectedSerialId('');
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

  const sendCommand = async (message: string) => {
    if (!selectedSerialId) {
      setError('Select a registered pump first');
      return;
    }

    setSending(true);
    setError('');
    setFeedback('');

    try {
      const response = await apiFetch<{ message?: string }>('/remote/control', {
        method: 'POST',
        body: JSON.stringify({
          pump_id: selectedSerialId,
          message,
        }),
      });

      setFeedback(response.message ?? 'Command sent successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send control command');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Pump Control</h1>
          <p className="text-slate-600">
            Send ON/OFF and speed commands to <span className="font-semibold">esp_hardware</span>.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <p className="flex items-center gap-2">
            <Circle className={`h-3 w-3 ${connected ? 'fill-emerald-500 text-emerald-500' : 'fill-amber-500 text-amber-500'}`} />
            {connected ? 'Realtime Connected' : 'Realtime Disconnected'}
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
            You do not have any registered pumps yet. Register a purchased pump first.
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
        <div className="rounded-xl border border-slate-100 bg-white p-8 shadow-lg">
          <div className="mb-6">
            <label htmlFor="control-pump" className="mb-2 block text-sm font-semibold text-slate-800">
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
                  {pump.name} ({pump.serial_id}) - {pump.capacity.toLocaleString()} L
                </option>
              ))}
            </select>
            {selectedPump && (
              <div className="mt-2 text-sm text-slate-600">
                <span className="font-medium">{selectedPump.name}</span> selected.
                <Link
                  to={`/pumps/${selectedPump._id}`}
                  className="ml-2 text-blue-600 hover:text-blue-700 hover:underline"
                >
                  View telemetry
                </Link>
              </div>
            )}
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => void sendCommand('ON')}
              disabled={sending || !selectedSerialId}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              <Play className="h-4 w-4" />
              Switch ON
            </button>
            <button
              onClick={() => void sendCommand('OFF')}
              disabled={sending || !selectedSerialId}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
            >
              <Square className="h-4 w-4" />
              Switch OFF
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="speed-range" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
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
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Apply Speed
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              Commands are sent as ON, OFF, or SPEED:&lt;0-100&gt; to topic <strong>esp_hardware</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
