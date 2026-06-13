"use client";

import { motion } from "framer-motion";

interface EnvironmentOverlayProps {
  lensHover: "referee" | "fan" | "supporter" | null;
  phase: number;
}

const LENS_TINTS = {
  referee: "rgba(30, 60, 120, 0.25)",
  fan:      "rgba(20, 80, 40,  0.20)",
  supporter:"rgba(120, 40, 20, 0.22)",
};

export default function EnvironmentOverlay({ lensHover, phase }: EnvironmentOverlayProps) {
  const tint = lensHover ? LENS_TINTS[lensHover] : "transparent";

  return (
    <>
      {/* Persistent vignette — top & bottom cinematic bars feel */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.70) 100%)",
        }}
      />

      {/* Left & right edge darkening */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0.35) 0%, transparent 12%, transparent 88%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Lens environment color tint */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-21"
        animate={{ backgroundColor: tint }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />

      {/* Cinematic letterbox feel — very subtle dark bars top/bottom */}
      <div
        className="absolute inset-x-0 top-0 h-[4vh] pointer-events-none z-22"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[4vh] pointer-events-none z-22"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
      />

      {/* Film grain */}
      <div className="film-grain absolute inset-0 pointer-events-none z-30" />

      {/* Phase 0–1: extra dark fade-in from black */}
      <motion.div
        className="absolute inset-0 bg-black pointer-events-none z-40"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase >= 1 ? 0 : 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </>
  );
}
