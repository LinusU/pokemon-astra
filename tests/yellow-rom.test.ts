import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAP, SYM } from "../src/yellow/generated/symbols";
import { YellowRom, verifyYellow } from "../src/yellow/rom";

const available = existsSync("pokeyellow.gbc");
describe.skipIf(!available)("Pokémon Yellow cartridge data", () => {
  const rom = new YellowRom(new Uint8Array(available ? readFileSync("pokeyellow.gbc") : []));

  it("accepts only the English Yellow release", async () => {
    await expect(verifyYellow(rom.bytes)).resolves.toBeUndefined();
    const altered = rom.bytes.slice();
    altered[0x150] ^= 1;
    await expect(verifyYellow(altered)).rejects.toThrow(/Yellow/);
  });

  it("reads map headers, connections, warps and objects", () => {
    const pallet = rom.map(MAP.PALLET_TOWN)!;
    expect([pallet.width, pallet.height]).toEqual([10, 9]);
    expect(pallet.connections.map(c => [c.dir, c.map])).toEqual([["north", MAP.ROUTE_1], ["south", MAP.ROUTE_21]]);
    expect(pallet.warps.map(w => w.map)).toEqual([MAP.REDS_HOUSE_1F, MAP.BLUES_HOUSE, MAP.OAKS_LAB]);
    expect(pallet.objects).toHaveLength(3);
    expect(rom.mapName(MAP.VIRIDIAN_FOREST)).toBe("VIRIDIAN FOREST");
    let maps = 0;
    for (let id = 0; id < rom.mapCount; id++) if (rom.map(id)) maps++;
    expect(maps).toBeGreaterThan(220);
  });

  it("decodes dialogue, trainers, encounters and items", () => {
    const pallet = rom.map(MAP.PALLET_TOWN)!;
    expect(rom.text(rom.mapText(pallet, 2))[0]).toMatchObject({ op: "text", s: expect.stringContaining("raising") });
    expect(rom.text(SYM["PalletTownOakText.HeyWaitDontGoOutText"])[0]).toMatchObject({ s: "OAK: Hey! Wait!\nDon't go out!" });
    expect(rom.trainerParty(1, 1).map(m => rom.monName(m.species))).toEqual(["RATTATA", "EKANS"]);
    expect(rom.trainerMoney(1)).toBe(15);
    expect(rom.wild(MAP.ROUTE_1).grass).toHaveLength(10);
    expect([rom.itemName(4), rom.itemPrice(4), rom.itemName(0xc4)]).toEqual(["POKé BALL", 200, "HM01"]);
    // TM01 Mega Punch, TM04 Whirlwind and HM01 Cut: the table lists the TMs before the HMs.
    expect([0xc9, 0xcc, 0xc4].map(item => rom.machineMove(item))).toEqual([5, 18, 15]);
    expect(rom.dex(rom.internal(25))).toBe(25);
  });
});

describe.skipIf(!available)("Yellow saves", () => {
  it("round-trip a fresh journey with play time", async () => {
    const { freshYellowSave, isYellowSave } = await import("../src/yellow/save");
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    const save = { ...freshYellowSave(rom, "yellow", "RED", "BLUE"), seconds: 12.75, steps: 3 };
    expect(isYellowSave(JSON.parse(JSON.stringify(save)), "yellow")).toBe(true);
    expect(isYellowSave({ ...save, map: 300 }, "yellow")).toBe(false);
  });
  it("keep the movement choice", async () => {
    const { freshYellowSave, isYellowSave } = await import("../src/yellow/save");
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    const save = freshYellowSave(rom, "yellow", "RED", "BLUE");
    expect(isYellowSave({ ...save, settings: { ...save.settings, movement: "grid" } }, "yellow")).toBe(true);
    expect(isYellowSave({ ...save, settings: { ...save.settings, movement: "diagonal" } }, "yellow")).toBe(false);
  });
});

describe.skipIf(!available)("Yellow movesets", () => {
  it("reads leaders' special moves", async () => {
    const { specialMoves } = await import("../src/yellow/learnsets");
    const { MOVE, TRAINER } = await import("../src/yellow/generated/symbols");
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    expect(specialMoves(rom, TRAINER.BROCK, 1)).toEqual([{ mon: 1, slot: 2, move: MOVE.BIND }, { mon: 1, slot: 3, move: MOVE.BIDE }]);
  });
});

describe.skipIf(!available)("Yellow script coverage", () => {
  it("has a port for every map script, text routine and hidden object", async () => {
    await import("../src/yellow/scripts");
    const { coverageGaps } = await import("../src/yellow/coverage");
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    expect(coverageGaps(rom)).toEqual([]);
  });
});

describe("Yellow item constants", () => {
  it("number TMs after the HMs", async () => {
    const { ITEM } = await import("../src/yellow/generated/symbols");
    expect([ITEM.HM_CUT, ITEM.HM_FLASH, ITEM.TM_MEGA_PUNCH, ITEM.TM_THUNDERBOLT, ITEM.TM_SUBSTITUTE]).toEqual([0xc4, 0xc8, 0xc9, 0xe0, 0xfa]);
  });
});

const crystal = existsSync("pokecrystal11.gbc") && existsSync("public/astra_native.wasm");
describe.skipIf(!available || !crystal)("Yellow items in Crystal battles", () => {
  it("maps every battle item, Poké Balls included", async () => {
    const { Engine } = await import("../src/engine");
    const { crystalItemMap } = await import("../src/yellow/items");
    const { ITEM } = await import("../src/yellow/generated/symbols");
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    const map = crystalItemMap(engine, rom);
    for (const item of ["POKE_BALL", "GREAT_BALL", "ULTRA_BALL", "MASTER_BALL", "POTION", "FULL_RESTORE", "POKE_DOLL", "X_ACCURACY", "MAX_ELIXER"])
      expect(map.get(ITEM[item]), item).toBeGreaterThan(0);
    expect(engine.itemName(map.get(ITEM.POKE_BALL)!)).toBe("POKE BALL");
  });
  it("takes machine compatibility from the game data where Crystal has the machine", async () => {
    const { Engine } = await import("../src/engine");
    const { canLearnMachine } = await import("../src/yellow/evolution");
    const { ITEM } = await import("../src/yellow/generated/symbols");
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    const game = { engine, rom } as never;
    for (let dex = 1; dex <= 151; dex++) {
      // Toxic is a Crystal TM; Mega Punch is not, so Yellow's own list decides it.
      expect(canLearnMachine(game, dex, ITEM.TM_TOXIC), `${dex}`).toBe(engine.machineMoves(dex).has(92));
      const bit = (rom.u8(SYM.BaseStats + (dex - 1) * 28 + 20) & 1) !== 0;
      expect(canLearnMachine(game, dex, ITEM.TM_MEGA_PUNCH), `${dex}`).toBe(bit);
    }
  });
});
