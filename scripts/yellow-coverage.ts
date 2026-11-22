// Lists Yellow map logic that still needs a hand-written port.
// Usage: npx vite-node scripts/yellow-coverage.ts [path/to/pokeyellow.gbc] [path/to/yellow-legacy.bps]
// A Yellow Legacy cartridge, or Yellow with the official V1.0.10 patch, is checked against Legacy's table.
import { readFileSync } from "node:fs";
import { applyBps } from "../src/yellow/bps";
import { identifyYellow, YellowRom } from "../src/yellow/rom";
import { useCartridge } from "../src/yellow/symbols";
import { coverageGaps } from "../src/yellow/coverage";
import "../src/yellow/scripts";

let bytes = new Uint8Array(readFileSync(process.argv[2] ?? "pokeyellow.gbc"));
if (process.argv[3]) bytes = applyBps(bytes, new Uint8Array(readFileSync(process.argv[3])));
const cartridge = await identifyYellow(bytes);
if (!cartridge) throw Error("Not English Pokémon Yellow or Yellow Legacy V1.0.10.");
await useCartridge(cartridge);
const rom = new YellowRom(bytes);
const gaps = coverageGaps(rom);
const byMap = new Map<string, string[]>();
for (const g of gaps) byMap.set(g.map, [...(byMap.get(g.map) ?? []), `${g.kind}: ${g.label}`]);
for (const [map, list] of byMap) console.log(`${map} (${list.length})\n  ${list.join("\n  ")}`);
console.log(`\n${gaps.length} gaps across ${byMap.size} maps (${gaps.filter(g => g.kind === "script").length} scripts, ${gaps.filter(g => g.kind === "text").length} texts, ${gaps.filter(g => g.kind === "hidden").length} hidden)`);
