/**
 * Pokémon Crystal's map and overworld graphics, decoded from the player's
 * cartridge: tilesets, Crystal's day and night palettes, roof colors,
 * animated water and flowers, overworld sprites and Pokémon icons.
 */
import { C, CONST, SYM } from "./symbols";
import type { CrystalMap, CrystalRom } from "./rom";
import type { Facing, LiveMap } from "./world";

export type Rgb = [number, number, number];

/** MORN_F, DAY_F, NITE_F or DARKNESS_F. */
export type TimeOfDay = 0 | 1 | 2 | 3;

interface DecodedTileset { graphics: Uint8Array; palMap: number }

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class CrystalGraphics {
  private tilesets = new Map<number, DecodedTileset>();
  private blocks = new Map<string, HTMLCanvasElement>();
  private maps = new Map<string, HTMLCanvasElement>();
  private animated = new Map<string, { x: number; y: number; tile: number; slot: number; kind: "water" | "flower" }[]>();
  private frames = new Map<string, HTMLCanvasElement>();
  private sprites = new Map<string, HTMLCanvasElement | undefined>();
  constructor(readonly rom: CrystalRom, private decompress: (data: Uint8Array) => Uint8Array) {}

  private u16(o: number) { return this.rom.u16(o); }
  color(o: number): Rgb {
    const c = this.u16(o);
    return [Math.round(((c & 31) * 255) / 31), Math.round((((c >> 5) & 31) * 255) / 31), Math.round((((c >> 10) & 31) * 255) / 31)];
  }
  palette(o: number): Rgb[] {
    return [0, 1, 2, 3].map(i => this.color(o + i * 2));
  }

  private tileset(id: number): DecodedTileset {
    let t = this.tilesets.get(id);
    if (!t) {
      const ts = this.rom.tileset(id);
      t = { graphics: this.decompress(this.rom.bytes.subarray(ts.gfx, ts.gfx + 0x4000)), palMap: ts.palMap };
      this.tilesets.set(id, t);
    }
    return t;
  }

  /** The palette index the map uses at `time`: its fixed palette, or the time of day. */
  timeFor(map: CrystalMap, time: TimeOfDay, flash: boolean): TimeOfDay {
    const p = map.palette;
    if (p === C("PALETTE_DAY")) return 1;
    if (p === C("PALETTE_NITE")) return 2;
    if (p === C("PALETTE_MORN")) return 0;
    if (p === C("PALETTE_DARK")) return flash ? 2 : 3;
    return time;
  }

  /** The eight background palettes of a map. */
  bgPalettes(map: CrystalMap, time: TimeOfDay): Rgb[][] {
    const special = this.specialPalettes(map);
    if (special) return special;
    const env = map.environment & 7;
    const table = this.rom.near(SYM.EnvironmentColorsPointers + env * 2);
    const row = table + time * 8;
    const set = Array.from({ length: 8 }, (_, i) => this.palette(SYM.TilesetBGPalette + this.rom.u8(row + i) * 8));
    if (env === C("TOWN") || env === C("ROUTE")) {
      const roof = SYM.RoofPals + map.group * 8 + (time >= 2 ? 4 : 0);
      set[6] = [set[6][0], this.color(roof), this.color(roof + 2), set[6][3]];
    }
    return set;
  }
  private specialPalettes(map: CrystalMap): Rgb[][] | undefined {
    const eight = (label: string) => SYM[label] === undefined ? undefined : Array.from({ length: 8 }, (_, i) => this.palette(SYM[label] + i * 8));
    const t = map.tileset;
    const is = (name: string) => CONST[name] !== undefined && CONST[name] === t;
    if (is("TILESET_POKECOM_CENTER")) return eight("PokeComPalette");
    if (is("TILESET_BATTLE_TOWER_INSIDE")) return eight("BattleTowerInsidePalette");
    if (is("TILESET_ICE_PATH") && (map.environment & 7) !== C("INDOOR")) return eight("IcePathPalette");
    if (is("TILESET_HOUSE")) return eight("HousePalette");
    if (is("TILESET_RADIO_TOWER")) return eight("RadioTowerPalette");
    if (is("TILESET_MANSION") && SYM.MansionPalette1 !== undefined) {
      const set = eight("MansionPalette1")!;
      if (SYM.MansionPalette2 !== undefined) set[C("PAL_BG_YELLOW")] = this.palette(SYM.MansionPalette2);
      set[C("PAL_BG_WATER")] = this.palette(SYM.MansionPalette1 + 6 * 8);
      set[C("PAL_BG_ROOF")] = this.palette(SYM.MansionPalette1 + 8 * 8);
      return set;
    }
    return undefined;
  }
  /** Overworld sprite palettes at `time`. */
  objPalettes(time: TimeOfDay): Rgb[][] {
    return Array.from({ length: 8 }, (_, i) => this.palette(SYM.MapObjectPals + time * 64 + i * 8));
  }

  /** A tile's 64 pixels (0–3) and its palette slot. */
  private tile(tilesetId: number, id: number) {
    const t = this.tileset(tilesetId);
    const index = id >= 0x80 ? id - 0x80 + 0x60 : id;
    const pixels = new Uint8Array(64);
    for (let y = 0; y < 8; y++) {
      const lo = t.graphics[index * 16 + y * 2] ?? 0, hi = t.graphics[index * 16 + y * 2 + 1] ?? 0;
      for (let x = 0; x < 8; x++) pixels[y * 8 + x] = ((lo >> (7 - x)) & 1) | (((hi >> (7 - x)) & 1) << 1);
    }
    const slot = (this.rom.u8(t.palMap + (id >> 1)) >> ((id & 1) * 4)) & 7;
    return { pixels, slot };
  }
  private draw(ctx: CanvasRenderingContext2D, pixels: Uint8Array, pal: Rgb[], x: number, y: number) {
    const image = ctx.createImageData(8, 8);
    for (let i = 0; i < 64; i++) {
      const [r, g, b] = pal[pixels[i]];
      image.data[i * 4] = r;
      image.data[i * 4 + 1] = g;
      image.data[i * 4 + 2] = b;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, x, y);
  }

  block(tilesetId: number, block: number, pals: Rgb[][], key: string): HTMLCanvasElement {
    const k = `${tilesetId}:${block}:${key}`;
    let c = this.blocks.get(k);
    if (!c) {
      c = canvas(32, 32);
      const ctx = c.getContext("2d")!;
      const tiles = this.rom.blockTiles(this.rom.tileset(tilesetId), block);
      for (let i = 0; i < 16; i++) {
        const t = this.tile(tilesetId, tiles[i]);
        this.draw(ctx, t.pixels, pals[t.slot], (i & 3) * 8, (i >> 2) * 8);
      }
      if (this.blocks.size > 4000) this.blocks.clear();
      this.blocks.set(k, c);
    }
    return c;
  }

  /** A whole map drawn from its blocks. */
  map(map: LiveMap | CrystalMap, pals: Rgb[][], key: string, version = 0): HTMLCanvasElement {
    const k = `${map.group}:${map.number}:${version}:${key}`;
    const hit = this.maps.get(k);
    if (hit) return hit;
    const blocks = "live" in map ? map.live : map.blocks;
    const c = canvas(map.width * 32, map.height * 32), ctx = c.getContext("2d")!;
    for (let by = 0; by < map.height; by++)
      for (let bx = 0; bx < map.width; bx++) ctx.drawImage(this.block(map.tileset, blocks[by * map.width + bx], pals, key), bx * 32, by * 32);
    if (this.maps.size > 16) this.maps.delete(this.maps.keys().next().value!);
    this.maps.set(k, c);
    return c;
  }

  /** Squares whose tiles animate: water ($14) and flowers ($03) on outdoor tilesets. */
  animatedTiles(map: LiveMap, version: number) {
    const k = `${map.group}:${map.number}:${version}`;
    let list = this.animated.get(k);
    if (list) return list;
    list = [];
    const outdoor = ["TILESET_JOHTO", "TILESET_JOHTO_MODERN", "TILESET_KANTO", "TILESET_PORT", "TILESET_FOREST", "TILESET_PARK", "TILESET_BATTLE_TOWER_OUTSIDE"]
      .some(n => CONST[n] === map.tileset);
    if (outdoor) {
      const ts = this.rom.tileset(map.tileset);
      for (let by = 0; by < map.height; by++)
        for (let bx = 0; bx < map.width; bx++) {
          const tiles = this.rom.blockTiles(ts, map.live[by * map.width + bx]);
          for (let i = 0; i < 16; i++) {
            const id = tiles[i];
            if (id !== 0x14 && id !== 0x03) continue;
            list.push({ x: bx * 32 + (i & 3) * 8, y: by * 32 + (i >> 2) * 8, tile: id, slot: this.tile(map.tileset, id).slot, kind: id === 0x14 ? "water" : "flower" });
          }
        }
    }
    if (this.animated.size > 16) this.animated.delete(this.animated.keys().next().value!);
    this.animated.set(k, list);
    return list;
  }
  frame(kind: "water" | "flower", step: number, pal: Rgb[]): HTMLCanvasElement {
    const k = `${kind}:${step}:${pal.flat().join(",")}`;
    let c = this.frames.get(k);
    if (!c) {
      c = canvas(8, 8);
      const at = kind === "water"
        ? SYM["AnimateWaterTile.WaterTileFrames"] + (step % 4) * 16
        : SYM["AnimateFlowerTile.FlowerTileFrames"] + ((step % 2) * 2 + 1) * 16;
      const pixels = new Uint8Array(64);
      for (let y = 0; y < 8; y++) {
        const lo = this.rom.u8(at + y * 2), hi = this.rom.u8(at + y * 2 + 1);
        for (let x = 0; x < 8; x++) pixels[y * 8 + x] = ((lo >> (7 - x)) & 1) | (((hi >> (7 - x)) & 1) << 1);
      }
      this.draw(c.getContext("2d")!, pixels, pal, 0, 0);
      this.frames.set(k, c);
    }
    return c;
  }

  // ------------------------------------------------------------ overworld sprites
  /**
   * One 16×16 frame of an overworld sprite. Walking sprites have three
   * facings with a walking frame each; right is the left frame mirrored, and
   * up/down walking alternates feet by mirroring.
   */
  sprite(sprite: number, facing: Facing, walking: boolean, leg: number, pal: Rgb[], palKey: string): HTMLCanvasElement | undefined {
    const k = `${sprite}:${facing}:${walking}:${leg}:${palKey}`;
    if (this.sprites.has(k)) return this.sprites.get(k);
    let c: HTMLCanvasElement | undefined;
    if (sprite >= C("SPRITE_POKEMON") && sprite < (CONST.SPRITE_VARS ?? 0xf0)) c = this.monIcon(sprite, walking, pal);
    else if (sprite > 0) {
      const entry = SYM.OverworldSprites + (sprite - 1) * 6;
      const base = this.rom.at(this.rom.u8(entry + 3), this.rom.u16(entry));
      const type = this.rom.u8(entry + 4);
      let offset = 0, flip = false;
      if (type !== C("STILL_SPRITE")) {
        offset = { down: 0, up: 64, left: 128, right: 128 }[facing];
        flip = facing === "right";
        if (walking && type === C("WALKING_SPRITE")) {
          offset += 192;
          if (facing === "up" || facing === "down") flip = leg % 2 === 1;
        }
      }
      c = this.paint(base + offset, pal, flip);
    }
    this.sprites.set(k, c);
    return c;
  }
  /** The default palette of an overworld sprite (PAL_OW_*). */
  spritePalette(sprite: number) {
    if (sprite <= 0 || sprite >= C("SPRITE_POKEMON")) return C("PAL_OW_RED");
    return this.rom.u8(SYM.OverworldSprites + (sprite - 1) * 6 + 5);
  }
  /** Pokémon sprites (SPRITE_POKEMON and on) are their party menu icons, two frames. */
  private monIcon(sprite: number, walking: boolean, pal: Rgb[]) {
    const species = this.rom.u8(SYM.SpriteMons + sprite - C("SPRITE_POKEMON"));
    const icon = this.rom.u8(SYM.MonMenuIcons + species - 1);
    const at = this.rom.near(SYM.IconPointers + icon * 2);
    return this.paint(at + (walking ? 64 : 0), pal, false);
  }
  /** Four 2bpp tiles (top-left, top-right, bottom-left, bottom-right); color 0 is see-through. */
  private paint(offset: number, pal: Rgb[], flip: boolean) {
    const c = canvas(16, 16), ctx = c.getContext("2d")!, image = ctx.createImageData(16, 16);
    for (let t = 0; t < 4; t++)
      for (let y = 0; y < 8; y++) {
        const lo = this.rom.u8(offset + t * 16 + y * 2), hi = this.rom.u8(offset + t * 16 + y * 2 + 1);
        for (let x = 0; x < 8; x++) {
          const v = ((lo >> (7 - x)) & 1) | (((hi >> (7 - x)) & 1) << 1);
          if (!v) continue;
          let px = (t & 1) * 8 + x;
          if (flip) px = 15 - px;
          const i = (((t >> 1) * 8 + y) * 16 + px) * 4;
          const [r, g, b] = pal[v];
          image.data[i] = r;
          image.data[i + 1] = g;
          image.data[i + 2] = b;
          image.data[i + 3] = 255;
        }
      }
    ctx.putImageData(image, 0, 0);
    return c;
  }
}
