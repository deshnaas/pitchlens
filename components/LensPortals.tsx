"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

interface LensPortalsProps {
  visible: boolean;
  onHoverChange: (lens: "referee" | "fan" | "supporter" | null) => void;
}

const LENSES = [
  {
    id: "referee" as const,
    label: "REFEREE",
    subtitle: "The Laws. The Logic. The Truth.",
    color: "#a8c4e0",
    glowColor: "rgba(168, 196, 224, 0.15)",
    borderColor: "rgba(168, 196, 224, 0.35)",
    route: "/referee",
    symbol: "⚖",
    delay: 0,
  },
  {
    id: "fan" as const,
    label: "NEW FAN",
    subtitle: "The Game. The Rules. The Story.",
    color: "#7ecfa0",
    glowColor: "rgba(126, 207, 160, 0.15)",
    borderColor: "rgba(126, 207, 160, 0.35)",
    route: "/fan",
    symbol: "◎",
    delay: 0.12,
  },
  {
    id: "supporter" as const,
    label: "SUPPORTER",
    subtitle: "The Emotion. The Drama. The Soul.",
    color: "#e8a87c",
    glowColor: "rgba(232, 168, 124, 0.15)",
    borderColor: "rgba(232, 168, 124, 0.35)",
    route: "/supporter",
    symbol: "♦",
    delay: 0.24,
  },
];

export default function LensPortals({ visible, onHoverChange }: LensPortalsProps) {
  const [hoveredLens, setHoveredLens] = useState<"referee" | "fan" | "supporter" | null>(null);
  const [selectedLens, setSelectedLens] = useState<string | null>(null);
  const router = useRouter();

  const handleHover = (id: "referee" | "fan" | "supporter" | null) => {
    setHoveredLens(id);
    onHoverChange(id);
  };

  const handleSelect = (lens: typeof LENSES[0]) => {
    setSelectedLens(lens.id);
    setTimeout(() => {
      router.push(lens.route);
    }, 800);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 flex items-end justify-center z-50 pointer-events-none"
          style={{ paddingBottom: "8vh" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex items-end justify-center gap-6 md:gap-10 pointer-events-auto w-full px-8 max-w-5xl mx-auto">
            {LENSES.map((lens) => {
              const isHovered = hoveredLens === lens.id;
              const isSelected = selectedLens === lens.id;
              const isDimmed = hoveredLens !== null && !isHovered;

              return (
                <motion.div
                  key={lens.id}
                  className="relative flex flex-col items-center select-none"
                  style={{ flex: 1, maxWidth: "280px" }}
                  initial={{ opacity: 0, y: 40, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 1.0,
                    delay: lens.delay,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  onMouseEnter={() => handleHover(lens.id)}
                  onMouseLeave={() => handleHover(null)}
                  onClick={() => handleSelect(lens)}
                >
                  {/* Portal container */}
                  <motion.div
                    className="relative w-full flex flex-col items-center"
                    animate={{
                      opacity: isDimmed ? 0.35 : 1,
                      y: isHovered ? -8 : 0,
                      scale: isSelected ? 1.08 : isHovered ? 1.03 : 1,
                    }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ cursor: "none" }}
                  >
                    {/* Glow backdrop */}
                    <motion.div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      animate={{
                        backgroundColor: isHovered ? lens.glowColor : "transparent",
                        boxShadow: isHovered
                          ? `0 0 60px 20px ${lens.glowColor}, 0 0 120px 40px ${lens.glowColor}`
                          : "none",
                      }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      style={{ filter: "blur(2px)", borderRadius: "16px" }}
                    />

                    {/* Portal border */}
                    <motion.div
                      className="relative w-full rounded-2xl overflow-hidden"
                      style={{
                        border: `1px solid`,
                        borderColor: isHovered ? lens.borderColor : "rgba(255,255,255,0.08)",
                        padding: "clamp(18px, 3vw, 32px) clamp(16px, 2.5vw, 28px)",
                        backdropFilter: "blur(1px)",
                        transition: "border-color 0.4s ease",
                      }}
                    >
                      {/* Symbol */}
                      <motion.div
                        className="text-center mb-4"
                        animate={{
                          color: isHovered ? lens.color : "rgba(255,255,255,0.25)",
                          scale: isHovered ? 1.2 : 1,
                        }}
                        transition={{ duration: 0.4 }}
                        style={{ fontSize: "clamp(1rem, 2vw, 1.5rem)" }}
                      >
                        {lens.symbol}
                      </motion.div>

                      {/* Thin divider line that grows on hover */}
                      <motion.div
                        className="mx-auto mb-5"
                        style={{ height: "1px", backgroundColor: lens.color }}
                        animate={{ width: isHovered ? "60%" : "20%", opacity: isHovered ? 0.7 : 0.2 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />

                      {/* Label */}
                      <motion.h2
                        className="text-center font-light"
                        style={{
                          fontFamily: "var(--font-inter), sans-serif",
                          fontSize: "clamp(0.65rem, 1.2vw, 0.9rem)",
                          letterSpacing: "0.38em",
                          textTransform: "uppercase",
                          lineHeight: 1,
                          color: isHovered ? lens.color : "rgba(255,255,255,0.8)",
                          transition: "color 0.4s ease",
                          fontWeight: 300,
                        }}
                      >
                        {lens.label}
                      </motion.h2>

                      {/* Subtitle — fades in on hover */}
                      <motion.p
                        className="text-center mt-3"
                        style={{
                          fontFamily: "var(--font-inter), sans-serif",
                          fontSize: "clamp(0.5rem, 0.75vw, 0.65rem)",
                          letterSpacing: "0.15em",
                          color: "rgba(255,255,255,0.5)",
                          lineHeight: 1.5,
                          fontWeight: 300,
                        }}
                        animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 4 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        {lens.subtitle}
                      </motion.p>

                      {/* Enter arrow */}
                      <motion.div
                        className="flex justify-center mt-4"
                        animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 6 }}
                        transition={{ duration: 0.35, delay: 0.05 }}
                      >
                        <span
                          style={{
                            fontSize: "0.55rem",
                            letterSpacing: "0.25em",
                            color: lens.color,
                            fontWeight: 300,
                          }}
                        >
                          ENTER →
                        </span>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
