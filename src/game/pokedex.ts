import { WORLD, type Requirement, type WorldMap } from "../world";
import { fieldHabitats } from "./badges";
import type { Save } from "./save";

export const dexFilters = ["All", "Seen", "Caught", "Missing", "Local"] as const;
export type DexFilter = typeof dexFilters[number];
const allSpecies = Array.from({ length: 251 }, (_, index) => index + 1);

export function fishingPool(map: WorldMap, isWaterType: (id: number) => boolean, save: Pick<Save, "badges" | "abilities">) {
  const pool = fieldHabitats(map, save).filter(entry => isWaterType(entry.species));
  return pool.length ? pool : [{ species: 129, minLevel: 10 }];
}

type HabitatRecord = {
  map: WorldMap;
  method: string;
  level: string;
  note: string;
};

function guardianHint(requirement?: Requirement) {
  if (requirement?.ability) {
    const ability = requirement.ability.replace(/[A-Z]/g, letter => " " + letter).replace(/^./, letter => letter.toUpperCase());
    return `Requires ${ability}`;
  }
  if (requirement?.caught) return `Register ${requirement.caught} caught`;
  if (requirement?.flags?.includes("aurora_restored")) return "League clear + restored sanctuary";
  if (requirement?.flags?.includes("champion")) return "After the Astral League";
  return "Fixed encounter";
}

export function buildDex(save: Pick<Save, "map" | "visited" | "flags" | "seen" | "caught" | "badges" | "abilities">,
  isWaterType: (id: number) => boolean) {
  const seen = new Set(save.seen);
  const caught = new Set(save.caught);
  const habitats = new Map<number, HabitatRecord[]>();
  const priority = (map: WorldMap) => map.id === save.map ? 0 : save.visited.includes(map.id) ? 1 : 2;
  const maps = Object.values(WORLD).sort((a, b) => priority(a) - priority(b));
  for (const map of maps) {
    function add(id: number, method: string, level: string, note: string) {
      const records = habitats.get(id) ?? [];
      records.push({ map, method, level, note });
      habitats.set(id, records);
    }
    const total = map.encounters.reduce((sum, entry) => sum + entry.weight, 0);
    for (const entry of fieldHabitats(map, save)) {
      const range = entry.minLevel === entry.maxLevel ? String(entry.minLevel) : `${entry.minLevel}–${entry.maxLevel}`;
      add(entry.species, "Tall grass", range, `${Math.round(entry.weight / total * 100)}% of encounters`);
    }
    if (map.tiles.some(row => row.includes("~"))) {
      const pool = fishingPool(map, isWaterType, save);
      for (const fish of pool) {
        add(fish.species, "Fishing", String(fish.minLevel), save.flags.includes("quest_angler_complete")
          ? `${Math.round(100 / pool.length)}% of bites` : "Complete the angler’s request");
      }
    }
    for (const object of map.objects) {
      const guardian = object.kind === "legendary" && object.trainer?.team[0];
      const collected = object.setsFlag && save.flags.includes(object.setsFlag);
      if (guardian) {
        add(guardian.species, "Guardian", String(guardian.level),
          collected ? "Already captured" : guardianHint(object.requires));
      }
      if (object.reward?.species) {
        add(object.reward.species, "Gift", String(object.reward.level ?? 5),
          collected ? "Gift received" : `From ${object.name}`);
      }
    }
  }
  const local = allSpecies.filter(id => habitats.get(id)?.some(record => record.map.id === save.map));
  const lists: Record<DexFilter, number[]> = {
    All: allSpecies,
    Seen: allSpecies.filter(id => seen.has(id)),
    Caught: allSpecies.filter(id => caught.has(id)),
    Missing: allSpecies.filter(id => !caught.has(id)),
    Local: local,
  };
  return { lists, habitats, caught, seen };
}
