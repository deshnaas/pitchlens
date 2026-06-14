"use client";

/**
 * MatchSelectionScreen
 *
 * The cinematic gateway between role selection and match analysis.
 * The video is NOT a background — it is the world the user has entered.
 * Cards are physical objects suspended inside that world.
 *
 * Phase sequence:
 *   cinema   (0–1800ms)   — video breathes. no UI. absorption.
 *   ring     (1800–2800ms) — investigation ring materialises at center
 *   cards    (2800ms+)    — 6 match cards glide into elliptical orbit
 *   selected              — card becomes portal, world enters transition
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { POV } from "@/lib/incidents/types";

// ── POV palettes ─────────────────────────────────────────────────────────────

const POV_PALETTE = {
  referee : { accent: "168,196,224", hex: "#a8c4e0" },
  fan     : { accent: "126,207,160", hex: "#7ecfa0" },
  supporter: { accent: "232,168,124", hex: "#e8a87c" },
};

// ── Match data ────────────────────────────────────────────────────────────────

interface FeaturedMatch {
  id       : string;
  title    : string;
  home     : string;
  homeflag : string;
  away     : string;
  awayflag : string;
  energyA  : string;   // rgba prefix for environment color A
  energyB  : string;   // rgba prefix for environment color B
  angle    : number;   // polar angle in degrees (0=right, -90=top)
  available: boolean;
}

const FEATURED: FeaturedMatch[] = [
  {
    id: "japan-spain",      title: "The Goal Line Incident",
    home: "JAPAN",          homeflag: "🇯🇵",
    away: "SPAIN",          awayflag: "🇪🇸",
    energyA: "rgba(0,55,190,",   energyB: "rgba(190,18,28,",
    angle: -90, available: true,
  },
  {
    id: "germany-japan",    title: "The Giant Killer",
    home: "GERMANY",        homeflag: "🇩🇪",
    away: "JAPAN",          awayflag: "🇯🇵",
    energyA: "rgba(55,55,55,",   energyB: "rgba(0,55,190,",
    angle: -30, available: false,
  },
  {
    id: "portugal-ghana",   title: "Ronaldo's Historic Night",
    home: "PORTUGAL",       homeflag: "🇵🇹",
    away: "GHANA",          awayflag: "🇬🇭",
    energyA: "rgba(175,18,18,",  energyB: "rgba(185,145,0,",
    angle: 30, available: false,
  },
  {
    id: "england-wales",    title: "The Derby",
    home: "ENGLAND",        homeflag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    away: "WALES",          awayflag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
    energyA: "rgba(200,200,200,", energyB: "rgba(175,18,18,",
    angle: 90, available: false,
  },
  {
    id: "belgium-croatia",  title: "Group Finale Drama",
    home: "BELGIUM",        homeflag: "🇧🇪",
    away: "CROATIA",        awayflag: "🇭🇷",
    energyA: "rgba(195,88,0,",   energyB: "rgba(170,14,35,",
    angle: 150, available: false,
  },
  {
    id: "iran-usa",         title: "The Political Match",
    home: "IRAN",           homeflag: "🇮🇷",
    away: "UNITED STATES",  awayflag: "🇺🇸",
    energyA: "rgba(0,130,40,",   energyB: "rgba(0,38,175,",
    angle: 210, available: false,
  },
];

// Elliptical orbit — wider than tall to match landscape screen
const RX = 370; // horizontal radius px
const RY = 200; // vertical radius px

function polarToCard(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.round(Math.cos(rad) * RX),
    y: Math.round(Math.sin(rad) * RY),
  };
}

const ARCHIVE = [
  { id: "arg-ksa",  home: "ARGENTINA",   homeflag: "🇦🇷", away: "SAUDI ARABIA", awayflag: "🇸🇦", title: "The Biggest Upset"       },
  { id: "bra-ser",  home: "BRAZIL",       homeflag: "🇧🇷", away: "SERBIA",        awayflag: "🇷🇸", title: "Richarlison's Bicycle"   },
  { id: "fra-aus",  home: "FRANCE",       homeflag: "🇫🇷", away: "AUSTRALIA",     awayflag: "🇦🇺", title: "Les Bleus Awaken"        },
  { id: "ned-sen",  home: "NETHERLANDS",  homeflag: "🇳🇱", away: "SENEGAL",       awayflag: "🇸🇳", title: "Late Dutch Drama"        },
  { id: "qat-ecu",  home: "QATAR",        homeflag: "🇶🇦", away: "ECUADOR",       awayflag: "🇪🇨", title: "Host Nation Falls"       },
  { id: "usa-wal",  home: "USA",          homeflag: "🇺🇸", away: "WALES",         awayflag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", title: "Atlantic Standoff"       },
  { id: "mar-bel",  home: "MOROCCO",      homeflag: "🇲🇦", away: "BELGIUM",       awayflag: "🇧🇪", title: "Atlas Lions Strike"      },
  { id: "kor-por",  home: "SOUTH KOREA",  homeflag: "🇰🇷", away: "PORTUGAL",      awayflag: "🇵🇹", title: "Hwang's Miracle"         },
  { id: "aus-den",  home: "AUSTRALIA",    homeflag: "🇦🇺", away: "DENMARK",       awayflag: "🇩🇰", title: "Socceroos Advance"       },
  { id: "gha-kor",  home: "GHANA",        homeflag: "🇬🇭", away: "SOUTH KOREA",   awayflag: "🇰🇷", title: "African Thriller"        },
  { id: "sui-ser",  home: "SWITZERLAND",  homeflag: "🇨🇭", away: "SERBIA",        awayflag: "🇷🇸", title: "Xhaka's Statement"       },
  { id: "mex-pol",  home: "MEXICO",       homeflag: "🇲🇽", away: "POLAND",        awayflag: "🇵🇱", title: "Ochoa's Wall"            },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  pov     : POV;
  onSelect: (matchId: string) => void;
  onBack  : () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatchSelectionScreen({ pov, onSelect, onBack }: Props) {
  const [phase,      setPhase]      = useState<"cinema" | "ring" | "cards" | "transitioning">("cinema");
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const palette = POV_PALETTE[pov];
  const acc     = `rgba(${palette.accent},`;

  // Phase progression
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("ring"),  1800);
    const t2 = setTimeout(() => setPhase("cards"), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleSelect = (match: FeaturedMatch) => {
    if (!match.available || phase === "transitioning") return;
    setSelectedId(match.id);
    setPhase("transitioning");
    setTimeout(() => onSelect(match.id), 2200);
  };

  const hoveredMatch = FEATURED.find(m => m.id === hoveredId) ?? null;
  const isTransitioning = phase === "transitioning";
  const showCards       = phase === "cards" || isTransitioning;

  return (
    <div
      style={{
        height          : "100vh",
        overflowY       : "auto",
        overflowX       : "hidden",
        background      : "#020408",
        fontFamily      : "var(--font-inter), Inter, sans-serif",
        cursor          : "none",
        scrollbarWidth  : "none",
      }}
    >

      {/* ══ HERO — full-screen environment ══════════════════════════════════ */}
      <section
        style={{
          position : "relative",
          width    : "100%",
          height   : "100vh",
          overflow : "hidden",
          flexShrink: 0,
        }}
      >

        {/* The world — not a background, the stage itself */}
        <motion.video
          ref={videoRef}
          autoPlay muted loop playsInline
          initial={{ scale: 1.06, opacity: 0 }}
          animate={{ scale: 1.02, opacity: 1 }}
          transition={{ duration: 2.8, ease: "easeOut" }}
          style={{
            position  : "absolute",
            inset     : 0,
            width     : "100%",
            height    : "100%",
            objectFit : "cover",
            willChange: "transform",
          }}
          src="/videos/match-selection-bg.mp4"
        />

        {/* World scrim — lets depth breathe, doesn't kill the image */}
        <div style={{
          position  : "absolute",
          inset     : 0,
          background: "radial-gradient(ellipse at 50% 45%, rgba(1,3,12,0.28) 0%, rgba(1,3,12,0.60) 100%)",
          pointerEvents: "none",
        }} />

        {/* Bottom vignette — grounds the cards */}
        <div style={{
          position  : "absolute",
          bottom    : 0,
          left      : 0,
          right     : 0,
          height    : "35%",
          background: "linear-gradient(to top, rgba(2,4,14,0.72) 0%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* ── Environmental energy — world reacts to hover ── */}
        <AnimatePresence>
          {hoveredMatch && !isTransitioning && (
            <motion.div
              key={hoveredMatch.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              {/* Team A energy — from card's orbital position */}
              <div style={{
                position  : "absolute",
                inset     : 0,
                background: `radial-gradient(ellipse at ${
                  50 + Math.cos(hoveredMatch.angle * Math.PI / 180) * 32
                }% ${
                  50 + Math.sin(hoveredMatch.angle * Math.PI / 180) * 26
                }%, ${hoveredMatch.energyA}0.28) 0%, transparent 58%)`,
              }} />
              {/* Team B energy — from opposite direction */}
              <div style={{
                position  : "absolute",
                inset     : 0,
                background: `radial-gradient(ellipse at ${
                  50 - Math.cos(hoveredMatch.angle * Math.PI / 180) * 32
                }% ${
                  50 - Math.sin(hoveredMatch.angle * Math.PI / 180) * 26
                }%, ${hoveredMatch.energyB}0.20) 0%, transparent 54%)`,
              }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Transition void — world collapses when entering match ── */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, ease: "easeIn" }}
              style={{
                position  : "absolute",
                inset     : 0,
                background: "rgba(0,1,8,0.90)",
                zIndex    : 10,
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Back button ── */}
        <AnimatePresence>
          {!isTransitioning && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 2.2, duration: 0.6 }}
              onClick={onBack}
              style={{
                position    : "absolute",
                top         : 24,
                left        : 28,
                zIndex      : 30,
                background  : "none",
                border      : "none",
                padding     : 0,
                cursor      : "none",
                color       : `${acc}0.36)`,
                fontSize    : "0.7rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontFamily  : "inherit",
                transition  : "color 0.3s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = `${acc}0.70)`)}
              onMouseLeave={e => (e.currentTarget.style.color = `${acc}0.36)`)}
            >
              ← Return
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── POV + role label — top right ── */}
        <AnimatePresence>
          {phase !== "cinema" && !isTransitioning && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              style={{
                position    : "absolute",
                top         : 24,
                right       : 28,
                zIndex      : 30,
                textAlign   : "right",
              }}
            >
              <div style={{
                fontSize    : "0.55rem",
                letterSpacing: "0.38em",
                color       : `${acc}0.28)`,
                textTransform: "uppercase",
                fontWeight  : 300,
              }}>
                {pov.toUpperCase()} &nbsp;·&nbsp; SELECT MATCH
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Central investigation ring ── */}
        <CentralRing
          phase={phase}
          accent={palette.accent}
        />

        {/* ── Floating match cards — orbital formation ── */}
        {FEATURED.map((match, i) => {
          const pos = polarToCard(match.angle);
          return (
            <MatchCard
              key={match.id}
              match={match}
              pos={pos}
              index={i}
              showCards={showCards}
              isTransitioning={isTransitioning}
              hoveredId={hoveredId}
              selectedId={selectedId}
              accent={palette.accent}
              onHover={id => { if (!isTransitioning) setHoveredId(id); }}
              onClick={() => handleSelect(match)}
            />
          );
        })}

        {/* ── Scroll hint — appears after cards settle ── */}
        <AnimatePresence>
          {phase === "cards" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 3.5, duration: 1 }}
              style={{
                position    : "absolute",
                bottom      : 26,
                left        : "50%",
                transform   : "translateX(-50%)",
                zIndex      : 20,
                textAlign   : "center",
                pointerEvents: "none",
              }}
            >
              <motion.div
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div style={{
                  fontSize    : "0.5rem",
                  letterSpacing: "0.40em",
                  color       : `${acc}0.32)`,
                  textTransform: "uppercase",
                  marginBottom : 6,
                }}>
                  World Cup Archive Below
                </div>
                <div style={{ color: `${acc}0.22)`, fontSize: "0.65rem" }}>↓</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </section>

      {/* ══ ARCHIVE — below the fold ════════════════════════════════════════ */}
      <ArchiveSection accent={palette.accent} pov={pov} />

    </div>
  );
}

// ── CentralRing ──────────────────────────────────────────────────────────────

function CentralRing({
  phase,
  accent,
}: {
  phase  : string;
  accent : string;
}) {
  const acc        = `rgba(${accent},`;
  const visible    = phase !== "cinema";
  const expanding  = phase === "transitioning";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ring"
          initial={{ opacity: 0, scale: 0.1 }}
          animate={expanding
            ? { opacity: [1, 0], scale: 14 }
            : { opacity: 1,      scale: 1   }
          }
          exit={{ opacity: 0, scale: 0.2 }}
          transition={expanding
            ? { duration: 1.6, ease: [0.16, 1, 0.3, 1] }
            : { duration: 1.2, ease: [0.16, 1, 0.3, 1] }
          }
          style={{
            position     : "absolute",
            left         : "50%",
            top          : "50%",
            transform    : "translate(-50%, -50%)",
            zIndex       : 15,
            pointerEvents: "none",
            width        : 200,
            height       : 200,
          }}
        >
          <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
            {/* Outer static ring */}
            <circle cx="100" cy="100" r="94" stroke={`rgba(${accent},0.10)`} strokeWidth="1" />
            {/* Mid ring */}
            <circle cx="100" cy="100" r="76" stroke={`rgba(${accent},0.06)`} strokeWidth="0.5" />
            {/* Slow rotating dashes — 18s period */}
            <motion.circle
              cx="100" cy="100" r="94"
              stroke={`rgba(${accent},0.28)`}
              strokeWidth="1"
              strokeDasharray="14 32"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "100px 100px" }}
            />
            {/* Fast bright arc — scanning feel */}
            <motion.circle
              cx="100" cy="100" r="94"
              stroke={`rgba(${accent},0.68)`}
              strokeWidth="1.5"
              strokeDasharray="28 350"
              strokeLinecap="round"
              animate={{ rotate: -360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "100px 100px" }}
            />
            {/* Inner slow counter-rotating arc */}
            <motion.circle
              cx="100" cy="100" r="76"
              stroke={`rgba(${accent},0.22)`}
              strokeWidth="0.8"
              strokeDasharray="8 52"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "100px 100px" }}
            />
            {/* Cardinal tick marks */}
            {[0, 90, 180, 270].map(deg => {
              const r  = deg * Math.PI / 180;
              const x1 = 100 + Math.cos(r) * 87;
              const y1 = 100 + Math.sin(r) * 87;
              const x2 = 100 + Math.cos(r) * 94;
              const y2 = 100 + Math.sin(r) * 94;
              return (
                <line key={deg}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={`rgba(${accent},0.50)`} strokeWidth="1.8"
                />
              );
            })}
            {/* Center pulse dot */}
            <motion.circle
              cx="100" cy="100" r="3.5"
              fill={`rgba(${accent},0.50)`}
              animate={{ opacity: [0.25, 0.80, 0.25], scale: [1, 1.3, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "100px 100px" }}
            />
          </svg>

          {/* Soft center glow */}
          <div style={{
            position    : "absolute",
            top         : "50%",
            left        : "50%",
            transform   : "translate(-50%, -50%)",
            width       : 100,
            height      : 100,
            borderRadius: "50%",
            background  : `radial-gradient(circle, rgba(${accent},0.07) 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────
// Card dimensions: 224w × 142h
// Centered at (left: 50% - 112px, top: 50% - 71px) + framer x/y offset

const CARD_W = 224;
const CARD_H = 142;

function MatchCard({
  match, pos, index,
  showCards, isTransitioning,
  hoveredId, selectedId,
  accent, onHover, onClick,
}: {
  match         : FeaturedMatch;
  pos           : { x: number; y: number };
  index         : number;
  showCards     : boolean;
  isTransitioning: boolean;
  hoveredId     : string | null;
  selectedId    : string | null;
  accent        : string;
  onHover       : (id: string | null) => void;
  onClick       : () => void;
}) {
  const isHovered  = hoveredId === match.id;
  const isSelected = selectedId === match.id;
  const isFaded    = selectedId !== null && !isSelected;
  const acc        = `rgba(${accent},`;

  // Entry: fly in from outer orbit direction
  const entryX = Math.round(pos.x * 1.8);
  const entryY = Math.round(pos.y * 1.8);

  // Animate targets
  const targetX     = isSelected ? 0       : pos.x;
  const targetY     = isSelected ? 0       : isHovered ? pos.y - 10 : pos.y;
  const targetScale = isSelected ? 1.52    : isHovered ? 1.055 : 1;
  const targetOpacity = !showCards ? 0 : isFaded ? 0 : 1;
  const targetZ     = isSelected ? 50 : isHovered ? 26 : 20;

  const entryDelay = 0.07 * index;

  return (
    <motion.div
      initial={{ opacity: 0, x: entryX, y: entryY, scale: 0.72 }}
      animate={{
        opacity: targetOpacity,
        x      : targetX,
        y      : targetY,
        scale  : targetScale,
      }}
      transition={
        isSelected
          ? { duration: 0.95, ease: [0.16, 1, 0.3, 1] }
          : isFaded
          ? { duration: 0.50, ease: "easeIn" }
          : {
              opacity: { duration: 0.65, delay: entryDelay },
              x      : { duration: 1.0,  delay: entryDelay, ease: [0.16, 1, 0.3, 1] },
              y      : { duration: isHovered ? 0.35 : 1.0, delay: isHovered ? 0 : entryDelay, ease: [0.16, 1, 0.3, 1] },
              scale  : { duration: isHovered ? 0.30 : 1.0, delay: isHovered ? 0 : entryDelay, ease: "easeOut" },
            }
      }
      style={{
        position : "absolute",
        left     : `calc(50% - ${CARD_W / 2}px)`,
        top      : `calc(50% - ${CARD_H / 2}px)`,
        zIndex   : targetZ,
        width    : CARD_W,
        height   : CARD_H,
        cursor   : "none",
        userSelect: "none",
        willChange: "transform, opacity",
      }}
      onMouseEnter={() => onHover(match.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      {/* ── Card surface — glass panel inside the world ── */}
      <div style={{
        position      : "relative",
        width         : "100%",
        height        : "100%",
        // Glass: lets the stadium video bleed through
        background    : isHovered
          ? "rgba(8,14,34,0.72)"
          : "rgba(4,8,22,0.58)",
        backdropFilter: "blur(18px) saturate(1.4)",
        WebkitBackdropFilter: "blur(18px) saturate(1.4)",
        border        : `1px solid rgba(${accent},${isHovered ? "0.42" : "0.16"})`,
        transition    : "border-color 0.35s, background 0.35s",
        overflow      : "hidden",
        boxShadow     : isHovered
          ? `0 0 0 1px rgba(${accent},0.08) inset, 0 28px 56px rgba(0,0,12,0.55)`
          : `0 0 0 1px rgba(${accent},0.04) inset, 0 12px 32px rgba(0,0,12,0.40)`,
      }}>

        {/* Match energy wash — vivid diagonal gradient, always visible */}
        <div style={{
          position  : "absolute",
          inset     : 0,
          background: `linear-gradient(135deg, ${match.energyA}${isHovered ? "0.22)" : "0.12)"} 0%, transparent 45%, ${match.energyB}${isHovered ? "0.16)" : "0.08)"} 100%)`,
          transition: "background 0.45s",
          pointerEvents: "none",
        }} />

        {/* Top edge accent line */}
        <div style={{
          position  : "absolute",
          top       : 0, left: "8%", right: "8%",
          height    : "1px",
          background: `linear-gradient(90deg, transparent, rgba(${accent},${isHovered ? "0.80" : "0.28"}), transparent)`,
          transition: "background 0.35s",
          pointerEvents: "none",
        }} />

        {/* Title */}
        <div style={{
          padding      : "12px 14px 0",
          fontSize     : "0.54rem",
          letterSpacing: "0.28em",
          color        : `rgba(255,255,255,${isHovered ? "0.72" : "0.45"})`,
          textTransform: "uppercase",
          fontWeight   : 400,
          transition   : "color 0.3s",
          whiteSpace   : "nowrap",
          overflow     : "hidden",
          textOverflow : "ellipsis",
        }}>
          {match.title}
        </div>

        {/* Main matchup */}
        <div style={{
          display       : "flex",
          alignItems    : "center",
          justifyContent: "center",
          gap           : "10px",
          height        : "calc(100% - 50px)",
          padding       : "0 12px",
        }}>

          {/* Home */}
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: "1.6rem", lineHeight: 1, marginBottom: 6 }}>{match.homeflag}</div>
            <div style={{
              fontSize     : "0.62rem",
              letterSpacing: "0.16em",
              color        : `rgba(255,255,255,${isHovered ? "0.92" : "0.72"})`,
              textTransform: "uppercase",
              fontWeight   : 500,
              transition   : "color 0.3s",
            }}>
              {match.home.length > 9 ? match.home.slice(0, 8) + "." : match.home}
            </div>
          </div>

          {/* VS */}
          <div style={{
            flexShrink   : 0,
            fontSize     : "0.58rem",
            letterSpacing: "0.22em",
            color        : `rgba(${accent},${isHovered ? "0.60" : "0.35"})`,
            fontWeight   : 300,
            transition   : "color 0.3s",
            paddingBottom: 2,
          }}>
            VS
          </div>

          {/* Away */}
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontSize: "1.6rem", lineHeight: 1, marginBottom: 6 }}>{match.awayflag}</div>
            <div style={{
              fontSize     : "0.62rem",
              letterSpacing: "0.16em",
              color        : `rgba(255,255,255,${isHovered ? "0.92" : "0.72"})`,
              textTransform: "uppercase",
              fontWeight   : 500,
              transition   : "color 0.3s",
            }}>
              {match.away.length > 9 ? match.away.slice(0, 8) + "." : match.away}
            </div>
          </div>

        </div>

        {/* Bottom status */}
        <div style={{
          position     : "absolute",
          bottom       : 10,
          left         : "50%",
          transform    : "translateX(-50%)",
          fontSize     : "0.48rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color        : match.available
            ? `rgba(${accent},${isHovered ? "0.90" : "0.55"})`
            : `rgba(255,255,255,${isHovered ? "0.26" : "0.18"})`,
          whiteSpace   : "nowrap",
          transition   : "color 0.3s",
          pointerEvents: "none",
        }}>
          {match.available
            ? (isHovered ? "▶  Enter Investigation" : "Available")
            : "Coming Soon"}
        </div>

        {/* Hover outer glow — card pulls toward viewer */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                position    : "absolute",
                inset       : "-2px",
                pointerEvents: "none",
                boxShadow   : `0 0 32px rgba(${accent},0.18), 0 0 80px rgba(${accent},0.08)`,
                borderRadius: "1px",
              }}
            />
          )}
        </AnimatePresence>

        {/* Portal flash on click */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.22, 0] }}
              transition={{ duration: 0.7 }}
              style={{
                position    : "absolute",
                inset       : 0,
                background  : `rgba(${accent},1)`,
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

      </div>
    </motion.div>
  );
}

// ── ArchiveSection ────────────────────────────────────────────────────────────

function ArchiveSection({ accent, pov }: { accent: string; pov: POV }) {
  const acc = `rgba(${accent},`;
  return (
    <section style={{
      background  : "rgba(2,4,12,1)",
      padding     : "80px 64px 120px",
      borderTop   : `1px solid ${acc}0.06)`,
      minHeight   : "60vh",
    }}>

      {/* Section header */}
      <div style={{ marginBottom: 56, textAlign: "center" }}>
        <div style={{
          fontSize    : "0.58rem",
          letterSpacing: "0.44em",
          color       : `${acc}0.26)`,
          textTransform: "uppercase",
          marginBottom: 14,
          fontWeight  : 300,
        }}>
          Qatar 2022
        </div>
        <div style={{
          fontSize    : "1.55rem",
          letterSpacing: "0.18em",
          color       : `${acc}0.65)`,
          fontWeight  : 200,
          textTransform: "uppercase",
        }}>
          World Cup Archive
        </div>
        <div style={{
          width     : 40,
          height    : "1px",
          background: `${acc}0.16)`,
          margin    : "20px auto 0",
        }} />
        <div style={{
          fontSize    : "0.68rem",
          letterSpacing: "0.16em",
          color       : `${acc}0.20)`,
          marginTop   : 14,
          fontWeight  : 300,
        }}>
          {ARCHIVE.length} matches · {pov.charAt(0).toUpperCase() + pov.slice(1)} investigations coming soon
        </div>
      </div>

      {/* Archive grid */}
      <div style={{
        display            : "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
        gap                : "1px",
        background         : `${acc}0.05)`,
        border             : `1px solid ${acc}0.06)`,
      }}>
        {ARCHIVE.map(match => (
          <ArchiveCard key={match.id} match={match} accent={accent} />
        ))}
      </div>

    </section>
  );
}

function ArchiveCard({
  match,
  accent,
}: {
  match : (typeof ARCHIVE)[0];
  accent: string;
}) {
  const [hovered, setHovered] = useState(false);
  const acc = `rgba(${accent},`;

  return (
    <motion.div
      animate={{
        background: hovered ? "rgba(7,13,30,0.98)" : "rgba(3,7,18,0.92)",
      }}
      transition={{ duration: 0.28 }}
      style={{
        padding     : "20px 22px 18px",
        cursor      : "none",
        position    : "relative",
        overflow    : "hidden",
        borderRight : `1px solid ${acc}0.04)`,
        borderBottom: `1px solid ${acc}0.04)`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover accent line */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0, scaleX: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position      : "absolute",
          top           : 0,
          left          : "10%",
          right         : "10%",
          height        : "1px",
          background    : `linear-gradient(90deg, transparent, ${acc}0.35), transparent)`,
          transformOrigin: "center",
          pointerEvents : "none",
        }}
      />

      <div style={{
        fontSize    : "0.48rem",
        letterSpacing: "0.28em",
        color       : `${acc}${hovered ? "0.30)" : "0.16)"}`,
        textTransform: "uppercase",
        marginBottom: 11,
        fontWeight  : 300,
        transition  : "color 0.3s",
      }}>
        {match.title}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "nowrap" }}>
        <span style={{ fontSize: "1.05rem" }}>{match.homeflag}</span>
        <span style={{
          fontSize    : "0.6rem",
          letterSpacing: "0.12em",
          color       : `${acc}${hovered ? "0.62)" : "0.40)"}`,
          fontWeight  : 300,
          transition  : "color 0.3s",
        }}>
          {match.home}
        </span>
        <span style={{
          fontSize    : "0.48rem",
          color       : `${acc}0.16)`,
          letterSpacing: "0.08em",
          flexShrink  : 0,
        }}>
          vs
        </span>
        <span style={{
          fontSize    : "0.6rem",
          letterSpacing: "0.12em",
          color       : `${acc}${hovered ? "0.62)" : "0.40)"}`,
          fontWeight  : 300,
          transition  : "color 0.3s",
        }}>
          {match.away}
        </span>
        <span style={{ fontSize: "1.05rem" }}>{match.awayflag}</span>
      </div>

      <div style={{
        marginTop   : 11,
        fontSize    : "0.46rem",
        letterSpacing: "0.24em",
        color       : "rgba(255,255,255,0.10)",
        textTransform: "uppercase",
      }}>
        Coming Soon
      </div>
    </motion.div>
  );
}
