import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { Engine } from "../src/engine";
const available =
  existsSync("pokecrystal11.gbc") && existsSync("public/astra_native.wasm");
describe.skipIf(!available)("Crystal ROM native bridge", () => {
  it("decodes distinct directional walk poses and retains enclosed highlights", async () => {
    // ImageData is normally supplied by the browser.
    const previous = globalThis.ImageData;
    globalThis.ImageData = class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
      colorSpace = "srgb" as const;
    } as typeof ImageData;
    try {
      const { instance } = await WebAssembly.instantiate(
        readFileSync("public/astra_native.wasm"),
        {},
      );
      const engine = new Engine(
        instance.exports as never,
        readFileSync("pokecrystal11.gbc"),
      );
      for (const direction of ["down", "up", "left", "right"]) {
        const still = engine.npc("player", false, direction, 0).data;
        const walking = engine.npc("player", false, direction, 1).data;
        expect(Array.from(still)).not.toEqual(Array.from(walking));
      }
      for (const direction of ["down", "up"])
        expect(
          Array.from(engine.npc("player", false, direction, 1).data),
        ).not.toEqual(
          Array.from(engine.npc("player", false, direction, 2).data),
        );
      expect(engine.move(7).type).toBe(20); // Fire Punch
      expect(engine.move(9).type).toBe(23); // Thunder Punch
      const sprite = engine.sprite(1);
      expect(sprite.data[3]).toBe(0);
      expect(
        Array.from(sprite.data).some(
          (v, i) =>
            i % 4 === 0 &&
            v === 255 &&
            sprite.data[i + 1] === 255 &&
            sprite.data[i + 2] === 255 &&
            sprite.data[i + 3] === 255,
        ),
      ).toBe(true);
    } finally {
      globalThis.ImageData = previous;
    }
  });
  it("synthesizes all battle sound events from the imported ROM", async () => {
    const { instance } = await WebAssembly.instantiate(
      readFileSync("public/astra_native.wasm"),
      {},
    );
    const engine = new Engine(
      instance.exports as never,
      readFileSync("pokecrystal11.gbc"),
    );
    for (const id of [4, 5, 42, 43, 47, 94, 182]) {
      const pcm = engine.soundEffect(id);
      expect(pcm.length).toBeGreaterThan(1000);
      expect(pcm.some((sample) => Math.abs(sample) > 0.01)).toBe(true);
    }
    expect(() => engine.soundEffect(192)).toThrow("Unsupported sound effect");
  });
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
