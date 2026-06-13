/**
 * Incident Engine — Shared type system
 *
 * All three POVs (Referee, Fan, Supporter) consume the same incident schema.
 * Only the framing, colour palette, and right-panel copy changes per POV.
 */

export type TeamSide = "home" | "away";
export type PlayerRole = "goalkeeper" | "defender" | "midfielder" | "attacker";
export type IncidentType = "offside" | "handball" | "foul" | "penalty" | "goal";
export type StepType = "incident" | "evidence" | "law" | "analysis" | "verdict";
export type POV = "referee" | "fan" | "supporter";

// ── Entities ─────────────────────────────────────────────────────────────────

export interface Player {
  id   : string;
  team : TeamSide;
  x    : number;   // pitch metres, 0–105, left→right
  y    : number;   // pitch metres, 0–68, top→bottom
  label: string;   // displayed above dot
  name?: string;
  role?: PlayerRole;
}

export interface Ball {
  x: number;
  y: number;
}

// ── Overlay primitives ───────────────────────────────────────────────────────

export interface HighlightOverlay {
  type     : "highlight";
  playerId : string;
  color    : string;
  pulse?   : boolean;
}

export interface LineOverlay {
  type     : "line";
  from     : { x: number; y: number };
  to       : { x: number; y: number };
  color    : string;
  dashed?  : boolean;
  width?   : number;        // strokeWidth in SVG units (metres)
  delay?   : number;        // animation delay seconds
}

export interface OffsideLineOverlay {
  type  : "offsideLine";
  x     : number;           // vertical line at this x
  color?: string;
  label?: string;
}

export interface ZoneOverlay {
  type   : "zone";
  x      : number;
  y      : number;
  w      : number;
  h      : number;
  color  : string;
  opacity?: number;
}

export interface LabelOverlay {
  type  : "label";
  text  : string;
  x     : number;
  y     : number;
  color?: string;
  size? : number;           // fontSize in SVG units
  bold? : boolean;
  delay?: number;
}

export interface MeasurementOverlay {
  type  : "measurement";
  from  : { x: number; y: number };
  to    : { x: number; y: number };
  label : string;
  color?: string;
  side? : "above" | "below"; // which side to place the label
}

export interface ArcOverlay {
  type        : "arc";
  cx          : number;
  cy          : number;
  r           : number;
  startAngle  : number;   // degrees
  endAngle    : number;   // degrees
  color       : string;
  width?      : number;
}

export type Overlay =
  | HighlightOverlay
  | LineOverlay
  | OffsideLineOverlay
  | ZoneOverlay
  | LabelOverlay
  | MeasurementOverlay
  | ArcOverlay;

// ── Step ─────────────────────────────────────────────────────────────────────

export interface IncidentStep {
  id       : number;
  type     : StepType;
  label    : string;    // short (Timeline label)
  title    : string;    // right panel heading
  body     : string;    // right panel paragraph
  lawRef?  : {
    number : number;
    title  : string;
    text   : string;
  };
  technical?: string[];
  overlays : Overlay[];
  verdict? : {
    decision  : string;
    confidence: number;
  };
}

// ── Incident ─────────────────────────────────────────────────────────────────

export interface Incident {
  id                 : string;
  type               : IncidentType;
  title              : string;
  matchContext       : {
    minute : number;
    teams  : [string, string];
    score  : string;
  };
  attackingDirection : "left-to-right" | "right-to-left";
  players            : Player[];
  ball               : Ball;
  steps              : IncidentStep[];
}
