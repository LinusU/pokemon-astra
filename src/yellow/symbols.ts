/**
 * The symbol table of the Yellow cartridge in play: pret/pokeyellow's for
 * Pokémon Yellow, Yellow Legacy's for Yellow patched with Yellow Legacy. The
 * tables hold only ROM offsets and identifier names (scripts/yellow-symbols.mjs);
 * the game itself is read from the player's cartridge. Importers see the table
 * in use through these live bindings, so code reads constants by name.
 */
import * as Yellow from "./generated/symbols";

export type Cartridge = "yellow" | "legacy";
type Table = Omit<typeof Yellow, "YELLOW_SHA1">;

export let SYM = Yellow.SYM;
export let RAM = Yellow.RAM;
export let MAP = Yellow.MAP;
export let MAP_LABELS = Yellow.MAP_LABELS;
export let TEXT_PREDEFS = Yellow.TEXT_PREDEFS;
export let EVENT = Yellow.EVENT;
export let HS = Yellow.HS;
export let ITEM = Yellow.ITEM;
export let MON = Yellow.MON;
export let DEX = Yellow.DEX;
export let MOVE = Yellow.MOVE;
export let SPRITE = Yellow.SPRITE;
export let TRAINER = Yellow.TRAINER;
export let TILESET = Yellow.TILESET;
export let PAL = Yellow.PAL;
export let CONST = Yellow.CONST;
export let MUSIC = Yellow.MUSIC;
export let SFX = Yellow.SFX;
export let MAP_TEXT = Yellow.MAP_TEXT;
export let MAP_SCRIPT = Yellow.MAP_SCRIPT;
export let MAP_OBJECT = Yellow.MAP_OBJECT;

let inUse: Cartridge = "yellow";

/** The cartridge whose table is in use. */
export function cartridgeInUse(): Cartridge {
  return inUse;
}

/** Switch to `cartridge`'s table (Yellow Legacy's is loaded on first use). */
export async function useCartridge(cartridge: Cartridge) {
  if (cartridge === inUse) return;
  const table: Table = cartridge === "legacy" ? await import("./generated/symbols-legacy") : Yellow;
  ({ SYM, RAM, MAP, MAP_LABELS, TEXT_PREDEFS, EVENT, HS, ITEM, MON, DEX, MOVE, SPRITE, TRAINER, TILESET, PAL, CONST, MUSIC, SFX,
    MAP_TEXT, MAP_SCRIPT, MAP_OBJECT } = table);
  inUse = cartridge;
}
