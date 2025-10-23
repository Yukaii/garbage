export function Logo({ className = "", size = 120, color = "currentColor" }: { className?: string; size?: number; color?: string }) {
  const strokeWidth = 4; // Fixed stroke width to match favicon

  return (
    <svg
      width={size}
      height={size}
      viewBox="20 20 65 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Garbage truck outline */}
      {/* Truck cabin */}
      <path
        d="M30 70L30 52L42 52L42 45L50 45L50 52L42 52"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Truck container */}
      <rect
        x="42"
        y="52"
        width="28"
        height="18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Wheels */}
      <circle
        cx="38"
        cy="70"
        r="5"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <circle
        cx="62"
        cy="70"
        r="5"
        stroke={color}
        strokeWidth={strokeWidth}
      />

      {/* Location pin */}
      <path
        d="M80 32C80 28.134 76.866 25 73 25C69.134 25 66 28.134 66 32C66 34.5 70 42 73 46C76 42 80 34.5 80 32Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="73"
        cy="32"
        r="2"
        fill={color}
      />

      {/* Connection line */}
      <path
        d="M73 46L73 52"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray="2 2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LogoWithText({ size = 120, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <Logo size={size} color={color} />
      <div className="text-center">
        <h1>TrackBin</h1>
        <p className="text-muted-foreground">Fleet Location Tracker</p>
      </div>
    </div>
  );
}
