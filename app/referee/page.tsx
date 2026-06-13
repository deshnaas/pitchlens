"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function RefereeWorld() {
  const router = useRouter();

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #0d1f3c 100%)" }}
    >
      {/* VAR monitor grid lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(168,196,224,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,196,224,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Scan line */}
      <motion.div
        className="absolute inset-x-0 h-px pointer-events-none"
        style={{ background: "rgba(168,196,224,0.2)" }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
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
            color: "rgba(168,196,224,0.5)",
            fontFamily: "var(--font-inter)",
            fontWeight: 300,
          }}
        >
          LENS ACTIVE — REFEREE
        </div>

        <h1
          style={{
            fontSize: "clamp(2rem, 6vw, 5rem)",
            letterSpacing: "0.3em",
            color: "#a8c4e0",
            fontFamily: "var(--font-inter)",
            fontWeight: 200,
            lineHeight: 1,
          }}
        >
          REFEREE
        </h1>

        <div
          style={{
            width: "40px",
            height: "1px",
            background: "rgba(168,196,224,0.4)",
          }}
        />

        <p
          style={{
            fontSize: "clamp(0.55rem, 0.9vw, 0.75rem)",
            letterSpacing: "0.25em",
            color: "rgba(168,196,224,0.45)",
            fontFamily: "var(--font-inter)",
            fontWeight: 300,
            lineHeight: 2,
          }}
        >
          THE LAWS. THE LOGIC. THE TRUTH.
          <br />
          <span style={{ opacity: 0.5 }}>THIS WORLD IS BEING CONSTRUCTED.</span>
        </p>
      </motion.div>

      <motion.button
        className="absolute bottom-12 text-center"
        style={{
          fontSize: "0.55rem",
          letterSpacing: "0.3em",
          color: "rgba(168,196,224,0.4)",
          background: "none",
          border: "none",
          cursor: "none",
          fontFamily: "var(--font-inter)",
        }}
        onClick={() => router.push("/")}
        whileHover={{ color: "rgba(168,196,224,0.8)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        ← RETURN
      </motion.button>
    </div>
  );
}
