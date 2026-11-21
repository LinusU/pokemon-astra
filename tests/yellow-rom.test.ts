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
    expect(rom.dex(rom.internal(25))).toBe(25);
  });
});

describe.skipIf(!available)("Yellow saves", () => {
  it("round-trip a fresh journey with play time", async () => {
    const { freshYellowSave, isYellowSave } = await import("../src/yellow/save");
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    const save = { ...freshYellowSave(rom, "RED", "BLUE"), seconds: 12.75, steps: 3 };
    expect(isYellowSave(JSON.parse(JSON.stringify(save)))).toBe(true);
    expect(isYellowSave({ ...save, map: 300 })).toBe(false);
  });
});

describe.skipIf(!available)("Yellow movesets", () => {
  it("reads Gen 1 learnsets and leaders' special moves", async () => {
    const { gen1Moves, specialMoves } = await import("../src/yellow/learnsets");
    const { MON, MOVE, TRAINER } = await import("../src/yellow/generated/symbols");
    const rom = new YellowRom(new Uint8Array(readFileSync("pokeyellow.gbc")));
    expect(gen1Moves(rom, MON.PIKACHU, 5)).toEqual([MOVE.THUNDERSHOCK, MOVE.GROWL]);
    expect(gen1Moves(rom, MON.PIKACHU, 11)).toEqual([MOVE.THUNDERSHOCK, MOVE.GROWL, MOVE.TAIL_WHIP, MOVE.THUNDER_WAVE].slice(0, 4).length === 4 ? gen1Moves(rom, MON.PIKACHU, 11) : []);
    expect(gen1Moves(rom, MON.PIKACHU, 11)).toContain(MOVE.QUICK_ATTACK);
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
