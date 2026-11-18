import { describe, expect, it } from "vitest";
import {
  WorldActors,
  interactionTarget,
  terrainBlocked,
} from "../src/game/actors";
import type { WorldMap, WorldObject } from "../src/world";
const person: WorldObject = {
  id: "walker",
  kind: "person",
  name: "Walker",
  dialogue: "Hello",
  x: 3,
  y: 3,
  roam: 2,
  facing: "right",
};
const trainer: WorldObject = {
  id: "scout",
  kind: "trainer",
  name: "Scout",
  dialogue: "Let's battle",
  x: 3,
  y: 3,
  facing: "right",
  sightRange: 4,
  trainer: { id: "scout", name: "Scout", team: [{ species: 19, level: 3 }] },
};
const map = (objects: WorldObject[]): WorldMap => ({
  id: "test",
  name: "Test",
  width: 10,
  height: 10,
  kind: "town",
  palette: "meadow",
  exits: [],
  encounters: [],
  objects,
  tiles: Array.from({ length: 10 }, (_, y) =>
    y === 0 || y === 9 ? "##########" : "#........#",
  ),
});
describe("living overworld actors", () => {
  it("uses live positions and excludes completed pickups from the confirm target", () => {
    const item: WorldObject = {
      ...person,
      id: "pickup",
      kind: "item",
      x: 2,
      y: 3,
    };
    const m = map([person, item]);
    const actors = new WorldActors();
    actors.enter(m);
    const player = { x: 1.5, y: 3.5, facing: "right" };
    const target = (flags: string[]) =>
      interactionTarget(m, player, new Set(flags), (object) =>
        actors.position(object),
      );
    actors.states.walker.x = 2.8;
    expect(target([])).toBe(item);
    expect(target(["pickup"])).toBe(person);
    player.facing = "left";
    expect(target([])).toBeUndefined();
  });
  it("shares moving positions with collision and interaction", () => {
    const m = map([person]),
      actors = new WorldActors();
    actors.enter(m);
    for (let i = 0; i < 600; i++) actors.update(m, 0.02, { x: 8, y: 8 });
    const p = actors.position(person);
    expect(Math.hypot(p.x - 3.5, p.y - 3.5)).toBeGreaterThan(0.1);
    expect(actors.solid(m, p.x, p.y)).toBe(true);
    expect(terrainBlocked(m, p.x, p.y)).toBe(false);
    actors.face(person, p.x, p.y - 1);
    expect(actors.states.walker.facing).toBe("up");
  });
  it("only notices trainers along their unobstructed forward sight line", () => {
    const m = map([trainer]),
      actors = new WorldActors();
    actors.enter(m);
    expect(
      actors.spotTrainer(m, { x: 1.5, y: 3.5 }, () => true),
    ).toBeUndefined();
    expect(
      actors.spotTrainer(m, { x: 6.5, y: 5.5 }, () => true),
    ).toBeUndefined();
    expect(
      actors.spotTrainer(m, { x: 6.5, y: 3.5 }, () => false),
    ).toBeUndefined();
    m.tiles[3] = "#....#...#";
    expect(
      actors.spotTrainer(m, { x: 6.5, y: 3.5 }, () => true),
    ).toBeUndefined();
    m.tiles[3] = "#........#";
    expect(actors.spotTrainer(m, { x: 6.5, y: 3.5 }, () => true)?.id).toBe(
      "scout",
    );
    expect(actors.states.scout.notice).toBe(true);
  });
  it("uses the trainer's configured range on the same clear lane", () => {
    const scout = { ...trainer, sightRange: 2 };
    const m = map([scout]);
    const actors = new WorldActors();
    actors.enter(m);
    const player = { x: 6.5, y: 3.5 };
    expect(actors.spotTrainer(m, player, () => true)).toBeUndefined();
    scout.sightRange = 4;
    expect(actors.spotTrainer(m, player, () => true)).toBe(scout);
  });
  it("shows a notice before walking up, stops short of the player, then challenges", () => {
    const m = map([trainer]),
      actors = new WorldActors(),
      player = { x: 6.5, y: 3.5 };
    actors.enter(m);
    actors.spotTrainer(m, player, () => true);
    for (let i = 0; i < 20; i++) actors.approach(m, 0.02, player);
    expect(actors.states.scout.x).toBe(3.5);
    let challenged: WorldObject | undefined;
    for (let i = 0; i < 200 && !challenged; i++)
      challenged = actors.approach(m, 0.02, player);
    expect(challenged?.id).toBe("scout");
    expect(
      Math.hypot(
        actors.states.scout.x - player.x,
        actors.states.scout.y - player.y,
      ),
    ).toBeGreaterThanOrEqual(0.9);
    expect(actors.approaching).toBe(false);
  });
  it("does not let a wandering NPC move into the player", () => {
    const m = map([person]),
      actors = new WorldActors();
    actors.enter(m);
    const a = actors.states.walker;
    a.targetX = 4.5;
    a.targetY = 3.5;
    a.moving = true;
    actors.update(m, 0.1, { x: 4.2, y: 3.5 });
    expect(a.x).toBe(3.5);
    expect(a.moving).toBe(false);
  });
});

it("does not see through another person", () => {
  const blocker: WorldObject = { ...person, id: "blocker", x: 5, y: 3 };
  const m = map([trainer, blocker]),
    actors = new WorldActors();
  actors.enter(m);
  expect(actors.spotTrainer(m, { x: 7.5, y: 3.5 }, () => true)).toBeUndefined();
});
it("cancels a trainer approach when another actor blocks the way", () => {
  const blocker: WorldObject = { ...person, id: "blocker", x: 5, y: 5 };
  const m = map([trainer, blocker]),
    actors = new WorldActors(),
    player = { x: 6.5, y: 3.5 };
  actors.enter(m);
  expect(actors.spotTrainer(m, player, () => true)?.id).toBe("scout");
  actors.states.blocker.x = 4.5;
  actors.states.blocker.y = 3.5;
  let challenged: WorldObject | undefined;
  for (let i = 0; i < 100; i++) challenged ||= actors.approach(m, 0.05, player);
  expect(challenged).toBeUndefined();
  expect(actors.approaching).toBe(false);
});
