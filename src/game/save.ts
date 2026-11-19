import { chartVisit, updateChart } from "../world/requests";
import { expeditionState } from "../world/expeditions";
import { gymState } from "../world/gyms";
import { ABILITIES, WORLD, type Ability, type Requirement } from "../world";
import { barrierAt, exitOpen } from "./navigation";
import type { Pokemon } from "../engine";

export type Save = {
  version: 1;
  map: string;
  x: number;
  y: number;
  facing: string;
  party: Pokemon[];
  storage: Pokemon[];
  pendingEvolutions?: number[];
  pendingMoves?: { slot: number; moves: number[] };
  nursery?: { parents: [Pokemon, Pokemon]; readyAt: number };
  egg?: { mon: Pokemon; hatchAt: number };
  flags: string[];
  abilities: Ability[];
  badges: number;
  seen: number[];
  caught: number[];
  items: Record<string, number>;
  money: number;
  visited: string[];
  steps: number;
  survey?: number;
  center?: string;
  hallOfFame?: { species: number; level: number; dvs?: number[] }[];
  repel?: number;
  settings: { battleSpeed: number; night?: boolean; music?: boolean };
};
export const freshSave = (): Save => ({
  version: 1,
  map: "dewdrop",
  x: 4.5,
  y: 16.5,
  facing: "up",
  party: [],
  storage: [],
  flags: ["starter_supplies_pending", "survey_rooms_v2"],
  abilities: [],
  badges: 0,
  seen: [],
  caught: [],
  items: {},
  money: 3000,
  visited: ["dewdrop"],
  steps: 0,
  settings: { battleSpeed: 1, music: true },
});

export function recordVisit(save: Save) {
  if (!save.visited.includes(save.map)) save.visited.push(save.map);
  updateChart(save.flags, save.map);
}

/** Older journals kept only town names. Recover visits attested by the player's field records. */
export function restoreVisits(save: Save) {
  const flags = new Set(save.flags);
  const visits = new Set(save.visited);
  if (save.center) visits.add(save.center);
  for (const map of Object.values(WORLD)) {
    const site = chartVisit(map.id);
    if ((site && flags.has("chart_" + site)) || map.objects.some(o =>
      o.setsFlag && flags.has(o.setsFlag) && (
        o.kind === "leader" || o.kind === "legendary" ||
        (o.kind === "trainer" && o.setsFlag.endsWith("_won")) ||
        (o.kind === "item" && o.setsFlag.endsWith("_found"))
      ))) visits.add(map.id);
  }
  save.visited = [...visits];
  recordVisit(save);
}

/** Earlier saves recorded the courier handoff without adding a Key Item. */
export function restoreQuestItems(save: Save): Save {
  if (!save.flags.includes("found_parcel") || save.flags.includes("quest_parcel_complete"))
    return save;
  if (save.items.courier_parcel === 1) return save;
  return { ...save, items: { ...save.items, courier_parcel: 1 } };
}
/** Credit earlier expeditions and relocate a player whose room was redrawn. */
export function restoreExpeditions(input: Save): Save {
  const save = restoreQuestItems(input);
  if (save.flags.includes("survey_rooms_v2")) return save;
  const credits: Record<string, string[]> = {
    found_parcel: ["parcel_wrapped"],
    summit_open: ["west_pitch", "east_pitch"],
    bridge_lowered: ["bamboo_nesting", "bamboo_burrow"],
    pokemon_freed: ["ember_kit_safe", "ember_slug_safe", "mine_clear"],
    ranger_report: ["bamboo_nesting", "bamboo_burrow"],
    vale_defeated: ["meridian_evidence", "keycard"],
    research_seal: ["aurora_day_record", "aurora_night_record"],
    quest_lighthouse_complete: ["lighthouse_lapras_safe"],
    quest_bamboo_friend_complete: ["farfetchd_lane", "farfetchd_home"],
    quest_hearth_complete: ["hearth_baked"],
  };
  const flags = [...new Set([...save.flags, ...save.flags.flatMap(f => credits[f] ?? []), "survey_rooms_v2"])];
  updateChart(flags, save.map);
  const map = WORLD[save.map];
  const arrival = map.kind === "dungeon" ? map.exits[0] : undefined;
  return { ...save, flags, ...(arrival && { x: arrival.x + 0.5, y: arrival.y + 0.5 }) };
}
const integer = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const exact = (a: unknown, n: number, max: number) =>
  Array.isArray(a) && a.length === n && a.every((v) => integer(v, 0, max));
const stringList = (a: unknown, max: number) =>
  Array.isArray(a) &&
  a.length <= max &&
  a.every((v) => typeof v === "string" && v.length <= 200) &&
  new Set(a).size === a.length;
function pokemon(m: any): m is Pokemon {
  return (
    !!m &&
    integer(m.species, 1, 251) &&
    integer(m.item, 0, 255) &&
    exact(m.moves, 4, 251) &&
    integer(m.ot_id, 0, 65535) &&
    integer(m.exp, 0, 0xffffff) &&
    exact(m.stat_exp, 5, 65535) &&
    exact(m.dvs, 2, 255) &&
    exact(m.pp, 4, 255) &&
    integer(m.happiness, 0, 255) &&
    integer(m.pokerus, 0, 255) &&
    exact(m.caught, 2, 255) &&
    integer(m.level, 1, 100) &&
    integer(m.status, 0, 255) &&
    integer(m.hp, 0, 65535) &&
    exact(m.stats, 6, 65535) &&
    m.hp <= m.stats[0] &&
    typeof m.nickname === "string" &&
    m.nickname.length <= 32 &&
    typeof m.ot_name === "string" &&
    m.ot_name.length <= 32
  );
}
export function isValidSave(x: any): x is Save {
  const dex = (v: any) =>
    Array.isArray(v) &&
    v.length <= 251 &&
    v.every((id: any) => integer(id, 1, 251)) &&
    new Set(v).size === v.length;
  return (
    !!x &&
    x.version === 1 &&
    typeof x.map === "string" &&
    Object.hasOwn(WORLD, x.map) &&
    typeof x.x === "number" &&
    Number.isFinite(x.x) &&
    x.x >= 0 &&
    x.x < Math.max(40, WORLD[x.map].width) &&
    typeof x.y === "number" &&
    Number.isFinite(x.y) &&
    x.y >= 0 &&
    x.y < Math.max(40, WORLD[x.map].height) &&
    ["up", "down", "left", "right"].includes(x.facing) &&
    Array.isArray(x.party) &&
    x.party.length <= 6 &&
    x.party.every(pokemon) &&
    Array.isArray(x.storage) &&
    x.storage.every(pokemon) &&
    (x.pendingEvolutions === undefined || (Array.isArray(x.pendingEvolutions) &&
      x.pendingEvolutions.length <= 6 && new Set(x.pendingEvolutions).size === x.pendingEvolutions.length &&
      x.pendingEvolutions.every((slot: unknown) => integer(slot, 0, x.party.length - 1)))) &&
    (x.pendingMoves === undefined || (integer(x.pendingMoves?.slot, 0, x.party.length - 1) &&
      Array.isArray(x.pendingMoves.moves) && x.pendingMoves.moves.length > 0 && dex(x.pendingMoves.moves))) &&
    (x.nursery === undefined || (Array.isArray(x.nursery?.parents) &&
      x.nursery.parents.length === 2 && x.nursery.parents.every(pokemon) &&
      Number.isFinite(x.nursery.readyAt) && x.nursery.readyAt >= 0)) &&
    (x.egg === undefined || (pokemon(x.egg?.mon) &&
      Number.isFinite(x.egg.hatchAt) && x.egg.hatchAt >= 0)) &&
    (x.hallOfFame === undefined ||
      (Array.isArray(x.hallOfFame) &&
        x.hallOfFame.length > 0 &&
        x.hallOfFame.length <= 6 &&
        x.hallOfFame.every(
          (m: any) =>
            m && integer(m.species, 1, 251) && integer(m.level, 1, 100) &&
            (m.dvs === undefined || exact(m.dvs, 2, 255)),
        ))) &&
    stringList(x.flags, 10000) &&
    stringList(x.abilities, 8) &&
    x.abilities.every((a: Ability) => ABILITIES.includes(a)) &&
    dex(x.seen) &&
    dex(x.caught) &&
    x.caught.every((id: number) => x.seen.includes(id)) &&
    stringList(x.visited, 500) &&
    x.visited.every((id: string) => Object.hasOwn(WORLD, id)) &&
    !!x.items &&
    typeof x.items === "object" &&
    !Array.isArray(x.items) &&
    Object.entries(x.items).every(
      ([k, v]) => k.length <= 100 && integer(v, 0, 99),
    ) &&
    integer(x.money, 0, 999999) &&
    integer(x.badges, 0, 8) &&
    (x.survey === undefined || integer(x.survey, 4, 6)) &&
    typeof x.steps === "number" &&
    Number.isFinite(x.steps) &&
    x.steps >= 0 &&
    (x.center === undefined ||
      (typeof x.center === "string" && Object.hasOwn(WORLD, x.center))) &&
    (x.repel === undefined ||
      (typeof x.repel === "number" &&
        Number.isFinite(x.repel) &&
        x.repel >= 0)) &&
    !!x.settings &&
    integer(x.settings.battleSpeed, 1, 3) &&
    (x.settings.night === undefined || typeof x.settings.night === "boolean") &&
    (x.settings.music === undefined || typeof x.settings.music === "boolean")
  );
}
export function meetsRequirement(
  save: Save,
  requirement?: Requirement,
  typesOf?: (species: number) => number[],
) {
  if (!requirement) return true;
  const {
    flags = [],
    badges = 0,
    ability,
    caught = 0,
    items = [],
    species,
    types = [],
  } = requirement;
  const typeIds: Record<string, number> = {
    bug: 7,
    water: 21,
    grass: 22,
    fire: 20,
  };
  return (
    flags.every((f) => save.flags.includes(f)) &&
    save.badges >= badges &&
    (!ability || save.abilities.includes(ability)) &&
    save.caught.length >= caught &&
    items.every((key) => save.items[key] > 0) &&
    (!species || save.party.some((mon) => species.includes(mon.species))) &&
    types.every(
      (t) =>
        save.caught.filter((id) => typesOf?.(id).includes(typeIds[t.type]))
          .length >= t.count,
    )
  );
}

/** Move a valid save out of an obstructed position, e.g. after a map update. */
export function normalizeSavePosition(save: Save): Save {
  const map = expeditionState(gymState(WORLD[save.map], save.flags), save.flags);
  const safe = (x: number, y: number) =>
    !map.objects.some(
      (o) =>
        (["person", "trainer", "leader", "healer", "shop", "starter", "pc"].includes(o.kind) ||
          (o.field?.solid && !save.flags.includes(o.setsFlag!))) &&
        Math.abs(o.x + 0.5 - x) < 0.6 &&
        Math.abs(o.y + 0.5 - y) < 0.6,
    ) &&
    [
      [-0.22, -0.22],
      [0.22, -0.22],
      [-0.22, 0.22],
      [0.22, 0.22],
    ].every(([dx, dy]) => {
      const gate = barrierAt(map, x + dx, y + dy);
      if (gate && !exitOpen(gate, (r) => meetsRequirement(save, r), save.flags))
        return false;
      const tile = map.tiles[Math.floor(y + dy)]?.[Math.floor(x + dx)];
      return (
        !!tile &&
        !"#orwBCPTS".includes(tile) &&
        (tile !== "~" || save.abilities.includes("surf"))
      );
    });
  // Map revisions can also strand a player on an otherwise walkable island.
  // Only relocate into the same walkable component as an entrance.
  const target = safe(save.x, save.y)
    ? Math.floor(save.y) * map.width + Math.floor(save.x)
    : -1;
  const accessible = new Set<number>();
  const queue = map.exits.flatMap(({ x, y }) => [
    [x, y],
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
    const key = y * map.width + x;
    if (accessible.has(key) || !safe(x + 0.5, y + 0.5)) continue;
    if (key === target) return save;
    accessible.add(key);
    queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  let best: { x: number; y: number; distance: number } | undefined;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      if (accessible.has(y * map.width + x)) {
        const distance = Math.hypot(px - save.x, py - save.y);
        if (!best || distance < best.distance)
          best = { x: px, y: py, distance };
      }
    }
  return best ? { ...save, x: best.x, y: best.y } : save;
}
