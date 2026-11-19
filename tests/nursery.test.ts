import { existsSync, readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Engine, type Pokemon } from "../src/engine";
import { canNest, collectPair, gender, hatchEgg, leavePair } from "../src/game/nursery";
import { freshSave, isValidSave, type Save } from "../src/game/save";

describe.skipIf(!existsSync("public/astra_native.wasm") || !existsSync("pokecrystal11.gbc"))("Reedhaven breeding", () => {
  let engine: Engine;
  let mother: Pokemon, father: Pokemon, lead: Pokemon;
  beforeAll(async () => {
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    mother = { ...engine.makePokemon(26, 25), dvs: [0x21, 0x31] };
    // Raichu's offspring can inherit Encore from a male Clefairy of the Fairy group.
    father = engine.teachMove({ ...engine.makePokemon(35, 25), dvs: [0xf2, 0x36] }, 227, 1);
    lead = engine.makeStarter(58);
  });

  it("reads the species families, compatibility, egg cycles and moves of the verified cartridge", () => {
    expect(gender(mother, engine)).toBe("♀");
    expect(gender(father, engine)).toBe("♂");
    expect(engine.firstStage(26)).toBe(172);
    expect(engine.firstStage(106)).toBe(236);
    expect(engine.firstStage(230)).toBe(116);
    expect(engine.inheritableMoves(172)).toContain(227);
    for (let id = 1; id <= 251; id++) {
      const { cycles, groups } = engine.breedingData(id);
      expect(cycles).toBeGreaterThan(0);
      expect(groups.every(group => group >= 1 && group <= 15)).toBe(true);
      expect([...engine.inheritableMoves(id)].every(move => move >= 1 && move <= 251)).toBe(true);
    }
    expect(canNest([mother, father, lead], 0, 1, engine)).toBe(true);
    expect(canNest([mother, father], 0, 1, engine)).toBe(false);
    expect(canNest([mother, { ...father, dvs: mother.dvs }, lead], 0, 1, engine)).toBe(false);
    expect(canNest([mother, { ...father, dvs: [0x12, 0x36] }, lead], 0, 1, engine)).toBe(false);
    const ditto = { ...father, species: 132 };
    expect(canNest([mother, ditto, lead], 0, 1, engine)).toBe(true);
    expect(canNest([ditto, { ...mother, species: 150 }, lead], 0, 1, engine)).toBe(false);
    expect(canNest([ditto, { ...mother, species: 172 }, lead], 0, 1, engine)).toBe(false);
  });

  it("returns an early pair intact and gives the walking reward exactly once across a save round trip", () => {
    let save = freshSave();
    save.party = [lead, father, mother];
    expect(leavePair(save, 2, 1, engine)).toBe(true);
    expect(save.party).toEqual([lead]);
    collectPair(save, engine);
    expect(save.party).toEqual([lead, mother, father]);
    expect(save.egg).toBeUndefined();
    expect(leavePair(save, 1, 2, engine)).toBe(true);
    save.steps = 96;
    save.party.push(...Array(5).fill(lead));
    const roundTrip = (current: Save): Save => {
      const copy = JSON.parse(JSON.stringify(current));
      expect(isValidSave(copy)).toBe(true);
      return copy;
    };
    save = roundTrip(save);
    collectPair(save, engine, () => 0.25);
    collectPair(save, engine);
    expect(save.storage.map(mon => mon.species)).toEqual([26, 35]);
    expect(save.egg?.mon.species).toBe(172);
    expect(save.egg?.mon.moves).toContain(227);
    expect(save.caught).not.toContain(172);
    expect(save.nursery).toBeUndefined();
    expect(hatchEgg(save)).toBeUndefined();
    save.steps = save.egg!.hatchAt;
    save = roundTrip(save);
    const hatched = hatchEgg(save);
    expect(hatched?.stored).toBe(true);
    expect(hatched?.mon.hp).toBe(hatched?.mon.stats[0]);
    expect(hatched?.mon.happiness).toBe(120);
    expect(save.storage.map(mon => mon.species)).toEqual([26, 35, 172]);
    expect(save.caught).toEqual([172]);
    expect(hatchEgg(roundTrip(save))).toBeUndefined();
  });
});
