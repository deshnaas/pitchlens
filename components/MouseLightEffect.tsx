"use client";

/**
 * MouseLightEffect — per-phase environmental mouse lighting.
 *
 * Creates the feeling that the world physically responds to the camera.
 * Each phase has different light character:
 *
 *   Phase 0–1 (stadium): warm stadium floodlight — gold, wide, gentle
 *   Phase 2   (descent) : cooler aerial light — blue-white, large radius
 *   Phase 3   (ball)    : concentrated warm glow — ball at center stage
 *   Phase 4   (portals) : no separate light — zones own their atmosphere
 *
 * Implemented as a pure CSS radial-gradient div — zero canvas overhead.
 * Parallax-offset so the light lags slightly behind cursor movement.
 */

interface Props {
  phase    : number;
  mousePos : { x: number; y: number }; // normalized -1..1
}

const PHASE_CONFIG: Record<number, { color: string; radius: string } | null> = {
  0: { color: "rgba(255, 210, 100, 0.055)", radius: "520px" },
  1: { color: "rgba(255, 210, 100, 0.060)", radius: "480px" },
  2: { color: "rgba(190, 215, 255, 0.050)", radius: "560px" },
  3: { color: "rgba(255, 195, 80,  0.075)", radius: "380px" },
  4: null, // portals own their atmosphere
};

export default function MouseLightEffect({ phase, mousePos }: Props) {
  const config = PHASE_CONFIG[Math.min(phase, 4)];
  if (!config) return null;

  // Convert normalized -1..1 to CSS percentage
  const xPct = ((mousePos.x * 0.5 + 0.5) * 100).toFixed(2);
  const yPct = ((mousePos.y * 0.5 + 0.5) * 100).toFixed(2);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex    : 22,
        background: `radial-gradient(circle ${config.radius} at ${xPct}% ${yPct}%, ${config.color}, transparent 70%)`,
        // No transition — must follow mouse in real time via parallax hook's lerp
      }}
    />
  );
}
