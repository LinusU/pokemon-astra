/** What each step counts (engine/overworld/events.asm, CountStep): Repel, poison, Eggs, the Day-Care, friendship and phone calls. */
import { C, RAM, SYM, TEXT } from "./symbols";
import type { CrystalGame } from "./runtime";
import { runScript } from "./script";

/** Returns true when something interrupted the walk. */
export async function countStep(game: CrystalGame): Promise<boolean> {
  const save = game.save;
  const { dayCareStep, eggStep } = await import("./daycare");
  dayCareStep(game);
  if (await eggStep(game)) return true;
  // Friendship grows for every Pokémon a step… every 256 of them.
  if (save.steps % 256 === 0) for (const m of save.party) if (!m.egg) m.happiness = Math.min(255, m.happiness + 1);
  if (save.repel && !--save.repel) {
    // Crystal Legacy offers another Repel of the same kind (UseAnotherRepelScript).
    const kind = save.vars.repelType ?? 0;
    if (RAM.wRepelType !== undefined) game.poke(RAM.wRepelType, kind);
    if (SYM.UseAnotherRepelScript !== undefined && kind && game.itemCount(kind)) await runScript(game, SYM.UseAnotherRepelScript);
    else if (SYM.RepelWoreOffScript !== undefined) await runScript(game, SYM.RepelWoreOffScript);
    else {
      const at = TEXT._RepelWoreOffText;
      if (at !== undefined) {
        await game.engineText(at);
        game.closeText();
      } else await game.say("REPEL's effect wore off.");
    }
    return true;
  }
  // Poison: every fourth step costs 1 HP, never below 1 outside battle (Crystal).
  if (save.steps % 4 === 0 && save.party.some(m => !m.egg && m.hp > 1 && (m.status & 0x08))) {
    let fainted = false;
    for (const m of save.party) {
      if (m.egg || !(m.status & 0x08) || m.hp <= 1) continue;
      m.hp--;
      if (m.hp === 1) {
        m.status &= ~0x08;
        await game.say(`${m.nickname || game.monName(m.species)} survived the poisoning!`);
        fainted = true;
      }
    }
    game.sfx("SFX_POISON");
    if (fainted) return true;
  }
  // The Bug-Catching Contest's 20 minutes.
  if (save.contest && game.contestMinutes() <= 0) {
    const { contestTimeUp } = await import("./contest");
    await contestTimeUp(game);
    return true;
  }
  // Phone calls: a special call queued by a script, then now and then a contact.
  if (save.specialCall && !game.map.phoneService) {
    const { specialCall } = await import("./phone");
    if (await specialCall(game)) return true;
  }
  if (save.steps % 64 === 0 && save.phone.length > 1 && !game.map.phoneService && Math.random() < 0.06) {
    const { randomCall } = await import("./phone");
    if (await randomCall(game)) return true;
  }
  void runScript;
  void SYM;
  void C;
  return false;
}
