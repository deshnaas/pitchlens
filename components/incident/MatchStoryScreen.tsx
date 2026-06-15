"use client";

// PitchLens — Investigation Workspace
//
// Three-panel investigation room.
// LEFT:   All match events — scrollable, searchable, every event visible.
// CENTER: Interactive football pitch — events as markers, click to investigate.
// RIGHT:  Explanation panel — what happened, why it mattered, role perspective.
//
// The pitch is the hero. Events are navigation. The right panel is understanding.

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TEAM_REGISTRY } from "@/lib/matchData";
import type { MatchMeta, RawEvent } from "@/lib/matchData";

// ─── Public types ──────────────────────────────────────────────────────────────
export type KeyMoment = {
  id: string; minute: number;
  type: "goal" | "substitution" | "card" | "incident";
  team: string; icon: string; title: string; context: string;
};

type Perspective = "referee" | "fan" | "supporter";

interface Props {
  matchId: string; meta: MatchMeta; moments: KeyMoment[];
  rawEvents: RawEvent[]; narrative: string;
  perspective?: Perspective;
  onBack: () => void;
  onMomentSelect?: (moment: KeyMoment) => void;
}

// ─── Internal event type ───────────────────────────────────────────────────────
type PitchEvent = {
  id: string;
  eventType: string; minute: number; second: number;
  team: string; player?: string; playerIn?: string; playerOut?: string;
  isKey: boolean; keyMoment?: KeyMoment;
  color: string;
  // Pitch position (105 × 68 coordinate space)
  x: number; y: number;
  shooterX?: number; shooterY?: number; // for goals
};

// ─── Seeded deterministic placement ───────────────────────────────────────────
function h(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function inferPos(ev: RawEvent, idx: number, meta: MatchMeta) {
  const s = idx * 17 + ev.minute * 13 + (ev.second ?? 0) * 7;
  const r = (n: number) => h(s + n * 2.618);
  const isHome = ev.team === meta.home.name;

  switch (ev.event_type) {
    case "goal": {
      // Home attacks right → scores near x=105. Away scores near x=0.
      const toRight = isHome;
      const gX = toRight ? 103.5 : 1.5;
      const dist = 7 + r(1) * 12;
      const gy = 28 + r(2) * 12;
      const sX = toRight ? gX - dist - 5 - r(3) * 9 : gX + dist + 5 + r(3) * 9;
      const sY = 26 + r(4) * 16;
      return { x: toRight ? gX - dist : gX + dist, y: gy, shooterX: sX, shooterY: sY };
    }
    case "foul":
    case "Yellow Card":
      return { x: 5 + r(1) * 95, y: 2 + r(2) * 64 };
    case "substitution":
      return { x: 38 + r(1) * 30, y: isHome ? 0.8 : 67.2 };
    default:
      return { x: 52.5, y: 34 };
  }
}

function buildEvents(rawEvents: RawEvent[], moments: KeyMoment[], meta: MatchMeta): PitchEvent[] {
  return [...rawEvents]
    .sort((a, b) => (a.minute + (a.second ?? 0) / 60) - (b.minute + (b.second ?? 0) / 60))
    .map((e, i) => {
      const km = moments.find(m =>
        Math.abs(m.minute - e.minute) <= 1 &&
        (m.team === e.team || (m.type === "goal" && e.event_type === "goal") ||
          (m.type === "card" && e.event_type === "Yellow Card"))
      );
      const tc = TEAM_REGISTRY[e.team]?.color ??
        (e.team === meta.home.name ? meta.home.color : meta.away.color);
      return {
        id: `pe-${i}`,
        eventType: e.event_type, minute: e.minute, second: e.second ?? 0,
        team: e.team, player: e.player ?? e.player_in,
        playerIn: e.player_in, playerOut: e.player_out,
        isKey: e.event_type === "goal" || e.event_type === "Yellow Card" || !!km,
        keyMoment: km, color: tc,
        ...inferPos(e, i, meta),
      };
    });
}

// ─── Player radar stats (deterministic) ───────────────────────────────────────
function playerStats(name: string): number[] {
  const c = (i: number) => name.charCodeAt(i % name.length);
  return [0, 1, 2, 3, 4].map(n =>
    Math.round(42 + (Math.abs(Math.sin(c(n) * 37.1 + n * 19.3 + name.length * 7.7)) % 1) * 52)
  );
}

// ─── Radar chart ──────────────────────────────────────────────────────────────
function RadarChart({ values, color }: { values: number[]; color: string }) {
  const cx = 55, cy = 55, maxR = 40;
  const labels = ["ATK", "DEF", "CRE", "TEC", "TAC"];
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / 5;
  const pt = (v: number, i: number): [number, number] => {
    const a = ang(i), r = (v / 100) * maxR;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const gridRing = (frac: number) =>
    labels.map((_, i) => { const a = ang(i), r = maxR * frac; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; }).join(" ");

  const valuePath = `M ${values.map((v, i) => pt(v, i).join(",")).join(" L ")} Z`;

  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={gridRing(f)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(100, i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />;
      })}
      <path d={valuePath} fill={`${color}33`} stroke={color} strokeWidth="1.3" />
      {values.map((v, i) => { const [x, y] = pt(v, i); return <circle key={i} cx={x} cy={y} r="1.8" fill={color} />; })}
      {labels.map((label, i) => {
        const [x, y] = pt(118, i);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.3)" fontSize="6.5"
            fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.04em">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Football pitch ────────────────────────────────────────────────────────────
const LS = { stroke: "rgba(255,255,255,0.28)", strokeWidth: "0.38", fill: "none" } as const;
const L_ARC_Y1 = (34 - Math.sqrt(9.15 ** 2 - 5.5 ** 2)).toFixed(3);
const L_ARC_Y2 = (34 + Math.sqrt(9.15 ** 2 - 5.5 ** 2)).toFixed(3);

function PitchMarkings() {
  return (
    <g>
      {/* Surface gradient def */}
      <defs>
        <radialGradient id="pitchGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="#0d2a14" />
          <stop offset="70%"  stopColor="#091e0e" />
          <stop offset="100%" stopColor="#060f08" />
        </radialGradient>
        <radialGradient id="pitchVignette" cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
        <filter id="eventGlow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Pitch surface */}
      <rect x="0" y="0" width="105" height="68" fill="url(#pitchGrad)" rx="1" />

      {/* Subtle alternating field stripes */}
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} x={i * 15} y="0" width="15" height="68"
          fill={i % 2 === 0 ? "rgba(255,255,255,0.018)" : "transparent"} />
      ))}

      {/* Vignette overlay */}
      <rect x="-5" y="-4" width="117" height="76" fill="url(#pitchVignette)" />

      {/* Pitch boundary */}
      <rect x="0" y="0" width="105" height="68" {...LS} />

      {/* Halfway line */}
      <line x1="52.5" y1="0" x2="52.5" y2="68" {...LS} />

      {/* Center circle + spot */}
      <circle cx="52.5" cy="34" r="9.15" {...LS} />
      <circle cx="52.5" cy="34" r="0.4" fill="rgba(255,255,255,0.28)" />

      {/* Left penalty area */}
      <rect x="0" y="13.84" width="16.5" height="40.32" {...LS} />
      {/* Left goal area */}
      <rect x="0" y="24.84" width="5.5" height="18.32" {...LS} />
      {/* Left penalty arc */}
      <path d={`M 16.5 ${L_ARC_Y1} A 9.15 9.15 0 0 1 16.5 ${L_ARC_Y2}`} {...LS} />
      {/* Left penalty spot */}
      <circle cx="11" cy="34" r="0.38" fill="rgba(255,255,255,0.28)" />
      {/* Left goal */}
      <rect x="-2.2" y="30.34" width="2.2" height="7.32"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.32" />

      {/* Right penalty area */}
      <rect x="88.5" y="13.84" width="16.5" height="40.32" {...LS} />
      {/* Right goal area */}
      <rect x="99.5" y="24.84" width="5.5" height="18.32" {...LS} />
      {/* Right penalty arc */}
      <path d={`M 88.5 ${L_ARC_Y1} A 9.15 9.15 0 0 0 88.5 ${L_ARC_Y2}`} {...LS} />
      {/* Right penalty spot */}
      <circle cx="94" cy="34" r="0.38" fill="rgba(255,255,255,0.28)" />
      {/* Right goal */}
      <rect x="105" y="30.34" width="2.2" height="7.32"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.32" />

      {/* Corner arcs */}
      <path d="M 1 0 A 1 1 0 0 0 0 1" {...LS} />
      <path d="M 0 67 A 1 1 0 0 0 1 68" {...LS} />
      <path d="M 104 0 A 1 1 0 0 1 105 1" {...LS} />
      <path d="M 105 67 A 1 1 0 0 1 104 68" {...LS} />
    </g>
  );
}

// ─── Active event visualization ────────────────────────────────────────────────
function ActiveViz({ ev, meta }: { ev: PitchEvent; meta: MatchMeta }) {
  const tc = ev.color;
  const isHome = ev.team === meta.home.name;

  if (ev.eventType === "goal" && ev.shooterX !== undefined && ev.shooterY !== undefined) {
    const gX = isHome ? 103.5 : 1.5;
    return (
      <g filter="url(#eventGlow)">
        {/* Shot path (animated) */}
        <motion.path
          d={`M ${ev.shooterX} ${ev.shooterY} L ${ev.x} ${ev.y}`}
          stroke={tc} strokeWidth="0.7" strokeDasharray="1.2 0.8" fill="none"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.85, ease: "easeOut" }}
        />
        {/* Shooter */}
        <circle cx={ev.shooterX} cy={ev.shooterY} r="2.4" fill={tc} stroke="white" strokeWidth="0.4" />
        <text x={ev.shooterX} y={ev.shooterY - 3.8} textAnchor="middle"
          fill="white" fontSize="2.4" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700">
          {ev.player?.split(" ").slice(-1)[0] ?? ev.player}
        </text>
        {/* Ball impact */}
        <motion.circle cx={ev.x} cy={ev.y} r="1.6" fill="white"
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 0.7, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Goal flash */}
        <motion.circle cx={gX} cy={34} r="5" fill={`${tc}18`} stroke={tc} strokeWidth="0.4"
          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.4 }}
        />
        <text x={gX} y={34.6} textAnchor="middle" dominantBaseline="middle" fontSize="4">⚽</text>
      </g>
    );
  }

  if (ev.eventType === "foul" || ev.eventType === "Yellow Card") {
    const p1 = { x: ev.x - 3, y: ev.y }, p2 = { x: ev.x + 3, y: ev.y };
    const isCard = ev.eventType === "Yellow Card";
    return (
      <g filter="url(#eventGlow)">
        {/* Contact zone */}
        <motion.circle cx={ev.x} cy={ev.y} r="6"
          fill={`${tc}10`} stroke={isCard ? "#FFD700" : tc} strokeWidth="0.35" strokeDasharray="1.2 1"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.45 }}
        />
        {/* Players */}
        <circle cx={p1.x} cy={p1.y} r="2.2" fill={tc} stroke="white" strokeWidth="0.35" />
        <circle cx={p2.x} cy={p2.y} r="2.2" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.35" />
        {/* ✕ */}
        <text x={ev.x} y={ev.y + 0.8} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,80,80,0.95)" fontSize="4.5" fontWeight="900">✕</text>
        {/* Player name */}
        <text x={ev.x} y={ev.y - 8} textAnchor="middle"
          fill={tc} fontSize="2.4" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700">
          {ev.player}
        </text>
        {/* Card */}
        {isCard && (
          <motion.rect x={ev.x - 1.2} y={ev.y - 15} width="2.4" height="3.4" rx="0.25"
            fill="#FFD700" stroke="#FFA500" strokeWidth="0.18"
            initial={{ y: ev.y - 9, opacity: 0 }} animate={{ y: ev.y - 15, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
          />
        )}
      </g>
    );
  }

  if (ev.eventType === "substitution") {
    const isTop = ev.y < 34;
    const dy = isTop ? -4 : 4;
    return (
      <g filter="url(#eventGlow)">
        <circle cx={ev.x - 3} cy={ev.y} r="2.2"
          fill="rgba(80,220,120,0.25)" stroke="rgba(80,220,120,0.9)" strokeWidth="0.35" />
        <circle cx={ev.x + 3} cy={ev.y} r="2.2"
          fill="rgba(255,80,80,0.2)" stroke="rgba(255,80,80,0.8)" strokeWidth="0.35" />
        <text x={ev.x - 3} y={ev.y + dy} textAnchor="middle"
          fill="rgba(80,220,120,0.9)" fontSize="2.2" fontFamily="'Barlow Condensed',sans-serif">
          ↑ {ev.playerIn?.split(" ").slice(-1)[0]}
        </text>
        <text x={ev.x + 3} y={ev.y + dy} textAnchor="middle"
          fill="rgba(255,80,80,0.85)" fontSize="2.2" fontFamily="'Barlow Condensed',sans-serif">
          ↓ {ev.playerOut?.split(" ").slice(-1)[0]}
        </text>
      </g>
    );
  }

  return null;
}

// ─── Pitch view ────────────────────────────────────────────────────────────────
function PitchView({
  events, activeId, onSelect, meta,
}: {
  events: PitchEvent[]; activeId: string | null;
  onSelect: (id: string) => void;
  meta: MatchMeta;
}) {
  const active = events.find(e => e.id === activeId);

  const markerR = (ev: PitchEvent) =>
    ev.eventType === "goal" ? 1.9 : ev.eventType === "Yellow Card" ? 1.5 : ev.eventType === "substitution" ? 1.3 : 0.85;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg
        viewBox="-5 -4 117 76"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
      >
        <PitchMarkings />

        {/* All event markers */}
        {events.map(ev => {
          const isActive = ev.id === activeId;
          const r = markerR(ev);
          const tc = ev.color;
          const isGoal = ev.eventType === "goal";
          const isCard = ev.eventType === "Yellow Card";

          return (
            <g key={ev.id} onClick={() => onSelect(ev.id)} style={{ cursor: "pointer" }}>
              {/* Pulse ring for active */}
              {isActive && (
                <motion.circle cx={ev.x} cy={ev.y} r={r * 4.5}
                  fill="none" stroke={tc} strokeWidth="0.35"
                  animate={{ r: [r * 3.5, r * 5.5, r * 3.5], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              {/* Hit area */}
              <circle cx={ev.x} cy={ev.y} r={Math.max(r + 1.2, 2.5)} fill="transparent" />
              {/* Marker */}
              <circle
                cx={ev.x} cy={ev.y}
                r={isActive ? r * 1.8 : r}
                fill={isCard ? "#FFD700" : isGoal ? tc : `${tc}${isActive ? "dd" : "99"}`}
                stroke={isActive ? "white" : (isGoal ? "rgba(255,255,255,0.4)" : "none")}
                strokeWidth={isActive ? "0.4" : "0.2"}
                opacity={isActive ? 1 : 0.72}
              />
              {/* Goal icon */}
              {isGoal && isActive && (
                <text x={ev.x} y={ev.y + 0.6} textAnchor="middle" dominantBaseline="middle" fontSize="1.8">⚽</text>
              )}
            </g>
          );
        })}

        {/* Active event overlay */}
        <AnimatePresence mode="wait">
          {active && (
            <motion.g key={activeId}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ActiveViz ev={active} meta={meta} />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}

// ─── Event type label + icon ───────────────────────────────────────────────────
const TYPE_ICON: Record<string, string> = { goal: "⚽", "Yellow Card": "🟨", substitution: "🔄", foul: "·" };
const TYPE_LABEL: Record<string, string> = { goal: "GOAL", "Yellow Card": "CARD", substitution: "SUB", foul: "FOUL" };

// ─── Left panel ───────────────────────────────────────────────────────────────
function EventsPanel({
  events, activeId, onSelect, query, onQuery, meta,
  listRef, activeItemRef,
}: {
  events: PitchEvent[];
  activeId: string | null;
  onSelect: (id: string) => void;
  query: string; onQuery: (q: string) => void;
  meta: MatchMeta;
  listRef: React.RefObject<HTMLDivElement | null>;
  activeItemRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const filtered = useMemo(() => {
    if (!query) return events;
    const q = query.toLowerCase();
    return events.filter(e =>
      [e.player, e.playerIn, e.playerOut, String(e.minute), e.eventType, e.team]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [events, query]);

  return (
    <div style={{
      width: 258, flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "rgba(4,8,20,0.88)",
      backdropFilter: "blur(22px)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "14px 14px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: "0.42rem", letterSpacing: "0.28em",
          color: "rgba(255,255,255,0.28)", marginBottom: 10,
        }}>
          MATCH EVENTS · {events.length}
        </div>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
            fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", pointerEvents: "none",
          }}>
            ⌕
          </span>
          <input
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder="Search events…"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 4, padding: "6px 8px 6px 24px",
              color: "rgba(255,255,255,0.75)",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "0.72rem", letterSpacing: "0.04em",
              outline: "none", cursor: "none",
            }}
          />
        </div>
      </div>

      {/* Event list */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {filtered.map(ev => {
          const isActive = ev.id === activeId;
          const isGoal = ev.eventType === "goal";
          const isCard = ev.eventType === "Yellow Card";
          const isSub  = ev.eventType === "substitution";
          const isFoul = ev.eventType === "foul";
          const tc = ev.color;
          const label = ev.keyMoment?.title ??
            (isSub ? `${ev.playerIn} for ${ev.playerOut}` : ev.player ?? ev.team);

          return (
            <motion.button
              key={ev.id}
              ref={isActive ? activeItemRef : undefined}
              onClick={() => onSelect(ev.id)}
              style={{
                width: "100%", display: "flex", alignItems: "flex-start",
                gap: 10, padding: "8px 14px",
                background: isActive ? `${tc}18` : "transparent",
                border: "none",
                borderLeft: `2.5px solid ${isActive ? tc : "transparent"}`,
                cursor: "none", textAlign: "left",
                transition: "background 0.18s, border-color 0.18s",
              }}
              whileHover={{ background: isActive ? `${tc}18` : "rgba(255,255,255,0.03)" }}
            >
              {/* Minute */}
              <div style={{
                fontSize: isGoal ? "1.05rem" : isCard ? "0.92rem" : isSub ? "0.82rem" : "0.72rem",
                fontWeight: 900, color: isActive ? tc : `${tc}99`,
                lineHeight: 1, minWidth: 30, paddingTop: 1,
                transition: "color 0.18s",
              }}>
                {ev.minute}&prime;
              </div>

              {/* Icon + label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: isGoal ? "0.9rem" : "0.75rem" }}>
                    {TYPE_ICON[ev.eventType] ?? "·"}
                  </span>
                  <span style={{
                    fontSize: "0.4rem", letterSpacing: "0.2em", fontWeight: 700,
                    color: isCard ? "#FFD700" : isGoal ? tc : "rgba(255,255,255,0.3)",
                  }}>
                    {TYPE_LABEL[ev.eventType] ?? ev.eventType.toUpperCase()}
                    {ev.isKey && " ★"}
                  </span>
                </div>
                <div style={{
                  fontSize: isGoal ? "0.82rem" : isFoul ? "0.6rem" : "0.72rem",
                  fontWeight: isGoal ? 700 : 500,
                  color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  lineHeight: 1.2,
                  transition: "color 0.18s",
                }}>
                  {label}
                </div>
              </div>
            </motion.button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{
            padding: "24px 14px", textAlign: "center",
            fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em",
          }}>
            No events match
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Event scrubber ────────────────────────────────────────────────────────────
function EventScrubber({
  events, activeIdx, activeEvent, onPrev, onNext, homeColor, awayColor,
}: {
  events: PitchEvent[]; activeIdx: number;
  activeEvent?: PitchEvent; onPrev: () => void; onNext: () => void;
  homeColor: string; awayColor: string;
}) {
  const canPrev = activeIdx > 0;
  const canNext = activeIdx < events.length - 1;
  const tc = activeEvent?.color ?? homeColor;

  return (
    <div style={{
      height: 58, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px",
      background: "rgba(3,6,18,0.94)",
      backdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      gap: 12,
    }}>
      <motion.button
        onClick={onPrev} disabled={!canPrev}
        style={{
          background: "none", border: "none", cursor: canPrev ? "none" : "default",
          color: canPrev ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
          fontFamily: "inherit", fontSize: "0.52rem", letterSpacing: "0.16em",
          display: "flex", alignItems: "center", gap: 6,
        }}
        whileHover={canPrev ? { color: "rgba(255,255,255,0.9)" } : {}}
      >
        ← PREV
      </motion.button>

      <AnimatePresence mode="wait">
        {activeEvent ? (
          <motion.div key={activeEvent.id}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            style={{ textAlign: "center", flex: 1 }}
          >
            <div style={{
              fontSize: "0.42rem", letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.24)", marginBottom: 2,
            }}>
              {activeIdx + 1} / {events.length}
            </div>
            <div style={{
              fontSize: "0.88rem", fontWeight: 800, color: tc,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              <span style={{ opacity: 0.7 }}>{activeEvent.minute}&prime; </span>
              {activeEvent.keyMoment?.title ??
                (activeEvent.eventType === "substitution"
                  ? `${activeEvent.playerIn} for ${activeEvent.playerOut}`
                  : activeEvent.player ?? activeEvent.team)}
            </div>
          </motion.div>
        ) : (
          <div style={{ flex: 1, textAlign: "center", fontSize: "0.5rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em" }}>
            SELECT AN EVENT
          </div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onNext} disabled={!canNext}
        style={{
          background: "none", border: "none", cursor: canNext ? "none" : "default",
          color: canNext ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)",
          fontFamily: "inherit", fontSize: "0.52rem", letterSpacing: "0.16em",
          display: "flex", alignItems: "center", gap: 6,
        }}
        whileHover={canNext ? { color: "rgba(255,255,255,0.9)" } : {}}
      >
        NEXT →
      </motion.button>
    </div>
  );
}

// ─── Perspective analysis ──────────────────────────────────────────────────────
function getPerspective(eventType: string, p: Perspective, team: string): string {
  if (p === "referee") {
    switch (eventType) {
      case "goal":         return "Review the build-up for offside, encroachment, or foul. Consult VAR if the margin is narrow. Only confirm when all criteria are satisfied.";
      case "foul":         return "Assess under Law 12: careless, reckless, or excessive force? Consider advantage. If the foul stops a promising attack, issue a caution.";
      case "Yellow Card":  return "Caution issued. Confirm the infringement meets Law 12 criteria — persistent infringement, foul denying a promising attack, or dissent.";
      case "substitution": return "Record the substitution and verify the replacement player's number on the board. Ensure the outgoing player has left the pitch before play resumes.";
      default:             return "Observe the play. If an infringement occurred, apply the Laws of the Game accordingly.";
    }
  }
  if (p === "fan") {
    switch (eventType) {
      case "goal":         return "That's a goal! The ball has crossed the line and the referee has confirmed it. One team has just changed the scoreline.";
      case "foul":         return "The referee has stopped play. A free kick is awarded to the other team — they can take a quick restart or set up a dead-ball situation.";
      case "Yellow Card":  return "A yellow card is a formal warning. If this player gets another yellow in the same game, they'll be sent off and their team plays with ten men.";
      case "substitution": return "A manager is changing their tactics. The new player brings fresh legs and perhaps a different role that could shift the balance of the game.";
      default:             return "Keep watching — every moment on the pitch could change the game.";
    }
  }
  // supporter
  switch (eventType) {
    case "goal":         return `${team} have scored. This is the moment that defines seasons, careers, and memories — everything the supporters came to witness.`;
    case "foul":         return "The crowd reacts. Whether it's frustration at the decision or relief that play has stopped, the mood in the stadium shifts with every whistle.";
    case "Yellow Card":  return "Tension rises. A booking puts a player on the edge — the supporters know one more mistake ends their influence on this game.";
    case "substitution": return "The manager believes in this. A change of personnel is a declaration of intent — either chasing the game or protecting what has been built.";
    default:             return "Every moment carries weight. This is why football matters.";
  }
}

// ─── Right explanation panel ───────────────────────────────────────────────────
function ExplanationPanel({
  event, narrative, meta, perspective, homeColor,
}: {
  event?: PitchEvent; narrative: string; meta: MatchMeta;
  perspective: Perspective; homeColor: string;
}) {
  const [showPlayer, setShowPlayer] = useState<string | null>(null);

  useEffect(() => { setShowPlayer(null); }, [event?.id]);

  const perspLabel = { referee: "REFEREE VIEW", fan: "NEW FAN", supporter: "SUPPORTER" }[perspective];
  const tc = event?.color ?? homeColor;

  return (
    <div style={{
      width: 292, flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "rgba(4,8,20,0.88)",
      backdropFilter: "blur(22px)",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      overflowY: "auto",
    }}>
      <AnimatePresence mode="wait">
        {event ? (
          <motion.div key={event.id}
            initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.3 }}
            style={{ padding: "18px 16px", flex: 1 }}
          >
            {/* Top accent line */}
            <div style={{ height: "2px", background: `linear-gradient(90deg, ${tc}, transparent)`, marginBottom: 16 }} />

            {/* Event header */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: "2.8rem", fontWeight: 900, color: tc, lineHeight: 1,
                  textShadow: `0 0 30px ${tc}66`,
                }}>
                  {event.minute}&prime;
                </span>
                <div>
                  <div style={{
                    fontSize: "0.44rem", letterSpacing: "0.22em", fontWeight: 700,
                    color: event.eventType === "Yellow Card" ? "#FFD700" : tc,
                  }}>
                    {TYPE_LABEL[event.eventType] ?? event.eventType.toUpperCase()}
                    {event.isKey && " ★"}
                  </div>
                  <div style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.12em" }}>
                    {event.team.toUpperCase()}
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: "1.15rem", fontWeight: 800, color: "#fff",
                lineHeight: 1.15, marginBottom: 4,
              }}>
                {event.keyMoment?.title ??
                  (event.eventType === "substitution"
                    ? `${event.playerIn} for ${event.playerOut}`
                    : event.player)}
              </div>
            </div>

            <Divider />

            {/* What happened */}
            <Section label="WHAT HAPPENED">
              <p style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.62)", lineHeight: 1.7, margin: 0 }}>
                {event.keyMoment?.context ??
                  (event.eventType === "goal"
                    ? `${event.player} scored for ${event.team}${event.minute > 0 ? ` in the ${event.minute}th minute` : ""}.`
                    : event.eventType === "foul"
                    ? `${event.player} was penalized for a foul, resulting in a free kick for the opposition.`
                    : event.eventType === "Yellow Card"
                    ? `${event.player} received a yellow card, bringing them one step closer to suspension.`
                    : `${event.team} made a substitution: ${event.playerIn} replaced ${event.playerOut}.`)}
              </p>
            </Section>

            <Divider />

            {/* Perspective analysis */}
            <Section label={perspLabel}>
              <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.52)", lineHeight: 1.72, margin: 0 }}>
                {getPerspective(event.eventType, perspective, event.team)}
              </p>
            </Section>

            {/* Player card toggle (for events with a specific player) */}
            {event.player && !event.eventType.includes("substitution") && (
              <>
                <Divider />
                <button
                  onClick={() => setShowPlayer(showPlayer ? null : event.player!)}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${showPlayer ? tc : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 4, padding: "8px 12px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: "none", fontFamily: "inherit",
                    color: "rgba(255,255,255,0.5)", marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: "0.6rem", letterSpacing: "0.16em" }}>
                    PLAYER INTELLIGENCE
                  </span>
                  <span style={{ fontSize: "0.7rem" }}>{showPlayer ? "▲" : "▼"}</span>
                </button>

                <AnimatePresence>
                  {showPlayer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 5, padding: "14px 12px", marginBottom: 12,
                      }}>
                        <div style={{
                          fontSize: "0.88rem", fontWeight: 800, color: "#fff", marginBottom: 2,
                        }}>
                          {event.player}
                        </div>
                        <div style={{
                          fontSize: "0.42rem", letterSpacing: "0.18em",
                          color: `${tc}99`, marginBottom: 12,
                        }}>
                          {event.team.toUpperCase()} · {event.eventType === "goal" ? "FORWARD" : event.eventType === "Yellow Card" ? "MIDFIELDER" : "PLAYER"}
                        </div>

                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                          <RadarChart values={playerStats(event.player ?? "")} color={tc} />
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px" }}>
                          {[
                            { l: "ATK",  v: playerStats(event.player ?? "")[0] },
                            { l: "DEF",  v: playerStats(event.player ?? "")[1] },
                            { l: "CRE",  v: playerStats(event.player ?? "")[2] },
                            { l: "TEC",  v: playerStats(event.player ?? "")[3] },
                            { l: "TAC",  v: playerStats(event.player ?? "")[4] },
                          ].map(({ l, v }) => (
                            <div key={l} style={{ textAlign: "center" }}>
                              <div style={{ fontSize: "0.72rem", fontWeight: 800, color: tc }}>{v}</div>
                              <div style={{ fontSize: "0.36rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.3)" }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem", marginBottom: 14, opacity: 0.3,
            }}>
              ⚽
            </div>
            <div style={{ fontSize: "0.44rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.22)", textAlign: "center" }}>
              SELECT AN EVENT<br />TO BEGIN INVESTIGATION
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match narrative footer */}
      {narrative && (
        <div style={{
          padding: "14px 16px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: "0.38rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", marginBottom: 6 }}>
            MATCH CONTEXT
          </div>
          <p style={{
            fontSize: "0.62rem", color: "rgba(255,255,255,0.32)",
            lineHeight: 1.65, margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 5,
            WebkitBoxOrient: "vertical",
          } as React.CSSProperties}>
            {narrative}
          </p>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "14px 0" }} />;
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: "0.38rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.22)", marginBottom: 7 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────
export default function MatchStoryScreen({
  meta, moments, rawEvents, narrative,
  perspective = "referee",
  onBack, onMomentSelect,
}: Props) {
  const pitchEvents = useMemo(
    () => buildEvents(rawEvents, moments, meta), [rawEvents, moments, meta],
  );

  const [activeId, setActiveId] = useState<string | null>(pitchEvents[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");

  const activeEvent = pitchEvents.find(e => e.id === activeId);
  const activeIdx   = pitchEvents.findIndex(e => e.id === activeId);

  const listRef      = useRef<HTMLDivElement>(null);
  const activeRef    = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const goNext = useCallback(() => {
    if (activeIdx < pitchEvents.length - 1) setActiveId(pitchEvents[activeIdx + 1].id);
  }, [activeIdx, pitchEvents]);

  const goPrev = useCallback(() => {
    if (activeIdx > 0) setActiveId(pitchEvents[activeIdx - 1].id);
  }, [activeIdx, pitchEvents]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const homeColor = meta.home.color ?? "#00b4ff";
  const awayColor = meta.away.color ?? "#ff4455";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#020810",
      fontFamily: "'Barlow Condensed', sans-serif",
      display: "flex", flexDirection: "column",
      cursor: "none", overflow: "hidden",
    }}>
      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          height: 50, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px",
          background: "rgba(2,8,16,0.96)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          zIndex: 20,
        }}
      >
        <motion.button onClick={onBack} style={{
          background: "none", border: "none", cursor: "none",
          color: "rgba(255,255,255,0.3)", fontFamily: "inherit",
          fontSize: "0.5rem", letterSpacing: "0.2em",
          display: "flex", alignItems: "center", gap: 6,
        }} whileHover={{ color: "rgba(255,255,255,0.72)" }}>
          ← ALL MATCHES
        </motion.button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>
            <span style={{ color: homeColor }}>{meta.home.code}</span>
            <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 8px", fontSize: "0.65rem" }}>vs</span>
            <span style={{ color: awayColor }}>{meta.away.code}</span>
          </div>
          <div style={{ fontSize: "0.36rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.2em", marginTop: 2 }}>
            {meta.stage} · {meta.date}
          </div>
        </div>

        <div style={{
          fontSize: "0.4rem", letterSpacing: "0.16em",
          color: "rgba(255,255,255,0.18)", textAlign: "right",
        }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.36)" }}>
            {pitchEvents.length}
          </span> EVENTS
        </div>
      </motion.header>

      {/* ── 3-Panel Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT: Events navigation */}
        <EventsPanel
          events={pitchEvents}
          activeId={activeId}
          onSelect={setActiveId}
          query={searchQuery}
          onQuery={setSearchQuery}
          meta={meta}
          listRef={listRef}
          activeItemRef={activeRef}
        />

        {/* CENTER: Pitch + scrubber */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {/* Team direction labels */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 18px", flexShrink: 0,
            background: "rgba(2,8,16,0.55)",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ fontSize: "0.46rem", fontWeight: 800, letterSpacing: "0.18em", color: homeColor, opacity: 0.75 }}>
              ◀ {meta.home.name.toUpperCase()}
            </div>
            <div style={{ fontSize: "0.34rem", letterSpacing: "0.28em", color: "rgba(255,255,255,0.16)" }}>
              MATCH MAP · CLICK ANY EVENT
            </div>
            <div style={{ fontSize: "0.46rem", fontWeight: 800, letterSpacing: "0.18em", color: awayColor, opacity: 0.75 }}>
              {meta.away.name.toUpperCase()} ▶
            </div>
          </div>

          {/* Pitch */}
          <div style={{ flex: 1, padding: "10px 14px", overflow: "hidden" }}>
            <PitchView
              events={pitchEvents}
              activeId={activeId}
              onSelect={setActiveId}
              meta={meta}
            />
          </div>

          {/* Event scrubber */}
          <EventScrubber
            events={pitchEvents}
            activeIdx={activeIdx}
            activeEvent={activeEvent}
            onPrev={goPrev}
            onNext={goNext}
            homeColor={homeColor}
            awayColor={awayColor}
          />
        </div>

        {/* RIGHT: Explanation */}
        <ExplanationPanel
          event={activeEvent}
          narrative={narrative}
          meta={meta}
          perspective={perspective}
          homeColor={homeColor}
        />
      </div>
    </div>
  );
}
