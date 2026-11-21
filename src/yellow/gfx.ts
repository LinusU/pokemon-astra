/** Colors and canvases for Yellow maps and sprites, decoded from the cartridge. */
import { CONST, MAP, PAL, SPRITE, SYM, TILESET } from "./generated/symbols";
import type { MapHeader, YellowRom } from "./rom";
import type { Facing } from "./world";

export type Rgb = [number, number, number];
const rgb555 = (word: number): Rgb => {
  const c = (v: number) => {
    // A light Game Boy Color screen response: lift the shadows and soften pure primaries.
    const linear = v / 31;
    return Math.round(255 * Math.min(1, 0.06 + 0.94 * Math.pow(linear, 0.9)));
  };
  return [c(word & 31), c((word >> 5) & 31), c((word >> 10) & 31)];
};

/** The four-color Game Boy Color palette the cartridge uses for a map. */
export function mapPalette(rom: YellowRom, map: MapHeader, lastOutdoor: number): Rgb[] {
  let pal: number;
  if (map.tileset === TILESET.CEMETERY) pal = PAL.PAL_GRAYMON;
  else if (map.tileset === TILESET.CAVERN) pal = PAL.PAL_CAVE;
  else {
    let id = map.id;
    if (id >= CONST.FIRST_INDOOR_MAP) {
      if (id >= MAP.CERULEAN_CAVE_2F && id <= MAP.CERULEAN_CAVE_1F) id = -1;
      else if (id === MAP.LORELEIS_ROOM) id = -2;
      else if (id === MAP.BRUNOS_ROOM) id = -1;
      else id = lastOutdoor;
    }
    pal = id === -1 ? PAL.PAL_CAVE : id === -2 ? PAL.PAL_SLOTS4 : id < CONST.NUM_CITY_MAPS ? id + 1 : PAL.PAL_ROUTE;
  }
  const at = SYM.CGBBasePalettes + pal * 8;
  return [0, 1, 2, 3].map(i => rgb555(rom.u16(at + i * 2)));
}

/** Sprite colors. Yellow tints the overworld in one palette; Astra gives each character its own. */
const SPRITE_TINTS: Record<string, Rgb> = {
  red: [228, 84, 64], blue: [88, 128, 224], green: [80, 168, 88], brown: [176, 120, 72],
  purple: [160, 96, 192], yellow: [240, 200, 48], gray: [128, 128, 140], pink: [232, 120, 160], teal: [64, 160, 168],
};
const tintOf = (sprite: number): Rgb => {
  const name = Object.keys(SPRITE).find(k => SPRITE[k] === sprite) ?? "";
  const families: [RegExp, keyof typeof SPRITE_TINTS][] = [
    [/PIKACHU|SANDSHREW|JIGGLYPUFF/, "yellow"], [/_RED|SPRITE_RED$|KOGA|BIKER|COOK|CAPTAIN|FAIRY|CLEFAIRY|CHANSEY|NURSE|JESSIE/, "red"],
    [/BLUE|SAILOR|SWIMMER|OFFICER|GUARD|SCIENTIST|LORELEI|SEEL|LINK_RECEPTIONIST/, "blue"],
    [/BULBASAUR|ODDISH|BUG|SAFARI|GRAMPS|FISHER|LANCE|GYM_GUIDE|CLERK|WARDEN/, "green"],
    [/OAK|HIKER|GENTLEMAN|GAMBLER|MIDDLE_AGED|BALDING|FOSSIL|AMBER|SUPER_NERD|FISHING_GURU|BRUNO/, "brown"],
    [/CHANNELER|AGATHA|GRANNY|JAMES|SILPH_PRESIDENT|ROCKER|POKEDEX/, "purple"],
    [/ROCKET|GIOVANNI|MONSTER|BOULDER|SNORLAX|CLIPBOARD|PAPER|WAITER/, "gray"],
    [/GIRL|BEAUTY|COOLTRAINER_F|DAISY|MOM|BRUNETTE|WOMAN|SILPH_WORKER_F/, "pink"],
    [/YOUNGSTER|COOLTRAINER_M|LITTLE_BOY|GAMEBOY|SILPH_WORKER_M|BIRD/, "teal"],
  ];
  for (const [re, family] of families) if (re.test(name)) return SPRITE_TINTS[family];
  return SPRITE_TINTS.blue;
};

const POKEMON_SPRITES = new Set(["SPRITE_PIKACHU", "SPRITE_SEEL", "SPRITE_SANDSHREW", "SPRITE_ODDISH", "SPRITE_BULBASAUR",
  "SPRITE_JIGGLYPUFF", "SPRITE_CLEFAIRY", "SPRITE_CHANSEY", "SPRITE_MONSTER", "SPRITE_BIRD", "SPRITE_FAIRY", "SPRITE_SNORLAX"].map(n => SPRITE[n]));
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const FRAME: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 2 };

export class YellowGraphics {
  private maps = new Map<string, HTMLCanvasElement>();
  private sprites = new Map<string, HTMLCanvasElement>();
  private tiles = new Map<string, HTMLCanvasElement>();
  constructor(readonly rom: YellowRom) {}

  private paintTile(ctx: CanvasRenderingContext2D, offset: number, x: number, y: number, palette: Rgb[], shift = 0) {
    const px = this.rom.tile2bpp(offset), image = ctx.createImageData(8, 8);
    for (let i = 0; i < 64; i++) {
      const row = i >> 3, col = ((i & 7) - shift + 8) & 7;
      const [r, g, b] = palette[px[row * 8 + col]];
      image.data.set([r, g, b, 255], i * 4);
    }
    ctx.putImageData(image, x, y);
  }

  /** A whole map drawn from its blocks, at 32×32 pixels per block. */
  map(map: MapHeader, palette: Rgb[], version = 0): HTMLCanvasElement {
    const key = `${map.id}:${version}:${palette.flat().join(",")}`;
    const cached = this.maps.get(key);
    if (cached) return cached;
    const tileset = this.rom.tileset(map.tileset);
    const c = canvas(map.width * 32, map.height * 32), ctx = c.getContext("2d")!;
    const blocks = new Map<number, HTMLCanvasElement>();
    for (let by = 0; by < map.height; by++)
      for (let bx = 0; bx < map.width; bx++)
        ctx.drawImage(this.block(map, map.blocks[by * map.width + bx], palette, blocks), bx * 32, by * 32);
    if (this.maps.size > 24) this.maps.delete(this.maps.keys().next().value!);
    this.maps.set(key, c);
    void tileset;
    return c;
  }

  block(map: MapHeader, block: number, palette: Rgb[], cache = new Map<number, HTMLCanvasElement>()) {
    const hit = cache.get(block);
    if (hit) return hit;
    const tileset = this.rom.tileset(map.tileset);
    const c = canvas(32, 32), ctx = c.getContext("2d")!;
    const tiles = this.rom.block(tileset, block);
    for (let i = 0; i < 16; i++) this.paintTile(ctx, tileset.gfx + tiles[i] * 16, (i & 3) * 8, (i >> 2) * 8, palette);
    cache.set(block, c);
    return c;
  }

  /** Animated water ($14) and flower ($03) tiles, for the tilesets that animate them. */
  animatedTile(map: MapHeader, tile: number, palette: Rgb[], frame: number) {
    const tileset = this.rom.tileset(map.tileset);
    const flower = tile === 0x03;
    const variant = flower ? frame % 3 : [0, 1, 2, 3, 2, 1, 0, -1][frame % 8];
    const key = `${map.tileset}:${tile}:${variant}:${palette.flat().join(",")}`;
    let c = this.tiles.get(key);
    if (!c) {
      c = canvas(8, 8);
      const ctx = c.getContext("2d")!;
      if (flower) this.paintTile(ctx, SYM[`FlowerTile${variant + 1}`] ?? tileset.gfx + tile * 16, 0, 0, palette);
      else this.paintTile(ctx, tileset.gfx + tile * 16, 0, 0, palette, variant);
      this.tiles.set(key, c);
    }
    return c;
  }

  /** One 16×16 overworld frame of a sprite. Pikachu uses its own sheet. */
  sprite(sprite: number, facing: Facing, walking: boolean, palette: Rgb[]): HTMLCanvasElement | undefined {
    const sheet = sprite === SPRITE.SPRITE_PIKACHU
      ? { offset: SYM.PikachuSprite, frames: 6 }
      : this.rom.spriteSheet(sprite);
    const frameIndex = sheet.frames === 1 ? 0 : FRAME[facing] + (walking ? 3 : 0);
    const flip = facing === "right" && sheet.frames > 1;
    const key = `${sprite}:${frameIndex}:${flip}:${palette.flat().join(",")}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const c = canvas(16, 16), ctx = c.getContext("2d")!;
    const tint = tintOf(sprite);
    // Pokémon sprites are mostly their lightest shade, so their body takes a pale tint.
    const creature = POKEMON_SPRITES.has(sprite);
    const light = creature ? tint.map(v => Math.round(v * 0.55 + 255 * 0.45)) as Rgb : palette[0];
    const colors: (Rgb | undefined)[] = [undefined, light, tint.map((v, i) => Math.round((v * 2 + palette[1][i]) / 3)) as Rgb, palette[3]];
    const image = ctx.createImageData(16, 16);
    const base = sheet.offset + frameIndex * 64;
    // Each frame is four tiles: top-left, top-right, bottom-left, bottom-right.
    for (let t = 0; t < 4; t++) {
      const px = this.rom.tile2bpp(base + t * 16);
      for (let i = 0; i < 64; i++) {
        const color = colors[px[i]];
        if (!color) continue;
        let x = (t & 1) * 8 + (i & 7);
        const y = (t >> 1) * 8 + (i >> 3);
        if (flip) x = 15 - x;
        image.data.set([...color, 255], (y * 16 + x) * 4);
      }
    }
    ctx.putImageData(image, 0, 0);
    this.sprites.set(key, c);
    return c;
  }
}
