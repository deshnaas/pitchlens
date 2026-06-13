"use client";

/**
 * IncidentEngine — The core investigation experience.
 *
 * Accepts any Incident and renders:
 *   Left  — step timeline + incident metadata
 *   Centre — SVG pitch (always visible, always the hero)
 *   Right  — law references, evidence, verdict
 *
 * Reused by all three POVs. The `pov` prop changes colour palette and text framing.
 * The pitch data is always identical — only the lens changes.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SVGPitch } from "@/components/pitch/SVGPitch";
import type {
  Incident,
  Player,
  Ball,
  Overlay,
  HighlightOverlay,
  LineOverlay,
  OffsideLineOverlay,
  ZoneOverlay,
  LabelOverlay,
  MeasurementOverlay,
  POV,
} from "@/lib/incidents/types";

// ── POV colour palettes ───────────────────────────────────────────────────────

const POV_PALETTE = {
  referee : { accent: "168,196,224", accentHex: "#a8c4e0", bg: "#050d18" },
  fan     : { accent: "126,207,160", accentHex: "#7ecfa0", bg: "#050e08" },
  supporter:{ accent: "232,168,124", accentHex: "#e8a87c", bg: "#100805" },
} as const;

// ── Player rendering ─────────────────────────────────────────────────────────

const TEAM_FILL = {
  home: "rgba(255,255,255,0.92)",
  away: "rgba(255,205,55,0.92)",
};

function PlayerDot({
  player,
  highlighted,
  highlightColor,
  dimmed,
  pulse,
}: {
  player        : Player;
  highlighted   : boolean;
  highlightColor: string;
  dimmed        : boolean;
  pulse         : boolean;
}) {
  const r = player.role === "goalkeeper" ? 1.9 : 1.5;

  return (
    <g style={{ opacity: dimmed ? 0.22 : 1 }}>
      {/* Outer ring when highlighted */}
      {highlighted && (
        <motion.circle
          cx={player.x} cy={player.y}
          r={r + 1.8}
          fill="none"
          stroke={highlightColor}
          strokeWidth={0.35}
          initial={{ opacity: 0, r: r }}
          animate={{
            opacity: pulse ? [0.7, 1, 0.7] : 0.85,
            r      : r + 1.8,
          }}
          transition={
            pulse
              ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.4 }
          }
        />
      )}

      {/* Body dot */}
      <motion.circle
        cx={player.x} cy={player.y} r={r}
        fill={TEAM_FILL[player.team]}
        initial={{ r: 0 }}
        animate={{ r }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Label */}
      {player.label && (
        <text
          x={player.x}
          y={player.y - r - 0.9}
          fill="rgba(255,255,255,0.62)"
          fontSize={1.65}
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
          fontWeight={300}
          style={{ userSelect: "none" }}
        >
          {player.label}
        </text>
      )}
    </g>
  );
}

// ── Ball rendering ────────────────────────────────────────────────────────────

function BallDot({ ball }: { ball: Ball }) {
  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      style={{ transformOrigin: `${ball.x}px ${ball.y}px` }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <circle cx={ball.x} cy={ball.y} r={1.05} fill="white" opacity={0.96} />
      <circle cx={ball.x} cy={ball.y} r={1.05} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={0.12} />
    </motion.g>
  );
}

// ── Overlay rendering — each type is a distinct SVG element ─────────────────

function OverlayLayer({
  overlays,
  players,
  stepKey,
}: {
  overlays: Overlay[];
  players : Player[];
  stepKey : number;
}) {
  const getPlayer = (id: string) => players.find(p => p.id === id);

  return (
    <g key={stepKey}>
      {overlays.map((ov, i) => {
        // ── Zone ──
        if (ov.type === "zone") {
          const o = ov as ZoneOverlay;
          return (
            <motion.rect
              key={`z-${i}`}
              x={o.x} y={o.y} width={o.w} height={o.h}
              fill={o.color}
              initial={{ opacity: 0 }}
              animate={{ opacity: o.opacity ?? 0.12 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: i * 0.05 }}
            />
          );
        }

        // ── Offside line ──
        if (ov.type === "offsideLine") {
          const o = ov as OffsideLineOverlay;
          return (
            <motion.path
              key={`ol-${i}`}
              d={`M ${o.x} 0 L ${o.x} 68`}
              stroke={o.color ?? "rgba(220,80,80,0.85)"}
              strokeWidth={0.45}
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.05 }}
            />
          );
        }

        // ── Line (pass / trajectory) ──
        if (ov.type === "line") {
          const o = ov as LineOverlay;
          return (
            <motion.path
              key={`ln-${i}`}
              d={`M ${o.from.x} ${o.from.y} L ${o.to.x} ${o.to.y}`}
              stroke={o.color}
              strokeWidth={o.width ?? 0.45}
              strokeDasharray={o.dashed ? "2 1.5" : undefined}
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: "easeInOut", delay: o.delay ?? i * 0.08 }}
            />
          );
        }

        // ── Player highlight ring ──
        if (ov.type === "highlight") {
          const o  = ov as HighlightOverlay;
          const pl = getPlayer(o.playerId);
          if (!pl) return null;
          const r = (pl.role === "goalkeeper" ? 1.9 : 1.5) + 2.2;
          return (
            <motion.circle
              key={`hl-${i}-${o.playerId}`}
              cx={pl.x} cy={pl.y}
              r={r}
              fill="none"
              stroke={o.color}
              strokeWidth={0.38}
              initial={{ r: r - 2, opacity: 0 }}
              animate={
                o.pulse
                  ? { r, opacity: [0, 0.9, 0.65], strokeWidth: [0.38, 0.55, 0.38] }
                  : { r, opacity: 0.85 }
              }
              transition={
                o.pulse
                  ? { duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }
                  : { duration: 0.45, delay: i * 0.05 }
              }
            />
          );
        }

        // ── Label ──
        if (ov.type === "label") {
          const o = ov as LabelOverlay;
          return (
            <motion.text
              key={`lb-${i}`}
              x={o.x} y={o.y}
              fill={o.color ?? "rgba(168,196,224,0.9)"}
              fontSize={o.size ?? 2}
              textAnchor="middle"
              fontFamily="Inter, sans-serif"
              fontWeight={o.bold ? 600 : 300}
              style={{ letterSpacing: "0.06em", userSelect: "none" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: (o.delay ?? 0.3) + i * 0.05 }}
            >
              {o.text}
            </motion.text>
          );
        }

        // ── Measurement ──
        if (ov.type === "measurement") {
          const o    = ov as MeasurementOverlay;
          const midX = (o.from.x + o.to.x) / 2;
          const midY = (o.from.y + o.to.y) / 2;
          const color = o.color ?? "rgba(255,200,80,0.9)";
          const labelY = o.side === "below" ? midY + 2 : midY - 1.2;
          return (
            <g key={`ms-${i}`}>
              {/* Main dimension line */}
              <motion.path
                d={`M ${o.from.x} ${o.from.y} L ${o.to.x} ${o.to.y}`}
                stroke={color}
                strokeWidth={0.38}
                strokeDasharray="1.2 0.8"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
              {/* End caps */}
              <motion.path
                d={`M ${o.from.x} ${o.from.y - 1.2} L ${o.from.x} ${o.from.y + 1.2} M ${o.to.x} ${o.to.y - 1.2} L ${o.to.x} ${o.to.y + 1.2}`}
                stroke={color}
                strokeWidth={0.3}
                fill="none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.55 }}
              />
              {/* Label */}
              <motion.text
                x={midX} y={labelY}
                fill={color}
                fontSize={1.9}
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
                fontWeight={300}
                style={{ userSelect: "none" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.65 }}
              >
                {o.label}
              </motion.text>
            </g>
          );
        }

        return null;
      })}
    </g>
  );
}

// ── Main IncidentEngine component ────────────────────────────────────────────

interface IncidentEngineProps {
  incident : Incident;
  pov?     : POV;
  onBack?  : () => void;
}

export function IncidentEngine({ incident, pov = "referee", onBack }: IncidentEngineProps) {
  const [step, setStep] = useState(0);
  const palette = POV_PALETTE[pov];

  const stepData   = incident.steps[step];
  const isLastStep = step === incident.steps.length - 1;
  const isFirstStep= step === 0;

  // Which players are highlighted and should others be dimmed
  const highlightMap = new Map<string, { color: string; pulse: boolean }>();
  stepData.overlays.forEach(ov => {
    if (ov.type === "highlight") {
      const o = ov as HighlightOverlay;
      highlightMap.set(o.playerId, { color: o.color, pulse: !!o.pulse });
    }
  });
  const hasHighlights = highlightMap.size > 0;

  const goNext = useCallback(() => {
    setStep(s => Math.min(s + 1, incident.steps.length - 1));
  }, [incident.steps.length]);

  const goPrev = useCallback(() => {
    setStep(s => Math.max(s - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", " "].includes(e.key)) { e.preventDefault(); goNext(); }
      if (["ArrowLeft",  "ArrowUp"       ].includes(e.key)) { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const acc = `rgba(${palette.accent},`;

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ background: palette.bg, fontFamily: "var(--font-inter), sans-serif", cursor: "none" }}
    >

      {/* ══════════════════════════════════════════════════════
          LEFT — Investigation timeline
      ══════════════════════════════════════════════════════ */}
      <nav
        style={{
          width       : "216px",
          flexShrink  : 0,
          background  : "rgba(0,6,18,0.94)",
          borderRight : `1px solid ${acc}0.07)`,
          display     : "flex",
          flexDirection:"column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "22px 18px 16px", borderBottom: `1px solid ${acc}0.07)` }}>
          <button
            onClick={onBack}
            style={{
              background: "none", border: "none", padding: 0, cursor: "none",
              color     : `${acc}0.35)`, fontSize: "0.46rem",
              letterSpacing: "0.3em", textTransform: "uppercase",
              display: "block", marginBottom: "18px",
              transition: "color 0.25s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = `${acc}0.72)`)}
            onMouseLeave={e => (e.currentTarget.style.color = `${acc}0.35)`)}
          >
            ← Return
          </button>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.36em", color: `${acc}0.32)`, textTransform: "uppercase" }}>
            VAR Investigation
          </div>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: `${acc}0.75)`, marginTop: "6px", fontWeight: 300 }}>
            {incident.matchContext.teams[0]} vs {incident.matchContext.teams[1]}
          </div>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.18em", color: `${acc}0.28)`, marginTop: "4px" }}>
            {incident.matchContext.minute}&apos; — {incident.matchContext.score} — {incident.title}
          </div>
        </div>

        {/* Steps */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {incident.steps.map((s, i) => {
            const isActive = i === step;
            const isPast   = i < step;
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width          : "100%",
                  background     : "none",
                  border         : "none",
                  borderLeft     : isActive ? `2px solid ${acc}0.72)` : "2px solid transparent",
                  backgroundColor: isActive ? `${acc}0.05)` : "transparent",
                  padding        : "14px 18px",
                  display        : "flex",
                  alignItems     : "flex-start",
                  gap            : "12px",
                  textAlign      : "left",
                  cursor         : "none",
                  transition     : "background-color 0.25s, border-color 0.25s",
                }}
              >
                <span style={{
                  fontSize     : "0.56rem",
                  letterSpacing: "0.1em",
                  color        : isActive ? `${acc}0.9)` : isPast ? `${acc}0.4)` : `${acc}0.18)`,
                  fontWeight   : 300,
                  minWidth     : "22px",
                  paddingTop   : "1px",
                  transition   : "color 0.25s",
                }}>
                  {s.id + 1 < 10 ? `0${s.id + 1}` : s.id + 1}
                </span>
                <div>
                  <div style={{
                    fontSize     : "0.5rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color        : isActive ? `${acc}0.85)` : isPast ? `${acc}0.35)` : `${acc}0.18)`,
                    fontWeight   : 300,
                    lineHeight   : 1,
                    transition   : "color 0.25s",
                  }}>
                    {s.label}
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit   ={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                          fontSize     : "0.42rem",
                          letterSpacing: "0.04em",
                          color        : `${acc}0.36)`,
                          marginTop    : "5px",
                          lineHeight   : 1.55,
                          maxWidth     : "140px",
                          overflow     : "hidden",
                        }}
                      >
                        {s.title}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${acc}0.07)` }}>
          <div style={{ display: "flex", gap: "5px" }}>
            {incident.steps.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  flex           : i === step ? 2.5 : 1,
                  backgroundColor: i <= step ? `${acc}0.65)` : `${acc}0.14)`,
                }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: "2px", borderRadius: "1px" }}
              />
            ))}
          </div>
          <div style={{ fontSize: "0.4rem", letterSpacing: "0.2em", color: `${acc}0.22)`, marginTop: "8px" }}>
            Step {step + 1} of {incident.steps.length}
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════
          CENTRE — The pitch (always visible, always the hero)
      ══════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          padding        : "13px 22px",
          borderBottom   : `1px solid ${acc}0.07)`,
          display        : "flex",
          alignItems     : "center",
          justifyContent : "space-between",
          flexShrink     : 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <motion.div
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(220,80,80,0.95)" }}
            />
            <span style={{ fontSize: "0.46rem", letterSpacing: "0.3em", color: `${acc}0.45)`, textTransform: "uppercase" }}>
              VAR Review Active — {incident.matchContext.minute}&apos;
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={step}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit   ={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              style={{ fontSize: "0.46rem", letterSpacing: "0.18em", color: `${acc}0.4)`, textTransform: "uppercase" }}
            >
              {stepData.label} — {stepData.title}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: "0.42rem", letterSpacing: "0.18em", color: `${acc}0.22)` }}>
            {step + 1} / {incident.steps.length}
          </span>
        </div>

        {/* ── THE PITCH ── */}
        <div style={{ flex: 1, padding: "20px 16px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", maxHeight: "100%", aspectRatio: "115/76" }}>
            <SVGPitch>
              {/* Overlays FIRST (behind players) */}
              <AnimatePresence mode="wait">
                <OverlayLayer
                  key={`ov-${step}`}
                  overlays={stepData.overlays}
                  players={incident.players}
                  stepKey={step}
                />
              </AnimatePresence>

              {/* Players */}
              {incident.players.map((pl, idx) => {
                const hl = highlightMap.get(pl.id);
                return (
                  <PlayerDot
                    key={`${pl.id}-${step}`}
                    player={pl}
                    highlighted={!!hl}
                    highlightColor={hl?.color ?? ""}
                    dimmed={hasHighlights && !hl}
                    pulse={hl?.pulse ?? false}
                  />
                );
              })}

              {/* Ball */}
              <BallDot key={`ball-${step}`} ball={incident.ball} />
            </SVGPitch>
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{
          padding        : "12px 22px",
          borderTop      : `1px solid ${acc}0.07)`,
          display        : "flex",
          justifyContent : "space-between",
          alignItems     : "center",
          flexShrink     : 0,
        }}>
          <motion.button
            onClick={goPrev}
            disabled={isFirstStep}
            style={{
              background   : "none",
              border       : `1px solid ${acc}${isFirstStep ? "0.08)" : "0.2)"}`,
              color        : `${acc}${isFirstStep ? "0.15)" : "0.55)"}`,
              padding      : "7px 20px",
              fontSize     : "0.44rem",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              cursor       : "none",
              fontFamily   : "inherit",
              transition   : "all 0.25s",
            }}
            whileHover={!isFirstStep ? { borderColor: `${acc}0.45)`, color: `${acc}0.85)` } : {}}
          >
            ← Prev
          </motion.button>

          {/* Pitch legend */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit   ={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{ display: "flex", gap: "18px", alignItems: "center" }}
            >
              <PitchLegendItem color="rgba(255,255,255,0.8)"  label="Germany" />
              <PitchLegendItem color="rgba(255,205,55,0.8)"   label="Brazil"  />
              {step >= 1 && <PitchLegendItem color="rgba(168,196,224,0.7)" label="Pass line" dash />}
              {step >= 2 && <PitchLegendItem color="rgba(220,80,80,0.8)"  label="Offside line" />}
              {step >= 3 && <PitchLegendItem color="rgba(255,200,80,0.8)" label="Measurement" dash />}
            </motion.div>
          </AnimatePresence>

          {!isLastStep ? (
            <motion.button
              onClick={goNext}
              style={{
                background   : `${acc}0.08)`,
                border       : `1px solid ${acc}0.28)`,
                color        : `${acc}0.8)`,
                padding      : "7px 24px",
                fontSize     : "0.44rem",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                cursor       : "none",
                fontFamily   : "inherit",
                transition   : "all 0.25s",
              }}
              whileHover={{ backgroundColor: `${acc}0.15)`, color: `${acc}1)` }}
            >
              Next →
            </motion.button>
          ) : (
            <motion.button
              onClick={onBack}
              style={{
                background   : "rgba(80,200,120,0.08)",
                border       : "1px solid rgba(80,200,120,0.3)",
                color        : "rgba(80,200,120,0.85)",
                padding      : "7px 24px",
                fontSize     : "0.44rem",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                cursor       : "none",
                fontFamily   : "inherit",
                transition   : "all 0.25s",
              }}
              whileHover={{ backgroundColor: "rgba(80,200,120,0.15)", color: "rgba(80,200,120,1)" }}
            >
              Return ↗
            </motion.button>
          )}
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════
          RIGHT — Law references, evidence, verdict
      ══════════════════════════════════════════════════════ */}
      <aside
        style={{
          width      : "282px",
          flexShrink : 0,
          background : "rgba(0,6,18,0.94)",
          borderLeft : `1px solid ${acc}0.07)`,
          display    : "flex",
          flexDirection: "column",
          overflowY  : "auto",
        }}
      >
        {/* Step heading */}
        <div style={{ padding: "22px 20px 16px", borderBottom: `1px solid ${acc}0.07)` }}>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.36em", color: `${acc}0.32)`, textTransform: "uppercase" }}>
            Step {String(step + 1).padStart(2, "0")}
          </div>
          <AnimatePresence mode="wait">
            <motion.h2
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit   ={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              style={{
                fontSize  : "clamp(0.82rem, 1.15vw, 1rem)",
                fontWeight: 300,
                letterSpacing: "0.03em",
                color     : `${acc}0.92)`,
                lineHeight: 1.3,
                margin    : "8px 0 0",
              }}
            >
              {stepData.title}
            </motion.h2>
          </AnimatePresence>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit   ={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              {/* Body */}
              <p style={{
                fontSize     : "0.62rem",
                letterSpacing: "0.03em",
                color        : "rgba(255,255,255,0.5)",
                lineHeight   : 1.8,
                fontWeight   : 300,
              }}>
                {stepData.body}
              </p>

              {/* Law reference block */}
              {stepData.lawRef && (
                <div style={{
                  background: `${acc}0.05)`,
                  border    : `1px solid ${acc}0.15)`,
                  padding   : "13px 15px",
                }}>
                  <div style={{ fontSize: "0.4rem", letterSpacing: "0.34em", color: `${acc}0.45)`, textTransform: "uppercase", marginBottom: "8px" }}>
                    Law {stepData.lawRef.number} — {stepData.lawRef.title}
                  </div>
                  <p style={{
                    fontSize     : "0.56rem",
                    letterSpacing: "0.02em",
                    color        : `${acc}0.72)`,
                    lineHeight   : 1.7,
                    fontWeight   : 300,
                    fontStyle    : "italic",
                  }}>
                    &ldquo;{stepData.lawRef.text}&rdquo;
                  </p>
                  <div style={{ fontSize: "0.38rem", letterSpacing: "0.18em", color: `${acc}0.28)`, marginTop: "8px" }}>
                    IFAB Laws of the Game 2023/24
                  </div>
                </div>
              )}

              {/* Technical data */}
              {stepData.technical && (
                <div style={{
                  background: "rgba(255,255,255,0.025)",
                  border    : "1px solid rgba(255,255,255,0.06)",
                  padding   : "11px 14px",
                }}>
                  <div style={{ fontSize: "0.4rem", letterSpacing: "0.34em", color: `${acc}0.35)`, textTransform: "uppercase", marginBottom: "9px" }}>
                    Technical Data
                  </div>
                  {stepData.technical.map((line, i) => (
                    <div key={i} style={{
                      display      : "flex",
                      gap          : "8px",
                      fontSize     : "0.52rem",
                      letterSpacing: "0.05em",
                      color        : "rgba(255,255,255,0.36)",
                      lineHeight   : 2,
                      fontWeight   : 300,
                    }}>
                      <span style={{ color: `${acc}0.28)`, flexShrink: 0 }}>—</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {/* Verdict */}
              {stepData.verdict && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.55 }}
                  style={{
                    background: "rgba(220,80,80,0.08)",
                    border    : "1px solid rgba(220,80,80,0.28)",
                    padding   : "18px 20px",
                    textAlign : "center",
                  }}
                >
                  <div style={{ fontSize: "0.4rem", letterSpacing: "0.36em", color: "rgba(220,80,80,0.5)", textTransform: "uppercase", marginBottom: "10px" }}>
                    VAR Decision
                  </div>
                  <div style={{
                    fontSize     : "1.1rem",
                    letterSpacing: "0.22em",
                    color        : "rgba(220,80,80,0.95)",
                    fontWeight   : 200,
                    textTransform: "uppercase",
                  }}>
                    {stepData.verdict.decision}
                  </div>
                  <div style={{
                    marginTop    : "10px",
                    fontSize     : "0.44rem",
                    letterSpacing: "0.1em",
                    color        : "rgba(220,80,80,0.4)",
                    fontWeight   : 300,
                  }}>
                    Confidence: {stepData.verdict.confidence}%
                  </div>
                  <div style={{
                    marginTop    : "6px",
                    fontSize     : "0.4rem",
                    letterSpacing: "0.12em",
                    color        : "rgba(220,80,80,0.3)",
                  }}>
                    Confirmed by Video Assistant Referee
                  </div>
                </motion.div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pitch key (bottom of right panel) */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${acc}0.07)` }}>
          <div style={{ fontSize: "0.38rem", letterSpacing: "0.3em", color: `${acc}0.2)`, textTransform: "uppercase", marginBottom: "9px" }}>
            Pitch Key
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <PitchKeyRow color="rgba(255,255,255,0.75)"  label="Home team (Germany)" />
            <PitchKeyRow color="rgba(255,205,55,0.75)"   label="Away team (Brazil)"  />
            <PitchKeyRow color="rgba(220,80,80,0.75)"    label="Offside / Violation" />
            <PitchKeyRow color="rgba(168,196,224,0.65)"  label="Reference / Pass"    />
            <PitchKeyRow color="rgba(255,200,80,0.72)"   label="Measurement"         />
          </div>
        </div>
      </aside>

    </div>
  );
}

// ── Small atoms ───────────────────────────────────────────────────────────────

function PitchLegendItem({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <div style={{
        width     : 18,
        height    : 1.5,
        flexShrink: 0,
        background: dash ? "none" : color,
        borderTop : dash ? `1.5px dashed ${color}` : "none",
      }} />
      <span style={{
        fontSize     : "0.4rem",
        letterSpacing: "0.15em",
        color        : "rgba(168,196,224,0.35)",
        textTransform: "uppercase",
      }}>
        {label}
      </span>
    </div>
  );
}

function PitchKeyRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: "0.42rem", letterSpacing: "0.1em", color: "rgba(168,196,224,0.28)" }}>
        {label}
      </span>
    </div>
  );
}
