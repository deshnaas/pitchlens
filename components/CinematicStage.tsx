"use client";

import { useState, useCallback, useEffect } from "react";
import VideoSequence from "./VideoSequence";
import EnvironmentOverlay from "./EnvironmentOverlay";
import TitleReveal from "./TitleReveal";
import LensPortals from "./LensPortals";
import CinematicCursor from "./CinematicCursor";

/*
  Phase map:
  0 — Black silence / initial
  1 — Video 1: Stadium awakening (title ghost: 12% opacity)
  2 — Video 2: Aerial descent    (title emerging: characters blur-in)
  3 — Video 3: Hold / stillness  (title full + subtitle)
  4 — Video 4: The Ball          (full title + "CHOOSE YOUR REALITY" pulse)
  5 — Post-sequence              (Three Realities portals visible, video 4 loops)
*/

export default function CinematicStage() {
  const [videoPhase, setVideoPhase] = useState(0);
  const [titlePhase, setTitlePhase] = useState(0);
  const [portalsVisible, setPortalsVisible] = useState(false);
  const [lensHover, setLensHover] = useState<"referee" | "fan" | "supporter" | null>(null);
  const [started, setStarted] = useState(false);

  // Map video index → title phase
  const handlePhaseChange = useCallback((phase: number) => {
    setVideoPhase(phase);
    if (phase === 0) setTitlePhase(1);
    if (phase === 1) setTitlePhase(1);
    if (phase === 2) setTitlePhase(2);
    if (phase === 3) setTitlePhase(3);
  }, []);

  const handleVideoComplete = useCallback(() => {
    setVideoPhase(4);
    setTitlePhase(3);
    // Portals emerge 1.4s after video sequence ends
    setTimeout(() => setPortalsVisible(true), 1400);
  }, []);

  // Autostart after brief black silence
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Kick title to phase 1 when video starts
  useEffect(() => {
    if (started) setTitlePhase(1);
  }, [started]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <CinematicCursor />

      {/* Video base layer */}
      {started && (
        <VideoSequence
          onPhaseChange={handlePhaseChange}
          onComplete={handleVideoComplete}
        />
      )}

      {/* Environment overlays — color, grain, vignette */}
      <EnvironmentOverlay lensHover={lensHover} phase={videoPhase} />

      {/* Title: only show from phase 1 onward */}
      {videoPhase >= 0 && (
        <TitleReveal phase={titlePhase} />
      )}

      {/* Lens portals — emerge after sequence */}
      <LensPortals
        visible={portalsVisible}
        onHoverChange={setLensHover}
      />
    </div>
  );
}
