"use client";
import { useState, useEffect } from "react";

export default function FullscreenButton() {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <button
      onClick={toggle}
      title={isFs ? "Exit fullscreen" : "Enter fullscreen"}
      style={{
        position: "fixed", bottom: 18, right: 18, zIndex: 9999,
        width: 36, height: 36, borderRadius: 4,
        background: "rgba(10,12,20,0.82)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.14)",
        cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", padding: 0, transition: "border-color 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.38)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)")}
    >
      {isFs ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2" strokeLinecap="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
          <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2" strokeLinecap="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
      )}
    </button>
  );
}
