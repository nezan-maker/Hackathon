import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle, AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PumpLoadingIndicator } from "../components/PumpLoadingIndicator";

interface BackendPump {
  _id: string;
  name: string;
  serial_id: string;
  capacity: number;
  userId?: string | null;
  purchasedAt?: string | null;
  registeredAt?: string | null;
}

export function RegisterPump() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const serialIdFromQuery = (searchParams.get("serial_id") || "").trim();

  const [pumps, setPumps] = useState<BackendPump[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serialId, setSerialId] = useState("");
  const [querySerialApplied, setQuerySerialApplied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string>("");

  const ownedPurchasedUnregistered = useMemo(
    () =>
      pumps.filter(
        (pump) =>
          user?.id &&
          pump.userId &&
          String(pump.userId) === String(user.id) &&
          !!pump.purchasedAt &&
          !pump.registeredAt,
      ),
    [pumps, user?.id],
  );

  const loadPumps = async () => {
    setLoadingPumps(true);
    try {
      const data = await apiFetch<{ pumps?: BackendPump[] }>("/my-pumps");
      setPumps(data.pumps ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pumps");
      setPumps([]);
    } finally {
      setLoadingPumps(false);
    }
  };

  useEffect(() => {
    void loadPumps();
  }, []);

  useEffect(() => {
    if (querySerialApplied) return;
    if (serialIdFromQuery) {
      setSerialId(serialIdFromQuery);
    }
    setQuerySerialApplied(true);
  }, [querySerialApplied, serialIdFromQuery]);

  useEffect(() => {
    if (!serialId && ownedPurchasedUnregistered.length > 0) {
      setSerialId(ownedPurchasedUnregistered[0].serial_id);
    }
  }, [ownedPurchasedUnregistered, serialId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const normalizedSerialId = serialId.trim();
    if (!normalizedSerialId) {
      setError("Product key is required");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<{ message?: string }>("/register", {
        method: "POST",
        body: JSON.stringify({ serial_id: normalizedSerialId }),
      });

      setSuccess(response.message ?? "Pump registered successfully");
      await loadPumps();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register pump");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">
            Register Purchased Pump
          </h1>
          <p className="text-slate-600">
            Only pumps purchased by your account can be registered.
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-8 shadow-lg">
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
              <p className="font-medium text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              <p className="font-medium text-emerald-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-800">
                Eligible Pumps
              </p>
              {loadingPumps ? (
                <PumpLoadingIndicator
                  size="sm"
                  label="Loading your purchased pumps"
                />
              ) : (
                <p className="text-sm text-slate-600">
                  {`You have ${ownedPurchasedUnregistered.length} purchased pump(s) ready for registration.`}
                </p>
              )}
            </div>

            {ownedPurchasedUnregistered.length > 0 && (
              <div>
                <label
                  htmlFor="ownedPumps"
                  className="mb-2 block text-sm font-bold text-slate-900"
                >
                  Select Purchased Pump
                </label>
                <select
                  id="ownedPumps"
                  value={serialId}
                  onChange={(e) => setSerialId(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 font-medium focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {ownedPurchasedUnregistered.map((pump) => (
                    <option key={pump._id} value={pump.serial_id}>
                      {pump.name} ({pump.serial_id}) -{" "}
                      {pump.capacity.toLocaleString()} L
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="serialId"
                className="mb-2 block text-sm font-bold text-slate-900"
              >
                Product Key
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="serialId"
                  type="text"
                  value={serialId}
                  onChange={(e) => setSerialId(e.target.value)}
                  placeholder="Enter purchased pump product key"
                  className="block w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 font-medium focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="flex items-start gap-2 text-sm text-blue-800">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                Registration will fail if this product key was not purchased by
                your account.
              </p>
            </div>

            {ownedPurchasedUnregistered.length === 0 && !loadingPumps && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
                <p className="mb-3 text-sm font-medium text-sky-800">
                  You do not have a purchased pump pending registration.
                </p>
                <Link
                  to="/"
                  className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
                >
                  Go to Landing Page
                </Link>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate("/pumps")}
                className="flex-1 rounded-lg border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-blue-600/30 disabled:cursor-not-allowed disabled:from-blue-400 disabled:to-blue-400"
              >
                {loading ? (
                  <PumpLoadingIndicator size="sm" label="Registering pump" />
                ) : (
                  <span>Register Pump</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
