"use client";

/**
 * ProgressBar — phase-based.
 * Fills from left to right as the cinematic journey advances.
 * 4 phases → 4 equal segments.
 * 1px tall — silent, unobtrusive, cinematic.
 */

interface Props {
  phase: number; // 0–4
}

export default function ProgressBar({ phase }: Props) {
  // Smooth progress: each phase = 25% of the bar
  const pct = Math.min(100, (phase / 4) * 100);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{
        zIndex    : 60,
        height    : "1px",
        background: "rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          height    : "100%",
          width     : `${pct}%`,
          background: "rgba(255,255,255,0.30)",
          transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
}
