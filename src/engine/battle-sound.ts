// Crystal 1.1's BattleAnimations pointer table (bank $32, address $506f).
// Only audio commands and script flow are interpreted. Astra draws its own effects.
const BANK_START = 0x32 * 0x4000;
const TABLE = BANK_START + 0x106f;
const MAX_ANIMATION = 277;

// Argument widths for the picture/object/palette commands in $d0 through $ff.
const ARGUMENTS = [
  4, 1, 2, 3, 4, 5, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0,
  2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 2,
  4, 1, 1, 1, 0, 0, 0, 0, 3, 1, 0, 3, 2, 3, 2, 0,
];

export const CRYSTAL_SFX_COUNT = 0xcf;

export type BattleSoundCue =
  | { frame: number; kind: "effect"; id: number; track: number }
  | { frame: number; kind: "cry"; lengthOffset: number };
export type BattleSoundTimeline = { frames: number; cues: BattleSoundCue[] };
export type CaptureSoundState = { wobbles: number; caught: boolean };

export function decodeBattleSound(
  rom: Uint8Array,
  id: number,
  param: number,
  capture?: CaptureSoundState,
): BattleSoundTimeline | undefined {
  if (!Number.isInteger(id) || id < 0 || id > MAX_ANIMATION || rom.length < BANK_START + 0x4000)
    return;

  const word = (offset: number) => rom[offset] | (rom[offset + 1] << 8);
  const offset = (address: number) => BANK_START + address - 0x4000;
  let pc = offset(word(TABLE + id * 2));
  let parent: number | undefined;
  let repeats: number | undefined;
  let value = 0;
  let frame = 0;
  let wobble = 0;
  const cues: BattleSoundCue[] = [];

  for (let steps = 0; steps < 4096 && frame < 2048; steps++) {
    if (pc < BANK_START || pc >= BANK_START + 0x4000) return;
    const op = rom[pc++];
    if (op < 0xd0) {
      // RunBattleAnimCommand resumes after the delay counter has reached zero.
      frame += op + 1;
      continue;
    }
    const args = pc;
    pc += ARGUMENTS[op - 0xd0];
    if (pc > BANK_START + 0x4000) return;
    switch (op) {
      case 0xdb: // anim_checkpokeball
        if (!capture) return;
        value = wobble++ < capture.wobbles ? 0 : capture.caught ? 1 : 2;
        break;
      case 0xe0: // anim_sound
        if (rom[args + 1] > 0 && rom[args + 1] < CRYSTAL_SFX_COUNT)
          cues.push({ frame, kind: "effect", track: rom[args] & 3, id: rom[args + 1] });
        break;
      case 0xe1: { // anim_cry
        const variant = rom[args] & 3;
        cues.push({ frame, kind: "cry", lengthOffset: [0xc0, 0x40, 0, 0][variant] });
        break;
      }
      case 0xee: // anim_if_param_and
        if (param & rom[args]) pc = offset(word(args + 1));
        break;
      case 0xef: // anim_jumpuntil
        if (param > 0) {
          param--;
          pc = offset(word(args));
        }
        break;
      case 0xf8: // anim_if_param_equal
        if (param === rom[args]) pc = offset(word(args + 1));
        break;
      case 0xf9: // anim_setvar
        value = rom[args];
        break;
      case 0xfa: // anim_incvar
        value = (value + 1) & 0xff;
        break;
      case 0xfb: // anim_if_var_equal
        if (value === rom[args]) pc = offset(word(args + 1));
        break;
      case 0xfc: // anim_jump
        pc = offset(word(args));
        break;
      case 0xfd: { // anim_loop
        const count = rom[args];
        if (count === 0 && repeats === undefined) {
          pc = offset(word(args + 1));
          break;
        }
        repeats ??= count - 1;
        if (repeats > 0) {
          repeats--;
          pc = offset(word(args + 1));
        } else repeats = undefined;
        break;
      }
      case 0xfe: // anim_call
        parent = pc;
        pc = offset(word(args));
        break;
      case 0xff: // anim_ret
        if (parent === undefined) return { frames: Math.max(1, frame), cues };
        pc = parent;
        parent = undefined;
        break;
    }
  }
}
