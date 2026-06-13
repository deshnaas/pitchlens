"use client";

import { useState } from "react";
import { useScrollTimeline } from "@/hooks/useScrollTimeline";
import { useMouseParallax } from "@/hooks/useMouseParallax";
import VideoSequence from "./VideoSequence";
import EnvironmentOverlay from "./EnvironmentOverlay";
import TitleReveal from "./TitleReveal";
import LensPortals from "./LensPortals";
import AtmosphericCanvas from "./AtmosphericCanvas";
import ProgressBar from "./ProgressBar";
import CinematicCursor from "./CinematicCursor";

/**
 * CinematicStage — V2
 *
 * Architecture: single continuous progress value (0–1) drives everything.
 * No timer-based phases. No autoplay. The user controls time.
 *
 * progress 0.00–0.24  →  Video 1: stadium awakening
 * progress 0.24–0.45  →  Video 2: aerial descent
 * progress 0.45–0.54  →  Video 3: stillness (compressed + scale push)
 * progress 0.54–1.00  →  Video 4: the ball → portals emerge
 */

export default function CinematicStage() {
  const progress  = useScrollTimeline();
  const parallax  = useMouseParallax();
  const [lensHover, setLensHover] = useState<"referee" | "fan" | "supporter" | null>(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Custom cinematic cursor */}
      <CinematicCursor />

      {/* ── Layer 1: Video base — scroll-scrubbed ── */}
      <VideoSequence progress={progress} parallax={parallax} />

      {/* ── Layer 2: Environment overlays — vignette, grain, tint ── */}
      <EnvironmentOverlay lensHover={lensHover} progress={progress} />

      {/* ── Layer 3: Atmospheric particles ── */}
      <AtmosphericCanvas progress={progress} lensHover={lensHover} />

      {/* ── Layer 4: PITCHLENS title — persistent, moves to top ── */}
      <TitleReveal progress={progress} parallax={parallax} />

      {/* ── Layer 5: Three Realities — atmospheric spatial zones ── */}
      <LensPortals progress={progress} onHoverChange={setLensHover} />

      {/* ── Layer 6: 1px timeline progress bar ── */}
      <ProgressBar progress={progress} />
    </div>
  );
}
