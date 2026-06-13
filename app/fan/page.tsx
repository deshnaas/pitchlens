"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function FanWorld() {
  const router = useRouter();

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg, #051209 0%, #071a0e 50%, #0a2415 100%)" }}
    >
      {/* Pitch lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(126,207,160,0.8) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        className="flex flex-col items-center gap-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.4em",
            color: "rgba(126,207,160,0.5)",
            fontFamily: "var(--font-inter)",
            fontWeight: 300,
          }}
        >
          LENS ACTIVE — NEW FAN
        </div>

        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 5rem)",
            letterSpacing: "0.3em",
            color: "#7ecfa0",
            fontFamily: "var(--font-inter)",
            fontWeight: 200,
            lineHeight: 1,
          }}
        >
          NEW FAN
        </h1>

        <div
          style={{
            width: "40px",
            height: "1px",
            background: "rgba(126,207,160,0.4)",
          }}
        />

        <p
          style={{
            fontSize: "clamp(0.55rem, 0.9vw, 0.75rem)",
            letterSpacing: "0.25em",
            color: "rgba(126,207,160,0.45)",
            fontFamily: "var(--font-inter)",
            fontWeight: 300,
            lineHeight: 2,
          }}
        >
          THE GAME. THE RULES. THE STORY.
          <br />
          <span style={{ opacity: 0.5 }}>THIS WORLD IS BEING CONSTRUCTED.</span>
        </p>
      </motion.div>

      <motion.button
        className="absolute bottom-12 text-center"
        style={{
          fontSize: "0.55rem",
          letterSpacing: "0.3em",
          color: "rgba(126,207,160,0.4)",
          background: "none",
          border: "none",
          cursor: "none",
          fontFamily: "var(--font-inter)",
        }}
        onClick={() => router.push("/")}
        whileHover={{ color: "rgba(126,207,160,0.8)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        ← RETURN
      </motion.button>
    </div>
  );
}
