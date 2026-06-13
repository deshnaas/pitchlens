"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  baseOpacity: number;
  hue: number; // 0=white, 1=referee-blue, 2=fan-green, 3=supporter-amber
  life: number;
  maxLife: number;
}

interface Props {
  progress: number;
  lensHover: "referee" | "fan" | "supporter" | null;
}

const LENS_COLORS = {
  referee:  [168, 196, 224],
  fan:      [126, 207, 160],
  supporter:[232, 168, 124],
};

const PARTICLE_COUNT = 55;

function createParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: h + Math.random() * 40,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(0.15 + Math.random() * 0.35),
    size: 0.8 + Math.random() * 2,
    opacity: 0,
    baseOpacity: 0.12 + Math.random() * 0.22,
    hue: 0,
    life: 0,
    maxLife: 200 + Math.random() * 300,
  };
}

export default function AtmosphericCanvas({ progress, lensHover }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const progressRef = useRef(progress);
  const lensRef = useRef(lensHover);
  const rafRef = useRef<number>(0);

  // Keep refs current without triggering re-renders
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { lensRef.current = lensHover; }, [lensHover]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles spread across the screen
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(canvas.width, canvas.height)
    );
    // Pre-scatter them vertically for immediate feel
    particlesRef.current.forEach((p) => {
      p.y = Math.random() * canvas.height;
      p.life = Math.random() * p.maxLife;
    });

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const p = progressRef.current;
      const lens = lensRef.current;

      ctx.clearRect(0, 0, w, h);

      // Particle intensity scales with progress — more particles feel as portals reveal
      const intensityMultiplier = 0.3 + p * 0.7;

      particlesRef.current.forEach((pt) => {
        pt.life += 1;
        pt.x += pt.vx + Math.sin(pt.life * 0.01) * 0.2;
        pt.y += pt.vy;

        // Fade in / out over lifetime
        const lifeRatio = pt.life / pt.maxLife;
        if (lifeRatio < 0.15) {
          pt.opacity = (lifeRatio / 0.15) * pt.baseOpacity;
        } else if (lifeRatio > 0.75) {
          pt.opacity = ((1 - lifeRatio) / 0.25) * pt.baseOpacity;
        } else {
          pt.opacity = pt.baseOpacity;
        }

        // Drift toward lens zone if hovered
        if (lens) {
          const targetX = lens === "referee" ? w * 0.16 : lens === "fan" ? w * 0.5 : w * 0.84;
          pt.vx += (targetX - pt.x) * 0.00008;
          pt.vx *= 0.99; // dampen
        }

        // Reset when off-screen or life ends
        if (pt.y < -20 || pt.life > pt.maxLife || pt.x < -20 || pt.x > w + 20) {
          Object.assign(pt, createParticle(w, h));
          pt.y = h + 10;
        }

        // Color — white normally, shifts to lens color on hover
        let r = 255, g = 255, b = 255;
        if (lens) {
          const [lr, lg, lb] = LENS_COLORS[lens];
          // Blend toward lens color based on proximity to that zone
          const blendFactor = 0.65;
          r = 255 + (lr - 255) * blendFactor;
          g = 255 + (lg - 255) * blendFactor;
          b = 255 + (lb - 255) * blendFactor;
        }

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${pt.opacity * intensityMultiplier})`;
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // stable effect — reads from refs

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 25 }}
    />
  );
}
