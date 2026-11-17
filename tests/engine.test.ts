import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { Engine } from "../src/engine";
const available =
  existsSync("pokecrystal11.gbc") && existsSync("public/astra_native.wasm");
describe.skipIf(!available)("Crystal ROM native bridge", () => {
  it("offers only balls and items that are actually in the inventory", async () => {
    const { instance } = await WebAssembly.instantiate(
      readFileSync("public/astra_native.wasm"),
      {},
    );
    const engine = new Engine(
      instance.exports as never,
      readFileSync("pokecrystal11.gbc"),
    );
    const battle = engine.startBattle({
      party: [engine.makePokemon(58, 6)],
      opponent: { species: 25, level: 5 },
      balls: [
        [1, 0],
        [2, 0],
        [4, 0],
        [5, 10],
      ],
      items: [[18, 0]],
      seed: 3,
    });
    const items = battle
      .snapshot()
      .legal.flatMap((action: any) => (action.Item ? [action.Item.id] : []));
    expect(items).toContain(5);
    expect(items).not.toContain(1);
    expect(items).not.toContain(2);
    expect(items).not.toContain(4);
    expect(items).not.toContain(18);
  });
  it("reads learnsets and evolves without losing experience or existing damage", async () => {
    const rom = readFileSync("pokecrystal11.gbc");
    const { instance } = await WebAssembly.instantiate(
      readFileSync("public/astra_native.wasm"),
      {},
    );
    const engine = new Engine(instance.exports as never, rom);
    expect(engine.evolutionData(1).evolutions).toContainEqual({
      method: 1,
      parameter: 16,
      species: 2,
    });
    expect(engine.evolutionData(1).learnset).toContainEqual({
      level: 7,
      move: 73,
    });
    for (let id = 1; id <= 251; id++)
      expect(engine.evolutionData(id).learnset.length).toBeGreaterThan(0);
    const mon = engine.makePokemon(1, 16);
    mon.hp -= 5;
    const evolved = engine.evolvePokemon(mon, 2);
    expect(evolved.exp).toBe(mon.exp);
    expect(evolved.dvs).toEqual(mon.dvs);
    expect(evolved.stats[0] - evolved.hp).toBe(5);
    expect(evolved.species).toBe(2);
  });
});
