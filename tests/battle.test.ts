import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { battleMessage, battleMonAtSendOut } from "../src/ui/battle";
import { findMoveVisual, nativeConditionVisual } from "../src/ui/move-visuals";
import { Engine } from "../src/engine";

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
  it("has an authored effect for every move in the native catalog", () => {
    const source = readFileSync(new URL("../vendor/crystal-battle/src/data/names.rs", import.meta.url), "utf8");
    const table = source.match(/const MOVE_NAMES: &\[&str\] = &\[([\s\S]*?)\];/)![1];
    const names = Array.from(table.matchAll(/"([^"]+)"/g), (entry) => entry[1]);
    expect(names).toHaveLength(251);
    expect(names.filter((name) => !findMoveVisual(name))).toEqual([]);
  });
  it("gives contact moves and thrown objects distinct staging", () => {
    expect(findMoveVisual("Bite")).toMatchObject({ motif: "jaw", pattern: "hit" });
    expect(findMoveVisual("Cross Chop")).toMatchObject({ motif: "cross", motion: "leap" });
    expect(findMoveVisual("Pay Day")).toMatchObject({ motif: "coin", pattern: "arc" });
    expect(findMoveVisual("Rock Slide")).toMatchObject({ motif: "rock", pattern: "fall" });
  });
  it("stages beams, field attacks, and charge turns separately", () => {
    expect(findMoveVisual("Thunder")).toMatchObject({ motif: "bolt", pattern: "column" });
    expect(findMoveVisual("Surf")).toMatchObject({ pattern: "flood", anchor: "field" });
    expect(findMoveVisual("Earthquake")).toMatchObject({ motif: "crack", anchor: "field" });
    expect(findMoveVisual("Solarbeam", 1)).toMatchObject({ motif: "sun", anchor: "user" });
    expect(findMoveVisual("Solarbeam", 0)).toMatchObject({ motif: "sun", pattern: "beam" });
  });
  it("anchors recovery and shields on the user and distinguishes ongoing conditions", () => {
    expect(findMoveVisual("Recover")).toMatchObject({ motif: "plus", anchor: "user" });
    expect(findMoveVisual("Protect")).toMatchObject({ pattern: "shield", anchor: "user" });
    expect(findMoveVisual("Sing")).toMatchObject({ motif: "note", pattern: "wave" });
    expect(findMoveVisual("Present", 3)).toMatchObject({ motif: "plus", pattern: "rise" });
    expect(findMoveVisual("Substitute", 2)).toMatchObject({ motif: "doll", pattern: "rise" });
    expect(findMoveVisual("Curse", 1)).toMatchObject({ motif: "arrow", anchor: "user" });
    expect(nativeConditionVisual(260)).toMatchObject({ motif: "sleep", anchor: "user" });
    expect(nativeConditionVisual(261)).toMatchObject({ motif: "fire", anchor: "user" });
    expect(nativeConditionVisual(262)).toMatchObject({ motif: "bubbles", anchor: "user" });
  });
});

const romAvailable =
  existsSync("pokecrystal11.gbc") && existsSync("public/astra_native.wasm");
describe.skipIf(!romAvailable)("real native battle events", () => {
  it("sends out fresh trainer Pokémon at full HP", async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const lead = engine.makePokemon(58, 50);
    lead.hp -= 5;
    const battle = engine.startBattle({
      party: [lead],
      opponent: { party: [engine.makePokemon(19, 10), engine.makePokemon(16, 11)] },
      seed: 4,
    });
    const opening = battle.snapshot();
    expect(opening.state.player.active.hp).toBe(lead.hp);
    const { hp, max_hp } = opening.state.enemy.active;
    expect(hp).toBe(max_hp);
    expect(opening.state.enemy.party?.every((mon) => mon.hp === mon.max_hp)).toBe(true);
    expect(opening.events).toContainEqual({
      SendOut: { side: "Enemy", slot: 0, mon: expect.objectContaining({ hp, max_hp }) },
    });

    let snapshot = opening;
    for (let step = 0; step < 10; step++) {
      const legal = snapshot.legal as { Move?: { slot: number }; OfferSwitch?: { keep: boolean } }[];
      const action = legal.findIndex((choice) => choice.OfferSwitch?.keep || choice.Move?.slot === 0);
      expect(action).toBeGreaterThanOrEqual(0);
      snapshot = battle.act(action);
      const replacement = (snapshot.events as { SendOut?: { side: string; slot: number; mon: { hp: number; max_hp: number } } }[])
        .find((event) => event.SendOut?.side === "Enemy" && event.SendOut.slot === 1)?.SendOut;
      if (replacement) {
        expect(replacement.mon.hp).toBe(replacement.mon.max_hp);
        return;
      }
    }
    expect.fail("The trainer never sent out their second Pokémon");
  });

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
    expect(battle.snapshot().state.enemy.active.hp).toBeGreaterThan(0);
    expect(used).toBeGreaterThanOrEqual(0);
    expect(anim).toBeGreaterThan(used);
    expect(hp).toBeGreaterThan(anim);
    expect(events.some((e) => e.Message?.StatFell)).toBe(true);
    const capture = make();
    const ball = (capture.snapshot().legal as any[]).findIndex(
      (a) => a.Item?.id === 1,
    );
    const caught = capture.act(ball).events as any[];
    expect(capture.snapshot().bag.balls).toEqual([]);
    expect(caught.find((e) => e.BallWobbles)?.BallWobbles).toEqual({
      caught: true,
      wobbles: 3,
    });
    const captureMusic = caught.findIndex((e) => e.Music === "Capture");
    expect(captureMusic).toBeGreaterThan(caught.findIndex((e) => e.BallWobbles));
    expect(caught[captureMusic + 1]).toHaveProperty("Message.Caught");
  });
  it("delivers separate native charge and strike events for Dig", async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const lead = { ...engine.makePokemon(58, 22), moves: [91, 0, 0, 0], pp: [10, 0, 0, 0] };
    const battle = engine.startBattle({ party: [lead], opponent: { species: 19, level: 3 }, seed: 5 });
    const move = battle.snapshot().legal.findIndex((action: any) => action.Move?.slot === 0);
    const snapshot = battle.act(move);
    const phases = (snapshot.events as { Animation?: { anim: number; user: string; param: number } }[])
      .flatMap(({ Animation }) => Animation?.anim === 91 && Animation.user === "Player" ? [Animation.param] : []);
    expect(phases).toEqual([1, 0]);
    expect(snapshot.state.player.substatus?.[2]).toBe(0);
  });
  it("queues the effectiveness sound after the move animation and before HP loss", async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const lead = { ...engine.makePokemon(58, 22), moves: [52, 0, 0, 0], pp: [25, 0, 0, 0] };
    const battle = engine.startBattle({ party: [lead], opponent: { species: 10, level: 4 }, seed: 5 });
    const move = battle.snapshot().legal.findIndex((action: any) => action.Move?.slot === 0);
    const events = battle.act(move).events as any[];
    const animation = events.findIndex((event) => event.Animation?.anim === 52);
    expect(animation).toBeGreaterThanOrEqual(0);
    expect(events[animation + 1]).toEqual({ Sound: 173 });
    expect(events[animation + 2]).toHaveProperty("HpBar.target", "Enemy");
    const victory = events.findIndex((event) => event.Music === "Victory");
    expect(victory).toBeGreaterThan(events.findIndex((event) => event.Faint === "Enemy"));
    expect(events[victory + 1]).toHaveProperty("Message.GainedExp");
  });
});

describe.skipIf(!romAvailable)("complete native battle decisions", () => {
  it("emits a reserve item HP animation with the native party slot and spends one Potion", async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const patient = { ...engine.makePokemon(19, 8), nickname: "Scout", hp: 1 };
    const battle = engine.startBattle({
      party: [engine.makePokemon(58, 10), patient],
      opponent: { species: 19, level: 3 },
      items: [[18, 2]],
      seed: 5,
    });
    const action = (battle.snapshot().legal as any[]).findIndex((a) => a.Item?.id === 18 && a.Item.target === 1);
    expect(action).toBeGreaterThanOrEqual(0);
    const snapshot = battle.act(action);
    expect(snapshot.bag.items).toEqual([[18, 1]]);
    expect(snapshot.events).toContainEqual({
      HpBar: { target: { Party: 1 }, from: 1, to: 21, max: patient.stats[0] },
    });
    expect(snapshot.events).toContainEqual({ Message: { PartyRecoveredHp: { mon: "Scout", hp: 20 } } });
  });

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
    const span = engine.makePokemon(1, 7).exp - engine.makePokemon(1, 6).exp;
    expect(battle.snapshot().exp_progress[1]).toBe(Math.floor((span - 1) * 100 / span));
    const seen = new Set<string>();
    let victoryCues = 0;
    for (let step = 0; step < 100; step++) {
      const snap = battle.snapshot();
      const events = snap.events as any[];
      for (const [index, event] of events.entries()) {
        if (event.Music === "Victory") {
          victoryCues++;
          expect(events[index + 1]).toHaveProperty("Message.EnemyWasDefeated");
        }
      }
      for (const [index, event] of events.entries())
        if (event.Message) {
          const value = event.Message;
          if (value.GrewToLevel)
            expect(events[index - 1]).toEqual({ Sound: 0xb6 });
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
      const sentOut = battle.act(index);
      if (legal[index]?.ForcedSwitch?.slot === 1)
        expect(sentOut.events).toContainEqual({
          SendOut: {
            side: "Player",
            slot: 1,
            mon: expect.objectContaining({ species: lead.species, hp: lead.hp }),
          },
        });
    }
    expect(battle.snapshot().outcome).toBeTruthy();
    expect(seen.has("MonFainted")).toBe(true);
    expect(seen.has("EnemyMonFainted")).toBe(true);
    expect(seen.has("GrewToLevel")).toBe(true);
    expect(seen.has("AskForgetMove")).toBe(true);
    expect(victoryCues).toBe(1);
  });

  it("awards reserve EXP only to an actual Exp. Share holder", async () => {
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
    for (const expShare of [false, true]) {
      const battle = engine.startBattle({
        party: [lead, { ...reserve, item: expShare ? 57 : 0 }],
        opponent: { party: [enemy] },
        balls: [[5, 2]],
        seed: 123,
      });
      let learned = false;
      let sawActiveExpBar = false;
      const recipients = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const snapshot = battle.snapshot();
        const events = snapshot.events as any[];
        for (const [index, event] of events.entries()) {
          if (event.Message?.GrewToLevel?.slot === 1)
            expect(events[index - 1]).toEqual({ Sound: 0xb6 });
          if (event.Message?.GainedExp) recipients.add(event.Message.GainedExp.mon);
          if (event.ExpBar) {
            sawActiveExpBar = true;
            expect(event.ExpBar.slot).toBe(0);
            expect(event.ExpBar.from).toBeLessThan(event.ExpBar.to);
            expect(event.ExpBar.to).toBeLessThanOrEqual(100);
          }
        }
        if (snapshot.outcome) break;
        const actions = snapshot.legal as { Move?: { slot: number }; LearnMove?: { slot: number }; Item?: { id: number } }[];
        expect(snapshot.bag.balls).toEqual([[5, 2]]);
        expect(actions.some((a) => a.Item?.id === 5)).toBe(false);
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
      expect(learned).toBe(expShare);
      expect(sawActiveExpBar).toBe(true);
      expect(recipients.has(reserve.nickname)).toBe(expShare);
      expect(result?.party[1].level).toBe(expShare ? 7 : 6);
      expect(result?.party[1].moves[2]).toBe(expShare ? 73 : 39);
      if (!expShare) {
        expect(result?.party[1].exp).toBe(reserve.exp);
        expect(result?.party[1].stat_exp).toEqual(reserve.stat_exp);
      }
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
  const snapshot = { state: { player: { active: mon, active_slot: 0 }, enemy: { active: mon, active_slot: 1 } }, events: [], site: null, legal: [], outcome: null, result: null, bag: { items: [], balls: [] } };
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
