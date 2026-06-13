"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function SupporterWorld() {
  const router = useRouter();

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg, #1a0505 0%, #280a0a 50%, #3c0d0d 100%)" }}
    >
      {/* Crowd noise feeling — concentric circles */}
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border pointer-events-none"
          style={{
            width: `${i * 20}vw`,
            height: `${i * 20}vw`,
            borderColor: `rgba(232,168,124,${0.04 - i * 0.007})`,
          }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
        />
      ))}

      <motion.div
        className="flex flex-col items-center gap-6 text-center relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.4em",
            color: "rgba(232,168,124,0.5)",
            fontFamily: "var(--font-inter)",
            fontWeight: 300,
          }}
        >
          LENS ACTIVE — SUPPORTER
        </div>

        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 5rem)",
            letterSpacing: "0.3em",
            color: "#e8a87c",
            fontFamily: "var(--font-inter)",
            fontWeight: 200,
            lineHeight: 1,
          }}
        >
          SUPPORTER
        </h1>

        <div style={{ width: "40px", height: "1px", background: "rgba(232,168,124,0.4)" }} />

        <p
          style={{
            fontSize: "clamp(0.55rem, 0.9vw, 0.75rem)",
            letterSpacing: "0.25em",
            color: "rgba(232,168,124,0.45)",
            fontFamily: "var(--font-inter)",
            fontWeight: 300,
            lineHeight: 2,
          }}
        >
          THE EMOTION. THE DRAMA. THE SOUL.
          <br />
          <span style={{ opacity: 0.5 }}>THIS WORLD IS BEING CONSTRUCTED.</span>
        </p>
      </motion.div>

      <motion.button
        className="absolute bottom-12 text-center"
        style={{
          fontSize: "0.55rem",
          letterSpacing: "0.3em",
          color: "rgba(232,168,124,0.4)",
          background: "none",
          border: "none",
          cursor: "none",
          fontFamily: "var(--font-inter)",
        }}
        onClick={() => router.push("/")}
        whileHover={{ color: "rgba(232,168,124,0.8)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        ← RETURN
      </motion.button>
    </div>
  );
}
