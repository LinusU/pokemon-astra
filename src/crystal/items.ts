/**
 * Using items from the Pack outside battle (engine/items/item_effects.asm):
 * medicine from the cartridge's own healing tables, evolution stones, Rare
 * Candy, vitamins, Repels, the Bicycle, rods, the Escape Rope, TMs and HMs.
 */
import { C, CONST, ITEM, MOVE, RAM, SYM, TEXT, itemConst } from "./symbols";
import type { CrystalGame } from "./runtime";

/** What a use left for the caller: a message, an action to run on the map, or nothing. */
export type ItemResult = string | (() => Promise<void>) | "close" | void;

function healAmount(game: CrystalGame, item: number) {
  const r = game.rom;
  if (SYM.HealingHPAmounts === undefined) return 0;
  for (let o = SYM.HealingHPAmounts; r.u8(o) !== 0xff; o += 3) if (r.u8(o) === item) return r.u16(o + 1);
  return 0;
}
function statusCure(game: CrystalGame, item: number) {
  const r = game.rom;
  if (SYM.StatusHealingActions === undefined) return 0;
  for (let o = SYM.StatusHealingActions; r.u8(o) !== 0xff; o += 3) if (r.u8(o) === item) return r.u8(o + 2);
  return 0;
}
const is = (item: number, ...names: string[]) => names.some(n => ITEM[n] === item);

async function pickMon(game: CrystalGame, title: string) {
  const { choosePartyMon } = await import("./menu");
  return choosePartyMon(game, title);
}

/** A cartridge text as one line for a message, or the fallback. */
function cartridgeLine(game: CrystalGame, label: string, fallback: string) {
  const at = TEXT[label];
  return at === undefined ? fallback : game.textOf(at).replace(/\f/g, " ");
}

/** UseRepel: starts the Repel's steps unless one is still working. Returns the cartridge's message. */
export function useRepel(game: CrystalGame, item: number) {
  if (game.save.repel) return cartridgeLine(game, "_RepelUsedEarlierIsStillInEffectText", "The REPEL used earlier is still in effect.");
  game.save.repel = is(item, "REPEL") ? 100 : is(item, "SUPER_REPEL") ? 200 : 250;
  game.save.vars.repelType = item;
  game.takeItem(item);
  // UseItemText: "<PLAYER> used the <ITEM>.", with the Full Heal sound.
  game.strings.set(RAM.wStringBuffer2, game.rom.itemName(item));
  game.sfx("SFX_FULL_HEAL");
  return cartridgeLine(game, "_ItemUsedText", `${game.save.name} used the ${game.rom.itemName(item)}.`);
}

export async function useItem(game: CrystalGame, item: number): Promise<ItemResult> {
  const name = itemConst(item) ?? "";
  const heal = healAmount(game, item), cure = statusCure(game, item);
  const revive = is(item, "REVIVE", "MAX_REVIVE", "REVIVAL_HERB");
  if (heal || cure || revive) return medicine(game, item, heal, cure, revive);
  if (is(item, "ETHER", "MAX_ETHER", "ELIXER", "MAX_ELIXER", "MYSTERYBERRY", "PP_UP")) return ppItem(game, item);
  if (is(item, "RARE_CANDY")) return rareCandy(game, item);
  if (is(item, "HP_UP", "PROTEIN", "IRON", "CARBOS", "CALCIUM")) return vitamin(game, item);
  if (is(item, "FIRE_STONE", "THUNDERSTONE", "WATER_STONE", "LEAF_STONE", "MOON_STONE", "SUN_STONE") || evolvesWith(game, item)) return stone(game, item);
  if (is(item, "REPEL", "SUPER_REPEL", "MAX_REPEL")) return useRepel(game, item);
  if (is(item, "BICYCLE")) return () => toggleBike(game);
  if (is(item, "OLD_ROD", "GOOD_ROD", "SUPER_ROD")) return async () => {
    const { fish } = await import("./field");
    await fish(game, is(item, "OLD_ROD") ? 0 : is(item, "GOOD_ROD") ? 1 : 2);
  };
  if (is(item, "ESCAPE_ROPE")) return async () => {
    const { canDig, useEscape } = await import("./field");
    if (!canDig(game)) return game.say("You can't use that here.");
    game.takeItem(item);
    await useEscape(game, "rope");
  };
  if (is(item, "ITEMFINDER")) return () => itemfinder(game);
  if (/^(TM|HM)_/.test(name)) return teachMachine(game, item, name.slice(3));
  if (is(item, "COIN_CASE")) return `Coins: ${game.save.coins}`;
  if (is(item, "BLUE_CARD")) return `Points: ${game.save.vars.blueCard ?? 0}`;
  if (is(item, "SQUIRTBOTTLE", "BASEMENT_KEY", "CARD_KEY", "SECRETPOTION", "RED_SCALE", "MYSTERY_EGG", "SILVER_WING", "RAINBOW_WING", "CLEAR_BELL", "GS_BALL"))
    return () => useKeyItemHere(game, item);
  return "OAK: This isn't the time to use that!";
}

/** HappinessChanges (data/events/happiness_changes.asm): the change below 100 happiness, below 200, and above. */
const HAPPINESS_CRYSTAL = {
  levelUp: [5, 3, 2], vitamin: [5, 3, 2], learnMove: [1, 1, 0], bitterPowder: [-5, -5, -10], energyRoot: [-10, -10, -15], revivalHerb: [-15, -15, -20],
  olderCut: [[1, 1, 1], [3, 3, 1], [5, 5, 2]], youngerCut: [[1, 1, 1], [3, 3, 1], [10, 10, 4]], grooming: [3, 3, 1],
};
/** Crystal Legacy raises the level-up, learned-move and haircut changes. */
const HAPPINESS_LEGACY: typeof HAPPINESS_CRYSTAL = {
  ...HAPPINESS_CRYSTAL, levelUp: [10, 6, 4], learnMove: [1, 1, 1],
  olderCut: [[5, 5, 5], [5, 5, 5], [5, 5, 5]], youngerCut: [[5, 5, 5], [7, 7, 7], [10, 10, 9]],
};
export function happinessChanges(game: CrystalGame) {
  return game.legacy ? HAPPINESS_LEGACY : HAPPINESS_CRYSTAL;
}
/** ChangeHappiness: a happiness action on a Pokémon (Eggs aren't changed). */
export function changeHappiness(m: { happiness: number; egg?: boolean }, change: readonly number[]) {
  if (m.egg) return;
  const delta = change[m.happiness < 100 ? 0 : m.happiness < 200 ? 1 : 2];
  m.happiness = Math.max(0, Math.min(255, m.happiness + delta));
}

async function medicine(game: CrystalGame, item: number, heal: number, cure: number, revive: boolean): Promise<ItemResult> {
  const slot = await pickMon(game, "Use on which POKéMON?");
  if (slot === undefined) return;
  const m = game.save.party[slot];
  if (m.egg) return "That can't be used on an EGG.";
  const max = m.stats[0];
  if (revive) {
    if (m.hp) return "It won't have any effect.";
    m.hp = is(item, "REVIVE") ? Math.floor(max / 2) : max;
    if (is(item, "REVIVAL_HERB")) changeHappiness(m, happinessChanges(game).revivalHerb);
    game.takeItem(item);
    return `${m.nickname || game.monName(m.species)} is revitalized!`;
  }
  if (!m.hp) return "It won't have any effect.";
  const healsHp = heal > 0 && m.hp < max, curesStatus = !!cure && !!(m.status & cure);
  if (!healsHp && !curesStatus) return "It won't have any effect.";
  if (healsHp) m.hp = Math.min(max, m.hp + heal);
  if (curesStatus || is(item, "FULL_RESTORE")) m.status = 0;
  game.takeItem(item);
  if (is(item, "ENERGYPOWDER", "HEAL_POWDER")) changeHappiness(m, happinessChanges(game).bitterPowder);
  if (is(item, "ENERGY_ROOT")) changeHappiness(m, happinessChanges(game).energyRoot);
  game.ctx.sound?.heal();
  return healsHp ? `${m.nickname || game.monName(m.species)}'s HP was restored.` : `${m.nickname || game.monName(m.species)} was cured.`;
}

async function ppItem(game: CrystalGame, item: number): Promise<ItemResult> {
  const slot = await pickMon(game, "Use on which POKéMON?");
  if (slot === undefined) return;
  const m = game.save.party[slot];
  const all = is(item, "ELIXER", "MAX_ELIXER");
  const moves = m.moves.map((mv, i) => ({ mv, i })).filter(x => x.mv);
  let targets = moves.map(x => x.i);
  if (!all) {
    const pick = await game.choose(moves.map(x => game.engine.move(x.mv).name.toUpperCase()), { cancel: true });
    if (pick === undefined) return;
    targets = [moves[pick].i];
  }
  let changed = false;
  for (const i of targets) {
    // ComputeMaxPP: each PP Up adds a fifth of the base PP, at most 7, so 40 PP tops out at 61.
    const base = game.engine.move(m.moves[i]).pp, ups = m.pp[i] >> 6, step = Math.min(7, Math.floor(base / 5)), full = base + step * ups;
    if (is(item, "PP_UP")) {
      if (ups >= 3 || base < 5) return "It won't have any effect.";
      m.pp[i] = ((ups + 1) << 6) | Math.min(63, (m.pp[i] & 63) + step);
      changed = true;
      continue;
    }
    const now = m.pp[i] & 63;
    if (now >= full) continue;
    // RestorePP: Ether and Elixer give 10, the MysteryBerry 5.
    const add = is(item, "MAX_ETHER", "MAX_ELIXER") ? full : is(item, "MYSTERYBERRY") ? 5 : 10;
    m.pp[i] = (ups << 6) | Math.min(full, now + add);
    changed = true;
  }
  if (!changed) return "It won't have any effect.";
  game.takeItem(item);
  return "PP was restored.";
}

async function rareCandy(game: CrystalGame, item: number): Promise<ItemResult> {
  const slot = await pickMon(game, "Use on which POKéMON?");
  if (slot === undefined) return;
  const m = game.save.party[slot];
  if (m.egg || m.level >= 100) return "It won't have any effect.";
  game.takeItem(item);
  const { gainLevel } = await import("./moves");
  return () => gainLevel(game, slot);
}

async function vitamin(game: CrystalGame, item: number): Promise<ItemResult> {
  const slot = await pickMon(game, "Use on which POKéMON?");
  if (slot === undefined) return;
  const m = game.save.party[slot];
  if (m.egg) return "It won't have any effect.";
  const stat = is(item, "HP_UP") ? 0 : is(item, "PROTEIN") ? 1 : is(item, "IRON") ? 2 : is(item, "CARBOS") ? 3 : 4;
  const exp = [...m.stat_exp];
  if (exp[stat] >= 25600) return "It won't have any effect.";
  exp[stat] = Math.min(65535, exp[stat] + 2560);
  const next = { ...m, stat_exp: exp };
  changeHappiness(next, happinessChanges(game).vitamin);
  next.stats = game.engine.statsFor(next);
  next.hp = m.hp + (next.stats[0] - m.stats[0]);
  game.save.party[slot] = next;
  game.takeItem(item);
  return `${m.nickname || game.monName(m.species)}'s stat rose.`;
}

function evolvesWith(game: CrystalGame, item: number) {
  return game.save.party.some(m => !m.egg && game.engine.evolutionData(m.species).evolutions.some(e => e.method === C("EVOLVE_ITEM") && e.parameter === item));
}
async function stone(game: CrystalGame, item: number): Promise<ItemResult> {
  const slot = await pickMon(game, "Use on which POKéMON?");
  if (slot === undefined) return;
  const { evolutionTarget, evolveTo } = await import("./battle");
  const target = evolutionTarget(game, game.save.party[slot], "item", item);
  // EvoStoneEffect: a held Everstone stops even a stone.
  if (!target || game.save.party[slot].egg || game.save.party[slot].item === CONST.EVERSTONE) return "It won't have any effect.";
  game.takeItem(item);
  return () => evolveTo(game, slot, target);
}

async function teachMachine(game: CrystalGame, item: number, moveName: string): Promise<ItemResult> {
  const move = MOVE[moveName] ?? MOVE[moveName.replace(/_M$/, "")];
  if (!move) return "It won't have any effect.";
  const slot = await pickMon(game, `Teach ${game.engine.move(move).name.toUpperCase()}?`);
  if (slot === undefined) return;
  const { teachMove } = await import("./moves");
  if (!(await teachMove(game, slot, move))) return;
  // TMs are used up and please the Pokémon a little; HMs last.
  if (!itemConst(item)?.startsWith("TM_")) return;
  changeHappiness(game.save.party[slot], happinessChanges(game).learnMove);
  game.takeItem(item);
}

/** BikeFunction: towns, routes, caves and gates, standing on land; Cycling Road keeps the player on it. */
async function toggleBike(game: CrystalGame) {
  const env = game.map.environment;
  const here = [C("TOWN"), C("ROUTE"), C("CAVE"), C("GATE")].includes(env) && game.world.isLand(game.world.collision(game.map, game.me.x, game.me.y));
  if (game.save.state === "surf" || !here) return game.say("OAK: {PLAYER}! This isn't the time to use that!");
  game.strings.set(RAM.wStringBuffer2, game.rom.itemName(ITEM.BICYCLE));
  const say = async (label: string, fallback: string) => {
    const at = TEXT[label];
    if (at !== undefined) { await game.engineText(at); game.closeText(); } else await game.say(fallback);
  };
  if (game.save.state === "bike") {
    if (game.hasFlag("ENGINE_ALWAYS_ON_BIKE")) return say("_CantGetOffBikeText", "You can't get off here!");
    game.setPlayerState(C("PLAYER_NORMAL"));
    return say("_GotOffBikeText", `${game.save.name} got off the BICYCLE.`);
  }
  game.setPlayerState(C("PLAYER_BIKE"));
  await say("_GotOnBikeText", `${game.save.name} got on the BICYCLE.`);
}

async function itemfinder(game: CrystalGame) {
  const near = game.map.bgs.some(b => b.kind === C("BGEVENT_ITEM") && !game.event(game.rom.u16(b.script)) && Math.abs(b.x - game.me.x) <= 4 && Math.abs(b.y - game.me.y) <= 4);
  game.sfx(near ? "SFX_SECOND_PART_OF_ITEMFINDER" : "SFX_TRANSACTION");
  await game.say(near ? "Yes! ITEMFINDER indicates there's an item nearby." : "Nope! ITEMFINDER isn't responding.");
}

/** Key items that do their work in front of something: their map scripts check for them. */
async function useKeyItemHere(game: CrystalGame, item: number) {
  if (is(item, "SQUIRTBOTTLE")) {
    const { x, y } = game.front();
    const tree = game.objects.find(o => o.visible && o.x === x && o.y === y && o.event.sprite === CONST.SPRITE_SUDOWOODO);
    if (tree) return game.talkTo(tree);
  }
  await game.say("OAK: This isn't the time to use that!");
}

/** SELECT uses the registered item. */
export async function useRegisteredItem(game: CrystalGame) {
  const item = game.save.vars.registered;
  if (!item || !game.itemCount(item)) return game.say("An item in the PACK can be registered to SELECT.");
  const result = await useItem(game, item);
  if (typeof result === "function") await result();
  else if (typeof result === "string") await game.say(result);
}
