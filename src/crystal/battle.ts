/**
 * Battles in the Crystal adventures: trainers who spot the player, wild
 * encounters by time of day, scripted battles, and what a battle leaves
 * behind (party, bag, Pokédex, evolutions, blackouts).
 */
import type { BattleOptions, Pokemon } from "../engine";
import { autoPlay, BattleLaunch, finishedBattle, type FinishedBattle } from "../ui/battle-launch";
import { C, CONST, MON, STD, SYM, TEXT, constName } from "./symbols";
import type { CrystalGame, Obj } from "./runtime";
import { towards } from "./runtime";
import { runScript, type TrainerHeader } from "./script";
import { STEP, type Facing } from "./world";
import type { CrystalMon } from "./save";

/** A trainer battle from a map trainer: sighting, challenge, battle and the after-battle script. */
export async function trainerScript(game: CrystalGame, o: Obj, header: TrainerHeader, seen: boolean) {
  if (game.event(header.flag)) {
    await runScript(game, header.after, { trainer: header });
    return;
  }
  encounterMusic(game, header.klass);
  if (seen) {
    await game.showEmote(C("EMOTE_SHOCK"), o.slot, 30);
    await approach(game, o);
    game.me.facing = towards(game.me, o);
  }
  o.facing = towards(o, game.me);
  await game.writeText(header.seen);
  await game.waitButton();
  game.closeText();
  game.battleSetup = { kind: "trainer", klass: header.klass, id: header.id, winLoss: [header.win, header.loss] };
  const result = await startBattle(game);
  await afterBattle(game);
  if (result === C("LOSE")) return;
  game.setEvent(header.flag, true);
  await runScript(game, header.after, { trainer: header, justBattled: true });
}

function encounterMusic(game: CrystalGame, klass: number) {
  const music = game.rom.u8(SYM.TrainerEncounterMusic + klass);
  if (music) game.playMusic(music);
}

/** Walks a trainer up to the player. */
async function approach(game: CrystalGame, o: Obj) {
  const steps: Facing[] = [];
  let { x, y } = o;
  for (let guard = 0; guard < 12 && Math.abs(game.me.x - x) + Math.abs(game.me.y - y) > 1; guard++) {
    const dir: Facing = x !== game.me.x ? (game.me.x > x ? "right" : "left") : game.me.y > y ? "down" : "up";
    steps.push(dir);
    x += STEP[dir][0];
    y += STEP[dir][1];
  }
  await game.walk(o.slot, steps);
}

// ------------------------------------------------------------------ wild Pokémon

const GRASS_SLOTS = [30, 30, 20, 10, 5, 4, 1];
const WATER_SLOTS = [60, 30, 10];

function pickSlot<T>(slots: T[], weights: number[]) {
  let roll = Math.random() * 100;
  for (let i = 0; i < slots.length; i++) if ((roll -= weights[i]) < 0) return slots[i];
  return slots[slots.length - 1];
}

/** A step in grass, water or a cave may start a wild battle. */
export async function tryWildEncounter(game: CrystalGame) {
  if (game.save.noWild || !game.save.party.some(m => !m.egg && m.hp > 0)) return;
  const env = game.map.environment;
  const coll = game.world.collision(game.map, game.me.x, game.me.y);
  const cave = env === C("CAVE") || env === C("DUNGEON");
  if (cave ? game.world.isIce(coll) : !game.world.isGrass(coll)) return;
  if (game.save.contest && game.map.name.startsWith("NATIONAL_PARK")) return contestEncounter(game);
  const surfing = game.save.state === "surf" || game.world.isWater(coll);
  const swarm = game.save.swarm?.group === game.map.group && game.save.swarm.number === game.map.number;
  let pick: { species: number; level: number } | undefined;
  let rate = 0;
  if (surfing) {
    const table = game.rom.water(game.map.group, game.map.number, swarm);
    if (!table) return;
    rate = table.rate;
    pick = pickSlot(table.slots, WATER_SLOTS);
  } else {
    const table = game.rom.grass(game.map.group, game.map.number, swarm);
    if (!table) return;
    const time = game.timeOfDay();
    rate = table.rates[time];
    pick = pickSlot(table.slots[time], GRASS_SLOTS);
  }
  rate = encounterRateEffects(game, rate);
  if (!pick || Math.random() * 256 >= rate) return;
  // A roaming legendary on this route turns up one encounter in four, and flees.
  const roamer = game.save.roamers?.find(r => r.group === game.map.group && r.number === game.map.number);
  const roaming = !!roamer && Math.random() < 0.25;
  if (roaming) pick = { species: roamer!.species, level: roamer!.level };
  if (repelled(game, pick.level)) return;
  if (roaming) game.save.vars.battleType = C("BATTLETYPE_ROAMING");
  game.battleSetup = { kind: "wild", species: pick.species, level: pick.level };
  const result = await startBattle(game);
  // A roamer that was caught or knocked out stops roaming.
  if (roamer && pick.species === roamer.species && (result === C("WIN") || game.save.caught.includes(roamer.species) && game.ownsRoamer(roamer.species)))
    game.save.roamers = game.save.roamers!.filter(r => r !== roamer);
  await afterBattle(game);
}

/** ApplyMusicEffectOnEncounterRate and ApplyCleanseTagEffectOnEncounterRate. */
function encounterRateEffects(game: CrystalGame, rate: number) {
  const music = game.musicTrack();
  if (music === CONST.MUSIC_POKEMON_MARCH || music === CONST.MUSIC_RUINS_OF_ALPH_RADIO) rate = Math.min(255, rate * 2);
  else if (music === CONST.MUSIC_POKEMON_LULLABY) rate >>= 1;
  if (game.save.party.some(m => !m.egg && m.item === CONST.CLEANSE_TAG)) rate >>= 1;
  return rate;
}
/** CheckRepelEffect: a Repel keeps away Pokémon weaker than the first Pokémon that can fight. */
function repelled(game: CrystalGame, level: number) {
  const lead = game.save.party.find(m => !m.egg && m.hp > 0);
  return !!game.save.repel && !!lead && level < lead.level;
}

async function contestEncounter(game: CrystalGame) {
  const mons = game.rom.contestMons();
  let roll = Math.random() * 100;
  const pick = mons.find(m => (roll -= m.chance) < 0) ?? mons[0];
  // TryWildEncounter_BugContest: 40% in the park's tallest grass, 20% elsewhere.
  const tall = game.world.collision(game.map, game.me.x, game.me.y) === CONST.COLL_LONG_GRASS;
  if (Math.random() * 256 >= encounterRateEffects(game, Math.floor((tall ? 40 : 20) * 256 / 100))) return;
  const level = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
  if (repelled(game, level)) return;
  const { contestBattle } = await import("./contest");
  await contestBattle(game, pick.species, level);
}

// ------------------------------------------------------------------ battles

/** The bag pockets a battle uses. */
function battleBag(game: CrystalGame) {
  const balls: [number, number][] = [], items: [number, number][] = [];
  for (const [key, count] of Object.entries(game.save.items)) {
    const id = +key, pocket = game.rom.itemPocket(id);
    if (!count) continue;
    if (pocket === C("BALL")) balls.push([id, Math.min(count, 99)]);
    else if (pocket === C("ITEM")) items.push([id, Math.min(count, 99)]);
  }
  return { balls, items };
}

/** A Crystal trainer's party from the cartridge, for plain Crystal (Legacy's come from the engine's data). */
function crystalParty(game: CrystalGame, klass: number, id: number): Pokemon[] {
  const party = game.rom.trainerParty(klass, id);
  return party.mons.map(m => {
    let mon = game.engine.makePokemon(m.species, m.level);
    mon = { ...mon, item: m.item };
    if (m.moves) {
      const moves = m.moves.map(x => x || 0);
      mon = { ...mon, moves, pp: moves.map(x => x ? game.engine.move(x).pp : 0) };
    }
    return mon;
  });
}

/** Starts the battle `game.battleSetup` describes. Resolves with WIN, LOSE or DRAW. */
export async function startBattle(game: CrystalGame): Promise<number> {
  const setup = game.battleSetup;
  game.battleSetup = undefined;
  if (!setup) return C("DRAW");
  const fighters = game.save.party.filter(m => !m.egg);
  if (!fighters.some(m => m.hp > 0)) return C("LOSE");
  const battleType = game.save.vars.battleType ?? C("BATTLETYPE_NORMAL");
  delete game.save.vars.battleType;
  let opponent: BattleOptions["opponent"];
  let trainerName: string | undefined;
  if (setup.kind === "trainer") {
    trainerName = game.trainerName(setup.klass, setup.id);
    if (game.legacy) opponent = { trainer: { class: setup.klass, id: setup.id } };
    else {
      const party = crystalParty(game, setup.klass, setup.id);
      const last = party[party.length - 1]?.level ?? 1;
      opponent = { party, trainer: { class: setup.klass, id: setup.id }, prizeMoney: game.rom.trainerBaseMoney(setup.klass) * last };
    }
  } else {
    let species: number, level: number;
    if (setup.kind === "random") {
      const table = game.rom.grass(game.map.group, game.map.number);
      const pick = table ? pickSlot(table.slots[game.timeOfDay()], GRASS_SLOTS) : { species: MON.RATTATA, level: 2 };
      ({ species, level } = pick);
    } else ({ species, level } = setup);
    game.register(species, false);
    opponent = { species, level, stationary: battleType !== C("BATTLETYPE_ROAMING") };
  }
  const bag = battleBag(game);
  const badges = game.badges();
  const start: BattleOptions = {
    party: fighters, opponent, balls: bag.balls, items: bag.items, money: game.save.money,
    badges: badges.johto, seen: game.save.seen, caught: game.save.caught,
    player: { name: game.save.name, id: game.save.playerId, gender: game.save.gender, kantoBadges: badges.kanto },
    rivalName: game.save.rival, timeOfDay: game.timeOfDay(), unlockedUnowns: game.unlockedUnowns(),
    unownDex: game.save.unownDex, location: game.landmark(),
  };
  const canLose = battleType === C("BATTLETYPE_CANLOSE");
  const finished = await runBattle(game, start, trainerName, setup.kind === "trainer" ? setup.klass : undefined, battleType);
  if (!finished) return C("DRAW");
  const result = await applyResult(game, finished, bag, canLose, battleType);
  // A trainer's parting words.
  if (setup.kind === "trainer" && setup.winLoss) {
    const text = result === C("WIN") ? setup.winLoss[0] : canLose ? setup.winLoss[1] : 0;
    if (text) {
      await game.writeText(text);
      await game.waitButton();
      game.closeText();
    }
  }
  game.battleResult = result;
  if (result === C("LOSE") && !canLose) game.save.vars.whitedOut = 1;
  return result;
}

async function runBattle(game: CrystalGame, start: BattleOptions, trainerName: string | undefined, klass: number | undefined, battleType: number): Promise<FinishedBattle | undefined> {
  const { engine } = game;
  // Without a page (tests), the battle is played on the engine with the strongest moves.
  if (!game.ctx.layer || !game.ctx.sound || !game.ctx.sprite) {
    const battle = engine.startBattle(start);
    return finishedBattle(autoPlay(engine, battle));
  }
  const previous = game.mode;
  game.mode = "battle";
  game.inBattle = { trainer: !!trainerName, klass };
  game.battleCue = String(battleMusic(game, klass, battleType));
  game.ctx.sound.refreshMusic();
  try {
    const launch = new BattleLaunch({ engine, layer: game.ctx.layer, sound: game.ctx.sound, sprite: game.ctx.sprite, cry: game.ctx.cry ?? (() => {}) }, {
      start, trainerName, speed: game.save.settings.battleSpeed,
      itemName: id => engine.itemName(id),
      party: () => game.save.party.filter(m => !m.egg),
      music: cue => {
        game.battleCue = cue === "Capture" ? "capture" : klass !== undefined && isLeader(klass) ? "gymVictory" : trainerName ? "trainerVictory" : "wildVictory";
        game.ctx.sound?.refreshMusic();
      },
      auto: game.autoBattle,
    });
    game.battleLaunch = launch;
    return await launch.finished;
  } catch (error) {
    console.error(error);
    return undefined;
  } finally {
    game.battleLaunch = undefined;
    game.inBattle = undefined;
    game.battleCue = undefined;
    game.mode = previous === "battle" ? "script" : previous;
    game.ctx.layer.replaceChildren();
    game.ctx.sound.refreshMusic();
  }
}

const JOHTO_LEADERS = ["FALKNER", "WHITNEY", "BUGSY", "MORTY", "PRYCE", "JASMINE", "CHUCK", "CLAIR", "WILL", "BRUNO", "KAREN", "KOGA", "CHAMPION"];
const KANTO_LEADERS = ["BROCK", "MISTY", "LT_SURGE", "ERIKA", "JANINE", "SABRINA", "BLAINE", "BLUE"];
const classIs = (klass: number, names: string[]) => names.some(n => CONST[n] === klass);
function isLeader(klass: number) {
  return classIs(klass, JOHTO_LEADERS) || classIs(klass, KANTO_LEADERS);
}
/** PlayBattleMusic: the song for a battle, by battle type, trainer class and region. */
function battleMusic(game: CrystalGame, klass: number | undefined, type: number) {
  if (type === CONST.BATTLETYPE_SUICUNE || type === CONST.BATTLETYPE_ROAMING) return C("MUSIC_SUICUNE_BATTLE");
  const kanto = game.landmark() >= C("KANTO_LANDMARK");
  if (klass === undefined) return kanto ? C("MUSIC_KANTO_WILD_BATTLE") : game.timeOfDay() === 2 ? C("MUSIC_JOHTO_WILD_BATTLE_NIGHT") : C("MUSIC_JOHTO_WILD_BATTLE");
  if (classIs(klass, ["CHAMPION", "RED"])) return C("MUSIC_CHAMPION_BATTLE");
  if (classIs(klass, ["GRUNTM", "GRUNTF"])) return C("MUSIC_ROCKET_BATTLE");
  if (classIs(klass, KANTO_LEADERS)) return C("MUSIC_KANTO_GYM_LEADER_BATTLE");
  if (classIs(klass, JOHTO_LEADERS)) return C("MUSIC_JOHTO_GYM_LEADER_BATTLE");
  if (classIs(klass, ["RIVAL1", "RIVAL2"])) return C("MUSIC_RIVAL_BATTLE");
  return kanto ? C("MUSIC_KANTO_TRAINER_BATTLE") : C("MUSIC_JOHTO_TRAINER_BATTLE");
}

/** Writes a finished battle back into the save. */
async function applyResult(game: CrystalGame, battle: FinishedBattle, bag: ReturnType<typeof battleBag>, canLose: boolean, battleType: number) {
  const result = battle.result;
  // The party comes back in the order it went in; Eggs keep their places.
  const eggs = game.save.party.map((m, i) => (m.egg ? [i, m] as const : undefined)).filter(Boolean) as (readonly [number, CrystalMon])[];
  const party: CrystalMon[] = [...battle.party];
  for (const [i, egg] of eggs) party.splice(i, 0, egg);
  game.save.party = party.slice(0, 6);
  const stored = new Map<Pokemon, CrystalMon>();
  for (const mon of [...party.slice(6), ...battle.overflow]) {
    const copy = { ...mon, ot_name: mon.ot_name || game.save.name };
    stored.set(mon, copy);
    game.addMon(copy, { anyBox: true });
  }
  game.save.money = result.money;
  for (const [id] of [...bag.balls, ...bag.items]) {
    const left = [...result.bag.balls, ...result.bag.items].find(([x]) => x === id)?.[1] ?? 0;
    if (left) game.save.items[id] = left;
    else delete game.save.items[id];
  }
  game.save.seen = result.world.seen.filter(n => n >= 1 && n <= 251);
  game.save.caught = result.world.caught.filter(n => n >= 1 && n <= 251);
  if (battle.end === "caught") {
    const mon = result.party[result.caught!];
    if (mon && !mon.ot_name) mon.ot_name = game.save.name;
    // CheckCaughtCelebi reads BATTLERESULT_CAUGHT_CELEBI after the shrine's battle.
    if (mon?.species === MON.CELEBI) game.save.vars.caughtCelebi = 1;
    // A contest catch waits for the judging, which asks about a nickname.
    const contest = battleType === C("BATTLETYPE_CONTEST");
    if (mon && !contest) await game.offerNickname((stored.get(mon) ?? mon) as CrystalMon);
    if (mon && stored.has(mon)) await game.say(`${stored.get(mon)!.nickname || game.monName(mon.species)} was sent to BILL's PC.`);
  }
  if (battle.end === "loss") {
    if (canLose) game.heal();
    return C("LOSE");
  }
  await evolveAfterBattle(game, result.may_evolve);
  game.persist();
  return battle.end === "win" ? C("WIN") : C("DRAW");
}

/** After `startbattle`: a blackout sends the player to their last Pokémon Center. */
export async function afterBattle(game: CrystalGame) {
  // reloadmapafterbattle enters the map again.
  game.calmEncounters();
  if (game.save.vars.whitedOut) {
    delete game.save.vars.whitedOut;
    await blackout(game);
    return true;
  }
  game.playMusic(undefined);
  return false;
}

/** Script_Whiteout: healed, half the money gone, back at the last Pokémon Center, or the contest's end. */
export async function blackout(game: CrystalGame) {
  const text = TEXT._WhitedOutText;
  if (text !== undefined) await game.engineText(text);
  else await game.say("{PLAYER} is out of useable POKéMON!\f{PLAYER} whited out!");
  game.closeText();
  game.heal();
  // During the Bug-Catching Contest, the contest ends and the judging starts (BugContestResultsWarpScript).
  if (game.hasFlag("ENGINE_BUG_CONTEST_TIMER") && STD.includes("BugContestResultsWarpScript")) {
    await runScript(game, game.rom.far(game.rom.sym("StdScripts") + STD.indexOf("BugContestResultsWarpScript") * 3));
    return;
  }
  game.save.money = Math.floor(game.save.money / 2);
  await game.blackoutWarp();
}

/** The catching tutorial (Lyra/the Dude): a short demonstration instead of a battle. */
export async function catchTutorial(game: CrystalGame) {
  await game.say("The old man threw a POKé BALL! The wild RATTATA was caught!");
}

// ------------------------------------------------------------------ evolution

export async function evolveAfterBattle(game: CrystalGame, slots: number[]) {
  for (const slot of [...new Set(slots)]) {
    const mon = game.save.party[slot];
    if (!mon || mon.egg || !mon.hp) continue;
    const target = evolutionTarget(game, mon, "level");
    if (target) await evolveTo(game, slot, target);
  }
}

/** The species a Pokémon evolves into by level, happiness or stats now, or by `item`. */
export function evolutionTarget(game: CrystalGame, mon: Pokemon, how: "level" | "item" | "trade", item?: number) {
  const evolutions = game.engine.evolutionData(mon.species).evolutions;
  const time = game.timeOfDay();
  for (const e of evolutions) {
    if (mon.item === CONST.EVERSTONE && how !== "item") continue;
    if (how === "item") {
      if (e.method === C("EVOLVE_ITEM") && e.parameter === item) return e.species;
      continue;
    }
    if (how === "trade") {
      if (e.method === C("EVOLVE_TRADE") && (!e.parameter || e.parameter === 0xff || e.parameter === mon.item)) return e.species;
      continue;
    }
    if (e.method === C("EVOLVE_LEVEL") && mon.level >= e.parameter) return e.species;
    if (e.method === C("EVOLVE_HAPPINESS") && mon.happiness >= 220) {
      if (e.parameter === C("TR_ANYTIME") || (e.parameter === C("TR_MORNDAY") && time < 2) || (e.parameter === C("TR_NITE") && time === 2)) return e.species;
    }
    if (e.method === C("EVOLVE_STAT") && mon.level >= e.parameter) {
      const [, atk, def] = mon.stats;
      const want = e.condition;
      if ((want === C("ATK_GT_DEF") && atk > def) || (want === C("ATK_LT_DEF") && atk < def) || (want === C("ATK_EQ_DEF") && atk === def)) return e.species;
    }
  }
  return undefined;
}

export async function evolveTo(game: CrystalGame, slot: number, species: number) {
  const current = game.save.party[slot];
  const evolved = game.engine.evolvePokemon(current, species);
  if (!game.ctx.layer || !game.ctx.sprite) {
    game.save.party[slot] = evolved;
    game.register(species, true);
    return;
  }
  const { playEvolution } = await import("../ui/evolution");
  const name = current.nickname || game.engine.species(current.species).name;
  game.ctx.cry?.(current.species);
  await game.modal(() => new Promise<void>(resolve => {
    void playEvolution(game.layer, {
      from: game.ctx.sprite!(current),
      to: game.ctx.sprite!({ species, dvs: current.dvs }),
      name,
      evolvedName: game.engine.species(species).name,
      reveal: () => {
        game.save.party[slot] = evolved;
        game.register(species, true);
        game.ctx.cry?.(species);
      },
      ready: () => game.ctx.sound?.overworld("evolved"),
      next: async () => {
        game.layer.replaceChildren();
        const { learnLevelMoves } = await import("./moves");
        await learnLevelMoves(game, slot);
        resolve();
      },
    });
  }));
  game.persist();
}
