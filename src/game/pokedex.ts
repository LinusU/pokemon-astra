import { WORLD, isWildEncounter, type Requirement, type WorldMap } from "../world";
import { fieldHabitats } from "./badges";
import { fossilChoices, starterSpecies } from "./collection";
import { bearings, routeTo } from "./journal";
import { regionPosition } from "./region";
import type { Save } from "./save";

export const dexFilters = ["All", "Seen", "Caught", "Missing", "Local"] as const;
export type DexFilter = typeof dexFilters[number];
const allSpecies = Array.from({ length: 251 }, (_, index) => index + 1);

export function fishingPool(map: WorldMap, isWaterType: (id: number) => boolean, save: Pick<Save, "badges" | "abilities">) {
  const pool = fieldHabitats(map, save).filter(entry => isWaterType(entry.species));
  return pool.length ? pool : [{ species: 129, minLevel: 10 }];
}

export type HabitatRecord = {
  map: WorldMap;
  method: string;
  level: string;
  note: string;
  contact?: { name: string; x: number; y: number };
};

export function locateHabitat(record: HabitatRecord, save: Save, permitted: (r?: Requirement) => boolean) {
  const { map, contact } = record;
  const position = regionPosition(map.id, contact ? contact.x + 0.5 : map.width / 2, contact ? contact.y + 0.5 : map.height / 2);
  let hint: string;
  if (save.map === map.id) {
    if (contact) hint = `${contact.name} · ${bearings(save.x, save.y, contact)}`;
    else if (record.method === "Fishing") hint = save.flags.includes("quest_angler_complete")
      ? "Face the water and press A to fish." : "Complete the angler’s request in Tideglass to fish here.";
    else hint = "Walk through the tall grass here.";
  } else {
    const next = routeTo(save.map, map.id, permitted)[0];
    hint = next ? `Head for ${WORLD[next.to].name} · ${bearings(save.x, save.y, next)}`
      : "No walking route is open from here yet.";
  }
  return { position, hint };
}

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
    function add(id: number, method: string, level: string, note: string, contact?: HabitatRecord["contact"]) {
      const records = habitats.get(id) ?? [];
      records.push({ map, method, level, note, contact });
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
      const guardian = isWildEncounter(object) && object.trainer?.team[0];
      const collected = object.setsFlag && save.flags.includes(object.setsFlag);
      if (guardian) {
        const requirement = object.id === "lighthouse_lapras" ? "Restore the fog signal and return with Surf" : guardianHint(object.requires);
        add(guardian.species, object.kind === "wild" ? "Field request" : "Guardian", String(guardian.level),
          collected ? "Already captured" : requirement, object);
      }
      if (object.kind === "starter") {
        const chosen = starterSpecies.find(id => save.flags.includes("starter_" + id)) ?? save.caught[0];
        for (const id of starterSpecies) {
          if (!collected || id === chosen)
            add(id, "Starter", "6", collected ? "Your first partner" : "Choose one partner from Alder", object);
        }
      } else if (object.id === "quest_fossil") {
        for (const { species, fossil } of fossilChoices) {
          const chosen = save.flags.includes("fossil_" + species);
          // Earlier saves only recorded that the one-time revival was used.
          if (!collected || chosen)
            add(species, "Fossil revival", String(object.reward!.level), chosen ? "Fossil revived" : `Choose the ${fossil} Fossil`, object);
        }
      } else if (object.reward?.species) {
        add(object.reward.species, "Gift", String(object.reward.level ?? 5),
          collected ? "Gift received" : `From ${object.name}`, object);
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
