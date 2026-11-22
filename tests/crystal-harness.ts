/** A headless Crystal game for tests: the real runtime and engine, with dialogue answered automatically. */
import { existsSync, readFileSync } from "node:fs";
import { Engine } from "../src/engine";
import { CrystalGame } from "../src/crystal/runtime";
import { freshCrystalSave, type CrystalAdventure } from "../src/crystal/save";
import { HeadlessUi } from "../src/crystal/ui";
import { MAP } from "../src/crystal/symbols";
import { cartridge, cartridgeBytes } from "./crystal-fixtures";
import type { Facing } from "../src/crystal/world";

export const hasEngine = existsSync("public/astra_native.wasm");
let wasm: WebAssembly.Instance | undefined;

export class FakeInput {
  dir?: Facing;
  pressed = new Set<string>();
  confirmLabel = "A";
  held(a: string) { return a === this.dir; }
  hit(a: string) { const had = this.pressed.has(a); this.pressed.delete(a); return had; }
  setGamepadLayout() {}
  update() {}
}

export async function headlessGame(adventure: CrystalAdventure, options: { hour?: number; day?: number } = {}) {
  const rom = await cartridge(adventure === "crystal" ? "crystal" : "legacy");
  wasm ??= (await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {})).instance;
  const engine = new Engine(wasm.exports as never, cartridgeBytes("crystal"));
  const save = freshCrystalSave(adventure, "GOLD", 0, "???");
  const [group, number] = MAP.PLAYERS_HOUSE_2F;
  Object.assign(save, { map: [group, number], x: 3, y: 3, facing: "up", spawn: { group, number } });
  save.settings.movement = "grid";
  const ui = new HeadlessUi();
  const input = new FakeInput();
  const hour = options.hour ?? 12;
  const day = options.day ?? 18;
  const game = new CrystalGame({ engine, rom, input: input as never, save, ui, now: () => new Date(2026, 10, day, hour, 30) });
  await game.begin();
  let clock = 0;
  const settle = async () => {
    for (let i = 0; i < 5000; i++) {
      await new Promise(r => setTimeout(r, 0));
      if (game.mode === "world") return;
    }
    throw Error(`Stuck in ${game.mode} on ${game.map.name}`);
  };
  /** Holds a direction for one frame: one square, as on the Game Boy. */
  const step = async (dir: Facing) => {
    await settle();
    input.dir = dir;
    game.frame((clock += 50), 0.05);
    input.dir = undefined;
    await settle();
    for (let i = 0; i < 40 && (game.me.from || game.mode !== "world"); i++) {
      game.frame((clock += 50), 0.05);
      await settle();
    }
  };
  const press = async (action: string) => {
    input.pressed.add(action);
    game.frame((clock += 50), 0.05);
    await settle();
    input.pressed.clear();
  };
  /** Walks a path like "U3 R2 D". */
  const walk = async (path: string) => {
    for (const m of path.toUpperCase().matchAll(/([UDLR])(\d*)/g)) {
      const dir = ({ U: "up", D: "down", L: "left", R: "right" } as const)[m[1] as "U"];
      for (let i = 0; i < (m[2] ? +m[2] : 1); i++) await step(dir);
    }
  };
  /** Walks to a square on the current map by the shortest open path. */
  const goto = async (x: number, y: number) => {
    const start = `${game.me.x},${game.me.y}`, key = (a: number, b: number) => `${a},${b}`;
    const prev = new Map<string, [string, Facing]>([[start, ["", "down"]]]);
    const queue: [number, number][] = [[game.me.x, game.me.y]];
    while (queue.length) {
      const [cx, cy] = queue.shift()!;
      if (cx === x && cy === y) break;
      for (const [dir, [dx, dy]] of Object.entries({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }) as [Facing, [number, number]][]) {
        const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
        if (prev.has(k) || !game.world.inside(game.map, nx, ny)) continue;
        if (!(nx === x && ny === y) && (game.blocked(nx, ny) || !game.passable(nx, ny, { x: cx, y: cy }))) continue;
        // Warps that take the player on arrival lead away: only the destination may be one (doormats only lead out when walked off).
        const coll = game.world.collision(game.map, nx, ny);
        if (!(nx === x && ny === y) && game.world.warpAt(game.map, nx, ny) >= 0 && game.world.isWarp(coll) && !game.world.carpet(coll)) continue;
        prev.set(k, [key(cx, cy), dir]);
        queue.push([nx, ny]);
      }
    }
    if (!prev.has(key(x, y))) throw Error(`No path to ${x},${y} on ${game.map.name}`);
    const dirs: Facing[] = [];
    for (let k = key(x, y); k !== start; k = prev.get(k)![0]) dirs.unshift(prev.get(k)![1]);
    const map = game.map.name;
    for (const d of dirs) {
      await step(d);
      if (game.map.name !== map) return;
    }
  };
  /** Faces a direction and presses A. */
  const talk = async (dir: Facing) => {
    game.me.facing = dir;
    await press("a");
  };
  return { game, ui, input, step, walk, goto, talk, press, settle, engine, rom };
}
