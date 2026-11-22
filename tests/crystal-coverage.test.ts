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

describe("Crystal text labels", () => {
  it("names only texts that one of the cartridges has", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const tables = ["crystal", "legacy"].map(name => {
      const source = readFileSync(`src/crystal/generated/symbols-${name}.ts`, "utf8");
      return new Set(Object.keys(JSON.parse(source.match(/export const TEXT[^=]*=\s*(\{[^\n]*\})/)![1])));
    });
    // Labels passed straight to the text helpers, or read from TEXT; a label a
    // helper prefixes itself (MoveDeletion., BuenaPrize., …) isn't checked here.
    const patterns = [
      /\b(?:engineText|text|martText|engine|phoneText|cartridgeLine)\(\s*(?:g|game)\s*,\s*"([^"]+)"/g,
      /\bTEXT\.([A-Za-z_]\w*)/g,
      /\bTEXT\["([^"]+)"\]/g,
    ];
    const unknown: string[] = [];
    for (const file of readdirSync("src/crystal").filter(f => f.endsWith(".ts"))) {
      const source = readFileSync(`src/crystal/${file}`, "utf8");
      for (const pattern of patterns) for (const [, label] of source.matchAll(pattern))
        if (!tables.some(t => t.has(label))) unknown.push(`${file}: ${label}`);
    }
    expect(unknown).toEqual([]);
  });
});
