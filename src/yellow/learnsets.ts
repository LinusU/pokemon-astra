/**
 * Trainers' hand-picked moves from the cartridge. Their other moves are the
 * battle engine's level-up moves, like every Pokémon's.
 */
import type { Pokemon } from "../engine";
import { SYM } from "./symbols";
import type { YellowRom } from "./rom";

/** Yellow gives some trainers hand-picked moves (gym leaders' signature moves, for instance). */
export function specialMoves(rom: YellowRom, klass: number, index: number) {
  const out: { mon: number; slot: number; move: number }[] = [];
  for (let o = SYM.SpecialTrainerMoves; rom.u8(o) !== 0xff && o < SYM.SpecialTrainerMoves + 400;) {
    const match = rom.u8(o) === klass && rom.u8(o + 1) === index;
    for (o += 2; rom.u8(o); o += 3)
      if (match) out.push({ mon: rom.u8(o) - 1, slot: rom.u8(o + 1) - 1, move: rom.u8(o + 2) });
    o++;
  }
  return out;
}

export function withMoves(mon: Pokemon, moves: number[], pp: (move: number) => number): Pokemon {
  const list = [...moves, 0, 0, 0, 0].slice(0, 4);
  return { ...mon, moves: list, pp: list.map(m => m ? pp(m) : 0) };
}
