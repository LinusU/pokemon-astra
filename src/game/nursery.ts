import type { Engine, Pokemon } from "../engine";
import { storePokemon } from "./collection";
import type { Save } from "./save";

type BreedingData = Pick<Engine, "breedingData">;
export function gender(mon: Pokemon, engine: BreedingData) {
  const { genderRatio } = engine.breedingData(mon.species);
  if (genderRatio === 255) return "—";
  if (genderRatio === 0) return "♂";
  const value = (mon.dvs[0] & 0xf0) | (mon.dvs[1] >> 4);
  return genderRatio === 254 || value <= genderRatio ? "♀" : "♂";
}

/** The egg follows the female parent's family, or Ditto's partner. */
function familyParent(a: Pokemon, b: Pokemon, engine: BreedingData) {
  if (a === b) return;
  const groups = engine.breedingData(a.species).groups;
  const other = engine.breedingData(b.species).groups;
  if (groups.includes(15) || other.includes(15)) return;
  if ((a.dvs[0] & 15) === (b.dvs[0] & 15) && (a.dvs[1] & 7) === (b.dvs[1] & 7)) return;
  if (a.species === 132) return b.species !== 132 ? b : undefined;
  if (b.species === 132) return a;
  if (!groups.some(group => other.includes(group))) return;
  const first = gender(a, engine), second = gender(b, engine);
  if (first === "♀" && second === "♂") return a;
  if (second === "♀" && first === "♂") return b;
}

export function canNest(party: Pokemon[], a: number, b: number, engine: BreedingData) {
  return !!party[a] && !!party[b] && party.some((mon, i) => i !== a && i !== b && mon.hp > 0)
    && !!familyParent(party[a], party[b], engine);
}

export function leavePair(save: Save, a: number, b: number, engine: BreedingData) {
  if (save.nursery || save.egg || !canNest(save.party, a, b, engine)) return false;
  save.nursery = { parents: [save.party[a], save.party[b]], readyAt: save.steps + 96 };
  save.party = save.party.filter((_, i) => i !== a && i !== b);
  return true;
}

function hatchling(a: Pokemon, b: Pokemon, engine: Engine, random: () => number) {
  const mother = familyParent(a, b, engine);
  if (!mother) return;
  const mate = mother === a ? b : a;
  let id = engine.firstStage(mother.species);
  if (id === 29 && random() < 0.5) id = 32;
  let mon = engine.makePokemon(id, 5);
  mon.dvs = [Math.floor(random() * 256), Math.floor(random() * 256)];
  const donor = mate.species === 132 || gender(mon, engine) === "♀" ? mate : mother;
  mon.dvs[0] = (mon.dvs[0] & 0xf0) | (donor.dvs[0] & 15);
  mon.dvs[1] = (mon.dvs[1] & 0xf8) | (donor.dvs[1] & 7);
  mon.stats = engine.statsFor(mon);
  mon.hp = mon.stats[0];
  mon.happiness = 120;
  mon.ot_name = "ASTRA";

  const moves = engine.inheritableMoves(id);
  const learnset = engine.evolutionData(id).learnset;
  // A male or genderless Pokémon passes moves when paired with Ditto.
  const teacher = mate.species === 132 && gender(mother, engine) !== "♀" ? mother : mate;
  for (const move of teacher.moves) {
    if (!move || mon.moves.includes(move)) continue;
    const shared = mother.moves.includes(move) && mate.moves.includes(move) && learnset.some(entry => entry.move === move);
    if (!moves.has(move) && !shared) continue;
    if (!mon.moves.includes(0)) {
      mon.moves = [...mon.moves.slice(1), 0];
      mon.pp = [...mon.pp.slice(1), 0];
    }
    mon = engine.teachMove(mon, move, mon.moves.indexOf(0));
  }
  return mon;
}

export function collectPair(save: Save, engine: Engine, random = Math.random) {
  const nest = save.nursery;
  if (!nest) return;
  const [a, b] = nest.parents;
  if (save.steps >= nest.readyAt && !save.egg) {
    const mon = hatchling(a, b, engine, random);
    if (mon) save.egg = { mon, hatchAt: save.steps + engine.breedingData(mon.species).cycles * 8 };
  }
  for (const mon of nest.parents) {
    if (save.party.length < 6) save.party.push(mon);
    else storePokemon(save.storage, mon);
  }
  delete save.nursery;
}

export function hatchEgg(save: Save) {
  if (!save.egg || save.steps < save.egg.hatchAt) return;
  const { mon } = save.egg;
  delete save.egg;
  mon.caught = [(save.settings.night ? 0xc0 : 0x80) | 1, 0];
  const stored = save.party.length >= 6;
  if (stored) storePokemon(save.storage, mon);
  else save.party.push(mon);
  if (!save.seen.includes(mon.species)) save.seen.push(mon.species);
  if (!save.caught.includes(mon.species)) save.caught.push(mon.species);
  return { mon, stored };
}
