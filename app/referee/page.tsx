"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IncidentEngine } from "@/components/incident/IncidentEngine";
import MatchSelectionScreen from "@/components/MatchSelectionScreen";
import { offside001 } from "@/lib/incidents/offside-001";
import CinematicCursor from "@/components/CinematicCursor";

export default function RefereePage() {
  const router = useRouter();
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Match selection → incident investigation
  // All matches currently load offside001; future: map matchId → incident data
  if (!selectedMatchId) {
    return (
      <>
        <CinematicCursor />
        <MatchSelectionScreen
          pov="referee"
          onSelect={id => setSelectedMatchId(id)}
          onBack={() => router.push("/?portals=true")}
        />
      </>
    );
  }

  return (
    <>
      <CinematicCursor />
      <IncidentEngine
        incident={offside001}
        pov="referee"
        onBack={() => setSelectedMatchId(null)}
      />
    </>
  );
}
