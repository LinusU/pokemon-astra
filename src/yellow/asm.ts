import { SYM } from "./symbols";
import type { YellowRom } from "./rom";

export type AsmPlan =
  | { kind: "end" }
  | { kind: "print"; at: number[]; pikachu?: number }
  | { kind: "trainer"; at: number }
  | { kind: "far"; at: number }
  | { kind: "custom" };

/**
 * Recognizes the common shapes of text_asm entries so only bespoke logic
 * needs a hand-written handler. A tiny interpreter follows `ld hl`, `ld b`,
 * jumps and far calls, and accepts code that only prints text, talks to a
 * trainer, or far-calls a routine that does one of those.
 */
export function asmPlan(rom: YellowRom, bank: number, at: number): AsmPlan {
  const prints: number[] = [];
  let hl = 0, b = 0, e = 0, pc = at, cur = bank, pikachu: number | undefined;
  const addr = (a: number) => rom.far(a < 0x4000 ? 0 : cur, a);
  for (let steps = 0; steps < 24; steps++) {
    const op = rom.u8(pc), w = rom.u16(pc + 1);
    if (op === 0x21) { hl = w; pc += 3; continue; }
    if (op === 0x06) { b = rom.u8(pc + 1); pc += 2; continue; }
    if (op === 0x1e) { e = rom.u8(pc + 1); pc += 2; continue; }
    if (op === 0x18) { pc += 2 + ((rom.u8(pc + 1) << 24) >> 24); continue; }
    if (op === 0xc9) break;
    if (op === 0xc3) {
      if (w === SYM.TextScriptEnd) break;
      pc = addr(w);
      continue;
    }
    if (op === 0xcd) {
      if (w === SYM.TalkToTrainer) return prints.length ? { kind: "custom" } : { kind: "trainer", at: addr(hl) };
      if (w === SYM.PrintText) { prints.push(addr(hl)); pc += 3; continue; }
      if (w === SYM.Bankswitch) {
        const routine = rom.far(b, hl);
        if (routine === SYM.PlayPikachuSoundClip) { pikachu = e; pc += 3; continue; }
        const inner = asmPlan(rom, b, routine);
        if (inner.kind === "print") prints.push(...inner.at);
        else if (inner.kind !== "end") return prints.length ? { kind: "custom" } : { kind: "far", at: routine };
        pc += 3;
        continue;
      }
      return { kind: "custom" };
    }
    return { kind: "custom" };
  }
  return prints.length ? { kind: "print", at: prints, pikachu } : { kind: "end" };
}
