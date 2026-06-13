"use client";
import { useEffect, useRef, useState } from "react";

export function useMouseParallax() {
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let rafId: number;

    const onMouseMove = (e: MouseEvent) => {
      // Normalize to -1..1 from screen center
      targetRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    const tick = () => {
      const c = currentRef.current;
      const t = targetRef.current;
      // Slow, inertial drift — never gimmicky
      c.x += (t.x - c.x) * 0.032;
      c.y += (t.y - c.y) * 0.032;
      setParallax({ x: c.x, y: c.y });
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return parallax;
}
