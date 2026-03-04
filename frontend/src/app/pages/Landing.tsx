import React from "react";
import { Link } from "react-router";
import { useEffect, useState } from "react";
import {
  Droplets,
  Activity,
  Shield,
  BarChart3,
  Smartphone,
} from "lucide-react";
import { API_URL } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PublicThemeToggle } from "../components/PublicThemeToggle";
import { PumpLoadingIndicator } from "../components/PumpLoadingIndicator";

interface PumpModel {
  id: string;
  name: string;
  capacity: string;
  imageUrl: string;
  priceUsd: number;
}

export function Landing() {
  const { isAuthenticated, authInitializing } = useAuth();
  const [pumpModels, setPumpModels] = useState<PumpModel[]>([]);
  const [loadingPumps, setLoadingPumps] = useState(false);

  const features = [
    {
      icon: Activity,
      title: "Real-time Monitoring",
      description: "Monitor pressure, flow rate, and temperature in real-time",
    },
    {
      icon: Shield,
      title: "Smart Alerts",
      description: "Get instant notifications for critical system events",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Visualize performance trends and optimize operations",
    },
    {
      icon: Smartphone,
      title: "Remote Control",
      description: "Start, stop, and control pumps from anywhere",
    },
  ];

  useEffect(() => {
    const fetchPumps = async () => {
      setLoadingPumps(true);
      try {
        const res = await fetch(`${API_URL}/catalog`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load pumps");
        }

        const data = (await res.json()) as {
          pumps?: Array<{
            _id: string;
            name: string;
            capacity: number;
            url: string;
            price_usd?: number;
          }>;
        };
        const pumps = (data.pumps ?? []).map((pump) => ({
          id: pump._id,
          name: pump.name,
          capacity: `${pump.capacity.toLocaleString()} L`,
          imageUrl: pump.url,
          priceUsd: Number(pump.price_usd ?? 0),
        }));

        setPumpModels(pumps);
      } catch {
        setPumpModels([]);
      } finally {
        setLoadingPumps(false);
      }
    };

    fetchPumps();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed right-3 top-3 z-50 md:hidden">
        <PublicThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                <Droplets className="h-6 w-6 text-white" />
              </div>
              <span className="ml-3 text-xl font-semibold text-slate-900 dark:text-white">
                FlowBot
              </span>
            </div>
            <div className="flex items-center gap-4">
              <PublicThemeToggle className="hidden md:inline-grid" />
              <Link
                to="/login"
                className="px-5 py-2.5 text-slate-600 hover:text-slate-900 transition-colors dark:text-slate-300 dark:hover:text-white"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-600/30"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-100 via-white to-blue-100 relative overflow-hidden dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
        <div className="absolute inset-0 bg-grid-slate-900/[0.03] bg-[size:60px_60px] dark:bg-grid-white/[0.02]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative">
          <div className="text-center">
            <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
              Smart Pump Management <br />
              Made Simple
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              Monitor, control, and optimize your water pump systems with
              real-time insights and intelligent automation.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                to="/register"
                className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-lg font-medium shadow-xl hover:shadow-blue-600/30 hover:scale-105"
              >
                Start Free Trial
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-lg hover:bg-slate-100 transition-all text-lg font-medium dark:bg-white/10 dark:backdrop-blur-sm dark:text-white dark:border-white/20 dark:hover:bg-white/20"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h2 className="text-4xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">
          Powerful Features for Complete Control
        </h2>
        <p className="text-center text-slate-600 dark:text-slate-300 mb-16 text-lg">
          Everything you need to manage your pump systems efficiently
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-4 shadow-lg group-hover:shadow-blue-600/30 transition-all group-hover:scale-110">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pump Models Section */}
      <div className="bg-slate-50 py-24 dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">
            Our Pump Models
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-300 mb-16 text-lg">
            Admin-registered pumps from catalog with Cloudinary-hosted images
          </p>

          {loadingPumps && (
            <div className="flex justify-center">
              <PumpLoadingIndicator
                size="lg"
                label="Loading pumps from database"
              />
            </div>
          )}

          {!loadingPumps && pumpModels.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-400">
              No admin catalog pumps found yet.
            </p>
          )}

          {!loadingPumps && pumpModels.length > 0 && (
            <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 xl:grid-cols-3">
              {pumpModels.map((pump) => (
                <article
                  key={pump.id}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="relative mb-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[4/3] dark:border-slate-700 dark:bg-slate-800">
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
                          {pump.capacity}
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
                          className="block w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-center text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-blue-600/30"
                        >
                          Buy This Pump
                        </Link>
                      ) : (
                        <Link
                          to={`/register?redirect=${encodeURIComponent(`/pumps/${pump.id}/purchase`)}`}
                          className="block w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 text-center text-white shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-blue-600/30"
                        >
                          Buy
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-slate-100 via-blue-100 to-slate-100 py-20 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
            Join thousands of businesses already using FlowBot to optimize their
            operations.
          </p>
          <Link
            to="/register"
            className="inline-block px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-lg font-medium shadow-xl hover:shadow-blue-600/30 hover:scale-105"
          >
            Create Free Account
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-100 py-12 text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <Droplets className="h-6 w-6 text-white" />
            </div>
            <span className="ml-3 text-xl font-semibold text-slate-900 dark:text-white">
              FlowBot
            </span>
          </div>
          <p>&copy; 2026 FlowBot. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
