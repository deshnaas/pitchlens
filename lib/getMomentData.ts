// Server-only utility — reads pitchlens_master_dataset.json via fs.
// Do NOT import this in client components.

import fs   from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FreezeFramePlayer {
  teammate : boolean;
  actor    : boolean;
  keeper   : boolean;
  location : [number, number];
}

export interface MomentData {
  event_uuid   : string;
  event_type   : string;
  minute       : number;
  second       : number;
  team         : string;
  player       : string;
  location     : [number, number];
  freeze_frame : FreezeFramePlayer[];
  visible_area : number[];
}

// ─── Dataset loader (cached after first read) ─────────────────────────────────

type RawEvent = {
  event_uuid   : string;
  event_type   : string;
  minute       : number;
  second       : number;
  team         : string;
  player       : string;
  location     : [number, number];
  freeze_frame : { teammate: boolean; actor: boolean; keeper: boolean; location: [number, number] }[];
  visible_area : number[];
};

type Dataset = Record<string, RawEvent[]>;

let _cache: Dataset | null = null;

function loadDataset(): Dataset {
  if (_cache) return _cache;

  // Absolute path to the master dataset — adjust if moved
  const filePath = path.join("C:\\Users\\spdes\\open-data", "pitchlens_master_dataset.json");

  const raw  = fs.readFileSync(filePath, "utf-8");
  _cache     = JSON.parse(raw) as Dataset;
  return _cache;
}

// ─── getMomentData ────────────────────────────────────────────────────────────
// Tolerant matching:
//   matchKey  — exact (case-sensitive key, e.g. "germany_japan")
//   minute    — exact number
//   player    — case-insensitive substring
//   eventType — case-insensitive substring

export function getMomentData(
  matchKey  : string,
  minute    : number,
  player    : string,
  eventType : string = ""   // empty = match any event type
): MomentData | null {
  // Normalise: "germany-japan" → "germany_japan"
  const key     = matchKey.replace(/-/g, "_");
  const dataset = loadDataset();
  const events  = dataset[key];

  if (!events) {
    console.warn(`[getMomentData] matchKey not found: "${key}"`);
    return null;
  }

  const playerLower = player.toLowerCase();
  const typeLower   = eventType.toLowerCase();

  // 1. Exact: same minute + player substring + event type
  let hit = events.find(ev =>
    ev.minute === minute &&
    ev.player?.toLowerCase().includes(playerLower) &&
    (typeLower === "" || ev.event_type?.toLowerCase().includes(typeLower))
  );

  // 2. Same minute, any player (substitution / no-player events)
  if (!hit && minute > 0) {
    hit = events.find(ev => ev.minute === minute);
  }

  // 3. Nearest minute with player match (within ±3 min)
  if (!hit && playerLower) {
    for (let delta = 1; delta <= 3 && !hit; delta++) {
      hit = events.find(ev =>
        Math.abs(ev.minute - minute) === delta &&
        ev.player?.toLowerCase().includes(playerLower)
      );
    }
  }

  // 4. First event in match — always return something from the right match
  if (!hit) hit = events[0];

  if (!hit) return null;

  return {
    event_uuid   : hit.event_uuid,
    event_type   : hit.event_type,
    minute       : hit.minute,
    second       : hit.second,
    team         : hit.team,
    player       : hit.player,
    location     : hit.location,
    freeze_frame : hit.freeze_frame ?? [],
    visible_area : hit.visible_area ?? [],
  };
}

// ─── listMatchKeys ─────────────────────────────────────────────────────────────

export function listMatchKeys(): string[] {
  return Object.keys(loadDataset());
}

// ─── getEventsAt ───────────────────────────────────────────────────────────────

export function getEventsAt(matchKey: string, minute: number): RawEvent[] {
  const key     = matchKey.replace(/-/g, "_");
  const dataset = loadDataset();
  return (dataset[key] ?? []).filter(ev => ev.minute === minute);
}

// ─── getMatchEvents ────────────────────────────────────────────────────────────
// All events with freeze frame data, sorted by time — used for prev/next nav.

export interface EventNav {
  event_uuid : string;
  minute     : number;
  second     : number;
  event_type : string;
  player     : string;
  team       : string;
}

export function getMatchEvents(matchKey: string): EventNav[] {
  const key     = matchKey.replace(/-/g, "_");
  const dataset = loadDataset();
  return (dataset[key] ?? [])
    .filter(ev => ev.freeze_frame && ev.freeze_frame.length > 0)
    .sort((a, b) => a.minute !== b.minute ? a.minute - b.minute : a.second - b.second)
    .map(ev => ({
      event_uuid : ev.event_uuid,
      minute     : ev.minute,
      second     : ev.second,
      event_type : ev.event_type,
      player     : ev.player ?? "",
      team       : ev.team,
    }));
}

// ─── getMomentByUuid ──────────────────────────────────────────────────────────
// Unambiguous lookup by event UUID — used by the client-side navigation API.

export function getMomentByUuid(matchKey: string, uuid: string): MomentData | null {
  const key     = matchKey.replace(/-/g, "_");
  const dataset = loadDataset();
  const events  = dataset[key] ?? [];
  const hit     = events.find(ev => ev.event_uuid === uuid);
  if (!hit) return null;
  return {
    event_uuid   : hit.event_uuid,
    event_type   : hit.event_type,
    minute       : hit.minute,
    second       : hit.second,
    team         : hit.team,
    player       : hit.player ?? "",
    location     : hit.location,
    freeze_frame : hit.freeze_frame ?? [],
    visible_area : hit.visible_area ?? [],
  };
}

// ─── getConsequenceChain ───────────────────────────────────────────────────────
// Returns a window of real StatsBomb events around the given event UUID.
// Includes all event types (not just freeze-frame ones).

export interface ChainEvent {
  event_uuid      : string;
  minute          : number;
  second          : number;
  event_type      : string;
  player          : string;
  team            : string;
  has_freeze_frame: boolean;
  is_current      : boolean;
}

export function getConsequenceChain(
  matchKey    : string,
  currentUuid : string,
  window      : number = 5   // events before and after
): ChainEvent[] {
  const key     = matchKey.replace(/-/g, "_");
  const dataset = loadDataset();
  const all     = (dataset[key] ?? [])
    .sort((a, b) => a.minute !== b.minute ? a.minute - b.minute : a.second - b.second);

  const idx = all.findIndex(ev => ev.event_uuid === currentUuid);
  if (idx === -1) return [];

  const start = Math.max(0, idx - window);
  const end   = Math.min(all.length - 1, idx + window);

  return all.slice(start, end + 1).map(ev => ({
    event_uuid      : ev.event_uuid,
    minute          : ev.minute,
    second          : ev.second,
    event_type      : ev.event_type,
    player          : ev.player ?? "",
    team            : ev.team,
    has_freeze_frame: !!(ev.freeze_frame && ev.freeze_frame.length > 0),
    is_current      : ev.event_uuid === currentUuid,
  }));
}
