import { WORLD, type Exit, type Requirement, type WorldMap } from "../world";
import { interactionDistance } from "./actors";

export function exitOpen(
  exit: Exit,
  has: (requirement?: Requirement) => boolean,
  flags: readonly string[],
) {
  return (
    has(exit.requires) &&
    (!exit.barrier?.flag || flags.includes(exit.barrier.flag))
  );
}

export function barrierTiles(exit: Exit) {
  if (!exit.barrier) return [];
  if (!exit.direction)
    return Array.from({ length: exit.width ?? 1 }, (_, i) => ({ x: exit.x + i, y: exit.y }));
  const vertical = exit.direction === "north" || exit.direction === "south";
  const span = exit.span ?? 1;
  return Array.from({ length: 2 * span + 1 }, (_, i) => ({
    x: exit.x + (vertical ? i - span : 0),
    y: exit.y + (vertical ? 0 : i - span),
  }));
}

export function barrierAt(map: WorldMap, x: number, y: number) {
  return map.exits.find((exit) => {
    if (!exit.barrier) return false;
    const dx = Math.abs(exit.x - Math.floor(x));
    const dy = Math.abs(exit.y - Math.floor(y));
    const span = exit.span ?? 1;
    if (exit.direction === "north" || exit.direction === "south")
      return dy === 0 && dx <= span;
    if (exit.direction === "east" || exit.direction === "west")
      return dx === 0 && dy <= span;
    const tileX = Math.floor(x);
    return dy === 0 && tileX >= exit.x && tileX < exit.x + (exit.width ?? 1);
  });
}

export function barrierTarget(
  map: WorldMap,
  player: { x: number; y: number; facing: string },
  isOpen: (exit: Exit) => boolean,
) {
  let nearest: Exit | undefined;
  let distance = Infinity;
  for (const exit of map.exits) {
    if (!exit.barrier || isOpen(exit)) continue;
    for (const { x, y } of barrierTiles(exit)) {
      const reach = interactionDistance(
        map,
        player,
        { x: x + 0.5, y: y + 0.5 },
        { allowWaterTarget: true },
      );
      if (reach < distance) {
        nearest = exit;
        distance = reach;
      }
    }
  }
  return nearest;
}

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

export function exitAt(map: WorldMap, x: number, y: number) {
  const tileX = Math.floor(x), tileY = Math.floor(y);
  return connectionAt(map, x, y) ?? map.exits.find((exit) =>
    !exit.direction && exit.y === tileY &&
    tileX >= exit.x && tileX < exit.x + (exit.width ?? 1),
  );
}

/** Preserve the exact sub-tile position across connected map coordinates. */
export function crossConnection(
  map: WorldMap,
  exit: Exit,
  x: number,
  y: number,
  permitted?: (exit: Exit) => boolean,
) {
  const peer = WORLD[exit.to].exits.find(
    (other) =>
      other.to === map.id && other.x === exit.toX && other.y === exit.toY,
  );
  if (!exit.direction) {
    const inset =
      peer?.entrance === "mat" ? -1 : exit.entrance === "mat" ? 1 : 0;
    return { x: exit.toX + 0.5, y: exit.toY + 0.5 + inset };
  }
  const offset = connectionOffset(map, exit);
  const arrival = { x: x - offset.x, y: y - offset.y };
  // A traveller leaving a shortcut may reach the far side of a closed obstacle.
  // Place their feet on the road inside the destination so the exit stays one-way.
  if (peer?.barrier && permitted && !permitted(peer)) {
    if (exit.direction === "west") arrival.x -= 1.25;
    if (exit.direction === "east") arrival.x += 1.25;
    if (exit.direction === "north") arrival.y -= 1.25;
    if (exit.direction === "south") arrival.y += 1.25;
  }
  return arrival;
}

export function connectedTile(
  map: WorldMap,
  x: number,
  y: number,
  permitted: (exit: Exit) => boolean,
): string | undefined {
  if (x >= 0 && x < map.width && y >= 0 && y < map.height) {
    const barrier = barrierAt(map, x, y);
    if (barrier && !permitted(barrier)) return;
    return map.tiles[Math.floor(y)][Math.floor(x)];
  }
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
    return !tile || "#orwBCPTS".includes(tile) || (tile === "~" && !surf);
  });
}
