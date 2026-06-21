"use client";

// ─── AllegianceScene — Elegant Arch Gates ────────────────────────────────────
//
// Three stadium arch gates emerge from the video at midfield.
// Each is a proper architectural arch — curved top, slim pillars, warm passage.
// The gate structure is dark and neutral; team identity comes from the light inside.
//
// At rest: gates breathe with a faint ambient glow.
// Hover: the arch illuminates, the passage floods with team colour, banners wake.
// Select: passage erupts → portal bloom → chant banner → dashboard.

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence }                   from "framer-motion";
import type { MatchMeta }                            from "@/lib/matchData";
import type { SupporterTeam }                        from "./SupporterStoryScreen";

// ─── Copy ─────────────────────────────────────────────────────────────────────
const ALLEGIANCE: Record<string, { home: string; away: string }> = {
  "japan-spain"    : { home: "RELIVE THE COMEBACK",    away: "DEFEND YOUR LEAD"       },
  "iran-usa"       : { home: "HOLD YOUR GROUND",        away: "FIGHT THROUGH THE WALL" },
  "germany-japan"  : { home: "RECLAIM THE MATCH",       away: "DEFY THE GIANTS"        },
  "belgium-croatia": { home: "ONE LAST SHOT AT GLORY",  away: "SURVIVE AND ADVANCE"    },
  "ghana-portugal" : { home: "REFUSE TO SURRENDER",     away: "SHOW YOUR CLASS"        },
  "england-wales"  : { home: "THE DERBY IS YOURS",      away: "STAND TOGETHER"         },
};

const CHANTS: Record<string, { home: string; away: string; neutral: string }> = {
  "japan-spain"    : { home: "JAPAN TILL THE END",    away: "LA ROJA FOREVER",        neutral: "BEAUTIFUL GAME" },
  "iran-usa"       : { home: "WE STAND TOGETHER",     away: "USA ALL THE WAY",         neutral: "BEAUTIFUL GAME" },
  "germany-japan"  : { home: "GERMANY TILL THE END",  away: "BELIEVE — SAMURAI BLUE", neutral: "BEAUTIFUL GAME" },
  "belgium-croatia": { home: "ONE LAST SHOT",         away: "VATRENI FOREVER",         neutral: "BEAUTIFUL GAME" },
  "ghana-portugal" : { home: "THIS IS OUR TIME",      away: "BLACK STARS RISE",        neutral: "BEAUTIFUL GAME" },
  "england-wales"  : { home: "IT'S COMING HOME",      away: "TOGETHER STRONGER",       neutral: "BEAUTIFUL GAME" },
};

function hexRgb(hex: string): string {
  const c = hex.replace("#", "");
  const r = Math.max(parseInt(c.slice(0,2),16), 80);
  const g = Math.max(parseInt(c.slice(2,4),16), 80);
  const b = Math.max(parseInt(c.slice(4,6),16), 80);
  // Lift near-greys to a warm amber so they read as atmospheric
  if (Math.max(r,g,b) - Math.min(r,g,b) < 28) return "210,150,55";
  return `${r},${g},${b}`;
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const GATE_Y   = "46%";
const LARGE_W  = 248;
const LARGE_H  = 390;
const SMALL_W  = 170;
const SMALL_H  = 292;

type Stage       = "video" | "gates";
type CommitStage = "crowd" | "rush" | "banner" | null;

interface Props {
  match   : MatchMeta;
  onSelect: (team: SupporterTeam) => void;
  onBack  : () => void;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AllegianceScene({ match, onSelect, onBack }: Props) {
  const [stage,       setStage]       = useState<Stage>("video");
  const [hovered,     setHovered]     = useState<SupporterTeam | null>(null);
  const [commitTeam,  setCommitTeam]  = useState<SupporterTeam | null>(null);
  const [commitStage, setCommitStage] = useState<CommitStage>(null);

  const hRgb = hexRgb(match.home.color);
  const aRgb = hexRgb(match.away.color);
  const hl   = ALLEGIANCE[match.id] ?? { home: "STAND WITH US",  away: "JOIN YOUR SIDE" };
  const ch   = CHANTS[match.id]     ?? { home: "BELIEVE",         away: "BELIEVE",        neutral: "BEAUTIFUL GAME" };

  useEffect(() => {
    const t = setTimeout(() => setStage("gates"), 2600);
    return () => clearTimeout(t);
  }, []);

  const handleCommit = useCallback((team: SupporterTeam) => {
    if (commitTeam) return;
    setCommitTeam(team);
    try { localStorage.setItem("pitchlens_supporterSide", team); } catch {}
    const at = (fn: () => void, ms: number) => setTimeout(fn, ms);
    at(() => setCommitStage("crowd"),  0);
    at(() => setCommitStage("rush"),   560);
    at(() => setCommitStage("banner"), 1100);
    at(() => onSelect(team),           1950);
  }, [commitTeam, onSelect]);

  const gatesReady = stage === "gates";

  // Camera lean toward hovered / committed gate
  const cameraX =
    commitStage === "rush" || commitStage === "banner"
      ? commitTeam==="home" ? "18%" : commitTeam==="away" ? "-18%" : "0%"
      : commitStage === "crowd"
      ? commitTeam==="home" ? "4%"  : commitTeam==="away" ? "-4%"  : "0%"
      : !commitTeam && hovered==="home"    ? "2.5%"
      : !commitTeam && hovered==="away"    ? "-2.5%"
      : "0%";

  const cameraScale =
    commitStage==="rush" || commitStage==="banner" ? 1.22 :
    commitStage==="crowd" ? 1.05 :
    hovered || commitTeam ? 1.036 : 1.0;

  return (
    <div style={{ position:"fixed", inset:0, background:"#000", overflow:"hidden",
                  fontFamily:"'Barlow Condensed', sans-serif" }}>

      {/* ── Camera ─────────────────────────────────────────────────────────── */}
      <motion.div
        style={{ position:"absolute", inset:0, transformOrigin:"50% 55%" }}
        animate={{ x: cameraX, scale: cameraScale }}
        transition={{
          duration: commitStage==="rush" ? 0.68 : 0.52,
          ease    : commitStage==="rush" ? [0.38,0,0.92,1] : [0.25,0.46,0.45,0.94],
        }}
      >
        {/* Video */}
        <video autoPlay muted loop playsInline
          style={{
            position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
            filter: commitStage==="rush" || commitStage==="banner"
              ? "brightness(0.18) saturate(0.28)"
              : commitTeam
              ? "brightness(0.30)"
              : "brightness(0.55)",
            transition:"filter 0.55s ease",
          }}
          src="/videos/allegiance-cinematic.mp4"
        />

        {/* Atmospheric colour washes from each stand */}
        <AtmosphereLayer
          hovered={hovered}
          commitTeam={commitTeam}
          commitStage={commitStage}
          hRgb={hRgb}
          aRgb={aRgb}
        />

        {/* ── GATES — flex row, guaranteed even spacing ── */}
        <div style={{
          position:"absolute", left:0, right:0, bottom:0, top:"18%",
          display:"flex", flexDirection:"row",
          alignItems:"flex-end",
          justifyContent:"space-evenly",
          paddingLeft:"4%", paddingRight:"4%",
          paddingBottom:"2%",
          pointerEvents:"none",
        }}>
          <ArchGate
            side="home" large
            teamCode={match.home.code} teamName={match.home.name} tagline={hl.home}
            flagCode={match.home.flagCode}
            color={hRgb}
            gatesReady={gatesReady} floatDelay={0}
            isHovered={!commitTeam && hovered==="home"}
            commitStage={commitTeam==="home" ? commitStage : null}
            isReceding={!!commitTeam && commitTeam!=="home"}
            onHover={()=>setHovered("home")}
            onLeave={()=>setHovered(null)}
            onCommit={()=>handleCommit("home")}
          />


          <ArchGate
            side="away" large
            teamCode={match.away.code} teamName={match.away.name} tagline={hl.away}
            flagCode={match.away.flagCode}
            color={aRgb}
            gatesReady={gatesReady} floatDelay={0.80}
            isHovered={!commitTeam && hovered==="away"}
            commitStage={commitTeam==="away" ? commitStage : null}
            isReceding={!!commitTeam && commitTeam!=="away"}
            onHover={()=>setHovered("away")}
            onLeave={()=>setHovered(null)}
            onCommit={()=>handleCommit("away")}
          />
        </div>

        {/* Portal bloom */}
        <AnimatePresence>
          {(commitStage==="rush" || commitStage==="banner") && (
            <motion.div key="portal"
              initial={{ scale:1, opacity:0.80, borderRadius:"50%" }}
              animate={{ scale:65, opacity:1,   borderRadius:"50%" }}
              transition={{ duration:1.05, ease:[0.38,0,0.92,1] }}
              style={{
                position:"absolute",
                left: commitTeam==="home" ? "20%" : commitTeam==="away" ? "80%" : "50%",
                top : "68%",
                width:LARGE_W, height:LARGE_H,
                transform:"translate(-50%,-50%)",
                transformOrigin:"center",
                background: commitTeam==="home"
                  ? `radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0%, rgba(${hRgb},0.92) 30%, rgba(${hRgb},0.96) 100%)`
                  : commitTeam==="away"
                  ? `radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0%, rgba(${aRgb},0.92) 30%, rgba(${aRgb},0.96) 100%)`
                  : "rgba(35,48,68,0.96)",
                zIndex:80, pointerEvents:"none",
              }}
            />
          )}
        </AnimatePresence>

        {/* Rush lines */}
        <AnimatePresence>
          {(commitStage==="rush" || commitStage==="banner") && (
            <RushLines key="rush"
              color={commitTeam==="home"?hRgb:commitTeam==="away"?aRgb:"185,170,110"}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Invisible hit zones ── */}
      {!commitTeam && (
        <>
          <div onMouseEnter={()=>setHovered("home")}    onMouseLeave={()=>setHovered(null)}
               onClick={()=>handleCommit("home")}
               style={{ position:"fixed", inset:"0 50% 0 0", zIndex:30, cursor:"crosshair" }} />
          <div onMouseEnter={()=>setHovered("away")}    onMouseLeave={()=>setHovered(null)}
               onClick={()=>handleCommit("away")}
               style={{ position:"fixed", inset:"0 0 0 66%", zIndex:30, cursor:"crosshair" }} />
        </>
      )}

      {/* Chant banner */}
      <AnimatePresence>
        {commitStage==="banner" && (
          <BannerFlash key="banner"
            text={commitTeam==="home"?ch.home:commitTeam==="away"?ch.away:ch.neutral}
            color={commitTeam==="home"?hRgb:commitTeam==="away"?aRgb:"190,172,100"}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <AnimatePresence>
        {!commitTeam && (
          <motion.div key="hdr"
            initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-12 }} transition={{ duration:0.70, delay:0.2 }}
            style={{
              position:"fixed", top:0, left:0, right:0, zIndex:60,
              display:"flex", flexDirection:"column", alignItems:"center",
              paddingTop:22, pointerEvents:"none",
            }}
          >
            <div style={{ fontSize:"0.46rem", letterSpacing:"0.24em",
                          color:"rgba(255,255,255,0.20)", marginBottom:8 }}>
              {match.home.code} vs {match.away.code} · {match.date}
            </div>
            <div style={{ fontSize:"1.05rem", fontWeight:800, letterSpacing:"0.13em",
                          color:"rgba(255,255,255,0.78)",
                          textShadow:"0 2px 22px rgba(0,0,0,0.90)" }}>
              CHOOSE YOUR STAND
            </div>
            <motion.div
              animate={{ opacity: gatesReady && !hovered ? 0.26 : 0 }}
              transition={{ duration:0.6, delay: gatesReady ? 2.4 : 0 }}
              style={{ marginTop:9, fontSize:"0.38rem", letterSpacing:"0.16em",
                       color:"rgba(255,255,255,0.26)" }}
            >
              Three entrances. One stadium. Different stories.
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back */}
      <motion.button onClick={onBack}
        animate={{ opacity: commitTeam ? 0 : 1 }} transition={{ duration:0.3 }}
        style={{
          position:"fixed", top:18, left:22, zIndex:65,
          background:"none", border:"none", fontFamily:"inherit",
          fontSize:"0.50rem", letterSpacing:"0.18em",
          color:"rgba(255,255,255,0.22)", cursor:"pointer", padding:0,
          transition:"color 0.2s", pointerEvents: commitTeam ? "none" : "auto",
        }}
        onMouseEnter={e=>{e.currentTarget.style.color="rgba(255,255,255,0.62)";}}
        onMouseLeave={e=>{e.currentTarget.style.color="rgba(255,255,255,0.22)";}}
      >
        ← BACK
      </motion.button>
    </div>
  );
}

// ─── AtmosphereLayer ─────────────────────────────────────────────────────────
// Subtle colour washes from each stand edge. Present even at rest (low opacity).
function AtmosphereLayer({ hovered, commitTeam, commitStage, hRgb, aRgb }: {
  hovered    : SupporterTeam | null;
  commitTeam : SupporterTeam | null;
  commitStage: CommitStage;
  hRgb       : string;
  aRgb       : string;
}) {
  const homeOp = commitTeam
    ? commitTeam==="home" ? 0.70 : 0
    : hovered==="home" ? 0.45 : 0.10;
  const awayOp = commitTeam
    ? commitTeam==="away" ? 0.70 : 0
    : hovered==="away" ? 0.45 : 0.10;
  const neutralOp = commitTeam
    ? commitTeam==="neutral" ? 0.38 : 0
    : hovered==="neutral" ? 0.28 : 0.06;

  return (
    <>
      <motion.div animate={{ opacity: homeOp }} transition={{ duration:0.60 }}
        style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`linear-gradient(105deg, rgba(${hRgb},0.50) 0%, rgba(${hRgb},0.18) 24%, transparent 48%)`,
        }}
      />
      <motion.div animate={{ opacity: awayOp }} transition={{ duration:0.60 }}
        style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`linear-gradient(255deg, rgba(${aRgb},0.50) 0%, rgba(${aRgb},0.18) 24%, transparent 48%)`,
        }}
      />
      <motion.div animate={{ opacity: neutralOp }} transition={{ duration:0.60 }}
        style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:`radial-gradient(ellipse 28% 35% at 50% 58%, rgba(170,200,155,0.16) 0%, transparent 65%)`,
        }}
      />
    </>
  );
}

// ─── ArchGate ─────────────────────────────────────────────────────────────────
// A beautiful architectural arch gate — the supporter entrance.
//
// Structure (SVG viewBox 320×480):
//   Two slim pillars, curved arch crown connecting them.
//   The passage inside the arch glows with team colour.
//   A sign panel sits at the arch crown.
//   Slim floodlight arms extend from pillar tops.
//   Fabric banners hang from the pillar sides.
//   A subtle ambient breath is always present at rest.
function ArchGate({
  side, large,
  teamCode, teamName, tagline, color, flagCode,
  gatesReady, floatDelay,
  isHovered, commitStage, isReceding,
  onHover, onLeave, onCommit,
}: {
  side: SupporterTeam; large: boolean;
  teamCode: string; teamName: string; tagline: string; color: string; flagCode: string;
  gatesReady: boolean; floatDelay: number;
  isHovered: boolean;
  commitStage: CommitStage;
  isReceding: boolean;
  onHover: () => void; onLeave: () => void; onCommit: () => void;
}) {
  const W  = large ? LARGE_W : SMALL_W;
  const H  = large ? LARGE_H : SMALL_H;
  const vW = 320;
  const vH = 480;
  const isNeutral = side === "neutral";

  // Arch geometry (all in viewBox units)
  // Outer arch: pillars x=14..44, x=276..306; crown peak at y=35
  // Inner passage arch: x=50..270; crown peak at y=75
  const OP = { lx:14, rx:276, pw:30, py:118, cy:35 }; // outer pillar, crown
  const IP = { lx:50, rx:270,        iy:140, cy:75 }; // inner passage, crown

  const active      = isHovered || !!commitStage;
  const unlockOpen  = commitStage==="rush" || commitStage==="banner";
  const erupting    = commitStage==="crowd" || unlockOpen;

  // SVG arch path helpers
  const outerLeft  = OP.lx + OP.pw / 2;
  const outerRight = OP.rx + OP.pw / 2;
  const innerLeft  = IP.lx;
  const innerRight = IP.rx;

  return (
    <motion.div
      style={{
        position:"relative",
        flexShrink:0,
        width:W, height:H,
        zIndex: commitStage ? 72 : 20,
        cursor: isReceding || commitStage ? "default" : "pointer",
        pointerEvents:"auto",
      }}
      initial={{ opacity:0, y:70 }}
      animate={
        !gatesReady               ? { opacity:0, y:70 }
        : unlockOpen              ? { opacity:0.28, y:-22, scale:1.06 }
        : commitStage==="crowd"   ? { opacity:1,   y:-8  }
        : isReceding              ? { opacity:0,   y:18,  scale:0.85 }
        : { opacity:1, y:0, scale:1 }
      }
      transition={{
        duration: !gatesReady ? 0 : (commitStage||isReceding) ? 0.45 : 1.00,
        delay   : gatesReady && !commitStage && !isReceding ? floatDelay : 0,
        ease    : [0.16,1,0.3,1],
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onCommit}
    >
      {/* ── Outer ground halo — ambient breathing ── */}
      <motion.div
        animate={{
          opacity: erupting ? 1 : isHovered ? 0.88 : 0.22,
          scale  : erupting ? 1.3 : 1,
        }}
        transition={{ duration:0.60 }}
        style={{
          position:"absolute", bottom:-48, left:"50%", transform:"translateX(-50%)",
          width:W * 1.7, height:64,
          borderRadius:"50%",
          background:`radial-gradient(ellipse at center, rgba(${color},0.32) 0%, transparent 70%)`,
          filter:"blur(20px)",
          pointerEvents:"none",
        }}
      />

      {/* ── SVG arch structure ── */}
      <svg viewBox={`0 0 ${vW} ${vH}`} width={W} height={H}
           style={{ display:"block", overflow:"visible" }}>
        <defs>
          {/* Pillar gradient — gold for neutral, dark metal for teams */}
          <linearGradient id={`pg${side}`} x1="0" y1="0" x2="1" y2="0">
            {isNeutral ? <>
              <stop offset="0%"   stopColor="rgba(120,90,10,0.98)" />
              <stop offset="25%"  stopColor="rgba(212,175,55,0.98)" />
              <stop offset="50%"  stopColor="rgba(255,235,120,0.98)" />
              <stop offset="75%"  stopColor="rgba(212,175,55,0.98)" />
              <stop offset="100%" stopColor="rgba(120,90,10,0.98)"  />
            </> : <>
              <stop offset="0%"   stopColor="rgba(10,14,26,0.98)" />
              <stop offset="35%"  stopColor="rgba(22,30,50,0.98)" />
              <stop offset="65%"  stopColor="rgba(18,24,42,0.98)" />
              <stop offset="100%" stopColor="rgba(8,12,22,0.98)"  />
            </>}
          </linearGradient>
          {/* Arch crown gradient */}
          <linearGradient id={`ag${side}`} x1="0" y1="0" x2="0" y2="1">
            {isNeutral ? <>
              <stop offset="0%"   stopColor="rgba(180,140,30,0.97)" />
              <stop offset="100%" stopColor="rgba(100,75,10,0.97)"  />
            </> : <>
              <stop offset="0%"   stopColor="rgba(14,18,32,0.97)" />
              <stop offset="100%" stopColor="rgba(20,26,46,0.97)" />
            </>}
          </linearGradient>
          {/* Passage interior — team colour glow from within */}
          <radialGradient id={`pass${side}`} cx="50%" cy="40%" r="65%">
            <stop offset="0%"   stopColor={`rgba(${color},0.70)`} />
            <stop offset="50%"  stopColor={`rgba(${color},0.22)`} />
            <stop offset="100%" stopColor="rgba(0,0,0,0.0)"       />
          </radialGradient>
          {/* Unlock flood — bright white/team when gate opens */}
          <radialGradient id={`uf${side}`} cx="50%" cy="38%" r="60%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.96)" />
            <stop offset="30%"  stopColor={`rgba(${color},0.88)`}  />
            <stop offset="100%" stopColor="rgba(0,0,0,0)"           />
          </radialGradient>
          {/* Floodlight cone */}
          <radialGradient id={`fc${side}`} cx="50%" cy="0%" r="100%">
            <stop offset="0%"   stopColor={`rgba(${color},0.55)`} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)"          />
          </radialGradient>
          {/* Crowd depth fade */}
          <linearGradient id={`cd${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(0,0,0,0.96)" />
            <stop offset="80%"  stopColor="rgba(0,0,0,0.0)"  />
          </linearGradient>
        </defs>

        {/* ── FLOODLIGHT CONES — angled from arch crown ── */}
        <motion.polygon
          points={`${outerLeft},${OP.py} 0,10 ${outerLeft+24},10`}
          fill={`url(#fc${side})`}
          animate={{ opacity: active ? 0.70 : 0.20 }}
          transition={{ duration:0.55 }}
        />
        <motion.polygon
          points={`${outerRight},${OP.py} ${vW-24},10 ${vW},10`}
          fill={`url(#fc${side})`}
          animate={{ opacity: active ? 0.70 : 0.20 }}
          transition={{ duration:0.55 }}
        />

        {/* ── PASSAGE INTERIOR ── */}
        {/* Inner arch passage fill */}
        <path
          d={`M ${IP.lx} ${vH}
              L ${IP.lx} ${IP.iy}
              Q ${IP.lx} ${IP.cy} 160 ${IP.cy - 8}
              Q ${IP.rx} ${IP.cy} ${IP.rx} ${IP.iy}
              L ${IP.rx} ${vH} Z`}
          fill="rgba(0,0,0,0.90)"
        />
        {/* Team colour glow inside passage */}
        <motion.path
          d={`M ${IP.lx} ${vH}
              L ${IP.lx} ${IP.iy}
              Q ${IP.lx} ${IP.cy} 160 ${IP.cy - 8}
              Q ${IP.rx} ${IP.cy} ${IP.rx} ${IP.iy}
              L ${IP.rx} ${vH} Z`}
          fill={`url(#pass${side})`}
          animate={{ opacity: active && !unlockOpen ? 1 : 0 }}
          transition={{ duration:0.45 }}
        />
        {/* Unlock flood */}
        <motion.path
          d={`M ${IP.lx} ${vH}
              L ${IP.lx} ${IP.iy}
              Q ${IP.lx} ${IP.cy} 160 ${IP.cy - 8}
              Q ${IP.rx} ${IP.cy} ${IP.rx} ${IP.iy}
              L ${IP.rx} ${vH} Z`}
          fill={`url(#uf${side})`}
          animate={{ opacity: unlockOpen ? 1 : 0 }}
          transition={{ duration:0.28 }}
        />

        {/* ── CROWD SILHOUETTES in passage ── */}
        <GateCrowd
          lx={IP.lx} rx={IP.rx} iy={IP.iy} vH={vH}
          color={color} active={active} side={side}
        />

        {/* Gate bars across passage (dissolve on unlock) */}
        {[0.30, 0.50, 0.68, 0.83].map((f,i) => (
          <motion.line key={i}
            x1={IP.lx+3} y1={IP.iy+(vH-IP.iy)*f}
            x2={IP.rx-3} y2={IP.iy+(vH-IP.iy)*f}
            stroke={`rgba(${color},${active?0.18:0.05})`} strokeWidth="2.5"
            animate={{ opacity: unlockOpen ? 0 : 1 }}
            transition={{ duration:0.30, delay:i*0.04 }}
          />
        ))}
        {[0.2,0.4,0.6,0.8].map((f,i) => (
          <motion.line key={i}
            x1={IP.lx+(IP.rx-IP.lx)*f} y1={IP.iy+10}
            x2={IP.lx+(IP.rx-IP.lx)*f} y2={vH}
            stroke={`rgba(${color},${active?0.09:0.03})`} strokeWidth="1.5"
            animate={{ opacity: unlockOpen ? 0 : 1 }}
            transition={{ duration:0.30, delay:i*0.04 }}
          />
        ))}

        {/* ── LEFT PILLAR ── */}
        <rect x={OP.lx} y={OP.py} width={OP.pw} height={vH-OP.py}
          fill={`url(#pg${side})`} rx="2" />
        {/* Pillar highlight edges */}
        <line x1={OP.lx}         y1={OP.py} x2={OP.lx}         y2={vH}
          stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
        <line x1={OP.lx+OP.pw}   y1={OP.py} x2={OP.lx+OP.pw}   y2={vH}
          stroke="rgba(0,0,0,0.50)"       strokeWidth="0.8" />
        {/* Pillar accent ring */}
        {[0.22,0.50,0.76].map((f,i)=>(
          <motion.rect key={i}
            x={OP.lx+2} y={OP.py+(vH-OP.py)*f} width={OP.pw-4} height="3" rx="1"
            fill={`rgba(${color},0.30)`}
            animate={{ opacity: active ? 1 : 0.25 }}
            transition={{ duration:0.50 }}
          />
        ))}

        {/* ── RIGHT PILLAR ── */}
        <rect x={OP.rx} y={OP.py} width={OP.pw} height={vH-OP.py}
          fill={`url(#pg${side})`} rx="2" />
        <line x1={OP.rx}         y1={OP.py} x2={OP.rx}         y2={vH}
          stroke="rgba(0,0,0,0.50)"       strokeWidth="0.8" />
        <line x1={OP.rx+OP.pw}   y1={OP.py} x2={OP.rx+OP.pw}   y2={vH}
          stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
        {[0.22,0.50,0.76].map((f,i)=>(
          <motion.rect key={i}
            x={OP.rx+2} y={OP.py+(vH-OP.py)*f} width={OP.pw-4} height="3" rx="1"
            fill={`rgba(${color},0.30)`}
            animate={{ opacity: active ? 1 : 0.25 }}
            transition={{ duration:0.50 }}
          />
        ))}

        {/* ── ARCH CROWN — curved structural frame ── */}
        {/* The ring between outer and inner arches */}
        <path
          d={`M ${OP.lx} ${OP.py}
              Q ${OP.lx} ${OP.cy} 160 ${OP.cy - 10}
              Q ${OP.rx+OP.pw} ${OP.cy} ${OP.rx+OP.pw} ${OP.py}
              L ${IP.rx} ${IP.iy}
              Q ${IP.rx} ${IP.cy} 160 ${IP.cy - 8}
              Q ${IP.lx} ${IP.cy} ${IP.lx} ${IP.iy}
              Z`}
          fill={`url(#ag${side})`}
        />
        {/* Arch crown outer edge — glowing line */}
        <motion.path
          d={`M ${OP.lx} ${OP.py} Q ${OP.lx} ${OP.cy} 160 ${OP.cy-10} Q ${OP.rx+OP.pw} ${OP.cy} ${OP.rx+OP.pw} ${OP.py}`}
          fill="none"
          stroke={`rgba(${color},0.60)`} strokeWidth="1.2"
          animate={{ opacity: active ? 1 : 0.22 }}
          transition={{ duration:0.50 }}
        />
        {/* Arch crown inner edge */}
        <path
          d={`M ${IP.lx} ${IP.iy} Q ${IP.lx} ${IP.cy} 160 ${IP.cy-8} Q ${IP.rx} ${IP.cy} ${IP.rx} ${IP.iy}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth="0.8"
        />

        {/* ── SIGN PANEL at crown ── */}
        <rect x="80" y={OP.cy+8} width="160" height="28"
          fill={isNeutral ? "rgba(180,140,20,0.95)" : "rgba(6,9,18,0.97)"} rx="5" />
        <motion.rect x="80" y={OP.cy+8} width="160" height="28" fill="none" rx="5"
          stroke={`rgba(${color},0.55)`} strokeWidth="1.2"
          animate={{ opacity: active ? 1 : 0.32 }}
          transition={{ duration:0.50 }}
        />

        {/* ── FLOODLIGHT ARMS ── slim, elegant ── */}
        <line x1={outerLeft}  y1={OP.py+12} x2={outerLeft-24}  y2={12}
          stroke={isNeutral ? "rgba(160,120,20,0.97)" : "rgba(16,22,38,0.97)"} strokeWidth="4.5" strokeLinecap="round" />
        <line x1={outerRight} y1={OP.py+12} x2={outerRight+24} y2={12}
          stroke={isNeutral ? "rgba(160,120,20,0.97)" : "rgba(16,22,38,0.97)"} strokeWidth="4.5" strokeLinecap="round" />
        {/* Floodlight heads */}
        <motion.ellipse cx={outerLeft-26}  cy="10" rx="15" ry="8"
          fill={isNeutral ? "rgba(180,140,30,0.97)" : "rgba(18,24,40,0.97)"}
          animate={{ filter: active?`drop-shadow(0 0 8px rgba(${color},0.85))`:"none" }}
          transition={{ duration:0.45 }}
        />
        <motion.ellipse cx={outerRight+26} cy="10" rx="15" ry="8"
          fill={isNeutral ? "rgba(180,140,30,0.97)" : "rgba(18,24,40,0.97)"}
          animate={{ filter: active?`drop-shadow(0 0 8px rgba(${color},0.85))`:"none" }}
          transition={{ duration:0.45 }}
        />
        <motion.ellipse cx={outerLeft-26}  cy="8" rx="7" ry="4"
          fill={`rgba(${color},0.92)`}
          animate={{ opacity: active ? 1 : 0.30 }} transition={{ duration:0.45 }}
        />
        <motion.ellipse cx={outerRight+26} cy="8" rx="7" ry="4"
          fill={`rgba(${color},0.92)`}
          animate={{ opacity: active ? 1 : 0.30 }} transition={{ duration:0.45 }}
        />
        {/* Lens glow rings */}
        <motion.circle cx={outerLeft-26}  cy="8" r="12"
          fill="none" stroke={`rgba(${color},0.45)`} strokeWidth="1"
          animate={{ opacity: active ? 0.90 : 0 }} transition={{ duration:0.45 }}
        />
        <motion.circle cx={outerRight+26} cy="8" r="12"
          fill="none" stroke={`rgba(${color},0.45)`} strokeWidth="1"
          animate={{ opacity: active ? 0.90 : 0 }} transition={{ duration:0.45 }}
        />
      </svg>

      {/* ── Sign text — HTML overlay at arch crown ── */}
      <div style={{
        position:"absolute",
        top    : `${((OP.cy+8)/vH) * H}px`,
        left   : `${(80/vW) * W}px`,
        width  : `${(160/vW) * W}px`,
        height : `${(28/vH) * H}px`,
        display:"flex", alignItems:"center", justifyContent:"center",
        pointerEvents:"none",
        gap:6,
      }}>
        <motion.span
          animate={{
            color    : active ? `rgb(${color})` : "rgba(255,255,255,0.52)",
            textShadow: active ? `0 0 20px rgba(${color},0.85)` : "none",
          }}
          transition={{ duration:0.40 }}
          style={{ fontSize:`${W * 0.070}px`, fontWeight:900, letterSpacing:"0.10em" }}
        >
          {teamCode}
        </motion.span>
      </div>

      {/* ── Hanging banners ── */}
      {[0,1].map(i=>(
        <ArchBanner key={`L${i}`} pillar="left"  index={i}
          color={color} active={active} erupting={erupting} W={W} H={H} vW={vW} vH={vH} />
      ))}
      {[0,1].map(i=>(
        <ArchBanner key={`R${i}`} pillar="right" index={i}
          color={color} active={active} erupting={erupting} W={W} H={H} vW={vW} vH={vH} />
      ))}

      {/* ── Gate smoke ── */}
      <GateSmoke color={color} active={active} erupting={erupting} W={W} />

      {/* ── Waving flag above arch ── */}
      <motion.div
        animate={{ opacity: gatesReady ? 1 : 0 }}
        transition={{ duration:0.60, delay: gatesReady ? floatDelay+0.3 : 0 }}
        style={{
          position:"absolute", top:-78, left:"50%",
          transform:"translateX(-50%)",
          display:"flex", alignItems:"flex-start", gap:0,
          pointerEvents:"none",
        }}
      >
        <div style={{
          width:3, height:52, flexShrink:0,
          background:"linear-gradient(180deg, rgba(255,255,255,0.50) 0%, rgba(255,255,255,0.18) 100%)",
          borderRadius:"1px 1px 0 0",
        }}/>
        <motion.img
          src={`https://flagcdn.com/w40/${flagCode}.png`}
          width={large ? 44 : 32}
          height={large ? 29 : 21}
          animate={{ skewX: [0, -5, 1, -3, 0, -4, 0] }}
          transition={{ duration: 2.8, repeat:Infinity, ease:"easeInOut" }}
          style={{
            display:"block", objectFit:"cover",
            borderRadius:"0 2px 2px 0",
            boxShadow:`0 2px 10px rgba(0,0,0,0.60), 0 0 12px rgba(${color},0.35)`,
            transformOrigin:"0% 50%",
            marginTop:4,
          }}
          alt={teamCode}
        />
      </motion.div>

      {/* ── Team name label above arch ── */}
      <motion.div
        animate={{ opacity: gatesReady ? (active ? 0.75 : 0.26) : 0 }}
        transition={{ duration:0.55, delay: gatesReady ? floatDelay+0.5 : 0 }}
        style={{
          position:"absolute", top:-26, left:"50%", transform:"translateX(-50%)",
          fontSize:"0.42rem", letterSpacing:"0.22em",
          color: active ? `rgb(${color})` : "rgba(255,255,255,0.28)",
          textShadow: active ? `0 0 14px rgba(${color},0.65)` : "none",
          transition:"color 0.40s, text-shadow 0.40s",
          whiteSpace:"nowrap", pointerEvents:"none",
        }}
      >
        {teamName.toUpperCase()}
      </motion.div>

      {/* ── Tagline below gate ── */}
      <motion.div
        animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 6 }}
        transition={{ duration:0.26 }}
        style={{
          position:"absolute", bottom:-52, left:"50%",
          transform:"translateX(-50%)",
          whiteSpace:"nowrap", textAlign:"center", pointerEvents:"none",
        }}
      >
        <div style={{
          fontSize:"0.60rem", fontWeight:800, letterSpacing:"0.10em",
          color:`rgb(${color})`,
          textShadow:`0 0 18px rgba(${color},0.68), 0 2px 8px rgba(0,0,0,0.80)`,
          marginBottom:4,
        }}>
          {tagline}
        </div>
        <div style={{ fontSize:"0.38rem", letterSpacing:"0.20em",
                      color:"rgba(255,255,255,0.36)" }}>
          ENTER THIS STAND →
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── GateCrowd ────────────────────────────────────────────────────────────────
// Crowd silhouettes visible through the arch passage.
function GateCrowd({ lx,rx,iy,vH, color, active, side }: {
  lx:number; rx:number; iy:number; vH:number;
  color:string; active:boolean; side:SupporterTeam;
}) {
  const figures = useMemo(()=>
    Array.from({length:30},(_,i)=>{
      const s  = ((i*9301+233+side.charCodeAt(0)*17) % 1000)/1000;
      const s2 = ((i*7919+11 +side.charCodeAt(0)*23) % 1000)/1000;
      return { x:lx+5+s*(rx-lx-10), h:12+s2*14, w:5+s*5 };
    })
  ,[lx,rx,side]);

  return (
    <g>
      {figures.map((f,i)=>(
        <g key={i} opacity={active ? 0.55 : 0.18} style={{ transition:"opacity 0.5s" }}>
          <rect x={f.x} y={iy+(vH-iy)*0.50-f.h} width={f.w} height={f.h}
            rx={f.w/2} fill={`rgba(${color},0.35)`} />
          <circle cx={f.x+f.w/2} cy={iy+(vH-iy)*0.50-f.h-4} r={f.w/2+1}
            fill={`rgba(${color},0.28)`} />
        </g>
      ))}
      <defs>
        <linearGradient id={`crowdFadeG${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.96)" />
          <stop offset="90%"  stopColor="rgba(0,0,0,0.0)"  />
        </linearGradient>
      </defs>
      <rect x={lx} y={iy} width={rx-lx} height={(vH-iy)*0.55}
        fill={`url(#crowdFadeG${side})`} />
    </g>
  );
}

// ─── ArchBanner ──────────────────────────────────────────────────────────────
// Elegant fabric banner hanging from the pillar.
function ArchBanner({ pillar,index,color,active,erupting,W,H,vW,vH }: {
  pillar:"left"|"right"; index:number; color:string;
  active:boolean; erupting:boolean;
  W:number; H:number; vW:number; vH:number;
}) {
  const isLeft = pillar==="left";
  // Position: attached to outer edge of pillar, below arch
  const bX = ((isLeft ? 2 : 288) / vW) * W;
  const bY = ((140 + index * 88) / vH) * H;
  const bW = (20 / vW) * W;
  const bH = (66 / vH) * H;
  const waveDur = erupting ? 0.28 : active ? 0.70 : 2.4;

  return (
    <motion.div
      animate={{ rotate: [0, isLeft?5:-5, 0, isLeft?3.5:-3.5, 0] }}
      transition={{ duration: waveDur + index*0.12, repeat:Infinity, ease:"easeInOut" }}
      style={{
        position:"absolute", left:bX, top:bY,
        width:bW, height:bH,
        transformOrigin:`${isLeft?"0%":"100%"} 0%`,
        background:`linear-gradient(180deg,
          rgba(${color},${active?0.90:0.38}) 0%,
          rgba(${color},${active?0.65:0.22}) 100%)`,
        border:`1px solid rgba(${color},${active?0.55:0.16})`,
        boxShadow: active ? `0 2px 14px rgba(${color},0.38)` : "none",
        transition:"background 0.45s, box-shadow 0.45s, border-color 0.45s",
        pointerEvents:"none",
      }}
    >
      <div style={{
        position:"absolute", top:"32%", left:0, right:0, height:2,
        background:`rgba(255,255,255,${active?0.20:0.05})`,
        transition:"background 0.45s",
      }} />
    </motion.div>
  );
}

// ─── GateSmoke ────────────────────────────────────────────────────────────────
function GateSmoke({ color, active, erupting, W }: {
  color:string; active:boolean; erupting:boolean; W:number;
}) {
  const puffs = useMemo(()=>
    Array.from({length:6},(_,i)=>({
      left:`${10+i*14}%`, dur:2.8+i*0.38,
      delay:i*0.30, size:28+(i%3)*14,
    }))
  ,[]);

  return (
    <div style={{
      position:"absolute", bottom:-14, left:0, width:W, height:55,
      pointerEvents:"none", overflow:"hidden",
    }}>
      {puffs.map((p,i)=>(
        <motion.div key={i}
          animate={{
            y      :[0,erupting?-32:-18,erupting?-60:-34],
            opacity:[0,erupting?0.65:active?0.48:0.14,0],
            scale  :[0.55,1.05,1.55],
          }}
          transition={{ duration:erupting?p.dur*0.58:p.dur, repeat:Infinity, delay:p.delay, ease:"easeOut" }}
          style={{
            position:"absolute", bottom:0, left:p.left,
            width:p.size, height:p.size,
            borderRadius:"50%",
            background:`rgba(${color},0.22)`,
            filter:"blur(12px)",
          }}
        />
      ))}
    </div>
  );
}

// ─── RushLines ────────────────────────────────────────────────────────────────
function RushLines({ color }: { color:string }) {
  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      transition={{ duration:0.18 }}
      style={{ position:"absolute", inset:0, zIndex:81, pointerEvents:"none" }}
    >
      <svg viewBox="0 0 1000 600"
           style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
        {Array.from({length:20},(_,i)=>{
          const a=(i/20)*Math.PI*2;
          const d=330+(i%4)*55;
          return (
            <motion.line key={i}
              x1="500" y1="300" x2={500+Math.cos(a)*d} y2={300+Math.sin(a)*d}
              stroke={`rgba(${color},0.14)`} strokeWidth={0.8+(i%3)*0.4}
              animate={{ pathLength:[0,1,0], opacity:[0,0.65,0] }}
              transition={{ duration:0.46, repeat:Infinity, delay:i*0.024, ease:"easeOut" }}
            />
          );
        })}
        {[78,165,260].map((r,i)=>(
          <motion.circle key={i} cx="500" cy="300" r={r}
            fill="none" stroke={`rgba(${color},0.07)`} strokeWidth={1.3-i*0.28}
            animate={{ scale:[1.8,0.1], opacity:[0,0.30,0] }}
            transition={{ duration:0.60, repeat:Infinity, delay:i*0.18, ease:"easeIn" }}
            style={{ transformOrigin:"500px 300px" }}
          />
        ))}
      </svg>
      <motion.div
        animate={{ scale:[0.2,1.5,0.2], opacity:[0,0.80,0] }}
        transition={{ duration:0.75, repeat:Infinity, ease:"easeInOut" }}
        style={{
          position:"absolute", top:"50%", left:"50%",
          width:180, height:180, transform:"translate(-50%,-50%)",
          borderRadius:"50%",
          background:`radial-gradient(ellipse at center,
            rgba(255,255,255,0.88) 0%,
            rgba(${color},0.45) 48%,
            transparent 75%)`,
          filter:"blur(6px)",
        }}
      />
    </motion.div>
  );
}

// ─── BannerFlash ─────────────────────────────────────────────────────────────
function BannerFlash({ text, color }: { text:string; color:string }) {
  return (
    <motion.div
      initial={{ opacity:0, y:-52, scaleX:0.88 }}
      animate={{ opacity:1,  y:0,   scaleX:1    }}
      exit={{    opacity:0,  y:58,  scaleX:0.92 }}
      transition={{ duration:0.24, ease:[0.16,1,0.3,1] }}
      style={{
        position:"fixed", top:"9%", left:0, right:0, zIndex:90,
        display:"flex", flexDirection:"column", alignItems:"center",
        pointerEvents:"none",
      }}
    >
      <div style={{
        background    :`rgba(${color},0.13)`,
        backdropFilter:"blur(6px)",
        borderTop     :`2px solid rgba(${color},0.52)`,
        borderBottom  :`2px solid rgba(${color},0.52)`,
        padding:"18px 80px", position:"relative",
      }}>
        {[-32,-12,12,32].map(p=>(
          <div key={p} style={{
            position:"absolute", top:-9,
            left:`${50+p}%`, width:1, height:9,
            background:`rgba(${color},0.35)`,
          }} />
        ))}
        <div style={{
          fontSize:"clamp(2rem,5.5vw,3.8rem)", fontWeight:900,
          letterSpacing:"0.14em", color:`rgb(${color})`,
          textShadow:`0 0 38px rgba(${color},0.85), 0 0 75px rgba(${color},0.32)`,
          whiteSpace:"nowrap",
        }}>
          {text}
        </div>
      </div>
    </motion.div>
  );
}
