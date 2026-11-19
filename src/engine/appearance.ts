export interface PokemonPortrait {
  species: number;
  /** Two saved DV bytes, or the native battle snapshot's big-endian word. */
  dvs?: readonly number[] | number;
  /** Transform copies the opponent's DVs but retains the user's palette. */
  paletteDvs?: number;
}

export function dvWord(dvs: NonNullable<PokemonPortrait["dvs"]>) {
  return typeof dvs === "number" ? dvs : (dvs[0] << 8) | dvs[1];
}

export function pokemonAppearance(mon: PokemonPortrait | number) {
  const species = typeof mon === "number" ? mon : mon.species;
  const dvs = typeof mon === "number" ? undefined : mon.dvs;
  const word = dvWord(dvs ?? 0);
  const palette = typeof mon === "number" ? word : mon.paletteDvs ?? word;
  const shiny = (palette & 0x2fff) === 0x2aaa;
  // Crystal packs the middle two bits of each DV into the Unown letter index.
  const letter = ((word >> 7) & 0xc0) | ((word >> 5) & 0x30) | ((word >> 3) & 0x0c) | ((word >> 1) & 3);
  return { species, form: species === 201 ? Math.floor(letter / 10) : 0, shiny };
}

export function portraitNumber(mon: PokemonPortrait) {
  const { species, form, shiny } = pokemonAppearance(mon);
  const letter = species === 201 ? `-${String.fromCharCode(65 + form)}` : "";
  return `№ ${String(species).padStart(3, "0")}${letter}${shiny ? " · Shiny" : ""}`;
}
