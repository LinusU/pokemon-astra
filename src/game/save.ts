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
    !!WORLD[x.map] &&
    typeof x.x === "number" &&
    Number.isFinite(x.x) &&
    x.x >= 0 &&
    x.x < WORLD[x.map].width &&
    typeof x.y === "number" &&
    Number.isFinite(x.y) &&
    x.y >= 0 &&
    x.y < WORLD[x.map].height &&
    ["up", "down", "left", "right"].includes(x.facing) &&
    Array.isArray(x.party) &&
    x.party.length <= 6 &&
    x.party.every(pokemon) &&
    Array.isArray(x.storage) &&
    x.storage.length <= 1000 &&
    x.storage.every(pokemon) &&
    stringList(x.flags, 10000) &&
    stringList(x.abilities, 8) &&
    x.abilities.every((a: Ability) => ABILITIES.includes(a)) &&
    dex(x.seen) &&
    dex(x.caught) &&
    x.caught.every((id: number) => x.seen.includes(id)) &&
    stringList(x.visited, 500) &&
    x.visited.every((id: string) => !!WORLD[id]) &&
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
      (typeof x.center === "string" && !!WORLD[x.center])) &&
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
  if (safe(save.x, save.y)) return save;
  let best: { x: number; y: number; distance: number } | undefined;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      if (safe(px, py)) {
        const distance = Math.hypot(px - save.x, py - save.y);
        if (!best || distance < best.distance)
          best = { x: px, y: py, distance };
      }
    }
  return best ? { ...save, x: best.x, y: best.y } : save;
}
