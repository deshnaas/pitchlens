"use client";

import { motion } from "framer-motion";

interface TitleRevealProps {
  phase: number; // 0=hidden, 1=ghost, 2=emerging, 3=full
}

export default function TitleReveal({ phase }: TitleRevealProps) {
  const titleChars = "PITCHLENS".split("");

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-50">
      {/* PITCHLENS — character sweep reveal */}
      <motion.div
        className="overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 1 ? 1 : 0 }}
        transition={{ duration: 1.0, ease: "easeOut" }}
      >
        <div
          className="flex items-center justify-center"
          style={{ gap: "0.12em" }}
        >
          {titleChars.map((char, i) => (
            <motion.span
              key={i}
              className="block text-white font-light select-none"
              style={{
                fontSize: "clamp(2.8rem, 7vw, 6.5rem)",
                letterSpacing: "0.32em",
                fontFamily: "var(--font-inter), sans-serif",
                fontWeight: 300,
                textTransform: "uppercase",
                lineHeight: 1,
              }}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={
                phase >= 2
                  ? { opacity: 1, y: 0, filter: "blur(0px)" }
                  : phase >= 1
                  ? { opacity: 0.12, y: 0, filter: "blur(4px)" }
                  : { opacity: 0, y: 18, filter: "blur(8px)" }
              }
              transition={{
                duration: phase >= 2 ? 1.0 : 0.6,
                delay: phase >= 2 ? i * 0.06 : 0,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>
      </motion.div>

      {/* Light sweep overlay on the title */}
      {phase >= 2 && (
        <motion.div
          className="absolute"
          style={{
            width: "clamp(280px, 40vw, 700px)",
            height: "clamp(40px, 8vw, 100px)",
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 1.4, delay: 0.3, ease: "easeInOut" }}
        />
      )}

      {/* ONE MATCH. THREE REALITIES. */}
      <motion.p
        className="text-white text-center select-none mt-5"
        style={{
          fontSize: "clamp(0.6rem, 1.1vw, 1rem)",
          letterSpacing: "0.42em",
          fontWeight: 300,
          fontFamily: "var(--font-inter), sans-serif",
          textTransform: "uppercase",
          opacity: 0,
          lineHeight: 1.6,
        }}
        animate={
          phase >= 3
            ? { opacity: 0.75, y: 0, filter: "blur(0px)" }
            : phase >= 2
            ? { opacity: 0.2, y: 4, filter: "blur(2px)" }
            : { opacity: 0, y: 10, filter: "blur(4px)" }
        }
        transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        ONE MATCH.&nbsp;&nbsp;THREE REALITIES.
      </motion.p>

      {/* Pulse invitation dot — appears last, subtly invites interaction */}
      <motion.div
        className="mt-16 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 3 ? 1 : 0 }}
        transition={{ duration: 1.5, delay: 1.2 }}
      >
        <motion.div
          className="w-px bg-white"
          style={{ height: "40px", opacity: 0.3 }}
          animate={{ scaleY: [0, 1], opacity: [0, 0.3] }}
          transition={{ duration: 1, delay: 1.5, ease: "easeOut" }}
        />
        <motion.span
          className="text-white text-center"
          style={{
            fontSize: "0.55rem",
            letterSpacing: "0.3em",
            fontWeight: 300,
            opacity: 0.4,
          }}
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          CHOOSE YOUR REALITY
        </motion.span>
      </motion.div>
    </div>
  );
}
