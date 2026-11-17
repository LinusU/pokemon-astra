import { describe, expect, it } from "vitest";
import { battleMessage, moveEffect, battleMonAtSendOut } from "../src/ui/battle";

describe("battle presentation", () => {
  const move = (id: number) => ({ name: id === 85 ? "Thunderbolt" : "Tackle" });
  it("renders typed native events with their details", () => {
    expect(
      battleMessage(
        { UsedMove: { user: { name: "Pikachu" }, mv: 85 } },
        move,
        () => "Potion",
      ),
    ).toBe("Pikachu used Thunderbolt!");
    expect(
      battleMessage(
        { GainedExp: { mon: "Pikachu", exp: 42 } },
        move,
        () => "Potion",
      ),
    ).toContain("42 EXP");
    expect(battleMessage("BallBrokeFree", move, () => "Potion")).toContain(
      "broke free",
    );
  });
  it("provides an effect for known and unfamiliar moves", () => {
    expect(moveEffect("Thunderbolt")).toBe("electric");
    expect(moveEffect("Flamethrower")).toBe("fire");
    expect(moveEffect("Hydro Pump")).toBe("water");
    expect(moveEffect("Tackle")).toBe("impact");
  });
});

import { readFileSync, existsSync } from "node:fs";
import { Engine } from "../src/engine";
const romAvailable =
  existsSync("pokecrystal11.gbc") && existsSync("public/astra_native.wasm");
describe.skipIf(!romAvailable)("real native battle events", () => {
  it("supplies ordered move, status, HP, and capture events", async () => {
    const { instance } = await WebAssembly.instantiate(
      readFileSync("public/astra_native.wasm"),
      {},
    );
    const engine = new Engine(
      instance.exports as never,
      readFileSync("pokecrystal11.gbc"),
    );
    const make = () =>
      engine.startBattle({
        party: [engine.makePokemon(58, 6)],
        opponent: { species: 19, level: 3 },
        balls: [[1, 1]],
        seed: 1,
      });
    const battle = make();
    expect(
      (battle.snapshot().events as any[]).some((e) => e.Message?.WildAppeared),
    ).toBe(true);
    const index = (battle.snapshot().legal as any[]).findIndex(
      (a) => a.Move?.slot === 0,
    );
    const events = battle.act(index).events as any[];
    const used = events.findIndex((e) => e.Message?.UsedMove);
    const anim = events.findIndex((e) => e.Animation?.anim < 256);
    const hp = events.findIndex((e) => e.HpBar);
    expect(used).toBeGreaterThanOrEqual(0);
    expect(anim).toBeGreaterThan(used);
    expect(hp).toBeGreaterThan(anim);
    expect(events.some((e) => e.Message?.StatFell)).toBe(true);
    const capture = make();
    const ball = (capture.snapshot().legal as any[]).findIndex(
      (a) => a.Item?.id === 1,
    );
    const caught = capture.act(ball).events as any[];
    expect(caught.find((e) => e.BallWobbles)?.BallWobbles).toEqual({
      caught: true,
      wobbles: 3,
    });
    for (let id = 1; id <= 251; id++) {
      const move = engine.move(id);
      expect(moveEffect(move.name, move.type)).toBeTruthy();
    }
  });
});

describe.skipIf(!romAvailable)("complete native battle decisions", () => {
  it("renders events through forced switch, trainer victory, level-up and move learning", async () => {
    const { instance } = await WebAssembly.instantiate(
      readFileSync("public/astra_native.wasm"),
      {},
    );
    const engine = new Engine(
      instance.exports as never,
      readFileSync("pokecrystal11.gbc"),
    );
    const lead = engine.makePokemon(1, 6);
    lead.exp = engine.makePokemon(1, 7).exp - 1;
    lead.moves = [33, 45, 15, 22];
    lead.pp = lead.moves.map((id) => engine.move(id).pp);
    const injured = engine.makePokemon(19, 2);
    injured.hp = 1;
    const enemy = engine.makePokemon(19, 2);
    const battle = engine.startBattle({
      party: [injured, lead],
      opponent: { party: [enemy, enemy] },
      seed: 4,
    });
    const seen = new Set<string>();
    for (let step = 0; step < 100; step++) {
      const snap = battle.snapshot();
      for (const event of snap.events as any[])
        if (event.Message) {
          const value = event.Message;
          seen.add(typeof value === "string" ? value : Object.keys(value)[0]);
          const text = battleMessage(
            value,
            (id) => engine.move(id),
            () => "item",
          );
          expect(text).not.toContain("[object Object]");
          expect(text).not.toBe("");
        }
      if (snap.outcome) break;
      const legal = snap.legal as any[];
      let index = legal.findIndex((a) => a.ForcedSwitch?.slot === 1);
      if (index < 0 && step === 0) index = legal.findIndex((a) => a.Move);
      if (index < 0) index = legal.findIndex((a) => a.LearnMove?.slot === 0);
      if (index < 0) index = legal.findIndex((a) => a.OfferSwitch?.keep);
      if (index < 0) index = legal.findIndex((a) => a.Move?.slot === 3);
      if (index < 0) index = legal.findIndex((a) => a.Move);
      if (index < 0) index = 0;
      battle.act(index);
    }
    expect(battle.snapshot().outcome).toBeTruthy();
    expect(seen.has("MonFainted")).toBe(true);
    expect(seen.has("EnemyMonFainted")).toBe(true);
    expect(seen.has("GrewToLevel")).toBe(true);
    expect(seen.has("AskForgetMove")).toBe(true);
  });

  it("trains a reserve through the native learn prompt without awarding reserve stat EXP", async () => {
    const { instance } = await WebAssembly.instantiate(
      readFileSync("public/astra_native.wasm"),
      {},
    );
    const engine = new Engine(
      instance.exports as never,
      readFileSync("pokecrystal11.gbc"),
    );
    const reserve = engine.makePokemon(1, 6);
    reserve.exp = engine.makePokemon(1, 7).exp - 1;
    reserve.moves = [33, 45, 39, 22];
    reserve.pp = reserve.moves.map((id) => engine.move(id).pp);
    const lead = engine.makeStarter(58);
    const enemy = engine.makePokemon(10, 5);
    for (const training of [false, true]) {
      const battle = engine.startBattle({
        party: [lead, reserve],
        opponent: { party: [enemy] },
        training,
        seed: 123,
      });
      let learned = false;
      for (let i = 0; i < 20 && !battle.snapshot().outcome; i++) {
        const snapshot = battle.snapshot();
        const actions = snapshot.legal as { Move?: { slot: number }; LearnMove?: { slot: number } }[];
        const learning = snapshot.site === "LearnMove";
        if (learning) {
          learned = true;
          expect(snapshot.learning_slot).toBe(1);
          expect(snapshot.state.player.party?.[1].moves).toEqual(reserve.moves);
        }
        const action = actions.findIndex((a) =>
          learning ? a.LearnMove?.slot === 2 : a.Move?.slot === 2,
        );
        expect(action).toBeGreaterThanOrEqual(0);
        battle.act(action);
      }
      const result = battle.snapshot().result;
      expect(result?.outcome).toBe("win");
      expect(learned).toBe(training);
      expect(result?.party[1].level).toBe(training ? 7 : 6);
      expect(result?.party[1].moves[2]).toBe(training ? 73 : 39);
      expect(result?.party[1].stat_exp).toEqual(reserve.stat_exp);
    }
  });
});

describe("authored trainer names", () => {
  it("uses the Astra trainer instead of the cartridge trainer identity", () => {
    const move = () => ({ name: "Tackle" });
    for (const message of [
      { WantsToBattle: { trainer: { name: "FALKNER", class: 1 } } },
      {
        EnemySentOut: { trainer: { name: "FALKNER", class: 1 }, mon: "PIDGEY" },
      },
      {
        EnemyWithdrew: {
          trainer: { name: "FALKNER", class: 1 },
          mon: "PIDGEY",
        },
      },
      { EnemyWasDefeated: { trainer: { name: "FALKNER", class: 1 } } },
      { LostAgainst: { trainer: { name: "FALKNER", class: 1 } } },
    ]) {
      const text = battleMessage(message, move, () => "item", "Scout Ari");
      expect(text).toContain("Scout Ari");
      expect(text).not.toContain("FALKNER");
    }
  });
});


it("uses only subsequent HP events for a replacement Pokémon", () => {
  const mon = { species: 25, moves: [], pp: [], level: 5, status: 0, hp: 15, max_hp: 15 };
  const snapshot = { state: { player: { active: mon, active_slot: 0 }, enemy: { active: mon, active_slot: 1 } }, events: [], site: null, legal: [], outcome: null, result: null };
  expect(battleMonAtSendOut(snapshot, "enemy", [])).toMatchObject({ hp: 15, max_hp: 15 });
  expect(battleMonAtSendOut(snapshot, "enemy", [{ HpBar: { target: "Enemy", from: 15, to: 8, max: 15 } }])).toMatchObject({ hp: 15, max_hp: 15 });
  expect(battleMonAtSendOut(snapshot, "enemy", [{ Message: { EnemySentOut: {} } }, { HpBar: { target: "Enemy", from: 3, to: 0, max: 3 } }])).toMatchObject({ hp: 15, max_hp: 15 });
});

it("names the specific stat and sharp change from native events", () => {
  const move = () => ({ name: "Tackle" });
  const item = () => "Potion";
  expect(battleMessage({ StatFell: { target: { name: "Pidgey" }, stat: 4, sharply: true } }, move, item)).toBe("Pidgey's Speed fell sharply!");
  expect(battleMessage({ StatRose: { user: { name: "Pidgey" }, stat: 2, sharply: false } }, move, item)).toBe("Pidgey's Attack rose!");
});

it("includes the authored trainer reward in the native prize message", () => {
  const text = battleMessage({ GotMoney: { player: "ASTRA", money: 20 } }, () => ({ name: "Tackle" }), () => "item", "Scout Ari", 100);
  expect(text).toBe("ASTRA got ¥120 for winning!");
});
