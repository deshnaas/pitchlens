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

// ─── Zone-based event visualization ───────────────────────────────────────────
// Uses football pitch zones (Attacking Third, Penalty Area, Midfield, etc.)
// Does NOT fabricate individual player positions or tracking coordinates.
function ZoneViz({ ev, meta }: { ev: PitchEvent; meta: MatchMeta }) {
  const tc   = ev.color;
  const isHome = ev.team === meta.home.name;

  // ── GOAL ──
  if (ev.eventType === "goal") {
    const penX = isHome ? 88.5 : 0;
    const penW = 16.5;
    const atkX = isHome ? 70 : 0;
    const atkW = 35;
    const goalX = isHome ? 103 : -2;
    const ballX = isHome ? 95 + (ev.x - 89) : 5 - (ev.x - 3); // approximate shot location

    return (
      <g filter="url(#glow)">
        {/* Attacking third zone */}
        <motion.rect x={atkX} y="0" width={atkW} height="68"
          fill={`${tc}0e`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
        />
        {/* Penalty area highlight */}
        <motion.rect x={penX} y="13.84" width={penW} height="40.32"
          fill={`${tc}28`} stroke={tc} strokeWidth="0.45" strokeDasharray="1.6 0.9" rx="0.4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.18 }}
        />
        {/* Goal flash */}
        <motion.rect x={goalX} y="30.34" width="3.5" height="7.32"
          fill={`${tc}60`}
          initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 1] }}
          transition={{ duration: 0.55, delay: 0.35 }}
        />
        {/* Ball approximate position */}
        <motion.circle cx={ev.x} cy={ev.y} r="1.6" fill="white"
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 0.5, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Zone labels */}
        <text x={isHome ? 87.5 : 17.5} y="7.5" textAnchor="middle"
          fill={tc} fontSize="3" fontFamily="'Barlow Condensed',sans-serif"
          fontWeight="700" letterSpacing="0.1" opacity="0.6">
          ATTACKING THIRD
        </text>
        <text x={isHome ? 97 : 8} y="10" textAnchor="middle"
          fill={tc} fontSize="2.4" fontFamily="'Barlow Condensed',sans-serif"
          opacity="0.85" letterSpacing="0.06">
          PENALTY AREA
        </text>
      </g>
    );
  }

  // ── FOUL or YELLOW CARD ──
  if (ev.eventType === "foul" || ev.eventType === "Yellow Card") {
    const isCard  = ev.eventType === "Yellow Card";
    const cc      = isCard ? "#FFD700" : tc;
    const zone    = ev.x < 35 ? "DEFENSIVE THIRD" : ev.x > 70 ? "ATTACKING THIRD" : "MIDFIELD";
    const zoneX   = ev.x < 35 ? 0 : ev.x > 70 ? 70 : 35;
    const zoneW   = 35;
    const labelY  = ev.y > 40 ? ev.y - 13 : ev.y + 13;
    const nameY   = ev.y > 40 ? ev.y + 12 : ev.y - 10;

    return (
      <g filter="url(#glow)">
        {/* Zone band */}
        <motion.rect x={zoneX} y="0" width={zoneW} height="68"
          fill={`${cc}08`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        />
        {/* Contact radius */}
        <motion.circle cx={ev.x} cy={ev.y} r="9"
          fill={`${cc}14`} stroke={cc} strokeWidth="0.4" strokeDasharray="1.4 0.9"
          initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        />
        {/* Event mark */}
        <text x={ev.x} y={ev.y + 1.2} textAnchor="middle" dominantBaseline="middle"
          fill={isCard ? "#FFD700" : "rgba(255,80,80,0.92)"} fontSize="6" fontWeight="900">
          {isCard ? "▪" : "✕"}
        </text>
        {/* Player name */}
        <text x={ev.x} y={nameY} textAnchor="middle"
          fill={tc} fontSize="2.5" fontFamily="'Barlow Condensed',sans-serif" fontWeight="700">
          {ev.player}
        </text>
        {/* Zone label */}
        <text x={ev.x} y={labelY} textAnchor="middle"
          fill="rgba(255,255,255,0.3)" fontSize="2.2"
          fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.1">
          {zone}
        </text>
      </g>
    );
  }

  // ── SUBSTITUTION ──
  if (ev.eventType === "substitution") {
    const isTop = ev.y < 34;
    const dy    = isTop ? 4 : -4;

    return (
      <g filter="url(#glow)">
        {/* Midfield zone */}
        <motion.rect x="35" y="0" width="35" height="68"
          fill="rgba(80,200,180,0.07)"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        />
        <text x="52.5" y="7" textAnchor="middle"
          fill="rgba(80,200,180,0.35)" fontSize="2.4"
          fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.12">
          MIDFIELD — TACTICAL CHANGE
        </text>
        {/* Touchline marker */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <line x1={ev.x - 5} y1={isTop ? 0 : 68} x2={ev.x + 5} y2={isTop ? 0 : 68}
            stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
          <text x={ev.x - 3.5} y={isTop ? 0 + dy + 4 : 68 + dy - 1}
            textAnchor="middle" fill="rgba(80,220,120,0.92)"
            fontSize="2.6" fontFamily="'Barlow Condensed',sans-serif">
            ↑ {ev.playerIn?.split(" ").slice(-1)[0]}
          </text>
          <text x={ev.x + 4} y={isTop ? 0 + dy + 4 : 68 + dy - 1}
            textAnchor="middle" fill="rgba(255,80,80,0.85)"
            fontSize="2.6" fontFamily="'Barlow Condensed',sans-serif">
            ↓ {ev.playerOut?.split(" ").slice(-1)[0]}
          </text>
        </motion.g>
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
  onSelect: (id: string) => void; meta: MatchMeta;
}) {
  const active = events.find(e => e.id === activeId);
  const mr = (ev: PitchEvent) =>
    ev.eventType === "goal" ? 1.9 : ev.eventType === "Yellow Card" ? 1.5
    : ev.eventType === "substitution" ? 1.3 : 0.85;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg viewBox="-5 -4 117 76" preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
        <PitchMarkings />

        {/* Zone visualization for active event (renders BELOW markers) */}
        <AnimatePresence mode="wait">
          {active && (
            <motion.g key={`viz-${activeId}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}>
              <ZoneViz ev={active} meta={meta} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* All event markers */}
        {events.map(ev => {
          const isActive = ev.id === activeId;
          const r = mr(ev);
          const tc = ev.color;
          const isGoal = ev.eventType === "goal";
          const isCard = ev.eventType === "Yellow Card";

          return (
            <g key={ev.id} onClick={() => onSelect(ev.id)} style={{ cursor: "pointer" }}>
              {isActive && (
                <motion.circle cx={ev.x} cy={ev.y} r={r * 4.5}
                  fill="none" stroke={tc} strokeWidth="0.35"
                  animate={{ r: [r * 3, r * 6, r * 3], opacity: [0.55, 0, 0.55] }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <circle cx={ev.x} cy={ev.y} r={Math.max(r + 1.4, 2.8)} fill="transparent" />
              <circle cx={ev.x} cy={ev.y} r={isActive ? r * 1.9 : r}
                fill={isCard ? "#FFD700" : isGoal ? tc : `${tc}${isActive ? "dd" : "88"}`}
                stroke={isActive ? "rgba(255,255,255,0.9)" : isGoal ? "rgba(255,255,255,0.3)" : "none"}
                strokeWidth={isActive ? "0.45" : "0.2"}
                opacity={isActive ? 1 : 0.7}
              />
            </g>
          );
        })}
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
            <PitchView events={pitchEvents} activeId={activeId} onSelect={setActiveId} meta={meta} />
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
