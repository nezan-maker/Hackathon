import React from "react";

type FlowBotLogoSize = "sm" | "md" | "lg";

interface FlowBotLogoProps {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
  size?: FlowBotLogoSize;
  textClassName?: string;
}

const iconSizeClasses: Record<FlowBotLogoSize, string> = {
  sm: "h-8 w-11",
  md: "h-10 w-14",
  lg: "h-16 w-24",
};

const textSizeClasses: Record<FlowBotLogoSize, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
};

export function FlowBotLogo({
  className = "",
  iconClassName = "",
  showText = true,
  size = "md",
  textClassName = "",
}: FlowBotLogoProps) {
  return (
    <div className={`inline-flex items-center ${className}`.trim()}>
      <div
        className={`relative inline-flex items-center justify-center ${iconSizeClasses[size]} ${iconClassName}`.trim()}
      >
        <svg
          viewBox="0 0 190 130"
          aria-hidden="true"
          className="h-full w-full"
          fill="none"
        >
          <circle
            cx="122"
            cy="14"
            r="12"
            fill="#E7FFFF"
            stroke="#093B49"
            strokeWidth="2.5"
          />
          <path
            d="M4 70C15 92 40 114 70 121C106 129 142 116 171 87C158 95 143 99 123 98C92 96 71 82 46 72C28 65 14 65 4 70Z"
            fill="#F7FBFC"
            stroke="#093B49"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M8 62C18 44 39 33 61 33C88 33 106 48 129 53C145 57 158 54 171 46C160 67 145 83 124 94C96 108 62 107 34 92C21 85 12 75 8 62Z"
            fill="url(#flowbot-wave-main)"
          />
          <path
            d="M23 66C37 55 57 55 77 62C95 69 111 82 131 84C110 96 85 101 63 97C45 94 31 83 23 66Z"
            fill="url(#flowbot-wave-light)"
          />
          <path
            d="M52 49C67 37 87 35 101 45C86 45 74 54 70 66C66 79 75 90 91 95C70 98 52 82 50 62C49 57 49 53 52 49Z"
            fill="#062635"
          />
          <path
            d="M39 72C51 82 69 88 89 88C108 88 125 83 140 73"
            stroke="#D9FFFF"
            strokeWidth="5.5"
            strokeLinecap="round"
            opacity="0.95"
          />
          <defs>
            <linearGradient
              id="flowbot-wave-main"
              x1="20"
              y1="36"
              x2="148"
              y2="102"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#35D8E4" />
              <stop offset="0.45" stopColor="#18BCCA" />
              <stop offset="1" stopColor="#0D7A95" />
            </linearGradient>
            <linearGradient
              id="flowbot-wave-light"
              x1="32"
              y1="60"
              x2="129"
              y2="99"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#E8FEFF" />
              <stop offset="1" stopColor="#A7ECF5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <span
          className={`ml-3 font-black uppercase tracking-[0.18em] ${textSizeClasses[size]} ${textClassName}`.trim()}
        >
          FLOWBOT
        </span>
      )}
    </div>
  );
}
