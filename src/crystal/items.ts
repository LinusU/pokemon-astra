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

async function medicine(game: CrystalGame, item: number, heal: number, cure: number, revive: boolean): Promise<ItemResult> {
  const slot = await pickMon(game, "Use on which POKéMON?");
  if (slot === undefined) return;
  const m = game.save.party[slot];
  if (m.egg) return "That can't be used on an EGG.";
  const max = m.stats[0];
  if (revive) {
    if (m.hp) return "It won't have any effect.";
    m.hp = is(item, "REVIVE") ? Math.floor(max / 2) : max;
    game.takeItem(item);
    return `${m.nickname || game.monName(m.species)} is revitalized!`;
  }
  if (!m.hp) return "It won't have any effect.";
  const healsHp = heal > 0 && m.hp < max, curesStatus = !!cure && !!(m.status & cure);
  if (!healsHp && !curesStatus) return "It won't have any effect.";
  if (healsHp) m.hp = Math.min(max, m.hp + heal);
  if (curesStatus || is(item, "FULL_RESTORE")) m.status = 0;
  game.takeItem(item);
  if (is(item, "ENERGYPOWDER", "ENERGY_ROOT", "HEAL_POWDER", "REVIVAL_HERB")) m.happiness = Math.max(0, m.happiness - 5);
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
    const base = game.engine.move(m.moves[i]).pp, ups = m.pp[i] >> 6, full = base + Math.floor(base / 5) * ups;
    if (is(item, "PP_UP")) {
      if (ups >= 3 || base < 5) return "It won't have any effect.";
      m.pp[i] = ((ups + 1) << 6) | Math.min(63, (m.pp[i] & 63) + Math.floor(base / 5));
      changed = true;
      continue;
    }
    const now = m.pp[i] & 63;
    if (now >= full) continue;
    const add = is(item, "MAX_ETHER", "MAX_ELIXER") ? full : 10;
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
  const next = { ...m, stat_exp: exp, happiness: Math.min(255, m.happiness + 2) };
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
  // TMs are used up; HMs last.
  if (itemConst(item)?.startsWith("TM_")) game.takeItem(item);
}

async function toggleBike(game: CrystalGame) {
  const env = game.map.environment;
  if (game.save.state === "surf") return game.say("You can't get on your BIKE now.");
  if (game.save.state !== "bike" && (env === C("INDOOR") || env === C("GATE")) && !CONST.ENGINE_BIKE_INDOORS) return game.say("You can't ride a BIKE here.");
  game.save.state = game.save.state === "bike" ? "normal" : "bike";
  game.ctx.sound?.refreshMusic();
  await game.say(game.save.state === "bike" ? `${game.save.name} got on the BICYCLE.` : `${game.save.name} got off the BICYCLE.`);
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
