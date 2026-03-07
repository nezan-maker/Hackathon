import React from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Clock3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { FlowBotLogo } from "./FlowBotLogo";

interface PublicFooterProps {
  isAuthenticated: boolean;
}

const workflowSteps = [
  "Browse verified pump models from the marketplace",
  "Confirm installation with user and admin approvals",
  "Monitor telemetry, alerts, and operations in one workspace",
];

export function PublicFooter({ isAuthenticated }: PublicFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-100/80 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <section className="relative mb-12 overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-white via-blue-50 to-slate-100 p-6 shadow-xl dark:border-blue-800/60 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/50 sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.16),_transparent_55%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.7fr_1fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Operations Confidence
              </p>
              <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
                Run your pump lifecycle with clear controls and traceability.
              </h2>
              <p className="max-w-2xl text-slate-600 dark:text-slate-300">
                FlowBot connects marketplace purchase, installation
                verification, telemetry, and remote control so teams can move
                from setup to daily operations faster.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to={isAuthenticated ? "/dashboard" : "/register"}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-blue-700"
              >
                {isAuthenticated
                  ? "Open Operations Dashboard"
                  : "Create Account"}
              </Link>
              <Link
                to="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Browse Marketplace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-b border-slate-300 pb-10 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <FlowBotLogo
              size="md"
              textClassName="text-slate-900 dark:text-white"
            />
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Industrial operations platform for pump purchase, onboarding,
              monitoring, and secure remote control.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-medium dark:border-slate-700 dark:bg-slate-900">
                Live telemetry
              </span>
              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-medium dark:border-slate-700 dark:bg-slate-900">
                Role-aware access
              </span>
              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 font-medium dark:border-slate-700 dark:bg-slate-900">
                Approval workflow
              </span>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Navigation
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="transition-colors hover:text-blue-600">
                  Landing
                </Link>
              </li>
              <li>
                <Link
                  to="/#capabilities"
                  className="transition-colors hover:text-blue-600"
                >
                  Platform Capabilities
                </Link>
              </li>
              <li>
                <Link
                  to="/#workflow"
                  className="transition-colors hover:text-blue-600"
                >
                  Workflow Steps
                </Link>
              </li>
              <li>
                <Link
                  to="/marketplace"
                  className="transition-colors hover:text-blue-600"
                >
                  Marketplace
                </Link>
              </li>
              <li>
                <Link
                  to={isAuthenticated ? "/pumps" : "/login"}
                  className="transition-colors hover:text-blue-600"
                >
                  {isAuthenticated ? "My Pumps" : "Sign In"}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Standard Process
            </h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {workflowSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
              Contact and Support
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <a
                  href="mailto:nielneza10@gmail.com"
                  className="transition-colors hover:text-blue-600"
                >
                  nielneza10@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <a
                  href="tel:+250795652826"
                  className="transition-colors hover:text-blue-600"
                >
                  +250 795 652 826
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <span>Support hours: Mon-Fri, 8:00-18:00 UTC</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <span>Local operations support hub</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="pt-5 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p>&copy; {year} FlowBot. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="mailto:nielneza10@gmail.com?subject=Privacy%20Inquiry"
                className="transition-colors hover:text-blue-600"
              >
                Privacy
              </a>
              <a
                href="mailto:nielneza10@gmail.com?subject=Terms%20Request"
                className="transition-colors hover:text-blue-600"
              >
                Terms
              </a>
              <a
                href="mailto:nielneza10@gmail.com?subject=Security%20Question"
                className="transition-colors hover:text-blue-600"
              >
                Security
              </a>
            </div>
          </div>
        </section>
      </div>
    </footer>
  );
}
