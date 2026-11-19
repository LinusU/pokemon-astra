import { expect, it } from "vitest";
import { WORLD } from "../src/world";
import { routes, surveyTrail, type Point } from "../src/world/atlas";

it.each(Object.keys(routes).sort())("keeps both ends of Route %s’s side trail connected to its discoveries", (n) => {
  const map = WORLD["route" + n];
  const survey = surveyTrail(n);
  const cell = ([x, y]: Point) => y * map.width + x;
  const mouths = [survey.bypass[0], survey.bypass.at(-1)!];
  // Remove the main road so a broken side trail cannot pass by walking back
  // along the road. A player can navigate around trainers in their home spots.
  const blocked = new Set(survey.trail.map(cell));
  for (const mouth of mouths) blocked.delete(cell(mouth));
  for (const o of map.objects.filter(o => o.kind === "trainer" || o.kind === "person"))
    blocked.add(cell([o.x, o.y]));
  const canSurf = ["22", "24"].includes(n);
  const visited = new Set<number>();
  const queue: Point[] = [mouths[0]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    const tile = map.tiles[y]?.[x];
    const key = cell(queue[i]);
    if (!tile || visited.has(key) || blocked.has(key) || "#orwBCPTS".includes(tile) || (!canSurf && tile === "~"))
      continue;
    visited.add(key);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  expect(visited.has(cell(mouths[1])), "rejoins the road beyond the clearing").toBe(true);
  for (const prefix of ["sign_", "item_", "resident_"]) {
    const object = map.objects.find(o => o.id === prefix + map.id)!;
    expect(visited.has(cell([object.x, object.y])), object.name).toBe(true);
    expect(Math.min(...survey.trail.map(([x, y]) => Math.hypot(object.x - x, object.y - y))),
      object.name + " is reached by leaving the road").toBeGreaterThan(2.5);
    if (object.wildlife) expect(map.encounters.some(e => e.species === object.wildlife)).toBe(true);
  }
});
