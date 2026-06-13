"use client";

/**
 * IncidentEngine — Immersive VAR investigation.
 *
 * Left   — step timeline
 * Centre — SVG pitch (the hero): camera system, spotlight, story overlays, breathing idle
 * Right  — evidence panel (progressive reveal) + VAR Assistant (Granite)
 *
 * Typography guide (rem, base 16px):
 *   0.65rem  ≈ 10px  — micro tags / eyebrows
 *   0.75rem  ≈ 12px  — secondary labels
 *   0.875rem ≈ 14px  — body text
 *   1rem     = 16px  — primary body / panel text
 *   1.1rem   ≈ 18px  — section headings
 *   1.25rem  = 20px  — step titles
 *   1.5rem+          — pitch overlays / verdict
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

// ── POV palettes ──────────────────────────────────────────────────────────────

const POV_PALETTE = {
  referee : { accent: "168,196,224", accentHex: "#a8c4e0", bg: "#050d18" },
  fan     : { accent: "126,207,160", accentHex: "#7ecfa0", bg: "#050e08" },
  supporter:{ accent: "232,168,124", accentHex: "#e8a87c", bg: "#100805" },
} as const;

// ── Camera positions (per step) ───────────────────────────────────────────────

const CAMERA_STEPS = [
  { scale: 1.00, x: "0%",   y: "0%",   origin: "center"  },
  { scale: 1.22, x: "-3%",  y: "-2%",  origin: "74% 46%" },
  { scale: 1.40, x: "-6%",  y: "-1%",  origin: "78% 46%" },
  { scale: 1.58, x: "-9%",  y: "-1%",  origin: "82% 45%" },
  { scale: 1.68, x: "-11%", y: "-1%",  origin: "84% 44%" },
] as const;

// ── Spotlight positions (SVG pitch metres) ────────────────────────────────────

const SPOTLIGHT_STEPS: (null | { cx: number; cy: number; r: number })[] = [
  null,
  { cx: 82, cy: 33, r: 30 },
  { cx: 88, cy: 32, r: 24 },
  { cx: 89, cy: 32, r: 18 },
  { cx: 91, cy: 31, r: 14 },
];

// ── Story cards (broadcast overlays) ─────────────────────────────────────────
// Positioned in the pitch CONTAINER (not camera wrapper) → consistent size.
// As camera zooms right the left side darkens → natural caption zone.

interface StoryCardData {
  left   : string;
  top    : string;
  eyebrow: string;
  headline: string;
  body?  : string;
  accent?: string;
  size?  : "sm" | "md" | "lg";
}

const STORY_CARDS: StoryCardData[] = [
  {
    left: "5%", top: "14%",
    eyebrow : "72′  ·  Incident Detected",
    headline: "Through Ball to Havertz",
    body    : "Müller plays a through ball behind the defensive line. Havertz runs onto the pass. The assistant referee raises their flag.",
    size    : "md",
  },
  {
    left: "5%", top: "56%",
    eyebrow : "Critical Frame",
    headline: "Moment of Pass",
    body    : "Offside is judged at the exact moment the ball leaves the passer's foot. Every position is frozen at this frame.",
    size    : "sm",
  },
  {
    left: "5%", top: "18%",
    eyebrow : "Law 11  ·  Havertz Position",
    headline: "Beyond the Line",
    body    : "The attacker appears ahead of the second-last defender. Any part of the body that can score a goal must be onside.",
    size    : "sm",
  },
  {
    left: "5%", top: "16%",
    eyebrow : "Position Difference",
    headline: "Margin: 3.0m",
    body    : "Havertz at 91.0m  ·  Silva at 88.0m\nThe attacker is clearly beyond the legal position.",
    accent  : "rgba(255,200,80,0.95)",
    size    : "md",
  },
  {
    left: "5%", top: "14%",
    eyebrow : "VAR Decision  ·  Confidence 96%",
    headline: "OFFSIDE\nCONFIRMED",
    body    : "VAR confirms the assistant referee's decision. Indirect free kick awarded to Brazil.",
    accent  : "rgba(220,80,80,0.95)",
    size    : "lg",
  },
];

// ── Team fills ────────────────────────────────────────────────────────────────

const TEAM_FILL = {
  home: "rgba(255,255,255,0.92)",
  away: "rgba(255,205,55,0.92)",
};

// ── PlayerDot ─────────────────────────────────────────────────────────────────

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
          transition={pulse ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
        />
      )}
      <motion.circle
        cx={player.x} cy={player.y} r={r}
        fill={TEAM_FILL[player.team]}
        initial={{ r: 0 }} animate={{ r }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
      {player.label && (
        <text
          x={player.x} y={player.y - r - 0.9}
          fill="rgba(255,255,255,0.72)" fontSize={1.85}
          textAnchor="middle" fontFamily="Inter, sans-serif"
          fontWeight={300} style={{ userSelect: "none" }}
        >
          {player.label}
        </text>
      )}
    </g>
  );
}

// ── BallDot ───────────────────────────────────────────────────────────────────

function BallDot({ ball }: { ball: Ball }) {
  return (
    <motion.g
      initial={{ scale: 0 }} animate={{ scale: 1 }}
      style={{ transformOrigin: `${ball.x}px ${ball.y}px` }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <circle cx={ball.x} cy={ball.y} r={1.05} fill="white" opacity={0.96} />
      <circle cx={ball.x} cy={ball.y} r={1.05} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={0.12} />
    </motion.g>
  );
}

// ── OverlayLayer ──────────────────────────────────────────────────────────────

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
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 + i * 0.08 }}
            />
          );
        }
        if (ov.type === "offsideLine") {
          const o = ov as OffsideLineOverlay;
          return (
            <motion.path key={`ol-${i}`}
              d={`M ${o.x} 0 L ${o.x} 68`}
              stroke={o.color ?? "rgba(220,80,80,0.85)"} strokeWidth={0.45} fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 + i * 0.1 }}
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
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut", delay: o.delay ?? 0.4 + i * 0.1 }}
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
                ? { duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 + i * 0.08 }
                : { duration: 0.55, delay: 0.4 + i * 0.08 }}
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
              transition={{ duration: 0.7, delay: (o.delay ?? 0.5) + i * 0.06 }}
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
                transition={{ duration: 0.9, ease: "easeInOut", delay: 0.6 }}
              />
              <motion.path
                d={`M ${o.from.x} ${o.from.y - 1.2} L ${o.from.x} ${o.from.y + 1.2} M ${o.to.x} ${o.to.y - 1.2} L ${o.to.x} ${o.to.y + 1.2}`}
                stroke={color} strokeWidth={0.3} fill="none"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 1.4 }}
              />
              <motion.text
                x={midX} y={labelY} fill={color} fontSize={1.9}
                textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={300}
                style={{ userSelect: "none" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 1.6 }}
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

// ── PitchVignette ─────────────────────────────────────────────────────────────

function PitchVignette() {
  return (
    <>
      <defs>
        <radialGradient id="cinVignette" cx="50%" cy="50%" r="68%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,22,0.62)" />
        </radialGradient>
      </defs>
      <rect x={-5} y={-4} width={125} height={80} fill="url(#cinVignette)" />
    </>
  );
}

// ── SpotlightOverlay ──────────────────────────────────────────────────────────

function SpotlightOverlay({ step }: { step: number }) {
  const pos = SPOTLIGHT_STEPS[step];
  return (
    <AnimatePresence>
      {pos && (
        <motion.g key={`spt-${step}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        >
          <defs>
            <radialGradient id={`spt-grad-${step}`}
              cx={pos.cx} cy={pos.cy} r={pos.r}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
              <stop offset="55%"  stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,28,0.75)" />
            </radialGradient>
          </defs>
          <rect x={-5} y={-4} width={125} height={80} fill={`url(#spt-grad-${step})`} />
        </motion.g>
      )}
    </AnimatePresence>
  );
}

// ── StoryCard — broadcast-style pitch overlay ─────────────────────────────────

function StoryCard({ data, stepKey, visible }: {
  data: StoryCardData; stepKey: number; visible: boolean;
}) {
  const accentColor = data.accent ?? "rgba(168,196,224,0.8)";
  const isLg = data.size === "lg";
  const isSm = data.size === "sm";

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={`sc-${stepKey}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10, transition: { duration: 0.4, ease: "easeIn" } }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          style={{
            position     : "absolute",
            left         : data.left,
            top          : data.top,
            zIndex       : 18,
            pointerEvents: "none",
            maxWidth     : isLg ? "260px" : isSm ? "210px" : "236px",
          }}
        >
          {/* Legibility halo */}
          <div style={{
            position  : "absolute",
            inset     : "-22px -28px",
            background: "radial-gradient(ellipse at 28% 38%, rgba(0,3,18,0.60) 0%, transparent 70%)",
            zIndex    : -1,
          }} />

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            style={{
              fontSize     : "0.65rem",
              letterSpacing: "0.2em",
              color        : accentColor,
              textTransform: "uppercase",
              fontWeight   : 300,
              marginBottom : "10px",
              opacity      : 0.75,
            }}
          >
            {data.eyebrow}
          </motion.div>

          {/* Accent line */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.55, delay: 0.68, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width          : isLg ? "32px" : "22px",
              height         : "1px",
              background     : accentColor,
              marginBottom   : "13px",
              transformOrigin: "left",
            }}
          />

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.74, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize     : isLg ? "clamp(1.3rem, 3vw, 2rem)" : isSm ? "1rem" : "1.2rem",
              letterSpacing: isLg ? "0.1em" : "0.03em",
              color        : isLg ? (data.accent ?? "rgba(255,255,255,0.96)") : "rgba(255,255,255,0.94)",
              fontWeight   : isLg ? 200 : 300,
              lineHeight   : 1.15,
              textTransform: isLg ? "uppercase" : "none",
              marginBottom : data.body ? "13px" : 0,
              whiteSpace   : "pre-line",
            }}
          >
            {data.headline}
          </motion.div>

          {/* Body */}
          {data.body && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.1 }}
              style={{
                fontSize     : "0.75rem",
                letterSpacing: "0.02em",
                color        : "rgba(255,255,255,0.44)",
                lineHeight   : 1.75,
                fontWeight   : 300,
                margin       : 0,
                whiteSpace   : "pre-line",
              }}
            >
              {data.body}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── AssistantPitchCard ────────────────────────────────────────────────────────

function AssistantPitchCard({ text, accent }: { text: string; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.5 } }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position     : "absolute",
        left         : "5%",
        bottom       : "16%",
        zIndex       : 22,
        pointerEvents: "none",
        maxWidth     : "240px",
      }}
    >
      <div style={{
        position  : "absolute",
        inset     : "-16px -22px",
        background: "radial-gradient(ellipse at 28% 62%, rgba(0,3,18,0.65) 0%, transparent 72%)",
        zIndex    : -1,
      }} />

      <div style={{
        display      : "flex",
        alignItems   : "center",
        gap          : "8px",
        fontSize     : "0.65rem",
        letterSpacing: "0.22em",
        color        : `rgba(${accent},0.6)`,
        textTransform: "uppercase",
        fontWeight   : 300,
        marginBottom : "10px",
      }}>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: "50%", background: `rgba(${accent},0.75)`, flexShrink: 0 }}
        />
        VAR Response
      </div>

      <motion.div
        initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: "20px", height: "1px", background: `rgba(${accent},0.45)`, marginBottom: "10px", transformOrigin: "left" }}
      />

      <p style={{
        fontSize     : "0.82rem",
        letterSpacing: "0.02em",
        color        : `rgba(${accent},0.85)`,
        lineHeight   : 1.72,
        fontWeight   : 300,
        margin       : 0,
      }}>
        {text}
      </p>
    </motion.div>
  );
}

// ── Chat types ────────────────────────────────────────────────────────────────

interface ChatMessage {
  role     : "assistant" | "user";
  text     : string;
  stepRef? : number;
  timestamp: number;
}

function buildIncidentContext(incident: Incident): string {
  const players = incident.players
    .map(p => `  ${p.name ?? p.id} (${p.team}, ${p.role ?? "player"}) at x=${p.x}m y=${p.y}m`)
    .join("\n");
  return `Incident: ${incident.title}
Match: ${incident.matchContext.teams[0]} vs ${incident.matchContext.teams[1]}, ${incident.matchContext.minute}', Score: ${incident.matchContext.score}
Type: ${incident.type}  |  Attacking direction: ${incident.attackingDirection}
Ball at moment of pass: x=${incident.ball.x}m, y=${incident.ball.y}m
Players:\n${players}
Steps:\n${incident.steps.map((s, i) => `  ${i + 1}. ${s.label}: ${s.title}`).join("\n")}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
  const [assistantCard,       setAssistantCard]       = useState<string | null>(null);
  // Verdict dramatic lock — brief pause before verdict overlays appear
  const [verdictLocked,       setVerdictLocked]       = useState(false);
  // Panel active — glow intensifies briefly when assistant transmits
  const [panelActive,         setPanelActive]         = useState(false);

  const assistantCardTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const panelActiveTimer   = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Intro sequence
  const [introPhase, setIntroPhase] = useState<"hold" | "reveal" | "active">("hold");
  useEffect(() => {
    const t1 = setTimeout(() => setIntroPhase("reveal"), 350);
    const t2 = setTimeout(() => setIntroPhase("active"), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [incident.id]);

  // Verdict lock: when entering step 4, hold overlays for 1.4s for dramatic effect
  useEffect(() => {
    if (step === incident.steps.length - 1) {
      setVerdictLocked(true);
      const t = setTimeout(() => setVerdictLocked(false), 1400);
      return () => clearTimeout(t);
    }
  }, [step, incident.steps.length]);

  const palette  = POV_PALETTE[pov];
  const stepData = incident.steps[step];
  const isLastStep  = step === incident.steps.length - 1;
  const isFirstStep = step === 0;
  const cam = CAMERA_STEPS[Math.min(step, CAMERA_STEPS.length - 1)];
  const acc = `rgba(${palette.accent},`;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const incidentContext = buildIncidentContext(incident);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([{
      role     : "assistant",
      text     : "The attacker appears beyond the second-last defender at the moment the pass was played. Reviewing Law 11 evidence. Would you like me to walk you through the offside determination?",
      timestamp: Date.now(),
    }]);
  }, [incident.id]);

  // Highlight map (step overlays + assistant)
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
    setAssistantCard(null);
    clearTimeout(assistantCardTimer.current);
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
      setAssistantCard(data.text);
      assistantCardTimer.current = setTimeout(() => setAssistantCard(null), 7000);
      // Briefly intensify panel glow on transmission received
      clearTimeout(panelActiveTimer.current);
      setPanelActive(true);
      panelActiveTimer.current = setTimeout(() => setPanelActive(false), 2200);
      applyAction(data.action);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Analysis feed interrupted. Review the timeline manually.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, incidentContext, step, stepData, applyAction]);

  const quickPrompts = ["Why is this offside?", "Show me the evidence", "Who is the last defender?", "Explain Law 11"];

  const showOverlays = introPhase === "active" && !verdictLocked;

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ background: palette.bg, fontFamily: "var(--font-inter), Inter, sans-serif", cursor: "none" }}
    >

      {/* ══ LEFT — Timeline ══════════════════════════════════════════════════ */}
      <nav style={{
        width: "220px", flexShrink: 0,
        background  : "rgba(0,4,14,0.97)",
        borderRight : `1px solid ${acc}0.07)`,
        display     : "flex",
        flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 20px 18px", borderBottom: `1px solid ${acc}0.07)`, flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              background: "none", border: "none", padding: 0, cursor: "none",
              color: `${acc}0.38)`, fontSize: "0.7rem",
              letterSpacing: "0.2em", textTransform: "uppercase",
              display: "block", marginBottom: "22px", transition: "color 0.25s",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = `${acc}0.72)`)}
            onMouseLeave={e => (e.currentTarget.style.color = `${acc}0.38)`)}
          >
            ← Return
          </button>
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.28em", color: `${acc}0.32)`, textTransform: "uppercase", marginBottom: "6px" }}>
            VAR Investigation
          </div>
          <div style={{ fontSize: "1rem", letterSpacing: "0.04em", color: `${acc}0.82)`, fontWeight: 300, lineHeight: 1.3 }}>
            {incident.matchContext.teams[0]} vs {incident.matchContext.teams[1]}
          </div>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.1em", color: `${acc}0.32)`, marginTop: "4px" }}>
            {incident.matchContext.minute}&apos; — {incident.matchContext.score}
          </div>
        </div>

        {/* Steps */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {incident.steps.map((s, i) => {
            const isActive = i === step;
            const isPast   = i < step;
            const isLocked = introPhase !== "active" && i > 0;
            return (
              <button key={i} onClick={() => !isLocked && setStep(i)}
                style={{
                  width: "100%", background: "none", border: "none",
                  borderLeft: isActive ? `2px solid ${acc}0.7)` : "2px solid transparent",
                  backgroundColor: isActive ? `${acc}0.05)` : "transparent",
                  padding: "16px 18px", display: "flex", alignItems: "flex-start",
                  gap: "12px", textAlign: "left", cursor: "none",
                  transition: "background-color 0.3s, border-color 0.3s",
                  opacity: isLocked ? 0.28 : 1,
                }}
              >
                <span style={{
                  fontSize: "0.72rem", letterSpacing: "0.08em",
                  color: isActive ? `${acc}0.88)` : isPast ? `${acc}0.42)` : `${acc}0.18)`,
                  fontWeight: 300, minWidth: "24px", paddingTop: "1px", transition: "color 0.3s",
                }}>
                  {(s.id + 1).toString().padStart(2, "0")}
                </span>
                <div>
                  <div style={{
                    fontSize: "0.72rem", letterSpacing: "0.15em", textTransform: "uppercase",
                    color: isActive ? `${acc}0.88)` : isPast ? `${acc}0.38)` : `${acc}0.18)`,
                    fontWeight: 300, lineHeight: 1, transition: "color 0.3s",
                  }}>
                    {s.label}
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }}
                        style={{ fontSize: "0.7rem", color: `${acc}0.38)`, marginTop: "5px", lineHeight: 1.5, overflow: "hidden" }}
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
        <div style={{ padding: "16px 18px", borderTop: `1px solid ${acc}0.07)`, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {incident.steps.map((_, i) => (
              <motion.div key={i}
                animate={{ flex: i === step ? 2.5 : 1, backgroundColor: i <= step ? `${acc}0.65)` : `${acc}0.12)` }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: "2px", borderRadius: "1px" }}
              />
            ))}
          </div>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", color: `${acc}0.28)`, marginTop: "8px" }}>
            Step {step + 1} of {incident.steps.length}
          </div>
        </div>
      </nav>

      {/* ══ CENTRE — Pitch ═══════════════════════════════════════════════════ */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>

        {/* Status bar */}
        <div style={{
          padding: "12px 22px", borderBottom: `1px solid ${acc}0.06)`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          background: "rgba(0,4,14,0.55)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <motion.div
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(220,80,80,0.92)" }}
            />
            <span style={{ fontSize: "0.72rem", letterSpacing: "0.2em", color: `${acc}0.48)`, textTransform: "uppercase" }}>
              VAR Review Active — {incident.matchContext.minute}&apos;
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span key={step}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: introPhase === "active" ? 1 : 0, y: 0 }}
              exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.35 }}
              style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: `${acc}0.38)`, textTransform: "uppercase" }}
            >
              {stepData.label} — {stepData.title}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: "0.65rem", letterSpacing: "0.14em", color: `${acc}0.22)` }}>
            {step + 1} / {incident.steps.length}
          </span>
        </div>

        {/* Pitch container */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "8px 10px 4px", position: "relative", overflow: "hidden",
        }}>

          {/* Story card overlay — broadcast-style caption */}
          {introPhase === "active" && (
            <StoryCard
              data={STORY_CARDS[Math.min(step, STORY_CARDS.length - 1)]}
              stepKey={step}
              visible={!verdictLocked || step !== incident.steps.length - 1}
            />
          )}

          {/* Assistant pitch card */}
          <AnimatePresence>
            {assistantCard && introPhase === "active" && (
              <AssistantPitchCard
                key={`apc-${assistantCard.slice(0, 12)}`}
                text={assistantCard}
                accent={palette.accent}
              />
            )}
          </AnimatePresence>

          {/* Breathing outer wrapper — subtle idle camera life */}
          <motion.div
            animate={{ scale: [1, 1.006, 1, 1.003, 1], y: ["0%", "-0.35%", "0%", "0.18%", "0%"] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", times: [0, 0.25, 0.5, 0.75, 1] }}
            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", inset: 0 }}
          >
            {/* Camera wrapper */}
            <motion.div
              animate={{ scale: cam.scale, x: cam.x, y: cam.y }}
              transition={{ duration: 2.0, ease: [0.25, 0.08, 0.25, 1] }}
              style={{
                width: "100%", maxHeight: "100%", aspectRatio: "115/76",
                transformOrigin: cam.origin, willChange: "transform",
              }}
            >
              <SVGPitch>
                <PitchVignette />

                <AnimatePresence mode="wait">
                  {showOverlays && (
                    <OverlayLayer key={`ov-${step}`} overlays={stepData.overlays} players={incident.players} stepKey={step} />
                  )}
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

                {introPhase === "active" && <SpotlightOverlay step={step} />}
              </SVGPitch>
            </motion.div>
          </motion.div>

          {/* Verdict dramatic pause overlay */}
          <AnimatePresence>
            {verdictLocked && (
              <motion.div
                key="verdict-pause"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.8 } }}
                transition={{ duration: 0.3 }}
                style={{
                  position: "absolute", inset: 0, zIndex: 25, pointerEvents: "none",
                  background: "rgba(0,2,10,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.92, 1, 1, 0.96] }}
                  transition={{ duration: 1.4, times: [0, 0.25, 0.75, 1] }}
                  style={{
                    fontSize: "0.72rem", letterSpacing: "0.52em",
                    color: "rgba(220,80,80,0.7)", textTransform: "uppercase",
                    fontWeight: 300,
                  }}
                >
                  VAR Decision
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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

                  <div style={{ fontSize: "0.72rem", letterSpacing: "0.42em", color: "rgba(220,80,80,0.7)", textTransform: "uppercase", marginBottom: "20px", fontWeight: 300 }}>
                    VAR Review Active
                  </div>

                  <div style={{ fontSize: "clamp(1.2rem, 2.8vw, 1.8rem)", letterSpacing: "0.05em", color: `${acc}0.94)`, fontWeight: 200, lineHeight: 1.2 }}>
                    {incident.title}
                  </div>

                  <div style={{ marginTop: "16px", fontSize: "0.78rem", letterSpacing: "0.18em", color: `${acc}0.38)`, fontWeight: 300 }}>
                    {incident.matchContext.minute}&apos; — {incident.matchContext.teams[0]} vs {incident.matchContext.teams[1]} — {incident.matchContext.score}
                  </div>

                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: [0, 0.6, 0] }}
                    transition={{ duration: 1.8, delay: 0.6, ease: "easeInOut" }}
                    style={{
                      marginTop: "30px", height: "1px", width: "160px",
                      background: `linear-gradient(90deg, transparent, ${acc}0.5), transparent)`,
                      transformOrigin: "left", marginLeft: "auto", marginRight: "auto",
                    }}
                  />

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: introPhase === "reveal" ? [0, 0.45, 0] : 0 }}
                    transition={{ duration: 1.4, delay: 1.2, repeat: 1 }}
                    style={{ marginTop: "18px", fontSize: "0.65rem", letterSpacing: "0.38em", color: `${acc}0.28)`, textTransform: "uppercase" }}
                  >
                    Initialising investigation
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom nav */}
        <div style={{
          padding: "11px 22px",
          borderTop: `1px solid ${acc}0.06)`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          background: "rgba(0,4,14,0.55)",
        }}>
          <motion.button onClick={goPrev} disabled={isFirstStep || introPhase !== "active"}
            style={{
              background: "none",
              border: `1px solid ${acc}${isFirstStep || introPhase !== "active" ? "0.07)" : "0.2)"}`,
              color: `${acc}${isFirstStep || introPhase !== "active" ? "0.14)" : "0.55)"}`,
              padding: "8px 20px", fontSize: "0.78rem", letterSpacing: "0.18em",
              textTransform: "uppercase", cursor: "none", fontFamily: "inherit", transition: "all 0.25s",
            }}
            whileHover={!isFirstStep && introPhase === "active" ? { borderColor: `${acc}0.42)`, color: `${acc}0.88)` } : {}}
          >
            ← Prev
          </motion.button>

          {/* Legend */}
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0 }} animate={{ opacity: introPhase === "active" ? 1 : 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              style={{ display: "flex", gap: "18px", alignItems: "center" }}
            >
              <PitchLegendItem color="rgba(255,255,255,0.78)"  label="Germany" />
              <PitchLegendItem color="rgba(255,205,55,0.78)"   label="Brazil" />
              {step >= 1 && <PitchLegendItem color="rgba(168,196,224,0.68)" label="Pass line" dash />}
              {step >= 2 && <PitchLegendItem color="rgba(220,80,80,0.78)"  label="Offside line" />}
              {step >= 3 && <PitchLegendItem color="rgba(255,200,80,0.78)" label="Measurement" dash />}
            </motion.div>
          </AnimatePresence>

          {!isLastStep ? (
            <motion.button
              onClick={() => { if (introPhase === "active") goNext(); else setIntroPhase("active"); }}
              style={{
                background: `${acc}0.08)`, border: `1px solid ${acc}0.24)`,
                color: `${acc}0.78)`, padding: "8px 24px", fontSize: "0.78rem",
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "none", fontFamily: "inherit", transition: "all 0.25s",
              }}
              whileHover={{ backgroundColor: `${acc}0.16)`, color: `${acc}1)` }}
            >
              {introPhase !== "active" ? "Begin →" : "Next →"}
            </motion.button>
          ) : (
            <motion.button onClick={onBack}
              style={{
                background: "rgba(80,200,120,0.07)", border: "1px solid rgba(80,200,120,0.28)",
                color: "rgba(80,200,120,0.82)", padding: "8px 24px", fontSize: "0.78rem",
                letterSpacing: "0.18em", textTransform: "uppercase",
                cursor: "none", fontFamily: "inherit", transition: "all 0.25s",
              }}
              whileHover={{ backgroundColor: "rgba(80,200,120,0.14)", color: "rgba(80,200,120,1)" }}
            >
              Return ↗
            </motion.button>
          )}
        </div>
      </main>

      {/* ══ RIGHT — Evidence (top) + VAR Assistant (bottom) ═════════════════ */}
      <aside style={{
        width: "340px", flexShrink: 0,
        background: "rgba(0,4,14,0.97)",
        borderLeft: `1px solid ${acc}0.07)`,
        display: "flex", flexDirection: "column",
        boxShadow: panelActive
          ? `inset 0 0 80px rgba(20,55,120,0.14), inset -1px 0 0 rgba(${palette.accent},0.12)`
          : `inset 0 0 50px rgba(10,30,80,0.07)`,
        transition: "box-shadow 0.7s ease",
      }}>

        {/* Evidence panel */}
        <div style={{ flexShrink: 0, maxHeight: "44%", overflowY: "auto", borderBottom: `1px solid ${acc}0.09)` }}>
          <div style={{ padding: "20px 22px 14px", borderBottom: `1px solid ${acc}0.07)` }}>
            <motion.div animate={{ opacity: introPhase === "active" ? 1 : 0 }} transition={{ duration: 0.5 }}>
              <div style={{ fontSize: "0.65rem", letterSpacing: "0.3em", color: `${acc}0.32)`, textTransform: "uppercase", marginBottom: "6px" }}>
                Step {String(step + 1).padStart(2, "0")} — {stepData.type.toUpperCase()}
              </div>
              <AnimatePresence mode="wait">
                <motion.h2 key={step}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  style={{ fontSize: "1.1rem", fontWeight: 300, letterSpacing: "0.02em", color: `${acc}0.92)`, lineHeight: 1.3, margin: "0" }}
                >
                  {stepData.title}
                </motion.h2>
              </AnimatePresence>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0 }} animate={{ opacity: introPhase === "active" ? 1 : 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
              style={{ padding: "14px 22px 16px", display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.35 }}
                style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.48)", lineHeight: 1.82, fontWeight: 300, margin: 0 }}
              >
                {stepData.body}
              </motion.p>

              {stepData.lawRef && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.75, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: `${acc}0.045)`, border: `1px solid ${acc}0.12)`, padding: "13px 15px" }}
                >
                  <div style={{ fontSize: "0.65rem", letterSpacing: "0.28em", color: `${acc}0.45)`, textTransform: "uppercase", marginBottom: "8px" }}>
                    Law {stepData.lawRef.number} — {stepData.lawRef.title}
                  </div>
                  <p style={{ fontSize: "0.82rem", color: `${acc}0.68)`, lineHeight: 1.75, fontWeight: 300, fontStyle: "italic", margin: 0 }}>
                    &ldquo;{stepData.lawRef.text}&rdquo;
                  </p>
                </motion.div>
              )}

              {stepData.technical && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px" }}>
                  <div style={{ fontSize: "0.65rem", letterSpacing: "0.28em", color: `${acc}0.32)`, textTransform: "uppercase", marginBottom: "10px" }}>
                    Technical Data
                  </div>
                  {stepData.technical.map((line, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.6 + i * 0.12 }}
                      style={{ display: "flex", gap: "8px", fontSize: "0.82rem", color: "rgba(255,255,255,0.34)", lineHeight: 2, fontWeight: 300 }}
                    >
                      <span style={{ color: `${acc}0.28)`, flexShrink: 0 }}>—</span>{line}
                    </motion.div>
                  ))}
                </div>
              )}

              {stepData.verdict && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 1.6, duration: 0.9 }}
                  style={{ background: "rgba(220,80,80,0.07)", border: "1px solid rgba(220,80,80,0.22)", padding: "14px 18px", textAlign: "center" }}
                >
                  <div style={{ fontSize: "0.65rem", letterSpacing: "0.3em", color: "rgba(220,80,80,0.5)", textTransform: "uppercase", marginBottom: "8px" }}>
                    VAR Decision
                  </div>
                  <div style={{ fontSize: "1.15rem", letterSpacing: "0.18em", color: "rgba(220,80,80,0.94)", fontWeight: 200, textTransform: "uppercase" }}>
                    {stepData.verdict.decision}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "rgba(220,80,80,0.38)", fontWeight: 300 }}>
                    Confidence: {stepData.verdict.confidence}%
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* VAR Assistant */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>

          {/* Breathing edge light — left border, slow pulse */}
          <motion.div
            animate={{ opacity: [0.28, 0.62, 0.28] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute", left: 0, top: "8%", bottom: "8%", width: "1px",
              background: `linear-gradient(180deg, transparent 0%, ${acc}0.55) 35%, ${acc}0.55) 65%, transparent 100%)`,
              pointerEvents: "none", zIndex: 1,
            }}
          />

          {/* Panel glow overlay — briefly intensifies on transmission */}
          <AnimatePresence>
            {panelActive && (
              <motion.div
                key="panel-glow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 1.0, ease: "easeOut" } }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{
                  position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
                  background: `radial-gradient(ellipse at 50% 20%, rgba(${palette.accent},0.05) 0%, transparent 68%)`,
                }}
              />
            )}
          </AnimatePresence>

          {/* VAR Operations Console Header */}
          <div style={{
            flexShrink: 0,
            borderBottom: `1px solid ${acc}0.09)`,
            position: "relative", overflow: "hidden",
          }}>
            {/* Top edge illumination line */}
            <motion.div
              animate={{ opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute", top: 0, left: "15%", right: "15%", height: "1px",
                background: `linear-gradient(90deg, transparent, ${acc}0.7), ${acc}0.7), transparent)`,
              }}
            />

            {/* System label row */}
            <div style={{
              padding: "13px 22px 0",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: "0.58rem", letterSpacing: "0.42em", color: `${acc}0.24)`, textTransform: "uppercase" }}>
                VAR Operations
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ fontSize: "0.58rem", letterSpacing: "0.18em", color: `${acc}0.18)`, textTransform: "uppercase" }}>
                  Channel 01
                </div>
                <div style={{ width: 1, height: 10, background: `${acc}0.1)` }} />
                <div style={{ fontSize: "0.58rem", letterSpacing: "0.14em", color: `${acc}0.16)`, textTransform: "uppercase" }}>
                  Encrypted
                </div>
              </div>
            </div>

            {/* LIVE indicator row */}
            <div style={{ padding: "11px 22px 0", display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Pulsing ring indicator */}
              <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                <motion.div
                  animate={{ scale: [1, 2.0, 1], opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: `1px solid ${acc}0.55)`,
                  }}
                />
                <motion.div
                  animate={{ opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute", inset: "2px", borderRadius: "50%",
                    background: `${acc}0.82)`,
                  }}
                />
              </div>
              <div style={{ fontSize: "0.75rem", letterSpacing: "0.22em", color: `${acc}0.72)`, textTransform: "uppercase", fontWeight: 300 }}>
                VAR Official Connected
              </div>
            </div>

            {/* Divider with signal markers */}
            <div style={{ padding: "12px 22px 13px", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ flex: 1, height: "1px", background: `${acc}0.07)` }} />
              {/* Signal strength bars */}
              <div style={{ display: "flex", gap: "2px", alignItems: "flex-end" }}>
                {[3, 5, 7, 9, 7].map((h, i) => (
                  <motion.div key={i}
                    animate={{ opacity: [0.3, i < 4 ? 0.7 : 0.25, 0.3] }}
                    transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
                    style={{ width: 2, height: h, background: `${acc}0.55)`, borderRadius: "1px" }}
                  />
                ))}
              </div>
              <div style={{ flex: 1, height: "1px", background: `${acc}0.07)` }} />
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "2px 0", display: "flex", flexDirection: "column", scrollbarWidth: "none" }}>
            {messages.map((msg, i) => {
              const isLatestAssistant = msg.role === "assistant" && i === messages.length - 1;
              return (
              <motion.div key={i}
                initial={{ opacity: 0, y: msg.role === "assistant" ? 10 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: msg.role === "assistant" ? 0.55 : 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  padding: msg.role === "assistant" ? "16px 22px" : "12px 22px",
                  borderBottom: `1px solid ${acc}0.04)`,
                  background: msg.role === "user" ? `${acc}0.028)` : "transparent",
                  position: "relative", overflow: "hidden",
                }}
              >
                {/* Transmission scan line — only on newest assistant message while panel is active */}
                {isLatestAssistant && panelActive && (
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0.55 }}
                    animate={{ scaleX: 1, opacity: 0 }}
                    transition={{ duration: 1.0, ease: "easeOut", delay: 0.1 }}
                    style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                      background: `linear-gradient(90deg, transparent, ${acc}1), ${acc}0.6), transparent)`,
                      transformOrigin: "left", pointerEvents: "none",
                    }}
                  />
                )}

                <div style={{
                  fontSize: "0.65rem", letterSpacing: "0.24em", textTransform: "uppercase",
                  color: msg.role === "assistant" ? `${acc}0.5)` : "rgba(255,255,255,0.22)",
                  marginBottom: "7px", fontWeight: 300,
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  {/* Role indicator dot */}
                  {msg.role === "assistant" ? (
                    <motion.span
                      animate={isLatestAssistant && panelActive
                        ? { opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }
                        : { opacity: 1 }}
                      transition={{ duration: 0.9, repeat: isLatestAssistant && panelActive ? 2 : 0 }}
                      style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: `${acc}0.65)`, flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "rgba(255,255,255,0.22)", flexShrink: 0 }} />
                  )}
                  {msg.role === "assistant" ? "VAR Official" : "Reviewing Officer"}
                </div>
                <p style={{
                  fontSize: msg.role === "assistant" ? "0.88rem" : "0.82rem",
                  color: msg.role === "assistant" ? `${acc}0.85)` : "rgba(255,255,255,0.38)",
                  lineHeight: 1.78, fontWeight: 300, margin: 0,
                }}>
                  {msg.text}
                </p>
                {msg.stepRef !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    style={{
                      marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px",
                      fontSize: "0.62rem", letterSpacing: "0.18em",
                      color: `${acc}0.42)`, border: `1px solid ${acc}0.16)`, padding: "4px 10px", textTransform: "uppercase",
                    }}
                  >
                    ↗ Navigated to Step {(msg.stepRef ?? 0) + 1}
                  </motion.div>
                )}
              </motion.div>
              );
            })}

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
                style={{ padding: "16px 22px", position: "relative", overflow: "hidden" }}
              >
                {/* Scanning line during transmission */}
                <motion.div
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                  style={{
                    position: "absolute", top: 0, left: 0, width: "40%", height: "1px",
                    background: `linear-gradient(90deg, transparent, ${acc}0.5), transparent)`,
                    pointerEvents: "none",
                  }}
                />
                <div style={{ fontSize: "0.65rem", letterSpacing: "0.24em", textTransform: "uppercase", color: `${acc}0.48)`, marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.3, 1] }} transition={{ duration: 0.9, repeat: Infinity }}
                    style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: `${acc}0.65)`, flexShrink: 0 }}
                  />
                  VAR Official
                  <span style={{ fontSize: "0.55rem", color: `${acc}0.28)`, letterSpacing: "0.12em" }}>· Transmitting</span>
                </div>
                <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                  {[0, 0.15, 0.3].map(d => (
                    <motion.div key={d}
                      animate={{ opacity: [0.15, 0.75, 0.15], y: [0, -3.5, 0] }}
                      transition={{ duration: 0.95, repeat: Infinity, delay: d, ease: "easeInOut" }}
                      style={{ width: 5, height: 5, borderRadius: "50%", background: `${acc}0.5)` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && !isLoading && (
            <div style={{ padding: "12px 22px 10px", display: "flex", flexWrap: "wrap", gap: "7px", flexShrink: 0, borderTop: `1px solid ${acc}0.06)` }}>
              <div style={{ width: "100%", fontSize: "0.65rem", letterSpacing: "0.2em", color: `${acc}0.25)`, textTransform: "uppercase", marginBottom: "4px" }}>
                Quick queries
              </div>
              {quickPrompts.map((q, i) => (
                <button key={i}
                  onClick={() => { setInputValue(q); inputRef.current?.focus(); }}
                  style={{
                    background: "none", border: `1px solid ${acc}0.14)`,
                    color: `${acc}0.45)`, padding: "6px 12px",
                    fontSize: "0.75rem", cursor: "none", fontFamily: "inherit", transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${acc}0.32)`; e.currentTarget.style.color = `${acc}0.75)`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${acc}0.14)`; e.currentTarget.style.color = `${acc}0.45)`; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input — comms console */}
          <div style={{
            padding: "0", borderTop: `1px solid ${acc}0.09)`,
            flexShrink: 0, position: "relative",
          }}>
            {/* Active input glow when focused */}
            <div style={{ padding: "11px 16px 13px", display: "flex", gap: "8px", alignItems: "center" }}>
              {/* Mic / channel icon */}
              <div style={{
                width: 26, height: 26, flexShrink: 0,
                border: `1px solid ${acc}0.14)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <motion.div
                  animate={{ opacity: inputValue.trim() ? [0.6, 1, 0.6] : 0.22 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ width: 5, height: 5, borderRadius: "50%", background: `${acc}0.7)` }}
                />
              </div>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Query the investigation..."
                style={{
                  flex: 1, background: "transparent",
                  border: "none", borderBottom: `1px solid ${acc}0.12)`,
                  color: `${acc}0.88)`,
                  padding: "6px 2px", fontSize: "0.875rem",
                  fontFamily: "inherit", outline: "none", cursor: "text",
                  transition: "border-color 0.25s",
                }}
                onFocus={e  => (e.target.style.borderBottomColor = `${acc}0.42)`)}
                onBlur={e   => (e.target.style.borderBottomColor = `${acc}0.12)`)}
              />
              <button onClick={sendMessage} disabled={!inputValue.trim() || isLoading}
                style={{
                  background: !inputValue.trim() || isLoading ? "none" : `${acc}0.09)`,
                  border: `1px solid ${acc}${!inputValue.trim() || isLoading ? "0.08)" : "0.26)"}`,
                  color: `${acc}${!inputValue.trim() || isLoading ? "0.16)" : "0.78)"}`,
                  padding: "7px 14px", fontSize: "0.72rem", letterSpacing: "0.18em",
                  cursor: "none", fontFamily: "inherit", transition: "all 0.2s",
                  textTransform: "uppercase", flexShrink: 0,
                }}
                onMouseEnter={e => { if (inputValue.trim() && !isLoading) { e.currentTarget.style.background = `${acc}0.16)`; e.currentTarget.style.color = `${acc}1)`; }}}
                onMouseLeave={e => { if (inputValue.trim() && !isLoading) { e.currentTarget.style.background = `${acc}0.09)`; e.currentTarget.style.color = `${acc}0.78)`; }}}
              >
                Transmit
              </button>
            </div>
          </div>

          {/* Pitch key */}
          <div style={{ padding: "10px 22px 13px", borderTop: `1px solid ${acc}0.07)`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <PitchKeyRow color="rgba(255,255,255,0.72)"  label="Germany" />
              <PitchKeyRow color="rgba(255,205,55,0.72)"   label="Brazil" />
              <PitchKeyRow color="rgba(220,80,80,0.72)"    label="Offside" />
              <PitchKeyRow color="rgba(255,200,80,0.7)"    label="Measure" />
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
      <span style={{ fontSize: "0.65rem", letterSpacing: "0.12em", color: "rgba(168,196,224,0.38)", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function PitchKeyRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: "0.65rem", letterSpacing: "0.08em", color: "rgba(168,196,224,0.3)" }}>{label}</span>
    </div>
  );
}
