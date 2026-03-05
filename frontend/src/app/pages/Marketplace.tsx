import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Filter,
  Search,
  ShoppingCart,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PublicThemeToggle } from "../components/PublicThemeToggle";
import { PumpLoadingIndicator } from "../components/PumpLoadingIndicator";
import { FlowBotLogo } from "../components/FlowBotLogo";

interface PumpModel {
  id: string;
  name: string;
  capacityLiters: number;
  imageUrl: string;
  priceUsd: number;
}

type SortOption = "price-asc" | "price-desc" | "capacity-desc" | "name-asc";

export function Marketplace() {
  const { isAuthenticated, authInitializing } = useAuth();
  const [pumps, setPumps] = useState<PumpModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [minCapacity, setMinCapacity] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("price-asc");

  useEffect(() => {
    const loadPumps = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch<{
          pumps?: Array<{
            _id: string;
            name: string;
            capacity: number;
            url: string;
            price_usd?: number;
          }>;
        }>("/catalog");

        const mapped = (response.pumps ?? []).map((pump) => ({
          id: pump._id,
          name: pump.name,
          capacityLiters: Number(pump.capacity),
          imageUrl: pump.url,
          priceUsd: Number(pump.price_usd ?? 0),
        }));
        setPumps(mapped);
      } catch (loadError) {
        setPumps([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load marketplace pumps",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadPumps();
  }, []);

  const visiblePumps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minCapacityValue = Number(minCapacity);

    const filtered = pumps.filter((pump) => {
      const matchesQuery =
        !normalizedQuery ||
        pump.name.toLowerCase().includes(normalizedQuery) ||
        String(pump.capacityLiters).includes(normalizedQuery);
      const matchesCapacity =
        !minCapacity ||
        (Number.isFinite(minCapacityValue) &&
          pump.capacityLiters >= minCapacityValue);

      return matchesQuery && matchesCapacity;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "price-asc") return a.priceUsd - b.priceUsd;
      if (sortBy === "price-desc") return b.priceUsd - a.priceUsd;
      if (sortBy === "capacity-desc") return b.capacityLiters - a.capacityLiters;
      return a.name.localeCompare(b.name);
    });
  }, [minCapacity, pumps, query, sortBy]);

  const avgPrice = useMemo(() => {
    if (pumps.length === 0) return 0;
    const total = pumps.reduce((sum, pump) => sum + pump.priceUsd, 0);
    return total / pumps.length;
  }, [pumps]);

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed right-3 top-3 z-50 md:hidden">
        <PublicThemeToggle />
      </div>

      <nav className="border-b border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <FlowBotLogo size="md" showText={false} />
            <span className="hidden text-xl font-semibold text-slate-900 dark:text-white sm:inline">
              FLOWBOT Marketplace
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <PublicThemeToggle className="hidden md:inline-grid" />
            <Link
              to="/"
              className="hidden px-4 py-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:inline-block"
            >
              About FlowBot
            </Link>
            {isAuthenticated ? (
              <Link
                to="/pumps"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-600/30 sm:px-5 sm:py-2.5 sm:text-base"
              >
                My Pumps
              </Link>
            ) : (
              <Link
                to="/register"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-600/30 sm:px-5 sm:py-2.5 sm:text-base"
              >
                Sign Up
              </Link>
            )}
          </div>
        </div>
      </nav>

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-100 via-white to-blue-100 py-16 dark:border-slate-800 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl">
            Pump Marketplace
          </h1>
          <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-300">
            Select a pump model, complete purchase, confirm installation, and
            continue onboarding in FlowBot.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Catalog Pumps
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {pumps.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Visible Results
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {visiblePumps.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Average Price
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                ${avgPrice.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by pump name or capacity"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                value={minCapacity}
                onChange={(event) => setMinCapacity(event.target.value)}
                placeholder="Minimum capacity (L)"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="capacity-desc">Capacity: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {loading && (
          <div className="flex justify-center">
            <PumpLoadingIndicator size="lg" label="Loading marketplace pumps" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && visiblePumps.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-lg font-medium text-slate-900 dark:text-slate-100">
              No pumps match your current filters.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Adjust search and filter values to see more results.
            </p>
          </div>
        )}

        {!loading && !error && visiblePumps.length > 0 && (
          <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 xl:grid-cols-3">
            {visiblePumps.map((pump) => (
              <article
                key={pump.id}
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                  <img
                    src={pump.imageUrl}
                    alt={`${pump.name} pump`}
                    className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>

                <div className="flex flex-1 flex-col">
                  <h3 className="mb-4 text-xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
                    {pump.name}
                  </h3>

                  <dl className="mb-6 space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                      <dt className="text-slate-600 dark:text-slate-300">
                        Capacity
                      </dt>
                      <dd className="font-semibold text-slate-900 dark:text-slate-100">
                        {pump.capacityLiters.toLocaleString()} L
                      </dd>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                      <dt className="text-slate-600 dark:text-slate-300">
                        Price
                      </dt>
                      <dd className="font-semibold text-slate-900 dark:text-slate-100">
                        ${pump.priceUsd.toFixed(2)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto">
                    {authInitializing ? (
                      <button
                        type="button"
                        disabled
                        className="block w-full rounded-lg bg-slate-300 px-6 py-3 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      >
                        <PumpLoadingIndicator
                          size="sm"
                          className="mx-auto"
                          label="Checking session"
                        />
                      </button>
                    ) : isAuthenticated ? (
                      <Link
                        to={`/pumps/${pump.id}/purchase`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-center text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-blue-600/30"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Buy This Pump
                      </Link>
                    ) : (
                      <Link
                        to={`/register?redirect=${encodeURIComponent(`/pumps/${pump.id}/purchase`)}`}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-center text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-blue-600/30"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Sign Up to Buy
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
