"use client";

// ─── PitchLens · Fan Story Screen ──────────────────────────────────────────────
// Completely standalone fan investigation experience.
// DO NOT import from MatchStoryScreen. Referee is untouched.
//
// Panels:
//   LEFT   — Match Story (documentary chapters)
//   CENTER — Interactive Match Board (brighter pitch)
//   RIGHT  — Why This Matters (educational + Match Coach chatbot)
//   FAR R  — Player Profile (radar + friendly stats)

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TEAM_REGISTRY } from "@/lib/matchData";
import type { MatchMeta, RawEvent } from "@/lib/matchData";

// KeyMoment defined locally — referee file untouched
type KeyMoment = {
  id: string; minute: number;
  type: "goal" | "substitution" | "card" | "incident";
  team: string; icon: string; title: string; context: string;
};

// ─── Types (local copy — referee untouched) ────────────────────────────────────
type PitchEvent = {
  id: string; eventType: string; minute: number; second: number;
  team: string; player?: string; playerIn?: string; playerOut?: string;
  isKey: boolean; keyMoment?: KeyMoment; color: string; x: number; y: number;
};
type ZoneDef       = { id:string; x:number; y:number; w:number; h:number; color:string; opacity:number; rx?:number; label?:string; labelX?:number; labelY?:number; dashed?:boolean };
type MarkerDef     = { id:string; label:string; cx:number; cy:number; color:string; teamSide:"home"|"away"; highlight?:boolean };
type ArrowDef      = { id:string; x1:number; y1:number; x2:number; y2:number; type:"pass"|"run"|"shot"|"press"; color:string; curved?:boolean; cpx?:number; cpy?:number };
type PitchLabelDef = { id:string; x:number; y:number; text:string; size:"sm"|"md"|"lg"; color?:string };
type ReconFrame    = { id:number; label:string; narration:string; zones:ZoneDef[]; markers:MarkerDef[]; arrows:ArrowDef[]; labels:PitchLabelDef[] };
type PlayerProfile = {
  stats: { influence:number; discipline:number; involvement:number; pressure:number; impact:number };
  explanations: { influence:string; discipline:string; involvement:string; pressure:string; impact:string };
  events: PitchEvent[]; goals:number; fouls:number; cards:number; totalEvents:number; keyInvolvements:number;
};

interface Props {
  meta: MatchMeta; moments: KeyMoment[]; rawEvents: RawEvent[]; narrative: string;
  matchId?: string; onBack: () => void;
}

// ─── Fan colour palette — dark premium (Football Atlas · Arc Browser · Champions League) ─
// Team / player marker colours
const FAN_TEAM_A = "#4F8CFF"; // soft blue   — home team markers
const FAN_TEAM_B = "#FFB84D"; // warm orange — away team markers
// Event type colours
const FAN_GOAL   = "#F59E0B"; // amber gold  — goal events
const FAN_SUB    = "#06B6D4"; // cyan        — substitution events
const FAN_CARD    = "#EAB308"; // yellow      — yellow card events
const FAN_FOUL    = "#F97316"; // orange      — foul events
// Dark premium UI palette
const FAN_BG       = "#0B1220"; // deep navy — page background
const FAN_SURFACE  = "#111827"; // dark slate — panel backgrounds
const FAN_CARD_BG  = "#1E293B"; // medium dark — card surfaces
const FAN_BORDER  = "rgba(255,255,255,0.07)"; // subtle dark borders
const FAN_GLOW_B  = "rgba(56,189,248,0.12)";  // soft blue glow tint
const FAN_GLOW_C  = "rgba(6,182,212,0.10)";   // soft cyan glow tint
const FAN_TEXT    = "rgba(255,255,255,0.92)";  // primary text
const FAN_TEXT_2  = "rgba(255,255,255,0.52)";  // secondary text
const FAN_TEXT_3  = "rgba(255,255,255,0.24)";  // tertiary / placeholder
const FAN_PRIMARY = "#38BDF8"; // sky blue — interactive primary
const FAN_ACCENT  = FAN_PRIMARY; // alias for UI accents

// ─── Chapter emoji helper ──────────────────────────────────────────────────────
function chapterEmoji(eventType: string): string {
  if (eventType === "goal")         return "⚽";
  if (eventType === "Yellow Card")  return "🟡";
  if (eventType === "substitution") return "🔄";
  if (eventType === "foul")         return "⚠️";
  return "📍";
}

// ─── Fan-friendly event type labels ───────────────────────────────────────────
function fanEventLabel(eventType: string): string {
  if (eventType === "goal")         return "GOAL";
  if (eventType === "Yellow Card")  return "DISCIPLINARY MOMENT";
  if (eventType === "substitution") return "TACTICAL CHANGE";
  if (eventType === "foul")         return "IMPORTANT FOUL";
  return "MOMENT";
}

// ─── zonePos helper (copied from MatchStoryScreen) ────────────────────────────
function zonePos(e: RawEvent, i: number, meta: MatchMeta): { x: number; y: number } {
  const raw = e as RawEvent & { x?: number; y?: number };
  if (typeof raw.x === "number" && typeof raw.y === "number") return { x: raw.x, y: raw.y };
  const isHome = e.team === meta.home.name;
  const base = isHome ? 60 + (i % 4) * 6 : 45 - (i % 4) * 6;
  return { x: base, y: 12 + (i % 6) * 9 };
}

// ─── buildEvents ──────────────────────────────────────────────────────────────
function buildEvents(raw: RawEvent[], moments: KeyMoment[], meta: MatchMeta): PitchEvent[] {
  return [...raw]
    .sort((a, b) => (a.minute + (a.second ?? 0) / 60) - (b.minute + (b.second ?? 0) / 60))
    .map((e, i) => {
      const km = moments.find(m =>
        Math.abs(m.minute - e.minute) <= 1 &&
        (m.team === e.team || (m.type === "goal" && e.event_type === "goal") ||
          (m.type === "card" && e.event_type === "Yellow Card"))
      );
      // Event-type colour (neutral palette — no red/green for good/bad)
      const eventColor =
        e.event_type === "goal"         ? FAN_GOAL  :
        e.event_type === "substitution" ? FAN_SUB   :
        e.event_type === "Yellow Card"  ? FAN_CARD  :
        e.event_type === "foul"         ? FAN_FOUL  :
        (e.team === meta.home.name ? FAN_TEAM_A : FAN_TEAM_B);
      return {
        id: `fpe-${i}`,
        eventType: e.event_type, minute: e.minute, second: e.second ?? 0,
        team: e.team,
        player: e.player ?? e.player_in,
        playerIn: e.player_in, playerOut: e.player_out,
        isKey: e.event_type === "goal" || e.event_type === "Yellow Card" || !!km,
        keyMoment: km, color: eventColor,
        ...zonePos(e, i, meta),
      };
    });
}

// ─── Frame builders (fan narration, identical mechanics) ──────────────────────
function buildGoalFrames(ev: PitchEvent, meta: MatchMeta): ReconFrame[] {
  const isHome = ev.team === meta.home.name;
  const tc  = isHome ? FAN_TEAM_A : FAN_TEAM_B; // team colour for markers
  const opp = isHome ? FAN_TEAM_B : FAN_TEAM_A;
  const ec  = ev.color;                           // event colour (gold) for accents
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

  return [
    {
      id: 0, label: "BUILD-UP",
      narration: `${teamU} are working the ball through the midfield. ${scorer} is showing for it centrally while ${oppU} try to stay compact. This is the build-up that precedes the chance.`,
      zones: [
        { id: "mid", x: 35, y: 0, w: 35, h: 68, color: tc, opacity: 0.08, label: "Ball moving through midfield", labelX: 52.5, labelY: 7.5 },
      ],
      markers: [
        { id: "mf1",    label: "",    cx: MF1.cx, cy: MF1.cy, color: tc,  teamSide: "home" },
        { id: "mf2",    label: "",    cx: MF2.cx, cy: MF2.cy, color: tc,  teamSide: "home" },
        { id: "scorer", label: short, cx: S0.cx,  cy: S0.cy,  color: tc,  teamSide: "home" },
        { id: "def1",   label: "",    cx: D1.cx,  cy: D1.cy,  color: opp, teamSide: "away" },
        { id: "def2",   label: "",    cx: D2.cx,  cy: D2.cy,  color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "p1", x1: MF1.cx, y1: MF1.cy, x2: S0.cx, y2: S0.cy, type: "pass", color: `${tc}70`, curved: false },
      ],
      labels: [],
    },
    {
      id: 1, label: "SPACE OPENS",
      narration: `${oppU} drop into a defensive block. This compresses the central areas but leaves gaps in the wider channels. Watch the space on the right — ${scorer} is about to find it.`,
      zones: [
        { id: "block", x: isHome ? 52.5 : 17.5, y: 10, w: 35, h: 48, color: opp, opacity: 0.1, label: "Defenders hold their shape", labelX: isHome ? 70 : 35, labelY: 8 },
      ],
      markers: [
        { id: "mf1",    label: "",    cx: cx(42),    cy: 22,    color: tc,  teamSide: "home" },
        { id: "mf2",    label: "",    cx: cx(42),    cy: 46,    color: tc,  teamSide: "home" },
        { id: "scorer", label: short, cx: S1.cx,     cy: S1.cy, color: tc,  teamSide: "home" },
        { id: "def1",   label: "",    cx: cx(65),    cy: 20,    color: opp, teamSide: "away" },
        { id: "def2",   label: "",    cx: cx(65),    cy: 46,    color: opp, teamSide: "away" },
        { id: "def3",   label: "",    cx: D3.cx,     cy: D3.cy, color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "pr1", x1: cx(65), y1: 20, x2: cx(55), y2: 26, type: "press", color: `${opp}55`, curved: false },
        { id: "pr2", x1: cx(65), y1: 46, x2: cx(55), y2: 40, type: "press", color: `${opp}55`, curved: false },
      ],
      labels: [
        { id: "l1", x: isHome ? 18 : 87, y: 63, text: "Space is opening up", size: "sm" as const, color: "rgba(255,255,255,0.28)" },
      ],
    },
    {
      id: 2, label: "THE RUN",
      narration: `This is the key moment! ${scorer} runs into the space behind ${oppU}'s defensive line. The defenders are caught between tracking the run and holding their position. The channel is open.`,
      zones: [
        { id: "atk",     x: atkX,           y: 0,  w: 35, h: 68, color: tc, opacity: 0.1 },
        { id: "channel", x: isHome ? 70 : 0, y: 10, w: 20, h: 26, color: tc, opacity: 0.18, label: "Gap behind the defence", labelX: isHome ? 80 : 10, labelY: 9 },
      ],
      markers: [
        { id: "scorer", label: short, cx: S2.cx,    cy: S2.cy, color: tc,  teamSide: "home", highlight: true },
        { id: "def1",   label: "",    cx: cx(74),    cy: 22,    color: opp, teamSide: "away" },
        { id: "def2",   label: "",    cx: cx(74),    cy: 44,    color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "run", x1: S1.cx, y1: S1.cy, x2: S2.cx, y2: S2.cy, type: "run", color: tc, curved: true, cpx: (S1.cx + S2.cx) / 2, cpy: ((S1.cy + S2.cy) / 2) - 7 },
      ],
      labels: [
        { id: "l1", x: isHome ? 18 : 87, y: 63, text: "The run begins",        size: "sm" as const, color: "rgba(255,255,255,0.32)" },
        { id: "l2", x: isHome ? 18 : 87, y: 67, text: "Defence splits open",  size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
    {
      id: 3, label: "GOAL",
      narration: `GOAL! ${scorer} scores for ${teamU} in the ${min}th minute! The shot goes in from the penalty area. ${ev.keyMoment?.context ?? `${teamU} lead. ${oppU} must now push forward to respond.`}`,
      zones: [
        { id: "atk", x: atkX, y: 0,     w: 35,  h: 68,    color: tc, opacity: 0.12 },
        { id: "pen", x: penX, y: 13.84, w: 16.5, h: 40.32, color: tc, opacity: 0.25, dashed: true, label: "Shot from here", labelX: penLX, labelY: 11 },
      ],
      markers: [
        { id: "scorer", label: short, cx: S3.cx, cy: S3.cy, color: tc, teamSide: "home", highlight: true },
      ],
      arrows: [
        { id: "shot", x1: S3.cx, y1: S3.cy, x2: goalX, y2: 34, type: "shot", color: "rgba(255,255,255,0.78)", curved: true, cpx: (S3.cx + goalX) / 2, cpy: 28 },
      ],
      labels: [
        { id: "l1", x: txtX, y: 62, text: `${scorer} scores — ${teamU} lead`, size: "sm" as const, color: `${ec}99` },
        { id: "l2", x: txtX, y: 67, text: `${min}′ · from the penalty area`,  size: "sm" as const, color: "rgba(255,255,255,0.22)" },
      ],
    },
  ];
}

function buildFoulFrames(ev: PitchEvent, meta: MatchMeta): ReconFrame[] {
  const isHome  = ev.team === meta.home.name;
  const tc      = isHome ? FAN_TEAM_A : FAN_TEAM_B;
  const opp     = isHome ? FAN_TEAM_B : FAN_TEAM_A;
  const player  = ev.player ?? "Player";
  const short   = player.split(" ").slice(-1)[0];
  const zoneName = ev.x < 35 ? "their own half" : ev.x > 70 ? "the attacking third" : "midfield";
  const zoneX    = ev.x < 35 ? 0 : ev.x > 70 ? 70 : 35;
  const zoneLabel = ev.x < 35 ? "Defensive third" : ev.x > 70 ? "Attacking third" : "Midfield";
  const min     = ev.minute;
  const yOff    = (min * 3) % 7 - 3;
  const approach = { cx: ev.x + (ev.x > 52 ? -10 : 10), cy: Math.max(3, Math.min(65, ev.y + yOff)) };

  return [
    {
      id: 0, label: "THE CHALLENGE",
      narration: `${player} goes in for the challenge. The referee is watching closely. If the contact is unfair, play will be stopped and a free kick awarded to the other team.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: tc, opacity: 0.08, label: `${short} closes down`, labelX: zoneX + 17.5, labelY: 7.5 },
      ],
      markers: [
        { id: "fouler", label: short, cx: approach.cx, cy: approach.cy, color: tc,  teamSide: "home" },
        { id: "opp",    label: "",    cx: ev.x,        cy: ev.y,        color: opp, teamSide: "away" },
      ],
      arrows: [
        { id: "app", x1: approach.cx, y1: approach.cy, x2: ev.x, y2: ev.y, type: "run", color: `${tc}70`, curved: false },
      ],
      labels: [
        { id: "l1", x: 52.5, y: 63, text: "The challenge is building", size: "sm" as const, color: "rgba(255,255,255,0.28)" },
      ],
    },
    {
      id: 1, label: "CONTACT",
      narration: `Contact is made and the referee stops the game. ${player} has caught their opponent. The other team will receive a free kick from ${zoneName}.`,
      zones: [
        { id: "zone",    x: zoneX,    y: 0,        w: 35, h: 68, color: tc,                     opacity: 0.09 },
        { id: "contact", x: ev.x - 9, y: ev.y - 9, w: 18, h: 18, color: FAN_FOUL,               opacity: 0.15, rx: 9, dashed: true },
      ],
      markers: [
        { id: "fouler", label: short, cx: ev.x,                         cy: ev.y,     color: tc,  teamSide: "home", highlight: true },
        { id: "opp",    label: "",    cx: ev.x + (ev.x > 52 ? 6 : -6), cy: ev.y + 2, color: opp, teamSide: "away" },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: "Referee stops play", size: "sm" as const, color: `${FAN_FOUL}99` },
        { id: "l2", x: 52.5, y: 67, text: `${zoneLabel} · ${min}′`, size: "sm" as const, color: "rgba(255,255,255,0.2)" },
      ],
    },
    {
      id: 2, label: "FREE KICK",
      narration: `The opposition gets a free kick from ${zoneName}. They'll set up to deliver the ball — either shooting directly or crossing into the box, depending on the location.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: opp, opacity: 0.1, label: "Free kick awarded here", labelX: zoneX + 17.5, labelY: 8 },
      ],
      markers: [],
      arrows: [],
      labels: [
        { id: "l1", x: ev.x, y: ev.y - 4, text: `${min}′ free kick`,      size: "sm" as const, color: "rgba(255,255,255,0.65)" },
        { id: "l2", x: 52.5, y: 62,        text: "Ball is live again",    size: "sm" as const, color: "rgba(255,255,255,0.3)" },
        { id: "l3", x: 52.5, y: 67,        text: `${zoneLabel} · ${min}′`, size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
  ];
}

function buildCardFrames(ev: PitchEvent, meta: MatchMeta): ReconFrame[] {
  const isHome = ev.team === meta.home.name;
  const tc     = isHome ? FAN_TEAM_A : FAN_TEAM_B;
  const opp    = isHome ? FAN_TEAM_B : FAN_TEAM_A;
  const player = ev.player ?? "Player";
  const short  = player.split(" ").slice(-1)[0];
  const zoneLabel = ev.x < 35 ? "Defensive third" : ev.x > 70 ? "Attacking third" : "Midfield";
  const zoneX  = ev.x < 35 ? 0 : ev.x > 70 ? 70 : 35;
  const min    = ev.minute;
  return [
    {
      id: 0, label: "THE INCIDENT",
      narration: `Something happened that the referee decided required an official warning. ${player} is being booked — given a yellow card. This is their formal caution for this match.`,
      zones: [
        { id: "zone",    x: zoneX,    y: 0,        w: 35, h: 68, color: "#e8c840", opacity: 0.07 },
        { id: "contact", x: ev.x - 9, y: ev.y - 9, w: 18, h: 18, color: "#e8c840", opacity: 0.14, rx: 9, dashed: true },
      ],
      markers: [
        { id: "player", label: short, cx: ev.x,                         cy: ev.y,     color: tc,  teamSide: "home", highlight: true },
        { id: "opp",    label: "",    cx: ev.x + (ev.x > 52 ? 7 : -7), cy: ev.y + 3, color: opp, teamSide: "away" },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: "Referee steps in",   size: "sm" as const, color: "rgba(232,200,64,0.55)" },
        { id: "l2", x: 52.5, y: 67, text: `${zoneLabel} · ${min}′`, size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
    {
      id: 1, label: "YELLOW CARD",
      narration: `The referee shows the yellow card. This is an official warning under the Laws of the Game. ${player} must now be careful — a second yellow card in the same match means they will be sent off, leaving their team with ten players.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: "#e8c840", opacity: 0.09 },
      ],
      markers: [
        { id: "player", label: short, cx: ev.x, cy: ev.y, color: tc, teamSide: "home", highlight: true },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: `${player} shown a yellow card`,     size: "sm" as const, color: "rgba(232,200,64,0.7)" },
        { id: "l2", x: 52.5, y: 67, text: `Official caution · ${min}′`,         size: "sm" as const, color: "rgba(255,255,255,0.22)" },
      ],
    },
    {
      id: 2, label: "WHAT IT MEANS",
      narration: `${player} must now play carefully for the rest of the game. One more yellow card means they are sent off and cannot be replaced — their team would play with ten people. Managers often substitute cautioned players to avoid the risk.`,
      zones: [
        { id: "zone", x: zoneX, y: 0, w: 35, h: 68, color: "#e8c840", opacity: 0.05 },
      ],
      markers: [],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: "One more yellow = sent off",     size: "sm" as const, color: "rgba(232,200,64,0.65)" },
        { id: "l2", x: 52.5, y: 67, text: "Player must now be very careful", size: "sm" as const, color: "rgba(255,255,255,0.22)" },
      ],
    },
  ];
}

function buildSubFrames(ev: PitchEvent, meta: MatchMeta): ReconFrame[] {
  const isHome   = ev.team === meta.home.name;
  const tc       = isHome ? FAN_TEAM_A : FAN_TEAM_B;
  const ec       = ev.color; // event colour (cyan) for label accents
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
      id: 0, label: "CURRENT PLAYER",
      narration: `${outName} is being substituted off. The manager has decided to change things — this could be tactical, or the player may be tired or carrying a knock. The new player will bring fresh energy.`,
      zones: [
        { id: "mid", x: 35, y: 0, w: 35, h: 68, color: tc, opacity: 0.08, label: `${outShort} is still on`, labelX: 52.5, labelY: 7.5 },
      ],
      markers: [
        { id: "outgoing", label: outShort, cx: centerCx, cy: 34, color: tc, teamSide: "home" },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: `${outShort} COMING OFF`, size: "sm" as const, color: `${ec}70` },
        { id: "l2", x: 52.5, y: 67, text: `${min}′ · ${teamU}`,     size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
    {
      id: 1, label: "THE CHANGE",
      narration: `${outName} leaves the pitch and ${inName} comes on. Both players pass through the technical area. Teams can make up to five substitutions per match — the manager is using one of them here.`,
      zones: [
        { id: "touch", x: 40, y: isHome ? 0 : 63.5, w: 25, h: 4.5, color: tc, opacity: 0.12, label: "Players swap here", labelX: 52.5, labelY: isHome ? 3 : 69 },
      ],
      markers: [
        { id: "outgoing", label: outShort, cx: centerCx - 4, cy: touchY, color: `${tc}66`, teamSide: "home" },
        { id: "incoming", label: inShort,  cx: centerCx + 4, cy: touchY, color: tc,        teamSide: "home" },
      ],
      arrows: [
        { id: "out", x1: centerCx,     y1: 34,     x2: centerCx - 4, y2: touchY, type: "run", color: "rgba(120,120,180,0.55)", curved: false },
        { id: "in",  x1: centerCx + 4, y1: touchY, x2: centerCx,     y2: 34,     type: "run", color: `${tc}70`,                curved: false },
      ],
      labels: [
        { id: "l1", x: centerCx, y: 62, text: `↑ ${inShort} ON · ↓ ${outShort} OFF`, size: "sm" as const, color: "rgba(255,255,255,0.35)" },
        { id: "l2", x: centerCx, y: 67, text: `${min}′ · TACTICAL CHANGE`,             size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
    {
      id: 2, label: "FRESH START",
      narration: `${inName} takes up their position. The substitution gives ${teamU} fresh energy and potentially a different tactical approach — watch to see how the team's shape adjusts around the new player.`,
      zones: [
        { id: "mid", x: 35, y: 0, w: 35, h: 68, color: tc, opacity: 0.1, label: `${inShort} enters the pitch`, labelX: 52.5, labelY: 7.5 },
      ],
      markers: [
        { id: "incoming", label: inShort, cx: centerCx, cy: 34, color: tc, teamSide: "home", highlight: true },
      ],
      arrows: [],
      labels: [
        { id: "l1", x: 52.5, y: 62, text: `${inShort} comes on — fresh legs`,  size: "sm" as const, color: `${ec}90` },
        { id: "l2", x: 52.5, y: 67, text: `${teamU} · ${min}′`,                 size: "sm" as const, color: "rgba(255,255,255,0.18)" },
      ],
    },
  ];
}

function buildFrames(ev: PitchEvent, meta: MatchMeta): ReconFrame[] {
  switch (ev.eventType) {
    case "goal":         return buildGoalFrames(ev, meta);
    case "foul":         return buildFoulFrames(ev, meta);
    case "Yellow Card":  return buildCardFrames(ev, meta);
    case "substitution": return buildSubFrames(ev, meta);
    default:             return buildFoulFrames(ev, meta);
  }
}

// ─── computePlayer ────────────────────────────────────────────────────────────
function computePlayer(playerName: string, all: PitchEvent[]): PlayerProfile {
  const mine = all.filter(e =>
    e.player === playerName || e.playerIn === playerName || e.playerOut === playerName
  );
  const goals           = mine.filter(e => e.eventType === "goal"        && e.player   === playerName).length;
  const fouls           = mine.filter(e => e.eventType === "foul"        && e.player   === playerName).length;
  const cards           = mine.filter(e => e.eventType === "Yellow Card" && e.player   === playerName).length;
  const keyInvolvements = mine.filter(e => e.isKey).length;
  const totalEvents     = mine.length;
  const lateEvents      = mine.filter(e => e.minute >= 70).length;

  const influence   = Math.min(94, Math.max(15, goals * 38 + keyInvolvements * 16 + (totalEvents >= 3 ? 18 : 8)));
  const discipline  = Math.min(88, Math.max(14, 76 - fouls * 13 - cards * 22));
  const involvement = Math.min(92, Math.max(16, 18 + totalEvents * 15 + keyInvolvements * 8));
  const pressure    = Math.min(90, Math.max(16, 18 + lateEvents * 20 + (cards > 0 ? 14 : 0) + goals * 12));
  const impact      = Math.min(95, Math.max(14, goals * 40 + keyInvolvements * 22 + (lateEvents > 0 ? 12 : 0)));

  const e = {
    influence: goals > 0
      ? `Scored ${goals} goal${goals > 1 ? "s" : ""}. Direct contribution to the scoreline.`
      : keyInvolvements > 0
      ? `Involved in ${keyInvolvements} key moment${keyInvolvements > 1 ? "s" : ""}.`
      : totalEvents > 0 ? `${totalEvents} event${totalEvents > 1 ? "s" : ""} recorded.`
      : "No events recorded for this player.",
    discipline: fouls > 0 || cards > 0
      ? `${fouls > 0 ? `${fouls} foul${fouls > 1 ? "s" : ""}` : ""}${fouls > 0 && cards > 0 ? ". " : ""}${cards > 0 ? `${cards} yellow card${cards > 1 ? "s" : ""}` : ""}.`
      : "Clean match — no fouls or cards.",
    involvement: `${totalEvents} event${totalEvents !== 1 ? "s" : ""} recorded across the match.`,
    pressure: lateEvents > 0
      ? `${lateEvents} event${lateEvents > 1 ? "s" : ""} in the final 20 minutes.`
      : "Not involved in late-match pressure.",
    impact: goals > 0
      ? "Goal scored changed the scoreline directly."
      : keyInvolvements > 0
      ? `Part of ${keyInvolvements} match-defining moment${keyInvolvements > 1 ? "s" : ""}.`
      : "No direct match-changing contributions.",
  };

  return { stats: { influence, discipline, involvement, pressure, impact }, explanations: e, events: mine, goals, fouls, cards, totalEvents, keyInvolvements };
}

// ─── Radar chart ──────────────────────────────────────────────────────────────
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
  const animKey  = values.join(",");
  return (
    <svg width="128" height="128" viewBox="0 0 104 104">
      {[0.25, 0.5, 0.75, 1].map(f => (
        <path key={f} d={ringPath(f)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />
      ))}
      {labels.map((_, i) => { const [x2, y2] = pt(100, i); return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.07)" strokeWidth="0.7" />; })}
      <motion.path key={animKey}
        d={dataPath} fill={`${color}22`} stroke={color} strokeWidth="1.5"
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
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.28)" fontSize="6" fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.04em">{label}</text>;
      })}
    </svg>
  );
}

// ─── Pitch markings — BRIGHTER for fan ────────────────────────────────────────
const LS = { stroke: "rgba(255,255,255,0.55)", strokeWidth: "0.45", fill: "none" } as const;
const ARC_Y1 = (34 - Math.sqrt(9.15 ** 2 - 5.5 ** 2)).toFixed(3);
const ARC_Y2 = (34 + Math.sqrt(9.15 ** 2 - 5.5 ** 2)).toFixed(3);

function FanPitchMarkings() {
  return (
    <g>
      <defs>
        <radialGradient id="fpg" cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="#2E8B45" />
          <stop offset="55%"  stopColor="#1E6B2E" />
          <stop offset="100%" stopColor="#134D1E" />
        </radialGradient>
        <radialGradient id="fpglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(60,180,80,0.22)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="fglow">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="fglow-soft">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="105" height="68" fill="url(#fpg)" rx="1" />
      {/* Atmospheric centre glow */}
      <rect x="0" y="0" width="105" height="68" fill="url(#fpglow)" rx="1" />
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x={i*15} y="0" width="15" height="68"
          fill={i % 2 === 0 ? "rgba(255,255,255,0.028)" : "transparent"} />
      ))}
      {[{ x: 17.5, label: "def" }, { x: 52.5, label: "mid" }, { x: 87.5, label: "atk" }].map(({ x, label }) => (
        <text key={label} x={x} y="3.5" textAnchor="middle" fill="rgba(255,255,255,0.1)" fontSize="3.6"
          fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.12em">{label}</text>
      ))}
      <rect x="0" y="0" width="105" height="68" {...LS} />
      <line x1="52.5" y1="0" x2="52.5" y2="68" {...LS} />
      <circle cx="52.5" cy="34" r="9.15" {...LS} />
      <circle cx="52.5" cy="34" r="9.15" fill="rgba(255,255,255,0.012)" />
      <circle cx="52.5" cy="34" r="0.5" fill="rgba(255,255,255,0.55)" />
      <rect x="0"    y="13.84" width="16.5" height="40.32" {...LS} />
      <rect x="0"    y="24.84" width="5.5"  height="18.32" {...LS} />
      <path d={`M 16.5 ${ARC_Y1} A 9.15 9.15 0 0 1 16.5 ${ARC_Y2}`} {...LS} />
      <circle cx="11" cy="34" r="0.42" fill="rgba(255,255,255,0.55)" />
      <rect x="-2.2" y="30.34" width="2.2" height="7.32" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.32" />
      <rect x="88.5" y="13.84" width="16.5" height="40.32" {...LS} />
      <rect x="99.5" y="24.84" width="5.5"  height="18.32" {...LS} />
      <path d={`M 88.5 ${ARC_Y1} A 9.15 9.15 0 0 0 88.5 ${ARC_Y2}`} {...LS} />
      <circle cx="94" cy="34" r="0.42" fill="rgba(255,255,255,0.55)" />
      <rect x="105" y="30.34" width="2.2" height="7.32" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.45)" strokeWidth="0.32" />
      <path d="M 1 0 A 1 1 0 0 0 0 1"      {...LS} />
      <path d="M 0 67 A 1 1 0 0 0 1 68"    {...LS} />
      <path d="M 104 0 A 1 1 0 0 1 105 1"  {...LS} />
      <path d="M 105 67 A 1 1 0 0 1 104 68" {...LS} />
    </g>
  );
}

// ─── Animation constants ───────────────────────────────────────────────────────
const MOVE_T = { duration: 0.42, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] };
const OPAC_T = { duration: 0.20 };

// ─── FrameScene ───────────────────────────────────────────────────────────────
function FrameScene({ frames, frameIdx }: { frames: ReconFrame[]; frameIdx: number }) {
  const frame = frames[frameIdx];

  const allMarkers = useMemo(() => {
    const seen = new Set<string>();
    const all: MarkerDef[] = [];
    frames.forEach(f => f.markers.forEach(m => {
      if (!seen.has(m.id)) { seen.add(m.id); all.push({ ...m }); }
    }));
    return all;
  }, [frames]);

  const frameMarkerMap = useMemo(() => {
    const map = new Map<string, MarkerDef>();
    frame?.markers.forEach(m => map.set(m.id, m));
    return map;
  }, [frame]);

  if (!frame) {
    return (
      <g>
        <motion.circle cx="52.5" cy="34" r="4.5"
          fill="none" stroke="rgba(126,207,160,0.15)" strokeWidth="0.5"
          animate={{ r: [4.5, 9, 4.5], opacity: [0.25, 0, 0.25] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <text x="52.5" y="34" textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.12)" fontSize="3.6"
          fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.24em">
          SELECT A CHAPTER
        </text>
      </g>
    );
  }

  const FS = { fontFamily: "'Barlow Condensed',sans-serif" };

  return (
    <g>
      <AnimatePresence mode="sync">
        {frame.zones.map(zone => (
          <motion.g key={`fz-${frameIdx}-${zone.id}`}
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
                fill="rgba(255,255,255,0.55)" fillOpacity={1}
                fontSize="3.0" fontWeight="500"
                {...FS} letterSpacing="0.04em">
                {zone.label}
              </text>
            )}
          </motion.g>
        ))}
      </AnimatePresence>

      {allMarkers.map(base => {
        const curr    = frameMarkerMap.get(base.id);
        const tCx     = curr?.cx ?? base.cx;
        const tCy     = curr?.cy ?? base.cy;
        const visible = !!curr;
        const hl      = curr?.highlight ?? false;
        const label   = curr?.label ?? base.label;
        const color   = curr?.color ?? base.color;
        const r       = hl ? 4.4 : 3.2;

        return (
          <g key={base.id}>
            {hl && (
              <motion.circle
                animate={{ cx: tCx, cy: tCy, opacity: visible ? 1 : 0 }}
                initial={{ cx: base.cx, cy: base.cy, opacity: 0 }}
                transition={{ cx: MOVE_T, cy: MOVE_T, opacity: OPAC_T }}
                r="8.5" fill={`${color}18`} stroke={color} strokeWidth="0.6"
              />
            )}
            <motion.circle
              animate={{ cx: tCx, cy: tCy, opacity: visible ? 1 : 0 }}
              initial={{ cx: base.cx, cy: base.cy, opacity: 0 }}
              transition={{ cx: MOVE_T, cy: MOVE_T, opacity: OPAC_T }}
              r={r} fill={`${color}45`} stroke={color} strokeWidth="0.75"
            />
            <motion.circle
              animate={{ cx: tCx, cy: tCy, opacity: visible ? 1 : 0 }}
              initial={{ cx: base.cx, cy: base.cy, opacity: 0 }}
              transition={{ cx: MOVE_T, cy: MOVE_T, opacity: OPAC_T }}
              r={r * 0.4} fill={color}
            />
            {label && (
              <motion.text
                animate={{ x: tCx, y: tCy - (hl ? 8 : 5.5), opacity: visible ? 0.9 : 0 }}
                initial={{ x: base.cx, y: base.cy - 5.5, opacity: 0 }}
                transition={{ x: MOVE_T, y: MOVE_T, opacity: OPAC_T }}
                textAnchor="middle" fill="rgba(255,255,255,0.9)"
                fontSize={hl ? "3.6" : "2.7"} fontWeight={hl ? "800" : "600"}
                {...FS}>
                {label}
              </motion.text>
            )}
          </g>
        );
      })}

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
              key={`fa-${frameIdx}-${arrow.id}`}
              d={d} fill="none" stroke={arrow.color}
              strokeWidth={isShot ? 1.2 : isRun ? 0.9 : 0.7}
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

      <AnimatePresence mode="sync">
        {frame.labels.map(lbl => {
          const fs  = lbl.size === "lg" ? 16 : lbl.size === "md" ? 6.2 : 3.3;
          const fw  = lbl.size === "lg" ? "900" : lbl.size === "md" ? "700" : "500";
          const col = lbl.color ?? "rgba(255,255,255,0.65)";
          const ls  = lbl.size === "sm" ? "0.06em" : lbl.size === "lg" ? "0em" : "0.05em";
          return (
            <motion.text
              key={`fl-${frameIdx}-${lbl.id}`}
              x={lbl.x} y={lbl.y} textAnchor="middle"
              fill={col} fontSize={fs} fontWeight={fw}
              {...FS} letterSpacing={ls}
              filter={lbl.size === "lg" ? "url(#fglow-soft)" : undefined}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}>
              {lbl.text}
            </motion.text>
          );
        })}
      </AnimatePresence>
    </g>
  );
}

// ─── Frame controls — fan-friendly ────────────────────────────────────────────
function FanFrameControls({
  frames, frameIdx, isPlaying, activeIdx, totalEvents,
  onPrev, onNext, onPlayPause, onFrameClick, activeEvent,
}: {
  frames: ReconFrame[]; frameIdx: number; isPlaying: boolean;
  activeIdx: number; totalEvents: number;
  onPrev: () => void; onNext: () => void; onPlayPause: () => void;
  onFrameClick: (i: number) => void; activeEvent?: PitchEvent;
}) {
  const tc   = activeEvent?.color ?? FAN_ACCENT;
  const canP = frameIdx > 0;
  const canN = frameIdx < frames.length - 1;

  return (
    <div style={{
      height: 44, flexShrink: 0,
      display: "flex", alignItems: "center",
      padding: "0 16px", gap: 12,
      borderTop: `1px solid ${FAN_BORDER}`,
      background: "rgba(11,18,32,0.95)",
      backdropFilter: "blur(12px)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div key={`ffl-${frameIdx}`}
            initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            <div style={{ fontSize: "0.42rem", letterSpacing: "0.2em", color: FAN_TEXT_3, marginBottom: 2 }}>
              Scene {frames.length > 0 ? frameIdx + 1 : "—"} / {frames.length}
            </div>
            <div style={{
              fontSize: "0.78rem", fontWeight: 700, color: tc,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {frames[frameIdx]?.label ?? "—"}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {frames.map((_, i) => (
          <motion.button key={i} onClick={() => onFrameClick(i)}
            animate={{ width: i === frameIdx ? 18 : 5, background: i === frameIdx ? tc : "rgba(255,255,255,0.15)" }}
            transition={{ duration: 0.2 }}
            style={{ height: 4, borderRadius: 2, border: "none", cursor: "none", padding: 0 }}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <button onClick={onPrev} disabled={!canP} style={{
          background: "none", border: "none", padding: "0 8px",
          cursor: canP ? "none" : "default",
          color: canP ? FAN_TEXT_2 : FAN_TEXT_3,
          fontSize: "1.1rem", lineHeight: 1,
        }}>‹</button>
        <button onClick={onPlayPause} style={{
          background: `rgba(56,189,248,0.18)`,
          border: `1px solid rgba(56,189,248,0.32)`,
          borderRadius: 8, cursor: "none",
          color: FAN_PRIMARY,
          fontFamily: "inherit", fontSize: "0.72rem",
          padding: "5px 14px",
          minWidth: 56,
        }}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={onNext} disabled={!canN} style={{
          background: "none", border: "none", padding: "0 8px",
          cursor: canN ? "none" : "default",
          color: canN ? FAN_TEXT_2 : FAN_TEXT_3,
          fontSize: "1.1rem", lineHeight: 1,
        }}>›</button>
      </div>

      {totalEvents > 0 && (
        <div style={{ fontSize: "0.46rem", color: FAN_TEXT_3, textAlign: "right", flexShrink: 0 }}>
          {activeIdx + 1}<span style={{ opacity: 0.55 }}>/{totalEvents}</span>
        </div>
      )}
    </div>
  );
}

// ─── Center: Interactive Match Board ─────────────────────────────────────────
function FanMatchBoard({
  frames, frameIdx, isPlaying, activeIdx, totalEvents,
  meta, activeEvent,
  onPrev, onNext, onPlayPause, onFrameClick,
}: {
  frames: ReconFrame[]; frameIdx: number; isPlaying: boolean;
  activeIdx: number; totalEvents: number;
  meta: MatchMeta; activeEvent?: PitchEvent;
  onPrev: () => void; onNext: () => void;
  onPlayPause: () => void; onFrameClick: (i: number) => void;
}) {
  const hc = FAN_TEAM_A;
  const ac = FAN_TEAM_B;

  return (
    <>
      {/* Team direction bar */}
      <div style={{
        height: 22, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", flexShrink: 0,
        borderBottom: `1px solid ${FAN_BORDER}`,
        background: "rgba(11,18,32,0.92)",
      }}>
        <span style={{ fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.12em", color: hc }}>
          ◀ {meta.home.code}
        </span>
        <span style={{ fontSize: "0.38rem", letterSpacing: "0.36em", color: FAN_TEXT_3 }}>
          MATCH BOARD
        </span>
        <span style={{ fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.12em", color: ac }}>
          {meta.away.code} ▶
        </span>
      </div>

      {/* Premium event badge — slim, inline */}
      <AnimatePresence mode="wait">
        {activeEvent && (
          <motion.div key={activeEvent.id}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
            style={{
              height: 34, flexShrink: 0, display: "flex", alignItems: "center",
              padding: "0 16px", gap: 10,
              borderBottom: `1px solid ${FAN_BORDER}`,
              background: "rgba(17,24,39,0.95)",
            }}>
            <span style={{
              fontSize: "0.84rem", fontWeight: 900, color: activeEvent.color,
              lineHeight: 1, flexShrink: 0,
            }}>
              {activeEvent.minute}′
            </span>
            <span style={{ fontSize: "0.4rem", color: FAN_TEXT_3 }}>·</span>
            <span style={{
              fontSize: "0.86rem", fontWeight: 700,
              color: FAN_TEXT, letterSpacing: "0.01em",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {activeEvent.keyMoment?.title
                ?? (activeEvent.eventType === "substitution"
                  ? `${activeEvent.playerIn} replaces ${activeEvent.playerOut}`
                  : activeEvent.player)}
            </span>
            <span style={{
              fontSize: "0.48rem", color: activeEvent.color, fontWeight: 600,
              marginLeft: "auto", flexShrink: 0,
              background: `${activeEvent.color}15`,
              padding: "2px 8px", borderRadius: 10,
              border: `1px solid ${activeEvent.color}30`,
            }}>
              {fanEventLabel(activeEvent.eventType)}{activeEvent.isKey ? " ★" : ""}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pitch — the visual hero */}
      <div style={{
        flex: 1, padding: "10px 12px", overflow: "hidden", position: "relative",
        background: "linear-gradient(135deg, #1a2a1e 0%, #0d1a10 100%)",
      }}>
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="-5 -4 117 76" preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
            <FanPitchMarkings />
            <AnimatePresence mode="wait">
              <motion.g key={activeEvent?.id ?? "empty"}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}>
                <FrameScene frames={frames} frameIdx={frameIdx} />
              </motion.g>
            </AnimatePresence>
          </svg>
        </div>

        {/* Floating glass explanation card */}
        <FanFloatingCard
          event={activeEvent}
          frame={frames[frameIdx] ?? null}
          frameIdx={frameIdx}
          totalFrames={frames.length}
        />
      </div>

      <FanFrameControls
        frames={frames} frameIdx={frameIdx} isPlaying={isPlaying}
        activeIdx={activeIdx} totalEvents={totalEvents}
        activeEvent={activeEvent}
        onPrev={onPrev} onNext={onNext}
        onPlayPause={onPlayPause} onFrameClick={onFrameClick}
      />
    </>
  );
}

// ─── Left: Match Story (documentary chapters) ─────────────────────────────────
function FanStoryNav({
  events, activeId, onSelect, listRef, activeRef,
}: {
  events: PitchEvent[]; activeId: string | null;
  onSelect: (id: string) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
  activeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const activeIdx = events.findIndex(e => e.id === activeId);

  return (
    <div style={{
      width: 190, flexShrink: 0, display: "flex", flexDirection: "column",
      background: FAN_SURFACE,
      borderRight: `1px solid ${FAN_BORDER}`,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", flexShrink: 0, borderBottom: `1px solid ${FAN_BORDER}` }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: "0.52rem", letterSpacing: "0.28em", color: FAN_PRIMARY, fontWeight: 700 }}>
            MATCH STORY
          </span>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: FAN_TEXT_3, lineHeight: 1 }}>
            {events.length}
          </span>
        </div>
        {activeIdx >= 0 && (
          <div style={{ fontSize: "0.48rem", color: FAN_TEXT_2, marginBottom: 8 }}>
            Chapter {activeIdx + 1} of {events.length}
          </div>
        )}
        <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2, marginBottom: 0 }}>
          <motion.div
            animate={{ width: events.length > 0 ? `${((activeIdx + 1) / events.length) * 100}%` : "0%" }}
            transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}
            style={{ height: "100%", background: FAN_PRIMARY, borderRadius: 2 }}
          />
        </div>
      </div>

      {/* Chapter list */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "6px 0", scrollbarWidth: "thin", scrollbarColor: `rgba(56,189,248,0.18) transparent` }}>
        {events.map((ev, i) => {
          const isActive = ev.id === activeId;
          const isGoal   = ev.eventType === "goal";
          const tc       = ev.color;
          const emoji    = chapterEmoji(ev.eventType);
          const title    = ev.keyMoment?.title
            ?? (ev.eventType === "substitution"
              ? `${ev.playerIn} for ${ev.playerOut}`
              : ev.eventType === "foul"
              ? `${ev.player ?? "Player"} Foul`
              : ev.player ?? "Event");

          return (
            <motion.button
              key={ev.id}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSelect(ev.id)}
              style={{
                width: "100%", display: "flex", alignItems: "flex-start", gap: 8,
                padding: isGoal ? "12px 14px" : "9px 14px",
                background: isActive ? `${tc}12` : "transparent",
                border: "none",
                borderLeft: `3px solid ${isActive ? tc : "transparent"}`,
                cursor: "pointer", textAlign: "left",
                boxSizing: "border-box",
              }}
              whileHover={{ background: isActive ? `${tc}12` : "rgba(255,255,255,0.04)" }}>

              {/* Chapter number */}
              <div style={{
                fontSize: "0.38rem", fontWeight: 700,
                color: isActive ? tc : FAN_TEXT_3,
                flexShrink: 0, marginTop: 3, width: 14,
              }}>
                {i + 1}
              </div>

              {/* Emoji */}
              <div style={{ fontSize: isGoal ? "0.88rem" : "0.72rem", flexShrink: 0, lineHeight: 1.3 }}>
                {emoji}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: isGoal ? "0.84rem" : "0.76rem",
                  fontWeight: isGoal ? 700 : 500,
                  color: isActive ? FAN_TEXT : FAN_TEXT_2,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  lineHeight: 1.3, transition: "color 0.12s", marginBottom: 2,
                }}>
                  {title}
                  {ev.isKey && isGoal && (
                    <span style={{ marginLeft: 4, fontSize: "0.6rem", color: tc }}>★</span>
                  )}
                </div>
                <div style={{
                  fontSize: "0.44rem",
                  color: isActive ? tc : FAN_TEXT_3,
                  transition: "color 0.12s",
                }}>
                  {ev.minute}′ · {fanEventLabel(ev.eventType)}
                </div>
              </div>
            </motion.button>
          );
        })}

        {events.length === 0 && (
          <div style={{ padding: "32px 14px", textAlign: "center" }}>
            <div style={{ fontSize: "0.52rem", color: FAN_TEXT_3 }}>No chapters yet</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Why This Matters — educational context ────────────────────────────────────
function whyThisMatters(ev: PitchEvent): string {
  if (!ev) return "";
  if (ev.keyMoment?.context) return ev.keyMoment.context;
  const player = ev.player ?? ev.playerIn ?? "The player";
  const team   = ev.team;
  if (ev.eventType === "goal") {
    return `This goal shifted the momentum of the match. Goals in football don't just change the score — they change how both teams approach the rest of the game. The team that concedes must now push forward and take more risks, which creates space for the team that scored.`;
  }
  if (ev.eventType === "Yellow Card") {
    return `A yellow card is more than just a warning in the moment. ${player} must now play every remaining challenge more carefully, knowing one more caution means being sent off. Managers often substitute booked players to protect the team from playing with ten.`;
  }
  if (ev.eventType === "substitution") {
    return `Substitutions are one of the manager's most powerful tools. Bringing ${ev.playerIn ?? "a new player"} on changes the energy, can shift the tactical shape, and sends a message about how the team plans to play the remaining minutes.`;
  }
  if (ev.eventType === "foul") {
    return `This foul stopped a potentially dangerous attack and gives the opposition a set piece. Free kicks close to goal are prime scoring opportunities — corners, direct shots, and headed balls from crosses are all possible from a dead-ball situation.`;
  }
  return `This moment contributed to the match story. Every event in football connects to what comes before and after — understanding the context helps you appreciate why the game unfolded the way it did.`;
}

// ─── Match Coach chatbot ───────────────────────────────────────────────────────
type CoachMsg = { id: string; role: "user" | "coach"; text: string };

function getCoachContext(ev: PitchEvent): string {
  const min    = ev.minute;
  const player = ev.player ?? ev.playerIn ?? "the player";
  if (ev.eventType === "goal")
    return `${player} just scored in minute ${min}! Want to understand how the goal happened, what made it possible, or what happens next in the match?`;
  if (ev.eventType === "foul")
    return `There was an important foul at minute ${min} by ${player}. I can explain what a foul is, why the referee stopped play, and what the free kick means for both teams.`;
  if (ev.eventType === "Yellow Card")
    return `${player} received a yellow card at ${min}′. Ask me anything — what a yellow card means, when players get sent off, or how it changes their play for the rest of the match.`;
  if (ev.eventType === "substitution")
    return `A tactical change at ${min}′ — ${ev.playerOut ?? "a player"} came off and ${ev.playerIn ?? "a new player"} came on. Want to know why managers make substitutions, or what this change might mean for the match?`;
  return `Something happened at ${min}′. Ask me anything about this moment and I'll explain it in plain language.`;
}

const COACH_QUICK_RESPONSES: Record<string, (ev: PitchEvent) => string> = {
  explain: ev => {
    if (ev.eventType === "goal")
      return `A goal happens when the ball fully crosses the opponent's goal line between the posts. The attacking team scores and their goal count goes up by one. The team that scores more goals by the end of the match wins.`;
    if (ev.eventType === "foul")
      return `A foul is when a player breaks a rule during play — usually by making an unfair physical challenge on an opponent. The referee stops play and awards a free kick to the team that was fouled.`;
    if (ev.eventType === "Yellow Card")
      return `A yellow card is an official warning the referee gives to a player for unsporting behaviour, dissent, or repeated foul play. If the same player gets a second yellow card in the same match, they receive a red card and are sent off.`;
    if (ev.eventType === "substitution")
      return `A substitution means one player leaves the field and a different player from the same team enters to replace them. Teams can make up to five substitutions per match — it's a key tactical decision by the manager.`;
    return `Football has two teams of eleven players trying to score goals in the opponent's net. Referees enforce the rules and award free kicks, cards, or penalties when the rules are broken.`;
  },
  impact: ev => {
    if (ev.eventType === "goal")
      return `Goals completely change the game. The team that just scored can sit back and defend their lead, while the team that conceded must push forward and attack more — this opens up space and creates more exciting football.`;
    if (ev.eventType === "foul")
      return `This foul gives the other team a free kick. Depending on where on the pitch it happened, this could be a dangerous opportunity to score. Fouls near the goal are especially dangerous — direct shots or crosses into the box are very threatening.`;
    if (ev.eventType === "Yellow Card")
      return `The player who received this card must now play more carefully for the rest of the match. Their team may also be more conservative, knowing they could lose a player if another foul is committed. Psychologically, it changes how both teams play.`;
    if (ev.eventType === "substitution")
      return `Fresh legs can change a match. The new player brings energy, and potentially a different style of play. Defensively-minded substitutions protect a lead; attacking substitutions chase a goal. Watch how the team's shape adjusts.`;
    return `Every moment in football connects to what comes next. This event affects the scoreline, the players' confidence, and the tactical decisions both managers will make going forward.`;
  },
  what_next: ev => {
    if (ev.eventType === "goal")
      return `After a goal, the team that conceded kicks off from the centre circle. The scoring team will often drop into a more defensive shape to protect their lead, while the team behind must push more players forward to try to equalize.`;
    if (ev.eventType === "foul")
      return `The team that was fouled will set up to take the free kick. Players from both teams position themselves — attackers look for space in the box, defenders form a wall if it's a shooting position. Play resumes when the kick is taken.`;
    if (ev.eventType === "Yellow Card")
      return `The referee logs the caution and play continues from the free kick or stoppage. The booked player must now think carefully before every challenge — one more yellow means an automatic red card and their team plays a man down.`;
    if (ev.eventType === "substitution")
      return `The new player takes up their position and play continues. The manager has signalled a tactical intention — watch where the new player positions themselves and how the team's shape adjusts in the next few minutes.`;
    return `Play continues from a free kick or throw-in. The referee signals the restart and the game goes on — both teams must now react to what just happened.`;
  },
  rules: ev => {
    if (ev.eventType === "goal")
      return `For a goal to stand: the whole ball must cross the goal line between the posts and under the crossbar. The player scoring must not be in an offside position when the ball is played to them. No handball in the build-up. The referee (and VAR in major tournaments) checks all of these.`;
    if (ev.eventType === "foul")
      return `A foul is called when a player trips, pushes, holds, or makes a dangerous challenge against an opponent. The referee decides whether it was careless (free kick), reckless (yellow card), or used excessive force (red card and dismissal).`;
    if (ev.eventType === "Yellow Card")
      return `Players get yellow cards for: unsporting behaviour, arguing with the referee, repeated fouling, wasting time, or encroachment. Two yellow cards in one match = red card (sent off). Red cards can also be given directly for violent conduct or serious foul play.`;
    if (ev.eventType === "substitution")
      return `Teams can make up to five substitutions per match in major tournaments (three in some competitions). A substituted player cannot return to the field. The fourth official displays a board showing the numbers of the player leaving and the player entering.`;
    return `Football is governed by 17 Laws of the Game set by IFAB (International Football Association Board). Key rules include: no hands (except goalkeepers in their area), offside, fouls, and the role of the referee as the final decision-maker.`;
  },
};

function generateCoachReply(ev: PitchEvent, query: string): string {
  const q = query.toLowerCase();
  if (q.includes("offside"))
    return `Offside is one of football's most important — and confusing — rules. A player is offside if they are closer to the opponent's goal than both the ball and the second-last defender at the moment the ball is played to them. If offside, the referee stops play and awards a free kick to the defending team.`;
  if (q.includes("penalty"))
    return `A penalty kick is awarded when a foul occurs inside the attacking team's penalty area (the big box near the goal). One player takes a direct shot from the penalty spot — 12 yards from goal — with only the goalkeeper to beat. Very high chance of scoring!`;
  if (q.includes("var") || q.includes("replay") || q.includes("review"))
    return `VAR (Video Assistant Referee) is a technology system used in major tournaments. A team of match officials watch video replays and can alert the on-field referee to check clear errors in four key situations: goals, penalties, red cards, and mistaken identity.`;
  if (q.includes("goalkeeper") || q.includes("goalie"))
    return `The goalkeeper is the only player allowed to use their hands — but only inside their own penalty area. They are the last line of defence and their job is to stop the ball from crossing the goal line. A good goalkeeper can change the outcome of a match.`;
  if (q.includes("corner") || q.includes("throw"))
    return `A corner kick is awarded when the defending team last touches the ball before it goes out over their own goal line. The attacking team takes the kick from the corner of the pitch. A throw-in is taken when the ball goes out of play over the touchline (the long sides of the pitch).`;
  return `Great question about the ${ev.minute}′ event! In football, every moment connects to the bigger picture. The key thing to understand is how this changed the balance of the match — which team has the advantage now, and how will each side respond in the next phase of play?`;
}

function MatchCoach({ event, flex }: { event: PitchEvent; flex?: boolean }) {
  const [msgs, setMsgs]         = useState<CoachMsg[]>([]);
  const [input, setInput]       = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([{ id: "init", role: "coach", text: getCoachContext(event) }]);
    setInput("");
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, thinking]);

  const addReply = (text: string) => setMsgs(p => [...p, { id: Date.now().toString(), role: "coach", text }]);

  const handleQuick = (key: string) => {
    const labels: Record<string, string> = {
      explain: "Explain this simply", impact: "What's the impact?",
      what_next: "What happens next?", rules: "What are the rules?",
    };
    setMsgs(p => [...p, { id: Date.now().toString(), role: "user", text: labels[key] ?? key }]);
    setThinking(true);
    setTimeout(() => {
      addReply(COACH_QUICK_RESPONSES[key]?.(event) ?? "");
      setThinking(false);
    }, 600 + Math.random() * 300);
  };

  const handleSend = () => {
    const q = input.trim(); if (!q) return;
    setInput("");
    setMsgs(p => [...p, { id: Date.now().toString(), role: "user", text: q }]);
    setThinking(true);
    setTimeout(() => {
      addReply(generateCoachReply(event, q));
      setThinking(false);
    }, 700 + Math.random() * 400);
  };

  const QUICK_BTNS = [
    { id: "explain",   label: "Explain this" },
    { id: "impact",    label: "What's the impact?" },
    { id: "what_next", label: "What happens next?" },
    { id: "rules",     label: "The rules" },
  ];

  // Scrollable message thread — dark glass, minimal
  const msgThread = (
    <div ref={scrollRef} style={{
      flex: flex ? 1 : undefined,
      maxHeight: flex ? undefined : 260,
      overflowY: "auto",
      display: "flex", flexDirection: "column", gap: 12,
      padding: "14px 16px 8px",
      scrollbarWidth: "thin",
      scrollbarColor: "rgba(255,255,255,0.08) transparent",
    }}>
      <AnimatePresence initial={false}>
        {msgs.map(m => (
          <motion.div key={m.id}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              padding: m.role === "coach" ? "11px 14px" : "8px 14px",
              background: m.role === "coach"
                ? `rgba(56,189,248,0.06)`
                : `rgba(255,255,255,0.04)`,
              borderLeft: m.role === "coach"
                ? `2px solid ${FAN_PRIMARY}70`
                : `1px solid rgba(255,255,255,0.08)`,
              borderRadius: m.role === "coach" ? "0 8px 8px 8px" : "0 6px 6px 6px",
            }}>
            {m.role === "coach" && (
              <div style={{ fontSize: "0.36rem", letterSpacing: "0.22em", color: FAN_PRIMARY, fontWeight: 700, marginBottom: 5, opacity: 0.9 }}>
                MATCH COACH
              </div>
            )}
            {m.role === "user" && (
              <div style={{ fontSize: "0.34rem", letterSpacing: "0.18em", color: FAN_TEXT_3, marginBottom: 4 }}>YOU</div>
            )}
            <p style={{
              fontSize: "0.84rem",
              color: m.role === "coach" ? "rgba(255,255,255,0.78)" : FAN_TEXT_2,
              margin: 0, lineHeight: 1.75, whiteSpace: "pre-line",
            }}>{m.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>

      {thinking && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ padding: "8px 14px", background: `rgba(56,189,248,0.04)`, borderRadius: 6, borderLeft: `2px solid ${FAN_PRIMARY}40` }}>
          <motion.div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {[0, 0.18, 0.36].map(d => (
              <motion.span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: FAN_PRIMARY, display: "block", opacity: 0.6 }}
                animate={{ opacity: [0.3, 0.9, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: d }} />
            ))}
          </motion.div>
        </motion.div>
      )}
    </div>
  );

  // Suggested questions + input — compact, elegant
  const actionsAndInput = (
    <div style={{
      flexShrink: 0,
      padding: "10px 16px 14px",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      background: `rgba(30,41,59,0.4)`,
    }}>
      {/* Quick suggestion pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {QUICK_BTNS.map(qa => (
          <button key={qa.id} onClick={() => handleQuick(qa.id)} style={{
            fontSize: "0.52rem", fontWeight: 500,
            color: FAN_TEXT_2,
            background: `rgba(56,189,248,0.06)`,
            border: `1px solid rgba(56,189,248,0.18)`,
            borderRadius: 16,
            padding: "4px 10px", cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.12s",
            whiteSpace: "nowrap",
          }}>{qa.label}</button>
        ))}
      </div>
      {/* Text input */}
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } }}
          placeholder="Ask anything about this moment…"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid rgba(56,189,248,0.22)`,
            borderRadius: 8,
            padding: "9px 12px",
            color: "rgba(255,255,255,0.82)",
            fontFamily: "inherit",
            fontSize: "0.82rem",
            outline: "none",
            cursor: "text",
          }}
        />
        <button onClick={handleSend} style={{
          background: `rgba(56,189,248,0.15)`,
          border: `1px solid ${FAN_PRIMARY}50`,
          borderRadius: 8,
          color: FAN_PRIMARY, fontFamily: "inherit",
          fontSize: "1rem", padding: "0 14px",
          flexShrink: 0, cursor: "pointer",
        }}>→</button>
      </div>
    </div>
  );

  if (flex) return <>{msgThread}{actionsAndInput}</>;
  return <div>{msgThread}{actionsAndInput}</div>;
}

// ─── Right: Why This Matters + Match Coach ────────────────────────────────────
function FanGuidePanel({
  event, frame, frameIdx,
}: {
  event?: PitchEvent; frame?: ReconFrame | null; frameIdx: number;
}) {
  const tc = event?.color ?? FAN_ACCENT;
  const eventLabel = event ? fanEventLabel(event.eventType) : "";
  const eventTitle = event?.keyMoment?.title
    ?? (event?.eventType === "substitution"
      ? `${event.playerIn} for ${event.playerOut}`
      : event?.player);

  return (
    <div style={{
      width: 295, flexShrink: 0, display: "flex", flexDirection: "column",
      borderLeft: "1px solid rgba(126,207,160,0.1)",
      overflow: "hidden",
    }}>
      <AnimatePresence mode="wait">
        {event ? (
          <motion.div key={event.id}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Event identity */}
            <div style={{
              padding: "14px 18px 10px", flexShrink: 0,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: "2.4rem", fontWeight: 900, color: tc, lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {event.minute}′
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.42rem", letterSpacing: "0.28em", color: tc, opacity: 0.75, marginBottom: 3 }}>
                    {eventLabel}{event.isKey ? " ★" : ""} · {event.team.toUpperCase()}
                  </div>
                  <div style={{
                    fontSize: "1.02rem", fontWeight: 800,
                    color: "rgba(255,255,255,0.88)", lineHeight: 1.15,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {eventTitle}
                  </div>
                </div>
              </div>
            </div>

            {/* WHY THIS MATTERS */}
            <div style={{
              padding: "12px 18px", flexShrink: 0,
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: `linear-gradient(180deg, ${tc}07 0%, transparent 100%)`,
            }}>
              <div style={{ height: 1, background: `linear-gradient(90deg, ${FAN_ACCENT}80, ${FAN_ACCENT}25, transparent)`, marginBottom: 8 }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.75)" }}>
                  WHY THIS MATTERS
                </span>
                <span style={{ fontSize: "0.38rem", letterSpacing: "0.18em", color: `${FAN_ACCENT}70`, flexShrink: 0 }}>
                  CONTEXT
                </span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={`why-${event.id}`}
                  initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
                  style={{
                    fontSize: "0.88rem", color: "rgba(255,255,255,0.72)",
                    lineHeight: 1.8, margin: 0,
                  }}>
                  {whyThisMatters(event)}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Narration (from frame) */}
            {frame?.narration && (
              <div style={{ padding: "10px 18px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "0.38rem", letterSpacing: "0.18em", color: `${FAN_ACCENT}55`, marginBottom: 6 }}>
                  Scene {frameIdx + 1} · {frame.label}
                </div>
                <AnimatePresence mode="wait">
                  <motion.p key={`nar-${event.id}-${frameIdx}`}
                    initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                    style={{
                      fontSize: "0.78rem", color: "rgba(255,255,255,0.45)",
                      lineHeight: 1.75, margin: 0,
                    }}>
                    {frame.narration}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}

            {/* Match Coach header */}
            <div style={{ padding: "10px 18px 6px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.7)" }}>
                  ASK MATCH COACH
                </span>
                <span style={{ fontSize: "0.36rem", letterSpacing: "0.18em", color: `${FAN_ACCENT}60` }}>
                  PITCHLENS AI
                </span>
              </div>
            </div>

            {/* Match Coach fills remaining height */}
            <MatchCoach event={event} flex />

          </motion.div>
        ) : (
          <motion.div key="empty-guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
            <div style={{ fontSize: "1.8rem", opacity: 0.18 }}>⚽</div>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.24em", color: "rgba(255,255,255,0.12)" }}>
              WHY THIS MATTERS
            </div>
            <div style={{ fontSize: "0.42rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.1)", textAlign: "center", lineHeight: 2 }}>
              SELECT A CHAPTER<br />TO START LEARNING
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stat bar ──────────────────────────────────────────────────────────────────
function FanStatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: "0.42rem", letterSpacing: "0.14em", color: FAN_TEXT_3, width: 72, flexShrink: 0, fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 1 }}>
        <motion.div
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: "100%", background: color, borderRadius: 1 }}
        />
      </div>
      <span style={{ fontSize: "0.9rem", fontWeight: 800, color, width: 22, textAlign: "right", flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

// ─── Far Right: Player Profile ────────────────────────────────────────────────
const FAN_TYPE_ICON: Record<string, string> = { goal: "⚽", "Yellow Card": "🟡", substitution: "🔄", foul: "⚠️" };

function FanPlayerProfile({
  event, allEvents, meta, homeColor,
}: {
  event?: PitchEvent; allEvents: PitchEvent[];
  meta: MatchMeta; homeColor: string;
}) {
  const tc         = event?.color ?? homeColor;
  const playerName = event?.player ?? (event?.eventType === "substitution" ? event?.playerIn : undefined);
  const profile    = playerName ? computePlayer(playerName, allEvents) : null;

  return (
    <div style={{
      width: 185, flexShrink: 0, display: "flex", flexDirection: "column",
      background: FAN_SURFACE,
      borderLeft: `1px solid ${FAN_BORDER}`,
      overflowY: "auto", scrollbarWidth: "none",
    }}>
      <AnimatePresence mode="wait">
        {profile && playerName && event ? (
          <motion.div key={`fp-${playerName}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
            style={{ display: "flex", flexDirection: "column", flex: 1 }}>

            {/* EA FC–style player card header */}
            <div style={{
              padding: "18px 16px 14px",
              background: `linear-gradient(160deg, ${tc}28 0%, rgba(30,41,59,0.9) 55%, ${FAN_SURFACE} 100%)`,
              borderBottom: `1px solid ${tc}22`,
              position: "relative", overflow: "hidden",
            }}>
              {/* Subtle glow orb */}
              <div style={{
                position: "absolute", top: -20, right: -20, width: 80, height: 80,
                borderRadius: "50%", background: `${tc}18`,
                filter: "blur(24px)", pointerEvents: "none",
              }} />
              {/* Team badge */}
              <div style={{
                fontSize: "0.36rem", letterSpacing: "0.28em", color: tc,
                fontWeight: 700, marginBottom: 8, opacity: 0.8,
              }}>
                {event.team.toUpperCase()}
              </div>
              {/* Player name — large */}
              <div style={{
                fontSize: "1.18rem", fontWeight: 900, color: "rgba(255,255,255,0.95)",
                lineHeight: 1.05, letterSpacing: "-0.01em", marginBottom: 6,
              }}>
                {playerName.split(" ").slice(-1)[0]}
              </div>
              <div style={{
                fontSize: "0.58rem", color: "rgba(255,255,255,0.4)", fontWeight: 400, letterSpacing: "0.02em",
              }}>
                {playerName.split(" ").slice(0, -1).join(" ")}
              </div>
              {/* Event type pill */}
              <div style={{
                marginTop: 10,
                display: "inline-flex", alignItems: "center", gap: 5,
                background: `${tc}18`, border: `1px solid ${tc}30`,
                borderRadius: 12, padding: "3px 10px",
              }}>
                <span style={{ fontSize: "0.68rem" }}>{chapterEmoji(event.eventType)}</span>
                <span style={{ fontSize: "0.46rem", fontWeight: 700, color: tc, letterSpacing: "0.08em" }}>
                  {fanEventLabel(event.eventType)}{event.isKey ? " ★" : ""}
                </span>
              </div>
            </div>

            {/* Radar chart — prominent */}
            <div style={{
              padding: "12px 4px 6px",
              display: "flex", justifyContent: "center",
              background: `linear-gradient(180deg, rgba(30,41,59,0.4) 0%, transparent 100%)`,
            }}>
              <RadarChart
                values={[profile.stats.influence, profile.stats.discipline, profile.stats.involvement, profile.stats.pressure, profile.stats.impact]}
                color={tc}
              />
            </div>

            {/* 5 stat bars */}
            <div style={{ padding: "0 14px 12px", borderBottom: `1px solid ${FAN_BORDER}` }}>
              <FanStatRow label="INFLUENCE"   value={profile.stats.influence}   color={tc} />
              <FanStatRow label="DISCIPLINE"  value={profile.stats.discipline}  color={tc} />
              <FanStatRow label="IMPACT"      value={profile.stats.impact}      color={tc} />
              <FanStatRow label="INVOLVEMENT" value={profile.stats.involvement} color={tc} />
              <FanStatRow label="PRESSURE"    value={profile.stats.pressure}    color={tc} />
            </div>

            {/* Match events */}
            {profile.events.length > 0 && (
              <div style={{ padding: "10px 14px 0" }}>
                <div style={{ fontSize: "0.34rem", letterSpacing: "0.26em", color: FAN_TEXT_3, marginBottom: 7, fontWeight: 500 }}>
                  IN THIS MATCH
                </div>
                {profile.events.map((e, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 7, alignItems: "center", padding: "4px 0",
                    borderBottom: i < profile.events.length - 1 ? `1px solid ${FAN_BORDER}` : "none",
                  }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: e.color, minWidth: 22 }}>{e.minute}′</span>
                    <span style={{ fontSize: "0.58rem", color: FAN_TEXT_2, lineHeight: 1.3 }}>
                      {FAN_TYPE_ICON[e.eventType] ?? "📍"} {fanEventLabel(e.eventType)}
                    </span>
                    {e.isKey && <span style={{ fontSize: "0.52rem", color: FAN_GOAL }}>★</span>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="fp-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 24 }}>
            <div style={{ fontSize: "1.8rem", opacity: 0.12 }}>👤</div>
            <div style={{ fontSize: "0.52rem", color: FAN_TEXT_3, textAlign: "center", lineHeight: 1.7 }}>
              PLAYER PROFILE
            </div>
            <div style={{ fontSize: "0.46rem", color: FAN_TEXT_3, opacity: 0.6, textAlign: "center", lineHeight: 1.6 }}>
              Select a chapter to see<br/>player statistics
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Floating scene narration card (pitch-left, narration only — no chatbot) ──
function FanFloatingCard({
  event, frame, frameIdx, totalFrames,
}: {
  event?: PitchEvent; frame: ReconFrame | null; frameIdx: number; totalFrames: number;
}) {
  if (!event || !frame) return null;

  const isLastFrame = frameIdx === totalFrames - 1;
  const tc          = event.color ?? FAN_PRIMARY;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${event.id}-${frameIdx}`}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -4 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "absolute",
          top: "50%",
          left: 10,
          transform: "translateY(-50%)",
          width: 190,
          maxWidth: "30%",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          background: "rgba(17,24,39,0.82)",
          border: `1px solid rgba(255,255,255,0.07)`,
          borderLeft: `3px solid ${tc}`,
          borderRadius: "0 12px 12px 0",
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), 0 0 16px ${tc}18`,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 10,
        }}>

        {/* Scene label */}
        <div style={{
          padding: "8px 12px 6px",
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
        }}>
          <div style={{ fontSize: "0.36rem", letterSpacing: "0.2em", color: tc, fontWeight: 700, marginBottom: 2 }}>
            {chapterEmoji(event.eventType)} {fanEventLabel(event.eventType)} · {event.minute}′
          </div>
          <div style={{ fontSize: "0.46rem", fontWeight: 700, color: FAN_TEXT, letterSpacing: "0.02em" }}>
            {frame.label}
          </div>
        </div>

        {/* Scene narration */}
        <div style={{ padding: "7px 12px 10px" }}>
          <p style={{
            fontSize: "0.58rem", lineHeight: 1.58,
            color: FAN_TEXT_2, margin: 0,
          }}>
            {frame.narration}
          </p>
        </div>

        {/* Why This Matters — final frame only */}
        {isLastFrame && (
          <div style={{
            margin: "0 10px 10px",
            padding: "7px 10px",
            background: `${tc}0E`,
            borderRadius: 6,
            borderLeft: `2px solid ${tc}66`,
          }}>
            <div style={{ fontSize: "0.36rem", letterSpacing: "0.18em", color: tc, marginBottom: 4, fontWeight: 700 }}>
              WHY THIS MATTERS
            </div>
            <p style={{ fontSize: "0.55rem", lineHeight: 1.5, color: FAN_TEXT_2, margin: 0 }}>
              {whyThisMatters(event)}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Dedicated Match Coach AI panel ──────────────────────────────────────────
function FanMatchCoach({ event }: { event?: PitchEvent }) {
  return (
    <div style={{
      width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
      background: FAN_SURFACE,
      borderLeft: `1px solid ${FAN_BORDER}`,
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "14px 18px 12px",
        flexShrink: 0,
        background: `linear-gradient(180deg, rgba(56,189,248,0.06) 0%, transparent 100%)`,
        borderBottom: `1px solid rgba(56,189,248,0.12)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${FAN_PRIMARY}33 0%, rgba(6,182,212,0.25) 100%)`,
            border: `1px solid rgba(56,189,248,0.25)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem",
          }}>🎙</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.96rem", fontWeight: 800, color: FAN_TEXT, letterSpacing: "0.01em", lineHeight: 1.1 }}>
              Match Coach AI
            </div>
            <div style={{ fontSize: "0.5rem", color: FAN_TEXT_3, marginTop: 2, letterSpacing: "0.04em" }}>
              PitchLens Guide · Powered by Granite
            </div>
          </div>
        </div>
      </div>

      {/* Coach body */}
      {event ? (
        <MatchCoach event={event} flex />
      ) : (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 14, padding: "32px 24px",
          background: FAN_SURFACE,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `rgba(56,189,248,0.08)`,
            border: `1px solid rgba(56,189,248,0.18)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem",
          }}>🎙</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.84rem", fontWeight: 700, color: FAN_TEXT, marginBottom: 6 }}>
              Your football teacher is ready
            </div>
            <div style={{ fontSize: "0.66rem", color: FAN_TEXT_2, lineHeight: 1.6 }}>
              Select a moment from the match story on the left to start a conversation with your Match Coach
            </div>
          </div>
          <div style={{
            padding: "8px 14px", borderRadius: 20,
            background: "rgba(56,189,248,0.06)", border: `1px solid rgba(56,189,248,0.18)`,
            fontSize: "0.58rem", color: FAN_PRIMARY, fontWeight: 500,
          }}>
            ← Select a chapter to begin
          </div>
        </div>
      )}
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

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function FanStoryScreen({ meta, moments, rawEvents, onBack }: Props) {
  const pitchEvents = useMemo(
    () => buildEvents(rawEvents, moments, meta), [rawEvents, moments, meta],
  );

  const [activeId,  setActiveId]  = useState<string | null>(pitchEvents[0]?.id ?? null);
  const [frameIdx,  setFrameIdx]  = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeEvent = pitchEvents.find(e => e.id === activeId);
  const activeIdx   = pitchEvents.findIndex(e => e.id === activeId);

  const frames = useMemo(
    () => activeEvent ? buildFrames(activeEvent, meta) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEvent?.id, meta],
  );

  const listRef   = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const { isFs, toggle: toggleFs } = useFullscreen();

  useEffect(() => {
    setFrameIdx(0);
    setIsPlaying(false);
    const t = setTimeout(() => setIsPlaying(true), 600);
    return () => clearTimeout(t);
  }, [activeId]);

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

  const homeColor    = FAN_TEAM_A; // neutral blue — no red/green team bias
  const awayColor    = FAN_TEAM_B; // neutral orange
  const currentFrame = frames[frameIdx] ?? null;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(ellipse 110% 80% at 55% 45%, #0d1a2e 0%, #0B1220 55%, #060C17 100%)",
      fontFamily: "'Barlow Condensed', sans-serif",
      display: "flex", flexDirection: "column",
      cursor: "none", overflow: "hidden",
    }}>
      {/* ── Global header ── */}
      <motion.header initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          height: 48, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: `1px solid ${FAN_BORDER}`,
          background: "rgba(11,18,32,0.88)",
          backdropFilter: "blur(20px) saturate(1.4)",
          boxShadow: "0 1px 0 rgba(56,189,248,0.08), 0 2px 12px rgba(0,0,0,0.4)",
          zIndex: 20,
        }}>
        <motion.button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          color: FAN_TEXT_3, fontFamily: "inherit",
          fontSize: "0.52rem", letterSpacing: "0.22em",
        }} whileHover={{ color: FAN_PRIMARY }}>
          ← PITCHLENS
        </motion.button>

        {/* Match identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: "1.2rem", fontWeight: 900, color: homeColor, lineHeight: 1 }}>
            {meta.home.code}
          </span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.38rem", letterSpacing: "0.28em", color: FAN_TEXT_3 }}>
              {meta.stage}
            </div>
          </div>
          <span style={{ fontSize: "1.2rem", fontWeight: 900, color: awayColor, lineHeight: 1 }}>
            {meta.away.code}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: "0.44rem", color: FAN_TEXT_3, letterSpacing: "0.1em" }}>
            {meta.date}
          </div>
          <motion.button onClick={toggleFs}
            whileHover={{ color: FAN_PRIMARY }}
            style={{
              background: "none", border: `1px solid ${FAN_BORDER}`,
              borderRadius: 6, cursor: "pointer",
              color: FAN_TEXT_3, fontFamily: "inherit",
              fontSize: "0.8rem", padding: "2px 10px", lineHeight: 1.4,
            }}
            title={isFs ? "Exit Fullscreen" : "Fullscreen"}>
            {isFs ? "⊡" : "⛶"}
          </motion.button>
        </div>
      </motion.header>

      {/* ── Panel workspace ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — Match Story (chapter navigator) */}
        <FanStoryNav
          events={pitchEvents} activeId={activeId} onSelect={setActiveId}
          listRef={listRef} activeRef={activeRef}
        />

        {/* CENTER — Interactive Match Board (pitch hero) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <FanMatchBoard
            frames={frames} frameIdx={frameIdx} isPlaying={isPlaying}
            activeIdx={activeIdx} totalEvents={pitchEvents.length}
            meta={meta} activeEvent={activeEvent}
            onPrev={goPrevFrame} onNext={goNextFrame}
            onPlayPause={() => setIsPlaying(p => !p)}
            onFrameClick={i => { setFrameIdx(i); setIsPlaying(false); }}
          />
        </div>

        {/* RIGHT — Match Coach AI (dedicated workspace) */}
        <FanMatchCoach event={activeEvent} />

        {/* FAR RIGHT — Player Profile (premium card) */}
        <FanPlayerProfile
          event={activeEvent}
          allEvents={pitchEvents}
          meta={meta}
          homeColor={homeColor}
        />
      </div>
    </div>
  );
}
