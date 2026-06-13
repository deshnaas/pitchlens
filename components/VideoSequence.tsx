"use client";

import { useEffect, useRef } from "react";

const VIDEOS = [
  "/videos/v1-awakening.mp4",
  "/videos/v2-aerial.mp4",
  "/videos/v3-descent.mp4",
  "/videos/v4-ball.mp4",
];

/**
 * Progress segments — [start, end] — for each video.
 *
 * v3 ("same composition" — static camera) is compressed to 0.45–0.54.
 * It gets a CSS scale push (1.0→1.08) driven by local progress so
 * every scroll pixel shows visible camera movement even on a static shot.
 * Zero dead zones.
 */
const SEGMENTS: [number, number][] = [
  [0.00, 0.24], // v1 — stadium awakening
  [0.24, 0.45], // v2 — aerial descent
  [0.45, 0.54], // v3 — stillness (compressed, augmented with scale)
  [0.54, 1.00], // v4 — the ball / portal reveal
];

interface Props {
  progress: number;
  parallax: { x: number; y: number };
}

function getActiveSeg(p: number): number {
  for (let i = SEGMENTS.length - 1; i >= 0; i--) {
    if (p >= SEGMENTS[i][0]) return i;
  }
  return 0;
}

function localProgress(p: number, seg: number): number {
  const [s, e] = SEGMENTS[seg];
  return Math.max(0, Math.min(1, (p - s) / (e - s)));
}

export default function VideoSequence({ progress, parallax }: Props) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null, null]);
  const readyRef = useRef<boolean[]>([false, false, false, false]);
  const lastTimeRef = useRef<number[]>([-1, -1, -1, -1]);

  // Preload all videos simultaneously on mount
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      video.src = VIDEOS[i];
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.load();
      video.addEventListener(
        "loadedmetadata",
        () => { readyRef.current[i] = true; },
        { once: true }
      );
    });
  }, []);

  // Scrub active video every time progress changes
  useEffect(() => {
    const seg = getActiveSeg(progress);
    const lp = localProgress(progress, seg);
    const video = videoRefs.current[seg];

    if (!video || !readyRef.current[seg]) return;
    const dur = video.duration;
    if (!dur || isNaN(dur)) return;

    // Target time, leave a hair before end to prevent looping
    const t = Math.max(0, Math.min(dur - 0.04, lp * dur));

    // Only seek if the change is meaningful (>1 frame @ 30fps)
    if (Math.abs(t - lastTimeRef.current[seg]) > 0.03) {
      video.currentTime = t;
      lastTimeRef.current[seg] = t;
    }
  }, [progress]);

  const activeSeg = getActiveSeg(progress);

  // V3 scale: 1.00 → 1.08 over its compressed segment — creates push-in motion
  const v3Scale = activeSeg === 2 ? 1 + localProgress(progress, 2) * 0.08 : 1;

  // Parallax offset — applied to all video layers
  const px = parallax.x * -5;
  const py = parallax.y * -5;

  const transform = (i: number) => {
    const scale = i === 2 ? v3Scale : 1.025; // slight overscale hides parallax edges
    return `translate(${px}px, ${py}px) scale(${scale})`;
  };

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
            opacity: activeSeg === i ? 1 : 0,
            transform: transform(i),
            // CSS transition handles the crossfade at segment boundaries
            transition: "opacity 0.45s ease",
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}
