"use client";

import { useRouter } from "next/navigation";
import { IncidentEngine } from "@/components/incident/IncidentEngine";
import { offside001 } from "@/lib/incidents/offside-001";
import CinematicCursor from "@/components/CinematicCursor";

export default function RefereePage() {
  const router = useRouter();
  return (
    <>
      <CinematicCursor />
      <IncidentEngine
        incident={offside001}
        pov="referee"
        onBack={() => router.push("/?portals=true")}
      />
    </>
  );
}
