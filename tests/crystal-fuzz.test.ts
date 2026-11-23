/**
 * Runs every script of every map headless, with YES to every question and a
 * strong party, and collects what fails. Slow, so only on request:
 *   CRYSTAL_FUZZ=1 npx vitest run tests/crystal-fuzz.test.ts
 */
import { describe, expect, it } from "vitest";
import { CARTRIDGES, SUITES } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { C, MON } from "../src/crystal/symbols";
import { runScript } from "../src/crystal/script";
import { readTrainerHeader } from "../src/crystal/script";

const run = !!process.env.CRYSTAL_FUZZ;
describe.skipIf(!run || !hasEngine || !CARTRIDGES.length).each(SUITES)("Every script on %s", cart => {
  it("runs without errors", async () => {
    const h = await headlessGame(cart === "crystal" ? "crystal" : "crystal-legacy");
    const g = h.game;
    const errors = new Map<string, string>();
    const strong = () => [g.makeMon(MON.TYRANITAR, 100), g.makeMon(MON.LUGIA, 100)];
    const maps = g.rom.allMaps();
    const { engineEntries } = await import("../src/crystal/coverage");
    const engine = engineEntries(g.rom);
    let count = 0;
    for (const map of maps) {
      if (map.name.startsWith("BATTLE_TOWER_") && map.name !== "BATTLE_TOWER_OUTSIDE") continue;
      const scripts: { at: number; what: string }[] = [];
      map.scenes.forEach((at, i) => scripts.push({ at, what: `scene ${i}` }));
      map.coords.forEach((c, i) => scripts.push({ at: c.script, what: `coord ${i}` }));
      map.bgs.forEach((b, i) => {
        if (b.kind === C("BGEVENT_ITEM") || b.kind === C("BGEVENT_COPY")) return;
        const at = b.kind === C("BGEVENT_IFSET") || b.kind === C("BGEVENT_IFNOTSET") ? g.rom.at(map.bank, g.rom.u16(b.script + 2)) : b.script;
        scripts.push({ at, what: `bg ${i}` });
      });
      for (const o of map.objects) {
        if (o.type === C("OBJECTTYPE_SCRIPT")) scripts.push({ at: o.script, what: `object ${o.id}` });
        else if (o.type === C("OBJECTTYPE_TRAINER") && o.script >= 0x4000) scripts.push({ at: readTrainerHeader(g, o.script).after, what: `trainer ${o.id}` });
      }
      for (const s of [{ at: -1, what: "callbacks" }, ...scripts]) {
        g.save.party = strong();
        g.save.money = 50000;
        g.enterMap(map.group, map.number, { arrival: "warp" });
        g.place(0, Math.min(2, map.width * 2 - 1), Math.min(2, map.height * 2 - 1), "down");
        g.lastTalked = 1;
        h.ui.budget = 6;
        count++;
        try {
          await Promise.race([
            s.at < 0 ? g.mapCallbacks() : runScript(g, s.at),
            new Promise((_, reject) => setTimeout(() => reject(Error("timed out")), 5000)),
          ]);
          await g.runDeferred();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const key = message.replace(/\d+/g, "#");
          if (!errors.has(key)) errors.set(key, `${map.name} ${s.what}: ${message}`);
        }
        g.mode = "world";
        g.closeText();
      }
    }
    // Standard scripts, phone calls and the engine's helpers, from New Bark Town.
    const [group, number] = [maps.find(m => m.name === "NEW_BARK_TOWN")!.group, maps.find(m => m.name === "NEW_BARK_TOWN")!.number];
    for (const e of engine) {
      g.save.party = strong();
      g.enterMap(group, number, { arrival: "warp" });
      g.place(0, 5, 8, "down");
      h.ui.budget = 6;
      count++;
      try {
        await Promise.race([runScript(g, e.at), new Promise((_, reject) => setTimeout(() => reject(Error("timed out")), 5000))]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const key = message.replace(/\d+/g, "#");
        if (!errors.has(key)) errors.set(key, `${e.where}: ${message}`);
      }
      g.mode = "world";
    }
    console.log(`${count} scripts on ${maps.length} maps`);
    console.log([...errors.values()].join("\n"));
    expect([...errors.values()]).toEqual([]);
  }, 600000);
});
