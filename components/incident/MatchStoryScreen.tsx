"use client";

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

// ─── Internal event type ───────────────────────────────────────────────────────
type PitchEvent = {
  id: string;
  eventType: string; minute: number; second: number;
  team: string; player?: string; playerIn?: string; playerOut?: string;
  isKey: boolean; keyMoment?: KeyMoment;
  color: string;
  x: number; y: number;
};

// ─── Reconstruction frame types ────────────────────────────────────────────────
type ZoneDef = {
  id: string; x: number; y: number; w: number; h: number;
  color: string; opacity: number; rx?: number;
  label?: string; labelX?: number; labelY?: number; dashed?: boolean;
};
type MarkerDef = {
  id: string; label: string; cx: number; cy: number;
  color: string; teamSide: "home" | "away"; highlight?: boolean;
};
type ArrowDef = {
  id: string; x1: number; y1: number; x2: number; y2: number;
  type: "pass" | "run" | "shot" | "press";
  color: string; curved?: boolean; cpx?: number; cpy?: number;
};
type PitchLabelDef = {
  id: string; x: number; y: number; text: string;
  size: "sm" | "md" | "lg"; color?: string;
};
type ReconFrame = {
  id: number; label: string; narration: string;
  zones: ZoneDef[]; markers: MarkerDef[];
  arrows: ArrowDef[]; labels: PitchLabelDef[];
};

// ─── Seeded zone placement ─────────────────────────────────────────────────────
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
      return isHome
        ? { x: 89 + r(1) * 13, y: 26 + r(2) * 16 }
        : { x: 3  + r(1) * 10, y: 26 + r(2) * 16 };
    case "substitution":
      return { x: 42 + r(1) * 21, y: isHome ? 1.2 : 66.8 };
    default:
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

// ─── Frame builders ────────────────────────────────────────────────────────────
function buildGoalFrames(ev: PitchEvent, meta: MatchMeta, p: Perspective): ReconFrame[] {
  const isHome = ev.team === meta.home.name;
  const tc  = ev.color;
  const opp = isHome ? (meta.away.color ?? "#ff4455") : (meta.home.color ?? "#00b4ff");
  const scorer  = ev.player ?? "Scorer";
  const short   = scorer.split(" ").slice(-1)[0];
  const teamU   = (isHome ? meta.home.name : meta.away.name).toUpperCase();
  const oppU    = (isHome ? meta.away.name : meta.home.name).toUpperCase();
  const min     = ev.minute;
  const cx      = (x: number) => isHome ? x : 105 - x;
  const goalX   = isHome ? 104.4 : 0.6;
  const atkX    = isHome ? 70 : 0;
  const penX    = isHome ? 88.5 : 0;
  const penLX   = isHome ? 97 : 8;
  const txtX    = isHome ? 26 : 79;

  const MF1 = { cx: cx(38), cy: 22 };
  const MF2 = { cx: cx(40), cy: 46 };
  const S0  = { cx: cx(55), cy: 30 };
  const S1  = { cx: cx(62), cy: 28 };
  const S2  = { cx: cx(78), cy: 22 };
  const S3  = { cx: cx(93), cy: 31 };
  const D1  = { cx: cx(60), cy: 20 };
  const D2  = { cx: cx(60), cy: 46 };
  const D3  = { cx: cx(71), cy: 32 };

  const moveT = { duration: 0.65, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] };
  void moveT;

  return [
    {
      id: 0, label: "BUILD-UP PHASE",
      narration: p === "referee"
        ? `${teamU} possession confirmed in midfield. ${scorer} positioned centrally — no offside noted. ${oppU}'s defensive structure is organized but beginning to be probed by ball movement across the lines.`
        : p === "fan"
        ? `${teamU} are working the ball through the midfield. ${scorer} is showing for it centrally while ${oppU} try to stay compact. This is the build-up that precedes the chance.`
        : `${teamU} in possession. Patient. Deliberate. The stadium can feel that something is building — ${scorer} keeps moving, keeps finding space.`,
      zones: [
        { id: "mid", x: 35, y: 0, w: 35, h: 68, color: tc, opacity: 0.08, label: "MIDFIELD CONTROL", labelX: 52.5, labelY: 7.5 },
      ],
      markers: [
        { id: "mf1", label: "",    cx: MF1.cx, cy: MF1.cy, color: tc,  teamSide: "home" },
        { id: "mf2", label: "",    cx: MF2.cx, cy: MF2.cy, color: tc,  teamSide: "home" },
        { id: "scorer", label: short, cx: S0.cx, cy: S0.cy, color: tc, teamSide: "home" },
        { id: "def1", label: "",   cx: D1.cx,  cy: D1.cy,  color: opp, teamSide: "away" },
        { id: "def2", label: "",   cx: D2.cx,  cy: D2.cy,  color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "p1", x1: MF1.cx, y1: MF1.cy, x2: S0.cx, y2: S0.cy, type: "pass", color: `${tc}70`, curved: false },
      ],
      labels: [],
    },
    {
      id: 1, label: "DEFENSIVE BLOCK",
      narration: p === "referee"
        ? `${oppU} compact shape confirmed — four-man block in the central zone. Analysis: the wide channels are exposed. ${scorer} is drifting toward the half-space behind the midfield line — potential offside trap needs monitoring.`
        : p === "fan"
        ? `${oppU} drop into a defensive block. This compresses the central areas but leaves gaps in the wider channels. Watch the space on the right — ${scorer} is about to find it.`
        : `${oppU} dig in. But listen to the crowd — they can see the space opening before the players even move. ${scorer} is drifting. The half-space is there.`,
      zones: [
        { id: "block", x: isHome ? 52.5 : 17.5, y: 10, w: 35, h: 48, color: opp, opacity: 0.1, label: "DEFENSIVE BLOCK", labelX: isHome ? 70 : 35, labelY: 8 },
      ],
      markers: [
        { id: "mf1",   label: "",    cx: cx(42),    cy: 22,     color: tc,  teamSide: "home" },
        { id: "mf2",   label: "",    cx: cx(42),    cy: 46,     color: tc,  teamSide: "home" },
        { id: "scorer", label: short, cx: S1.cx,    cy: S1.cy,  color: tc,  teamSide: "home" },
        { id: "def1",  label: "",    cx: cx(65),    cy: 20,     color: opp, teamSide: "away" },
        { id: "def2",  label: "",    cx: cx(65),    cy: 46,     color: opp, teamSide: "away" },
        { id: "def3",  label: "",    cx: D3.cx,     cy: D3.cy,  color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "pr1", x1: cx(65), y1: 20, x2: cx(55), y2: 26, type: "press", color: `${opp}55`, curved: false },
        { id: "pr2", x1: cx(65), y1: 46, x2: cx(55), y2: 40, type: "press", color: `${opp}55`, curved: false },
      ],
      labels: [
        { id: "l1", x: isHome ? 18 : 87, y: 63, text: "SPACE IN CHANNEL", size: "sm" as const, color: "rgba(255,255,255,0.22)" },
      ],
    },
    {
      id: 2, label: "CHANNEL EXPLOITED",
      narration: p === "referee"
        ? `${scorer} enters the attacking channel — currently onside. The defensive line has shifted, creating a gap. This is the decisive movement leading to the shot on goal. Offside check: position valid at the moment the ball was played.`
        : p === "fan"
        ? `This is the key moment! ${scorer} runs into the space behind ${oppU}'s defensive line. The defenders are caught between tracking the run and holding their position. The channel is open.`
        : `There it is. The run everyone sensed was coming. ${scorer} goes — the whole ground rises — the channel opens and there is nothing ${oppU} can do about it now.`,
      zones: [
        { id: "atk",     x: atkX, y: 0,  w: 35, h: 68, color: tc, opacity: 0.1 },
        { id: "channel", x: isHome ? 70 : 0, y: 10, w: 20, h: 26, color: tc, opacity: 0.18, label: "HALF SPACE", labelX: isHome ? 80 : 10, labelY: 9 },
      ],
      markers: [
        { id: "scorer", label: short, cx: S2.cx, cy: S2.cy, color: tc,  teamSide: "home", highlight: true },
        { id: "def1",   label: "",    cx: cx(74), cy: 22,   color: opp, teamSide: "away" },
        { id: "def2",   label: "",    cx: cx(74), cy: 44,   color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "run", x1: S1.cx, y1: S1.cy, x2: S2.cx, y2: S2.cy, type: "run", color: tc, curved: true, cpx: (S1.cx + S2.cx) / 2, cpy: ((S1.cy + S2.cy) / 2) - 7 },
      ],
      labels: [
        { id: "l1", x: isHome ? 18 : 87, y: 63, text: "ATTACKING RUN",          size: "sm" as const, color: "rgba(255,255,255,0.28)" },
        { id: "l2", x: isHome ? 18 : 87, y: 67, text: "DEFENSIVE LINE BROKEN",  size: "sm" as const, color: "rgba(255,255,255,0.16)" },
      ],
    },
    {
      id: 3, label: "GOAL",
      narration: p === "referee"
        ? `Goal confirmed. ${scorer} scores for ${teamU} at ${min}'. ${ev.keyMoment?.context ?? `Shot taken from within the penalty area. No offside detected in the build-up. Goal stands.`}`
        : p === "fan"
        ? `GOAL! ${scorer} scores for ${teamU} in the ${min}th minute! The shot goes in from the penalty area. ${ev.keyMoment?.context ?? `${teamU} lead. ${oppU} must now push forward to respond.`}`
        : `${short.toUpperCase()}. ${min}′. ${teamU.toUpperCase()}. ${ev.keyMoment?.context ?? `The ground erupts. This is why they came. The scoreline has changed.`}`,
      zones: [
        { id: "atk", x: atkX,  y: 0,     w: 35,  h: 68,    color: tc, opacity: 0.12 },
        { id: "pen", x: penX,  y: 13.84, w: 16.5, h: 40.32, color: tc, opacity: 0.25, dashed: true, label: "PENALTY AREA", labelX: penLX, labelY: 11 },
      ],
      markers: [
        { id: "scorer", label: short, cx: S3.cx, cy: S3.cy, color: tc, teamSide: "home", highlight: true },
      ],
      arrows: [
        { id: "shot", x1: S3.cx, y1: S3.cy, x2: goalX, y2: 34, type: "shot", color: "rgba(255,255,255,0.78)", curved: true, cpx: (S3.cx + goalX) / 2, cpy: 28 },
      ],
      labels: [
        { id: "lg", x: txtX, y: 32, text: "GOAL", size: "lg" as const, color: tc },
        { id: "l1", x: txtX, y: 62, text: `${teamU} TAKE THE LEAD`,    size: "sm" as const, color: `${tc}88` },
        { id: "l2", x: txtX, y: 67, text: `${min}′ · PENALTY AREA`,    size: "sm" as const, color: "rgba(255,255,255,0.2)" },
      ],
    },
  ];
}

function buildFoulFrames(ev: PitchEvent, meta: MatchMeta, p: Perspective): ReconFrame[] {
  const isHome = ev.team === meta.home.name;
  const tc  = ev.color;
  const opp = isHome ? (meta.away.color ?? "#ff4455") : (meta.home.color ?? "#00b4ff");
  const player = ev.player ?? "Player";
  const short  = player.split(" ").slice(-1)[0];
  const teamU  = (isHome ? meta.home.name : meta.away.name).toUpperCase();
  const zone   = ev.x < 35 ? "DEFENSIVE THIRD" : ev.x > 70 ? "ATTACKING THIRD" : "MIDFIELD";
  const zoneX  = ev.x < 35 ? 0 : ev.x > 70 ? 70 : 35;
  const min    = ev.minute;
  const yOff   = (min * 3) % 7 - 3;
  const approach = { cx: ev.x + (ev.x > 52 ? -10 : 10), cy: Math.max(3, Math.min(65, ev.y + yOff)) };

  return [
    {
      id: 0, label: "CHALLENGE APPROACH",
      narration: p === "referee"
        ? `${player} advances toward the ball carrier in the ${zone.toLowerCase()}. Referee tracking the challenge — Law 12 assessment will depend on the nature of contact: careless, reckless, or excessive force.`
        : p === "fan"
        ? `${player} goes in for the challenge. The referee is watching closely. If the contact is unfair, play will be stopped and a free kick awarded to the other team.`
        : `${short} goes for it. The ball. The opponent. The crowd can see the collision coming before it happens.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: tc, opacity: 0.08, label: zone, labelX: zoneX + 17.5, labelY: 7.5 },
      ],
      markers: [
        { id: "fouler", label: short,  cx: approach.cx, cy: approach.cy, color: tc,  teamSide: "home" },
        { id: "opp",    label: "OPP",  cx: ev.x,        cy: ev.y,        color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "app", x1: approach.cx, y1: approach.cy, x2: ev.x, y2: ev.y, type: "run", color: `${tc}70`, curved: false },
      ],
      labels: [
        { id: "l1", x: 52.5, y: 63, text: "CHALLENGE DEVELOPING", size: "sm" as const, color: "rgba(255,255,255,0.22)" },
      ],
    },
    {
      id: 1, label: "CONTACT POINT",
      narration: p === "referee"
        ? `Contact confirmed in the ${zone.toLowerCase()}. Assessment under Law 12: the nature of the challenge determines the sanction. ${ev.isKey ? "Reckless contact — mandatory caution to be issued." : "Careless contact — free kick awarded, no further action."}`
        : p === "fan"
        ? `Contact is made and the referee stops the game. ${player} has caught their opponent. The other team will receive a free kick from this position in the ${zone.toLowerCase()}.`
        : `The whistle. The crowd reacts immediately. ${short} caught their man. Free kick. ${zone}. Every player reacts.`,
      zones: [
        { id: "zone",    x: zoneX,    y: 0,         w: 35, h: 68, color: tc,                     opacity: 0.09 },
        { id: "contact", x: ev.x - 9, y: ev.y - 9,  w: 18, h: 18, color: "rgba(255,80,80,0.7)", opacity: 0.18, rx: 9, dashed: true },
      ],
      markers: [
        { id: "fouler", label: short, cx: ev.x, cy: ev.y, color: tc,  teamSide: "home", highlight: true },
        { id: "opp",    label: "OPP", cx: ev.x + (ev.x > 52 ? 6 : -6), cy: ev.y + 2, color: opp, teamSide: "away" },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: "ILLEGAL CONTACT · LAW 12", size: "sm" as const, color: "rgba(255,80,80,0.55)" },
        { id: "l2", x: 52.5, y: 67, text: `${zone} · ${min}′`,         size: "sm" as const, color: "rgba(255,255,255,0.2)" },
      ],
    },
    {
      id: 2, label: "FREE KICK AWARDED",
      narration: p === "referee"
        ? `Free kick awarded in the ${zone.toLowerCase()} (Law 13). All opponents must retreat the required distance. Ball is not in play until the kick is taken. ${teamU === (isHome ? meta.home.name : meta.away.name).toUpperCase() ? "" : `${(isHome ? meta.away.name : meta.home.name).toUpperCase()}`} will take the set piece.`
        : p === "fan"
        ? `The opposition gets a free kick from this position in the ${zone.toLowerCase()}. They'll set up to deliver the ball — either shooting directly or crossing into the box, depending on the location.`
        : `Free kick. The players set up. The wall forms. Silence, then noise. This is the moment from which anything can happen.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: opp, opacity: 0.1, label: "FREE KICK POSITION", labelX: zoneX + 17.5, labelY: 8 },
      ],
      markers: [],
      arrows: [],
      labels: [
        { id: "l1", x: ev.x, y: ev.y - 4, text: "FREE KICK",              size: "md" as const, color: "rgba(255,255,255,0.7)" },
        { id: "l2", x: 52.5, y: 62,        text: "DIRECT FREE KICK · LAW 13", size: "sm" as const, color: "rgba(255,255,255,0.28)" },
        { id: "l3", x: 52.5, y: 67,        text: `${zone} · ${min}′`,     size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
  ];
}

function buildCardFrames(ev: PitchEvent, meta: MatchMeta, p: Perspective): ReconFrame[] {
  const isHome = ev.team === meta.home.name;
  const tc  = ev.color;
  const opp = isHome ? (meta.away.color ?? "#ff4455") : (meta.home.color ?? "#00b4ff");
  const player = ev.player ?? "Player";
  const short  = player.split(" ").slice(-1)[0];
  const zone   = ev.x < 35 ? "DEFENSIVE THIRD" : ev.x > 70 ? "ATTACKING THIRD" : "MIDFIELD";
  const zoneX  = ev.x < 35 ? 0 : ev.x > 70 ? 70 : 35;
  const min    = ev.minute;

  return [
    {
      id: 0, label: "INCIDENT",
      narration: p === "referee"
        ? `${player} commits a sanctionable offence in the ${zone.toLowerCase()}. The challenge or conduct meets the threshold for an official caution under Law 12. Referee approaches to issue the card.`
        : p === "fan"
        ? `Something happened that the referee decided required an official warning. ${player} is being booked — given a yellow card. This is their formal caution for this match.`
        : `The referee reaches into the pocket. ${short} knows what's coming. The whole stadium knows.`,
      zones: [
        { id: "zone",    x: zoneX,    y: 0,        w: 35, h: 68, color: "#FFD700",            opacity: 0.07 },
        { id: "contact", x: ev.x - 9, y: ev.y - 9, w: 18, h: 18, color: "rgba(255,215,0,0.7)", opacity: 0.18, rx: 9, dashed: true },
      ],
      markers: [
        { id: "player", label: short, cx: ev.x, cy: ev.y, color: tc,  teamSide: "home", highlight: true },
        { id: "opp",    label: "OPP", cx: ev.x + (ev.x > 52 ? 7 : -7), cy: ev.y + 3, color: opp, teamSide: "away" },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: `${zone} · SANCTIONABLE OFFENCE`, size: "sm" as const, color: "rgba(255,215,0,0.45)" },
        { id: "l2", x: 52.5, y: 67, text: `${min}′`,                         size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
    {
      id: 1, label: "LAW 12 APPLIED",
      narration: p === "referee"
        ? `Caution issued under Law 12. Grounds: ${ev.isKey ? "stopping a promising attack / persistent infringement" : "careless/reckless challenge"}. Record in match report. Communicate clearly — explain the reason for the caution to the player.`
        : p === "fan"
        ? `The referee shows the yellow card. This is an official warning under the Laws of the Game. ${player} must now be careful — a second yellow card in the same match means they will be sent off, leaving their team with ten players.`
        : `Yellow. ${short.toUpperCase()}. The card is out. One more caution and they walk. The psychological weight of that card is immediate — it changes how they play for the rest of the match.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: "#FFD700", opacity: 0.1 },
      ],
      markers: [
        { id: "player", label: short, cx: ev.x, cy: ev.y, color: tc, teamSide: "home", highlight: true },
      ],
      arrows: [],
      labels: [
        { id: "lg", x: 52.5, y: 30, text: "YELLOW CARD",  size: "lg" as const, color: "#FFD700" },
        { id: "l1", x: 52.5, y: 62, text: "OFFICIAL CAUTION · LAW 12", size: "sm" as const, color: "rgba(255,215,0,0.55)" },
        { id: "l2", x: 52.5, y: 67, text: `${player} · ${min}′`,        size: "sm" as const, color: "rgba(255,255,255,0.22)" },
      ],
    },
    {
      id: 2, label: "CONSEQUENCE",
      narration: p === "referee"
        ? `${player} is now on a caution. Any further bookable offence results in a second yellow and automatic dismissal. Monitor ${player}'s challenges for the remainder of the match. Inform the fourth official of the caution for the official record.`
        : p === "fan"
        ? `${player} must now play carefully for the rest of the game. One more yellow card means they are sent off and cannot be replaced — their team would play with ten people. Managers often substitute cautioned players to avoid the risk.`
        : `One caution. The game has changed for ${short}. They know it. Their manager knows it. Every challenge from here is a calculation — win the ball or risk the team playing a man down.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: "#FFD700", opacity: 0.06 },
      ],
      markers: [],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 30, text: "ONE FURTHER CAUTION",  size: "md" as const, color: "rgba(255,215,0,0.65)" },
        { id: "l2", x: 52.5, y: 37, text: "RESULTS IN DISMISSAL", size: "md" as const, color: "rgba(255,215,0,0.4)" },
        { id: "l3", x: 52.5, y: 62, text: "PLAYER REMAINS ON CAUTION",     size: "sm" as const, color: "rgba(255,255,255,0.22)" },
        { id: "l4", x: 52.5, y: 67, text: "RISK MANAGEMENT NOW CRITICAL",  size: "sm" as const, color: "rgba(255,255,255,0.16)" },
      ],
    },
  ];
}

function buildSubFrames(ev: PitchEvent, meta: MatchMeta, p: Perspective): ReconFrame[] {
  const isHome   = ev.team === meta.home.name;
  const tc       = ev.color;
  const teamU    = (isHome ? meta.home.name : meta.away.name).toUpperCase();
  const inName   = ev.playerIn  ?? "Incoming";
  const outName  = ev.playerOut ?? "Outgoing";
  const inShort  = inName.split(" ").slice(-1)[0];
  const outShort = outName.split(" ").slice(-1)[0];
  const min      = ev.minute;
  const touchY   = isHome ? 3.5 : 64.5;
  const centerCx = 52.5;

  return [
    {
      id: 0, label: "CURRENT SETUP",
      narration: p === "referee"
        ? `${outName} is about to be withdrawn. The fourth official will display the substitution board. Verify the outgoing player has fully exited the field before the replacement enters — Law 3 requirement.`
        : p === "fan"
        ? `${outName} is being substituted off. The manager has decided to change things — this could be tactical, or the player may be tired or carrying a knock. The new player will bring fresh energy.`
        : `${outShort} is coming off. The crowd acknowledges the player — every substitution is a statement about how the manager reads the game at this moment.`,
      zones: [
        { id: "mid", x: 35, y: 0, w: 35, h: 68, color: tc, opacity: 0.08, label: "CURRENT POSITION", labelX: 52.5, labelY: 7.5 },
      ],
      markers: [
        { id: "outgoing", label: outShort, cx: centerCx, cy: 34, color: tc, teamSide: "home" },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: `${outShort} TO BE WITHDRAWN`, size: "sm" as const, color: `${tc}70` },
        { id: "l2", x: 52.5, y: 67, text: `${min}′ · ${teamU}`,          size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
    {
      id: 1, label: "SUBSTITUTION",
      narration: p === "referee"
        ? `Substitution made: ${inName} replaces ${outName} for ${teamU} at ${min}'. Board displayed, both players confirmed. Record jersey numbers in the official match report. Law 3 complied with.`
        : p === "fan"
        ? `${outName} leaves the pitch and ${inName} comes on. Both players pass through the technical area. Teams can make up to five substitutions per match — the manager is using one of them here.`
        : `${outShort} walks off. ${inShort} comes on. The dugout makes a move. The crowd watches to understand what it means — attack, defence, or simply fresh legs?`,
      zones: [
        { id: "touch", x: 40, y: isHome ? 0 : 63.5, w: 25, h: 4.5, color: tc, opacity: 0.12, label: "TECHNICAL AREA", labelX: 52.5, labelY: isHome ? 3 : 69 },
      ],
      markers: [
        { id: "outgoing", label: outShort, cx: centerCx - 4, cy: touchY, color: `${tc}66`, teamSide: "home" },
        { id: "incoming", label: inShort,  cx: centerCx + 4, cy: touchY, color: tc,        teamSide: "home" },
      ],
      arrows: [
        { id: "out", x1: centerCx, y1: 34, x2: centerCx - 4, y2: touchY, type: "run", color: "rgba(255,80,80,0.55)", curved: false },
        { id: "in",  x1: centerCx + 4, y1: touchY, x2: centerCx, y2: 34, type: "run", color: `${tc}70`,             curved: false },
      ],
      labels: [
        { id: "l1", x: centerCx, y: 62, text: `↑ ${inShort} ON · ↓ ${outShort} OFF`, size: "sm" as const, color: "rgba(255,255,255,0.35)" },
        { id: "l2", x: centerCx, y: 67, text: `${min}′ · SUBSTITUTION CONFIRMED`,      size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
    {
      id: 2, label: "NEW SHAPE",
      narration: p === "referee"
        ? `${inName} is now on the pitch. Both players confirmed, substitution board withdrawn. ${teamU} may use additional substitutions as the match progresses.`
        : p === "fan"
        ? `${inName} takes up their position. The substitution gives ${teamU} fresh energy and potentially a different tactical approach — watch to see how the team's shape adjusts around the new player.`
        : `${inShort} is on. This is the manager's statement. The shape has shifted. The game has changed — the question is whether anyone in the opposition has noticed yet.`,
      zones: [
        { id: "mid", x: 35, y: 0, w: 35, h: 68, color: tc, opacity: 0.1, label: "NEW SHAPE", labelX: 52.5, labelY: 7.5 },
      ],
      markers: [
        { id: "incoming", label: inShort, cx: centerCx, cy: 34, color: tc, teamSide: "home", highlight: true },
      ],
      arrows: [],
      labels: [
        { id: "lg", x: 52.5, y: 30, text: inShort,     size: "lg" as const, color: tc },
        { id: "l1", x: 52.5, y: 37, text: "INTRODUCED", size: "md" as const, color: `${tc}80` },
        { id: "l2", x: 52.5, y: 62, text: "FORMATION SHIFT", size: "sm" as const, color: "rgba(255,255,255,0.28)" },
        { id: "l3", x: 52.5, y: 67, text: `${teamU} · ${min}′`, size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
  ];
}

function buildFrames(ev: PitchEvent, meta: MatchMeta, p: Perspective): ReconFrame[] {
  switch (ev.eventType) {
    case "goal":         return buildGoalFrames(ev, meta, p);
    case "foul":         return buildFoulFrames(ev, meta, p);
    case "Yellow Card":  return buildCardFrames(ev, meta, p);
    case "substitution": return buildSubFrames(ev, meta, p);
    default:             return buildFoulFrames(ev, meta, p);
  }
}

// ─── Player Intelligence ───────────────────────────────────────────────────────
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

  const influence   = Math.min(94, Math.max(15, goals * 38 + keyInvolvements * 16 + (totalEvents >= 3 ? 18 : 8)));
  const discipline  = Math.min(88, Math.max(14, 76 - fouls * 13 - cards * 22));
  const involvement = Math.min(92, Math.max(16, 18 + totalEvents * 15 + keyInvolvements * 8));
  const pressure    = Math.min(90, Math.max(16, 18 + lateEvents * 20 + (cards > 0 ? 14 : 0) + goals * 12));
  const impact      = Math.min(95, Math.max(14, goals * 40 + keyInvolvements * 22 + (lateEvents > 0 ? 12 : 0)));

  const e = {
    influence: goals > 0
      ? `Scored ${goals} goal${goals > 1 ? "s" : ""}. Direct contribution to the scoreline.`
      : keyInvolvements > 0
      ? `Involved in ${keyInvolvements} key moment${keyInvolvements > 1 ? "s" : ""}. Significant indirect influence.`
      : totalEvents > 0 ? `${totalEvents} event${totalEvents > 1 ? "s" : ""} recorded. No direct goal involvement.`
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

// ─── Radar chart ───────────────────────────────────────────────────────────────
function RadarChart({ values, color }: { values: number[]; color: string }) {
  const cx = 56, cy = 56, maxR = 42;
  const labels = ["INF", "DIS", "INV", "PRS", "IMP"];
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / 5;
  const pt  = (v: number, i: number): [number, number] => {
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
      {labels.map((_, i) => { const [x2, y2] = pt(100, i); return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />; })}
      <path d={`M ${values.map((v, i) => pt(v, i).join(",")).join(" L ")} Z`} fill={`${color}30`} stroke={color} strokeWidth="1.4" />
      {values.map((v, i) => { const [x, y] = pt(v, i); return <circle key={i} cx={x} cy={y} r="2" fill={color} />; })}
      {labels.map((label, i) => {
        const [x, y] = pt(115, i);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.32)" fontSize="6.5" fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.04em">{label}</text>;
      })}
    </svg>
  );
}

// ─── Pitch markings ────────────────────────────────────────────────────────────
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
      {[{ x: 17.5, label: "DEF" }, { x: 52.5, label: "MID" }, { x: 87.5, label: "ATK" }].map(({ x, label }) => (
        <text key={label} x={x} y="3.5" textAnchor="middle" fill="rgba(255,255,255,0.055)" fontSize="3.8"
          fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.16em">{label}</text>
      ))}
      <rect x="0" y="0" width="105" height="68" {...LS} />
      <line x1="52.5" y1="0" x2="52.5" y2="68" {...LS} />
      <circle cx="52.5" cy="34" r="9.15" {...LS} />
      <circle cx="52.5" cy="34" r="0.4" fill="rgba(255,255,255,0.28)" />
      <rect x="0"    y="13.84" width="16.5" height="40.32" {...LS} />
      <rect x="0"    y="24.84" width="5.5"  height="18.32" {...LS} />
      <path d={`M 16.5 ${ARC_Y1} A 9.15 9.15 0 0 1 16.5 ${ARC_Y2}`} {...LS} />
      <circle cx="11" cy="34" r="0.38" fill="rgba(255,255,255,0.28)" />
      <rect x="-2.2" y="30.34" width="2.2" height="7.32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.32" />
      <rect x="88.5" y="13.84" width="16.5" height="40.32" {...LS} />
      <rect x="99.5" y="24.84" width="5.5"  height="18.32" {...LS} />
      <path d={`M 88.5 ${ARC_Y1} A 9.15 9.15 0 0 0 88.5 ${ARC_Y2}`} {...LS} />
      <circle cx="94" cy="34" r="0.38" fill="rgba(255,255,255,0.28)" />
      <rect x="105" y="30.34" width="2.2" height="7.32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.32" />
      <path d="M 1 0 A 1 1 0 0 0 0 1"    {...LS} />
      <path d="M 0 67 A 1 1 0 0 0 1 68"  {...LS} />
      <path d="M 104 0 A 1 1 0 0 1 105 1" {...LS} />
      <path d="M 105 67 A 1 1 0 0 1 104 68" {...LS} />
    </g>
  );
}

// ─── Frame scene ───────────────────────────────────────────────────────────────
// Zones and arrows use AnimatePresence (keyed by frameIdx) for per-frame transitions.
// Markers animate their cx/cy SVG attributes directly for smooth position movement.
const MOVE_T = { duration: 0.65, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };
const OPAC_T = { duration: 0.35 };

function FrameScene({
  frames, frameIdx,
}: {
  frames: ReconFrame[]; frameIdx: number;
}) {
  const frame = frames[frameIdx];

  // All unique markers across all frames for this event (for smooth position tracking)
  const allMarkers = useMemo(() => {
    const seen = new Set<string>();
    const all: MarkerDef[] = [];
    frames.forEach(f => f.markers.forEach(m => {
      if (!seen.has(m.id)) { seen.add(m.id); all.push({ ...m }); }
    }));
    return all;
  }, [frames]);

  // Current frame's marker positions
  const frameMarkerMap = useMemo(() => {
    const map = new Map<string, MarkerDef>();
    frame?.markers.forEach(m => map.set(m.id, m));
    return map;
  }, [frame]);

  if (!frame) {
    return (
      <g>
        <motion.circle cx="52.5" cy="34" r="4.5"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
          animate={{ r: [4.5, 9, 4.5], opacity: [0.25, 0, 0.25] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <text x="52.5" y="34" textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.1)" fontSize="2.8"
          fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.24em">
          SELECT AN EVENT
        </text>
      </g>
    );
  }

  const FS = { fontFamily: "'Barlow Condensed',sans-serif" };

  return (
    <g>
      {/* ZONES — fade in/out per frame */}
      <AnimatePresence mode="sync">
        {frame.zones.map(zone => (
          <motion.g key={`z-${frameIdx}-${zone.id}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}>
            <rect
              x={zone.x} y={zone.y} width={zone.w} height={zone.h}
              rx={zone.rx ?? 0}
              fill={zone.color}
              fillOpacity={zone.opacity}
              stroke={zone.dashed ? zone.color : "none"}
              strokeWidth={zone.dashed ? 0.5 : 0}
              strokeDasharray={zone.dashed ? "2 0.9" : undefined}
              strokeOpacity={0.55}
            />
            {zone.label && (
              <text
                x={zone.labelX ?? zone.x + zone.w / 2}
                y={zone.labelY ?? zone.y + 5}
                textAnchor="middle"
                fill={zone.color} fillOpacity={0.6}
                fontSize="2.7" fontWeight="800"
                {...FS} letterSpacing="0.18em">
                {zone.label}
              </text>
            )}
          </motion.g>
        ))}
      </AnimatePresence>

      {/* MARKERS — all rendered, animate cx/cy as SVG attributes for smooth movement */}
      {allMarkers.map(base => {
        const curr    = frameMarkerMap.get(base.id);
        const tCx     = curr?.cx ?? base.cx;
        const tCy     = curr?.cy ?? base.cy;
        const visible = !!curr;
        const hl      = curr?.highlight ?? false;
        const label   = curr?.label ?? base.label;
        const color   = curr?.color ?? base.color;
        const r       = hl ? 3.2 : 2.4;

        return (
          <g key={base.id}>
            {/* Highlight ring */}
            {hl && (
              <motion.circle
                animate={{ cx: tCx, cy: tCy, opacity: visible ? 1 : 0 }}
                initial={{ cx: base.cx, cy: base.cy, opacity: 0 }}
                transition={{ cx: MOVE_T, cy: MOVE_T, opacity: OPAC_T }}
                r="6.5"
                fill={`${color}18`}
                stroke={color}
                strokeWidth="0.45"
              />
            )}
            {/* Outer fill circle */}
            <motion.circle
              animate={{ cx: tCx, cy: tCy, opacity: visible ? 1 : 0 }}
              initial={{ cx: base.cx, cy: base.cy, opacity: 0 }}
              transition={{ cx: MOVE_T, cy: MOVE_T, opacity: OPAC_T }}
              r={r}
              fill={`${color}45`}
              stroke={color}
              strokeWidth="0.55"
            />
            {/* Inner dot */}
            <motion.circle
              animate={{ cx: tCx, cy: tCy, opacity: visible ? 1 : 0 }}
              initial={{ cx: base.cx, cy: base.cy, opacity: 0 }}
              transition={{ cx: MOVE_T, cy: MOVE_T, opacity: OPAC_T }}
              r={r * 0.4}
              fill={color}
            />
            {/* Label */}
            {label && (
              <motion.text
                animate={{ x: tCx, y: tCy - (hl ? 8 : 5.5), opacity: visible ? 0.9 : 0 }}
                initial={{ x: base.cx, y: base.cy - 5.5, opacity: 0 }}
                transition={{ x: MOVE_T, y: MOVE_T, opacity: OPAC_T }}
                textAnchor="middle"
                fill="rgba(255,255,255,0.9)"
                fontSize={hl ? "2.8" : "2.1"}
                fontWeight={hl ? "800" : "600"}
                {...FS}>
                {label}
              </motion.text>
            )}
          </g>
        );
      })}

      {/* ARROWS — animated pathLength per frame */}
      <AnimatePresence mode="sync">
        {frame.arrows.map(arrow => {
          const d = arrow.curved
            ? `M ${arrow.x1} ${arrow.y1} Q ${arrow.cpx ?? (arrow.x1 + arrow.x2) / 2} ${arrow.cpy ?? (arrow.y1 + arrow.y2) / 2} ${arrow.x2} ${arrow.y2}`
            : `M ${arrow.x1} ${arrow.y1} L ${arrow.x2} ${arrow.y2}`;
          const isShot  = arrow.type === "shot";
          const isRun   = arrow.type === "run";
          const isPress = arrow.type === "press";
          return (
            <motion.path
              key={`a-${frameIdx}-${arrow.id}`}
              d={d}
              fill="none"
              stroke={arrow.color}
              strokeWidth={isShot ? 0.8 : isRun ? 0.65 : 0.5}
              strokeDasharray={isPress ? "1.5 1" : isRun ? undefined : "2 1.2"}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0, pathLength: 0 }}
              transition={{
                pathLength: { duration: isShot ? 0.65 : 0.5, ease: "easeOut" },
                opacity:    { duration: 0.2 },
              }}
            />
          );
        })}
      </AnimatePresence>

      {/* LABELS — fade in/out per frame */}
      <AnimatePresence mode="sync">
        {frame.labels.map(lbl => {
          const fs  = lbl.size === "lg" ? 14 : lbl.size === "md" ? 5 : 2.5;
          const fw  = lbl.size === "lg" ? "900" : "700";
          const col = lbl.color ?? "rgba(255,255,255,0.6)";
          const ls  = lbl.size === "sm" ? "0.14em" : lbl.size === "lg" ? "0em" : "0.07em";
          return (
            <motion.text
              key={`l-${frameIdx}-${lbl.id}`}
              x={lbl.x} y={lbl.y}
              textAnchor="middle"
              fill={col}
              fontSize={fs}
              fontWeight={fw}
              {...FS}
              letterSpacing={ls}
              filter={lbl.size === "lg" ? "url(#glow)" : undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38 }}>
              {lbl.text}
            </motion.text>
          );
        })}
      </AnimatePresence>
    </g>
  );
}

// ─── Frame controls ────────────────────────────────────────────────────────────
function FrameControls({
  frames, frameIdx, isPlaying, activeIdx, totalEvents,
  onPrev, onNext, onPlayPause, onFrameClick,
  activeEvent,
}: {
  frames: ReconFrame[]; frameIdx: number; isPlaying: boolean;
  activeIdx: number; totalEvents: number;
  onPrev: () => void; onNext: () => void;
  onPlayPause: () => void;
  onFrameClick: (i: number) => void;
  activeEvent?: PitchEvent;
}) {
  const frame = frames[frameIdx];
  const tc    = activeEvent?.color ?? "#00b4ff";
  const canPrev = frameIdx > 0;
  const canNext = frameIdx < frames.length - 1;

  return (
    <div style={{
      height: 70, flexShrink: 0,
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "0 20px",
      background: "rgba(2,6,14,0.97)", backdropFilter: "blur(20px)",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      gap: 6,
    }}>
      {/* Frame label + event counter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <AnimatePresence mode="wait">
          <motion.div key={`fl-${frameIdx}`}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22 }}
            style={{ fontSize: "0.4rem", letterSpacing: "0.22em", fontWeight: 700, color: tc, fontFamily: "'Barlow Condensed',sans-serif" }}>
            {frame?.label ?? "—"}
          </motion.div>
        </AnimatePresence>
        <div style={{ fontSize: "0.36rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.18em", fontFamily: "'Barlow Condensed',sans-serif" }}>
          FRAME {frames.length > 0 ? frameIdx + 1 : 0} / {frames.length}
          {totalEvents > 0 && <span style={{ marginLeft: 10, color: "rgba(255,255,255,0.12)" }}>EVENT {activeIdx + 1}/{totalEvents}</span>}
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Prev frame */}
        <button onClick={onPrev} disabled={!canPrev} style={{
          background: "none", border: "none", cursor: canPrev ? "none" : "default",
          color: canPrev ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.14)",
          fontFamily: "inherit", fontSize: "0.72rem", padding: "2px 4px",
        }}>‹</button>

        {/* Play / Pause */}
        <button onClick={onPlayPause} style={{
          background: `${tc}18`, border: `1px solid ${tc}44`,
          borderRadius: 3, cursor: "none",
          color: tc, fontFamily: "inherit", fontSize: "0.55rem",
          padding: "3px 10px", letterSpacing: "0.14em",
        }}>
          {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
        </button>

        {/* Frame dots */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1 }}>
          {frames.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => onFrameClick(i)}
              animate={{ width: i === frameIdx ? 22 : 7 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: 7, borderRadius: 4, border: "none", cursor: "none",
                background: i === frameIdx ? tc : `${tc}30`,
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Next frame */}
        <button onClick={onNext} disabled={!canNext} style={{
          background: "none", border: "none", cursor: canNext ? "none" : "default",
          color: canNext ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.14)",
          fontFamily: "inherit", fontSize: "0.72rem", padding: "2px 4px",
        }}>›</button>
      </div>
    </div>
  );
}

// ─── Reconstruction board (center panel) ──────────────────────────────────────
function ReconBoard({
  frames, frameIdx, isPlaying, activeIdx, totalEvents,
  meta, activeEvent,
  onPrev, onNext, onPlayPause, onFrameClick,
}: {
  frames: ReconFrame[]; frameIdx: number; isPlaying: boolean;
  activeIdx: number; totalEvents: number;
  meta: MatchMeta; activeEvent?: PitchEvent;
  onPrev: () => void; onNext: () => void;
  onPlayPause: () => void;
  onFrameClick: (i: number) => void;
}) {
  const homeColor = meta.home.color ?? "#00b4ff";
  const awayColor = meta.away.color ?? "#ff4455";

  return (
    <>
      {/* Team direction bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 18px", flexShrink: 0,
        background: "rgba(2,8,16,0.6)", borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ fontSize: "0.46rem", fontWeight: 800, letterSpacing: "0.18em", color: homeColor, opacity: 0.75 }}>
          ◀ {meta.home.name.toUpperCase()}
        </div>
        <div style={{ fontSize: "0.34rem", letterSpacing: "0.28em", color: "rgba(255,255,255,0.16)" }}>
          EVENT RECONSTRUCTION · TACTICAL BOARD
        </div>
        <div style={{ fontSize: "0.46rem", fontWeight: 800, letterSpacing: "0.18em", color: awayColor, opacity: 0.75 }}>
          {meta.away.name.toUpperCase()} ▶
        </div>
      </div>

      {/* Pitch SVG */}
      <div style={{ flex: 1, padding: "10px 14px", overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="-5 -4 117 76" preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
            <PitchMarkings />
            {/* Wrap markers in AnimatePresence so changing events fades all markers out then in */}
            <AnimatePresence mode="wait">
              <motion.g key={activeEvent?.id ?? "empty"}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}>
                <FrameScene frames={frames} frameIdx={frameIdx} />
              </motion.g>
            </AnimatePresence>
          </svg>
        </div>
      </div>

      {/* Frame controls */}
      <FrameControls
        frames={frames} frameIdx={frameIdx} isPlaying={isPlaying}
        activeIdx={activeIdx} totalEvents={totalEvents}
        activeEvent={activeEvent}
        onPrev={onPrev} onNext={onNext}
        onPlayPause={onPlayPause} onFrameClick={onFrameClick}
      />
    </>
  );
}

// ─── Left panel ────────────────────────────────────────────────────────────────
const TYPE_ICON:  Record<string, string> = { goal: "⚽", "Yellow Card": "🟨", substitution: "🔄", foul: "·" };
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
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        <div style={{ fontSize: "0.4rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>
          MATCH EVENTS · {events.length}
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "rgba(255,255,255,0.18)", pointerEvents: "none" }}>⌕</span>
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

      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {filtered.map(ev => {
          const isActive = ev.id === activeId;
          const isGoal = ev.eventType === "goal";
          const isCard = ev.eventType === "Yellow Card";
          const isSub  = ev.eventType === "substitution";
          const isFoul = ev.eventType === "foul";
          const tc     = ev.color;
          const title  = ev.keyMoment?.title
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
              <div style={{ fontSize: isGoal ? "1.05rem" : isCard ? "0.9rem" : isSub ? "0.8rem" : "0.7rem", fontWeight: 900, lineHeight: 1, color: isActive ? tc : `${tc}88`, minWidth: 30, paddingTop: 1, transition: "color 0.15s" }}>
                {ev.minute}&prime;
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: isGoal ? "0.85rem" : "0.7rem" }}>{TYPE_ICON[ev.eventType] ?? "·"}</span>
                  <span style={{ fontSize: "0.38rem", letterSpacing: "0.22em", fontWeight: 700, color: isCard ? "#FFD700" : isGoal ? tc : "rgba(255,255,255,0.28)" }}>
                    {TYPE_LABEL[ev.eventType] ?? ev.eventType.toUpperCase()}
                    {ev.isKey && " ★"}
                  </span>
                </div>
                <div style={{ fontSize: isGoal ? "0.82rem" : isFoul ? "0.6rem" : "0.7rem", fontWeight: isGoal ? 700 : 500, lineHeight: 1.25, color: isActive ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.48)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.15s" }}>
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

// ─── Right panel ───────────────────────────────────────────────────────────────
function ExplanationPanel({
  event, frame, frameIdx, totalFrames, allEvents, narrative, meta, perspective, homeColor,
}: {
  event?: PitchEvent;
  frame?: ReconFrame | null;
  frameIdx: number;
  totalFrames: number;
  allEvents: PitchEvent[];
  narrative: string;
  meta: MatchMeta;
  perspective: Perspective;
  homeColor: string;
}) {
  const [playerOpen, setPlayerOpen] = useState(false);
  useEffect(() => { setPlayerOpen(false); }, [event?.id]);

  const tc = event?.color ?? homeColor;
  const perspLabels: Record<Perspective, string> = {
    referee: "REFEREE VIEW", fan: "FAN GUIDE", supporter: "SUPPORTER VIEW",
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

            <div style={{ height: 2, background: `linear-gradient(90deg, ${tc}, transparent)`, marginBottom: 14 }} />

            {/* INVESTIGATION header */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: "0.37rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.22)", marginBottom: 4 }}>
                EVENT RECONSTRUCTION
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={`fl-right-${frameIdx}`}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 900, color: tc, lineHeight: 1 }}>
                      {frame?.label ?? "—"}
                    </span>
                    <span style={{ fontSize: "0.38rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.16em" }}>
                      {totalFrames > 0 ? `${frameIdx + 1} / ${totalFrames}` : ""}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Perspective label */}
            <div style={{ fontSize: "0.36rem", letterSpacing: "0.24em", color: `${tc}70`, marginBottom: 10 }}>
              {perspLabels[perspective]}
            </div>

            {/* Frame narration — primary content */}
            <AnimatePresence mode="wait">
              <motion.p key={`narr-${event.id}-${frameIdx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
                style={{
                  fontSize: "0.74rem", color: "rgba(255,255,255,0.62)",
                  lineHeight: 1.74, margin: "0 0 14px 0",
                }}>
                {frame?.narration ?? "Select a frame to begin reconstruction."}
              </motion.p>
            </AnimatePresence>

            <HR />

            {/* Event context (secondary) */}
            <Sect label="EVENT CONTEXT">
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: "1.8rem", fontWeight: 900, color: tc, lineHeight: 1 }}>
                  {event.minute}&prime;
                </span>
                <div>
                  <div style={{ fontSize: "0.42rem", letterSpacing: "0.22em", fontWeight: 700, color: event.eventType === "Yellow Card" ? "#FFD700" : tc }}>
                    {TYPE_LABEL[event.eventType] ?? event.eventType.toUpperCase()}{event.isKey ? " ★" : ""}
                  </div>
                  <div style={{ fontSize: "0.4rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>
                    {event.team.toUpperCase()}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", lineHeight: 1.2 }}>
                {event.keyMoment?.title
                  ?? (event.eventType === "substitution"
                    ? `${event.playerIn} for ${event.playerOut}`
                    : event.player)}
              </div>
              {event.keyMoment?.context && (
                <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.38)", lineHeight: 1.6, margin: "8px 0 0" }}>
                  {event.keyMoment.context}
                </p>
              )}
            </Sect>

            {/* Player Intelligence — collapsible */}
            {profile && (
              <>
                <HR />
                <button onClick={() => setPlayerOpen(o => !o)} style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${playerOpen ? tc : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 4, padding: "8px 12px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  cursor: "none", fontFamily: "inherit", color: "rgba(255,255,255,0.4)", marginBottom: 10,
                }}>
                  <span style={{ fontSize: "0.52rem", letterSpacing: "0.18em" }}>PLAYER INTELLIGENCE</span>
                  <span style={{ fontSize: "0.6rem" }}>{playerOpen ? "▲" : "▼"}</span>
                </button>

                <AnimatePresence>
                  {playerOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28 }}
                      style={{ overflow: "hidden" }}>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, padding: "14px 12px", marginBottom: 12 }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#fff", marginBottom: 2 }}>{playerName}</div>
                        <div style={{ fontSize: "0.4rem", letterSpacing: "0.18em", color: `${tc}88`, marginBottom: 12 }}>{event.team.toUpperCase()}</div>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                          <RadarChart values={[profile.stats.influence, profile.stats.discipline, profile.stats.involvement, profile.stats.pressure, profile.stats.impact]} color={tc} />
                        </div>
                        {([
                          { key: "influence",   label: "INFLUENCE",   val: profile.stats.influence,   note: profile.explanations.influence   },
                          { key: "discipline",  label: "DISCIPLINE",  val: profile.stats.discipline,  note: profile.explanations.discipline  },
                          { key: "involvement", label: "INVOLVEMENT", val: profile.stats.involvement, note: profile.explanations.involvement },
                          { key: "pressure",    label: "PRESSURE",    val: profile.stats.pressure,    note: profile.explanations.pressure    },
                          { key: "impact",      label: "IMPACT",      val: profile.stats.impact,      note: profile.explanations.impact      },
                        ] as const).map(({ key, label, val, note }) => (
                          <div key={key} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                              <span style={{ fontSize: "0.42rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)", minWidth: 70 }}>{label}</span>
                              <span style={{ fontSize: "0.88rem", fontWeight: 800, color: tc }}>{val}</span>
                            </div>
                            <div style={{ fontSize: "0.54rem", color: "rgba(255,255,255,0.32)", lineHeight: 1.5, marginTop: 1 }}>{note}</div>
                          </div>
                        ))}
                        <div style={{ marginTop: 10, padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, fontSize: "0.42rem", color: "rgba(255,255,255,0.22)", lineHeight: 1.55, letterSpacing: "0.04em" }}>
                          Values derived from match event counts in the match JSON. Not fetched from an external player database.
                        </div>
                        <HR />
                        <div style={{ fontSize: "0.4rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.24)", marginBottom: 8 }}>MATCH DOSSIER</div>
                        {profile.events.length === 0 ? (
                          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.22)" }}>No events recorded.</div>
                        ) : profile.events.map((e, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", borderBottom: i < profile.events.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                            <span style={{ fontSize: "0.72rem", fontWeight: 800, color: e.color, minWidth: 26 }}>{e.minute}&prime;</span>
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
                        ))}
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
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", marginBottom: 14, opacity: 0.3 }}>⚽</div>
            <div style={{ fontSize: "0.44rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              SELECT AN EVENT<br />TO BEGIN RECONSTRUCTION
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {narrative && (
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div style={{ fontSize: "0.37rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.18)", marginBottom: 6 }}>MATCH CONTEXT</div>
          <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", lineHeight: 1.68, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" } as React.CSSProperties}>
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
      <div style={{ fontSize: "0.37rem", letterSpacing: "0.26em", color: "rgba(255,255,255,0.2)", marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function MatchStoryScreen({
  meta, moments, rawEvents, narrative,
  perspective = "referee",
  onBack,
}: Props) {
  const pitchEvents = useMemo(
    () => buildEvents(rawEvents, moments, meta), [rawEvents, moments, meta],
  );

  const [activeId,  setActiveId]  = useState<string | null>(pitchEvents[0]?.id ?? null);
  const [searchQ,   setSearchQ]   = useState("");
  const [frameIdx,  setFrameIdx]  = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeEvent = pitchEvents.find(e => e.id === activeId);
  const activeIdx   = pitchEvents.findIndex(e => e.id === activeId);

  const frames = useMemo(
    () => activeEvent ? buildFrames(activeEvent, meta, perspective) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEvent?.id, meta, perspective],
  );

  const listRef   = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Reset frame + auto-play when event changes
  useEffect(() => {
    setFrameIdx(0);
    setIsPlaying(false);
    const t = setTimeout(() => setIsPlaying(true), 600);
    return () => clearTimeout(t);
  }, [activeId]);

  // Auto-advance frames
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    if (frameIdx >= frames.length - 1) { setIsPlaying(false); return; }
    const t = setTimeout(() => setFrameIdx(i => i + 1), 2600);
    return () => clearTimeout(t);
  }, [isPlaying, frameIdx, frames.length]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeId]);

  const goNextEvent = useCallback(() => {
    if (activeIdx < pitchEvents.length - 1) setActiveId(pitchEvents[activeIdx + 1].id);
  }, [activeIdx, pitchEvents]);
  const goPrevEvent = useCallback(() => {
    if (activeIdx > 0) setActiveId(pitchEvents[activeIdx - 1].id);
  }, [activeIdx, pitchEvents]);

  const goNextFrame = useCallback(() => {
    if (frameIdx < frames.length - 1) { setFrameIdx(i => i + 1); setIsPlaying(false); }
  }, [frameIdx, frames.length]);
  const goPrevFrame = useCallback(() => {
    if (frameIdx > 0) { setFrameIdx(i => i - 1); setIsPlaying(false); }
  }, [frameIdx]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight")  { e.preventDefault(); goNextEvent(); }
      if (e.key === "ArrowLeft")   { e.preventDefault(); goPrevEvent(); }
      if (e.key === "ArrowDown")   { e.preventDefault(); goNextFrame(); }
      if (e.key === "ArrowUp")     { e.preventDefault(); goPrevFrame(); }
      if (e.key === " ")           { e.preventDefault(); setIsPlaying(p => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [goNextEvent, goPrevEvent, goNextFrame, goPrevFrame]);

  const homeColor = meta.home.color ?? "#00b4ff";
  const awayColor = meta.away.color ?? "#ff4455";
  const currentFrame = frames[frameIdx] ?? null;

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
          <ReconBoard
            frames={frames} frameIdx={frameIdx} isPlaying={isPlaying}
            activeIdx={activeIdx} totalEvents={pitchEvents.length}
            meta={meta} activeEvent={activeEvent}
            onPrev={goPrevFrame} onNext={goNextFrame}
            onPlayPause={() => setIsPlaying(p => !p)}
            onFrameClick={i => { setFrameIdx(i); setIsPlaying(false); }}
          />
        </div>

        {/* RIGHT */}
        <ExplanationPanel
          event={activeEvent}
          frame={currentFrame}
          frameIdx={frameIdx}
          totalFrames={frames.length}
          allEvents={pitchEvents}
          narrative={narrative}
          meta={meta}
          perspective={perspective}
          homeColor={homeColor}
        />
      </div>
    </div>
  );
}
