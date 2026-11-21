import type { Pokemon } from "../engine";
import type { YellowGame } from "./runtime";

/** Total experience needed for a level in each Gen 2 experience group. */
export function expForLevel(rate: number, n: number) {
  if (n <= 1) return 0;
  const cube = n ** 3, square = n ** 2;
  switch (rate) {
    case 1: return Math.floor((3 * cube) / 4 + 10 * square - 30);
    case 2: return Math.floor((3 * cube) / 4 + 20 * square - 70);
    case 3: return Math.floor((6 * cube) / 5 - 15 * square + 100 * n - 140);
    case 4: return Math.floor((4 * cube) / 5);
    case 5: return Math.floor((5 * cube) / 4);
    default: return cube;
  }
}

/**
 * Adds experience outside battle. New levels recalculate stats, keep the HP
 * already lost, and teach level-up moves, forgetting the oldest move when full,
 * as the Day-Care does.
 */
export function gainExperience(game: YellowGame, mon: Pokemon, exp: number): Pokemon {
  const engine = game.engine, rate = engine.growthRate(mon.species);
  const total = Math.min(mon.exp + Math.max(0, exp), expForLevel(rate, 100));
  let level = mon.level;
  while (level < 100 && expForLevel(rate, level + 1) <= total) level++;
  if (level === mon.level) return { ...mon, exp: total };
  const stats = engine.statsFor({ ...mon, level });
  const lost = mon.stats[0] - mon.hp;
  let moves = [...mon.moves], pp = [...mon.pp];
  for (const { level: at, move } of engine.evolutionData(mon.species).learnset) {
    if (at <= mon.level || at > level || moves.includes(move)) continue;
    const empty = moves.indexOf(0);
    if (empty >= 0) {
      moves[empty] = move;
      pp[empty] = engine.move(move).pp;
    } else {
      moves = [...moves.slice(1), move];
      pp = [...pp.slice(1), engine.move(move).pp];
    }
  }
  return { ...mon, exp: total, level, stats, hp: mon.hp === 0 ? 0 : Math.max(1, stats[0] - lost), moves, pp };
}
