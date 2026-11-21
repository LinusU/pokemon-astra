/**
 * Draws Yellow's maps with Pokémon Crystal's tiles and colors, decoded from
 * the player's Crystal cartridge. Yellow's blocks, collision and events are
 * unchanged; only the pictures come from Crystal.
 */
import { MAP, TILESET } from "./generated/symbols";
import { CRYSTAL_MAP_GROUP, CRYSTAL_SYM, CRYSTAL_TILESET } from "./generated/crystal";
import { CRYSTAL_LOOKS, type CrystalLook, type CrystalTile } from "./crystal-look";
import type { MapHeader, YellowRom } from "./rom";
import type { Rgb } from "./gfx";

interface CrystalTileset {
  /** Decompressed 2bpp graphics: tiles $00–$5F, then $80–$DF. */
  graphics: Uint8Array;
  /** Packed palette map, one nibble per tile id. */
  palMap: number;
}
interface Painted {
  pixels: number[];
  slot: number;
  /** Animation: Crystal water at $14 and flowers at $03. */
  anim?: "water" | "flower" | "cave";
}

const OUTDOOR_WATER = 0x28;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class CrystalGraphics {
  private tilesets = new Map<number, CrystalTileset>();
  private maps = new Map<string, HTMLCanvasElement>();
  private blocks = new Map<string, HTMLCanvasElement>();
  private frames = new Map<string, HTMLCanvasElement>();
  private animated = new Map<string, { x: number; y: number; tile: Painted }[]>();
  constructor(readonly rom: YellowRom, readonly crystal: Uint8Array, private decompress: (data: Uint8Array) => Uint8Array) {}

  /** Whether a map has a Crystal look. */
  covers(map: MapHeader) {
    return !!this.look(map);
  }
  private look(map: MapHeader): CrystalLook | undefined {
    const name = Object.keys(TILESET).find(k => TILESET[k] === map.tileset);
    return name ? CRYSTAL_LOOKS[name] : undefined;
  }

  private u16(o: number) {
    return this.crystal[o] | (this.crystal[o + 1] << 8);
  }
  private far(o: number) {
    return this.crystal[o] * 0x4000 + (this.u16(o + 1) & 0x3fff);
  }
  private color(o: number): Rgb {
    const c = this.u16(o);
    return [Math.round(((c & 31) * 255) / 31), Math.round((((c >> 5) & 31) * 255) / 31), Math.round((((c >> 10) & 31) * 255) / 31)];
  }
  private palette(o: number): Rgb[] {
    return [0, 1, 2, 3].map(i => this.color(o + i * 2));
  }

  private tileset(id: number): CrystalTileset {
    let t = this.tilesets.get(id);
    if (!t) {
      const header = CRYSTAL_SYM.Tilesets + id * 15;
      const gfx = this.far(header);
      // The decompressor stops at the data's own end marker.
      t = { graphics: this.decompress(this.crystal.subarray(gfx, gfx + 0x4000)), palMap: 0x4c000 + (this.u16(header + 13) & 0x3fff) };
      this.tilesets.set(id, t);
    }
    return t;
  }

  /** A Crystal tile's pixels and palette slot. */
  private crystalTile(tilesetId: number, id: number): Painted {
    const t = this.tileset(tilesetId);
    const index = id >= 0x80 ? id - 0x80 + 0x60 : id;
    const pixels: number[] = [];
    for (let y = 0; y < 8; y++) {
      const lo = t.graphics[index * 16 + y * 2] ?? 0, hi = t.graphics[index * 16 + y * 2 + 1] ?? 0;
      for (let x = 7; x >= 0; x--) pixels.push(((lo >> x) & 1) | (((hi >> x) & 1) << 1));
    }
    const slot = (this.crystal[t.palMap + (id >> 1)] >> ((id & 1) * 4)) & 7;
    const name = Object.keys(CRYSTAL_TILESET).find(k => CRYSTAL_TILESET[k] === tilesetId) ?? "";
    let anim: Painted["anim"];
    if (id === 0x14 && ["KANTO", "JOHTO", "PORT", "FOREST", "PARK"].includes(name)) anim = "water";
    else if (id === 0x14 && ["CAVE", "DARK_CAVE"].includes(name)) anim = "cave";
    else if (id === 0x03 && ["KANTO", "JOHTO", "FOREST", "PARK"].includes(name)) anim = "flower";
    return { pixels, slot, anim };
  }

  private paint(look: CrystalLook, yellowTileset: number, yellowTile: number, source: CrystalTile | undefined): Painted {
    const base = CRYSTAL_TILESET[look.tileset];
    if (source === undefined) source = look.identity ? yellowTile : { keep: 0 };
    if (typeof source === "number") return this.crystalTile(base, source);
    if (Array.isArray(source)) return this.crystalTile(CRYSTAL_TILESET[source[0]], source[1]);
    const ts = this.rom.tileset(yellowTileset);
    return { pixels: [...this.rom.tile2bpp(ts.gfx + yellowTile * 16)], slot: source.keep };
  }

  /** Crystal's eight background palettes for a map, by daylight. */
  colors(map: MapHeader): Rgb[][] {
    const look = this.look(map);
    const kind = look?.colors ?? "indoor";
    const bg = (i: number) => this.palette(CRYSTAL_SYM.TilesetBGPalette + i * 8);
    if (kind === "house") return Array.from({ length: 8 }, (_, i) => this.palette(CRYSTAL_SYM.HousePalette + i * 8));
    if (kind === "mansion") {
      const set = Array.from({ length: 8 }, (_, i) => this.palette(CRYSTAL_SYM.MansionPalette1 + i * 8));
      set[4] = this.palette(CRYSTAL_SYM.MansionPalette2);
      set[3] = this.palette(CRYSTAL_SYM.MansionPalette1 + 6 * 8);
      set[6] = this.palette(CRYSTAL_SYM.MansionPalette1 + 8 * 8);
      return set;
    }
    // Daytime rows of Crystal's environment tables; caves use the night row, as Crystal's cave maps do.
    const table = kind === "outdoor" ? "OutdoorColors" : kind === "dungeon" || kind === "cave" ? "DungeonColors" : "IndoorColors";
    const row = CRYSTAL_SYM[`EnvironmentColorsPointers.${table}`] + (kind === "cave" ? 16 : 8);
    const set = Array.from({ length: 8 }, (_, i) => bg(this.crystal[row + i]));
    if (kind === "outdoor") {
      set[3] = bg(OUTDOOR_WATER);
      const group = this.group(map);
      const roof = CRYSTAL_SYM.RoofPals + group * 8;
      set[6] = [set[6][0], this.color(roof), this.color(roof + 2), set[6][3]];
    }
    return set;
  }

  /** The Crystal map group of a Yellow map with the same name, which picks its roof colors. */
  private group(map: MapHeader) {
    const name = Object.keys(MAP).find(k => MAP[k] === map.id) ?? "";
    return CRYSTAL_MAP_GROUP[name] ?? CRYSTAL_MAP_GROUP.ROUTE_23 ?? 0;
  }

  /** The background color behind and around a map. */
  backdrop(map: MapHeader): Rgb {
    return this.colors(map)[0][0];
  }

  private tilesOf(map: MapHeader, block: number): Painted[] {
    const look = this.look(map)!;
    const tiles = this.rom.block(this.rom.tileset(map.tileset), block);
    const whole = look.blocks?.[block];
    return Array.from({ length: 16 }, (_, i) => this.paint(look, map.tileset, tiles[i], whole ? whole[i] : look.tiles?.[tiles[i]]));
  }

  private draw(ctx: CanvasRenderingContext2D, tile: Painted, colors: Rgb[][], x: number, y: number, frame?: number[]) {
    const image = ctx.createImageData(8, 8), pal = colors[tile.slot];
    const px = frame ?? tile.pixels;
    for (let i = 0; i < 64; i++) image.data.set([...pal[px[i]], 255], i * 4);
    ctx.putImageData(image, x, y);
  }

  block(map: MapHeader, block: number): HTMLCanvasElement {
    const colors = this.colors(map);
    const key = `${map.tileset}:${block}:${colors[6].flat().join(",")}`;
    let c = this.blocks.get(key);
    if (!c) {
      c = canvas(32, 32);
      const ctx = c.getContext("2d")!;
      this.tilesOf(map, block).forEach((t, i) => this.draw(ctx, t, colors, (i & 3) * 8, (i >> 2) * 8));
      this.blocks.set(key, c);
    }
    return c;
  }

  /** A whole map drawn from its blocks, at 32×32 pixels per block. */
  map(map: MapHeader, version = 0): HTMLCanvasElement {
    const key = `${map.id}:${version}`;
    const cached = this.maps.get(key);
    if (cached) return cached;
    const c = canvas(map.width * 32, map.height * 32), ctx = c.getContext("2d")!;
    for (let by = 0; by < map.height; by++)
      for (let bx = 0; bx < map.width; bx++) ctx.drawImage(this.block(map, map.blocks[by * map.width + bx]), bx * 32, by * 32);
    if (this.maps.size > 24) this.maps.delete(this.maps.keys().next().value!);
    this.maps.set(key, c);
    return c;
  }

  /** Squares of a map whose Crystal tiles animate. */
  animatedTiles(map: MapHeader, version = 0) {
    const key = `${map.id}:${version}`;
    let list = this.animated.get(key);
    if (!list) {
      list = [];
      const seen = new Map<number, Painted[]>();
      for (let by = 0; by < map.height; by++)
        for (let bx = 0; bx < map.width; bx++) {
          const block = map.blocks[by * map.width + bx];
          let tiles = seen.get(block);
          if (!tiles) seen.set(block, tiles = this.tilesOf(map, block));
          tiles.forEach((tile, i) => {
            if (tile.anim) list!.push({ x: bx * 32 + (i & 3) * 8, y: by * 32 + (i >> 2) * 8, tile });
          });
        }
      if (this.animated.size > 24) this.animated.delete(this.animated.keys().next().value!);
      this.animated.set(key, list);
    }
    return list;
  }

  /** One frame of an animated tile: Crystal's water and flower frames, or cave water scrolling. */
  frame(map: MapHeader, tile: Painted, frame: number): HTMLCanvasElement {
    const colors = this.colors(map);
    const step = tile.anim === "flower" ? frame % 2 : frame % 4;
    const key = `${tile.anim}:${tile.slot}:${step}:${tile.pixels.join("")}:${colors[tile.slot].flat().join(",")}`;
    let c = this.frames.get(key);
    if (!c) {
      c = canvas(8, 8);
      let px: number[];
      if (tile.anim === "water") px = this.framePixels(CRYSTAL_SYM["AnimateWaterTile.WaterTileFrames"] + step * 16);
      else if (tile.anim === "flower") px = this.framePixels(CRYSTAL_SYM["AnimateFlowerTile.FlowerTileFrames"] + (step * 2 + 1) * 16);
      else px = tile.pixels.map((_, i) => tile.pixels[(i & ~7) | (((i & 7) + [0, 1, 0, -1][step] + 8) & 7)]);
      this.draw(c.getContext("2d")!, tile, colors, 0, 0, px);
      this.frames.set(key, c);
    }
    return c;
  }
  private framePixels(o: number) {
    const out: number[] = [];
    for (let y = 0; y < 8; y++) {
      const lo = this.crystal[o + y * 2], hi = this.crystal[o + y * 2 + 1];
      for (let x = 7; x >= 0; x--) out.push(((lo >> x) & 1) | (((hi >> x) & 1) << 1));
    }
    return out;
  }
}
