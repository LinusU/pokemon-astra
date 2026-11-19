import { expect, it } from "vitest";
import { objectVisible, interactionTarget, terrainBlocked, WorldActors } from "../src/game/actors";
import { WORLD } from "../src/world";
import { settlements } from "../src/world/atlas";

it("brings wildlife back to all twelve settlements after a playable local milestone", () => {
  const playableFlags = new Set(Object.values(WORLD).flatMap(m => m.objects.map(o => o.setsFlag)));
  const species = new Set<number>();
  for (const id of Object.keys(settlements)) {
    const map = WORLD[id];
    const visitor = map.objects.find(o => o.id === "visitor_" + id)!;
    const milestone = visitor.field!.appearsAfter!;
    expect(playableFlags.has(milestone), id).toBe(true);
    expect(objectVisible(visitor, new Set()), id).toBe(false);
    expect(objectVisible(visitor, new Set([milestone])), id).toBe(true);
    expect(map.objects.find(o => o.id === "resident_" + id + "_1")?.requires?.flags).toEqual([milestone]);
    species.add(visitor.wildlife!);

    const actors = new WorldActors();
    actors.enter(map);
    const center = map.exits.find(e => e.to.endsWith("_center"))!;
    const queue = [[center.x, center.y + 1]];
    const seen = new Set<string>();
    const directions = [
      [1, 0, "right"], [-1, 0, "left"], [0, 1, "down"], [0, -1, "up"],
    ] as const;
    let canObserve = false;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      const key = x + "," + y;
      if (seen.has(key) || terrainBlocked(map, x + 0.5, y + 0.5) || actors.solid(map, x + 0.5, y + 0.5)) continue;
      seen.add(key);
      for (const [dx, dy, facing] of directions) {
        if (visitor.x === x + dx && visitor.y === y + dy) {
          const target = interactionTarget(map, { x: x + 0.5, y: y + 0.5, facing }, new Set([milestone]), o => actors.position(o));
          if (target === visitor) canObserve = true;
        }
        queue.push([x + dx, y + dy]);
      }
    }
    expect(canObserve, map.name + " wildlife").toBe(true);
    for (const exit of map.exits.filter(e => !e.direction)) {
      expect(seen.has(exit.x + "," + exit.y), map.name + " to " + exit.to).toBe(true);
    }
  }
  expect(species.size).toBe(12);
});
