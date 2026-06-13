"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * TitleReveal — V3
 *
 * Phase-driven. Framer Motion handles transitions.
 * Title is PERMANENT — never disappears. Apple model.
 *
 * titlePhase 0 → invisible (black intro)
 * titlePhase 1 → ghost (barely there, chars blurred — v1 playing)
 * titlePhase 2 → emerging (staggered char blur-in — v2 playing)
 * titlePhase 3 → full prominence + subtitle (v3 / v4 playing)
 * titlePhase 4 → portal mode: shrinks, rises to top, still visible
 */

interface Props {
  titlePhase: number;
  parallax: { x: number; y: number };
}

const CHARS = "PITCHLENS".split("");

export default function TitleReveal({ titlePhase, parallax }: Props) {
  const inPortalMode = titlePhase >= 4;

  // Subtle parallax on title
  const px = parallax.x * -3;
  const py = parallax.y * -2.5;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 50 }}
    >
      {/* ── Master wrapper: handles shrink + rise in portal mode ── */}
      <motion.div
        style={{ x: px, transformOrigin: "center center" }}
        animate={{
          scale  : inPortalMode ? 0.44 : 1,
          y      : inPortalMode ? "-36vh" : py,
          opacity: inPortalMode ? 0.62 : titlePhase >= 1 ? 1 : 0,
        }}
        transition={{
          duration: inPortalMode ? 1.1 : 0.7,
          ease    : [0.16, 1, 0.3, 1],
        }}
        className="flex flex-col items-center"
      >

        {/* ── PITCHLENS characters ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.1em" }}>
          {CHARS.map((char, i) => (
            <motion.span
              key={i}
              className="select-none"
              style={{
                display    : "inline-block",
                fontSize   : "clamp(2.6rem, 6.5vw, 6rem)",
                letterSpacing: "0.34em",
                fontFamily : "var(--font-inter), sans-serif",
                fontWeight : 300,
                color      : "white",
                lineHeight : 1,
              }}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={
                titlePhase >= 2
                  ? { opacity: 1,    y: 0, filter: "blur(0px)" }
                  : titlePhase >= 1
                  ? { opacity: 0.12, y: 0, filter: "blur(4px)" }
                  : { opacity: 0,    y: 18, filter: "blur(8px)" }
              }
              transition={{
                duration: titlePhase >= 2 ? 1.0 : 0.7,
                delay   : titlePhase >= 2 ? i * 0.07 : 0,
                ease    : [0.16, 1, 0.3, 1],
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* ── Light sweep — fires once on full reveal ── */}
        {titlePhase === 2 && (
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top   : 0,
              left  : "-10%",
              width : "120%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.06) 60%, transparent 100%)",
            }}
            initial={{ x: "-120%" }}
            animate={{ x: "120%" }}
            transition={{ duration: 1.4, delay: 0.5, ease: "easeInOut" }}
          />
        )}

        {/* ── ONE MATCH. THREE REALITIES. ── */}
        <motion.p
          className="text-white text-center select-none"
          style={{
            fontSize     : "clamp(0.55rem, 1vw, 0.85rem)",
            letterSpacing: "0.44em",
            fontWeight   : 300,
            fontFamily   : "var(--font-inter), sans-serif",
            textTransform: "uppercase",
            lineHeight   : 1.6,
            marginTop    : "1rem",
          }}
          animate={
            titlePhase >= 3
              ? { opacity: 0.72, y: 0,  filter: "blur(0px)" }
              : titlePhase >= 2
              ? { opacity: 0.2,  y: 4,  filter: "blur(2px)" }
              : { opacity: 0,    y: 10, filter: "blur(4px)" }
          }
          transition={{ duration: 1.1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          ONE MATCH.&nbsp;&nbsp;&nbsp;THREE REALITIES.
        </motion.p>
      </motion.div>

      {/* ── Scroll to begin hint — only phase 0-1, gone once journey starts ── */}
      <AnimatePresence>
        {titlePhase <= 1 && (
          <motion.div
            className="absolute flex flex-col items-center gap-2 pointer-events-none"
            style={{ bottom: "7vh" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
          >
            <span
              style={{
                fontSize     : "0.5rem",
                letterSpacing: "0.3em",
                color        : "rgba(255,255,255,0.38)",
                fontFamily   : "var(--font-inter)",
                fontWeight   : 300,
                textTransform: "uppercase",
              }}
            >
              Scroll to experience
            </span>
            <motion.div
              style={{
                width     : "1px",
                height    : "30px",
                background: "linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)",
              }}
              animate={{ scaleY: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
