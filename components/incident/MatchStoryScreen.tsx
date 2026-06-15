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
  const cx = 52, cy = 52, maxR = 38;
  const labels = ["INF", "DIS", "INV", "PRS", "IMP"];
  const ang = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / 5;
  const pt  = (v: number, i: number): [number, number] => {
    const a = ang(i), r = (v / 100) * maxR;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ringPath = (f: number) => {
    const pts = labels.map((_, i) => { const a = ang(i), r = maxR * f; return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`; });
    return `M ${pts.join(" L ")} Z`;
  };
  const dataPath = `M ${values.map((v, i) => pt(v, i).join(" ")).join(" L ")} Z`;
  const animKey = values.join(",");
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <path key={f} d={ringPath(f)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.7" />
      ))}
      {labels.map((_, i) => { const [x2, y2] = pt(100, i); return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />; })}
      <motion.path key={animKey}
        d={dataPath} fill={`${color}28`} stroke={color} strokeWidth="1.5"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 0.55, ease: "easeOut" }, opacity: { duration: 0.2 } }}
      />
      {values.map((v, i) => {
        const [x, y] = pt(v, i);
        return (
          <motion.circle key={`${animKey}-${i}`} cx={x} cy={y} r="2.2" fill={color}
            initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.04, duration: 0.15 }}
          />
        );
      })}
      {labels.map((label, i) => {
        const [x, y] = pt(118, i);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.3)" fontSize="6" fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.04em">{label}</text>;
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
const MOVE_T = { duration: 0.42, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };
const OPAC_T = { duration: 0.20 };

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
            transition={{ duration: 0.22 }}>
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
                pathLength: { duration: isShot ? 0.38 : 0.28, ease: "easeOut" },
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
              transition={{ duration: 0.22 }}>
              {lbl.text}
            </motion.text>
          );
        })}
      </AnimatePresence>
    </g>
  );
}

// ─── Frame controls — minimal analyst style ────────────────────────────────────
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
  const frame  = frames[frameIdx];
  const tc     = activeEvent?.color ?? "#4da6ff";
  const canP   = frameIdx > 0;
  const canN   = frameIdx < frames.length - 1;

  return (
    <div style={{
      height: 56, flexShrink: 0,
      display: "flex", alignItems: "center",
      padding: "0 18px", gap: 14,
      borderTop: "1px solid rgba(255,255,255,0.052)",
      background: "rgba(5,8,16,1)",
    }}>
      {/* Phase label — animated */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div key={`fl-${frameIdx}`}
            initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            <div style={{ fontSize: "0.3rem", letterSpacing: "0.32em", color: "rgba(255,255,255,0.18)", marginBottom: 2 }}>
              PHASE {frames.length > 0 ? frameIdx + 1 : "—"} / {frames.length}
            </div>
            <div style={{
              fontSize: "0.62rem", fontWeight: 700, color: tc,
              letterSpacing: "0.06em", whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {frame?.label ?? "—"}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot scrubber */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {frames.map((_, i) => (
          <motion.button key={i} onClick={() => onFrameClick(i)}
            animate={{ width: i === frameIdx ? 18 : 5, background: i === frameIdx ? tc : "rgba(255,255,255,0.15)" }}
            transition={{ duration: 0.2 }}
            style={{ height: 4, borderRadius: 2, border: "none", cursor: "none", padding: 0 }}
          />
        ))}
      </div>

      {/* Playback trio */}
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <button onClick={onPrev} disabled={!canP} style={{
          background: "none", border: "none", padding: "0 8px",
          cursor: canP ? "none" : "default",
          color: canP ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)",
          fontSize: "1rem", lineHeight: 1,
        }}>‹</button>
        <button onClick={onPlayPause} style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 2, cursor: "none",
          color: "rgba(255,255,255,0.55)",
          fontFamily: "inherit", fontSize: "0.58rem",
          padding: "4px 12px", letterSpacing: "0.1em",
          minWidth: 56,
        }}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={onNext} disabled={!canN} style={{
          background: "none", border: "none", padding: "0 8px",
          cursor: canN ? "none" : "default",
          color: canN ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)",
          fontSize: "1rem", lineHeight: 1,
        }}>›</button>
      </div>

      {/* Event index */}
      {totalEvents > 0 && (
        <div style={{ fontSize: "0.3rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.14)", textAlign: "right", flexShrink: 0 }}>
          {activeIdx + 1}<span style={{ opacity: 0.45 }}>/{totalEvents}</span>
        </div>
      )}
    </div>
  );
}

// ─── Investigation board — pitch is the product ────────────────────────────────
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
  const hc = meta.home.color ?? "#4da6ff";
  const ac = meta.away.color ?? "#ff4455";

  return (
    <>
      {/* Hairline team bar — 26px, purely directional */}
      <div style={{
        height: 26, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 18px", flexShrink: 0,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <span style={{ fontSize: "0.34rem", fontWeight: 800, letterSpacing: "0.22em", color: hc, opacity: 0.55 }}>
          ◀ {meta.home.code}
        </span>
        <span style={{ fontSize: "0.28rem", letterSpacing: "0.4em", color: "rgba(255,255,255,0.1)" }}>
          INVESTIGATION BOARD
        </span>
        <span style={{ fontSize: "0.34rem", fontWeight: 800, letterSpacing: "0.22em", color: ac, opacity: 0.55 }}>
          {meta.away.code} ▶
        </span>
      </div>

      {/* Event context header — title + brief type label */}
      <AnimatePresence mode="wait">
        {activeEvent && (
          <motion.div key={activeEvent.id}
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            style={{
              height: 58, flexShrink: 0, display: "flex", flexDirection: "column",
              justifyContent: "center", padding: "0 18px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: `linear-gradient(180deg, ${activeEvent.color}08 0%, transparent 100%)`,
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: "1.6rem", fontWeight: 900, color: activeEvent.color,
                lineHeight: 1, letterSpacing: "-0.02em", flexShrink: 0,
              }}>
                {activeEvent.minute}′
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: "0.28rem", letterSpacing: "0.3em", fontWeight: 700,
                  color: activeEvent.color, opacity: 0.7, marginBottom: 3,
                }}>
                  {activeEvent.eventType === "Yellow Card" ? "CARD"
                    : activeEvent.eventType === "substitution" ? "SUB"
                    : activeEvent.eventType.toUpperCase()}
                  {activeEvent.isKey ? " ★" : ""}
                </div>
                <div style={{
                  fontSize: "0.78rem", fontWeight: 800,
                  color: "rgba(255,255,255,0.82)", lineHeight: 1.15,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {activeEvent.keyMoment?.title
                    ?? (activeEvent.eventType === "substitution"
                      ? `${activeEvent.playerIn} ↑  ${activeEvent.playerOut} ↓`
                      : activeEvent.player)}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{
                fontSize: "0.3rem", letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.2)", flexShrink: 0,
              }}>
                {activeEvent.team.toUpperCase()}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pitch — absolute fill, zero padding */}
      <div style={{ flex: 1, padding: "6px 8px", overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="-5 -4 117 76" preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
            <PitchMarkings />
            <AnimatePresence mode="wait">
              <motion.g key={activeEvent?.id ?? "empty"}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}>
                <FrameScene frames={frames} frameIdx={frameIdx} />
              </motion.g>
            </AnimatePresence>
          </svg>
        </div>
      </div>

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

// ─── Left panel — Events Library ──────────────────────────────────────────────
const TYPE_ICON:  Record<string, string> = { goal: "⚽", "Yellow Card": "🟨", substitution: "⇄", foul: "·" };
const TYPE_COLOR: Record<string, string> = { goal: "inherit", "Yellow Card": "#FFD700", substitution: "rgba(255,255,255,0.55)", foul: "rgba(255,255,255,0.35)" };

type FilterType = "all" | "goal" | "foul" | "Yellow Card" | "substitution";
const FILTER_OPTS: { id: FilterType; label: string }[] = [
  { id: "all",          label: "ALL"  },
  { id: "goal",         label: "GOAL" },
  { id: "Yellow Card",  label: "CARD" },
  { id: "substitution", label: "SUB"  },
  { id: "foul",         label: "FOUL" },
];

function EventsPanel({
  events, activeId, onSelect, query, onQuery, listRef, activeRef,
}: {
  events: PitchEvent[]; activeId: string | null;
  onSelect: (id: string) => void;
  query: string; onQuery: (q: string) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  activeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = useMemo(() => {
    const base = filter === "all" ? events : events.filter(e => e.eventType === filter);
    if (!query) return base;
    const q = query.toLowerCase();
    return base.filter(e =>
      [e.player, e.playerIn, e.playerOut, String(e.minute), e.eventType, e.team]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [events, query, filter]);

  return (
    <div style={{
      width: 220, flexShrink: 0, display: "flex", flexDirection: "column",
      borderRight: "1px solid rgba(255,255,255,0.052)",
    }}>
      {/* Library header */}
      <div style={{ padding: "18px 14px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontSize: "0.38rem", letterSpacing: "0.36em", color: "rgba(255,255,255,0.18)" }}>EVENTS</span>
          <span style={{ fontSize: "0.88rem", fontWeight: 900, color: "rgba(255,255,255,0.22)", lineHeight: 1 }}>{events.length}</span>
        </div>

        {/* Search — minimal underline style */}
        <input value={query} onChange={e => onQuery(e.target.value)}
          placeholder="Search players, minutes…"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "transparent", border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "5px 0 6px",
            color: "rgba(255,255,255,0.6)",
            fontFamily: "'Barlow Condensed',sans-serif",
            fontSize: "0.72rem", letterSpacing: "0.03em",
            outline: "none", cursor: "none",
            marginBottom: 14,
          }}
        />

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {FILTER_OPTS.map(f => {
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{
                  background: active ? "rgba(255,255,255,0.07)" : "transparent",
                  border: active ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 2, padding: "3px 8px",
                  cursor: "none", fontFamily: "inherit",
                  fontSize: "0.35rem", letterSpacing: "0.2em",
                  color: active ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.26)",
                  transition: "all 0.12s",
                }}>
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thin separator */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.052)", flexShrink: 0 }} />

      {/* Scrollable event list */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {filtered.map(ev => {
          const isActive = ev.id === activeId;
          const isGoal   = ev.eventType === "goal";
          const isCard   = ev.eventType === "Yellow Card";
          const isSub    = ev.eventType === "substitution";
          const isFoul   = ev.eventType === "foul";
          const tc       = ev.color;
          const title    = ev.keyMoment?.title
            ?? (isSub  ? `${ev.playerIn} ↑  ${ev.playerOut} ↓`
             : isFoul  ? ev.player
             : ev.player);

          return (
            <motion.button key={ev.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(ev.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 0,
                padding: isGoal ? "11px 14px" : "7px 14px",
                background: isActive ? `${tc}0d` : "transparent",
                border: "none",
                borderLeft: `2px solid ${isActive ? tc : "transparent"}`,
                cursor: "none", textAlign: "left",
              }}
              whileHover={{ background: isActive ? `${tc}0d` : "rgba(255,255,255,0.018)" }}>

              {/* Minute column */}
              <div style={{
                width: 30, fontWeight: 900, lineHeight: 1, flexShrink: 0,
                fontSize: isGoal ? "0.96rem" : "0.7rem",
                color: isActive ? tc : `${tc}72`,
                transition: "color 0.12s",
              }}>
                {ev.minute}′
              </div>

              {/* Icon — only for goals and cards */}
              <div style={{ width: 18, fontSize: "0.65rem", flexShrink: 0, opacity: 0.85 }}>
                {(isGoal || isCard) ? TYPE_ICON[ev.eventType] : ""}
                {isSub ? <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)" }}>⇄</span> : null}
              </div>

              {/* Title */}
              <div style={{
                flex: 1, minWidth: 0,
                fontSize: isGoal ? "0.78rem" : "0.66rem",
                fontWeight: isGoal ? 700 : 400,
                color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.38)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                lineHeight: 1.3, transition: "color 0.12s",
              }}>
                {title}
                {ev.isKey && isGoal && (
                  <span style={{ marginLeft: 4, fontSize: "0.5rem", color: tc, opacity: 0.7 }}>★</span>
                )}
              </div>
            </motion.button>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: "32px 14px", textAlign: "center" }}>
            <div style={{ fontSize: "0.32rem", letterSpacing: "0.26em", color: "rgba(255,255,255,0.14)" }}>
              NO EVENTS
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat bar row ──────────────────────────────────────────────────────────────
function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
      <span style={{ fontSize: "0.3rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", width: 64, flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 1 }}>
        <motion.div
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: "100%", background: color, borderRadius: 1 }}
        />
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 800, color, width: 22, textAlign: "right", flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

// ─── Dossier divider ───────────────────────────────────────────────────────────
function DR() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.052)", margin: "18px 0" }} />;
}

// ─── Right panel — Event Dossier ──────────────────────────────────────────────
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
  const [dossierOpen, setDossierOpen] = useState(false);
  useEffect(() => { setDossierOpen(false); }, [event?.id]);

  const tc          = event?.color ?? homeColor;
  const playerName  = event?.player ?? (event?.eventType === "substitution" ? event.playerIn : undefined);
  const profile     = playerName ? computePlayer(playerName, allEvents) : null;
  const perspLabel  = { referee: "REFEREE", fan: "FAN", supporter: "SUPPORTER" }[perspective];

  const eventTitle = event?.keyMoment?.title
    ?? (event?.eventType === "substitution"
      ? `${event.playerIn} for ${event.playerOut}`
      : event?.player);

  const eventType = event?.eventType === "Yellow Card" ? "CARD"
    : event?.eventType === "substitution" ? "SUB"
    : event?.eventType === "goal" ? "GOAL"
    : event?.eventType === "foul" ? "FOUL"
    : event?.eventType?.toUpperCase() ?? "";

  return (
    <div style={{
      width: 264, flexShrink: 0, display: "flex", flexDirection: "column",
      borderLeft: "1px solid rgba(255,255,255,0.052)",
      overflow: "hidden",
    }}>
      <AnimatePresence mode="wait">
        {event ? (
          <motion.div key={event.id}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

            {/* ── SECTION 1: Event Identity ── */}
            <div style={{ padding: "20px 18px 0" }}>
              {/* Accent strip */}
              <div style={{ height: 1, background: `linear-gradient(90deg, ${tc}, transparent)`, marginBottom: 16 }} />

              {/* Minute + type */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{
                  fontSize: "2.6rem", fontWeight: 900, lineHeight: 1,
                  color: tc, letterSpacing: "-0.02em",
                }}>
                  {event.minute}′
                </span>
                <div style={{ textAlign: "right", paddingTop: 4 }}>
                  <div style={{
                    fontSize: "0.32rem", letterSpacing: "0.28em", fontWeight: 700,
                    color: event.eventType === "Yellow Card" ? "#FFD700" : tc,
                    marginBottom: 2,
                  }}>
                    {eventType}{event.isKey ? " ★" : ""}
                  </div>
                  <div style={{ fontSize: "0.3rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)" }}>
                    {event.team.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Event title */}
              <div style={{
                fontSize: "0.92rem", fontWeight: 800,
                color: "rgba(255,255,255,0.88)", lineHeight: 1.2, marginBottom: 18,
              }}>
                {eventTitle}
              </div>
            </div>

            <DR />

            {/* ── SECTION 2: Frame narration (compact) ── */}
            <div style={{ padding: "0 18px" }}>
              <AnimatePresence mode="wait">
                <motion.div key={`fn-${frameIdx}`}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                  <div style={{
                    fontSize: "0.52rem", fontWeight: 700,
                    color: tc, letterSpacing: "0.05em", marginBottom: 6,
                  }}>
                    {frame?.label ?? "—"}
                    <span style={{ marginLeft: 8, fontSize: "0.28rem", fontWeight: 400, color: "rgba(255,255,255,0.22)", letterSpacing: "0.16em" }}>
                      {totalFrames > 0 ? `${frameIdx + 1}/${totalFrames}` : ""}
                    </span>
                  </div>
                  <p style={{
                    fontSize: "0.6rem", color: "rgba(255,255,255,0.42)",
                    lineHeight: 1.65, margin: 0,
                    display: "-webkit-box", WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 4, overflow: "hidden",
                  } as React.CSSProperties}>
                    {frame?.narration ?? "Select a frame to read the analysis."}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <DR />

            {/* ── SECTION 3: IBM Granite Referee Assistant ── */}
            <div style={{ padding: "0 18px" }}>
              <GraniteAssistant event={event} />
            </div>

            {/* ── SECTION 4: Player Card ── */}
            {profile && playerName && (
              <>
                <DR />
                <div style={{ padding: "0 18px" }}>
                  <div style={{ fontSize: "0.3rem", letterSpacing: "0.32em", color: "rgba(255,255,255,0.18)", marginBottom: 10 }}>
                    PLAYER
                  </div>

                  {/* Name + team */}
                  <div style={{ fontSize: "0.9rem", fontWeight: 800, color: "rgba(255,255,255,0.88)", lineHeight: 1.15, marginBottom: 2 }}>
                    {playerName}
                  </div>
                  <div style={{ fontSize: "0.3rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.28)", marginBottom: 12 }}>
                    {event.team.toUpperCase()}
                  </div>

                  {/* Radar chart — always visible */}
                  <div style={{ display: "flex", justifyContent: "center", margin: "0 0 14px" }}>
                    <RadarChart
                      values={[profile.stats.influence, profile.stats.discipline, profile.stats.involvement, profile.stats.pressure, profile.stats.impact]}
                      color={tc}
                    />
                  </div>

                  {/* Stat bars — three primary */}
                  <StatRow label="INFLUENCE"  value={profile.stats.influence}  color={tc} />
                  <StatRow label="DISCIPLINE" value={profile.stats.discipline} color={tc} />
                  <StatRow label="IMPACT"     value={profile.stats.impact}     color={tc} />

                  {/* Full dossier toggle */}
                  <button onClick={() => setDossierOpen(o => !o)} style={{
                    background: "none", border: "none", cursor: "none",
                    color: "rgba(255,255,255,0.22)", fontFamily: "inherit",
                    fontSize: "0.3rem", letterSpacing: "0.24em",
                    padding: "8px 0 0", display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <span style={{
                      display: "inline-block", width: 10, height: 1,
                      background: "rgba(255,255,255,0.15)",
                    }} />
                    {dossierOpen ? "COLLAPSE" : "FULL DOSSIER"}
                  </button>

                  <AnimatePresence>
                    {dossierOpen && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.24 }}
                        style={{ overflow: "hidden" }}>
                        <div style={{ paddingTop: 12 }}>
                          {/* All 5 stats */}
                          <StatRow label="INVOLVEMENT" value={profile.stats.involvement} color={tc} />
                          <StatRow label="PRESSURE"    value={profile.stats.pressure}    color={tc} />

                          {/* Dossier list */}
                          <div style={{ fontSize: "0.3rem", letterSpacing: "0.24em", color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>
                            MATCH EVENTS
                          </div>
                          {profile.events.length === 0 ? (
                            <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.2)" }}>No events.</div>
                          ) : profile.events.map((e, i) => (
                            <div key={i} style={{
                              display: "flex", gap: 8, alignItems: "center",
                              padding: "5px 0",
                              borderBottom: i < profile.events.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            }}>
                              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: e.color, minWidth: 26 }}>
                                {e.minute}′
                              </span>
                              <span style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.48)" }}>
                                {TYPE_ICON[e.eventType]} {e.eventType === "substitution"
                                  ? (e.player === playerName ? `Off — ${e.playerIn} on` : `On for ${e.playerOut}`)
                                  : e.eventType}
                              </span>
                              {e.isKey && <span style={{ fontSize: "0.45rem", color: "#FFD700" }}>★</span>}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

            {/* ── SECTION 5: Match Metadata ── */}
            <DR />
            <div style={{ padding: "0 18px 20px" }}>
              <div style={{ fontSize: "0.3rem", letterSpacing: "0.32em", color: "rgba(255,255,255,0.18)", marginBottom: 8 }}>
                MATCH
              </div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 3 }}>
                {meta.stage}
              </div>
              <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.28)" }}>
                {meta.venue ?? `${meta.home.name} vs ${meta.away.name}`}
              </div>
              <div style={{ fontSize: "0.32rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.18)", marginTop: 3 }}>
                {meta.date}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.1rem", opacity: 0.25,
            }}>⚽</div>
            <div style={{ fontSize: "0.3rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.16)", textAlign: "center", lineHeight: 2 }}>
              SELECT AN EVENT<br />TO OPEN DOSSIER
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// kept for legacy compat — no longer rendered but type-safe to reference
function HR() { return <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "13px 0" }} />; }
function Sect({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: "0.37rem", letterSpacing: "0.26em", color: "rgba(255,255,255,0.2)", marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Fullscreen hook ───────────────────────────────────────────────────────────
function useFullscreen() {
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  const toggle = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);
  return { isFs, toggle };
}

// ─── IBM Granite Referee Assistant ────────────────────────────────────────────
type GMsg = { id: string; role: "user" | "assistant"; text: string };

function getGraniteContext(ev: PitchEvent): string {
  const t = ev.eventType;
  const min = ev.minute;
  const player = ev.player ?? ev.playerIn ?? "player";
  if (t === "goal") return `${player} scored in minute ${min}. Validate build-up for offside, encroachment, and any handling.`;
  if (t === "foul") return `${player} committed a foul in minute ${min}. Assess severity under Law 12.`;
  if (t === "Yellow Card") return `Yellow card issued to ${player} at ${min}′. Log caution, check double-jeopardy, advise fourth official.`;
  if (t === "substitution") return `Substitution at ${min}′: ${ev.playerIn} replaces ${ev.playerOut}. Confirm eligibility and signal play resumption.`;
  return `Incident at ${min}′ involving ${player}. Standing by for analysis.`;
}

const QUICK_RESPONSES: Record<string, (ev: PitchEvent) => string> = {
  why: ev => {
    const t = ev.eventType;
    if (t === "goal") return `Goal confirmed. Offside check at moment of pass: attacking player level or behind the second-last defender. No encroachment detected on goal-line. Decision: goal stands under Law 10.`;
    if (t === "foul") return `The challenge is classified as careless contact under Law 12 — the player made no attempt to play the ball. Free kick awarded. No caution warranted at this severity level.`;
    if (t === "Yellow Card") return `Caution issued for persistent infringement under Law 12.3. This follows a pattern of minor fouls. The accumulation threshold was met at this minute.`;
    if (t === "substitution") return `Tactical substitution — coaching staff decision, not referee-initiated. Referee responsibility: confirm the substituted player has left the field before the replacement enters.`;
    return `Decision made at ${ev.minute}′ based on real-time positioning and Law of the Game assessment. Granite flagged this as consistent with precedent.`;
  },
  law: ev => {
    const t = ev.eventType;
    if (t === "goal") return `Law 10 — Determining the Outcome of a Match. Law 11 — Offside: applies if attacker in offside position at moment of pass. Law 12 — handling check. VAR protocol: DOGSO, offside, and encroachment.`;
    if (t === "foul") return `Law 12 — Fouls and Misconduct. Careless: free kick only. Reckless: caution (yellow). Excessive force or brutality: send-off (red). This incident: careless — free kick awarded, no card.`;
    if (t === "Yellow Card") return `Law 12.3 — Cautionable offences include: unsporting behaviour, dissent, persistent infringement, delaying restart, not respecting required distance, and entering/re-entering without permission.`;
    if (t === "substitution") return `Law 3 — The Players. Substitution: up to 5 changes per team in competitive matches. Player must exit at nearest touchline or goal line. Substituted player may not return. All changes must be reported to fourth official.`;
    return `Law 5 — The Referee. The referee's decision on facts connected with play are final. Law 12 governs misconduct classification.`;
  },
  incidents: ev => {
    const t = ev.eventType;
    if (t === "goal") return `Similar: Torres vs. Paraguay (2010 WC), Benzema vs. Germany (EURO 2021) — all ruled valid after offside check. Precedent supports goal standing when attacker is level at moment of release.`;
    if (t === "foul") return `Comparable fouls at this severity in knockout fixtures typically yield cautions only if the offender has prior yellows. Without prior caution, a free kick is the standard outcome — consistent with this decision.`;
    if (t === "Yellow Card") return `Historical pattern: accumulation of 3+ minor fouls within 20 minutes triggers caution in 78% of major tournament matches. This decision aligns with that benchmark.`;
    if (t === "substitution") return `Late substitutions (70′+) in tournaments often precede set-piece situations. Coaches typically rotate high-foul-risk players before they earn a second caution. Granite notes this is the ${ev.minute > 70 ? "second" : "first"} half change.`;
    return `No directly analogous recorded incident in the Granite reference database. Recommend consulting the IFAB Annual Report for nearest precedents.`;
  },
  checklist: ev => {
    const t = ev.eventType;
    if (t === "goal") return `Checklist:\n1. Confirm ball fully crossed the line\n2. Verify offside position at moment of pass\n3. Check for encroachment or goalkeeper infringement\n4. Signal to fourth official\n5. Restart from centre spot`;
    if (t === "foul") return `Checklist:\n1. Identify fouling player (number + team)\n2. Classify: careless / reckless / excessive\n3. Award free kick at correct location\n4. Issue caution if reckless or dissent follows\n5. Log in match report`;
    if (t === "Yellow Card") return `Checklist:\n1. Stop play — identify player by number\n2. Display yellow card high, face players\n3. Inform fourth official of name and offence\n4. Note time and offence in book\n5. Second yellow = automatic red`;
    if (t === "substitution") return `Checklist:\n1. Receive substitution board from fourth official\n2. Halt play at next stoppage\n3. Confirm exiting player leaves promptly\n4. Allow entering player onto pitch\n5. Signal play resumption`;
    return `Checklist:\n1. Identify all players involved\n2. Consult Law 12 classification\n3. Award correct restart\n4. Document in match report\n5. Monitor subsequent behaviour`;
  },
};

function generateGraniteReply(ev: PitchEvent, query: string): string {
  const q = query.toLowerCase();
  if (q.includes("offside") || q.includes("onside"))
    return `Offside analysis for minute ${ev.minute}: the assistant checks the position of the attacker relative to the second-last defender at the exact moment the ball is played. If level, the player is onside. Video timestamp lock is applied at the kicking frame.`;
  if (q.includes("var") || q.includes("review"))
    return `VAR review conditions: goal — offside, handball, foul in build-up; penalty — foul in box, offside; red card — direct red, mistaken identity. This incident ${ev.eventType === "goal" ? "qualifies for goal review" : "may qualify if a clear red card offence occurred"}.`;
  if (q.includes("card") || q.includes("caution") || q.includes("yellow") || q.includes("red"))
    return `Card assessment at ${ev.minute}′: Law 12.3 governs cautionable offences. If the player has an existing caution, any further cautionable infringement results in dismissal. Check the disciplinary record before deciding.`;
  if (q.includes("penalty") || q.includes("box"))
    return `Penalty box decision: contact inside the penalty area that would constitute a foul elsewhere must be penalised with a penalty kick under Law 12. Key question: was the contact on the ball first, or the player?`;
  if (q.includes("time") || q.includes("added") || q.includes("stoppage"))
    return `Time management: the fourth official tracks time lost for substitutions (30s each), injuries, and other stoppages. Granite estimates current expected added time based on recorded events up to ${ev.minute}′.`;
  return `Granite analysis at ${ev.minute}′: this type of incident (${ev.eventType}) aligns with standard decision-making frameworks. The referee's real-time assessment — confirmed by assistant referee positioning — indicates the correct call was applied under current Laws of the Game.`;
}

function GraniteAssistant({ event }: { event: PitchEvent }) {
  const [msgs, setMsgs] = useState<GMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tc = event.color;

  useEffect(() => {
    setMsgs([{ id: "init", role: "assistant", text: getGraniteContext(event) }]);
    setInput("");
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, thinking]);

  const addReply = (text: string) => setMsgs(p => [...p, { id: Date.now().toString(), role: "assistant", text }]);

  const handleQuick = (key: string) => {
    const label = { why: "Why this decision?", law: "Applicable law", incidents: "Similar incidents", checklist: "Referee checklist" }[key] ?? key;
    setMsgs(p => [...p, { id: Date.now().toString(), role: "user", text: label }]);
    setThinking(true);
    setTimeout(() => {
      addReply(QUICK_RESPONSES[key]?.(event) ?? "");
      setThinking(false);
    }, 600 + Math.random() * 300);
  };

  const handleSend = () => {
    const q = input.trim(); if (!q) return;
    setInput("");
    setMsgs(p => [...p, { id: Date.now().toString(), role: "user", text: q }]);
    setThinking(true);
    setTimeout(() => {
      addReply(generateGraniteReply(event, q));
      setThinking(false);
    }, 700 + Math.random() * 400);
  };

  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: "0.3rem", letterSpacing: "0.32em", color: "rgba(255,255,255,0.18)" }}>IBM GRANITE</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
        <span style={{ fontSize: "0.26rem", letterSpacing: "0.14em", color: `${tc}55` }}>REFEREE ASSISTANT</span>
      </div>

      {/* Message thread */}
      <div ref={scrollRef} style={{
        maxHeight: 180, overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 6,
        marginBottom: 10,
        scrollbarWidth: "none",
      }}>
        <AnimatePresence initial={false}>
          {msgs.map(m => (
            <motion.div key={m.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                padding: m.role === "assistant" ? "8px 10px" : "4px 0",
                background: m.role === "assistant" ? "rgba(255,255,255,0.035)" : "transparent",
                borderLeft: m.role === "assistant" ? `2px solid ${tc}55` : "none",
                borderRadius: m.role === "assistant" ? "0 3px 3px 0" : 0,
              }}>
              {m.role === "assistant" && (
                <div style={{ fontSize: "0.24rem", letterSpacing: "0.2em", color: tc, opacity: 0.7, marginBottom: 4 }}>GRANITE</div>
              )}
              <p style={{
                fontSize: "0.58rem",
                color: m.role === "assistant" ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.35)",
                margin: 0, lineHeight: 1.6,
                whiteSpace: "pre-line",
              }}>{m.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 2 }}>
            <motion.span
              animate={{ opacity: [0.3, 0.9, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: "0.52rem", color: tc, letterSpacing: "0.12em" }}>
              ANALYZING…
            </motion.span>
          </motion.div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {[
          { id: "why",       label: "Why this decision?" },
          { id: "law",       label: "Applicable law"     },
          { id: "incidents", label: "Similar incidents"  },
          { id: "checklist", label: "Referee checklist"  },
        ].map(qa => (
          <button key={qa.id} onClick={() => handleQuick(qa.id)} style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${tc}30`,
            borderRadius: 2, cursor: "none",
            fontFamily: "inherit", fontSize: "0.28rem",
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.42)",
            padding: "4px 8px",
            transition: "all 0.1s",
          }}>{qa.label}</button>
        ))}
      </div>

      {/* Chat input */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
          placeholder="Ask Granite about this incident…"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderBottom: `1px solid ${tc}40`,
            borderRadius: "2px 2px 0 0",
            padding: "6px 9px",
            color: "rgba(255,255,255,0.65)",
            fontFamily: "inherit",
            fontSize: "0.58rem",
            letterSpacing: "0.02em",
            outline: "none",
            cursor: "none",
          }}
        />
        <button onClick={handleSend} style={{
          background: `${tc}18`, border: `1px solid ${tc}35`,
          borderRadius: 2, cursor: "none",
          color: tc, fontFamily: "inherit",
          fontSize: "0.7rem", padding: "5px 10px",
        }}>→</button>
      </div>
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
  const { isFs, toggle: toggleFs } = useFullscreen();

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
    const t = setTimeout(() => setFrameIdx(i => i + 1), 1400);
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
      position: "fixed", inset: 0,
      background: "#070B13",
      fontFamily: "'Barlow Condensed', sans-serif",
      display: "flex", flexDirection: "column",
      cursor: "none", overflow: "hidden",
    }}>
      {/* ── Global header — minimal 42px ── */}
      <motion.header initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          height: 42, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 18px",
          borderBottom: "1px solid rgba(255,255,255,0.052)",
          zIndex: 20,
        }}>
        <motion.button onClick={onBack} style={{
          background: "none", border: "none", cursor: "none",
          color: "rgba(255,255,255,0.24)", fontFamily: "inherit",
          fontSize: "0.3rem", letterSpacing: "0.28em",
        }} whileHover={{ color: "rgba(255,255,255,0.65)" }}>
          ← PITCHLENS
        </motion.button>

        {/* Match identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.88rem", fontWeight: 900, color: homeColor, lineHeight: 1 }}>
            {meta.home.code}
          </span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.28rem", letterSpacing: "0.3em", color: "rgba(255,255,255,0.18)" }}>
              {meta.stage}
            </div>
          </div>
          <span style={{ fontSize: "0.88rem", fontWeight: 900, color: awayColor, lineHeight: 1 }}>
            {meta.away.code}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: "0.28rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.16)" }}>
            {meta.date}
          </div>
          <motion.button onClick={toggleFs}
            whileHover={{ color: "rgba(255,255,255,0.65)" }}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 2, cursor: "none",
              color: "rgba(255,255,255,0.28)", fontFamily: "inherit",
              fontSize: "0.62rem", padding: "2px 8px", lineHeight: 1.4,
            }}
            title={isFs ? "Exit Fullscreen" : "Fullscreen"}>
            {isFs ? "⊡" : "⛶"}
          </motion.button>
        </div>
      </motion.header>

      {/* ── Three-panel workspace ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — Events Library */}
        <EventsPanel
          events={pitchEvents} activeId={activeId} onSelect={setActiveId}
          query={searchQ} onQuery={setSearchQ}
          listRef={listRef} activeRef={activeRef}
        />

        {/* CENTER — Investigation Board (primary) */}
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

        {/* RIGHT — Event Dossier */}
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
