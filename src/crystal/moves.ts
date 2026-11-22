/** Learning moves outside battle: level-ups, TMs and HMs, tutors, and Crystal Legacy's Move Reminders. */
import { chooseEvolutionMove } from "../ui/learn-move";
import { C, RAM, SYM, TEXT } from "./symbols";
import type { CrystalGame } from "./runtime";
import { expForLevel } from "../yellow/growth";

/** Teaches `move`, asking which move to forget when four are known. Resolves true if it was learned. */
export async function learnMove(game: CrystalGame, slot: number, move: number): Promise<boolean> {
  const mon = game.save.party[slot];
  const name = mon.nickname || game.monName(mon.species), moveName = game.engine.move(move).name.toUpperCase();
  if (mon.moves.includes(move)) return false;
  const empty = mon.moves.indexOf(0);
  if (empty >= 0) {
    game.save.party[slot] = { ...game.engine.teachMove(mon, move, empty), egg: mon.egg };
    game.sfx("SFX_DEX_FANFARE_50_79");
    await game.say(`${name} learned ${moveName}!`);
    return true;
  }
  if (!game.ctx.layer) {
    game.save.party[slot] = game.engine.teachMove(mon, move, 0);
    return true;
  }
  return game.modal(() => new Promise<boolean>(resolve => {
    game.closeText();
    chooseEvolutionMove(game.layer, mon, move, game.engine, async replace => {
      game.layer.replaceChildren();
      if (replace === undefined) {
        await game.say(`${name} did not learn ${moveName}.`);
        return resolve(false);
      }
      game.save.party[slot] = game.engine.teachMove(mon, move, replace);
      game.sfx("SFX_DEX_FANFARE_50_79");
      await game.say(`${name} learned ${moveName}!`);
      resolve(true);
    });
  }));
}

/** Whether a species can learn a move from a TM, HM or tutor, by the game data. */
export function canLearn(game: CrystalGame, species: number, move: number) {
  return game.engine.machineMoves(species).has(move);
}

/** A TM, HM or tutor move: checks compatibility, then learns. */
export async function teachMove(game: CrystalGame, slot: number, move: number) {
  const mon = game.save.party[slot];
  if (mon.egg || !canLearn(game, mon.species, move)) {
    await game.say(`${mon.egg ? "An EGG" : mon.nickname || game.monName(mon.species)} can't learn ${game.engine.move(move).name.toUpperCase()}.`);
    return false;
  }
  if (mon.moves.includes(move)) {
    await game.say(`${mon.nickname || game.monName(mon.species)} already knows ${game.engine.move(move).name.toUpperCase()}.`);
    return false;
  }
  return learnMove(game, slot, move);
}

/** Moves a Pokémon learns at its current level. */
export async function learnLevelMoves(game: CrystalGame, slot: number) {
  const mon = game.save.party[slot];
  const moves = game.engine.evolutionData(mon.species).learnset.filter(e => e.level === mon.level && !mon.moves.includes(e.move));
  for (const { move } of moves) await learnMove(game, slot, move);
}

/** A Rare Candy's level: new stats, moves, and evolution. */
export async function gainLevel(game: CrystalGame, slot: number) {
  const mon = game.save.party[slot];
  const rate = game.engine.growthRate(mon.species), level = mon.level + 1;
  const next = { ...mon, level, exp: Math.max(mon.exp, expForLevel(rate, level)) };
  next.stats = game.engine.statsFor(next);
  next.hp = mon.hp + (next.stats[0] - mon.stats[0]);
  game.save.party[slot] = next;
  game.sfx("SFX_LEVEL_UP");
  await game.say(`${mon.nickname || game.monName(mon.species)} grew to level ${level}!`);
  await learnLevelMoves(game, slot);
  const { evolutionTarget, evolveTo } = await import("./battle");
  const target = evolutionTarget(game, game.save.party[slot], "level");
  if (target) await evolveTo(game, slot, target);
}

/** Crystal Legacy's Move Reminder and Egg Move Reminder (engine/events/move_reminder.asm), with its texts. */
export async function moveReminder(game: CrystalGame, egg: boolean) {
  const say = async (label: string, fallback: string, wait = true) => {
    const at = TEXT[label];
    if (at !== undefined) await game.writeText(at);
    else await game.say(fallback, false);
    if (wait) await game.waitButton();
  };
  await say(egg ? "Text_EggMoveReminderIntro" : "Text_MoveReminderIntro", "Shall I teach your POKéMON a move it has forgotten?", false);
  if (!(await game.yesNo())) return say("Text_MoveReminderCancel", "Come back anytime.");
  await say("Text_MoveReminderWhichMon", "Which POKéMON?");
  const { choosePartyMon } = await import("./menu");
  const slot = await choosePartyMon(game, "Which POKéMON?");
  if (slot === undefined) return say("Text_MoveReminderCancel", "Come back anytime.");
  const mon = game.save.party[slot];
  if (mon.egg) return say("Text_MoveReminderEgg", "An EGG can't learn moves.");
  let moves: number[];
  if (egg) {
    const first = game.engine.firstStage(mon.species);
    const list: number[] = [];
    for (let o = game.rom.near(SYM.EggMovePointers + (first - 1) * 2); game.rom.u8(o) !== 0xff && list.length < 20; o++) list.push(game.rom.u8(o));
    moves = list;
  } else moves = game.engine.evolutionData(mon.species).learnset.filter(e => e.level <= mon.level).map(e => e.move);
  moves = [...new Set(moves)].filter(m => m && !mon.moves.includes(m));
  if (!moves.length) return say("Text_MoveReminderNoMoves", "There's no move it can remember.");
  await say("Text_MoveReminderWhichMove", "Which move should it remember?");
  const pick = await game.choose(moves.map(m => game.engine.move(m).name.toUpperCase()), { title: "Which move?", cancel: true });
  if (pick !== undefined) {
    game.strings.set(RAM.wStringBuffer2, game.engine.move(moves[pick]).name.toUpperCase());
    await learnMove(game, slot, moves[pick]);
  }
  await say("Text_MoveReminderCancel", "Come back anytime.");
  void C;
}
