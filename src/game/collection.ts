import type { Pokemon } from "../engine";

export type Collection = { party: Pokemon[]; storage: Pokemon[] };

/** One register, in National Pokédex order. Equal species and levels keep arrival order. */
export function sortCollection(storage: Pokemon[]) {
  storage.sort((a, b) => a.species - b.species || a.level - b.level);
}

export function storePokemon(storage: Pokemon[], mon: Pokemon) {
  storage.push(mon);
  sortCollection(storage);
}

export function canDeposit(party: Pokemon[], index: number, incoming?: Pokemon) {
  return !!party[index] && (!!incoming?.hp || party.some((mon, i) => i !== index && mon.hp > 0));
}

export function depositPokemon({ party, storage }: Collection, index: number) {
  if (!canDeposit(party, index)) return false;
  storePokemon(storage, party.splice(index, 1)[0]);
  return true;
}

/** With a full party, exchange both partners in one operation. */
export function withdrawPokemon({ party, storage }: Collection, mon: Pokemon, replace?: number) {
  const index = storage.indexOf(mon);
  if (index < 0) return false;
  if (replace === undefined) {
    if (party.length >= 6) return false;
    storage.splice(index, 1);
    party.push(mon);
  } else {
    if (!canDeposit(party, replace, mon)) return false;
    storage[index] = party[replace];
    party[replace] = mon;
    sortCollection(storage);
  }
  return true;
}
