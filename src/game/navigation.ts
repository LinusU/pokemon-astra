import { WORLD, type Exit, type WorldMap } from "../world";

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
  const destination = WORLD[exit.to];
  if (exit.direction === "east")
    return { x: x - map.width, y: y + exit.toY - exit.y };
  if (exit.direction === "west")
    return { x: x + destination.width, y: y + exit.toY - exit.y };
  if (exit.direction === "north")
    return { x: x + exit.toX - exit.x, y: y + destination.height };
  if (exit.direction === "south")
    return { x: x + exit.toX - exit.x, y: y - map.height };
  return { x: exit.toX + 0.5, y: exit.toY + 0.5 };
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
