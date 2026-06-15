"use client";

// ─── PitchLens · Referee World ─────────────────────────────────────────────────
// Stage = video.
// Layout: 1 featured top-center + 2×2 flanking side cards + 1 bottom-center.
// Cards are dark glass panels — the video IS the background, never fight it.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import MatchStoryScreen from "@/components/incident/MatchStoryScreen";
import { MATCH_META, ALL_MATCHES } from "@/lib/matchData";
import { MATCH_NARRATIVES } from "@/lib/matchNarratives";

// ─── Match catalogue ───────────────────────────────────────────────────────────
// "featured" = top-center hero slot. Others fill the hexagonal orbit.
const MATCHES: {
  id: string;
  chapterTitle: string;
  featured: boolean;
  pos: { left: string; top: string };
  floatDelay: number;
}[] = [
  {
    id: "japan-spain",
    chapterTitle: "THE GOAL LINE INCIDENT",
    featured: true,
    pos: { left: "50%", top: "16%" },
    floatDelay: 0,
  },
  {
    id: "iran-usa",
    chapterTitle: "THE POLITICAL MATCH",
    featured: false,
    pos: { left: "21%", top: "40%" },
    floatDelay: 0.5,
  },
  {
    id: "germany-japan",
    chapterTitle: "THE GIANT KILLER",
    featured: false,
    pos: { left: "79%", top: "40%" },
    floatDelay: 1.0,
  },
  {
    id: "belgium-croatia",
    chapterTitle: "GROUP FINALE DRAMA",
    featured: false,
    pos: { left: "21%", top: "64%" },
    floatDelay: 1.5,
  },
  {
    id: "portugal-ghana",
    chapterTitle: "RONALDO'S HISTORIC NIGHT",
    featured: false,
    pos: { left: "79%", top: "64%" },
    floatDelay: 2.0,
  },
  {
    id: "england-wales",
    chapterTitle: "THE DERBY",
    featured: false,
    pos: { left: "50%", top: "83%" },
    floatDelay: 2.5,
  },
];

type WorldStage = "video" | "ring" | "cards";
type Phase      = "select" | "investigate";

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function RefereePage() {
  const router = useRouter();
  const [phase, setPhase]                     = useState<Phase>("select");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  if (phase === "investigate" && selectedMatchId) {
    const narrative = MATCH_NARRATIVES[selectedMatchId];
    const meta      = MATCH_META[selectedMatchId];
    if (narrative && meta) {
      return (
        <MatchStoryScreen
          matchId={selectedMatchId}
          meta={meta}
          moments={narrative.moments}
          rawEvents={ALL_MATCHES[selectedMatchId] ?? []}
          narrative={narrative.narrative}
          perspective="referee"
          onBack={() => setPhase("select")}
        />
      );
    }
  }

  return (
    <RefereeWorld
      onSelect={(id) => { setSelectedMatchId(id); setPhase("investigate"); }}
      onBack={() => router.push("/")}
    />
  );
}

// ─── Referee World ─────────────────────────────────────────────────────────────
function RefereeWorld({ onSelect, onBack }: {
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const [worldStage, setWorldStage] = useState<WorldStage>("video");
  const [hoveredId, setHoveredId]   = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | null>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setWorldStage("ring"),  3200);
    const t2 = setTimeout(() => setWorldStage("cards"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

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
      {/* ══ STAGE ═══════════════════════════════════════════════════════════════ */}
      <video
        autoPlay muted loop playsInline preload="auto"
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%", objectFit: "cover",
          filter: enteringId
            ? "brightness(0.12) saturate(0.3)"
            : "brightness(0.55) saturate(0.75)",
          transition: "filter 0.85s ease",
        }}
      >
        <source src="/videos/referee-world.mp4" type="video/mp4" />
      </video>

      {/* Edge vignette */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background:
          "radial-gradient(ellipse 95% 90% at 50% 50%, transparent 20%, rgba(0,0,0,0.4) 62%, rgba(0,0,0,0.92) 100%)",
      }} />

      {/* ══ RING ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {worldStage !== "video" && (
          <InvestigationRing
            entering={!!enteringId}
            hoveredId={hoveredId}
          />
        )}
      </AnimatePresence>

      {/* ══ MATCH CARDS ══════════════════════════════════════════════════════════ */}
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
              position: "absolute",
              left: match.pos.left,
              top: match.pos.top,
              translateX: "-50%",
              translateY: "-50%",
              zIndex: isThis ? 50 : 20,
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
              delay: cardsReady && !enteringId ? i * 0.08 : 0,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Autonomous float — gentle, never overlaps */}
            <motion.div
              animate={isHov ? {} : { y: [0, match.featured ? -4 : -3, 0] }}
              transition={{
                duration: 5.2 + match.floatDelay * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: match.floatDelay,
              }}
            >
              <MatchCard
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
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px", height: 44,
          background: "linear-gradient(180deg, rgba(0,0,0,0.52) 0%, transparent 100%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2 }}
      >
        <motion.button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            color: "rgba(255,255,255,0.4)", cursor: "none",
            background: "none", border: "none",
            fontFamily: "inherit", fontSize: "0.56rem", letterSpacing: "0.2em",
          }}
          whileHover={{ color: "rgba(255,255,255,0.75)" }}
        >
          ← RETURN
        </motion.button>

        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          fontSize: "0.52rem", letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.28)",
        }}>
          <span>REFEREE</span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>→</span>
          <span style={{ color: "rgba(255,255,255,0.55)" }}>SELECT MATCH</span>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Investigation Ring ────────────────────────────────────────────────────────
// Sits in the centre-background between the card rows.
// Expands to fill screen on enter transition.
function InvestigationRing({ entering, hoveredId }: {
  entering: boolean;
  hoveredId: string | null;
}) {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%", top: "52%",
        translateX: "-50%", translateY: "-50%",
        zIndex: 10, pointerEvents: "none",
        width: 200, height: 200,
      }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={entering
        ? { opacity: 0, scale: 6 }
        : { opacity: 1, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.4 }}
      transition={{
        duration: entering ? 0.78 : 0.95,
        ease: entering ? [0.3, 0, 0.9, 1] : [0.16, 1, 0.3, 1],
      }}
    >
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ overflow: "visible" }}>
        {/* Outer ghost ring */}
        <circle cx="100" cy="100" r="96"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

        {/* Primary slow-rotating arc */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "100px 100px" }}
        >
          <circle cx="100" cy="100" r="96" fill="none"
            stroke="rgba(160,190,240,0.4)" strokeWidth="0.8"
            strokeDasharray="50 554" strokeLinecap="round" />
        </motion.g>

        {/* Counter arc */}
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ duration: 46, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "100px 100px" }}
        >
          <circle cx="100" cy="100" r="96" fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth="0.7"
            strokeDasharray="22 554" strokeLinecap="round" />
        </motion.g>

        {/* Inner ring */}
        <circle cx="100" cy="100" r="76"
          fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.6" />

        {/* Crosshair lines */}
        <line x1="100" y1="76" x2="100" y2="88"
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
        <line x1="100" y1="112" x2="100" y2="124"
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
        <line x1="76" y1="100" x2="88" y2="100"
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
        <line x1="112" y1="100" x2="124" y2="100"
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />

        {/* Tick marks at 60° orbital positions */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const r = (deg - 90) * Math.PI / 180;
          return (
            <line key={deg}
              x1={100 + 90 * Math.cos(r)} y1={100 + 90 * Math.sin(r)}
              x2={100 + 98 * Math.cos(r)} y2={100 + 98 * Math.sin(r)}
              stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinecap="round" />
          );
        })}

        <circle cx="100" cy="100" r="1.8" fill="rgba(255,255,255,0.18)" />
      </svg>

      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: -40, borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(100,140,240,0.06) 0%, transparent 65%)",
        filter: "blur(16px)",
      }} />
    </motion.div>
  );
}

// ─── Match Card ────────────────────────────────────────────────────────────────
// Dark glass panel. The video shows through it — it IS the atmosphere.
// Featured card: larger, "ENTER INVESTIGATION".
// Others: standard size, "COMING SOON" at rest → "ENTER" on hover.
function MatchCard({ match, meta, isHovered, isEntering, onHover, onSelect }: {
  match: typeof MATCHES[0];
  meta: NonNullable<typeof MATCH_META[string]>;
  isHovered: boolean;
  isEntering: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const W = match.featured ? 320 : 248;
  const H = match.featured ? 150 : 122;

  const isActive  = isHovered || match.featured;
  const borderCol = isHovered
    ? "rgba(130,170,255,0.65)"
    : isEntering
    ? "rgba(140,170,240,0.5)"
    : match.featured
    ? "rgba(120,155,220,0.28)"
    : "rgba(100,130,200,0.14)";
  const bgColor   = isHovered
    ? "transparent"
    : match.featured
    ? "rgba(8,12,26,0.76)"
    : "rgba(8,12,26,0.68)";

  return (
    <motion.button
      onClick={() => onSelect(match.id)}
      onHoverStart={() => onHover(match.id)}
      onHoverEnd={() => onHover(null)}
      style={{
        width: W, height: H,
        padding: 0, border: "none",
        background: "none", cursor: "none",
        fontFamily: "'Barlow Condensed', sans-serif",
        display: "block", position: "relative",
      }}
      animate={{
        y:     isHovered ? -10 : 0,
        scale: isHovered ? 1.04 : 1,
      }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── Card panel ── */}
      <div style={{
        position: "absolute", inset: 0,
        borderRadius: 6,
        background: isHovered
          ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(90,130,255,0.28) 0%, rgba(8,12,26,0.88) 55%, rgba(8,12,26,0.82) 100%)"
          : bgColor,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${borderCol}`,
        boxShadow: isHovered
          ? [
              "0 0 0 1px rgba(110,155,255,0.22)",
              "0 0 18px rgba(90,130,255,0.45)",
              "0 0 55px rgba(70,110,240,0.18)",
              "0 16px 48px rgba(0,0,0,0.8)",
            ].join(", ")
          : isEntering
          ? "0 0 40px rgba(100,140,240,0.2), 0 20px 60px rgba(0,0,0,0.9)"
          : "0 8px 28px rgba(0,0,0,0.55)",
        transition: "box-shadow 0.4s ease, border-color 0.4s ease, background 0.4s ease",
        overflow: "hidden",
        padding: match.featured ? "14px 20px 12px" : "11px 16px 10px",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
      }}>

        {/* Subtle inner highlight — top edge catches light */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(180,200,255,0.12), transparent)",
          pointerEvents: "none",
        }} />

        {/* ── Chapter title ── */}
        <div style={{
          fontSize: "0.42rem",
          fontWeight: 400,
          letterSpacing: "0.22em",
          color: isHovered
            ? "rgba(180,205,255,0.75)"
            : "rgba(160,185,225,0.38)",
          transition: "color 0.4s",
          marginBottom: 4,
        }}>
          {match.chapterTitle}
        </div>

        {/* ── Team codes — the visual centrepiece ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          paddingBottom: 2,
        }}>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{
              fontSize: match.featured ? "1.9rem" : "1.5rem",
              fontWeight: 900,
              letterSpacing: "0.04em",
              lineHeight: 1,
              color: isHovered ? "rgba(240,235,220,1)" : "rgba(210,200,180,0.82)",
              transition: "color 0.4s",
              textShadow: isHovered ? "0 0 20px rgba(120,160,255,0.5)" : "none",
            }}>
              {meta.home.code}
            </div>
            <div style={{
              fontSize: "0.46rem",
              fontWeight: 400,
              letterSpacing: "0.13em",
              color: isHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.32)",
              marginTop: 3,
              transition: "color 0.4s",
            }}>
              {meta.home.name.toUpperCase()}
            </div>
          </div>

          <div style={{
            fontSize: "0.6rem",
            fontWeight: 300,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.18)",
            flexShrink: 0,
          }}>
            vs
          </div>

          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{
              fontSize: match.featured ? "1.9rem" : "1.5rem",
              fontWeight: 900,
              letterSpacing: "0.04em",
              lineHeight: 1,
              color: isHovered ? "rgba(240,235,220,1)" : "rgba(210,200,180,0.82)",
              transition: "color 0.4s",
              textShadow: isHovered ? "0 0 20px rgba(120,160,255,0.5)" : "none",
            }}>
              {meta.away.code}
            </div>
            <div style={{
              fontSize: "0.46rem",
              fontWeight: 400,
              letterSpacing: "0.13em",
              color: isHovered ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.32)",
              marginTop: 3,
              transition: "color 0.4s",
            }}>
              {meta.away.name.toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{
          height: "0.5px",
          background: isHovered
            ? "rgba(110,155,255,0.35)"
            : "rgba(255,255,255,0.07)",
          marginBottom: 6,
          transition: "background 0.4s",
        }} />

        {/* ── CTA / Status ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: "0.42rem",
          letterSpacing: "0.2em",
          color: isHovered
            ? "rgba(160,195,255,0.85)"
            : match.featured
            ? "rgba(200,215,255,0.5)"
            : "rgba(255,255,255,0.18)",
          transition: "color 0.4s",
        }}>
          {(match.featured || isHovered) ? (
            <>
              <span style={{ fontSize: "0.55rem" }}>▶</span>
              <span>ENTER INVESTIGATION</span>
            </>
          ) : (
            <span>COMING SOON</span>
          )}
        </div>
      </div>

    </motion.button>
  );
}
