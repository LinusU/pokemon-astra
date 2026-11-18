import { expect, it } from "vitest";
import { WORLD, type WorldMap } from "../src/world";
import { gymState } from "../src/world/gyms";
import { WorldActors, interactionDistance, terrainBlocked, type Facing } from "../src/game/actors";
import { iceLanding } from "../src/game/skating";
import { freshSave, meetsRequirement, normalizeSavePosition } from "../src/game/save";
import { fieldTeam } from "../src/game/badges";

const directions: [Facing, number, number][] = [["up",0,-1], ["down",0,1], ["left",-1,0], ["right",1,0]];
function explore(map: WorldMap, avoidSight = false, surf = false, start = map.exits[0]) {
  const actors = new WorldActors();
  actors.enter(map);
  const blocked = (x: number, y: number) => terrainBlocked(map, x, y, surf) || actors.solid(map, x, y);
  const seen = new Set<string>();
  const cells = [{ x: start.x + 0.5, y: start.y + 0.5 }];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i], key = [cell.x,cell.y].join(",");
    if (seen.has(key) || blocked(cell.x,cell.y)) continue;
    seen.add(key);
    if (avoidSight && actors.spotTrainer(map, cell, () => true)) {
      actors.reset();
      actors.enter(map);
      continue;
    }
    for (const [facing, dx, dy] of directions) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      if (!blocked(next.x, next.y)) cells.push(iceLanding(map, next, facing, blocked) ?? next);
    }
  }
  const leader = map.objects.find(o => o.kind === "leader")!;
  return { seen, canTalk: [...seen].some(key => {
    const [x, y] = key.split(",").map(Number);
    return directions.some(([facing]) => Number.isFinite(interactionDistance(map,
      { x, y, facing }, { x: leader.x + 0.5, y: leader.y + 0.5 })));
  }) };
}

it("gives each keeper a different floor plan, staff and specialty team", () => {
  const maps = Object.values(WORLD).filter(m => m.kind === "gym");
  expect(new Set(maps.map(m => [m.width,m.height].join("x"))).size).toBe(8);
  for (const map of maps) {
    expect(map.objects.some(o => o.kind === "switch")).toBe(false);
    const crew = map.objects.filter(o => o.kind === "trainer");
    expect(crew.length).toBeGreaterThan(0);
    expect(crew.every(o => o.trainer?.team.length && o.sprite && o.facing && o.sightRange)).toBe(true);
    expect(explore(map).canTalk, map.name).toBe(true);
  }
  for (const id of ["gym1", "gym2", "gym4", "gym5", "gym7"])
    expect(explore(WORLD[id], true).canTalk, id + " has a clear bypass").toBe(true);
  expect(explore(WORLD.gym8, true).canTalk).toBe(false);
});

it("welcomes walk-ins at the silkhouse and still needs the surveyor on the east road", () => {
  const save = freshSave();
  save.flags.push("partner");
  expect(meetsRequirement(save, WORLD.gym1.objects.find(o => o.kind === "leader")!.requires)).toBe(true);
  const exit = WORLD.bramble.exits.find(e => e.to === "route04")!;
  save.badges = 1;
  save.abilities.push("cut");
  expect(meetsRequirement(save, exit.requires)).toBe(false);
  save.flags.push("surveyor");
  expect(meetsRequirement(save, exit.requires)).toBe(true);
});

it("lowers the lightship gangway and releases only the catwalk whose operator lost", () => {
  const dock = WORLD.gym2, hall = WORLD.gym3;
  expect(explore(gymState(dock, [])).canTalk).toBe(false);
  expect(explore(gymState(dock, ["fog_signal"])).canTalk).toBe(true);
  expect(explore(gymState(hall, ["power_restored"]), false, true).canTalk).toBe(false);
  for (const flag of ["gym3_1_won", "gym3_2_won"]) {
    const oneOpen = gymState(hall, [flag]);
    expect(explore(oneOpen).canTalk).toBe(true);
    expect(oneOpen.tiles.join("").match(/o/g)).toHaveLength(1);
  }
  expect(explore(gymState(hall, ["badge3"])).canTalk).toBe(true);
  const save = normalizeSavePosition({ ...freshSave(), map: hall.id, x: 11.5, y: 2.5,
    flags: ["gym3_puzzle3", "power_restored"] });
  expect(save.y).toBeGreaterThan(4);
  expect(gymState(dock, []).tiles).not.toEqual(dock.tiles);
});

it("makes the mine rescue visible and keeps open-shore crew at the chosen tier", () => {
  const residents = (flags: string[]) => gymState(WORLD.gym5, flags).objects.filter(o => o.wildlife);
  expect(residents([])).toHaveLength(0);
  expect(residents(["pokemon_freed"]).map(o => o.wildlife)).toEqual([155,218]);
  for (const n of [4,5,6]) {
    const trainer = WORLD["gym" + n].objects.find(o => o.kind === "trainer")!;
    for (const badges of [3,4,5])
      expect(Math.max(...fieldTeam(trainer, { badges, abilities: [] }).map(m => m.level)))
        .toBeLessThan([29,36,42][badges-3]);
  }
});

it("coasts across the rink, stops on grit and can get back out from every landing", () => {
  const rink = WORLD.gym6;
  const blocked = (x: number, y: number) => terrainBlocked(rink, x, y);
  expect(iceLanding(rink, { x: 4.5, y: 9.5 }, "up", blocked)).toEqual({ x: 4.5, y: 8.5 });
  expect(iceLanding(rink, { x: 5.5, y: 8.5 }, "right", blocked)).toEqual({ x: 6.5, y: 8.5 });
  const { seen } = explore(rink);
  const door = rink.exits[0];
  for (const cell of seen) {
    const [x,y] = cell.split(",").map(n => Math.floor(Number(n)));
    expect(explore(rink, false, false, { ...door, x, y }).seen.has([door.x + 0.5,door.y + 0.5].join(",")), cell).toBe(true);
  }
});
