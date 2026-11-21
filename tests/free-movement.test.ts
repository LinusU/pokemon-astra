import { describe, expect, it } from "vitest";
import type { Input } from "../src/game/input";
import {
  BIKE_SPEED, BODY_RADIUS, RUN_SPEED, WALK_SPEED, bodyTouches, heldHeading, walkFreely, walkSpeed,
} from "../src/game/free-movement";

const pad = (...held: string[]) => ({ held: (a: string) => held.includes(a), hit: () => false }) as unknown as Input;
/** A body test over a map of walls, given as rows of "#" and ".". */
const walls = (...rows: string[]) => (x: number, y: number) =>
  bodyTouches(x, y, (px, py) => rows[Math.floor(py)]?.[Math.floor(px)] !== ".");

describe("shared free movement", () => {
  it("walks diagonals as fast as straight lines, keeping the facing already held", () => {
    const h = heldHeading(pad("right", "down"), "right")!;
    expect(Math.hypot(h.dx, h.dy)).toBeCloseTo(1);
    expect(h).toMatchObject({ facing: "right", across: "right", along: "down" });
    expect(heldHeading(pad("right", "down"), "left")!.facing).toBe("down");
    expect(heldHeading(pad(), "up")).toBeUndefined();
  });

  it("runs with B or Shift, and rides faster", () => {
    expect(walkSpeed(pad())).toBe(WALK_SPEED);
    expect(walkSpeed(pad("b"))).toBe(RUN_SPEED);
    expect(walkSpeed(pad("speed"))).toBe(RUN_SPEED);
    expect(walkSpeed(pad("b"), { bike: true })).toBe(BIKE_SPEED);
  });

  it("covers the full distance in open ground", () => {
    const pos = { x: 1.5, y: 1.5 };
    const moved = walkFreely(pos, { dx: 1, dy: 0 }, WALK_SPEED / 2, () => false);
    expect(moved).toBeCloseTo(WALK_SPEED / 2);
    expect(pos.x).toBeCloseTo(1.5 + WALK_SPEED / 2);
  });

  it("stops at a wall even after a long frame", () => {
    const blocked = walls("......#", "......#", "......#");
    const pos = { x: 1.5, y: 1.5 };
    walkFreely(pos, { dx: 1, dy: 0 }, 20, blocked);
    expect(pos.x + BODY_RADIUS).toBeLessThan(6);
    expect(pos.x + BODY_RADIUS).toBeGreaterThan(5.85);
  });

  it("slides along a wall when walking into it diagonally", () => {
    const blocked = walls("#######", ".......", ".......");
    const pos = { x: 1.5, y: 1.5 };
    walkFreely(pos, { dx: Math.SQRT1_2, dy: -Math.SQRT1_2 }, 2, blocked);
    expect(pos.x).toBeGreaterThan(2.7);
    expect(pos.y - BODY_RADIUS).toBeGreaterThanOrEqual(1);
  });

  it("eases into a one-square gap the player walks at slightly off-line", () => {
    const blocked = walls("...#...", "###.###", ".......", ".......");
    const pos = { x: 3.92, y: 2.5 };
    walkFreely(pos, { dx: 0, dy: -1 }, 2, blocked);
    // Just far enough to fit through.
    expect(pos.x + BODY_RADIUS).toBeLessThanOrEqual(4);
    expect(pos.x).toBeGreaterThan(3.6);
    expect(pos.y).toBeLessThan(2);
  });

  it("does not slide when its own lane is closed", () => {
    const blocked = walls(".......", "###.###", ".......");
    const pos = { x: 2.9, y: 2.5 };
    walkFreely(pos, { dx: 0, dy: -1 }, 2, blocked);
    expect(pos.x).toBe(2.9);
    expect(pos.y - BODY_RADIUS).toBeGreaterThanOrEqual(2);
  });

  it("stops after the step that reaches a new square", () => {
    const pos = { x: 1.5, y: 1.5 };
    walkFreely(pos, { dx: 1, dy: 0 }, 3, () => false, p => Math.floor(p.x) !== 1);
    expect(Math.floor(pos.x)).toBe(2);
    expect(pos.x).toBeLessThan(2.13);
  });
});
