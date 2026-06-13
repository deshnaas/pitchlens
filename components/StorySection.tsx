"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * StorySection — "ONE MOMENT. MANY REALITIES."
 *
 * 8 cinematic scenes inserted between the video intro and the portal selection.
 * Left: narrative text. Right: living canvas animation per scene.
 * Navigation: scroll wheel accumulator (threshold 80), arrow keys, touch.
 * Final scene triggers onComplete → portals appear.
 */

interface Props {
  visible   : boolean;
  onComplete: () => void;
}

// ── Scene definitions ─────────────────────────────────────────────────────────

interface Scene {
  id       : number;
  bg       : string;
  accent   : string; // rgba string for canvas tint
  kicker   : string;
  headline : string;
  body     : string;
  canvasKey: string; // identifies which canvas draw fn to use
}

const SCENES: Scene[] = [
  {
    id      : 0,
    bg      : "rgba(0,0,0,0.87)",
    accent  : "rgba(255,255,255,0.6)",
    kicker  : "72'",
    headline: "Germany are awarded a penalty.",
    body    : "Kai Havertz steps up. The stadium holds its breath. One kick. Everything in the balance.",
    canvasKey: "anticipation",
  },
  {
    id      : 1,
    bg      : "rgba(4,4,18,0.90)",
    accent  : "rgba(200,200,255,0.6)",
    kicker  : "72' 14\"",
    headline: "He misses.",
    body    : "The ball drifts wide. A moment that means a thousand different things to a thousand different people.",
    canvasKey: "miss",
  },
  {
    id      : 2,
    bg      : "rgba(4,4,22,0.92)",
    accent  : "rgba(180,200,255,0.5)",
    kicker  : "ONE MOMENT.  MANY REALITIES.",
    headline: "The same event. Three completely different worlds.",
    body    : "Where you stand changes everything you see.",
    canvasKey: "fracture",
  },
  {
    id      : 3,
    bg      : "rgba(0,16,52,0.91)",
    accent  : "rgba(168,196,224,0.7)",
    kicker  : "REFEREE POV",
    headline: "The penalty was correctly awarded. Play continues.",
    body    : "Laws applied. Process followed. The decision is documented, analysed, archived. Correct.",
    canvasKey: "referee",
  },
  {
    id      : 4,
    bg      : "rgba(0,32,16,0.90)",
    accent  : "rgba(126,207,160,0.7)",
    kicker  : "NEW FAN",
    headline: "Germany had a chance to score. Kai Havertz took the shot but missed.",
    body    : "A penalty is a free kick on goal from twelve yards. The goalkeeper guessed right.",
    canvasKey: "fan",
  },
  {
    id      : 5,
    bg      : "rgba(52,16,0,0.91)",
    accent  : "rgba(232,168,124,0.7)",
    kicker  : "TEAM SUPPORTER",
    headline: "NOOO. How did he miss that?",
    body    : "That was our chance. That was THE chance. I can't even look. Someone hold me.",
    canvasKey: "supporter",
  },
  {
    id      : 6,
    bg      : "rgba(24,8,0,0.90)",
    accent  : "rgba(200,160,80,0.6)",
    kicker  : "ONE MOMENT",
    headline: "Two sides of the same pitch.",
    body    : "Every decision divides a stadium. One reality fractures into many — instantly, permanently.",
    canvasKey: "split",
  },
  {
    id      : 7,
    bg      : "rgba(0,4,12,0.93)",
    accent  : "rgba(255,255,255,0.55)",
    kicker  : "ONE EVENT.  MULTIPLE TRUTHS.",
    headline: "This is PitchLens.",
    body    : "Choose your reality.",
    canvasKey: "reveal",
  },
];

// ── Canvas draw functions ─────────────────────────────────────────────────────

function drawAnticipation(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.0025);

  // Pulsing orb
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90 * pulse);
  grad.addColorStop(0, "rgba(255,255,255,0.18)");
  grad.addColorStop(0.5, "rgba(200,210,255,0.06)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 90 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Expanding rings
  for (let r = 1; r <= 3; r++) {
    const radius = (40 + r * 38) * pulse;
    ctx.strokeStyle = `rgba(255,255,255,${0.28 - r * 0.07})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Centre dot
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawMiss(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const age = Math.min(t / 1200, 1); // 0→1 over 1.2s after mount

  // Arc of the missed ball — curves wide
  ctx.strokeStyle = `rgba(200,200,255,${0.55 * age})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 80, cy + 50);
  ctx.bezierCurveTo(cx - 20, cy - 80, cx + 60, cy - 30, cx + 110, cy + 20);
  ctx.stroke();

  // Ball dot along path
  const bx = cx - 80 + (cx + 110 - (cx - 80)) * age;
  const by = cy + 50 + ((cy + 20) - (cy + 50)) * age - 80 * Math.sin(Math.PI * age);
  ctx.fillStyle = `rgba(255,255,255,${0.9 * age})`;
  ctx.beginPath();
  ctx.arc(bx, by, 5 * (1 - age * 0.4), 0, Math.PI * 2);
  ctx.fill();

  // "WIDE" drift rings at end
  if (age > 0.7) {
    const r = (age - 0.7) / 0.3;
    ctx.strokeStyle = `rgba(200,200,255,${0.3 * r})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx + 110, cy + 20, 20 * r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFracture(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const age = Math.min(t / 900, 1);

  // Three coloured streams radiating from centre
  const streams = [
    { angle: -Math.PI / 6,     color: "rgba(168,196,224," },
    { angle: Math.PI / 2,      color: "rgba(126,207,160," },
    { angle: Math.PI + Math.PI / 6, color: "rgba(232,168,124," },
  ];
  streams.forEach(({ angle, color }) => {
    const len = 120 * age;
    const ex = cx + Math.cos(angle) * len;
    const ey = cy + Math.sin(angle) * len;
    const g = ctx.createLinearGradient(cx, cy, ex, ey);
    g.addColorStop(0, color + "0.7)");
    g.addColorStop(1, color + "0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  });

  // Origin pulse
  const p = 0.9 + 0.1 * Math.sin(t * 0.003);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(cx, cy, 4 * p, 0, Math.PI * 2);
  ctx.fill();
}

function drawReferee(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;

  // Horizontal analysis lines
  for (let i = 0; i < 5; i++) {
    const y = cy - 60 + i * 30;
    const alpha = 0.55 - i * 0.08;
    ctx.strokeStyle = `rgba(168,196,224,${alpha})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 100, y);
    ctx.lineTo(cx + 100, y);
    ctx.stroke();
  }

  // Radial glow
  const pulse = 0.85 + 0.15 * Math.sin(t * 0.002);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70 * pulse);
  grad.addColorStop(0, "rgba(168,196,224,0.18)");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 70 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Offside dashed verticals
  [-38, 38].forEach(dx => {
    ctx.strokeStyle = "rgba(168,196,224,0.35)";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy - 60);
    ctx.lineTo(cx + dx, cy + 60);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function drawFan(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const pulse = 0.9 + 0.1 * Math.sin(t * 0.0018);

  // Concentric circles — pitch centre circle
  const radii = [20, 45, 68, 90];
  radii.forEach((r, i) => {
    ctx.strokeStyle = `rgba(126,207,160,${0.55 - i * 0.1})`;
    ctx.lineWidth = 0.6 - i * 0.1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Centre spot
  ctx.fillStyle = "rgba(126,207,160,0.7)";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawSupporter(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;

  // Pulsing amber energy rings — chaotic frequency
  [0.0035, 0.0028, 0.0042].forEach((freq, i) => {
    const r = (38 + i * 32) * (0.85 + 0.15 * Math.sin(t * freq + i));
    ctx.strokeStyle = `rgba(232,168,124,${0.48 - i * 0.12})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Centre burst
  const p = 0.7 + 0.3 * Math.abs(Math.sin(t * 0.005));
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 * p);
  g.addColorStop(0, "rgba(232,168,124,0.28)");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, 50 * p, 0, Math.PI * 2);
  ctx.fill();
}

function drawSplit(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const age = Math.min(t / 800, 1);

  // Germany side — red diagonal streaks (left)
  const germanyLines = [[-80, 90, -20, 10], [-55, 90, 10, 10], [-30, 90, 40, 15]];
  germanyLines.forEach(([x1, y1, x2, y2]) => {
    const g = ctx.createLinearGradient(cx + x1, cy + y1, cx + x2, cy + y2);
    g.addColorStop(0, `rgba(210,40,40,${0.55 * age})`);
    g.addColorStop(1, `rgba(210,40,40,0)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + x1, cy + y1);
    ctx.lineTo(cx + x2, cy + y2);
    ctx.stroke();
  });

  // Brazil side — gold-green streaks (right)
  const brazilLines = [[80, 90, 20, 10], [55, 90, -10, 10], [30, 90, -40, 15]];
  brazilLines.forEach(([x1, y1, x2, y2]) => {
    const g = ctx.createLinearGradient(cx + x1, cy + y1, cx + x2, cy + y2);
    g.addColorStop(0, `rgba(40,180,80,${0.55 * age})`);
    g.addColorStop(1, `rgba(40,180,80,0)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + x1, cy + y1);
    ctx.lineTo(cx + x2, cy + y2);
    ctx.stroke();
  });

  // Vertical dividing line
  ctx.strokeStyle = `rgba(255,255,255,${0.2 * age})`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 70);
  ctx.lineTo(cx, cy + 70);
  ctx.stroke();
}

function drawReveal(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const age = Math.min(t / 1000, 1);

  // Full branching tree: root → 3 coloured branches
  const branches = [
    { angle: -Math.PI / 3,     color: "rgba(168,196,224," },
    { angle: -Math.PI / 2,     color: "rgba(255,255,255,"  },
    { angle: -Math.PI * 2 / 3, color: "rgba(232,168,124," },
  ];

  // Root stem
  const rootLen = 50 * age;
  ctx.strokeStyle = `rgba(255,255,255,${0.4 * age})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 70);
  ctx.lineTo(cx, cy + 70 - rootLen);
  ctx.stroke();

  if (age > 0.4) {
    const branchAge = (age - 0.4) / 0.6;
    branches.forEach(({ angle, color }) => {
      const len = 80 * branchAge;
      const ex = cx + Math.cos(angle) * len;
      const ey = cy + 70 - rootLen + Math.sin(angle) * len;
      const g = ctx.createLinearGradient(cx, cy + 70 - rootLen, ex, ey);
      g.addColorStop(0, color + "0.6)");
      g.addColorStop(1, color + "0.2)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 70 - rootLen);
      ctx.quadraticCurveTo(cx + Math.cos(angle) * len * 0.5, cy + 70 - rootLen + Math.sin(angle) * len * 0.5, ex, ey);
      ctx.stroke();

      // Terminal glow
      if (branchAge > 0.8) {
        const glow = (branchAge - 0.8) / 0.2;
        ctx.fillStyle = color + `${0.55 * glow})`;
        ctx.beginPath();
        ctx.arc(ex, ey, 4 * glow, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

const DRAW_FNS: Record<string, (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void> = {
  anticipation: drawAnticipation,
  miss        : drawMiss,
  fracture    : drawFracture,
  referee     : drawReferee,
  fan         : drawFan,
  supporter   : drawSupporter,
  split       : drawSplit,
  reveal      : drawReveal,
};

// ── Text animation variants ───────────────────────────────────────────────────

const textVariants = {
  enter : (d: number) => ({
    y      : d > 0 ? 48 : -48,
    opacity: 0,
    filter : "blur(6px)",
    scale  : d > 0 ? 0.96 : 1.04,
  }),
  center: { y: 0, opacity: 1, filter: "blur(0px)", scale: 1 },
  exit  : (d: number) => ({
    y      : d > 0 ? -48 : 48,
    opacity: 0,
    filter : "blur(6px)",
    scale  : d > 0 ? 1.04 : 0.96,
  }),
};

// ── Component ────────────────────────────────────────────────────────────────

export default function StorySection({ visible, onComplete }: Props) {
  const [sceneIdx,   setSceneIdx]   = useState(0);
  const [direction,  setDirection]  = useState(1);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const mountTimeRef= useRef<number>(0);
  const accumRef    = useRef<number>(0);
  const sceneIdxRef = useRef<number>(0);
  const advancingRef= useRef<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Sync ref with state for stable event handlers
  useEffect(() => { sceneIdxRef.current = sceneIdx; }, [sceneIdx]);

  // ── Canvas RAF loop ──
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    mountTimeRef.current = performance.now();

    const loop = (now: number) => {
      const elapsed = now - mountTimeRef.current;
      const scene   = SCENES[sceneIdxRef.current];
      const fn      = DRAW_FNS[scene.canvasKey];
      const dpr     = devicePixelRatio;
      ctx.save();
      ctx.scale(dpr, dpr);
      fn(ctx, canvas.offsetWidth, canvas.offsetHeight, elapsed);
      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [visible]);

  // Reset canvas mount time when scene changes so animations restart
  const resetMount = () => { mountTimeRef.current = performance.now(); };

  // ── Advance/retreat logic ──
  const advance = useCallback((delta: number) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setTimeout(() => { advancingRef.current = false; }, 420);

    const next = sceneIdxRef.current + delta;
    if (next < 0) return;
    if (next >= SCENES.length) {
      // All scenes consumed → trigger portals
      onCompleteRef.current();
      return;
    }
    setDirection(delta);
    setSceneIdx(next);
    resetMount();
  }, []);

  // ── Wheel accumulator ──
  useEffect(() => {
    if (!visible) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      accumRef.current += e.deltaY;
      if (Math.abs(accumRef.current) >= 80) {
        advance(accumRef.current > 0 ? 1 : -1);
        accumRef.current = 0;
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [visible, advance]);

  // ── Keyboard ──
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") advance(1);
      if (e.key === "ArrowUp"   || e.key === "ArrowLeft")                    advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, advance]);

  // ── Touch ──
  const touchStartY = useRef<number>(0);
  useEffect(() => {
    if (!visible) return;
    const onStart = (e: TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
    const onEnd   = (e: TouchEvent) => {
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 40) advance(dy > 0 ? 1 : -1);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend",   onEnd,   { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend",   onEnd);
    };
  }, [visible, advance]);

  const scene    = SCENES[sceneIdx];
  const isLast   = sceneIdx === SCENES.length - 1;
  const progress = (sceneIdx + 1) / SCENES.length;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 flex overflow-hidden"
          style={{ zIndex: 55 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ── Background tint — transitions per scene ── */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ background: scene.bg }}
            transition={{ duration: 0.75, ease: "easeInOut" }}
          />

          {/* ── LEFT PANEL: narrative text ── */}
          <div
            className="relative flex flex-col justify-center"
            style={{
              width  : "50%",
              padding: "0 clamp(32px, 6vw, 80px)",
              zIndex : 2,
            }}
          >
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={sceneIdx}
                custom={direction}
                variants={textVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Kicker */}
                <motion.p
                  style={{
                    fontFamily   : "var(--font-inter), sans-serif",
                    fontWeight   : 300,
                    fontSize     : "clamp(0.5rem, 0.75vw, 0.7rem)",
                    letterSpacing: "0.38em",
                    textTransform: "uppercase",
                    color        : scene.accent,
                    marginBottom : "1.2rem",
                    lineHeight   : 1,
                  }}
                >
                  {scene.kicker}
                </motion.p>

                {/* Headline */}
                <h2
                  style={{
                    fontFamily   : "var(--font-inter), sans-serif",
                    fontWeight   : 300,
                    fontSize     : "clamp(1.4rem, 3.2vw, 2.8rem)",
                    letterSpacing: "0.02em",
                    color        : "rgba(255,255,255,0.95)",
                    lineHeight   : 1.15,
                    margin       : "0 0 1.4rem 0",
                  }}
                >
                  {scene.headline}
                </h2>

                {/* Body */}
                {scene.body && (
                  <p
                    style={{
                      fontFamily   : "var(--font-inter), sans-serif",
                      fontWeight   : 300,
                      fontSize     : "clamp(0.75rem, 1.1vw, 0.95rem)",
                      letterSpacing: "0.04em",
                      color        : "rgba(255,255,255,0.52)",
                      lineHeight   : 1.7,
                      maxWidth     : "400px",
                    }}
                  >
                    {scene.body}
                  </p>
                )}

                {/* CTA on last scene */}
                {isLast && (
                  <motion.button
                    style={{
                      marginTop    : "2.2rem",
                      padding      : "0.6rem 2rem",
                      border       : "1px solid rgba(255,255,255,0.25)",
                      background   : "transparent",
                      color        : "rgba(255,255,255,0.8)",
                      fontFamily   : "var(--font-inter), sans-serif",
                      fontWeight   : 300,
                      fontSize     : "0.65rem",
                      letterSpacing: "0.35em",
                      textTransform: "uppercase",
                      cursor       : "none",
                    }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.7 }}
                    onClick={() => onCompleteRef.current()}
                    whileHover={{ borderColor: "rgba(255,255,255,0.55)", color: "rgba(255,255,255,1)" }}
                  >
                    Choose your reality
                  </motion.button>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Scroll hint (non-last scenes) */}
            {!isLast && (
              <motion.div
                style={{
                  position     : "absolute",
                  bottom       : "7vh",
                  left         : "clamp(32px, 6vw, 80px)",
                  display      : "flex",
                  alignItems   : "center",
                  gap          : "10px",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <motion.div
                  style={{
                    width     : "1px",
                    height    : "24px",
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)",
                  }}
                  animate={{ scaleY: [1, 1.4, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
                <span
                  style={{
                    fontFamily   : "var(--font-inter), sans-serif",
                    fontWeight   : 300,
                    fontSize     : "0.48rem",
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color        : "rgba(255,255,255,0.28)",
                  }}
                >
                  Scroll to continue
                </span>
              </motion.div>
            )}
          </div>

          {/* ── VERTICAL DIVIDER ── */}
          <div
            style={{
              width     : "1px",
              background: "rgba(255,255,255,0.06)",
              flexShrink: 0,
              zIndex    : 2,
            }}
          />

          {/* ── RIGHT PANEL: living canvas ── */}
          <div
            className="relative flex items-center justify-center"
            style={{ flex: 1, zIndex: 2 }}
          >
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                inset   : 0,
                width   : "100%",
                height  : "100%",
              }}
            />
          </div>

          {/* ── PROGRESS DOTS ── */}
          <div
            style={{
              position      : "absolute",
              right         : "clamp(20px, 3vw, 36px)",
              top           : "50%",
              transform     : "translateY(-50%)",
              display       : "flex",
              flexDirection : "column",
              gap           : "10px",
              zIndex        : 10,
            }}
          >
            {SCENES.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  opacity        : i === sceneIdx ? 1 : 0.25,
                  scale          : i === sceneIdx ? 1.3 : 1,
                  backgroundColor: i === sceneIdx ? scene.accent : "rgba(255,255,255,0.4)",
                }}
                transition={{ duration: 0.35 }}
                style={{ width: "4px", height: "4px", borderRadius: "50%" }}
              />
            ))}
          </div>

          {/* ── BOTTOM PROGRESS BAR ── */}
          <div
            style={{
              position  : "absolute",
              bottom    : 0,
              left      : 0,
              right     : 0,
              height    : "1px",
              background: "rgba(255,255,255,0.05)",
              zIndex    : 10,
            }}
          >
            <motion.div
              style={{ height: "100%", background: "rgba(255,255,255,0.28)" }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
