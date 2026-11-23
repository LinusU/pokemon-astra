import { describe, expect, it } from "vitest";
import { CARTRIDGES, SUITES } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { C, MON } from "../src/crystal/symbols";

describe.skipIf(!hasEngine || !CARTRIDGES.length).each(SUITES)("A new %s journey", cart => {
  const adventure = cart === "crystal" ? "crystal" : "crystal-legacy";
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
