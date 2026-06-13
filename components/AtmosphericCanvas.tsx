"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  opacity: number;
  baseOpacity: number;
  life: number;
  maxLife: number;
}

interface Props {
  phase    : number;                                          // 0–4
  lensHover: "referee" | "fan" | "supporter" | null;
  mousePos : { x: number; y: number };                       // -1..1 normalized
}

const LENS_COLORS = {
  referee  : [168, 196, 224] as [number, number, number],
  fan      : [126, 207, 160] as [number, number, number],
  supporter: [232, 168, 124] as [number, number, number],
};

const PARTICLE_COUNT = 58;

function createParticle(w: number, h: number): Particle {
  return {
    x          : Math.random() * w,
    y          : h + Math.random() * 50,
    vx         : (Math.random() - 0.5) * 0.28,
    vy         : -(0.12 + Math.random() * 0.32),
    size       : 0.7 + Math.random() * 1.8,
    opacity    : 0,
    baseOpacity: 0.10 + Math.random() * 0.20,
    life       : 0,
    maxLife    : 220 + Math.random() * 320,
  };
}

export default function AtmosphericCanvas({ phase, lensHover, mousePos }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const phaseRef    = useRef(phase);
  const lensRef     = useRef(lensHover);
  const mouseRef    = useRef(mousePos);
  const rafRef      = useRef<number>(0);
  const particlesRef= useRef<Particle[]>([]);

  // Keep refs current — no re-renders from prop changes
  useEffect(() => { phaseRef.current  = phase;    }, [phase]);
  useEffect(() => { lensRef.current   = lensHover;}, [lensHover]);
  useEffect(() => { mouseRef.current  = mousePos; }, [mousePos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Pre-scatter particles
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(canvas.width, canvas.height)
    );
    particlesRef.current.forEach((p) => {
      p.y    = Math.random() * canvas.height;
      p.life = Math.random() * p.maxLife;
    });

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const ph = phaseRef.current;
      const lens = lensRef.current;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      // Overall particle intensity grows with phase
      const intensity = 0.25 + ph * 0.16;

      // Cursor position in pixels (for proximity calculations)
      const cursorX = (mouse.x * 0.5 + 0.5) * w;
      const cursorY = (mouse.y * 0.5 + 0.5) * h;

      particlesRef.current.forEach((pt) => {
        pt.life += 1;

        // Gentle swaying
        pt.x += pt.vx + Math.sin(pt.life * 0.012) * 0.18;
        pt.y += pt.vy;

        // ── Cursor attraction (phases 3–4: ball + portals) ──
        if (ph >= 3) {
          const dx   = cursorX - pt.x;
          const dy   = cursorY - pt.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180 && dist > 1) {
            const strength = ((180 - dist) / 180) * 0.045;
            pt.vx += (dx / dist) * strength;
            pt.vy += (dy / dist) * strength * 0.6;
          }
          // Dampen to prevent runaway
          pt.vx *= 0.97;
          pt.vy *= 0.97;
        }

        // ── Lens zone drift (portals phase) ──
        if (lens && ph >= 4) {
          const targetX = lens === "referee" ? w * 0.17 : lens === "fan" ? w * 0.5 : w * 0.83;
          pt.vx += (targetX - pt.x) * 0.00007;
          pt.vx *= 0.99;
        }

        // ── Lifetime opacity ──
        const lr = pt.life / pt.maxLife;
        if (lr < 0.15)      pt.opacity = (lr / 0.15) * pt.baseOpacity;
        else if (lr > 0.75) pt.opacity = ((1 - lr) / 0.25) * pt.baseOpacity;
        else                pt.opacity = pt.baseOpacity;

        // ── Reset off-screen / expired ──
        if (pt.y < -20 || pt.life > pt.maxLife || pt.x < -20 || pt.x > w + 20) {
          Object.assign(pt, createParticle(w, h));
          pt.y    = h + 10;
          pt.life = 0;
        }

        // ── Color — white by default, tinted toward active lens ──
        let r = 255, g = 255, b = 255;
        if (lens) {
          const [lr2, lg, lb] = LENS_COLORS[lens];
          r = 255 + (lr2 - 255) * 0.6;
          g = 255 + (lg  - 255) * 0.6;
          b = 255 + (lb  - 255) * 0.6;
        }

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${pt.opacity * intensity})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 25 }}
    />
  );
}
