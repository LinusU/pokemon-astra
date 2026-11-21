/** Gen 1 movesets from the cartridge, for trainers' Pokémon. */
import type { Pokemon } from "../engine";
import { SYM } from "./generated/symbols";
import type { YellowRom } from "./rom";

/** Moves a Pokémon knows at a level in Yellow: its level-1 moves, then each level-up move, oldest forgotten first. */
export function gen1Moves(rom: YellowRom, species: number, level: number): number[] {
  const dex = rom.dex(species);
  const base = SYM.BaseStats + (dex - 1) * 28 + 15;
  const moves = [0, 1, 2, 3].map(i => rom.u8(base + i)).filter(Boolean);
  const table = SYM.EvosMovesPointerTable, bank = rom.bankOf(table);
  let o = rom.far(bank, rom.u16(table + (species - 1) * 2));
  while (rom.u8(o)) o += rom.u8(o) === 2 ? 4 : 3;
  for (o++; rom.u8(o); o += 2) {
    const at = rom.u8(o), move = rom.u8(o + 1);
    if (at > level) break;
    if (moves.includes(move)) continue;
    if (moves.length === 4) moves.shift();
    moves.push(move);
  }
  return moves;
}

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
