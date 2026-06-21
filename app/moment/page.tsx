import { getMomentData, getMatchEvents, getConsequenceChain } from "@/lib/getMomentData";
import { MATCH_META } from "@/lib/matchData";
import MomentViewer from "@/components/MomentViewer";

const DEFAULT_MATCH  = "germany_japan";
const DEFAULT_MINUTE = 18;
const DEFAULT_PLAYER = "Takefusa Kubo";

type SearchParams = Promise<{
  matchId?: string; minute?: string; player?: string;
  type?: string; team?: string; lens?: string;
}>;

export default async function MomentPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const matchKey = (sp.matchId ?? DEFAULT_MATCH).replace(/-/g, "_");
  const minute   = parseInt(sp.minute ?? String(DEFAULT_MINUTE), 10);
  const player   = sp.player ?? DEFAULT_PLAYER;
  const team     = sp.team   ?? "";
  const lens     = sp.lens === "fan" ? "fan" : sp.lens === "referee" ? "referee" : sp.lens === "supporter" ? "supporter" : "tactical";

  const moment = getMomentData(matchKey, minute, player, "");

  if (!moment) {
    return (
      <div style={{
        minHeight: "100vh", background: "#07090f", color: "#e8e8e8",
        fontFamily: "'Barlow Condensed', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 16,
      }}>
        <div style={{ fontSize: "2rem", fontWeight: 900, color: "rgba(255,255,255,0.20)" }}>
          NO DATA FOUND
        </div>
        <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.35)" }}>
          {player} · {minute}′ · {matchKey}
        </div>
      </div>
    );
  }

  const allEvents  = getMatchEvents(matchKey);
  const currentIdx = allEvents.findIndex(e => e.event_uuid === moment.event_uuid);
  const chain      = getConsequenceChain(matchKey, moment.event_uuid, 5);

  // Normalise key: dataset uses underscores, registry uses hyphens
  const metaKey = matchKey.replace(/_/g, "-");
  const matchMeta = MATCH_META[metaKey] ?? null;

  return (
    <MomentViewer
      moment={moment}
      matchKey={matchKey}
      team={team}
      allEvents={allEvents}
      currentIdx={currentIdx === -1 ? 0 : currentIdx}
      chain={chain}
      lens={lens as "fan" | "referee" | "tactical" | "supporter"}
      matchMeta={matchMeta}
    />
  );
}
