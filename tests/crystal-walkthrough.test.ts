/**
 * Plays Crystal Legacy's story headless, map by map, on the cartridge's own
 * scripts and the battle engine. Slow, so only on request:
 *   CRYSTAL_WALKTHROUGH=1 npx vitest run tests/crystal-walkthrough.test.ts
 * CRYSTAL_WALKTHROUGH_LOG=file writes the dialogue to a file.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasLegacy } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { C, CONST, ITEM, MAP, MON } from "../src/crystal/symbols";
import type { Obj } from "../src/crystal/runtime";
import { STEP, type Facing } from "../src/crystal/world";
import { readTrainerHeader } from "../src/crystal/script";

type Harness = Awaited<ReturnType<typeof headlessGame>>;

/** Story helpers over the headless harness. */
function walker(h: Harness) {
  const g = h.game;
  const log: string[] = [];
  let seen = 0;
  const flush = (title: string) => {
    log.push(`=== ${title} (${g.map.name} ${g.me.x},${g.me.y})`, ...h.ui.log.slice(seen));
    seen = h.ui.log.length;
  };
  const sprite = (name: string) => C(`SPRITE_${name}`);
  const where = () => `${g.map.name} ${g.me.x},${g.me.y}`;
  return {
    log, flush, where,
    /** Teleports onto a map square, running its callbacks and scene script as an arrival would. */
    async warp(map: string, x: number, y: number, facing: Facing = "down") {
      const [group, number] = MAP[map];
      await g.runScript(async () => {
        await g.warpTo(group, number, x, y, facing);
        await g.afterArrival(true);
      });
      await h.settle();
      expect(g.map.name).toBe(map);
    },
    /** Walks to a square on the current map. */
    async to(x: number, y: number) {
      await h.goto(x, y);
    },
    /** Walks onto a doormat and off it, out of the building. */
    async leave(x: number, y: number, dir: Facing = "down") {
      const map = g.map.name;
      await h.goto(x, y);
      if (g.map.name === map) await h.step(dir);
      expect(g.map.name).not.toBe(map);
    },
    /** A visible person on the map by sprite (and optionally position). */
    find(name: string, near?: { x: number; y: number }) {
      const s = sprite(name);
      const list = g.objects.filter(o => o.visible && g.spriteOf(o) === s);
      if (!list.length) throw Error(`No ${name} on ${g.map.name}: ${g.objects.filter(o => o.visible).map(o => `${o.event.sprite}@${o.x},${o.y}`).join(" ")}`);
      if (near) list.sort((a, b) => Math.abs(a.x - near.x) + Math.abs(a.y - near.y) - Math.abs(b.x - near.x) - Math.abs(b.y - near.y));
      return list[0];
    },
    /** Walks next to a person and talks to them. */
    async talk(o: Obj | string, near?: { x: number; y: number }) {
      const target = typeof o === "string" ? this.find(o, near) : o;
      const sides = (Object.entries(STEP) as [Facing, [number, number]][])
        .map(([dir, [dx, dy]]) => ({ x: target.x - dx, y: target.y - dy, face: dir }))
        .filter(s => g.world.inside(g.map, s.x, s.y));
      let last: unknown;
      for (const s of sides) {
        // A counter between the player and a clerk: talk across it.
        try {
          // A trainer who spots the player on the way can leave the path blocked: plan again.
          for (let i = 0; i < 4 && (g.me.x !== s.x || g.me.y !== s.y); i++) await h.goto(s.x, s.y);
          if (g.me.x !== s.x || g.me.y !== s.y) continue;
        } catch (e) { last = e; continue; }
        // Talk as pressing A does, waiting for the whole script (and letting its errors through).
        g.me.facing = s.face;
        await g.runScript(() => g.interact());
        await h.settle();
        return;
      }
      // Across a counter.
      for (const [dir, [dx, dy]] of Object.entries(STEP) as [Facing, [number, number]][]) {
        const x = target.x - 2 * dx, y = target.y - 2 * dy;
        if (!g.world.inside(g.map, x, y)) continue;
        try {
          await h.goto(x, y);
          if (g.me.x !== x || g.me.y !== y) continue;
        } catch (e) { last = e; continue; }
        g.me.facing = dir;
        await g.runScript(() => g.interact());
        await h.settle();
        return;
      }
      throw Error(`Can't reach ${g.spriteOf(target)} at ${target.x},${target.y} on ${where()}: ${last}`);
    },
    /** Presses A facing a direction (signs, machines, counters). */
    async inspect(face: Facing) {
      await h.talk(face);
      await h.settle();
    },
    ev(name: string) { return g.ev(name); },
    /** Talks to every trainer on the map who hasn't been beaten yet. */
    async beatTrainers() {
      for (let i = 0; i < 12; i++) {
        const t = g.objects.find(o => o.visible && o.event.type === C("OBJECTTYPE_TRAINER") && o.event.script >= 0x4000 && !g.event(readTrainerHeader(g, o.event.script).flag));
        if (!t) return;
        const from = `${g.me.x},${g.me.y}`;
        await this.talk(t);
        if (process.env.WALK_DEBUG) console.log(`trainer ${t.x},${t.y} from ${from} -> ${g.me.x},${g.me.y} facing ${g.me.facing}`);
        if (!g.event(readTrainerHeader(g, t.event.script).flag)) throw Error(`Trainer at ${t.x},${t.y} on ${where()} wasn't beaten: result ${g.battleResult}, party ${g.save.party.map(m => `${m.species}:${m.hp}/${m.stats[0]}`).join(" ")}`);
      }
    },
    /** Makes the party strong enough to win every battle on the engine's auto-play. */
    strengthen(level = 70) {
      g.save.party = g.save.party.map(m => (m.egg ? m : { ...g.makeMon(m.species, Math.max(level, m.level)), nickname: m.nickname, item: m.item }));
      g.heal();
    },
    has(item: string) { return g.itemCount(ITEM[item] ?? C(item)) > 0; },
  };
}

const run = !!process.env.CRYSTAL_WALKTHROUGH;
describe.skipIf(!run || !hasEngine || !hasLegacy)("Crystal Legacy's story", () => {
  it("plays from New Bark Town onwards", async () => {
    const h = await headlessGame("crystal-legacy");
    const g = h.game, w = walker(h);
    try {
      // ------------------------------------------------------------ New Bark Town
      await h.walk("R4 U3");
      await h.walk("D4");
      expect(g.hasFlag("ENGINE_POKEGEAR")).toBe(true);
      w.flush("Mom");
      await h.goto(7, 7);
      await h.step("down");
      const lab = g.map.warps[0];
      await h.goto(lab.x, lab.y);
      expect(g.map.name).toBe("ELMS_LAB");
      w.flush("Elm's lab");
      // Cyndaquil's ball.
      await w.talk(g.objects.find(o => o.visible && o.event.sprite === C("SPRITE_POKE_BALL"))!);
      expect(g.save.party.length).toBe(1);
      w.flush("Starter");
      // The aide hands over a Potion on the way out.
      await w.to(4, 8);
      w.flush("Aide's potion");
      await w.leave(4, 11);
      expect(g.map.name).toBe("NEW_BARK_TOWN");
      w.strengthen(20);

      // ------------------------------------------------------------ Route 29 to Cherrygrove
      await w.warp("CHERRYGROVE_CITY", 39, 7, "left");
      await w.talk("GRAMPS");
      w.flush("Guide gent");
      expect(g.hasFlag("ENGINE_MAP_CARD")).toBe(true);

      // ------------------------------------------------------------ Mr. Pokémon
      await w.warp("MR_POKEMONS_HOUSE", 3, 7, "up");
      w.flush("Mr. Pokémon arrives");
      await w.talk("GENTLEMAN");
      w.flush("Mr. Pokémon");
      expect(w.has("MYSTERY_EGG")).toBe(true);
      expect(g.hasFlag("ENGINE_POKEDEX")).toBe(true);
      await w.leave(3, 7);
      expect(g.map.name).toBe("ROUTE_30");
      w.flush("Leaving Mr. Pokémon");

      // ------------------------------------------------------------ The catching tutorial on Route 29
      await w.warp("ROUTE_29", 56, 8, "left");
      await w.to(53, 8);
      w.flush("Route 29 tutorial");

      // ------------------------------------------------------------ The rival in Cherrygrove
      await w.warp("CHERRYGROVE_CITY", 30, 7, "right");
      await w.to(33, 7);
      w.flush("Rival in Cherrygrove");
      expect(w.ev("EVENT_RIVAL_CHERRYGROVE_CITY")).toBe(true);

      // ------------------------------------------------------------ Back to Elm
      await w.warp("NEW_BARK_TOWN", 6, 4, "up");
      await h.step("up");
      expect(g.map.name).toBe("ELMS_LAB");
      w.flush("Officer in Elm's lab");
      await w.talk("ELM");
      w.flush("Elm takes the Egg");
      expect(w.has("MYSTERY_EGG")).toBe(false);
      await w.to(4, 8);
      w.flush("Aide's Poké Balls");
      expect(w.has("POKE_BALL")).toBe(true);

      // ------------------------------------------------------------ Violet City: Sprout Tower
      w.strengthen(25);
      await w.warp("SPROUT_TOWER_3F", 10, 13, "up");
      await w.to(11, 9);
      w.flush("Rival in Sprout Tower");
      await w.talk("SAGE", { x: 10, y: 2 });
      w.flush("Elder Li");
      expect(w.has("HM_FLASH")).toBe(true);

      // ------------------------------------------------------------ Falkner
      await w.warp("VIOLET_GYM", 4, 13, "up");
      await w.talk("FALKNER");
      w.flush("Falkner");
      expect(g.hasFlag("ENGINE_ZEPHYRBADGE")).toBe(true);
      expect(w.has("TM_MUD_SLAP")).toBe(true);
      await w.leave(4, 15);
      expect(g.map.name).toBe("VIOLET_CITY");
      // Elm calls once the player is outdoors: his aide is waiting at the Pokémon Center.
      for (let i = 0; i < 6 && !w.ev("EVENT_ELMS_AIDE_IN_LAB"); i++) await h.step(i % 2 ? "up" : "down");
      w.flush("Elm's call about the Egg");
      expect(w.ev("EVENT_ELMS_AIDE_IN_VIOLET_POKEMON_CENTER")).toBe(false);
      await w.warp("VIOLET_POKECENTER_1F", 3, 6, "up");
      await w.talk("SCIENTIST");
      w.flush("Aide's Togepi Egg");
      expect(w.ev("EVENT_GOT_TOGEPI_EGG_FROM_ELMS_AIDE")).toBe(true);
      expect(g.save.party.some(m => m.egg)).toBe(true);

      // ------------------------------------------------------------ Route 32 to Union Cave
      await w.warp("ROUTE_32", 18, 6, "down");
      await w.to(18, 8);
      w.flush("Route 32 Miracle Seed");
      await w.warp("ROUTE_32_POKECENTER_1F", 3, 6, "up");
      w.flush("Route 32 Pokémon Center");
      await w.warp("ROUTE_32", 7, 72, "up");
      await w.to(7, 71);
      w.flush("Slowpoke Tail salesman");

      // ------------------------------------------------------------ Azalea Town: Kurt and the Slowpoke Well
      w.strengthen(35);
      await w.warp("UNION_CAVE_1F", 17, 4, "down");
      await w.warp("AZALEA_TOWN", 15, 10, "down");
      w.flush("Azalea Town");
      await w.warp("KURTS_HOUSE", 3, 6, "up");
      await w.talk("KURT");
      w.flush("Kurt runs to the well");
      expect(w.ev("EVENT_AZALEA_TOWN_SLOWPOKETAIL_ROCKET")).toBe(true);
      await w.warp("SLOWPOKE_WELL_B1F", 17, 14, "up");
      w.flush("Slowpoke Well entrance");
      if (g.objects.some(o => o.visible && g.spriteOf(o) === C("SPRITE_KURT"))) await w.talk("KURT");
      w.flush("Kurt in the well");
      await w.beatTrainers();
      w.flush("Team Rocket in the well");
      expect(w.ev("EVENT_CLEARED_SLOWPOKE_WELL")).toBe(true);
      await w.warp("KURTS_HOUSE", 3, 6, "up");
      await w.talk("KURT");
      w.flush("Kurt's Lure Ball");
      expect(w.has("LURE_BALL")).toBe(true);

      // ------------------------------------------------------------ Bugsy and the rival
      await w.warp("AZALEA_GYM", 4, 13, "up");
      await w.talk("BUGSY");
      w.flush("Bugsy");
      expect(g.hasFlag("ENGINE_HIVEBADGE")).toBe(true);
      await w.warp("AZALEA_TOWN", 7, 10, "left");
      await w.to(5, 10);
      w.flush("Rival in Azalea");
      expect(w.ev("EVENT_RIVAL_AZALEA_TOWN")).toBe(true);
    } finally {
      w.flush("end");
      if (process.env.CRYSTAL_WALKTHROUGH_LOG) writeFileSync(process.env.CRYSTAL_WALKTHROUGH_LOG, w.log.join("\n"));
      console.log(`Stopped at ${w.where()}`);
    }
    void CONST; void MON;
  }, 600000);
});
