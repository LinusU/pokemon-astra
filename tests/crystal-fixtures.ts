/** Local cartridges for the Crystal adventure tests: Crystal, and Crystal Legacy from its official patch. */
import { existsSync, readFileSync } from "node:fs";
import { applyBps } from "../src/yellow/bps";
import { useCrystalCartridge, type CrystalCartridge } from "../src/crystal/symbols";
import { CrystalRom } from "../src/crystal/rom";

export const CRYSTAL_ROM = "pokecrystal11.gbc";
export const LEGACY_PATCH = "crystal-legacy.bps";
export const hasCrystal = existsSync(CRYSTAL_ROM);
export const hasLegacy = hasCrystal && existsSync(LEGACY_PATCH);

let crystal: Uint8Array | undefined, legacy: Uint8Array | undefined;
export function cartridgeBytes(cartridge: CrystalCartridge) {
  crystal ??= new Uint8Array(readFileSync(CRYSTAL_ROM));
  if (cartridge === "crystal") return crystal;
  legacy ??= applyBps(crystal, new Uint8Array(readFileSync(LEGACY_PATCH)));
  return legacy;
}
/** Switches the symbol table and returns a reader for the cartridge. */
export async function cartridge(cartridge: CrystalCartridge) {
  await useCrystalCartridge(cartridge);
  return new CrystalRom(cartridgeBytes(cartridge));
}
export const CARTRIDGES = [
  ...(hasCrystal ? [["crystal"] as const] : []),
  ...(hasLegacy ? [["legacy"] as const] : []),
];
