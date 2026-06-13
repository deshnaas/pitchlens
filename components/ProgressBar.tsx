"use client";

interface Props {
  progress: number;
}

export default function ProgressBar({ progress }: Props) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{ zIndex: 60, height: "1px", background: "rgba(255,255,255,0.06)" }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          background: "rgba(255,255,255,0.35)",
          transition: "width 0.05s linear",
        }}
      />
    </div>
  );
}
