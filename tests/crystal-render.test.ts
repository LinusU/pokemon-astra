/**
 * Draws a few places with the Crystal renderer in Node and writes PNGs, to
 * look at the decoded tiles, palettes and sprites without a browser:
 *   CRYSTAL_RENDER=/some/dir npx vitest run tests/crystal-render.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CARTRIDGES, SUITES } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { FakeCanvas, installCanvas, png } from "./canvas-shim";
import { CrystalRenderer } from "../src/crystal/render";
import { C, MAP } from "../src/crystal/symbols";

describe.skipIf(!hasEngine || !CARTRIDGES.length).each(SUITES)("Route 36 rendering on %s", cart => {
  it("jiggles Sudowoodo when the player talks to it without a SquirtBottle", async () => {
    installCanvas();
    const { game, input } = await headlessGame(cart === "crystal" ? "crystal" : "crystal-legacy");
    game.enterMap(...MAP.ROUTE_36, { arrival: "warp" });
    await game.mapCallbacks();
    const tree = game.objects.find(o => o.visible && game.spriteOf(o) === C("SPRITE_SUDOWOODO"))!;
    game.place(0, tree.x, tree.y + 1, "up");

    const canvas = new FakeCanvas();
    canvas.width = 320;
    canvas.height = 240;
    game.ctx.canvas = canvas as unknown as HTMLCanvasElement;
    const renderer = game.renderer = new CrystalRenderer(game, game.ctx.canvas);
    const draw = vi.spyOn(canvas.getContext(), "drawImage");
    const frames: FakeCanvas[] = [];
    const record = () => {
      const treeDraw = draw.mock.calls.find(([sprite, x, y]) => sprite.width === 16 && sprite.height === 16 && x === 152 && y === 92);
      expect(treeDraw).toBeDefined();
      const sprite = treeDraw![0];
      if (sprite !== frames[frames.length - 1]) frames.push(sprite);
      draw.mockClear();
    };
    renderer.render(0);
    record();
    input.pressed.add("a");
    for (let frame = 1; frame <= 90; frame++) {
      game.frame(frame * 1000 / 60, 1 / 60);
      record();
      await new Promise(resolve => setTimeout(resolve, 0));
      if (game.mode === "world") break;
    }
    expect(game.mode).toBe("world");
    renderer.render(0);
    record();
    expect(frames.map(frame => frames.indexOf(frame))).toEqual([0, 1, 0, 3, 0, 1, 0]);
    const idle = frames[0].pixels.data, left = frames[1].pixels.data, right = frames[3].pixels.data;
    expect(left).not.toEqual(idle);
    expect(right).not.toEqual(left);
    const mirrored = new Uint8ClampedArray(left.length);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const leftPixel = (y * 16 + x) * 4, rightPixel = (y * 16 + 15 - x) * 4;
        mirrored.set(left.subarray(leftPixel, leftPixel + 4), rightPixel);
      }
    }
    expect(right).toEqual(mirrored);
  });
});

const out = process.env.CRYSTAL_RENDER;
const PLACES: [string, number, number, number][] = [
  ["NEW_BARK_TOWN", 13, 6, 12], ["NEW_BARK_TOWN", 13, 6, 21], ["ELMS_LAB", 4, 8, 12], ["ROUTE_29", 30, 8, 12], ["CHERRYGROVE_CITY", 29, 5, 7],
  ["VIOLET_CITY", 18, 18, 12], ["SPROUT_TOWER_1F", 9, 14, 12], ["GOLDENROD_CITY", 24, 20, 12], ["UNION_CAVE_1F", 6, 20, 12],
  ["ECRUTEAK_CITY", 18, 22, 19], ["OLIVINE_CITY", 13, 20, 12], ["GOLDENROD_POKECENTER_1F", 3, 6, 12], ["SAFFRON_CITY", 18, 22, 12],
];
describe.skipIf(!out || !hasEngine || !CARTRIDGES.length).each(SUITES)("Crystal pictures on %s", cart => {
  it("draws places", async () => {
    installCanvas();
    mkdirSync(out!, { recursive: true });
    for (const [name, x, y, hour] of PLACES) {
      const h = await headlessGame(cart === "crystal" ? "crystal" : "crystal-legacy", { hour });
      const [group, number] = MAP[name];
      h.game.enterMap(group, number, { arrival: "warp" });
      await h.game.mapCallbacks();
      h.game.place(0, x, y, "down");
      const canvas = new FakeCanvas();
      canvas.width = 320;
      canvas.height = 240;
      const r = new CrystalRenderer(h.game, canvas as unknown as HTMLCanvasElement);
      r.render(1000);
      writeFileSync(`${out}/${cart}-${name.toLowerCase()}-${hour}.png`, png(canvas));
    }
  }, 120000);
});
