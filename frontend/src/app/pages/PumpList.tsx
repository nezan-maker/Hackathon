import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Activity, Search, Filter, ShoppingCart } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

interface BackendPump {
  _id: string;
  name: string;
  serial_id: string;
  capacity: number;
  purchasedAt?: string | null;
  registeredAt?: string | null;
  price_usd?: number;
}

type PumpStatus = 'purchased' | 'registered';

interface Pump {
  id: string;
  name: string;
  serialId: string;
  status: PumpStatus;
  capacity: number;
  priceUsd: number;
}

export function PumpList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string>('');

  const mapPumpStatus = (pump: BackendPump): PumpStatus => {
    return pump.registeredAt ? 'registered' : 'purchased';
  };

  const loadPumps = async () => {
    setLoading(true);
    setFeedback('');
    try {
      const data = await apiFetch<{ pumps?: BackendPump[] }>('/my-pumps');
      const mapped: Pump[] = (data.pumps ?? []).map((pump) => ({
        id: pump._id,
        name: pump.name,
        serialId: pump.serial_id,
        status: mapPumpStatus(pump),
        capacity: pump.capacity,
        priceUsd: Number(pump.price_usd ?? 0),
      }));
      setPumps(mapped);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to load pumps');
      setPumps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPumps();
  }, []);

  const filteredPumps = useMemo(
    () =>
      pumps.filter((pump) => {
        const matchesSearch =
          pump.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          pump.serialId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || pump.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [pumps, searchTerm, statusFilter],
  );

  const getStatusColor = (status: PumpStatus) => {
    switch (status) {
      case 'registered':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200';
      case 'purchased':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-200';
    }
  };

  const handleRegisterOwnedPump = async (serialId: string) => {
    setFeedback('');
    try {
      const response = await apiFetch<{ message?: string }>('/register', {
        method: 'POST',
        body: JSON.stringify({ serial_id: serialId }),
      });
      setFeedback(response.message ?? 'Pump registered');
      await loadPumps();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to register pump');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">My Pumps</h1>
        <p className="text-slate-600">Only pumps purchased by your account are shown here.</p>
      </div>

      {feedback && (
        <div className="mb-4 p-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm">{feedback}</div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 border border-slate-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or product key..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
            >
              <option value="all">All</option>
              <option value="purchased">Purchased (Mine)</option>
              <option value="registered">Registered (Mine)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="hidden lg:block bg-white rounded-xl shadow-lg overflow-hidden border border-slate-100">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-slate-800 to-slate-700">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Pump Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Product Key</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Capacity</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Price</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredPumps.map((pump) => (
              <tr key={pump.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-slate-900 font-medium">{pump.name}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-sm font-medium">{pump.serialId}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(pump.status)}`}>
                    {pump.status === 'registered' && <Activity className="h-4 w-4" />}
                    {pump.status.charAt(0).toUpperCase() + pump.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-medium">{pump.capacity.toLocaleString()} L</td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-medium">${pump.priceUsd.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                  <Link
                    to={`/pumps/${pump.id}`}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium shadow-lg hover:shadow-blue-600/30"
                  >
                    View
                  </Link>

                  {pump.status === 'purchased' && (
                    <button
                      onClick={() => void handleRegisterOwnedPump(pump.serialId)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all font-medium shadow-lg"
                    >
                      Register
                    </button>
                  )}

                  {pump.status === 'registered' && (
                    <span className="inline-flex items-center rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                      Registered
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-4">
          <PumpLoadingIndicator size="md" label="Loading pumps" />
        </div>
      )}

      {filteredPumps.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center border border-slate-100">
          <p className="text-slate-600 font-medium">
            No purchased pumps found for your account.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <ShoppingCart className="h-4 w-4" />
            Buy Pump From Landing Page
          </Link>
        </div>
      )}
    </div>
  );
}
