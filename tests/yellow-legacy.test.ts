import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyBps, BpsError, crc32, isBps } from "../src/yellow/bps";
import { YELLOW_SHA1 as LEGACY_TABLE_SHA1 } from "../src/yellow/generated/symbols-legacy";
import { specialMoves } from "../src/yellow/learnsets";
import { identifyYellow, LEGACY_SHA1, YellowRom } from "../src/yellow/rom";
import { ITEM, MAP, MOVE, TRAINER, useCartridge } from "../src/yellow/symbols";

/** A BPS patch from its actions: source reads, target reads, then the CRCs. */
function bps(source: Uint8Array, target: Uint8Array, actions: number[]) {
  const num = (n: number) => {
    const out: number[] = [];
    for (;;) {
      const x = n & 0x7f;
      n = Math.floor(n / 128);
      if (n === 0) { out.push(x | 0x80); return out; }
      out.push(x);
      n--;
    }
  };
  const bytes = [0x42, 0x50, 0x53, 0x31, ...num(source.length), ...num(target.length), ...num(0), ...actions];
  const word = (v: number) => [v & 0xff, v >>> 8 & 0xff, v >>> 16 & 0xff, v >>> 24];
  bytes.push(...word(crc32(source)), ...word(crc32(target)));
  bytes.push(...word(crc32(new Uint8Array(bytes))));
  return new Uint8Array(bytes);
}

describe("BPS patches", () => {
  it("reads the source and the patch", () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const target = new Uint8Array([1, 2, 9, 9, 9]);
    // SourceRead 2 ((2 - 1) << 2 | 0), TargetRead 3 ((3 - 1) << 2 | 1) of 9s.
    const patch = bps(source, target, [(1 << 2 | 0) | 0x80, (2 << 2 | 1) | 0x80, 9, 9, 9]);
    expect(isBps(patch)).toBe(true);
    expect([...applyBps(source, patch)]).toEqual([...target]);
    expect(() => applyBps(new Uint8Array([1, 2, 3, 5]), patch)).toThrow(BpsError);
  });
});

describe("Yellow Legacy's table", () => {
  it("is for the cartridge the official patch makes", () => {
    expect(LEGACY_TABLE_SHA1).toBe(LEGACY_SHA1);
  });
});

const available = existsSync("pokeyellow.gbc") && existsSync("yellow-legacy.bps");
describe.skipIf(!available)("The official Yellow Legacy V1.0.10 patch", () => {
  it("patches the local Yellow cartridge into Yellow Legacy", async () => {
    const yellow = new Uint8Array(readFileSync("pokeyellow.gbc"));
    const legacy = applyBps(yellow, new Uint8Array(readFileSync("yellow-legacy.bps")));
    expect(await identifyYellow(yellow)).toBe("yellow");
    expect(await identifyYellow(legacy)).toBe("legacy");
  });
  it("reads Yellow Legacy's cartridge through its own table", async () => {
    const legacy = applyBps(new Uint8Array(readFileSync("pokeyellow.gbc")), new Uint8Array(readFileSync("yellow-legacy.bps")));
    await useCartridge("legacy");
    try {
      const rom = new YellowRom(legacy);
      // Legacy's TM04 is Flamethrower instead of Whirlwind.
      expect(ITEM.TM_FLAMETHROWER).toBe(0xcc);
      expect(rom.machineMove(ITEM.TM_FLAMETHROWER)).toBe(MOVE.FLAMETHROWER);
      expect(rom.trainerClassName(TRAINER.JANINE)).toBe("JANINE");
      const { prizes } = await import("../src/yellow/game-corner");
      expect(prizes(rom).map(w => w.map(p => `${p.name} ${p.level ?? ""} ${p.cost}`.replace("  ", " ")))).toEqual([
        ["ABRA 15 230", "SEEL 20 500", "MAGMAR 22 1500"],
        ["ELECTABUZZ 22 1500", "DRATINI 25 3000", "PORYGON 30 4500"],
        ["TM_DRAGON_RAGE 1000", "TM_HYPER_BEAM 5000", "TM_SUBSTITUTE 3000"],
      ]);
      // Brock's Onix knows more than Yellow's hand-picked Bide.
      expect(specialMoves(rom, TRAINER.BROCK, 1).length).toBeGreaterThan(1);
      const { freshYellowSave, isYellowSave } = await import("../src/yellow/save");
      const save = freshYellowSave(rom, "yellow-legacy", "RED", "BLUE");
      expect(isYellowSave(JSON.parse(JSON.stringify(save)), "yellow-legacy")).toBe(true);
      expect(isYellowSave(save, "yellow")).toBe(false);
    } finally {
      await useCartridge("yellow");
    }
  });
  it("decodes every trainer party and wild table of Yellow Legacy", async () => {
    const legacy = applyBps(new Uint8Array(readFileSync("pokeyellow.gbc")), new Uint8Array(readFileSync("yellow-legacy.bps")));
    await useCartridge("legacy");
    try {
      const rom = new YellowRom(legacy);
      const bad: string[] = [];
      const valid = (where: string, m: { species: number; level: number }) => {
        const dex = rom.dex(m.species);
        if (!(dex >= 1 && dex <= 151 && m.level >= 1 && m.level <= 100)) bad.push(`${where}: ${m.species} L${m.level}`);
      };
      for (const [name, id] of Object.entries(MAP)) {
        const map = !name.startsWith("UNUSED_MAP_") && rom.map(id);
        if (!map) continue;
        const wild = rom.wild(id);
        for (const m of [...wild.grass, ...wild.water]) valid(map.label, m);
        for (const { trainer } of map.objects) {
          if (!trainer) continue;
          const party = rom.trainerParty(trainer.klass, trainer.index);
          if (!party.length || party.length > 6) bad.push(`${map.label}: ${trainer.klass}/${trainer.index} has ${party.length}`);
          for (const m of party) valid(`${map.label} ${trainer.klass}/${trainer.index}`, m);
          for (const { mon, slot, move } of specialMoves(rom, trainer.klass, trainer.index))
            if (mon >= party.length || slot > 3 || !move || move > MOVE.STRUGGLE) bad.push(`${map.label}: ${trainer.klass}/${trainer.index} move ${move}`);
        }
      }
      expect(bad).toEqual([]);
    } finally {
      await useCartridge("yellow");
    }
  });
});
