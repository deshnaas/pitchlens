"use client";

/**
 * IncidentEngine — The core investigation experience.
 *
 * Left   — step timeline (clean, focused)
 * Centre — SVG pitch (always the hero)
 * Right  — law/evidence (top) + VAR Assistant powered by Granite (bottom, prominent)
 */

import { useState, useEffect, useCallback, useRef } from "react";
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
import type { VarChatResponse, VarAction } from "@/app/api/var-chat/route";

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
  player, highlighted, highlightColor, dimmed, pulse,
}: {
  player: Player; highlighted: boolean; highlightColor: string; dimmed: boolean; pulse: boolean;
}) {
  const r = player.role === "goalkeeper" ? 1.9 : 1.5;
  return (
    <g style={{ opacity: dimmed ? 0.22 : 1 }}>
      {highlighted && (
        <motion.circle
          cx={player.x} cy={player.y} r={r + 1.8}
          fill="none" stroke={highlightColor} strokeWidth={0.35}
          initial={{ opacity: 0, r }}
          animate={{ opacity: pulse ? [0.7, 1, 0.7] : 0.85, r: r + 1.8 }}
          transition={pulse
            ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 }}
        />
      )}
      <motion.circle
        cx={player.x} cy={player.y} r={r}
        fill={TEAM_FILL[player.team]}
        initial={{ r: 0 }} animate={{ r }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      />
      {player.label && (
        <text
          x={player.x} y={player.y - r - 0.9}
          fill="rgba(255,255,255,0.62)" fontSize={1.65}
          textAnchor="middle" fontFamily="Inter, sans-serif"
          fontWeight={300} style={{ userSelect: "none" }}
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
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      style={{ transformOrigin: `${ball.x}px ${ball.y}px` }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <circle cx={ball.x} cy={ball.y} r={1.05} fill="white" opacity={0.96} />
      <circle cx={ball.x} cy={ball.y} r={1.05} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={0.12} />
    </motion.g>
  );
}

// ── Overlay rendering ─────────────────────────────────────────────────────────

function OverlayLayer({ overlays, players, stepKey }: {
  overlays: Overlay[]; players: Player[]; stepKey: number | string;
}) {
  const getPlayer = (id: string) => players.find(p => p.id === id);

  return (
    <g key={stepKey}>
      {overlays.map((ov, i) => {
        if (ov.type === "zone") {
          const o = ov as ZoneOverlay;
          return (
            <motion.rect key={`z-${i}`}
              x={o.x} y={o.y} width={o.w} height={o.h} fill={o.color}
              initial={{ opacity: 0 }} animate={{ opacity: o.opacity ?? 0.12 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: i * 0.05 }}
            />
          );
        }
        if (ov.type === "offsideLine") {
          const o = ov as OffsideLineOverlay;
          return (
            <motion.path key={`ol-${i}`}
              d={`M ${o.x} 0 L ${o.x} 68`}
              stroke={o.color ?? "rgba(220,80,80,0.85)"} strokeWidth={0.45} fill="none"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.05 }}
            />
          );
        }
        if (ov.type === "line") {
          const o = ov as LineOverlay;
          return (
            <motion.path key={`ln-${i}`}
              d={`M ${o.from.x} ${o.from.y} L ${o.to.x} ${o.to.y}`}
              stroke={o.color} strokeWidth={o.width ?? 0.45}
              strokeDasharray={o.dashed ? "2 1.5" : undefined}
              strokeLinecap="round" fill="none"
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: "easeInOut", delay: o.delay ?? i * 0.08 }}
            />
          );
        }
        if (ov.type === "highlight") {
          const o  = ov as HighlightOverlay;
          const pl = getPlayer(o.playerId);
          if (!pl) return null;
          const r = (pl.role === "goalkeeper" ? 1.9 : 1.5) + 2.2;
          return (
            <motion.circle key={`hl-${i}-${o.playerId}`}
              cx={pl.x} cy={pl.y} r={r}
              fill="none" stroke={o.color} strokeWidth={0.38}
              initial={{ r: r - 2, opacity: 0 }}
              animate={o.pulse
                ? { r, opacity: [0, 0.9, 0.65], strokeWidth: [0.38, 0.55, 0.38] }
                : { r, opacity: 0.85 }}
              transition={o.pulse
                ? { duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }
                : { duration: 0.45, delay: i * 0.05 }}
            />
          );
        }
        if (ov.type === "label") {
          const o = ov as LabelOverlay;
          return (
            <motion.text key={`lb-${i}`}
              x={o.x} y={o.y}
              fill={o.color ?? "rgba(168,196,224,0.9)"}
              fontSize={o.size ?? 2} textAnchor="middle"
              fontFamily="Inter, sans-serif" fontWeight={o.bold ? 600 : 300}
              style={{ letterSpacing: "0.06em", userSelect: "none" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: (o.delay ?? 0.3) + i * 0.05 }}
            >
              {o.text}
            </motion.text>
          );
        }
        if (ov.type === "measurement") {
          const o    = ov as MeasurementOverlay;
          const midX = (o.from.x + o.to.x) / 2;
          const midY = (o.from.y + o.to.y) / 2;
          const color  = o.color ?? "rgba(255,200,80,0.9)";
          const labelY = o.side === "below" ? midY + 2 : midY - 1.2;
          return (
            <g key={`ms-${i}`}>
              <motion.path
                d={`M ${o.from.x} ${o.from.y} L ${o.to.x} ${o.to.y}`}
                stroke={color} strokeWidth={0.38} strokeDasharray="1.2 0.8" fill="none"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
              <motion.path
                d={`M ${o.from.x} ${o.from.y - 1.2} L ${o.from.x} ${o.from.y + 1.2} M ${o.to.x} ${o.to.y - 1.2} L ${o.to.x} ${o.to.y + 1.2}`}
                stroke={color} strokeWidth={0.3} fill="none"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.55 }}
              />
              <motion.text
                x={midX} y={labelY} fill={color} fontSize={1.9}
                textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={300}
                style={{ userSelect: "none" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
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

// ── Chat types ────────────────────────────────────────────────────────────────

interface ChatMessage {
  role     : "assistant" | "user";
  text     : string;
  stepRef? : number;
  timestamp: number;
}

// ── Build incident context string for Granite ─────────────────────────────────

function buildIncidentContext(incident: Incident): string {
  const players = incident.players
    .map(p => `  ${p.name ?? p.id} (${p.team}, ${p.role ?? "player"}) at x=${p.x}m y=${p.y}m`)
    .join("\n");
  return `Incident: ${incident.title}
Match: ${incident.matchContext.teams[0]} vs ${incident.matchContext.teams[1]}, ${incident.matchContext.minute}', Score: ${incident.matchContext.score}
Type: ${incident.type}
Attacking direction: ${incident.attackingDirection}
Ball position at moment of pass: x=${incident.ball.x}m, y=${incident.ball.y}m
Players:\n${players}
Steps:\n${incident.steps.map((s, i) => `  ${i + 1}. ${s.label}: ${s.title}`).join("\n")}`;
}

// ── Main IncidentEngine ───────────────────────────────────────────────────────

interface IncidentEngineProps {
  incident: Incident;
  pov?    : POV;
  onBack? : () => void;
}

export function IncidentEngine({ incident, pov = "referee", onBack }: IncidentEngineProps) {
  const [step,                setStep]                = useState(0);
  const [messages,            setMessages]            = useState<ChatMessage[]>([]);
  const [inputValue,          setInputValue]          = useState("");
  const [isLoading,           setIsLoading]           = useState(false);
  const [assistantHighlights, setAssistantHighlights] = useState<string[]>([]);

  const palette  = POV_PALETTE[pov];
  const stepData = incident.steps[step];
  const isLastStep  = step === incident.steps.length - 1;
  const isFirstStep = step === 0;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const incidentContext = buildIncidentContext(incident);
  const acc = `rgba(${palette.accent},`;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    setMessages([{
      role     : "assistant",
      text     : "The attacker appears beyond the second-last defender at the moment the pass was played. Reviewing Law 11 evidence. Would you like me to walk you through the offside determination?",
      timestamp: Date.now(),
    }]);
  }, [incident.id]);

  // Build highlight map from current step + assistant overrides
  const highlightMap = new Map<string, { color: string; pulse: boolean }>();
  stepData.overlays.forEach(ov => {
    if (ov.type === "highlight") {
      const o = ov as HighlightOverlay;
      highlightMap.set(o.playerId, { color: o.color, pulse: !!o.pulse });
    }
  });
  assistantHighlights.forEach(id => {
    if (!highlightMap.has(id))
      highlightMap.set(id, { color: "rgba(255,200,80,0.9)", pulse: true });
  });
  const hasHighlights = highlightMap.size > 0;

  const goNext = useCallback(() => setStep(s => Math.min(s + 1, incident.steps.length - 1)), [incident.steps.length]);
  const goPrev = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (["ArrowRight", "ArrowDown", " "].includes(e.key)) { e.preventDefault(); goNext(); }
      if (["ArrowLeft",  "ArrowUp"       ].includes(e.key)) { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const applyAction = useCallback((action: VarAction | null) => {
    if (!action) return;
    if (action.type === "goToStep" && typeof action.value === "number")
      setStep(Math.max(0, Math.min(action.value, incident.steps.length - 1)));
    if (action.type === "highlight" && Array.isArray(action.players)) {
      setAssistantHighlights(action.players);
      setTimeout(() => setAssistantHighlights([]), 6000);
    }
  }, [incident.steps.length]);

  const sendMessage = useCallback(async () => {
    const msg = inputValue.trim();
    if (!msg || isLoading) return;
    setInputValue("");
    setAssistantHighlights([]);
    setMessages(prev => [...prev, { role: "user", text: msg, timestamp: Date.now() }]);
    setIsLoading(true);
    try {
      const res  = await fetch("/api/var-chat", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ message: msg, incidentContext, currentStep: step, stepLabel: stepData.label, stepTitle: stepData.title }),
      });
      const data = await res.json() as VarChatResponse;
      setMessages(prev => [...prev, {
        role     : "assistant",
        text     : data.text,
        stepRef  : data.action?.type === "goToStep" ? (data.action.value ?? undefined) : undefined,
        timestamp: Date.now(),
      }]);
      applyAction(data.action);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Analysis feed interrupted. Review the timeline manually.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, incidentContext, step, stepData, applyAction]);

  const quickPrompts = ["Why is this offside?", "Show me the evidence", "Who is the last defender?", "Explain the law"];

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ background: palette.bg, fontFamily: "var(--font-inter), sans-serif", cursor: "none" }}
    >

      {/* ══ LEFT — Timeline ══ */}
      <nav style={{
        width: "200px", flexShrink: 0,
        background: "rgba(0,6,18,0.94)",
        borderRight: `1px solid ${acc}0.07)`,
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 18px 16px", borderBottom: `1px solid ${acc}0.07)`, flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              background: "none", border: "none", padding: 0, cursor: "none",
              color: `${acc}0.35)`, fontSize: "0.46rem",
              letterSpacing: "0.3em", textTransform: "uppercase",
              display: "block", marginBottom: "18px", transition: "color 0.25s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = `${acc}0.72)`)}
            onMouseLeave={e => (e.currentTarget.style.color = `${acc}0.35)`)}
          >
            ← Return
          </button>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.36em", color: `${acc}0.32)`, textTransform: "uppercase" }}>
            VAR Investigation
          </div>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.1em", color: `${acc}0.75)`, marginTop: "5px", fontWeight: 300 }}>
            {incident.matchContext.teams[0]} vs {incident.matchContext.teams[1]}
          </div>
          <div style={{ fontSize: "0.42rem", letterSpacing: "0.18em", color: `${acc}0.28)`, marginTop: "3px" }}>
            {incident.matchContext.minute}&apos; — {incident.matchContext.score}
          </div>
        </div>

        {/* Steps */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {incident.steps.map((s, i) => {
            const isActive = i === step;
            const isPast   = i < step;
            return (
              <button key={i} onClick={() => setStep(i)}
                style={{
                  width: "100%", background: "none", border: "none",
                  borderLeft: isActive ? `2px solid ${acc}0.72)` : "2px solid transparent",
                  backgroundColor: isActive ? `${acc}0.05)` : "transparent",
                  padding: "14px 16px", display: "flex", alignItems: "flex-start",
                  gap: "10px", textAlign: "left", cursor: "none",
                  transition: "background-color 0.25s, border-color 0.25s",
                }}
              >
                <span style={{
                  fontSize: "0.54rem", letterSpacing: "0.1em",
                  color: isActive ? `${acc}0.9)` : isPast ? `${acc}0.4)` : `${acc}0.18)`,
                  fontWeight: 300, minWidth: "20px", paddingTop: "1px", transition: "color 0.25s",
                }}>
                  {(s.id + 1).toString().padStart(2, "0")}
                </span>
                <div>
                  <div style={{
                    fontSize: "0.48rem", letterSpacing: "0.18em", textTransform: "uppercase",
                    color: isActive ? `${acc}0.85)` : isPast ? `${acc}0.35)` : `${acc}0.18)`,
                    fontWeight: 300, lineHeight: 1, transition: "color 0.25s",
                  }}>
                    {s.label}
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }}
                        style={{ fontSize: "0.4rem", letterSpacing: "0.04em", color: `${acc}0.34)`, marginTop: "4px", lineHeight: 1.5, overflow: "hidden" }}
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

        {/* Progress */}
        <div style={{ padding: "14px 16px", borderTop: `1px solid ${acc}0.07)`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {incident.steps.map((_, i) => (
              <motion.div key={i}
                animate={{ flex: i === step ? 2.5 : 1, backgroundColor: i <= step ? `${acc}0.65)` : `${acc}0.14)` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: "2px", borderRadius: "1px" }}
              />
            ))}
          </div>
          <div style={{ fontSize: "0.4rem", letterSpacing: "0.2em", color: `${acc}0.22)`, marginTop: "7px" }}>
            Step {step + 1} of {incident.steps.length}
          </div>
        </div>
      </nav>

      {/* ══ CENTRE — Pitch ══ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          padding: "13px 22px", borderBottom: `1px solid ${acc}0.07)`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <motion.div
              animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(220,80,80,0.95)" }}
            />
            <span style={{ fontSize: "0.46rem", letterSpacing: "0.3em", color: `${acc}0.45)`, textTransform: "uppercase" }}>
              VAR Review Active — {incident.matchContext.minute}&apos;
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span key={step}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
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

        {/* Pitch */}
        <div style={{ flex: 1, padding: "20px 16px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", maxHeight: "100%", aspectRatio: "115/76" }}>
            <SVGPitch>
              <AnimatePresence mode="wait">
                <OverlayLayer key={`ov-${step}`} overlays={stepData.overlays} players={incident.players} stepKey={step} />
              </AnimatePresence>
              {assistantHighlights.length > 0 && (
                <OverlayLayer
                  key={`asst-${assistantHighlights.join("-")}`}
                  overlays={assistantHighlights.map(id => ({ type: "highlight" as const, playerId: id, color: "rgba(255,200,80,0.95)", pulse: true }))}
                  players={incident.players}
                  stepKey={`asst-${assistantHighlights.join("-")}`}
                />
              )}
              {incident.players.map(pl => {
                const hl = highlightMap.get(pl.id);
                return (
                  <PlayerDot key={`${pl.id}-${step}`} player={pl}
                    highlighted={!!hl} highlightColor={hl?.color ?? ""}
                    dimmed={hasHighlights && !hl} pulse={hl?.pulse ?? false}
                  />
                );
              })}
              <BallDot key={`ball-${step}`} ball={incident.ball} />
            </SVGPitch>
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{
          padding: "12px 22px", borderTop: `1px solid ${acc}0.07)`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <motion.button onClick={goPrev} disabled={isFirstStep}
            style={{
              background: "none",
              border: `1px solid ${acc}${isFirstStep ? "0.08)" : "0.2)"}`,
              color: `${acc}${isFirstStep ? "0.15)" : "0.55)"}`,
              padding: "7px 20px", fontSize: "0.44rem", letterSpacing: "0.28em",
              textTransform: "uppercase", cursor: "none", fontFamily: "inherit", transition: "all 0.25s",
            }}
            whileHover={!isFirstStep ? { borderColor: `${acc}0.45)`, color: `${acc}0.85)` } : {}}
          >
            ← Prev
          </motion.button>

          {/* Legend */}
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{ display: "flex", gap: "18px", alignItems: "center" }}
            >
              <PitchLegendItem color="rgba(255,255,255,0.8)"  label="Germany" />
              <PitchLegendItem color="rgba(255,205,55,0.8)"   label="Brazil" />
              {step >= 1 && <PitchLegendItem color="rgba(168,196,224,0.7)" label="Pass line" dash />}
              {step >= 2 && <PitchLegendItem color="rgba(220,80,80,0.8)"  label="Offside line" />}
              {step >= 3 && <PitchLegendItem color="rgba(255,200,80,0.8)" label="Measurement" dash />}
            </motion.div>
          </AnimatePresence>

          {!isLastStep ? (
            <motion.button onClick={goNext}
              style={{
                background: `${acc}0.08)`, border: `1px solid ${acc}0.28)`,
                color: `${acc}0.8)`, padding: "7px 24px", fontSize: "0.44rem",
                letterSpacing: "0.28em", textTransform: "uppercase",
                cursor: "none", fontFamily: "inherit", transition: "all 0.25s",
              }}
              whileHover={{ backgroundColor: `${acc}0.15)`, color: `${acc}1)` }}
            >
              Next →
            </motion.button>
          ) : (
            <motion.button onClick={onBack}
              style={{
                background: "rgba(80,200,120,0.08)", border: "1px solid rgba(80,200,120,0.3)",
                color: "rgba(80,200,120,0.85)", padding: "7px 24px", fontSize: "0.44rem",
                letterSpacing: "0.28em", textTransform: "uppercase",
                cursor: "none", fontFamily: "inherit", transition: "all 0.25s",
              }}
              whileHover={{ backgroundColor: "rgba(80,200,120,0.15)", color: "rgba(80,200,120,1)" }}
            >
              Return ↗
            </motion.button>
          )}
        </div>
      </main>

      {/* ══ RIGHT — Evidence panel (top) + VAR Assistant (bottom, primary) ══ */}
      <aside style={{
        width: "340px", flexShrink: 0,
        background: "rgba(0,6,18,0.94)",
        borderLeft: `1px solid ${acc}0.07)`,
        display: "flex", flexDirection: "column",
      }}>

        {/* ── TOP: Step content (law / evidence / verdict) ── */}
        <div style={{ flexShrink: 0, maxHeight: "46%", overflowY: "auto", borderBottom: `1px solid ${acc}0.09)` }}>
          <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${acc}0.07)` }}>
            <div style={{ fontSize: "0.42rem", letterSpacing: "0.36em", color: `${acc}0.32)`, textTransform: "uppercase" }}>
              Step {String(step + 1).padStart(2, "0")}
            </div>
            <AnimatePresence mode="wait">
              <motion.h2 key={step}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                style={{ fontSize: "0.88rem", fontWeight: 300, letterSpacing: "0.03em", color: `${acc}0.92)`, lineHeight: 1.3, margin: "7px 0 0" }}
              >
                {stepData.title}
              </motion.h2>
            </AnimatePresence>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ padding: "14px 20px 16px", display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <p style={{ fontSize: "0.6rem", letterSpacing: "0.03em", color: "rgba(255,255,255,0.48)", lineHeight: 1.8, fontWeight: 300, margin: 0 }}>
                {stepData.body}
              </p>

              {stepData.lawRef && (
                <div style={{ background: `${acc}0.05)`, border: `1px solid ${acc}0.15)`, padding: "11px 14px" }}>
                  <div style={{ fontSize: "0.38rem", letterSpacing: "0.34em", color: `${acc}0.45)`, textTransform: "uppercase", marginBottom: "7px" }}>
                    Law {stepData.lawRef.number} — {stepData.lawRef.title}
                  </div>
                  <p style={{ fontSize: "0.54rem", letterSpacing: "0.02em", color: `${acc}0.7)`, lineHeight: 1.7, fontWeight: 300, fontStyle: "italic", margin: 0 }}>
                    &ldquo;{stepData.lawRef.text}&rdquo;
                  </p>
                </div>
              )}

              {stepData.technical && (
                <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 13px" }}>
                  <div style={{ fontSize: "0.38rem", letterSpacing: "0.34em", color: `${acc}0.35)`, textTransform: "uppercase", marginBottom: "8px" }}>
                    Technical Data
                  </div>
                  {stepData.technical.map((line, i) => (
                    <div key={i} style={{ display: "flex", gap: "7px", fontSize: "0.5rem", letterSpacing: "0.05em", color: "rgba(255,255,255,0.34)", lineHeight: 1.95, fontWeight: 300 }}>
                      <span style={{ color: `${acc}0.28)`, flexShrink: 0 }}>—</span>{line}
                    </div>
                  ))}
                </div>
              )}

              {stepData.verdict && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  style={{ background: "rgba(220,80,80,0.08)", border: "1px solid rgba(220,80,80,0.28)", padding: "14px 18px", textAlign: "center" }}
                >
                  <div style={{ fontSize: "0.38rem", letterSpacing: "0.36em", color: "rgba(220,80,80,0.5)", textTransform: "uppercase", marginBottom: "8px" }}>
                    VAR Decision
                  </div>
                  <div style={{ fontSize: "1rem", letterSpacing: "0.22em", color: "rgba(220,80,80,0.95)", fontWeight: 200, textTransform: "uppercase" }}>
                    {stepData.verdict.decision}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "0.42rem", letterSpacing: "0.1em", color: "rgba(220,80,80,0.4)", fontWeight: 300 }}>
                    Confidence: {stepData.verdict.confidence}%
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── BOTTOM: VAR ASSISTANT — primary, large ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

          {/* Assistant header */}
          <div style={{
            padding: "14px 20px 12px",
            borderBottom: `1px solid ${acc}0.09)`,
            display: "flex", alignItems: "center", gap: "10px",
            flexShrink: 0,
            background: `${acc}0.02)`,
          }}>
            <motion.div
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: `${acc}0.7)`, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: "0.42rem", letterSpacing: "0.34em", color: `${acc}0.55)`, textTransform: "uppercase", fontWeight: 300 }}>
                VAR Assistant
              </div>
              <div style={{ fontSize: "0.36rem", letterSpacing: "0.12em", color: `${acc}0.25)`, marginTop: "1px" }}>
                Granite · ibm/granite-3-3-8b-instruct
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "4px 0",
            display: "flex", flexDirection: "column",
            scrollbarWidth: "none",
          }}>
            {messages.map((msg, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                  padding: msg.role === "assistant" ? "14px 20px" : "10px 20px",
                  borderBottom: `1px solid ${acc}0.04)`,
                  background: msg.role === "assistant" ? "transparent" : `${acc}0.03)`,
                }}
              >
                {/* Role tag */}
                <div style={{
                  fontSize: "0.38rem", letterSpacing: "0.32em", textTransform: "uppercase",
                  color: msg.role === "assistant" ? `${acc}0.5)` : "rgba(255,255,255,0.22)",
                  marginBottom: "6px", fontWeight: 300,
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  {msg.role === "assistant" ? (
                    <>
                      <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: `${acc}0.6)` }} />
                      VAR OFFICIAL
                    </>
                  ) : (
                    <>
                      <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
                      REVIEWING OFFICER
                    </>
                  )}
                </div>
                {/* Text */}
                <p style={{
                  fontSize: msg.role === "assistant" ? "0.66rem" : "0.58rem",
                  letterSpacing: "0.025em",
                  color: msg.role === "assistant" ? `${acc}0.85)` : "rgba(255,255,255,0.4)",
                  lineHeight: 1.7, fontWeight: 300, margin: 0,
                }}>
                  {msg.text}
                </p>
                {/* Step jump badge */}
                {msg.stepRef !== undefined && (
                  <div style={{
                    marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "5px",
                    fontSize: "0.38rem", letterSpacing: "0.2em",
                    color: `${acc}0.45)`, border: `1px solid ${acc}0.18)`,
                    padding: "3px 8px", textTransform: "uppercase",
                  }}>
                    <span>↗</span> Navigated to Step {(msg.stepRef ?? 0) + 1}
                  </div>
                )}
              </motion.div>
            ))}

            {/* Thinking indicator */}
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ padding: "14px 20px" }}
              >
                <div style={{ fontSize: "0.38rem", letterSpacing: "0.32em", textTransform: "uppercase", color: `${acc}0.5)`, marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.1, repeat: Infinity }}
                    style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: `${acc}0.6)` }}
                  />
                  VAR OFFICIAL
                </div>
                <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  {[0, 0.18, 0.36].map(d => (
                    <motion.div key={d}
                      animate={{ opacity: [0.2, 0.8, 0.2], y: [0, -3, 0] }}
                      transition={{ duration: 1.0, repeat: Infinity, delay: d }}
                      style={{ width: 4, height: 4, borderRadius: "50%", background: `${acc}0.5)` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts — visible until first reply */}
          {messages.length <= 1 && !isLoading && (
            <div style={{ padding: "10px 20px 8px", display: "flex", flexWrap: "wrap", gap: "6px", flexShrink: 0, borderTop: `1px solid ${acc}0.06)` }}>
              <div style={{ width: "100%", fontSize: "0.36rem", letterSpacing: "0.22em", color: `${acc}0.25)`, textTransform: "uppercase", marginBottom: "4px" }}>
                Quick queries
              </div>
              {quickPrompts.map((q, i) => (
                <button key={i}
                  onClick={() => { setInputValue(q); inputRef.current?.focus(); }}
                  style={{
                    background: "none", border: `1px solid ${acc}0.14)`,
                    color: `${acc}0.45)`, padding: "5px 10px",
                    fontSize: "0.48rem", letterSpacing: "0.05em",
                    cursor: "none", fontFamily: "inherit", transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${acc}0.32)`; e.currentTarget.style.color = `${acc}0.72)`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${acc}0.14)`; e.currentTarget.style.color = `${acc}0.45)`; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "12px 16px 14px",
            borderTop: `1px solid ${acc}0.09)`,
            display: "flex", gap: "8px", alignItems: "center",
            flexShrink: 0,
            background: `${acc}0.015)`,
          }}>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
              placeholder="Submit to VAR..."
              style={{
                flex: 1,
                background: `${acc}0.06)`,
                border: `1px solid ${acc}0.14)`,
                color: `${acc}0.88)`,
                padding: "9px 13px",
                fontSize: "0.58rem",
                letterSpacing: "0.04em",
                fontFamily: "inherit",
                outline: "none",
                cursor: "text",
              }}
              onFocus={e  => (e.target.style.borderColor = `${acc}0.35)`)}
              onBlur={e   => (e.target.style.borderColor = `${acc}0.14)`)}
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              style={{
                background: !inputValue.trim() || isLoading ? "none" : `${acc}0.12)`,
                border: `1px solid ${acc}${!inputValue.trim() || isLoading ? "0.1)" : "0.3)"}`,
                color: `${acc}${!inputValue.trim() || isLoading ? "0.18)" : "0.82)"}`,
                padding: "9px 16px",
                fontSize: "0.56rem", letterSpacing: "0.1em",
                cursor: "none", fontFamily: "inherit",
                transition: "all 0.2s", flexShrink: 0,
                textTransform: "uppercase",
              }}
              onMouseEnter={e => { if (inputValue.trim() && !isLoading) { e.currentTarget.style.background = `${acc}0.2)`; e.currentTarget.style.color = `${acc}1)`; }}}
              onMouseLeave={e => { if (inputValue.trim() && !isLoading) { e.currentTarget.style.background = `${acc}0.12)`; e.currentTarget.style.color = `${acc}0.82)`; }}}
            >
              Send
            </button>
          </div>

          {/* Pitch key */}
          <div style={{ padding: "10px 20px 12px", borderTop: `1px solid ${acc}0.07)`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <PitchKeyRow color="rgba(255,255,255,0.75)"  label="Germany" />
              <PitchKeyRow color="rgba(255,205,55,0.75)"   label="Brazil" />
              <PitchKeyRow color="rgba(220,80,80,0.75)"    label="Offside" />
              <PitchKeyRow color="rgba(255,200,80,0.72)"   label="Measure" />
            </div>
          </div>
        </div>
      </aside>

    </div>
  );
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function PitchLegendItem({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <div style={{ width: 18, height: 1.5, flexShrink: 0, background: dash ? "none" : color, borderTop: dash ? `1.5px dashed ${color}` : "none" }} />
      <span style={{ fontSize: "0.4rem", letterSpacing: "0.15em", color: "rgba(168,196,224,0.35)", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function PitchKeyRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: "0.4rem", letterSpacing: "0.1em", color: "rgba(168,196,224,0.28)" }}>{label}</span>
    </div>
  );
}
