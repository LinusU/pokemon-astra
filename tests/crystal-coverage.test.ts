import { describe, expect, it } from "vitest";
import { CARTRIDGES, cartridge } from "./crystal-fixtures";
import { engineEntries, mapEntries, walkScripts } from "../src/crystal/coverage";

describe.skipIf(!CARTRIDGES.length).each(CARTRIDGES)("Crystal script coverage on %s", cart => {
  it("has a port of every command, special and routine its scripts reach", async () => {
    const rom = await cartridge(cart);
    const { gaps, scripts } = walkScripts(rom, [...mapEntries(rom), ...engineEntries(rom)]);
    expect(scripts).toBeGreaterThan(5000);
    expect(gaps.map(g => `${g.kind} ${g.name} (${g.where})`)).toEqual([]);
  });
});
