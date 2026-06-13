"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface Props {
  visible      : boolean;
  onHoverChange: (lens: "referee" | "fan" | "supporter" | null) => void;
}

const ZONES = [
  {
    id        : "referee"   as const,
    label     : "REFEREE POV",
    descriptor: "Experience the match through the laws of the game.",
    route     : "/referee",
    color     : [168, 196, 224] as [number, number, number],
    delay     : 0,
    // Geometry: thin horizontal rule lines — VAR / offside analysis
    Geometry  : () => (
      <svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0 }}>
        <line x1="10" y1="28"  x2="190" y2="28"  stroke="rgba(168,196,224,0.55)" strokeWidth="0.5"/>
        <line x1="10" y1="48"  x2="190" y2="48"  stroke="rgba(168,196,224,0.38)" strokeWidth="0.5"/>
        <line x1="10" y1="68"  x2="190" y2="68"  stroke="rgba(168,196,224,0.28)" strokeWidth="0.5"/>
        <line x1="10" y1="88"  x2="190" y2="88"  stroke="rgba(168,196,224,0.18)" strokeWidth="0.5"/>
        <line x1="62"  y1="10" x2="62"  y2="110" stroke="rgba(168,196,224,0.45)" strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1="138" y1="10" x2="138" y2="110" stroke="rgba(168,196,224,0.3)"  strokeWidth="0.5" strokeDasharray="3 3"/>
      </svg>
    ),
  },
  {
    id        : "fan"       as const,
    label     : "NEW FAN",
    descriptor: "Learn football through every moment.",
    route     : "/fan",
    color     : [126, 207, 160] as [number, number, number],
    delay     : 0.12,
    // Geometry: concentric circles — pitch center circle
    Geometry  : () => (
      <svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0 }}>
        <circle cx="100" cy="60" r="30"  fill="none" stroke="rgba(126,207,160,0.55)" strokeWidth="0.6"/>
        <circle cx="100" cy="60" r="52"  fill="none" stroke="rgba(126,207,160,0.32)" strokeWidth="0.5"/>
        <circle cx="100" cy="60" r="72"  fill="none" stroke="rgba(126,207,160,0.18)" strokeWidth="0.4"/>
        <circle cx="100" cy="60" r="4.5" fill="rgba(126,207,160,0.6)"/>
      </svg>
    ),
  },
  {
    id        : "supporter" as const,
    label     : "TEAM SUPPORTER",
    descriptor: "Feel every decision through the heart of your club.",
    route     : "/supporter",
    color     : [232, 168, 124] as [number, number, number],
    delay     : 0.24,
    // Geometry: diagonal energy streaks — crowd flare trails
    Geometry  : () => (
      <svg width="100%" height="100%" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0 }}>
        <line x1="20"  y1="115" x2="90"  y2="5"   stroke="rgba(232,168,124,0.55)" strokeWidth="0.7"/>
        <line x1="52"  y1="115" x2="115" y2="5"   stroke="rgba(232,168,124,0.38)" strokeWidth="0.5"/>
        <line x1="90"  y1="115" x2="155" y2="5"   stroke="rgba(232,168,124,0.45)" strokeWidth="0.6"/>
        <line x1="130" y1="115" x2="190" y2="10"  stroke="rgba(232,168,124,0.22)" strokeWidth="0.4"/>
        <line x1="5"   y1="85"  x2="55"  y2="15"  stroke="rgba(232,168,124,0.18)" strokeWidth="0.4"/>
      </svg>
    ),
  },
];

export default function LensPortals({ visible, onHoverChange }: Props) {
  const [hovered,  setHovered]  = useState<"referee" | "fan" | "supporter" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();

  const handleHover = (id: "referee" | "fan" | "supporter" | null) => {
    setHovered(id);
    onHoverChange(id);
  };

  const handleClick = (zone: typeof ZONES[0]) => {
    setSelected(zone.id);
    setTimeout(() => router.push(zone.route), 680);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-x-0 bottom-0 flex"
          style={{ height: "48vh", zIndex: 50 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {ZONES.map((zone, idx) => {
            const isHov  = hovered === zone.id;
            const isDim  = hovered !== null && !isHov;
            const isSel  = selected === zone.id;
            const [r, g, b] = zone.color;

            return (
              <motion.div
                key={zone.id}
                onClick={() => handleClick(zone)}
                onMouseEnter={() => handleHover(zone.id)}
                onMouseLeave={() => handleHover(null)}
                className="relative flex flex-col justify-end overflow-hidden"
                style={{
                  cursor    : "none",
                  borderLeft: idx > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  flexGrow  : isHov ? 1.5 : isDim ? 0.75 : 1,
                  transition: "flex-grow 0.55s cubic-bezier(0.16,1,0.3,1)",
                }}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                transition={{
                  duration: 0.9,
                  delay   : zone.delay,
                  ease    : [0.16, 1, 0.3, 1],
                }}
              >
                {/* ── Atmospheric fog rising from bottom ── */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 pointer-events-none"
                  animate={{
                    height         : isHov ? "100%" : "62%",
                    backgroundColor: `rgba(${r},${g},${b},0)`,
                  }}
                  style={{
                    background: `linear-gradient(to top, rgba(${r},${g},${b},${isHov ? 0.42 : isDim ? 0.04 : 0.09}) 0%, rgba(${r},${g},${b},${isHov ? 0.22 : 0.04}) 35%, transparent 100%)`,
                    transition: "height 0.6s cubic-bezier(0.16,1,0.3,1), background 0.5s ease",
                  }}
                />

                {/* ── Geometric hover element (SVG lines/shapes) ── */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    bottom : "22%",
                    left   : "8%",
                    right  : "8%",
                    height : "44%",
                    opacity: isHov ? 0.9 : 0,
                    transition: "opacity 0.45s ease",
                  }}
                >
                  <zone.Geometry />
                </div>

                {/* ── Dim overlay for non-hovered zones ── */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: isDim ? 0.55 : 0 }}
                  transition={{ duration: 0.35 }}
                  style={{ backgroundColor: "rgba(0,0,0,0.1)" }}
                />

                {/* ── Content: label + descriptor ── */}
                <motion.div
                  className="relative text-center"
                  style={{
                    padding      : "0 clamp(12px, 2.5vw, 28px)",
                    paddingBottom: "clamp(18px, 3.5vh, 36px)",
                  }}
                  animate={{
                    y      : isHov ? -8 : 0,
                    opacity: isDim ? 0.35 : 1,
                    scale  : isSel ? 1.06 : 1,
                  }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Accent line */}
                  <motion.div
                    className="mx-auto"
                    style={{
                      height         : "1px",
                      marginBottom   : "14px",
                      backgroundColor: `rgba(${r},${g},${b},1)`,
                    }}
                    animate={{
                      width  : isHov ? "55%" : "20px",
                      opacity: isHov ? 0.75 : 0.25,
                    }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />

                  {/* LENS NAME — large, crystal clear */}
                  <motion.h2
                    className="select-none m-0"
                    style={{
                      fontFamily   : "var(--font-inter), sans-serif",
                      fontWeight   : 300,
                      textTransform: "uppercase",
                      lineHeight   : 1,
                      fontSize     : "clamp(1rem, 1.9vw, 1.65rem)",
                      letterSpacing: "0.26em",
                    }}
                    animate={{ color: isHov ? `rgb(${r},${g},${b})` : "rgba(255,255,255,0.88)" }}
                    transition={{ duration: 0.4 }}
                  >
                    {zone.label}
                  </motion.h2>

                  {/* Descriptor — always legible, explains the reality */}
                  <motion.p
                    className="select-none mx-auto"
                    style={{
                      fontFamily   : "var(--font-inter), sans-serif",
                      fontWeight   : 300,
                      fontSize     : "clamp(0.48rem, 0.72vw, 0.62rem)",
                      letterSpacing: "0.09em",
                      lineHeight   : 1.5,
                      maxWidth     : "200px",
                      marginTop    : "9px",
                    }}
                    animate={{
                      opacity: isHov ? 0.75 : 0.35,
                      color  : isHov ? `rgba(${r},${g},${b},0.85)` : "rgba(255,255,255,0.5)",
                      y      : isHov ? 0 : 3,
                    }}
                    transition={{ duration: 0.38, ease: "easeOut" }}
                  >
                    {zone.descriptor}
                  </motion.p>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
