"use client";

import { useState, useCallback } from "react";
import { useMouseParallax } from "@/hooks/useMouseParallax";

import VideoSequence     from "./VideoSequence";
import EnvironmentOverlay from "./EnvironmentOverlay";
import MouseLightEffect  from "./MouseLightEffect";
import AtmosphericCanvas from "./AtmosphericCanvas";
import TitleReveal       from "./TitleReveal";
import LensPortals       from "./LensPortals";
import ProgressBar       from "./ProgressBar";
import CinematicCursor   from "./CinematicCursor";

/**
 * CinematicStage — V3
 *
 * Philosophy: 70% cinematic film, 30% interaction.
 *
 * Videos play naturally as a short film.
 * Scrolling accelerates the journey — user feels participation.
 * Mouse moves the world — parallax, light, particles.
 * Phase transitions drive all UI state discretely.
 *
 * Phase map:
 *   0 → black / pre-roll
 *   1 → v1 playing  (stadium awakening)  — title ghost
 *   2 → v2 playing  (aerial descent)     — title emerging
 *   3 → v3 playing  (stillness)          — title full
 *   4 → v4 playing  (the ball)           — portals revealed, title shrinks
 */

function videoIndexToTitlePhase(videoIdx: number, portalsVisible: boolean): number {
  if (portalsVisible) return 4;
  if (videoIdx === 0) return 1;
  if (videoIdx === 1) return 2;
  if (videoIdx >= 2)  return 3;
  return 0;
}

export default function CinematicStage() {
  const parallax = useMouseParallax();

  const [videoPhase,     setVideoPhase]     = useState(0);
  const [portalsVisible, setPortalsVisible] = useState(false);
  const [lensHover,      setLensHover]      = useState<"referee" | "fan" | "supporter" | null>(null);

  const handlePhaseChange = useCallback((idx: number) => {
    setVideoPhase(idx);
  }, []);

  const handleComplete = useCallback(() => {
    // v4 has started — portals emerge after a brief breath
    setTimeout(() => setPortalsVisible(true), 900);
  }, []);

  const titlePhase = videoIndexToTitlePhase(videoPhase, portalsVisible);

  // Derive current stage for phase-specific effects (0–4)
  const effectPhase = portalsVisible ? 4 : videoPhase;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">

      {/* Custom cinematic cursor */}
      <CinematicCursor />

      {/* ── Layer 1: Videos — natural autoplay, scroll boosts rate ── */}
      <VideoSequence
        parallax       = {parallax}
        onPhaseChange  = {handlePhaseChange}
        onComplete     = {handleComplete}
      />

      {/* ── Layer 2: Vignette + grain + lens tint ── */}
      <EnvironmentOverlay lensHover={lensHover} phase={effectPhase} />

      {/* ── Layer 3: Per-phase mouse light — world reacts to camera ── */}
      <MouseLightEffect phase={effectPhase} mousePos={parallax} />

      {/* ── Layer 4: Atmospheric particles — cursor-reactive in late phases ── */}
      <AtmosphericCanvas
        phase    = {effectPhase}
        lensHover= {lensHover}
        mousePos = {parallax}
      />

      {/* ── Layer 5: PITCHLENS title — permanent, shrinks in portal mode ── */}
      <TitleReveal titlePhase={titlePhase} parallax={parallax} />

      {/* ── Layer 6: Three Realities — atmospheric spatial zones ── */}
      <LensPortals
        visible      = {portalsVisible}
        onHoverChange= {setLensHover}
      />

      {/* ── Layer 7: 1px cinematic progress bar ── */}
      <ProgressBar phase={effectPhase} />

    </div>
  );
}
