import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { YellowRom } from "../src/yellow/rom";
import { MAP, SPRITE, TILESET } from "../src/yellow/generated/symbols";
import { CRYSTAL_SPRITE, CRYSTAL_SYM, CRYSTAL_TILESET } from "../src/yellow/generated/crystal";
import { CRYSTAL_LOOKS, type CrystalTile } from "../src/yellow/crystal-look";

const available = existsSync("pokeyellow.gbc") && existsSync("pokecrystal11.gbc") && existsSync("public/astra_native.wasm");

describe("Crystal looks for Yellow tilesets", () => {
  it("name real tilesets and tile ids", () => {
    const valid = (t: CrystalTile) =>
      typeof t === "number" ? (t >= 0 && t < 0x60) || (t >= 0x80 && t < 0xe0)
        : Array.isArray(t) ? CRYSTAL_TILESET[t[0]] !== undefined && valid(t[1])
          : t.keep >= 0 && t.keep < 8;
    for (const [name, look] of Object.entries(CRYSTAL_LOOKS)) {
      expect(TILESET[name], name).toBeDefined();
      expect(CRYSTAL_TILESET[look.tileset], `${name} → ${look.tileset}`).toBeDefined();
      for (const [tile, source] of Object.entries(look.tiles ?? {})) expect(valid(source), `${name} tile ${tile}`).toBe(true);
      for (const [block, tiles] of Object.entries(look.blocks ?? {})) {
        expect(tiles, `${name} block ${block}`).toHaveLength(16);
        for (const t of tiles) expect(valid(t), `${name} block ${block}`).toBe(true);
      }
    }
  });
});

describe.skipIf(!available)("Crystal graphics for Yellow maps", () => {
  const rom = new YellowRom(new Uint8Array(available ? readFileSync("pokeyellow.gbc") : []));
  const crystal = new Uint8Array(available ? readFileSync("pokecrystal11.gbc") : []);

  it("find Crystal's tables in the cartridge", () => {
    expect(CRYSTAL_SYM.Tilesets).toBe(0x4d596);
    // The Kanto tileset's palette map pointer sits in its tileset header.
    const kanto = CRYSTAL_SYM.Tilesets + CRYSTAL_TILESET.KANTO * 15;
    expect(crystal[kanto + 13] | (crystal[kanto + 14] << 8)).toBeGreaterThanOrEqual(0x4000);
    // Red's overworld sprite is a 12-tile walking sprite in Crystal's red palette.
    const red = CRYSTAL_SYM.OverworldSprites + (CRYSTAL_SPRITE.RED - 1) * 6;
    expect([crystal[red + 2], crystal[red + 4], crystal[red + 5]]).toEqual([12 * 16, 1, 0]);
  });

  it("cover every tile used on the maps of each tileset", () => {
    const unmapped: string[] = [];
    for (const [name, look] of Object.entries(CRYSTAL_LOOKS)) {
      if (look.identity) continue;
      const tileset = rom.tileset(TILESET[name]);
      const used = new Set<number>();
      for (const id of new Set(Object.values(MAP))) {
        const map = rom.map(id);
        if (!map || map.tileset !== TILESET[name]) continue;
        for (const block of new Set([...map.blocks, map.border])) {
          if (look.blocks?.[block]) continue;
          for (const t of rom.block(tileset, block)) used.add(t);
        }
      }
      for (const t of used) if (look.tiles?.[t] === undefined) unmapped.push(`${name} $${t.toString(16)}`);
    }
    expect(unmapped).toEqual([]);
  });

  it("draw Pallet Town's pond with Crystal's animated water", async () => {
    const { Engine } = await import("../src/engine");
    const { instance } = await WebAssembly.instantiate(readFileSync("public/astra_native.wasm"), {});
    const engine = new Engine(instance.exports as never, readFileSync("pokecrystal11.gbc"));
    const { CrystalGraphics } = await import("../src/yellow/crystal-gfx");
    const gfx = new CrystalGraphics(rom, engine.cartridge, d => engine.decompress(d));
    const pallet = rom.map(MAP.PALLET_TOWN)!;
    const tiles = new Set<number>();
    for (const block of pallet.blocks) for (const t of rom.block(rom.tileset(pallet.tileset), block)) tiles.add(t);
    expect(tiles.has(0x14)).toBe(true);
    const water = pallet.blocks.find(b => rom.block(rom.tileset(pallet.tileset), b).includes(0x14))!;
    const painted = (gfx as unknown as { tilesOf: (m: typeof pallet, b: number) => { slot: number; anim?: string }[] }).tilesOf(pallet, water);
    const tile = painted[rom.block(rom.tileset(pallet.tileset), water).indexOf(0x14)];
    expect(tile).toMatchObject({ slot: 3, anim: "water" });
    // Outdoor colors: Pallet Town's roof colors come from Crystal's Pallet map group.
    expect(gfx.colors(pallet)).toHaveLength(8);
  });

  it("draw every Yellow person with a Crystal sprite or Crystal colors", async () => {
    const { CrystalSprites } = await import("../src/yellow/crystal-sprites");
    const sprites = new CrystalSprites(rom, crystal);
    const missing = Object.keys(SPRITE).filter(name => !/NONE|UNUSED/.test(name) && !sprites.choose(SPRITE[name]));
    expect(missing).toEqual([]);
  });
});
