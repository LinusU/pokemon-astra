// Lists Yellow map logic that still needs a hand-written port.
// Usage: npx vite-node scripts/yellow-coverage.ts [path/to/pokeyellow.gbc]
import { readFileSync } from "node:fs";
import { YellowRom } from "../src/yellow/rom";
import { coverageGaps } from "../src/yellow/coverage";
import "../src/yellow/scripts";

const rom = new YellowRom(new Uint8Array(readFileSync(process.argv[2] ?? "pokeyellow.gbc")));
const gaps = coverageGaps(rom);
const byMap = new Map<string, string[]>();
for (const g of gaps) byMap.set(g.map, [...(byMap.get(g.map) ?? []), `${g.kind}: ${g.label}`]);
for (const [map, list] of byMap) console.log(`${map} (${list.length})\n  ${list.join("\n  ")}`);
console.log(`\n${gaps.length} gaps across ${byMap.size} maps (${gaps.filter(g => g.kind === "script").length} scripts, ${gaps.filter(g => g.kind === "text").length} texts, ${gaps.filter(g => g.kind === "hidden").length} hidden)`);
