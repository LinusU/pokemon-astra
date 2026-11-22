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

  it("lets the player retire from the Bug-Catching Contest", async () => {
    const h = await headlessGame(adventure, { day: 17 });
    const g = h.game;
    g.save.party = [g.makeMon(MON.TYRANITAR, 60), g.makeMon(MON.PIDGEY, 5)];
    const [group, number] = MAP.ROUTE_36_NATIONAL_PARK_GATE;
    await g.warpTo(group, number, 5, 5, "left");
    const officer = g.objects.find(o => o.visible && o.event.sprite === C("SPRITE_OFFICER"))!;
    await g.runScript(() => g.talkTo(officer));
    expect(g.map.name).toBe("NATIONAL_PARK_BUG_CONTEST");
    const { contestQuit } = await import("../src/crystal/contest");
    await g.runScript(() => contestQuit(g));
    await h.settle();
    expect(g.map.name).toBe("ROUTE_36_NATIONAL_PARK_GATE");
    expect(g.hasFlag("ENGINE_BUG_CONTEST_TIMER")).toBe(false);
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
    // The call is about the theft, not Pokérus: Elm's script reads the call's id.
    expect(g.ev("EVENT_ELM_CALLED_ABOUT_STOLEN_POKEMON")).toBe(true);
    expect(h.ui.log.join(" ")).not.toMatch(/POKéRUS/);
  }, 60000);

  it("gives no badge for a lost gym battle", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.CYNDAQUIL, 2)];
    g.save.money = 1000;
    g.save.spawn = { group: MAP.VIOLET_CITY[0], number: MAP.VIOLET_CITY[1] };
    const [group, number] = MAP.VIOLET_GYM;
    await g.warpTo(group, number, 5, 3, "up");
    const falkner = g.objects.find(o => o.visible && o.event.sprite === C("SPRITE_FALKNER"))!;
    await g.runScript(() => g.talkTo(falkner));
    expect(g.hasFlag("ENGINE_ZEPHYRBADGE")).toBe(false);
    expect(g.ev("EVENT_BEAT_FALKNER")).toBe(false);
    // The spawn point is the street in front of the Pokémon Center.
    expect(g.map.name).toBe("VIOLET_CITY");
    expect(g.save.money).toBe(500);
    expect(g.save.party[0].hp).toBe(g.save.party[0].stats[0]);
  }, 60000);

  it("goes up to a Pokémon Center's 2F and back down", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.CYNDAQUIL, 10)];
    const [group, number] = MAP.CHERRYGROVE_POKECENTER_1F;
    await g.warpTo(group, number, 3, 4);
    const stairs = g.map.warps.findIndex(w => w.group === MAP.POKECENTER_2F[0] && w.number === MAP.POKECENTER_2F[1]);
    await g.runScript(() => g.useWarp(stairs));
    expect(g.map.name).toBe("POKECENTER_2F");
    await g.runScript(() => g.useWarp(0));
    expect(g.map.name).toBe("CHERRYGROVE_POKECENTER_1F");
  }, 60000);

  it("wakes Snorlax with the Poké Flute channel", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.TYRANITAR, 70)];
    const [group, number] = MAP.VERMILION_CITY;
    await g.warpTo(group, number, 34, 10, "up");
    const snorlax = g.objects.find(o => o.visible && o.event.sprite === C("SPRITE_BIG_SNORLAX"))!;
    await g.runScript(() => g.talkTo(snorlax));
    expect(g.ev("EVENT_FOUGHT_SNORLAX")).toBe(false);
    g.playMusic(C("MUSIC_POKE_FLUTE_CHANNEL"));
    await g.runScript(() => g.talkTo(snorlax));
    expect(g.ev("EVENT_FOUGHT_SNORLAX")).toBe(true);
  }, 60000);

  it("flies to the towns the player has visited", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.PIDGEOT, 40)];
    for (const map of ["NEW_BARK_TOWN", "VIOLET_CITY", "ROUTE_31"] as const) await g.warpTo(MAP[map][0], MAP[map][1], 10, 10);
    const { useFly } = await import("../src/crystal/field");
    h.ui.answers = [1];
    await g.runScript(() => useFly(g));
    expect(g.map.name).toBe("VIOLET_CITY");
  }, 60000);

  it("drops a Strength boulder through Ice Path's floor", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.TYRANITAR, 70)];
    g.setEvent(C("EVENT_BOULDER_IN_ICE_PATH_1A"), true);
    const [group, number] = MAP.ICE_PATH_B1F;
    await g.warpTo(group, number, 3, 15);
    g.setFlag(C("ENGINE_STRENGTH_ACTIVE"), true);
    // Boulder 1 belongs in the hole that is warp 3.
    const hole = g.map.warps[2];
    const boulder = g.objects.find(o => o.visible && o.event.movement === C("SPRITEMOVEDATA_STRENGTH_BOULDER"))!;
    g.moveObject(boulder.slot, hole.x - 1, hole.y);
    g.place(0, hole.x - 2, hole.y, "right");
    const { pushBoulder } = await import("../src/crystal/field");
    expect(pushBoulder(g, boulder)).toBe(true);
    await h.settle();
    expect(boulder.visible).toBe(false);
    expect(g.ev("EVENT_BOULDER_IN_ICE_PATH_1")).toBe(true);
    // The boulder turns up on the floor below.
    expect(g.ev("EVENT_BOULDER_IN_ICE_PATH_1A")).toBe(false);
  }, 60000);

  it("is spotted by a swimmer across the water", async () => {
    const h = await headlessGame(adventure);
    const g = h.game;
    g.save.party = [g.makeMon(MON.TYRANITAR, 70)];
    const [group, number] = MAP.ROUTE_41;
    await g.warpTo(group, number, 0, 0);
    const { readTrainerHeader } = await import("../src/crystal/script");
    const { STEP } = await import("../src/crystal/world");
    const swimmer = g.objects.find(o => o.visible && o.event.type === C("OBJECTTYPE_TRAINER") && o.event.sight >= 3)!;
    const [dx, dy] = STEP[swimmer.facing];
    g.save.state = "surf";
    g.place(0, swimmer.x + dx * swimmer.event.sight, swimmer.y + dy * swimmer.event.sight, "up");
    await h.step(swimmer.facing === "left" || swimmer.facing === "right" ? "up" : "left");
    g.place(0, swimmer.x + dx * swimmer.event.sight, swimmer.y + dy * swimmer.event.sight);
    for (let i = 0; i < 5; i++) await h.press("none");
    expect(g.event(readTrainerHeader(g, swimmer.event.script).flag)).toBe(true);
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
