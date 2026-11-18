import type { WorldMap } from "../world";
import type { Facing } from "./actors";

type Position = { x: number; y: number };
const stride: Record<Facing, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

/** Blue ice carries a skater to the first grit tile or the face of a bank. */
export function iceLanding(
  map: WorldMap,
  position: Position,
  facing: Facing,
  blocked: (x: number, y: number) => boolean,
): Position | undefined {
  let x = Math.floor(position.x),
    y = Math.floor(position.y);
  if (map.tiles[y]?.[x] !== "i") return;
  const [dx, dy] = stride[facing];
  while (map.tiles[y]?.[x] === "i" && !blocked(x + dx + 0.5, y + dy + 0.5)) {
    x += dx;
    y += dy;
  }
  return { x: x + 0.5, y: y + 0.5 };
}

export function advanceGlide(position: Position, landing: Position, dt: number) {
  const dx = landing.x - position.x,
    dy = landing.y - position.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= dt * 8) {
    position.x = landing.x;
    position.y = landing.y;
    return true;
  }
  position.x += (dx / distance) * dt * 8;
  position.y += (dy / distance) * dt * 8;
  return false;
}
