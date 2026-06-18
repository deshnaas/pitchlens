"use client";

import { useEffect, useRef, useState } from "react";

const VIDEOS = [
  "/videos/v1-awakening.mp4",
  "/videos/v2-aerial.mp4",
  "/videos/v3-descent.mp4",
  "/videos/v4-ball.mp4",
];

/**
 * How long each video plays before we force-advance, regardless of natural end.
 * Targets ~10s total intro → portals appear.
 *   v1: 4.5s  v2: 2.8s  v3: 2.2s  v4: loops
 * Scrolling boosts playbackRate (up to 1.8×) so the journey is faster with interaction.
 */
const MAX_DURATIONS = [4.5, 2.8, 2.2, Infinity];

interface Props {
  parallax: { x: number; y: number };
  onPhaseChange: (videoIndex: number) => void;
  onComplete: () => void;
}

export default function VideoSequence({ parallax, onPhaseChange, onComplete }: Props) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null, null]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadingIndex, setFadingIndex] = useState<number | null>(null);

  // Refs for stable access inside event listeners (no stale closures)
  const activeIdxRef    = useRef(0);
  const advancingRef    = useRef(false);
  const rateDecayRef    = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onPhaseRef      = useRef(onPhaseChange);
  const onCompleteRef   = useRef(onComplete);
  useEffect(() => { onPhaseRef.current    = onPhaseChange; }, [onPhaseChange]);
  useEffect(() => { onCompleteRef.current = onComplete;    }, [onComplete]);

  useEffect(() => {
    // ── 1. Load all videos simultaneously ──
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      v.src       = VIDEOS[i];
      v.preload   = "auto";
      v.muted     = true;
      v.playsInline = true;
      v.load();
    });

    // ── 2. Advance logic (closure-safe — uses local ref variables) ──
    const advance = () => {
      if (advancingRef.current) return;
      const prev = activeIdxRef.current;
      const next = prev + 1;
      if (next >= VIDEOS.length) return;

      advancingRef.current  = true;
      activeIdxRef.current  = next;

      const nextVid = videoRefs.current[next];
      if (nextVid) {
        nextVid.currentTime = 0;
        nextVid.play().catch(() => {});
      }

      setFadingIndex(prev);
      setActiveIndex(next);
      onPhaseRef.current(next);

      // After crossfade completes: pause old video, clear fading state
      setTimeout(() => {
        const oldVid = videoRefs.current[prev];
        if (oldVid) { oldVid.pause(); oldVid.currentTime = 0; }
        setFadingIndex(null);
        advancingRef.current = false;

        // v4 started → notify parent to trigger portals
        if (next === VIDEOS.length - 1) onCompleteRef.current();
      }, 1100);
    };

    // ── 3. Attach timeupdate + ended listeners to every video ──
    videoRefs.current.forEach((v, i) => {
      if (!v) return;

      v.addEventListener("timeupdate", () => {
        if (activeIdxRef.current !== i) return;
        if (MAX_DURATIONS[i] !== Infinity && v.currentTime >= MAX_DURATIONS[i] && !advancingRef.current) {
          advance();
        }
      });

      v.addEventListener("ended", () => {
        if (i === VIDEOS.length - 1) {
          // v4 loops — keeps the ball alive during portal phase
          v.currentTime = 0;
          v.play().catch(() => {});
          return;
        }
        if (activeIdxRef.current === i && !advancingRef.current) {
          advance();
        }
      });
    });

    // ── 4. Start first video — auto-skip if it doesn't load within 3s ──
    const first = videoRefs.current[0];
    let skipTimer: ReturnType<typeof setTimeout> | undefined;
    if (first) {
      const tryPlay = () => {
        clearTimeout(skipTimer);
        first.play().catch(() => {});
      };
      if (first.readyState >= 2) {
        tryPlay();
      } else {
        first.addEventListener("canplay", tryPlay, { once: true });
        // If video hasn't started within 3s (e.g. slow ngrok), jump straight to portals
        skipTimer = setTimeout(() => {
          // Advance through all videos instantly to reach portals
          activeIdxRef.current = VIDEOS.length - 1;
          setActiveIndex(VIDEOS.length - 1);
          onPhaseRef.current(VIDEOS.length - 1);
          onCompleteRef.current();
        }, 3000);
      }
    }
    onPhaseRef.current(0); // notify: v1 is active

    // ── 5. Scroll → playback rate boost ──
    // User feels participation; sequence still works without any scrolling.
    const onWheel = (e: WheelEvent) => {
      const v = videoRefs.current[activeIdxRef.current];
      if (!v) return;
      const boost = Math.min(1, Math.abs(e.deltaY) / 200);
      v.playbackRate = 1 + boost * 0.8; // up to 1.8×
      clearTimeout(rateDecayRef.current);
      rateDecayRef.current = setTimeout(() => {
        const active = videoRefs.current[activeIdxRef.current];
        if (active) active.playbackRate = 1;
      }, 400);
    };
    window.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      window.removeEventListener("wheel", onWheel);
      clearTimeout(rateDecayRef.current);
    };
  }, []); // stable — all callbacks via refs

  // Parallax transform applied to all video layers
  const px = parallax.x * -5;
  const py = parallax.y * -5;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 10 }}>
      {VIDEOS.map((_, i) => (
        <video
          key={i}
          ref={(el) => { videoRefs.current[i] = el; }}
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity   : i === activeIndex ? 1 : 0,
            transform : `translate(${px}px, ${py}px) scale(1.025)`,
            transition: "opacity 1.05s cubic-bezier(0.4, 0, 0.2, 1), transform 0.12s linear",
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}
