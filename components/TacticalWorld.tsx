"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import { useRef, useMemo, useEffect, useCallback } from "react";
import * as THREE from "three";

// ─── Public types ─────────────────────────────────────────────────────────────

export type CameraMode = "tactical" | "focus" | "broadcast" | "pov";

export interface DisplayedPlayer {
  x: number; y: number;
  teammate: boolean; actor: boolean; keeper: boolean;
  opacity: number;
}

export interface DisplayedScene {
  players      : DisplayedPlayer[];
  location     : [number, number];
  va           : number[];
  vaNext       : number[];
  vaOpacity    : number;
  vaNextOpacity: number;
}

// ─── Coordinate conversion ────────────────────────────────────────────────────

export function sb2xz(sx: number, sy: number): [number, number] {
  return [sx - 60, sy - 40];
}

// ─── Camera helpers ───────────────────────────────────────────────────────────

const TACTICAL_POS    = new THREE.Vector3(0, 52, 72);
const TACTICAL_TARGET = new THREE.Vector3(0, 0, 0);
// Broadcast: half-way line, elevated right-of-center — classic TV diagonal
const BROADCAST_POS    = new THREE.Vector3(22, 26, 62);
const BROADCAST_TARGET = new THREE.Vector3(-4, 0, -8);

// Compute POV camera from player position + azimuth angle.
// azimuth=0 → default behind-player (attack direction); ±π/2 = sides; π = rear.
function getPovCam(
  scene       : DisplayedScene,
  povPlayerIdx: number | null,
  azimuth     : number,
): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const p = povPlayerIdx != null ? scene.players[povPlayerIdx] : null;
  if (p) {
    const [wx, wz] = sb2xz(p.x, p.y);
    const baseAngle = p.x < 60 ? 0 : Math.PI; // 0 = attack toward +X
    const angle     = baseAngle + azimuth;
    const CAM_DIST  = 4.0;   // how far behind the player the camera sits
    const CAM_H     = 4.8;   // shoulder height
    const LOOK_DIST = 22;    // how far ahead the camera looks
    return {
      pos   : new THREE.Vector3(wx - Math.sin(angle) * CAM_DIST, CAM_H, wz - Math.cos(angle) * CAM_DIST),
      target: new THREE.Vector3(wx + Math.sin(angle) * LOOK_DIST, 1.2, wz + Math.cos(angle) * LOOK_DIST),
    };
  }
  // Fallback when no player
  return { pos: BROADCAST_POS.clone(), target: BROADCAST_TARGET.clone() };
}

function getModeCam(
  mode        : CameraMode,
  scene       : DisplayedScene,
  povPlayerIdx: number | null = null,
  povAzimuth  : number = 0,
) {
  if (mode === "pov") {
    return getPovCam(scene, povPlayerIdx, povAzimuth);
  }
  if (mode === "focus") {
    const actor = scene.players.find(p => p.actor && p.opacity > 0.25);
    const [ax, az] = actor ? sb2xz(actor.x, actor.y) : [0, 0];
    return {
      pos   : new THREE.Vector3(ax * 0.40, 4.5, az + 20),
      target: new THREE.Vector3(ax, 1.2, az),
    };
  }
  if (mode === "broadcast") {
    return { pos: BROADCAST_POS.clone(), target: BROADCAST_TARGET.clone() };
  }
  return { pos: TACTICAL_POS.clone(), target: TACTICAL_TARGET.clone() };
}

// ─── Camera controller ────────────────────────────────────────────────────────

function CameraController({
  mode, scene, orbitRef, onOrbitReady, povPlayerIdx, povAzimuth,
}: {
  mode          : CameraMode;
  scene         : DisplayedScene;
  orbitRef      : React.RefObject<any>;
  onOrbitReady? : (controls: any) => void;
  povPlayerIdx  : number | null;
  povAzimuth    : number;
}) {
  const { camera } = useThree();

  const sceneRef     = useRef(scene);
  const povIdxRef    = useRef(povPlayerIdx);
  const povAzRef     = useRef(povAzimuth);       // target azimuth from D-pad
  const smoothAzRef  = useRef(povAzimuth);       // smoothed azimuth (lerped each frame)
  useEffect(() => { sceneRef.current  = scene;        }, [scene]);
  useEffect(() => { povIdxRef.current = povPlayerIdx; }, [povPlayerIdx]);
  useEffect(() => { povAzRef.current  = povAzimuth;   }, [povAzimuth]);

  const smoothPos    = useRef(TACTICAL_POS.clone());
  const smoothTarget = useRef(TACTICAL_TARGET.clone());
  const modeRef      = useRef<CameraMode>(mode);
  const prevModeRef  = useRef<CameraMode>(mode);
  const isAnimRef    = useRef(false);

  // Init
  useEffect(() => {
    camera.position.copy(TACTICAL_POS);
    smoothPos.current.copy(TACTICAL_POS);
    smoothTarget.current.copy(TACTICAL_TARGET);
    if (orbitRef.current) {
      orbitRef.current.target.copy(TACTICAL_TARGET);
      orbitRef.current.update();
      onOrbitReady?.(orbitRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === prevModeRef.current) return;
    prevModeRef.current = mode;
    modeRef.current     = mode;
    smoothPos.current.copy(camera.position);
    if (orbitRef.current) {
      smoothTarget.current.copy(orbitRef.current.target);
      // Orbit is disabled in POV — button D-pad controls rotation
      orbitRef.current.enabled = mode !== "pov";
    }
    if (mode === "tactical") isAnimRef.current = true;
    if (mode === "pov") {
      // Kick off initial fly-in
      isAnimRef.current = true;
      smoothAzRef.current = povAzRef.current;
    }
  }, [mode, camera, orbitRef]);

  useFrame((_, delta) => {
    const m = modeRef.current;

    // ── POV: dedicated path — orbit off, D-pad controls azimuth ──────────────
    if (m === "pov") {
      // Smooth-lerp azimuth — shortest-path wrap to avoid spinning the long way
      let dAz = povAzRef.current - smoothAzRef.current;
      if (dAz >  Math.PI) dAz -= 2 * Math.PI;
      if (dAz < -Math.PI) dAz += 2 * Math.PI;
      smoothAzRef.current += dAz * (1 - Math.exp(-6.0 * delta));

      const { pos, target } = getPovCam(sceneRef.current, povIdxRef.current, smoothAzRef.current);
      const k = 1 - Math.exp(-3.8 * delta);
      smoothPos.current.lerp(pos, k);
      smoothTarget.current.lerp(target, k);
      camera.position.copy(smoothPos.current);
      if (orbitRef.current) {
        orbitRef.current.target.copy(smoothTarget.current);
        orbitRef.current.update();
      }
      return;
    }

    // ── Tactical idle — orbit owns camera ────────────────────────────────────
    if (m === "tactical" && !isAnimRef.current) {
      smoothPos.current.copy(camera.position);
      if (orbitRef.current) smoothTarget.current.copy(orbitRef.current.target);
      return;
    }

    // ── Animating (broadcast / focus / tactical entry) ────────────────────────
    const { pos, target } = getModeCam(m, sceneRef.current, null, 0);
    const k = 1 - Math.exp(-3.2 * delta);
    smoothPos.current.lerp(pos, k);
    smoothTarget.current.lerp(target, k);
    camera.position.copy(smoothPos.current);
    if (orbitRef.current) {
      orbitRef.current.target.copy(smoothTarget.current);
      orbitRef.current.update();
    }
    const settled =
      smoothPos.current.distanceTo(pos) < 1.2 &&
      smoothTarget.current.distanceTo(target) < 0.4;
    if (settled) {
      isAnimRef.current = false;
      if (orbitRef.current) orbitRef.current.enabled = true;
    }
  });

  return null;
}

// ─── Pitch ────────────────────────────────────────────────────────────────────

// Per-pixel grass texture: 2048×1365 (matches 120:80 = 3:2 pitch aspect)
// Uses ImageData for speed — no canvas API call per pixel.
function buildGrassTexture(): THREE.CanvasTexture {
  const W = 2048, H = 1365;          // 120×80 aspect → 3:2
  const cvs = document.createElement("canvas");
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext("2d")!;
  const img = ctx.createImageData(W, H);
  const d   = img.data;

  // Precompute floodlight centre-field brightness gradient
  // (simulates stadium lights being brighter at centre)
  const CX = W * 0.5, CY = H * 0.5;
  const maxDist = Math.sqrt(CX*CX + CY*CY);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      // Pitch coordinate (0..120, 0..80)
      const pitchX = (px / W) * 120;
      const pitchY = (py / H) * 80;

      // ── Mowing stripes ─────────────────────────────────────────────────────
      // 10m bands along X. Even = dark grass, odd = bright grass.
      const stripeIdx   = Math.floor(pitchX / 10);
      const lightStripe = stripeIdx % 2 === 1;

      // Base RGB — dark emerald Champions League turf
      // Stripe 1: #245f2a = (36,95,42)  Stripe 2: #2d6f33 = (45,111,51)
      let r = lightStripe ? 45  : 36;
      let g = lightStripe ? 111 : 95;
      let b = lightStripe ? 51  : 42;

      // ── Micro-direction lines within stripe (blade tips catching light) ───
      const bladeRow = py % 6;
      if (bladeRow < 2) { r += 3; g += 9; b += 2; }

      // ── Grass noise (fast bit-hash, no RNG state) ─────────────────────────
      const hash = ((px * 374761393) ^ (py * 668265263) ^ (px * py * 2246822519)) >>> 0;
      const n    = ((hash & 0x17) - 12); // ±12 — subtle, not noisy
      r = Math.max(0, Math.min(255, r + n));
      g = Math.max(0, Math.min(255, g + (n | 0)));
      b = Math.max(0, Math.min(255, b + Math.floor(n * 0.35)));

      // ── Floodlight falloff: brighter centre, dark corners ─────────────────
      // Stadium lights point inward — corners receive least illumination
      const dCentre    = Math.sqrt((px - CX) ** 2 + (py - CY) ** 2);
      const normDist   = dCentre / maxDist; // 0 = centre, 1 = corner
      const centreBoost = (1 - normDist) * 28;   // centre gets +28g
      const cornerDark  = normDist * normDist * 32; // corners lose up to 32g
      g = Math.min(255, Math.max(0, g + Math.floor(centreBoost - cornerDark)));
      r = Math.min(255, Math.max(0, r + Math.floor((centreBoost - cornerDark) * 0.25)));

      // ── Wear / high-traffic patches ──────────────────────────────────────
      // Center circle ring
      const dcx = pitchX - 60, dcy = pitchY - 40;
      const distC = Math.sqrt(dcx * dcx + dcy * dcy);
      const cWear = Math.max(0, 1 - Math.abs(distC - 10) * 0.9) * 0.20;

      // Penalty spots (12,40) and (108,40)
      const dP1 = Math.sqrt((pitchX - 12) ** 2 + (pitchY - 40) ** 2);
      const dP2 = Math.sqrt((pitchX - 108) ** 2 + (pitchY - 40) ** 2);
      const pWear = (Math.max(0, 1 - dP1 * 0.55) + Math.max(0, 1 - dP2 * 0.55)) * 0.25;

      // Goal mouths (high-traffic rectangle)
      const leftGoal  = pitchX < 20 && pitchY > 27 && pitchY < 53
        ? (1 - pitchX / 20) * 0.22 : 0;
      const rightGoal = pitchX > 100 && pitchY > 27 && pitchY < 53
        ? ((pitchX - 100) / 20) * 0.22 : 0;

      // Touchline edges (slight dryness)
      const edgeWear = (
        (pitchY < 4  ? (1 - pitchY / 4)  : 0) +
        (pitchY > 76 ? (pitchY - 76) / 4 : 0) +
        (pitchX < 4  ? (1 - pitchX / 4)  : 0) +
        (pitchX > 116 ? (pitchX - 116) / 4 : 0)
      ) * 0.12;

      const totalWear = Math.min(0.35, cWear + pWear + leftGoal + rightGoal + edgeWear);

      // Wear shifts colour toward dry sand-yellow-brown
      if (totalWear > 0) {
        r = Math.min(255, Math.round(r * (1 - totalWear) + 80  * totalWear));
        g = Math.min(255, Math.round(g * (1 - totalWear) + 115 * totalWear));
        b = Math.min(255, Math.round(b * (1 - totalWear) + 18  * totalWear));
      }

      const idx = (py * W + px) * 4;
      d[idx    ] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

function PitchGround({ fanMode: _ }: { fanMode?: boolean }) {
  const { gl } = useThree();

  const grassTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    return buildGrassTexture();
  }, []);

  useEffect(() => {
    if (grassTex) grassTex.anisotropy = gl.capabilities.getMaxAnisotropy();
  }, [grassTex, gl]);

  return (
    <group>
      {/* Main pitch plane — textured grass */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[124, 84, 1, 1]} />
        <meshStandardMaterial
          map={grassTex ?? undefined}
          color={grassTex ? "#ffffff" : "#1b5e20"}
          roughness={0.72}
          metalness={0.02}
        />
      </mesh>

      {/* Subtle edge darkening — frames the pitch */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.01, 0]}>
        <ringGeometry args={[61, 63.5, 80]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      {/* Centre-field spotlight glow — brighter midfield feel */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.003, 0]}>
        <circleGeometry args={[22, 48]} />
        <meshBasicMaterial color="#30e050" transparent opacity={0.045} depthWrite={false} />
      </mesh>
    </group>
  );
}

function arcPts(cx: number, cz: number, r: number, a0: number, a1: number, segs = 48): [number,number,number][] {
  return Array.from({ length: segs + 1 }, (_, i) => {
    const a = a0 + (a1 - a0) * (i / segs);
    return [cx + Math.cos(a) * r, 0.02, cz + Math.sin(a) * r];
  });
}

function PitchMarkings() {
  const segs = useMemo(() => {
    const S: [number,number,number][][] = [];
    const p = Math.acos(6 / 10);
    // Outer boundary, halfway, centre circle
    S.push([[-60,0.02,-40],[60,0.02,-40],[60,0.02,40],[-60,0.02,40],[-60,0.02,-40]]);
    S.push([[0,0.02,-40],[0,0.02,40]]);
    S.push(arcPts(0,0,10,0,Math.PI*2));
    // Penalty areas
    S.push([[-60,0.02,-22],[-42,0.02,-22],[-42,0.02,22],[-60,0.02,22]]);
    S.push([[-60,0.02,-10],[-54,0.02,-10],[-54,0.02,10],[-60,0.02,10]]);
    S.push([[60,0.02,-22],[42,0.02,-22],[42,0.02,22],[60,0.02,22]]);
    S.push([[60,0.02,-10],[54,0.02,-10],[54,0.02,10],[60,0.02,10]]);
    // Penalty arcs
    S.push(arcPts(-48,0,10,-p,p,24));
    S.push(arcPts(48,0,10,Math.PI-p,Math.PI+p,24));
    // Corner arcs
    S.push(arcPts(-60,-40,1,0,Math.PI/2,10));
    S.push(arcPts(60,-40,1,Math.PI/2,Math.PI,10));
    S.push(arcPts(60,40,1,Math.PI,1.5*Math.PI,10));
    S.push(arcPts(-60,40,1,1.5*Math.PI,2*Math.PI,10));
    return S;
  }, []);

  return (
    <group>
      {segs.map((pts, i) => (
        <Line key={i} points={pts} color="#ffffff" lineWidth={2.2}
          transparent opacity={0.96} />
      ))}
      {([[-48,0],[0,0],[48,0]] as [number,number][]).map(([px,pz]) => (
        <mesh key={`${px}-${pz}`} rotation={[-Math.PI/2,0,0]} position={[px,0.03,pz]}>
          <circleGeometry args={[0.35,16]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Goals with posts, crossbar and net ──────────────────────────────────────

const GOAL_HALF_W = 3.66;   // 7.32m wide
const GOAL_H      = 2.44;   // 2.44m tall
const GOAL_DEPTH  = 2.4;    // net depth
const POST_R      = 0.07;

function Goal({ x }: { x: -60 | 60 }) {
  const behind = x < 0 ? -1 : 1; // net extends away from pitch
  const dx     = behind * GOAL_DEPTH;

  // Net grid lines — back face, side faces, top face
  const netLines = useMemo((): [number,number,number][][] => {
    const lines: [number,number,number][][] = [];
    const VERTS = 10, HORIZ = 7;
    // Back face verticals
    for (let i = 0; i <= VERTS; i++) {
      const z = -GOAL_HALF_W + i * (GOAL_HALF_W * 2 / VERTS);
      lines.push([[x+dx, 0, z], [x+dx, GOAL_H, z]]);
    }
    // Back face horizontals
    for (let j = 0; j <= HORIZ; j++) {
      const y = j * (GOAL_H / HORIZ);
      lines.push([[x+dx, y, -GOAL_HALF_W], [x+dx, y, GOAL_HALF_W]]);
    }
    // Top face (crossbar → back)
    for (let i = 0; i <= VERTS; i++) {
      const z = -GOAL_HALF_W + i * (GOAL_HALF_W * 2 / VERTS);
      lines.push([[x, GOAL_H, z], [x+dx, GOAL_H, z]]);
    }
    // Side face left
    for (let j = 0; j <= HORIZ; j++) {
      const y = j * (GOAL_H / HORIZ);
      lines.push([[x, y, -GOAL_HALF_W], [x+dx, y, -GOAL_HALF_W]]);
    }
    // Side face right
    for (let j = 0; j <= HORIZ; j++) {
      const y = j * (GOAL_H / HORIZ);
      lines.push([[x, y,  GOAL_HALF_W], [x+dx, y,  GOAL_HALF_W]]);
    }
    return lines;
  }, [x, dx]);

  const postMat = (
    <meshStandardMaterial color="#d8d8d8" metalness={0.30} roughness={0.50} />
  );

  return (
    <group>
      {/* Left post */}
      <mesh position={[x, GOAL_H/2, -GOAL_HALF_W]} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_H, 8]} />
        {postMat}
      </mesh>
      {/* Right post */}
      <mesh position={[x, GOAL_H/2, GOAL_HALF_W]} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_H, 8]} />
        {postMat}
      </mesh>
      {/* Crossbar — rotated to lie along Z axis */}
      <mesh position={[x, GOAL_H, 0]} rotation={[Math.PI/2, 0, 0]} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_HALF_W*2, 8]} />
        {postMat}
      </mesh>

      {/* Net grid lines */}
      {netLines.map((pts, i) => (
        <Line key={i} points={pts} color="#e8e8e8" lineWidth={0.6} transparent opacity={0.30} />
      ))}

      {/* Net fill — barely visible translucent panels */}
      {/* Back */}
      <mesh position={[x+dx, GOAL_H/2, 0]} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[GOAL_HALF_W*2, GOAL_H]} />
        <meshBasicMaterial color="#e0e0e0" transparent opacity={0.06}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Top */}
      <mesh position={[x+dx/2, GOAL_H, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[Math.abs(dx), GOAL_HALF_W*2]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.018}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Side left */}
      <mesh position={[x+dx/2, GOAL_H/2, -GOAL_HALF_W]}>
        <planeGeometry args={[Math.abs(dx), GOAL_H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.018}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Side right */}
      <mesh position={[x+dx/2, GOAL_H/2, GOAL_HALF_W]}>
        <planeGeometry args={[Math.abs(dx), GOAL_H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.018}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Post shadow (subtle disk at base) */}
      {([-GOAL_HALF_W, GOAL_HALF_W] as const).map(z => (
        <mesh key={z} rotation={[-Math.PI/2,0,0]} position={[x,0.01,z]}>
          <circleGeometry args={[0.22, 10]} />
          <meshBasicMaterial color="#000" transparent opacity={0.40} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Tactical arena ───────────────────────────────────────────────────────────

// One tiered stand section — aligned along local Z, facing local -X (toward pitch)
function Stand({ len, depth = 14, tiers = 2 }: { len: number; depth?: number; tiers?: number }) {
  return (
    <group>
      {/* Tier 1 — nearest to pitch */}
      <mesh position={[0, 2.5, depth * 0.28]} receiveShadow>
        <boxGeometry args={[len, 5, depth * 0.56]} />
        <meshStandardMaterial color="#0c0f15" roughness={0.95} metalness={0.10} />
      </mesh>
      {/* Tier 2 — stepped back */}
      {tiers >= 2 && (
        <mesh position={[0, 6.5, depth * 0.72]} receiveShadow>
          <boxGeometry args={[len, 5, depth * 0.44]} />
          <meshStandardMaterial color="#090c12" roughness={0.95} metalness={0.10} />
        </mesh>
      )}
      {/* Fascia — front lip */}
      <mesh position={[0, 0.25, 0.5]} receiveShadow>
        <boxGeometry args={[len, 0.5, 1]} />
        <meshStandardMaterial color="#0e1118" roughness={0.80} metalness={0.20}
          emissive="#1a1e24" emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

// ─── Fan mode dome stadium components ────────────────────────────────────────

// ─── Fan mode: canvas-texture stadium (photorealistic crowd + floodlights) ───

// ─── Team identity palettes ───────────────────────────────────────────────────
// Each entry drives crowd colours, LED ribbon content, and section bias.
// Keyed by TeamMeta.name (e.g. "Japan", "Spain").
type TeamStadium = {
  home   : [number,number,number][];   // jersey colour variants (RGB)
  accent : [number,number,number][];   // secondary colour variants
  neutral: [number,number,number][];   // neutral/scarf mix
  bias   : number;                     // fraction of crowd in home colour (0–1)
  led    : { bg:string; fg:string; text:string }[];
};

const TEAM_STADIUM: Record<string, TeamStadium> = {
  "Japan": {
    home   : [[20,50,160],[18,44,148],[25,60,175],[15,42,145],[30,65,185],[22,55,165]],
    accent : [[240,242,248],[255,255,255],[228,232,245],[210,215,235]],
    neutral: [[70,90,130],[55,75,115],[85,105,145],[40,58,100],[100,120,160]],
    bias   : 0.72,
    led: [
      { bg:"#003087", fg:"#ffffff", text:"⚽ JAPAN" },
      { bg:"#ffffff", fg:"#003087", text:"SAMURAI BLUE" },
      { bg:"#003087", fg:"#ffffff", text:"がんばれ日本" },
      { bg:"#c8102e", fg:"#ffffff", text:"QATAR 2022" },
      { bg:"#003087", fg:"#ffd700", text:"PITCHLENS AI" },
      { bg:"#ffffff", fg:"#003087", text:"⚽ JPN" },
      { bg:"#003087", fg:"#ffffff", text:"STATSBOMB 360°" },
      { bg:"#c8102e", fg:"#ffd700", text:"FIFA WORLD CUP" },
    ],
  },
  "Spain": {
    home   : [[196,12,48],[178,10,30],[210,15,55],[192,12,42],[184,8,38],[202,14,52]],
    accent : [[255,196,0],[240,178,0],[255,210,20],[228,188,0],[248,200,10]],
    neutral: [[140,60,60],[120,50,50],[155,65,65],[100,40,40],[165,75,75]],
    bias   : 0.70,
    led: [
      { bg:"#c60b1e", fg:"#ffd700", text:"⚽ ESPAÑA" },
      { bg:"#ffd700", fg:"#c60b1e", text:"LA ROJA" },
      { bg:"#c60b1e", fg:"#ffffff", text:"VAMOS ESPAÑA" },
      { bg:"#003399", fg:"#ffd700", text:"FIFA WORLD CUP" },
      { bg:"#c60b1e", fg:"#ffd700", text:"PITCHLENS AI" },
      { bg:"#ffd700", fg:"#c60b1e", text:"⚽ ESP" },
      { bg:"#c60b1e", fg:"#ffffff", text:"STATSBOMB 360°" },
      { bg:"#ffd700", fg:"#c60b1e", text:"QATAR 2022" },
    ],
  },
  "Germany": {
    home   : [[14,14,14],[22,22,22],[8,8,8],[28,28,28],[18,18,18],[10,10,10]],
    accent : [[220,0,0],[198,0,0],[238,10,10],[208,4,4],[228,5,5]],
    neutral: [[80,80,80],[65,65,65],[95,95,95],[50,50,50],[110,110,110]],
    bias   : 0.68,
    led: [
      { bg:"#000000", fg:"#ffce00", text:"⚽ DEUTSCHLAND" },
      { bg:"#dd0000", fg:"#ffffff", text:"DIE MANNSCHAFT" },
      { bg:"#ffce00", fg:"#000000", text:"⚽ GER" },
      { bg:"#000000", fg:"#dd0000", text:"FIFA WORLD CUP" },
      { bg:"#ffce00", fg:"#000000", text:"PITCHLENS AI" },
      { bg:"#dd0000", fg:"#ffce00", text:"STATSBOMB 360°" },
      { bg:"#000000", fg:"#ffffff", text:"QATAR 2022" },
      { bg:"#dd0000", fg:"#000000", text:"⚽ DEUTSCHLAND" },
    ],
  },
  "Portugal": {
    home   : [[0,100,0],[0,88,0],[0,114,10],[0,78,5],[5,95,0],[0,92,4]],
    accent : [[198,16,46],[178,10,35],[214,20,50],[188,12,40],[204,18,48]],
    neutral: [[60,100,60],[50,88,50],[70,112,70],[40,80,40],[80,120,80]],
    bias   : 0.68,
    led: [
      { bg:"#006600", fg:"#ffffff", text:"⚽ PORTUGAL" },
      { bg:"#c8102e", fg:"#ffffff", text:"A SELEÇÃO" },
      { bg:"#006600", fg:"#ffd700", text:"VAMOS PORTUGAL" },
      { bg:"#c8102e", fg:"#006600", text:"FIFA WORLD CUP" },
      { bg:"#006600", fg:"#ffffff", text:"PITCHLENS AI" },
      { bg:"#ffd700", fg:"#006600", text:"⚽ POR" },
      { bg:"#c8102e", fg:"#ffd700", text:"STATSBOMB 360°" },
      { bg:"#006600", fg:"#c8102e", text:"QATAR 2022" },
    ],
  },
  "England": {
    home   : [[252,252,255],[238,240,244],[248,250,252],[244,246,250],[234,236,242]],
    accent : [[206,9,33],[188,8,28],[218,12,38],[198,10,30],[208,11,34]],
    neutral: [[160,160,170],[145,145,155],[175,175,182],[130,130,142],[185,185,192]],
    bias   : 0.72,
    led: [
      { bg:"#ffffff", fg:"#cf0921", text:"⚽ ENGLAND" },
      { bg:"#cf0921", fg:"#ffffff", text:"THREE LIONS" },
      { bg:"#00205b", fg:"#ffffff", text:"IT'S COMING HOME" },
      { bg:"#cf0921", fg:"#ffffff", text:"FIFA WORLD CUP" },
      { bg:"#00205b", fg:"#ffffff", text:"PITCHLENS AI" },
      { bg:"#ffffff", fg:"#cf0921", text:"⚽ ENG" },
      { bg:"#cf0921", fg:"#ffd700", text:"STATSBOMB 360°" },
      { bg:"#00205b", fg:"#cf0921", text:"QATAR 2022" },
    ],
  },
  "Wales": {
    home   : [[192,0,26],[173,0,20],[208,5,30],[183,0,22],[198,2,28],[186,0,24]],
    accent : [[252,252,252],[238,240,240],[248,248,250],[230,232,232]],
    neutral: [[130,40,40],[115,32,32],[145,48,48],[100,28,28],[155,55,55]],
    bias   : 0.70,
    led: [
      { bg:"#c2001a", fg:"#ffffff", text:"⚽ CYMRU" },
      { bg:"#ffffff", fg:"#c2001a", text:"WALES" },
      { bg:"#c2001a", fg:"#00a651", text:"YMLAEN CYMRU" },
      { bg:"#00a651", fg:"#ffffff", text:"FIFA WORLD CUP" },
      { bg:"#c2001a", fg:"#ffffff", text:"PITCHLENS AI" },
      { bg:"#00a651", fg:"#ffffff", text:"⚽ WAL" },
      { bg:"#c2001a", fg:"#ffd700", text:"STATSBOMB 360°" },
      { bg:"#ffffff", fg:"#c2001a", text:"QATAR 2022" },
    ],
  },
  "Iran": {
    home   : [[0,112,66],[0,98,55],[0,124,74],[0,92,58],[4,106,68],[0,104,62]],
    accent : [[252,252,252],[238,238,242],[248,248,250],[228,228,235]],
    neutral: [[60,110,70],[50,98,60],[70,122,80],[40,88,52],[80,130,88]],
    bias   : 0.68,
    led: [
      { bg:"#007342", fg:"#ffffff", text:"⚽ IRAN" },
      { bg:"#ffffff", fg:"#007342", text:"TEAM MELLI" },
      { bg:"#c8102e", fg:"#ffffff", text:"⚽ IRN" },
      { bg:"#007342", fg:"#ffffff", text:"FIFA WORLD CUP" },
      { bg:"#007342", fg:"#ffd700", text:"PITCHLENS AI" },
      { bg:"#ffffff", fg:"#c8102e", text:"STATSBOMB 360°" },
      { bg:"#c8102e", fg:"#007342", text:"QATAR 2022" },
      { bg:"#007342", fg:"#ffffff", text:"⚽ IRAN" },
    ],
  },
  "United States": {
    home   : [[10,48,95],[8,40,83],[12,54,108],[9,44,90],[14,52,100],[11,46,96]],
    accent : [[175,32,50],[158,26,40],[188,38,58],[168,30,46],[180,34,52]],
    neutral: [[80,80,120],[68,68,108],[92,92,132],[55,55,98],[105,105,145]],
    bias   : 0.68,
    led: [
      { bg:"#0a3161", fg:"#ffffff", text:"⚽ USA" },
      { bg:"#b22234", fg:"#ffffff", text:"STARS & STRIPES" },
      { bg:"#ffffff", fg:"#0a3161", text:"LET'S GO USA" },
      { bg:"#b22234", fg:"#ffffff", text:"FIFA WORLD CUP" },
      { bg:"#0a3161", fg:"#b22234", text:"PITCHLENS AI" },
      { bg:"#ffffff", fg:"#0a3161", text:"⚽ USA" },
      { bg:"#b22234", fg:"#ffd700", text:"STATSBOMB 360°" },
      { bg:"#0a3161", fg:"#ffffff", text:"QATAR 2022" },
    ],
  },
  "Belgium": {
    home   : [[10,10,10],[18,18,18],[6,6,6],[24,24,24],[14,14,14],[8,8,8]],
    accent : [[238,50,62],[218,38,52],[248,58,70],[228,44,56],[240,52,64]],
    neutral: [[80,50,20],[68,40,15],[92,58,24],[55,35,10],[105,65,28]],
    bias   : 0.68,
    led: [
      { bg:"#000000", fg:"#ffd100", text:"⚽ BELGIQUE" },
      { bg:"#ef3340", fg:"#000000", text:"RED DEVILS" },
      { bg:"#ffd100", fg:"#000000", text:"ALLEZ LES DIABLES" },
      { bg:"#000000", fg:"#ef3340", text:"FIFA WORLD CUP" },
      { bg:"#ef3340", fg:"#ffd100", text:"PITCHLENS AI" },
      { bg:"#ffd100", fg:"#000000", text:"⚽ BEL" },
      { bg:"#000000", fg:"#ffffff", text:"STATSBOMB 360°" },
      { bg:"#ef3340", fg:"#ffffff", text:"QATAR 2022" },
    ],
  },
  "Croatia": {
    home   : [[252,0,0],[228,0,0],[244,4,4],[218,4,4],[238,0,0],[246,2,2]],
    accent : [[252,252,252],[238,240,240],[248,248,250],[228,230,232]],
    neutral: [[140,0,0],[120,0,0],[158,5,5],[102,0,0],[170,8,8]],
    bias   : 0.70,
    led: [
      { bg:"#ff0000", fg:"#ffffff", text:"⚽ HRVATSKA" },
      { bg:"#ffffff", fg:"#ff0000", text:"VATRENI" },
      { bg:"#0046ad", fg:"#ffffff", text:"IDEMO HRVATSKA" },
      { bg:"#ff0000", fg:"#ffffff", text:"FIFA WORLD CUP" },
      { bg:"#0046ad", fg:"#ffffff", text:"PITCHLENS AI" },
      { bg:"#ffffff", fg:"#ff0000", text:"⚽ CRO" },
      { bg:"#ff0000", fg:"#ffd700", text:"STATSBOMB 360°" },
      { bg:"#0046ad", fg:"#ff0000", text:"QATAR 2022" },
    ],
  },
  "Ghana": {
    home   : [[0,104,76],[0,90,64],[0,118,84],[4,98,70],[0,94,70],[0,110,80]],
    accent : [[254,208,0],[238,190,0],[252,218,18],[244,198,8],[255,215,10]],
    neutral: [[60,80,50],[50,68,40],[70,92,58],[40,60,32],[80,105,65]],
    bias   : 0.68,
    led: [
      { bg:"#006b4e", fg:"#ffd100", text:"⚽ GHANA" },
      { bg:"#ce1126", fg:"#ffd100", text:"BLACK STARS" },
      { bg:"#ffd100", fg:"#000000", text:"⚽ GHA" },
      { bg:"#006b4e", fg:"#ffffff", text:"FIFA WORLD CUP" },
      { bg:"#ce1126", fg:"#ffffff", text:"PITCHLENS AI" },
      { bg:"#ffd100", fg:"#006b4e", text:"STATSBOMB 360°" },
      { bg:"#000000", fg:"#ffd100", text:"QATAR 2022" },
      { bg:"#006b4e", fg:"#ffd100", text:"⚽ GHANA" },
    ],
  },
};

function buildStadiumTexture(teamKey?: string): THREE.CanvasTexture {
  // 4 K wide for crispness when projected on a large cylinder
  const W = 4096, H = 2048;
  const cvs = document.createElement("canvas");
  cvs.width = W; cvs.height = H;
  const c = cvs.getContext("2d")!;

  // ── Seeded LCG ───────────────────────────────────────────────────────────────
  let seed = 0xc0ffee42;
  const rand = () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 0x100000000; };
  const rInt = (n: number) => Math.floor(rand() * n);
  const rRange = (lo: number, hi: number) => lo + rand() * (hi - lo);

  // ── Deep-night sky / roof ─────────────────────────────────────────────────────
  const skyGrad = c.createLinearGradient(0, 0, 0, H * 0.14);
  skyGrad.addColorStop(0, "#010208");
  skyGrad.addColorStop(1, "#060a18");
  c.fillStyle = skyGrad;
  c.fillRect(0, 0, W, H * 0.14);

  // Roof steel truss lines — converging to vanishing points at each end
  c.strokeStyle = "rgba(50,60,90,0.55)";
  c.lineWidth = 2.5;
  for (let i = 0; i <= 20; i++) {
    const x = (i / 20) * W;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(W/2 + (x - W/2)*0.22, H*0.15); c.stroke();
  }
  // Cross struts
  for (let j = 1; j <= 5; j++) {
    c.strokeStyle = `rgba(40,50,75,${0.35 - j*0.05})`;
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, H*0.028*j); c.lineTo(W, H*0.028*j); c.stroke();
  }

  // ── Floodlight banks ─────────────────────────────────────────────────────────
  const FLOOD_XS = [0.052, 0.155, 0.270, 0.385, 0.500, 0.615, 0.730, 0.845, 0.948];
  FLOOD_XS.forEach(xp => {
    // Atmospheric halo — warm white, very wide
    const halo = c.createRadialGradient(W*xp, H*0.055, 2, W*xp, H*0.10, W*0.16);
    halo.addColorStop(0,    "rgba(255,255,245,1.00)");
    halo.addColorStop(0.04, "rgba(255,250,220,0.96)");
    halo.addColorStop(0.13, "rgba(255,242,195,0.72)");
    halo.addColorStop(0.32, "rgba(255,232,165,0.30)");
    halo.addColorStop(0.60, "rgba(255,222,140,0.10)");
    halo.addColorStop(1.0,  "rgba(255,210,110,0.00)");
    c.fillStyle = halo;
    c.fillRect(W*xp - W*0.18, 0, W*0.36, H*0.36);

    // Steel housing frame
    c.fillStyle = "#141820";
    c.fillRect(W*xp - 36, H*0.036, 72, 22);
    c.fillStyle = "#1e2430";
    c.fillRect(W*xp - 30, H*0.038, 60, 18);

    // LED light bars inside housing
    for (let k = 0; k < 3; k++) {
      c.fillStyle = `rgba(255,${248-k*8},${200-k*20},${1.0-k*0.12})`;
      c.fillRect(W*xp - 26 + k*2, H*0.040 + k*4, 52 - k*4, 4);
    }
    // Bright core
    c.fillStyle = "#ffffff";
    c.fillRect(W*xp - 20, H*0.042, 40, 6);

    // Downward light cone
    const cone = c.createLinearGradient(0, H*0.06, 0, H*0.32);
    cone.addColorStop(0, "rgba(255,250,210,0.22)");
    cone.addColorStop(1, "rgba(255,240,180,0.00)");
    c.fillStyle = cone;
    c.beginPath();
    c.moveTo(W*xp - 12, H*0.06);
    c.lineTo(W*xp + 12, H*0.06);
    c.lineTo(W*xp + 80, H*0.32);
    c.lineTo(W*xp - 80, H*0.32);
    c.closePath();
    c.fill();
  });

  // ── Roof cantilever fascia ────────────────────────────────────────────────────
  const roofFascia = c.createLinearGradient(0, H*0.12, 0, H*0.18);
  roofFascia.addColorStop(0, "#060810");
  roofFascia.addColorStop(0.4, "#0c1022");
  roofFascia.addColorStop(1, "#141828");
  c.fillStyle = roofFascia;
  c.fillRect(0, H*0.12, W, H*0.06);
  // Fascia rivets / panel joints
  for (let i = 0; i < W; i += 56) {
    c.fillStyle = "rgba(255,255,255,0.07)";
    c.fillRect(i, H*0.122, 1, H*0.056);
  }
  c.fillStyle = "rgba(255,255,255,0.10)";
  c.fillRect(0, H*0.12, W, 1.5);

  // ── Crowd: three tiers rendered with individual person pixels ────────────────
  const teamId = teamKey ? TEAM_STADIUM[teamKey] : null;

  const SKINS: [number,number,number][] = [
    [220,185,145],[210,170,130],[200,160,120],[230,195,155],[190,150,110],[240,205,165],
  ];
  const NEUTRALS: [number,number,number][] = teamId
    ? teamId.neutral
    : [
        [175,175,175],[155,155,155],[195,195,195],[210,210,210],[135,135,140],
        [80,80,85],[100,100,105],[120,110,100],[145,130,115],[160,150,140],
        [50,55,65],[65,70,85],[200,200,195],[220,220,215],[90,85,80],
      ];
  // Generic match palette (fan lens)
  const GEN_HOME: [number,number,number][] = [[20,50,160],[18,45,150],[25,60,175],[15,42,145],[30,65,185],[22,55,165]];
  const GEN_AWAY: [number,number,number][] = [[160,10,20],[175,12,22],[150,8,18],[185,15,25],[165,10,20],[155,9,19]];
  const GEN_ACCENT: [number,number,number][] = [[240,240,240],[255,255,255],[240,200,40],[255,220,0],[200,200,200]];

  const pickColor = (xFrac: number, tierIdx: number): [number,number,number] => {
    const sectionBias = Math.sin(xFrac * Math.PI * 2.5 + tierIdx * 0.8);

    if (teamId) {
      // Supporter lens: stadium dominated by the team's colours
      // Slight thinning near vomitory gaps (concourse areas have fewer fans)
      const homeW   = teamId.bias + (sectionBias > 0.2 ? 0.06 : sectionBias < -0.2 ? -0.04 : 0);
      const accentW = 0.08 + (sectionBias < -0.25 ? 0.04 : 0);
      const r = rand();
      if (r < homeW)           return teamId.home  [rInt(teamId.home.length)];
      if (r < homeW + accentW) return teamId.accent[rInt(teamId.accent.length)];
      return NEUTRALS[rInt(NEUTRALS.length)];
    }

    // Fan lens / generic: mixed home + away distribution
    const homeW   = 0.18 + (sectionBias >  0.3 ? 0.14 : 0);
    const awayW   = 0.12 + (sectionBias < -0.3 ? 0.14 : 0);
    const accentW = 0.06;
    const r = rand();
    if (r < homeW)                  return GEN_HOME  [rInt(GEN_HOME.length)];
    if (r < homeW + awayW)          return GEN_AWAY  [rInt(GEN_AWAY.length)];
    if (r < homeW + awayW + accentW) return GEN_ACCENT[rInt(GEN_ACCENT.length)];
    return NEUTRALS[rInt(NEUTRALS.length)];
  };

  // Vomitory (tunnel) x-positions as fraction of W — dark vertical gaps
  const VOMITORY_X = [0.125, 0.250, 0.375, 0.500, 0.625, 0.750, 0.875];
  const nearVomitory = (xFrac: number) => VOMITORY_X.some(v => Math.abs(xFrac - v) < 0.010);

  // 3 tiers: upper (small, dark), middle, lower (large, bright)
  type TierDef = { y0: number; y1: number; pW: number; pH: number; baseBr: number; label: string };
  const TIERS: TierDef[] = [
    { y0: 0.18, y1: 0.44, pW: 3, pH:  8, baseBr: 0.42, label: "upper"  },
    { y0: 0.48, y1: 0.70, pW: 4, pH: 11, baseBr: 0.62, label: "middle" },
    { y0: 0.74, y1: 0.90, pW: 5, pH: 15, baseBr: 0.88, label: "lower"  },
  ];

  TIERS.forEach((tier, tIdx) => {
    const { y0, y1, pW, pH, baseBr } = tier;
    const py0 = H * y0, py1 = H * y1;
    const ROW_H = pH + 3;
    const numRows = Math.max(1, Math.floor((py1 - py0) / ROW_H));

    for (let row = 0; row < numRows; row++) {
      const rowFrac = row / numRows;
      const fy = py0 + row * ROW_H;

      // Row base background — seat plastic colour (dark blue/grey)
      c.fillStyle = row % 2 === 0 ? "#0d1020" : "#0a0e1a";
      c.fillRect(0, fy, W, ROW_H);

      // Concrete step edge shadow at top of each row
      c.fillStyle = "rgba(0,0,0,0.78)";
      c.fillRect(0, fy, W, 2);

      // Depth brightness: lower rows slightly brighter (closer to pitch lights)
      const depthMul = baseBr * (0.72 + rowFrac * 0.28 * (tIdx === 2 ? 1 : -0.5));

      let px = rand() * pW * 0.8;
      while (px < W) {
        const xFrac = px / W;

        // Vomitory gap
        if (nearVomitory(xFrac)) {
          c.fillStyle = "#020408";
          c.fillRect(Math.floor(px - 2), fy, pW * 3 + 4, ROW_H);
          px += pW * 4.5;
          continue;
        }

        // Occasional empty seat gap
        if (rand() < 0.07) { px += pW + 1; continue; }

        const [cr, cg, cb] = pickColor(xFrac, tIdx);

        // Floodlight proximity brightness boost
        let floodBoost = 0;
        FLOOD_XS.forEach(fxp => { floodBoost += Math.max(0, 0.28 - Math.abs(xFrac - fxp) * 3.5); });
        floodBoost = Math.min(0.32, floodBoost);

        const br = Math.min(1.0, depthMul + floodBoost + rRange(-0.06, 0.10));

        // Body rectangle
        c.fillStyle = `rgb(${Math.min(255,Math.floor(cr*br))},${Math.min(255,Math.floor(cg*br))},${Math.min(255,Math.floor(cb*br))})`;
        c.fillRect(Math.floor(px), Math.floor(fy + 3), pW, pH - 5);

        // Head circle — skin tone
        const skin = SKINS[rInt(SKINS.length)];
        const hBr  = Math.min(1.0, br + 0.18);
        c.fillStyle = `rgb(${Math.min(255,Math.floor(skin[0]*hBr))},${Math.min(255,Math.floor(skin[1]*hBr))},${Math.min(255,Math.floor(skin[2]*hBr))})`;
        c.fillRect(Math.floor(px + 0.5), Math.floor(fy + 1), pW - 1, 3);

        // Camera flash / phone screen (~1.2%)
        if (rand() < 0.012) {
          c.fillStyle = `rgba(255,255,255,${rRange(0.55, 0.95)})`;
          c.fillRect(Math.floor(px), Math.floor(fy + 1), pW, pH - 4);
        }

        px += pW + (rand() < 0.12 ? 2 : 1);
      }
    }

    // Tier walkway (concourse) band between tiers
    const concourse = c.createLinearGradient(0, H*y1, 0, H*(y1+0.04));
    concourse.addColorStop(0, "#131620");
    concourse.addColorStop(0.5, "#1c2030");
    concourse.addColorStop(1, "#141820");
    c.fillStyle = concourse;
    c.fillRect(0, H*y1, W, H*0.04);

    // Front railing bar
    c.fillStyle = "rgba(190,200,220,0.28)";
    c.fillRect(0, H*y1, W, 2);
    // Railing posts
    for (let rx = 0; rx < W; rx += 52) {
      c.fillStyle = "rgba(180,190,210,0.16)";
      c.fillRect(rx, H*y1, 1.5, H*0.04);
    }
    // Bottom railing bar
    c.fillStyle = "rgba(190,200,220,0.14)";
    c.fillRect(0, H*(y1 + 0.038), W, 1.5);
  });

  // ── LED Ribbon board ─────────────────────────────────────────────────────────
  const RIBBON_Y = H * 0.905;
  const RIBBON_H = H * 0.022;
  // Mounting bracket
  c.fillStyle = "#050810";
  c.fillRect(0, RIBBON_Y - 2, W, RIBBON_H + 4);
  // LED glow spill above
  const ribbonSpill = c.createLinearGradient(0, RIBBON_Y - RIBBON_H, 0, RIBBON_Y);
  ribbonSpill.addColorStop(0, "rgba(255,255,255,0)");
  ribbonSpill.addColorStop(1, "rgba(255,255,255,0.06)");
  c.fillStyle = ribbonSpill;
  c.fillRect(0, RIBBON_Y - RIBBON_H, W, RIBBON_H);

  const RIBBONS = teamId ? teamId.led : [
    { bg:"#c60b1e", fg:"#ffffff", text:"⚽ PITCHLENS" },
    { bg:"#003399", fg:"#ffffff", text:"IBM GRANITE AI" },
    { bg:"#f0c028", fg:"#000000", text:"STATSBOMB 360°" },
    { bg:"#ffffff", fg:"#003399", text:"FIFA WORLD CUP 2022" },
    { bg:"#c60b1e", fg:"#ffffff", text:"QATAR 2022" },
    { bg:"#000000", fg:"#f0c028", text:"⚽ PITCHLENS" },
    { bg:"#003399", fg:"#ffffff", text:"IBM GRANITE AI" },
    { bg:"#c60b1e", fg:"#ffffff", text:"STATSBOMB 360°" },
  ];
  const ribW = W / RIBBONS.length;
  c.font = `bold ${Math.floor(RIBBON_H * 0.56)}px 'Arial', sans-serif`;
  c.textBaseline = "middle";
  c.textAlign = "left";
  RIBBONS.forEach((r, i) => {
    // Panel glow
    c.fillStyle = r.bg;
    c.fillRect(i * ribW, RIBBON_Y, ribW - 1, RIBBON_H);
    // Inner bright highlight
    c.fillStyle = `rgba(255,255,255,0.08)`;
    c.fillRect(i * ribW, RIBBON_Y, ribW - 1, RIBBON_H * 0.4);
    // Text
    c.fillStyle = r.fg;
    c.fillText(r.text, i * ribW + 8, RIBBON_Y + RIBBON_H * 0.52);
    // Separator
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillRect(i * ribW, RIBBON_Y, 1.5, RIBBON_H);
  });

  // ── Pitch-side advertising boards ────────────────────────────────────────────
  const AD_Y = RIBBON_Y + RIBBON_H;
  const AD_H = H - AD_Y;
  const ADS = [
    { bg:"#003399", fg:"#ffffff", text:"FIFA WORLD CUP 2022 ★" },
    { bg:"#c60b1e", fg:"#ffffff", text:"QATAR 2022 ★" },
    { bg:"#050505", fg:"#f0c028", text:"PITCHLENS  •  AI Football" },
    { bg:"#003399", fg:"#ffffff", text:"IBM GRANITE" },
    { bg:"#c60b1e", fg:"#ffffff", text:"STATSBOMB 360°" },
    { bg:"#f0c028", fg:"#000000", text:"FIFA WORLD CUP 2022 ★" },
    { bg:"#003399", fg:"#ffffff", text:"QATAR 2022 ★" },
    { bg:"#c60b1e", fg:"#ffffff", text:"IBM GRANITE" },
  ];
  const adW = W / ADS.length;
  c.font = `bold ${Math.floor(AD_H * 0.46)}px 'Arial', sans-serif`;
  c.textBaseline = "middle";
  c.textAlign = "left";
  ADS.forEach((ad, i) => {
    c.fillStyle = ad.bg;
    c.fillRect(i * adW, AD_Y, adW - 1, AD_H);
    c.fillStyle = `rgba(255,255,255,0.07)`;
    c.fillRect(i * adW, AD_Y, adW - 1, AD_H * 0.45);
    c.fillStyle = ad.fg;
    c.fillText(ad.text, i * adW + 10, AD_Y + AD_H * 0.52);
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.fillRect(i * adW, AD_Y, 1.5, AD_H);
  });

  const tex = new THREE.CanvasTexture(cvs);
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

// ─── Referee (VAR room) dark analytical stadium texture ───────────────────────
function buildRefereeTexture(): THREE.CanvasTexture {
  const W = 2048, H = 1024;
  const cvs = document.createElement("canvas");
  cvs.width = W; cvs.height = H;
  const c = cvs.getContext("2d")!;

  c.fillStyle = "#01030a";
  c.fillRect(0, 0, W, H);

  const tiers = [
    { y: 0.10, h: 0.30, bright: 0.09 },
    { y: 0.42, h: 0.30, bright: 0.06 },
    { y: 0.74, h: 0.22, bright: 0.04 },
  ];
  tiers.forEach(({ y: ty, h: th, bright }) => {
    const yPx = ty * H, hPx = th * H;
    const grad = c.createLinearGradient(0, yPx, 0, yPx + hPx);
    grad.addColorStop(0, `rgba(${Math.round(bright*220)},${Math.round(bright*260)},${Math.round(bright*420)},1)`);
    grad.addColorStop(1, `rgba(${Math.round(bright*100)},${Math.round(bright*130)},${Math.round(bright*260)},1)`);
    c.fillStyle = grad;
    c.fillRect(0, yPx, W, hPx);
    for (let row = 0; row < hPx; row += 5) {
      c.fillStyle = `rgba(2,8,28,${0.20 + (row / hPx) * 0.10})`;
      c.fillRect(0, yPx + row, W, 2);
    }
    // cold blue tier separator
    c.fillStyle = "rgba(36,90,210,0.32)";
    c.fillRect(0, yPx, W, 1.5);
    c.fillStyle = "rgba(16,55,160,0.14)";
    c.fillRect(0, yPx + 1.5, W, 4);
  });

  // Vomitory tunnels
  [0.125, 0.250, 0.375, 0.500, 0.625, 0.750, 0.875].forEach(xf => {
    c.fillStyle = "rgba(0,0,0,0.96)";
    c.fillRect(W * xf - 11, H * 0.10, 22, H * 0.86);
  });

  // Horizontal scan-line pattern
  for (let y = 0; y < H; y += 3) {
    c.fillStyle = "rgba(0,8,32,0.08)";
    c.fillRect(0, y, W, 1);
  }

  // Pitch-light glow at base of lower tier
  const glow = c.createLinearGradient(0, H * 0.10, 0, H * 0.36);
  glow.addColorStop(0, "rgba(28,76,200,0.16)");
  glow.addColorStop(1, "rgba(4,16,70,0.0)");
  c.fillStyle = glow;
  c.fillRect(0, H * 0.10, W, H * 0.26);

  const tex = new THREE.CanvasTexture(cvs);
  tex.needsUpdate = true;
  return tex;
}

function VARRoomBackground() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    return buildRefereeTexture();
  }, []);

  return (
    <group>
      {/* Dark analytical bowl */}
      <mesh position={[0, 24, 0]}>
        <cylinderGeometry args={[118, 118, 142, 64, 1, true]} />
        <meshBasicMaterial map={texture ?? undefined} color={texture ? "#ffffff" : "#01030a"}
          side={THREE.BackSide} />
      </mesh>
      {/* Roof cap */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 95, 0]}>
        <circleGeometry args={[118, 64]} />
        <meshBasicMaterial color="#010206" />
      </mesh>
      {/* Ground apron */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.06, 0]}>
        <ringGeometry args={[44, 118, 64]} />
        <meshStandardMaterial color="#04060e" roughness={1} />
      </mesh>
      {/* Cold blue perimeter LED strip */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.12, 0]}>
        <ringGeometry args={[43.5, 44.5, 64]} />
        <meshBasicMaterial color="#1840a0" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── Tactical pitch zone grid for referee lens ─────────────────────────────────
function TacticalGrid() {
  const lines = useMemo((): [number,number,number][][] => {
    const ls: [number,number,number][][] = [];
    // Vertical thirds
    for (const x of [-20, 0, 20]) {
      ls.push([[x, 0.06, -42], [x, 0.06, 42]]);
    }
    // Horizontal 5-zone channels
    for (const z of [-13.5, -6.75, 0, 6.75, 13.5]) {
      ls.push([[-62, 0.06, z], [62, 0.06, z]]);
    }
    return ls;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#1a3a6a" lineWidth={0.9}
          transparent opacity={0.28} depthWrite={false} />
      ))}
    </>
  );
}

// ─── Supporter lens confetti system ───────────────────────────────────────────
const CONFETTI_COUNT = 160;
function ConfettiSystem({ teamKey }: { teamKey?: string }) {
  const teamId = teamKey ? TEAM_STADIUM[teamKey] : null;
  const meshA = useRef<THREE.InstancedMesh>(null);
  const meshB = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cntA  = Math.floor(CONFETTI_COUNT * 0.62);
  const cntB  = CONFETTI_COUNT - cntA;

  const particles = useMemo(() => Array.from({ length: CONFETTI_COUNT }, () => ({
    x     : (Math.random() - 0.5) * 92,
    startY: 16 + Math.random() * 32,
    z     : (Math.random() - 0.5) * 54,
    speed : 1.6 + Math.random() * 2.4,
    spin  : Math.random() * Math.PI * 2,
    phase : Math.random() * Math.PI * 2,
    wobble: 1.2 + Math.random() * 2.8,
  })), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const update = (ref: React.RefObject<THREE.InstancedMesh | null>, start: number, count: number) => {
      const m = ref.current; if (!m) return;
      for (let i = 0; i < count; i++) {
        const p = particles[start + i];
        const elapsed = (t * p.speed + p.phase * 8) % (p.startY + 12);
        const y = p.startY - elapsed;
        dummy.position.set(
          p.x + Math.sin(t * 0.65 + p.phase) * p.wobble,
          y,
          p.z + Math.cos(t * 0.48 + p.phase) * p.wobble * 0.6,
        );
        dummy.rotation.set(p.spin + t * 1.1, p.spin * 0.9 + t * 0.75, t * 0.35);
        dummy.scale.set(0.28, 0.44, 0.02);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    };
    update(meshA, 0, cntA);
    update(meshB, cntA, cntB);
  });

  const colA = teamId
    ? `rgb(${teamId.home[0][0]},${teamId.home[0][1]},${teamId.home[0][2]})`
    : "#f0c028";
  const colB = teamId
    ? `rgb(${teamId.accent[0][0]},${teamId.accent[0][1]},${teamId.accent[0][2]})`
    : "#ffffff";

  return (
    <>
      <instancedMesh ref={meshA} args={[undefined, undefined, cntA]}>
        <boxGeometry args={[1, 1, 0.02]} />
        <meshBasicMaterial color={colA} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={meshB} args={[undefined, undefined, cntB]}>
        <boxGeometry args={[1, 1, 0.02]} />
        <meshBasicMaterial color={colB} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

// The stadium cylinder — canvas texture on inside face
function StadiumBackground({ teamKey }: { teamKey?: string }) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    return buildStadiumTexture(teamKey);
  // teamKey is a stable string — safe as memo dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey]);

  const { gl } = useThree();

  useEffect(() => {
    if (texture) texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  }, [texture, gl]);

  if (!texture) return null;
  return (
    <group>
      {/* Primary crowd cylinder — camera always inside (top y=95 > max cam y=52) */}
      <mesh position={[0, 24, 0]}>
        <cylinderGeometry args={[118, 118, 142, 128, 1, true]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} />
      </mesh>
      {/* Dark roof plate above all cameras */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 95, 0]}>
        <circleGeometry args={[118, 128]} />
        <meshBasicMaterial color="#010208" />
      </mesh>
      {/* Ground apron — dark concrete ring between cylinder and pitch edge */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.06, 0]}>
        <ringGeometry args={[44, 118, 128]} />
        <meshStandardMaterial color="#10121a" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

// Floodlight banks — visible fixtures + actual lights
const FLOOD_POS: [number,number,number][] = [
  [-62, 38, -52], [-20, 42, -58], [20, 42, -58], [62, 38, -52],
  [-62, 38,  52], [-20, 42,  58], [20, 42,  58], [62, 38,  52],
  [-85, 34,   0], [ 85, 34,   0],
];
function StadiumFloodlights() {
  return (
    <>
      {FLOOD_POS.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <boxGeometry args={[6, 1.6, 2.4]} />
            <meshBasicMaterial color="#fffef0" toneMapped={false} />
          </mesh>
          <pointLight intensity={5.0} color="#fff8e8" distance={160} decay={1.4} />
        </group>
      ))}
    </>
  );
}

// Camera flashes from crowd
const FLASH_COUNT = 200;
function CrowdFlashes() {
  const meshRef   = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);
  const flashData = useMemo(() => Array.from({ length: FLASH_COUNT }, () => ({
    angle   : Math.random() * Math.PI * 2,
    r       : 50 + Math.random() * 45,
    h       : 1 + Math.random() * 28,
    phase   : Math.random() * 5,
    interval: 1.0 + Math.random() * 3.0,
  })), []);

  useFrame(({ clock }) => {
    const m = meshRef.current; if (!m) return;
    const t = clock.getElapsedTime();
    flashData.forEach((f, i) => {
      const cycle  = (t + f.phase) % f.interval;
      const active = cycle < 0.12;
      const sc     = active ? 0.4 + Math.random() * 0.5 : 0.001;
      dummy.position.set(Math.cos(f.angle) * f.r, f.h, Math.sin(f.angle) * f.r);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FLASH_COUNT]}>
      <sphereGeometry args={[0.8, 6, 4]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  );
}

// Perimeter ad boards at pitch level
function AdBoards() {
  const BH = 1.05; const BT = 0.20;
  const segs: { pos:[number,number,number]; size:[number,number,number]; col:string }[] = [];
  const TZ = 42; const GX = 62;
  const xSegs = [[-55,-35],[-33,-13],[-11,9],[11,31],[33,53]];
  const zSegs = [[-35,-15],[-13,7],[9,29],[31,51]];
  xSegs.forEach(([x0,x1],i) => {
    const xc=(x0+x1)/2, len=x1-x0;
    segs.push({ pos:[xc,BH/2, TZ], size:[len,BH,BT], col:i%2?"#1e3a8a":"#c8102e" });
    segs.push({ pos:[xc,BH/2,-TZ], size:[len,BH,BT], col:i%2?"#c8102e":"#1e3a8a" });
  });
  zSegs.forEach(([z0,z1],i) => {
    const zc=(z0+z1)/2, len=z1-z0;
    segs.push({ pos:[-GX,BH/2,zc], size:[BT,BH,len], col:i%2?"#1e3a8a":"#c8102e" });
    segs.push({ pos:[ GX,BH/2,zc], size:[BT,BH,len], col:i%2?"#c8102e":"#1e3a8a" });
  });
  return (
    <group>
      {segs.map((s,i) => (
        <mesh key={i} position={s.pos}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={s.col} roughness={0.35} metalness={0.15}
            emissive={s.col} emissiveIntensity={0.50} />
        </mesh>
      ))}
    </group>
  );
}

// Floodlight mast — visual marker for light sources
function FloodlightMast({ position }: { position: [number,number,number] }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[0.20, 0.30, 30, 6]} />
        <meshStandardMaterial color="#181c22" metalness={0.45} roughness={0.55} />
      </mesh>
      {/* Light bank */}
      <mesh position={[0, 30.5, 0]}>
        <boxGeometry args={[3.8, 0.7, 2.4]} />
        <meshStandardMaterial
          color="#c8c8b8"
          emissive="#fff8e8" emissiveIntensity={0.65}
          metalness={0.30} roughness={0.35}
        />
      </mesh>
    </group>
  );
}

function TacticalArena({
  fanMode: _, teamKey, lens,
}: { fanMode?: boolean; teamKey?: string; lens?: string }) {

  // ── REFEREE LENS — VAR Room / Tactical Command Center ─────────────────────
  if (lens === "referee") {
    return (
      <group>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.08, 0]}>
          <planeGeometry args={[260, 200]} />
          <meshStandardMaterial color="#02040c" roughness={1} />
        </mesh>
        <StadiumBackground />
        <StadiumFloodlights />
        <CrowdFlashes />
        <AdBoards />
        <TacticalGrid />
      </group>
    );
  }

  // ── SUPPORTER LENS — Emotional Memory Stadium ──────────────────────────────
  if (lens === "supporter") {
    const teamId = teamKey ? TEAM_STADIUM[teamKey] : null;
    const tc = teamId ? teamId.home[0] : [255, 200, 0];
    return (
      <group>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
          <planeGeometry args={[260, 200]} />
          <meshStandardMaterial color="#08060e" roughness={1} metalness={0} />
        </mesh>
        <StadiumBackground teamKey={teamKey} />
        <StadiumFloodlights />
        <CrowdFlashes />
        <AdBoards />
        {/* Team-colored atmospheric fill lights */}
        <pointLight position={[-55, 22,  0]} intensity={14}
          color={`rgb(${tc[0]},${tc[1]},${tc[2]})`} distance={180} decay={2} />
        <pointLight position={[ 55, 22,  0]} intensity={14}
          color={`rgb(${tc[0]},${tc[1]},${tc[2]})`} distance={180} decay={2} />
        <pointLight position={[  0, 22, -45]} intensity={10}
          color={`rgb(${tc[0]},${tc[1]},${tc[2]})`} distance={160} decay={2} />
        <pointLight position={[  0, 22,  45]} intensity={10}
          color={`rgb(${tc[0]},${tc[1]},${tc[2]})`} distance={160} decay={2} />
        <ConfettiSystem teamKey={teamKey} />
      </group>
    );
  }

  // ── FAN LENS — Live Broadcast ──────────────────────────────────────────────
  return (
    <group>
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <planeGeometry args={[260, 200]} />
        <meshStandardMaterial color="#111318" roughness={1} metalness={0} />
      </mesh>
      <StadiumBackground />
      <StadiumFloodlights />
      <CrowdFlashes />
      <AdBoards />
    </group>
  );
}

// ─── Visible area ─────────────────────────────────────────────────────────────

function VisibleAreaMesh({ va, opacity }: { va: number[]; opacity: number }) {
  const geo = useMemo(() => {
    if (va.length < 6) return null;
    const shape = new THREE.Shape();
    const [x0, z0] = sb2xz(va[0], va[1]);
    shape.moveTo(x0, z0);
    for (let i = 1; i < va.length / 2; i++) {
      const [x, z] = sb2xz(va[i*2], va[i*2+1]);
      shape.lineTo(x, z);
    }
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    return g;
  }, [va]);

  if (!geo || opacity < 0.005) return null;
  return (
    <mesh geometry={geo} position={[0, 0.04, 0]}>
      <meshBasicMaterial color="#88bbff" transparent opacity={0.07 * opacity}
        side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function VisibleAreaOutline({ va, opacity }: { va: number[]; opacity: number }) {
  const pts = useMemo((): [number,number,number][] => {
    if (va.length < 6) return [];
    const p: [number,number,number][] = [];
    for (let i = 0; i < va.length / 2; i++) {
      const [x,z] = sb2xz(va[i*2], va[i*2+1]);
      p.push([x, 0.05, z]);
    }
    const [x0,z0] = sb2xz(va[0], va[1]);
    p.push([x0, 0.05, z0]);
    return p;
  }, [va]);

  if (pts.length < 3 || opacity < 0.005) return null;
  return <Line points={pts} color="#aaccff" lineWidth={0.5} transparent opacity={0.35 * opacity} />;
}

// ─── Actor enhancements ───────────────────────────────────────────────────────

function PulsingActorRings({ eventType }: { eventType: string }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const strong = /shot|duel|pressure/i.test(eventType);

  useFrame(({ clock }) => {
    const t     = clock.getElapsedTime();
    const speed = strong ? 2.4 : 1.7;
    if (r1.current) {
      const s = 1 + (strong ? 0.22 : 0.15) * Math.sin(t * speed);
      r1.current.scale.set(s, 1, s);
      (r1.current.material as THREE.MeshBasicMaterial).opacity =
        (strong ? 0.50 : 0.32) + 0.20 * Math.sin(t * speed);
    }
    if (r2.current) {
      const s = 1 + 0.12 * Math.sin(t * speed + Math.PI / 2);
      r2.current.scale.set(s, 1, s);
      (r2.current.material as THREE.MeshBasicMaterial).opacity =
        (strong ? 0.22 : 0.14) + 0.10 * Math.sin(t * speed + Math.PI / 2);
    }
  });

  return (
    <>
      <mesh ref={r1} rotation={[-Math.PI/2,0,0]} position={[0,0.07,0]}>
        <ringGeometry args={[2.8, 3.9, 52]} />
        <meshBasicMaterial color="#f0c028" transparent opacity={0.35}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={r2} rotation={[-Math.PI/2,0,0]} position={[0,0.05,0]}>
        <ringGeometry args={[4.6, 6.0, 52]} />
        <meshBasicMaterial color="#f0c028" transparent opacity={0.14}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  );
}

function ActorBeam({ eventType, opacity }: { eventType: string; opacity: number }) {
  const ref    = useRef<THREE.Mesh>(null);
  const isShot = /shot/i.test(eventType);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t    = clock.getElapsedTime();
    const base = isShot ? 0.22 : 0.09;
    const amp  = isShot ? 0.10 : 0.05;
    (ref.current.material as THREE.MeshBasicMaterial).opacity =
      opacity * (base + amp * Math.sin(t * (isShot ? 2.8 : 1.8)));
  });
  const h = isShot ? 20 : 14;
  return (
    <mesh ref={ref} position={[0, h / 2, 0]}>
      <cylinderGeometry args={[0.045, 0.28, h, 8]} />
      <meshBasicMaterial color="#f0c028" transparent opacity={0.09} />
    </mesh>
  );
}

// ─── Player shapes ────────────────────────────────────────────────────────────

interface PlayerShapeProps {
  teammate          : boolean;
  actor             : boolean;
  keeper            : boolean;
  opacity           : number;
  playerName?       : string;
  eventType?        : string;
  onActorDoubleClick?: () => void;
  fanMode?          : boolean;
}

function PlayerShape({
  teammate, actor, keeper, opacity,
  playerName, eventType, onActorDoubleClick, fanMode,
}: PlayerShapeProps) {

  // ── Fan mode: Subbuteo-style figurine on base disc ───────────────────────────
  if (fanMode) {
    // Jersey / shorts / ring colours
    const jerseyColor = keeper
      ? "#22c55e"
      : actor   ? "#f5c518"
      : teammate ? "#3b82f6"
      : "#ef4444";
    const jerseyEmit  = actor ? "#9a7200" : "#000000";
    const shortsColor = keeper
      ? "#15803d"
      : actor   ? "#111827"
      : teammate ? "#1e3a8a"
      : "#7f1d1d";
    const ringColor   = actor ? "#f5c518" : teammate ? "#3b82f6" : "#ef4444";
    const headColor   = "#c8906a";
    const legColor    = shortsColor;

    return (
      <group>
        {/* ── Base platform: white disc + team ring ── */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 0]}>
          <circleGeometry args={[1.05, 36]} />
          <meshStandardMaterial color="#f0f0f0" roughness={0.5} metalness={0.05}
            transparent opacity={opacity} />
        </mesh>
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[1.05, 1.38, 36]} />
          <meshStandardMaterial color={ringColor} roughness={0.4}
            emissive={ringColor} emissiveIntensity={0.55}
            transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        {/* ── Ground shadow ── */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[1.55, 32]} />
          <meshBasicMaterial color="#000" transparent opacity={0.32 * opacity}
            depthWrite={false} />
        </mesh>

        {/* ── Left leg ── */}
        <mesh position={[-0.19, 0.50, 0.05]} castShadow
          onDoubleClick={actor ? (e)=>{ e.stopPropagation(); onActorDoubleClick?.(); } : undefined}>
          <cylinderGeometry args={[0.12, 0.14, 0.76, 8]} />
          <meshStandardMaterial color={legColor} roughness={0.88} transparent opacity={opacity} />
        </mesh>

        {/* ── Right leg ── */}
        <mesh position={[0.19, 0.50, 0.05]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.76, 8]} />
          <meshStandardMaterial color={legColor} roughness={0.88} transparent opacity={opacity} />
        </mesh>

        {/* ── Torso / jersey ── */}
        <mesh position={[0, 1.24, 0]} castShadow
          onDoubleClick={actor ? (e)=>{ e.stopPropagation(); onActorDoubleClick?.(); } : undefined}>
          <cylinderGeometry args={[0.34, 0.28, 0.80, 12]} />
          <meshStandardMaterial color={jerseyColor}
            emissive={jerseyEmit} emissiveIntensity={actor ? 0.45 : 0}
            roughness={0.72} transparent opacity={opacity} />
        </mesh>

        {/* ── Shoulders / arms stub ── */}
        <mesh position={[0, 1.48, 0]} rotation={[0, 0, Math.PI/2]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.80, 8]} />
          <meshStandardMaterial color={jerseyColor} roughness={0.72} transparent opacity={opacity} />
        </mesh>

        {/* ── Neck ── */}
        <mesh position={[0, 1.72, 0]} castShadow>
          <cylinderGeometry args={[0.10, 0.12, 0.18, 8]} />
          <meshStandardMaterial color={headColor} roughness={0.88} transparent opacity={opacity} />
        </mesh>

        {/* ── Head ── */}
        <mesh position={[0, 1.98, 0]} castShadow>
          <sphereGeometry args={[0.30, 12, 10]} />
          <meshStandardMaterial color={headColor} roughness={0.85} transparent opacity={opacity} />
        </mesh>

        {/* ── Actor: pulsing base rings + beam ── */}
        {actor && <PulsingActorRings eventType={eventType ?? ""} />}
        {actor && <ActorBeam eventType={eventType ?? ""} opacity={opacity} />}

        {/* ── Actor name badge ── */}
        {actor && playerName && opacity > 0.5 && (
          <Html position={[0, 3.8, 0]} center distanceFactor={32} style={{ pointerEvents:"none" }}>
            <div style={{
              fontFamily   :"'Barlow Condensed', sans-serif",
              fontSize     :"13px", fontWeight:900, letterSpacing:"0.11em",
              color        :"#f5c518",
              textShadow   :"0 1px 10px rgba(0,0,0,0.95)",
              background   :"rgba(5,7,14,0.88)",
              padding      :"3px 10px", borderRadius:"4px",
              border       :"1px solid rgba(245,197,24,0.45)",
              whiteSpace   :"nowrap",
            }}>
              {playerName.split(" ").pop()?.toUpperCase()}
            </div>
          </Html>
        )}

        {/* ── Keeper crown marker ── */}
        {keeper && (
          <mesh position={[0, 2.42, 0]}>
            <cylinderGeometry args={[0.22, 0.16, 0.20, 6]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.80 * opacity} />
          </mesh>
        )}
      </group>
    );
  }

  const mat = useMemo(() => {
    if (actor)    return { color:"#f0c028", emissive:"#d97706", emissiveIntensity:1.2 };
    if (teammate) return { color:"#3b82f6", emissive:"#1e3a8a", emissiveIntensity:0.9 };
    return           { color:"#ef4444", emissive:"#7f1d1d", emissiveIntensity:0.9 };
  }, [actor, teammate]);

  if (keeper) {
    const kc = teammate
      ? { color:"#60a5fa", emissive:"#1d4ed8", emissiveIntensity:0.8 }
      : { color:"#f87171", emissive:"#b91c1c", emissiveIntensity:0.8 };
    return (
      <group>
        <mesh position={[0,1.2,0]} castShadow>
          <octahedronGeometry args={[1.0,0]} />
          <meshStandardMaterial {...kc} transparent opacity={opacity} />
        </mesh>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.04,0]}>
          <ringGeometry args={[0.8,1.2,24]} />
          <meshBasicMaterial color={kc.color} transparent opacity={0.25*opacity}
            side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  if (actor) {
    const et = eventType ?? "";
    return (
      <group>
        {/* Main cylinder — double-click to focus */}
        <mesh position={[0,0.9,0]} castShadow
          onDoubleClick={(e) => { e.stopPropagation(); onActorDoubleClick?.(); }}>
          <cylinderGeometry args={[0.9,0.9,1.8,24]} />
          <meshStandardMaterial {...mat} transparent opacity={opacity} />
        </mesh>
        {/* Top cap */}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,1.81,0]}>
          <circleGeometry args={[0.9,24]} />
          <meshBasicMaterial color="#ffe580" transparent opacity={0.90*opacity} />
        </mesh>
        {/* Inner ground rings */}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.04,0]}>
          <ringGeometry args={[1.3,2.1,40]} />
          <meshBasicMaterial color="#f0c028" transparent opacity={0.45*opacity}
            side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.03,0]}>
          <ringGeometry args={[0.95,1.25,40]} />
          <meshBasicMaterial color="#ffe580" transparent opacity={0.30*opacity}
            side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {/* Pulsing outer rings */}
        <PulsingActorRings eventType={et} />
        {/* Vertical beam */}
        <ActorBeam eventType={et} opacity={opacity} />
        {/* Floating player label */}
        {playerName && opacity > 0.6 && (
          <Html position={[0, 5.4, 0]} center distanceFactor={32}
            occlude={false} style={{ pointerEvents:"none" }}>
            <div style={{
              fontFamily   : "'Barlow Condensed', 'Helvetica Neue', sans-serif",
              fontSize     : "12px",
              fontWeight   : 900,
              color        : "#f0c028",
              letterSpacing: "0.14em",
              textShadow   : "0 1px 8px rgba(0,0,0,0.90)",
              background   : "rgba(7,9,15,0.72)",
              padding      : "2px 8px",
              borderRadius : "3px",
              border       : "1px solid rgba(240,192,40,0.28)",
              whiteSpace   : "nowrap",
            }}>
              {playerName.toUpperCase()}
            </div>
          </Html>
        )}
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0,0.65,0]} castShadow>
        <cylinderGeometry args={[0.75,0.75,1.3,20]} />
        <meshStandardMaterial {...mat} transparent opacity={opacity} />
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,1.31,0]}>
        <circleGeometry args={[0.75,20]} />
        <meshBasicMaterial color={teammate?"#93c5fd":"#fca5a5"} transparent opacity={0.70*opacity} />
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <circleGeometry args={[0.8,20]} />
        <meshBasicMaterial color={teammate?"#3b82f6":"#ef4444"} transparent
          opacity={0.18*opacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Player POV overlays ──────────────────────────────────────────────────────

function PovOverlays({
  players,
  povPlayerIdx,
}: {
  players      : DisplayedPlayer[];
  povPlayerIdx : number;
}) {
  const pov = players[povPlayerIdx];
  if (!pov) return null;

  const [px, pz] = sb2xz(pov.x, pov.y);

  // Collect nearby teammates for passing lanes (max 8, within 28 pitch units)
  const lanes: { tx: number; tz: number; open: boolean }[] = [];
  for (let i = 0; i < players.length && lanes.length < 8; i++) {
    const p = players[i];
    if (i === povPlayerIdx || (!p.teammate && !p.actor) || p.opacity < 0.1) continue;
    const [tx, tz] = sb2xz(p.x, p.y);
    const dist = Math.sqrt((tx - px) ** 2 + (tz - pz) ** 2);
    if (dist > 28 || dist < 0.5) continue;
    // Lane blocked? check if any opponent is within 3.5 units of midpoint
    const mx = (px + tx) / 2, mz = (pz + tz) / 2;
    const blocked = players.some(opp => {
      if (opp.teammate || opp.actor || opp.opacity < 0.1) return false;
      const [ox, oz] = sb2xz(opp.x, opp.y);
      return Math.sqrt((ox - mx) ** 2 + (oz - mz) ** 2) < 3.5;
    });
    lanes.push({ tx, tz, open: !blocked });
  }

  // Nearby opponents for pressure rings (within 10 units)
  const pressures: { ox: number; oz: number; dist: number }[] = [];
  for (const p of players) {
    if (p.teammate || p.actor || p.opacity < 0.1) continue;
    const [ox, oz] = sb2xz(p.x, p.y);
    const dist = Math.sqrt((ox - px) ** 2 + (oz - pz) ** 2);
    if (dist < 10) pressures.push({ ox, oz, dist });
  }

  const underPressure = pressures.some(p => p.dist < 4.5);

  return (
    <group renderOrder={10}>
      {/* Selected player — bright white ring */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[px, 0.07, pz]} renderOrder={11}>
        <ringGeometry args={[1.9, 2.4, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.90} depthWrite={false} />
      </mesh>

      {/* Under-pressure red pulse ring */}
      {underPressure && (
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[px, 0.09, pz]} renderOrder={12}>
          <ringGeometry args={[2.6, 3.2, 40]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      )}

      {/* Passing lane lines */}
      {lanes.map(({ tx, tz, open }, i) => (
        <group key={i}>
          <Line
            points={[[px, 0.14, pz], [tx, 0.14, tz]]}
            color={open ? "#22d3ee" : "#f97316"}
            lineWidth={open ? 2.5 : 1.8}
            transparent
            opacity={open ? 0.72 : 0.42}
            dashed={!open}
            dashSize={1.8}
            gapSize={1.2}
          />
          {/* Lane-end dot */}
          <mesh rotation={[-Math.PI/2, 0, 0]} position={[tx, 0.10, tz]} renderOrder={11}>
            <circleGeometry args={[open ? 0.65 : 0.50, 16]} />
            <meshBasicMaterial
              color={open ? "#22d3ee" : "#f97316"}
              transparent opacity={open ? 0.60 : 0.38}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Pressure zones — nearby opponents */}
      {pressures.map(({ ox, oz, dist }, i) => {
        const r = Math.max(1.8, 4.0 - dist * 0.25);
        return (
          <mesh key={i} rotation={[-Math.PI/2, 0, 0]} position={[ox, 0.06, oz]} renderOrder={10}>
            <circleGeometry args={[r, 24]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.16} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

const MAX_POOL = 30;

function PlayerPool({
  players, playerName, eventType, onActorDoubleClick, fanMode, onPlayerClick,
}: {
  players            : DisplayedPlayer[];
  playerName         : string;
  eventType          : string;
  onActorDoubleClick?: () => void;
  fanMode?           : boolean;
  onPlayerClick?     : (idx: number) => void;
}) {
  return (
    <>
      {Array.from({ length: MAX_POOL }, (_, i) => {
        const p = players[i];
        if (!p || p.opacity < 0.01) return <group key={i} />;
        const [wx, wz] = sb2xz(p.x, p.y);
        return (
          <group key={i} position={[wx, 0, wz]}>
            {/* AO shadow under every player */}
            <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.001,0]} scale={[1.1,0.75,1]}>
              <circleGeometry args={[1.0, 16]} />
              <meshBasicMaterial color="#000" transparent opacity={0.38 * p.opacity} depthWrite={false} />
            </mesh>
            <PlayerShape
              teammate={p.teammate} actor={p.actor} keeper={p.keeper} opacity={p.opacity}
              playerName={p.actor ? playerName : undefined}
              eventType={p.actor ? eventType : undefined}
              onActorDoubleClick={p.actor ? onActorDoubleClick : undefined}
              fanMode={fanMode}
            />
            {/* Invisible click-target disk — enters POV on single click */}
            {onPlayerClick && (
              <mesh
                rotation={[-Math.PI/2, 0, 0]}
                position={[0, 0.08, 0]}
                onClick={(e) => { e.stopPropagation(); onPlayerClick(i); }}
              >
                <circleGeometry args={[2.2, 12]} />
                <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

// ─── Broadcast-quality event arrows + Football ────────────────────────────────

// Animated football that bobs slightly
function Football3D({ position }: { position: [number,number,number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = position[1] + 0.35 + Math.sin(clock.getElapsedTime() * 2.8) * 0.08;
      ref.current.rotation.y = clock.getElapsedTime() * 1.2;
    }
  });
  return (
    <group ref={ref} position={position}>
      {/* Glow disc on ground */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.28,0]}>
        <circleGeometry args={[0.65,24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {/* Shadow */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.34,0]}>
        <circleGeometry args={[0.45,24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.38} depthWrite={false} />
      </mesh>
      {/* Ball body */}
      <mesh>
        <sphereGeometry args={[0.38, 20, 14]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.35} metalness={0.05}
          emissive="#ffffff" emissiveIntensity={0.18} />
      </mesh>
      {/* Pentagon patches */}
      {[0,72,144,216,288].map(deg => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.sin(rad)*0.30, 0.20, Math.cos(rad)*0.20]}>
            <dodecahedronGeometry args={[0.09, 0]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.60} />
          </mesh>
        );
      })}
    </group>
  );
}

// Dashed line for carry — drawn as many short segments
function DashedLine({ from, to, color, lineWidth }: {
  from: [number,number]; to: [number,number]; color: string; lineWidth: number;
}) {
  const pts = useMemo(() => {
    const [x1,z1] = from, [x2,z2] = to;
    const SEGMENTS = 14;
    const result: [number,number,number][][] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const t0 = i / SEGMENTS;
      const t1 = (i + 0.55) / SEGMENTS;
      result.push([
        [x1+(x2-x1)*t0, 0.22, z1+(z2-z1)*t0],
        [x1+(x2-x1)*t1, 0.22, z1+(z2-z1)*t1],
      ]);
    }
    return result;
  }, [from, to]);
  return (
    <>
      {pts.map((p, i) => (
        <Line key={i} points={p} color={color} lineWidth={lineWidth} transparent opacity={0.85} />
      ))}
    </>
  );
}

// Arrowhead cone pointing along direction from→to at the endpoint
function ArrowHead({ from, to, color, scale = 1 }: {
  from: [number,number]; to: [number,number]; color: string; scale?: number;
}) {
  const { pos, quat } = useMemo(() => {
    const [x1,z1] = from, [x2,z2] = to;
    const dir = new THREE.Vector3(x2-x1, 0, z2-z1).normalize();
    const q   = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
    return { pos: [x2, 0.22, z2] as [number,number,number], quat: q };
  }, [from, to]);
  return (
    <mesh position={pos} quaternion={quat}>
      <coneGeometry args={[0.32 * scale, 0.80 * scale, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} />
    </mesh>
  );
}

// Wide semi-transparent glow line (broadcast-style thick arrow body)
function GlowLine({ from, to, color, opacity = 0.50, lineWidth = 3.5 }: {
  from: [number,number]; to: [number,number]; color: string; opacity?: number; lineWidth?: number;
}) {
  const [x1,z1] = from, [x2,z2] = to;
  const short: [number,number] = [x2 - (x2-x1)*0.12, z2 - (z2-z1)*0.12]; // stop before arrowhead
  return (
    <Line
      points={[[x1,0.20,z1],[short[0],0.20,short[1]]]}
      color={color} lineWidth={lineWidth} transparent opacity={opacity}
    />
  );
}

function EventTrajectory({ eventType, scene }: { eventType:string; scene:DisplayedScene }) {
  const et    = eventType.toLowerCase();
  const actor = scene.players.find(p => p.actor && p.opacity > 0.55);
  if (!actor) return null;
  const [ax, az] = sb2xz(actor.x, actor.y);

  // PASS — solid bright-blue arrow toward nearest teammate
  if (et.includes("pass")) {
    const tms = scene.players
      .filter(p => p.teammate && !p.actor && p.opacity > 0.40)
      .sort((a,b) => Math.hypot(a.x-actor.x,a.y-actor.y) - Math.hypot(b.x-actor.x,b.y-actor.y));
    if (!tms.length) return null;
    const [rx,rz] = sb2xz(tms[0].x, tms[0].y);
    const from: [number,number] = [ax, az];
    const to  : [number,number] = [rx, rz];
    return (
      <>
        {/* Glow halo */}
        <GlowLine from={from} to={to} color="#60a5fa" opacity={0.18} lineWidth={9} />
        {/* Main line */}
        <GlowLine from={from} to={to} color="#93c5fd" opacity={0.90} lineWidth={3.2} />
        {/* Arrowhead */}
        <ArrowHead from={from} to={to} color="#60a5fa" />
        {/* Ball at actor */}
        <Football3D position={[ax, 0, az]} />
      </>
    );
  }

  // SHOT — gold/orange bold arrow toward goal, wider
  if (et.includes("shot")) {
    const goalSbX = (120 - actor.x) < actor.x ? 120 : 0;
    const [gx,gz] = sb2xz(goalSbX, 40);
    const from: [number,number] = [ax, az];
    const to  : [number,number] = [gx, gz];
    return (
      <>
        <GlowLine from={from} to={to} color="#f0c028" opacity={0.22} lineWidth={12} />
        <GlowLine from={from} to={to} color="#fcd34d" opacity={0.95} lineWidth={4.5} />
        <ArrowHead from={from} to={to} color="#f59e0b" scale={1.25} />
        <Football3D position={[ax, 0, az]} />
      </>
    );
  }

  // CARRY — dashed yellow-green arrow, direction estimated toward nearest forward space
  if (et.includes("carry")) {
    // direction: actor → second-nearest teammate or away from goal
    const tms = scene.players
      .filter(p => p.teammate && !p.actor && p.opacity > 0.40)
      .sort((a,b) => Math.hypot(a.x-actor.x,a.y-actor.y) - Math.hypot(b.x-actor.x,b.y-actor.y));
    // Carry for ~8–12m in the direction of play (toward opponent's goal half)
    const dirX = actor.x < 60 ? 1 : -1;
    const dirZ = tms.length ? (tms[0].y - actor.y) * 0.25 : 0;
    const CARRY_LEN = 10;
    const ex = ax + dirX * CARRY_LEN;
    const ez = az + dirZ;
    const from: [number,number] = [ax, az];
    const to  : [number,number] = [ex, ez];
    return (
      <>
        {/* Subtle glow behind dashes */}
        <GlowLine from={from} to={to} color="#a3e635" opacity={0.12} lineWidth={8} />
        {/* Dashed carry trail */}
        <DashedLine from={from} to={to} color="#d4fa50" lineWidth={3.0} />
        {/* Arrowhead */}
        <ArrowHead from={from} to={to} color="#bef264" />
        {/* Ball at actor */}
        <Football3D position={[ax, 0, az]} />
      </>
    );
  }

  // DUEL / TACKLE / BLOCK — red clash line
  if (/duel|tackle|block|foul/.test(et)) {
    const ops = scene.players
      .filter(p => !p.teammate && !p.actor && p.opacity > 0.40)
      .sort((a,b) => Math.hypot(a.x-actor.x,a.y-actor.y) - Math.hypot(b.x-actor.x,b.y-actor.y));
    if (!ops.length) return (
      <Football3D position={[ax, 0, az]} />
    );
    const [ox,oz] = sb2xz(ops[0].x, ops[0].y);
    return (
      <>
        <GlowLine from={[ax,az]} to={[ox,oz]} color="#ef4444" opacity={0.60} lineWidth={3.0} />
        <Football3D position={[ax, 0, az]} />
      </>
    );
  }

  // PRESSURE / INTERCEPTION — orange lines to nearby opponents
  if (/pressure|interception/.test(et)) {
    const ops = scene.players
      .filter(p => !p.teammate && !p.actor && p.opacity > 0.40)
      .sort((a,b) => Math.hypot(a.x-actor.x,a.y-actor.y) - Math.hypot(b.x-actor.x,b.y-actor.y))
      .slice(0, 2);
    return (
      <>
        {ops.map((p, i) => {
          const [ox,oz] = sb2xz(p.x, p.y);
          return <Line key={i} points={[[ax,0.22,az],[ox,0.22,oz]]}
            color="#f97316" lineWidth={2.0} transparent opacity={0.50} />;
        })}
        <Football3D position={[ax, 0, az]} />
      </>
    );
  }

  // Default — just the ball
  return <Football3D position={[ax, 0, az]} />;
}

// ─── Event marker (ring at location) ─────────────────────────────────────────

function EventMarker({ location }: { location:[number,number] }) {
  const ringRef  = useRef<THREE.Mesh>(null);
  const [wx,wz] = sb2xz(location[0], location[1]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + 0.10 * Math.sin(t * 2.2);
      ringRef.current.scale.set(s, 1, s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.38 + 0.16 * Math.sin(t * 2.2);
    }
  });
  return (
    <group position={[wx, 0, wz]}>
      <mesh ref={ringRef} rotation={[-Math.PI/2,0,0]} position={[0,0.05,0]}>
        <ringGeometry args={[2.0,2.6,40]} />
        <meshBasicMaterial color="#f0c028" transparent opacity={0.38}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────

interface SceneProps {
  scene              : DisplayedScene;
  cameraMode         : CameraMode;
  playerName         : string;
  eventType          : string;
  onActorDoubleClick?: () => void;
  onOrbitReady?      : (controls: any) => void;
  fanMode?           : boolean;
  povPlayerIdx       : number | null;
  onPlayerClick?     : (idx: number) => void;
  povAzimuth         : number;
  supporterTeam?     : string;
  lens?              : string;
  panMode?           : boolean;
}

function Scene({
  scene, cameraMode, playerName, eventType, onActorDoubleClick, onOrbitReady, fanMode,
  povPlayerIdx, onPlayerClick, povAzimuth, supporterTeam, lens, panMode,
}: SceneProps) {
  const orbitRef = useRef<any>(null);

  const isReferee  = lens === "referee";
  const isSupporter = lens === "supporter";
  const teamId = (isSupporter && supporterTeam) ? TEAM_STADIUM[supporterTeam] : null;
  const tc = teamId ? teamId.home[0] : [255, 200, 40];

  const bg       = isReferee ? "#010306" : isSupporter ? "#040210" : "#071020";
  const fogNear  = isReferee ? 80 : 120;
  const fogFar   = isReferee ? 200 : 320;

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, fogNear, fogFar]} />

      {/* ── Referee: VAR room — cold, clinical, high-contrast ───────────────── */}
      {isReferee && (
        <>
          <ambientLight intensity={0.05} color="#a8c4f0" />
          {/* Single overhead cold key — interrogation-room feel */}
          <directionalLight position={[0, 88, 0]} intensity={3.8} color="#d0e8ff"
            castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
            shadow-camera-left={-75} shadow-camera-right={75}
            shadow-camera-top={52}  shadow-camera-bottom={-52}
            shadow-bias={-0.0005}
          />
          {/* Narrow lateral fills — cold blue, low intensity */}
          <directionalLight position={[-52, 50, 0]} intensity={0.32} color="#6888c0" />
          <directionalLight position={[ 52, 50, 0]} intensity={0.32} color="#6888c0" />
          <hemisphereLight args={["#0c1e44", "#010308", 0.12]} />
        </>
      )}

      {/* ── Fan: broadcast warmth — sky sports / CBS sports ─────────────────── */}
      {!isReferee && !isSupporter && (
        <>
          <ambientLight intensity={0.14} color="#c8d4f0" />
          <directionalLight position={[8, 72, 38]} intensity={2.10} color="#fefdf8"
            castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
            shadow-camera-left={-75} shadow-camera-right={75}
            shadow-camera-top={52}  shadow-camera-bottom={-52}
            shadow-bias={-0.0005}
          />
          <directionalLight position={[-64, 44, -50]} intensity={1.55} color="#fff6e8" />
          <directionalLight position={[ 64, 44, -50]} intensity={1.55} color="#fff6e8" />
          <directionalLight position={[-64, 40,  50]} intensity={1.20} color="#fff2e0" />
          <directionalLight position={[ 64, 40,  50]} intensity={1.20} color="#fff2e0" />
          <directionalLight position={[  0, 52, -80]} intensity={0.80} color="#fff8f2" />
          <directionalLight position={[  0, 52,  80]} intensity={0.75} color="#fff8f2" />
          <directionalLight position={[-82, 34,   0]} intensity={0.50} color="#fff4ec" />
          <directionalLight position={[ 82, 34,   0]} intensity={0.50} color="#fff4ec" />
          <hemisphereLight args={["#2c4470", "#050505", 0.22]} />
        </>
      )}

      {/* ── Supporter: theatrical + team-tinted dramatic atmosphere ─────────── */}
      {isSupporter && (
        <>
          <ambientLight intensity={0.09} color="#c0b0f0" />
          <directionalLight position={[8, 72, 38]} intensity={2.50} color="#fff0ff"
            castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
            shadow-camera-left={-75} shadow-camera-right={75}
            shadow-camera-top={52}  shadow-camera-bottom={-52}
            shadow-bias={-0.0005}
          />
          <directionalLight position={[-64, 44, -50]} intensity={1.40} color="#fff0f8" />
          <directionalLight position={[ 64, 44, -50]} intensity={1.40} color="#fff0f8" />
          <directionalLight position={[-64, 40,  50]} intensity={1.00} color="#fff0f8" />
          <directionalLight position={[ 64, 40,  50]} intensity={1.00} color="#fff0f8" />
          {/* Team-coloured directional wash from above */}
          <directionalLight position={[0, 35, 0]} intensity={0.70}
            color={`rgb(${tc[0]},${tc[1]},${tc[2]})`} />
          <hemisphereLight args={["#1a0638", "#050508", 0.28]} />
        </>
      )}

      {/* Geometry */}
      <TacticalArena fanMode={fanMode} teamKey={supporterTeam} lens={lens} />
      <PitchGround fanMode={fanMode} />
      <PitchMarkings />
      <Goal x={-60} />
      <Goal x={60} />

      <VisibleAreaMesh va={scene.va}     opacity={scene.vaOpacity} />
      <VisibleAreaMesh va={scene.vaNext} opacity={scene.vaNextOpacity} />
      <VisibleAreaOutline va={scene.va}     opacity={scene.vaOpacity} />
      <VisibleAreaOutline va={scene.vaNext} opacity={scene.vaNextOpacity} />

      <EventTrajectory eventType={eventType} scene={scene} />
      <PlayerPool
        players={scene.players} playerName={playerName} eventType={eventType}
        onActorDoubleClick={onActorDoubleClick} fanMode={fanMode}
        onPlayerClick={onPlayerClick}
      />
      {cameraMode === "pov" && povPlayerIdx != null && (
        <PovOverlays players={scene.players} povPlayerIdx={povPlayerIdx} />
      )}
      <EventMarker location={scene.location} />

      <CameraController
        mode={cameraMode} scene={scene} orbitRef={orbitRef}
        onOrbitReady={onOrbitReady}
        povPlayerIdx={povPlayerIdx}
        povAzimuth={povAzimuth}
      />

      <OrbitControls
        ref={orbitRef}
        enablePan enableZoom enableRotate
        maxPolarAngle={Math.PI / 2.05}
        minDistance={14} maxDistance={180}
        panSpeed={panMode ? 1.4 : 0.7} zoomSpeed={1.1} rotateSpeed={panMode ? 0 : 0.65}
        mouseButtons={panMode
          ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
          : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={panMode
          ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
          : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface TacticalWorldProps {
  scene              : DisplayedScene;
  cameraMode         : CameraMode;
  playerName         : string;
  eventType          : string;
  onActorDoubleClick?: () => void;
  fanMode?           : boolean;
  povPlayerIdx       : number | null;
  onPlayerClick?     : (idx: number) => void;
  povAzimuth         : number;
  supporterTeam?     : string;
  lens?              : string;
  panMode?           : boolean;
}

export default function TacticalWorld({
  scene, cameraMode, playerName, eventType, onActorDoubleClick, fanMode,
  povPlayerIdx, onPlayerClick, povAzimuth, supporterTeam, lens, panMode,
}: TacticalWorldProps) {
  const handleOrbitReady = useCallback((_c: any) => {}, []);

  // Tone mapping per lens: referee = high-contrast dark, supporter = dramatic, fan = broadcast
  const exposure = lens === "referee" ? 0.70 : lens === "supporter" ? 0.84 : 0.88;

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{
        antialias          : true,
        toneMapping        : THREE.ACESFilmicToneMapping,
        toneMappingExposure: exposure,
      }}
      style={{ width:"100%", height:"100%", display:"block" }}
    >
      <Scene
        scene={scene} cameraMode={cameraMode}
        playerName={playerName} eventType={eventType}
        onActorDoubleClick={onActorDoubleClick}
        onOrbitReady={handleOrbitReady}
        fanMode={fanMode}
        povPlayerIdx={povPlayerIdx}
        onPlayerClick={onPlayerClick}
        povAzimuth={povAzimuth}
        supporterTeam={supporterTeam}
        lens={lens}
        panMode={panMode}
      />
    </Canvas>
  );
}
