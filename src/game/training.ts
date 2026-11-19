import type { Engine, Pokemon } from "../engine";
import type { Save } from "./save";

/** The three natural evolution methods in Crystal's species records. */
export function levelEvolution(mon: Pokemon, night: boolean, engine: Engine) {
  if (mon.item === 112) return; // Everstone
  return engine.evolutionData(mon.species).evolutions.find(e => {
    if (e.method === 1) return mon.level >= e.parameter;
    if (e.method === 4) return mon.happiness >= 220 &&
      (e.parameter === 1 || (e.parameter === 2 && !night) || (e.parameter === 3 && night));
    if (e.method !== 5 || mon.level < e.parameter) return false;
    const difference = mon.stats[1] - mon.stats[2];
    return difference > 0 ? e.condition === 1 : difference < 0 ? e.condition === 2 : e.condition === 3;
  })?.species;
}

export function queueEvolutionMoves(save: Save, slot: number, engine: Engine) {
  const mon = save.party[slot];
  const moves = engine.evolutionData(mon.species).learnset
    .filter(entry => entry.level === mon.level && !mon.moves.includes(entry.move))
    .map(entry => entry.move);
  if (moves.length) save.pendingMoves = { slot, moves: [...new Set(moves)] };
}

export function resolveEvolutionMove(save: Save, replace: number | undefined, engine: Engine) {
  const lesson = save.pendingMoves;
  if (!lesson) return;
  if (replace !== undefined) save.party[lesson.slot] = engine.teachMove(save.party[lesson.slot], lesson.moves[0], replace);
  lesson.moves.shift();
  if (!lesson.moves.length) delete save.pendingMoves;
}

export function finishEvolutionChoice(save: Save) {
  save.pendingEvolutions?.shift();
  if (!save.pendingEvolutions?.length) delete save.pendingEvolutions;
}

/** Count actual distance for friendship and Repel, including ice and road crossings. */
export function recordTravel(save: Save, distance: number) {
  const before = Math.floor(save.steps / 128);
  save.steps += distance;
  const gain = Math.floor(save.steps / 128) - before;
  if (gain > 0) for (const mon of save.party) mon.happiness = Math.min(255, mon.happiness + gain);
  if (!save.repel) return false;
  save.repel = Math.max(0, save.repel - distance);
  return save.repel === 0;
}
