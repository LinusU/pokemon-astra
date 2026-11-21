/**
 * Development-only helpers for driving Yellow journeys from the browser
 * console: real movement and interactions, frame by frame.
 */
import type { YellowGame } from "./runtime";
import type { Facing } from "./world";

const channel = new MessageChannel();
const yieldTask = () => new Promise<void>(resolve => {
  channel.port1.onmessage = () => resolve();
  channel.port2.postMessage(0);
});

export function attachDebug(game: YellowGame) {
  const g = game as unknown as Record<string, any>;
  let clock = performance.now();
  const log: string[] = [];
  const api = {
    game,
    log,
    /** Answer for yes/no prompts and choice menus while pumping. */
    answer: { yes: true, choice: 0 },
    async frames(count = 1) {
      for (let i = 0; i < count; i++) {
        clock += 33;
        game.frame(clock, 1 / 30);
        await yieldTask();
      }
    },
    /** Runs frames, reading text and answering prompts, until the player has control again. */
    async settle(limit = 3000) {
      for (let i = 0; i < limit; i++) {
        await api.frames();
        const text = (game.layer.innerText || "").replace(/\s+/g, " ").trim();
        if (text && log[log.length - 1] !== text) log.push(text.slice(0, 160));
        if (g.mode === "text") g.advanceText();
        else if (g.yesNoResolve) g.yesNoResolve(api.answer.yes);
        else if (g.showcaseNext) g.showcaseNext();
        else if (g.mode === "menu") {
          const pick = game.layer.querySelectorAll<HTMLButtonElement>("[data-choice]")[api.answer.choice];
          (pick ?? game.layer.querySelector<HTMLButtonElement>("#continue, #confirm, #back, #close, button"))?.click();
        }
        if (g.mode === "world" && !g.me.from && i > 2) return true;
      }
      return false;
    },
    async step(dir: Facing, count = 1) {
      for (let i = 0; i < count; i++) {
        if (g.me.facing !== dir) g.me.facing = dir;
        g.tryStep(dir);
        await api.settle();
      }
      return api.where();
    },
    async walk(path: string) {
      for (const m of path.toUpperCase().matchAll(/([UDLR])(\d*)/g))
        await api.step(({ U: "up", D: "down", L: "left", R: "right" } as const)[m[1] as "U"], m[2] ? +m[2] : 1);
      return api.where();
    },
    async talk(dir?: Facing) {
      if (dir) g.me.facing = dir;
      void game.runScript(async () => {
        await g.interact();
        await g.afterControl();
      });
      await api.settle();
      return log.slice(-6);
    },
    async warp(map: string, x: number, y: number) {
      game.debugWarp(map, x, y);
      await api.settle();
      return api.where();
    },
    /** Walks to a square on the current map with breadth-first search over passable squares. */
    async goto(x: number, y: number, tries = 4): Promise<string> {
      const map = g.header, world = g.world;
      const { w, h } = world.cells(map);
      const key = (a: number, b: number) => a * 1000 + b;
      const prev = new Map<number, [number, number, Facing]>();
      const start = [g.me.x, g.me.y];
      const queue: [number, number][] = [[start[0], start[1]]];
      prev.set(key(start[0], start[1]), [-1, -1, "down"]);
      const dirs: [Facing, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];
      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        if (cx === x && cy === y) break;
        for (const [dir, dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev.has(key(nx, ny))) continue;
          const target = nx === x && ny === y;
          if (!world.passable(map, nx, ny) && !(g.save.surfing && world.isWater(map, nx, ny))) continue;
          if (!target && map.warps.some((wp: { x: number; y: number }) => wp.x === nx && wp.y === ny)) continue;
          if (g.npcs.some((n: { hidden: boolean; x: number; y: number }) => !n.hidden && n.x === nx && n.y === ny)) continue;
          if (world.pairBlocked(map, world.tile(map, cx, cy), world.tile(map, nx, ny))) continue;
          prev.set(key(nx, ny), [cx, cy, dir]);
          queue.push([nx, ny]);
        }
      }
      if (!prev.has(key(x, y))) return `no path to ${x},${y} from ${api.where()}`;
      const path: Facing[] = [];
      for (let k = key(x, y); ;) {
        const [px, py, dir] = prev.get(k)!;
        if (px < 0) break;
        path.unshift(dir);
        k = key(px, py);
      }
      for (const dir of path) {
        const before = api.where();
        await api.step(dir);
        if (g.header !== map) return api.where();
        if (api.where() === before && tries > 0) return api.goto(x, y, tries - 1);
      }
      return api.where();
    },
    where: () => `${game.mapLabel} ${g.me.x},${g.me.y} ${g.me.facing} ${g.mode}`,
    /** A strong team for checking story flow rather than balance. */
    strongTeam(level = 70) {
      const dexes = [25, 6, 9, 3, 65, 143];
      game.save.party = dexes.map(dex => game.makeMon(dex, level));
      game.save.vars.pikachuStarter = 1;
      game.follower(true);
    },
  };
  game.autoBattle = true;
  (window as unknown as { yq: typeof api }).yq = api;
  return api;
}
