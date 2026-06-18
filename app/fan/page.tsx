"use client";

// ─── PitchLens · New Fan World ─────────────────────────────────────────────────
//
//   The cinematic IS the match selection.
//   The video plays → the world comes alive → cards emerge from the stadium.
//   The user never leaves the cinematic to reach a dashboard.
//
//   Stage sequence:
//     "video"  (0–3200ms)  — stadium entrance, camera settles
//     "ring"   (3200ms+)   — investigation ring materialises at pitch centre
//     "cards"  (4000ms+)   — six memory portals emerge and become interactive

import { useState, useEffect, useCallback } from "react";
import { useRouter }                         from "next/navigation";
import { motion, AnimatePresence }           from "framer-motion";
import FanStoryScreen                        from "@/components/fan/FanStoryScreen";
import { MATCH_META, ALL_MATCHES }           from "@/lib/matchData";
import { MATCH_NARRATIVES }                  from "@/lib/matchNarratives";

// ─── Match positions — elliptical formation around the ring ───────────────────
const MATCHES = [
  { id: "japan-spain",     pos: { left: "50%",  top: "14%" }, featured: true,  floatDelay: 0.0 },
  { id: "iran-usa",        pos: { left: "20%",  top: "38%" }, featured: false, floatDelay: 0.6 },
  { id: "germany-japan",   pos: { left: "80%",  top: "38%" }, featured: false, floatDelay: 1.1 },
  { id: "belgium-croatia", pos: { left: "20%",  top: "65%" }, featured: false, floatDelay: 1.6 },
  { id: "portugal-ghana",  pos: { left: "80%",  top: "65%" }, featured: false, floatDelay: 2.1 },
  { id: "england-wales",   pos: { left: "50%",  top: "83%" }, featured: false, floatDelay: 2.6 },
];

type WorldStage = "video" | "ring" | "cards";
type AppPhase   = "select" | "investigate";

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function FanPage() {
  const router = useRouter();
  const [appPhase,        setAppPhase]        = useState<AppPhase>("select");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [visitedWorld,    setVisitedWorld]    = useState(false);

  if (appPhase === "investigate" && selectedMatchId) {
    const narrative = MATCH_NARRATIVES[selectedMatchId];
    const meta      = MATCH_META[selectedMatchId];
    if (narrative && meta) {
      return (
        <FanStoryScreen
          matchId={selectedMatchId}
          meta={meta}
          moments={narrative.moments}
          rawEvents={ALL_MATCHES[selectedMatchId] ?? []}
          narrative={narrative.narrative}
          onBack={() => setAppPhase("select")}
        />
      );
    }
  }

  return (
    <FanWorld
      skipIntro={visitedWorld}
      onSelect={(id) => { setVisitedWorld(true); setSelectedMatchId(id); setAppPhase("investigate"); }}
      onBack={() => router.push("/?portals=true")}
    />
  );
}

// ─── Fan World — integrated cinematic + selection ─────────────────────────────
function FanWorld({
  onSelect,
  onBack,
  skipIntro = false,
}: {
  onSelect  : (id: string) => void;
  onBack    : () => void;
  skipIntro ?: boolean;
}) {
  const [stage,      setStage]      = useState<WorldStage>(skipIntro ? "cards" : "video");
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [enteringId, setEnteringId] = useState<string | null>(null);

  useEffect(() => {
    if (skipIntro) return;
    const t1 = setTimeout(() => setStage("ring"),  3200);
    const t2 = setTimeout(() => setStage("cards"), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [skipIntro]);

  const handleSelect = useCallback((id: string) => {
    if (enteringId) return;
    setEnteringId(id);
    setTimeout(() => onSelect(id), 900);
  }, [enteringId, onSelect]);

  const showCards = stage === "cards" || !!enteringId;

  return (
    <div style={{
      position  : "fixed",
      inset     : 0,
      background: "#000",
      overflow  : "hidden",
      fontFamily: "'Barlow Condensed', sans-serif",
      cursor    : "none",
    }}>

      {/* ── Stadium world — the video is the environment ── */}
      <motion.video
        autoPlay muted loop playsInline
        onError={() => setStage("cards")}
        onStalled={() => setTimeout(() => setStage("cards"), 2500)}
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1.02, opacity: 1 }}
        transition={{ duration: 3.2, ease: "easeOut" }}
        style={{
          position  : "absolute",
          inset     : 0,
          width     : "100%",
          height    : "100%",
          objectFit : "cover",
          willChange: "transform",
        }}
        src="/videos/fan-world.mp4"
      />

      {/* World scrim — depth without killing the image */}
      <div style={{
        position     : "absolute",
        inset        : 0,
        background   : "radial-gradient(ellipse at 50% 45%, rgba(0,4,16,0.22) 0%, rgba(0,4,16,0.55) 100%)",
        pointerEvents: "none",
      }} />

      {/* Bottom vignette — grounds the cards */}
      <div style={{
        position     : "absolute",
        bottom       : 0, left: 0, right: 0,
        height       : "32%",
        background   : "linear-gradient(to top, rgba(0,4,16,0.65) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Transition void — world collapses when entering a match */}
      <AnimatePresence>
        {enteringId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeIn" }}
            style={{
              position     : "absolute",
              inset        : 0,
              background   : "rgba(0,2,10,0.92)",
              zIndex       : 10,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <AnimatePresence>
        {!enteringId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.8, duration: 0.7 }}
            style={{
              position      : "absolute",
              top           : 0, left: 0, right: 0,
              zIndex        : 30,
              display       : "flex",
              alignItems    : "center",
              justifyContent: "space-between",
              padding       : "0 28px",
              height        : 44,
              background    : "linear-gradient(180deg, rgba(0,0,0,0.50) 0%, transparent 100%)",
            }}
          >
            <motion.button
              onClick={onBack}
              style={{
                background   : "none",
                border       : "none",
                color        : "rgba(255,255,255,0.38)",
                fontFamily   : "inherit",
                fontSize     : "0.56rem",
                letterSpacing: "0.2em",
                cursor       : "none",
                padding      : 0,
                transition   : "color 0.25s",
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
              color        : "rgba(255,255,255,0.26)",
            }}>
              <span>NEW FAN</span>
              <span style={{ opacity: 0.45 }}>→</span>
              <span style={{ color: "rgba(126,207,160,0.60)" }}>
                {stage === "video" ? "ENTERING THE ARENA" : "SELECT A MEMORY"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Investigation ring — materialises at pitch centre ── */}
      <WorldRing stage={stage} entering={!!enteringId} />

      {/* ── Memory portals — emerge from the world ── */}
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
            initial={{ opacity: 0, scale: 0.72, y: 28, filter: "blur(10px)" }}
            animate={
              !showCards
                ? { opacity: 0,   scale: 0.72, y: 28,  filter: "blur(10px)" }
                : isThis
                ? { opacity: 1,   scale: 1.10, y: -16, filter: "blur(0px)"  }
                : isRecede
                ? { opacity: 0,   scale: 0.85, y: 18,  filter: "blur(5px)"  }
                : { opacity: 1,   scale: 1,    y: 0,   filter: "blur(0px)"  }
            }
            transition={{
              duration: 0.75,
              delay   : showCards && !enteringId ? 0.05 * i : 0,
              ease    : [0.16, 1, 0.3, 1],
            }}
          >
            {/* Gentle ambient float */}
            <motion.div
              animate={isHov ? {} : { y: [0, match.featured ? -5 : -3, 0] }}
              transition={{
                duration: 5.0 + match.floatDelay * 0.3,
                repeat  : Infinity,
                ease    : "easeInOut",
                delay   : match.floatDelay,
              }}
            >
              <MemoryPortal
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

    </div>
  );
}

// ─── World Ring ────────────────────────────────────────────────────────────────
function WorldRing({ stage, entering }: { stage: WorldStage; entering: boolean }) {
  const visible = stage !== "video";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="ring"
          style={{
            position     : "absolute",
            left         : "50%",
            top          : "52%",
            translateX   : "-50%",
            translateY   : "-50%",
            zIndex       : 10,
            pointerEvents: "none",
            width        : 220,
            height       : 220,
          }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={entering
            ? { opacity: 0, scale: 8 }
            : { opacity: 1, scale: 1 }
          }
          exit={{ opacity: 0, scale: 0.2 }}
          transition={entering
            ? { duration: 0.85, ease: [0.3, 0, 0.9, 1] }
            : { duration: 1.1,  ease: [0.16, 1, 0.3, 1] }
          }
        >
          <svg width="220" height="220" viewBox="0 0 220 220" fill="none" style={{ overflow: "visible" }}>
            <circle cx="110" cy="110" r="104" stroke="rgba(126,207,160,0.08)" strokeWidth="1" />
            <circle cx="110" cy="110" r="84"  stroke="rgba(126,207,160,0.05)" strokeWidth="0.7" />

            <motion.circle
              cx="110" cy="110" r="104"
              stroke="rgba(126,207,160,0.32)"
              strokeWidth="1"
              strokeDasharray="18 36"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "110px 110px" }}
            />
            <motion.circle
              cx="110" cy="110" r="104"
              stroke="rgba(126,207,160,0.65)"
              strokeWidth="1.5"
              strokeDasharray="32 420"
              strokeLinecap="round"
              animate={{ rotate: -360 }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "110px 110px" }}
            />
            <motion.circle
              cx="110" cy="110" r="84"
              stroke="rgba(126,207,160,0.20)"
              strokeWidth="0.8"
              strokeDasharray="9 55"
              strokeLinecap="round"
              animate={{ rotate: 360 }}
              transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "110px 110px" }}
            />

            {[0, 90, 180, 270].map(deg => {
              const r = deg * Math.PI / 180;
              return (
                <line key={deg}
                  x1={110 + Math.cos(r) * 96} y1={110 + Math.sin(r) * 96}
                  x2={110 + Math.cos(r) * 104} y2={110 + Math.sin(r) * 104}
                  stroke="rgba(126,207,160,0.50)" strokeWidth="2" strokeLinecap="round"
                />
              );
            })}

            <motion.circle
              cx="110" cy="110" r="3.5"
              fill="rgba(126,207,160,0.55)"
              animate={{ opacity: [0.3, 0.85, 0.3], scale: [1, 1.4, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "110px 110px" }}
            />
          </svg>

          <div style={{
            position    : "absolute",
            inset       : -50,
            borderRadius: "50%",
            background  : "radial-gradient(ellipse at center, rgba(126,207,160,0.06) 0%, transparent 65%)",
            filter      : "blur(18px)",
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Memory Portal — match card embedded in the world ─────────────────────────
function MemoryPortal({
  match,
  meta,
  isHovered,
  isEntering,
  onHover,
  onSelect,
}: {
  match     : typeof MATCHES[0];
  meta      : NonNullable<typeof MATCH_META[string]>;
  isHovered : boolean;
  isEntering: boolean;
  onHover   : (id: string | null) => void;
  onSelect  : (id: string) => void;
}) {
  const W = match.featured ? 310 : 242;
  const H = match.featured ? 148 : 118;

  const accent = "126,207,160";

  return (
    <motion.button
      onClick={() => onSelect(match.id)}
      onMouseEnter={() => onHover(match.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        width     : W,
        height    : H,
        padding   : 0,
        border    : "none",
        background: "none",
        cursor    : "none",
        fontFamily: "'Barlow Condensed', sans-serif",
        display   : "block",
        position  : "relative",
      }}
      animate={{
        y    : isHovered ? -8 : 0,
        scale: isHovered ? 1.04 : 1,
      }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{
        position           : "absolute",
        inset              : 0,
        background         : isHovered
          ? "rgba(8,18,36,0.76)"
          : "rgba(4,10,24,0.60)",
        backdropFilter     : "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        border             : `1px solid rgba(${accent},${isHovered ? "0.45" : "0.16"})`,
        boxShadow          : isHovered
          ? `0 0 0 1px rgba(${accent},0.10), 0 0 24px rgba(${accent},0.22), 0 20px 50px rgba(0,0,0,0.60)`
          : isEntering
          ? `0 0 50px rgba(${accent},0.18), 0 20px 60px rgba(0,0,0,0.80)`
          : "0 8px 28px rgba(0,0,0,0.50)",
        transition         : "box-shadow 0.35s, border-color 0.35s, background 0.35s",
        overflow           : "hidden",
        padding            : match.featured ? "13px 18px 11px" : "10px 14px 9px",
        display            : "flex",
        flexDirection      : "column",
        justifyContent     : "space-between",
      }}>

        {/* Match energy gradient */}
        <div style={{
          position     : "absolute",
          inset        : 0,
          background   : `linear-gradient(135deg, rgba(${meta.home.color.replace("#","").match(/.{2}/g)?.map(h=>parseInt(h,16)).join(",") ?? "80,140,255"},${isHovered?"0.14":"0.07"}) 0%, transparent 50%, rgba(${meta.away.color.replace("#","").match(/.{2}/g)?.map(h=>parseInt(h,16)).join(",") ?? "255,180,80"},${isHovered?"0.10":"0.05"}) 100%)`,
          pointerEvents: "none",
          transition   : "background 0.4s",
        }} />

        {/* Top accent line */}
        <div style={{
          position     : "absolute",
          top          : 0, left: "6%", right: "6%",
          height       : "1px",
          background   : `linear-gradient(90deg, transparent, rgba(${accent},${isHovered?"0.75":"0.25"}) 50%, transparent)`,
          transition   : "background 0.35s",
          pointerEvents: "none",
        }} />

        {/* Chapter title */}
        <div style={{
          fontSize     : "0.42rem",
          fontWeight   : 400,
          letterSpacing: "0.22em",
          color        : isHovered ? `rgba(${accent},0.80)` : `rgba(${accent},0.32)`,
          transition   : "color 0.35s",
          whiteSpace   : "nowrap",
          overflow     : "hidden",
          textOverflow : "ellipsis",
        }}>
          {meta.headline.toUpperCase()}
        </div>

        {/* Team codes */}
        <div style={{
          display    : "flex",
          alignItems : "center",
          gap        : 10,
          flex       : 1,
          padding    : "4px 0",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize  : match.featured ? "1.80rem" : "1.42rem",
              fontWeight: 900,
              letterSpacing: "0.05em",
              lineHeight: 1,
              color     : isHovered ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.80)",
              transition: "color 0.35s",
              textShadow: isHovered ? `0 0 22px rgba(${accent},0.40)` : "none",
            }}>
              {meta.home.code}
            </div>
            <div style={{
              fontSize     : "0.42rem",
              letterSpacing: "0.13em",
              color        : "rgba(255,255,255,0.30)",
              marginTop    : 3,
            }}>
              {meta.home.name.toUpperCase()}
            </div>
          </div>

          <div style={{
            flexShrink   : 0,
            fontSize     : "0.55rem",
            letterSpacing: "0.14em",
            color        : "rgba(255,255,255,0.18)",
            paddingBottom: 10,
          }}>
            vs
          </div>

          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{
              fontSize  : match.featured ? "1.80rem" : "1.42rem",
              fontWeight: 900,
              letterSpacing: "0.05em",
              lineHeight: 1,
              color     : isHovered ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.80)",
              transition: "color 0.35s",
              textShadow: isHovered ? `0 0 22px rgba(${accent},0.40)` : "none",
            }}>
              {meta.away.code}
            </div>
            <div style={{
              fontSize     : "0.42rem",
              letterSpacing: "0.13em",
              color        : "rgba(255,255,255,0.30)",
              marginTop    : 3,
            }}>
              {meta.away.name.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height    : "0.5px",
          background: isHovered ? `rgba(${accent},0.28)` : "rgba(255,255,255,0.07)",
          marginBottom: 5,
          transition: "background 0.35s",
        }} />

        {/* CTA */}
        <div style={{
          fontSize     : "0.41rem",
          letterSpacing: "0.20em",
          color        : isHovered ? `rgba(${accent},0.90)` : "rgba(255,255,255,0.20)",
          transition   : "color 0.35s",
        }}>
          {isHovered ? "▶  ENTER MEMORY" : "MEMORY PORTAL"}
        </div>

        {/* Hover outer glow */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position    : "absolute",
                inset       : "-2px",
                pointerEvents: "none",
                boxShadow   : `0 0 28px rgba(${accent},0.16), 0 0 70px rgba(${accent},0.07)`,
              }}
            />
          )}
        </AnimatePresence>

        {/* Portal flash on select */}
        <AnimatePresence>
          {isEntering && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.20, 0] }}
              transition={{ duration: 0.65 }}
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
    </motion.button>
  );
}
