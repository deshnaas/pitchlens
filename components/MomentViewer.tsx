"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { MomentData, EventNav, ChainEvent } from "@/lib/getMomentData";
import type { MatchMeta } from "@/lib/matchData";
import { narrateEvent } from "@/lib/narrateEvent";
import { generateInsights } from "@/lib/tacticalInsight";
import type { TacticalInsight } from "@/lib/tacticalInsight";
import type { DisplayedPlayer, DisplayedScene, CameraMode } from "./TacticalWorld";

const TacticalWorld = dynamic(() => import("./TacticalWorld"), { ssr: false });

export type { DisplayedPlayer, DisplayedScene, CameraMode };

// ─── Animation helpers ────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Player matching ──────────────────────────────────────────────────────────

interface MatchedPair {
  fromX: number; fromY: number; toX: number; toY: number;
  teammate: boolean; actor: boolean; keeper: boolean;
  fromOpacity: number; toOpacity: number;
}

function matchPlayers(from: DisplayedPlayer[], to: MomentData["freeze_frame"]): MatchedPair[] {
  const used: Set<number> = new Set();
  const pairs: MatchedPair[] = [];

  for (const tp of to) {
    let bestIdx = -1, bestDist = Infinity;
    for (let i = 0; i < from.length; i++) {
      if (used.has(i)) continue;
      const fp = from[i];
      if (fp.teammate !== tp.teammate || fp.actor !== tp.actor) continue;
      const d = Math.hypot(fp.x - tp.location[0], fp.y - tp.location[1]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      used.add(bestIdx);
      pairs.push({
        fromX: from[bestIdx].x, fromY: from[bestIdx].y,
        toX: tp.location[0],   toY: tp.location[1],
        teammate: tp.teammate, actor: tp.actor, keeper: tp.keeper,
        fromOpacity: 1, toOpacity: 1,
      });
    } else {
      pairs.push({
        fromX: tp.location[0], fromY: tp.location[1],
        toX: tp.location[0],   toY: tp.location[1],
        teammate: tp.teammate, actor: tp.actor, keeper: tp.keeper,
        fromOpacity: 0, toOpacity: 1,
      });
    }
  }
  for (let i = 0; i < from.length; i++) {
    if (!used.has(i)) {
      const fp = from[i];
      pairs.push({
        fromX: fp.x, fromY: fp.y, toX: fp.x, toY: fp.y,
        teammate: fp.teammate, actor: fp.actor, keeper: fp.keeper,
        fromOpacity: fp.opacity, toOpacity: 0,
      });
    }
  }
  return pairs;
}

function sceneFromMoment(m: MomentData): DisplayedScene {
  return {
    players: m.freeze_frame.map(p => ({
      x: p.location[0], y: p.location[1],
      teammate: p.teammate, actor: p.actor, keeper: p.keeper,
      opacity: 1,
    })),
    location:      m.location,
    va:            m.visible_area,
    vaNext:        m.visible_area,
    vaOpacity:     1,
    vaNextOpacity: 0,
  };
}

// ─── useSceneAnimation ────────────────────────────────────────────────────────

const ANIM_DURATION = 700;

function useSceneAnimation(initial: MomentData) {
  const [scene, setScene] = useState<DisplayedScene>(() => sceneFromMoment(initial));
  const rafRef  = useRef<number | null>(null);
  const dataRef = useRef<{
    pairs: MatchedPair[]; fromLoc: [number,number]; toLoc: [number,number];
    fromVA: number[]; toVA: number[]; toScene: DisplayedScene; start: number;
  } | null>(null);

  const cancelAnim = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    dataRef.current = null;
  }, []);

  const startAnimation = useCallback((
    currentScene: DisplayedScene, nextMoment: MomentData, duration = ANIM_DURATION,
  ) => {
    cancelAnim();
    const toScene = sceneFromMoment(nextMoment);
    dataRef.current = {
      pairs  : matchPlayers(currentScene.players, nextMoment.freeze_frame),
      fromLoc: currentScene.location,
      toLoc  : nextMoment.location,
      fromVA : currentScene.va,
      toVA   : nextMoment.visible_area,
      toScene,
      start  : performance.now(),
    };

    function tick(now: number) {
      const d = dataRef.current;
      if (!d) return;
      const rawT = Math.min((now - d.start) / duration, 1);
      const t    = easeInOutCubic(rawT);
      if (rawT >= 1) { setScene(d.toScene); dataRef.current = null; return; }
      setScene({
        players: d.pairs.map(p => ({
          x: lerp(p.fromX, p.toX, t), y: lerp(p.fromY, p.toY, t),
          teammate: p.teammate, actor: p.actor, keeper: p.keeper,
          opacity: lerp(p.fromOpacity, p.toOpacity, t),
        })),
        location: [lerp(d.fromLoc[0], d.toLoc[0], t), lerp(d.fromLoc[1], d.toLoc[1], t)],
        va:            d.fromVA,
        vaNext:        d.toVA,
        vaOpacity:     lerp(1, 0, Math.min(t * 2, 1)),
        vaNextOpacity: lerp(0, 1, Math.max(t * 2 - 1, 0)),
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [cancelAnim]);

  useEffect(() => () => cancelAnim(), [cancelAnim]);
  return { scene, startAnimation, cancelAnim };
}

// ─── Moment Popup — lightweight, non-blocking ─────────────────────────────────

function MomentPopup({ moment }: { moment: MomentData }) {
  const [opacity, setOpacity] = useState(0);
  const [gone,    setGone]    = useState(false);

  useEffect(() => {
    setOpacity(0);
    setGone(false);
    const t0 = setTimeout(() => setOpacity(1),   30);
    const t1 = setTimeout(() => setOpacity(0), 2200);
    const t2 = setTimeout(() => setGone(true), 3000);
    return () => { [t0,t1,t2].forEach(clearTimeout); };
  }, [moment.event_uuid]);

  if (gone) return null;
  return (
    <div style={{
      position  : "absolute",
      top       : 0,
      left      : 0,
      right     : 0,
      padding   : "9px 20px",
      display   : "flex",
      alignItems: "center",
      gap       : 10,
      background: "linear-gradient(to bottom, rgba(7,9,15,0.78) 0%, transparent 100%)",
      pointerEvents: "none",
      zIndex    : 20,
      opacity,
      transition: `opacity ${opacity === 0 ? "0.80s" : "0.25s"} ease`,
    }}>
      <span style={{
        fontFamily   : "'Barlow Condensed', sans-serif",
        fontSize     : "1.55rem",
        fontWeight   : 900,
        color        : "#f0c028",
        lineHeight   : 1,
        letterSpacing: "-0.02em",
      }}>
        {moment.minute}′
      </span>
      <div style={{ width:1, height:16, background:"rgba(255,255,255,0.15)", flexShrink:0 }} />
      <span style={{
        fontFamily   : "'Barlow Condensed', sans-serif",
        fontSize     : "0.80rem",
        fontWeight   : 900,
        color        : "rgba(255,255,255,0.88)",
        letterSpacing: "0.06em",
        whiteSpace   : "nowrap",
      }}>
        {moment.player.toUpperCase()}
      </span>
      <span style={{ color:"rgba(240,192,40,0.40)", fontWeight:700, fontSize:"0.65rem" }}>·</span>
      <span style={{
        fontFamily   : "'Barlow Condensed', sans-serif",
        fontSize     : "0.65rem",
        fontWeight   : 800,
        color        : "rgba(240,192,40,0.62)",
        letterSpacing: "0.20em",
        whiteSpace   : "nowrap",
      }}>
        {moment.event_type.toUpperCase()}
      </span>
    </div>
  );
}

// ─── Floating Consequence Chain card ─────────────────────────────────────────

const PITCH_W = 200;
const PITCH_H = 112; // 200 × (80/120) ≈ 133 — slightly squished to 112 for compactness

function pitchX(sbX: number) { return (sbX / 120) * PITCH_W; }
function pitchY(sbY: number) { return (sbY / 80)  * PITCH_H; }

function shortType(t: string): string {
  const m: Record<string,string> = {
    "Ball Receipt*":"Receipt","Foul Committed":"Foul","Foul Won":"Foul Won",
    "Goal Keeper":"GK","Miscontrol":"Misctl.","Dispossessed":"Disp.",
    "Carry":"Carry","Pass":"Pass","Shot":"Shot","Dribble":"Dribble",
    "Pressure":"Press","Tackle":"Tackle","Interception":"Intercept",
    "Clearance":"Clear","Block":"Block","Duel":"Duel",
  };
  return m[t] ?? (t.length > 9 ? t.slice(0, 8) + "…" : t);
}

interface FloatingChainCardProps {
  chain        : ChainEvent[];
  activeUuid   : string;
  activeMoment : MomentData;
  locationCache: Record<string, [number,number]>;
  onSelect     : (ev: ChainEvent) => void;
}

function FloatingChainCard({
  chain, activeUuid, activeMoment, locationCache, onSelect,
}: FloatingChainCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll active node into view when it changes
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-active='true']") as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeUuid]);

  // Build trajectory polyline from cached locations
  const trajPoints = chain
    .map(ev => locationCache[ev.event_uuid])
    .filter(Boolean) as [number,number][];

  const polyline = trajPoints.length > 1
    ? trajPoints.map(([x,y]) => `${pitchX(x).toFixed(1)},${pitchY(y).toFixed(1)}`).join(" ")
    : null;

  return (
    <div style={{
      position  : "absolute",
      bottom    : 16,
      left      : 16,
      width     : 232,
      background: "rgba(7,9,15,0.88)",
      border    : "1px solid rgba(255,255,255,0.07)",
      borderLeft: "2px solid rgba(240,192,40,0.40)",
      borderRadius: 7,
      backdropFilter: "blur(14px)",
      zIndex    : 10,
      overflow  : "hidden",
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>

      {/* Header */}
      <div style={{
        padding: "8px 12px 6px",
        display: "flex", alignItems: "center", gap: 8,
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ fontSize:"8px", fontWeight:800, letterSpacing:"0.26em",
          color:"rgba(240,192,40,0.60)", flexShrink:0 }}>
          CONSEQUENCE CHAIN
        </span>
        <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.05)" }} />
        <span style={{ fontSize:"9px", color:"rgba(255,255,255,0.22)", fontWeight:600 }}>
          {chain.length}
        </span>
      </div>

      {/* Mini pitch — trajectory builds as user navigates */}
      <div style={{ padding:"8px 12px 6px" }}>
        <svg
          width={PITCH_W} height={PITCH_H}
          viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
          style={{ display:"block", borderRadius:3, overflow:"hidden" }}
        >
          {/* Pitch fill */}
          <rect width={PITCH_W} height={PITCH_H} fill="#0b1e0b" rx={3} />

          {/* Stripe alternation */}
          {Array.from({length:6},(_,i) => (
            <rect key={i} x={i*(PITCH_W/6)} y={0}
              width={PITCH_W/6} height={PITCH_H}
              fill={i%2===0?"rgba(255,255,255,0.018)":"transparent"} />
          ))}

          {/* Pitch outline */}
          <rect x={1} y={1} width={PITCH_W-2} height={PITCH_H-2}
            fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.7} rx={2} />

          {/* Halfway line */}
          <line x1={PITCH_W/2} y1={0} x2={PITCH_W/2} y2={PITCH_H}
            stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />

          {/* Centre circle */}
          <circle cx={PITCH_W/2} cy={PITCH_H/2} r={PITCH_H*0.17}
            fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} />

          {/* Penalty areas */}
          <rect x={1} y={PITCH_H*0.225} width={PITCH_W*0.170} height={PITCH_H*0.55}
            fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} />
          <rect x={PITCH_W*0.830} y={PITCH_H*0.225} width={PITCH_W*0.170} height={PITCH_H*0.55}
            fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={0.5} />

          {/* Attack direction */}
          <text x={PITCH_W-5} y={PITCH_H/2+2} fontSize={5.5}
            fill="rgba(255,255,255,0.20)" textAnchor="end" dominantBaseline="middle">
            ATTACK →
          </text>

          {/* Trajectory polyline (builds as user navigates) */}
          {polyline && (
            <polyline
              points={polyline}
              fill="none"
              stroke="rgba(240,192,40,0.35)"
              strokeWidth={1.2}
              strokeDasharray="3 3"
            />
          )}

          {/* Cached event dots */}
          {chain.map(ev => {
            const loc = locationCache[ev.event_uuid];
            if (!loc) return null;
            const isActive = ev.event_uuid === activeUuid;
            const cx = pitchX(loc[0]);
            const cy = pitchY(loc[1]);
            return (
              <g key={ev.event_uuid}
                style={{ cursor: ev.has_freeze_frame && !isActive ? "pointer" : "default" }}
                onClick={() => ev.has_freeze_frame && !isActive && onSelect(ev)}
              >
                {isActive && (
                  <circle cx={cx} cy={cy} r={6}
                    fill="rgba(240,192,40,0.15)" stroke="#f0c028" strokeWidth={0.8} />
                )}
                <circle cx={cx} cy={cy} r={isActive ? 3.5 : 2.2}
                  fill={isActive ? "#f0c028" : "rgba(255,255,255,0.45)"}
                  stroke={isActive ? "none" : "rgba(255,255,255,0.20)"}
                  strokeWidth={0.5}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Event node strip — horizontally scrollable */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding  : "6px 10px 8px",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        <div
          ref={scrollRef}
          style={{ display:"flex", alignItems:"center", gap:0, minWidth:"max-content" }}
        >
          {chain.map((ev, i) => {
            const isActive = ev.event_uuid === activeUuid;
            const canNav   = ev.has_freeze_frame && !isActive;
            return (
              <div key={ev.event_uuid} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
                {/* Connector */}
                {i > 0 && (
                  <div style={{
                    width: 10, height:1, flexShrink:0,
                    background: isActive
                      ? "rgba(240,192,40,0.45)"
                      : "rgba(255,255,255,0.10)",
                  }} />
                )}
                {/* Node */}
                <button
                  data-active={isActive ? "true" : undefined}
                  onClick={() => canNav && onSelect(ev)}
                  style={{
                    display      : "flex",
                    flexDirection: "column",
                    alignItems   : "center",
                    gap          : 2,
                    padding      : "4px 6px",
                    background   : isActive ? "rgba(240,192,40,0.12)" : "transparent",
                    border       : isActive
                      ? "1px solid rgba(240,192,40,0.50)"
                      : ev.has_freeze_frame
                        ? "1px solid rgba(255,255,255,0.08)"
                        : "1px solid rgba(255,255,255,0.03)",
                    borderRadius : 4,
                    cursor       : canNav ? "pointer" : "default",
                    flexShrink   : 0,
                    opacity      : ev.has_freeze_frame || isActive ? 1 : 0.30,
                    fontFamily   : "'Barlow Condensed', sans-serif",
                    transition   : "border-color 0.20s, background 0.20s",
                    minWidth     : 40,
                  }}
                >
                  <span style={{ fontSize:"9px", fontWeight:800, letterSpacing:"0.04em",
                    color: isActive ? "#f0c028" : "rgba(255,255,255,0.70)", lineHeight:1 }}>
                    {ev.minute}′
                  </span>
                  <span style={{ fontSize:"7px", fontWeight:700, letterSpacing:"0.04em",
                    color: isActive ? "rgba(240,192,40,0.80)" : "rgba(255,255,255,0.28)",
                    maxWidth:44, overflow:"hidden", textOverflow:"ellipsis",
                    whiteSpace:"nowrap", lineHeight:1 }}>
                    {shortType(ev.event_type)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Camera mode selector ─────────────────────────────────────────────────────

const CAMERA_MODES: { id: CameraMode; label: string; icon: string }[] = [
  { id:"tactical",  label:"TACTICAL",  icon:"⊞" },
  { id:"focus",     label:"FOCUS",     icon:"◎" },
  { id:"broadcast", label:"BROADCAST", icon:"▶" },
];

// ─── POV D-pad controller ─────────────────────────────────────────────────────

function PovController({
  azimuth, onAzimuth,
}: { azimuth: number; onAzimuth: (a: number) => void }) {
  const STEP = Math.PI / 2; // 90° per tap

  // Hold-to-spin: interval fires every 80 ms while a direction button is held
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const azRef       = useRef(azimuth);
  useEffect(() => { azRef.current = azimuth; }, [azimuth]);

  const startSpin = (dir: number) => {
    // Immediate first step
    const next = azRef.current + dir * STEP;
    azRef.current = next;
    onAzimuth(next);
    intervalRef.current = setInterval(() => {
      const n = azRef.current + dir * STEP;
      azRef.current = n;
      onAzimuth(n);
    }, 200);
  };
  const stopSpin = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    width         : 48, height: 48,
    background    : active ? "rgba(34,211,238,0.20)" : "rgba(7,9,15,0.82)",
    border        : `1px solid ${active ? "rgba(34,211,238,0.55)" : "rgba(255,255,255,0.13)"}`,
    borderRadius  : "50%",
    cursor        : "pointer",
    display       : "flex", alignItems: "center", justifyContent: "center",
    color         : active ? "#22d3ee" : "rgba(255,255,255,0.55)",
    fontSize      : "18px",
    backdropFilter: "blur(8px)",
    transition    : "background 0.12s, border-color 0.12s, color 0.12s",
    userSelect    : "none",
    WebkitUserSelect: "none",
    touchAction   : "none",
    flexShrink    : 0,
  });

  const presetBtn = (icon: string, targetAz: number, title: string) => (
    <button
      title={title}
      style={btnStyle(Math.abs(((azimuth - targetAz) % (2*Math.PI) + 3*Math.PI) % (2*Math.PI) - Math.PI) < 0.2)}
      onPointerDown={(e) => { e.preventDefault(); onAzimuth(targetAz); }}
    >{icon}</button>
  );

  return (
    <div style={{
      position   : "absolute",
      bottom     : 24,
      right      : 16,
      zIndex     : 8,
      display    : "flex",
      flexDirection: "column",
      alignItems : "center",
      gap        : 6,
      pointerEvents: "auto",
    }}>
      {/* Label */}
      <div style={{
        fontSize:"7px", fontWeight:800, letterSpacing:"0.22em",
        color:"rgba(34,211,238,0.60)", marginBottom:2,
      }}>SURROUNDINGS</div>

      {/* D-pad grid: 3×3 with corners empty */}
      <div style={{ display:"grid", gridTemplateColumns:"48px 48px 48px", gap:6 }}>
        {/* Row 1: [empty] [forward ▲] [empty] */}
        <div />
        {presetBtn("▲", 0, "Look ahead")}
        <div />

        {/* Row 2: [rotate left] [center reset] [rotate right] */}
        <button
          title="Rotate left"
          style={btnStyle()}
          onPointerDown={(e) => { e.preventDefault(); startSpin(-1); }}
          onPointerUp={stopSpin}
          onPointerLeave={stopSpin}
        >◀</button>

        {/* Center — shows compass direction */}
        <button
          title="Reset view"
          style={{ ...btnStyle(), background:"rgba(34,211,238,0.10)", fontSize:"11px",
            border:"1px solid rgba(34,211,238,0.25)", color:"#22d3ee", fontWeight:800 }}
          onPointerDown={(e) => { e.preventDefault(); onAzimuth(0); }}
        >⊕</button>

        <button
          title="Rotate right"
          style={btnStyle()}
          onPointerDown={(e) => { e.preventDefault(); startSpin(1); }}
          onPointerUp={stopSpin}
          onPointerLeave={stopSpin}
        >▶</button>

        {/* Row 3: [empty] [rear ▼] [empty] */}
        <div />
        {presetBtn("▼", Math.PI, "Look behind")}
        <div />
      </div>

      {/* Side labels */}
      <div style={{ display:"flex", gap:6, marginTop:2 }}>
        {[
          { label:"LEFT",    az: -Math.PI/2 },
          { label:"FORWARD", az: 0 },
          { label:"RIGHT",   az:  Math.PI/2 },
        ].map(({ label, az: a }) => (
          <button key={label}
            style={{
              background: Math.abs(((azimuth - a + 3*Math.PI) % (2*Math.PI)) - Math.PI) < 0.2
                ? "rgba(34,211,238,0.18)" : "rgba(7,9,15,0.72)",
              border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:4, padding:"3px 8px",
              color: "rgba(255,255,255,0.40)",
              fontSize:"7px", fontWeight:800, letterSpacing:"0.14em",
              cursor:"pointer", fontFamily:"'Barlow Condensed', sans-serif",
              backdropFilter:"blur(6px)",
            }}
            onPointerDown={(e) => { e.preventDefault(); onAzimuth(a); }}
          >{label}</button>
        ))}
      </div>
    </div>
  );
}

function CameraModeSelector({ mode, onChange }: {
  mode: CameraMode; onChange: (m: CameraMode) => void;
}) {
  return (
    <div style={{
      position  : "absolute",
      bottom    : 16,
      left      : "50%",
      transform : "translateX(-50%)",
      display   : "flex",
      background: "rgba(7,9,15,0.80)",
      border    : "1px solid rgba(255,255,255,0.10)",
      borderRadius: 8,
      overflow  : "hidden",
      backdropFilter: "blur(8px)",
      zIndex    : 5,
    }}>
      {CAMERA_MODES.map(({ id, label, icon }, i) => {
        const isActive = mode === id;
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            display       : "flex",
            flexDirection : "column",
            alignItems    : "center",
            justifyContent: "center",
            gap           : 3,
            padding       : "8px 18px",
            background    : isActive ? "rgba(240,192,40,0.12)" : "transparent",
            border        : "none",
            borderRight   : i < CAMERA_MODES.length - 1
              ? "1px solid rgba(255,255,255,0.08)" : "none",
            cursor     : "pointer",
            transition : "background 0.18s",
            fontFamily : "'Barlow Condensed', sans-serif",
            minWidth   : 76,
          }}>
            <span style={{ fontSize:"14px", color: isActive ? "#f0c028" : "rgba(255,255,255,0.30)",
              lineHeight:1, transition:"color 0.18s" }}>{icon}</span>
            <span style={{ fontSize:"9px", fontWeight:800, letterSpacing:"0.18em",
              color: isActive ? "#f0c028" : "rgba(255,255,255,0.30)",
              lineHeight:1, transition:"color 0.18s" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color:"#3b82f6", label:"Teammate" },
    { color:"#ef4444", label:"Opponent" },
    { color:"#f0c028", label:"Actor" },
    { color:"#60a5fa", label:"GK", diamond:true },
  ];
  return (
    <div style={{
      position: "absolute", bottom:16, right:16,
      display:"flex", flexDirection:"column", gap:5,
      pointerEvents:"none",
    }}>
      {items.map(({ color, label, diamond }) => (
        <div key={label} style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{
            width:8, height:8, background:color,
            boxShadow:`0 0 6px ${color}`,
            borderRadius: diamond ? 0 : "50%",
            clipPath: diamond ? "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" : undefined,
          }} />
          <span style={{ fontFamily:"'Barlow Condensed', sans-serif",
            fontSize:"10px", fontWeight:700, letterSpacing:"0.12em",
            color:"rgba(255,255,255,0.35)" }}>{label.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Transition card ──────────────────────────────────────────────────────────

function TransitionCard({ from, to, visible }: { from:string; to:string; visible:boolean }) {
  return (
    <div style={{
      position:"absolute", inset:0,
      display:"flex", alignItems:"center", justifyContent:"center",
      pointerEvents:"none", zIndex:10,
      opacity: visible ? 1 : 0,
      transition:"opacity 0.20s ease",
    }}>
      <div style={{
        background:"rgba(7,9,15,0.88)",
        border:"1px solid rgba(240,192,40,0.35)",
        borderRadius:8, padding:"14px 28px", textAlign:"center",
        fontFamily:"'Barlow Condensed', sans-serif",
        backdropFilter:"blur(6px)",
      }}>
        <div style={{ fontSize:"13px", fontWeight:700,
          color:"rgba(255,255,255,0.45)", letterSpacing:"0.06em" }}>{from}</div>
        <div style={{ fontSize:"18px", color:"rgba(240,192,40,0.55)",
          lineHeight:1.2, margin:"4px 0" }}>↓</div>
        <div style={{ fontSize:"13px", fontWeight:800,
          color:"#f0c028", letterSpacing:"0.06em" }}>{to}</div>
      </div>
    </div>
  );
}

// ─── Granite Coach ────────────────────────────────────────────────────────────

type CoachMsg = { id: string; role: "user" | "coach"; text: string };

function getCoachGreeting(m: MomentData): string {
  const et = m.event_type.toLowerCase();
  if (et.includes("goal"))     return `GOAL! ${m.player} scores in minute ${m.minute}! Ask me anything — how did it happen, why couldn't the keeper stop it, or what this means for the match.`;
  if (et.includes("shot"))     return `${m.player} attempts a shot in minute ${m.minute}! Ask me why they shot there, if it was a smart decision, or what the goalkeeper has to do.`;
  if (et.includes("pass"))     return `${m.player} plays a pass at minute ${m.minute}. Passes are the heartbeat of football — ask me why this one matters or what makes a great pass.`;
  if (et.includes("carry"))    return `${m.player} carries the ball at ${m.minute}′. A carry means the player is running with the ball — ask me why that matters and what they're trying to do.`;
  if (et.includes("duel") || et.includes("tackle")) return `${m.player} wins a duel at ${m.minute}′. Two players are competing for the ball — ask me what that means or why winning it matters.`;
  return `${m.player} — ${m.event_type} at minute ${m.minute}. I'm Granite Coach. Ask me anything about this moment in plain language!`;
}

function getCoachFallback(m: MomentData, q: string): string {
  const ql = q.toLowerCase();
  if (ql.includes("looking at"))    return `${m.player} just performed a ${m.event_type.toLowerCase()} — this happens constantly in football. Every touch and decision matters, especially in a high-stakes match like this one.`;
  if (ql.includes("dangerous"))     return `Position is everything. Where ${m.player} is on the pitch, and how many opponents are nearby, determines how dangerous this moment becomes. Pressure from defenders narrows the options.`;
  if (ql.includes("new to footbal")) return `Football is beautifully simple: two teams of 11 try to get a round ball into the opponent's goal. A ${m.event_type.toLowerCase()} like this one is one of the thousands of small actions that make up each match.`;
  if (ql.includes("mistake"))        return `Not every error is obvious. Sometimes the defending team makes things so difficult — closing space, cutting passing lanes — that the attacking player has no good option left.`;
  if (ql.includes("next"))           return `After a ${m.event_type.toLowerCase()}, both teams immediately react — defenders hold their shape, attackers look for new spaces. Football never stops moving.`;
  return `Great question! This ${m.event_type.toLowerCase()} at ${m.minute}′ is a moment where individual skill meets team tactics. The best players read the situation instantly and make the right call.`;
}

const GRANITE_QUICK_QUESTIONS = [
  "What is happening in this moment?",
  "Why is this dangerous?",
  "Who made the mistake?",
  "What happens next?",
  "Explain this player",
  "Explain this tactic",
  "Explain like I'm new to football",
];

const POV_QUICK_QUESTIONS = [
  "What options did this player have?",
  "Who was open for a pass?",
  "Why did they choose this action?",
  "What was the safest decision?",
  "What was the most dangerous option?",
  "How much pressure were they under?",
  "What would the best player do here?",
];

const GraniteCoach = memo(function GraniteCoach({
  moment, povPlayerLabel,
}: { moment: MomentData; povPlayerLabel?: string }) {
  const [msgs,     setMsgs]     = useState<CoachMsg[]>([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([]);
    setInput("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment.event_uuid]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior:"smooth" });
  }, [msgs, loading]);

  const askGranite = useCallback(async (q: string) => {
    if (loading || !q.trim()) return;
    setMsgs(p => [...p, { id: Date.now()+"u", role:"user", text:q }]);
    setLoading(true);

    const ctrl    = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 18000); // 18 s hard cap

    try {
      const res = await fetch("/api/granite", {
        method :"POST",
        headers:{"Content-Type":"application/json"},
        signal : ctrl.signal,
        body   : JSON.stringify({
          matchId  : moment.event_uuid.slice(0,8),
          eventType: moment.event_type,
          player   : moment.player,
          team     : moment.team,
          minute   : String(moment.minute),
          frameLabel: q,
          frameWhy : getCoachFallback(moment, q),
          score    : `${moment.minute}′`,
          mode     : lens === "fan" ? "fan_coach" : lens === "supporter" ? "supporter" : "referee",
          question : q,
        }),
      });
      const data = await res.json();
      setMsgs(p => [...p, { id:Date.now()+"c", role:"coach", text: data.insight || getCoachFallback(moment, q) }]);
    } catch (err: unknown) {
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Took too long — here's what I know: " + getCoachFallback(moment, q)
        : getCoachFallback(moment, q);
      setMsgs(p => [...p, { id:Date.now()+"c", role:"coach", text: msg }]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, moment]);

  const handleSend = () => {
    const q = input.trim(); if (!q) return;
    setInput("");
    askGranite(q);
  };

  const hasConversation = msgs.some(m => m.role === "user");
  const questions = povPlayerLabel ? POV_QUICK_QUESTIONS : GRANITE_QUICK_QUESTIONS;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight:0 }}>
      <style>{`@keyframes gc-pulse{0%,100%{opacity:0.25;transform:scale(0.75)}50%{opacity:1;transform:scale(1.2)}}`}</style>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{
        padding:"10px 18px 9px", flexShrink:0,
        borderBottom:"1px solid rgba(240,192,40,0.12)",
        display:"flex", alignItems:"center", gap:8,
      }}>
        <div style={{
          width:28, height:28, borderRadius:"50%",
          background:"rgba(240,192,40,0.14)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"13px", flexShrink:0,
        }}>⚽</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:"10px", fontWeight:900, letterSpacing:"0.20em", color:"#f0c028" }}>
              GRANITE COACH
            </span>
            <span style={{
              fontSize:"6.5px", fontWeight:800, letterSpacing:"0.10em",
              background:"rgba(240,192,40,0.18)", color:"#f0c028",
              borderRadius:3, padding:"2px 5px",
            }}>AI</span>
          </div>
          <div style={{ fontSize:"7px", color:"rgba(255,255,255,0.30)", letterSpacing:"0.10em", marginTop:1 }}>
            {povPlayerLabel ? `Asking about ${povPlayerLabel}` : "Powered by IBM Granite"}
          </div>
        </div>
        <div style={{ fontSize:"18px", opacity:0.45, flexShrink:0 }}>⭐</div>
      </div>

      {/* ── Idle state: big question chips ───────────────────────────────────── */}
      {!hasConversation && !loading && (
        <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:6,
          scrollbarWidth:"none" }}>
          <div style={{ fontSize:"7.5px", fontWeight:800, letterSpacing:"0.22em",
            color:"rgba(255,255,255,0.22)", marginBottom:4, paddingLeft:2 }}>
            {povPlayerLabel ? `ASK ABOUT ${povPlayerLabel.toUpperCase()}` : "QUICK QUESTIONS"}
          </div>
          {questions.map(q => (
            <button key={q} onClick={() => askGranite(q)} style={{
              background:"rgba(255,255,255,0.035)",
              border:"1px solid rgba(255,255,255,0.09)",
              borderLeft:"3px solid rgba(240,192,40,0.35)",
              borderRadius:"0 6px 6px 0",
              padding:"10px 13px",
              cursor:"pointer",
              fontFamily:"'Barlow Condensed', sans-serif",
              fontSize:"0.86rem", fontWeight:600, letterSpacing:"0.03em",
              color:"rgba(255,255,255,0.65)",
              textAlign:"left",
              width:"100%",
              transition:"background 0.14s, color 0.14s, border-color 0.14s",
            }}
              onMouseOver={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(240,192,40,0.07)";
                el.style.color = "#ffffff";
                el.style.borderLeftColor = "#f0c028";
              }}
              onMouseOut={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.035)";
                el.style.color = "rgba(255,255,255,0.65)";
                el.style.borderLeftColor = "rgba(240,192,40,0.35)";
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Active conversation thread ────────────────────────────────────────── */}
      {(hasConversation || loading) && (
        <div ref={scrollRef} style={{
          flex:1, overflowY:"auto", minHeight:0,
          display:"flex", flexDirection:"column", gap:8,
          padding:"10px 14px 6px",
          scrollbarWidth:"thin",
          scrollbarColor:"rgba(255,255,255,0.06) transparent",
        }}>
          {msgs.filter(m => m.role === "user" || m.role === "coach").map(m => (
            <div key={m.id} style={{
              padding    : "10px 13px",
              background : m.role==="coach" ? "rgba(240,192,40,0.05)" : "rgba(255,255,255,0.04)",
              border     : "1px solid " + (m.role==="coach" ? "rgba(240,192,40,0.18)" : "rgba(255,255,255,0.06)"),
              borderLeft : "3px solid " + (m.role==="coach" ? "rgba(240,192,40,0.55)" : "rgba(255,255,255,0.15)"),
              borderRadius:"0 7px 7px 7px",
              flexShrink :0,
            }}>
              <div style={{ fontSize:"7px", fontWeight:800, letterSpacing:"0.18em", marginBottom:5,
                color: m.role==="coach" ? "rgba(240,192,40,0.70)" : "rgba(255,255,255,0.28)" }}>
                {m.role==="coach" ? "GRANITE COACH" : "YOU"}
              </div>
              <p style={{ margin:0, fontSize:"0.85rem", lineHeight:1.65,
                color: m.role==="coach" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)" }}>
                {m.text}
              </p>
            </div>
          ))}

          {/* Loading dots */}
          {loading && (
            <div style={{ padding:"11px 13px",
              background:"rgba(240,192,40,0.04)",
              border:"1px solid rgba(240,192,40,0.16)",
              borderLeft:"3px solid rgba(240,192,40,0.45)",
              borderRadius:"0 7px 7px 7px", flexShrink:0 }}>
              <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                {[0,140,280].map(d => (
                  <span key={d} style={{
                    width:7, height:7, borderRadius:"50%",
                    background:"rgba(240,192,40,0.75)", display:"inline-block",
                    animation:`gc-pulse 0.82s ${d}ms ease-in-out infinite`,
                  }} />
                ))}
                <span style={{ marginLeft:5, fontSize:"0.72rem",
                  color:"rgba(240,192,40,0.50)", letterSpacing:"0.08em" }}>
                  Granite thinking…
                </span>
              </div>
            </div>
          )}

          {/* Follow-up chips after conversation */}
          {!loading && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, paddingTop:2 }}>
              {questions.slice(0, 4).map(q => (
                <button key={q} onClick={() => askGranite(q)} style={{
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(255,255,255,0.09)",
                  borderRadius:4, padding:"5px 10px",
                  cursor:"pointer", fontFamily:"'Barlow Condensed', sans-serif",
                  fontSize:"0.75rem", fontWeight:600,
                  color:"rgba(255,255,255,0.45)",
                  transition:"color 0.12s, border-color 0.12s",
                }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.80)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(240,192,40,0.35)";
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.09)";
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Input bar ────────────────────────────────────────────────────────── */}
      <div style={{ flexShrink:0, padding:"8px 14px 12px", display:"flex", gap:7,
        borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { e.stopPropagation(); if (e.key==="Enter") handleSend(); }}
          placeholder="Ask anything about this moment…"
          style={{
            flex:1, background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.10)",
            borderRadius:6, padding:"9px 12px",
            color:"rgba(255,255,255,0.85)", fontSize:"0.82rem",
            fontFamily:"'Barlow Condensed', sans-serif",
            outline:"none",
          }}
        />
        <button disabled={!input.trim() || loading} onClick={handleSend} style={{
          background  : input.trim() && !loading ? "rgba(240,192,40,0.18)" : "rgba(240,192,40,0.06)",
          border      :"1px solid rgba(240,192,40,0.30)",
          borderRadius:6, padding:"9px 14px",
          cursor      : input.trim() && !loading ? "pointer" : "default",
          color       : input.trim() && !loading ? "#f0c028" : "rgba(240,192,40,0.25)",
          fontSize    :"16px", lineHeight:1,
          transition  :"all 0.16s",
        }}>➤</button>
      </div>
    </div>
  );
});

// ─── Narrative panel ──────────────────────────────────────────────────────────

const NarrativePanel = memo(function NarrativePanel({
  moment, chain,
}: { moment: MomentData; chain: ChainEvent[] }) {
  const n = narrateEvent(moment, chain);
  return (
    <div style={{ padding:"0 20px" }}>
      <div style={{ fontSize:"9px", fontWeight:800, letterSpacing:"0.28em",
        color:"rgba(240,192,40,0.55)", marginBottom:12 }}>THE MOMENT</div>
      {n.moment.map((line, i) => (
        <p key={i} style={{ margin:"0 0 10px",
          fontSize: i===0 ? "1.00rem" : "0.83rem",
          fontWeight: i===0 ? 700 : 400,
          fontStyle: i>0 ? "italic" : "normal",
          lineHeight:1.62,
          color: i===0 ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.52)" }}>{line}</p>
      ))}
    </div>
  );
});

// ─── Tactical insight card ────────────────────────────────────────────────────

const TONE_COLOR: Record<TacticalInsight["tone"], string> = {
  positive: "#34d399",
  warning : "#f87171",
  neutral : "rgba(240,192,40,0.70)",
};

const TacticalInsightCard = memo(function TacticalInsightCard({
  moment, chain,
}: { moment: MomentData; chain: ChainEvent[] }) {
  const insights = generateInsights(moment, chain, 4);
  if (insights.length === 0) return null;
  return (
    <div style={{ padding:"0 20px" }}>
      <div style={{ fontSize:"9px", fontWeight:800, letterSpacing:"0.28em",
        color:"rgba(240,192,40,0.55)", marginBottom:14 }}>TACTICAL INSIGHT</div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{
            display:"flex", gap:12, alignItems:"flex-start",
            padding:"10px 12px",
            background:"rgba(255,255,255,0.025)",
            border:"1px solid rgba(255,255,255,0.06)",
            borderLeft:`2px solid ${TONE_COLOR[ins.tone]}`,
            borderRadius:5,
          }}>
            <div style={{ flexShrink:0, paddingTop:1 }}>
              <div style={{ fontSize:"7.5px", fontWeight:800, letterSpacing:"0.20em",
                color:TONE_COLOR[ins.tone], lineHeight:1, whiteSpace:"nowrap" }}>
                {ins.label}
              </div>
            </div>
            <div style={{ width:1, alignSelf:"stretch", flexShrink:0,
              background:"rgba(255,255,255,0.07)" }} />
            <p style={{ margin:0, fontSize:"0.79rem", lineHeight:1.60,
              color:"rgba(255,255,255,0.62)", fontWeight:400 }}>{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export interface MomentViewerProps {
  moment    : MomentData;
  matchKey  : string;
  team      : string;
  allEvents : EventNav[];
  currentIdx: number;
  chain     : ChainEvent[];
  lens?     : "fan" | "referee" | "tactical" | "supporter";
  matchMeta?: MatchMeta | null;
}

function AutoDismiss({ onDismiss, delay }: { onDismiss: () => void; delay: number }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, delay);
    return () => clearTimeout(t);
  }, [onDismiss, delay]);
  return null;
}

export default function MomentViewer({
  moment: initialMoment, matchKey, team, chain, lens, allEvents, matchMeta,
}: MomentViewerProps) {
  const router = useRouter();

  const [activeMoment, setActiveMoment] = useState<MomentData>(initialMoment);
  const [activeUuid,   setActiveUuid]   = useState(initialMoment.event_uuid);
  // Referee lens defaults to top-down tactical view; all other lenses broadcast
  const [cameraMode,   setCameraMode]   = useState<CameraMode>(() =>
    lens === "referee" ? "tactical" : "broadcast"
  );
  const [loading,      setLoading]      = useState(false);
  const [povPlayerIdx,   setPovPlayerIdx]   = useState<number | null>(null);
  const [povPlayerLabel, setPovPlayerLabel] = useState<string>("");
  const [povAzimuth,     setPovAzimuth]     = useState<number>(0);
  const [panMode,        setPanMode]        = useState(false);
  const [showPovHint,   setShowPovHint]    = useState(true);

  // Double-tap-to-pan: two pointer-downs within 300ms toggle pan mode
  const lastTapRef = useRef<number>(0);
  const handleCanvasTap = useCallback(() => {
    if (cameraMode === "pov") return; // no pan in POV
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setPanMode(p => !p);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [cameraMode]);

  const { scene, startAnimation } = useSceneAnimation(initialMoment);
  const sceneRef = useRef(scene);
  useEffect(() => { sceneRef.current = scene; }, [scene]);

  // Drag-to-scroll — only captures pointer after 4px movement so clicks still fire
  const panelRef       = useRef<HTMLDivElement>(null);
  const dragRef        = useRef({ down: false, dragging: false, startY: 0, startTop: 0, pid: -1 });
  const onPanelPtrDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current; if (!panel) return;
    dragRef.current = { down: true, dragging: false, startY: e.clientY, startTop: panel.scrollTop, pid: e.pointerId };
  };
  const onPanelPtrMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current; if (!d.down || !panelRef.current) return;
    const dy = e.clientY - d.startY;
    if (!d.dragging) {
      if (Math.abs(dy) < 4) return;
      d.dragging = true;
      panelRef.current.setPointerCapture(d.pid);
    }
    panelRef.current.scrollTop = d.startTop - dy;
  };
  const onPanelPtrUp  = () => { dragRef.current.down = false; dragRef.current.dragging = false; };

  // Location cache — grows as user navigates; used to draw mini-map trajectory
  const [locationCache, setLocationCache] = useState<Record<string, [number,number]>>(() => ({
    [initialMoment.event_uuid]: initialMoment.location as [number,number],
  }));
  useEffect(() => {
    setLocationCache(prev => ({
      ...prev,
      [activeMoment.event_uuid]: activeMoment.location as [number,number],
    }));
  }, [activeMoment]);

  const [transLabel,   setTransLabel]   = useState<{ from:string; to:string } | null>(null);
  const [labelVisible, setLabelVisible] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const navigable    = chain.filter(e => e.has_freeze_frame);
  const chainIdx     = navigable.findIndex(e => e.event_uuid === activeUuid);
  const activeAllIdx = allEvents.findIndex(e => e.event_uuid === activeUuid);

  // Within-chain navigation
  const prevChain = chainIdx > 0 ? navigable[chainIdx - 1] : null;
  const nextChain = chainIdx !== -1 && chainIdx < navigable.length - 1 ? navigable[chainIdx + 1] : null;

  // Fall through to full match event list when chain is exhausted
  const asChain = (ev: EventNav): ChainEvent =>
    ({ ...ev, has_freeze_frame: true, is_current: false });
  const prevOverflow = !prevChain && activeAllIdx > 0
    ? asChain(allEvents[activeAllIdx - 1]) : null;
  const nextOverflow = !nextChain && activeAllIdx !== -1 && activeAllIdx < allEvents.length - 1
    ? asChain(allEvents[activeAllIdx + 1]) : null;

  const prevTarget = prevChain ?? prevOverflow;
  const nextTarget = nextChain ?? nextOverflow;

  function eventLabel(ev: { minute: number; event_type: string }) {
    return `${ev.minute}′  ${ev.event_type}`;
  }

  const navigateTo = useCallback(async (target: ChainEvent) => {
    if (target.event_uuid === activeUuid || loading) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    setTransLabel({ from: eventLabel(activeMoment), to: eventLabel(target) });
    setLabelVisible(true);

    try {
      const res = await fetch(
        `/api/moment?matchId=${encodeURIComponent(matchKey)}&uuid=${encodeURIComponent(target.event_uuid)}`,
        { signal: ctrl.signal }
      );
      if (!res.ok) throw new Error("not found");
      const data: MomentData = await res.json();

      setActiveMoment(data);
      setActiveUuid(target.event_uuid);
      startAnimation(sceneRef.current, data, ANIM_DURATION);

      setTimeout(() => {
        setLabelVisible(false);
        setTimeout(() => setTransLabel(null), 220);
      }, ANIM_DURATION + 80);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setLabelVisible(false);
        setTransLabel(null);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUuid, activeMoment, matchKey, loading, startAnimation]);

  const handlePlayerClick = useCallback((idx: number) => {
    const p = scene.players[idx];
    if (!p) return;
    let label = "Player";
    if (p.actor)   label = activeMoment.player;
    else if (p.keeper && p.teammate)  label = "GK (Team)";
    else if (p.keeper && !p.teammate) label = "GK (Opp)";
    else if (p.teammate)  label = "Teammate";
    else label = "Opponent";
    setPovPlayerIdx(idx);
    setPovPlayerLabel(label);
    setPovAzimuth(0);       // always start facing player's attacking direction
    setCameraMode("pov");
    setShowPovHint(false);
  }, [scene.players, activeMoment.player]);

  const exitPov = useCallback(() => {
    setPovPlayerIdx(null);
    setPovPlayerLabel("");
    setPovAzimuth(0);
    setCameraMode("broadcast");
  }, []);

  return (
    <div style={{
      display:"flex", height:"100vh", width:"100vw",
      background:"#07090f",
      fontFamily:"'Barlow Condensed', 'Helvetica Neue', sans-serif",
      overflow:"hidden", color:"#e8e8e8",
    }}>

      {/* ── LEFT: 3D Tactical World ───────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ flex:1, position:"relative", overflow:"hidden", minHeight:0 }}
          onPointerDown={handleCanvasTap}>
          {/* Pan mode indicator */}
          {panMode && cameraMode !== "pov" && (
            <div style={{
              position:"absolute", top:10, left:"50%", transform:"translateX(-50%)",
              zIndex:9, background:"rgba(240,192,40,0.18)",
              border:"1px solid rgba(240,192,40,0.45)", borderRadius:20,
              padding:"4px 14px", fontSize:"9px", fontWeight:800,
              letterSpacing:"0.20em", color:"#f0c028", pointerEvents:"none",
            }}>
              PAN MODE · double-tap to exit
            </div>
          )}
          <TacticalWorld
            scene={scene}
            cameraMode={cameraMode}
            playerName={activeMoment.player}
            eventType={activeMoment.event_type}
            onActorDoubleClick={() => setCameraMode("focus")}
            fanMode={true}
            povPlayerIdx={povPlayerIdx}
            onPlayerClick={handlePlayerClick}
            povAzimuth={povAzimuth}
            supporterTeam={lens === "supporter"
              ? (team || matchMeta?.home.name || "")
              : undefined}
            lens={lens}
            panMode={panMode}
          />

          {/* ── POV onboarding hint ─────────────────────────────────── */}
          {showPovHint && cameraMode !== "pov" && (
            <div style={{
              position:"absolute", bottom:60, left:"50%",
              transform:"translateX(-50%)",
              zIndex:10, pointerEvents:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:6,
              animation:"pov-hint-in 0.5s ease both",
            }}>
              <style>{`
                @keyframes pov-hint-in{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
                @keyframes pov-hint-out{from{opacity:1}to{opacity:0}}
              `}</style>
              <div style={{
                background:"rgba(6,10,20,0.82)",
                backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,0.14)",
                borderRadius:10,
                padding:"10px 18px",
                display:"flex", alignItems:"center", gap:10,
                boxShadow:"0 4px 24px rgba(0,0,0,0.45)",
              }}>
                <div style={{
                  width:32, height:32, borderRadius:"50%",
                  background:"rgba(240,192,40,0.15)",
                  border:"1.5px solid rgba(240,192,40,0.50)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"15px", flexShrink:0,
                }}>👤</div>
                <div>
                  <div style={{ fontSize:"9.5px", fontWeight:900, letterSpacing:"0.18em",
                    color:"#f0c028", marginBottom:2 }}>
                    PLAYER POV
                  </div>
                  <div style={{ fontSize:"11px", fontWeight:600,
                    color:"rgba(255,255,255,0.80)", lineHeight:1.4 }}>
                    Tap any player on the pitch to see
                  </div>
                  <div style={{ fontSize:"11px", fontWeight:600,
                    color:"rgba(255,255,255,0.80)", lineHeight:1.4 }}>
                    the match through their eyes
                  </div>
                </div>
              </div>
              <div style={{
                width:2, height:14,
                background:"rgba(255,255,255,0.20)",
                borderRadius:2,
              }} />
              <div style={{
                width:8, height:8, borderRadius:"50%",
                background:"rgba(240,192,40,0.60)",
                boxShadow:"0 0 8px rgba(240,192,40,0.80)",
              }} />
              {/* Auto-dismiss after 4 s */}
              <AutoDismiss onDismiss={() => setShowPovHint(false)} delay={4000} />
            </div>
          )}

          {/* POV Mode overlay — top-left badge + exit button */}
          {cameraMode === "pov" && (
            <div style={{
              position:"absolute", top:10, left:12, zIndex:8,
              display:"flex", flexDirection:"column", gap:6,
              pointerEvents:"auto",
            }}>
              {/* Badge */}
              <div style={{
                background:"rgba(7,9,15,0.88)",
                border:"1px solid rgba(255,255,255,0.14)",
                borderRadius:6, padding:"8px 12px",
                backdropFilter:"blur(8px)",
              }}>
                <div style={{
                  fontSize:"8px", fontWeight:800, letterSpacing:"0.22em",
                  color:"#22d3ee", marginBottom:4,
                }}>PLAYER POV</div>
                <div style={{
                  fontSize:"13px", fontWeight:900, letterSpacing:"0.10em",
                  color:"#f0f0f0",
                }}>{povPlayerLabel.toUpperCase()}</div>
                <div style={{
                  fontSize:"8px", letterSpacing:"0.12em", marginTop:3,
                  color:"rgba(255,255,255,0.35)",
                }}>CLICK PLAYER TO SWITCH POV</div>
              </div>
              {/* Legend */}
              <div style={{
                background:"rgba(7,9,15,0.78)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:5, padding:"7px 10px",
                backdropFilter:"blur(6px)",
                display:"flex", flexDirection:"column", gap:4,
              }}>
                {[
                  { color:"#22d3ee", label:"Open passing lane" },
                  { color:"#f97316", label:"Blocked lane" },
                  { color:"#ef4444", label:"Opponent pressure" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{ width:16, height:2, background:color, borderRadius:1 }} />
                    <span style={{ fontSize:"8px", fontWeight:700, letterSpacing:"0.12em",
                      color:"rgba(255,255,255,0.45)" }}>{label}</span>
                  </div>
                ))}
              </div>
              {/* Exit button */}
              <button onClick={exitPov} style={{
                background:"rgba(239,68,68,0.12)",
                border:"1px solid rgba(239,68,68,0.30)",
                borderRadius:5, padding:"7px 12px",
                color:"#fca5a5", cursor:"pointer",
                fontSize:"9px", fontWeight:800, letterSpacing:"0.18em",
                fontFamily:"'Barlow Condensed', sans-serif",
                backdropFilter:"blur(6px)",
                transition:"background 0.15s",
              }}>← EXIT POV</button>
            </div>
          )}

          {/* Non-blocking moment popup */}
          <MomentPopup key={activeUuid} moment={activeMoment} />

          {/* Reset camera button — top-right */}
          <button
            onClick={() => setCameraMode("broadcast")}
            title="Reset to broadcast view"
            style={{
              position      : "absolute",
              top           : 10,
              right         : 12,
              width         : 30,
              height        : 30,
              background    : "rgba(7,9,15,0.78)",
              border        : "1px solid rgba(255,255,255,0.11)",
              borderRadius  : "50%",
              cursor        : "pointer",
              color         : "rgba(255,255,255,0.42)",
              fontSize      : "15px",
              display       : "flex",
              alignItems    : "center",
              justifyContent: "center",
              backdropFilter: "blur(6px)",
              zIndex        : 6,
              lineHeight    : 1,
              padding       : 0,
              transition    : "color 0.18s, border-color 0.18s",
              fontFamily    : "sans-serif",
            }}
          >↺</button>

          {/* Floating consequence chain — bottom-left */}
          <FloatingChainCard
            chain={chain}
            activeUuid={activeUuid}
            activeMoment={activeMoment}
            locationCache={locationCache}
            onSelect={navigateTo}
          />

          {/* Camera mode selector — hidden in POV, shown otherwise */}
          {cameraMode !== "pov" && (
            <CameraModeSelector mode={cameraMode} onChange={setCameraMode} />
          )}

          {/* POV D-pad controller — only in POV mode */}
          {cameraMode === "pov" && (
            <PovController azimuth={povAzimuth} onAzimuth={setPovAzimuth} />
          )}

          {/* Legend — bottom-right */}
          <Legend />

          {/* Transition label */}
          {transLabel && (
            <TransitionCard from={transLabel.from} to={transLabel.to} visible={labelVisible} />
          )}
        </div>
      </div>

      {/* ── RIGHT: Info panel ─────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        onPointerDown={onPanelPtrDown}
        onPointerMove={onPanelPtrMove}
        onPointerUp={onPanelPtrUp}
        onPointerLeave={onPanelPtrUp}
        style={{
          width:340, flexShrink:0,
          display:"flex", flexDirection:"column",
          borderLeft:"1px solid rgba(255,255,255,0.06)",
          background:"rgba(255,255,255,0.012)",
          overflowY:"auto",
          userSelect:"none",
          scrollbarWidth:"none",
        }}
      >
        {/* Back + match score header */}
        <div style={{ flexShrink:0 }}>
          {/* Back row */}
          <div style={{ padding:"14px 20px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button onClick={() => {
              if (lens === "fan")       { router.push("/fan"); }
              else if (lens === "referee")  { router.push("/referee"); }
              else if (lens === "supporter") { router.push("/supporter"); }
              else { router.back(); }
            }} style={{
              background:"none", border:"1px solid rgba(255,255,255,0.10)",
              borderRadius:4, padding:"4px 11px",
              color:"rgba(255,255,255,0.38)", cursor:"pointer",
              fontSize:"10px", letterSpacing:"0.16em", fontWeight:700,
              fontFamily:"'Barlow Condensed', sans-serif",
            }}>← BACK</button>
            {matchMeta && (
              <div style={{ fontSize:"8px", letterSpacing:"0.14em", color:"rgba(255,255,255,0.28)", fontWeight:700 }}>
                {matchMeta.stage.toUpperCase()}
              </div>
            )}
          </div>

          {/* Score bar */}
          {matchMeta && (
            <div style={{
              margin:"0 16px 14px",
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:8, padding:"10px 14px",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              gap:8,
            }}>
              {/* Home team */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
                <img
                  src={`https://flagcdn.com/32x24/${matchMeta.home.flagCode}.png`}
                  alt={matchMeta.home.code}
                  style={{ width:28, height:21, objectFit:"cover", borderRadius:2 }}
                />
                <div style={{ fontSize:"11px", fontWeight:900, letterSpacing:"0.12em",
                  color:"rgba(255,255,255,0.90)" }}>{matchMeta.home.code}</div>
              </div>
              {/* Score */}
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <span style={{ fontSize:"2rem", fontWeight:900, color:"#fff", lineHeight:1 }}>{matchMeta.score[0]}</span>
                <span style={{ fontSize:"0.9rem", color:"rgba(255,255,255,0.35)", fontWeight:700, lineHeight:1 }}>—</span>
                <span style={{ fontSize:"2rem", fontWeight:900, color:"#fff", lineHeight:1 }}>{matchMeta.score[1]}</span>
              </div>
              {/* Away team */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flex:1, minWidth:0 }}>
                <img
                  src={`https://flagcdn.com/32x24/${matchMeta.away.flagCode}.png`}
                  alt={matchMeta.away.code}
                  style={{ width:28, height:21, objectFit:"cover", borderRadius:2 }}
                />
                <div style={{ fontSize:"11px", fontWeight:900, letterSpacing:"0.12em",
                  color:"rgba(255,255,255,0.90)" }}>{matchMeta.away.code}</div>
              </div>
            </div>
          )}

          <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"0 0 0 0" }} />
        </div>

        {/* Event badge */}
        <div style={{ padding:"12px 20px 0" }}>
          <div style={{
            display:"inline-block",
            background:"rgba(240,192,40,0.10)", border:"1px solid rgba(240,192,40,0.30)",
            borderRadius:3, padding:"3px 10px",
            fontSize:"9px", letterSpacing:"0.22em", fontWeight:800,
            color:"rgba(240,192,40,0.90)",
          }}>
            {activeMoment.event_type.toUpperCase()}
          </div>
        </div>

        {/* Minute + player */}
        <div style={{ padding:"8px 20px 0" }}>
          <div style={{ fontSize:"2.8rem", fontWeight:900, color:"#f0c028",
            lineHeight:1, letterSpacing:"-0.02em" }}>{activeMoment.minute}′</div>
          <div style={{ fontSize:"1.30rem", fontWeight:900, color:"#fff",
            letterSpacing:"0.01em", lineHeight:1.1, marginTop:3 }}>{activeMoment.player}</div>
          <div style={{ fontSize:"0.65rem", fontWeight:600,
            color:"rgba(255,255,255,0.35)", letterSpacing:"0.14em", marginTop:4 }}>
            {activeMoment.team.toUpperCase()}
          </div>
        </div>

        <div style={{ margin:"12px 20px 0", height:1, background:"rgba(255,255,255,0.06)" }} />

        {/* Granite Coach — full height for all lenses */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
          <GraniteCoach moment={activeMoment} povPlayerLabel={cameraMode === "pov" ? povPlayerLabel : undefined} />
        </div>

        <div style={{ flex:1 }} />

        {/* Footer */}
        <div style={{ margin:"0 20px", height:1, background:"rgba(255,255,255,0.06)" }} />
        <div style={{ padding:"10px 20px 4px", flexShrink:0 }}>
          <div style={{ fontSize:"8px", letterSpacing:"0.18em",
            color:"rgba(255,255,255,0.18)", fontWeight:700 }}>
            {activeMoment.freeze_frame.length} PLAYERS TRACKED · STATSBOMB 360
          </div>
        </div>

        {/* Prev / Next navigation */}
        <div style={{ padding:"6px 16px 20px", display:"flex", gap:8, flexShrink:0 }}>
          {([
            { ev:prevTarget, label:"← PREV", align:"left"  as const },
            { ev:nextTarget, label:"NEXT →", align:"right" as const },
          ] as const).map(({ ev, label, align }) => (
            <button key={label}
              onClick={() => ev && navigateTo(ev)}
              disabled={!ev || loading}
              style={{
                flex:1,
                background: ev ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.015)",
                border:"1px solid rgba(255,255,255,0.09)",
                borderRadius:5, padding:"9px 8px",
                cursor: ev && !loading ? "pointer" : "not-allowed",
                fontFamily:"'Barlow Condensed', sans-serif",
                fontSize:"10px", letterSpacing:"0.16em", fontWeight:800,
                color: ev ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.18)",
                textAlign:align, lineHeight:1.4,
                opacity:loading ? 0.5 : 1, transition:"opacity 0.15s",
              }}
            >
              {ev ? (
                <>{label}<br />
                  <span style={{ fontSize:"9px", fontWeight:500,
                    color:"rgba(255,255,255,0.30)", letterSpacing:"0.06em" }}>
                    {ev.minute}′ {ev.event_type}
                  </span>
                </>
              ) : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
