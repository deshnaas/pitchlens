"use client";

// --- Supporter Story Screen � Cinematic Atmosphere Pass -----------------------
// Philosophy: The user FEELS the match, not reads about it.
//
// Rules:
//   - No synthetic metrics. No fake Belief %, Confidence %, Pressure bars.
//   - Stadium physically reacts to events � shake, border flash, particles.
//   - IBM Granite is a flagship feature, prominently placed.
//   - Confetti ONLY for 90+ winners or final whistle victories. Not regular goals.
//   - No decorative floating circles. Every effect is intentional and premium.
//   - Team atmosphere = light quality, not UI recolor.
//
// DO NOT MODIFY DATA FLOW. DO NOT MODIFY REFEREE. DO NOT MODIFY FAN.

import {
  useState, useRef, useEffect, useCallback, useMemo
} from "react";
import { useRouter } from "next/navigation";
import {
  motion, AnimatePresence, useAnimation, useMotionValue, animate
} from "framer-motion";
import { TEAM_REGISTRY }    from "@/lib/matchData";
import type { MatchMeta, RawEvent } from "@/lib/matchData";
import type { MatchNarrative }      from "@/lib/matchNarratives";

export type SupporterTeam = "home" | "away" | "neutral";

// --- Types --------------------------------------------------------------------
type KeyMoment = {
  id: string; minute: number;
  type: "goal" | "substitution" | "card" | "incident";
  team: string; icon: string; title: string; context: string;
};

type PitchEvent = {
  id: string; eventType: string; minute: number; second: number;
  team: string; player?: string; playerIn?: string; playerOut?: string;
  isKey: boolean; keyMoment?: KeyMoment; color: string; teamColor: string;
  x: number; y: number;
};

type ZoneDef       = { id:string; x:number; y:number; w:number; h:number; color:string; opacity:number; rx?:number; label?:string; labelX?:number; labelY?:number; dashed?:boolean };
type MarkerDef     = { id:string; label:string; cx:number; cy:number; color:string; teamSide:"home"|"away"; highlight?:boolean };
type ArrowDef      = { id:string; x1:number; y1:number; x2:number; y2:number; type:"pass"|"run"|"shot"|"press"; color:string; curved?:boolean; cpx?:number; cpy?:number };
type PitchLabelDef = { id:string; x:number; y:number; text:string; size:"sm"|"md"|"lg"; color?:string };
type ReconFrame    = { id:number; label:string; narration:string; zones:ZoneDef[]; markers:MarkerDef[]; arrows:ArrowDef[]; labels:PitchLabelDef[] };

// --- Reaction types ------------------------------------------------------------
type ReactionType =
  | "goal_for_90plus"   // 90+ winner: confetti + max everything
  | "goal_for_winner"   // late winner (75+): strong celebration
  | "goal_for"          // regular goal for: celebration
  | "goal_against"      // opponent scores: silence
  | "red_card"          // red card: sharp flash
  | "penalty";          // penalty: tension build

function detectReaction(
  ev: PitchEvent,
  isMyTeam: boolean,
  allEvents: PitchEvent[],
  myTeam: string,
): ReactionType | null {
  if (ev.eventType === "goal") {
    if (!isMyTeam) return "goal_against";
    // Compute score after this goal
    const myGoals  = allEvents.filter(e => e.eventType==="goal" && e.team===myTeam    && (e.minute<ev.minute||(e.minute===ev.minute&&e.second<=ev.second))).length;
    const oppGoals = allEvents.filter(e => e.eventType==="goal" && e.team!==myTeam    && (e.minute<ev.minute||(e.minute===ev.minute&&e.second<=ev.second))).length;
    const winning  = myGoals > oppGoals;
    if (ev.minute >= 88 && winning) return "goal_for_90plus";
    if (ev.minute >= 75 && winning) return "goal_for_winner";
    return "goal_for";
  }
  if (ev.eventType === "Red Card") return "red_card";
  if (ev.eventType === "penalty")  return "penalty";
  return null;
}

// --- Atmosphere System --------------------------------------------------------
type AtmosphereType =
  | "spain_crimson"    // Spain � passion, control, dominance
  | "japan_samurai"    // Japan � elegant, disciplined, precise
  | "england_wembley"  // England � historic, traditional, white/navy
  | "germany_elite"    // Germany � champagne gold, machine-like, elite
  | "portugal_royal"   // Portugal � emerald, burgundy, gold, legacy
  | "usa_bigstage"     // USA � electric blue, loud, confident
  | "belgium_golden"   // Belgium � golden generation, prestige
  | "croatia_warrior"  // Croatia � warrior red, intensity
  | "wales_dragon"     // Wales � dragon red, fire, underdog
  | "festival"         // Brazil � carnival green, yellow
  | "electric"         // Argentina � sky blue
  | "default";

type AtmoConfig = {
  overlay    : string;
  vignette   : string;
  pitchFog   : string;
  crowdTint  : string;
  sectionGlow: string;
  scarf1     : string;
  scarf2     : string;
  scarf3     : string;
  chant      : string;
  sectionName: string;
  baseBg     : string;
  headerBg   : string;
  panelBg    : string;
  borderCol  : string;
  dimText    : string;
  accentHex  : string;
  // Pitch lighting � makes each stadium feel visually different
  pitchInner : string;  // radialGradient center (under floodlights)
  pitchMid   : string;  // gradient mid
  pitchOuter : string;  // gradient edge (deepest shadow)
  ambientTint: string;  // permanent RGBA overlay on pitch surface
  // Nation cinema personality
  shakeOnConcede : boolean;  // Japan=false (composure), rest=true
  confettiOnGoal : boolean;  // Portugal=true (explosion), Germany/Japan=false
};

function getAtmosphereType(teamName: string): AtmosphereType {
  const n = teamName.toLowerCase();
  if (n.includes("spain"))                        return "spain_crimson";
  if (n.includes("japan"))                        return "japan_samurai";
  if (n.includes("england"))                      return "england_wembley";
  if (n.includes("germany"))                      return "germany_elite";
  if (n.includes("portugal"))                     return "portugal_royal";
  if (n.includes("united states")||n==="usa")     return "usa_bigstage";
  if (n.includes("belgium"))                      return "belgium_golden";
  if (n.includes("croatia"))                      return "croatia_warrior";
  if (n.includes("wales"))                        return "wales_dragon";
  if (n.includes("brazil"))                       return "festival";
  if (n.includes("argentina"))                    return "electric";
  return "default";
}

const ATMO: Record<AtmosphereType, AtmoConfig> = {

  // -- SPAIN: Passion � Control � Dominance � Royal -----------------------------
  // Crimson + Gold. Warm stadium, lit like Seville at night. Inevitable.
  spain_crimson: {
    overlay    : "rgba(170,21,27,0.040)",
    vignette   : "rgba(80,8,10,0.240)",
    pitchFog   : "rgba(170,21,27,0.020)",
    crowdTint  : "rgba(255,220,180,0.82)",
    sectionGlow: "rgba(170,21,27,0.18)",
    scarf1     : "#AA151B",
    scarf2     : "#F1BF00",
    scarf3     : "#F5F5F5",
    chant      : "OL� OL� OL�",
    sectionName: "LA ROJA END",
    baseBg     : "#0D0403",               // dark wine-ember
    headerBg   : "rgba(10,3,2,0.97)",
    panelBg    : "rgba(170,21,27,0.06)",
    borderCol  : "rgba(170,21,27,0.20)",
    dimText    : "rgba(255,215,180,0.30)",
    accentHex  : "#AA151B",
    pitchInner : "#130706",               // warm crimson-lit centre
    pitchMid   : "#0e0504",
    pitchOuter : "#080303",
    ambientTint: "rgba(170,21,27,0.06)",  // crimson wash over the grass
    shakeOnConcede : true,
    confettiOnGoal : false,
  },

  // -- JAPAN: Elegant � Disciplined � Precise � Samurai composure ---------------
  // Cool navy + pearl white. Silence amplified. One crimson cut.
  japan_samurai: {
    overlay    : "rgba(193,18,31,0.018)",
    vignette   : "rgba(8,17,29,0.320)",
    pitchFog   : "rgba(27,54,93,0.018)",
    crowdTint  : "rgba(235,240,250,0.82)",
    sectionGlow: "rgba(193,18,31,0.07)",
    scarf1     : "#1B365D",
    scarf2     : "#F7F7F7",
    scarf3     : "#C1121F",
    chant      : "???? ????",
    sectionName: "SAMURAI END",
    baseBg     : "#06090F",               // deep navy-black (coldest background)
    headerBg   : "rgba(4,7,14,0.97)",
    panelBg    : "rgba(27,54,93,0.08)",
    borderCol  : "rgba(193,18,31,0.16)",
    dimText    : "rgba(220,230,245,0.28)",
    accentHex  : "#C1121F",
    pitchInner : "#0a0e16",               // cool navy-lit pitch, almost clinical
    pitchMid   : "#080b12",
    pitchOuter : "#050709",
    ambientTint: "rgba(27,54,93,0.07)",   // cool navy tint over the grass
    shakeOnConcede : false,               // composure � never panic
    confettiOnGoal : false,               // discipline � no excess
  },

  // -- ENGLAND: Historic � Traditional � Wembley � Football Heritage -------------
  // White + Navy. Clean floodlights. No colour drama. History.
  england_wembley: {
    overlay    : "rgba(31,58,95,0.030)",
    vignette   : "rgba(10,18,35,0.240)",
    pitchFog   : "rgba(31,58,95,0.016)",
    crowdTint  : "rgba(240,242,248,0.84)",
    sectionGlow: "rgba(31,58,95,0.12)",
    scarf1     : "#F5F5F5",               // white � dominant
    scarf2     : "#1F3A5F",               // Wembley navy
    scarf3     : "#C1272D",               // St George red � accent only
    chant      : "IT'S COMING HOME",
    sectionName: "WEMBLEY END",
    baseBg     : "#060810",               // cool near-black navy
    headerBg   : "rgba(4,6,12,0.97)",
    panelBg    : "rgba(31,58,95,0.07)",
    borderCol  : "rgba(31,58,95,0.22)",
    dimText    : "rgba(210,220,235,0.28)",
    accentHex  : "#1F3A5F",
    pitchInner : "#0c1018",               // bright clean Wembley floodlight
    pitchMid   : "#090d14",
    pitchOuter : "#060810",
    ambientTint: "rgba(31,58,95,0.05)",   // barely-there navy blue
    shakeOnConcede : true,
    confettiOnGoal : false,
  },

  // -- GERMANY: Elite � Machine-like � Champions League night � Premium ----------
  // Champagne Gold + Graphite. Broadcast quality. Precision.
  germany_elite: {
    overlay    : "rgba(212,175,55,0.032)",
    vignette   : "rgba(15,14,8,0.300)",
    pitchFog   : "rgba(212,175,55,0.018)",
    crowdTint  : "rgba(240,235,210,0.80)",
    sectionGlow: "rgba(212,175,55,0.12)",
    scarf1     : "#D4AF37",
    scarf2     : "#F5F5F5",
    scarf3     : "#6B7280",
    chant      : "DEUTSCHLAND",
    sectionName: "NORDKURVE",
    baseBg     : "#09080B",               // graphite-black (warm, not blue)
    headerBg   : "rgba(7,6,4,0.97)",
    panelBg    : "rgba(212,175,55,0.06)",
    borderCol  : "rgba(212,175,55,0.20)",
    dimText    : "rgba(235,225,190,0.28)",
    accentHex  : "#D4AF37",
    pitchInner : "#131108",               // gold-lit pitch � CL floodlights
    pitchMid   : "#0e0d07",
    pitchOuter : "#080806",
    ambientTint: "rgba(212,175,55,0.07)", // gold floodlight wash � the key visual
    shakeOnConcede : true,
    confettiOnGoal : false,               // machine � execute, don't celebrate
  },

  // -- PORTUGAL: Royal � Passionate � Legacy � Drama -----------------------------
  // Emerald + Burgundy + Gold. History lives here. Pressure builds.
  portugal_royal: {
    overlay    : "rgba(4,106,56,0.032)",
    vignette   : "rgba(3,24,12,0.260)",
    pitchFog   : "rgba(4,106,56,0.020)",
    crowdTint  : "rgba(170,225,195,0.75)",
    sectionGlow: "rgba(4,106,56,0.14)",
    scarf1     : "#046A38",
    scarf2     : "#7A1F35",
    scarf3     : "#D4AF37",
    chant      : "PORTUGAL",
    sectionName: "SELEC��O END",
    baseBg     : "#050C07",               // deep emerald-black
    headerBg   : "rgba(3,8,4,0.97)",
    panelBg    : "rgba(4,106,56,0.06)",
    borderCol  : "rgba(4,106,56,0.20)",
    dimText    : "rgba(170,230,195,0.28)",
    accentHex  : "#046A38",
    pitchInner : "#081508",               // green + hint of burgundy
    pitchMid   : "#060e06",
    pitchOuter : "#040805",
    ambientTint: "rgba(4,106,56,0.09)",   // emerald glow � Est�dio da Luz green
    shakeOnConcede : true,
    confettiOnGoal : true,                // passion erupts every time
  },

  // -- USA: Big Game � Modern � Confident � Loud --------------------------------
  // Electric Blue + Crimson. Stadium rock. Maximum noise.
  usa_bigstage: {
    overlay    : "rgba(31,78,157,0.036)",
    vignette   : "rgba(5,10,25,0.240)",
    pitchFog   : "rgba(31,78,157,0.020)",
    crowdTint  : "rgba(190,215,255,0.82)",
    sectionGlow: "rgba(31,78,157,0.16)",
    scarf1     : "#1F4E9D",
    scarf2     : "#D7263D",
    scarf3     : "#F5F5F5",
    chant      : "U-S-A",
    sectionName: "SAM'S ARMY",
    baseBg     : "#060810",               // electric dark
    headerBg   : "rgba(3,5,14,0.97)",
    panelBg    : "rgba(31,78,157,0.07)",
    borderCol  : "rgba(31,78,157,0.22)",
    dimText    : "rgba(185,215,255,0.28)",
    accentHex  : "#1F4E9D",
    pitchInner : "#080e1a",               // electric blue stadium
    pitchMid   : "#060b14",
    pitchOuter : "#04070e",
    ambientTint: "rgba(31,78,157,0.08)",  // electric blue stadium glow
    shakeOnConcede : true,
    confettiOnGoal : false,
  },

  // -- BELGIUM: Golden Generation � Power � Prestige ----------------------------
  // Gold + Crimson + Black. Unfulfilled destiny.
  belgium_golden: {
    overlay    : "rgba(212,175,55,0.030)",
    vignette   : "rgba(10,6,2,0.280)",
    pitchFog   : "rgba(212,175,55,0.016)",
    crowdTint  : "rgba(245,230,180,0.80)",
    sectionGlow: "rgba(212,175,55,0.12)",
    scarf1     : "#D4AF37",
    scarf2     : "#C1121F",
    scarf3     : "#1A1A1A",
    chant      : "ALLEZ LES DIABLES",
    sectionName: "DEVIL'S END",
    baseBg     : "#0A0800",               // amber-black (warm, rich)
    headerBg   : "rgba(7,5,2,0.97)",
    panelBg    : "rgba(212,175,55,0.06)",
    borderCol  : "rgba(212,175,55,0.20)",
    dimText    : "rgba(240,225,185,0.28)",
    accentHex  : "#D4AF37",
    pitchInner : "#11100a",               // golden-lit pitch
    pitchMid   : "#0e0d08",
    pitchOuter : "#090808",
    ambientTint: "rgba(212,175,55,0.06)", // gold prestige wash
    shakeOnConcede : true,
    confettiOnGoal : false,
  },

  // -- CROATIA: Warrior � Intensity � Never Give Up -----------------------------
  // Crimson + White. Vatreni fire. Checks and intensity.
  croatia_warrior: {
    overlay    : "rgba(193,18,31,0.036)",
    vignette   : "rgba(60,5,8,0.240)",
    pitchFog   : "rgba(193,18,31,0.020)",
    crowdTint  : "rgba(255,230,230,0.82)",
    sectionGlow: "rgba(193,18,31,0.16)",
    scarf1     : "#C1121F",
    scarf2     : "#F5F5F5",
    scarf3     : "#D4AF37",
    chant      : "HRVATSKA",
    sectionName: "VATRENI BLOCK",
    baseBg     : "#0A0303",               // dark crimson-black
    headerBg   : "rgba(7,2,2,0.97)",
    panelBg    : "rgba(193,18,31,0.06)",
    borderCol  : "rgba(193,18,31,0.20)",
    dimText    : "rgba(255,210,210,0.28)",
    accentHex  : "#C1121F",
    pitchInner : "#110508",               // crimson warrior light
    pitchMid   : "#0d0406",
    pitchOuter : "#080303",
    ambientTint: "rgba(193,18,31,0.07)",
    shakeOnConcede : true,
    confettiOnGoal : false,
  },

  // -- WALES: Dragon � Fire � Underdog � Never Give Up --------------------------
  // Dragon Red. The pitch literally glows red. Fire and heat.
  wales_dragon: {
    overlay    : "rgba(193,18,31,0.040)",
    vignette   : "rgba(65,5,8,0.250)",
    pitchFog   : "rgba(193,18,31,0.022)",
    crowdTint  : "rgba(255,220,220,0.84)",
    sectionGlow: "rgba(193,18,31,0.20)",  // strongest glow � dragon breathes
    scarf1     : "#C1121F",
    scarf2     : "#F5F5F5",
    scarf3     : "#D4AF37",
    chant      : "YMA O HYD",
    sectionName: "DRAGON END",
    baseBg     : "#0A0404",               // ember-black � darkest red background
    headerBg   : "rgba(7,2,2,0.97)",
    panelBg    : "rgba(193,18,31,0.07)",
    borderCol  : "rgba(193,18,31,0.24)",
    dimText    : "rgba(255,210,210,0.28)",
    accentHex  : "#C1121F",
    pitchInner : "#140507",               // hottest red � dragon fire on grass
    pitchMid   : "#0f0405",
    pitchOuter : "#080303",
    ambientTint: "rgba(193,18,31,0.10)",  // strongest tint � unmistakable dragon red
    shakeOnConcede : true,
    confettiOnGoal : false,               // flares and border flash instead
  },

  // -- BRAZIL: Carnival � Festival Green � Yellow --------------------------------
  festival: {
    overlay    : "rgba(0,156,59,0.028)",
    vignette   : "rgba(0,60,25,0.180)",
    pitchFog   : "rgba(0,156,59,0.016)",
    crowdTint  : "rgba(210,240,90,0.75)",
    sectionGlow: "rgba(0,156,59,0.12)",
    scarf1     : "#009c3b",
    scarf2     : "#ffdf00",
    scarf3     : "#002776",
    chant      : "BRASIL BRASIL",
    sectionName: "CANARINHO END",
    baseBg     : "#040A04",               // dark carnival green-black
    headerBg   : "rgba(2,6,2,0.97)",
    panelBg    : "rgba(0,156,59,0.06)",
    borderCol  : "rgba(0,156,59,0.18)",
    dimText    : "rgba(190,255,210,0.28)",
    accentHex  : "#009c3b",
    pitchInner : "#081608",               // bright green carnival
    pitchMid   : "#061108",
    pitchOuter : "#040906",
    ambientTint: "rgba(0,156,59,0.07)",
    shakeOnConcede : true,
    confettiOnGoal : true,                // always carnival
  },

  // -- ARGENTINA: Electric Sky-Blue � Heroic White ------------------------------
  electric: {
    overlay    : "rgba(116,172,223,0.028)",
    vignette   : "rgba(30,60,110,0.180)",
    pitchFog   : "rgba(116,172,223,0.014)",
    crowdTint  : "rgba(155,205,250,0.80)",
    sectionGlow: "rgba(116,172,223,0.12)",
    scarf1     : "#74acdf",
    scarf2     : "#ffffff",
    scarf3     : "#4080C0",
    chant      : "VAMOS ARGENTINA",
    sectionName: "ALBICELESTE END",
    baseBg     : "#05080F",               // deep sky-black
    headerBg   : "rgba(3,5,12,0.97)",
    panelBg    : "rgba(116,172,223,0.06)",
    borderCol  : "rgba(116,172,223,0.18)",
    dimText    : "rgba(185,215,255,0.28)",
    accentHex  : "#74acdf",
    pitchInner : "#090e16",               // sky-blue electric
    pitchMid   : "#070b12",
    pitchOuter : "#05080d",
    ambientTint: "rgba(116,172,223,0.06)",
    shakeOnConcede : true,
    confettiOnGoal : false,
  },

  // -- Default ------------------------------------------------------------------
  default: {
    overlay    : "rgba(60,80,120,0.020)",
    vignette   : "rgba(20,30,60,0.140)",
    pitchFog   : "rgba(60,80,120,0.010)",
    crowdTint  : "rgba(200,210,230,0.65)",
    sectionGlow: "rgba(60,80,120,0.05)",
    scarf1     : "#4F8CFF",
    scarf2     : "#ffffff",
    scarf3     : "#4F8CFF",
    chant      : "COME ON",
    sectionName: "SUPPORTER END",
    baseBg     : "#070C18",
    headerBg   : "rgba(5,9,20,0.97)",
    panelBg    : "rgba(60,80,120,0.04)",
    borderCol  : "rgba(60,80,120,0.14)",
    dimText    : "rgba(200,210,230,0.28)",
    accentHex  : "#4F8CFF",
    pitchInner : "#0d1220",
    pitchMid   : "#090e18",
    pitchOuter : "#060a12",
    ambientTint: "transparent",
    shakeOnConcede : true,
    confettiOnGoal : false,
  },
};

// --- Emotion system -----------------------------------------------------------
type EmotionKey = "ELATION"|"DEVASTATION"|"TENSION"|"BELIEF"|"FRUSTRATION"|"ANTICIPATION"|"HOPE"|"ANGER"|"CHAOS"|"SILENCE";

const EMOTION_COLORS: Record<EmotionKey,string> = {
  ELATION     : "#FF9933",
  DEVASTATION : "#DC2626",
  TENSION     : "#8B5CF6",
  BELIEF      : "#34D399",
  FRUSTRATION : "#F97316",
  ANTICIPATION: "#56CCF2",
  HOPE        : "#4ADE80",
  ANGER       : "#F2C94C",
  CHAOS       : "#E8A850",
  SILENCE     : "#6B7280",
};

function emotionForEvent(et:string,mine:boolean,p:SupporterTeam):{state:EmotionKey;color:string}{
  if(p==="neutral") return{state:"CHAOS",color:EMOTION_COLORS.CHAOS};
  if(et==="goal")             return mine?{state:"ELATION",     color:EMOTION_COLORS.ELATION}     :{state:"DEVASTATION", color:EMOTION_COLORS.DEVASTATION};
  if(et==="substitution")     return mine?{state:"ANTICIPATION",color:EMOTION_COLORS.ANTICIPATION}:{state:"TENSION",     color:EMOTION_COLORS.TENSION};
  if(et==="Yellow Card"||et==="Red Card") return mine?{state:"ANGER",color:EMOTION_COLORS.ANGER}:{state:"BELIEF",color:EMOTION_COLORS.BELIEF};
  if(et==="foul")             return mine?{state:"FRUSTRATION", color:EMOTION_COLORS.FRUSTRATION} :{state:"HOPE",        color:EMOTION_COLORS.HOPE};
  return{state:"TENSION",color:EMOTION_COLORS.TENSION};
}

// --- Crowd narrative � documentary style, from inside the crowd ---------------
function crowdNarrative(et:string,mine:boolean,myTeam:string,opp:string,minute:number,p:SupporterTeam):string{
  if(p==="neutral"){
    if(et==="goal") return`The stadium splits in two.\n\nOne end detonates.\nThe other falls completely silent.\n\nTwo sets of supporters. The same moment.\nOpposite directions.`;
    return`${minute}'.\n\nThe crowd reads it before the commentators catch up.\nSomething has shifted.\nEveryone in here can feel it.`;
  }

  if(et==="goal"&&mine) return`The whole end detonates.\n\nArms. Noise. Strangers turning to strangers.\nVoices gone completely.\n\nFor a few seconds there is no thought.\nOnly feeling. Only this.\n\nThis is why you come.`;

  if(et==="goal"&&!mine) return`Silence.\n\nFor a second the stadium forgets how to breathe.\n\nThe goal lands like a punch.\nOne mistake. One moment.\nThe ${myTeam} end absorbs it slowly.\n\nBelief survives.\nBut only just.`;

  if(et==="substitution"&&mine) return`The board goes up.\n\nThe section watches.\nIs this the moment the game turns?\nOr is the manager managing?\n\nThe new player walks into the noise.\nThe crowd wills him forward.`;

  if(et==="substitution"&&!mine) return`${opp} make a change.\n\nRead that as desperation.\n${myTeam} forced them to react.\n\nThe crowd senses the shift.\nNow press. Now push.\nThe moment is there.`;

  if(et==="Red Card"&&mine) return`The card comes out.\n\nTen men.\n\nThe ${myTeam} section goes very quiet.\nEvery challenge from here is agony to watch.\nEvery loose ball matters twice as much.`;

  if(et==="Red Card"&&!mine) return`Red card.\n\nThe ${myTeam} end erupts.\n\nOne down. Numerical advantage.\n\nThe game has changed shape completely.\nThis is the moment to take it.`;

  if(et==="Yellow Card"&&mine) return`Caution shown against us.\n\nThe section bites its lip.\nOne more and we play with ten.\n\nEvery tackle from here carries weight.\nThe crowd holds its breath on every challenge.`;

  if(et==="Yellow Card"&&!mine) return`Card against them.\n\nThe ${myTeam} end feels it.\nAnother booking. Another warning.\n\nThey cannot afford to lose their discipline now.\nThe crowd knows it. The players know it.`;

  if(et==="foul"&&mine) return`A groan rolls across the ${myTeam} end.\n\nThe attack breaks down again.\nHands go to heads.\n\nThe crowd demands more.\nThe pressure is there � now convert it.\nFind the opening.`;

  if(et==="foul"&&!mine) return`The noise begins to rise.\n\nFree kick. Dangerous position.\nOne chance. One opening.\n\nEvery supporter in the ${myTeam} end rises.\nThe wall forms. The chant builds.\nThe supporters can feel momentum shifting.`;

  return`${minute}'.\n\nThe crowd felt it before anyone put it into words.\nBefore the replay. Before the commentary.\n\nThat's what being in here does.\nYou become part of the match, not just a witness to it.`;
}

// --- Granite replies � supporter companion ------------------------------------
const COMPANION_REPLIES: Record<string,(ev:PitchEvent,my:string,opp:string)=>string> = {
  devastated :(ev,m,o)=>`When ${o} scored, it wasn't just a goal � it silenced the entire ${m} section. The supporters had started to believe. That belief evaporated in about thirty seconds. This is what football does: it builds you up and takes you apart in the same breath. But supporters don't leave. They absorb it and they wait for the next moment.`,
  celebrating:(ev,m,o)=>`${m} supporters in that end will remember this for years. Not the tactics. Not the formation. The specific feeling of this goal going in � the roar, the strangers hugging, the voice lost in the noise. Football keeps supporters coming back because no other sport creates moments like this.`,
  stillwin   :(ev,m,o)=>`At ${ev.minute}', the mathematical reality is: there are still minutes left. I've seen supporters abandon belief right before their team equalises. The crowd energy matters � it absolutely affects the players on the pitch. If ${m} supporters keep the noise up, they're contributing to the result, not just watching it.`,
  mattered   :(ev,m,o)=>ev.eventType==="goal"?`This goal changed two things at once: the scoreline and the psychology. For ${m}, a goal against doesn't just add a number � it shifts what the next 30 minutes has to look like. Everything after this moment is a different match.`:`This moment at ${ev.minute}' mattered because football is built on turning points. Before this: one version of the match. After this: a completely different match with different pressures.`,
  changed    :(ev,m,o)=>`After ${ev.minute}', watch the pressing intensity, the body language on the touchline, and how quickly ${m} move the ball. Those are the real signals. The crowd can feel the shift before the statistics show it.`,
  crowd      :(ev,m,o)=>`The crowd reaction at ${ev.minute}' isn't just about this moment � it's the accumulated weight of everything before it. Every near-miss, every wrong call, every minute of tension had been building. That energy genuinely affects how players perform. Supporters aren't just watching. They're participating.`,
};

function generateReply(ev:PitchEvent,query:string,myTeam:string,opp:string):string{
  const q=query.toLowerCase();
  if(q.includes("devastat")||q.includes("gutted")||q.includes("silent"))     return COMPANION_REPLIES.devastated(ev,myTeam,opp);
  if(q.includes("celebrat")||q.includes("euphoria")||q.includes("eruption")) return COMPANION_REPLIES.celebrating(ev,myTeam,opp);
  if(q.includes("still win")||q.includes("come back")||q.includes("equalis")) return COMPANION_REPLIES.stillwin(ev,myTeam,opp);
  if(q.includes("why")||q.includes("matter")||q.includes("important"))       return COMPANION_REPLIES.mattered(ev,myTeam,opp);
  if(q.includes("after")||q.includes("change")||q.includes("different"))     return COMPANION_REPLIES.changed(ev,myTeam,opp);
  if(q.includes("crowd")||q.includes("fans")||q.includes("stand"))           return COMPANION_REPLIES.crowd(ev,myTeam,opp);
  return`At ${ev.minute}', the crowd felt this before the commentators put it into words. Every supporter in that end was processing this moment through their entire history with ${myTeam}. That's what makes supporter experience irreplaceable � the meaning isn't in the data, it's in the accumulation of every match before.`;
}

// --- Momentum -----------------------------------------------------------------
function buildMomentum(moments:KeyMoment[],myTeam:string,p:SupporterTeam){
  const curve:{minute:number;value:number}[]=[{minute:0,value:5}];
  let cur=5;
  for(const m of moments){
    const mine=p==="neutral"||m.team===myTeam;
    let d=0;
    if(m.type==="goal")          d=mine?2.8:-2.8;
    else if(m.type==="substitution") d=m.team===myTeam?0.5:-0.3;
    else if(m.type==="card")     d=m.team===myTeam?-0.7:0.7;
    cur=Math.max(0.5,Math.min(9.5,cur+d));
    curve.push({minute:m.minute,value:cur});
  }
  curve.push({minute:90,value:cur});
  return curve;
}

// --- Event builder ------------------------------------------------------------
function sh(s:number){const v=Math.sin(s*127.1+311.7)*43758.5453;return v-Math.floor(v);}
function zonePos(ev:RawEvent,idx:number,meta:MatchMeta){
  const s=idx*17+ev.minute*13+(ev.second??0)*7,r=(n:number)=>sh(s+n*2.618),ih=ev.team===meta.home.name;
  switch(ev.event_type){
    case "goal":         return ih?{x:89+r(1)*13,y:26+r(2)*16}:{x:3+r(1)*10,y:26+r(2)*16};
    case "substitution": return{x:42+r(1)*21,y:ih?1.2:66.8};
    default:             return{x:6+r(1)*93,y:3+r(2)*62};
  }
}

const C_GOAL="#FFD166",C_CARD_Y="#F2C94C",C_CARD_R="#DC2626",C_FOUL="#FF7F6A",C_SUB="#56CCF2",C_TEAM_A="#4F8CFF",C_TEAM_B="#FFB84D",C_GRANITE="#6366F1";

function evColor(et:string,tc:string):string{
  if(et==="goal")         return C_GOAL;
  if(et==="Yellow Card")  return C_CARD_Y;
  if(et==="Red Card")     return C_CARD_R;
  if(et==="foul")         return C_FOUL;
  if(et==="substitution") return C_SUB;
  return tc;
}

function buildEvents(raw:RawEvent[],moments:KeyMoment[],meta:MatchMeta):PitchEvent[]{
  return[...raw]
    .sort((a,b)=>(a.minute+(a.second??0)/60)-(b.minute+(b.second??0)/60))
    .map((e,i)=>{
      const evType=e.event_type as string;
      const km=moments.find(m=>Math.abs(m.minute-e.minute)<=1&&(m.team===e.team||(m.type==="goal"&&evType==="goal")||(m.type==="card"&&(evType==="Yellow Card"||evType==="Red Card"))));
      const tc=TEAM_REGISTRY[e.team]?.color??(e.team===meta.home.name?(meta.home.color??C_TEAM_A):(meta.away.color??C_TEAM_B));
      return{id:`pe-${i}`,eventType:e.event_type,minute:e.minute,second:e.second??0,team:e.team,player:e.player??e.player_in,playerIn:e.player_in,playerOut:e.player_out,isKey:e.event_type==="goal"||e.event_type==="Yellow Card"||!!km,keyMoment:km,color:evColor(e.event_type,tc),teamColor:tc,...zonePos(e,i,meta)};
    });
}

// --- Frame builders -----------------------------------------------------------
function buildGoalFrames(ev:PitchEvent,meta:MatchMeta):ReconFrame[]{
  const ih=ev.team===meta.home.name,tc=ev.teamColor,opp=ih?(meta.away.color??C_TEAM_B):(meta.home.color??C_TEAM_A);
  const scorer=ev.player??"Scorer",short=scorer.split(" ").slice(-1)[0];
  const teamU=(ih?meta.home.name:meta.away.name).toUpperCase(),min=ev.minute;
  const cx=(x:number)=>ih?x:105-x;
  const goalX=ih?104.4:0.6,atkX=ih?70:0,penX=ih?88.5:0,penLX=ih?97:8,txtX=ih?26:79;
  const S0={cx:cx(55),cy:30},S2={cx:cx(78),cy:22},S3={cx:cx(93),cy:31};
  const D1={cx:cx(60),cy:20},D2={cx:cx(60),cy:46};
  return[
    {id:0,label:"THE RUN",narration:`The crowd rises before the shot is even taken. ${short} finds the space � the whole ground can see what's coming.`,
      zones:[{id:"ch",x:ih?70:0,y:10,w:20,h:26,color:tc,opacity:0.16,label:"THE SPACE",labelX:ih?80:10,labelY:9}],
      markers:[{id:"s",label:short,cx:S0.cx,cy:S0.cy,color:tc,teamSide:"home"},{id:"d1",label:"",cx:D1.cx,cy:D1.cy,color:opp,teamSide:"away"},{id:"d2",label:"",cx:D2.cx,cy:D2.cy,color:opp,teamSide:"away"}],
      arrows:[{id:"r",x1:S0.cx,y1:S0.cy,x2:S2.cx,y2:S2.cy,type:"run",color:tc,curved:true,cpx:(S0.cx+S2.cx)/2,cpy:((S0.cy+S2.cy)/2)-8}],
      labels:[{id:"l1",x:txtX,y:63,text:"THE CHANNEL OPENS",size:"sm",color:"rgba(255,255,255,0.22)"}]},
    {id:1,label:"INTO THE BOX",narration:`${short} is in. Penalty area. The crowd has stopped breathing. Every supporter knows what comes next.`,
      zones:[{id:"a",x:atkX,y:0,w:35,h:68,color:tc,opacity:0.08},{id:"p",x:penX,y:13.84,w:16.5,h:40.32,color:tc,opacity:0.22,dashed:true,label:"THE BOX",labelX:penLX,labelY:11}],
      markers:[{id:"s",label:short,cx:S2.cx,cy:S2.cy,color:tc,teamSide:"home",highlight:true}],
      arrows:[{id:"r",x1:S2.cx,y1:S2.cy,x2:S3.cx,y2:S3.cy,type:"run",color:`${tc}80`,curved:false}],
      labels:[{id:"l1",x:txtX,y:63,text:"THE MOMENT IS HERE",size:"sm",color:`${tc}88`}]},
    {id:2,label:"GOAL",narration:ev.keyMoment?.context??`${short.toUpperCase()}. ${min}'. ${teamU}. The ground erupts. This is why they came. The scoreline has changed � everything has changed.`,
      zones:[{id:"p",x:penX,y:13.84,w:16.5,h:40.32,color:tc,opacity:0.32,dashed:true}],
      markers:[{id:"s",label:short,cx:S3.cx,cy:S3.cy,color:tc,teamSide:"home",highlight:true}],
      arrows:[{id:"sh",x1:S3.cx,y1:S3.cy,x2:goalX,y2:34,type:"shot",color:"rgba(255,255,255,0.82)",curved:true,cpx:(S3.cx+goalX)/2,cpy:28}],
      labels:[{id:"lg",x:txtX,y:32,text:"GOAL",size:"lg",color:C_GOAL},{id:"l1",x:txtX,y:62,text:`${teamU} SCORE`,size:"sm",color:`${C_GOAL}88`},{id:"l2",x:txtX,y:67,text:`${min}'`,size:"sm",color:"rgba(255,255,255,0.20)"}]},
  ];
}

function buildCardFrames(ev:PitchEvent,meta:MatchMeta):ReconFrame[]{
  const tc=ev.teamColor,ec=ev.color,player=ev.player??"Player",short=player.split(" ").slice(-1)[0];
  const zone=ev.x<35?"DEFENSIVE THIRD":ev.x>70?"ATTACKING THIRD":"MIDFIELD",zoneX=ev.x<35?0:ev.x>70?70:35,min=ev.minute;
  return[
    {id:0,label:"THE INCIDENT",narration:`The crowd sees it. ${short} commits. Eyes go to the referee. The pocket. The card comes out.`,
      zones:[{id:"z",x:zoneX,y:0,w:35,h:68,color:ec,opacity:0.08}],markers:[{id:"p",label:short,cx:ev.x,cy:ev.y,color:tc,teamSide:"home",highlight:true}],arrows:[],labels:[{id:"l1",x:52.5,y:62,text:`${zone} � ${min}'`,size:"sm",color:"rgba(255,255,255,0.22)"}]},
    {id:1,label:"YELLOW CARD",narration:`${short.toUpperCase()}. One more and they walk. Every supporter feels it � that caution changes how the next 30 minutes must be played.`,
      zones:[{id:"z",x:zoneX,y:0,w:35,h:68,color:ec,opacity:0.12}],markers:[{id:"p",label:short,cx:ev.x,cy:ev.y,color:tc,teamSide:"home",highlight:true}],arrows:[],
      labels:[{id:"lg",x:52.5,y:30,text:"YELLOW",size:"lg",color:ec},{id:"l1",x:52.5,y:62,text:`${player} � OFFICIAL CAUTION`,size:"sm",color:`${ec}BB`},{id:"l2",x:52.5,y:67,text:`${min}'`,size:"sm",color:"rgba(255,255,255,0.22)"}]},
    {id:2,label:"WHAT IT CHANGES",narration:`From here, every challenge from ${short} is watched by 50,000 pairs of eyes. One more mistake and the team plays with ten.`,
      zones:[],markers:[],arrows:[],
      labels:[{id:"l1",x:52.5,y:28,text:"ONE MORE CAUTION",size:"md",color:`${ec}CC`},{id:"l2",x:52.5,y:35,text:"= SENT OFF",size:"md",color:`${ec}77`},{id:"l3",x:52.5,y:62,text:`${player} ON THIN ICE`,size:"sm",color:"rgba(255,255,255,0.28)"}]},
  ];
}

function buildSubFrames(ev:PitchEvent,meta:MatchMeta):ReconFrame[]{
  const ih=ev.team===meta.home.name,tc=ev.teamColor;
  const teamU=(ih?meta.home.name:meta.away.name).toUpperCase();
  const inN=ev.playerIn??"Incoming",outN=ev.playerOut??"Outgoing";
  const inS=inN.split(" ").slice(-1)[0],outS=outN.split(" ").slice(-1)[0],min=ev.minute,tY=ih?3.5:64.5;
  return[
    {id:0,label:"THE CALL",narration:`${outS} is coming off. The crowd acknowledges the effort � and watches what the manager believes will change things.`,
      zones:[{id:"z",x:35,y:0,w:35,h:68,color:tc,opacity:0.08}],markers:[{id:"o",label:outS,cx:52.5,cy:34,color:tc,teamSide:"home"}],arrows:[],labels:[{id:"l1",x:52.5,y:62,text:`${outS} WITHDRAWN � ${min}'`,size:"sm",color:`${tc}70`}]},
    {id:1,label:"THE CHANGE",narration:`${outS} off. ${inS} on. Belief or desperation? The crowd watches the new player's first touch for the answer.`,
      zones:[{id:"t",x:40,y:ih?0:63.5,w:25,h:4.5,color:tc,opacity:0.12}],
      markers:[{id:"o",label:outS,cx:52.5-4,cy:tY,color:`${tc}66`,teamSide:"home"},{id:"i",label:inS,cx:52.5+4,cy:tY,color:tc,teamSide:"home"}],
      arrows:[{id:"oo",x1:52.5,y1:34,x2:52.5-4,y2:tY,type:"run",color:`${tc}66`,curved:false},{id:"ii",x1:52.5+4,y1:tY,x2:52.5,y2:34,type:"run",color:`${tc}70`,curved:false}],
      labels:[{id:"l1",x:52.5,y:62,text:`? ${inS}  ? ${outS}`,size:"sm",color:"rgba(255,255,255,0.35)"}]},
    {id:2,label:"NEW SHAPE",narration:`${inS} is on. The match has a new variable. ${teamU} supporters watch how the system adapts around the new player.`,
      zones:[{id:"z",x:35,y:0,w:35,h:68,color:tc,opacity:0.12}],markers:[{id:"i",label:inS,cx:52.5,cy:34,color:tc,teamSide:"home",highlight:true}],arrows:[],
      labels:[{id:"lg",x:52.5,y:30,text:inS,size:"lg",color:tc},{id:"l1",x:52.5,y:37,text:"INTRODUCED",size:"md",color:`${tc}80`},{id:"l2",x:52.5,y:67,text:`${teamU} � ${min}'`,size:"sm",color:"rgba(255,255,255,0.18)"}]},
  ];
}

function buildFoulFrames(ev:PitchEvent,meta:MatchMeta):ReconFrame[]{
  const tc=ev.teamColor,ec=ev.color,player=ev.player??"Player",short=player.split(" ").slice(-1)[0];
  const zone=ev.x<35?"DEFENSIVE THIRD":ev.x>70?"ATTACKING THIRD":"MIDFIELD",zoneX=ev.x<35?0:ev.x>70?70:35,min=ev.minute;
  return[
    {id:0,label:"THE CHALLENGE",narration:`${short} goes in. The crowd knows before the whistle � that challenge has trouble written all over it.`,
      zones:[{id:"z",x:zoneX,y:0,w:35,h:68,color:tc,opacity:0.08}],markers:[{id:"p",label:short,cx:ev.x,cy:ev.y,color:tc,teamSide:"home"}],arrows:[],labels:[{id:"l1",x:52.5,y:62,text:`${zone} � ${min}'`,size:"sm",color:`${ec}88`}]},
    {id:1,label:"FREE KICK",narration:`Whistle. Free kick awarded. The wall forms. From the stands you can see the geometry of the chance � better than the players can.`,
      zones:[{id:"z",x:zoneX,y:0,w:35,h:68,color:tc,opacity:0.10}],markers:[],arrows:[],
      labels:[{id:"l1",x:ev.x,y:ev.y-4,text:"FREE KICK",size:"md",color:"rgba(255,255,255,0.72)"},{id:"l2",x:52.5,y:67,text:`${zone} � ${min}'`,size:"sm",color:"rgba(255,255,255,0.18)"}]},
    {id:2,label:"PLAY RESUMES",narration:`The set piece is taken. The crowd exhales. The game moves on.`,
      zones:[],markers:[],arrows:[],labels:[{id:"l1",x:52.5,y:34,text:"PLAY RESUMES",size:"md",color:"rgba(255,255,255,0.22)"},{id:"l2",x:52.5,y:67,text:`${min}'`,size:"sm",color:"rgba(255,255,255,0.14)"}]},
  ];
}

function buildFrames(ev:PitchEvent,meta:MatchMeta):ReconFrame[]{
  switch(ev.eventType){
    case "goal":         return buildGoalFrames(ev,meta);
    case "Yellow Card":
    case "Red Card":     return buildCardFrames(ev,meta);
    case "substitution": return buildSubFrames(ev,meta);
    default:             return buildFoulFrames(ev,meta);
  }
}

// --- Player stats -------------------------------------------------------------
function computePlayer(name:string,all:PitchEvent[]){
  const mine=all.filter(e=>e.player===name||e.playerIn===name||e.playerOut===name);
  const goals=mine.filter(e=>e.eventType==="goal"&&e.player===name).length;
  const fouls=mine.filter(e=>e.eventType==="foul"&&e.player===name).length;
  const cards=mine.filter(e=>e.eventType==="Yellow Card"&&e.player===name).length;
  const keyInv=mine.filter(e=>e.isKey).length,late=mine.filter(e=>e.minute>=70).length;
  return{
    stats:{
      influence  :Math.min(94,Math.max(15,goals*38+keyInv*16+(mine.length>=3?18:8))),
      discipline :Math.min(88,Math.max(14,76-fouls*13-cards*22)),
      involvement:Math.min(92,Math.max(16,18+mine.length*15+keyInv*8)),
      pressure   :Math.min(90,Math.max(16,18+late*20+(cards>0?14:0)+goals*12)),
      impact     :Math.min(95,Math.max(14,goals*40+keyInv*22+(late>0?12:0))),
    },
    goals,totalEvents:mine.length,
  };
}

// --- Pitch markings -----------------------------------------------------------
const LS={stroke:"rgba(255,255,255,0.22)",strokeWidth:"0.38",fill:"none"} as const;
const AY1=(34-Math.sqrt(9.15**2-5.5**2)).toFixed(3);
const AY2=(34+Math.sqrt(9.15**2-5.5**2)).toFixed(3);

function PitchMarkings({ p1, p2, p3 }:{ p1:string; p2:string; p3:string }){
  return(
    <g>
      <defs>
        <radialGradient id="spg4" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={p1}/><stop offset="75%" stopColor={p2}/><stop offset="100%" stopColor={p3}/>
        </radialGradient>
        <filter id="sg4"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect x="0" y="0" width="105" height="68" fill="url(#spg4)" rx="1"/>
      {[0,1,2,3,4,5,6].map(i=><rect key={i} x={i*15} y="0" width="15" height="68" fill={i%2===0?"rgba(255,255,255,0.018)":"transparent"}/>)}
      <rect x="0" y="0" width="105" height="68" {...LS}/>
      <line x1="52.5" y1="0" x2="52.5" y2="68" {...LS}/><circle cx="52.5" cy="34" r="9.15" {...LS}/><circle cx="52.5" cy="34" r="0.4" fill="rgba(255,255,255,0.28)"/>
      <rect x="0" y="13.84" width="16.5" height="40.32" {...LS}/><rect x="0" y="24.84" width="5.5" height="18.32" {...LS}/>
      <path d={`M 16.5 ${AY1} A 9.15 9.15 0 0 1 16.5 ${AY2}`} {...LS}/><circle cx="11" cy="34" r="0.38" fill="rgba(255,255,255,0.28)"/>
      <rect x="-2.2" y="30.34" width="2.2" height="7.32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.32"/>
      <rect x="88.5" y="13.84" width="16.5" height="40.32" {...LS}/><rect x="99.5" y="24.84" width="5.5" height="18.32" {...LS}/>
      <path d={`M 88.5 ${AY1} A 9.15 9.15 0 0 0 88.5 ${AY2}`} {...LS}/><circle cx="94" cy="34" r="0.38" fill="rgba(255,255,255,0.28)"/>
      <rect x="105" y="30.34" width="2.2" height="7.32" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.32"/>
    </g>
  );
}

// --- Crowd silhouettes � subconscious, decorative -----------------------------
function CrowdStrip({pos,tint}:{pos:"top"|"bottom";tint:string}){
  const heads=Array.from({length:52},(_,i)=>({
    x:i*4.15+(i%2===0?0:2.1),
    y:Math.sin(i*1.73)*1.0+Math.cos(i*2.51)*0.6,
    r:1.7+(i%5)*0.18,
  }));
  const yBase=pos==="top"?-2.2:71;
  return(
    <g opacity={0.18} pointerEvents="none">
      {heads.map((h,i)=><ellipse key={i} cx={h.x} cy={yBase+h.y} rx={h.r} ry={h.r*1.15} fill={tint}/>)}
    </g>
  );
}

// --- Frame scene --------------------------------------------------------------
const MT={duration:0.42,ease:[0.16,1,0.3,1] as [number,number,number,number]};
const OT={duration:0.20};

function FrameScene({frames,frameIdx}:{frames:ReconFrame[];frameIdx:number}){
  const frame=frames[frameIdx];
  const allM=useMemo(()=>{const s=new Set<string>(),a:MarkerDef[]=[];frames.forEach(f=>f.markers.forEach(m=>{if(!s.has(m.id)){s.add(m.id);a.push({...m});}}));return a;},[frames]);
  const fMap=useMemo(()=>{const m=new Map<string,MarkerDef>();frame?.markers.forEach(d=>m.set(d.id,d));return m;},[frame]);
  // No pitch empty state decorative circles � just text
  if(!frame) return(
    <text x="52.5" y="34" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.06)" fontSize="3.0" fontFamily="'Barlow Condensed',sans-serif" letterSpacing="0.30em">SELECT A MOMENT</text>
  );
  const FS={fontFamily:"'Barlow Condensed',sans-serif"};
  return(
    <g>
      <AnimatePresence mode="sync">
        {frame.zones.map(z=>(
          <motion.g key={`z-${frameIdx}-${z.id}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.22}}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={z.rx??0} fill={z.color} fillOpacity={z.opacity} stroke={z.dashed?z.color:"none"} strokeWidth={z.dashed?0.5:0} strokeDasharray={z.dashed?"2 0.9":undefined} strokeOpacity={0.55}/>
            {z.label&&<text x={z.labelX??z.x+z.w/2} y={z.labelY??z.y+5} textAnchor="middle" fill={z.color} fillOpacity={0.6} fontSize="3.4" fontWeight="800" {...FS} letterSpacing="0.18em">{z.label}</text>}
          </motion.g>
        ))}
      </AnimatePresence>
      {allM.map(base=>{
        const curr=fMap.get(base.id),tCx=curr?.cx??base.cx,tCy=curr?.cy??base.cy;
        const vis=!!curr,hl=curr?.highlight??false,label=curr?.label??base.label,color=curr?.color??base.color,r=hl?4.4:3.2;
        return(
          <g key={base.id}>
            {hl&&<motion.circle animate={{cx:tCx,cy:tCy,opacity:vis?1:0}} initial={{cx:base.cx,cy:base.cy,opacity:0}} transition={{cx:MT,cy:MT,opacity:OT}} r="8.5" fill={`${color}18`} stroke={color} strokeWidth="0.6"/>}
            <motion.circle animate={{cx:tCx,cy:tCy,opacity:vis?1:0}} initial={{cx:base.cx,cy:base.cy,opacity:0}} transition={{cx:MT,cy:MT,opacity:OT}} r={r} fill={`${color}45`} stroke={color} strokeWidth="0.75"/>
            <motion.circle animate={{cx:tCx,cy:tCy,opacity:vis?1:0}} initial={{cx:base.cx,cy:base.cy,opacity:0}} transition={{cx:MT,cy:MT,opacity:OT}} r={r*0.4} fill={color}/>
            {label&&<motion.text animate={{x:tCx,y:tCy-(hl?8:5.5),opacity:vis?0.9:0}} initial={{x:base.cx,y:base.cy-5.5,opacity:0}} transition={{x:MT,y:MT,opacity:OT}} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={hl?"3.6":"2.7"} fontWeight={hl?"800":"600"} {...FS}>{label}</motion.text>}
          </g>
        );
      })}
      <AnimatePresence mode="sync">
        {frame.arrows.map(a=>{
          const d=a.curved?`M ${a.x1} ${a.y1} Q ${a.cpx??((a.x1+a.x2)/2)} ${a.cpy??((a.y1+a.y2)/2)} ${a.x2} ${a.y2}`:`M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}`;
          return<motion.path key={`a-${frameIdx}-${a.id}`} d={d} fill="none" stroke={a.color} strokeWidth={a.type==="shot"?1.2:0.9} strokeDasharray={a.type==="press"?"1.5 1":undefined} strokeLinecap="round" initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} exit={{opacity:0,pathLength:0}} transition={{pathLength:{duration:a.type==="shot"?0.38:0.28,ease:"easeOut"},opacity:{duration:0.2}}}/>;
        })}
      </AnimatePresence>
      <AnimatePresence mode="sync">
        {frame.labels.map(l=>{
          const fs=l.size==="lg"?17:l.size==="md"?6.5:3.2;
          return<motion.text key={`l-${frameIdx}-${l.id}`} x={l.x} y={l.y} textAnchor="middle" fill={l.color??"rgba(255,255,255,0.6)"} fontSize={fs} fontWeight={l.size==="lg"?"900":"700"} fontFamily="'Barlow Condensed',sans-serif" letterSpacing={l.size==="sm"?"0.14em":l.size==="lg"?"0em":"0.07em"} filter={l.size==="lg"?"url(#sg4)":undefined} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.22}}>{l.text}</motion.text>;
        })}
      </AnimatePresence>
    </g>
  );
}

// --- Frame controls -----------------------------------------------------------
function FrameControls({frames,frameIdx,isPlaying,onPrev,onNext,onPlayPause,onFrameClick,tc}:{
  frames:ReconFrame[];frameIdx:number;isPlaying:boolean;onPrev:()=>void;onNext:()=>void;onPlayPause:()=>void;onFrameClick:(i:number)=>void;tc:string;
}){
  const frame=frames[frameIdx],canP=frameIdx>0,canN=frameIdx<frames.length-1;
  return(
    <div style={{height:38,flexShrink:0,display:"flex",alignItems:"center",padding:"0 14px",gap:12,borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(5,8,16,0.96)"}}>
      <div style={{flex:1}}>
        <AnimatePresence mode="wait">
          <motion.div key={`fc-${frameIdx}`} initial={{opacity:0,y:3}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.16}}>
            <div style={{fontSize:"0.56rem",letterSpacing:"0.32em",color:"rgba(255,255,255,0.14)",marginBottom:1}}>PHASE {frames.length>0?frameIdx+1:"-"}/{frames.length}</div>
            <div style={{fontSize:"1.01rem",fontWeight:700,color:tc,letterSpacing:"0.06em"}}>{frame?.label??"�"}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div style={{display:"flex",gap:4}}>
        {frames.map((_,i)=>(
          <motion.button key={i} onClick={()=>onFrameClick(i)} animate={{width:i===frameIdx?18:5,background:i===frameIdx?tc:"rgba(255,255,255,0.15)"}} transition={{duration:0.2}} style={{height:4,borderRadius:2,border:"none",cursor:"pointer",padding:0}}/>
        ))}
      </div>
      <div style={{display:"flex",gap:0}}>
        <button onClick={onPrev} disabled={!canP} style={{background:"none",border:"none",padding:"0 8px",cursor:canP?"pointer":"default",color:canP?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.1)",fontSize:"1.3rem"}}>�</button>
        <button onClick={onPlayPause} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:2,cursor:"pointer",color:"rgba(255,255,255,0.55)",fontFamily:"inherit",fontSize:"0.99rem",padding:"4px 12px",minWidth:48}}>{isPlaying?"?":"?"}</button>
        <button onClick={onNext} disabled={!canN} style={{background:"none",border:"none",padding:"0 8px",cursor:canN?"pointer":"default",color:canN?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.1)",fontSize:"1.3rem"}}>�</button>
      </div>
    </div>
  );
}

// --- Momentum line ------------------------------------------------------------
function MomentumLine({curve,color,label}:{curve:{minute:number;value:number}[];color:string;label:string}){
  const W=188,H=26,PAD=3,plotW=W-PAD*2,plotH=H-PAD*2;
  const pts=curve.map(p=>({x:PAD+(p.minute/90)*plotW,y:PAD+(1-p.value/10)*plotH}));
  const pathD=pts.length>0?`M ${pts[0].x} ${pts[0].y} `+pts.slice(1).map(p=>`L ${p.x} ${p.y}`).join(" "):"";
  const fillD=pts.length>0?`${pathD} L ${pts[pts.length-1].x} ${PAD+plotH} L ${pts[0].x} ${PAD+plotH} Z`:"";
  const sl=label.replace(/\s/g,"");
  return(
    <div style={{marginBottom:5}}>
      <div style={{fontSize:"0.62rem",letterSpacing:"0.18em",color:"rgba(255,255,255,0.20)",marginBottom:3}}>{label}</div>
      <svg width={W} height={H} style={{display:"block"}}>
        <defs><linearGradient id={`ml-${sl}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={`${color}28`}/><stop offset="100%" stopColor={`${color}03`}/></linearGradient></defs>
        <line x1={PAD} y1={PAD+plotH/2} x2={PAD+plotW} y2={PAD+plotH/2} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" strokeDasharray="3 4"/>
        {fillD&&<path d={fillD} fill={`url(#ml-${sl})`}/>}
        {pathD&&<path d={pathD} fill="none" stroke={`${color}99`} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>}
      </svg>
    </div>
  );
}

// --- Radar --------------------------------------------------------------------
function RadarChart({values,color}:{values:number[];color:string}){
  const cx=64,cy=64,maxR=46,labels=["INF","DIS","INV","PRS","IMP"];
  const ang=(i:number)=>-Math.PI/2+(i*Math.PI*2)/5;
  const pt=(v:number,i:number):[number,number]=>{const a=ang(i),r=(v/100)*maxR;return[cx+r*Math.cos(a),cy+r*Math.sin(a)];};
  const ringPath=(f:number)=>{const p=labels.map((_,i)=>{const a=ang(i),r=maxR*f;return`${cx+r*Math.cos(a)} ${cy+r*Math.sin(a)}`;});return`M ${p.join(" L ")} Z`;};
  const safeVals=values.map(v=>Math.max(v,8));
  const dp=`M ${safeVals.map((v,i)=>pt(v,i).join(" ")).join(" L ")} Z`,ak=safeVals.join(",");
  return(
    <svg width="128" height="128" viewBox="0 0 128 128">
      {[0.25,0.5,0.75,1].map(f=><path key={f} d={ringPath(f)} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.8"/>)}
      {labels.map((_,i)=>{const[x2,y2]=pt(100,i);return<line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="rgba(255,255,255,0.10)" strokeWidth="0.8"/>;} )}
      <motion.path key={ak} d={dp} fill={`${color}40`} stroke={color} strokeWidth="2" initial={{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:1}} transition={{pathLength:{duration:0.55,ease:"easeOut"},opacity:{duration:0.2}}}/>
      {safeVals.map((v,i)=>{const[x,y]=pt(v,i);return<motion.circle key={`${ak}-${i}`} cx={x} cy={y} r="3" fill={color} initial={{opacity:0,scale:0}} animate={{opacity:1,scale:1}} transition={{delay:0.3+i*0.04,duration:0.15}}/>;} )}
      {labels.map((l,i)=>{const[x,y]=pt(120,i);return<text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.45)" fontSize="7" fontWeight="700" fontFamily="'Barlow Condensed',sans-serif">{l}</text>;} )}
    </svg>
  );
}

// --- IBM Granite � Supporter Companion ---------------------------------------
type GMsg={id:string;role:"user"|"assistant";text:string};
const QUICK_Q=[
  {id:"devastated",  label:"Why are we devastated?"},
  {id:"celebrating", label:"Why are we celebrating?"},
  {id:"stillwin",    label:"Can we still win?"},
  {id:"mattered",    label:"Why did this matter?"},
  {id:"changed",     label:"What changed after?"},
  {id:"crowd",       label:"What was the crowd feeling?"},
];

function GraniteCompanion({event,myTeamName,oppName,tc,isMyTeamEvent}:{event?:PitchEvent;myTeamName:string;oppName:string;tc:string;isMyTeamEvent:boolean}){
  const[msgs,setMsgs]=useState<GMsg[]>([]);
  const[input,setInput]=useState("");
  const[thinking,setThinking]=useState(false);
  const scrollRef=useRef<HTMLDivElement|null>(null);
  const addReply=(t:string)=>setMsgs(p=>[...p,{id:Date.now().toString(),role:"assistant",text:t}]);

  useEffect(()=>{
    if(event){
      const isGoal=event.eventType==="goal";
      const opener=isGoal&&isMyTeamEvent
        ?`${event.minute}' � ${myTeamName} score. The section erupts. What do you want to understand about this moment?`
        :isGoal&&!isMyTeamEvent
        ?`${event.minute}' � ${oppName} score. Silence in the ${myTeamName} end. Ask me what this moment meant.`
        :event.eventType==="substitution"
        ?`${event.minute}' � the manager makes a move. Ask me what this means from the stands.`
        :`${event.minute}' selected. Ask me what this meant from inside the crowd.`;
      setMsgs([{id:"init",role:"assistant",text:opener}]);
    }else{
      setMsgs([{id:"init",role:"assistant",text:`You're watching ${myTeamName} through the eyes of a supporter. Ask me anything � what a moment meant, why the crowd reacted, whether there's still hope. I'm the knowledgeable fan sitting next to you.`}]);
    }
    setInput("");
  },[event?.id,myTeamName]); // eslint-disable-line

  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight;},[msgs,thinking]);

  const handleQuick=(key:string)=>{
    const label=QUICK_Q.find(q=>q.id===key)?.label??key;
    setMsgs(p=>[...p,{id:Date.now().toString(),role:"user",text:label}]);
    setThinking(true);
    setTimeout(()=>{
      if(event) addReply(COMPANION_REPLIES[key]?.(event,myTeamName,oppName)??"");
      else addReply(`Select a moment from the left panel first � then ask me what it meant from the stands.`);
      setThinking(false);
    },520+Math.random()*280);
  };

  const handleSend=()=>{
    const q=input.trim();if(!q)return;
    setInput("");setMsgs(p=>[...p,{id:Date.now().toString(),role:"user",text:q}]);setThinking(true);
    setTimeout(()=>{addReply(event?generateReply(event,q,myTeamName,oppName):`Select a moment from the left � then ask me about it.`);setThinking(false);},600+Math.random()*340);
  };

  const visibleQ=QUICK_Q.filter(q=>{
    if(!event) return["crowd","mattered","stillwin"].includes(q.id);
    if(event.eventType==="goal"&&isMyTeamEvent)  return["celebrating","mattered","changed","crowd"].includes(q.id);
    if(event.eventType==="goal"&&!isMyTeamEvent) return["devastated","stillwin","mattered","crowd"].includes(q.id);
    return["mattered","changed","crowd","stillwin"].includes(q.id);
  });

  return(
    <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"4px 16px",display:"flex",flexDirection:"column",gap:8,scrollbarWidth:"none"}}>
        <AnimatePresence initial={false}>
          {msgs.map(m=>(
            <motion.div key={m.id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:0.18}}
              style={{padding:m.role==="assistant"?"10px 12px":"4px 2px",background:m.role==="assistant"?"rgba(255,255,255,0.04)":"transparent",borderLeft:m.role==="assistant"?`2px solid ${tc}50`:"none",borderRadius:m.role==="assistant"?"0 3px 3px 0":0}}>
              <p style={{fontSize:"0.7rem",lineHeight:1.72,color:m.role==="assistant"?"rgba(255,255,255,0.62)":"rgba(255,255,255,0.40)",margin:0,fontWeight:300,letterSpacing:"0.02em"}}>{m.text}</p>
            </motion.div>
          ))}
          {thinking&&(
            <motion.div key="t" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{padding:"9px 12px",background:"rgba(255,255,255,0.03)",borderLeft:`2px solid ${C_GRANITE}38`,borderRadius:"0 3px 3px 0"}}>
              <motion.span animate={{opacity:[0.3,0.8,0.3]}} transition={{duration:1.1,repeat:Infinity}} style={{fontSize:"0.57rem",color:`${C_GRANITE}CC`,letterSpacing:"0.16em"}}>THINKING�</motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div style={{flexShrink:0,padding:"7px 16px 5px",display:"flex",flexWrap:"wrap",gap:4}}>
        {visibleQ.map(q=>(
          <button key={q.id} onClick={()=>handleQuick(q.id)}
            style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:3,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit",fontSize:"0.55rem",letterSpacing:"0.08em",color:"rgba(255,255,255,0.36)",transition:"all 0.13s"}}
            onMouseEnter={e=>{e.currentTarget.style.background=`${C_GRANITE}1E`;e.currentTarget.style.borderColor=`${C_GRANITE}3C`;e.currentTarget.style.color="rgba(255,255,255,0.68)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.36)";}}>
            {q.label}
          </button>
        ))}
      </div>
      <div style={{flexShrink:0,padding:"4px 16px 13px",display:"flex",gap:7}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleSend();}}
          placeholder="What did this moment mean?"
          style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:3,padding:"7px 11px",color:"rgba(255,255,255,0.62)",fontFamily:"inherit",fontSize:"0.80rem",outline:"none",letterSpacing:"0.02em"}}/>
        <button onClick={handleSend}
          style={{background:`${C_GRANITE}28`,border:`1px solid ${C_GRANITE}40`,borderRadius:3,padding:"7px 13px",cursor:"pointer",fontFamily:"inherit",fontSize:"0.57rem",letterSpacing:"0.14em",color:`${C_GRANITE}EE`,transition:"background 0.13s"}}
          onMouseEnter={e=>{e.currentTarget.style.background=`${C_GRANITE}3C`;}}
          onMouseLeave={e=>{e.currentTarget.style.background=`${C_GRANITE}28`;}}>
          ASK
        </button>
      </div>
    </div>
  );
}

// --- Props --------------------------------------------------------------------
interface Props {
  match    : MatchMeta;
  team     : SupporterTeam;
  narrative: MatchNarrative;
  rawEvents: RawEvent[];
  onBack   : () => void;
}


// --- Particle Types -----------------------------------------------------------
interface Particle { id:number; x:number; y:number; vx:number; vy:number; color:string; size:number; life:number; }

// --- Floating Event Card ------------------------------------------------------
function FloatingEventCard({ event, frames, frameIdx, emotion, acRgb, acHex }:
  { event:PitchEvent; frames:ReconFrame[]; frameIdx:number; emotion:{state:EmotionKey;color:string}|null; acRgb:string; acHex:string; }) {
  const label = frames[frameIdx]?.label ?? event.eventType.toUpperCase();
  const narr  = frames[frameIdx]?.narration ?? "";
  const col   = emotion?.color ?? acHex;
  const rgb   = (h:string) => { const c=(h.replace("#","")+"000000").slice(0,6); return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`; };
  const eRgb  = rgb(col);
  return (
    <div style={{ position:"absolute", bottom:24, left:8, width:196, background:"rgba(4,7,14,0.92)",
      backdropFilter:"blur(14px)", border:`1px solid rgba(${acRgb},0.18)`,
      borderLeft:`3px solid ${col}`, borderRadius:4, overflow:"hidden", zIndex:15 }}>
      <div style={{ padding:"5px 10px", background:`rgba(${eRgb},0.14)`, display:"flex", alignItems:"center", gap:6 }}>
        <div style={{ width:5, height:5, borderRadius:"50%", background:col, flexShrink:0 }}/>
        <span style={{ fontSize:"0.62rem", letterSpacing:"0.20em", color:col, fontWeight:700 }}>
          {emotion?.state ?? event.eventType.toUpperCase()} {event.minute}'
        </span>
      </div>
      <div style={{ padding:"7px 10px 4px" }}>
        <div style={{ fontSize:"1.01rem", fontWeight:900, letterSpacing:"0.03em", color:"rgba(255,255,255,0.82)", marginBottom:3 }}>{label}</div>
        <p style={{ fontSize:"0.57rem", lineHeight:1.60, color:"rgba(255,255,255,0.38)", margin:0, display:"-webkit-box" as any,
          WebkitLineClamp:3, WebkitBoxOrient:"vertical" as any, overflow:"hidden" }}>{narr}</p>
      </div>
      <div style={{ padding:"4px 10px 7px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize:"0.41rem", letterSpacing:"0.20em", color:`rgba(${acRgb},0.70)`, marginBottom:2, fontWeight:700 }}>FROM THE STANDS</div>
        <p style={{ fontSize:"0.62rem", lineHeight:1.56, color:"rgba(255,255,255,0.30)", margin:0, fontStyle:"italic",
          display:"-webkit-box" as any, WebkitLineClamp:3, WebkitBoxOrient:"vertical" as any, overflow:"hidden" }}>
          {frames[frameIdx]?.narration ?? ""}
        </p>
      </div>
    </div>
  );
}

// --- LED Modes ----------------------------------------------------------------
type LEDMode = "calm"|"excited"|"devastated"|"var_pulse"|"silent"|"hope"|"explode";

// --- Cinema Config ------------------------------------------------------------
interface CinemaLine {
  text: string;
  size: "tiny"|"small"|"medium"|"large"|"massive";
  color?: string;
  delay: number;
}

interface CinemaConfig {
  lines: CinemaLine[];
  bg: string;
  duration: number;
  ledMode: LEDMode;
  cameraZoom: number;
  cameraY: number;
  pitchLight: string;
}

function buildCinema(reaction:ReactionType, minute:number, scorer:string|null, isMyTeam:boolean, oppName:string, acHex:string): CinemaConfig {
  const hex2rgb = (h:string) => { const c=(h.replace("#","")+"000000").slice(0,6); return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`; };
  const acRgb = hex2rgb(acHex);
  switch(reaction) {
    case "goal_for_90plus": return {
      lines:[
        {text:"NO WAY.",        size:"massive", color:acHex,     delay:200},
        {text:"THEY DID IT.",   size:"large",   color:"#ffffff", delay:900},
        {text:`${minute}'`,    size:"small",   color:`rgba(${acRgb},0.60)`, delay:1800},
      ],
      bg:`radial-gradient(ellipse 80% 60% at 50% 45%, rgba(${acRgb},0.60) 0%, rgba(0,0,0,0.96) 65%)`,
      duration:4400, ledMode:"explode", cameraZoom:1.12, cameraY:-4,
      pitchLight:`rgba(${acRgb},0.35)`,
    };
    case "goal_for_winner": return {
      lines:[
        {text:"YES.",           size:"massive", color:acHex,     delay:200},
        {text:"THEY SCORED.",   size:"large",   color:"#ffffff", delay:900},
        {text:`${minute}'`,    size:"small",   color:`rgba(${acRgb},0.60)`, delay:1700},
      ],
      bg:`radial-gradient(ellipse 70% 55% at 50% 45%, rgba(${acRgb},0.50) 0%, rgba(0,0,0,0.94) 60%)`,
      duration:3800, ledMode:"explode", cameraZoom:1.09, cameraY:-3,
      pitchLight:`rgba(${acRgb},0.28)`,
    };
    case "goal_for": return {
      lines:[
        {text:"YES.",           size:"massive", color:acHex,     delay:200},
        {text:"THERE IT IS.",   size:"medium",  color:"rgba(255,255,255,0.80)", delay:1000},
        {text:`${minute}'`,    size:"small",   color:`rgba(${acRgb},0.55)`, delay:1800},
      ],
      bg:`radial-gradient(ellipse 65% 50% at 50% 45%, rgba(${acRgb},0.42) 0%, rgba(0,0,0,0.92) 58%)`,
      duration:3400, ledMode:"excited", cameraZoom:1.07, cameraY:-3,
      pitchLight:`rgba(${acRgb},0.22)`,
    };
    case "goal_against": return {
      lines:[
        {text:"SILENCE.",       size:"massive", color:"#DC2626", delay:700},
        {text:`${oppName} score.`, size:"medium", color:"rgba(255,255,255,0.50)", delay:1600},
        {text:"Nobody breathes.", size:"small", color:"rgba(255,255,255,0.30)", delay:2400},
        {text:`${minute}'`,    size:"tiny",    color:"rgba(200,50,50,0.50)",   delay:3100},
      ],
      bg:`radial-gradient(ellipse 70% 55% at 50% 45%, rgba(139,0,0,0.50) 0%, rgba(0,0,0,0.96) 65%)`,
      duration:4400, ledMode:"devastated", cameraZoom:1.06, cameraY:2,
      pitchLight:"rgba(100,0,0,0.28)",
    };
    case "red_card": return {
      lines:[
        {text:"DOWN TO TEN.",   size:"large",   color:"#ff2244", delay:400},
        {text:"Everything changes.", size:"medium", color:"rgba(255,255,255,0.50)", delay:1400},
        {text:`${minute}'`,    size:"tiny",    color:"rgba(255,34,68,0.50)",   delay:2200},
      ],
      bg:`radial-gradient(ellipse 60% 50% at 50% 40%, rgba(180,0,20,0.45) 0%, rgba(0,0,0,0.94) 60%)`,
      duration:3400, ledMode:"devastated", cameraZoom:1.05, cameraY:0,
      pitchLight:"rgba(180,0,20,0.22)",
    };
    case "penalty": return {
      lines:[
        {text:"PENALTY.",       size:"massive", color:"#CC44FF", delay:300},
        {text:"One player.",    size:"medium",  color:"rgba(255,255,255,0.55)", delay:1200},
        {text:"One chance.",    size:"medium",  color:"rgba(255,255,255,0.40)", delay:1900},
        {text:`${minute}'`,    size:"tiny",    color:"rgba(200,68,255,0.55)", delay:2600},
      ],
      bg:`radial-gradient(ellipse 65% 55% at 50% 45%, rgba(120,30,200,0.50) 0%, rgba(0,0,0,0.95) 62%)`,
      duration:3800, ledMode:"var_pulse", cameraZoom:1.08, cameraY:-2,
      pitchLight:"rgba(120,30,200,0.25)",
    };
    default: return {
      lines:[{text:`${minute}'`, size:"medium", color:"rgba(255,255,255,0.55)", delay:300}],
      bg:"rgba(0,0,0,0.70)",
      duration:2200, ledMode:"calm", cameraZoom:1.0, cameraY:0,
      pitchLight:"transparent",
    };
  }
}

// --- VAR / Near Miss cinema (non-reaction events) ----------------------------
function buildEventCinema(eventType:string, minute:number, acHex:string): CinemaConfig|null {
  switch(eventType) {
    case "var_decision": return {
      lines:[
        {text:"WAIT.",          size:"massive", color:"#FFD700", delay:300},
        {text:"Nobody knows.",  size:"medium",  color:"rgba(255,255,255,0.55)", delay:1300},
        {text:"VAR REVIEW",     size:"small",   color:"rgba(255,215,0,0.65)",   delay:2200},
        {text:`${minute}'`,    size:"tiny",    color:"rgba(255,215,0,0.35)",   delay:2900},
      ],
      bg:`radial-gradient(ellipse 70% 55% at 50% 45%, rgba(80,60,0,0.60) 0%, rgba(0,0,0,0.96) 65%)`,
      duration:4000, ledMode:"var_pulse", cameraZoom:1.04, cameraY:1,
      pitchLight:"rgba(100,80,0,0.22)",
    };
    case "shot_on_target": return {
      lines:[
        {text:"SO CLOSE.",      size:"massive", color:"#ffffff", delay:300},
        {text:"One inch.",      size:"medium",  color:"rgba(255,255,255,0.55)", delay:1100},
        {text:"One second.",    size:"medium",  color:"rgba(255,255,255,0.40)", delay:1800},
        {text:"One chance.",    size:"small",   color:"rgba(255,255,255,0.28)", delay:2500},
        {text:`${minute}'`,    size:"tiny",    color:"rgba(255,255,255,0.30)", delay:3100},
      ],
      bg:`radial-gradient(ellipse 65% 50% at 50% 45%, rgba(20,20,20,0.70) 0%, rgba(0,0,0,0.95) 60%)`,
      duration:3800, ledMode:"hope", cameraZoom:1.06, cameraY:-2,
      pitchLight:"rgba(255,255,255,0.06)",
    };
    default: return null;
  }
}

// --- EmotionCinema Component --------------------------------------------------
function EmotionCinema({ config, onDismiss }:{ config:CinemaConfig; onDismiss:()=>void }) {
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    const timers = config.lines.map((line, i) =>
      setTimeout(() => setVisibleCount(c => Math.max(c, i+1)), line.delay)
    );
    const auto = setTimeout(onDismiss, config.duration);
    return () => { timers.forEach(clearTimeout); clearTimeout(auto); };
  }, [config]);

  const sizeMap: Record<CinemaLine["size"],{fs:string;fw:number;ls:string;mb:number}> = {
    massive: { fs:"3.20rem", fw:900, ls:"0.08em", mb:20 },
    large:   { fs:"1.55rem", fw:800, ls:"0.12em", mb:16 },
    medium:  { fs:"0.72rem", fw:600, ls:"0.20em", mb:12 },
    small:   { fs:"0.50rem", fw:500, ls:"0.24em", mb:8  },
    tiny:    { fs:"0.36rem", fw:400, ls:"0.20em", mb:0  },
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.35}}
      onClick={onDismiss} style={{ position:"absolute", inset:0, zIndex:22, cursor:"pointer",
        background:config.bg, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", padding:"0 24px" }}>
      <AnimatePresence>
        {config.lines.slice(0, visibleCount).map((line, i) => {
          const s = sizeMap[line.size];
          return (
            <motion.div key={i} initial={{opacity:0, y:14}} animate={{opacity:1, y:0}} exit={{opacity:0}}
              transition={{duration:0.55, ease:[0.16,1,0.3,1]}}
              style={{ fontSize:s.fs, fontWeight:s.fw, letterSpacing:s.ls,
                color: line.color ?? "rgba(255,255,255,0.88)",
                textAlign:"center", lineHeight:1.08, marginBottom:s.mb,
                textShadow:`0 0 40px ${line.color ?? "rgba(255,255,255,0.40)"}80`,
                fontFamily:"'Barlow Condensed',sans-serif" }}>
              {line.text}
            </motion.div>
          );
        })}
      </AnimatePresence>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.5, duration:0.6}}
        style={{ position:"absolute", bottom:20, fontSize:"0.43rem", letterSpacing:"0.24em",
          color:"rgba(255,255,255,0.22)" }}>
        TAP TO DISMISS
      </motion.div>
    </motion.div>
  );
}

// --- CrowdLEDs (emotion-aware) ------------------------------------------------
// ── String light LEDs — pear-shaped bulbs on drooping wire ───────────────────
function CrowdLEDs({ ledMode, scarf1, scarf2, scarf3, flip=false }:{
  ledMode:LEDMode; acHex:string; scarf1:string; scarf2:string; scarf3:string; flip?:boolean;
}) {
  const count   = 50;
  const spacing = 18;
  const W       = count * spacing;
  const H       = 26;

  // Wire hangs from top (or bottom if flipped)
  const wireY  = flip ? H - 3 : 3;
  // Bulb centre sits below/above the wire
  const bulbCY = flip ? 8 : H - 8;
  // Socket cap sits between wire and bulb
  const capY   = wireY < bulbCY ? wireY + 1.5 : bulbCY + 5.2;

  // Flag colours cycle scarf1 → scarf2 → scarf3
  const flagCols = [scarf1, scarf2, scarf3];

  // Build drooping wire: quadratic bezier sags between each bulb
  const wireParts: string[] = [];
  for (let i = 0; i < count - 1; i++) {
    const x1  = i * spacing + spacing / 2;
    const x2  = (i + 1) * spacing + spacing / 2;
    const mx  = (x1 + x2) / 2;
    const sag = flip ? wireY - 3.5 : wireY + 3.5;
    wireParts.push(`M ${x1} ${wireY} Q ${mx} ${sag} ${x2} ${wireY}`);
  }
  // extend wire to edges
  wireParts.unshift(`M 0 ${wireY} L ${spacing / 2} ${wireY}`);
  wireParts.push(`M ${(count - 1) * spacing + spacing / 2} ${wireY} L ${W} ${wireY}`);

  type BT = { op:[number,number,number]; dur:number; stagger:number };
  const cfg: Record<LEDMode, BT> = {
    calm:       { op:[0.22,0.34,0.22], dur:2.20, stagger:0.018 },
    silent:     { op:[0.04,0.08,0.04], dur:3.60, stagger:0.025 },
    hope:       { op:[0.50,0.80,0.50], dur:1.30, stagger:0.009 },
    excited:    { op:[0.70,1.00,0.70], dur:0.52, stagger:0.005 },
    explode:    { op:[0.85,1.00,0.85], dur:0.24, stagger:0.002 },
    devastated: { op:[0.06,0.12,0.06], dur:1.90, stagger:0.014 },
    var_pulse:  { op:[0.35,0.90,0.35], dur:0.80, stagger:0.006 },
  };
  const { op, dur, stagger } = cfg[ledMode];
  const filterId = `led-glow-${flip ? "b" : "t"}`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none" style={{ display:"block" }}>
      <defs>
        {/* Soft warm halo — two-pass blur for realism */}
        <filter id={filterId} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur1"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="blur2"/>
          <feMerge>
            <feMergeNode in="blur1"/>
            <feMergeNode in="blur2"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Drooping wire */}
      {wireParts.map((d, i) => (
        <path key={i} d={d} fill="none"
          stroke="rgba(210,195,165,0.30)" strokeWidth="0.8" strokeLinecap="round"/>
      ))}

      {/* Bulbs */}
      {Array.from({ length: count }, (_, i) => {
        const cx  = i * spacing + spacing / 2;
        const col = flagCols[i % 3];
        const d   = i * stagger;
        // Short drop wire from main wire to socket cap
        const wireEndY = wireY < bulbCY ? capY - 0.5 : capY + 0.5;
        return (
          <g key={i}>
            {/* Drop wire (neck wire from main wire to cap) */}
            <line x1={cx} y1={wireY} x2={cx} y2={wireEndY}
              stroke="rgba(210,195,165,0.35)" strokeWidth="0.9"/>

            {/* Socket / cap */}
            <rect x={cx - 2.4} y={capY} width={4.8} height={2.4}
              rx={0.7} fill="rgba(190,180,155,0.40)"/>

            {/* Outer glow halo — gives the "warm bloom" */}
            <motion.ellipse cx={cx} cy={bulbCY} rx={9} ry={10}
              fill={col} filter={`url(#${filterId})`}
              animate={{ opacity: [op[0] * 0.35, op[1] * 0.45, op[0] * 0.35] }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>

            {/* Mid glow */}
            <motion.ellipse cx={cx} cy={bulbCY} rx={6} ry={6.8}
              fill={col}
              animate={{ opacity: [op[0] * 0.55, op[1] * 0.70, op[0] * 0.55] }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>

            {/* Pear/teardrop bulb body — slightly taller than wide */}
            <motion.ellipse cx={cx} cy={bulbCY} rx={4.0} ry={4.8}
              fill={col}
              animate={{ opacity: op }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>

            {/* Bright inner filament glow */}
            <motion.ellipse cx={cx} cy={bulbCY - 0.6} rx={2.0} ry={2.4}
              fill="rgba(255,255,255,0.60)"
              animate={{ opacity: [op[0] * 0.7, op[1] * 0.9, op[0] * 0.7] }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>

            {/* Specular highlight (top-left glint) */}
            <circle cx={cx - 1.4} cy={bulbCY - 2.2} r={1.0}
              fill="rgba(255,255,255,0.75)" opacity={0.60}/>
          </g>
        );
      })}
    </svg>
  );
}

// ── Gold screen-border string lights ─────────────────────────────────────────
function GoldLEDEdge({ count=56, ledMode, flip=false }:{ count?:number; ledMode:LEDMode; flip?:boolean }) {
  const spacing = 16;
  const W       = count * spacing;
  const H       = 26;
  const wireY   = flip ? H - 3 : 3;
  const bulbCY  = flip ? 8 : H - 8;

  const GOLD = ["#D4AF37","#FFE566","#C9920A"];

  const wireParts: string[] = [];
  for (let i = 0; i < count - 1; i++) {
    const x1  = i * spacing + spacing / 2;
    const x2  = (i + 1) * spacing + spacing / 2;
    const sag = flip ? wireY - 3 : wireY + 3;
    wireParts.push(`M ${x1} ${wireY} Q ${(x1+x2)/2} ${sag} ${x2} ${wireY}`);
  }
  wireParts.unshift(`M 0 ${wireY} L ${spacing/2} ${wireY}`);
  wireParts.push(`M ${(count-1)*spacing+spacing/2} ${wireY} L ${W} ${wireY}`);

  const capY = wireY < bulbCY ? wireY + 1.5 : bulbCY + 5.2;

  type BT = { op:[number,number,number]; dur:number; stagger:number };
  const cfg: Record<LEDMode,BT> = {
    calm:      { op:[0.28,0.42,0.28], dur:2.10, stagger:0.016 },
    silent:    { op:[0.06,0.10,0.06], dur:3.50, stagger:0.022 },
    hope:      { op:[0.55,0.82,0.55], dur:1.30, stagger:0.009 },
    excited:   { op:[0.72,1.00,0.72], dur:0.52, stagger:0.005 },
    explode:   { op:[0.88,1.00,0.88], dur:0.24, stagger:0.002 },
    devastated:{ op:[0.08,0.14,0.08], dur:1.90, stagger:0.013 },
    var_pulse: { op:[0.40,0.92,0.40], dur:0.80, stagger:0.006 },
  };
  const { op, dur, stagger } = cfg[ledMode];
  const fid = `gld-${flip?"b":"t"}`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none" style={{ display:"block" }}>
      <defs>
        <filter id={fid} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.0" result="b1"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="b2"/>
          <feMerge><feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {wireParts.map((d,i) => (
        <path key={i} d={d} fill="none" stroke="rgba(210,185,120,0.32)" strokeWidth="0.8" strokeLinecap="round"/>
      ))}
      {Array.from({ length:count }, (_,i) => {
        const cx  = i * spacing + spacing / 2;
        const col = GOLD[i % 3];
        const d   = i * stagger;
        return (
          <g key={i}>
            <line x1={cx} y1={wireY} x2={cx} y2={capY}
              stroke="rgba(210,185,120,0.35)" strokeWidth="0.9"/>
            <rect x={cx-2.4} y={capY} width={4.8} height={2.4}
              rx={0.7} fill="rgba(190,170,100,0.45)"/>
            <motion.ellipse cx={cx} cy={bulbCY} rx={9} ry={10}
              fill={col} filter={`url(#${fid})`}
              animate={{ opacity:[op[0]*0.35,op[1]*0.45,op[0]*0.35] }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>
            <motion.ellipse cx={cx} cy={bulbCY} rx={5.5} ry={6.4}
              fill={col}
              animate={{ opacity:[op[0]*0.55,op[1]*0.70,op[0]*0.55] }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>
            <motion.ellipse cx={cx} cy={bulbCY} rx={3.8} ry={4.6}
              fill={col}
              animate={{ opacity:op }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>
            <motion.ellipse cx={cx} cy={bulbCY-0.6} rx={1.9} ry={2.3}
              fill="rgba(255,245,200,0.65)"
              animate={{ opacity:[op[0]*0.7,op[1]*0.9,op[0]*0.7] }}
              transition={{ duration:dur, delay:d, repeat:Infinity, ease:"easeInOut" }}/>
            <circle cx={cx-1.3} cy={bulbCY-2.1} r={0.95}
              fill="rgba(255,255,230,0.80)" opacity={0.60}/>
          </g>
        );
      })}
    </svg>
  );
}

function ScreenBorderLEDs({ ledMode }:{ ledMode:LEDMode }) {
  const H = 26;
  return (
    <>
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:50, pointerEvents:"none" }}>
        <GoldLEDEdge ledMode={ledMode} flip={false}/>
      </div>
      <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, pointerEvents:"none" }}>
        <GoldLEDEdge ledMode={ledMode} flip={true}/>
      </div>
      <div style={{ position:"fixed", left:0, top:0, height:"100vh", width:H,
        zIndex:50, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"50%", left:"50%",
          width:"100vh", height:H,
          transform:"translate(-50%,-50%) rotate(90deg)" }}>
          <GoldLEDEdge ledMode={ledMode} flip={true} count={72}/>
        </div>
      </div>
      <div style={{ position:"fixed", right:0, top:0, height:"100vh", width:H,
        zIndex:50, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"50%", left:"50%",
          width:"100vh", height:H,
          transform:"translate(-50%,-50%) rotate(-90deg)" }}>
          <GoldLEDEdge ledMode={ledMode} flip={true} count={72}/>
        </div>
      </div>
    </>
  );
}

// --- Particle Types -----------------------------------------------------------
interface Particle { id:number; x:number; y:number; vx:number; vy:number; color:string; size:number; life:number; }

// --- Props --------------------------------------------------------------------
interface Props {
  match    : MatchMeta;
  team     : SupporterTeam;
  narrative: MatchNarrative;
  rawEvents: RawEvent[];
  onBack   : () => void;
}

// --- Main Component -----------------------------------------------------------
export default function SupporterStoryScreen({ match, team, narrative, rawEvents, onBack }: Props) {
  const router = useRouter();

  // -- Atmosphere --
  const myTeam  = team === "home" ? match.home.name : team === "away" ? match.away.name : match.home.name;
  const oppTeam = team === "home" ? match.away.name : team === "away" ? match.home.name : match.away.name;
  const myCode  = team === "home" ? match.home.code : team === "away" ? match.away.code : match.home.code;
  const oppCode = team === "home" ? match.away.code : team === "away" ? match.home.code : match.away.code;
  const atmoKey = getAtmosphereType(myTeam);
  const atmo    = ATMO[atmoKey];
  const acHex   = atmo.accentHex;
  const hex2rgb = (h:string) => { const c=(h.replace("#","")+"000000").slice(0,6); return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`; };
  const acRgb   = hex2rgb(acHex);

  // -- Events --
  const allEvents = useMemo(() => buildEvents(rawEvents, narrative.moments ?? [], match), [rawEvents]);
  const filteredEvents = useMemo(() => allEvents.filter(ev => {
    const t = ev.eventType;
    return ["goal","yellow_card","red_card","substitution","penalty","foul","shot_on_target","var_decision","corner","offside"].includes(t);
  }), [allEvents]);

  const [activeId, setActiveId] = useState<string>(filteredEvents[0]?.id ?? "");
  const activeEvent    = filteredEvents.find(e => e.id === activeId) ?? filteredEvents[0] ?? null;
  const activeEventIdx = filteredEvents.findIndex(e => e.id === activeId);

  // -- Frames --
  const frames   = useMemo(() => activeEvent ? buildFrames(activeEvent, match) : [], [activeEvent?.id]);
  const [frameIdx,   setFrameIdx]   = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);
  useEffect(() => {
    setFrameIdx(0);
    setIsPlaying(false);
    const t = setTimeout(() => setIsPlaying(true), 900);
    return () => clearTimeout(t);
  }, [activeEvent?.id]);
  useEffect(() => {
    if (!isPlaying || frames.length < 2) return;
    const t = setTimeout(() => {
      if (frameIdx < frames.length - 1) setFrameIdx(fi => fi + 1);
      else setIsPlaying(false);
    }, 1800);
    return () => clearTimeout(t);
  }, [isPlaying, frameIdx, frames.length]);

  // -- Emotion + Narrative --
  const isMyTeamEvent = activeEvent ? activeEvent.team === myTeam : false;
  const emotion       = activeEvent ? emotionForEvent(activeEvent.eventType, isMyTeamEvent, team) : null;
  const crowdText     = activeEvent ? crowdNarrative(activeEvent.eventType, isMyTeamEvent, myTeam, oppTeam, activeEvent.minute, team) : null;

  // -- Cinema state --
  const [cinemaConfig, setCinemaConfig] = useState<CinemaConfig|null>(null);
  const [showCinema,   setShowCinema]   = useState(false);
  const [ledMode,      setLedMode]      = useState<LEDMode>("calm");
  const [pitchLight,   setPitchLight]   = useState("transparent");

  const dismissCinema = useCallback(() => { setShowCinema(false); }, []);

  // -- Reaction FX --
  const shakeControls  = useAnimation();
  const borderControls = useAnimation();
  const flashOpacity   = useMotionValue(0);
  const pitchScale     = useMotionValue(1);
  const pitchTX        = useMotionValue(0);
  const pitchTY        = useMotionValue(0);
  const [particles,   setParticles]   = useState<Particle[]>([]);
  const [confetti,    setConfetti]    = useState<Particle[]>([]);
  const [reaction,    setReaction]    = useState<ReactionType|null>(null);
  const [borderColor, setBorderColor] = useState<string>("transparent");

  const C_GOAL  = "#FFD700";
  const C_CARD_R= "#ff2244";
  const C_PEN   = "#CC44FF";

  const spawnParticles = (col:string, n:number) => {
    const ps:Particle[] = Array.from({length:n}, (_,i) => ({
      id:Date.now()+i, x:45+Math.random()*20, y:30+Math.random()*20,
      vx:(Math.random()-0.5)*3, vy:-(Math.random()*2+1),
      color:[col,"#ffffff","#ffd700"][i%3], size:Math.random()*3+2, life:1
    }));
    setParticles(ps);
    setTimeout(()=>setParticles([]),2400);
  };
  const spawnConfetti = (col:string) => {
    const cs:Particle[] = Array.from({length:60}, (_,i) => ({
      id:Date.now()+1000+i, x:Math.random()*107, y:-5+Math.random()*5,
      vx:(Math.random()-0.5)*2.5, vy:(Math.random()*3+1.5),
      color:[col,"#ffffff","#ffd700","#ff4488"][i%4], size:Math.random()*5+3, life:1
    }));
    setConfetti(cs);
    setTimeout(()=>setConfetti([]),3500);
  };

  const triggerFX = useCallback((r:ReactionType, tc:string, ev:PitchEvent) => {
    setReaction(r);
    setTimeout(()=>setReaction(null), 3000);

    const cinema = buildCinema(r, ev.minute, ev.player??null, isMyTeamEvent, oppTeam, tc);
    setCinemaConfig(cinema);
    setShowCinema(true);
    setLedMode(cinema.ledMode);
    setPitchLight(cinema.pitchLight);
    setTimeout(()=>setLedMode("calm"), cinema.duration + 800);
    setTimeout(()=>setPitchLight("transparent"), cinema.duration + 600);

    // Camera motion
    animate(pitchScale, cinema.cameraZoom, {duration:0.60, ease:[0.16,1,0.3,1]});
    animate(pitchTY, cinema.cameraY, {duration:0.60, ease:[0.16,1,0.3,1]});
    setTimeout(()=>{
      animate(pitchScale, 1.0, {duration:1.0, ease:[0.16,1,0.3,1]});
      animate(pitchTY, 0,   {duration:1.0, ease:[0.16,1,0.3,1]});
    }, cinema.duration - 800);

    // Physical FX
    const doShake = () => shakeControls.start({ x:[0,-4.5,4.5,-3.5,3.5,-2,2,0], transition:{duration:0.46,ease:"easeOut"} });
    const doFlash = (col:string, dur:number=2.2) => {
      animate(flashOpacity,[0,0.22,0],{duration:0.55});
      setBorderColor(col);
      borderControls.start({ opacity:[1,0.6,1,0.4,0], transition:{duration:dur} });
    };
    const doDarken = () => {
      animate(flashOpacity,[0,0.18,0],{duration:0.80});
      setBorderColor("#1a3a5c");
      borderControls.start({ opacity:[1,0.7,0], transition:{duration:2.0} });
    };
    switch(r) {
      case "goal_for_90plus":
      case "goal_for_winner":
      case "goal_for":
        doShake(); doFlash(C_GOAL, 3.5); spawnParticles(tc, 40); spawnConfetti(tc);
        break;
      case "goal_against":
        if (atmo.shakeOnConcede) doShake();
        doDarken();
        break;
      case "red_card":
        doShake(); doFlash(C_CARD_R,2.5);
        break;
      case "penalty":
        doShake(); setBorderColor(C_PEN);
        borderControls.start({opacity:[1,0.5,1,0.5,0],transition:{duration:2.8}});
        break;
    }
  }, [isMyTeamEvent, oppTeam, atmo]);

  const triggerEventCinema = useCallback((ev:PitchEvent) => {
    const c = buildEventCinema(ev.eventType, ev.minute, acHex);
    if (!c) return;
    setCinemaConfig(c);
    setShowCinema(true);
    setLedMode(c.ledMode);
    setPitchLight(c.pitchLight);
    setTimeout(()=>setLedMode("calm"), c.duration + 800);
    setTimeout(()=>setPitchLight("transparent"), c.duration + 600);
    animate(pitchScale, c.cameraZoom, {duration:0.60, ease:[0.16,1,0.3,1]});
    animate(pitchTY, c.cameraY, {duration:0.60, ease:[0.16,1,0.3,1]});
    setTimeout(()=>{
      animate(pitchScale, 1.0, {duration:1.0, ease:[0.16,1,0.3,1]});
      animate(pitchTY, 0,   {duration:1.0, ease:[0.16,1,0.3,1]});
    }, c.duration - 800);
  }, [acHex]);

  const prevActiveIdRef = useRef<string>("");
  useEffect(() => {
    if (!activeEvent || activeEvent.id === prevActiveIdRef.current) return;
    prevActiveIdRef.current = activeEvent.id;
    const r = detectReaction(activeEvent, isMyTeamEvent, allEvents, myTeam);
    if (r) triggerFX(r, acHex, activeEvent);
    else triggerEventCinema(activeEvent);
  }, [activeEvent?.id]);

  // -- Player Profile --
  const playerProfile = useMemo(() =>
    activeEvent ? computePlayer(activeEvent.player ?? activeEvent.playerIn ?? "", allEvents) : null,
    [activeEvent?.id]);
  const playerName = playerProfile ? (activeEvent?.player ?? activeEvent?.playerIn ?? null) : null;

  // -- Event list scroll --
  const listRef   = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activeRef.current && listRef.current)
      activeRef.current.scrollIntoView({ block:"nearest", behavior:"smooth" });
  }, [activeId]);

  const handleSelect = (id:string) => { setActiveId(id); setFrameIdx(0); setIsPlaying(false); };
  const handlePrev   = () => setFrameIdx(fi => Math.max(0, fi-1));
  const handleNext   = () => setFrameIdx(fi => Math.min(frames.length-1, fi+1));
  const handlePlay   = () => { if (frameIdx >= frames.length-1) setFrameIdx(0); setIsPlaying(p=>!p); };

  const EV_ICONS: Record<string,string> = {
    goal:"⚽",
    yellow_card:"🟨", "Yellow Card":"🟨",
    red_card:"🟥",   "Red Card":"🟥",
    substitution:"⇆",
    penalty:"⚡",
    foul:"⛔",
    shot_on_target:"🎯",
    var_decision:"📺",
    corner:"⚑",
    offside:"⛳",
  };

  const gradSide = team==="away" ? "92%" : "8%";
  const bgGrad   = `radial-gradient(ellipse 140% 80% at ${gradSide} 0%, rgba(${acRgb},0.11) 0%, transparent 52%),
                    radial-gradient(ellipse 120% 60% at ${team==="away"?"8%":"92%"} 100%, rgba(${acRgb},0.07) 0%, transparent 52%),
                    ${atmo.baseBg}`;

  const homeName = match.home.name; const awayName = match.away.name;
  const homeCode = match.home.code; const awayCode = match.away.code;
  const stageLabel = match.stage ?? "";
  const dateStr    = match.date ? new Date(match.date).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "";
  const goalsFor   = rawEvents.filter(e=>e.event_type==="goal"&&e.team===myTeam).length;
  const goalsAgainst = rawEvents.filter(e=>e.event_type==="goal"&&e.team!==myTeam).length;
  const scoreStr   = `${goalsFor}�${goalsAgainst}`;

  return (
    <motion.div animate={shakeControls}
      style={{ position:"fixed", inset:0, overflow:"hidden", fontFamily:"'Barlow Condensed',sans-serif",
        background:bgGrad }}>

      {/* Atmospheric overlays */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1,
        background:`radial-gradient(ellipse 60% 80% at ${gradSide} 50%, ${atmo.sectionGlow} 0%, transparent 55%),
                    ${atmo.vignette}` }}/>
      {/* Emotion pitch light (animates per event) */}
      <motion.div animate={{ background:pitchLight }} transition={{duration:0.50}}
        style={{ position:"absolute", inset:0, zIndex:2, pointerEvents:"none" }}/>
      {/* Flash overlay */}
      <motion.div style={{ position:"absolute", inset:0, zIndex:30, pointerEvents:"none",
        background:"rgba(255,255,255,0.55)", opacity:flashOpacity }}/>
      {/* Border FX */}
      <motion.div animate={borderControls} initial={{opacity:0}}
        style={{ position:"absolute", inset:0, zIndex:31, pointerEvents:"none",
          boxShadow:`inset 0 0 0 3px ${borderColor}` }}/>
      {/* Particles */}
      {(particles.length>0||confetti.length>0)&&(
        <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",zIndex:32,pointerEvents:"none" }} viewBox="0 0 107 70">
          {[...particles,...confetti].map(p=>(
            <motion.circle key={p.id} cx={p.x} cy={p.y} r={p.size/2} fill={p.color}
              animate={{cy:p.y+p.vy*22, cx:p.x+p.vx*22, opacity:[1,0.8,0]}}
              transition={{duration:2.0,ease:"easeOut"}}/>
          ))}
        </svg>
      )}

      {/* HEADER */}
      <div style={{ position:"relative", zIndex:20, height:50, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"0 20px",
        background:atmo.headerBg, backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${atmo.borderCol}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, minWidth:180 }}>
          <button onClick={onBack}
            style={{ background:"transparent", border:`1px solid rgba(${acRgb},0.25)`, borderRadius:3,
              padding:"4px 10px", cursor:"pointer", fontFamily:"inherit",
              fontSize:"0.62rem", letterSpacing:"0.18em", color:"rgba(255,255,255,0.50)" }}>
            ? BACK
          </button>
          <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
            <span style={{ fontSize:"0.62rem", letterSpacing:"0.22em", color:"rgba(255,255,255,0.30)" }}>? {homeCode}</span>
            <span style={{ fontSize:"0.41rem", letterSpacing:"0.12em", color:"rgba(255,255,255,0.18)" }}>{homeName}</span>
          </div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:"1.04rem", fontWeight:900, letterSpacing:"0.20em", color:"rgba(255,255,255,0.85)" }}>{scoreStr}</div>
          <div style={{ fontSize:"0.43rem", letterSpacing:"0.28em", color:`rgba(${acRgb},0.65)`, marginTop:1 }}>SUPPORTER BOARD</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:14, minWidth:180 }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:1 }}>
            <span style={{ fontSize:"0.62rem", letterSpacing:"0.22em", color:"rgba(255,255,255,0.30)" }}>{awayCode} ?</span>
            <span style={{ fontSize:"0.41rem", letterSpacing:"0.12em", color:"rgba(255,255,255,0.18)" }}>{awayName}</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:"0.46rem", letterSpacing:"0.14em", color:"rgba(255,255,255,0.24)" }}>{dateStr}</div>
            <div style={{ fontSize:"0.41rem", letterSpacing:"0.14em", color:"rgba(255,255,255,0.16)" }}>{stageLabel}</div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ position:"relative", zIndex:10, display:"flex", height:"calc(100% - 50px)", overflow:"hidden" }}>

        {/* LEFT: Supporter Moments */}
        <div style={{ width:183, flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden",
          borderRight:`1px solid ${atmo.borderCol}`,
          background:`linear-gradient(180deg, rgba(${acRgb},0.13) 0%, ${atmo.panelBg} 30%, ${atmo.panelBg} 100%)` }}>
          <div style={{ height:2, background:`linear-gradient(90deg, ${acHex}, rgba(${acRgb},0.08))`, flexShrink:0 }}/>
          <div style={{ flexShrink:0, padding:"10px 14px 9px", borderBottom:`1px solid rgba(${acRgb},0.12)` }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
              <div style={{ fontSize:"0.58rem", letterSpacing:"0.26em", color:`rgba(${acRgb},0.80)`, fontWeight:700 }}>MATCH STORY</div>
              <div style={{ background:acHex, borderRadius:2, padding:"0 6px", fontSize:"0.42rem", fontWeight:800,
                color:"rgba(0,0,0,0.72)", lineHeight:"14px", flexShrink:0 }}>{filteredEvents.length}</div>
            </div>
            <div style={{ fontSize:"0.46rem", letterSpacing:"0.12em", color:"rgba(255,255,255,0.22)", marginBottom:7 }}>
              Chapter {activeEventIdx >= 0 ? activeEventIdx+1 : 1} of {filteredEvents.length}
            </div>
            <div style={{ display:"flex", gap:"1px" }}>
              {Array.from({length:25},(_,i)=>(<div key={i} style={{ flex:1, height:3, borderRadius:1, opacity:0.40, background:[atmo.scarf1,atmo.scarf2,atmo.scarf3][i%3] }}/>))}
            </div>
          </div>
          <div ref={listRef} style={{ flex:1, overflowY:"auto", scrollbarWidth:"none" }}>
            {filteredEvents.map((ev,idx)=>{
              const isActive = ev.id===activeId;
              const mine = ev.team===myTeam;
              const em   = emotionForEvent(ev.eventType, mine, team);
              return(
                <button key={ev.id} ref={isActive?(activeRef as React.RefObject<HTMLButtonElement>):null}
                  onClick={()=>handleSelect(ev.id)}
                  style={{ width:"100%", display:"flex", alignItems:"flex-start", gap:8,
                    padding:"9px 12px 9px 14px",
                    background:isActive?`rgba(${acRgb},0.14)`:"transparent",
                    border:"none", borderLeft:`2px solid ${isActive?em.color:"transparent"}`,
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                    borderBottom:"1px solid rgba(255,255,255,0.04)", transition:"background 0.12s, border-color 0.12s" }}>
                  <span style={{ color:"rgba(255,255,255,0.18)", fontSize:"0.57rem", minWidth:14, paddingTop:1, flexShrink:0 }}>{idx+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:2 }}>
                      <span style={{ fontSize:"0.80rem", flexShrink:0 }}>{EV_ICONS[ev.eventType] ?? "·"}</span>
                      <span style={{ fontSize:"0.92rem", fontWeight:700,
                        color:isActive?"rgba(255,255,255,0.90)":"rgba(255,255,255,0.50)",
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:98 }}>
                        {ev.player??ev.playerIn??ev.team}
                      </span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:"0.62rem", color:"rgba(255,255,255,0.26)", fontWeight:700, flexShrink:0 }}>{ev.minute}'</span>
                      <span style={{ fontSize:"0.35rem", letterSpacing:"0.12em", fontWeight:700,
                        color:isActive?em.color:"rgba(255,255,255,0.22)",
                        background:isActive?`rgba(${acRgb},0.20)`:"transparent",
                        padding:"1px 5px", borderRadius:2, transition:"all 0.12s" }}>
                        {em.state}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER: Pitch + Cinema */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>

          {/* Center header: ? HOMECODE  MATCH BOARD / EXPLORE  AWAYCODE ? */}
          <div style={{ flexShrink:0, height:32, display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"0 14px", background:`rgba(${acRgb},0.06)`, borderBottom:`1px solid ${atmo.borderCol}` }}>
            <span style={{ fontSize:"0.56rem", letterSpacing:"0.18em", color:"rgba(255,255,255,0.45)", fontWeight:700 }}>? {homeCode}</span>
            {activeEvent ? (
              <button
                onClick={() => {
                  const p = activeEvent.player ?? activeEvent.playerOut ?? activeEvent.playerIn ?? activeEvent.team ?? "";
                  sessionStorage.setItem("supporter_matchId", match.id);
                  sessionStorage.setItem("supporter_team", team);
                  router.push(`/moment?matchId=${encodeURIComponent(match.id)}&eventId=${encodeURIComponent(activeEvent.id)}&minute=${activeEvent.minute}&player=${encodeURIComponent(p)}&type=${encodeURIComponent(activeEvent.eventType)}&team=${encodeURIComponent(team)}&lens=supporter`);
                }}
                style={{
                  background:"#f0c028", border:"none", borderRadius:4,
                  padding:"4px 14px", cursor:"pointer",
                  fontFamily:"'Barlow Condensed', sans-serif",
                  fontSize:"11px", letterSpacing:"0.18em", fontWeight:900,
                  color:"#000", whiteSpace:"nowrap",
                }}
              >
                EXPLORE MOMENT →
              </button>
            ) : (
              <span style={{ fontSize:"0.41rem", letterSpacing:"0.30em", color:"rgba(255,255,255,0.20)" }}>MATCH BOARD</span>
            )}
            <span style={{ fontSize:"0.56rem", letterSpacing:"0.18em", color:"rgba(255,255,255,0.45)", fontWeight:700 }}>{awayCode} ?</span>
          </div>

          {/* Event header: minute · player · emotion badge */}
          <AnimatePresence mode="wait">
            {activeEvent && (
              <motion.div key={`eh-${activeEvent.id}`}
                initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                transition={{duration:0.18}}
                style={{ flexShrink:0, borderBottom:`1px solid ${atmo.borderCol}`,
                  background:"rgba(0,0,0,0.22)" }}>

                {/* Row 1: minute · player · emotion */}
                <div style={{ display:"flex", alignItems:"center", padding:"0 10px", gap:8, height:36 }}>
                  <span style={{ fontSize:"1.04rem", fontWeight:800, color:acHex, flexShrink:0, letterSpacing:"0.02em" }}>
                    {activeEvent.minute}'
                  </span>
                  <span style={{ fontSize:"0.81rem", fontWeight:700, color:"rgba(255,255,255,0.78)",
                    flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {activeEvent.player ?? activeEvent.playerIn ?? activeEvent.team}
                  </span>
                  {emotion && (
                    <span style={{ fontSize:"0.55rem", letterSpacing:"0.10em", fontWeight:700, color:emotion.color,
                      background:`${emotion.color}22`, border:`1px solid ${emotion.color}55`,
                      borderRadius:3, padding:"3px 8px", flexShrink:0, whiteSpace:"nowrap" }}>
                      {emotion.state}
                    </span>
                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>

          <div style={{ flexShrink:0 }}><CrowdLEDs ledMode={ledMode} acHex={acHex} scarf1={atmo.scarf1} scarf2={atmo.scarf2} scarf3={atmo.scarf3}/></div>
          <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
            {/* Side glow from supporter end */}
            <div style={{ position:"absolute", inset:0, zIndex:2, pointerEvents:"none",
              background:`radial-gradient(ellipse 35% 100% at ${team==="away"?"100%":"0%"} 50%, ${atmo.sectionGlow} 0%, transparent 52%),
                          linear-gradient(to bottom, rgba(0,0,0,0.20) 0%, transparent 15%, transparent 82%, rgba(0,0,0,0.26) 100%)` }}/>
            {/* Pitch SVG with camera motion */}
            <motion.svg viewBox="-5 -6 117 82" preserveAspectRatio="xMidYMid meet"
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", display:"block",
                scale:pitchScale, x:pitchTX, y:pitchTY, transformOrigin:"50% 50%" }}>
              <PitchMarkings p1={atmo.pitchInner} p2={atmo.pitchMid} p3={atmo.pitchOuter}/>
              <CrowdStrip pos="top"    tint={atmo.crowdTint}/>
              <CrowdStrip pos="bottom" tint={atmo.crowdTint}/>
              <FrameScene frames={frames} frameIdx={frameIdx}/>
            </motion.svg>
            {/* Nation ambient tint � permanent floodlight color per nation */}
            {atmo.ambientTint !== "transparent" && (
              <div style={{ position:"absolute", inset:0, zIndex:4, pointerEvents:"none",
                background:atmo.ambientTint, mixBlendMode:"color" }}/>
            )}
            {/* Floating event card — hidden during cinema */}
            {activeEvent && !showCinema && (
              <FloatingEventCard event={activeEvent} frames={frames} frameIdx={frameIdx}
                emotion={emotion} acRgb={acRgb} acHex={acHex}/>
            )}

            {/* CINEMA OVERLAY */}
            <AnimatePresence>
              {showCinema && cinemaConfig && (
                <EmotionCinema config={cinemaConfig} onDismiss={dismissCinema}/>
              )}
            </AnimatePresence>
          </div>
          <div style={{ flexShrink:0 }}><CrowdLEDs ledMode={ledMode} acHex={acHex} scarf1={atmo.scarf1} scarf2={atmo.scarf2} scarf3={atmo.scarf3} flip={true}/></div>
          <div style={{ flexShrink:0 }}>
            <FrameControls frames={frames} frameIdx={frameIdx} isPlaying={isPlaying}
              tc={acHex} onPrev={handlePrev} onNext={handleNext}
              onPlayPause={handlePlay} onFrameClick={setFrameIdx}/>
          </div>
        </div>

        {/* RIGHT: Supporter Companion + Player Sidebar */}
        <div style={{ width:336, flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden",
          borderLeft:`1px solid ${atmo.borderCol}`, background:atmo.panelBg }}>

          {/* Panel header � Supporter Companion AI */}
          <div style={{ flexShrink:0, padding:"10px 14px 9px",
            background:`rgba(${acRgb},0.08)`, borderBottom:`1px solid ${atmo.borderCol}`,
            display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0,
              background:`rgba(${acRgb},0.20)`, border:`1px solid rgba(${acRgb},0.35)`,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="12,2 20.5,7 20.5,17 12,22 3.5,17 3.5,7" stroke={acHex} strokeWidth="1.5" fill={`${acHex}22`}/>
                <polygon points="12,7 17,9.5 17,14.5 12,17 7,14.5 7,9.5" stroke={acHex} strokeWidth="1" fill={`${acHex}44`}/>
              </svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:"0.6rem", fontWeight:700, color:"rgba(255,255,255,0.78)", letterSpacing:"0.04em" }}>Supporter Companion</div>
              <div style={{ fontSize:"0.41rem", color:"rgba(255,255,255,0.26)", letterSpacing:"0.08em" }}>PitchLens Guide � Powered by Granite</div>
            </div>
            <div style={{ fontSize:"0.43rem", letterSpacing:"0.08em", color:"rgba(255,255,255,0.16)", flexShrink:0 }}>IBM Granite</div>
          </div>

          {/* Body: chat (left) + player sidebar (right) */}
          <div style={{ flex:1, minHeight:0, display:"flex", overflow:"hidden" }}>

            {/* CHAT AREA */}
            <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden",
              borderRight:`1px solid ${atmo.borderCol}` }}>

              {/* FROM THE STANDS � crowd narrative snippet */}
              <div style={{ flexShrink:0, padding:"9px 14px 8px", borderBottom:`1px solid ${atmo.borderCol}`,
                minHeight:64, overflow:"hidden" }}>
                <div style={{ fontSize:"0.43rem", letterSpacing:"0.22em", color:"rgba(255,255,255,0.20)", marginBottom:5, fontWeight:700 }}>FROM THE STANDS</div>
                <AnimatePresence mode="wait">
                  {emotion ? (
                    <motion.div key={`ns-${activeEvent?.id}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.20}}>
                      <div style={{ fontSize:"0.91rem", fontWeight:900, letterSpacing:"0.06em", lineHeight:1,
                        color:emotion.color, marginBottom:4, textShadow:`0 0 22px ${emotion.color}44` }}>{emotion.state}</div>
                      {crowdText && (
                        <p style={{ fontSize:"0.58rem", lineHeight:1.65, color:"rgba(255,255,255,0.42)", margin:0,
                          fontWeight:300, display:"-webkit-box" as any,
                          WebkitLineClamp:3, WebkitBoxOrient:"vertical" as any, overflow:"hidden" }}>
                          {crowdText.split("\n\n")[0]}
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.p key="empty" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.20}}
                      style={{ fontSize:"0.58rem", lineHeight:1.65, color:"rgba(255,255,255,0.24)", margin:0, fontStyle:"italic" }}>
                      Select a moment to feel the match.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Granite chat */}
              <GraniteCompanion event={activeEvent} myTeamName={myTeam} oppName={oppTeam} tc={acHex} isMyTeamEvent={isMyTeamEvent}/>
            </div>

            {/* PLAYER SIDEBAR */}
            <div style={{ width:130, flexShrink:0, display:"flex", flexDirection:"column", overflow:"hidden",
              background:`rgba(${acRgb},0.04)` }}>

              {/* Nation + player identity */}
              <div style={{ flexShrink:0, padding:"10px 10px 8px", borderBottom:`1px solid ${atmo.borderCol}` }}>
                <div style={{ fontSize:"0.43rem", letterSpacing:"0.20em", color:`rgba(${acRgb},0.70)`, marginBottom:4, fontWeight:700 }}>
                  {atmo.sectionName.split(" ")[0]}
                </div>
                <AnimatePresence mode="wait">
                  {playerProfile && playerName ? (
                    <motion.div key={`ps-${playerName}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}>
                      <div style={{ fontSize:"1.23rem", fontWeight:900, color:"rgba(255,255,255,0.84)", lineHeight:1,
                        letterSpacing:"0.02em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {playerName.split(" ").slice(-1)[0]}
                      </div>
                      <div style={{ fontSize:"0.43rem", color:"rgba(255,255,255,0.36)", letterSpacing:"0.06em", marginBottom:6, marginTop:1 }}>
                        {playerName.split(" ").slice(0,-1).join(" ") || playerName}
                      </div>
                      {emotion && (
                        <div style={{ fontSize:"0.43rem", letterSpacing:"0.12em", fontWeight:700, color:emotion.color,
                          background:`${emotion.color}18`, border:`1px solid ${emotion.color}40`,
                          borderRadius:2, padding:"2px 6px", display:"inline-block" }}>
                          {emotion.state}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="no-player" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.18}}>
                      <div style={{ fontSize:"1.43rem", fontWeight:900, color:"rgba(255,255,255,0.65)", lineHeight:1 }}>{myCode}</div>
                      <div style={{ fontSize:"0.43rem", color:`rgba(${acRgb},0.50)`, letterSpacing:"0.08em", marginTop:4 }}>{atmo.chant}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Radar + all 5 stats */}
              {playerProfile && (
                <div style={{ flexShrink:0, padding:"6px 8px 8px", borderBottom:`1px solid ${atmo.borderCol}` }}>
                  <div style={{ display:"flex", justifyContent:"center" }}>
                    <RadarChart values={[playerProfile.stats.influence,playerProfile.stats.discipline,playerProfile.stats.involvement,playerProfile.stats.pressure,playerProfile.stats.impact]} color={acHex}/>
                  </div>
                  {([["INFLUENCE",playerProfile.stats.influence],["DISCIPLINE",playerProfile.stats.discipline],["IMPACT",playerProfile.stats.impact],["INVOLVEMENT",playerProfile.stats.involvement],["PRESSURE",playerProfile.stats.pressure]] as [string,number][]).map(([lbl,val])=>(
                    <div key={lbl} style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
                      <span style={{ fontSize:"0.33rem", letterSpacing:"0.04em", color:"rgba(255,255,255,0.26)", width:46, flexShrink:0 }}>{lbl}</span>
                      <div style={{ flex:1, height:1.5, background:"rgba(255,255,255,0.07)", borderRadius:1 }}>
                        <motion.div animate={{width:`${val}%`}} initial={{width:0}}
                          transition={{duration:0.40,ease:[0.16,1,0.3,1]}}
                          style={{ height:"100%", background:acHex, borderRadius:1 }}/>
                      </div>
                      <span style={{ fontSize:"0.58rem", fontWeight:800, color:acHex, width:14, textAlign:"right", flexShrink:0 }}>{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* IN THIS MATCH */}
              <div style={{ flex:1, minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                <div style={{ flexShrink:0, padding:"6px 10px 3px",
                  fontSize:"0.33rem", letterSpacing:"0.18em", color:"rgba(255,255,255,0.20)", fontWeight:700 }}>
                  IN THIS MATCH
                </div>
                <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"none", padding:"0 10px 6px" }}>
                  {(playerName
                    ? allEvents.filter(e=>e.player===playerName||e.playerIn===playerName||e.playerOut===playerName)
                    : filteredEvents.slice(0,8)
                  ).map(e=>(
                    <button key={e.id} onClick={()=>handleSelect(e.id)}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:5, padding:"3px 0",
                        borderBottom:"1px solid rgba(255,255,255,0.04)", background:"none", border:"none",
                        cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                        borderLeft:"none", borderRight:"none", borderTop:"none" }}>
                      <span style={{ fontSize:"0.42rem", fontWeight:700, color:`rgba(${acRgb},0.72)`, minWidth:18, flexShrink:0 }}>{e.minute}'</span>
                      <span style={{ fontSize:"0.43rem", letterSpacing:"0.06em", color:evColor(e.eventType,e.teamColor),
                        textTransform:"uppercase", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
                        {e.eventType.replace(/_/g," ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scarf accent */}
              <div style={{ flexShrink:0, display:"flex", gap:"1px", padding:"0 8px 8px" }}>
                {Array.from({length:14},(_,i)=>(<div key={i} style={{ flex:1, height:3, borderRadius:1, opacity:0.45, background:[atmo.scarf1,atmo.scarf2,atmo.scarf3][i%3] }}/>))}
              </div>
            </div>
          </div>
        </div>
      </div>


    </motion.div>
  );
}
