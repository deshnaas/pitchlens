"use client";
import { useEffect, useRef, useState } from "react";

// Total "virtual scroll distance" to traverse 0→1
const TOTAL_SCROLL = 1400;

export function useScrollTimeline() {
  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId: number;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 40;  // line mode
      if (e.deltaMode === 2) delta *= 800; // page mode
      targetRef.current = Math.max(0, Math.min(1, targetRef.current + delta / TOTAL_SCROLL));
    };

    // Touch support (mobile / trackpad)
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const delta = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      targetRef.current = Math.max(0, Math.min(1, targetRef.current + delta / TOTAL_SCROLL));
    };

    // Keyboard support — arrow keys / space
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowDown", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
        targetRef.current = Math.min(1, targetRef.current + 0.08);
      }
      if (["ArrowUp", "ArrowLeft"].includes(e.key)) {
        e.preventDefault();
        targetRef.current = Math.max(0, targetRef.current - 0.08);
      }
    };

    // Lerp loop — smooth inertia
    const tick = () => {
      const c = currentRef.current;
      const t = targetRef.current;
      const next = c + (t - c) * 0.07;
      if (Math.abs(next - c) > 0.00008) {
        currentRef.current = next;
        setProgress(next);
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return progress;
}
