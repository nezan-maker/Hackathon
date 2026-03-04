interface PumpAnimatedSvgProps {
  className?: string;
}

export function PumpAnimatedSvg({ className }: PumpAnimatedSvgProps) {
  return (
    <svg
      viewBox="0 0 240 150"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect className="pump-loader-shadow" x="40" y="112" width="162" height="18" rx="9" />
      <rect className="pump-loader-metal" x="48" y="86" width="146" height="30" rx="10" />
      <rect className="pump-loader-metal" x="88" y="56" width="66" height="36" rx="8" />
      <rect className="pump-loader-piston" x="118" y="68" width="48" height="10" rx="5" />
      <circle className="pump-loader-accent" cx="96" cy="73" r="7" />
      <g className="pump-loader-handle">
        <rect className="pump-loader-metal" x="93" y="22" width="8" height="44" rx="4" />
        <rect className="pump-loader-accent" x="74" y="16" width="48" height="10" rx="5" />
        <circle className="pump-loader-accent" cx="97" cy="61" r="6" />
      </g>
      <path className="pump-loader-flow" d="M166 72 C197 72 210 88 210 111" />
      <path
        className="pump-loader-drop"
        d="M210 111 C216 120 219 124 219 129 C219 134 215 138 210 138 C205 138 201 134 201 129 C201 124 204 120 210 111 Z"
      />
    </svg>
  );
}
