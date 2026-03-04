import type { CSSProperties } from "react";
import { usePendingPromiseCount } from "../hooks/usePendingPromiseCount";
import { PumpAnimatedSvg } from "./PumpAnimatedSvg";

export function PumpPromiseLoader() {
  const pendingPromiseCount = usePendingPromiseCount();
  const isDashboardRoute =
    typeof window !== "undefined" &&
    /^\/(?:dashboard|admin)(?:\/|$)/.test(window.location.pathname);

  if (pendingPromiseCount === 0 || !isDashboardRoute) {
    return null;
  }

  const cycleSeconds = Math.max(0.35, 1.1 / Math.min(5, pendingPromiseCount));
  const style = { "--pump-cycle": `${cycleSeconds}s` } as CSSProperties;

  return (
    <div
      className="pump-loader-overlay pump-loader-overlay-fullscreen"
      style={style}
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard data"
    >
      <PumpAnimatedSvg className="pump-loader-svg pump-loader-svg-focus" />
    </div>
  );
}
