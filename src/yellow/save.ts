import type { Pokemon } from "../engine";
import type { JourneySummary } from "../game/storage";
import { HS, MAP } from "./generated/symbols";
import type { YellowRom } from "./rom";
import type { Facing } from "./world";

export interface YellowSave {
  adventure: "yellow";
  version: 1;
  name: string;
  rival: string;
  map: number;
  x: number;
  y: number;
  facing: Facing;
  /** The town or route the player last left, for exits to the "last map" and indoor colors. */
  lastMap: number;
  /** Where a blackout returns the player (the last Pokémon Center's town). */
  blackout: number;
  /** Event flag indexes that are set. */
  events: number[];
  /** Toggleable object (HS_*) indexes that are hidden. */
  hidden: number[];
  /** Persistent script state, keyed by name. */
  vars: Record<string, number>;
  party: Pokemon[];
  storage: Pokemon[];
  /** Bag and PC items by Gen 1 item id. */
  items: Record<string, number>;
  pcItems: Record<string, number>;
  money: number;
  coins: number;
  /** Badge bits, Boulder = 1. */
  badges: number;
  /** National Pokédex numbers. */
  seen: number[];
  caught: number[];
  pikachu: { happiness: number; mood: number };
  /** Towns registered for Fly. */
  visited: number[];
  steps: number;
  seconds: number;
  bike?: boolean;
  surfing?: boolean;
  repel?: number;
  safari?: { steps: number; balls: number };
  /** The Route 5 Day-Care: the Pokémon left there and the steps walked since. */
  daycare?: { mon: Pokemon; steps: number };
  settings: { battleSpeed: number; music?: boolean; swapGamepadAB?: boolean };
}

export function freshYellowSave(rom: YellowRom, name: string, rival: string): YellowSave {
  const hidden = rom.missables().flatMap((m, i) => m.shown ? [] : [i]);
  return {
    adventure: "yellow",
    version: 1,
    name,
    rival,
    map: MAP.REDS_HOUSE_2F,
    x: 3,
    y: 6,
    facing: "up",
    lastMap: MAP.PALLET_TOWN,
    blackout: MAP.PALLET_TOWN,
    events: [],
    hidden,
    vars: {},
    party: [],
    storage: [],
    items: {},
    pcItems: { "20": 1 }, // Yellow's PC starts with a Potion.
    money: 3000,
    coins: 0,
    badges: 0,
    seen: [],
    caught: [],
    pikachu: { happiness: 90, mood: 0x80 },
    visited: [MAP.PALLET_TOWN],
    steps: 0,
    seconds: 0,
    settings: { battleSpeed: 1, music: true },
  };
}

const int = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const ints = (v: unknown, min: number, max: number) => Array.isArray(v) && v.every(x => int(x, min, max));
const counts = (v: unknown) => !!v && typeof v === "object" &&
  Object.entries(v as Record<string, unknown>).every(([k, n]) => /^\d{1,3}$/.test(k) && +k <= 255 && int(n, 0, 999));

export function isYellowSave(data: unknown): data is YellowSave {
  const s = data as YellowSave;
  return !!s && typeof s === "object" && s.adventure === "yellow" && s.version === 1 &&
    typeof s.name === "string" && s.name.length <= 10 && typeof s.rival === "string" && s.rival.length <= 10 &&
    int(s.map, 0, 255) && int(s.x, -1, 255) && int(s.y, -1, 255) && ["down", "up", "left", "right"].includes(s.facing) &&
    int(s.lastMap, 0, 255) && int(s.blackout, 0, 255) && ints(s.events, 0, 4095) && ints(s.hidden, 0, Object.keys(HS).length) &&
    !!s.vars && typeof s.vars === "object" && Object.values(s.vars).every(v => typeof v === "number") &&
    Array.isArray(s.party) && s.party.length <= 6 && Array.isArray(s.storage) &&
    counts(s.items) && counts(s.pcItems) && int(s.money, 0, 999999) && int(s.coins, 0, 9999) && int(s.badges, 0, 255) &&
    ints(s.seen, 1, 251) && ints(s.caught, 1, 251) && !!s.pikachu && int(s.pikachu.happiness, 0, 255) &&
    ints(s.visited, 0, 255) && int(s.steps, 0, Number.MAX_SAFE_INTEGER) && typeof s.seconds === "number" && s.seconds >= 0 && Number.isFinite(s.seconds) &&
    !!s.settings && int(s.settings.battleSpeed, 1, 3);
}

export function yellowSummary(save: YellowSave, place: (map: number) => string): JourneySummary {
  const lead = save.party[0];
  let badges = 0;
  for (let b = save.badges; b; b &= b - 1) badges++;
  return {
    place: place(save.map),
    badges,
    caught: save.caught.length,
    player: save.name,
    ...(lead && { lead: { species: lead.species, dvs: [...lead.dvs] } }),
  };
}
