/** Crystal and Crystal Legacy journeys, as kept in the browser. */
import type { Pokemon } from "../engine";
import type { JourneySummary } from "../game/storage";
import type { SoundSetting } from "../game/audio";
import type { Facing } from "./world";

export type CrystalAdventure = "crystal" | "crystal-legacy";

/** A Pokémon as the adventure keeps it: an Egg until it hatches. */
export type CrystalMon = Pokemon & { egg?: boolean; /** Steps left before an Egg hatches, in 256s. */ eggCycles?: number };

export interface CrystalSave {
  version: 1;
  adventure: CrystalAdventure;
  name: string;
  /** 0 boy, 1 girl. */
  gender: 0 | 1;
  rival: string;
  mom: string;
  playerId: number;
  map: [number, number];
  x: number;
  y: number;
  facing: Facing;
  money: number;
  momMoney: number;
  coins: number;
  /** Set event flags (EVENT_*). */
  events: number[];
  /** Set engine flags (ENGINE_*). */
  flags: number[];
  /** Scene ids, by "group:number". */
  scenes: Record<string, number>;
  /** Bytes scripts read and write by address. */
  ram: Record<string, number>;
  /** Bag, by item id. */
  items: Record<string, number>;
  /** The player's PC. */
  pcItems: Record<string, number>;
  party: CrystalMon[];
  /** Bill's PC: 14 boxes. */
  boxes: CrystalMon[][];
  box: number;
  seen: number[];
  caught: number[];
  unownDex: number[];
  unlockedUnowns: number;
  /** The Day-Care: its two Pokémon, the levels they were left at, the steps to the next Egg roll and a waiting Egg. */
  daycare: { mons: (CrystalMon | undefined)[]; egg: boolean; steps: number; lady?: boolean; levels?: (number | undefined)[]; eggMon?: CrystalMon };
  phone: number[];
  specialCall: number;
  repel: number;
  noWild: boolean;
  /** Where a blackout or Escape Rope leads (blackoutmod). */
  spawn: { group: number; number: number };
  backupWarp?: { warp: number; group: number; number: number };
  /** The last outdoor map, for Dig, Escape Rope and Fly's home. */
  lastOutdoor: [number, number];
  state: "normal" | "bike" | "surf";
  variableSprites: number[];
  /** Fly destinations visited, by ENGINE_FLYPOINT_* flag. */
  steps: number;
  seconds: number;
  /** The date daily events last reset (YYYY-MM-DD). */
  day: string;
  swarm?: { kind: number; group: number; number: number };
  roamers?: { species: number; level: number; group: number; number: number; hp?: number }[];
  hallOfFame: { party: { species: number; level: number; nickname: string; dvs: number[] }[]; time: number }[];
  settings: { music?: SoundSetting; battleSpeed: number; swapGamepadAB?: boolean; movement?: "free" | "grid"; textSpeed?: number };
  contest?: { balls: number; minutes: number; started: number; caught?: CrystalMon; party?: CrystalMon[] };
  /** Mail and misc. state that doesn't fit elsewhere. */
  vars: Record<string, number>;
}

export function freshCrystalSave(adventure: CrystalAdventure, name: string, gender: 0 | 1, rival: string): CrystalSave {
  return {
    version: 1, adventure, name, gender, rival, mom: "MOM", playerId: Math.floor(Math.random() * 65536),
    map: [0, 0], x: 0, y: 0, facing: "down", money: 3000, momMoney: 0, coins: 0,
    events: [], flags: [], scenes: {}, ram: {}, items: {}, pcItems: {}, party: [], boxes: Array.from({ length: 14 }, () => []), box: 0,
    seen: [], caught: [], unownDex: [], unlockedUnowns: 0, daycare: { mons: [], egg: false, steps: 0 }, phone: [], specialCall: 0,
    repel: 0, noWild: false, spawn: { group: 0, number: 0 }, lastOutdoor: [0, 0], state: "normal", variableSprites: Array(16).fill(0),
    steps: 0, seconds: 0, day: "", hallOfFame: [], settings: { battleSpeed: 1 }, vars: {},
  };
}

const int = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
export function isCrystalSave(data: unknown, adventure: CrystalAdventure): data is CrystalSave {
  const s = data as CrystalSave;
  return !!s && typeof s === "object" && s.version === 1 && s.adventure === adventure && typeof s.name === "string" &&
    Array.isArray(s.map) && int(s.x, 0, 255) && int(s.y, 0, 255) && Array.isArray(s.party) && Array.isArray(s.events) &&
    Array.isArray(s.boxes) && typeof s.items === "object";
}

export function crystalSummary(save: CrystalSave, place: string): JourneySummary {
  const badges = save.vars.badgeCount ?? 0;
  const lead = save.party.find(m => !m.egg);
  return {
    place, badges, caught: save.caught.length, player: save.name,
    ...(lead && { lead: { species: lead.species, dvs: [...lead.dvs] } }),
  };
}
