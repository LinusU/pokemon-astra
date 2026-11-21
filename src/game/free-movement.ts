/**
 * Free movement shared by every adventure: how fast the player walks and
 * runs, how big their body is, and how a step slides along walls and into
 * doorways. Positions are body centres in squares, so square n spans
 * [n, n + 1) and its centre is n + 0.5. Each adventure supplies its own
 * collision test and decides what happens on the squares the player reaches.
 */
import type { Facing } from "./actors";
import type { Input } from "./input";

/** Squares per second. */
export const WALK_SPEED = 5.2;
export const RUN_SPEED = 7.2;
export const BIKE_SPEED = WALK_SPEED * 2;
/** Half the width of the player's body, in squares. */
export const BODY_RADIUS = 0.22;
/** Longest collision step, short enough that a slow frame cannot pass through a wall. */
const STEP = 0.12;

export type Position = { x: number; y: number };
export interface Heading {
  /** Unit direction: diagonals are as fast as straight lines. */
  dx: number;
  dy: number;
  facing: Facing;
  /** The horizontal and vertical directions held, if any. */
  across?: Facing;
  along?: Facing;
}

/** The direction held on the pad, and which way the player faces while walking it. */
export function heldHeading(input: Input, facing: Facing): Heading | undefined {
  const held = (d: Facing) => input.held(d) || input.hit(d);
  const h = Number(held("right")) - Number(held("left")), v = Number(held("down")) - Number(held("up"));
  if (!h && !v) return undefined;
  const across: Facing | undefined = h ? (h > 0 ? "right" : "left") : undefined;
  const along: Facing | undefined = v ? (v > 0 ? "down" : "up") : undefined;
  // On a diagonal the player keeps whichever of the two ways they already faced.
  const next = across && along ? (facing === across || facing === along ? facing : along) : (across ?? along)!;
  const length = Math.hypot(h, v);
  return { dx: h / length, dy: v / length, facing: next, across, along };
}

/** Walking pace: B or Shift runs, and a bike is faster still. */
export function walkSpeed(input: Input, options: { bike?: boolean } = {}) {
  if (options.bike) return BIKE_SPEED;
  return input.held("speed") || input.held("b") ? RUN_SPEED : WALK_SPEED;
}

/**
 * Whether `test` holds at any corner of a body centred at (x, y). With a
 * radius under half a square, the corners land on every square the body
 * overlaps.
 */
export function bodyTouches(x: number, y: number, test: (x: number, y: number) => boolean, radius = BODY_RADIUS) {
  return test(x - radius, y - radius) || test(x + radius, y - radius) ||
    test(x - radius, y + radius) || test(x + radius, y + radius);
}

/**
 * Walks a body `distance` squares along a heading in short collision steps,
 * sliding along walls on diagonals. Walking straight at a doorway or gap the
 * body nearly fits eases it into that lane. `stop` ends the walk after the
 * step that reached a place the adventure has to react to, such as a new
 * square or ice. Moves `pos` in place and returns the distance covered.
 */
export function walkFreely(
  pos: Position,
  heading: { dx: number; dy: number },
  distance: number,
  blocked: (x: number, y: number) => boolean,
  stop?: (pos: Position) => boolean,
) {
  const { dx, dy } = heading, start = { ...pos };
  const steps = Math.max(1, Math.ceil(distance / STEP)), step = distance / steps;
  for (let i = 0; i < steps; i++) {
    const before = { ...pos };
    if (dx) {
      if (!blocked(pos.x + dx * step, pos.y)) pos.x += dx * step;
      else if (!dy) slideIntoLane(pos, "y", dx * step, blocked);
    }
    if (dy) {
      if (!blocked(pos.x, pos.y + dy * step)) pos.y += dy * step;
      else if (!dx) slideIntoLane(pos, "x", dy * step, blocked);
    }
    if (stop?.(pos)) break;
    if (pos.x === before.x && pos.y === before.y) break;
  }
  return Math.hypot(pos.x - start.x, pos.y - start.y);
}

/** Nudges a blocked body towards the centre of its square's lane when that lane is open ahead. */
function slideIntoLane(pos: Position, axis: "x" | "y", step: number, blocked: (x: number, y: number) => boolean) {
  const lane = Math.floor(pos[axis]) + 0.5, offset = lane - pos[axis];
  if (Math.abs(offset) < 1e-4) return;
  const ahead = axis === "x" ? blocked(lane, pos.y + step) : blocked(pos.x + step, lane);
  if (ahead) return;
  const nudge = Math.sign(offset) * Math.min(Math.abs(offset), Math.abs(step));
  const open = axis === "x" ? !blocked(pos.x + nudge, pos.y) : !blocked(pos.x, pos.y + nudge);
  if (open) pos[axis] += nudge;
}
