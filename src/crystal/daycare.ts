/**
 * The Route 34 Day-Care (engine/events/daycare.asm): the man and the lady
 * each raise one Pokémon, compatible pairs leave an Egg, and Eggs hatch as
 * the player walks.
 */
import type { Pokemon } from "../engine";
import { gender } from "../game/nursery";
import { C, CONST, RAM, SYM, TEXT } from "./symbols";
import type { CrystalGame } from "./runtime";
import type { CrystalMon } from "./save";
import { expForLevel } from "../yellow/growth";

const TEXTS = [
  "DayCareManIntroText", "DayCareManIntroEggText", "DayCareLadyIntroText", "DayCareLadyIntroEggText", "WhatShouldIRaiseText",
  "IllRaiseYourMonText", "CantAcceptEggText", "OnlyOneMonText", "LastHealthyMonText", "ComeBackLaterText", "RemoveMailText",
  "AreWeGeniusesText", "YourMonHasGrownText", "PerfectHeresYourMonText", "GotBackMonText", "BackAlreadyText", "HaveNoRoomText",
  "NotEnoughMoneyText", "OhFineThenText", "ComeAgainText",
];
async function say(game: CrystalGame, index: number, wait = true) {
  const at = TEXT[`PrintDayCareText.${TEXTS[index]}`];
  if (at !== undefined) await game.engineText(at, wait);
  else if (wait) await game.waitButton();
}

/** Experience the Day-Care adds as the player walks: one point a step. */
export function dayCareStep(game: CrystalGame) {
  const d = game.save.daycare;
  for (let i = 0; i < 2; i++) {
    const mon = d.mons[i];
    if (!mon || mon.level >= 100) continue;
    d.mons[i] = grow(game, mon, 1);
  }
  if (!d.mons[0] || !d.mons[1] || d.egg) return;
  // DAYCAREMAN_MONS_COMPATIBLE: a pair that can breed (not 0, nor $ff for matching DVs).
  const compatible = compatibility(game, d.mons[0], d.mons[1]);
  if (!compatible || compatible === 0xff) return;
  // wStepsToEgg: 150–255 steps after the pair is left, then a random byte each time.
  if (!d.steps) d.steps = 150 + Math.floor(Math.random() * 106);
  if (--d.steps > 0) return;
  d.steps = Math.floor(Math.random() * 256) || 256;
  const chance = compatible >= 230 ? 80 : compatible >= 170 ? 41 : compatible >= 110 ? 30 : 10;
  if (Math.random() * 256 >= chance) return;
  d.egg = true;
  // The Egg is made now, from the parents left (DayCare_InitBreeding fills wEggMon).
  d.eggMon = makeEgg(game, d.mons[0], d.mons[1]);
  game.setFlag(C("ENGINE_DAY_CARE_MAN_HAS_EGG"), true);
}

function grow(game: CrystalGame, mon: CrystalMon, exp: number): CrystalMon {
  const rate = game.engine.growthRate(mon.species);
  const total = Math.min(mon.exp + exp, expForLevel(rate, 100));
  let level = mon.level;
  while (level < 100 && expForLevel(rate, level + 1) <= total) level++;
  if (level === mon.level) return { ...mon, exp: total };
  let moves = [...mon.moves], pp = [...mon.pp];
  for (const { level: at, move } of game.engine.evolutionData(mon.species).learnset) {
    if (at <= mon.level || at > level || moves.includes(move)) continue;
    const empty = moves.indexOf(0);
    if (empty >= 0) { moves[empty] = move; pp[empty] = game.engine.move(move).pp; }
    else { moves = [...moves.slice(1), move]; pp = [...pp.slice(1), game.engine.move(move).pp]; }
  }
  const next = { ...mon, exp: total, level, moves, pp };
  next.stats = game.engine.statsFor(next);
  next.hp = next.stats[0];
  return next;
}

/**
 * CheckBreedmonCompatibility: 0 when the pair can't breed, $ff when their
 * Defense and low Special DVs match (they won't breed either), otherwise 254
 * for one species or 128 for two, less 77 when they share a trainer.
 */
export function compatibility(game: CrystalGame, a: Pokemon, b: Pokemon) {
  const e = game.engine, ditto = CONST.DITTO ?? 132;
  const ga = e.breedingData(a.species).groups, gb = e.breedingData(b.species).groups;
  if (ga.includes(15) || gb.includes(15)) return 0;
  if (a.species === ditto && b.species === ditto) return 0;
  if (a.species !== ditto && b.species !== ditto) {
    if (!ga.some(g => gb.includes(g))) return 0;
    const sa = gender(a, e), sb = gender(b, e);
    if (sa === "—" || sb === "—" || sa === sb) return 0;
  }
  if ((a.dvs[0] & 15) === (b.dvs[0] & 15) && (a.dvs[1] & 7) === (b.dvs[1] & 7)) return 0xff;
  const base = a.species === b.species ? 254 : 128;
  return a.ot_id === b.ot_id ? base - 77 : base;
}

async function choosePartyMon(game: CrystalGame) {
  const { choosePartyMon } = await import("./menu");
  return choosePartyMon(game, "Which POKéMON?");
}

async function deposit(game: CrystalGame, slot: 0 | 1) {
  const d = game.save.daycare;
  if (game.save.party.length < 2) return say(game, 7);
  await say(game, 4, false);
  const pick = await choosePartyMon(game);
  if (pick === undefined) return say(game, 18);
  const mon = game.save.party[pick];
  if (mon.egg) return say(game, 6);
  if (!game.save.party.some((m, i) => i !== pick && !m.egg && m.hp > 0)) return say(game, 8);
  game.strings.set(RAM.wStringBuffer1, mon.nickname || game.monName(mon.species));
  game.save.party.splice(pick, 1);
  d.mons[slot] = { ...mon, vars: undefined } as CrystalMon;
  // The level it was left at, for the price; the Pokémon's own caught data stays as it is.
  (d.levels ??= [])[slot] = mon.level;
  d.steps = 0;
  await say(game, 5);
  game.cry(mon.species);
  await say(game, 9);
}

async function withdraw(game: CrystalGame, slot: 0 | 1) {
  const d = game.save.daycare, mon = d.mons[slot]!;
  const deposited = d.levels?.[slot] ?? mon.caught?.[0] ?? mon.level;
  const grown = Math.max(0, mon.level - deposited);
  const price = 100 + 100 * grown;
  game.strings.set(RAM.wStringBuffer1, mon.nickname || game.monName(mon.species));
  game.poke(RAM.wStringBuffer2 + 1, grown);
  game.poke(RAM.wStringBuffer2 + 2, price >> 16);
  game.poke(RAM.wStringBuffer2 + 3, (price >> 8) & 0xff);
  game.poke(RAM.wStringBuffer2 + 4, price & 0xff);
  if (!grown) {
    await say(game, 15, false);
    if (!(await game.yesNo())) return say(game, 18);
  } else {
    await say(game, 11, false);
    if (!(await game.yesNo())) return say(game, 18);
    await say(game, 12, false);
    if (!(await game.yesNo())) return say(game, 18);
  }
  if (game.save.money < price) return say(game, 17);
  if (game.save.party.length >= 6) return say(game, 16);
  game.save.money -= price;
  d.mons[slot] = undefined;
  if (d.levels) d.levels[slot] = undefined;
  game.save.party.push(mon);
  await say(game, 13);
  game.cry(mon.species);
  await say(game, 14);
}

export async function dayCareMan(game: CrystalGame) {
  const d = game.save.daycare;
  if (d.mons[0]) await withdraw(game, 0);
  else {
    await say(game, d.mons[1] ? 1 : 0, false);
    if (await game.yesNo()) await deposit(game, 0);
  }
  await say(game, 19);
}
export async function dayCareLady(game: CrystalGame) {
  const d = game.save.daycare;
  if (d.mons[1]) await withdraw(game, 1);
  else {
    await say(game, d.lady ? 2 : 3, false);
    d.lady = true;
    if (await game.yesNo()) await deposit(game, 1);
  }
  await say(game, 19);
}

/** The man outside: "Here's an Egg we found." */
export async function dayCareManOutside(game: CrystalGame) {
  const d = game.save.daycare;
  const text = async (name: string) => {
    const at = TEXT[`DayCareManOutside.${name}`];
    if (at !== undefined) await game.engineText(at);
  };
  if (!d.egg) {
    game.scriptVar = 0;
    return;
  }
  await text("FoundAnEggText");
  if (!(await game.yesNo())) {
    await text("IllKeepItThanksText");
    d.egg = false;
    delete d.eggMon;
    game.setFlag(C("ENGINE_DAY_CARE_MAN_HAS_EGG"), false);
    game.scriptVar = 1;
    return;
  }
  if (game.save.party.length >= 6) {
    await text("NoRoomForEggText");
    game.scriptVar = 1;
    return;
  }
  const egg = d.eggMon ?? (d.mons[0] && d.mons[1] ? makeEgg(game, d.mons[0], d.mons[1]) : undefined);
  if (egg) game.save.party.push(egg);
  d.egg = false;
  delete d.eggMon;
  game.setFlag(C("ENGINE_DAY_CARE_MAN_HAS_EGG"), false);
  await text("ReceivedEggText");
  game.sfx("SFX_GET_EGG");
  await text("TakeGoodCareOfEggText");
  game.scriptVar = 1;
}

/** The species and moves of an Egg from two parents. */
export function makeEgg(game: CrystalGame, a: Pokemon, b: Pokemon): CrystalMon | undefined {
  const e = game.engine, ditto = CONST.DITTO ?? 132;
  const mother = a.species === ditto ? b : b.species === ditto ? a : gender(a, e) === "♀" ? a : b;
  const father = mother === a ? b : a;
  let species = e.firstStage(mother.species);
  if (species === (CONST.NIDORAN_F ?? 29) && Math.random() < 0.5) species = CONST.NIDORAN_M ?? 32;
  let mon = e.makePokemon(species, 5);
  mon.dvs = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
  const donor = father.species === ditto || gender(mon, e) === "♀" ? father : mother;
  mon.dvs[0] = (mon.dvs[0] & 0xf0) | (donor.dvs[0] & 15);
  mon.dvs[1] = (mon.dvs[1] & 0xf8) | (donor.dvs[1] & 7);
  const eggMoves = new Set<number>();
  const ptr = game.rom.near(SYM.EggMovePointers + (species - 1) * 2);
  for (let o = ptr; game.rom.u8(o) !== 0xff && eggMoves.size < 20; o++) eggMoves.add(game.rom.u8(o));
  const machines = e.machineMoves(species);
  for (const move of father.moves) {
    if (!move || mon.moves.includes(move)) continue;
    if (!eggMoves.has(move) && !machines.has(move)) continue;
    if (!mon.moves.includes(0)) mon = { ...mon, moves: [...mon.moves.slice(1), 0], pp: [...mon.pp.slice(1), 0] };
    mon = e.teachMove(mon, move, mon.moves.indexOf(0));
  }
  mon.stats = e.statsFor(mon);
  mon.hp = mon.stats[0];
  mon.happiness = e.breedingData(species).cycles;
  return { ...mon, ot_id: game.save.playerId, ot_name: game.save.name, nickname: "EGG", egg: true, eggCycles: e.breedingData(species).cycles };
}

/** Eggs in the party hatch after their cycles of 256 steps. */
/** DoEggStep and HatchEggs: every 256 steps the Eggs count down, in party order, until one is ready; then every ready Egg hatches. */
export async function eggStep(game: CrystalGame) {
  if (game.save.steps % 256) return false;
  const party = game.save.party;
  for (const m of party) {
    if (!m.egg || !m.eggCycles) continue;
    m.eggCycles--;
    if (!m.eggCycles) break;
  }
  let hatched = false;
  for (let i = 0; i < party.length; i++) {
    if (!party[i].egg || party[i].eggCycles) continue;
    await hatch(game, i);
    hatched = true;
  }
  return hatched;
}
async function hatch(game: CrystalGame, slot: number) {
  const mon = game.save.party[slot];
  const name = game.monName(mon.species);
  await game.say("Huh?");
  game.cry(mon.species);
  const hatched: CrystalMon = { ...mon, egg: undefined, eggCycles: undefined, nickname: name, happiness: 120, caught: [0, 0] };
  game.save.party[slot] = hatched;
  game.register(mon.species, true);
  await game.say(`${name} came out of its EGG!`);
  await game.offerNickname(hatched, "_BreedAskNicknameText");
}
