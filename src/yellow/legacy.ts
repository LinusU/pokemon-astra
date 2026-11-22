/**
 * Cartridge tables only Yellow Legacy has. Their names are checked against
 * Legacy's symbol table alone (tests/yellow-scripts.test.ts), so callers must
 * be in play with Legacy's cartridge.
 */
import { SYM } from "./symbols";

/** OldRodMons: two (level, species) pairs, like Yellow's GoodRodMons. */
export const oldRodMons = () => SYM.OldRodMons;
