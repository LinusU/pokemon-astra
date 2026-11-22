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
import { C, CONST, ITEM, MAP, MON, MOVE, RAM } from "../src/crystal/symbols";
import type { Obj } from "../src/crystal/runtime";
import { STEP, type Facing } from "../src/crystal/world";
import { readTrainerHeader } from "../src/crystal/script";

type Harness = Awaited<ReturnType<typeof headlessGame>>;

/** Story helpers over the headless harness. */
function walker(h: Harness) {
  const g = h.game;
  const log: string[] = [];
  const flush = (title: string) => {
    log.push(`=== ${title} (${g.map.name} ${g.me.x},${g.me.y})`, ...h.ui.log);
    h.ui.log.length = 0;
  };
  const sprite = (name: string) => C(`SPRITE_${name}`);
  const where = () => `${g.map.name} ${g.me.x},${g.me.y}`;
  return {
    log, flush, where,
    /** Teleports onto a map square, running its callbacks and scene script as an arrival would. */
    async warp(map: string, x: number, y: number, facing: Facing = "down", options: { stay?: boolean } = {}) {
      const [group, number] = MAP[map];
      await g.runScript(async () => {
        await g.warpTo(group, number, x, y, facing);
        await g.afterArrival(true);
      });
      await h.settle();
      if (options.stay !== false) expect(g.map.name).toBe(map);
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
    /** Uses an item from the Pack, on party Pokémon `slot` when it asks for one. */
    async useItem(name: string, slot = 0) {
      const { useItem } = await import("../src/crystal/items");
      h.ui.answers = [slot];
      const result = await useItem(g, ITEM[name]);
      if (typeof result === "function") await g.runScript(result);
      h.ui.answers = [];
      return result;
    },
    /** Squares of the current map whose collision passes `test`. */
    squares(test: (coll: number) => boolean) {
      const out: { x: number; y: number }[] = [];
      for (let y = 0; y < g.map.height * 2; y++) for (let x = 0; x < g.map.width * 2; x++) if (test(g.world.collision(g.map, x, y))) out.push({ x, y });
      return out;
    },
    /** Walks next to a square and presses A facing it (trees, water, boulders). */
    async inspectFrom(at: { x: number; y: number }) {
      for (const [dir, [dx, dy]] of Object.entries(STEP) as [Facing, [number, number]][]) {
        const x = at.x - dx, y = at.y - dy;
        if (!g.world.inside(g.map, x, y) || !g.passable(x, y)) continue;
        try { await h.goto(x, y); } catch { continue; }
        if (g.me.x !== x || g.me.y !== y) continue;
        g.me.facing = dir;
        await g.runScript(() => g.interact());
        await h.settle();
        return;
      }
      throw Error(`Can't reach ${at.x},${at.y} on ${where()}`);
    },
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

      // ------------------------------------------------------------ Ilex Forest: Farfetch'd and HM01 Cut
      await w.warp("ILEX_FOREST", 4, 42, "up");
      await w.talk("YOUNGSTER", { x: 7, y: 28 });
      w.flush("Charcoal apprentice");
      // Herd Farfetch'd: talking to it from the right side sends it on to its next spot, from a
      // wrong side back to an earlier one. Remember the wrong sides and try the others.
      const position = () => g.peek(RAM.wFarfetchdPosition) || 1;
      const wrong = new Set<string>();
      for (let guard = 0; guard < 80 && !w.ev("EVENT_HERDED_FARFETCHD"); guard++) {
        const bird = w.find("BIRD"), before = position();
        const sides = (Object.entries(STEP) as [Facing, [number, number]][]).filter(([dir]) => !wrong.has(`${before}:${dir}`));
        let tried = false;
        for (const [dir, [dx, dy]] of sides) {
          const x = bird.x - dx, y = bird.y - dy;
          try { for (let i = 0; i < 3 && (g.me.x !== x || g.me.y !== y); i++) await h.goto(x, y); } catch { continue; }
          if (g.me.x !== x || g.me.y !== y) continue;
          g.me.facing = dir;
          await g.runScript(() => g.interact());
          await h.settle();
          tried = true;
          if (position() < before) wrong.add(`${before}:${dir}`);
          break;
        }
        if (!tried) throw Error(`Farfetch'd can't be reached at position ${before}, ${bird.x},${bird.y}`);
      }
      w.flush("Farfetch'd herded");
      expect(w.ev("EVENT_HERDED_FARFETCHD")).toBe(true);
      await w.talk("BLACK_BELT");
      w.flush("Charcoal master");
      expect(w.has("HM_CUT")).toBe(true);
      // Teach Cut from the Pack and cut the tree on the way out of the forest.
      g.save.party.push(g.makeMon(MON.SCYTHER, 30));
      await w.useItem("HM_CUT", g.save.party.length - 1);
      expect(g.save.party.at(-1)!.moves).toContain(MOVE.CUT);
      const tree = w.squares(c => g.world.isCutTree(c))[0];
      expect(tree).toBeTruthy();
      await w.inspectFrom(tree);
      w.flush("Cut the tree");
      expect(g.world.isCutTree(g.collisionAt(tree.x, tree.y))).toBe(false);
      await w.to(1, 6);
      await h.step("up");
      w.flush("Out of Ilex Forest");
      expect(g.map.name).toBe("ROUTE_34_ILEX_FOREST_GATE");

      // ------------------------------------------------------------ Goldenrod City
      w.strengthen(45);
      await w.warp("GOLDENROD_BIKE_SHOP", 3, 6, "up");
      await w.talk("CLERK");
      w.flush("Bike Shop");
      expect(w.has("BICYCLE")).toBe(true);
      await w.warp("RADIO_TOWER_1F", 3, 6, "up");
      h.ui.answers = [true, true, false, false, true, false];
      await w.talk("COOLTRAINER_F");
      h.ui.answers = [];
      w.flush("Radio Card quiz");
      expect(g.hasFlag("ENGINE_RADIO_CARD")).toBe(true);
      await w.warp("GOLDENROD_GYM", 3, 16, "up");
      await w.talk("WHITNEY");
      w.flush("Whitney");
      expect(w.ev("EVENT_BEAT_WHITNEY")).toBe(true);
      // She cries until the player comes near; then she hands over the badge.
      await w.to(8, 5);
      w.flush("Whitney cries");
      await w.talk("WHITNEY");
      w.flush("Plain Badge");
      expect(g.hasFlag("ENGINE_PLAINBADGE")).toBe(true);
      await w.warp("GOLDENROD_FLOWER_SHOP", 3, 6, "up");
      await w.talk("TEACHER");
      w.flush("SquirtBottle");
      expect(w.has("SQUIRTBOTTLE")).toBe(true);

      // ------------------------------------------------------------ Route 36: Sudowoodo
      await w.warp("ROUTE_36", 36, 13, "up");
      await w.talk("SUDOWOODO");
      w.flush("Sudowoodo");
      expect(w.ev("EVENT_FOUGHT_SUDOWOODO")).toBe(true);

      // ------------------------------------------------------------ Ecruteak City: the Burned Tower
      w.strengthen(50);
      await w.warp("ECRUTEAK_CITY", 23, 28, "down");
      w.flush("Ecruteak City");
      await w.warp("ECRUTEAK_GYM", 4, 15, "up", { stay: false });
      w.flush("Ecruteak Gym closed");
      expect(g.map.name).toBe("ECRUTEAK_CITY");
      await w.warp("BURNED_TOWER_1F", 9, 14, "up");
      w.flush("Eusine");
      await w.to(11, 9);
      w.flush("Rival in the Burned Tower");
      expect(w.ev("EVENT_RIVAL_BURNED_TOWER")).toBe(true);
      // The floor gives way into the basement, where the beasts wake.
      await h.settle();
      if (g.map.name === "BURNED_TOWER_1F") await w.to(10, 9);
      expect(g.map.name).toBe("BURNED_TOWER_B1F");
      await w.to(10, 6);
      w.flush("The legendary beasts");
      expect(w.ev("EVENT_RELEASED_THE_BEASTS")).toBe(true);
      expect(g.save.roamers?.length).toBe(2);

      // ------------------------------------------------------------ Morty and Surf
      await w.warp("ECRUTEAK_GYM", 5, 2, "up");
      await w.talk("MORTY");
      w.flush("Morty");
      expect(g.hasFlag("ENGINE_FOGBADGE")).toBe(true);
      await w.warp("DANCE_THEATRE", 5, 12, "up");
      await w.beatTrainers();
      await w.talk("GENTLEMAN");
      w.flush("Kimono Girls and HM03");
      expect(w.has("HM_SURF")).toBe(true);

      // ------------------------------------------------------------ Olivine and Cianwood
      w.strengthen(55);
      await w.warp("OLIVINE_CITY", 13, 10, "down");
      await w.to(13, 12);
      w.flush("Rival in Olivine");
      await w.warp("OLIVINE_LIGHTHOUSE_6F", 9, 14, "up");
      await w.talk("JASMINE");
      w.flush("Jasmine and Amphy");
      expect(w.ev("EVENT_JASMINE_EXPLAINED_AMPHYS_SICKNESS")).toBe(true);
      await w.warp("CIANWOOD_PHARMACY", 2, 6, "up");
      await w.talk("PHARMACIST");
      w.flush("SecretPotion");
      expect(w.has("SECRETPOTION")).toBe(true);
      // Chuck waits behind the gym's boulders; Strength's puzzle is skipped here.
      await w.warp("CIANWOOD_GYM", 4, 2, "up");
      await w.talk("CHUCK");
      w.flush("Chuck");
      expect(g.hasFlag("ENGINE_STORMBADGE")).toBe(true);
      await w.warp("CIANWOOD_CITY", 10, 45, "down");
      await w.talk("POKEFAN_F");
      w.flush("Chuck's wife");
      expect(w.has("HM_FLY")).toBe(true);
      await w.warp("OLIVINE_LIGHTHOUSE_6F", 9, 14, "up");
      await w.talk("JASMINE");
      w.flush("Amphy's medicine");
      expect(w.ev("EVENT_JASMINE_RETURNED_TO_GYM")).toBe(true);
      await w.warp("OLIVINE_GYM", 4, 13, "up");
      await w.talk("JASMINE");
      w.flush("Jasmine");
      expect(g.hasFlag("ENGINE_MINERALBADGE")).toBe(true);
    } finally {
      w.flush("end");
      if (process.env.CRYSTAL_WALKTHROUGH_LOG) writeFileSync(process.env.CRYSTAL_WALKTHROUGH_LOG, w.log.join("\n"));
      console.log(`Stopped at ${w.where()}`);
    }
    void CONST; void MON;
  }, 600000);
});
