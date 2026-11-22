/** Which parts of the cartridge's map logic still need a hand-written port. */
import { MAP, MAP_TEXT, SYM } from "./symbols";
import { asmPlan } from "./asm";
import type { YellowRom } from "./rom";
import { MAP_SCRIPTS, SHARED_TEXTS } from "./script";

export const BUILTIN_HIDDEN = new Set(["HiddenItems", "HiddenCoins", "OpenPokemonCenterPC", "OpenRedsPC", "BillsHousePC", "StartSlotMachine"]);
const GENERIC_SCRIPT_TABLE = () => new Set([SYM.CheckFightingMapTrainers, SYM.DisplayEnemyTrainerTextAndStartBattle, SYM.EndTrainerBattle]);

/** Map scripts that only enable text boxes or run the standard trainer loop. */
export function genericMapScript(rom: YellowRom, bank: number, at: number) {
  const b = (i: number) => rom.u8(at + i), w = (i: number) => rom.u16(at + i);
  if (b(0) === 0xc9) return true;
  if (b(0) === 0xc3 && w(1) === SYM.EnableAutoTextBoxDrawing) return true;
  if (b(0) === 0xcd && w(1) === SYM.EnableAutoTextBoxDrawing && b(3) === 0xc9) return true;
  // call EnableAutoTextBoxDrawing / ld hl, headers / ld de, pointers / ld a, [cur] / call ExecuteCurMapScriptInTable / ld [cur], a / ret
  if (b(0) === 0xcd && w(1) === SYM.EnableAutoTextBoxDrawing && b(3) === 0x21 && b(6) === 0x11 && b(9) === 0xfa &&
    b(12) === 0xcd && w(13) === SYM.ExecuteCurMapScriptInTable && b(15) === 0xea && b(18) === 0xc9) {
    const table = rom.far(bank, w(7)), generic = GENERIC_SCRIPT_TABLE();
    for (let i = 0; i < 3; i++) if (!generic.has(rom.u16(table + i * 2))) return false;
    return true;
  }
  return false;
}

export interface Gap { map: string; kind: "script" | "text" | "hidden"; label: string }

export function coverageGaps(rom: YellowRom): Gap[] {
  const gaps: Gap[] = [];
  // Unused map slots are never entered (Yellow Legacy points some of them at other banks' data).
  const unused = new Set(Object.entries(MAP).flatMap(([name, id]) => name.startsWith("UNUSED_MAP_") ? [id] : []));
  for (let id = 0; id < rom.mapCount; id++) {
    const map = !unused.has(id) && rom.map(id);
    if (!map) continue;
    const script = MAP_SCRIPTS[map.label];
    if (!genericMapScript(rom, map.bank, map.script) && !script?.onStep && !script?.onEnter && !script?.generic)
      gaps.push({ map: map.label, kind: "script", label: rom.label(map.script) ?? map.label + "_Script" });
    const ids = new Set<number>([...map.objects.map(o => o.text), ...map.signs.map(s => s.text)]);
    // Script-only texts follow the object and sign ids in the pointer table.
    for (const t of Object.values(MAP_TEXT[map.label] ?? {})) ids.add(t);
    for (const t of ids) {
      if (!t) continue;
      const at = rom.mapText(map, t);
      const label = rom.label(at) ?? `@${at.toString(16)}`;
      const asm = rom.text(at).find(op => op.op === "asm") as { at: number } | undefined;
      if (!asm) continue;
      if (script?.texts?.[label] || SHARED_TEXTS[label]) continue;
      const plan = asmPlan(rom, map.bank, asm.at);
      if (plan.kind === "end" || plan.kind === "print" || plan.kind === "trainer") continue;
      if (plan.kind === "far") {
        const routine = rom.label(plan.at);
        if (routine && (script?.texts?.[routine] || SHARED_TEXTS[routine])) continue;
        gaps.push({ map: map.label, kind: "text", label: `${label} -> ${routine ?? "?"}` });
        continue;
      }
      gaps.push({ map: map.label, kind: "text", label });
    }
    for (const h of rom.hiddenObjects(id)) {
      if (BUILTIN_HIDDEN.has(h.routine) || SHARED_TEXTS["hidden:" + h.routine]) continue;
      gaps.push({ map: map.label, kind: "hidden", label: h.routine });
    }
  }
  return gaps;
}
