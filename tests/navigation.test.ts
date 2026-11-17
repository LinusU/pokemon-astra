import { describe, expect, it } from "vitest";
import {
  connectedBlocked,
  connectionAt,
  crossConnection,
} from "../src/game/navigation";
import { WORLD } from "../src/world";

describe("continuous outdoor connections", () => {
  it("carries sub-tile positions through both directions with no inset teleport", () => {
    const from = WORLD.dewdrop,
      exit = from.exits.find((e) => e.to === "route01")!;
    const x = from.width + 0.08,
      y = exit.y + 0.8;
    expect(connectionAt(from, x, y)).toBe(exit);
    const next = crossConnection(from, exit, x, y);
    expect(next.x).toBeCloseTo(0.08);
    expect(next.y).toBeCloseTo(exit.toY + 0.8);
    const back = WORLD.route01.exits.find((e) => e.to === "dewdrop")!;
    const returned = crossConnection(WORLD.route01, back, -0.08, next.y);
    expect(returned.x).toBeCloseTo(from.width - 0.08);
    expect(returned.y).toBeCloseTo(y);
  });
  it("allows the collision box to straddle an open connection, and respects locked edges", () => {
    const map = WORLD.dewdrop,
      exit = map.exits.find((e) => e.to === "route01")!;
    expect(
      connectedBlocked(map, map.width - 0.1, exit.y + 0.5, false, () => true),
    ).toBe(false);
    expect(
      connectedBlocked(map, map.width - 0.1, exit.y + 0.5, false, () => false),
    ).toBe(true);
    expect(
      connectedBlocked(map, map.width + 0.1, exit.y + 0.5, false, () => true),
    ).toBe(false);
    expect(
      connectedBlocked(map, map.width + 0.1, exit.y + 4, false, () => true),
    ).toBe(true);
  });
  it("preserves aligned cross-axis coordinates for every north/south connection", () => {
    for (const map of Object.values(WORLD))
      for (const exit of map.exits) {
        if (exit.direction !== "north" && exit.direction !== "south") continue;
        const x = exit.x + 0.7,
          y = exit.direction === "north" ? -0.04 : map.height + 0.04;
        const next = crossConnection(map, exit, x, y);
        expect(next.x).toBeCloseTo(exit.toX + 0.7);
        expect(next.y).toBeCloseTo(
          exit.direction === "north" ? WORLD[exit.to].height - 0.04 : 0.04,
        );
      }
  });
});
