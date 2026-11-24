import { describe, expect, it, vi } from "vitest";
import { CARTRIDGES, SUITES } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { C, MAP, MON } from "../src/crystal/symbols";
import { CrystalGame } from "../src/crystal/runtime";
import { readTrainerHeader } from "../src/crystal/script";
import { BODY_RADIUS } from "../src/game/free-movement";

describe.skipIf(!hasEngine || !CARTRIDGES.length).each(SUITES)("A new %s journey", cart => {
  const adventure = cart === "crystal" ? "crystal" : "crystal-legacy";
  it("can walk clear of a trainer occupying the saved square on Route 35", async () => {
    const h = await headlessGame(adventure);
    const [group, number] = MAP.ROUTE_35;
    const save = {
      ...h.game.save, map: [group, number] as [number, number], x: 8, y: 20, facing: "up" as const,
      settings: { ...h.game.save.settings, movement: "free" as const },
    };
    const game = new CrystalGame({ ...h.game.ctx, save });
    for (const o of game.objects) {
      if (o.event.type === C("OBJECTTYPE_TRAINER")) game.setEvent(readTrainerHeader(game, o.event.script).flag, true);
    }
    await game.begin();
    expect(game.objects.some(o => o.visible && o.x === 8 && o.y === 20)).toBe(true);

    let frame = 0;
    const walk = async (dir: "up" | "down") => {
      h.input.dir = dir;
      for (let i = 0; i < 12; i++) {
        game.frame(++frame * 50, 0.05);
        await vi.waitFor(() => expect(game.mode).toBe("world"), { interval: 1 });
      }
    };
    const trainerEdge = save.y - 0.5 - BODY_RADIUS;
    await walk("up");
    expect(game.me.free?.y).toBeLessThan(trainerEdge);
    await walk("down");
    expect(game.me.y).toBe(19);
    expect(game.me.free?.y).toBeLessThan(trainerEdge);
  });

  it("starts in the player's room and meets Mom downstairs", async () => {
    const h = await headlessGame(adventure);
    expect(h.game.map.name).toBe("PLAYERS_HOUSE_2F");
    expect(h.game.ev("EVENT_INITIALIZED_EVENTS")).toBe(true);
    // The stairs are in the top-right corner.
    await h.walk("R4");
    await h.walk("U3");
    expect(h.game.map.name).toBe("PLAYERS_HOUSE_1F");
    // Mom stops the player on their way to the door and gives them the Pokégear.
    await h.walk("D4");
    expect(h.game.hasFlag("ENGINE_POKEGEAR")).toBe(true);
    expect(h.game.save.phone).toContain(C("PHONECONTACT_MOM"));
    // Out of the door and over to Elm's lab.
    await h.goto(7, 7);
    await h.step("down");
    expect(h.game.map.name).toBe("NEW_BARK_TOWN");
    const lab = h.game.map.warps[0];
    await h.goto(lab.x, lab.y);
    expect(h.game.map.name).toBe("ELMS_LAB");
    // Elm explains the errand; the Poké Balls on the table hold the starters.
    const balls = h.game.objects.filter(o => o.visible && o.event.sprite === C("SPRITE_POKE_BALL"));
    expect(balls.length).toBe(3);
    await h.goto(balls[0].x, balls[0].y + 1);
    await h.talk("up");
    expect(h.game.save.party.length).toBe(1);
    expect(h.game.ev("EVENT_GOT_A_POKEMON_FROM_ELM")).toBe(true);
    // A wild battle on the engine, and a trainer: the Route 30 youngster's party is the cartridge's.
    const mon = h.game.save.party[0];
    h.game.battleSetup = { kind: "wild", species: MON.PIDGEY, level: 2 };
    const exp = mon.exp;
    expect(await h.game.startBattle()).toBe(C("WIN"));
    expect(h.game.save.party[0].exp).toBeGreaterThan(exp);
    h.game.save.party[0] = h.game.makeMon(h.game.save.party[0].species, 30);
    h.game.battleSetup = { kind: "trainer", klass: C("YOUNGSTER"), id: C("JOEY1") };
    const money = h.game.save.money;
    expect(await h.game.startBattle()).toBe(C("WIN"));
    expect(h.game.save.money).toBeGreaterThan(money);
  }, 60000);
});
