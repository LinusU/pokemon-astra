import { WORLD } from "../world";
import { routes, settlements, type Footprint, type Point, type Town } from "../world/atlas";

export const outdoorFootprints: Record<string, Footprint> = {
  ...settlements,
  ...Object.fromEntries(Object.entries(routes).map(([n, r]) => ["route" + n, r])),
};

/** Indoor rooms share their exterior entrance on the regional chart. */
export function regionPosition(mapId: string, x: number, y: number): { area: string; point: Point } {
  const queue = [{ id: mapId, x, y }];
  const seen = new Set([mapId]);
  for (let i = 0; i < queue.length; i++) {
    const next = queue[i],
      footprint = outdoorFootprints[next.id];
    if (footprint) return { area: next.id, point: [footprint.x + next.x, footprint.y + next.y] };
    for (const exit of WORLD[next.id].exits) {
      if (seen.has(exit.to)) continue;
      seen.add(exit.to);
      queue.push({ id: exit.to, x: exit.toX + 0.5, y: exit.toY + 0.5 });
    }
  }
  throw Error("Missing regional entrance for " + mapId);
}

export const townIds = Object.keys(settlements) as Town[];
export const routeIds = Object.keys(routes).sort();
export const chartAreas = [...townIds, ...routeIds.map((n) => "route" + n)];
