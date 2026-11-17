import { ABILITIES, WORLD, type Ability } from "../world";
import type { Pokemon } from "../engine";

export type Save = {
  version: 1;
  map: string;
  x: number;
  y: number;
  facing: string;
  party: Pokemon[];
  storage: Pokemon[];
  flags: string[];
  abilities: Ability[];
  badges: number;
  seen: number[];
  caught: number[];
  items: Record<string, number>;
  money: number;
  visited: string[];
  steps: number;
  center?: string;
  hallOfFame?: { species: number; level: number }[];
  repel?: number;
  settings: { battleSpeed: number; night?: boolean; music?: boolean };
};
export const freshSave = (): Save => ({
  version: 1,
  map: "dewdrop",
  x: 6.5,
  y: 24.5,
  facing: "down",
  party: [],
  storage: [],
  flags: [],
  abilities: [],
  badges: 0,
  seen: [],
  caught: [],
  items: { poke_ball: 10, potion: 5 },
  money: 3000,
  visited: ["dewdrop"],
  steps: 0,
  settings: { battleSpeed: 1, music: true },
});
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
    exact(m.moves, 4, 255) &&
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
    (x.hallOfFame === undefined ||
      (Array.isArray(x.hallOfFame) &&
        x.hallOfFame.length > 0 &&
        x.hallOfFame.length <= 6 &&
        x.hallOfFame.every(
          (m: any) =>
            m && integer(m.species, 1, 251) && integer(m.level, 1, 100),
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
/** Move a valid save out of an obstructed position, e.g. after a map update. */
export function normalizeSavePosition(save: Save): Save {
  const map = WORLD[save.map];
  const safe = (x: number, y: number) =>
    !map.objects.some(
      (o) =>
        ["person", "trainer", "leader", "healer", "shop", "starter"].includes(
          o.kind,
        ) &&
        Math.abs(o.x + 0.5 - x) < 0.6 &&
        Math.abs(o.y + 0.5 - y) < 0.6,
    ) &&
    [
      [-0.22, -0.22],
      [0.22, -0.22],
      [-0.22, 0.22],
      [0.22, 0.22],
    ].every(([dx, dy]) => {
      const tile = map.tiles[Math.floor(y + dy)]?.[Math.floor(x + dx)];
      return (
        !!tile &&
        !"#rwBCPTS".includes(tile) &&
        (tile !== "~" || save.abilities.includes("surf"))
      );
    });
  // Map revisions can also strand a player on an otherwise walkable island.
  // Only relocate into the same walkable component as an entrance.
  const accessible = new Set<number>();
  const queue = map.exits.map((e) => [e.x, e.y]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
    const key = y * map.width + x;
    if (accessible.has(key) || !safe(x + 0.5, y + 0.5)) continue;
    accessible.add(key);
    queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
  if (
    safe(save.x, save.y) &&
    accessible.has(Math.floor(save.y) * map.width + Math.floor(save.x))
  )
    return save;
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
