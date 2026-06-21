/**
 * narrateEvent.ts
 *
 * Rule-based football narration engine.
 * Designed for future replacement by Granite / IBM Watsonx / OpenAI.
 *
 * Interface contract:
 *   narrateEvent(event, chain) → Narration
 *
 * All logic is deterministic and local — no external APIs.
 */

import type { MomentData } from "./getMomentData";
import type { ChainEvent }  from "./getMomentData";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Narration {
  /** 2–3 sentence prose describing the moment itself. Documentary tone. */
  moment: string[];
  /** 3–4 contextual observations. Each is a complete sentence. */
  whyItMatters: string[];
  /** 1–2 sentence forward-looking prose based on consequence chain. */
  whatsNext: string;
}

// ─── Vocabulary helpers ───────────────────────────────────────────────────────

const ZONE_LABEL: Record<string, string> = {
  def: "their own defensive third",
  mid: "the centre of the pitch",
  atk: "the attacking third",
};

function pitchZone(x: number): "def" | "mid" | "atk" {
  if (x < 40)  return "def";
  if (x < 80)  return "mid";
  return "atk";
}

function flankLabel(y: number): string {
  if (y < 22) return "the left flank";
  if (y > 58) return "the right flank";
  return "a central channel";
}

function lastNameOf(player: string): string {
  return player.split(" ").slice(-1)[0] ?? player;
}

function minutePhase(minute: number): string {
  if (minute <= 15)  return "the opening exchanges";
  if (minute <= 30)  return "the first half";
  if (minute <= 45)  return "the final stages of the first half";
  if (minute <= 60)  return "the early stages of the second half";
  if (minute <= 75)  return "an increasingly tense second half";
  return "the closing stages of the match";
}

// ─── Event verb phrases ───────────────────────────────────────────────────────

function momentVerb(eventType: string, player: string): string {
  const last = lastNameOf(player);
  const t    = eventType.toLowerCase();
  if (t === "foul won")         return `${last} is brought down`;
  if (t === "foul committed")   return `${last} concedes a foul`;
  if (t === "goal")             return `${last} finds the back of the net`;
  if (t.includes("shot"))       return `${last} pulls the trigger`;
  if (t === "duel")             return `${last} contests possession`;
  if (t === "carry")            return `${last} drives forward with the ball`;
  if (t.includes("pass"))       return `${last} plays the ball`;
  if (t === "pressure")         return `${last} closes down the ball carrier`;
  if (t === "interception")     return `${last} reads the pass and cuts it out`;
  if (t === "clearance")        return `${last} clears the danger`;
  if (t === "ball receipt*")    return `${last} receives under pressure`;
  if (t === "dispossessed")     return `${last} loses the ball`;
  if (t === "miscontrol")       return `${last} fails to control`;
  if (t === "offside")          return `${last} is caught offside`;
  if (t === "substitution")     return `${last} is introduced from the bench`;
  if (t.includes("card"))       return `${last} is shown a card`;
  return `${last} is involved in play`;
}

// ─── Section 1: The Moment ────────────────────────────────────────────────────

function buildMoment(event: MomentData, chain: ChainEvent[]): string[] {
  const [ax, ay] = event.location;
  const zone     = pitchZone(ax);
  const flank    = flankLabel(ay);
  const phase    = minutePhase(event.minute);
  const verb     = momentVerb(event.event_type, event.player);
  const team     = event.team;
  const last     = lastNameOf(event.player);

  // Detect recent match momentum from chain events before current
  const currentIdx = chain.findIndex(e => e.is_current);
  const before     = chain.slice(0, currentIdx);
  const teamEvents = before.filter(e => e.team === team).length;
  const oppEvents  = before.filter(e => e.team !== team && e.team !== "").length;
  const oppTeam    = chain.find(e => e.team !== team && e.team !== "")?.team ?? "The opposition";

  // Line 1: The action
  const line1 = `${event.minute}′ — ${verb} in ${flank}.`;

  // Line 2: Match context
  let line2: string;
  if (teamEvents > oppEvents + 2) {
    line2 = `${team} have dominated the recent exchanges, and this moment continues their push for control.`;
  } else if (oppEvents > teamEvents + 2) {
    line2 = `${oppTeam} have had the upper hand in the buildup, making this a critical moment for ${team} to stem the tide.`;
  } else if (zone === "atk") {
    line2 = `With the ball in the ${ZONE_LABEL[zone]}, the potential for something decisive is high.`;
  } else if (zone === "def") {
    line2 = `Deep in ${ZONE_LABEL[zone]}, the margin for error is small and every decision carries consequence.`;
  } else {
    line2 = `In ${phase}, the pattern of play is being shaped by moments exactly like this one.`;
  }

  // Line 3: Atmospheric closer (event-type specific)
  const t = event.event_type.toLowerCase();
  let line3 = "";
  if (t === "duel" || t === "pressure") {
    line3 = `The physical contest here encapsulates the battle for dominance running through the entire match.`;
  } else if (t === "foul won") {
    line3 = `${last} wins the right to restart from a dangerous position — a small victory with potential consequences.`;
  } else if (t.includes("pass") || t === "carry") {
    line3 = `The ball moves through the thirds as both sides work to establish their shape.`;
  } else if (t.includes("shot") || t === "goal") {
    line3 = `The game hangs in the balance at this precise moment.`;
  }

  return line3 ? [line1, line2, line3] : [line1, line2];
}

// ─── Section 2: Why It Matters ────────────────────────────────────────────────

function buildWhyItMatters(event: MomentData, chain: ChainEvent[]): string[] {
  const observations: string[] = [];
  const [ax, ay]  = event.location;
  const ff        = event.freeze_frame;
  const zone      = pitchZone(ax);
  const last      = lastNameOf(event.player);
  const team      = event.team;

  const teammates = ff.filter(p => p.teammate && !p.actor);
  const opponents = ff.filter(p => !p.teammate && !p.actor);

  // 1. Zone observation
  observations.push(`This ${event.event_type.toLowerCase()} occurs in ${ZONE_LABEL[zone]}, where the stakes of every duel are amplified.`);

  // 2. Numerical balance
  const radius   = 15;
  const nearTeam = teammates.filter(p =>
    Math.sqrt((p.location[0]-ax)**2 + (p.location[1]-ay)**2) < radius
  ).length;
  const nearOpp  = opponents.filter(p =>
    Math.sqrt((p.location[0]-ax)**2 + (p.location[1]-ay)**2) < radius
  ).length;
  const oppTeam  = chain.find(e => e.team !== team && e.team !== "")?.team ?? "The opposition";

  if (nearTeam > nearOpp) {
    observations.push(`${team} have numerical superiority around the ball — ${nearTeam} to ${nearOpp} — giving them time and options.`);
  } else if (nearOpp > nearTeam) {
    observations.push(`${oppTeam} outnumber ${team} in this zone, limiting ${last}'s available options and time on the ball.`);
  } else if (nearTeam === 0 && nearOpp === 0) {
    observations.push(`The area around the ball is unusually open — the next action will demand sharp decision-making in space.`);
  } else {
    observations.push(`The numbers around the ball are evenly matched, making the individual quality of each player decisive.`);
  }

  // 3. Width / touchline
  const isWide = ay < 20 || ay > 60;
  if (isWide) {
    const side = ay < 40 ? "left" : "right";
    observations.push(`The action unfolds close to the ${side} touchline — width is being used to stretch the opposition's defensive shape.`);
  } else {
    // 3b. Corridor to goal
    const distL = Math.sqrt(ax * ax + (ay - 40) ** 2);
    const distR = Math.sqrt((120-ax) ** 2 + (ay - 40) ** 2);
    const dist  = Math.min(distL, distR);
    if (dist < 25) {
      observations.push(`The proximity to goal — ${dist.toFixed(0)} yards — means a mistake here could immediately threaten the scoreline.`);
    } else {
      observations.push(`This central position gives ${last} options in multiple directions, making the next pass the crucial variable.`);
    }
  }

  // 4. Chain-based: does this lead to something?
  const currentIdx = chain.findIndex(e => e.is_current);
  const after      = chain.slice(currentIdx + 1);
  const nextGoal   = after.find(e => e.event_type.toLowerCase() === "goal");
  const nextShot   = after.find(e => e.event_type.toLowerCase().includes("shot"));
  const possChange = after.find(e => e.team !== team && e.team !== "");

  if (nextGoal && chain.indexOf(nextGoal) - currentIdx <= 4) {
    observations.push(`Critically, this moment sits just ${chain.indexOf(nextGoal) - currentIdx} events before a goal — its role in the sequence is significant.`);
  } else if (nextShot && chain.indexOf(nextShot) - currentIdx <= 4) {
    observations.push(`Within the next few events, a shot on goal follows — this moment is part of the attacking buildup.`);
  } else if (possChange && chain.indexOf(possChange) - currentIdx <= 2) {
    observations.push(`Possession changes hands very shortly after this moment, making it a pivotal transition point in the match.`);
  } else {
    observations.push(`The event contributes to a chain of actions that gradually reshape the tempo and direction of the game.`);
  }

  return observations.slice(0, 4);
}

// ─── Section 3: What Happens Next ────────────────────────────────────────────

function buildWhatsNext(event: MomentData, chain: ChainEvent[]): string {
  const currentIdx = chain.findIndex(e => e.is_current);
  if (currentIdx === -1 || currentIdx >= chain.length - 1) {
    return "This is the final event in the current chain. The story continues beyond this snapshot.";
  }

  const after   = chain.slice(currentIdx + 1);
  const team    = event.team;
  const oppTeam = chain.find(e => e.team !== team && e.team !== "")?.team ?? "the opposition";

  // Pattern detection
  const next3Types   = after.slice(0, 3).map(e => e.event_type.toLowerCase());
  const teamRetains  = after.slice(0, 3).every(e => e.team === team);
  const oppTakes     = after[0]?.team !== team && after[0]?.team !== "";
  const hasGoal      = after.some(e => e.event_type.toLowerCase() === "goal");
  const hasShot      = after.some((e, i) => e.event_type.toLowerCase().includes("shot") && i < 4);
  const hasPressSeq  = next3Types.filter(t => t === "pressure" || t === "duel").length >= 2;
  const hasPassSeq   = next3Types.filter(t => t.includes("pass") || t === "carry").length >= 2;

  if (hasGoal) {
    const goalEv = after.find(e => e.event_type.toLowerCase() === "goal")!;
    if (goalEv.team === team) {
      return `${team} are about to score. The pressure building through this phase of play reaches its climax just moments later.`;
    } else {
      return `${oppTeam} find the net shortly after this moment. What feels like a routine sequence proves to be the beginning of something significant.`;
    }
  }

  if (hasShot) {
    const shotEv = after.find(e => e.event_type.toLowerCase().includes("shot"))!;
    if (shotEv.team === team) {
      return `${team} work their way into a shooting position from this moment. The attacking intent is clear in the events that follow.`;
    } else {
      return `${oppTeam} create a shooting opportunity from this sequence. The challenge for ${team} is to absorb the pressure and reorganise.`;
    }
  }

  if (oppTakes) {
    return `${oppTeam} recover the ball immediately after this. The flow of possession reverses, and both sides reset their shape.`;
  }

  if (teamRetains && hasPassSeq) {
    return `${team} keep the ball through the next sequence — a controlled buildup that probes for space without exposing themselves at the back.`;
  }

  if (hasPressSeq) {
    const pressTeam = after[0]?.team ?? team;
    return `What follows is a sustained period of pressure from ${pressTeam}. The intensity rises as both sides contest every second ball in the middle third.`;
  }

  if (hasPassSeq && !teamRetains) {
    return `The ball moves quickly between feet as both teams look to establish a foothold. This moment is a turning point in the rhythm of the match.`;
  }

  // Generic forward narrative based on next event
  const nextEv = after[0];
  if (nextEv) {
    const nextType = nextEv.event_type.toLowerCase();
    if (nextType === "carry") return `The move continues — the ball is carried forward as ${nextEv.team} look to advance into space.`;
    if (nextType.includes("pass")) return `Play continues with a pass. The structure of this sequence determines which side gains the territorial advantage.`;
    if (nextType === "pressure") return `${nextEv.team} apply immediate pressure — the battle for the second ball begins.`;
    if (nextType === "duel") return `A physical contest follows. The outcome of the next challenge will define who controls this phase.`;
    if (nextType === "clearance") return `The ball is cleared away from danger. Both sides regroup and the game resets.`;
    if (nextType === "foul won" || nextType === "foul committed") return `A foul brings the sequence to a halt and offers one side a moment to reorganise from the restart.`;
  }

  return `The action continues from here, with both teams alert to the opportunities and threats this phase of play presents.`;
}

// ─── Intro copy (cinematic 2-line text for Memory Entry Sequence) ─────────────

export interface IntroCopy {
  line1: string; // situation / context
  line2: string; // forward-looking dramatic statement
}

export function buildIntroCopy(event: MomentData, chain: ChainEvent[]): IntroCopy {
  const t    = event.event_type.toLowerCase();
  const min  = event.minute;
  const last = lastNameOf(event.player);
  const ci   = chain.findIndex(e => e.is_current);
  const after = chain.slice(ci + 1);

  const nextGoal = after.find(e  => e.event_type.toLowerCase() === "goal");
  const nextShot = after.find((e, i) => e.event_type.toLowerCase().includes("shot") && i < 4);

  // ── Line 1: what is happening right now ────────────────────────────────────
  let line1: string;
  if      (t === "goal")             line1 = "This is the moment.";
  else if (t.includes("shot"))       line1 = "The attempt is coming.";
  else if (t === "duel")             line1 = "The ball is contested.";
  else if (t === "pressure")         line1 = `${last} closes down. There is no space.`;
  else if (t === "foul committed")   line1 = "A moment of indiscipline.";
  else if (t === "foul won")         line1 = "An opportunity opens up.";
  else if (t === "interception")     line1 = "The pass is cut out.";
  else if (t === "clearance")        line1 = "The danger is cleared — for now.";
  else if (t === "carry")            line1 = `${last} drives forward with intent.`;
  else if (t.includes("pass"))       line1 = "The ball moves through the lines.";
  else if (t === "ball receipt*")    line1 = `${last} receives under pressure.`;
  else if (t === "dispossessed")     line1 = `${last} loses the ball.`;
  else if (t === "miscontrol")       line1 = "The touch is heavy.";
  else if (min >= 85)                line1 = "The clock is almost gone.";
  else if (min >= 70)                line1 = "The game is in its final phase.";
  else if (min >= 45)                line1 = "The second half is finding its shape.";
  else                               line1 = "A decisive moment is building.";

  // ── Line 2: what is about to happen ───────────────────────────────────────
  let line2: string;
  if (nextGoal && (chain.indexOf(nextGoal) - ci) <= 4) {
    line2 = "A goal is moments away.";
  } else if (nextShot) {
    line2 = "Danger is building.";
  } else if (t === "goal") {
    line2 = "Everything changes from here.";
  } else if (min >= 88) {
    line2 = "Every second now carries the weight of the match.";
  } else if (min >= 75) {
    line2 = "The game is reaching its decisive phase.";
  } else {
    line2 = "Watch what happens next.";
  }

  return { line1, line2 };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate documentary-style narration for a football moment.
 *
 * Future compatibility: replace this function body with an LLM call
 * while preserving the Narration return type.
 */
export function narrateEvent(event: MomentData, chain: ChainEvent[]): Narration {
  return {
    moment      : buildMoment(event, chain),
    whyItMatters: buildWhyItMatters(event, chain),
    whatsNext   : buildWhatsNext(event, chain),
  };
}
