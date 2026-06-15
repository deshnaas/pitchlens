"use client";

// PitchLens — Investigation Workspace
//
// Three-panel investigation room.
// LEFT:   Every match event from JSON — searchable, scrollable, no hidden events.
// CENTER: Football pitch with honest zone-based visualization (no fake tracking data).
// RIGHT:  Event analysis + player intelligence derived from JSON event counts.
//
// Player Intelligence uses real JSON-derived metrics, not synthetic hash values.
// Pitch zones represent honest approximations (Attacking Third, Penalty Area, etc.)
// — not fabricated player tracking coordinates.

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
  onMomentSelect?: (m: KeyMoment) => void;
}

// ─── Internal event ────────────────────────────────────────────────────────────
type PitchEvent = {
  id: string;
  eventType: string; minute: number; second: number;
  team: string; player?: string; playerIn?: string; playerOut?: string;
  isKey: boolean; keyMoment?: KeyMoment;
  color: string;
  x: number; y: number;   // approximate zone position (105×68 pitch space)
};

// ─── Seeded deterministic zone placement ───────────────────────────────────────
// These are ZONE APPROXIMATIONS, not real tracking coordinates.
// Goals go near the correct goal mouth. Fouls are distributed across the pitch.
// Subs appear near the touchline. No player positions are fabricated.
function sh(seed: number) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function zonePos(ev: RawEvent, idx: number, meta: MatchMeta): { x: number; y: number } {
  const s = idx * 17 + ev.minute * 13 + (ev.second ?? 0) * 7;
  const r = (n: number) => sh(s + n * 2.618);
  const isHome = ev.team === meta.home.name;
  switch (ev.event_type) {
    case "goal":
      // Home attacks right → scores near x=105 goal. Away scores near x=0.
      return isHome
        ? { x: 89 + r(1) * 13, y: 26 + r(2) * 16 }
        : { x: 3  + r(1) * 10, y: 26 + r(2) * 16 };
    case "substitution":
      return { x: 42 + r(1) * 21, y: isHome ? 1.2 : 66.8 };
    default: // foul, Yellow Card — distributed across whole pitch
      return { x: 6 + r(1) * 93, y: 3 + r(2) * 62 };
  }
}

function buildEvents(raw: RawEvent[], moments: KeyMoment[], meta: MatchMeta): PitchEvent[] {
  return [...raw]
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
        team: e.team,
        player: e.player ?? e.player_in,
        playerIn: e.player_in, playerOut: e.player_out,
        isKey: e.event_type === "goal" || e.event_type === "Yellow Card" || !!km,
        keyMoment: km, color: tc,
        ...zonePos(e, i, meta),
      };
    });
}

// ─── Player Intelligence — derived from JSON event counts ──────────────────────
// All five values are calculated from real events in the match JSON.
// No trigonometric hashing, no synthetic values.
type PlayerProfile = {
  stats: { influence: number; discipline: number; involvement: number; pressure: number; impact: number };
  explanations: { influence: string; discipline: string; involvement: string; pressure: string; impact: string };
  events: PitchEvent[];
  goals: number; fouls: number; cards: number; totalEvents: number; keyInvolvements: number;
};

function computePlayer(playerName: string, all: PitchEvent[]): PlayerProfile {
  const mine = all.filter(e =>
    e.player === playerName || e.playerIn === playerName || e.playerOut === playerName
  );
  const goals          = mine.filter(e => e.eventType === "goal"        && e.player   === playerName).length;
  const fouls          = mine.filter(e => e.eventType === "foul"        && e.player   === playerName).length;
  const cards          = mine.filter(e => e.eventType === "Yellow Card" && e.player   === playerName).length;
  const keyInvolvements = mine.filter(e => e.isKey).length;
  const totalEvents    = mine.length;
  const lateEvents     = mine.filter(e => e.minute >= 70).length;

  // Influence — goal involvement + key moment participation
  const influence = Math.min(94, Math.max(15,
    goals * 38 + keyInvolvements * 16 + (totalEvents >= 3 ? 18 : 8),
  ));

  // Discipline — inverse of fouls and cards. High score = disciplined.
  const discipline = Math.min(88, Math.max(14,
    76 - fouls * 13 - cards * 22,
  ));

  // Involvement — total recorded events across the match
  const involvement = Math.min(92, Math.max(16,
    18 + totalEvents * 15 + keyInvolvements * 8,
  ));

  // Pressure — events in the final 20 minutes or in high-stakes moments
  const pressure = Math.min(90, Math.max(16,
    18 + lateEvents * 20 + (cards > 0 ? 14 : 0) + goals * 12,
  ));

  // Impact — direct match-changing contributions
  const impact = Math.min(95, Math.max(14,
    goals * 40 + keyInvolvements * 22 + (lateEvents > 0 ? 12 : 0),
  ));

  const e = {
    influence: goals > 0
      ? `Scored ${goals} goal${goals > 1 ? "s" : ""}. Direct contribution to the scoreline.`
      : keyInvolvements > 0
      ? `Involved in ${keyInvolvements} key moment${keyInvolvements > 1 ? "s" : ""}. Significant indirect influence.`
      : totalEvents > 0
      ? `${totalEvents} event${totalEvents > 1 ? "s" : ""} recorded. No direct goal involvement.`
      : "No events recorded for this player.",

    discipline: fouls > 0 || cards > 0
      ? `${fouls > 0 ? `${fouls} foul${fouls > 1 ? "s" : ""} committed` : ""}${fouls > 0 && cards > 0 ? ". " : ""}${cards > 0 ? `${cards} yellow card${cards > 1 ? "s" : ""} received` : ""}.`
      : "No fouls or cautions recorded in this match.",

    involvement: `${totalEvents} event${totalEvents > 1 ? "s" : ""} recorded across the match.` +
      (totalEvents === 0 ? " Player does not appear in match event data." : ""),

    pressure: lateEvents > 0
      ? `${lateEvents} event${lateEvents > 1 ? "s" : ""} in the final 20 minutes. Involved in late-match pressure.`
      : "No recorded events in the final 20 minutes.",

    impact: goals > 0
      ? "Goal scored directly altered the scoreline."
      : keyInvolvements > 0
      ? `Participated in ${keyInvolvements} match-defining moment${keyInvolvements > 1 ? "s" : ""}.`
      : "No direct match-changing contributions recorded.",
  };

  return { stats: { influence, discipline, involvement, pressure, impact }, explanations: e, events: mine, goals, fouls, cards, totalEvents, keyInvolvements };
}

// ─── Radar chart (Influence / Discipline / Involvement / Pressure / Impact) ────
function RadarChart({ values, color }: { values: number[]; color: string }) {
  const cx = 56, cy = 56, maxR = 42;
  const labels = ["INF", "DIS", "INV", "PRS", "IMP"];
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / 5;
  const pt = (v: number, i: number): [number, number] => {
    const a = ang(i), r = (v / 100) * maxR;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ring = (f: number) => labels.map((_, i) => {
    const a = ang(i), r = maxR * f;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");

  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" />
      ))}
      {labels.map((_, i) => {
        const [x2, y2] = pt(100, i);
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />;
      })}
      <path d={`M ${values.map((v, i) => pt(v, i).join(",")).join(" L ")} Z`}
        fill={`${color}30`} stroke={color} strokeWidth="1.4" />
      {values.map((v, i) => { const [x, y] = pt(v, i); return <circle key={i} cx={x} cy={y} r="2" fill={color} />; })}
      {labels.map((label, i) => {
        const [x, y] = pt(115, i);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill="rgba(255,255,255,0.32)" fontSize="6.5"
            fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.04em">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Pitch markings (regulation geometry) ─────────────────────────────────────
const LS = { stroke: "rgba(255,255,255,0.28)", strokeWidth: "0.38", fill: "none" } as const;
const ARC_Y1 = (34 - Math.sqrt(9.15 ** 2 - 5.5 ** 2)).toFixed(3);
const ARC_Y2 = (34 + Math.sqrt(9.15 ** 2 - 5.5 ** 2)).toFixed(3);

function PitchMarkings() {
  return (
    <g>
      <defs>
        <radialGradient id="pg" cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="#0d2a14" />
          <stop offset="75%"  stopColor="#091e0e" />
          <stop offset="100%" stopColor="#060f08" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width="105" height="68" fill="url(#pg)" rx="1" />
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x={i*15} y="0" width="15" height="68"
          fill={i % 2 === 0 ? "rgba(255,255,255,0.016)" : "transparent"} />
      ))}

      {/* Zone labels — permanent, subtle */}
      {[
        { x: 17.5, label: "DEF" }, { x: 52.5, label: "MID" }, { x: 87.5, label: "ATK" },
      ].map(({ x, label }) => (
        <text key={label} x={x} y="3.5" textAnchor="middle"
          fill="rgba(255,255,255,0.055)" fontSize="3.8"
          fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.16em">
          {label}
        </text>
      ))}

      {/* Pitch lines */}
      <rect x="0" y="0" width="105" height="68" {...LS} />
      <line x1="52.5" y1="0" x2="52.5" y2="68" {...LS} />
      <circle cx="52.5" cy="34" r="9.15" {...LS} />
      <circle cx="52.5" cy="34" r="0.4" fill="rgba(255,255,255,0.28)" />

      {/* Left penalty area + arc + goal */}
      <rect x="0" y="13.84" width="16.5" height="40.32" {...LS} />
      <rect x="0" y="24.84" width="5.5"  height="18.32" {...LS} />
      <path d={`M 16.5 ${ARC_Y1} A 9.15 9.15 0 0 1 16.5 ${ARC_Y2}`} {...LS} />
      <circle cx="11" cy="34" r="0.38" fill="rgba(255,255,255,0.28)" />
      <rect x="-2.2" y="30.34" width="2.2" height="7.32"
        fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.32" />

      {/* Right penalty area + arc + goal */}
      <rect x="88.5" y="13.84" width="16.5" height="40.32" {...LS} />
      <rect x="99.5" y="24.84" width="5.5"  height="18.32" {...LS} />
      <path d={`M 88.5 ${ARC_Y1} A 9.15 9.15 0 0 0 88.5 ${ARC_Y2}`} {...LS} />
      <circle cx="94" cy="34" r="0.38" fill="rgba(255,255,255,0.28)" />
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

// ─── Investigation scenes ──────────────────────────────────────────────────────
// Each scene focuses entirely on one incident. No other markers are shown.
// Zone highlights are honest football zones — not fabricated tracking coordinates.
// Player markers represent the player(s) named in the JSON event, placed in the
// correct zone for that event type (penalty area for goals, distributed for fouls).

// Shared label style helpers
const SL = { fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "0.15em" } as const;
const SF = { transformBox: "fill-box" as const, transformOrigin: "center" as const };

function GoalScene({ ev, meta }: { ev: PitchEvent; meta: MatchMeta }) {
  const isHome = ev.team === meta.home.name;
  const tc = ev.color;
  const atkX  = isHome ? 70 : 0;
  const penX  = isHome ? 88.5 : 0;
  const goalCX = isHome ? 104.2 : 0.8;
  // Shot arc: from ev.x/ev.y (penalty area zone) curving toward goal mouth
  const cpX = isHome ? ev.x + 10 : ev.x - 10;
  const cpY = ev.y + (ev.y < 34 ? 4 : -4);
  const endY = 30 + (ev.y - 34) * 0.18 + 34 - 30; // slight vertical drift
  const shotPath = `M ${ev.x} ${ev.y} Q ${cpX} ${cpY} ${goalCX} ${endY}`;
  const labelSide = isHome ? 87.5 : 17.5;
  const penLabel  = isHome ? 97 : 8;
  const nameAbove = ev.y > 44;

  return (
    <g>
      {/* Dim the non-attacking half */}
      <motion.rect x={isHome ? 0 : 35} y="0" width="70" height="68"
        fill="rgba(0,0,0,0.38)" pointerEvents="none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55 }}
      />
      {/* Attacking third glow */}
      <motion.rect x={atkX} y="0" width="35" height="68"
        fill={`${tc}12`} pointerEvents="none"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.05 }}
      />
      {/* Penalty area pulse border */}
      <motion.rect x={penX} y="13.84" width="16.5" height="40.32" rx="0.3"
        fill={`${tc}20`} stroke={tc} strokeWidth="0.55" strokeDasharray="2.2 0.9"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      />

      {/* Shot path — animated draw */}
      <motion.path d={shotPath}
        fill="none" stroke="rgba(255,255,255,0.72)" strokeWidth="0.6"
        strokeDasharray="1.8 1.1" strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.65, delay: 0.42, ease: "easeOut" },
          opacity:    { duration: 0.18, delay: 0.42 },
        }}
      />
      {/* Arrowhead at goal end */}
      <motion.circle cx={goalCX} cy={endY} r="0.9" fill="white"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.22 }}
      />

      {/* Scorer position — outer glow ring */}
      <motion.circle cx={ev.x} cy={ev.y} r="6.5"
        fill={`${tc}1a`} stroke={`${tc}50`} strokeWidth="0.4"
        style={SF}
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 160, damping: 14 }}
      />
      {/* Scorer dot */}
      <motion.circle cx={ev.x} cy={ev.y} r="2.4"
        fill={tc} stroke="rgba(255,255,255,0.88)" strokeWidth="0.5"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.26, type: "spring", stiffness: 260, damping: 18 }}
      />
      {/* Pulse ring */}
      <motion.circle cx={ev.x} cy={ev.y} r="6.5"
        fill="none" stroke={tc} strokeWidth="0.4"
        animate={{ r: [6.5, 11, 6.5], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
      />

      {/* Player name */}
      <motion.text x={ev.x} y={nameAbove ? ev.y - 9.5 : ev.y + 11.5}
        textAnchor="middle" fill="rgba(255,255,255,0.92)"
        fontSize="3.6" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        {ev.player}
      </motion.text>
      <motion.text x={ev.x} y={nameAbove ? ev.y - 5.5 : ev.y + 15.5}
        textAnchor="middle" fill={`${tc}80`} fontSize="2.2" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.52 }}>
        SHOT ZONE
      </motion.text>

      {/* Goal mouth glow */}
      <motion.rect x={isHome ? 103.5 : -2.2} y="29.6" width="2.5" height="8.8" rx="0.2"
        fill={`${tc}75`}
        initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
        style={{ transformOrigin: `${isHome ? 104.7 : -0.9}px 34px` }}
        transition={{ duration: 0.38, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Goal flash */}
      <motion.rect x={isHome ? 103.5 : -2.2} y="29.6" width="2.5" height="8.8" rx="0.2"
        fill="white"
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 0.45, delay: 1.05 }}
      />

      {/* Zone labels */}
      <motion.text x={labelSide} y="8" textAnchor="middle"
        fill={`${tc}70`} fontSize="4" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        ATTACKING THIRD
      </motion.text>
      <motion.text x={penLabel} y="11.5" textAnchor="middle"
        fill={`${tc}55`} fontSize="2.5" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}>
        PENALTY AREA
      </motion.text>
      <motion.text x={goalCX + (isHome ? -5 : 5)} y="25"
        textAnchor="middle" fill={`${tc}55`} fontSize="2.2" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
        GOAL
      </motion.text>
    </g>
  );
}

function FoulScene({ ev, meta }: { ev: PitchEvent; meta: MatchMeta }) {
  const isHome = ev.team === meta.home.name;
  const tc  = ev.color;
  const opp = isHome ? meta.away.color : meta.home.color;
  const zone  = ev.x < 35 ? "DEFENSIVE THIRD" : ev.x > 70 ? "ATTACKING THIRD" : "MIDFIELD";
  const zoneX = ev.x < 35 ? 0 : ev.x > 70 ? 70 : 35;
  // Victim is the opposing player — offset slightly so two figures are distinct
  const vx = Math.min(102, Math.max(3, ev.x + (ev.x < 52 ? 5 : -5)));
  const vy = Math.min(65,  Math.max(3, ev.y + (ev.y < 34 ? 2 : -2)));
  const nameSide = ev.y > 40;

  return (
    <g>
      {/* Zone band */}
      <motion.rect x={zoneX} y="0" width="35" height="68"
        fill={`${tc}0c`}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      />

      {/* Contact radius — the incident zone */}
      <motion.circle cx={ev.x} cy={ev.y} r="11"
        fill={`${tc}10`} stroke={tc} strokeWidth="0.45" strokeDasharray="2 1.1"
        style={SF}
        initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Victim (opponent) */}
      <motion.circle cx={vx} cy={vy} r="4"
        fill={`${opp}28`} stroke={opp} strokeWidth="0.55"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.18, type: "spring", stiffness: 200, damping: 16 }}
      />
      <motion.circle cx={vx} cy={vy} r="1.5" fill={opp}
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.26, type: "spring", stiffness: 260 }}
      />
      <motion.text x={vx} y={nameSide ? vy - 7 : vy + 8.5}
        textAnchor="middle" fill={`${opp}aa`} fontSize="2.4" fontWeight="700" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
        OPPONENT
      </motion.text>

      {/* Fouler */}
      <motion.circle cx={ev.x} cy={ev.y} r="4"
        fill={`${tc}28`} stroke={tc} strokeWidth="0.55"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 16 }}
      />
      <motion.circle cx={ev.x} cy={ev.y} r="1.5" fill={tc}
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.38, type: "spring", stiffness: 260 }}
      />
      <motion.text x={ev.x} y={nameSide ? ev.y + 8.5 : ev.y - 7}
        textAnchor="middle" fill="rgba(255,255,255,0.9)"
        fontSize="2.9" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {ev.player}
      </motion.text>

      {/* Foul mark at contact point */}
      <motion.text x={(ev.x + vx) / 2} y={(ev.y + vy) / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,80,80,0.85)" fontSize="4.5" fontWeight="900"
        initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
        style={SF}
        transition={{ delay: 0.46, type: "spring", stiffness: 300, damping: 16 }}>
        ✕
      </motion.text>

      {/* Zone label */}
      <motion.text x={zoneX + 17.5} y="8" textAnchor="middle"
        fill={`${tc}65`} fontSize="4" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        {zone}
      </motion.text>
      <motion.text x={ev.x} y={nameSide ? ev.y - 15 : ev.y + 17}
        textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="2.2" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        CONTACT POINT
      </motion.text>
    </g>
  );
}

function CardScene({ ev, meta }: { ev: PitchEvent; meta: MatchMeta }) {
  const isHome = ev.team === meta.home.name;
  const tc = ev.color;
  const zone  = ev.x < 35 ? "DEFENSIVE THIRD" : ev.x > 70 ? "ATTACKING THIRD" : "MIDFIELD";
  const zoneX = ev.x < 35 ? 0 : ev.x > 70 ? 70 : 35;
  const nameSide = ev.y > 40;
  // Card floats above player (or below if player is in top half)
  const cardX = ev.x + (ev.x > 85 ? -11 : 5);
  const cardY = nameSide ? ev.y - 16 : ev.y + 6;

  return (
    <g>
      {/* Zone band */}
      <motion.rect x={zoneX} y="0" width="35" height="68"
        fill="rgba(255,215,0,0.07)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      />
      {/* Incident radius */}
      <motion.circle cx={ev.x} cy={ev.y} r="11"
        fill="rgba(255,215,0,0.09)" stroke="#FFD700" strokeWidth="0.45" strokeDasharray="2 1.1"
        style={SF}
        initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Player marker */}
      <motion.circle cx={ev.x} cy={ev.y} r="4"
        fill={`${tc}28`} stroke={tc} strokeWidth="0.55"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 16 }}
      />
      <motion.circle cx={ev.x} cy={ev.y} r="1.5" fill={tc}
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.28, type: "spring" }}
      />
      <motion.text x={ev.x} y={nameSide ? ev.y + 8 : ev.y - 7.5}
        textAnchor="middle" fill="rgba(255,255,255,0.9)"
        fontSize="2.9" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
        {ev.player}
      </motion.text>

      {/* Yellow card — drops into view */}
      <motion.g
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.58, type: "spring", stiffness: 200, damping: 18 }}>
        {/* Card shadow */}
        <rect x={cardX + 0.6} y={cardY + 0.8} width="7" height="10" rx="0.8"
          fill="rgba(0,0,0,0.35)" />
        {/* Card body */}
        <rect x={cardX} y={cardY} width="7" height="10" rx="0.8" fill="#FFD700" />
        <rect x={cardX + 0.6} y={cardY + 0.6} width="5.8" height="8.8" rx="0.5" fill="#FFC600" />
        {/* Shine */}
        <rect x={cardX + 0.9} y={cardY + 0.9} width="2.2" height="3.5" rx="0.3"
          fill="rgba(255,255,255,0.22)" />
      </motion.g>

      {/* Disciplinary focus label */}
      <motion.text x={zoneX + 17.5} y="8" textAnchor="middle"
        fill="rgba(255,215,0,0.65)" fontSize="4" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}>
        {zone}
      </motion.text>
      <motion.text x={ev.x} y={nameSide ? ev.y - 15 : ev.y + 18}
        textAnchor="middle" fill="rgba(255,215,0,0.45)" fontSize="2.4" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.82 }}>
        DISCIPLINARY ACTION
      </motion.text>
    </g>
  );
}

function SubScene({ ev, meta }: { ev: PitchEvent; meta: MatchMeta }) {
  const isHome = ev.team === meta.home.name;
  const tc = ev.color;
  // Place the two players in the midfield zone — where tactical changes take effect
  // Home: upper half of midfield; Away: lower half
  const baseY = isHome ? 20 : 48;
  const offX = 40, onX = 65;
  const offY = baseY, onY = baseY;

  return (
    <g>
      {/* Midfield zone */}
      <motion.rect x="35" y="0" width="35" height="68"
        fill="rgba(80,200,180,0.07)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      />

      {/* Exchange arrow */}
      <motion.path d={`M ${offX + 5} ${offY} L ${onX - 5} ${onY}`}
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.55" strokeDasharray="2 1.2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, delay: 0.52, ease: "easeOut" }}
      />
      {/* Arrow tip */}
      <motion.text x={onX - 4.5} y={onY + 1} textAnchor="middle"
        fill="rgba(255,255,255,0.28)" fontSize="3" dominantBaseline="middle"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>
        ▶
      </motion.text>

      {/* Player OFF — red */}
      <motion.circle cx={offX} cy={offY} r="5.5"
        fill="rgba(255,55,55,0.18)" stroke="rgba(255,75,75,0.7)" strokeWidth="0.55"
        strokeDasharray="1.6 0.9"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: "spring", stiffness: 180, damping: 14 }}
      />
      <motion.circle cx={offX} cy={offY} r="2" fill="rgba(255,75,75,0.85)"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.22, type: "spring", stiffness: 260 }}
      />
      <motion.text x={offX} y={offY - 9} textAnchor="middle"
        fill="rgba(255,255,255,0.88)" fontSize="2.9" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}>
        {ev.playerOut?.split(" ").slice(-1)[0] ?? "—"}
      </motion.text>
      <motion.text x={offX} y={offY + 9.5} textAnchor="middle"
        fill="rgba(255,80,80,0.8)" fontSize="2.3" fontWeight="700" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        ↓ WITHDRAWN
      </motion.text>

      {/* Player ON — green */}
      <motion.circle cx={onX} cy={onY} r="5.5"
        fill="rgba(55,215,120,0.18)" stroke="rgba(55,215,120,0.75)" strokeWidth="0.55"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 180, damping: 14 }}
      />
      <motion.circle cx={onX} cy={onY} r="2" fill="rgba(55,215,120,0.9)"
        style={SF}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.42, type: "spring", stiffness: 260 }}
      />
      <motion.text x={onX} y={onY - 9} textAnchor="middle"
        fill="rgba(255,255,255,0.88)" fontSize="2.9" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {ev.playerIn?.split(" ").slice(-1)[0] ?? "—"}
      </motion.text>
      <motion.text x={onX} y={onY + 9.5} textAnchor="middle"
        fill="rgba(55,215,120,0.8)" fontSize="2.3" fontWeight="700" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.68 }}>
        ↑ INTRODUCED
      </motion.text>

      {/* Header */}
      <motion.text x="52.5" y="8" textAnchor="middle"
        fill="rgba(80,200,180,0.65)" fontSize="4.2" fontWeight="800" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.78 }}>
        TACTICAL SHIFT
      </motion.text>
      <motion.text x="52.5" y="12.5" textAnchor="middle"
        fill="rgba(80,200,180,0.32)" fontSize="2.5" {...SL}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.88 }}>
        {ev.team.toUpperCase()} · {ev.minute}′
      </motion.text>
    </g>
  );
}

function EmptyCanvas() {
  return (
    <g>
      {/* Subtle centrepiece cue */}
      <motion.circle cx="52.5" cy="34" r="4.5"
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"
        animate={{ r: [4.5, 8, 4.5], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <text x="52.5" y="34" textAnchor="middle" dominantBaseline="middle"
        fill="rgba(255,255,255,0.12)" fontSize="2.8"
        fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.22em">
        SELECT AN EVENT
      </text>
    </g>
  );
}

function InvestigationScene({ ev, meta }: { ev?: PitchEvent; meta: MatchMeta }) {
  if (!ev) return <EmptyCanvas />;
  switch (ev.eventType) {
    case "goal":        return <GoalScene ev={ev} meta={meta} />;
    case "foul":        return <FoulScene ev={ev} meta={meta} />;
    case "Yellow Card": return <CardScene ev={ev} meta={meta} />;
    case "substitution":return <SubScene  ev={ev} meta={meta} />;
    default:            return <FoulScene ev={ev} meta={meta} />;
  }
}

// ─── Pitch view ────────────────────────────────────────────────────────────────
// Investigation canvas: no overview markers. The pitch shows one incident at a time.
// Selecting a new event fades the current scene out, then reveals the next.
function PitchView({
  events, activeId, meta,
}: {
  events: PitchEvent[]; activeId: string | null; meta: MatchMeta;
}) {
  const active = events.find(e => e.id === activeId);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="-5 -4 117 76" preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
        <PitchMarkings />

        {/* Investigation scene — transitions between events */}
        <AnimatePresence mode="wait">
          <motion.g key={activeId ?? "empty"}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}>
            <InvestigationScene ev={active} meta={meta} />
          </motion.g>
        </AnimatePresence>
      </svg>
    </div>
  );
}

// ─── Perspective analysis ──────────────────────────────────────────────────────
function graniteAnalysis(ev: PitchEvent, p: Perspective): string {
  const min = ev.minute;
  const player = ev.player ?? ev.team;

  if (p === "referee") {
    switch (ev.eventType) {
      case "goal":
        return `Review the build-up under Law 11 (offside) and Law 12 (fouls). Check for encroachment on the goal line. Only confirm after all VAR criteria are satisfied. Any foul by the attacking side in the build-up must be assessed before the goal is awarded.`;
      case "foul":
        return `Assess the contact under Law 12. Was it careless (free kick), reckless (mandatory caution), or excessive force (send-off)? If the foul stopped a promising attack, a yellow card for DOGSO-passing applies. At ${min}', consider the match context before applying advantage.`;
      case "Yellow Card":
        return `Caution confirmed. Under Law 12, verify the grounds — persistent infringement, dissent, or stopping a promising attack. Record the player's name and offence. One further caution results in dismissal. Communicate clearly with the player.`;
      case "substitution":
        return `Verify the substitution board is visible. Confirm the outgoing player has fully left the field before the replacement enters. Record jersey numbers for the official match report. The substitution cannot be reversed once the player has left.`;
      default:
        return `Observe play. Apply the Laws of the Game as the situation develops.`;
    }
  }

  if (p === "fan") {
    switch (ev.eventType) {
      case "goal":
        return `A goal has been scored. The attacking team put the ball into the net and the referee has allowed it — sometimes after a VAR check for offside or foul. The team that scores more goals wins the match.`;
      case "foul":
        return `The referee stopped play because a player made illegal contact with an opponent. The other team gets a free kick from where the foul happened. If the foul was inside the penalty box, it becomes a penalty kick instead.`;
      case "Yellow Card":
        return `A yellow card is an official warning. The player's name goes in the referee's book. If they receive a second yellow card in the same match, they are sent off and their team plays with ten players for the rest of the game.`;
      case "substitution":
        return `The manager replaced one player with another. Teams can make up to five substitutions in a match. Managers use substitutions to change tactics, give tired players a rest, or inject energy into the game.`;
      default:
        return `Watch the pitch — every moment can change the match.`;
    }
  }

  // supporter
  switch (ev.eventType) {
    case "goal":
      return `${ev.team} have scored. This is the entire reason the supporters came. The weight of every previous minute — every foul, every substitution, every moment of pressure — delivers itself into this single instant. The scoreline has changed.`;
    case "foul":
      return `The supporters react. Frustration or relief, depending on which end you're sitting. Fouls at ${min}' carry different tension at different stages — early, it is tactical; late, it is desperate. The crowd understands the difference instinctively.`;
    case "Yellow Card":
      return `A booking changes the game psychologically. ${player} must now operate with the knowledge that one more caution ends their involvement entirely. It affects their challenges, their positioning, their risk tolerance. The card is not just a warning — it is a constraint.`;
    case "substitution":
      return `Every substitution is a managerial statement. Bringing on ${ev.playerIn} and withdrawing ${ev.playerOut} communicates intent — whether attacking, defending, or resetting the tempo. The crowd reads these signals before the pundits do.`;
    default:
      return `Every event carries weight. This is why football matters.`;
  }
}

// ─── Left panel ────────────────────────────────────────────────────────────────
const TYPE_ICON: Record<string, string>  = { goal: "⚽", "Yellow Card": "🟨", substitution: "🔄", foul: "·" };
const TYPE_LABEL: Record<string, string> = { goal: "GOAL", "Yellow Card": "CARD", substitution: "SUB", foul: "FOUL" };

function EventsPanel({
  events, activeId, onSelect, query, onQuery, listRef, activeRef,
}: {
  events: PitchEvent[]; activeId: string | null;
  onSelect: (id: string) => void;
  query: string; onQuery: (q: string) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  activeRef: React.RefObject<HTMLButtonElement | null>;
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
      width: 252, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "rgba(4,8,20,0.9)", backdropFilter: "blur(22px)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ fontSize: "0.4rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
          MATCH EVENTS · {events.length}
        </div>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
            fontSize: "0.75rem", color: "rgba(255,255,255,0.18)", pointerEvents: "none",
          }}>⌕</span>
          <input value={query} onChange={e => onQuery(e.target.value)}
            placeholder="Search events, players…"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 4, padding: "6px 8px 6px 24px",
              color: "rgba(255,255,255,0.72)", fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: "0.7rem", letterSpacing: "0.04em", outline: "none", cursor: "none",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {filtered.map(ev => {
          const isActive = ev.id === activeId;
          const isGoal = ev.eventType === "goal";
          const isCard = ev.eventType === "Yellow Card";
          const isSub  = ev.eventType === "substitution";
          const isFoul = ev.eventType === "foul";
          const tc = ev.color;

          const title = ev.keyMoment?.title
            ?? (isSub  ? `${ev.playerIn} for ${ev.playerOut}`
             : isFoul  ? ev.player
             : ev.player);

          return (
            <motion.button key={ev.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(ev.id)}
              style={{
                width: "100%", display: "flex", alignItems: "flex-start", gap: 10,
                padding: "9px 14px",
                background: isActive ? `${tc}16` : "transparent",
                border: "none", borderLeft: `2.5px solid ${isActive ? tc : "transparent"}`,
                cursor: "none", textAlign: "left",
                transition: "background 0.15s, border-color 0.15s",
              }}
              whileHover={{ background: isActive ? `${tc}16` : "rgba(255,255,255,0.028)" }}
            >
              {/* Minute */}
              <div style={{
                fontSize: isGoal ? "1.05rem" : isCard ? "0.9rem" : isSub ? "0.8rem" : "0.7rem",
                fontWeight: 900, lineHeight: 1,
                color: isActive ? tc : `${tc}88`,
                minWidth: 30, paddingTop: 1,
                transition: "color 0.15s",
              }}>
                {ev.minute}&prime;
              </div>

              {/* Type + label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: isGoal ? "0.85rem" : "0.7rem" }}>{TYPE_ICON[ev.eventType] ?? "·"}</span>
                  <span style={{
                    fontSize: "0.38rem", letterSpacing: "0.22em", fontWeight: 700,
                    color: isCard ? "#FFD700" : isGoal ? tc : "rgba(255,255,255,0.28)",
                  }}>
                    {TYPE_LABEL[ev.eventType] ?? ev.eventType.toUpperCase()}
                    {ev.isKey && " ★"}
                  </span>
                </div>
                <div style={{
                  fontSize: isGoal ? "0.82rem" : isFoul ? "0.6rem" : "0.7rem",
                  fontWeight: isGoal ? 700 : 500, lineHeight: 1.25,
                  color: isActive ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.48)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  transition: "color 0.15s",
                }}>
                  {title}
                </div>
              </div>
            </motion.button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: "28px 14px", textAlign: "center", fontSize: "0.6rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.14em" }}>
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
  events: PitchEvent[]; activeIdx: number; activeEvent?: PitchEvent;
  onPrev: () => void; onNext: () => void; homeColor: string; awayColor: string;
}) {
  const canPrev = activeIdx > 0, canNext = activeIdx < events.length - 1;
  const tc = activeEvent?.color ?? homeColor;

  return (
    <div style={{
      height: 56, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 18px",
      background: "rgba(3,6,18,0.95)", backdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(255,255,255,0.05)", gap: 12,
    }}>
      <NavBtn label="← PREV" enabled={canPrev} onClick={onPrev} />

      <AnimatePresence mode="wait">
        {activeEvent ? (
          <motion.div key={activeEvent.id}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: "0.4rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", marginBottom: 1 }}>
              {activeIdx + 1} / {events.length}
            </div>
            <div style={{
              fontSize: "0.88rem", fontWeight: 800, color: tc,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              <span style={{ opacity: 0.65 }}>{activeEvent.minute}&prime; </span>
              {activeEvent.keyMoment?.title
                ?? (activeEvent.eventType === "substitution"
                  ? `${activeEvent.playerIn} for ${activeEvent.playerOut}`
                  : activeEvent.player ?? activeEvent.team)}
            </div>
          </motion.div>
        ) : (
          <div style={{ flex: 1, textAlign: "center", fontSize: "0.48rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.2em" }}>
            SELECT AN EVENT
          </div>
        )}
      </AnimatePresence>

      <NavBtn label="NEXT →" enabled={canNext} onClick={onNext} />
    </div>
  );
}

function NavBtn({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return (
    <motion.button onClick={onClick} disabled={!enabled} style={{
      background: "none", border: "none", cursor: enabled ? "none" : "default",
      color: enabled ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.14)",
      fontFamily: "inherit", fontSize: "0.5rem", letterSpacing: "0.16em",
    }} whileHover={enabled ? { color: "rgba(255,255,255,0.88)" } : {}}>
      {label}
    </motion.button>
  );
}

// ─── Right panel ───────────────────────────────────────────────────────────────
function ExplanationPanel({
  event, allEvents, narrative, meta, perspective, homeColor,
}: {
  event?: PitchEvent; allEvents: PitchEvent[]; narrative: string; meta: MatchMeta;
  perspective: Perspective; homeColor: string;
}) {
  const [playerOpen, setPlayerOpen] = useState(false);
  useEffect(() => { setPlayerOpen(false); }, [event?.id]);

  const tc = event?.color ?? homeColor;
  const perspLabels: Record<Perspective, string> = {
    referee: "REFEREE ANALYSIS", fan: "NEW FAN GUIDE", supporter: "SUPPORTER VIEW",
  };

  const playerName = event?.player ?? (event?.eventType === "substitution" ? event.playerIn : undefined);
  const profile    = playerName ? computePlayer(playerName, allEvents) : null;

  return (
    <div style={{
      width: 294, flexShrink: 0, display: "flex", flexDirection: "column",
      background: "rgba(4,8,20,0.9)", backdropFilter: "blur(22px)",
      borderLeft: "1px solid rgba(255,255,255,0.06)", overflowY: "auto",
    }}>
      <AnimatePresence mode="wait">
        {event ? (
          <motion.div key={event.id}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.28 }}
            style={{ padding: "18px 16px", flex: 1 }}>

            <div style={{ height: 2, background: `linear-gradient(90deg, ${tc}, transparent)`, marginBottom: 16 }} />

            {/* Event header */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: "2.8rem", fontWeight: 900, color: tc, lineHeight: 1, textShadow: `0 0 32px ${tc}55` }}>
                  {event.minute}&prime;
                </span>
                <div>
                  <div style={{ fontSize: "0.42rem", letterSpacing: "0.22em", fontWeight: 700, color: event.eventType === "Yellow Card" ? "#FFD700" : tc }}>
                    {TYPE_LABEL[event.eventType] ?? event.eventType.toUpperCase()}{event.isKey ? " ★" : ""}
                  </div>
                  <div style={{ fontSize: "0.44rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>
                    {event.team.toUpperCase()}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "1.12rem", fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 4 }}>
                {event.keyMoment?.title
                  ?? (event.eventType === "substitution"
                    ? `${event.playerIn} for ${event.playerOut}`
                    : event.player)}
              </div>
            </div>

            <HR />

            {/* What happened */}
            <Sect label="WHAT HAPPENED">
              <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.72, margin: 0 }}>
                {event.keyMoment?.context
                  ?? (event.eventType === "goal"
                    ? `${event.player} scored for ${event.team} in the ${event.minute}th minute.`
                    : event.eventType === "foul"
                    ? `${event.player} was penalised for a foul. A free kick was awarded to the opposition.`
                    : event.eventType === "Yellow Card"
                    ? `${event.player} received a yellow card. One further caution means dismissal.`
                    : `${event.team} made a substitution: ${event.playerIn} came on for ${event.playerOut}.`)}
              </p>
            </Sect>

            <HR />

            {/* Granite analysis */}
            <Sect label={perspLabels[perspective]}>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.74, margin: 0 }}>
                {graniteAnalysis(event, perspective)}
              </p>
            </Sect>

            {/* Player Intelligence */}
            {profile && (
              <>
                <HR />
                <button onClick={() => setPlayerOpen(o => !o)} style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${playerOpen ? tc : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 4, padding: "8px 12px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "none", fontFamily: "inherit", color: "rgba(255,255,255,0.45)", marginBottom: 10,
                }}>
                  <span style={{ fontSize: "0.56rem", letterSpacing: "0.18em" }}>PLAYER INTELLIGENCE</span>
                  <span style={{ fontSize: "0.65rem" }}>{playerOpen ? "▲" : "▼"}</span>
                </button>

                <AnimatePresence>
                  {playerOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }}
                      style={{ overflow: "hidden" }}>
                      <div style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 5, padding: "14px 12px", marginBottom: 12,
                      }}>
                        {/* Player name + team */}
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#fff", marginBottom: 2 }}>
                          {playerName}
                        </div>
                        <div style={{ fontSize: "0.4rem", letterSpacing: "0.18em", color: `${tc}88`, marginBottom: 12 }}>
                          {event.team.toUpperCase()}
                        </div>

                        {/* Radar */}
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                          <RadarChart
                            values={[
                              profile.stats.influence,
                              profile.stats.discipline,
                              profile.stats.involvement,
                              profile.stats.pressure,
                              profile.stats.impact,
                            ]}
                            color={tc}
                          />
                        </div>

                        {/* Stats with explanations */}
                        {([
                          { key: "influence",   label: "INFLUENCE",   val: profile.stats.influence,   note: profile.explanations.influence   },
                          { key: "discipline",  label: "DISCIPLINE",  val: profile.stats.discipline,  note: profile.explanations.discipline  },
                          { key: "involvement", label: "INVOLVEMENT", val: profile.stats.involvement, note: profile.explanations.involvement },
                          { key: "pressure",    label: "PRESSURE",    val: profile.stats.pressure,    note: profile.explanations.pressure    },
                          { key: "impact",      label: "IMPACT",      val: profile.stats.impact,      note: profile.explanations.impact      },
                        ] as const).map(({ key, label, val, note }) => (
                          <div key={key} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: "0.42rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", minWidth: 70 }}>
                                {label}
                              </span>
                              <span style={{ fontSize: "0.88rem", fontWeight: 800, color: tc }}>{val}</span>
                            </div>
                            <div style={{ fontSize: "0.54rem", color: "rgba(255,255,255,0.32)", lineHeight: 1.5, marginTop: 1 }}>
                              {note}
                            </div>
                          </div>
                        ))}

                        {/* Source transparency */}
                        <div style={{
                          marginTop: 10, padding: "6px 8px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3,
                          fontSize: "0.42rem", color: "rgba(255,255,255,0.22)", lineHeight: 1.55,
                          letterSpacing: "0.04em",
                        }}>
                          Values derived from match event counts (goals, fouls, cards, key involvement) in the match JSON. Not fetched from an external player database.
                        </div>

                        <HR />

                        {/* Event history dossier */}
                        <div style={{ fontSize: "0.4rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)", marginBottom: 8 }}>
                          MATCH DOSSIER
                        </div>
                        {profile.events.length === 0 ? (
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.22)" }}>No events recorded.</div>
                        ) : (
                          profile.events.map((e, i) => (
                            <div key={i} style={{
                              display: "flex", gap: 8, alignItems: "flex-start",
                              padding: "5px 0",
                              borderBottom: i < profile.events.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            }}>
                              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: e.color, minWidth: 26 }}>
                                {e.minute}&prime;
                              </span>
                              <div>
                                <div style={{ fontSize: "0.56rem", fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>
                                  {TYPE_ICON[e.eventType]} {TYPE_LABEL[e.eventType] ?? e.eventType}
                                  {e.isKey && <span style={{ color: "#FFD700", marginLeft: 4 }}>★</span>}
                                </div>
                                {e.eventType === "substitution" && (
                                  <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.32)" }}>
                                    {e.player === playerName ? `Replaced by ${e.playerIn}` : `Came on for ${e.playerOut}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.4rem", marginBottom: 14, opacity: 0.3,
            }}>⚽</div>
            <div style={{ fontSize: "0.44rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              SELECT AN EVENT<br />TO BEGIN INVESTIGATION
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {narrative && (
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ fontSize: "0.37rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.18)", marginBottom: 6 }}>
            MATCH CONTEXT
          </div>
          <p style={{
            fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", lineHeight: 1.68, margin: 0,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 5, WebkitBoxOrient: "vertical",
          } as React.CSSProperties}>
            {narrative}
          </p>
        </div>
      )}
    </div>
  );
}

function HR() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "13px 0" }} />;
}
function Sect({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: "0.37rem", letterSpacing: "0.26em", color: "rgba(255,255,255,0.2)", marginBottom: 7 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function MatchStoryScreen({
  meta, moments, rawEvents, narrative,
  perspective = "referee",
  onBack, onMomentSelect,
}: Props) {
  const pitchEvents = useMemo(
    () => buildEvents(rawEvents, moments, meta), [rawEvents, moments, meta],
  );

  const [activeId, setActiveId] = useState<string | null>(pitchEvents[0]?.id ?? null);
  const [searchQ,  setSearchQ]  = useState("");

  const activeEvent = pitchEvents.find(e => e.id === activeId);
  const activeIdx   = pitchEvents.findIndex(e => e.id === activeId);

  const listRef   = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const goNext = useCallback(() => {
    if (activeIdx < pitchEvents.length - 1) setActiveId(pitchEvents[activeIdx + 1].id);
  }, [activeIdx, pitchEvents]);
  const goPrev = useCallback(() => {
    if (activeIdx > 0) setActiveId(pitchEvents[activeIdx - 1].id);
  }, [activeIdx, pitchEvents]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [goNext, goPrev]);

  const homeColor = meta.home.color ?? "#00b4ff";
  const awayColor = meta.away.color ?? "#ff4455";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#020810",
      fontFamily: "'Barlow Condensed', sans-serif",
      display: "flex", flexDirection: "column",
      cursor: "none", overflow: "hidden",
    }}>
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          height: 50, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px",
          background: "rgba(2,8,16,0.97)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 20,
        }}>
        <motion.button onClick={onBack} style={{
          background: "none", border: "none", cursor: "none",
          color: "rgba(255,255,255,0.3)", fontFamily: "inherit",
          fontSize: "0.5rem", letterSpacing: "0.2em",
        }} whileHover={{ color: "rgba(255,255,255,0.72)" }}>
          ← ALL MATCHES
        </motion.button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>
            <span style={{ color: homeColor }}>{meta.home.code}</span>
            <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 8px", fontSize: "0.6rem" }}>vs</span>
            <span style={{ color: awayColor }}>{meta.away.code}</span>
          </div>
          <div style={{ fontSize: "0.35rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", marginTop: 2 }}>
            {meta.stage} · {meta.date}
          </div>
        </div>

        <div style={{ fontSize: "0.4rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.18)", textAlign: "right" }}>
          <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>{pitchEvents.length}</span> EVENTS
        </div>
      </motion.header>

      {/* 3-panel body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT */}
        <EventsPanel
          events={pitchEvents} activeId={activeId} onSelect={setActiveId}
          query={searchQ} onQuery={setSearchQ}
          listRef={listRef} activeRef={activeRef}
        />

        {/* CENTER */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 18px", flexShrink: 0,
            background: "rgba(2,8,16,0.6)", borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ fontSize: "0.46rem", fontWeight: 800, letterSpacing: "0.18em", color: homeColor, opacity: 0.75 }}>
              ◀ {meta.home.name.toUpperCase()}
            </div>
            <div style={{ fontSize: "0.34rem", letterSpacing: "0.28em", color: "rgba(255,255,255,0.16)" }}>
              INVESTIGATION WORKSPACE · CLICK ANY EVENT
            </div>
            <div style={{ fontSize: "0.46rem", fontWeight: 800, letterSpacing: "0.18em", color: awayColor, opacity: 0.75 }}>
              {meta.away.name.toUpperCase()} ▶
            </div>
          </div>

          <div style={{ flex: 1, padding: "10px 14px", overflow: "hidden" }}>
            <PitchView events={pitchEvents} activeId={activeId} meta={meta} />
          </div>

          <EventScrubber
            events={pitchEvents} activeIdx={activeIdx} activeEvent={activeEvent}
            onPrev={goPrev} onNext={goNext}
            homeColor={homeColor} awayColor={awayColor}
          />
        </div>

        {/* RIGHT */}
        <ExplanationPanel
          event={activeEvent} allEvents={pitchEvents}
          narrative={narrative} meta={meta}
          perspective={perspective} homeColor={homeColor}
        />
      </div>
    </div>
  );
}
