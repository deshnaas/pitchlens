"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const VIDEOS = [
  "/videos/v1-awakening.mp4",
  "/videos/v2-aerial.mp4",
  "/videos/v3-descent.mp4",
  "/videos/v4-ball.mp4",
];

interface VideoSequenceProps {
  onPhaseChange: (phase: number) => void;
  onComplete: () => void;
}

export default function VideoSequence({ onPhaseChange, onComplete }: VideoSequenceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [nextSrc, setNextSrc] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);
  const completedRef = useRef(false);

  // Preload all videos
  useEffect(() => {
    VIDEOS.forEach((src) => {
      const v = document.createElement("video");
      v.src = src;
      v.preload = "auto";
      v.muted = true;
    });
  }, []);

  const advanceToNext = useCallback(() => {
    const next = currentIndex + 1;

    if (next >= VIDEOS.length) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
      return;
    }

    setNextSrc(VIDEOS[next]);
    setTransitioning(true);

    setTimeout(() => {
      setShowNext(true);
    }, 50);

    setTimeout(() => {
      setCurrentIndex(next);
      setShowNext(false);
      setNextSrc(null);
      setTransitioning(false);
      onPhaseChange(next);

      if (nextVideoRef.current) {
        nextVideoRef.current.play().catch(() => {});
      }
    }, 600);
  }, [currentIndex, onPhaseChange, onComplete]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = VIDEOS[currentIndex];
    video.load();
    video.play().catch(() => {});

    const handleEnded = () => {
      if (currentIndex < VIDEOS.length - 1) {
        advanceToNext();
      } else {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }
    };

    video.addEventListener("ended", handleEnded);
    return () => video.removeEventListener("ended", handleEnded);
  }, [currentIndex, advanceToNext, onComplete]);

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Primary video */}
      <motion.video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        muted
        playsInline
        animate={{ opacity: transitioning ? 0 : 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />

      {/* Next video crossfade */}
      <AnimatePresence>
        {nextSrc && (
          <motion.video
            ref={nextVideoRef}
            key={nextSrc}
            src={nextSrc}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            autoPlay
            initial={{ opacity: 0 }}
            animate={{ opacity: showNext ? 1 : 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
