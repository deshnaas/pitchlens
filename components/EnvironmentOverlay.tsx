"use client";

type Lens = "referee" | "fan" | "supporter" | null;

interface Props {
  lensHover: Lens;
  progress: number;
}

const LENS_TINTS: Record<NonNullable<Lens>, string> = {
  referee:  "rgba(20,  50, 110, 0.28)",
  fan:      "rgba(15,  70,  35, 0.24)",
  supporter:"rgba(110, 30,  15, 0.26)",
};

// Smooth remap
function remap(p: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (p - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

export default function EnvironmentOverlay({ lensHover, progress }: Props) {
  const tint = lensHover ? LENS_TINTS[lensHover] : "transparent";

  // Initial black fade: 1 → 0 over first 0.8s of load time
  // We use a CSS transition on a black div driven by a simple mounted class
  const initialFadeOpacity = progress > 0.005 ? 0 : 1; // snaps away once user scrolls

  return (
    <>
      {/* Top/bottom cinematic vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 20,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* Left/right edge darkening */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 20,
          background:
            "linear-gradient(to right, rgba(0,0,0,0.3) 0%, transparent 14%, transparent 86%, rgba(0,0,0,0.3) 100%)",
        }}
      />

      {/* Lens environment tint — transitions smoothly on hover change */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 21,
          backgroundColor: tint,
          transition: "background-color 0.75s ease",
        }}
      />

      {/* Film grain */}
      <div
        className="film-grain absolute inset-0 pointer-events-none"
        style={{ zIndex: 30 }}
      />

      {/* Initial black fade — dissolves immediately on first scroll interaction */}
      <div
        className="absolute inset-0 bg-black pointer-events-none"
        style={{
          zIndex: 40,
          opacity: initialFadeOpacity,
          transition: initialFadeOpacity === 0 ? "opacity 1.0s ease" : "none",
        }}
      />

      {/* Page-load black: CSS animation, fades out in 1.2s regardless of scroll */}
      <div
        className="absolute inset-0 bg-black pointer-events-none"
        style={{
          zIndex: 41,
          animation: "fadeFromBlack 1.2s ease-out 0.2s forwards",
        }}
      />

      <style>{`
        @keyframes fadeFromBlack {
          from { opacity: 1; }
          to   { opacity: 0; pointer-events: none; }
        }
      `}</style>
    </>
  );
}
