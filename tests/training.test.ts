import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Engine } from "../src/engine";
import { freshSave, isValidSave } from "../src/game/save";
import { finishEvolutionChoice, levelEvolution, queueEvolutionMoves, recordTravel, resolveEvolutionMove } from "../src/game/training";

describe.skipIf(!existsSync("pokecrystal11.gbc") || !existsSync("public/astra_native.wasm"))("party development", () => {
  let engine: Engine;
  beforeAll(async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
  });
  it("takes a battle-earned level through evolution and learns Butterfree’s Confusion", () => {
    const metapod = engine.teachMove(engine.makePokemon(11, 9), 33, 1);
    metapod.exp = engine.makePokemon(11, 10).exp - 1;
    const battle = engine.startBattle({ party: [metapod], opponent: { species: 16, level: 2 }, seed: 5 });
    let state = battle.snapshot();
    for (let turns = 0; turns < 30 && !state.result; turns++) {
      const choice = state.legal.findIndex((a: any) => a === "Fight" || a.Move?.slot === 1);
      expect(choice).toBeGreaterThanOrEqual(0);
      state = battle.act(choice);
    }
    expect(state.result?.may_evolve).toEqual([0]);
    let save = freshSave();
    save.party = state.result!.party;
    save.pendingEvolutions = state.result!.may_evolve;
    const target = levelEvolution(save.party[0], false, engine);
    expect(target).toBe(12);
    save.party[0] = engine.evolvePokemon(save.party[0], target!);
    finishEvolutionChoice(save);
    queueEvolutionMoves(save, 0, engine);
    expect(save.pendingMoves).toEqual({ slot: 0, moves: [93] });
    save = JSON.parse(JSON.stringify(save));
    expect(isValidSave(save)).toBe(true);
    resolveEvolutionMove(save, save.party[0].moves.indexOf(0), engine);
    expect(save.party[0].moves).toEqual([106, 33, 93, 0]);
    expect(save.party[0].pp[2]).toBe(engine.move(93).pp);
    queueEvolutionMoves(save, 0, engine);
    expect(save.pendingMoves).toBeUndefined();
  });
  it("keeps incumbent moves and PP when declining a post-evolution lesson", () => {
    const save = freshSave();
    const eevee = engine.makePokemon(133, 16);
    save.party = [engine.evolvePokemon(eevee, 134)];
    queueEvolutionMoves(save, 0, engine);
    expect(save.pendingMoves?.moves).toEqual([55]);
    resolveEvolutionMove(save, undefined, engine);
    expect(save.party[0].moves).toEqual(eevee.moves);
    expect(save.party[0].pp).toEqual(eevee.pp);
    expect(save.pendingMoves).toBeUndefined();
  });
  it("credits only the traveling party for crossing walking milestones and honors Everstone", () => {
    const save = freshSave();
    const eevee = { ...engine.makePokemon(133, 20), happiness: 219 };
    save.party = [eevee, { ...eevee, happiness: 255 }];
    save.storage = [{ ...eevee }];
    save.steps = 127.5;
    recordTravel(save, 0.25);
    expect(levelEvolution(eevee, false, engine)).toBeUndefined();
    recordTravel(save, 0.5);
    expect(eevee.happiness).toBe(220);
    expect(levelEvolution(eevee, false, engine)).toBe(196);
    expect(levelEvolution(eevee, true, engine)).toBe(197);
    expect(levelEvolution({ ...eevee, item: 112 }, true, engine)).toBeUndefined();
    expect(save.storage[0].happiness).toBe(219);
    expect(save.party[1].happiness).toBe(255);
  });
});
