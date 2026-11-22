/**
 * The assembly routines Crystal's scripts call: `special` (SpecialsPointers)
 * and `callasm`. Each is a port of the routine in the disassembly, or, for
 * link, mobile and Battle Tower features, a polite refusal.
 */
import { C, CONST, ITEM, MON, MOVE, RAM, SYM, TEXT, itemConst } from "./symbols";
import type { CrystalGame } from "./runtime";
import { UnsupportedScript, type Script } from "./script";
import { engineText } from "./services";
import type { CrystalMon } from "./save";

type Routine = (game: CrystalGame, script: Script) => void | Promise<void>;

const noop: Routine = () => {};
const setVar = (v: number): Routine => g => { g.scriptVar = v; };
const unavailable: Routine = async g => {
  g.scriptVar = 0;
  await g.say("That isn't available in this adventure.");
};

function firstFighter(g: CrystalGame) {
  return g.save.party.find(m => !m.egg);
}
function ownsAnywhere(g: CrystalGame, species: number) {
  return [...g.save.party, ...g.save.boxes.flat(), ...g.save.daycare.mons.filter(Boolean) as CrystalMon[]].some(m => !m.egg && m.species === species);
}
async function selectMon(g: CrystalGame, title = "Choose a POKéMON.") {
  const { choosePartyMon } = await import("./menu");
  return choosePartyMon(g, title);
}
function nickname(g: CrystalGame, m: CrystalMon) {
  return m.nickname || g.monName(m.species);
}

async function healParty(g: CrystalGame) {
  g.heal();
}
async function healMachineAnim(g: CrystalGame) {
  g.sfx("SFX_HEALING_MACHINE");
  g.ctx.sound?.heal();
  await g.delay(80);
}

/** Kurt: choose an Apricorn to turn into a Poké Ball. */
async function selectApricornForKurt(g: CrystalGame) {
  const apricorns = ["RED_APRICORN", "BLU_APRICORN", "YLW_APRICORN", "GRN_APRICORN", "WHT_APRICORN", "BLK_APRICORN", "PNK_APRICORN"]
    .map(n => ITEM[n]).filter(id => id !== undefined && g.itemCount(id) > 0);
  if (TEXT["Kurt_PrintTextWhichApricorn.WhichApricornText"] !== undefined) await g.writeText(TEXT["Kurt_PrintTextWhichApricorn.WhichApricornText"]);
  if (!apricorns.length) { g.scriptVar = 0; return; }
  const pick = await g.choose(apricorns.map(id => g.rom.itemName(id)), { cancel: true });
  if (pick === undefined) { g.scriptVar = 0; return; }
  const item = apricorns[pick];
  if (TEXT["Kurt_PrintTextHowMany.HowManyShouldIMakeText"] !== undefined) await g.writeText(TEXT["Kurt_PrintTextHowMany.HowManyShouldIMakeText"]);
  const { quantity } = await import("./services");
  const n = await quantity(g, g.rom.itemName(item), g.itemCount(item));
  if (!n) { g.scriptVar = 0; return; }
  g.takeItem(item, n);
  g.scriptVar = item;
  g.poke(RAM.wKurtApricornQuantity, n);
}

/** Mom's bank: save, withdraw, deposit or change whether she saves. */
async function bankOfMom(g: CrystalGame) {
  const saving = g.flag(C("ENGINE_MOM_SAVING_MONEY"));
  const { quantity } = await import("./services");
  const amount = async (max: number) => {
    const steps = [10, 100, 1000, 10000, 100000].filter(v => v <= max);
    if (!steps.length) return 0;
    const pick = await g.choose(steps.map(v => `¥${v}`), { cancel: true });
    if (pick === undefined) return 0;
    const n = await quantity(g, `¥${steps[pick]}`, Math.min(99, Math.floor(max / steps[pick])));
    return n * steps[pick];
  };
  if (!g.save.vars.momIntro) {
    g.save.vars.momIntro = 1;
    await engineText(g, "MomLeavingText1", "", true);
    if (TEXT.MomLeavingText2 !== undefined) await engineText(g, "MomLeavingText2");
  }
  for (;;) {
    await engineText(g, "MomBankWhatDoYouWantToDoText", "What do you want to do?", false);
    const pick = await g.choose(["GET", "SAVE", "CHANGE", "CANCEL"], { title: `Mom: ¥${g.save.momMoney}  You: ¥${g.save.money}`, cancel: true });
    if (pick === 0) {
      const n = await amount(g.save.momMoney);
      if (!n) continue;
      g.save.momMoney -= n;
      g.save.money = Math.min(999999, g.save.money + n);
    } else if (pick === 1) {
      const n = await amount(g.save.money);
      if (!n) continue;
      g.save.money -= n;
      g.save.momMoney = Math.min(999999, g.save.momMoney + n);
    } else if (pick === 2) {
      await engineText(g, saving ? "MomStartSavingMoneyText" : "MomIsThisAboutYourMoneyText", saving ? "Do you want to stop saving money?" : "Do you want to save some money?", false);
      if (await g.yesNo()) g.setFlag(C("ENGINE_MOM_SAVING_MONEY"), !g.flag(C("ENGINE_MOM_SAVING_MONEY")));
    } else break;
  }
  await engineText(g, "MomDeterminedText", "", false);
}

async function moveDeletion(g: CrystalGame) {
  await engineText(g, "MoveDeletion.DeleterIntroText", "Um… I'm the MOVE DELETER.", false);
  if (!(await g.yesNo())) return engineText(g, "MoveDeletion.DeleterNoComeAgainText", "Come again!");
  const slot = await selectMon(g, "Which POKéMON?");
  if (slot === undefined) return engineText(g, "MoveDeletion.DeleterNoComeAgainText", "Come again!");
  const mon = g.save.party[slot];
  if (mon.egg) return engineText(g, "MoveDeletion.DeleterEggText", "An EGG doesn't know any moves!");
  const known = mon.moves.filter(Boolean);
  if (known.length < 2) return engineText(g, "MoveDeletion.MoveKnowsOneText", "That POKéMON knows only one move.");
  const pick = await g.choose(known.map(m => g.engine.move(m).name.toUpperCase()), { cancel: true });
  if (pick === undefined) return engineText(g, "MoveDeletion.DeleterNoComeAgainText", "Come again!");
  g.strings.set(RAM.wStringBuffer1, g.engine.move(known[pick]).name.toUpperCase());
  await engineText(g, "MoveDeletion.AskDeleteMoveText", "Should that move be forgotten?", false);
  if (!(await g.yesNo())) return engineText(g, "MoveDeletion.DeleterNoComeAgainText", "Come again!");
  const i = mon.moves.indexOf(known[pick]);
  const moves = [...mon.moves.slice(0, i), ...mon.moves.slice(i + 1), 0];
  const pp = [...mon.pp.slice(0, i), ...mon.pp.slice(i + 1), 0];
  g.save.party[slot] = { ...mon, moves, pp };
  await engineText(g, "MoveDeletion.DeleterForgotMoveText", "It's forgotten the move.");
}

/** The Goldenrod move tutor: Flamethrower, Thunderbolt or Ice Beam for a Pokémon that can learn it. */
async function moveTutor(g: CrystalGame) {
  const moves = [MOVE.FLAMETHROWER, MOVE.THUNDERBOLT, MOVE.ICE_BEAM];
  const move = moves[g.scriptVar - 1];
  if (!move) { g.scriptVar = 1; return; }
  const slot = await selectMon(g, `Teach ${g.engine.move(move).name.toUpperCase()}?`);
  if (slot === undefined) { g.scriptVar = 1; return; }
  const { teachMove } = await import("./moves");
  g.scriptVar = (await teachMove(g, slot, move)) ? 0 : 1;
}

async function nameRater(g: CrystalGame) {
  await engineText(g, "NameRater.NameRaterHelloText", "Hello, hello! I'm the NAME RATER.", false);
  if (!(await g.yesNo())) return engineText(g, "NameRater.NameRaterComeAgainText", "OK, then. Come again sometime.");
  await engineText(g, "NameRater.NameRaterWhichMonText", "Which POKéMON's nickname should I rate for you?", false);
  const slot = await selectMon(g);
  if (slot === undefined) return engineText(g, "NameRater.NameRaterComeAgainText", "OK, then. Come again sometime.");
  const mon = g.save.party[slot];
  if (mon.egg) return engineText(g, "NameRater.NameRaterEggText", "Whoa… That's just an EGG.");
  if (mon.ot_id !== g.save.playerId || mon.ot_name !== g.save.name) return engineText(g, "NameRater.NameRaterPerfectNameText", "Hm… That's a fine name.");
  g.strings.set(RAM.wStringBuffer1, nickname(g, mon));
  await engineText(g, "NameRater.NameRaterBetterNameText", "Should I give it a better name?", false);
  if (!(await g.yesNo())) return engineText(g, "NameRater.NameRaterComeAgainText", "OK, then. Come again sometime.");
  const { rename } = await import("./menu");
  if (await rename(g, mon)) await engineText(g, "NameRater.NameRaterFinishedText", "That's a better name than before!");
}

async function nameRival(g: CrystalGame) {
  const { askName } = await import("./menu");
  const name = await askName(g, "Your rival's name?", g.save.rival || "SILVER");
  if (name) g.save.rival = name;
}

/** Lucky Number Show: the day's number against the player's Pokémon IDs. */
function luckyNumber(g: CrystalGame) {
  if (g.save.vars.luckyDay === undefined) {
    g.save.vars.luckyDay = 1;
    g.save.vars.luckyNumber = Math.floor(Math.random() * 65536);
  }
  return g.save.vars.luckyNumber;
}
async function checkForLuckyNumberWinners(g: CrystalGame) {
  const lucky = luckyNumber(g);
  let best = 0, where = "";
  const digits = (id: number) => {
    let n = 0;
    for (let i = 0, a = lucky, b = id; i < 5; i++, a = Math.floor(a / 10), b = Math.floor(b / 10)) {
      if (a % 10 !== b % 10) break;
      n++;
    }
    return n;
  };
  for (const [list, label] of [[g.save.party, "party"], [g.save.boxes.flat(), "pc"]] as const)
    for (const m of list) {
      if (m.egg || m.ot_id === undefined) continue;
      const d = digits(m.ot_id);
      if (d > best) { best = d; where = label; g.strings.set(RAM.wStringBuffer1, nickname(g, m)); }
    }
  g.scriptVar = best >= 5 ? 1 : best >= 3 ? 2 : best >= 2 ? 3 : 0;
  if (where && TEXT[`CheckForLuckyNumberWinners.LuckyNumberMatch${where === "party" ? "Party" : "PC"}Text`] !== undefined)
    await engineText(g, `CheckForLuckyNumberWinners.LuckyNumberMatch${where === "party" ? "Party" : "PC"}Text`);
}
function printTodaysLuckyNumber(g: CrystalGame) {
  g.strings.set(RAM.wStringBuffer3, String(luckyNumber(g)).padStart(5, "0"));
}

/** Buena's Password: the day's password from the radio, and her prizes. */
async function buenasPassword(g: CrystalGame) {
  const options = ["CYNDAQUIL", "TOTODILE", "CHIKORITA"];
  void options;
  g.scriptVar = g.peek(RAM.wBuenasPassword) >> 7 ? 1 : 0;
}
async function buenaPrize(g: CrystalGame) {
  const points = g.save.vars.blueCard ?? 0;
  const prizes: [string, number][] = [["ULTRA_BALL", 2], ["FULL_RESTORE", 2], ["NUGGET", 3], ["RARE_CANDY", 3], ["PROTEIN", 5], ["IRON", 5], ["CARBOS", 5], ["CALCIUM", 5], ["HP_UP", 5]];
  await engineText(g, "BuenaPrize.BuenaAskWhichPrizeText", "Which prize would you like?", false);
  const pick = await g.choose(prizes.map(([n, c]) => `${g.rom.itemName(ITEM[n])} ${c}`), { cancel: true, title: `Points: ${points}` });
  if (pick === undefined) return engineText(g, "BuenaPrize.BuenaComeAgainText", "Come again!");
  const [item, cost] = prizes[pick];
  if (points < cost) return engineText(g, "BuenaPrize.BuenaNotEnoughPointsText", "You don't have enough points.");
  if (!g.giveItem(ITEM[item])) return engineText(g, "BuenaPrize.BuenaNoRoomText", "You have no room for it.");
  g.save.vars.blueCard = points - cost;
  await engineText(g, "BuenaPrize.BuenaHereYouGoText", "Here you go!");
}

/** Odd Egg: a baby Pokémon, sometimes shiny. */
function giveOddEgg(g: CrystalGame) {
  const babies = ["PICHU", "CLEFFA", "IGGLYBUFF", "SMOOCHUM", "MAGBY", "ELEKID", "TYROGUE"].map(n => MON[n]);
  const species = babies[Math.floor(Math.random() * babies.length)];
  const mon = g.makeMon(species, 5);
  mon.egg = true;
  mon.eggCycles = 20;
  mon.nickname = "EGG";
  if (!g.addMon(mon)) g.scriptVar = 0;
}

function giveShuckle(g: CrystalGame) {
  if (g.save.party.length >= 6) { g.scriptVar = 0; return; }
  const mon = g.makeMon(MON.SHUCKLE, 15);
  Object.assign(mon, { item: ITEM.BERRY, nickname: "SHUCKIE", ot_name: "KIRK", ot_id: 518 });
  g.save.party.push(mon);
  g.register(MON.SHUCKLE, true);
  g.setEvent(C("EVENT_GOT_SHUCKIE"), true);
  g.scriptVar = 1;
}
async function returnShuckie(g: CrystalGame) {
  const slot = await selectMon(g);
  if (slot === undefined) { g.scriptVar = 2; return; }
  const m = g.save.party[slot];
  if (m.species !== MON.SHUCKLE || m.ot_id !== 518) { g.scriptVar = 0; return; }
  if (!g.save.party.some((x, i) => i !== slot && !x.egg && x.hp > 0)) { g.scriptVar = 3; return; }
  g.save.party.splice(slot, 1);
  g.scriptVar = m.happiness >= 150 ? 4 : 1;
}

async function haircut(g: CrystalGame, table: number[]) {
  const slot = await selectMon(g);
  if (slot === undefined) { g.scriptVar = 0; return; }
  const mon = g.save.party[slot];
  if (mon.egg) { g.scriptVar = 1; return; }
  g.strings.set(RAM.wStringBuffer3, nickname(g, mon));
  const roll = Math.random() * 100;
  let i = 0, acc = 0;
  for (; i < table.length - 1; i += 2) if (roll < (acc += table[i])) break;
  const boost = table[i + 1] ?? 1;
  mon.happiness = Math.min(255, mon.happiness + boost);
  g.scriptVar = i / 2 + 2;
}

/** Magikarp's length, from its DVs and ID, as the fishing guru measures it. */
function magikarpLength(m: CrystalMon) {
  const b = ((m.dvs[0] ^ (m.ot_id >> 8)) << 8 | (m.dvs[1] ^ (m.ot_id & 0xff))) >>> 0;
  const steps = [110, 310, 710, 2710, 7710, 17710, 32710, 47710, 57710, 62710, 64710, 65210, 65410, 65510, 65530, 65535];
  const mult = [1, 2, 4, 20, 50, 100, 150, 150, 100, 50, 20, 5, 2, 1, 1, 1];
  let i = 0;
  while (i < steps.length - 1 && b > steps[i]) i++;
  const base = 190 + (i ? (b - steps[i - 1]) / mult[i] : b);
  return Math.round(base);
}
async function checkMagikarpLength(g: CrystalGame) {
  const slot = await selectMon(g);
  if (slot === undefined) { g.scriptVar = C("MAGIKARPLENGTH_REFUSED") ?? 3; return; }
  const m = g.save.party[slot];
  if (m.species !== MON.MAGIKARP) { g.scriptVar = C("MAGIKARPLENGTH_NOT_MAGIKARP") ?? 1; return; }
  const mm = magikarpLength(m);
  const inches = Math.round(mm / 25.4);
  g.strings.set(RAM.wStringBuffer1, `${Math.floor(inches / 12)}′${inches % 12}″`);
  if (mm > (g.save.vars.magikarpRecord ?? 0)) {
    g.save.vars.magikarpRecord = mm;
    g.scriptVar = C("MAGIKARPLENGTH_BEAT_RECORD") ?? 2;
  } else g.scriptVar = C("MAGIKARPLENGTH_TOO_SHORT") ?? 0;
}
function magikarpHouseSign(g: CrystalGame) {
  const mm = g.save.vars.magikarpRecord ?? 0;
  const inches = Math.round(mm / 25.4);
  g.strings.set(RAM.wStringBuffer3, `${Math.floor(inches / 12)}′${inches % 12}″`);
}

function snorlaxAwake(g: CrystalGame) {
  g.scriptVar = g.save.vars.pokeFlute && Math.abs(g.me.x - 33) + Math.abs(g.me.y - 8) <= 3 ? 1 : g.save.vars.pokeFlute ? 1 : 0;
}

function omanyteChamber(g: CrystalGame) {
  if (g.ev("EVENT_WALL_OPENED_IN_OMANYTE_CHAMBER")) return;
  if (g.itemCount(ITEM.WATER_STONE) || g.save.party.some(m => m.item === ITEM.WATER_STONE)) {
    g.setEvent(C("EVENT_WALL_OPENED_IN_OMANYTE_CHAMBER"), true);
    g.scriptVar = 1;
  }
}
function hoOhChamber(g: CrystalGame) {
  if (g.save.party[0]?.species === MON.HO_OH && !g.save.party[0].egg) g.setEvent(C("EVENT_WALL_OPENED_IN_HO_OH_CHAMBER"), true);
}

function initRoamMons(g: CrystalGame) {
  const roam = [["RAIKOU", "ROUTE_42"], ["ENTEI", "ROUTE_37"]] as const;
  g.save.roamers = roam.map(([species, map]) => {
    const [group, number] = g.rom.mapByName(map) ? [g.rom.mapByName(map).group, g.rom.mapByName(map).number] : [0, 0];
    return { species: MON[species], level: 40, group, number };
  });
}

async function giveDratini(g: CrystalGame) {
  const slot = [...g.save.party.keys()].reverse().find(i => g.save.party[i].species === MON.DRATINI);
  if (slot === undefined) return;
  const mon = g.save.party[slot];
  const moves = g.scriptVar === 1 ? [MOVE.WRAP, MOVE.THUNDER_WAVE, MOVE.TWISTER, MOVE.EXTREMESPEED] : [MOVE.WRAP, MOVE.THUNDER_WAVE, MOVE.TWISTER, MOVE.SAFEGUARD];
  g.save.party[slot] = { ...mon, moves, pp: moves.map(m => g.engine.move(m).pp) };
}

async function playersHousePC(g: CrystalGame) {
  const { pokemonCenterPC } = await import("./services");
  await pokemonCenterPC(g, true);
  g.scriptVar = 0;
}

async function townMap(g: CrystalGame) {
  const { openPokegear } = await import("./pokegear");
  await g.modal(() => openPokegear(g, "map"));
}
async function mapRadio(g: CrystalGame) {
  const { openPokegear } = await import("./pokegear");
  await g.modal(() => openPokegear(g, "radio"));
}

async function slotMachine(g: CrystalGame) {
  const { slotMachine } = await import("./minigames");
  await g.modal(() => slotMachine(g));
}
async function cardFlip(g: CrystalGame) {
  const { cardFlip } = await import("./minigames");
  await g.modal(() => cardFlip(g));
}
async function unownPuzzle(g: CrystalGame) {
  const { unownPuzzle } = await import("./minigames");
  await g.modal(() => unownPuzzle(g));
}

async function bugContest(g: CrystalGame, name: string) {
  const contest = await import("./contest");
  const routine = (contest as unknown as Record<string, Routine>)[name];
  if (!routine) throw new UnsupportedScript(`No port of ${name}`);
  await routine(g, undefined as unknown as Script);
}

/** Legacy's move relearner: a level-up move the Pokémon has passed. */
async function moveReminder(g: CrystalGame, egg = false) {
  const { moveReminder } = await import("./moves");
  await moveReminder(g, egg);
}

async function showDexEntry(g: CrystalGame, species: number) {
  g.register(species, false);
  const { showDexEntry } = await import("./menu");
  await showDexEntry(g, species);
}

async function displayCoins(g: CrystalGame) {
  g.strings.set(RAM.wStringBuffer1, String(g.save.coins));
}

async function pokeSeer(g: CrystalGame) {
  const slot = await selectMon(g);
  if (slot === undefined) return;
  const m = g.save.party[slot];
  await g.say(m.ot_name === g.save.name ? `I see… You met ${nickname(g, m)} when it was level ${m.caught?.[0] || m.level}.` : `I see… ${nickname(g, m)} came to you from someone else.`);
}

async function diploma(g: CrystalGame) {
  await g.say(`GAME FREAK presents ${g.save.name} with this diploma for completing the POKéDEX. Congratulations!`);
}

async function celebiShrine(g: CrystalGame) {
  await g.delay(60);
}

async function trainerHouse(g: CrystalGame) {
  g.scriptVar = 0;
}

/**
 * Mom's clock question (InitialSetDSTFlag and InitialClearDSTFlag): the time
 * as PrintHoursMins writes it, then the cartridge's question. Astra follows
 * the device clock, so the answer changes nothing.
 */
async function askClock(g: CrystalGame, label: string) {
  const now = g.now(), h = now.getHours();
  const time = `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  const at = TEXT[label];
  await g.say(time + (at === undefined ? ", is that OK?" : g.textOf(at)), false);
}

const SPECIAL: Record<string, Routine> = {
  // the overworld and its screen
  WarpToSpawnPoint: g => { void g.blackoutWarp(); },
  ClearBGPalettesBufferScreen: noop, FadeOutToWhite: noop, FadeOutToBlack: noop, FadeInFromWhite: noop, FadeInFromBlack: noop,
  BattleTowerFade: noop, ReloadSpritesNoPalettes: noop, ClearBGPalettes: noop, UpdateTimePals: noop, ClearTilemap: noop,
  UpdateSprites: noop, UpdatePlayerSprite: noop, RefreshSprites: noop, LoadUsedSpritesGFX: noop, LoadMapPalettes: noop,
  SetPlayerPalette: noop, FadeOutPalettes: noop, FadeBlackQuickly: noop, FadeInPalettes: noop, FadeInQuickly: noop,
  InitialSetDSTFlag: g => askClock(g, "_DSTIsThatOKText"), InitialClearDSTFlag: g => askClock(g, "_TimeAskOkayText"),
  ToggleMaptileDecorations: noop, ToggleDecorationsVisibility: noop,
  UnownPrinter: noop, StubbedTrainerRankings_Healings: noop, UnusedDummySpecial: noop, UnusedFindItemInPCOrBag: noop,
  SetDayOfWeek: noop, AskRememberPassword: setVar(0), GameboyCheck: g => { g.scriptVar = C("GBCHECK_CGB"); },
  SurfStartStep: async g => { await g.walk(0, [g.me.facing]); },
  HealMachineAnim: healMachineAnim,
  // sound
  WaitSFX: async g => { await g.delay(20); }, PlayMapMusic: g => g.playMusic(undefined), RestartMapMusic: g => g.playMusic(undefined),
  FadeOutMusic: g => g.playMusic(0), PlaySlowCry: g => g.cry(g.scriptVar), PlayCurMonCry: g => g.cry(g.scriptVar),
  // services
  HealParty: healParty, PokemonCenterPC: async g => { const { pokemonCenterPC } = await import("./services"); await pokemonCenterPC(g); },
  PlayersHousePC: playersHousePC, BankOfMom: bankOfMom, MoveDeletion: moveDeletion, MoveTutor: moveTutor, NameRater: nameRater,
  NameRival: nameRival, OverworldTownMap: townMap, MapRadio: mapRadio, SelectApricornForKurt: selectApricornForKurt,
  DayCareMan: async g => { const d = await import("./daycare"); await d.dayCareMan(g); },
  DayCareLady: async g => { const d = await import("./daycare"); await d.dayCareLady(g); },
  DayCareManOutside: async g => { const d = await import("./daycare"); await d.dayCareManOutside(g); },
  DayCareMon1: async g => { const m = g.save.daycare.mons[0]; if (m) { g.cry(m.species); await g.say(`It's ${nickname(g, m)}.`); } },
  DayCareMon2: async g => { const m = g.save.daycare.mons[1]; if (m) { g.cry(m.species); await g.say(`It's ${nickname(g, m)}.`); } },
  OlderHaircutBrother: g => haircut(g, [30, 1, 50, 5, 20, 10]),
  YoungerHaircutBrother: g => haircut(g, [60, 1, 30, 5, 10, 10]),
  DaisysGrooming: g => haircut(g, [100, 3]),
  BillsGrandfather: async g => {
    const slot = await selectMon(g);
    if (slot === undefined) { g.scriptVar = 0; return; }
    const m = g.save.party[slot];
    g.scriptVar = m.egg ? 0 : m.species;
    g.strings.set(RAM.wStringBuffer3, g.monName(m.species));
  },
  PokeSeer: pokeSeer, Diploma: diploma, PrintDiploma: diploma, PhotoStudio: async g => { await g.say("Smile!"); },
  ProfOaksPCBoot: async g => { const { profOaksPCBoot } = await import("./services"); await profOaksPCBoot(g); },
  MagnetTrain: async g => { await g.delay(90); },
  CheckMagikarpLength: checkMagikarpLength, MagikarpHouseSign: magikarpHouseSign,
  CheckForLuckyNumberWinners: checkForLuckyNumberWinners,
  CheckLuckyNumberShowFlag: g => { g.scriptVar = g.save.vars.luckyShown ? 1 : 0; },
  ResetLuckyNumberShowFlag: g => { g.save.vars.luckyShown = 1; luckyNumber(g); },
  PrintTodaysLuckyNumber: printTodaysLuckyNumber,
  BuenasPassword: buenasPassword, BuenaPrize: buenaPrize, SampleKenjiBreakCountdown: g => { g.save.vars.kenji = 1 + Math.floor(Math.random() * 3); },
  DisplayCoinCaseBalance: displayCoins, DisplayMoneyAndCoinBalance: displayCoins, PlaceMoneyTopRight: noop,
  // checks on the party
  FindPartyMonAboveLevel: g => { const v = g.scriptVar; g.scriptVar = g.save.party.some(m => !m.egg && m.level >= v) ? 1 : 0; },
  FindPartyMonAtLeastThatHappy: g => { const v = g.scriptVar; g.scriptVar = g.save.party.some(m => !m.egg && m.happiness >= v) ? 1 : 0; },
  FindPartyMonThatSpecies: g => { const v = g.scriptVar; g.scriptVar = g.save.party.some(m => !m.egg && m.species === v) ? 1 : 0; },
  FindPartyMonThatSpeciesYourTrainerID: g => {
    const v = g.scriptVar;
    const m = g.save.party.find(m => !m.egg && m.species === v && m.ot_id === g.save.playerId && m.ot_name === g.save.name);
    g.scriptVar = m ? 1 : 0;
    if (m) g.strings.set(RAM.wStringBuffer3, nickname(g, m));
  },
  GetFirstPokemonHappiness: g => { const m = firstFighter(g); g.scriptVar = m?.happiness ?? 0; if (m) g.strings.set(RAM.wStringBuffer3, g.monName(m.species)); },
  CheckFirstMonIsEgg: g => { g.scriptVar = g.save.party[0]?.egg ? 1 : 0; },
  CheckPokerus: g => { g.scriptVar = g.save.party.some(m => m.pokerus) ? 1 : 0; },
  MonCheck: g => { g.scriptVar = ownsAnywhere(g, g.scriptVar) ? 1 : 0; },
  BeastsCheck: g => { g.scriptVar = ["RAIKOU", "ENTEI", "SUICUNE"].every(n => ownsAnywhere(g, MON[n])) ? 1 : 0; },
  CheckCaughtCelebi: g => { g.scriptVar = g.save.vars.caughtCelebi ? 1 : 0; },
  GameCornerPrizeMonCheckDex: async g => { await showDexEntry(g, g.scriptVar); },
  UnusedSetSeenMon: g => g.register(g.scriptVar, false),
  ShowPokedexEntry: async g => { await showDexEntry(g, g.scriptVar); },
  // gifts
  GiveShuckle: giveShuckle, ReturnShuckie: returnShuckie, GiveOddEgg: giveOddEgg, GiveDratini: giveDratini,
  // the world
  ActivateFishingSwarm: g => { g.save.vars.fishSwarm = g.scriptVar; },
  InitRoamMons: initRoamMons, SnorlaxAwake: snorlaxAwake, OmanyteChamber: omanyteChamber, HoOhChamber: hoOhChamber,
  DisplayUnownWords: async g => { await g.say("The walls are covered in UNOWN."); },
  CelebiShrineEvent: celebiShrine, TrainerHouse: trainerHouse,
  RandomUnseenWildMon: g => {
    const t = g.rom.grass(g.map.group, g.map.number);
    const mons = t?.slots[g.timeOfDay()].map(s => s.species).filter(s => !g.save.caught.includes(s)) ?? [];
    g.scriptVar = mons.length ? 0 : 1;
    if (mons.length) g.strings.set(RAM.wStringBuffer4, g.monName(mons[Math.floor(Math.random() * mons.length)]));
  },
  RandomPhoneWildMon: g => {
    const t = g.rom.grass(g.map.group, g.map.number);
    const s = t?.slots[g.timeOfDay()][Math.floor(Math.random() * 7)]?.species ?? MON.RATTATA;
    g.strings.set(RAM.wStringBuffer4, g.monName(s));
  },
  RandomPhoneMon: g => { g.strings.set(RAM.wStringBuffer4, g.monName(MON.RATTATA)); },
  // minigames
  SlotMachine: slotMachine, CardFlip: cardFlip, UnownPuzzle: unownPuzzle, UnusedMemoryGame: noop,
  // the Bug-Catching Contest
  BugContestJudging: g => bugContest(g, "bugContestJudging"),
  CheckPartyFullAfterContest: g => bugContest(g, "checkPartyFullAfterContest"),
  ContestDropOffMons: g => bugContest(g, "contestDropOffMons"),
  ContestReturnMons: g => bugContest(g, "contestReturnMons"),
  GiveParkBalls: g => bugContest(g, "giveParkBalls"),
  SelectRandomBugContestContestants: g => bugContest(g, "selectContestants"),
  // Crystal Legacy
  MoveReminder: g => moveReminder(g), EggMoveReminder: g => moveReminder(g, true),
  Mobile_DummyReturnFalse: setVar(0), Function11b444: setVar(0),
  // link cable, mobile and the Battle Tower
  Reset: async g => { g.persist(true); },
  TryQuickSave: async g => { await g.persist(true); g.scriptVar = 1; },
};
const LINK = ["SetBitsForLinkTradeRequest", "WaitForLinkedFriend", "CheckLinkTimeout_Receptionist", "CheckBothSelectedSameRoom", "FailedLinkToPast",
  "CloseLink", "WaitForOtherPlayerToExit", "SetBitsForBattleRequest", "SetBitsForTimeCapsuleRequest", "CheckTimeCapsuleCompatibility", "EnterTimeCapsule",
  "TradeCenter", "Colosseum", "TimeCapsule", "CableClubCheckWhichChris", "CheckMysteryGift", "GetMysteryGiftItem", "UnlockMysteryGift",
  "DisplayLinkRecord", "BattleTowerRoomMenu", "BattleTowerBattle", "BattleTowerAction", "LoadOpponentTrainerAndPokemonWithOTSprite",
  "CheckForBattleTowerRules", "UnusedBattleTowerDummySpecial1", "UnusedBattleTowerDummySpecial2", "Menu_ChallengeExplanationCancel",
  "BattleTowerMobileError", "AskMobileOrCable", "Mobile_SelectThreeMons", "CheckMobileAdapterStatusSpecial", "TradeCornerHoldMon",
  "UnusedCheckUnusedTwoDayTimer"];
for (const name of LINK) SPECIAL[name] ??= g => { g.scriptVar = 0; };
const QUIET = /^Function[0-9a-f]+$/;

export async function runSpecial(game: CrystalGame, name: string, script: Script) {
  const routine = SPECIAL[name] ?? (QUIET.test(name) ? setVar(0) : undefined);
  if (!routine) throw new UnsupportedScript(`No port of special ${name}`);
  await routine(game, script);
}

/** `callasm` routines in scripts the cartridge runs. */
const ASM_ROUTINES: Record<string, Routine> = {
  "FindItemInBallScript.TryReceiveItem": g => {
    const item = g.peek(RAM.wItemBallItemID), n = g.peek(RAM.wItemBallQuantity) || 1;
    g.strings.set(RAM.wStringBuffer3, g.rom.itemName(item));
    g.lastItem = item;
    g.scriptVar = g.giveItem(item, n) ? 1 : 0;
  },
  SetMemEvent: g => { g.setEvent(g.peek(RAM.wHiddenItemEvent) | (g.peek(RAM.wHiddenItemEvent + 1) << 8), true); },
  GiveItemScript_DummyFunction: noop,
  // Crystal Legacy's UseAnotherRepelScript uses the Repel in wRepelType.
  DoItemEffect: async g => {
    const { useRepel } = await import("./items");
    const item = g.peek(RAM.wRepelType);
    if (g.itemCount(item)) useRepel(g, item);
  },
  GetCurTreeFruit: g => {
    const tree = g.peek(RAM.wCurFruitTree);
    g.poke(RAM.wCurFruit, g.rom.u8(SYM.FruitTreeItems + tree - 1));
  },
  TryResetFruitTrees: g => { if (!g.save.vars.fruitTreesDay) g.save.vars.fruitTreesDay = 1; },
  CheckFruitTree: g => { const tree = g.peek(RAM.wCurFruitTree); g.scriptVar = (g.save.vars.fruitTrees ?? 0) & (2 ** tree) ? 1 : 0; },
  PickedFruitTree: g => { const tree = g.peek(RAM.wCurFruitTree); g.save.vars.fruitTrees = (g.save.vars.fruitTrees ?? 0) | 2 ** tree; },
  GetPartyNickname: g => {
    const m = g.save.party[g.save.vars.curPartyMon ?? 0];
    if (m) g.strings.set(RAM.wStringBuffer3, nickname(g, m));
  },
  HalveMoney: g => { g.save.money = Math.floor(g.save.money / 2); },
  // Strength and Rock Smash, from the standard scripts boulders and rocks run.
  TryStrengthOW: g => {
    const slot = g.save.party.findIndex(m => !m.egg && m.moves.includes(MOVE.STRENGTH));
    if (slot < 0 || !g.hasFlag("ENGINE_PLAINBADGE")) { g.scriptVar = 1; return; }
    g.save.vars.curPartyMon = slot;
    g.scriptVar = g.hasFlag("ENGINE_STRENGTH_ACTIVE") ? 2 : 0;
  },
  SetStrengthFlag: g => {
    g.setFlag(C("ENGINE_STRENGTH_ACTIVE"), true);
    const m = g.save.party[g.save.vars.curPartyMon ?? 0];
    if (m) {
      g.poke(RAM.wStrengthSpecies, m.species);
      for (const b of ["wStringBuffer1", "wStringBuffer2", "wStringBuffer3"]) g.strings.set(RAM[b], nickname(g, m));
    }
  },
  HasRockSmash: g => {
    const slot = g.save.party.findIndex(m => !m.egg && m.moves.includes(MOVE.ROCK_SMASH));
    if (slot >= 0) g.save.vars.curPartyMon = slot;
    g.scriptVar = slot >= 0 ? 0 : 1;
  },
  RockMonEncounter: g => wildFromTable(g, true),
  TreeMonEncounter: g => wildFromTable(g, false),
  "HiddenItemScript.append_tmhm_move_name": g => {
    const item = g.peek(RAM.wHiddenItemID), name = itemConst(item) ?? "";
    const move = /^(TM|HM)_/.test(name) ? MOVE[name.slice(3)] : undefined;
    if (move) g.strings.set(RAM.wStringBuffer3, `${g.rom.itemName(item)} ${g.engine.move(move).name.toUpperCase()}`);
  },
  EnableWildEncounters: g => { g.save.noWild = false; },
  HideSprites: noop, SkipUpdateMapSprites: noop, OverworldBGMap: noop, BattleBGMap: noop, LoadFishingGFX: noop,
};

/** Rock Smash and Headbutt Pokémon: wTempWildMonSpecies (0 for none) and wCurPartyLevel for `randomwildmon`. */
function wildFromTable(g: CrystalGame, rock: boolean) {
  g.poke(RAM.wTempWildMonSpecies, 0);
  const t = g.rom.treeMons(g.map.group, g.map.number, rock);
  if (!t?.common.length || (rock && Math.random() < 0.6)) return;
  let roll = Math.random() * 100;
  const pick = t.common.find(e => (roll -= e.chance) < 0) ?? t.common[0];
  g.poke(RAM.wTempWildMonSpecies, pick.species);
  g.poke(RAM.wCurPartyLevel, pick.level);
}

export async function runAsm(game: CrystalGame, name: string, script: Script) {
  const routine = ASM_ROUTINES[name] ?? SPECIAL[name];
  if (!routine) throw new UnsupportedScript(`No port of ${name}`);
  await routine(game, script);
}
/** Text that continues in assembly (`text_asm`). */
export async function runTextAsm(game: CrystalGame, at: number) {
  void at;
  void game;
}

export const SUPPORTED_SPECIALS = new Set(Object.keys(SPECIAL));
export const SUPPORTED_ASM = new Set([...Object.keys(ASM_ROUTINES), ...Object.keys(SPECIAL)]);
export function specialSupported(name: string) {
  return SUPPORTED_SPECIALS.has(name) || QUIET.test(name);
}
void CONST;
