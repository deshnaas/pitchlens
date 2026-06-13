"use client";

/**
 * TitleReveal — V2
 *
 * Title is PERMANENT. It never disappears.
 *
 * Behavior:
 *   progress 0.00 – 0.35 : title not yet visible
 *   progress 0.35 – 0.58 : characters blur-in left to right (staggered)
 *   progress 0.58 – 0.72 : title at full prominence, center screen
 *   progress 0.72 – 0.92 : title shrinks + rises toward top — always visible
 *   progress 0.92 – 1.00 : settled in top position, minimal but present
 *
 * Apple model: branding always present. Never abandoned.
 */

interface Props {
  progress: number;
  parallax: { x: number; y: number };
}

// Smooth remap — clamps p into [inMin,inMax] then maps to [outMin,outMax]
function remap(p: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (p - inMin) / (inMax - inMin)));
  // Ease in-out cubic
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  return outMin + eased * (outMax - outMin);
}

const CHARS = "PITCHLENS".split("");

export default function TitleReveal({ progress, parallax }: Props) {
  // How far along the "shrink to top" phase we are
  const shrink = remap(progress, 0.72, 0.92, 0, 1);

  // Y offset: 0 (center) → -38vh (near top)
  const translateY = shrink * -38; // vh units

  // Scale: 1.0 (full size) → 0.42 (small but readable)
  const scale = 1 - shrink * 0.58;

  // Opacity: fades slightly when shrinking but NEVER below 0.5
  const masterOpacity = Math.max(
    0.5,
    remap(progress, 0.35, 0.52, 0, 1) - shrink * 0.42
  );

  // Subtitle behavior: fades in then shrinks away as portals come
  const subtitleOpacity = remap(progress, 0.58, 0.70, 0, 0.72) * (1 - shrink * 0.9);

  // Subtle parallax — less movement than background
  const px = parallax.x * -3;
  const py = parallax.y * -2.5;

  // Scroll hint — visible only before user scrolls, gone quickly
  const hintOpacity = remap(progress, 0.04, 0.14, 1, 0);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 50 }}
    >
      {/* ── PITCHLENS + subtitle wrapper ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translate(${px}px, calc(${translateY}vh + ${py}px)) scale(${scale})`,
          opacity: masterOpacity,
          transformOrigin: "center center",
          // No CSS transition — driven frame-by-frame via scroll progress
          willChange: "transform, opacity",
        }}
      >
        {/* Characters — each reveals individually based on scroll progress */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.08em" }}>
          {CHARS.map((char, i) => {
            // Stagger: each char starts revealing slightly after the previous
            const charOpacity = remap(progress, 0.36 + i * 0.009, 0.53 + i * 0.005, 0, 1);
            const charBlur = (1 - charOpacity) * 7;
            const charY = (1 - charOpacity) * 16;

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontSize: "clamp(2.6rem, 6.5vw, 6rem)",
                  letterSpacing: "0.34em",
                  fontFamily: "var(--font-inter), sans-serif",
                  fontWeight: 300,
                  color: "white",
                  opacity: charOpacity,
                  filter: `blur(${charBlur}px)`,
                  transform: `translateY(${charY}px)`,
                  userSelect: "none",
                  willChange: "opacity, transform, filter",
                }}
              >
                {char}
              </span>
            );
          })}
        </div>

        {/* Light sweep — plays once as title fully reveals */}
        {progress >= 0.52 && progress <= 0.75 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "-5%",
              width: "110%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.07) 60%, transparent 100%)",
              pointerEvents: "none",
              // Animate via CSS animation triggered once
              animation: "lightSweep 1.3s cubic-bezier(0.4,0,0.2,1) 0.1s forwards",
              opacity: progress > 0.68 ? 0 : 1,
              transition: "opacity 0.4s ease",
            }}
          />
        )}

        {/* ONE MATCH. THREE REALITIES. */}
        <p
          style={{
            fontSize: "clamp(0.55rem, 1vw, 0.85rem)",
            letterSpacing: "0.44em",
            fontWeight: 300,
            fontFamily: "var(--font-inter), sans-serif",
            textTransform: "uppercase",
            color: "white",
            opacity: subtitleOpacity,
            marginTop: "1rem",
            filter: `blur(${remap(progress, 0.58, 0.68, 2, 0)}px)`,
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          ONE MATCH.&nbsp;&nbsp;&nbsp;THREE REALITIES.
        </p>
      </div>

      {/* ── Scroll to begin hint ── */}
      <div
        style={{
          position: "absolute",
          bottom: "7vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          opacity: hintOpacity,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: "0.5rem",
            letterSpacing: "0.32em",
            color: "rgba(255,255,255,0.4)",
            fontFamily: "var(--font-inter)",
            fontWeight: 300,
            textTransform: "uppercase",
          }}
        >
          Scroll to begin
        </span>
        <div
          style={{
            width: "1px",
            height: "32px",
            background: "linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)",
            animation: "scrollPulse 1.8s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes lightSweep {
          from { transform: translateX(-110%); }
          to   { transform: translateX(110%); }
        }
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.4; transform: scaleY(1); }
          50%       { opacity: 0.9; transform: scaleY(1.15); }
        }
      `}</style>
    </div>
  );
}
