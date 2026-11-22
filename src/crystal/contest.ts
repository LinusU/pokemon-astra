/**
 * The Bug-Catching Contest (engine/events/bug_contest): 20 Park Balls and 20
 * minutes in the National Park, one Pokémon kept, and the judging.
 */
import { C, CONST, ITEM, MON, RAM, SYM, TEXT } from "./symbols";
import type { CrystalGame } from "./runtime";
import { runScript } from "./script";
import type { CrystalMon } from "./save";

async function engine(game: CrystalGame, label: string, wait = true) {
  const at = TEXT[label];
  if (at === undefined) return;
  await game.writeText(at);
  if (wait) await game.waitButton();
}

export function giveParkBalls(game: CrystalGame) {
  game.save.contest = { balls: CONST.BUG_CONTEST_BALLS ?? 20, minutes: CONST.BUG_CONTEST_MINUTES ?? 20, started: game.save.seconds };
  game.poke(RAM.wParkBallsRemaining, game.save.contest.balls);
  game.setFlag(C("ENGINE_BUG_CONTEST_TIMER"), true);
}

/** Leaves only the lead Pokémon with the player (var 1: the lead has fainted). */
export function contestDropOffMons(game: CrystalGame) {
  const lead = game.save.party[0];
  if (!lead || lead.egg || !lead.hp) { game.scriptVar = 1; return; }
  game.save.contest ??= { balls: 20, minutes: 20, started: game.save.seconds };
  game.save.contest.party = game.save.party.slice(1);
  game.save.party = [lead];
  game.scriptVar = 0;
}
export function contestReturnMons(game: CrystalGame) {
  const held = game.save.contest?.party ?? [];
  game.save.party = [...game.save.party, ...held].slice(0, 6);
  if (game.save.contest) delete game.save.contest.party;
}

export function selectContestants(game: CrystalGame) {
  const flags = Array.from({ length: 10 }, (_, i) => CONST[`EVENT_BUG_CATCHING_CONTESTANT_${i + 1}A`]).filter(f => f !== undefined);
  for (const f of flags) game.setEvent(f, false);
  const hidden = new Set<number>();
  while (hidden.size < Math.min(5, flags.length)) hidden.add(flags[Math.floor(Math.random() * flags.length)]);
  for (const f of hidden) game.setEvent(f, true);
}

/** A contest battle: Park Balls only, and a catch replaces the Pokémon kept so far. */
export async function contestBattle(game: CrystalGame, species: number, level: number) {
  const contest = game.save.contest!;
  const items = game.save.items;
  const saved = { ...items };
  for (const k of Object.keys(items)) delete items[k];
  items[ITEM.PARK_BALL] = contest.balls;
  const before = game.save.party.length;
  game.save.vars.battleType = C("BATTLETYPE_CONTEST");
  game.battleSetup = { kind: "wild", species, level };
  await game.startBattle();
  contest.balls = game.save.items[ITEM.PARK_BALL] ?? 0;
  game.poke(RAM.wParkBallsRemaining, contest.balls);
  for (const k of Object.keys(items)) delete items[k];
  Object.assign(items, saved);
  // A caught Pokémon is kept apart from the party.
  const caught = game.save.party.length > before ? game.save.party.pop() : undefined;
  if (caught) {
    if (contest.caught) {
      game.strings.set(RAM.wStringBuffer1, game.monName(contest.caught.species));
      await game.say(`You already caught a ${game.monName(contest.caught.species)}. Switch POKéMON?`, false);
      if (await game.yesNo()) contest.caught = caught;
    } else contest.caught = caught;
    game.closeText();
  }
  await game.afterBattle();
  if (!contest.balls && SYM.BugCatchingContestOverScript !== undefined) await runScript(game, SYM.BugCatchingContestOverScript);
}

export async function contestTimeUp(game: CrystalGame) {
  if (SYM.BugCatchingContestOverScript !== undefined) await runScript(game, SYM.BugCatchingContestOverScript);
  else await game.say("The contest is over!");
}

function score(game: CrystalGame, m: CrystalMon | undefined) {
  if (!m) return 0;
  const [hp, atk, def, spe, sat, sdf] = m.stats;
  const rare = [MON.SCYTHER, MON.PINSIR].includes(m.species) ? 100 : [MON.BUTTERFREE, MON.BEEDRILL].includes(m.species) ? 40 : 10;
  return Math.floor(m.level * 4 + (hp + atk + def + spe + sat + (sdf ?? 0)) / 8 + rare + (m.hp / Math.max(1, hp)) * 10);
}

/** The judging: three places, with the player's place in the script variable. */
export async function bugContestJudging(game: CrystalGame) {
  const mine = score(game, game.save.contest?.caught);
  const pointers = SYM.BugContestantPointers;
  const contestants = Array.from({ length: 10 }, (_, i) => i).map(i => {
    const at = pointers !== undefined ? game.rom.near(pointers + (i + 1) * 2) : 0;
    const klass = at ? game.rom.u8(at) : 0, id = at ? game.rom.u8(at + 1) : 0;
    const species = at ? game.rom.u8(at + 2) : MON.CATERPIE;
    return { name: klass ? game.trainerName(klass, id) : "?", species, score: 150 + Math.floor(Math.random() * 200) };
  });
  const field = [...contestants, { name: game.save.name, species: game.save.contest?.caught?.species ?? 0, score: mine, player: true }]
    .filter(c => c.species).sort((a, b) => b.score - a.score);
  for (const [place, label] of [[2, "ThirdPlace"], [1, "SecondPlace"], [0, "FirstPlace"]] as const) {
    const c = field[place];
    if (!c) continue;
    game.strings.set(RAM.wBugContestWinnerName, c.name);
    game.strings.set(RAM.wStringBuffer1, game.monName(c.species));
    game.poke(RAM.wBugContestFirstPlaceScore, c.score >> 8);
    game.poke(RAM.wBugContestFirstPlaceScore + 1, c.score & 0xff);
    await engine(game, `ContestJudging_${label}Text`, false);
    await engine(game, `ContestJudging_${label}ScoreText`);
  }
  const place = field.findIndex(c => "player" in c) + 1;
  game.scriptVar = place >= 1 && place <= 3 ? place : 4;
  game.setFlag(C("ENGINE_BUG_CONTEST_TIMER"), false);
}

/** Puts the contest Pokémon in the party or the PC (var: 0 party, 1 PC, 2 none caught). */
export async function checkPartyFullAfterContest(game: CrystalGame) {
  const caught = game.save.contest?.caught;
  delete game.save.contest;
  if (!caught) { game.scriptVar = 2; return; }
  game.register(caught.species, true);
  const where = game.addMon({ ...caught, ot_name: game.save.name, ot_id: game.save.playerId });
  game.scriptVar = where === "party" ? 0 : 1;
  await game.offerNickname(caught);
}
