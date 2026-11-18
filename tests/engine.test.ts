import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { Engine } from "../src/engine";
import { HEAL_TRACK, OVERWORLD_SOUNDS } from "../src/game/audio";
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
    const sounds = new Set([42, 43, 47, 94, 171, 172, 173, 182, ...Object.values(OVERWORLD_SOUNDS)]);
    for (let move = 1; move <= 277; move++) {
      if (move > 251 && move < 255) continue;
      for (const param of [0, 1, 2, 3, 4, 5, 7, 10]) {
        const timeline = engine.battleSound(move, param, { wobbles: 3, caught: true });
        expect(timeline, `animation ${move}, param ${param}`).toBeDefined();
        for (const cue of timeline!.cues)
          if (cue.kind === "effect") sounds.add(cue.id);
      }
    }
    for (const id of sounds) {
      const pcm = engine.soundEffect(id);
      expect(pcm.length, `SFX ${id}`).toBeGreaterThan(0);
      expect(pcm.some((sample) => Math.abs(sample) > 0.01), `SFX ${id}`).toBe(true);
    }
    expect(() => engine.soundEffect(0xcf)).toThrow("Unsupported sound effect");
  });
  it("decodes the finite Pokémon Center healing music from the cartridge", async () => {
    const rom = readFileSync("pokecrystal11.gbc");
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, rom);
    const entry = 0x3a * 0x4000 + 0x106e + 0x0d * 3;
    expect(HEAL_TRACK).toEqual([rom[entry], rom.readUInt16LE(entry + 1)]);
    const samples = engine.music(...HEAL_TRACK);
    expect(samples.some((sample) => Math.abs(sample) > 0.03)).toBe(true);
    expect(samples.length).toBeLessThan(48000 * 10);
  });
  it("follows timed repeats, parameter branches, and actor cries", async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    expect(engine.battleSound(44, 0)?.cues).toEqual([
      { frame: 9, kind: "effect", track: 1, id: 69 },
      { frame: 26, kind: "effect", track: 1, id: 69 },
    ]);
    expect(engine.battleSound(57, 0)?.cues.map((cue) => cue.frame)).toEqual([0, 33, 66, 99]);
    expect(engine.battleSound(76, 1)?.cues).not.toEqual(engine.battleSound(76, 0)?.cues);
    expect(engine.battleSound(45, 0)?.cues).toEqual([{ frame: 0, kind: "cry", lengthOffset: 192 }]);
    expect(engine.cry(25, 192).length).toBeGreaterThan(engine.cry(25).length);
    const escaped = engine.battleSound(256, 5, { wobbles: 2, caught: false })!.cues;
    expect(escaped.filter((cue) => cue.kind === "effect" && cue.id === 179)).toHaveLength(2);
    expect(escaped.at(-1)).toMatchObject({ kind: "effect", id: 41 });
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
