/**
 * Yellow's people drawn with Pokémon Crystal's overworld sprites and colors,
 * decoded from the player's Crystal cartridge. Crystal has no sprite for a
 * few Yellow characters (and none that walk for Pikachu and the other
 * Pokémon); those keep Yellow's sprite in Crystal-style colors.
 */
import { CRYSTAL_OW_PALETTE, CRYSTAL_SPRITE, CRYSTAL_SYM } from "./generated/crystal";
import { MAP_TEXT, SPRITE, SYM, TRAINER } from "./symbols";
import type { MapObject, YellowRom } from "./rom";
import type { Facing } from "./world";
import type { Rgb } from "./gfx";

/** A Gen 2 color in 0–31 steps. */
type Rgb5 = [number, number, number];
type Own = { palette: string | Rgb5[] };

/** Yellow sprite → Crystal sprite, or Yellow's own sprite with a Crystal palette (or custom colors). */
const SPRITES: Record<string, string | Own> = {
  SPRITE_RED: "RED", SPRITE_BLUE: "BLUE", SPRITE_OAK: "OAK", SPRITE_MOM: "REDS_MOM", SPRITE_DAISY: "DAISY",
  SPRITE_YOUNGSTER: "YOUNGSTER", SPRITE_MONSTER: "MONSTER", SPRITE_COOLTRAINER_F: "COOLTRAINER_F",
  SPRITE_COOLTRAINER_M: "COOLTRAINER_M", SPRITE_LITTLE_GIRL: "TWIN", SPRITE_BIRD: "BIRD", SPRITE_FAIRY: "FAIRY",
  SPRITE_MIDDLE_AGED_MAN: "POKEFAN_M", SPRITE_GAMBLER: "POKEFAN_M", SPRITE_SUPER_NERD: "SUPER_NERD", SPRITE_GIRL: "LASS",
  SPRITE_HIKER: "POKEFAN_M", SPRITE_BEAUTY: "BEAUTY", SPRITE_GENTLEMAN: "GENTLEMAN", SPRITE_BIKER: "BIKER",
  SPRITE_SAILOR: "SAILOR", SPRITE_BIKE_SHOP_CLERK: "POKEFAN_M", SPRITE_MR_FUJI: "ELDER", SPRITE_ROCKET: "ROCKET",
  SPRITE_CHANNELER: "GRANNY", SPRITE_SILPH_WORKER_F: "RECEPTIONIST", SPRITE_SILPH_WORKER_M: "GENTLEMAN",
  SPRITE_MIDDLE_AGED_WOMAN: "POKEFAN_F", SPRITE_BRUNETTE_GIRL: "TEACHER", SPRITE_LANCE: "LANCE",
  SPRITE_SCIENTIST: "SCIENTIST", SPRITE_ROCKER: "ROCKER", SPRITE_SWIMMER: "SWIMMER_GUY", SPRITE_GYM_GUIDE: "GYM_GUIDE",
  SPRITE_GRAMPS: "GRAMPS", SPRITE_CLERK: "CLERK", SPRITE_FISHING_GURU: "FISHING_GURU", SPRITE_GRANNY: "GRANNY",
  SPRITE_NURSE: "NURSE", SPRITE_LINK_RECEPTIONIST: "LINK_RECEPTIONIST", SPRITE_WARDEN: "GRAMPS",
  SPRITE_CAPTAIN: "CAPTAIN", SPRITE_FISHER: "FISHER", SPRITE_KOGA: "KOGA", SPRITE_GUARD: "OFFICER",
  SPRITE_BALDING_GUY: "POKEFAN_M", SPRITE_LITTLE_BOY: "BUG_CATCHER", SPRITE_GAMEBOY_KID: "GAMEBOY_KID",
  SPRITE_AGATHA: "GRANNY", SPRITE_BRUNO: "BRUNO", SPRITE_SAFARI_ZONE_WORKER: "GYM_GUIDE", SPRITE_POKE_BALL: "POKE_BALL",
  SPRITE_PAPER: "PAPER", SPRITE_POKEDEX: "POKEDEX", SPRITE_BOULDER: "BOULDER", SPRITE_SEEL: "SURF",
  // Crystal has no sprite for these: Yellow's own, in Crystal's colors.
  SPRITE_COOK: { palette: "RED" }, SPRITE_WAITER: { palette: "BROWN" }, SPRITE_GIOVANNI: { palette: "BROWN" },
  SPRITE_SILPH_PRESIDENT: { palette: "BROWN" }, SPRITE_LORELEI: { palette: "BLUE" }, SPRITE_JESSIE: { palette: "PINK" },
  SPRITE_JAMES: { palette: "BLUE" }, SPRITE_OFFICER_JENNY: { palette: "BLUE" }, SPRITE_CLIPBOARD: { palette: "ROCK" },
  SPRITE_FOSSIL: { palette: "ROCK" }, SPRITE_OLD_AMBER: { palette: "ROCK" }, SPRITE_GAMBLER_ASLEEP: { palette: "BROWN" },
  SPRITE_PIKACHU: { palette: [[31, 27, 4], [25, 9, 2]] }, SPRITE_SANDSHREW: { palette: [[30, 25, 10], [19, 12, 4]] },
  SPRITE_ODDISH: { palette: [[12, 26, 8], [8, 10, 24]] }, SPRITE_BULBASAUR: { palette: [[16, 28, 18], [6, 16, 10]] },
  SPRITE_JIGGLYPUFF: { palette: [[31, 22, 26], [24, 8, 14]] }, SPRITE_CLEFAIRY: { palette: [[31, 22, 26], [24, 8, 14]] },
  SPRITE_CHANSEY: { palette: [[31, 22, 26], [24, 8, 14]] }, SPRITE_SNORLAX: { palette: [[24, 26, 24], [6, 14, 18]] },
};

/** Trainers Crystal draws with their own sprite: the gym leaders and Elite Four it shares with Yellow. */
const TRAINER_SPRITES: Record<string, string> = {
  BROCK: "BROCK", MISTY: "MISTY", LT_SURGE: "SURGE", ERIKA: "ERIKA", KOGA: "KOGA", SABRINA: "SABRINA",
  BLAINE: "BLAINE", BRUNO: "BRUNO", LANCE: "LANCE",
};

const FRAME_OFFSET: Record<Facing, number> = { down: 0, up: 64, left: 128, right: 128 };

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class CrystalSprites {
  private cache = new Map<string, HTMLCanvasElement>();
  constructor(readonly rom: YellowRom, readonly crystal: Uint8Array) {}

  /** The Crystal sprite (or Yellow sprite and colors) that draws a Yellow sprite, with per-character overrides. */
  choose(sprite: number, object?: MapObject, mapLabel?: string): string | Own | undefined {
    const klass = object?.trainer?.klass;
    if (klass !== undefined) {
      const name = Object.keys(TRAINER).find(k => TRAINER[k] === klass);
      if (name && TRAINER_SPRITES[name]) return TRAINER_SPRITES[name];
    }
    if (object && mapLabel && sprite === SPRITE.SPRITE_SUPER_NERD) {
      const text = Object.entries(MAP_TEXT[mapLabel] ?? {}).find(([, id]) => id === object.text)?.[0] ?? "";
      if (/_BILL(_|$)/.test(text)) return "BILL";
    }
    const name = Object.keys(SPRITE).find(k => SPRITE[k] === sprite);
    return name ? SPRITES[name] : undefined;
  }

  private u16(o: number) {
    return this.crystal[o] | (this.crystal[o + 1] << 8);
  }
  private colors(o: number): (Rgb | undefined)[] {
    return [undefined, ...[1, 2, 3].map(i => {
      const c = this.u16(o + i * 2);
      return [Math.round(((c & 31) * 255) / 31), Math.round((((c >> 5) & 31) * 255) / 31), Math.round((((c >> 10) & 31) * 255) / 31)] as Rgb;
    })];
  }
  /** Crystal's daytime overworld sprite palette. */
  private palette(index: number) {
    return this.colors(CRYSTAL_SYM.MapObjectPals + 64 + index * 8);
  }

  /**
   * One 16×16 frame. `leg` alternates which foot steps forward when walking
   * up or down, which Crystal draws by mirroring the walking frame.
   */
  sprite(choice: string | Own, yellowSprite: number, facing: Facing, walking: boolean, leg: number): HTMLCanvasElement | undefined {
    const key = `${typeof choice === "string" ? choice : yellowSprite}:${facing}:${walking}:${leg}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const c = typeof choice === "string" ? this.drawCrystal(choice, facing, walking, leg) : this.drawOwn(choice, yellowSprite, facing, walking);
    if (c) this.cache.set(key, c);
    return c;
  }

  private drawCrystal(name: string, facing: Facing, walking: boolean, leg: number) {
    const id = CRYSTAL_SPRITE[name];
    if (!id) return undefined;
    const entry = CRYSTAL_SYM.OverworldSprites + (id - 1) * 6;
    const base = this.crystal[entry + 3] * 0x4000 + (this.u16(entry) & 0x3fff);
    const type = this.crystal[entry + 4], colors = this.palette(this.crystal[entry + 5]);
    let offset = 0, flip = false;
    if (type !== 3) {
      offset = FRAME_OFFSET[facing];
      flip = facing === "right";
      if (walking && type === 1) {
        offset += 192;
        if (facing === "up" || facing === "down") flip = leg % 2 === 1;
      }
    }
    return this.paint(base + offset, colors, flip);
  }

  private drawOwn(own: Own, sprite: number, facing: Facing, walking: boolean) {
    const sheet = sprite === SPRITE.SPRITE_PIKACHU ? { offset: SYM.PikachuSprite, frames: 6 } : this.rom.spriteSheet(sprite);
    const frame = sheet.frames === 1 ? 0 : ({ down: 0, up: 1, left: 2, right: 2 } as const)[facing] + (walking ? 3 : 0);
    let colors: (Rgb | undefined)[];
    if (typeof own.palette === "string") colors = this.palette(CRYSTAL_OW_PALETTE[own.palette]);
    else {
      const to8 = ([r, g, b]: Rgb5): Rgb => [r, g, b].map(v => Math.round((v * 255) / 31)) as Rgb;
      colors = [undefined, to8(own.palette[0]), to8(own.palette[1]), [0, 0, 0]];
    }
    return this.paint(sheet.offset + frame * 64, colors, facing === "right" && sheet.frames > 1, this.rom.bytes);
  }

  /** Four 2bpp tiles (top-left, top-right, bottom-left, bottom-right); color 0 is see-through, as on the Game Boy. */
  private paint(offset: number, colors: (Rgb | undefined)[], flip: boolean, source: Uint8Array = this.crystal) {
    const c = canvas(16, 16), ctx = c.getContext("2d")!, image = ctx.createImageData(16, 16);
    for (let t = 0; t < 4; t++)
      for (let y = 0; y < 8; y++) {
        const lo = source[offset + t * 16 + y * 2], hi = source[offset + t * 16 + y * 2 + 1];
        for (let x = 0; x < 8; x++) {
          const color = colors[((lo >> (7 - x)) & 1) | (((hi >> (7 - x)) & 1) << 1)];
          if (!color) continue;
          let px = (t & 1) * 8 + x;
          if (flip) px = 15 - px;
          image.data.set([...color, 255], (((t >> 1) * 8 + y) * 16 + px) * 4);
        }
      }
    ctx.putImageData(image, 0, 0);
    return c;
  }
}
