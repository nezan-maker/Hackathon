import React from "react";
import { Link } from "react-router";
import {
  Activity,
  BarChart3,
  Droplets,
  Shield,
  Smartphone,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PublicThemeToggle } from "../components/PublicThemeToggle";
import { FlowBotLogo } from "../components/FlowBotLogo";
import { PublicFooter } from "../components/PublicFooter";

export function Landing() {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: Activity,
      title: "Live Monitoring",
      description:
        "Track pressure, flow, temperature, and speed from one dashboard in real time.",
    },
    {
      icon: Shield,
      title: "Alert Intelligence",
      description:
        "Receive instant operational alerts and route issues before they become downtime.",
    },
    {
      icon: Smartphone,
      title: "Remote Operations",
      description:
        "Operate registered pumps remotely once installation and approvals are complete.",
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      description:
        "Review telemetry patterns across your pumps to optimize usage and maintenance.",
    },
  ];

  const processSteps = [
    {
      icon: Droplets,
      title: "Choose a Pump",
      description: "Browse available pumps from the public marketplace catalog.",
    },
    {
      icon: Workflow,
      title: "Purchase and Confirm",
      description:
        "Complete checkout and confirm installation from the confirmation email.",
    },
    {
      icon: Wrench,
      title: "Admin Approval",
      description:
        "Admin reviews and approves installation status for compliance and safety.",
    },
    {
      icon: Zap,
      title: "Register and Operate",
      description:
        "Register the approved pump and start remote control and telemetry analysis.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed right-3 top-3 z-50 md:hidden">
        <PublicThemeToggle />
      </div>

      <nav className="border-b border-slate-200 bg-white/95 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <FlowBotLogo
            size="md"
            textClassName="text-slate-900 dark:text-white"
          />
          <div className="flex items-center gap-2 sm:gap-4">
            <PublicThemeToggle className="hidden md:inline-grid" />
            <Link
              to="/marketplace"
              className="hidden px-4 py-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:inline-block"
            >
              Marketplace
            </Link>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-600/30 sm:px-5 sm:py-2.5 sm:text-base"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden px-4 py-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:inline-block"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-600/30 sm:px-5 sm:py-2.5 sm:text-base"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-100 via-white to-blue-100 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.15),_transparent_50%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-200">
              Industrial Pump Operations Platform
            </p>
            <h1 className="mb-6 text-4xl font-bold leading-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              Control Pumps With Data, Not Guesswork
            </h1>
            <p className="mb-8 text-lg text-slate-600 dark:text-slate-300">
              FlowBot centralizes marketplace purchase, installation workflow,
              registration, telemetry, alerts, and remote control into one
              reliable platform.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/marketplace"
                className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-xl transition-all hover:bg-blue-700 hover:shadow-blue-600/30 sm:px-7 sm:text-lg"
              >
                Explore Marketplace
              </Link>
              <Link
                to={isAuthenticated ? "/dashboard" : "/register"}
                className="rounded-lg border-2 border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-900 transition-all hover:bg-slate-100 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 sm:px-7 sm:text-lg"
              >
                {isAuthenticated ? "Open Dashboard" : "Create Account"}
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
            <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-white">
              Why Teams Use FlowBot
            </h2>
            <ul className="space-y-4 text-slate-700 dark:text-slate-300">
              <li className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                Unified lifecycle from pump selection to production telemetry.
              </li>
              <li className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                User confirmation plus admin verification before operation.
              </li>
              <li className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                Clear ownership controls for purchase, registration, and access.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
      >
        <h2 className="mb-4 text-center text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
          Platform Capabilities
        </h2>
        <p className="mb-16 text-center text-lg text-slate-600 dark:text-slate-300">
          Built for operations teams that need dependable control and visibility.
        </p>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="bg-slate-50 py-24 dark:bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-4 text-center text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
            How FlowBot Works
          </h2>
          <p className="mb-16 text-center text-lg text-slate-600 dark:text-slate-300">
            Clear operational path from purchase to live remote operation.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {processSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                    Step {index + 1}
                  </p>
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="get-started"
        className="bg-gradient-to-r from-slate-100 via-blue-100 to-slate-100 py-20 dark:from-slate-900 dark:via-blue-900 dark:to-slate-900"
      >
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-6 text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Start With the Pump Marketplace
          </h2>
          <p className="mb-8 text-xl text-slate-600 dark:text-slate-300">
            Browse available pumps, purchase securely, and run the full FlowBot
            onboarding workflow.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/marketplace"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-xl transition-all hover:bg-blue-700 hover:shadow-blue-600/30 sm:px-8 sm:py-4 sm:text-lg"
            >
              Open Marketplace
            </Link>
            {!isAuthenticated && (
              <Link
                to="/register"
                className="rounded-lg border-2 border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-900 transition-all hover:bg-slate-100 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 sm:px-8 sm:py-4 sm:text-lg"
              >
                Create Account
              </Link>
            )}
          </div>
        </div>
      </section>

      <PublicFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}
