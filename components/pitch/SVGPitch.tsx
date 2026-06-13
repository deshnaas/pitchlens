"use client";

import React from "react";

/**
 * SVGPitch — Responsive SVG football pitch.
 *
 * viewBox uses real football metres: 0 0 105 68.
 * Extended to "-5 -4 115 76" to include goals outside pitch boundary.
 * All markings are crisp at every display size.
 * Children (players, overlays) receive the same coordinate space.
 */

// Real FIFA/IFAB pitch measurements (metres)
export const PITCH = {
  w : 105,
  h : 68,

  centreX : 52.5,
  centreY : 34,
  centreR : 9.15,

  penDepth : 16.5,          // penalty area depth from goal line
  penWidth : 40.32,         // penalty area width
  goaDepth : 5.5,           // goal area depth from goal line
  goaWidth : 18.32,         // goal area width
  goalW    : 7.32,          // goal width (between posts)
  goalD    : 2.44,          // goal depth (behind line)
  penSpotD : 11,            // penalty spot distance from goal line
  cornerR  : 1,             // corner arc radius
} as const;

// Derived Y-axis values (centred on pitch)
const paY  = (PITCH.h - PITCH.penWidth) / 2;   // 13.84
const gaY  = (PITCH.h - PITCH.goaWidth) / 2;   // 24.84
const goalY = (PITCH.h - PITCH.goalW) / 2;     // 30.34

// Penalty arc intersection with penalty-area edge (right side)
const paEdgeR   = PITCH.w - PITCH.penDepth;     // 88.5
const psRightX  = PITCH.w - PITCH.penSpotD;     // 94
const penArcDy  = Math.sqrt(PITCH.centreR ** 2 - (paEdgeR - psRightX) ** 2); // ≈ 7.31

const LINE_COLOR = "rgba(255,255,255,0.58)";
const LINE_W     = 0.3;

interface SVGPitchProps {
  children? : React.ReactNode;
  className?: string;
  style?    : React.CSSProperties;
}

export function SVGPitch({ children, className, style }: SVGPitchProps) {
  return (
    <svg
      viewBox="-5 -4 115 76"
      className={className}
      style={{ width: "100%", height: "100%", display: "block", ...style }}
      overflow="visible"
    >
      <defs>
        {/* Clip to pitch surface for fills */}
        <clipPath id="pitchClip">
          <rect x={0} y={0} width={PITCH.w} height={PITCH.h} />
        </clipPath>

        {/* Floodlight radial glow */}
        <radialGradient id="floodlight" cx="50%" cy="-5%" r="85%">
          <stop offset="0%"   stopColor="rgba(255,255,240,0.09)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        {/* Right penalty area accent glow */}
        <radialGradient id="paGlow" cx="85%" cy="50%" r="35%">
          <stop offset="0%"   stopColor="rgba(168,196,224,0.045)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* ── Background ── */}
      <rect x={-5} y={-4} width={115} height={76} fill="#050d18" />

      {/* ── Pitch surface ── */}
      <rect x={0} y={0} width={PITCH.w} height={PITCH.h} fill="#0b1a0c" />

      {/* ── Grass alternating stripes ── */}
      {Array.from({ length: 14 }).map((_, i) =>
        i % 2 === 0 ? (
          <rect
            key={i}
            x={i * (PITCH.w / 14)}
            y={0}
            width={PITCH.w / 14}
            height={PITCH.h}
            fill="rgba(255,255,255,0.013)"
            clipPath="url(#pitchClip)"
          />
        ) : null,
      )}

      {/* ── Lighting ── */}
      <rect x={0} y={0} width={PITCH.w} height={PITCH.h} fill="url(#floodlight)" clipPath="url(#pitchClip)" />
      <rect x={0} y={0} width={PITCH.w} height={PITCH.h} fill="url(#paGlow)"     clipPath="url(#pitchClip)" />

      {/* ══ Pitch markings ══════════════════════════════════════════════════ */}
      <g stroke={LINE_COLOR} strokeWidth={LINE_W} fill="none">

        {/* Outer boundary */}
        <rect x={0} y={0} width={PITCH.w} height={PITCH.h} />

        {/* Halfway line */}
        <line x1={PITCH.centreX} y1={0} x2={PITCH.centreX} y2={PITCH.h} />

        {/* Centre circle */}
        <circle cx={PITCH.centreX} cy={PITCH.centreY} r={PITCH.centreR} />

        {/* Right penalty area */}
        <rect x={PITCH.w - PITCH.penDepth} y={paY} width={PITCH.penDepth} height={PITCH.penWidth} />

        {/* Right goal area */}
        <rect x={PITCH.w - PITCH.goaDepth} y={gaY} width={PITCH.goaDepth} height={PITCH.goaWidth} />

        {/* Left penalty area */}
        <rect x={0} y={paY} width={PITCH.penDepth} height={PITCH.penWidth} />

        {/* Left goal area */}
        <rect x={0} y={gaY} width={PITCH.goaDepth} height={PITCH.goaWidth} />

        {/* Right goal (extends past pitch) */}
        <rect x={PITCH.w} y={goalY} width={PITCH.goalD} height={PITCH.goalW} />

        {/* Left goal (extends past pitch) */}
        <rect x={-PITCH.goalD} y={goalY} width={PITCH.goalD} height={PITCH.goalW} />

        {/* Right penalty arc (portion outside penalty area) */}
        <path
          d={`M ${paEdgeR} ${PITCH.centreY - penArcDy} A ${PITCH.centreR} ${PITCH.centreR} 0 0 0 ${paEdgeR} ${PITCH.centreY + penArcDy}`}
        />

        {/* Left penalty arc */}
        <path
          d={`M ${PITCH.penDepth} ${PITCH.centreY + penArcDy} A ${PITCH.centreR} ${PITCH.centreR} 0 0 0 ${PITCH.penDepth} ${PITCH.centreY - penArcDy}`}
        />

        {/* Corner arcs */}
        <path d={`M 0 ${PITCH.cornerR} A ${PITCH.cornerR} ${PITCH.cornerR} 0 0 1 ${PITCH.cornerR} 0`} />
        <path d={`M ${PITCH.w - PITCH.cornerR} 0 A ${PITCH.cornerR} ${PITCH.cornerR} 0 0 1 ${PITCH.w} ${PITCH.cornerR}`} />
        <path d={`M ${PITCH.w} ${PITCH.h - PITCH.cornerR} A ${PITCH.cornerR} ${PITCH.cornerR} 0 0 1 ${PITCH.w - PITCH.cornerR} ${PITCH.h}`} />
        <path d={`M ${PITCH.cornerR} ${PITCH.h} A ${PITCH.cornerR} ${PITCH.cornerR} 0 0 1 0 ${PITCH.h - PITCH.cornerR}`} />

      </g>

      {/* ── Spots (filled) ── */}
      <circle cx={PITCH.centreX}                  cy={PITCH.centreY} r={0.4} fill={LINE_COLOR} />
      <circle cx={PITCH.w - PITCH.penSpotD}        cy={PITCH.centreY} r={0.4} fill={LINE_COLOR} />
      <circle cx={PITCH.penSpotD}                  cy={PITCH.centreY} r={0.4} fill={LINE_COLOR} />

      {/* ── Overlay children (players, analysis lines, etc.) ── */}
      {children}
    </svg>
  );
}
