"use client";

// Global custom cursor — both elements track mouse via RAF at native speed.
// No spring lag — avoids jank on heavy animation pages (e.g. Supporter Lens).

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let x = -200, y = -200;
    let rafId = 0;

    const onMove = (e: MouseEvent) => { x = e.clientX; y = e.clientY; };
    window.addEventListener("mousemove", onMove, { passive: true });

    const tick = () => {
      if (dotRef.current) {
        dotRef.current.style.left = `${x}px`;
        dotRef.current.style.top  = `${y}px`;
      }
      if (ringRef.current) {
        ringRef.current.style.left = `${x}px`;
        ringRef.current.style.top  = `${y}px`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <div ref={dotRef}  className="cursor-dot"
        style={{ position: "fixed", pointerEvents: "none", zIndex: 9999 }} />
      <div ref={ringRef} className="cursor-ring"
        style={{ position: "fixed", pointerEvents: "none", zIndex: 9998,
          borderColor: "var(--cursor-accent, rgba(255,255,255,0.38))",
          transition: "border-color 0.35s ease, width 0.25s ease, height 0.25s ease" }} />
    </>
  );
}
