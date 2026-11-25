import { pokemonAppearance, type PokemonPortrait } from "../engine/appearance";

const SHA1 = "f3ae088181bf583e55daf962a92bb46f4f1d07b7";
const SIZE = 16 * 1024 * 1024;
const GBA_ROM = 0x08000000;
const SIDE = 64;
const FRAME_BYTES = SIDE * SIDE / 2;

// Offsets for the English Emerald ROM identified above. See pokeemerald's
// pokemon_graphics tables and sSpeciesToBackAnimSet in pokemon_animation.c.
const FRONT_PICTURES = 0x30a18c;
const BACK_PICTURES = 0x3028b8;
const PALETTES = 0x303678;
const SHINY_PALETTES = 0x304438;
const FRONT_ANIMATIONS = 0x309aac;
const BACK_ANIMATION_SETS = 0x60a8c8;

export const EMERALD_ROM_KEY = "rom-emerald";

export class UnsupportedEmeraldCartridge extends Error {
  constructor() {
    super("Choose an unmodified English Pokémon Emerald ROM (.gba).");
  }
}

export type PortraitAppearance = ReturnType<typeof pokemonAppearance>;
export type EntranceFrame = { image: string; duration: number };
export type EntranceMotion = "hop" | "sway" | "shake" | "stretch";
export type PortraitEntrance = { frames: EntranceFrame[] } | { motion: EntranceMotion };

export class EmeraldPortraits {
  private constructor(private readonly rom: Uint8Array<ArrayBuffer>) {
    this.view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  }
  private readonly view: DataView;

  static async open(rom: Uint8Array<ArrayBuffer>) {
    if (rom.length !== SIZE) throw new UnsupportedEmeraldCartridge();
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", rom));
    if (Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("") !== SHA1)
      throw new UnsupportedEmeraldCartridge();
    return new EmeraldPortraits(rom);
  }

  private pointer(offset: number) {
    return this.view.getUint32(offset, true) - GBA_ROM;
  }

  private decompress(offset: number, maxSize: number) {
    const header = this.view.getUint32(offset, true);
    const size = header >>> 8;
    if ((header & 0xff) !== 0x10 || size === 0 || size > maxSize)
      throw new Error("Invalid Emerald graphic");
    const bytes = new Uint8Array(size);
    let read = offset + 4, write = 0;
    while (write < size) {
      const flags = this.rom[read++];
      for (let mask = 0x80; mask && write < size; mask >>= 1) {
        if (!(flags & mask)) {
          bytes[write++] = this.rom[read++];
          continue;
        }
        const control = this.view.getUint16(read);
        read += 2;
        const distance = (control & 0xfff) + 1;
        const end = Math.min(size, write + (control >>> 12) + 3);
        if (distance > write) throw new Error("Invalid Emerald graphic reference");
        while (write < end) {
          bytes[write] = bytes[write - distance];
          write++;
        }
      }
    }
    return bytes;
  }

  picture({ species, form, shiny }: PortraitAppearance, back: boolean) {
    const egg = species === 253 && !back;
    if (!egg && (species < 1 || species > 251)) return undefined;
    const id = egg ? 412 : species === 201 && form > 0 ? 412 + form : species;
    const tiles = this.decompress(this.pointer((back ? BACK_PICTURES : FRONT_PICTURES) + id * 8), 4 * FRAME_BYTES);
    const palette = new DataView(this.decompress(this.pointer((shiny ? SHINY_PALETTES : PALETTES) + id * 8), 32).buffer);
    return {
      frame: (frame = 0, hFlip = false, vFlip = false) => {
        const rgba = new Uint8ClampedArray(SIDE * SIDE * 4);
        for (let y = 0; y < SIDE; y++) {
          for (let x = 0; x < SIDE; x++) {
            const tile = (y >> 3) * 8 + (x >> 3);
            const packed = tiles[frame * FRAME_BYTES + tile * 32 + (y & 7) * 4 + ((x & 7) >> 1)];
            const index = (packed >> ((x & 1) * 4)) & 15;
            if (!index) continue;
            const c = palette.getUint16(index * 2, true);
            const out = ((vFlip ? SIDE - 1 - y : y) * SIDE + (hFlip ? SIDE - 1 - x : x)) * 4;
            rgba[out] = Math.round((c & 31) * 255 / 31);
            rgba[out + 1] = Math.round(((c >> 5) & 31) * 255 / 31);
            rgba[out + 2] = Math.round(((c >> 10) & 31) * 255 / 31);
            rgba[out + 3] = 255;
          }
        }
        return new ImageData(rgba, SIDE, SIDE);
      },
    };
  }

  frontFrames(species: number) {
    // Unown's graphics are individual forms. Emerald animates them by moving
    // the sprite instead of swapping its tiles.
    if (species < 1 || species > 251 || species === 201) return [];
    let command = this.pointer(this.pointer(FRONT_ANIMATIONS + species * 4) + 4);
    const frames = [];
    for (let i = 0; i < 64; i++, command += 4) {
      const frame = this.view.getUint16(command, true);
      if (frame === 0xffff) return frames;
      // The battle entrance sequences for the first 251 species are linear.
      if (frame > 1) break;
      const flags = this.rom[command + 2];
      frames.push({ frame, duration: Math.max(1, flags & 0x3f) * 1000 / 60, hFlip: !!(flags & 0x40), vFlip: !!(flags & 0x80) });
    }
    return [];
  }

  motion(mon: PokemonPortrait, back: boolean): EntranceMotion {
    if (!back) return "sway";
    // Use Emerald's species assignment to choose a short motion for
    // the back picture. Astra has Gen II DVs instead of Gen III natures.
    const set = this.rom[BACK_ANIMATION_SETS + mon.species];
    if ([1, 8, 9, 14, 22, 23, 24, 25].includes(set)) return "shake";
    if ([5, 6, 11, 12, 13, 20].includes(set)) return "stretch";
    if ([2, 3, 4, 7, 10, 19, 21].includes(set)) return "sway";
    return "hop";
  }
}
