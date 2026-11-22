import { describe, expect, it } from "vitest";
import { CARTRIDGES } from "./crystal-fixtures";
import { hasEngine, headlessGame } from "./crystal-harness";
import { C, ITEM, MAP, MON } from "../src/crystal/symbols";

describe.skipIf(!hasEngine || !CARTRIDGES.length).each(CARTRIDGES)("Crystal's systems on %s", cart => {
  const adventure = cart === "crystal" ? "crystal" : "crystal-legacy";
  it("runs a Bug-Catching Contest from entry to prize", async () => {
    // 17 November 2026 is a Tuesday, a contest day.
    const h = await headlessGame(adventure, { day: 17 });
    const g = h.game;
    g.save.party = [g.makeMon(MON.TYRANITAR, 60), g.makeMon(MON.PIDGEY, 5)];
    const [group, number] = MAP.ROUTE_36_NATIONAL_PARK_GATE;
    await g.warpTo(group, number, 5, 5, "left");
    const officer = g.objects.find(o => o.visible && o.event.sprite === C("SPRITE_OFFICER"));
    expect(officer).toBeTruthy();
    await g.runScript(() => g.talkTo(officer!));
    expect(g.map.name).toBe("NATIONAL_PARK_BUG_CONTEST");
    expect(g.save.contest?.balls).toBe(20);
    expect(g.save.party.length).toBe(1);
    g.save.contest!.caught = g.makeMon(MON.SCYTHER, 15);
    g.save.contest!.started -= 21 * 60;
    await h.walk("D");
    await h.settle();
    expect(g.map.name).toBe("ROUTE_36_NATIONAL_PARK_GATE");
    expect(g.save.contest).toBeUndefined();
    if (!g.save.party.some(m => m.species === MON.SCYTHER)) console.log(h.ui.log.slice(-40).join("\n"), g.save.party.map(m => m.species));
    expect(g.save.party.some(m => m.species === MON.SCYTHER)).toBe(true);
    expect(g.save.party.some(m => m.species === MON.PIDGEY)).toBe(true);
  }, 60000);

  it("hatches an Egg from the Day-Care", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.TYRANITAR, 60)];
    const egg = g.makeMon(MON.PICHU, 5);
    g.save.party.push({ ...egg, egg: true, eggCycles: 1 });
    g.save.steps = 255;
    await h.walk("R");
    await h.settle();
    expect(g.save.party[1].egg).toBeFalsy();
    expect(g.save.caught).toContain(MON.PICHU);
  }, 60000);

  it("puts through Elm's call", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.CYNDAQUIL, 10)];
    g.addPhoneNumber(C("PHONECONTACT_ELM"));
    const [group, number] = MAP.ROUTE_29;
    await g.warpTo(group, number, 30, 8);
    g.save.specialCall = C("SPECIALCALL_ROBBED");
    await g.runScript(() => g.arrived());
    expect(g.save.specialCall).toBe(0);
    expect(h.ui.log.join(" ")).toMatch(/ELM/);
  }, 60000);

  it("buys from a Mart", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    const [group, number] = MAP.CHERRYGROVE_MART;
    await g.warpTo(group, number, 2, 5);
    const clerk = g.objects.find(o => o.visible && o.event.sprite === C("SPRITE_CLERK"))!;
    h.ui.answers = [0, 0, 0, true];
    h.ui.budget = 5;
    await g.runScript(() => g.talkTo(clerk));
    expect(g.itemCount(ITEM.POTION)).toBe(1);
    expect(g.save.money).toBe(3000 - g.rom.itemPrice(ITEM.POTION));
  }, 60000);
});
