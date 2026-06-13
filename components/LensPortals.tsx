"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  progress: number;
  onHoverChange: (lens: "referee" | "fan" | "supporter" | null) => void;
}

// Smooth 0-1 clamp + remap
function remap(p: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (p - inMin) / (inMax - inMin)));
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return outMin + e * (outMax - outMin);
}

const ZONES = [
  {
    id:        "referee" as const,
    label:     "REFEREE",
    descriptor:"See every decision through the laws of the game",
    route:     "/referee",
    color:     [168, 196, 224] as [number, number, number],
    // Referee: thin horizontal rule lines — like offside geometry
    Geometry:  () => (
      <svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
        <line x1="10" y1="30"  x2="190" y2="30"  stroke="rgba(168,196,224,0.6)" strokeWidth="0.5"/>
        <line x1="10" y1="50"  x2="190" y2="50"  stroke="rgba(168,196,224,0.4)" strokeWidth="0.5"/>
        <line x1="10" y1="70"  x2="190" y2="70"  stroke="rgba(168,196,224,0.3)" strokeWidth="0.5"/>
        <line x1="10" y1="90"  x2="190" y2="90"  stroke="rgba(168,196,224,0.2)" strokeWidth="0.5"/>
        {/* VAR measurement line */}
        <line x1="60" y1="15" x2="60" y2="105" stroke="rgba(168,196,224,0.5)" strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1="140" y1="15" x2="140" y2="105" stroke="rgba(168,196,224,0.3)" strokeWidth="0.5" strokeDasharray="3 3"/>
      </svg>
    ),
  },
  {
    id:        "fan" as const,
    label:     "NEW FAN",
    descriptor:"Learn the beautiful game from the first whistle",
    route:     "/fan",
    color:     [126, 207, 160] as [number, number, number],
    // New Fan: concentric arc — pitch center circle
    Geometry:  () => (
      <svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <circle cx="100" cy="60" r="35" fill="none" stroke="rgba(126,207,160,0.5)" strokeWidth="0.6"/>
        <circle cx="100" cy="60" r="55" fill="none" stroke="rgba(126,207,160,0.3)" strokeWidth="0.5"/>
        <circle cx="100" cy="60" r="72" fill="none" stroke="rgba(126,207,160,0.18)" strokeWidth="0.4"/>
        <circle cx="100" cy="60" r="4"  fill="rgba(126,207,160,0.6)"/>
      </svg>
    ),
  },
  {
    id:        "supporter" as const,
    label:     "SUPPORTER",
    descriptor:"Feel the match through pure passion and emotion",
    route:     "/supporter",
    color:     [232, 168, 124] as [number, number, number],
    // Supporter: diagonal energy streaks — crowd flare trails
    Geometry:  () => (
      <svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <line x1="20"  y1="110" x2="90"  y2="10"  stroke="rgba(232,168,124,0.55)" strokeWidth="0.7"/>
        <line x1="50"  y1="115" x2="110" y2="5"   stroke="rgba(232,168,124,0.35)" strokeWidth="0.5"/>
        <line x1="90"  y1="115" x2="150" y2="5"   stroke="rgba(232,168,124,0.45)" strokeWidth="0.6"/>
        <line x1="130" y1="115" x2="190" y2="10"  stroke="rgba(232,168,124,0.25)" strokeWidth="0.4"/>
        <line x1="5"   y1="80"  x2="60"  y2="20"  stroke="rgba(232,168,124,0.2)"  strokeWidth="0.4"/>
      </svg>
    ),
  },
];

export default function LensPortals({ progress, onHoverChange }: Props) {
  const [hovered, setHovered] = useState<"referee" | "fan" | "supporter" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();

  // Portals enter at progress 0.72 → 0.92
  const entryProgress = remap(progress, 0.72, 0.92, 0, 1);
  const isVisible = progress >= 0.72;

  const handleHover = (id: "referee" | "fan" | "supporter" | null) => {
    setHovered(id);
    onHoverChange(id);
  };

  const handleClick = (zone: typeof ZONES[0]) => {
    setSelected(zone.id);
    setTimeout(() => router.push(zone.route), 700);
  };

  if (!isVisible) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 flex"
      style={{
        height: "48vh",
        zIndex: 50,
        opacity: entryProgress,
      }}
    >
      {ZONES.map((zone, idx) => {
        const isHov = hovered === zone.id;
        const isDim = hovered !== null && !isHov;
        const isSel = selected === zone.id;

        const [r, g, b] = zone.color;

        // Width flex — hovered zone expands, others compress
        const flexGrow = isHov ? 1.5 : isDim ? 0.75 : 1;

        // Entry animation — each zone slides up with stagger
        const entryDelay = idx * 0.08;
        const zoneEntry = remap(progress, 0.72 + entryDelay, 0.88 + entryDelay, 0, 1);
        const zoneY = (1 - zoneEntry) * 40;

        // Fog intensity
        const fogOpacity = isHov ? 0.45 : isDim ? 0.04 : 0.1;
        const fogHeight = isHov ? "100%" : "65%";

        // Label visual state
        const labelOpacity = isDim ? 0.3 : 1;
        const labelColor = isHov ? `rgb(${r},${g},${b})` : "rgba(255,255,255,0.88)";
        const labelScale = isHov ? 1.04 : isSel ? 1.08 : 1;

        return (
          <div
            key={zone.id}
            onClick={() => handleClick(zone)}
            onMouseEnter={() => handleHover(zone.id)}
            onMouseLeave={() => handleHover(null)}
            style={{
              flex: flexGrow,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              cursor: "none",
              transform: `translateY(${zoneY}px)`,
              opacity: labelOpacity,
              transition: "flex 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.4s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)",
              borderLeft: idx > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              overflow: "hidden",
            }}
          >
            {/* Atmospheric fog — rises from bottom */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: fogHeight,
                background: `linear-gradient(to top, rgba(${r},${g},${b},${fogOpacity}) 0%, rgba(${r},${g},${b},${fogOpacity * 0.5}) 40%, transparent 100%)`,
                transition: "height 0.6s cubic-bezier(0.16,1,0.3,1), background 0.5s ease",
                pointerEvents: "none",
              }}
            />

            {/* Geometric element — visible on hover */}
            <div
              style={{
                position: "absolute",
                bottom: "18%",
                left: "10%",
                right: "10%",
                height: "45%",
                opacity: isHov ? 1 : 0,
                transition: "opacity 0.5s ease",
                pointerEvents: "none",
              }}
            >
              <zone.Geometry />
            </div>

            {/* Content — label + descriptor */}
            <div
              style={{
                position: "relative",
                padding: "0 clamp(16px, 3vw, 32px)",
                paddingBottom: "clamp(20px, 4vh, 40px)",
                textAlign: "center",
                transform: `scale(${labelScale}) translateY(${isHov ? -6 : 0}px)`,
                transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              {/* Thin accent line above label */}
              <div
                style={{
                  width: isHov ? "50%" : "24px",
                  height: "1px",
                  background: `rgba(${r},${g},${b},${isHov ? 0.8 : 0.3})`,
                  margin: "0 auto 16px",
                  transition: "width 0.5s cubic-bezier(0.16,1,0.3,1), background 0.4s ease",
                }}
              />

              {/* LENS NAME — large, immediately readable */}
              <h2
                style={{
                  fontSize: "clamp(1rem, 2vw, 1.7rem)",
                  letterSpacing: "0.28em",
                  fontWeight: 300,
                  fontFamily: "var(--font-inter), sans-serif",
                  textTransform: "uppercase",
                  color: labelColor,
                  lineHeight: 1,
                  transition: "color 0.4s ease",
                  userSelect: "none",
                  margin: 0,
                }}
              >
                {zone.label}
              </h2>

              {/* Descriptor — always visible, explains the reality */}
              <p
                style={{
                  fontSize: "clamp(0.5rem, 0.75vw, 0.65rem)",
                  letterSpacing: "0.1em",
                  fontWeight: 300,
                  fontFamily: "var(--font-inter), sans-serif",
                  color: `rgba(${r},${g},${b},${isHov ? 0.75 : 0.35})`,
                  lineHeight: 1.5,
                  marginTop: "10px",
                  opacity: isHov ? 1 : 0.6,
                  transform: `translateY(${isHov ? 0 : 4}px)`,
                  transition: "opacity 0.4s ease, transform 0.4s ease, color 0.4s ease",
                  userSelect: "none",
                  maxWidth: "220px",
                  margin: "10px auto 0",
                }}
              >
                {zone.descriptor}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
