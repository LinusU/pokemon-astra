/**
 * Movement scripts (`applymovement`): the cartridge's movement bytecode
 * (engine/overworld/movement.asm) played on an object or the player.
 */
import type { CrystalGame } from "./runtime";
import { FACINGS, STEP, type Facing } from "./world";

/** A byte reader over ROM, or over RAM for movement the engine builds in wMovementBuffer. */
function reader(game: CrystalGame, at: number) {
  if (at < 0) {
    let addr = -at;
    return () => game.peek(addr++);
  }
  let pos = at;
  return () => game.rom.u8(pos++);
}

export async function applyMovement(game: CrystalGame, slot: number, at: number) {
  const m = game.mover(slot);
  // GetMovementData finds no object for a person who isn't out on the map: nothing moves, and the script goes on.
  if (!m || (slot > 0 && !game.obj(slot)!.visible)) return;
  const next = reader(game, at);
  const start = at;
  for (let guard = 0; guard < 400; guard++) {
    const b = next();
    if (b < 0x38) {
      const dir: Facing = FACINGS[b & 3], kind = b >> 2;
      switch (kind) {
        case 0: // turn_head
          m.facing = dir;
          break;
        case 1: // turn_step
        case 8: case 9: case 10: // turn_away, turn_in, turn_waterfall
          m.facing = dir;
          await game.delay(8);
          break;
        case 2: await game.walk(slot, [dir], { speed: 0.5 }); break;
        case 3: await game.walk(slot, [dir]); break;
        case 4: await game.walk(slot, [dir], { speed: 2 }); break;
        case 5: await game.walk(slot, [dir], { speed: 0.5, slide: true }); break;
        case 6: await game.walk(slot, [dir], { slide: true }); break;
        case 7: await game.walk(slot, [dir], { speed: 2, slide: true }); break;
        case 11: await game.walk(slot, [dir], { hop: true, speed: 0.5 }); break;
        case 12: await game.walk(slot, [dir], { hop: true }); break;
        case 13: await game.walk(slot, [dir], { hop: true, speed: 1.5 }); break;
      }
      continue;
    }
    if (b >= 0x3e && b <= 0x45) { await game.delay(b - 0x3e + 1); continue; }
    switch (b) {
      case 0x38: m.sliding = false; break; // remove_sliding
      case 0x39: m.sliding = true; break; // set_sliding
      case 0x3a: m.fixedFacing = false; break; // remove_fixed_facing
      case 0x3b: m.fixedFacing = true; break; // fix_facing
      case 0x3c: m.invisible = false; break; // show_object
      case 0x3d: m.invisible = true; break; // hide_object
      case 0x46: await game.delay(next()); break; // step_sleep n > 8
      case 0x47: return; // step_end
      case 0x48: next(); return; // step_wait_end
      case 0x49: { // remove_object
        const o = game.obj(slot);
        if (o) o.visible = false;
        return;
      }
      case 0x4a: return applyMovement(game, slot, start); // step_loop
      case 0x4b: return; // step_stop
      case 0x4c: case 0x4d: case 0x4e: case 0x59: // teleport_from, teleport_to, skyfall, skyfall_top
        await game.delay(16);
        break;
      case 0x4f: case 0x57: case 0x58: { // step_dig, rock_smash, return_dig
        const n = next();
        await game.delay(n);
        break;
      }
      case 0x50: await game.delay(8); break; // step_bump
      case 0x51: case 0x52: await game.delay(16); break; // fish_got_bite, fish_cast_rod
      case 0x53: m.emote = undefined; break; // hide_emote
      case 0x54: m.emote = { kind: 0, until: Infinity }; break; // show_emote
      case 0x55: { // step_shake
        const n = next();
        game.shake = Math.max(game.shake, n / 60);
        await game.delay(n);
        game.shake = 0;
        break;
      }
      case 0x56: await game.shakeTree(m); break; // tree_shake
      default: return;
    }
  }
}
export { STEP };
