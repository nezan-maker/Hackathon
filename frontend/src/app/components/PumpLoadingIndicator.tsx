import type { CSSProperties } from "react";
import { PumpAnimatedSvg } from "./PumpAnimatedSvg";

type PumpLoadingIndicatorSize = "sm" | "md" | "lg";

interface PumpLoadingIndicatorProps {
  className?: string;
  label?: string;
  size?: PumpLoadingIndicatorSize;
}

const sizeClasses: Record<PumpLoadingIndicatorSize, string> = {
  sm: "pump-inline-svg-sm",
  md: "pump-inline-svg-md",
  lg: "pump-inline-svg-lg",
};

export function PumpLoadingIndicator({
  className,
  label = "Loading",
  size = "md",
}: PumpLoadingIndicatorProps) {
  const style = { "--pump-cycle": "0.9s" } as CSSProperties;
  const rootClassName = ["pump-inline-loader", className].filter(Boolean).join(" ");

  return (
    <span className={rootClassName} style={style} role="status" aria-live="polite" aria-label={label}>
      <PumpAnimatedSvg className={`pump-inline-svg ${sizeClasses[size]}`} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
