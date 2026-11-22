/**
 * Draws a few places with the Crystal renderer in Node and writes PNGs, to
 * look at the decoded tiles, palettes and sprites without a browser:
 *   CRYSTAL_RENDER=/some/dir npx vitest run tests/crystal-render.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { CARTRIDGES } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { FakeCanvas, installCanvas, png } from "./canvas-shim";
import { CrystalRenderer } from "../src/crystal/render";
import { MAP } from "../src/crystal/symbols";

const out = process.env.CRYSTAL_RENDER;
const PLACES: [string, number, number, number][] = [
  ["NEW_BARK_TOWN", 13, 6, 12], ["NEW_BARK_TOWN", 13, 6, 21], ["ELMS_LAB", 4, 8, 12], ["ROUTE_29", 30, 8, 12], ["CHERRYGROVE_CITY", 29, 5, 7],
  ["VIOLET_CITY", 18, 18, 12], ["SPROUT_TOWER_1F", 9, 14, 12], ["GOLDENROD_CITY", 24, 20, 12], ["UNION_CAVE_1F", 6, 20, 12],
  ["ECRUTEAK_CITY", 18, 22, 19], ["OLIVINE_CITY", 13, 20, 12], ["GOLDENROD_POKECENTER_1F", 3, 6, 12], ["SAFFRON_CITY", 18, 22, 12],
];
describe.skipIf(!out || !hasEngine || !CARTRIDGES.length).each(CARTRIDGES)("Crystal pictures on %s", cart => {
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
