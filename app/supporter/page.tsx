"use client";

// ─── PitchLens · Supporter World ───────────────────────────────────────────────
// Architecture mirrors Referee exactly.
// Difference: emotion over investigation. Warm amber over clinical blue.
// The user is not choosing a match. They are choosing a memory.
//
// Stage = video.
// Layout: 1 featured top-center + 2×2 flanking side cards + 1 bottom-center.
// Cards are dark glass panels — the video IS the atmosphere.

import { useState, useEffect, useCallback } from "react";
import { useRouter }                         from "next/navigation";
import { motion, AnimatePresence }           from "framer-motion";
import SupporterStoryScreen                  from "@/components/supporter/SupporterStoryScreen";
import AllegianceScene                       from "@/components/supporter/AllegianceScene";
import type { SupporterTeam }               from "@/components/supporter/SupporterStoryScreen";
import { MATCH_META, ALL_MATCHES, ALL_MATCHES as RAW } from "@/lib/matchData";
import { MATCH_NARRATIVES }                  from "@/lib/matchNarratives";
import FlagImg                               from "@/components/ui/FlagImg";

// ─── Match catalogue — emotional story hooks ───────────────────────────────────
// Same six matches as Referee. Different framing: not chapters, but memories.
const MATCHES: {
  id          : string;
  storyHook   : string;   // the emotional teaser shown on the card
  scoreline   : string;   // result — makes it feel real and weighted
  featured    : boolean;
  pos         : { left: string; top: string };
  floatDelay  : number;
}[] = [
  {
    id       : "japan-spain",
    storyHook: "The comeback nobody expected.",
    scoreline: "2 – 1",
    featured : true,
    pos      : { left: "50%", top: "16%" },
    floatDelay: 0,
  },
  {
    id       : "iran-usa",
    storyHook: "One goal. A hero stretchered off.",
    scoreline: "0 – 1",
    featured : false,
    pos      : { left: "21%", top: "40%" },
    floatDelay: 0.5,
  },
  {
    id       : "germany-japan",
    storyHook: "History written at the death.",
    scoreline: "1 – 2",
    featured : false,
    pos      : { left: "79%", top: "40%" },
    floatDelay: 1.0,
  },
  {
    id       : "belgium-croatia",
    storyHook: "The golden generation's farewell.",
    scoreline: "0 – 0",
    featured : false,
    pos      : { left: "21%", top: "64%" },
    floatDelay: 1.5,
  },
  {
    id       : "ghana-portugal",
    storyHook: "Five goals. Pure chaos.",
    scoreline: "3 – 2",
    featured : false,
    pos      : { left: "79%", top: "64%" },
    floatDelay: 2.0,
  },
  {
    id       : "england-wales",
    storyHook: "Swift, merciless, and final.",
    scoreline: "3 – 0",
    featured : false,
    pos      : { left: "50%", top: "83%" },
    floatDelay: 2.5,
  },
];

type WorldStage = "video" | "ring" | "cards";
type Phase      = "select" | "allegiance" | "experience";

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function SupporterPage() {
  const router = useRouter();
  const [phase,           setPhase]       = useState<Phase>("select");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedTeam,    setSelectedTeam]    = useState<SupporterTeam | null>(null);
  const [visitedWorld,    setVisitedWorld]    = useState(false);

  // Restore match + team when returning from MomentViewer BACK button
  useEffect(() => {
    const savedMatch = sessionStorage.getItem("supporter_matchId");
    const savedTeam  = sessionStorage.getItem("supporter_team") as SupporterTeam | null;
    if (savedMatch && savedTeam) {
      setSelectedMatchId(savedMatch);
      setSelectedTeam(savedTeam);
      setPhase("experience");
      setVisitedWorld(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase: allegiance — choose your side
  if (phase === "allegiance" && selectedMatchId) {
    const meta = MATCH_META[selectedMatchId];
    if (meta) {
      return (
        <AllegianceScene
          match={meta}
          onSelect={(team) => { setSelectedTeam(team); setPhase("experience"); }}
          onBack={() => setPhase("select")}
        />
      );
    }
  }

  // Phase: experience — relive the match from chosen perspective
  if (phase === "experience" && selectedMatchId && selectedTeam) {
    const narrative = MATCH_NARRATIVES[selectedMatchId];
    const meta      = MATCH_META[selectedMatchId];
    if (narrative && meta) {
      return (
        <SupporterStoryScreen
          match={meta}
          team={selectedTeam}
          narrative={narrative}
          rawEvents={RAW[selectedMatchId] ?? []}
          onBack={() => setPhase("select")}
        />
      );
    }
  }

  return (
    <SupporterWorld
      skipIntro={visitedWorld}
      onSelect={(id) => { setVisitedWorld(true); setSelectedMatchId(id); setPhase("allegiance"); }}
      onBack={() => router.push("/?portals=true")}
    />
  );
}

// ─── Supporter World ───────────────────────────────────────────────────────────
function SupporterWorld({ onSelect, onBack, skipIntro = false }: {
  onSelect  : (id: string) => void;
  onBack    : () => void;
  skipIntro ?: boolean;
}) {
  const [worldStage, setWorldStage] = useState<WorldStage>(skipIntro ? "cards" : "video");
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | null>(null);

  useEffect(() => {
    if (skipIntro) return;
    const t1 = setTimeout(() => setWorldStage("ring"),  3200);
    const t2 = setTimeout(() => setWorldStage("cards"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [skipIntro]);

  const handleSelect = useCallback((id: string) => {
    if (enteringId) return;
    setEnteringId(id);
    setTimeout(() => onSelect(id), 860);
  }, [enteringId, onSelect]);

  const cardsReady = worldStage === "cards";

  return (
    <div
      className="fixed inset-0"
      style={{ background: "#000", fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      {/* ══ STAGE — supporter cinematic ══════════════════════════════════════════ */}
      <video
        autoPlay muted loop playsInline preload="auto"
        onError={() => setWorldStage("cards")}
        onStalled={() => setTimeout(() => setWorldStage("cards"), 2500)}
        style={{
          position  : "absolute",
          inset     : 0,
          width     : "100%",
          height    : "100%",
          objectFit : "cover",
          filter    : enteringId
            ? "brightness(0.10) saturate(0.2)"
            : "brightness(0.52) saturate(0.85)",
          transition: "filter 0.85s ease",
        }}
      >
        <source src="/videos/supporter-cinematic.mp4" type="video/mp4" />
      </video>

      {/* Edge vignette */}
      <div style={{
        position     : "absolute",
        inset        : 0,
        pointerEvents: "none",
        background   :
          "radial-gradient(ellipse 95% 90% at 50% 50%, transparent 20%, rgba(0,0,0,0.38) 62%, rgba(0,0,0,0.90) 100%)",
      }} />

      {/* Warm amber atmospheric tint — the stadium breathes emotion */}
      <div style={{
        position     : "absolute",
        inset        : 0,
        pointerEvents: "none",
        background   : "radial-gradient(ellipse 70% 55% at 50% 60%, rgba(200,110,30,0.08) 0%, transparent 70%)",
      }} />

      {/* ══ RING — warm amber instead of clinical blue ═══════════════════════════ */}
      <AnimatePresence>
        {worldStage !== "video" && (
          <EmotionRing
            entering={!!enteringId}
            hoveredId={hoveredId}
          />
        )}
      </AnimatePresence>

      {/* ══ MEMORY CARDS ═════════════════════════════════════════════════════════ */}
      {MATCHES.map((match, i) => {
        const meta = MATCH_META[match.id];
        if (!meta) return null;

        const isThis   = enteringId === match.id;
        const isRecede = !!enteringId && !isThis;
        const isHov    = hoveredId === match.id && !enteringId;

        return (
          <motion.div
            key={match.id}
            style={{
              position  : "absolute",
              left      : match.pos.left,
              top       : match.pos.top,
              translateX: "-50%",
              translateY: "-50%",
              zIndex    : isThis ? 50 : 20,
            }}
            initial={{ opacity: 0, scale: 0.78, y: 20, filter: "blur(8px)" }}
            animate={
              !cardsReady
                ? { opacity: 0,    scale: 0.78, y: 20,  filter: "blur(8px)"  }
                : isThis
                ? { opacity: 1,    scale: 1.06, y: -12, filter: "blur(0px)"  }
                : isRecede
                ? { opacity: 0,    scale: 0.88, y: 14,  filter: "blur(4px)"  }
                : { opacity: 1,    scale: 1,    y: 0,   filter: "blur(0px)"  }
            }
            transition={{
              duration: 0.72,
              delay   : cardsReady && !enteringId ? i * 0.08 : 0,
              ease    : [0.16, 1, 0.3, 1],
            }}
          >
            <motion.div
              animate={isHov ? {} : { y: [0, match.featured ? -4 : -3, 0] }}
              transition={{
                duration: 5.2 + match.floatDelay * 0.2,
                repeat  : Infinity,
                ease    : "easeInOut",
                delay   : match.floatDelay,
              }}
            >
              <MemoryCard
                match={match}
                meta={meta}
                isHovered={isHov}
                isEntering={isThis}
                onHover={setHoveredId}
                onSelect={handleSelect}
              />
            </motion.div>
          </motion.div>
        );
      })}

      {/* ══ HEADER BREADCRUMB ════════════════════════════════════════════════════ */}
      <motion.div
        style={{
          position      : "absolute",
          top           : 0, left: 0, right: 0,
          zIndex        : 60,
          display       : "flex",
          alignItems    : "center",
          justifyContent: "space-between",
          padding       : "0 28px",
          height        : 44,
          background    : "linear-gradient(180deg, rgba(0,0,0,0.52) 0%, transparent 100%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2 }}
      >
        <motion.button
          onClick={onBack}
          style={{
            display      : "flex",
            alignItems   : "center",
            gap          : 8,
            color        : "rgba(255,255,255,0.4)",
            cursor       : "none",
            background   : "none",
            border       : "none",
            fontFamily   : "inherit",
            fontSize     : "0.56rem",
            letterSpacing: "0.2em",
          }}
          whileHover={{ color: "rgba(255,255,255,0.75)" }}
        >
          ← RETURN
        </motion.button>

        <div style={{
          display      : "flex",
          alignItems   : "center",
          gap          : 10,
          fontSize     : "0.52rem",
          letterSpacing: "0.22em",
          color        : "rgba(255,255,255,0.28)",
        }}>
          <span>SUPPORTER</span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>→</span>
          <span style={{ color: "rgba(232,168,80,0.65)" }}>CHOOSE A MEMORY</span>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Emotion Ring ─────────────────────────────────────────────────────────────
// Same structure as Referee's InvestigationRing. Warm amber instead of blue.
// Expands to fill screen on match enter.
function EmotionRing({ entering, hoveredId }: {
  entering : boolean;
  hoveredId: string | null;
}) {
  void hoveredId;
  return (
    <motion.div
      style={{
        position     : "absolute",
        left         : "50%",
        top          : "52%",
        translateX   : "-50%",
        translateY   : "-50%",
        zIndex       : 10,
        pointerEvents: "none",
        width        : 200,
        height       : 200,
      }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={entering
        ? { opacity: 0, scale: 6 }
        : { opacity: 1, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{
        duration: entering ? 0.78 : 0.95,
        ease    : entering ? [0.3, 0, 0.9, 1] : [0.16, 1, 0.3, 1],
      }}
    >
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: "visible" }}>
        {/* Outer ghost ring */}
        <circle cx="100" cy="100" r="96"
          fill="none" stroke="rgba(232,168,80,0.08)" strokeWidth="0.8" />

        {/* Primary slow-rotating arc — warm amber */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "100px 100px" }}
        >
          <circle cx="100" cy="100" r="96" fill="none"
            stroke="rgba(232,168,80,0.38)" strokeWidth="0.8"
            strokeDasharray="50 554" strokeLinecap="round" />
        </motion.g>

        {/* Counter arc — dimmer */}
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "100px 100px" }}
        >
          <circle cx="100" cy="100" r="96" fill="none"
            stroke="rgba(255,200,100,0.06)" strokeWidth="0.7"
            strokeDasharray="22 554" strokeLinecap="round" />
        </motion.g>

        {/* Inner ring */}
        <circle cx="100" cy="100" r="76"
          fill="none" stroke="rgba(232,168,80,0.04)" strokeWidth="0.6" />

        {/* Crosshair */}
        <line x1="100" y1="76"  x2="100" y2="88"  stroke="rgba(232,168,80,0.14)" strokeWidth="0.7" />
        <line x1="100" y1="112" x2="100" y2="124" stroke="rgba(232,168,80,0.14)" strokeWidth="0.7" />
        <line x1="76"  y1="100" x2="88"  y2="100" stroke="rgba(232,168,80,0.14)" strokeWidth="0.7" />
        <line x1="112" y1="100" x2="124" y2="100" stroke="rgba(232,168,80,0.14)" strokeWidth="0.7" />

        {/* Tick marks at 60° orbital positions */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const r = (deg - 90) * Math.PI / 180;
          return (
            <line key={deg}
              x1={100 + 90 * Math.cos(r)} y1={100 + 90 * Math.sin(r)}
              x2={100 + 98 * Math.cos(r)} y2={100 + 98 * Math.sin(r)}
              stroke="rgba(232,168,80,0.18)" strokeWidth="1" strokeLinecap="round" />
          );
        })}

        <circle cx="100" cy="100" r="1.8" fill="rgba(232,168,80,0.22)" />
      </svg>

      {/* Ambient warm glow */}
      <div style={{
        position    : "absolute",
        inset       : -40,
        borderRadius: "50%",
        background  : "radial-gradient(ellipse at center, rgba(220,130,40,0.07) 0%, transparent 65%)",
        filter      : "blur(16px)",
      }} />
    </motion.div>
  );
}

// ─── Memory Card ──────────────────────────────────────────────────────────────
// Same structure as Referee's MatchCard. Warm amber palette.
// Shows: teams · scoreline · emotional story hook.
// CTA: "RELIVE THIS MEMORY" not "ENTER INVESTIGATION".
function MemoryCard({ match, meta, isHovered, isEntering, onHover, onSelect }: {
  match     : typeof MATCHES[0];
  meta      : NonNullable<typeof MATCH_META[string]>;
  isHovered : boolean;
  isEntering: boolean;
  onHover   : (id: string | null) => void;
  onSelect  : (id: string) => void;
}) {
  const W = match.featured ? 320 : 248;
  const H = match.featured ? 160 : 130;

  const borderCol = isHovered
    ? "rgba(232,168,80,0.65)"
    : isEntering
    ? "rgba(220,150,60,0.50)"
    : match.featured
    ? "rgba(210,140,50,0.28)"
    : "rgba(180,120,40,0.14)";

  const bgColor = isHovered
    ? "transparent"
    : match.featured
    ? "rgba(18,10,4,0.76)"
    : "rgba(14,8,2,0.68)";

  return (
    <motion.button
      onClick={() => onSelect(match.id)}
      onHoverStart={() => onHover(match.id)}
      onHoverEnd={() => onHover(null)}
      style={{
        width    : W,
        height   : H,
        padding  : 0,
        border   : "none",
        background: "none",
        cursor   : "none",
        fontFamily: "'Barlow Condensed', sans-serif",
        display  : "block",
        position : "relative",
      }}
      animate={{
        y    : isHovered ? -10 : 0,
        scale: isHovered ? 1.04 : 1,
      }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{
        position           : "absolute",
        inset              : 0,
        borderRadius       : 6,
        background         : isHovered
          ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(200,110,20,0.30) 0%, rgba(18,10,4,0.90) 55%, rgba(14,8,2,0.84) 100%)"
          : bgColor,
        backdropFilter     : "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border             : `1px solid ${borderCol}`,
        boxShadow          : isHovered
          ? [
              "0 0 0 1px rgba(232,168,80,0.20)",
              "0 0 20px rgba(220,140,40,0.45)",
              "0 0 60px rgba(180,110,20,0.18)",
              "0 16px 48px rgba(0,0,0,0.80)",
            ].join(", ")
          : isEntering
          ? "0 0 40px rgba(200,130,30,0.20), 0 20px 60px rgba(0,0,0,0.90)"
          : "0 8px 28px rgba(0,0,0,0.55)",
        transition         : "box-shadow 0.4s ease, border-color 0.4s ease, background 0.4s ease",
        overflow           : "hidden",
        padding            : match.featured ? "13px 18px 11px" : "10px 14px 9px",
        display            : "flex",
        flexDirection      : "column",
        justifyContent     : "space-between",
      }}>

        {/* Subtle top-edge warmth */}
        <div style={{
          position     : "absolute",
          top          : 0, left: 0, right: 0,
          height       : 1,
          background   : isHovered
            ? "linear-gradient(90deg, transparent, rgba(232,168,80,0.55), transparent)"
            : "linear-gradient(90deg, transparent, rgba(200,130,40,0.10), transparent)",
          pointerEvents: "none",
          transition   : "background 0.4s",
        }} />

        {/* ── Story hook — the emotional teaser ── */}
        <div style={{
          fontSize     : "0.42rem",
          fontWeight   : 400,
          letterSpacing: "0.18em",
          fontStyle    : "italic",
          color        : isHovered
            ? "rgba(232,168,80,0.80)"
            : "rgba(200,140,60,0.38)",
          transition   : "color 0.4s",
          marginBottom : 4,
        }}>
          {match.storyHook}
        </div>

        {/* ── Team codes + scoreline ── */}
        <div style={{
          display    : "flex",
          alignItems : "center",
          gap        : 10,
          flex       : 1,
          paddingBottom: 2,
        }}>
          {/* Home */}
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ marginBottom: 4 }}>
              <FlagImg code={meta.home.flagCode} size={match.featured ? 28 : 22} />
            </div>
            <div style={{
              fontSize     : match.featured ? "1.9rem" : "1.5rem",
              fontWeight   : 900,
              letterSpacing: "0.04em",
              lineHeight   : 1,
              color        : isHovered ? "rgba(255,240,210,1)" : "rgba(220,200,170,0.82)",
              transition   : "color 0.4s",
              textShadow   : isHovered ? "0 0 22px rgba(232,168,80,0.50)" : "none",
            }}>
              {meta.home.code}
            </div>
            <div style={{
              fontSize     : "0.44rem",
              letterSpacing: "0.13em",
              color        : isHovered ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.30)",
              marginTop    : 3,
              transition   : "color 0.4s",
            }}>
              {meta.home.name.toUpperCase()}
            </div>
          </div>

          {/* Scoreline — the result that carries all the drama */}
          <div style={{
            flexShrink        : 0,
            textAlign         : "center",
            fontSize          : match.featured ? "1.30rem" : "1.05rem",
            fontWeight        : 700,
            letterSpacing     : "0.10em",
            color             : isHovered
              ? "rgba(232,168,80,0.90)"
              : "rgba(200,150,60,0.38)",
            lineHeight        : 1,
            transition        : "color 0.4s",
            fontVariantNumeric: "tabular-nums",
          }}>
            {match.scoreline}
          </div>

          {/* Away */}
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ marginBottom: 4 }}>
              <FlagImg code={meta.away.flagCode} size={match.featured ? 28 : 22} />
            </div>
            <div style={{
              fontSize     : match.featured ? "1.9rem" : "1.5rem",
              fontWeight   : 900,
              letterSpacing: "0.04em",
              lineHeight   : 1,
              color        : isHovered ? "rgba(255,240,210,1)" : "rgba(220,200,170,0.82)",
              transition   : "color 0.4s",
              textShadow   : isHovered ? "0 0 22px rgba(232,168,80,0.50)" : "none",
            }}>
              {meta.away.code}
            </div>
            <div style={{
              fontSize     : "0.44rem",
              letterSpacing: "0.13em",
              color        : isHovered ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.30)",
              marginTop    : 3,
              transition   : "color 0.4s",
            }}>
              {meta.away.name.toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{
          height    : "0.5px",
          background: isHovered
            ? "rgba(232,168,80,0.35)"
            : "rgba(255,255,255,0.07)",
          marginBottom: 5,
          transition  : "background 0.4s",
        }} />

        {/* ── CTA ── */}
        <div style={{
          display      : "flex",
          alignItems   : "center",
          gap          : 6,
          fontSize     : "0.42rem",
          letterSpacing: "0.2em",
          color        : isHovered
            ? "rgba(232,168,80,0.88)"
            : match.featured
            ? "rgba(200,140,60,0.50)"
            : "rgba(255,255,255,0.18)",
          transition   : "color 0.4s",
        }}>
          {(match.featured || isHovered) ? (
            <>
              <span style={{ fontSize: "0.55rem" }}>▶</span>
              <span>RELIVE THIS MEMORY</span>
            </>
          ) : (
            <span>COMING SOON</span>
          )}
        </div>

      </div>
    </motion.button>
  );
}
