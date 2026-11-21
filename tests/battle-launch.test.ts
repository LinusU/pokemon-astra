import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Engine, type BattleSnapshot, type Pokemon } from "../src/engine";
import { autoPlay, battleEnd, finishedBattle } from "../src/ui/battle-launch";

const mon = (hp: number) => ({ species: 25, hp }) as Pokemon;
const ended = (outcome: string, options: { party?: Pokemon[]; caught?: number | null; events?: unknown[] } = {}) =>
  ({
    outcome,
    events: options.events ?? [],
    result: {
      outcome, party: options.party ?? [mon(20)], caught: options.caught ?? null, money: 0,
      bag: { balls: [], items: [] }, may_evolve: [], world: { seen: [], caught: [] },
    },
  }) as unknown as BattleSnapshot;

describe("how a battle ended", () => {
  it("names wins, losses and catches", () => {
    expect(battleEnd(ended("win"))).toBe("win");
    expect(battleEnd(ended("loss"))).toBe("loss");
    expect(battleEnd(ended("caught", { caught: 1, party: [mon(20), mon(30)] }))).toBe("caught");
  });

  it("counts a team with no Pokémon standing as a loss", () => {
    expect(battleEnd(ended("draw", { party: [mon(0), mon(0)] }))).toBe("loss");
  });

  it("tells an escape from a plain draw", () => {
    expect(battleEnd(ended("draw", { events: [{ Message: "GotAwaySafely" }] }))).toBe("escaped");
    expect(battleEnd(ended("draw", { events: [{ Message: { WildFled: { mon: "Abra" } } }] }))).toBe("escaped");
    expect(battleEnd(ended("draw"))).toBe("draw");
  });

  it("sends a catch beyond six Pokémon to storage", () => {
    const party = [1, 2, 3, 4, 5, 6, 7].map(n => mon(n));
    const f = finishedBattle(ended("caught", { caught: 6, party }));
    expect(f.party).toHaveLength(6);
    expect(f.overflow).toEqual([party[6]]);
  });
});

const native = existsSync("pokecrystal11.gbc") && existsSync("public/astra_native.wasm");
describe.skipIf(!native)("auto-played battles", () => {
  it("win a lopsided wild battle on the native engine", async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const battle = engine.startBattle({ party: [engine.makePokemon(6, 60)], opponent: { species: 19, level: 3 } });
    const f = finishedBattle(autoPlay(engine, battle));
    expect(f.end).toBe("win");
    expect(f.party[0].species).toBe(6);
  });
});
