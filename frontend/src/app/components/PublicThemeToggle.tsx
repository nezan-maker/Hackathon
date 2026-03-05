import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface PublicThemeToggleProps {
  className?: string;
}

export function PublicThemeToggle({ className = "" }: PublicThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={`relative inline-grid w-36 grid-cols-2 rounded-full border p-1 shadow-lg backdrop-blur transition-colors sm:w-44 ${
        isDark
          ? "border-slate-600/70 bg-slate-900/75 shadow-slate-950/35"
          : "border-slate-200 bg-white/90 shadow-slate-300/40"
      } ${className}`}
    >
      <span
        className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 ${
          isDark
            ? "translate-x-full bg-slate-700/90"
            : "translate-x-0 bg-blue-100"
        }`}
      />

      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-label="Switch to light mode"
        className={`relative z-10 inline-flex items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-3 sm:text-xs ${
          isDark ? "text-slate-300 hover:text-white" : "text-slate-800"
        }`}
      >
        <Sun className="h-3.5 w-3.5" />
        Light
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-label="Switch to dark mode"
        className={`relative z-10 inline-flex items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-3 sm:text-xs ${
          isDark ? "text-white" : "text-slate-700 hover:text-slate-900"
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
        Dark
      </button>
    </div>
  );
}
