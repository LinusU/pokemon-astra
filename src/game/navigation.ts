import { WORLD, type Exit, type WorldMap } from "../world";

/** The destination map's origin relative to this map's origin, in tiles. */
export function connectionOffset(map: WorldMap, exit: Exit) {
  const destination = WORLD[exit.to];
  return {
    x:
      exit.direction === "east"
        ? map.width
        : exit.direction === "west"
          ? -destination.width
          : exit.x - exit.toX,
    y:
      exit.direction === "south"
        ? map.height
        : exit.direction === "north"
          ? -destination.height
          : exit.y - exit.toY,
  };
}

export function connectionAt(
  map: WorldMap,
  x: number,
  y: number,
): Exit | undefined {
  const direction =
    x < 0
      ? "west"
      : x >= map.width
        ? "east"
        : y < 0
          ? "north"
          : y >= map.height
            ? "south"
            : undefined;
  if (!direction) return;
  return map.exits.find(
    (exit) =>
      exit.direction === direction &&
      Math.abs(
        (direction === "east" || direction === "west"
          ? y - exit.y
          : x - exit.x) - 0.5,
      ) <
        (exit.span ?? 1) + 0.5,
  );
}

/** Preserve the exact sub-tile position across connected map coordinates. */
export function crossConnection(
  map: WorldMap,
  exit: Exit,
  x: number,
  y: number,
) {
  if (!exit.direction) return { x: exit.toX + 0.5, y: exit.toY + 0.5 };
  const offset = connectionOffset(map, exit);
  return { x: x - offset.x, y: y - offset.y };
}

export function connectedTile(
  map: WorldMap,
  x: number,
  y: number,
  permitted: (exit: Exit) => boolean,
): string | undefined {
  if (x >= 0 && x < map.width && y >= 0 && y < map.height)
    return map.tiles[Math.floor(y)][Math.floor(x)];
  const exit = connectionAt(map, x, y);
  if (!exit || !permitted(exit)) return;
  const next = crossConnection(map, exit, x, y);
  return WORLD[exit.to].tiles[Math.floor(next.y)]?.[Math.floor(next.x)];
}

export function connectedBlocked(
  map: WorldMap,
  x: number,
  y: number,
  surf: boolean,
  permitted: (exit: Exit) => boolean,
) {
  return [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ].some(([dx, dy]) => {
    const tile = connectedTile(map, x + dx, y + dy, permitted);
    return !tile || "#rwBCPTS".includes(tile) || (tile === "~" && !surf);
  });
}
