import { describe, expect, it } from "vitest";
import {
  barrierTarget,
  connectedBlocked,
  connectionAt,
  crossConnection,
  exitAt,
  exitOpen,
} from "../src/game/navigation";
import { WORLD, type Requirement } from "../src/world";
import { freshSave, meetsRequirement } from "../src/game/save";
import { directions } from "../src/game/journal";
import { localStops } from "../src/ui/field-map";

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

describe("field barriers", () => {
  it("blocks all lanes of a locked road and supports deliberate field actions", () => {
    const map = WORLD.bramble;
    const exit = map.exits.find((e) => e.to === "route04")!;
    const open =
      (requirementsMet: boolean, flags: string[] = []) =>
      (e: typeof exit) =>
        exitOpen(e, (req) => !req || requirementsMet, flags);
    for (const yy of [-1, 0, 1].map((d) => exit.y + 0.5 + d)) {
      expect(connectedBlocked(map, exit.x + 0.5, yy, false, open(false))).toBe(
        true,
      );
      expect(connectedBlocked(map, exit.x + 0.5, yy, false, open(true))).toBe(
        true,
      );
      expect(
        connectedBlocked(
          map,
          exit.x + 0.5,
          yy,
          false,
          open(true, [exit.barrier!.flag!]),
        ),
      ).toBe(false);
    }
    const approach = { x: exit.x - 0.5, y: exit.y + 0.5, facing: "right" };
    expect(
      connectedBlocked(map, approach.x, approach.y, false, open(false)),
    ).toBe(false);
    expect(barrierTarget(map, approach, open(false))).toBe(exit);
    expect(
      barrierTarget(map, { ...approach, facing: "left" }, open(false)),
    ).toBeUndefined();
    expect(
      barrierTarget(map, approach, open(true, [exit.barrier!.flag!])),
    ).toBeUndefined();
  });

  it("swims through open water crossings and stops at closed buoys", () => {
    const map = WORLD.tideglass;
    const exit = map.exits.find((e) => e.to === "route06")!;
    const open = (e: typeof exit) => exitOpen(e, () => true, []);
    const player = { x: exit.x - 0.5, y: exit.y + 0.5, facing: "right" };
    expect(barrierTarget(map, player, () => false)).toBe(exit);
    expect(connectedBlocked(map, exit.x + 0.5, exit.y + 0.5, false, open)).toBe(
      true,
    );
    expect(connectedBlocked(map, exit.x + 0.5, exit.y + 0.5, true, open)).toBe(
      false,
    );
    expect(
      connectedBlocked(map, exit.x + 0.5, exit.y + 0.5, true, () => false),
    ).toBe(true);
  });

  it("lands inside a closed reciprocal road after backtracking from an old save", () => {
    const map = WORLD.route04;
    const exit = map.exits.find((e) => e.to === "bramble")!;
    const isOpen = (e: typeof exit) => !e.barrier;
    const arrival = crossConnection(map, exit, -0.03, exit.y + 0.5, isOpen);
    expect(
      connectedBlocked(WORLD.bramble, arrival.x, arrival.y, false, isOpen),
    ).toBe(false);
  });

  it("lands safely past the Cinderfall rockslide when running out of Old Quarry", () => {
    const quarry = WORLD.route23;
    const exit = quarry.exits.find(e => e.to === "cinderfall")!;
    const save = freshSave();
    save.abilities.push("strength");
    const open = (e: typeof exit) => exitOpen(e, r => meetsRequirement(save, r), save.flags);
    const x = quarry.width + 0.9, y = exit.y + 1.5;
    expect(connectedBlocked(quarry, x, y, false, open)).toBe(false);
    const arrival = crossConnection(quarry, exit, x, y, open);
    expect(arrival.y).toBe(exit.toY + 1.5);
    expect(connectedBlocked(WORLD.cinderfall, arrival.x, arrival.y, false, open)).toBe(false);
    expect(connectedBlocked(WORLD.cinderfall, 0.5, arrival.y, false, open)).toBe(true);
  });

  it("allows both mat tiles to exit to the same outdoor approach", () => {
    for (const map of Object.values(WORLD)) {
      for (const exit of map.exits.filter((e) => e.entrance === "mat")) {
        const town = WORLD[exit.to];
        const door = town.exits.find((e) => e.to === map.id)!;
        const interior = crossConnection(town, door, 0, 0);
        expect(exit.width, map.id).toBe(2);
        expect(interior.y).toBe(exit.y - 0.5);
        for (const x of [exit.x + 0.5, exit.x + 1.5]) {
          const y = exit.y + 0.5;
          expect(exitAt(map, x, y), map.id).toBe(exit);
          expect(connectedBlocked(map, x, y, false, () => true), map.id).toBe(false);
          expect(connectedBlocked(map, x, y - 1, false, () => true), map.id).toBe(false);
          const exterior = crossConnection(map, exit, x, y);
          expect(exterior).toEqual({ x: door.x + 0.5, y: door.y + 1.5 });
          expect(connectedBlocked(town, exterior.x, exterior.y, false, () => true), town.id).toBe(false);
        }
        expect(
          connectedBlocked(map, interior.x, interior.y, false, () => true),
          map.id,
        ).toBe(false);
      }
    }
  });
});

it("charts the Cut crossing as closed, clearable, then open after the field action", () => {
  const map = WORLD.dewdrop;
  const save = freshSave();
  const allowed = (r?: Requirement) => meetsRequirement(save, r);
  const exit = map.exits.find(e => e.to === "route21")!;
  const stops = () => localStops(map, save, directions(save, allowed), allowed);
  const crossing = () => stops().find(stop => stop.pin === exit)!;
  expect(crossing().gate).toBe("Closed");
  save.abilities.push("cut");
  expect(crossing()).toMatchObject({gate: "Clearable", note: "Use Cut at the crossing."});
  save.flags.push(exit.barrier!.flag!);
  expect(crossing().gate).toBeUndefined();
  expect(stops()[0].pin).toBe(map.exits.find(e => e.to === "lab"));
  expect(stops().find(stop => stop.kind === "Landmark")?.pin).toBe(map.objects.find(o => o.id === "sign_dewdrop"));
});
