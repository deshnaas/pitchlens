/**
 * Rule-based tactical insight generator.
 * Input: StatsBomb freeze-frame + consequence chain.
 * Output: 2–4 human-readable insight strings.
 * No AI, no external APIs.
 */

import type { MomentData, ChainEvent } from "@/lib/getMomentData";

// ─── Public types ─────────────────────────────────────────────────────────────

export type InsightTone = "positive" | "warning" | "neutral";

export interface TacticalInsight {
  label: string;      // short category, e.g. "SPACE"
  text : string;      // one plain-language sentence
  tone : InsightTone;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Pt = [number, number];

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// ─── 1. Space around actor ────────────────────────────────────────────────────

function spaceInsight(m: MomentData): TacticalInsight | null {
  const actor = m.freeze_frame.find(p => p.actor);
  if (!actor) return null;

  const al  = actor.location as Pt;
  const opp = m.freeze_frame.filter(p => !p.teammate && !p.actor);
  const tms = m.freeze_frame.filter(p =>  p.teammate && !p.actor);

  const pressing  = opp.filter(p => dist(p.location as Pt, al) < 3.5);
  const converging= opp.filter(p => dist(p.location as Pt, al) < 7.0);
  const nearTm    = tms.filter(p => dist(p.location as Pt, al) < 15);

  if (pressing.length >= 3) {
    return { label:"SPACE", tone:"warning",
      text: "Three or more defenders pressing — barely any room to breathe." };
  }
  if (pressing.length === 2) {
    return { label:"SPACE", tone:"warning",
      text: "Double-marked with no angle to turn — this is a tight spot." };
  }
  if (pressing.length === 1 && nearTm.length === 0) {
    return { label:"SPACE", tone:"warning",
      text: "Tightly marked and completely isolated — no teammate support in range." };
  }
  if (pressing.length === 1) {
    return { label:"SPACE", tone:"warning",
      text: "One defender closing in fast — the decision window is shrinking." };
  }
  if (converging.length === 0 && nearTm.length >= 2) {
    return { label:"SPACE", tone:"positive",
      text: "Significant space available with support nearby — time to be ambitious." };
  }
  if (converging.length === 0) {
    return { label:"SPACE", tone:"positive",
      text: "Acres of space around the actor — plenty of time to pick a pass." };
  }
  if (nearTm.length === 0) {
    return { label:"SPACE", tone:"warning",
      text: "No nearby teammates — the actor must hold the ball alone." };
  }
  return null;
}

// ─── 2. Defensive shape ───────────────────────────────────────────────────────

function shapeInsight(m: MomentData): TacticalInsight | null {
  const opp = m.freeze_frame.filter(p => !p.teammate && !p.actor);
  if (opp.length < 4) return null;

  const xs     = opp.map(p => p.location[0]);
  const ys     = opp.map(p => p.location[1]);
  const xSpan  = Math.max(...xs) - Math.min(...xs);
  const ySpan  = Math.max(...ys) - Math.min(...ys);

  // Defensive third: x > 90 or x < 30 (both ends — we don't know direction)
  const deepBlock  = opp.filter(p => p.location[0] > 90 || p.location[0] < 30).length;
  const highPress  = opp.filter(p => p.location[0] > 55 && p.location[0] < 80).length;

  if (ySpan > 50) {
    return { label:"SHAPE", tone:"positive",
      text: "Defensive line is stretched wide — a gap through the centre should exist." };
  }
  if (ySpan < 22 && xSpan < 18) {
    return { label:"SHAPE", tone:"warning",
      text: "Opponents are tightly bunched — a compact block is hard to break down." };
  }
  if (deepBlock >= 6) {
    return { label:"SHAPE", tone:"warning",
      text: "Heavy low block in place — the defence has retreated and packed the box." };
  }
  if (highPress >= 5) {
    return { label:"SHAPE", tone:"positive",
      text: "Opponents pressing high — space behind the defensive line is available." };
  }
  if (xSpan > 40) {
    return { label:"SHAPE", tone:"positive",
      text: "Opponents are spread across a large depth — the shape lacks compactness." };
  }
  return null;
}

// ─── 3. Numerical advantage ───────────────────────────────────────────────────

function numbersInsight(m: MomentData): TacticalInsight | null {
  const actor = m.freeze_frame.find(p => p.actor);
  if (!actor) return null;

  const al     = actor.location as Pt;
  const RADIUS = 22;

  const near = m.freeze_frame.filter(p => dist(p.location as Pt, al) < RADIUS);
  const tms  = near.filter(p =>  p.teammate && !p.actor).length;
  const ops  = near.filter(p => !p.teammate && !p.actor).length;

  if (tms + ops < 2) return null;

  const diff = tms - ops;

  if (diff >= 3) {
    return { label:"NUMBERS", tone:"positive",
      text: `Attacking side is outnumbering the defence ${tms + 1}v${ops} in this zone.` };
  }
  if (diff === 2) {
    return { label:"NUMBERS", tone:"positive",
      text: `Clear attacking surplus nearby — ${tms + 1} attackers against ${ops} defenders.` };
  }
  if (diff === 1) {
    return { label:"NUMBERS", tone:"positive",
      text: `Slight advantage for the attacking side — one extra man in this pocket.` };
  }
  if (diff === -1) {
    return { label:"NUMBERS", tone:"warning",
      text: `Defending side has the numbers here — one more opponent than attacker.` };
  }
  if (diff <= -2) {
    return { label:"NUMBERS", tone:"warning",
      text: `Attackers are outnumbered ${ops}v${tms + 1} in this area — dangerous territory.` };
  }
  return { label:"NUMBERS", tone:"neutral",
    text: `Numbers are even in this zone — the outcome will come down to quality of movement.` };
}

// ─── 4. Field position ────────────────────────────────────────────────────────

function positionInsight(m: MomentData): TacticalInsight | null {
  const [x, y] = m.location;

  const inBox      = (x > 102 || x < 18) && y > 18 && y < 62;
  const sixYard    = (x > 114 || x <  6) && y > 30 && y < 50;
  const finalThird = x > 80  || x < 40;
  const central    = y > 27  && y < 53;
  const touchline  = y < 13  || y > 67;
  const halfSpace  = (y > 13 && y < 27) || (y > 53 && y < 67);
  const midfield   = x >= 40 && x <= 80;

  if (sixYard) {
    return { label:"POSITION", tone:"warning",
      text: "Inside the six-yard box — every touch here can decide the match." };
  }
  if (inBox && central) {
    return { label:"POSITION", tone:"warning",
      text: "Central penalty area — the highest-value zone on the pitch." };
  }
  if (inBox) {
    return { label:"POSITION", tone:"warning",
      text: "Inside the penalty area — one decision here changes everything." };
  }
  if (finalThird && central) {
    return { label:"POSITION", tone:"positive",
      text: "Final third, central channel — prime attacking real estate." };
  }
  if (finalThird && halfSpace) {
    return { label:"POSITION", tone:"positive",
      text: "In the half-space of the attacking third — a corridor where defences can be unlocked." };
  }
  if (finalThird && touchline) {
    return { label:"POSITION", tone:"neutral",
      text: "Near the byline in the final third — angle is tight, but a cross or cut-back is on." };
  }
  if (finalThird) {
    return { label:"POSITION", tone:"neutral",
      text: "Action in the attacking third — the team is in a position to create danger." };
  }
  if (touchline && midfield) {
    return { label:"POSITION", tone:"neutral",
      text: "Wide in midfield — limited passing angles on one side, space to drive on the other." };
  }
  if (central && midfield) {
    return { label:"POSITION", tone:"neutral",
      text: "Central midfield — options exist in every direction from here." };
  }
  return null;
}

// ─── 5. Momentum from chain ───────────────────────────────────────────────────

function momentumInsight(chain: ChainEvent[], uuid: string): TacticalInsight | null {
  const idx = chain.findIndex(e => e.event_uuid === uuid);
  if (idx <= 0) return null;

  const window = chain.slice(clamp(idx - 5, 0, chain.length), idx);
  if (window.length === 0) return null;

  const types = window.map(e => e.event_type.toLowerCase());

  const buildUp   = types.filter(t =>
    t.includes("pass") || t.includes("carry") || t.includes("receipt")
  ).length;
  const breakdown = types.filter(t =>
    t.includes("miscontrol") || t.includes("dispossessed") || t.includes("clearance") ||
    t.includes("error")
  ).length;
  const pressure  = types.filter(t =>
    t.includes("tackle") || t.includes("pressure") || t.includes("foul") ||
    t.includes("interception") || t.includes("duel")
  ).length;

  if (breakdown >= 2) {
    return { label:"MOMENTUM", tone:"warning",
      text: "The move has broken down recently — transition risk is elevated." };
  }
  if (pressure >= 3) {
    return { label:"MOMENTUM", tone:"warning",
      text: "Sustained defensive pressure in the lead-up — the attack is being forced." };
  }
  if (buildUp >= 4) {
    return { label:"MOMENTUM", tone:"positive",
      text: "Possession has been moved through multiple players — the team is in complete control." };
  }
  if (buildUp >= 2 && pressure === 0) {
    return { label:"MOMENTUM", tone:"positive",
      text: "Clean build-up over the last few touches — momentum is with the attacking side." };
  }
  if (pressure >= 1 && buildUp >= 2) {
    return { label:"MOMENTUM", tone:"neutral",
      text: "Build-up play under some defensive pressure — the moment is contested." };
  }
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateInsights(
  m      : MomentData,
  chain  : ChainEvent[],
  max = 4,
): TacticalInsight[] {
  // Order matters: most reliably informative first
  const candidates = [
    spaceInsight(m),
    positionInsight(m),
    numbersInsight(m),
    shapeInsight(m),
    momentumInsight(chain, m.event_uuid),
  ];

  const seen   = new Set<string>();
  const result : TacticalInsight[] = [];

  for (const ins of candidates) {
    if (!ins) continue;
    if (seen.has(ins.label)) continue;
    seen.add(ins.label);
    result.push(ins);
    if (result.length >= max) break;
  }

  return result;
}
