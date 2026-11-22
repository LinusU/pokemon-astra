/**
 * The symbol table of the Crystal cartridge in play: pret/pokecrystal's for
 * Pokémon Crystal, Crystal Legacy's for Crystal patched with Crystal Legacy.
 * The tables hold ROM offsets, RAM addresses, identifier names and constant
 * values (scripts/crystal-world-symbols.mjs); the game itself is read from the
 * player's cartridge. Importers see the table in use through live bindings.
 */
import * as Crystal from "./generated/symbols-crystal";

export type CrystalCartridge = "crystal" | "legacy";
type Table = Omit<typeof Crystal, "SOURCE" | "SHA1"> & { SOURCE: string; SHA1: string };

export let SYM = Crystal.SYM;
export let ASM = Crystal.ASM;
export let TEXT = Crystal.TEXT;
export let RAM = Crystal.RAM;
export let MAP = Crystal.MAP;
export let ITEM = Crystal.ITEM;
export let MON = Crystal.MON;
export let MOVE = Crystal.MOVE;
export let CONST = Crystal.CONST;
export let SPECIALS = Crystal.SPECIALS;
export let STD = Crystal.STD;
export let SCRIPT_COMMANDS = Crystal.SCRIPT_COMMANDS;
export let ENGINE_RAM = Crystal.ENGINE_RAM;
export let TEXT_COMMANDS = Crystal.TEXT_COMMANDS;
export let CHARMAP = Crystal.CHARMAP;
export let SHA1: string = Crystal.SHA1;

let inUse: CrystalCartridge = "crystal";
let reverse: Map<string, Map<number, string>> = new Map();

export function cartridgeInUse(): CrystalCartridge {
  return inUse;
}

/** Switch to `cartridge`'s table (Crystal Legacy's is loaded on first use). */
export async function useCrystalCartridge(cartridge: CrystalCartridge) {
  if (cartridge === inUse) return;
  const table: Table = cartridge === "legacy" ? await import("./generated/symbols-legacy") : Crystal;
  ({ SYM, ASM, TEXT, RAM, MAP, ITEM, MON, MOVE, CONST, SPECIALS, STD, SCRIPT_COMMANDS, ENGINE_RAM, TEXT_COMMANDS, CHARMAP, SHA1 } = table);
  inUse = cartridge;
  reverse = new Map();
}

/** A constant by name, failing loudly when the cartridge's source has no such constant. */
export function C(name: string): number {
  const v = CONST[name];
  if (v === undefined) throw Error(`Unknown constant ${name}`);
  return v;
}

/** The name of a constant with `prefix` and `value`, such as `EVENT_` 42. */
export function constName(prefix: string, value: number): string | undefined {
  let table = reverse.get(prefix);
  if (!table) {
    table = new Map();
    for (const [k, v] of Object.entries(CONST)) if (k.startsWith(prefix) && !table.has(v)) table.set(v, k);
    reverse.set(prefix, table);
  }
  return table.get(value);
}

/** Reverse lookups over the other tables. */
function reversed(key: string, entries: () => [string, number][]) {
  let table = reverse.get(key);
  if (!table) {
    table = new Map();
    for (const [k, v] of entries()) if (!table.has(v)) table.set(v, k);
    reverse.set(key, table);
  }
  return table;
}
export const ramName = (addr: number) => reversed("ram", () => Object.entries(RAM)).get(addr);
export const asmName = (offset: number) => reversed("asm", () => Object.entries(ASM)).get(offset);
export const itemConst = (id: number) => reversed("item", () => Object.entries(ITEM)).get(id);
export const monConst = (id: number) => reversed("mon", () => Object.entries(MON)).get(id);
export function mapName(group: number, number: number): string | undefined {
  return reversed("map", () => Object.entries(MAP).map(([k, [g, n]]) => [k, g * 256 + n])).get(group * 256 + number);
}
export function mapId(name: string): [number, number] {
  const m = MAP[name];
  if (!m) throw Error(`Unknown map ${name}`);
  return [m[0], m[1]];
}
