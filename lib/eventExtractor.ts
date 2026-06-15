// PitchLens — Event Extractor
// Turns raw match JSON into cinematic investigation events with narrative frames.
// Philosophy: every frame answers WHY, not WHAT.

import type { RawEvent, MatchMeta } from "./matchData";
import { TEAM_REGISTRY } from "./matchData";

export type PitchZone =
  | "defensive_third"
  | "midfield"
  | "attacking_third"
  | "left_channel"
  | "right_channel"
  | "penalty_area"
  | "penalty_spot"
  | "goal_mouth"
  | "center_circle";

export type PlayerDot = {
  id: string;
  name: string;          // short name for display
  fullName: string;
  team: string;
  color: string;
  x: number;            // 0–100 pitch coordinate
  y: number;            // 0–65 pitch coordinate
  isKey: boolean;       // spotlight this player
  hasBall?: boolean;
};

export type EventFrame = {
  id: string;
  label: string;         // "Germany In Control" — narrative title
  why: string;           // "WHY" explanation paragraph
  zone: PitchZone;
  players: PlayerDot[];
  ballPosition: { x: number; y: number };
  highlightPlayerName?: string;
};

export type InvestigationEvent = {
  id: string;
  minute: number;
  second: number;
  type: "goal" | "card" | "substitution" | "key-foul";
  team: string;
  teamCode: string;
  teamColor: string;
  primaryPlayer: string;
  secondaryPlayer?: string;   // player_in for substitutions
  momentLabel: string;        // "Gündoğan Penalty 32'"
  emotionLabel: string;       // "Germany Take the Lead"
  frames: EventFrame[];
  importance: 1 | 2 | 3;
};

// ─── SHORT NAME HELPER ─────────────────────────────────────────────
function shortName(full: string): string {
  const parts = full.trim().split(" ");
  if (parts.length === 1) return full;
  // Special: Cristiano Ronaldo, Joao Felix → surname
  return parts[parts.length - 1];
}

// ─── SEEDED SCORE GENERATOR ────────────────────────────────────────
// Returns a consistent score 68–96 based on player name + attribute index
export function playerAttribute(name: string, attrIdx: number): number {
  let h = attrIdx * 1337;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(31, h) + name.charCodeAt(i) | 0;
  }
  return 68 + (Math.abs(h) % 29);
}

export const RADAR_ATTRIBUTES = [
  "Positioning",
  "Awareness",
  "Decision Making",
  "Creativity",
  "Composure",
];

// ─── NARRATIVE FRAME DATABASE ──────────────────────────────────────
// Pre-authored narrative frames for key moments.
// Structure allows Granite to override the `why` field.

type NarrativeKey = string; // "{matchId}_{minute}_{playerSurname}"
const NARRATIVE_FRAMES: Record<NarrativeKey, EventFrame[]> = {

  // ── GERMANY vs JAPAN ─────────────────────────────────────────────

  "germany-japan_32_Gündoğan": [
    {
      id: "f1",
      label: "Germany in Control",
      why: "Germany's press is suffocating. Japan can't breathe out of their half. Havertz drops deep, pulls defenders, creates the corridors Müller and Gnabry exploit on the break.",
      zone: "attacking_third",
      ballPosition: { x: 62, y: 32 },
      highlightPlayerName: "Havertz",
      players: [
        { id:"ger-hav", name:"Havertz",  fullName:"Kai Havertz",  team:"Germany", color:"#d9d9d9", x:72, y:32, isKey:true },
        { id:"ger-gun", name:"Gündoğan", fullName:"İlkay Gündoğan", team:"Germany", color:"#d9d9d9", x:58, y:38, isKey:false },
        { id:"ger-mul", name:"Müller",   fullName:"Thomas Müller", team:"Germany", color:"#d9d9d9", x:66, y:26, isKey:false },
        { id:"ger-mus", name:"Musiala",  fullName:"Jamal Musiala", team:"Germany", color:"#d9d9d9", x:60, y:48, isKey:false },
        { id:"jpn-end", name:"Endo",     fullName:"Wataru Endo",   team:"Japan",   color:"#003f87", x:68, y:34, isKey:false },
        { id:"jpn-yos", name:"Yoshida",  fullName:"Maya Yoshida",  team:"Japan",   color:"#003f87", x:79, y:30, isKey:false },
        { id:"jpn-ita", name:"Itakura",  fullName:"Ko Itakura",    team:"Japan",   color:"#003f87", x:80, y:22, isKey:false },
      ],
    },
    {
      id: "f2",
      label: "Havertz Enters the Box",
      why: "Japan's backline steps up to compress space — a risky gambit. Havertz times his run to arrive exactly as the pass comes. The line is too high. Germany has its opening.",
      zone: "penalty_area",
      ballPosition: { x: 84, y: 33 },
      highlightPlayerName: "Havertz",
      players: [
        { id:"ger-hav", name:"Havertz",  fullName:"Kai Havertz",  team:"Germany", color:"#d9d9d9", x:84, y:30, isKey:true, hasBall:true },
        { id:"ger-gun", name:"Gündoğan", fullName:"İlkay Gündoğan", team:"Germany", color:"#d9d9d9", x:76, y:40, isKey:false },
        { id:"jpn-yos", name:"Yoshida",  fullName:"Maya Yoshida",  team:"Japan",   color:"#003f87", x:86, y:33, isKey:false },
        { id:"jpn-gon", name:"Gonda",    fullName:"Shūichi Gonda", team:"Japan",   color:"#2a6099", x:97, y:32, isKey:false },
      ],
    },
    {
      id: "f3",
      label: "Contact. Foul. Penalty.",
      why: "Yoshida commits. He has to — if Havertz turns and shoots, it's a clean chance. The contact is enough. The referee has no doubt. Germany step up to the spot.",
      zone: "penalty_spot",
      ballPosition: { x: 89, y: 32 },
      highlightPlayerName: "Gündoğan",
      players: [
        { id:"ger-hav", name:"Havertz",  fullName:"Kai Havertz",  team:"Germany", color:"#d9d9d9", x:86, y:34, isKey:false },
        { id:"ger-gun", name:"Gündoğan", fullName:"İlkay Gündoğan", team:"Germany", color:"#d9d9d9", x:72, y:38, isKey:true },
        { id:"jpn-yos", name:"Yoshida",  fullName:"Maya Yoshida",  team:"Japan",   color:"#003f87", x:86, y:30, isKey:false },
        { id:"jpn-gon", name:"Gonda",    fullName:"Shūichi Gonda", team:"Japan",   color:"#2a6099", x:97, y:32, isKey:false },
      ],
    },
    {
      id: "f4",
      label: "Gündoğan Converts",
      why: "Gündoğan has scored from the spot many times. No hesitation. He sends Gonda the wrong way. Germany lead, and for 40 minutes, the world believes this is the expected script.",
      zone: "goal_mouth",
      ballPosition: { x: 99, y: 26 },
      highlightPlayerName: "Gündoğan",
      players: [
        { id:"ger-gun", name:"Gündoğan", fullName:"İlkay Gündoğan", team:"Germany", color:"#d9d9d9", x:89, y:32, isKey:true },
        { id:"jpn-gon", name:"Gonda",    fullName:"Shūichi Gonda", team:"Japan",   color:"#2a6099", x:97, y:38, isKey:false },
      ],
    },
  ],

  "germany-japan_74_Doan": [
    {
      id: "f1",
      label: "Japan's Substitutes Change the Match",
      why: "At half-time Japan's coach Moriyasu made a radical call: switch to a back-five and release two forwards. Mitoma and Asano come on at 56'. Germany's structure hasn't adapted.",
      zone: "midfield",
      ballPosition: { x: 52, y: 40 },
      highlightPlayerName: "Mitoma",
      players: [
        { id:"jpn-mit", name:"Mitoma",   fullName:"Kaoru Mitoma",   team:"Japan", color:"#003f87", x:62, y:52, isKey:true },
        { id:"jpn-asa", name:"Asano",    fullName:"Takuma Asano",   team:"Japan", color:"#003f87", x:66, y:18, isKey:false },
        { id:"jpn-doa", name:"Doan",     fullName:"Ritsu Doan",     team:"Japan", color:"#003f87", x:58, y:35, isKey:false },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:72, y:24, isKey:false },
        { id:"ger-ram", name:"Raum",     fullName:"David Raum",     team:"Germany", color:"#d9d9d9", x:68, y:52, isKey:false },
        { id:"ger-gor", name:"Goretzka", fullName:"Leon Goretzka",  team:"Germany", color:"#d9d9d9", x:55, y:30, isKey:false },
      ],
    },
    {
      id: "f2",
      label: "Mitoma Attacks the Left Channel",
      why: "Mitoma is one of the fastest wingers in world football. Germany's right back Raum is caught out of position — he pushed too high. The channel behind him is a highway.",
      zone: "left_channel",
      ballPosition: { x: 78, y: 55 },
      highlightPlayerName: "Mitoma",
      players: [
        { id:"jpn-mit", name:"Mitoma", fullName:"Kaoru Mitoma",  team:"Japan",   color:"#003f87", x:78, y:55, isKey:true, hasBall:true },
        { id:"ger-ram", name:"Raum",   fullName:"David Raum",    team:"Germany", color:"#d9d9d9", x:76, y:50, isKey:false },
        { id:"jpn-doa", name:"Doan",   fullName:"Ritsu Doan",    team:"Japan",   color:"#003f87", x:72, y:35, isKey:false },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:80, y:32, isKey:false },
        { id:"jpn-asa", name:"Asano",  fullName:"Takuma Asano",  team:"Japan",   color:"#003f87", x:70, y:18, isKey:false },
      ],
    },
    {
      id: "f3",
      label: "The Corner. Doan Positions.",
      why: "Germany clear the initial danger but concede the corner. Doan, who has just come on for Tanaka, takes up position at the near post — exactly where Japan trained. Germany's marking is loose.",
      zone: "penalty_area",
      ballPosition: { x: 100, y: 65 },
      highlightPlayerName: "Doan",
      players: [
        { id:"jpn-doa", name:"Doan",    fullName:"Ritsu Doan",     team:"Japan",   color:"#003f87", x:84, y:26, isKey:true },
        { id:"jpn-mit", name:"Mitoma",  fullName:"Kaoru Mitoma",   team:"Japan",   color:"#003f87", x:87, y:38, isKey:false },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:82, y:30, isKey:false },
        { id:"ger-gor", name:"Goretzka", fullName:"Leon Goretzka", team:"Germany", color:"#d9d9d9", x:78, y:34, isKey:false },
        { id:"jpn-gon", name:"GK",      fullName:"Shūichi Gonda",  team:"Japan",   color:"#2a6099", x:97, y:32, isKey:false },
      ],
    },
    {
      id: "f4",
      label: "The Net Ripples. 1—1.",
      why: "Doan's shot is instinctive — first time, low, across Neuer. The German goalkeeper has no chance. Japan have done the impossible. The entire stadium is stunned.",
      zone: "goal_mouth",
      ballPosition: { x: 99, y: 24 },
      highlightPlayerName: "Doan",
      players: [
        { id:"jpn-doa", name:"Doan",   fullName:"Ritsu Doan",     team:"Japan",   color:"#003f87", x:84, y:28, isKey:true },
        { id:"ger-neu", name:"Neuer",  fullName:"Manuel Neuer",   team:"Germany", color:"#d9d9d9", x:97, y:36, isKey:false },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:82, y:35, isKey:false },
      ],
    },
  ],

  "germany-japan_82_Asano": [
    {
      id: "f1",
      label: "Germany Exposed",
      why: "After Doan's equalizer, Germany push men forward desperately seeking a winner. Their backline is high and stretched. Asano reads this. He waits for the moment the defense steps up in unison.",
      zone: "midfield",
      ballPosition: { x: 58, y: 25 },
      highlightPlayerName: "Asano",
      players: [
        { id:"jpn-asa", name:"Asano",    fullName:"Takuma Asano",      team:"Japan",   color:"#003f87", x:62, y:18, isKey:true },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:66, y:22, isKey:false },
        { id:"ger-rud", name:"Rüdiger", fullName:"Antonio Rüdiger",    team:"Germany", color:"#d9d9d9", x:70, y:34, isKey:false },
        { id:"jpn-tan", name:"Tanaka",   fullName:"Ao Tanaka",         team:"Japan",   color:"#003f87", x:55, y:35, isKey:false },
        { id:"ger-neu", name:"Neuer",    fullName:"Manuel Neuer",      team:"Germany", color:"#d9d9d9", x:97, y:32, isKey:false },
      ],
    },
    {
      id: "f2",
      label: "Asano's Blistering Run",
      why: "The through-ball splits Germany's defense. Asano's acceleration is extraordinary — he covers 40 metres in under 4 seconds. Schlotterbeck is caught flat-footed. The race is on.",
      zone: "right_channel",
      ballPosition: { x: 78, y: 16 },
      highlightPlayerName: "Asano",
      players: [
        { id:"jpn-asa", name:"Asano",    fullName:"Takuma Asano",      team:"Japan",   color:"#003f87", x:78, y:16, isKey:true, hasBall:true },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:76, y:22, isKey:false },
        { id:"ger-neu", name:"Neuer",    fullName:"Manuel Neuer",      team:"Germany", color:"#d9d9d9", x:97, y:32, isKey:false },
        { id:"jpn-doa", name:"Doan",     fullName:"Ritsu Doan",        team:"Japan",   color:"#003f87", x:70, y:34, isKey:false },
      ],
    },
    {
      id: "f3",
      label: "Racing Schlotterbeck",
      why: "Schlotterbeck's only chance is to force Asano wide and deny the shooting angle. But Asano is faster. He reaches the byline before the defender. The angle becomes extreme — near-impossible.",
      zone: "right_channel",
      ballPosition: { x: 92, y: 12 },
      highlightPlayerName: "Asano",
      players: [
        { id:"jpn-asa", name:"Asano",    fullName:"Takuma Asano",      team:"Japan",   color:"#003f87", x:92, y:12, isKey:true, hasBall:true },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:90, y:18, isKey:false },
        { id:"ger-neu", name:"Neuer",    fullName:"Manuel Neuer",      team:"Germany", color:"#d9d9d9", x:96, y:29, isKey:false },
      ],
    },
    {
      id: "f4",
      label: "Impossible Angle. Impossible Finish.",
      why: "Neuer expects the cross. Asano shoots. The ball squeezes between the goalkeeper and the near post. Nobody in the stadium can believe what they've just seen. Japan win 2—1. Germany are eliminated.",
      zone: "goal_mouth",
      ballPosition: { x: 100, y: 20 },
      highlightPlayerName: "Asano",
      players: [
        { id:"jpn-asa", name:"Asano",    fullName:"Takuma Asano",  team:"Japan",   color:"#003f87", x:94, y:14, isKey:true },
        { id:"ger-neu", name:"Neuer",    fullName:"Manuel Neuer",  team:"Germany", color:"#d9d9d9", x:97, y:30, isKey:false },
        { id:"ger-sch", name:"Schlott.", fullName:"Nico Schlotterbeck", team:"Germany", color:"#d9d9d9", x:92, y:22, isKey:false },
      ],
    },
  ],

  // ── IRAN vs USA ──────────────────────────────────────────────────

  "iran-united-states_37_Pulisic": [
    {
      id: "f1",
      label: "USA Build Through Midfield",
      why: "Tyler Adams anchors an American midfield that has been controlling territory for 30 minutes. Iran defend deep — they're not looking to score, they're waiting. But the USA found the moment.",
      zone: "midfield",
      ballPosition: { x: 55, y: 30 },
      highlightPlayerName: "Pulisic",
      players: [
        { id:"usa-pul", name:"Pulisic",  fullName:"Christian Pulisic",    team:"United States", color:"#b22234", x:68, y:28, isKey:true },
        { id:"usa-ada", name:"Adams",    fullName:"Tyler Adams",          team:"United States", color:"#b22234", x:52, y:34, isKey:false },
        { id:"usa-mus", name:"Musah",    fullName:"Yunus Dimoara Musah",  team:"United States", color:"#b22234", x:60, y:42, isKey:false },
        { id:"irn-rez", name:"Rezaeian", fullName:"Ramin Rezaeian",       team:"Iran",          color:"#239f40", x:72, y:32, isKey:false },
        { id:"irn-end", name:"Endo",     fullName:"Saeid Ezatolahi Afagh",team:"Iran",          color:"#239f40", x:70, y:42, isKey:false },
      ],
    },
    {
      id: "f2",
      label: "Pulisic Drives at the Defense",
      why: "Pulisic receives facing goal and immediately drives at pace. The Iranian defenders backpedal — Pulisic's speed forces them to retreat rather than press. This creates the space between the lines.",
      zone: "attacking_third",
      ballPosition: { x: 80, y: 26 },
      highlightPlayerName: "Pulisic",
      players: [
        { id:"usa-pul", name:"Pulisic",  fullName:"Christian Pulisic",  team:"United States", color:"#b22234", x:80, y:26, isKey:true, hasBall:true },
        { id:"irn-hos", name:"Hosseini", fullName:"Seyed Majid Hosseini", team:"Iran",        color:"#239f40", x:82, y:30, isKey:false },
        { id:"irn-pou", name:"Pourali",  fullName:"Morteza Pouraliganji", team:"Iran",        color:"#239f40", x:84, y:22, isKey:false },
        { id:"usa-sar", name:"Sargent",  fullName:"Joshua Sargent",      team:"United States", color:"#b22234", x:84, y:36, isKey:false },
      ],
    },
    {
      id: "f3",
      label: "The Collision That Changes Everything",
      why: "Pulisic finishes by diving in at the far post. He scores — but takes a heavy collision from the Iranian goalkeeper. He leaves the field on a stretcher. The USA lead, but at enormous personal cost.",
      zone: "goal_mouth",
      ballPosition: { x: 99, y: 28 },
      highlightPlayerName: "Pulisic",
      players: [
        { id:"usa-pul", name:"Pulisic", fullName:"Christian Pulisic", team:"United States", color:"#b22234", x:94, y:30, isKey:true },
        { id:"irn-bay", name:"Beiranvand", fullName:"Alireza Beiranvand", team:"Iran",       color:"#239f40", x:97, y:32, isKey:false },
      ],
    },
    {
      id: "f4",
      label: "37'. USA Lead. Pulisic Down.",
      why: "The goal stands. The USA hold this lead for 53 minutes through waves of Iranian pressure. Pulisic — carried off and hospitalised — watches his team qualify for the round of 16.",
      zone: "goal_mouth",
      ballPosition: { x: 99, y: 27 },
      highlightPlayerName: "Pulisic",
      players: [
        { id:"usa-ada", name:"Adams",   fullName:"Tyler Adams",          team:"United States", color:"#b22234", x:52, y:34, isKey:false },
        { id:"usa-mck", name:"McKennie",fullName:"Weston McKennie",      team:"United States", color:"#b22234", x:58, y:26, isKey:false },
        { id:"usa-wea", name:"Weah",    fullName:"Timothy Weah",         team:"United States", color:"#b22234", x:62, y:42, isKey:false },
        { id:"irn-tar", name:"Taremi",  fullName:"Mehdi Taremi",         team:"Iran",          color:"#239f40", x:68, y:30, isKey:true },
      ],
    },
  ],

  // ── ENGLAND vs WALES ─────────────────────────────────────────────

  "england-wales_49_Rashford": [
    {
      id: "f1",
      label: "Wales Hold. England Wait.",
      why: "Wales defended deep for 45 minutes with Gareth Bale up front in isolation. But Bale has left at half-time. Johnson replaced him — talented, but not the same defensive outlet.",
      zone: "defensive_third",
      ballPosition: { x: 30, y: 32 },
      highlightPlayerName: "Rashford",
      players: [
        { id:"eng-ras", name:"Rashford", fullName:"Marcus Rashford",         team:"England", color:"#ffffff", x:72, y:28, isKey:true },
        { id:"eng-hen", name:"Henderson",fullName:"Jordan Brian Henderson",   team:"England", color:"#ffffff", x:55, y:34, isKey:false },
        { id:"wal-mep", name:"Mepham",   fullName:"Chris Mepham",            team:"Wales",   color:"#c8102e", x:78, y:30, isKey:false },
        { id:"wal-rod", name:"Rodon",    fullName:"Joe Rodon",               team:"Wales",   color:"#c8102e", x:80, y:36, isKey:false },
      ],
    },
    {
      id: "f2",
      label: "Free Kick. Rashford Steps Up.",
      why: "Wales concede a free kick on the edge of the box — 49 minutes in. Rashford steps up. This is exactly his range. He has practiced this moment thousands of times in Manchester.",
      zone: "attacking_third",
      ballPosition: { x: 82, y: 28 },
      highlightPlayerName: "Rashford",
      players: [
        { id:"eng-ras", name:"Rashford", fullName:"Marcus Rashford", team:"England", color:"#ffffff", x:80, y:28, isKey:true, hasBall:true },
        { id:"eng-hend",name:"Henderson",fullName:"Jordan Brian Henderson", team:"England", color:"#ffffff", x:77, y:34, isKey:false },
        { id:"wal-hen", name:"Hennessey",fullName:"Wayne Hennessey", team:"Wales",   color:"#c8102e", x:97, y:32, isKey:false },
      ],
    },
    {
      id: "f3",
      label: "Over the Wall. Into the Corner.",
      why: "Hennessey dives left. Rashford puts it right. The ball dips perfectly over the Wales wall and nestles into the top corner. For the wall, there was nothing they could do.",
      zone: "goal_mouth",
      ballPosition: { x: 99, y: 22 },
      highlightPlayerName: "Rashford",
      players: [
        { id:"eng-ras", name:"Rashford",  fullName:"Marcus Rashford", team:"England", color:"#ffffff", x:80, y:28, isKey:true },
        { id:"wal-hen", name:"Hennessey", fullName:"Wayne Hennessey", team:"Wales",   color:"#c8102e", x:97, y:36, isKey:false },
      ],
    },
    {
      id: "f4",
      label: "49'. England Strike. Wales Broken.",
      why: "England scored within 4 minutes of the second half starting. The mental damage is as significant as the scoreline. One minute later, Foden makes it 2–0.",
      zone: "midfield",
      ballPosition: { x: 50, y: 32 },
      highlightPlayerName: "Rashford",
      players: [
        { id:"eng-fod", name:"Foden",     fullName:"Phil Foden",           team:"England", color:"#ffffff", x:66, y:36, isKey:true },
        { id:"eng-ras", name:"Rashford",  fullName:"Marcus Rashford",      team:"England", color:"#ffffff", x:72, y:24, isKey:false },
        { id:"wal-dav", name:"Davies",    fullName:"Ben Davies",           team:"Wales",   color:"#c8102e", x:75, y:34, isKey:false },
        { id:"wal-amp", name:"Ampadu",    fullName:"Ethan Ampadu",         team:"Wales",   color:"#c8102e", x:68, y:40, isKey:false },
      ],
    },
  ],

};

// ─── GENERIC FRAMES (fallback) ─────────────────────────────────────
function buildGenericGoalFrames(
  minute: number,
  player: string,
  team: string,
  teamMeta: typeof TEAM_REGISTRY[string],
  opponentMeta: typeof TEAM_REGISTRY[string],
): EventFrame[] {
  const sn = shortName(player);
  return [
    {
      id: "f1", label: `${teamMeta.code} Build-Up`,
      why: `${teamMeta.name} create the conditions for this goal through patient build-up and intelligent movement. ${sn} has positioned themselves to receive at exactly the right moment.`,
      zone: "midfield", ballPosition: { x: 55, y: 32 },
      players: [
        { id:"p1", name:sn,          fullName:player,              team, color:teamMeta.color, x:62, y:28, isKey:true },
        { id:"p2", name:"Defender",  fullName:"Defender",          team:opponentMeta.name, color:opponentMeta.color, x:74, y:30, isKey:false },
      ],
    },
    {
      id: "f2", label: `${sn} Creates Space`,
      why: `The movement before the goal is key. ${sn} draws defenders out of position, creating the lane needed for the decisive action.`,
      zone: "attacking_third", ballPosition: { x: 78, y: 30 },
      players: [
        { id:"p1", name:sn, fullName:player, team, color:teamMeta.color, x:78, y:28, isKey:true, hasBall:true },
        { id:"p2", name:"GK", fullName:"Goalkeeper", team:opponentMeta.name, color:opponentMeta.color, x:97, y:32, isKey:false },
      ],
    },
    {
      id: "f3", label: `${minute}'. ${sn} Scores.`,
      why: `The finish is decisive. ${sn} makes the right decision in the moment and converts. This goal changes the match.`,
      zone: "goal_mouth", ballPosition: { x: 99, y: 26 },
      players: [
        { id:"p1", name:sn, fullName:player, team, color:teamMeta.color, x:88, y:30, isKey:true },
        { id:"p2", name:"GK", fullName:"Goalkeeper", team:opponentMeta.name, color:opponentMeta.color, x:97, y:36, isKey:false },
      ],
    },
  ];
}

function buildGenericCardFrames(
  minute: number,
  player: string,
  team: string,
  teamMeta: typeof TEAM_REGISTRY[string],
): EventFrame[] {
  const sn = shortName(player);
  return [
    {
      id: "f1", label: "Tension Rising",
      why: `Pressure has been building for several minutes. ${sn} has been caught in a difficult position — a moment of frustration waiting to happen.`,
      zone: "midfield", ballPosition: { x: 52, y: 36 },
      players: [
        { id:"p1", name:sn, fullName:player, team, color:teamMeta.color, x:58, y:34, isKey:true },
      ],
    },
    {
      id: "f2", label: `${sn} Commits`,
      why: `${minute}' — the foul is committed. Whether tactical or emotional, the referee has no choice. The card is shown.`,
      zone: "midfield", ballPosition: { x: 56, y: 34 },
      players: [
        { id:"p1", name:sn, fullName:player, team, color:teamMeta.color, x:58, y:34, isKey:true },
      ],
    },
  ];
}

function buildGenericSubFrames(
  minute: number,
  playerOut: string,
  playerIn: string,
  team: string,
  teamMeta: typeof TEAM_REGISTRY[string],
): EventFrame[] {
  const outSn = shortName(playerOut);
  const inSn  = shortName(playerIn);
  return [
    {
      id: "f1", label: "Tactical Change",
      why: `${minute}' — ${teamMeta.name}'s coach reads the match. ${outSn} has given what they can. ${inSn} comes on to shift the dynamic.`,
      zone: "midfield", ballPosition: { x: 50, y: 32 },
      players: [
        { id:"p1", name:outSn, fullName:playerOut, team, color:teamMeta.color, x:60, y:30, isKey:false },
        { id:"p2", name:inSn,  fullName:playerIn,  team, color:teamMeta.color, x:60, y:38, isKey:true },
      ],
    },
    {
      id: "f2", label: `${inSn} Enters`,
      why: `The substitution is not just personnel — it's a signal. ${teamMeta.name} are changing their approach. Watch how the shape shifts in the next five minutes.`,
      zone: "midfield", ballPosition: { x: 50, y: 32 },
      players: [
        { id:"p2", name:inSn, fullName:playerIn, team, color:teamMeta.color, x:58, y:34, isKey:true },
      ],
    },
  ];
}

// ─── RUNNING SCORE TRACKER ─────────────────────────────────────────
function computeRunningScore(
  events: RawEvent[],
  upToTimestamp: number,
  homeTeam: string,
): { home: number; away: number } {
  const sorted = [...events].sort((a, b) => (a.minute * 60 + a.second) - (b.minute * 60 + b.second));
  let home = 0; let away = 0;
  for (const ev of sorted) {
    if (ev.minute * 60 + ev.second > upToTimestamp) break;
    if (ev.event_type === "goal") {
      if (ev.team === homeTeam) home++; else away++;
    }
  }
  return { home, away };
}

// ─── MAIN EXTRACTOR ───────────────────────────────────────────────
export function extractEvents(
  matchId: string,
  rawEvents: RawEvent[],
  meta: MatchMeta,
): InvestigationEvent[] {
  const sorted = [...rawEvents].sort(
    (a, b) => (a.minute * 60 + a.second) - (b.minute * 60 + b.second),
  );

  const results: InvestigationEvent[] = [];

  for (const ev of sorted) {
    const ts = ev.minute * 60 + ev.second;
    const type = ev.event_type.toLowerCase();

    if (type === "goal") {
      const player = ev.player ?? "Unknown";
      const sn = shortName(player);
      const isHome = ev.team === meta.home.name;
      const teamMeta = isHome ? TEAM_REGISTRY[meta.home.name] : TEAM_REGISTRY[meta.away.name];
      const oppMeta  = isHome ? TEAM_REGISTRY[meta.away.name] : TEAM_REGISTRY[meta.home.name];

      if (!teamMeta) continue;

      // Look up pre-authored frames
      const key = `${matchId}_${ev.minute}_${sn}`;
      const frames = NARRATIVE_FRAMES[key]
        ?? buildGenericGoalFrames(ev.minute, player, ev.team, teamMeta, oppMeta);

      const score = computeRunningScore(sorted, ts, meta.home.name);

      results.push({
        id: `${matchId}_goal_${ev.minute}_${ts}`,
        minute: ev.minute,
        second: ev.second,
        type: "goal",
        team: ev.team,
        teamCode: teamMeta.code,
        teamColor: teamMeta.color,
        primaryPlayer: player,
        momentLabel: `${sn}  ${ev.minute}'`,
        emotionLabel: `${ev.team} ${ (isHome ? score.home : score.away) === 1 ? "Take" : "Score" } the ${ordinal(isHome ? score.home : score.away)} Goal`,
        frames,
        importance: 3,
      });
    }

    else if (type === "yellow card") {
      const player = ev.player ?? "Unknown";
      const sn = shortName(player);
      const isHome = ev.team === meta.home.name;
      const teamMeta = isHome ? TEAM_REGISTRY[meta.home.name] : TEAM_REGISTRY[meta.away.name];
      if (!teamMeta) continue;

      results.push({
        id: `${matchId}_card_${ev.minute}_${ts}`,
        minute: ev.minute,
        second: ev.second,
        type: "card",
        team: ev.team,
        teamCode: teamMeta.code,
        teamColor: teamMeta.color,
        primaryPlayer: player,
        momentLabel: `${sn}  ${ev.minute}'`,
        emotionLabel: `Yellow Card — ${sn}`,
        frames: buildGenericCardFrames(ev.minute, player, ev.team, teamMeta),
        importance: 2,
      });
    }
  }

  // Sort chronologically
  return results.sort((a, b) => (a.minute * 60 + a.second) - (b.minute * 60 + b.second));
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
