"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * StorySection — "ONE MOMENT. MANY REALITIES."
 *
 * One continuous world. The camera travels through a branching structure.
 * The structure is always visible. Content appears at destinations inside it.
 * No slides. No sections. No presentations. Camera movement IS the navigation.
 *
 * World space: y grows downward. Camera lerps toward CAMERA_STEPS[step].
 * Canvas draws the full tree at every frame; camera transform pans/zooms.
 */

interface Props {
  visible   : boolean;
  onComplete: () => void;
}

// ── World-space node positions ────────────────────────────────────────────────

const N = {
  root:      { x: 0,    y: -480 },
  miss:      { x: 0,    y: -180 },
  fracture:  { x: 0,    y:  100 },
  referee:   { x: -340, y:  390 },
  fan:       { x: 0,    y:  390 },
  supporter: { x: 340,  y:  390 },
  reveal:    { x: 0,    y:  580 },
};

// ── Camera positions per step ─────────────────────────────────────────────────
// x, y = world-space focus point (maps to screen centre)
// zoom = canvas scale

const CAMERA_STEPS = [
  { x: 0,    y: -480, zoom: 0.90 },  // 0  root — penalty awarded     (start pulled back)
  { x: 0,    y: -180, zoom: 1.40 },  // 1  miss — zoom IN close        (arrival feel)
  { x: 0,    y:  100, zoom: 0.72 },  // 2  fracture — zoom OUT wide    (reveal 3 branches)
  { x: -340, y:  390, zoom: 1.80 },  // 3  referee — zoom IN deep
  { x: 0,    y:  390, zoom: 1.80 },  // 4  fan — zoom IN deep
  { x: 340,  y:  390, zoom: 1.80 },  // 5  supporter — zoom IN deep
  { x: 0,    y:  520, zoom: 0.48 },  // 6  full tree — big zoom OUT
] as const;

// ── Content at each step ──────────────────────────────────────────────────────

const STEPS = [
  {
    kicker : "72'",
    headline: "Germany are awarded a penalty.",
    body   : "Kai Havertz steps up. The stadium holds its breath.",
    accent : "rgba(255,255,255,0.7)",
    node   : "root",
  },
  {
    kicker : "72' 14\"",
    headline: "He misses.",
    body   : "The ball drifts wide. A moment that means a thousand different things.",
    accent : "rgba(200,210,255,0.7)",
    node   : "miss",
  },
  {
    kicker : "ONE MOMENT.  MANY REALITIES.",
    headline: "The same event. Three completely different worlds.",
    body   : "Where you stand changes everything you see.",
    accent : "rgba(180,200,255,0.65)",
    node   : "fracture",
  },
  {
    kicker : "REFEREE POV",
    headline: "The penalty was correctly awarded. Play continues.",
    body   : "Laws applied. Process followed. Decision documented. Correct.",
    accent : "rgba(168,196,224,0.85)",
    node   : "referee",
  },
  {
    kicker : "NEW FAN",
    headline: "Germany had a chance. Havertz missed.",
    body   : "A penalty is a free kick on goal from twelve yards. The goalkeeper guessed right.",
    accent : "rgba(126,207,160,0.85)",
    node   : "fan",
  },
  {
    kicker : "TEAM SUPPORTER",
    headline: "NOOO. How did he miss that?",
    body   : "That was THE chance. I can't even look.",
    accent : "rgba(232,168,124,0.85)",
    node   : "supporter",
  },
  {
    kicker : "ONE EVENT.  MULTIPLE TRUTHS.",
    headline: "This is PitchLens.",
    body   : "Choose your reality.",
    accent : "rgba(255,255,255,0.6)",
    node   : "reveal",
  },
] as const;

// ── Node colours ──────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, [number,number,number]> = {
  root:      [255, 255, 255],
  miss:      [200, 210, 255],
  fracture:  [180, 200, 255],
  referee:   [168, 196, 224],
  fan:       [126, 207, 160],
  supporter: [232, 168, 124],
  reveal:    [255, 255, 255],
};

// ── Particle pool ─────────────────────────────────────────────────────────────

interface Particle {
  pathIdx: number;
  t      : number;  // 0→1 progress along path
  speed  : number;
  alpha  : number;
}

function initParticles(): Particle[] {
  const ps: Particle[] = [];
  for (let pi = 0; pi < 5; pi++) {
    for (let i = 0; i < 6; i++) {
      ps.push({ pathIdx: pi, t: Math.random(), speed: 0.0004 + Math.random() * 0.0003, alpha: 0.4 + Math.random() * 0.5 });
    }
  }
  return ps;
}

// ── Bezier helpers ────────────────────────────────────────────────────────────

function bezierPoint(t: number, p0: {x:number,y:number}, cp: {x:number,y:number}, p1: {x:number,y:number}) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p1.y,
  };
}

// Path definitions: [from, controlPoint, to, colorKey]
const PATHS = [
  { from: N.root,      cp: { x: 0,    y: -330 }, to: N.miss,      color: "white" },
  { from: N.miss,      cp: { x: 0,    y: -40  }, to: N.fracture,  color: "white" },
  { from: N.fracture,  cp: { x: -200, y: 220  }, to: N.referee,   color: "referee" },
  { from: N.fracture,  cp: { x: 0,    y: 260  }, to: N.fan,       color: "fan" },
  { from: N.fracture,  cp: { x: 200,  y: 220  }, to: N.supporter, color: "supporter" },
];

const PATH_COLORS: Record<string, [number,number,number]> = {
  white    : [220, 230, 255],
  referee  : [168, 196, 224],
  fan      : [126, 207, 160],
  supporter: [232, 168, 124],
};

// ── Canvas draw ───────────────────────────────────────────────────────────────

function drawWorld(
  ctx    : CanvasRenderingContext2D,
  sw     : number,  // screen width
  sh     : number,  // screen height
  camX   : number,
  camY   : number,
  zoom   : number,
  t      : number,  // elapsed ms
  step   : number,
  particles: Particle[],
) {
  ctx.clearRect(0, 0, sw, sh);

  // Camera transform: world → screen
  // screen_pos = (world_pos - cam) * zoom + screenCenter
  const scx = sw / 2;
  const scy = sh / 2;

  function w2s(wx: number, wy: number) {
    return {
      x: (wx - camX) * zoom + scx,
      y: (wy - camY) * zoom + scy,
    };
  }

  // ── Draw paths ──
  PATHS.forEach((path, pi) => {
    const [r, g, b] = PATH_COLORS[path.color];

    // Determine visibility / brightness based on step
    let baseAlpha = 0.18;
    if (step >= 2) baseAlpha = 0.35; // fracture onwards: full tree visible
    // Highlight active branch
    if (step === 3 && pi === 2) baseAlpha = 0.75;
    if (step === 4 && pi === 3) baseAlpha = 0.75;
    if (step === 5 && pi === 4) baseAlpha = 0.75;
    if (step === 6) baseAlpha = 0.55;

    const sp0 = w2s(path.from.x, path.from.y);
    const scp = w2s(path.cp.x,   path.cp.y);
    const sp1 = w2s(path.to.x,   path.to.y);

    // Glow pass (thick, low alpha)
    ctx.strokeStyle = `rgba(${r},${g},${b},${baseAlpha * 0.4})`;
    ctx.lineWidth   = 4 * zoom;
    ctx.beginPath();
    ctx.moveTo(sp0.x, sp0.y);
    ctx.quadraticCurveTo(scp.x, scp.y, sp1.x, sp1.y);
    ctx.stroke();

    // Core line
    ctx.strokeStyle = `rgba(${r},${g},${b},${baseAlpha})`;
    ctx.lineWidth   = 0.8 * zoom;
    ctx.beginPath();
    ctx.moveTo(sp0.x, sp0.y);
    ctx.quadraticCurveTo(scp.x, scp.y, sp1.x, sp1.y);
    ctx.stroke();
  });

  // ── Draw particles ──
  particles.forEach(p => {
    // Advance
    p.t = (p.t + p.speed) % 1;

    const path   = PATHS[p.pathIdx];
    const [r, g, b] = PATH_COLORS[path.color];
    const wpos   = bezierPoint(p.t, path.from, path.cp, path.to);
    const spos   = w2s(wpos.x, wpos.y);

    // Only draw if on screen
    if (spos.x < -20 || spos.x > sw + 20 || spos.y < -20 || spos.y > sh + 20) return;

    const alpha = p.alpha * (step >= 2 ? 0.85 : 0.35);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(spos.x, spos.y, 2 * zoom, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Draw nodes ──
  const nodeList = [
    { key: "root",      n: N.root },
    { key: "miss",      n: N.miss },
    { key: "fracture",  n: N.fracture },
    { key: "referee",   n: N.referee },
    { key: "fan",       n: N.fan },
    { key: "supporter", n: N.supporter },
  ];

  nodeList.forEach(({ key, n: wn }) => {
    const [r, g, b] = NODE_COLORS[key];
    const sp = w2s(wn.x, wn.y);

    // Off-screen cull
    if (sp.x < -60 || sp.x > sw + 60 || sp.y < -60 || sp.y > sh + 60) return;

    // Is this the active node?
    const activeNode = STEPS[step].node;
    const isActive   = activeNode === key;
    const pulse = isActive ? (0.8 + 0.2 * Math.sin(t * 0.003)) : 1;

    // Aura
    if (isActive) {
      const aura = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 44 * zoom * pulse);
      aura.addColorStop(0, `rgba(${r},${g},${b},0.22)`);
      aura.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 44 * zoom * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ring
    ctx.strokeStyle = `rgba(${r},${g},${b},${isActive ? 0.7 : 0.28})`;
    ctx.lineWidth   = (isActive ? 1.2 : 0.6) * zoom;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, (isActive ? 14 : 10) * zoom * (isActive ? pulse : 1), 0, Math.PI * 2);
    ctx.stroke();

    // Core dot
    ctx.fillStyle = `rgba(${r},${g},${b},${isActive ? 0.9 : 0.45})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, (isActive ? 4.5 : 3) * zoom, 0, Math.PI * 2);
    ctx.fill();
  });

  // ── Ambient floating particles (background depth) ──
  const seed = Math.floor(t / 60) * 0;  // stable
  for (let i = 0; i < 18; i++) {
    const drift = Math.sin(t * 0.0008 + i * 1.7) * 2;
    const wx = (((i * 173.3) % 900) - 450) + drift;
    const wy = (((i * 97.1)  % 1400) - 600);
    const sp = w2s(wx, wy);
    if (sp.x < 0 || sp.x > sw || sp.y < 0 || sp.y > sh) continue;
    const a = 0.04 + 0.03 * Math.sin(t * 0.001 + i);
    ctx.fillStyle = `rgba(200,220,255,${a})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  void seed;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function StorySection({ visible, onComplete }: Props) {
  const [step,       setStep]       = useState(0);
  const [dwellReady, setDwellReady] = useState(false);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const rafRef         = useRef<number>(0);
  const startTimeRef   = useRef<number>(0);
  const accumRef       = useRef<number>(0);
  const stepRef        = useRef<number>(0);
  const advancingRef   = useRef<boolean>(false);
  const lastAdvanceRef = useRef<number>(0);   // timestamp of last scene change
  const particlesRef   = useRef<Particle[]>(initParticles());
  const onCompleteRef  = useRef(onComplete);

  // Minimum ms the user must dwell on each scene before scrolling advances it.
  // Gives them time to actually read. After 2 s they're free to scroll forward.
  const MIN_DWELL_MS = 2000;

  // Lerped camera state
  const camRef = useRef({ x: CAMERA_STEPS[0].x, y: CAMERA_STEPS[0].y, zoom: CAMERA_STEPS[0].zoom });

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    stepRef.current = step;
    // Reset dwell gate on every step change — user must wait before scrolling on
    setDwellReady(false);
    const t = setTimeout(() => setDwellReady(true), MIN_DWELL_MS);
    return () => clearTimeout(t);
  }, [step, MIN_DWELL_MS]);

  // ── Reset on show ──
  useEffect(() => {
    if (visible) {
      setStep(0);
      setDwellReady(false);
      stepRef.current = 0;
      accumRef.current = 0;
      lastAdvanceRef.current = Date.now();
      const target = CAMERA_STEPS[0];
      camRef.current = { x: target.x, y: target.y, zoom: target.zoom };
    }
  }, [visible]);

  // ── RAF loop ──
  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener("resize", resize);
    startTimeRef.current = performance.now();

    const loop = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const dpr     = devicePixelRatio;
      const sw      = canvas.offsetWidth;
      const sh      = canvas.offsetHeight;
      const target  = CAMERA_STEPS[stepRef.current];
      const LERP    = 0.044; // controls travel smoothness — lower = slower, weightier camera

      // Lerp camera toward target
      const cam = camRef.current;
      cam.x    += (target.x    - cam.x)    * LERP;
      cam.y    += (target.y    - cam.y)    * LERP;
      cam.zoom += (target.zoom - cam.zoom) * LERP;

      ctx.save();
      ctx.scale(dpr, dpr);
      drawWorld(ctx, sw, sh, cam.x, cam.y, cam.zoom, elapsed, stepRef.current, particlesRef.current);
      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [visible]);

  // ── Advance ──
  const advance = useCallback((delta: number, ignoreDwell = false) => {
    if (advancingRef.current) return;

    // Enforce minimum reading time before forwarding (going back is always instant)
    if (delta > 0 && !ignoreDwell) {
      if (Date.now() - lastAdvanceRef.current < MIN_DWELL_MS) {
        // Reset accumulator so partial scrolls during dwell don't stack up
        accumRef.current = 0;
        return;
      }
    }

    advancingRef.current = true;
    setTimeout(() => { advancingRef.current = false; }, 550);
    lastAdvanceRef.current = Date.now();

    const cur  = stepRef.current;
    const next = cur + delta;
    if (next < 0) return;
    if (next >= STEPS.length) {
      onCompleteRef.current();
      return;
    }
    setStep(next);
    stepRef.current = next;
    accumRef.current = 0; // always clear after a real advance
  }, [MIN_DWELL_MS]);

  // ── Wheel ──
  useEffect(() => {
    if (!visible) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      accumRef.current += e.deltaY;
      if (Math.abs(accumRef.current) >= 220) {
        advance(accumRef.current > 0 ? 1 : -1);
        // accumRef cleared inside advance(); partial drift decays naturally
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [visible, advance]);

  // ── Keyboard ──
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowRight", " "].includes(e.key)) { e.preventDefault(); advance(1);  }
      if (["ArrowUp",   "ArrowLeft"       ].includes(e.key)) { e.preventDefault(); advance(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, advance]);

  // ── Touch ──
  const touchY = useRef(0);
  useEffect(() => {
    if (!visible) return;
    const onStart = (e: TouchEvent) => { touchY.current = e.touches[0].clientY; };
    const onEnd   = (e: TouchEvent) => {
      const dy = touchY.current - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 55) advance(dy > 0 ? 1 : -1);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend",   onEnd,   { passive: true });
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchend", onEnd); };
  }, [visible, advance]);

  const stepData    = STEPS[step];
  const isLastStep  = step === STEPS.length - 1;
  const progress    = (step + 1) / STEPS.length;

  // Accent colour as string for text
  const accent = stepData.accent;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 overflow-hidden"
          style={{ zIndex: 55 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* ── Full-screen canvas — the world ── */}
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />

          {/* ── Subtle background gradient — shifts per POV ── */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background:
                step === 3 ? "radial-gradient(ellipse at 20% 60%, rgba(0,20,60,0.65) 0%, transparent 70%)"
              : step === 4 ? "radial-gradient(ellipse at 50% 60%, rgba(0,40,20,0.60) 0%, transparent 70%)"
              : step === 5 ? "radial-gradient(ellipse at 80% 60%, rgba(60,20,0,0.65) 0%, transparent 70%)"
              : "radial-gradient(ellipse at 50% 50%, rgba(0,4,18,0.50) 0%, transparent 70%)",
            }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />

          {/* ── Content overlay — fades to new content, world stays ── */}
          <div
            className="absolute inset-0 flex flex-col justify-center pointer-events-none"
            style={{
              // Align text bottom-left except on branch nodes (centred toward that side)
              paddingLeft : step === 3 ? "6vw" : step === 5 ? "auto" : "8vw",
              paddingRight: step === 5 ? "6vw" : step === 3 ? "auto" : "auto",
              paddingBottom: "12vh",
              alignItems  : step === 3 ? "flex-start" : step === 5 ? "flex-end" : step === 4 ? "center" : "flex-start",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
                exit   ={{ opacity: 0, y: -16, filter: "blur(6px)" }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  maxWidth   : "480px",
                  textAlign  : step === 4 ? "center" : step === 5 ? "right" : "left",
                  pointerEvents: isLastStep ? "auto" : "none",
                }}
              >
                {/* Kicker */}
                <p style={{
                  fontFamily   : "var(--font-inter), sans-serif",
                  fontWeight   : 300,
                  fontSize     : "clamp(0.48rem, 0.7vw, 0.68rem)",
                  letterSpacing: "0.40em",
                  textTransform: "uppercase",
                  color        : accent,
                  marginBottom : "1rem",
                  lineHeight   : 1,
                }}>
                  {stepData.kicker}
                </p>

                {/* Headline */}
                <h2 style={{
                  fontFamily   : "var(--font-inter), sans-serif",
                  fontWeight   : 300,
                  fontSize     : "clamp(1.2rem, 2.8vw, 2.4rem)",
                  letterSpacing: "0.01em",
                  color        : "rgba(255,255,255,0.94)",
                  lineHeight   : 1.18,
                  margin       : "0 0 1.1rem 0",
                }}>
                  {stepData.headline}
                </h2>

                {/* Body */}
                {stepData.body && (
                  <p style={{
                    fontFamily   : "var(--font-inter), sans-serif",
                    fontWeight   : 300,
                    fontSize     : "clamp(0.7rem, 1vw, 0.88rem)",
                    letterSpacing: "0.04em",
                    color        : "rgba(255,255,255,0.46)",
                    lineHeight   : 1.7,
                    maxWidth     : "380px",
                    margin       : step === 4 ? "0 auto" : step === 5 ? "0 0 0 auto" : undefined,
                  }}>
                    {stepData.body}
                  </p>
                )}

                {/* Final CTA */}
                {isLastStep && (
                  <motion.button
                    style={{
                      marginTop    : "2rem",
                      padding      : "0.55rem 2.2rem",
                      border       : "1px solid rgba(255,255,255,0.22)",
                      background   : "transparent",
                      color        : "rgba(255,255,255,0.75)",
                      fontFamily   : "var(--font-inter), sans-serif",
                      fontWeight   : 300,
                      fontSize     : "0.6rem",
                      letterSpacing: "0.38em",
                      textTransform: "uppercase",
                      cursor       : "none",
                      display      : "block",
                      margin       : "2rem auto 0",
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0  }}
                    transition={{ delay: 0.7, duration: 0.7 }}
                    onClick={() => onCompleteRef.current()}
                    whileHover={{ borderColor: "rgba(255,255,255,0.5)", color: "rgba(255,255,255,1)" }}
                  >
                    Choose your reality
                  </motion.button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Scroll hint + dwell indicator ── */}
          {!isLastStep && (
            <div
              className="absolute pointer-events-none flex flex-col items-center"
              style={{ bottom: "5vh", left: "50%", transform: "translateX(-50%)", gap: "10px" }}
            >
              {/* Dwell fill bar — grows from 0 → 100% over MIN_DWELL_MS, then pulses */}
              <div style={{
                width     : "44px",
                height    : "1px",
                background: "rgba(255,255,255,0.10)",
                position  : "relative",
                overflow  : "hidden",
              }}>
                <motion.div
                  style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.50)", transformOrigin: "left" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: dwellReady ? 1 : 1 }}
                  key={`dwell-${step}`}
                  // Animate the fill over MIN_DWELL_MS, then hold
                  transition={{ duration: MIN_DWELL_MS / 1000, ease: "linear" }}
                />
              </div>

              {/* Animated line — only pulses once dwell is ready */}
              <motion.div
                style={{
                  width     : "1px",
                  height    : "24px",
                  background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)",
                }}
                animate={dwellReady
                  ? { scaleY: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }
                  : { scaleY: 0.6,         opacity: 0.2               }
                }
                transition={dwellReady
                  ? { duration: 1.8, repeat: Infinity }
                  : { duration: 0.4 }
                }
              />

              <motion.span
                animate={{ opacity: dwellReady ? 0.32 : 0.12 }}
                transition={{ duration: 0.5 }}
                style={{
                  fontFamily   : "var(--font-inter), sans-serif",
                  fontWeight   : 300,
                  fontSize     : "0.44rem",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color        : "rgba(255,255,255,1)",
                }}
              >
                {dwellReady ? "Scroll to travel" : "Reading…"}
              </motion.span>
            </div>
          )}

          {/* ── Skip button — top right, always available ── */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            onClick={() => onCompleteRef.current()}
            style={{
              position     : "absolute",
              top          : "4vh",
              right        : "3vw",
              zIndex       : 20,
              background   : "transparent",
              border       : "1px solid rgba(255,255,255,0.14)",
              color        : "rgba(255,255,255,0.38)",
              fontFamily   : "var(--font-inter), sans-serif",
              fontWeight   : 300,
              fontSize     : "0.5rem",
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              padding      : "0.45rem 1.1rem",
              cursor       : "none",
              backdropFilter: "blur(4px)",
            }}
            whileHover={{
              color        : "rgba(255,255,255,0.75)",
              borderColor  : "rgba(255,255,255,0.35)",
            }}
          >
            Skip →
          </motion.button>

          {/* ── Step counter (subtle) ── */}
          <div
            className="absolute pointer-events-none"
            style={{ top: "4vh", left: "3vw", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}
          >
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  opacity        : i === step ? 0.9 : i < step ? 0.35 : 0.15,
                  scale          : i === step ? 1.4 : 1,
                  backgroundColor: i === step ? accent : "rgba(255,255,255,0.3)",
                }}
                transition={{ duration: 0.4 }}
                style={{ width: "3px", height: "3px", borderRadius: "50%" }}
              />
            ))}
          </div>

          {/* ── Progress bar ── */}
          <div style={{
            position  : "absolute",
            bottom    : 0,
            left      : 0,
            right     : 0,
            height    : "1px",
            background: "rgba(255,255,255,0.05)",
            zIndex    : 10,
          }}>
            <motion.div
              style={{ height: "100%", background: "rgba(255,255,255,0.28)" }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
