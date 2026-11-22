import { beforeAll, describe, expect, it } from "vitest";
import type { Game } from "../src/yellow/script";

/** A stand-in for the runtime that records what a script shows and fights. */
function fakeGame(o: { answers?: boolean[]; badges?: number; vars?: Record<string, number>; events?: string[]; map?: number; party?: unknown[]; money?: number; coins?: number; items?: string[] } = {}) {
  const events = new Set(o.events ?? []), hidden = new Set<string>(), shown = new Set<string>();
  const log: string[] = [], answers = [...(o.answers ?? [])];
  const g = {
    legacy: true, log, shown, hidden, map: o.map ?? 0, money: o.money ?? 0, coins: o.coins ?? 0,
    save: { badges: o.badges ?? 0, caught: [] as number[], seen: [] as number[], party: o.party ?? [], vars: o.vars ?? {} },
    vars: o.vars ?? {},
    player: { x: 0, y: 0, facing: "up" },
    ev: (e: string) => events.has(e), set: (e: string) => events.add(e), reset: (e: string) => events.delete(e),
    show: (hs: string) => { shown.add(hs); hidden.delete(hs); }, hide: (hs: string) => { hidden.add(hs); shown.delete(hs); },
    async text(ref: string) { log.push(ref); },
    async yesNo() { const a = answers.shift() ?? false; log.push(a ? "yes" : "no"); return a; },
    async trainerBattle(klass: string, index: number) { log.push(`battle ${klass} ${index}`); return true; },
    async giveMon(species: string, level: number) { log.push(`mon ${species} ${level}`); return {}; },
    give: (item: string) => (log.push(`item ${item}`), true),
    hasItem: (item: string) => (o.items ?? []).includes(item),
    textVar() {}, music() {}, sfx() {}, badge() {}, async delay() {}, face() {}, facePlayer() {}, async fade(f?: () => void) { f?.(); },
    async service(kind: string) { log.push(`service ${kind}`); },
    hasBadge: (i: number) => !!((o.badges ?? 0) & (1 << i)),
    async choosePartyMon() { return 0; }, async choose() { return 0; },
    learnset: () => [{ level: 1, move: 33 }, { level: 5, move: 45 }, { level: 9, move: 52 }],
    moveName: (m: number) => `MOVE${m}`,
    async learnMove(_slot: number, move: number) { log.push(`learn ${move}`); return true; },
  };
  return g as unknown as Game & { log: string[]; shown: Set<string>; hidden: Set<string>; money: number; coins: number };
}

let script: (label: string) => import("../src/yellow/script").MapScript;
beforeAll(async () => {
  const { useCartridge } = await import("../src/yellow/symbols");
  await useCartridge("legacy");
  await import("../src/yellow/scripts");
  const { mapScript } = await import("../src/yellow/script");
  script = label => mapScript(label, true)!;
});
const text = (map: string, label: string) => script(map).texts![label];

describe("Yellow Legacy's gym leaders", () => {
  it("field the team for the badges the player already has", async () => {
    for (const [badges, party] of [[0b111, 1], [0b1111, 2], [0b11111, 3]] as const) {
      const g = fakeGame({ badges });
      await text("CeladonGym", "CeladonGymErikaText")(g);
      expect(g.log).toContain(`battle ERIKA ${party}`);
    }
    const koga = fakeGame({ badges: 0b11111 });
    await text("FuchsiaGym", "FuchsiaGymKogaText")(koga);
    expect(koga.log).toContain("battle KOGA 2");
    const sabrina = fakeGame({ badges: 0b1111 });
    await text("SaffronGym", "SaffronGymSabrinaText")(sabrina);
    expect(sabrina.log).toContain("battle SABRINA 2");
  });
  it("offer rematches once the game is beaten", async () => {
    const g = fakeGame({ answers: [true], vars: { gameStage: 1 }, events: ["EVENT_BEAT_ERIKA", "EVENT_GOT_TM21"] });
    await text("CeladonGym", "CeladonGymErikaText")(g);
    expect(g.log).toEqual(["CeladonGymErikaText.PreBattleRematch1Text", "yes", "CeladonGymErikaText.PreBattleRematch2Text", "battle ERIKA 4", "TEXT_CELADONGYM_REMATCH_POST_BATTLE"]);
    expect(g.shown.has("HS_REDS_HOUSE_2F_MR_MIME")).toBe(true);
    const blaine = fakeGame({ answers: [false], vars: { gameStage: 1 }, events: ["EVENT_BEAT_BLAINE", "EVENT_GOT_TM38"] });
    await text("CinnabarGym", "CinnabarGymBlaineText")(blaine);
    expect(blaine.log).toEqual(["CinnabarGymStartRematchScript.PreBattleRematch1Text", "no", "CinnabarGymStartRematchScript.PreBattleRematchRefusedText"]);
  });
  it("keep Yellow's advice before the Hall of Fame", async () => {
    const g = fakeGame({ events: ["EVENT_BEAT_BROCK", "EVENT_GOT_TM34"] });
    await text("PewterGym", "PewterGymBrockText")(g);
    expect(g.log).toEqual(["PewterGymBrockText.PostBattleAdviceText"]);
  });
});

describe("Yellow Legacy's post-game", () => {
  it("starts at the Hall of Fame", async () => {
    const { MAP } = await import("../src/yellow/symbols");
    const g = fakeGame({ map: MAP.PALLET_TOWN, vars: { rivalStarter: 2 } });
    // Yellow's scene runs first; here it has already sent the player home.
    await script("HallOfFame").onStep!(Object.assign(g, { move: async () => {}, hallOfFame: async () => {}, warp: async () => {} }));
    expect(g.vars.gameStage).toBe(1);
    expect([...g.shown]).toEqual(expect.arrayContaining(["HS_ROUTE_1_OAK", "HS_LORELEISROOM_LORELEI_REMATCH", "HS_LANCESROOM_LANCE_REMATCH", "HS_CHAMPIONS_ROOM_FLAREON"]));
    expect([...g.hidden]).toEqual(expect.arrayContaining(["HS_OAKS_LAB_OAK_1", "HS_LORELEISROOM_LORELEI"]));
  });
  it("has Oak battle on Route 1, then go home", async () => {
    const g = fakeGame({ answers: [true] });
    await text("Route1", "Route1OakText")(g);
    expect(g.log).toContain("battle PROF_OAK 1");
    expect(g.ev("EVENT_BEAT_ROUTE_1_OAK")).toBe(true);
    expect(g.shown.has("HS_OAKS_LAB_OAK_1") && g.hidden.has("HS_ROUTE_1_OAK")).toBe(true);
  });
  it("sends Oak to the Mansion for a full Pokédex, where Mew appears after his battle", async () => {
    const lab = fakeGame({ events: ["EVENT_PALLET_AFTER_GETTING_POKEBALLS"] });
    lab.save.caught.push(...Array.from({ length: 150 }, (_, i) => i + 1));
    await text("OaksLab", "OaksLabOak1Text")(lab);
    expect(lab.log).toContain("CompletedDexText");
    expect(lab.shown.has("HS_POKEMON_MANSION_2F_OAK")).toBe(true);
    const mansion = fakeGame({ answers: [true] });
    await text("PokemonMansion2F", "PokemonMansion2FOakText")(mansion);
    expect(mansion.log).toContain("battle PROF_OAK 2");
    expect(mansion.shown.has("HS_POKEMON_MANSION_B1F_MEW")).toBe(true);
  });
});

describe("Yellow Legacy's services", () => {
  it("sell 500 coins for ¥11,000", async () => {
    const g = fakeGame({ answers: [true], money: 12000, coins: 10, items: ["COIN_CASE"] });
    await text("GameCornerPrizeRoom", "GameCornerPrizeRoomClerkText")(g);
    expect([g.money, g.coins]).toEqual([1000, 510]);
  });
  it("delete a move, shifting the rest up", async () => {
    const mon = { moves: [33, 45, 52, 0], pp: [35, 40, 25, 0] };
    const g = fakeGame({ answers: [true, true], party: [mon] });
    await text("CinnabarLabFossilRoom", "MoveDeleterText1")(g);
    expect(g.save.party[0]).toMatchObject({ moves: [45, 52, 0, 0], pp: [40, 25, 0, 0] });
  });
  it("relearn a forgotten level-up move for ¥1,000", async () => {
    const g = fakeGame({ answers: [true], money: 1500, party: [{ species: 25, level: 9, moves: [33, 0, 0, 0] }] });
    await text("CinnabarLabFossilRoom", "MoveRelearnerText1")(g);
    expect(g.log).toContain("learn 45");
    expect(g.money).toBe(500);
  });
  it("give the fossil Pokémon the player passed up", async () => {
    const g = fakeGame({ answers: [true], events: ["EVENT_GOT_DOME_FOSSIL"] });
    await text("FuchsiaGoodRodHouse", "FuchsiaGoodRodHouseFishingGuruText")(g);
    expect(g.log).toContain("mon OMANYTE 10");
  });
});

describe("Yellow Legacy's Repel", () => {
  /** The runtime pieces Repels use. */
  function game(legacy: boolean, o: { answers?: boolean[]; items?: Record<string, number>; events?: string[] } = {}) {
    const g = fakeGame({ answers: o.answers, events: o.events });
    const player = { facing: "up" };
    return Object.assign(g, {
      legacy,
      save: { ...g.save, items: o.items ?? {}, repel: 0, lastMap: 0, blackout: 1 } as Record<string, unknown>,
      rom: { itemName: () => "SUPER REPEL" },
      heal() { g.log.push("heal"); }, ctx: { sound: { heal() {} } }, persist: async () => {},
      face(who: string, f: string) { if (who === "player") player.facing = f; }, player,
    });
  }
  it("offer another Repel of the same kind on Legacy", async () => {
    const { repelWoreOff } = await import("../src/yellow/items");
    const { ITEM } = await import("../src/yellow/symbols");
    const id = ITEM.SUPER_REPEL;
    const yes = game(true, { answers: [true], items: { [id]: 2 } });
    yes.save.repelItem = id;
    await repelWoreOff(yes as never);
    expect(yes.log).toEqual(["RepelWoreOffUseAnotherText", "yes"]);
    expect([yes.save.repel, yes.save.repelItem, (yes.save.items as Record<number, number>)[id]]).toEqual([200, id, 1]);
    const none = game(true, { items: {} });
    none.save.repelItem = id;
    await repelWoreOff(none as never);
    expect(none.log).toEqual(["RepelWoreOffText"]);
    const yellow = game(false, { items: { [id]: 2 } });
    yellow.save.repelItem = id;
    await repelWoreOff(yellow as never);
    expect(yellow.log).toEqual(["RepelWoreOffText"]);
  });
});
