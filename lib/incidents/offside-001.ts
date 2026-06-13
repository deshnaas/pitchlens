/**
 * Incident: Offside — Kai Havertz flagged
 * Germany vs Brazil, 72'
 * Germany attacking left → right (goal at x = 105)
 *
 * Scenario: Müller plays a through ball to Havertz who is 3.0m
 * ahead of the last Brazilian outfield defender (Silva) at the
 * moment the ball is played.
 */

import { Incident } from "./types";

export const offside001: Incident = {
  id   : "offside_001",
  type : "offside",
  title: "Offside — Havertz Flagged",

  matchContext: {
    minute: 72,
    teams : ["Germany", "Brazil"],
    score : "0 – 0",
  },

  attackingDirection: "left-to-right",

  // ── Players (x, y in real metres 0–105, 0–68) ───────────────────────────
  players: [
    {
      id   : "mueller",
      team : "home",
      x    : 72,
      y    : 37,
      label: "Müller",
      name : "Thomas Müller",
      role : "midfielder",
    },
    {
      id   : "havertz",
      team : "home",
      x    : 91,
      y    : 32,
      label: "Havertz",
      name : "Kai Havertz",
      role : "attacker",
    },
    {
      id   : "ger_mid",
      team : "home",
      x    : 64,
      y    : 44,
      label: "",
      role : "midfielder",
    },
    {
      id   : "ger_att2",
      team : "home",
      x    : 79,
      y    : 25,
      label: "",
      role : "attacker",
    },
    {
      id   : "silva",
      team : "away",
      x    : 88,
      y    : 29,
      label: "Silva",
      name : "Thiago Silva",
      role : "defender",
    },
    {
      id   : "bra_def2",
      team : "away",
      x    : 90,
      y    : 44,
      label: "",
      role : "defender",
    },
    {
      id   : "bra_def3",
      team : "away",
      x    : 97,
      y    : 38,
      label: "",
      role : "defender",
    },
    {
      id   : "alisson",
      team : "away",
      x    : 103.5,
      y    : 34,
      label: "Alisson",
      name : "Alisson",
      role : "goalkeeper",
    },
    {
      id   : "bra_mid",
      team : "away",
      x    : 71,
      y    : 27,
      label: "",
      role : "midfielder",
    },
  ],

  ball: { x: 72, y: 37 }, // at moment of pass

  // ── Steps ─────────────────────────────────────────────────────────────────
  steps: [
    // ── 01 INCIDENT ──────────────────────────────────────────────────────────
    {
      id     : 0,
      type   : "incident",
      label  : "Incident",
      title  : "72' — Through Ball to Havertz",
      body   : "Müller plays a through ball into space behind the Brazilian defensive line. Havertz runs onto it. The assistant referee raises their flag. Video review triggered.",
      overlays: [],
    },

    // ── 02 EVIDENCE ──────────────────────────────────────────────────────────
    {
      id     : 1,
      type   : "evidence",
      label  : "Evidence",
      title  : "Pass Origin & Receiver Position",
      body   : "The pass is traced from Müller to Havertz. At the exact instant the ball leaves Müller's foot, the positions of every player are frozen and compared against the last defender.",
      technical: [
        "Passer: Müller (Germany)",
        "Receiver: Havertz (Germany)",
        "Pass type: Through ball",
        "Timestamp: 72' 14\"",
      ],
      overlays: [
        {
          type : "line",
          from : { x: 72, y: 37 },
          to   : { x: 91, y: 32 },
          color: "rgba(255,255,255,0.55)",
          dashed: true,
          delay: 0,
        },
        { type: "highlight", playerId: "mueller",  color: "rgba(168,196,224,0.9)" },
        { type: "highlight", playerId: "havertz",  color: "rgba(168,196,224,0.9)", pulse: true },
      ],
    },

    // ── 03 LAW APPLIED ────────────────────────────────────────────────────────
    {
      id     : 2,
      type   : "law",
      label  : "Law Applied",
      title  : "Law 11 — The Offside Line",
      body   : "The offside line is set by the second-to-last opponent — the last outfield player. At the moment of Müller's pass, that player is Silva at x = 88m. Havertz at x = 91m is clearly beyond this line.",
      lawRef : {
        number: 11,
        title : "Offside",
        text  : "A player is in an offside position if any part of their head, body or feet is in the opponents' half and nearer to the opponents' goal line than both the ball and the second-to-last opponent.",
      },
      overlays: [
        {
          type   : "zone",
          x: 88, y: 0, w: 17, h: 68,
          color  : "rgba(220,80,80,1)",
          opacity: 0.09,
        },
        {
          type : "offsideLine",
          x    : 88,
          color: "rgba(220,80,80,0.85)",
          label: "OFFSIDE LINE",
        },
        { type: "highlight", playerId: "silva",   color: "rgba(255,255,255,0.75)" },
        { type: "highlight", playerId: "havertz", color: "rgba(220,80,80,0.95)", pulse: true },
        {
          type : "label",
          text : "OFFSIDE ZONE",
          x: 96.5, y: 6,
          color: "rgba(220,80,80,0.5)",
          size : 1.9,
          delay: 0.4,
        },
      ],
    },

    // ── 04 ANALYSIS ──────────────────────────────────────────────────────────
    {
      id     : 3,
      type   : "analysis",
      label  : "Analysis",
      title  : "Margin at Moment of Pass",
      body   : "Havertz is 3.0 metres beyond the offside line at the moment the ball is played. Under Law 11 any part of the head, body or feet that can legally score must be behind the line — his shoulder confirms the offside.",
      technical: [
        "Havertz: x = 91.0m",
        "Silva (last def.): x = 88.0m",
        "Margin: 3.0m OFFSIDE",
        "Body part: right shoulder",
        "Camera feeds reviewed: 4",
        "VAR review duration: 1m 18s",
      ],
      overlays: [
        {
          type   : "zone",
          x: 88, y: 0, w: 17, h: 68,
          color  : "rgba(220,80,80,1)",
          opacity: 0.06,
        },
        {
          type : "offsideLine",
          x    : 88,
          color: "rgba(220,80,80,0.75)",
        },
        // pass line (faded, context only)
        {
          type : "line",
          from : { x: 72, y: 37 },
          to   : { x: 91, y: 32 },
          color: "rgba(255,255,255,0.2)",
          dashed: true,
        },
        { type: "highlight", playerId: "havertz", color: "rgba(220,80,80,0.95)", pulse: true },
        { type: "highlight", playerId: "silva",   color: "rgba(255,255,255,0.65)" },
        {
          type : "measurement",
          from : { x: 88, y: 34 },
          to   : { x: 91, y: 34 },
          label: "3.0m",
          color: "rgba(255,200,80,0.9)",
          side : "above",
        },
      ],
    },

    // ── 05 VERDICT ───────────────────────────────────────────────────────────
    {
      id     : 4,
      type   : "verdict",
      label  : "Verdict",
      title  : "Decision — Offside Confirmed",
      body   : "VAR confirms the assistant referee's original decision. Havertz is 3.0 metres offside at the moment of the pass. The opportunity is disallowed. Indirect free kick awarded to Brazil.",
      technical: [
        "Decision: OFFSIDE",
        "Confidence: 96%",
        "Margin: 3.0m",
        "VAR: Confirmed (original correct)",
        "Outcome: Indirect free kick — Brazil",
      ],
      overlays: [
        {
          type   : "zone",
          x: 88, y: 0, w: 17, h: 68,
          color  : "rgba(220,80,80,1)",
          opacity: 0.13,
        },
        {
          type : "offsideLine",
          x    : 88,
          color: "rgba(220,80,80,0.9)",
        },
        { type: "highlight", playerId: "havertz", color: "rgba(220,80,80,1)", pulse: true },
        {
          type : "label",
          text : "OFFSIDE",
          x: 91, y: 28.5,
          color: "rgba(220,80,80,0.95)",
          size : 2.8,
          bold : true,
          delay: 0.3,
        },
      ],
      verdict: {
        decision  : "OFFSIDE",
        confidence: 96,
      },
    },
  ],
};
