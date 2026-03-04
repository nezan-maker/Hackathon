import { ResolvedTheme } from "../context/ThemeContext";

export interface ChartPalette {
  grid: string;
  axis: string;
  axisText: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipLabel: string;
  pressure: string;
  flow: string;
  flowFillStart: string;
  flowFillEnd: string;
  temperature: string;
  speed: string;
  critical: string;
  warning: string;
}

export const getChartPalette = (theme: ResolvedTheme): ChartPalette =>
  theme === "dark"
    ? {
        grid: "#2b4570",
        axis: "#33527f",
        axisText: "#cbdaf2",
        tooltipBg: "#0f2749",
        tooltipBorder: "#31598e",
        tooltipText: "#e6efff",
        tooltipLabel: "#f4f8ff",
        pressure: "#60a5fa",
        flow: "#34d399",
        flowFillStart: "rgba(52, 211, 153, 0.45)",
        flowFillEnd: "rgba(52, 211, 153, 0.08)",
        temperature: "#fb923c",
        speed: "#a78bfa",
        critical: "#f87171",
        warning: "#fbbf24",
      }
    : {
        grid: "#dbe4f0",
        axis: "#b8c5d9",
        axisText: "#475569",
        tooltipBg: "#ffffff",
        tooltipBorder: "#d0d9e6",
        tooltipText: "#0f172a",
        tooltipLabel: "#1e293b",
        pressure: "#2563eb",
        flow: "#0f766e",
        flowFillStart: "rgba(20, 184, 166, 0.35)",
        flowFillEnd: "rgba(20, 184, 166, 0.06)",
        temperature: "#ea580c",
        speed: "#7c3aed",
        critical: "#dc2626",
        warning: "#d97706",
      };
