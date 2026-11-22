/**
 * Yellow Legacy's engine changes outside its map scripts, and the cartridge
 * tables only it has. Their names are checked against
 * Legacy's symbol table alone (tests/yellow-scripts.test.ts), so callers must
 * be in play with Legacy's cartridge.
 */
import type { YellowGame } from "./runtime";
import { SYM } from "./symbols";

/** OldRodMons: two (level, species) pairs, like Yellow's GoodRodMons. */
export const oldRodMons = () => SYM.OldRodMons;

/** "<Repel>'s effect wore off. Use another?" Resolves whether the player said yes. */
export async function offerAnotherRepel(game: YellowGame, item: string) {
  game.textVar("wStringBuffer", item);
  await game.text("RepelWoreOffUseAnotherText", { wait: false });
  return game.yesNo();
}

/**
 * Once the player has been healed (EVENT_FIRST_POKECENTER), Legacy's nurses
 * only say "Shall we heal your POKéMON?" and heal. Resolves whether they did.
 */
export async function quickNurse(game: YellowGame) {
  if (!game.legacy || !game.ev("EVENT_FIRST_POKECENTER")) return false;
  await game.text("ShallWeHealYourPokemonFastText", { wait: false });
  return true;
}

export function nurseHealed(game: YellowGame) {
  if (game.legacy) game.set("EVENT_FIRST_POKECENTER");
}
