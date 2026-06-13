"use client";

import { motion } from "framer-motion";

type Lens = "referee" | "fan" | "supporter" | null;

interface Props {
  lensHover: Lens;
  phase    : number; // 0–4
}

const LENS_TINTS: Record<NonNullable<Lens>, string> = {
  referee  : "rgba(18,  48, 115, 0.28)",
  fan      : "rgba(12,  68,  32, 0.24)",
  supporter: "rgba(115, 28,  12, 0.27)",
};

export default function EnvironmentOverlay({ lensHover, phase }: Props) {
  const tint = lensHover ? LENS_TINTS[lensHover] : "transparent";

  return (
    <>
      {/* Top / bottom cinematic vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex    : 20,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* Left / right edge darkening */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex    : 20,
          background: "linear-gradient(to right, rgba(0,0,0,0.30) 0%, transparent 14%, transparent 86%, rgba(0,0,0,0.30) 100%)",
        }}
      />

      {/* Lens environment tint */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 21 }}
        animate={{ backgroundColor: tint }}
        transition={{ duration: 0.75, ease: "easeInOut" }}
      />

      {/* Film grain */}
      <div
        className="film-grain absolute inset-0 pointer-events-none"
        style={{ zIndex: 30 }}
      />

      {/* Opening black fade — CSS animation, independent of phase */}
      <div
        className="absolute inset-0 bg-black pointer-events-none"
        style={{
          zIndex   : 40,
          animation: "fadeFromBlack 1.1s ease-out 0.15s forwards",
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
