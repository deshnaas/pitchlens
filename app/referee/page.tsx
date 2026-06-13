"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

/**
 * Referee VAR Investigation — PitchLens
 *
 * The football pitch IS the primary storytelling surface.
 * The user investigates a decision — they don't read a summary.
 * Text supports the pitch. Not the other way around.
 *
 * Incident: Brazil-Germany 72' — Handball in penalty area → penalty awarded.
 * Investigation steps: Incident → Evidence → Law Applied → Analysis → Verdict
 */

// ── Virtual pitch space (1050×680 = 105m × 68m at 10 units/m) ───────────────

const VW = 1050;  // virtual pitch width
const VH = 680;   // virtual pitch height

// All incident positions in virtual coords — Germany attacks RIGHT (→ Brazil goal)
const P = {
  // Players
  havertz  : { x: 810, y: 355 },   // German attacker (crossed the ball)
  defender : { x: 895, y: 318 },   // Brazilian defender — commits handball
  shoulder : { x: 896, y: 305 },   // defender's left shoulder joint
  armActual: { x: 916, y: 271 },   // actual arm tip (unnatural — raised)
  armNatural:{ x: 904, y: 310 },   // natural arm tip (shoulder-width level)
  contact  : { x: 913, y: 278 },   // ball contact point on arm
  ballStart: { x: 822, y: 358 },   // ball position when crossed
  gk       : { x: 1038, y: 340 },  // goalkeeper
  def2     : { x: 866, y: 392 },
  def3     : { x: 946, y: 282 },
  att2     : { x: 858, y: 302 },
  penSpot  : { x: 940, y: 340 },   // penalty spot
};

// Pitch geometry helpers
interface Geom {
  px: number; py: number;   // top-left of pitch rect in screen px
  pw: number; ph: number;   // pitch width/height in screen px
  sx: number; sy: number;   // scale virtual→screen
}

function getGeom(cw: number, ch: number): Geom {
  const PAD = 32;
  const aspect = VW / VH;
  let pw = cw - PAD * 2;
  let ph = pw / aspect;
  if (ph > ch - PAD * 2) { ph = ch - PAD * 2; pw = ph * aspect; }
  const px = (cw - pw) / 2;
  const py = (ch - ph) / 2;
  return { px, py, pw, ph, sx: pw / VW, sy: ph / VH };
}

// Virtual → screen
function vs(g: Geom, vx: number, vy: number) {
  return { x: g.px + vx * g.sx, y: g.py + vy * g.sy };
}
// Scale a virtual radius
function vr(g: Geom, r: number) { return r * g.sx; }

// ── Pitch markings ────────────────────────────────────────────────────────────

function drawPitch(ctx: CanvasRenderingContext2D, g: Geom) {
  const { px, py, pw, ph } = g;

  // Pitch surface
  ctx.fillStyle = "#0b1a0c";
  ctx.fillRect(px, py, pw, ph);

  // Alternating grass stripes (vertical)
  for (let i = 0; i < 14; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.013)";
      ctx.fillRect(px + i * (pw / 14), py, pw / 14, ph);
    }
  }

  // Floodlight radial wash from above-centre
  const fl = ctx.createRadialGradient(px + pw / 2, py - ph * 0.1, 0, px + pw / 2, py + ph / 2, ph * 0.85);
  fl.addColorStop(0, "rgba(255,255,240,0.07)");
  fl.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fl;
  ctx.fillRect(px, py, pw, ph);

  // Right-end focused accent glow (penalty area)
  const pg = ctx.createRadialGradient(
    g.px + g.pw * 0.88, g.py + g.ph / 2, 0,
    g.px + g.pw * 0.88, g.py + g.ph / 2, g.pw * 0.28,
  );
  pg.addColorStop(0, "rgba(168,196,224,0.04)");
  pg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = pg;
  ctx.fillRect(px, py, pw, ph);

  // ── Lines ──
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.58)";
  ctx.lineWidth   = 1;

  // Outer boundary
  ctx.strokeRect(px, py, pw, ph);

  // Halfway line
  const hw = vs(g, VW / 2, 0);
  ctx.beginPath(); ctx.moveTo(hw.x, py); ctx.lineTo(hw.x, py + ph); ctx.stroke();

  // Centre circle
  const cc = vs(g, VW / 2, VH / 2);
  ctx.beginPath(); ctx.arc(cc.x, cc.y, vr(g, 91.5), 0, Math.PI * 2); ctx.stroke();

  // Centre spot
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.beginPath(); ctx.arc(cc.x, cc.y, 3, 0, Math.PI * 2); ctx.fill();

  // Helper: draw a virtual rect
  function vrect(vx: number, vy: number, vw: number, vh: number) {
    const tl = vs(g, vx, vy);
    ctx.strokeRect(tl.x, tl.y, vw * g.sx, vh * g.sy);
  }

  // Right penalty area (16.5m × 40.32m = 165 × 403)
  vrect(VW - 165, (VH - 403) / 2, 165, 403);
  // Right goal area (5.5m × 18.32m = 55 × 183)
  vrect(VW - 55, (VH - 183) / 2, 55, 183);
  // Left penalty area
  vrect(0, (VH - 403) / 2, 165, 403);
  // Left goal area
  vrect(0, (VH - 183) / 2, 55, 183);

  // Goals (slight 3D depth extending past pitch boundary)
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  const GOAL_DEPTH = 10;
  // Right goal
  const rg1 = vs(g, VW, VH / 2 - 36.6);
  const rg2 = vs(g, VW, VH / 2 + 36.6);
  ctx.beginPath();
  ctx.moveTo(rg1.x, rg1.y); ctx.lineTo(rg1.x + GOAL_DEPTH, rg1.y);
  ctx.lineTo(rg1.x + GOAL_DEPTH, rg2.y); ctx.lineTo(rg2.x, rg2.y);
  ctx.stroke();
  // Left goal
  const lg1 = vs(g, 0, VH / 2 - 36.6);
  const lg2 = vs(g, 0, VH / 2 + 36.6);
  ctx.beginPath();
  ctx.moveTo(lg1.x, lg1.y); ctx.lineTo(lg1.x - GOAL_DEPTH, lg1.y);
  ctx.lineTo(lg1.x - GOAL_DEPTH, lg2.y); ctx.lineTo(lg2.x, lg2.y);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.58)";
  // Penalty spots
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  const rps = vs(g, VW - 110, VH / 2);
  ctx.beginPath(); ctx.arc(rps.x, rps.y, 2.5, 0, Math.PI * 2); ctx.fill();
  const lps = vs(g, 110, VH / 2);
  ctx.beginPath(); ctx.arc(lps.x, lps.y, 2.5, 0, Math.PI * 2); ctx.fill();

  // Right penalty arc (arc outside penalty area, radius 91.5 from penalty spot)
  // Arc exits PA at angles ~127° and ~233° (measured from centre)
  const rpss = vs(g, VW - 110, VH / 2);
  ctx.beginPath();
  ctx.arc(rpss.x, rpss.y, vr(g, 91.5), 2.21, 4.07, false);
  ctx.stroke();

  // Corner arcs (r=10)
  const corners = [
    { vx: 0,   vy: 0,   a0: 0,              a1: Math.PI / 2 },
    { vx: VW,  vy: 0,   a0: Math.PI / 2,    a1: Math.PI },
    { vx: VW,  vy: VH,  a0: Math.PI,        a1: 3 * Math.PI / 2 },
    { vx: 0,   vy: VH,  a0: 3 * Math.PI / 2, a1: 2 * Math.PI },
  ];
  corners.forEach(({ vx, vy, a0, a1 }) => {
    const sc = vs(g, vx, vy);
    ctx.beginPath(); ctx.arc(sc.x, sc.y, vr(g, 10), a0, a1); ctx.stroke();
  });

  ctx.restore();
}

// ── Player dot helper ─────────────────────────────────────────────────────────

function drawPlayer(
  ctx  : CanvasRenderingContext2D,
  g    : Geom,
  vx   : number,
  vy   : number,
  opts : {
    color?    : string;
    radius?   : number;
    label?    : string;
    glow?     : boolean;
    glowColor?: string;
    alpha?    : number;
  } = {},
) {
  const { x, y } = vs(g, vx, vy);
  const r     = vr(g, opts.radius ?? 8);
  const alpha = opts.alpha ?? 1;
  const color = opts.color ?? "rgba(255,255,255,0.9)";

  if (opts.glow) {
    const gc = opts.glowColor ?? color;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
    grad.addColorStop(0, gc.replace(")", `, ${0.35 * alpha})`).replace("rgba(", "rgba(").replace("rgb(", "rgba("));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, r * 3.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = color.includes("rgba") ? color : `rgba(${color},${alpha})`;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

  if (opts.label) {
    ctx.fillStyle = `rgba(255,255,255,${0.65 * alpha})`;
    ctx.font      = `${vr(g, 9)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(opts.label, x, y - r - 4);
  }
}

// ── Canvas label helper ───────────────────────────────────────────────────────

function pitchLabel(
  ctx  : CanvasRenderingContext2D,
  g    : Geom,
  vx   : number,
  vy   : number,
  text : string,
  opts : { color?: string; size?: number; align?: CanvasTextAlign; alpha?: number } = {},
) {
  const { x, y } = vs(g, vx, vy);
  ctx.font      = `300 ${vr(g, opts.size ?? 9)}px Inter, sans-serif`;
  ctx.fillStyle = opts.color ?? `rgba(168,196,224,${opts.alpha ?? 0.8})`;
  ctx.textAlign = opts.align ?? "center";
  ctx.fillText(text, x, y);
}

// Easing
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// ── Per-step overlay draw functions ──────────────────────────────────────────

function drawStep0(ctx: CanvasRenderingContext2D, g: Geom, te: number) {
  // INCIDENT — show the scene. Ball trajectory animates in.
  const p = easeOut(Math.min(1, te / 1600));

  // Soft spotlight on right penalty area
  const paX = g.px + (VW - 165) * g.sx;
  const paY = g.py + (VH - 403) / 2 * g.sy;
  const paW = 165 * g.sx;
  const paH = 403 * g.sy;
  ctx.fillStyle = "rgba(168,196,224,0.05)";
  ctx.fillRect(paX, paY, paW, paH);

  // All players — fade in
  const fade = Math.min(1, te / 800);
  drawPlayer(ctx, g, P.havertz.x,   P.havertz.y,   { color: "rgba(255,255,255,0.85)", label: "Havertz", alpha: fade });
  drawPlayer(ctx, g, P.defender.x,  P.defender.y,  { color: "rgba(255,215,50,0.85)",  label: "Silva",   alpha: fade });
  drawPlayer(ctx, g, P.gk.x,        P.gk.y,        { color: "rgba(255,215,50,0.75)",  label: "Alisson", alpha: fade });
  drawPlayer(ctx, g, P.def2.x,      P.def2.y,      { color: "rgba(255,215,50,0.55)",  alpha: fade });
  drawPlayer(ctx, g, P.def3.x,      P.def3.y,      { color: "rgba(255,215,50,0.55)",  alpha: fade });
  drawPlayer(ctx, g, P.att2.x,      P.att2.y,      { color: "rgba(255,255,255,0.55)", alpha: fade });

  // Ball trajectory: ballStart → contact (line grows with p)
  const bStart = vs(g, P.ballStart.x, P.ballStart.y);
  const bEnd   = vs(g, P.contact.x,   P.contact.y);
  const bCurX  = bStart.x + (bEnd.x - bStart.x) * p;
  const bCurY  = bStart.y + (bEnd.y - bStart.y) * p;

  ctx.strokeStyle = `rgba(255,255,255,${0.55 * fade})`;
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(bStart.x, bStart.y); ctx.lineTo(bCurX, bCurY); ctx.stroke();
  ctx.setLineDash([]);

  // Ball
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.arc(bCurX, bCurY, vr(g, 6), 0, Math.PI * 2); ctx.fill();

  // Label
  if (fade > 0.7) {
    pitchLabel(ctx, g, VW * 0.5, 620, "72' — MATCH EVENT", { size: 8, alpha: (fade - 0.7) / 0.3 * 0.6 });
  }
}

function drawStep1(ctx: CanvasRenderingContext2D, g: Geom, te: number) {
  // EVIDENCE — highlight contact, draw arm, mark position
  const p     = easeOut(Math.min(1, te / 2000));
  const pulse = 0.65 + 0.35 * Math.sin(te * 0.004);

  // Dim other players
  drawPlayer(ctx, g, P.havertz.x, P.havertz.y, { color: "rgba(255,255,255,0.35)", radius: 7 });
  drawPlayer(ctx, g, P.gk.x, P.gk.y,           { color: "rgba(255,215,50,0.35)",  radius: 7 });
  drawPlayer(ctx, g, P.def2.x, P.def2.y,        { color: "rgba(255,215,50,0.25)",  radius: 6 });
  drawPlayer(ctx, g, P.def3.x, P.def3.y,        { color: "rgba(255,215,50,0.25)",  radius: 6 });
  drawPlayer(ctx, g, P.att2.x, P.att2.y,        { color: "rgba(255,255,255,0.25)", radius: 6 });

  // Highlighted defender
  drawPlayer(ctx, g, P.defender.x, P.defender.y, {
    color    : "rgba(220,80,80,0.9)",
    label    : "Silva",
    glow     : true,
    glowColor: "rgba(220,80,80,1)",
    radius   : 9,
  });

  // Arm line: shoulder → actual arm tip (grows with p)
  const sh  = vs(g, P.shoulder.x,   P.shoulder.y);
  const tip = vs(g, P.armActual.x,  P.armActual.y);
  const curArmX = sh.x + (tip.x - sh.x) * p;
  const curArmY = sh.y + (tip.y - sh.y) * p;

  ctx.strokeStyle = `rgba(220,80,80,${0.85 * p})`;
  ctx.lineWidth   = vr(g, 3);
  ctx.lineCap     = "round";
  ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(curArmX, curArmY); ctx.stroke();
  ctx.lineCap = "butt";

  // Contact point ring + pulse
  if (p > 0.5) {
    const cp    = vs(g, P.contact.x, P.contact.y);
    const pp    = (p - 0.5) / 0.5;
    ctx.strokeStyle = `rgba(220,80,80,${0.9 * pp * pulse})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, vr(g, 12) * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(220,80,80,${0.5 * pp})`;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, vr(g, 20), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle   = `rgba(220,80,80,${0.95 * pp})`;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, vr(g, 5), 0, Math.PI * 2); ctx.fill();

    if (pp > 0.6) {
      pitchLabel(ctx, g, P.contact.x + 22, P.contact.y - 18, "CONTACT", {
        size: 8, color: `rgba(220,80,80,${(pp - 0.6) / 0.4 * 0.9})`, align: "left",
      });
    }
  }

  // Ball path (static now)
  const bStart = vs(g, P.ballStart.x, P.ballStart.y);
  const bEnd   = vs(g, P.contact.x,   P.contact.y);
  ctx.strokeStyle = `rgba(255,255,255,${0.3 * p})`;
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(bStart.x, bStart.y); ctx.lineTo(bEnd.x, bEnd.y); ctx.stroke();
  ctx.setLineDash([]);
}

function drawStep2(ctx: CanvasRenderingContext2D, g: Geom, te: number) {
  // LAW APPLIED — natural vs actual arm, silhouette zone
  const p = easeInOut(Math.min(1, te / 2200));

  // Defender body (dimmed)
  drawPlayer(ctx, g, P.defender.x, P.defender.y, { color: "rgba(255,215,50,0.5)", radius: 8 });

  // Natural silhouette zone (blue zone showing legal arm area)
  if (p > 0.1) {
    const pp = (p - 0.1) / 0.9;
    const sh = vs(g, P.shoulder.x, P.shoulder.y);
    const an = vs(g, P.armNatural.x, P.armNatural.y);
    // Draw natural arm in blue
    ctx.strokeStyle = `rgba(168,196,224,${0.7 * pp})`;
    ctx.lineWidth   = vr(g, 3);
    ctx.lineCap     = "round";
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(an.x, an.y); ctx.stroke();
    ctx.fillStyle   = `rgba(168,196,224,${0.7 * pp})`;
    ctx.beginPath(); ctx.arc(an.x, an.y, vr(g, 5), 0, Math.PI * 2); ctx.fill();

    if (pp > 0.5) pitchLabel(ctx, g, P.armNatural.x - 28, P.armNatural.y + 4, "NATURAL", {
      size: 7.5, color: `rgba(168,196,224,${(pp - 0.5) / 0.5 * 0.7})`, align: "right",
    });
  }

  // Actual arm in red
  if (p > 0.4) {
    const pp = (p - 0.4) / 0.6;
    const sh  = vs(g, P.shoulder.x,  P.shoulder.y);
    const tip = vs(g, P.armActual.x, P.armActual.y);
    ctx.strokeStyle = `rgba(220,80,80,${0.85 * pp})`;
    ctx.lineWidth   = vr(g, 3);
    ctx.lineCap     = "round";
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.fillStyle   = `rgba(220,80,80,${0.9 * pp})`;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, vr(g, 5), 0, Math.PI * 2); ctx.fill();

    if (pp > 0.5) pitchLabel(ctx, g, P.armActual.x + 20, P.armActual.y - 6, "UNNATURAL", {
      size: 7.5, color: `rgba(220,80,80,${(pp - 0.5) / 0.5 * 0.9})`, align: "left",
    });
  }

  // Angle arc between natural and actual
  if (p > 0.65) {
    const pp = (p - 0.65) / 0.35;
    const sh  = vs(g, P.shoulder.x, P.shoulder.y);
    // Angle from shoulder to natural arm ≈ straight down-left
    // Angle from shoulder to actual arm ≈ up-right
    ctx.strokeStyle = `rgba(255,200,80,${0.7 * pp})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, vr(g, 22), -1.2, -0.2, false);
    ctx.stroke();
    if (pp > 0.6) pitchLabel(ctx, g, P.shoulder.x + 30, P.shoulder.y - 15, "42°", {
      size: 8, color: `rgba(255,200,80,${(pp - 0.6) / 0.4 * 0.85})`, align: "left",
    });
  }
  ctx.lineCap = "butt";
}

function drawStep3(ctx: CanvasRenderingContext2D, g: Geom, te: number) {
  // ANALYSIS — all lines, freeze frame, measurements
  const p     = easeOut(Math.min(1, te / 2500));
  const pulse = 0.7 + 0.3 * Math.sin(te * 0.003);

  // All players dimmed
  drawPlayer(ctx, g, P.havertz.x,  P.havertz.y,  { color: "rgba(255,255,255,0.3)", radius: 7 });
  drawPlayer(ctx, g, P.gk.x,       P.gk.y,       { color: "rgba(255,215,50,0.3)",  radius: 7 });
  drawPlayer(ctx, g, P.def2.x,     P.def2.y,     { color: "rgba(255,215,50,0.2)",  radius: 6 });
  drawPlayer(ctx, g, P.def3.x,     P.def3.y,     { color: "rgba(255,215,50,0.2)",  radius: 6 });
  drawPlayer(ctx, g, P.att2.x,     P.att2.y,     { color: "rgba(255,255,255,0.2)", radius: 6 });

  // Focus: defender
  drawPlayer(ctx, g, P.defender.x, P.defender.y, {
    color: "rgba(220,80,80,0.8)", radius: 9,
    glow: true, glowColor: "rgba(220,80,80,1)",
  });

  // Ball velocity vector (arrow from attacker toward contact)
  if (p > 0) {
    const bS  = vs(g, P.ballStart.x, P.ballStart.y);
    const bE  = vs(g, P.contact.x,   P.contact.y);
    const dx  = bE.x - bS.x;
    const dy  = bE.y - bS.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const curX = bS.x + dx * p;
    const curY = bS.y + dy * p;

    ctx.strokeStyle = `rgba(255,255,255,${0.5 * p})`;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(bS.x, bS.y); ctx.lineTo(curX, curY); ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    if (p > 0.8) {
      const ap = (p - 0.8) / 0.2;
      const angle = Math.atan2(dy, dx);
      const aSize = vr(g, 8);
      ctx.fillStyle = `rgba(255,255,255,${0.6 * ap})`;
      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX - aSize * Math.cos(angle - 0.4), curY - aSize * Math.sin(angle - 0.4));
      ctx.lineTo(curX - aSize * Math.cos(angle + 0.4), curY - aSize * Math.sin(angle + 0.4));
      ctx.closePath(); ctx.fill();
    }

    // "28 KM/H" label
    if (p > 0.5) pitchLabel(ctx, g, (bS.x + bE.x) / (2 * g.sx) * g.sx / g.sx,
      0, "", { size: 8 }); // placeholder, use screen coords below
    if (p > 0.5) {
      const midX = (bS.x + bE.x) / 2;
      const midY = (bS.y + bE.y) / 2;
      ctx.fillStyle = `rgba(255,255,255,${(p - 0.5) / 0.5 * 0.55})`;
      ctx.font      = `300 ${vr(g, 8)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("28 KM/H", midX, midY - 8);
    }

    void len;
  }

  // Natural arm (blue, reference)
  if (p > 0.3) {
    const pp = (p - 0.3) / 0.7;
    const sh = vs(g, P.shoulder.x,   P.shoulder.y);
    const an = vs(g, P.armNatural.x, P.armNatural.y);
    ctx.strokeStyle = `rgba(168,196,224,${0.5 * pp})`;
    ctx.lineWidth   = vr(g, 2.5); ctx.lineCap = "round";
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(an.x, an.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Actual arm (red, violation)
  if (p > 0.5) {
    const pp = (p - 0.5) / 0.5;
    const sh  = vs(g, P.shoulder.x,  P.shoulder.y);
    const tip = vs(g, P.armActual.x, P.armActual.y);
    ctx.strokeStyle = `rgba(220,80,80,${0.9 * pp})`;
    ctx.lineWidth   = vr(g, 3.5); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.lineCap = "butt";
  }

  // Contact pulsing
  if (p > 0.6) {
    const pp = (p - 0.6) / 0.4;
    const cp = vs(g, P.contact.x, P.contact.y);
    ctx.strokeStyle = `rgba(220,80,80,${0.85 * pp * pulse})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, vr(g, 10) * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle   = `rgba(220,80,80,${0.9 * pp})`;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, vr(g, 4), 0, Math.PI * 2); ctx.fill();
  }

  // Measurement line: vertical extent of arm elevation
  if (p > 0.75) {
    const pp  = (p - 0.75) / 0.25;
    const nat = vs(g, P.armNatural.x + 10, P.armNatural.y);
    const act = vs(g, P.armNatural.x + 10, P.armActual.y);
    ctx.strokeStyle = `rgba(255,200,80,${0.7 * pp})`;
    ctx.lineWidth   = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(nat.x, nat.y); ctx.lineTo(act.x, act.y); ctx.stroke();
    ctx.setLineDash([]);
    // End caps
    ctx.beginPath(); ctx.moveTo(nat.x - 4, nat.y); ctx.lineTo(nat.x + 4, nat.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(act.x - 4, act.y); ctx.lineTo(act.x + 4, act.y); ctx.stroke();
    if (pp > 0.5) {
      ctx.fillStyle = `rgba(255,200,80,${(pp - 0.5) / 0.5 * 0.85})`;
      ctx.font      = `300 ${vr(g, 8)}px Inter, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("+42cm", nat.x + 8, (nat.y + act.y) / 2 + 3);
    }
  }
}

function drawStep4(ctx: CanvasRenderingContext2D, g: Geom, te: number) {
  // VERDICT — penalty spot glows, confirmation
  const p     = easeOut(Math.min(1, te / 1800));
  const pulse = 0.75 + 0.25 * Math.sin(te * 0.0035);

  // Green confirmation wash on penalty area
  if (p > 0.2) {
    const pp  = (p - 0.2) / 0.8;
    const paX = g.px + (VW - 165) * g.sx;
    const paY = g.py + (VH - 403) / 2 * g.sy;
    const paW = 165 * g.sx;
    const paH = 403 * g.sy;
    ctx.fillStyle = `rgba(80,200,120,${0.06 * pp})`;
    ctx.fillRect(paX, paY, paW, paH);
  }

  // All players faded
  drawPlayer(ctx, g, P.havertz.x,  P.havertz.y,  { color: "rgba(255,255,255,0.35)", radius: 7 });
  drawPlayer(ctx, g, P.defender.x, P.defender.y,  { color: "rgba(220,80,80,0.4)",  radius: 8 });
  drawPlayer(ctx, g, P.gk.x,       P.gk.y,       { color: "rgba(255,215,50,0.35)", radius: 7 });

  // Penalty spot — large pulsing gold
  const ps = vs(g, P.penSpot.x, P.penSpot.y);
  const aura = ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, vr(g, 40) * pulse);
  aura.addColorStop(0, `rgba(255,200,80,${0.35 * p})`);
  aura.addColorStop(0.5, `rgba(255,200,80,${0.12 * p})`);
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(ps.x, ps.y, vr(g, 40) * pulse, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = `rgba(255,200,80,${0.9 * p * pulse})`;
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.arc(ps.x, ps.y, vr(g, 14) * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle   = `rgba(255,200,80,${p})`;
  ctx.beginPath(); ctx.arc(ps.x, ps.y, vr(g, 6), 0, Math.PI * 2); ctx.fill();

  // Confirmation ring expanding outward
  if (p > 0.4) {
    const pp = (p - 0.4) / 0.6;
    const ringR = vr(g, 14 + 60 * pp);
    ctx.strokeStyle = `rgba(80,200,120,${0.5 * (1 - pp) * pp * 4})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, ringR, 0, Math.PI * 2); ctx.stroke();
  }

  // "PENALTY" text on pitch
  if (p > 0.6) {
    const pp = (p - 0.6) / 0.4;
    ctx.fillStyle = `rgba(80,200,120,${0.6 * pp})`;
    ctx.font      = `200 ${vr(g, 16)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.letterSpacing = `${vr(g, 8)}px`;
    ctx.fillText("PENALTY", ps.x, ps.y + vr(g, 50));
    ctx.letterSpacing = "0px";
  }
}

// ── Step content ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    number  : "01",
    label   : "Incident",
    title   : "72’ — Handball in the Penalty Area",
    law     : null as string | null,
    body    : "A cross from the left flank strikes the arm of a Brazilian defender inside the penalty area. The referee immediately signals for VAR to begin review.",
    evidence: null as string | null,
    verdict : null as string | null,
  },
  {
    number  : "02",
    label   : "Evidence",
    title   : "Contact Point Identified",
    law     : null,
    body    : "Frame-by-frame analysis confirms ball contact with the defender’s left arm. The contact occurs above and beyond the natural body silhouette. Ball velocity at impact was approximately 28 km/h.",
    evidence: "Defender: Thiago Silva\nContact: Left forearm, elevated\nBall velocity: ~28 km/h\nFrame: 72’ 14\"",
    verdict : null,
  },
  {
    number  : "03",
    label   : "Law Applied",
    title   : "Law 12 — Handling the Ball",
    law     : "It is an offence if a player touches the ball with their hand/arm in an unnatural position — making the body unnaturally larger. The arm above shoulder height is always considered unnatural.",
    body    : "The defender’s arm is raised 42° above the natural body line. Under Law 12, this constitutes an unnatural arm position regardless of intent.",
    evidence: "IFAB Laws of the Game 2023/24\nLaw 12 — Fouls and Misconduct\nSection: Handling the Ball",
    verdict : null,
  },
  {
    number  : "04",
    label   : "Analysis",
    title   : "VAR Frame-by-Frame Review",
    law     : null,
    body    : "The precise moment of contact is isolated. The arm is elevated 42° above the natural position, extending 31cm beyond the legal body silhouette. Ball trajectory was direct and unavoidable.",
    evidence: "Arm elevation: 42° above natural\nSilhouette exceeded: 31cm\nVAR review duration: 1m 43s\nAngle checked: 4 camera feeds",
    verdict : null,
  },
  {
    number  : "05",
    label   : "Verdict",
    title   : "Decision — Penalty Awarded",
    law     : null,
    body    : "The original decision is confirmed by VAR. Penalty kick awarded to Germany. The handball was unnatural under Law 12. Deliberate intent is not required for a handball offence to be given.",
    evidence: null,
    verdict : "PENALTY AWARDED",
  },
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function RefereeVAR() {
  const router   = useRouter();
  const [step, setStep] = useState(0);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rafRef       = useRef<number>(0);
  const stepRef      = useRef<number>(0);
  const stepStartRef = useRef<number>(0);

  useEffect(() => { stepRef.current = step; stepStartRef.current = performance.now(); }, [step]);

  // ── Canvas RAF loop ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = devicePixelRatio;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (now: number) => {
      const dpr    = devicePixelRatio;
      const sw     = canvas.offsetWidth;
      const sh     = canvas.offsetHeight;
      const te     = now - stepStartRef.current;
      const s      = stepRef.current;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, sw, sh);

      const g = getGeom(sw, sh);
      drawPitch(ctx, g);

      if (s === 0) drawStep0(ctx, g, te);
      if (s === 1) drawStep1(ctx, g, te);
      if (s === 2) drawStep2(ctx, g, te);
      if (s === 3) drawStep3(ctx, g, te);
      if (s === 4) drawStep4(ctx, g, te);

      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, []);

  const goNext = useCallback(() => { if (step < STEPS.length - 1) setStep(s => s + 1); }, [step]);
  const goPrev = useCallback(() => { if (step > 0) setStep(s => s - 1); }, [step]);

  const sd = STEPS[step];

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ background: "#050d18", fontFamily: "var(--font-inter), sans-serif", cursor: "none" }}
    >

      {/* ══════════════════════════════════════════════════════════
          LEFT PANEL — Investigation timeline
      ══════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col"
        style={{
          width     : "220px",
          flexShrink: 0,
          background: "rgba(0,6,18,0.92)",
          borderRight: "1px solid rgba(168,196,224,0.08)",
          padding   : "0",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(168,196,224,0.07)" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "none", border: "none",
              color     : "rgba(168,196,224,0.38)",
              fontSize  : "0.48rem", letterSpacing: "0.32em",
              textTransform: "uppercase", cursor: "none",
              marginBottom: "20px", display: "block",
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(168,196,224,0.75)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(168,196,224,0.38)")}
          >
            ← Return
          </button>
          <div style={{ fontSize: "0.44rem", letterSpacing: "0.38em", color: "rgba(168,196,224,0.35)", textTransform: "uppercase" }}>
            VAR Investigation
          </div>
          <div style={{ fontSize: "0.75rem", letterSpacing: "0.12em", color: "rgba(168,196,224,0.7)", marginTop: "6px", fontWeight: 300 }}>
            Germany vs Brazil
          </div>
          <div style={{ fontSize: "0.44rem", letterSpacing: "0.22em", color: "rgba(168,196,224,0.3)", marginTop: "4px" }}>
            72&apos; — Penalty Incident
          </div>
        </div>

        {/* Timeline steps */}
        <div style={{ flex: 1, padding: "16px 0", overflowY: "auto" }}>
          {STEPS.map((s, i) => {
            const isActive  = i === step;
            const isPast    = i < step;
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width       : "100%",
                  background  : "none",
                  border      : "none",
                  cursor      : "none",
                  padding     : "14px 20px",
                  display          : "flex",
                  alignItems       : "flex-start",
                  gap              : "14px",
                  textAlign        : "left",
                  borderLeft       : isActive ? "2px solid rgba(168,196,224,0.7)" : "2px solid transparent",
                  backgroundColor  : isActive ? "rgba(168,196,224,0.05)" : "transparent",
                  transition       : "all 0.3s",
                }}
              >
                {/* Step number */}
                <div style={{
                  fontSize    : "0.58rem",
                  letterSpacing:"0.12em",
                  color       : isActive ? "rgba(168,196,224,0.9)" : isPast ? "rgba(168,196,224,0.4)" : "rgba(168,196,224,0.2)",
                  fontWeight  : 300,
                  minWidth    : "22px",
                  paddingTop  : "1px",
                }}>
                  {s.number}
                </div>
                <div>
                  <div style={{
                    fontSize    : "0.52rem",
                    letterSpacing:"0.18em",
                    textTransform:"uppercase",
                    color       : isActive ? "rgba(168,196,224,0.85)" : isPast ? "rgba(168,196,224,0.35)" : "rgba(168,196,224,0.18)",
                    fontWeight  : 300,
                    lineHeight  : 1,
                  }}>
                    {s.label}
                  </div>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.4 }}
                      style={{
                        fontSize    : "0.44rem",
                        letterSpacing:"0.06em",
                        color       : "rgba(168,196,224,0.38)",
                        marginTop   : "5px",
                        lineHeight  : 1.5,
                        maxWidth    : "140px",
                      }}
                    >
                      {s.title}
                    </motion.div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress dots */}
        <div style={{
          padding     : "16px 20px",
          borderTop   : "1px solid rgba(168,196,224,0.07)",
          display     : "flex",
          gap         : "6px",
          alignItems  : "center",
        }}>
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width           : i === step ? 20 : 5,
                backgroundColor : i <= step ? "rgba(168,196,224,0.7)" : "rgba(168,196,224,0.18)",
              }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: "2px", borderRadius: "1px" }}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          CENTRE — The pitch (always visible, always the hero)
      ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 relative flex flex-col">

        {/* Top bar */}
        <div style={{
          padding    : "14px 24px",
          borderBottom:"1px solid rgba(168,196,224,0.07)",
          display    : "flex",
          alignItems : "center",
          justifyContent:"space-between",
          flexShrink : 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(220,80,80,0.9)" }}
            />
            <span style={{ fontSize: "0.48rem", letterSpacing: "0.32em", color: "rgba(168,196,224,0.5)", textTransform: "uppercase" }}>
              VAR Review Active
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit   ={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              style={{ fontSize: "0.5rem", letterSpacing: "0.22em", color: "rgba(168,196,224,0.45)", textTransform: "uppercase" }}
            >
              {sd.label} — {sd.title}
            </motion.span>
          </AnimatePresence>
          <span style={{ fontSize: "0.44rem", letterSpacing: "0.2em", color: "rgba(168,196,224,0.25)" }}>
            {step + 1} / {STEPS.length}
          </span>
        </div>

        {/* Canvas — THE PITCH */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        </div>

        {/* Bottom navigation */}
        <div style={{
          padding    : "14px 24px",
          borderTop  : "1px solid rgba(168,196,224,0.07)",
          display    : "flex",
          justifyContent:"space-between",
          alignItems : "center",
          flexShrink : 0,
        }}>
          <motion.button
            onClick={goPrev}
            style={{
              background: "none", border: "1px solid rgba(168,196,224,0.15)",
              color: step > 0 ? "rgba(168,196,224,0.55)" : "rgba(168,196,224,0.12)",
              padding: "7px 18px", fontSize: "0.46rem",
              letterSpacing: "0.28em", textTransform: "uppercase",
              cursor: "none", fontFamily: "inherit",
            }}
            whileHover={step > 0 ? { borderColor: "rgba(168,196,224,0.4)", color: "rgba(168,196,224,0.85)" } : {}}
          >
            ← Previous
          </motion.button>

          {/* Pitch legend for current step */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit   ={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{ display: "flex", gap: "20px", alignItems: "center" }}
            >
              {step === 0 && <>
                <Legend color="rgba(255,255,255,0.7)" label="Germany" />
                <Legend color="rgba(255,215,50,0.7)"  label="Brazil" />
                <Legend color="rgba(255,255,255,0.6)" label="Ball path" dash />
              </>}
              {(step === 1 || step === 3) && <>
                <Legend color="rgba(220,80,80,0.8)"   label="Handball contact" />
                <Legend color="rgba(255,215,50,0.6)"  label="Defender" />
              </>}
              {step === 2 && <>
                <Legend color="rgba(168,196,224,0.7)" label="Natural position" />
                <Legend color="rgba(220,80,80,0.8)"   label="Unnatural arm" />
                <Legend color="rgba(255,200,80,0.7)"  label="Angle delta" />
              </>}
              {step === 4 && <>
                <Legend color="rgba(255,200,80,0.8)"  label="Penalty spot" />
                <Legend color="rgba(80,200,120,0.7)"  label="Decision confirmed" />
              </>}
            </motion.div>
          </AnimatePresence>

          {step < STEPS.length - 1 ? (
            <motion.button
              onClick={goNext}
              style={{
                background: "rgba(168,196,224,0.08)",
                border    : "1px solid rgba(168,196,224,0.28)",
                color     : "rgba(168,196,224,0.8)",
                padding   : "7px 22px", fontSize: "0.46rem",
                letterSpacing: "0.28em", textTransform: "uppercase",
                cursor: "none", fontFamily: "inherit",
              }}
              whileHover={{ background: "rgba(168,196,224,0.15)", color: "rgba(168,196,224,1)" }}
            >
              Next →
            </motion.button>
          ) : (
            <motion.button
              onClick={() => router.push("/")}
              style={{
                background: "rgba(80,200,120,0.1)",
                border    : "1px solid rgba(80,200,120,0.35)",
                color     : "rgba(80,200,120,0.85)",
                padding   : "7px 22px", fontSize: "0.46rem",
                letterSpacing: "0.28em", textTransform: "uppercase",
                cursor: "none", fontFamily: "inherit",
              }}
              whileHover={{ background: "rgba(80,200,120,0.18)", color: "rgba(80,200,120,1)" }}
            >
              Return ↗
            </motion.button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          RIGHT PANEL — Laws, reasoning, evidence
      ══════════════════════════════════════════════════════════ */}
      <div
        className="flex flex-col"
        style={{
          width      : "290px",
          flexShrink : 0,
          background : "rgba(0,6,18,0.92)",
          borderLeft : "1px solid rgba(168,196,224,0.08)",
          overflowY  : "auto",
        }}
      >
        {/* Step header */}
        <div style={{ padding: "24px 22px 18px", borderBottom: "1px solid rgba(168,196,224,0.07)" }}>
          <div style={{ fontSize: "0.44rem", letterSpacing: "0.36em", color: "rgba(168,196,224,0.35)", textTransform: "uppercase" }}>
            Step {sd.number}
          </div>
          <AnimatePresence mode="wait">
            <motion.h2
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit   ={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45 }}
              style={{
                fontSize: "clamp(0.85rem, 1.2vw, 1.05rem)",
                fontWeight: 300, letterSpacing: "0.04em",
                color: "rgba(168,196,224,0.9)", lineHeight: 1.3,
                margin: "8px 0 0",
              }}
            >
              {sd.title}
            </motion.h2>
          </AnimatePresence>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, padding: "20px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit   ={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "flex", flexDirection: "column", gap: "18px" }}
            >

              {/* Body text */}
              <p style={{
                fontSize: "0.65rem", letterSpacing: "0.04em",
                color: "rgba(255,255,255,0.52)", lineHeight: 1.75,
                fontWeight: 300,
              }}>
                {sd.body}
              </p>

              {/* Law block */}
              {sd.law && (
                <div style={{
                  background: "rgba(168,196,224,0.06)",
                  border    : "1px solid rgba(168,196,224,0.15)",
                  padding   : "14px 16px",
                }}>
                  <div style={{ fontSize: "0.42rem", letterSpacing: "0.34em", color: "rgba(168,196,224,0.5)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Law Reference
                  </div>
                  <p style={{
                    fontSize: "0.58rem", letterSpacing: "0.03em",
                    color: "rgba(168,196,224,0.75)", lineHeight: 1.7,
                    fontWeight: 300, fontStyle: "italic",
                  }}>
                    &ldquo;{sd.law}&rdquo;
                  </p>
                </div>
              )}

              {/* Evidence block */}
              {sd.evidence && (
                <div style={{
                  background: "rgba(255,255,255,0.03)",
                  border    : "1px solid rgba(255,255,255,0.07)",
                  padding   : "12px 16px",
                }}>
                  <div style={{ fontSize: "0.42rem", letterSpacing: "0.34em", color: "rgba(168,196,224,0.38)", textTransform: "uppercase", marginBottom: "8px" }}>
                    Technical Data
                  </div>
                  {sd.evidence.split("\n").map((line, i) => (
                    <div key={i} style={{
                      fontSize: "0.54rem", letterSpacing: "0.06em",
                      color: "rgba(255,255,255,0.38)", lineHeight: 2,
                      fontWeight: 300, display: "flex", gap: "8px",
                    }}>
                      <span style={{ color: "rgba(168,196,224,0.3)" }}>—</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}

              {/* Verdict block */}
              {sd.verdict && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  style={{
                    background: "rgba(80,200,120,0.08)",
                    border    : "1px solid rgba(80,200,120,0.3)",
                    padding   : "18px 20px",
                    textAlign : "center",
                  }}
                >
                  <div style={{ fontSize: "0.42rem", letterSpacing: "0.36em", color: "rgba(80,200,120,0.55)", textTransform: "uppercase", marginBottom: "10px" }}>
                    VAR Decision
                  </div>
                  <div style={{
                    fontSize: "1rem", letterSpacing: "0.18em",
                    color: "rgba(80,200,120,0.95)", fontWeight: 200,
                    textTransform: "uppercase",
                  }}>
                    {sd.verdict}
                  </div>
                  <div style={{
                    fontSize: "0.48rem", letterSpacing: "0.1em",
                    color: "rgba(80,200,120,0.45)", marginTop: "8px", fontWeight: 300,
                  }}>
                    Confirmed by Video Assistant Referee
                  </div>
                </motion.div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pitch annotation key (bottom of right panel) */}
        <div style={{
          padding   : "16px 22px",
          borderTop : "1px solid rgba(168,196,224,0.07)",
        }}>
          <div style={{ fontSize: "0.4rem", letterSpacing: "0.3em", color: "rgba(168,196,224,0.22)", textTransform: "uppercase", marginBottom: "10px" }}>
            Pitch Key
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
            <LegendRow color="rgba(220,80,80,0.75)"   label="Contact / Violation" />
            <LegendRow color="rgba(168,196,224,0.6)"  label="Reference / Natural" />
            <LegendRow color="rgba(255,200,80,0.7)"   label="Measurement" />
            <LegendRow color="rgba(80,200,120,0.6)"   label="Confirmed decision" />
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Small UI atoms ────────────────────────────────────────────────────────────

function Legend({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <div style={{
        width     : 18,
        height    : 1.5,
        background: dash ? "none" : color,
        borderTop : dash ? `1.5px dashed ${color}` : "none",
        flexShrink: 0,
      }} />
      <span style={{ fontSize: "0.42rem", letterSpacing: "0.15em", color: "rgba(168,196,224,0.38)", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: "0.44rem", letterSpacing: "0.1em", color: "rgba(168,196,224,0.3)" }}>
        {label}
      </span>
    </div>
  );
}
