"use client";

/**
 * MatchMemory — Match investigation experience.
 *
 * Visual architecture matches the original IncidentEngine exactly:
 *   Left   220px  — key moments as numbered steps (timeline)
 *   Centre flex-1 — SVGPitch hero: camera zoom, breathing, story card, vignette
 *   Right  340px  — WHY analysis (top) + players / Granite (bottom)
 *
 * Content: key moments from matchNarratives, WHY from Granite, player dossier on click.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SVGPitch } from "@/components/pitch/SVGPitch";
import { extractEvents, playerAttribute, RADAR_ATTRIBUTES } from "@/lib/eventExtractor";
import type { InvestigationEvent, EventFrame, PlayerDot } from "@/lib/eventExtractor";
import { MATCH_META, ALL_MATCHES, TEAM_REGISTRY } from "@/lib/matchData";
import type { RawEvent } from "@/lib/matchData";
import type { KeyMoment } from "@/components/incident/MatchStoryScreen";

interface Props {
  matchId: string;
  initialMoment: KeyMoment;
  allMoments: KeyMoment[];
  onBack: () => void;
}

// ── POV palette (referee) ─────────────────────────────────────────────
const ACCENT = "168,196,224";
const BG     = "#050d18";
const acc    = (a: string) => `rgba(${ACCENT},${a})`;

// ── Camera positions per moment type ─────────────────────────────────
const CAM: Record<string, { scale: number; x: string; y: string; origin: string }> = {
  goal:         { scale: 1.55, x: "-10%", y: "0%",  origin: "82% 48%" },
  substitution: { scale: 1.05, x: "0%",   y: "0%",  origin: "center"  },
  card:         { scale: 1.28, x: "-5%",  y: "-1%", origin: "68% 47%" },
  incident:     { scale: 1.18, x: "-3%",  y: "0%",  origin: "64% 50%" },
};

// ── Pitch coords: convert from % space to FIFA metres (105×68) ───────
const toM = (x: number, y: number) => ({
  x: (x / 100) * 105,
  y: (y / 65)  * 68,
});

// ─── ROOT ─────────────────────────────────────────────────────────────
export default function MatchMemory({ matchId, initialMoment, allMoments, onBack }: Props) {
  const meta      = MATCH_META[matchId];
  const rawEvents = (ALL_MATCHES[matchId] ?? []) as RawEvent[];
  const keyEvents = meta ? extractEvents(matchId, rawEvents, meta) : [];

  const [momentIdx,     setMomentIdx]     = useState(() => allMoments.findIndex(m => m.id === initialMoment.id) || 0);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [dossierPlayer, setDossierPlayer] = useState<PlayerDot | null>(null);
  const [graniteText,   setGraniteText]   = useState("");
  const [graniteLoading, setGraniteLoading] = useState(false);
  const [introPhase,    setIntroPhase]    = useState<"hold" | "reveal" | "active">("hold");
  const [panelActive,   setPanelActive]   = useState(false);
  const [edgeSweepActive, setEdgeSweepActive] = useState(false);

  const panelTimer  = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sweepOuter  = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sweepInner  = useRef<ReturnType<typeof setTimeout>>(undefined);

  const activeMoment = allMoments[momentIdx] ?? initialMoment;
  const isFirst = momentIdx === 0;
  const isLast  = momentIdx === allMoments.length - 1;

  const keyEvent = keyEvents.find(ke => ke.minute === activeMoment.minute && ke.type === activeMoment.type)
    ?? keyEvents.find(ke => ke.minute === activeMoment.minute)
    ?? null;
  const activeFrame = keyEvent?.frames?.[activeFrameIdx] ?? null;

  // Intro sequence
  useEffect(() => {
    const t1 = setTimeout(() => setIntroPhase("reveal"), 350);
    const t2 = setTimeout(() => setIntroPhase("active"), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [activeMoment.id]);

  // Edge sweep — random interval, feels like broadcast equipment
  useEffect(() => {
    const schedule = () => {
      sweepOuter.current = setTimeout(() => {
        setEdgeSweepActive(true);
        sweepInner.current = setTimeout(() => {
          setEdgeSweepActive(false);
          schedule();
        }, 2000);
      }, 8000 + Math.random() * 4000);
    };
    schedule();
    return () => { clearTimeout(sweepOuter.current); clearTimeout(sweepInner.current); };
  }, []);

  // Granite WHY fetch
  useEffect(() => {
    if (!meta) return;
    const why = activeFrame?.why ?? activeMoment.context;
    setGraniteText(why);
    setGraniteLoading(true);
    clearTimeout(panelTimer.current);
    setPanelActive(true);
    panelTimer.current = setTimeout(() => setPanelActive(false), 2200);

    const ts = activeMoment.minute * 60;
    let home = 0, away = 0;
    for (const ev of rawEvents) {
      if (ev.event_type === "goal" && ev.minute * 60 + ev.second <= ts) {
        if (ev.team === meta.home.name) home++; else away++;
      }
    }
    const score = `${meta.home.code} ${home}–${away} ${meta.away.code}`;

    fetch("/api/granite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId, eventType: activeMoment.type,
        player: activeMoment.title, team: activeMoment.team,
        minute: activeMoment.minute,
        frameLabel: activeFrame?.label ?? activeMoment.title,
        frameWhy: why, score,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.insight) {
          setGraniteText(d.insight);
          clearTimeout(panelTimer.current);
          setPanelActive(true);
          panelTimer.current = setTimeout(() => setPanelActive(false), 2500);
        }
      })
      .catch(() => {})
      .finally(() => setGraniteLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMoment.id, activeFrameIdx]);

  // Cleanup
  useEffect(() => () => { clearTimeout(panelTimer.current); }, []);

  const goNext = useCallback(() => {
    setMomentIdx(i => Math.min(i + 1, allMoments.length - 1));
    setActiveFrameIdx(0);
    setDossierPlayer(null);
    setIntroPhase("hold");
  }, [allMoments.length]);

  const goPrev = useCallback(() => {
    setMomentIdx(i => Math.max(i - 1, 0));
    setActiveFrameIdx(0);
    setDossierPlayer(null);
    setIntroPhase("hold");
  }, []);

  const goToMoment = useCallback((idx: number) => {
    setMomentIdx(idx);
    setActiveFrameIdx(0);
    setDossierPlayer(null);
    setIntroPhase("hold");
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", " "].includes(e.key)) { e.preventDefault(); goNext(); }
      if (["ArrowLeft",  "ArrowUp"].includes(e.key))        { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  if (!meta) return null;

  const teamColor = TEAM_REGISTRY[activeMoment.team]?.color ?? acc("0.82");
  const cam = CAM[activeMoment.type] ?? CAM.incident;
  const showOverlays = introPhase === "active";

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ background: BG, fontFamily: "var(--font-inter), Inter, sans-serif" }}
    >

      {/* ══ LEFT — Timeline ══════════════════════════════════════════════ */}
      <nav style={{
        width: 220, flexShrink: 0,
        background: "rgba(0,4,14,0.97)",
        borderRight: `1px solid ${acc("0.07")}`,
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${acc("0.07")}`, flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: acc("0.38"), fontSize: "0.7rem",
              letterSpacing: "0.2em", textTransform: "uppercase",
              display: "block", marginBottom: 22, transition: "color 0.25s",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = acc("0.72"))}
            onMouseLeave={e => (e.currentTarget.style.color = acc("0.38"))}
          >
            ← Return
          </button>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.28em", color: acc("0.32"), textTransform: "uppercase", marginBottom: 6 }}>
            Match Memory
          </div>
          <div style={{ fontSize: "1rem", letterSpacing: "0.04em", color: acc("0.82"), fontWeight: 300, lineHeight: 1.3 }}>
            {meta.home.name} vs {meta.away.name}
          </div>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: acc("0.32"), marginTop: 4 }}>
            {meta.stage} · {meta.date}
          </div>
        </div>

        {/* Key moments as steps */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {allMoments.map((m, i) => {
            const isActive = i === momentIdx;
            const isPast   = i < momentIdx;
            return (
              <button key={m.id}
                onClick={() => goToMoment(i)}
                style={{
                  width: "100%", background: "none", border: "none",
                  borderLeft: isActive ? `2px solid ${acc("0.7")}` : "2px solid transparent",
                  backgroundColor: isActive ? acc("0.05") : "transparent",
                  padding: "16px 18px", display: "flex", alignItems: "flex-start",
                  gap: 12, textAlign: "left", cursor: "pointer",
                  transition: "background-color 0.3s, border-color 0.3s",
                }}
              >
                <span style={{
                  fontSize: "0.72rem", letterSpacing: "0.08em",
                  color: isActive ? acc("0.88") : isPast ? acc("0.42") : acc("0.18"),
                  fontWeight: 300, minWidth: 24, paddingTop: 1, transition: "color 0.3s",
                }}>
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <div>
                  <div style={{
                    fontSize: "0.72rem", letterSpacing: "0.15em", textTransform: "uppercase",
                    color: isActive ? acc("0.88") : isPast ? acc("0.38") : acc("0.18"),
                    fontWeight: 300, lineHeight: 1, transition: "color 0.3s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span>{m.icon}</span>
                    <span>{m.minute}&apos; · {m.type}</span>
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }}
                        style={{ fontSize: "0.7rem", color: acc("0.55"), marginTop: 5, lineHeight: 1.5, overflow: "hidden", fontWeight: 300 }}
                      >
                        {m.title}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ padding: "16px 18px", borderTop: `1px solid ${acc("0.07")}`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {allMoments.map((_, i) => (
              <motion.div key={i}
                animate={{ flex: i === momentIdx ? 2.5 : 1, backgroundColor: i <= momentIdx ? acc("0.65") : acc("0.12") }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: 2, borderRadius: 1 }}
              />
            ))}
          </div>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: acc("0.28"), marginTop: 8 }}>
            Moment {momentIdx + 1} of {allMoments.length}
          </div>
        </div>
      </nav>

      {/* ══ CENTRE — Pitch ══════════════════════════════════════════════ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>

        {/* Status bar */}
        <div style={{
          padding: "12px 22px", borderBottom: `1px solid ${acc("0.06")}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          background: "rgba(0,4,14,0.55)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <motion.div
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(220,80,80,0.92)" }}
            />
            <span style={{ fontSize: "0.72rem", letterSpacing: "0.2em", color: acc("0.48"), textTransform: "uppercase" }}>
              Match Memory Active — {activeMoment.minute}&apos;
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span key={momentIdx}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: introPhase === "active" ? 1 : 0, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.35 }}
              style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: acc("0.38"), textTransform: "uppercase" }}
            >
              {activeMoment.type.toUpperCase()} — {activeMoment.title}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.14em", color: acc("0.22") }}>
            {momentIdx + 1} / {allMoments.length}
          </span>
        </div>

        {/* Pitch container */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 10px 4px", position: "relative", overflow: "hidden" }}>

          {/* Story card — broadcast caption overlay */}
          {introPhase === "active" && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`sc-${momentIdx}-${activeFrameIdx}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10, transition: { duration: 0.4, ease: "easeIn" } }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                style={{ position: "absolute", left: "5%", top: "14%", zIndex: 18, pointerEvents: "none", maxWidth: 240 }}
              >
                {/* Legibility halo */}
                <div style={{
                  position: "absolute", inset: "-22px -28px",
                  background: "radial-gradient(ellipse at 28% 38%, rgba(0,3,18,0.60) 0%, transparent 70%)",
                  zIndex: -1,
                }} />
                {/* Eyebrow */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  style={{ fontSize: "0.65rem", letterSpacing: "0.2em", color: acc("0.75"), textTransform: "uppercase", fontWeight: 300, marginBottom: 10, opacity: 0.75 }}
                >
                  {activeMoment.minute}&apos; · {TEAM_REGISTRY[activeMoment.team]?.code} · {activeMoment.type}
                </motion.div>
                {/* Accent line */}
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.55, delay: 0.68, ease: [0.16, 1, 0.3, 1] }}
                  style={{ width: 22, height: 1, background: acc("0.8"), marginBottom: 13, transformOrigin: "left" }}
                />
                {/* Headline */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.74, ease: [0.16, 1, 0.3, 1] }}
                  style={{ fontSize: "1.2rem", letterSpacing: "0.03em", color: "rgba(255,255,255,0.94)", fontWeight: 300, lineHeight: 1.15, marginBottom: 13 }}
                >
                  {activeFrame?.label ?? activeMoment.title}
                </motion.div>
                {/* Body */}
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, delay: 1.1 }}
                  style={{ fontSize: "0.75rem", letterSpacing: "0.02em", color: "rgba(255,255,255,0.44)", lineHeight: 1.75, fontWeight: 300, margin: 0 }}
                >
                  {activeFrame?.why ?? activeMoment.context}
                </motion.p>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Breathing outer wrapper */}
          <motion.div
            animate={{ scale: [1, 1.006, 1, 1.003, 1], y: ["0%", "-0.35%", "0%", "0.18%", "0%"] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] }}
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", inset: 0 }}
          >
            {/* Camera wrapper — zooms to action zone */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMoment.id}
                animate={{ scale: showOverlays ? cam.scale : 1, x: cam.x, y: cam.y }}
                initial={{ opacity: 0, scale: 0.97 }}
                exit={{ opacity: 0, scale: 1.03 }}
                transition={{ duration: 2.0, ease: [0.25, 0.08, 0.25, 1] }}
                style={{ width: "100%", maxHeight: "100%", aspectRatio: "115/76", transformOrigin: cam.origin, willChange: "transform" }}
              >
                <SVGPitch>
                  {/* Vignette */}
                  <PitchVignette />

                  {/* Zone highlight */}
                  {showOverlays && activeFrame?.zone && ZONE_METRES[activeFrame.zone] && (
                    <motion.rect
                      key={activeFrame.zone + activeMoment.id}
                      x={ZONE_METRES[activeFrame.zone].x} y={ZONE_METRES[activeFrame.zone].y}
                      width={ZONE_METRES[activeFrame.zone].w} height={ZONE_METRES[activeFrame.zone].h}
                      fill={teamColor} rx={0.5}
                      initial={{ opacity: 0 }} animate={{ opacity: [0, 0.09, 0.05] }}
                      transition={{ duration: 1.4 }}
                    />
                  )}

                  {/* Players */}
                  {showOverlays && buildPlayers(activeMoment, activeFrame, meta).map(p => (
                    <PlayerDot
                      key={p.id + activeMoment.id}
                      player={p}
                      isHighlighted={!!activeFrame && (p.name === activeFrame.highlightPlayerName || p.fullName === activeFrame.highlightPlayerName)}
                      highlightColor={teamColor}
                      onClick={() => setDossierPlayer(p)}
                    />
                  ))}

                  {/* Ball */}
                  {showOverlays && (() => {
                    const raw = activeFrame?.ballPosition ?? guessBallPct(activeMoment);
                    const b = toM(raw.x, raw.y);
                    return (
                      <>
                        <motion.circle
                          key={`ball-${activeMoment.id}-${activeFrame?.id}`}
                          cx={b.x} cy={b.y} r={1.1} fill="white" opacity={0.96}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 0.96 }}
                          transition={{ duration: 0.35, delay: 0.18 }}
                        />
                        <motion.circle cx={b.x} cy={b.y} r={2.8} fill="white"
                          animate={{ opacity: [0, 0.06, 0] }} transition={{ duration: 2.8, repeat: Infinity }} />
                        {/* Goal flash */}
                        {activeMoment.type === "goal" && (
                          <motion.circle cx={b.x} cy={b.y} r={5} fill="none"
                            stroke={teamColor} strokeWidth={0.4}
                            initial={{ opacity: 0.9, r: 1.5 }} animate={{ opacity: 0, r: 14 }}
                            transition={{ duration: 1.4, delay: 0.3 }} />
                        )}
                        {/* Card pulse */}
                        {(activeMoment.type === "card" || activeMoment.type === "incident") && (
                          <motion.circle cx={b.x} cy={b.y} r={5} fill="none"
                            stroke={teamColor} strokeWidth={0.3} strokeDasharray="1.5 1"
                            animate={{ opacity: [0, 0.6, 0] }} transition={{ duration: 2.2, repeat: Infinity }} />
                        )}
                      </>
                    );
                  })()}

                  {/* Spotlight */}
                  {showOverlays && <SpotlightOverlay moment={activeMoment} />}
                </SVGPitch>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Intro overlay */}
          <AnimatePresence>
            {introPhase !== "active" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: introPhase === "reveal" ? 1 : 0 }}
                exit={{ opacity: 0, transition: { duration: 1.2, ease: "easeIn" } }}
                style={{
                  position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "radial-gradient(ellipse at center, rgba(0,6,20,0.3) 0%, rgba(0,2,10,0.85) 100%)",
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: introPhase === "reveal" ? 1 : 0, y: introPhase === "reveal" ? 0 : 18 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  style={{ textAlign: "center" }}
                >
                  <motion.div
                    animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.18, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(220,80,80,0.92)", margin: "0 auto 22px" }}
                  />
                  <div style={{ fontSize: "0.72rem", letterSpacing: "0.42em", color: "rgba(220,80,80,0.7)", textTransform: "uppercase", marginBottom: 20, fontWeight: 300 }}>
                    Match Memory
                  </div>
                  <div style={{ fontSize: "clamp(1.2rem, 2.8vw, 1.8rem)", letterSpacing: "0.05em", color: acc("0.94"), fontWeight: 200, lineHeight: 1.2 }}>
                    {activeMoment.title}
                  </div>
                  <div style={{ marginTop: 16, fontSize: "0.78rem", letterSpacing: "0.18em", color: acc("0.38"), fontWeight: 300 }}>
                    {activeMoment.minute}&apos; — {meta.home.name} vs {meta.away.name}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom nav — Prev / frame scrubber / Next */}
        <div style={{
          padding: "11px 22px", borderTop: `1px solid ${acc("0.06")}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          background: "rgba(0,4,14,0.55)",
        }}>
          <motion.button
            onClick={goPrev} disabled={isFirst || introPhase !== "active"}
            style={{
              background: "none",
              border: `1px solid ${acc(isFirst || introPhase !== "active" ? "0.07" : "0.2")}`,
              color: acc(isFirst || introPhase !== "active" ? "0.14" : "0.55"),
              padding: "8px 20px", fontSize: "0.78rem", letterSpacing: "0.18em",
              textTransform: "uppercase", cursor: isFirst ? "default" : "pointer",
              fontFamily: "inherit", transition: "all 0.25s",
            }}
            whileHover={!isFirst && introPhase === "active" ? { borderColor: acc("0.42"), color: acc("0.88") } : {}}
          >
            ← Prev
          </motion.button>

          {/* Frame scrubber (center) */}
          {(keyEvent?.frames?.length ?? 0) > 1 ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {keyEvent!.frames.map((f, i) => (
                <button key={f.id} onClick={() => setActiveFrameIdx(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontFamily: "inherit" }}>
                  <motion.div
                    animate={{ width: i === activeFrameIdx ? 28 : 8, background: i === activeFrameIdx ? acc("0.8") : acc("0.18") }}
                    style={{ height: 2, borderRadius: 1 }} transition={{ duration: 0.2 }} />
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <PitchLegendItem color={TEAM_REGISTRY[meta.home.name]?.color ?? "#fff"} label={meta.home.code} />
              <PitchLegendItem color={TEAM_REGISTRY[meta.away.name]?.color ?? "#aaa"} label={meta.away.code} />
            </div>
          )}

          <motion.button
            onClick={() => { if (introPhase === "active") goNext(); else setIntroPhase("active"); }}
            style={{
              background: acc("0.08"), border: `1px solid ${acc("0.24")}`,
              color: acc("0.78"), padding: "8px 24px", fontSize: "0.78rem",
              letterSpacing: "0.18em", textTransform: "uppercase",
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.25s",
              opacity: isLast && introPhase === "active" ? 0.35 : 1,
            }}
            whileHover={!(isLast && introPhase === "active") ? { backgroundColor: acc("0.16"), color: acc("1") } : {}}
          >
            {introPhase !== "active" ? "Begin →" : "Next →"}
          </motion.button>
        </div>
      </main>

      {/* ══ RIGHT — Analysis + Players ══════════════════════════════════ */}
      <aside style={{
        width: 340, flexShrink: 0,
        background: "rgba(0,4,14,0.97)",
        borderLeft: `1px solid ${acc("0.07")}`,
        display: "flex", flexDirection: "column",
        boxShadow: panelActive
          ? `inset 0 0 80px rgba(20,55,120,0.14), inset -1px 0 0 ${acc("0.12")}`
          : `inset 0 0 50px rgba(10,30,80,0.07)`,
        transition: "box-shadow 0.7s ease",
      }}>

        {/* Analysis panel — top portion */}
        <div style={{ flexShrink: 0, maxHeight: "48%", overflowY: "auto", borderBottom: `1px solid ${acc("0.09")}` }}>
          <div style={{ padding: "20px 22px 14px", borderBottom: `1px solid ${acc("0.07")}` }}>
            <motion.div animate={{ opacity: introPhase === "active" ? 1 : 0 }} transition={{ duration: 0.5 }}>
              <div style={{ fontSize: "0.65rem", letterSpacing: "0.3em", color: acc("0.32"), textTransform: "uppercase", marginBottom: 6 }}>
                Moment {String(momentIdx + 1).padStart(2, "0")} — {activeMoment.type.toUpperCase()}
              </div>
              <AnimatePresence mode="wait">
                <motion.h2 key={activeMoment.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  style={{ fontSize: "1.1rem", fontWeight: 300, letterSpacing: "0.02em", color: acc("0.92"), lineHeight: 1.3, margin: 0 }}
                >
                  {activeMoment.title}
                </motion.h2>
              </AnimatePresence>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeMoment.id}
              initial={{ opacity: 0 }} animate={{ opacity: introPhase === "active" ? 1 : 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
              style={{ padding: "14px 22px 16px", display: "flex", flexDirection: "column", gap: 12 }}
            >
              {/* Context */}
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.35 }}
                style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.48)", lineHeight: 1.82, fontWeight: 300, margin: 0 }}
              >
                {activeMoment.context}
              </motion.p>

              {/* WHY — Granite */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: acc("0.045"), border: `1px solid ${acc("0.12")}`, padding: "13px 15px" }}
              >
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.28em", color: acc("0.45"), textTransform: "uppercase", marginBottom: 8 }}>
                  Why This Happened
                </div>
                <AnimatePresence mode="wait">
                  <motion.p key={graniteText.slice(0, 8)}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{ fontSize: "0.82rem", color: acc("0.68"), lineHeight: 1.75, fontWeight: 300, fontStyle: "italic", margin: 0,
                      opacity: graniteLoading ? 0.45 : 1, transition: "opacity 0.4s" }}
                  >
                    {graniteText || "Analysing moment…"}
                  </motion.p>
                </AnimatePresence>
                {graniteLoading && (
                  <div style={{ display: "flex", gap: 3, marginTop: 10, alignItems: "center" }}>
                    {[0,1,2].map(i => (
                      <motion.div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: acc("0.6") }}
                        animate={{ opacity: [0.2, 0.9, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
                    ))}
                    <span style={{ fontSize: "0.5rem", color: acc("0.22"), letterSpacing: "0.18em", marginLeft: 6 }}>GRANITE</span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Players section — bottom portion */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>

          {/* Stadium ambient glow */}
          <motion.div
            animate={{ opacity: [0.45, 0.78, 0.45] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
              background: "radial-gradient(ellipse 88% 60% at 50% 6%, rgba(110,170,255,0.13) 0%, rgba(110,170,255,0.05) 44%, transparent 76%)",
            }}
          />

          {/* Breathing edge light */}
          <motion.div
            animate={{ opacity: [0.28, 0.66, 0.28] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", left: 0, top: "8%", bottom: "8%", width: 1,
              background: `linear-gradient(180deg, transparent 0%, ${acc("0.55")} 35%, ${acc("0.55")} 65%, transparent 100%)`,
              pointerEvents: "none", zIndex: 1,
            }}
          />

          {/* Panel glow on transmission */}
          <AnimatePresence>
            {panelActive && (
              <motion.div key="panel-glow"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 1.1, ease: "easeOut" } }}
                transition={{ duration: 0.3 }}
                style={{
                  position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
                  background: `radial-gradient(ellipse 80% 50% at 50% 10%, rgba(110,170,255,0.10) 0%, ${acc("0.04")} 55%, transparent 78%)`,
                }}
              />
            )}
          </AnimatePresence>

          {/* Header */}
          <div style={{ flexShrink: 0, borderBottom: `1px solid ${acc("0.09")}`, position: "relative", overflow: "hidden", zIndex: 2 }}>
            {/* Ambient top line */}
            <motion.div
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute", top: 0, left: "12%", right: "12%", height: 1,
                background: "linear-gradient(90deg, transparent, rgba(110,170,255,0.75), rgba(110,170,255,0.75), transparent)",
                pointerEvents: "none",
              }}
            />
            {/* Sweep */}
            <AnimatePresence>
              {edgeSweepActive && (
                <motion.div key="sweep"
                  initial={{ x: "-110%", opacity: 0 }}
                  animate={{ x: "210%", opacity: [0, 0.85, 0.85, 0] }}
                  exit={{}} transition={{ duration: 1.9, ease: "linear" }}
                  style={{
                    position: "absolute", top: 0, left: 0, width: "55%", height: 1,
                    background: "linear-gradient(90deg, transparent, rgba(160,200,255,0.9), rgba(110,170,255,0.5), transparent)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </AnimatePresence>

            <div style={{ padding: "13px 22px 0", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: "0.58rem", letterSpacing: "0.42em", color: acc("0.24"), textTransform: "uppercase" }}>
                Players
              </div>
            </div>
            <div style={{ padding: "11px 22px 13px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                <motion.div
                  animate={{ scale: [1, 1.9, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `1px solid ${acc("0.55")}` }}
                />
                <motion.div
                  animate={{ opacity: [0.65, 1, 0.65] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", inset: 2, borderRadius: "50%", background: acc("0.82") }}
                />
              </div>
              <div style={{ fontSize: "0.75rem", letterSpacing: "0.22em", color: acc("0.72"), textTransform: "uppercase", fontWeight: 300 }}>
                Tap a player on the pitch
              </div>
            </div>
          </div>

          {/* Player list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px", position: "relative", zIndex: 2 }}>
            <AnimatePresence mode="wait">
              <motion.div key={activeMoment.id}
                initial={{ opacity: 0 }} animate={{ opacity: introPhase === "active" ? 1 : 0 }}
                exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              >
                {buildPlayers(activeMoment, activeFrame, meta).map((p, i) => (
                  <motion.button key={p.id}
                    onClick={() => setDossierPlayer(p)}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                    style={{
                      width: "100%", background: "none", border: "none",
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 0", textAlign: "left",
                      borderBottom: `1px solid ${acc("0.05")}`,
                    }}
                    whileHover={{ backgroundColor: acc("0.04") }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0, opacity: p.isKey ? 1 : 0.5 }} />
                    <div>
                      <div style={{ fontSize: "0.82rem", color: p.isKey ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.32)", fontWeight: p.isKey ? 400 : 300, letterSpacing: "0.02em" }}>
                        {p.isKey ? p.fullName : p.name}
                      </div>
                      {p.isKey && (
                        <div style={{ fontSize: "0.58rem", color: acc("0.30"), letterSpacing: "0.1em", marginTop: 1 }}>
                          Key player · tap to inspect
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* ══ PLAYER DOSSIER overlay ══════════════════════════════════════ */}
      <AnimatePresence>
        {dossierPlayer && (
          <PlayerDossier player={dossierPlayer} keyEvent={keyEvent} onClose={() => setDossierPlayer(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── PITCH VIGNETTE ──────────────────────────────────────────────────
function PitchVignette() {
  return (
    <>
      <defs>
        <radialGradient id="mm-vig" cx="50%" cy="50%" r="68%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,22,0.62)" />
        </radialGradient>
      </defs>
      <rect x={-5} y={-4} width={125} height={80} fill="url(#mm-vig)" />
    </>
  );
}

// ─── SPOTLIGHT ───────────────────────────────────────────────────────
function SpotlightOverlay({ moment }: { moment: KeyMoment }) {
  const pos = moment.type === "goal"
    ? { cx: 97, cy: 34, r: 18 }
    : moment.type === "card"
      ? { cx: 65, cy: 34, r: 22 }
      : null;
  if (!pos) return null;
  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }}>
      <defs>
        <radialGradient id="mm-spt" cx={pos.cx} cy={pos.cy} r={pos.r} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
          <stop offset="55%"  stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,28,0.72)" />
        </radialGradient>
      </defs>
      <rect x={-5} y={-4} width={125} height={80} fill="url(#mm-spt)" />
    </motion.g>
  );
}

// ─── PLAYER DOT ──────────────────────────────────────────────────────
function PlayerDot({ player, isHighlighted, highlightColor, onClick }: {
  player: PlayerDot; isHighlighted: boolean; highlightColor: string; onClick: () => void;
}) {
  const pos = toM(player.x, player.y);
  const r   = 1.55;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      style={{ cursor: "pointer" }}
      onClick={onClick}
    >
      {isHighlighted && (
        <motion.circle cx={pos.x} cy={pos.y} r={r + 1.8}
          fill="none" stroke={highlightColor} strokeWidth={0.35}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
      )}
      {player.hasBall && (
        <circle cx={pos.x + 1.6} cy={pos.y - 1.6} r={0.7} fill="white" opacity={0.88} />
      )}
      <motion.circle cx={pos.x} cy={pos.y} r={r}
        fill={player.color} opacity={isHighlighted ? 0.95 : 0.78}
        initial={{ r: 0 }} animate={{ r }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />
      {player.isKey && (
        <text x={pos.x} y={pos.y - r - 0.9}
          fill="rgba(255,255,255,0.72)" fontSize={1.85}
          textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={300}
          style={{ userSelect: "none" }}>
          {player.name}
        </text>
      )}
    </motion.g>
  );
}

// ─── PITCH LEGEND ITEM ────────────────────────────────────────────────
function PitchLegendItem({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 14, height: 1.5, background: color, opacity: 0.75,
        borderStyle: dash ? "dashed" : "solid",
      }} />
      <span style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.32)", fontWeight: 300 }}>{label}</span>
    </div>
  );
}

// ─── PLAYER DOSSIER ──────────────────────────────────────────────────
function PlayerDossier({ player, keyEvent, onClose }: {
  player: PlayerDot; keyEvent: InvestigationEvent | null; onClose: () => void;
}) {
  const attrs = RADAR_ATTRIBUTES.map((label, i) => ({ label, score: playerAttribute(player.fullName, i) }));
  const role = player.isKey
    ? (keyEvent?.type === "goal" ? "Match Winner" : "Key Protagonist")
    : player.team === keyEvent?.team ? "Contributor" : "Defensive Challenger";

  return (
    <>
      <motion.div className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.52)", backdropFilter: "blur(3px)", cursor: "pointer" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="fixed right-0 top-0 bottom-0 z-[60] overflow-y-auto"
        style={{ width: 310, background: "#060d1c", borderLeft: `1px solid ${player.color}44`, scrollbarWidth: "none" }}
        initial={{ x: 310 }} animate={{ x: 0 }} exit={{ x: 310 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${player.color}, transparent)` }} />

        <div style={{ padding: "20px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "0.44rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.25)", marginBottom: 6, textTransform: "uppercase" }}>
                Player Dossier
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 200, color: "#fff", lineHeight: 1.0 }}>
                {player.fullName.split(" ").pop()}
              </div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", marginTop: 2, fontWeight: 300 }}>
                {player.fullName}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)", cursor: "pointer", width: 28, height: 28, borderRadius: 2, fontFamily: "inherit", fontSize: "0.7rem" }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: player.color }} />
            <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", fontWeight: 300 }}>{player.team}</span>
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: "0.44rem", letterSpacing: "0.28em", color: "rgba(255,255,255,0.2)", marginBottom: 5, textTransform: "uppercase" }}>Role in this moment</div>
          <div style={{ fontSize: "0.9rem", fontWeight: 300, color: player.isKey ? player.color : "rgba(255,255,255,0.55)", letterSpacing: "0.06em" }}>{role}</div>
        </div>

        <div style={{ padding: "16px 20px 8px" }}>
          <div style={{ fontSize: "0.44rem", letterSpacing: "0.28em", color: "rgba(255,255,255,0.2)", marginBottom: 12, textTransform: "uppercase" }}>Performance Attributes</div>
          <RadarChart attrs={attrs} color={player.color} />
        </div>

        <div style={{ padding: "4px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {attrs.map(({ label, score }) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.06em" }}>{label}</span>
                <span style={{ fontSize: "0.58rem", fontWeight: 400, color: player.isKey ? player.color : "rgba(255,255,255,0.5)" }}>{score}</span>
              </div>
              <div style={{ height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 1, overflow: "hidden" }}>
                <motion.div style={{ height: "100%", background: player.color, borderRadius: 1 }}
                  initial={{ width: 0 }} animate={{ width: `${score}%` }}
                  transition={{ duration: 0.8, delay: 0.05, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ margin: "0 20px 20px", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 2 }}>
          <div style={{ fontSize: "0.44rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.18)", marginBottom: 6, textTransform: "uppercase" }}>Scouting Note</div>
          <p style={{ fontSize: "0.66rem", fontWeight: 300, color: "rgba(255,255,255,0.52)", lineHeight: 1.65, margin: 0 }}>
            {player.isKey && keyEvent?.type === "goal"
              ? `${player.fullName.split(" ").pop()} demonstrates the intelligence to arrive at exactly the right moment. Their ability to read the game in real-time separates them.`
              : player.hasBall
                ? `In possession, ${player.fullName.split(" ").pop()} makes decisions at speed. Their vision opens passing lanes others don't see.`
                : `${player.fullName.split(" ").pop()} plays an undervalued role — setting the conditions for others to act.`}
          </p>
        </div>
      </motion.div>
    </>
  );
}

// ─── RADAR CHART ─────────────────────────────────────────────────────
function RadarChart({ attrs, color }: { attrs: { label: string; score: number }[]; color: string }) {
  const cx = 80, cy = 80, r = 60, n = attrs.length;
  const ang = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const pts = attrs.map((_, i) => ({ x: cx + Math.cos(ang(i)) * r, y: cy + Math.sin(ang(i)) * r }));
  const vp  = attrs.map(({ score }, i) => ({ x: cx + Math.cos(ang(i)) * r * score/100, y: cy + Math.sin(ang(i)) * r * score/100 }));
  const grid = (p: number) => pts.map((_, i) => `${i===0?"M":"L"} ${cx+Math.cos(ang(i))*r*p} ${cy+Math.sin(ang(i))*r*p}`).join(" ")+" Z";
  const val  = vp.map((p, i) => `${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ")+" Z";
  return (
    <svg viewBox="0 0 160 160" style={{ width: "100%", maxWidth: 185, display: "block", margin: "0 auto" }}>
      {[0.33,0.66,1].map(p => <path key={p} d={grid(p)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} />)}
      {pts.map((p,i) => <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />)}
      <motion.path d={val} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.5}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} />
      {vp.map((p,i) => <motion.circle key={i} cx={p.x} cy={p.y} r={3} fill={color}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.45+i*0.05 }} />)}
      {pts.map((p,i) => {
        const dx=p.x-cx,dy=p.y-cy;
        return <text key={i} x={cx+dx*1.3} y={cy+dy*1.3+3} textAnchor="middle"
          fill="rgba(255,255,255,0.35)" fontSize={7.5} fontFamily="Inter, sans-serif" fontWeight={300}>
          {attrs[i].label.split(" ")[0]}
        </text>;
      })}
    </svg>
  );
}

// ─── ZONE METRES (FIFA coordinate space 0–105 × 0–68) ────────────────
const ZONE_METRES: Record<string, { x: number; y: number; w: number; h: number }> = {
  defensive_third:  { x: 0,    y: 0,    w: 35,   h: 68 },
  midfield:         { x: 35,   y: 0,    w: 35,   h: 68 },
  attacking_third:  { x: 70,   y: 0,    w: 35,   h: 68 },
  left_channel:     { x: 58,   y: 44,   w: 29,   h: 24 },
  right_channel:    { x: 58,   y: 0,    w: 29,   h: 24 },
  penalty_area:     { x: 88.5, y: 13.8, w: 16.5, h: 40.3 },
  penalty_spot:     { x: 86,   y: 23,   w: 13,   h: 22 },
  goal_mouth:       { x: 99.5, y: 27.5, w: 5.5,  h: 13 },
  center_circle:    { x: 38,   y: 19,   w: 29,   h: 30 },
};

// ─── PLAYER BUILDER ───────────────────────────────────────────────────
// Returns dots in % space (0-100 x, 0-65 y) — toM() converts when rendering
function buildPlayers(moment: KeyMoment, frame: EventFrame | null, meta: typeof MATCH_META[string]): PlayerDot[] {
  if (frame?.players?.length) return frame.players;
  const isHome   = moment.team === meta.home.name;
  const tMeta    = TEAM_REGISTRY[moment.team];
  const oName    = isHome ? meta.away.name : meta.home.name;
  const oMeta    = TEAM_REGISTRY[oName];
  if (!tMeta || !oMeta) return [];
  const pName = moment.title.split(" ")[0];

  if (moment.type === "goal") return [
    { id:"p1", name:pName, fullName:pName,       team:moment.team, color:tMeta.color, x:isHome?88:12, y:32, isKey:true,  hasBall:true },
    { id:"p2", name:"GK",  fullName:"Goalkeeper", team:oName,       color:oMeta.color, x:isHome?97:3,  y:32, isKey:false, hasBall:false },
    { id:"p3", name:"Def", fullName:"Defender",   team:oName,       color:oMeta.color, x:isHome?82:18, y:26, isKey:false, hasBall:false },
  ];
  if (moment.type === "substitution") return [
    { id:"p1", name:"In",  fullName:"Substitute",    team:moment.team, color:tMeta.color, x:50, y:24, isKey:true,  hasBall:false },
    { id:"p2", name:"Out", fullName:"Player leaving", team:moment.team, color:tMeta.color, x:50, y:40, isKey:false, hasBall:false },
  ];
  return [
    { id:"p1", name:pName, fullName:pName,   team:moment.team, color:tMeta.color, x:isHome?60:40, y:32, isKey:true,  hasBall:false },
    { id:"p2", name:"Opp", fullName:"Opponent", team:oName,    color:oMeta.color, x:isHome?64:36, y:34, isKey:false, hasBall:false },
  ];
}

function guessBallPct(moment: KeyMoment): { x: number; y: number } {
  if (moment.type === "goal")         return { x: 92, y: 30 };
  if (moment.type === "card")         return { x: 55, y: 34 };
  if (moment.type === "substitution") return { x: 50, y: 32 };
  return { x: 50, y: 32 };
}
