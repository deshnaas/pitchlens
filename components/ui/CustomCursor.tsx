"use client";

// Global custom cursor — replaces the system cursor (hidden in globals.css).
// Dot: follows mouse exactly.
// Ring: follows with a spring lag; tints to the hovered card's team color.

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const mX = useMotionValue(-200);
  const mY = useMotionValue(-200);

  const spring = { stiffness: 180, damping: 20, mass: 0.7 };
  const rX = useSpring(mX, spring);
  const rY = useSpring(mY, spring);

  useEffect(() => {
    const move = (e: MouseEvent) => { mX.set(e.clientX); mY.set(e.clientY); };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [mX, mY]);

  return (
    <>
      {/* Precision dot — exact mouse position */}
      <motion.div
        className="cursor-dot"
        style={{ left: mX, top: mY, position: "fixed", pointerEvents: "none", zIndex: 9999 }}
      />
      {/* Ring — trails behind with spring, tints to match hovered element */}
      <motion.div
        className="cursor-ring"
        style={{
          left: rX, top: rY,
          position: "fixed", pointerEvents: "none", zIndex: 9998,
          borderColor: "var(--cursor-accent, rgba(255,255,255,0.38))",
          transition: "border-color 0.35s ease, width 0.25s ease, height 0.25s ease",
        }}
      />
    </>
  );
}
