import { describe, expect, it } from "vitest";
import { cartridge, cartridgeBytes, hasCrystal, hasLegacy } from "./crystal-fixtures";
import { identifyCrystal } from "../src/crystal/rom";
import { C, ITEM, MON } from "../src/crystal/symbols";

describe.skipIf(!hasCrystal)("Crystal cartridge", () => {
  it("is recognised", async () => {
    expect(await identifyCrystal(cartridgeBytes("crystal"))).toBe("crystal");
  });
  it("reads New Bark Town", async () => {
    const rom = await cartridge("crystal");
    const map = rom.mapByName("NEW_BARK_TOWN");
    expect([map.width, map.height]).toEqual([10, 9]);
    expect(map.warps.length).toBe(4);
    expect(map.connections.map(c => c.dir).sort()).toEqual(["east", "west"]);
    expect(map.objects.length).toBe(3);
    const lab = map.warps[0];
    expect(rom.mapHeader(lab.group, lab.number).name).toBe("ELMS_LAB");
  });
  it("decodes dialogue", async () => {
    const rom = await cartridge("crystal");
    const elm = rom.mapByName("ELMS_LAB");
    expect(elm.objects.some(o => o.sprite === C("SPRITE_ELM"))).toBe(true);
  });
  it("reads a map's fishing group", async () => {
    const rom = await cartridge("crystal");
    // New Bark Town fishes in the ocean: Magikarp and Tentacool on the Old Rod.
    const ocean = rom.fish(rom.mapByName("NEW_BARK_TOWN").fishGroup, 0).table.map(e => e.species);
    expect(ocean).toEqual([MON.MAGIKARP, MON.MAGIKARP, MON.TENTACOOL]);
    expect(rom.fish(rom.mapByName("ROUTE_4").fishGroup, 0).table).toEqual([]);
  });
  it("reads encounter tables", async () => {
    const rom = await cartridge("crystal");
    const [g, n] = [rom.mapByName("ROUTE_29").group, rom.mapByName("ROUTE_29").number];
    const grass = rom.grass(g, n)!;
    expect(grass.slots[0].map(s => s.species)).toContain(MON.PIDGEY);
    expect(rom.martStock(C("MART_CHERRYGROVE"))).toEqual([ITEM.POTION, ITEM.ANTIDOTE, ITEM.PARLYZ_HEAL, ITEM.AWAKENING]);
    expect(rom.itemName(ITEM.POKE_BALL)).toBe("POKé BALL");
    expect(rom.trainerParty(C("FALKNER"), 1).mons.map(m => m.species)).toEqual([MON.PIDGEY, MON.PIDGEOTTO]);
  });
});

describe.skipIf(!hasLegacy)("Crystal Legacy cartridge", () => {
  it("is recognised once patched", async () => {
    expect(await identifyCrystal(cartridgeBytes("legacy"))).toBe("legacy");
  });
  it("reads its maps", async () => {
    const rom = await cartridge("legacy");
    const map = rom.mapByName("NEW_BARK_TOWN");
    expect(map.warps.length).toBe(4);
    expect(rom.itemName(ITEM.POKE_BALL)).toBe("POKé BALL");
  });
});
