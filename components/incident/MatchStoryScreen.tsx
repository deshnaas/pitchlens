"use client";

// PitchLens — Match Story Screen
// Same structure. Same content. Cinematic motion layer added throughout.
// Left: match narrative with title reveal, progressive paragraphs, parallax drift.
// Right: timeline with drawing spine, pulsing nodes, staggered chapters, click portal.

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { TEAM_REGISTRY } from "@/lib/matchData";
import type { MatchMeta } from "@/lib/matchData";

export type KeyMoment = {
  id: string;
  minute: number;
  type: "goal" | "substitution" | "card" | "incident";
  team: string;
  icon: string;
  title: string;
  context: string;
};

interface Props {
  matchId: string;
  meta: MatchMeta;
  moments: KeyMoment[];
  narrative: string;
  onMomentSelect: (moment: KeyMoment) => void;
  onBack: () => void;
}

// ─── Easing presets ────────────────────────────────────────────────────────────
const EASE_OUT  = [0.16, 1, 0.3, 1] as const;
const EASE_EXPO = [0.22, 1, 0.36, 1] as const;

export default function MatchStoryScreen({
  matchId, meta, moments, narrative, onMomentSelect, onBack,
}: Props) {
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [clickingId, setClickingId] = useState<string | null>(null);
  const [spineReady, setSpineReady] = useState(false);

  const homeColor = meta.home.color;
  const awayColor = meta.away.color;

  // Spine draws after cards begin entering
  useEffect(() => {
    const t = setTimeout(() => setSpineReady(true), 380);
    return () => clearTimeout(t);
  }, []);

  // Parallax mouse drift on left panel
  const mX = useMotionValue(0);
  const mY = useMotionValue(0);
  const springConfig = { stiffness: 40, damping: 18, mass: 1.2 };
  const panelX = useSpring(useTransform(mX, [0, 1], [-6, 6]),  springConfig);
  const panelY = useSpring(useTransform(mY, [0, 1], [-4, 4]),  springConfig);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mX.set(e.clientX / window.innerWidth);
      mY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [mX, mY]);

  // Momentum split for the match flow bar
  const homeEvents = moments.filter(m => m.team === meta.home.name).length;
  const total      = Math.max(moments.length, 1);
  const homePct    = Math.round((homeEvents / total) * 100);

  // Click-to-investigate — portal flash then navigate
  const handleClick = useCallback((moment: KeyMoment) => {
    if (clickingId) return;
    setClickingId(moment.id);
    setTimeout(() => onMomentSelect(moment), 520);
  }, [clickingId, onMomentSelect]);

  const paragraphs = narrative.split("\n\n").filter(Boolean);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: "#04080f", fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      {/* Top edge accent — draws in */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-px z-40"
        style={{ background: `linear-gradient(90deg,transparent,${homeColor}90,${awayColor}90,transparent)` }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 1.1, delay: 0.1, ease: EASE_EXPO }}
      />

      {/* Click portal overlay — expands from centre on investigation entry */}
      <AnimatePresence>
        {clickingId && (
          <motion.div
            key="portal"
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: [0, 0.55, 0.1], scale: [0.2, 1.6, 3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE_EXPO }}
            style={{
              position: "fixed", inset: 0, zIndex: 100, pointerEvents: "none",
              background: "radial-gradient(ellipse at center, rgba(0,180,255,0.18) 0%, transparent 65%)",
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.div
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6"
        style={{ height: 54, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(4,8,15,0.96)", backdropFilter: "blur(8px)" }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE_OUT }}
      >
        <motion.button
          onClick={onBack}
          style={{ color: "rgba(255,255,255,0.32)", cursor: "none", background: "none", border: "none", fontFamily: "inherit" }}
          whileHover={{ color: "rgba(255,255,255,0.78)" }}
        >
          <span style={{ fontSize: "0.58rem", letterSpacing: "0.2em" }}>← ALL MATCHES</span>
        </motion.button>

        <div className="flex items-center gap-4">
          <GradCode code={meta.home.code} color={homeColor} />
          <div className="text-center">
            <div style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 800, letterSpacing: "0.1em" }}>{meta.headline}</div>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.5rem", letterSpacing: "0.2em" }}>{meta.stage} · {meta.date}</div>
          </div>
          <GradCode code={meta.away.code} color={awayColor} />
        </div>

        <div style={{ fontSize: "0.55rem", letterSpacing: "0.22em", color: "rgba(0,212,255,0.35)" }}>PITCHLENS</div>
      </motion.div>

      {/* ── Two-column body ── */}
      <div className="absolute" style={{ top: 54, left: 0, right: 0, bottom: 0, display: "flex" }}>

        {/* ════ LEFT 38%: Match Narrative ════ */}
        <motion.div
          className="flex flex-col overflow-y-auto"
          style={{
            width: "38%",
            borderRight: "1px solid rgba(255,255,255,0.07)",
            padding: "40px 36px",
            scrollbarWidth: "none",
            background: "rgba(0,0,0,0.28)",
            x: panelX,
            y: panelY,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* "THE STORY" label — fade in */}
          <motion.div
            style={{ fontSize: "0.48rem", letterSpacing: "0.32em", color: "rgba(255,255,255,0.22)", marginBottom: 14 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            THE STORY
          </motion.div>

          {/* Headline — clip-path wipe left→right */}
          <div style={{ overflow: "hidden", marginBottom: 6 }}>
            <motion.h1
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.6rem)",
                fontWeight: 900, color: "#fff",
                lineHeight: 1.05, letterSpacing: "0.02em",
              }}
              initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0.4 }}
              animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1 }}
              transition={{ duration: 0.85, delay: 0.3, ease: EASE_EXPO }}
            >
              {meta.headline}
            </motion.h1>
          </div>

          {/* Sub-headline wipe */}
          <div style={{ overflow: "hidden", marginBottom: 20 }}>
            <motion.div
              style={{ fontSize: "0.8rem", fontWeight: 400, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)" }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.55, ease: EASE_OUT }}
            >
              {meta.subline}
            </motion.div>
          </div>

          {/* Teams strip */}
          <motion.div
            className="flex items-center gap-3 mb-8"
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.65, ease: EASE_OUT }}
          >
            <div style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.1em", color: homeColor }}>
              {meta.home.name}
            </div>
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem" }}>vs</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.1em", color: awayColor }}>
              {meta.away.name}
            </div>
          </motion.div>

          {/* Narrative paragraphs — progressive reveal */}
          {paragraphs.map((para, i) => (
            <motion.p
              key={i}
              style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.78, marginBottom: 18, letterSpacing: "0.01em" }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 + i * 0.14, ease: EASE_OUT }}
            >
              {para}
            </motion.p>
          ))}

          {/* Venue + date footer */}
          <motion.div
            style={{ marginTop: "auto", paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 + paragraphs.length * 0.1 }}
          >
            <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em" }}>{meta.venue}</div>
            <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em", marginTop: 4 }}>{meta.date} · FIFA WORLD CUP QATAR 2022</div>
          </motion.div>
        </motion.div>

        {/* ════ RIGHT 62%: Key Moments Timeline ════ */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{ flex: 1, padding: "32px 40px 40px", scrollbarWidth: "none" }}
        >
          {/* Section header */}
          <motion.div
            style={{ marginBottom: 24 }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: EASE_OUT }}
          >
            <div style={{ fontSize: "0.48rem", letterSpacing: "0.36em", color: "rgba(255,255,255,0.2)", marginBottom: 7 }}>
              KEY MOMENTS
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", letterSpacing: "0.03em" }}>
              Click a moment to investigate it.
            </div>
          </motion.div>

          {/* ── Match Flow Bar ── */}
          <MatchFlowBar
            homeColor={homeColor}
            awayColor={awayColor}
            homeCode={meta.home.code}
            awayCode={meta.away.code}
            homePct={homePct}
          />

          {/* ── Timeline ── */}
          <div style={{ position: "relative", marginTop: 24 }}>

            {/* Spine — draws itself downward */}
            <div style={{
              position: "absolute", left: 28, top: 0, bottom: 0, width: 1,
              background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.08) 8%, rgba(255,255,255,0.08) 92%, transparent)`,
              overflow: "hidden",
            }}>
              <motion.div
                style={{ position: "absolute", inset: 0, transformOrigin: "top center" }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: spineReady ? 1 : 0 }}
                transition={{ duration: 1.4, ease: EASE_EXPO }}
              >
                <div style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(to bottom, ${homeColor}55, ${awayColor}55)`,
                }} />
              </motion.div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {moments.map((moment, i) => {
                const isHov     = hoveredId === moment.id;
                const isClicking = clickingId === moment.id;
                const teamColor = TEAM_REGISTRY[moment.team]?.color ?? "#00d4ff";
                const isGoal    = moment.type === "goal";

                return (
                  <motion.div
                    key={moment.id}
                    initial={{ opacity: 0, x: 28, filter: "blur(5px)" }}
                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.55, delay: 0.2 + i * 0.08, ease: EASE_OUT }}
                  >
                    <div style={{ position: "relative", paddingLeft: 58 }}>

                      {/* Pulse ring on timeline node */}
                      <motion.div
                        style={{
                          position: "absolute", left: 28 - 10, top: 22 - 10,
                          width: 20, height: 20, borderRadius: "50%",
                          border: `1px solid ${teamColor}`,
                          pointerEvents: "none",
                        }}
                        animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{
                          duration: 2.6, repeat: Infinity,
                          delay: 0.4 + i * 0.35, ease: "easeOut",
                        }}
                      />

                      {/* Node dot */}
                      <motion.div
                        style={{
                          position: "absolute",
                          left: 22,
                          top: 22,
                          width: isGoal ? 14 : 10,
                          height: isGoal ? 14 : 10,
                          marginLeft: isGoal ? -2 : 0,
                          marginTop: isGoal ? -2 : 0,
                          borderRadius: "50%",
                          background: (isHov || isClicking) ? teamColor : `${teamColor}88`,
                          border: `1px solid ${teamColor}`,
                          zIndex: 2,
                        }}
                        animate={{
                          boxShadow: isHov || isClicking
                            ? [`0 0 0px ${teamColor}`, `0 0 16px ${teamColor}bb`, `0 0 6px ${teamColor}88`]
                            : `0 0 0px transparent`,
                        }}
                        transition={{ duration: 0.5 }}
                      />

                      {/* Event card */}
                      <motion.button
                        onClick={() => handleClick(moment)}
                        onHoverStart={() => setHoveredId(moment.id)}
                        onHoverEnd={() => setHoveredId(null)}
                        style={{
                          display: "flex", flexDirection: "column", width: "100%",
                          padding: 0, background: "none", border: "none",
                          cursor: "none", textAlign: "left", fontFamily: "inherit",
                        }}
                        animate={{
                          y: isHov ? -3 : 0,
                          scale: isClicking ? 1.025 : 1,
                        }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                      >
                        <motion.div
                          animate={{
                            background: isClicking
                              ? `linear-gradient(135deg, ${teamColor}38 0%, rgba(4,8,22,0.96) 100%)`
                              : isHov
                              ? `linear-gradient(135deg, ${teamColor}1a 0%, rgba(4,8,22,0.9) 100%)`
                              : "rgba(4,8,22,0.55)",
                            borderColor: isClicking
                              ? `${teamColor}88`
                              : isHov
                              ? `${teamColor}44`
                              : "rgba(255,255,255,0.07)",
                          }}
                          transition={{ duration: 0.22 }}
                          style={{
                            borderRadius: 4,
                            border: "1px solid rgba(255,255,255,0.07)",
                            overflow: "hidden",
                            backdropFilter: "blur(8px)",
                            boxShadow: isHov
                              ? `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px ${teamColor}22`
                              : "0 2px 8px rgba(0,0,0,0.35)",
                            transition: "box-shadow 0.3s ease",
                          }}
                        >
                          <div style={{ display: "flex", gap: 0 }}>
                            {/* Left color strip */}
                            <motion.div
                              animate={{ opacity: isHov || isClicking ? 1 : 0.4 }}
                              style={{
                                background: isGoal
                                  ? `linear-gradient(180deg, ${teamColor}, ${teamColor}88)`
                                  : teamColor,
                                flexShrink: 0, width: isHov || isClicking ? 4 : 3,
                                transition: "width 0.25s ease",
                              }}
                            />

                            {/* Content */}
                            <div style={{ flex: 1, padding: "14px 18px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                {/* Minute */}
                                <motion.div
                                  style={{
                                    fontSize: "1.15rem", fontWeight: 900,
                                    letterSpacing: "0.04em", lineHeight: 1, minWidth: 42,
                                  }}
                                  animate={{ color: isHov || isClicking ? teamColor : `${teamColor}cc` }}
                                  transition={{ duration: 0.2 }}
                                >
                                  {moment.minute}&apos;
                                </motion.div>
                                {/* Icon */}
                                <motion.div
                                  style={{ fontSize: "1.1rem" }}
                                  animate={{ scale: isHov ? 1.15 : 1 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  {moment.icon}
                                </motion.div>
                                {/* Team badge */}
                                <div style={{
                                  fontSize: "0.52rem", letterSpacing: "0.2em",
                                  color: "rgba(255,255,255,0.3)",
                                  padding: "2px 6px",
                                  background: `${teamColor}18`,
                                  borderRadius: 2,
                                }}>
                                  {TEAM_REGISTRY[moment.team]?.code ?? moment.team}
                                </div>

                                {/* Type label for non-goal events */}
                                {!isGoal && (
                                  <div style={{
                                    fontSize: "0.42rem", letterSpacing: "0.18em",
                                    color: "rgba(255,255,255,0.18)",
                                    marginLeft: "auto",
                                    textTransform: "uppercase",
                                  }}>
                                    {moment.type}
                                  </div>
                                )}
                              </div>

                              {/* Title */}
                              <motion.div
                                style={{
                                  fontSize: isGoal ? "1.15rem" : "0.95rem",
                                  fontWeight: isGoal ? 800 : 700,
                                  letterSpacing: "0.02em",
                                  lineHeight: 1.15,
                                }}
                                animate={{
                                  color: isClicking ? "#fff" : isHov ? "#fff" : "rgba(255,255,255,0.84)",
                                  textShadow: isClicking
                                    ? `0 0 24px ${teamColor}88`
                                    : isGoal && isHov
                                    ? `0 0 12px ${teamColor}44`
                                    : "none",
                                }}
                                transition={{ duration: 0.2 }}
                              >
                                {moment.title}
                              </motion.div>

                              {/* Context — reveal on hover or always for goals */}
                              <AnimatePresence>
                                {(isHov || isGoal || isClicking) && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0, y: -4 }}
                                    animate={{ opacity: 1, height: "auto", y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.22, ease: EASE_OUT }}
                                  >
                                    <div style={{
                                      fontSize: "0.68rem",
                                      color: "rgba(255,255,255,0.46)",
                                      lineHeight: 1.55,
                                      marginTop: 7,
                                      letterSpacing: "0.02em",
                                    }}>
                                      {moment.context}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Investigate CTA — slides in on hover */}
                            <motion.div
                              initial={false}
                              animate={{
                                opacity: isHov || isClicking ? 1 : 0,
                                x: isHov || isClicking ? 0 : 8,
                              }}
                              transition={{ duration: 0.2 }}
                              style={{
                                flexShrink: 0,
                                display: "flex", alignItems: "center",
                                paddingRight: 18,
                                fontSize: "0.52rem",
                                letterSpacing: "0.2em",
                                color: teamColor,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isClicking ? "ENTERING →" : "INVESTIGATE →"}
                            </motion.div>
                          </div>

                          {/* Bottom glow line on hover */}
                          <motion.div
                            animate={{ scaleX: isHov || isClicking ? 1 : 0, opacity: isHov || isClicking ? 1 : 0 }}
                            initial={{ scaleX: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{
                              height: "0.5px",
                              background: `linear-gradient(90deg, ${teamColor}00, ${teamColor}88, ${teamColor}00)`,
                              transformOrigin: "left center",
                            }}
                          />
                        </motion.div>
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Match Flow Bar ────────────────────────────────────────────────────────────
// A broadcast-style momentum indicator showing event distribution between teams.
function MatchFlowBar({ homeColor, awayColor, homeCode, awayCode, homePct }: {
  homeColor: string; awayColor: string;
  homeCode: string;  awayCode: string;
  homePct: number;
}) {
  const awayPct = 100 - homePct;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginBottom: 4 }}
    >
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 5,
        fontSize: "0.42rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)",
      }}>
        <span style={{ color: homeColor }}>{homeCode} {homePct}%</span>
        <span style={{ letterSpacing: "0.26em" }}>MATCH FLOW</span>
        <span style={{ color: awayColor }}>{awayPct}% {awayCode}</span>
      </div>
      <div style={{ height: 2, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <motion.div
          style={{ height: "100%", display: "flex", transformOrigin: "left center" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            style={{ height: "100%", background: homeColor }}
            initial={{ width: "50%" }}
            animate={{ width: `${homePct}%` }}
            transition={{ duration: 1.2, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            style={{ height: "100%", background: awayColor, flex: 1 }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Team Code Badge ───────────────────────────────────────────────────────────
function GradCode({ code, color }: { code: string; color: string }) {
  return (
    <div style={{
      fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.1em",
      background: `linear-gradient(160deg,${color}ee,${color}77)`,
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
    }}>{code}</div>
  );
}
