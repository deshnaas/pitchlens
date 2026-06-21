"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useMouseParallax } from "@/hooks/useMouseParallax";

import VideoSequence     from "./VideoSequence";
import EnvironmentOverlay from "./EnvironmentOverlay";
import MouseLightEffect  from "./MouseLightEffect";
import AtmosphericCanvas from "./AtmosphericCanvas";
import TitleReveal       from "./TitleReveal";
import LensPortals       from "./LensPortals";
import StorySection      from "./StorySection";
import ProgressBar       from "./ProgressBar";
import CinematicCursor   from "./CinematicCursor";
import { ShaderCanvas }  from "@/components/ui/fireflies-1";

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

// Compact fireflies shader (abridged for background use — full shader in fireflies-1.tsx)
const FIREFLIES_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 v_uv;
uniform vec3 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouse;
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 r = iResolution.xy;
  float t = iTime;
  vec3 FC = vec3(fragCoord, t);
  vec4 o = vec4(0.0);
  vec3 s = normalize(FC.rgb * 2.1 - r.xyx), p, c = s / s.y;
  for (float i=0.0,d=0.0,z=0.0; i++<3e1; o.rgb+=(1.1-sin(p))/d) {
    p = s*z; p.z -= t;
    d = ++p.y; p.y = abs(mod(d-2.0,4.0)-2.0);
    p += 0.03*sin(dot(cos(c),sin(c/0.6-t))/0.1)*(p.y-d);
    z += (d = 0.7*length(vec3(cos(p.z/0.1)*0.1,(p+sin(p.z*vec3(0.7,1.0,0.0)+t)).xy)-0.1));
  }
  o = tanh(o/2e2);
  fragColor = vec4(o.rgb, 1.0);
}
void main(){ mainImage(fragColor, gl_FragCoord.xy); }
`;

function videoIndexToTitlePhase(videoIdx: number, portalsVisible: boolean): number {
  if (portalsVisible) return 4;
  if (videoIdx === 0) return 1;
  if (videoIdx === 1) return 2;
  if (videoIdx >= 2)  return 3;
  return 0;
}

export default function CinematicStage({ skipToPortals = false }: { skipToPortals?: boolean }) {
  const parallax = useMouseParallax();

  const [videoPhase,     setVideoPhase]     = useState(skipToPortals ? 4 : 0);
  const [storyVisible,   setStoryVisible]   = useState(false);
  const [portalsVisible, setPortalsVisible] = useState(skipToPortals);
  const [lensHover,      setLensHover]      = useState<"referee" | "fan" | "supporter" | null>(null);

  const handlePhaseChange = useCallback((idx: number) => {
    setVideoPhase(idx);
  }, []);

  const handleComplete = useCallback(() => {
    // v4 has started — story section emerges after a brief breath
    setTimeout(() => setStoryVisible(true), 900);
  }, []);

  const handleStoryComplete = useCallback(() => {
    // Story done — hide story, reveal portals simultaneously
    setStoryVisible(false);
    setTimeout(() => setPortalsVisible(true), 400);
  }, []);

  const titlePhase = storyVisible ? 0 : videoIndexToTitlePhase(videoPhase, portalsVisible);

  // Derive current stage for phase-specific effects (0–4)
  const effectPhase = portalsVisible ? 4 : videoPhase;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">

      {/* Custom cinematic cursor */}
      <CinematicCursor />

      {/* ── Skip button — visible during video, hidden once portals show ── */}
      {!portalsVisible && (
        <button
          onClick={() => { setStoryVisible(false); setPortalsVisible(true); setVideoPhase(4); }}
          style={{
            position: "fixed", top: 22, right: 28, zIndex: 9000,
            background: "rgba(10,12,20,0.70)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.16)", borderRadius: 4,
            color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "0.52rem", letterSpacing: "0.22em", fontWeight: 600,
            padding: "7px 16px", cursor: "pointer",
            transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.88)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.38)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; }}
        >
          SKIP →
        </button>
      )}

      {/* ── Layer 0: Deep WebGL atmosphere — visible in pre-roll & portals ── */}
      <motion.div
        animate={{ opacity: effectPhase === 0 ? 0.55 : effectPhase >= 4 ? 0.18 : 0.06 }}
        transition={{ duration: 2.4, ease: "easeInOut" }}
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      >
        <ShaderCanvas fragSource={FIREFLIES_SHADER} pixelRatio={1} />
      </motion.div>

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

      {/* ── Layer 6: Story interlude — ONE MOMENT. MANY REALITIES. ── */}
      <StorySection
        visible   = {storyVisible}
        onComplete= {handleStoryComplete}
      />

      {/* ── Layer 7: Three Realities — atmospheric spatial zones ── */}
      <LensPortals
        visible      = {portalsVisible}
        onHoverChange= {setLensHover}
      />

      {/* ── Layer 8: 1px cinematic progress bar ── */}
      <ProgressBar phase={effectPhase} />

    </div>
  );
}
