/**
 * Crystal's script engine, run over the cartridge's own script bytecode
 * (engine/overworld/scripting.asm in the disassembly). Every map script,
 * standard script and phone script is read from the player's cartridge; the
 * commands below are ports of the original's, and the assembly routines that
 * scripts call (`special` and `callasm`) are ported in specials.ts.
 */
import { C, MON, RAM, SCRIPT_COMMANDS, SPECIALS, STD, asmName } from "./symbols";
import type { CrystalGame } from "./runtime";
import { runAsm, runSpecial } from "./specials";
import { FACINGS } from "./world";

/** Thrown when a script reaches something Astra has no port of. */
export class UnsupportedScript extends Error {}

/** Ends the whole script, as `endall` and map changes that end it do. */
const END_ALL = "endall" as const;
type Step = void | typeof END_ALL;

export class Script {
  pos: number;
  stack: number[] = [];
  /** Set by `endifjustbattled` checks after a trainer battle. */
  justBattled = false;
  /** The trainer header a trainer script runs with, for `trainertext` and `scripttalkafter`. */
  trainer?: TrainerHeader;
  /** Win and loss texts for the next battle. */
  winLoss?: [number, number];
  constructor(readonly game: CrystalGame, start: number, readonly callback = false) {
    this.pos = start;
  }
  get rom() { return this.game.rom; }
  get bank() { return this.rom.bankOf(this.pos); }
  byte() { return this.rom.u8(this.pos++); }
  word() { const v = this.rom.u16(this.pos); this.pos += 2; return v; }
  /** A `dw` pointer into the script's bank. */
  pointer() { const bank = this.bank; return this.rom.at(bank, this.word()); }
  /** A `dba` pointer. */
  far() { const bank = this.byte(); return this.rom.at(bank, this.word()); }
}

export interface TrainerHeader {
  at: number;
  flag: number;
  klass: number;
  id: number;
  seen: number;
  win: number;
  loss: number;
  after: number;
}
export function readTrainerHeader(game: CrystalGame, at: number): TrainerHeader {
  const r = game.rom, bank = r.bankOf(at);
  const p = (o: number) => r.at(bank, r.u16(at + o));
  return { at, flag: r.u16(at), klass: r.u8(at + 2), id: r.u8(at + 3), seen: p(4), win: p(6), loss: p(8), after: p(10) };
}

/** Runs a script to its end. */
export async function runScript(game: CrystalGame, start: number, options: { callback?: boolean; trainer?: TrainerHeader; justBattled?: boolean } = {}) {
  const s = new Script(game, start, options.callback);
  s.trainer = options.trainer;
  s.justBattled = !!options.justBattled;
  await execute(s);
}

async function execute(s: Script) {
  for (let guard = 0; guard < 100000; guard++) {
    const at = s.pos;
    const op = s.byte();
    const name = SCRIPT_COMMANDS[op];
    const command = name && COMMANDS[ALIASES[name] ?? name];
    if (!command) throw new UnsupportedScript(`Unknown script command ${name ?? op.toString(16)} at ${at.toString(16)}`);
    const step = await command(s, s.game);
    if (step === END_ALL) return;
    if (s.game.stopped) return;
  }
  throw new UnsupportedScript("A script ran too long");
}

/** Returns from a subroutine, or ends the script. */
function end(s: Script): Step {
  const back = s.stack.pop();
  if (back === undefined) return END_ALL;
  s.pos = back;
}
function call(s: Script, target: number) {
  if (s.stack.length >= 16) throw new UnsupportedScript("Script stack overflow");
  s.stack.push(s.pos);
  s.pos = target;
}
function std(s: Script) {
  const index = s.word();
  const name = STD[index];
  const table = s.game.rom.sym("StdScripts") + index * 3;
  return { name, at: s.game.rom.far(table) };
}

/** Standard scripts Astra runs its own way. Resolves whether `name` was one. */
async function nativeStd(g: CrystalGame, name: string | undefined) {
  if (name !== "PokecenterNurseScript") return false;
  const { pokecenterNurse } = await import("./services");
  await pokecenterNurse(g);
  return true;
}

/** A script object number as a map object slot: 0 is the player. */
function object(s: Script, n: number) {
  if (n === 0) return 0;
  if (n === 0xfe) return s.game.lastTalked;
  return n - 1;
}

const ALIASES: Record<string, string> = { refreshscreen: "reanchormap", reloadmappart: "refreshmap", priorityjump: "sdefer", prioritysjump: "sdefer" };

type Command = (s: Script, g: CrystalGame) => Step | Promise<Step>;
const COMMANDS: Record<string, Command> = {
  // ---------------------------------------------------------------- flow
  scall: s => call(s, s.pointer()),
  farscall: s => call(s, s.far()),
  memcall: (s, g) => call(s, g.ramPointer(s.word())),
  sjump: s => { s.pos = s.pointer(); },
  farsjump: s => { s.pos = s.far(); },
  memjump: (s, g) => { s.pos = g.ramPointer(s.word()); },
  ifequal: (s, g) => { const v = s.byte(), to = s.pointer(); if (g.scriptVar === v) s.pos = to; },
  ifnotequal: (s, g) => { const v = s.byte(), to = s.pointer(); if (g.scriptVar !== v) s.pos = to; },
  iffalse: (s, g) => { const to = s.pointer(); if (!g.scriptVar) s.pos = to; },
  iftrue: (s, g) => { const to = s.pointer(); if (g.scriptVar) s.pos = to; },
  ifgreater: (s, g) => { const v = s.byte(), to = s.pointer(); if (g.scriptVar > v) s.pos = to; },
  ifless: (s, g) => { const v = s.byte(), to = s.pointer(); if (g.scriptVar < v) s.pos = to; },
  jumpstd: async (s, g) => {
    const { name, at } = std(s);
    if (await nativeStd(g, name)) return end(s);
    s.pos = at;
  },
  callstd: async (s, g) => {
    const { name, at } = std(s);
    if (!(await nativeStd(g, name))) call(s, at);
  },
  callasm: async (s, g) => {
    const at = s.far();
    const name = asmName(at);
    if (!name) throw new UnsupportedScript(`callasm to an unknown routine at ${at.toString(16)}`);
    await runAsm(g, name, s);
  },
  special: async (s, g) => {
    const index = s.word();
    const name = SPECIALS[index];
    if (!name) throw new UnsupportedScript(`Unknown special ${index}`);
    await runSpecial(g, name, s);
  },
  memcallasm: async (s, g) => {
    const at = g.ramPointer(s.word());
    const name = asmName(at);
    if (!name) throw new UnsupportedScript(`memcallasm to an unknown routine at ${at.toString(16)}`);
    await runAsm(g, name, s);
  },
  sdefer: (s, g) => { g.defer(s.pointer()); },
  stopandsjump: s => { s.pos = s.pointer(); },
  end: s => end(s),
  endcallback: s => end(s),
  endall: () => END_ALL,
  reloadend: async (s, g) => { s.byte(); await g.reloadMap(); return END_ALL; },

  // ---------------------------------------------------------------- scenes and variables
  checkmapscene: (s, g) => { const group = s.byte(), number = s.byte(); g.scriptVar = g.sceneOf(group, number); },
  setmapscene: (s, g) => { const group = s.byte(), number = s.byte(); g.setScene(group, number, s.byte()); },
  checkscene: (_, g) => { g.scriptVar = g.sceneOf(g.map.group, g.map.number); },
  setscene: (s, g) => { g.setScene(g.map.group, g.map.number, s.byte()); },
  setval: (s, g) => { g.scriptVar = s.byte(); },
  addval: (s, g) => { g.scriptVar = (g.scriptVar + s.byte()) & 0xff; },
  random: (s, g) => { const n = s.byte(); g.scriptVar = n ? Math.floor(Math.random() * n) : Math.floor(Math.random() * 256); },
  checkver: (_, g) => { g.scriptVar = C("GS_VERSION"); },
  readmem: (s, g) => { g.scriptVar = g.peek(s.word()); },
  writemem: (s, g) => { g.poke(s.word(), g.scriptVar); },
  loadmem: (s, g) => { const addr = s.word(); g.poke(addr, s.byte()); },
  readvar: (s, g) => { g.scriptVar = g.readVar(s.byte()); },
  writevar: (s, g) => { g.writeVar(s.byte(), g.scriptVar); },
  loadvar: (s, g) => { const v = s.byte(); g.writeVar(v, s.byte()); },
  checkevent: (s, g) => { g.scriptVar = g.event(s.word()) ? 1 : 0; },
  setevent: (s, g) => { g.setEvent(s.word(), true); },
  clearevent: (s, g) => { g.setEvent(s.word(), false); },
  checkflag: (s, g) => { g.scriptVar = g.flag(s.word()) ? 1 : 0; },
  setflag: (s, g) => { g.setFlag(s.word(), true); },
  clearflag: (s, g) => { g.setFlag(s.word(), false); },
  wildon: (_, g) => { g.save.noWild = false; },
  wildoff: (_, g) => { g.save.noWild = true; },
  xycompare: s => { s.word(); },
  checktime: (s, g) => { g.scriptVar = s.byte() & g.timeOfDayFlag() ? 1 : 0; },
  checkpoke: (s, g) => { const species = s.byte(); g.scriptVar = g.save.party.some(m => m.species === species && !g.isEgg(m)) ? 1 : 0; },
  checksave: (_, g) => { g.scriptVar = 1; },
  writeunusedbyte: s => { s.byte(); },

  // ---------------------------------------------------------------- items, money, Pokémon
  giveitem: (s, g) => { const item = g.itemArg(s.byte()), n = s.byte(); g.lastItem = item; g.scriptVar = g.giveItem(item, n) ? 1 : 0; },
  takeitem: (s, g) => { const item = s.byte(), n = s.byte(); g.scriptVar = g.takeItem(item, n) ? 1 : 0; },
  checkitem: (s, g) => { g.scriptVar = g.itemCount(s.byte()) > 0 ? 1 : 0; },
  verbosegiveitem: async (s, g) => {
    const item = g.itemArg(s.byte()), n = s.byte();
    g.scriptVar = g.giveItem(item, n) ? 1 : 0;
    await g.receivedItem(item, n, !!g.scriptVar);
  },
  verbosegiveitemvar: async (s, g) => {
    const item = g.itemArg(s.byte()), n = g.readVar(s.byte());
    g.scriptVar = g.giveItem(item, n) ? 1 : 0;
    await g.receivedItem(item, n, !!g.scriptVar);
  },
  itemnotify: async (_, g) => g.itemNotify(),
  pocketisfull: async (_, g) => g.pocketIsFull(),
  givemoney: (s, g) => { const account = s.byte(), n = bigdt(s); g.addMoney(account, n); },
  takemoney: (s, g) => { const account = s.byte(), n = bigdt(s); g.addMoney(account, -n); },
  checkmoney: (s, g) => { const account = s.byte(), n = bigdt(s); g.scriptVar = compare(g.money(account), n); },
  givecoins: (s, g) => { g.save.coins = Math.min(9999, g.save.coins + s.word()); },
  takecoins: (s, g) => { g.save.coins = Math.max(0, g.save.coins - s.word()); },
  checkcoins: (s, g) => { g.scriptVar = compare(g.save.coins, s.word()); },
  givepoke: async (s, g) => {
    const species = s.byte(), level = s.byte(), item = s.byte(), trainer = s.byte();
    let ot: { name: number; nickname: number } | undefined;
    if (trainer) ot = { nickname: s.pointer(), name: s.pointer() };
    g.scriptVar = await g.givePoke(species, level, item, ot) ? 1 : 0;
  },
  giveegg: async (s, g) => { const species = s.byte(), level = s.byte(); g.scriptVar = g.giveEgg(species, level) ? 2 : 0; },
  givepokemail: async (s, g) => { await g.givePokeMail(s.pointer()); },
  checkpokemail: async (s, g) => { g.scriptVar = g.checkPokeMail(s.pointer()); },

  // ---------------------------------------------------------------- names
  getmonname: (s, g) => { const species = s.byte() || g.scriptVar; g.setBuffer(s.byte(), g.monName(species)); },
  getitemname: (s, g) => { const item = s.byte() || g.scriptVar; g.setBuffer(s.byte(), g.rom.itemName(item)); },
  getcurlandmarkname: (s, g) => { g.setBuffer(s.byte(), g.rom.landmarkName(g.landmark())); },
  getlandmarkname: (s, g) => { const landmark = s.byte(); g.setBuffer(s.byte(), g.rom.landmarkName(landmark)); },
  gettrainername: (s, g) => { const klass = s.byte(), id = s.byte(); g.setBuffer(s.byte(), g.trainerName(klass, id)); },
  gettrainerclassname: (s, g) => { const klass = s.byte(); g.setBuffer(s.byte(), g.rom.trainerClassName(klass)); },
  getname: (s, g) => { const type = s.byte(), index = s.byte(); g.setBuffer(s.byte(), g.nameOf(type, index)); },
  getstring: (s, g) => { const at = s.pointer(); g.setBuffer(s.byte(), g.rom.string(at, 20)); },
  getmoney: (s, g) => { const account = s.byte(); g.setBuffer(s.byte(), String(g.money(account))); },
  getcoins: (s, g) => { g.setBuffer(s.byte(), String(g.save.coins)); },
  getnum: (s, g) => { g.setBuffer(s.byte(), String(g.scriptVar)); },

  // ---------------------------------------------------------------- text and menus
  opentext: (_, g) => { g.textOpen = true; },
  closetext: (_, g) => { g.closeText(); },
  writetext: async (s, g) => { g.lastText = s.pointer(); await g.writeText(g.lastText); },
  farwritetext: async (s, g) => { g.lastText = s.far(); await g.writeText(g.lastText); },
  repeattext: async (s, g) => { const a = s.byte(), b = s.byte(); if (a === 0xff && b === 0xff && g.lastText) await g.writeText(g.lastText); },
  jumptext: async (s, g) => { await jumpText(g, s.pointer()); return end(s); },
  farjumptext: async (s, g) => { await jumpText(g, s.far()); return end(s); },
  jumptextfaceplayer: async (s, g) => { g.facePlayer(); await jumpText(g, s.pointer()); return end(s); },
  waitbutton: async (_, g) => g.waitButton(),
  promptbutton: async (_, g) => g.waitButton(),
  yesorno: async (_, g) => { g.scriptVar = await g.yesNo() ? 1 : 0; },
  loadmenu: (s, g) => { g.menuHeader = s.pointer(); },
  closewindow: (_, g) => { g.menuHeader = undefined; },
  verticalmenu: async (_, g) => { g.scriptVar = await g.scriptMenu(false); },
  _2dmenu: async (_, g) => { g.scriptVar = await g.scriptMenu(true); },
  pokepic: async (s, g) => { await g.pokepic(s.byte() || g.scriptVar); },
  closepokepic: (_, g) => g.closePokepic(),
  battletowertext: async (s, g) => { s.byte(); await g.say("…"); },
  describedecoration: async (s, g) => { await g.describeDecoration(s.byte()); return end(s); },

  // ---------------------------------------------------------------- objects and movement
  setlasttalked: (s, g) => { g.lastTalked = object(s, s.byte()); },
  applymovement: async (s, g) => { const who = object(s, s.byte()); await g.applyMovement(who, s.pointer()); },
  applymovementlasttalked: async (s, g) => { await g.applyMovement(g.lastTalked, s.pointer()); },
  faceplayer: (_, g) => { g.facePlayer(); },
  faceobject: (s, g) => { const a = object(s, s.byte()), b = object(s, s.byte()); g.faceObject(a, b); },
  turnobject: (s, g) => { const who = object(s, s.byte()); g.turn(who, FACINGS[s.byte() & 3]); },
  variablesprite: (s, g) => { const index = s.byte(); g.setVariableSprite(index, s.byte()); },
  appear: (s, g) => { g.appear(object(s, s.byte()), true); },
  disappear: (s, g) => { g.appear(object(s, s.byte()), false); },
  follow: (s, g) => { const leader = object(s, s.byte()), follower = object(s, s.byte()); g.follow(leader, follower); },
  follownotexact: (s, g) => { const leader = object(s, s.byte()), follower = object(s, s.byte()); g.follow(leader, follower); },
  stopfollow: (_, g) => { g.stopFollow(); },
  moveobject: (s, g) => { const who = object(s, s.byte()), x = s.byte(), y = s.byte(); g.moveObject(who, x, y); },
  writeobjectxy: (s, g) => { g.writeObjectXY(object(s, s.byte())); },
  loademote: s => { s.byte(); },
  showemote: async (s, g) => { const emote = s.byte(), who = object(s, s.byte()), frames = s.byte(); await g.showEmote(emote, who, frames); },
  earthquake: async (s, g) => { await g.earthquake(s.byte()); },

  // ---------------------------------------------------------------- the map
  warp: async (s, g) => { const group = s.byte(), number = s.byte(), x = s.byte(), y = s.byte(); await g.warpTo(group, number, x, y); },
  warpfacing: async (s, g) => { const facing = FACINGS[s.byte() & 3], group = s.byte(), number = s.byte(), x = s.byte(), y = s.byte(); await g.warpTo(group, number, x, y, facing); },
  warpmod: (s, g) => { const warp = s.byte(), group = s.byte(), number = s.byte(); g.save.backupWarp = { warp, group, number }; },
  blackoutmod: (s, g) => { const group = s.byte(), number = s.byte(); g.save.spawn = { group, number }; },
  warpsound: (_, g) => { g.sfx("SFX_EXIT_BUILDING"); },
  warpcheck: async (_, g) => { await g.warpCheck(); },
  changeblock: (s, g) => { const x = s.byte(), y = s.byte(); g.changeBlock(x, y, s.byte()); },
  changemapblocks: (s, g) => { g.changeMapBlocks(s.far()); },
  reloadmap: async (_, g) => { await g.reloadMap(); },
  refreshmap: (_, g) => { g.redraw(); },
  reanchormap: (s, g) => { s.byte(); g.redraw(); },
  newloadmap: async (s, g) => { s.byte(); await g.reloadMap(); },
  writecmdqueue: (s, g) => { g.writeCmdQueue(s.pointer()); },
  delcmdqueue: (s, g) => { g.scriptVar = g.delCmdQueue(s.byte()) ? 1 : 0; },
  autoinput: s => { s.far(); },
  deactivatefacing: async (s, g) => { await g.delay(s.byte() || 1); },
  pause: async (s, g) => { await g.delay((s.byte() || 1) * 2); },
  wait: async (s, g) => { await g.delay(s.byte() * 6); },

  // ---------------------------------------------------------------- sound
  playmusic: (s, g) => { g.playMusic(s.word()); },
  encountermusic: (_, g) => { g.encounterMusic(); },
  // The song fades out and the given one starts (MUSIC_NONE: silence).
  musicfadeout: (s, g) => { const music = s.word(); s.byte(); g.playMusic(music); },
  playmapmusic: (_, g) => { g.playMusic(undefined); },
  dontrestartmapmusic: (_, g) => { g.keepMusic = true; },
  cry: (s, g) => { const species = s.word() & 0xff; g.cry(species || g.scriptVar); },
  playsound: (s, g) => { g.sfxId(s.word()); },
  waitsfx: async (_, g) => { await g.delay(20); },
  specialsound: (_, g) => { g.sfx(g.lastItem && g.rom.itemPocket(g.lastItem) === C("TM_HM") ? "SFX_GET_TM" : "SFX_ITEM"); },

  // ---------------------------------------------------------------- battles
  loadpikachudata: (_, g) => { g.battleSetup = { kind: "wild", species: MON.PIKACHU, level: 5 }; },
  loadwildmon: (s, g) => { const species = s.byte(), level = s.byte(); g.battleSetup = { kind: "wild", species, level }; },
  // A species a routine picked (Rock Smash, Headbutt), or one from the map's grass.
  randomwildmon: (_, g) => {
    const species = g.peek(RAM.wTempWildMonSpecies);
    g.battleSetup = species ? { kind: "wild", species, level: g.peek(RAM.wCurPartyLevel) || 5 } : { kind: "random" };
    g.poke(RAM.wTempWildMonSpecies, 0);
  },
  loadtrainer: (s, g) => { const klass = s.byte(), id = s.byte(); g.battleSetup = { kind: "trainer", klass, id, winLoss: s.winLoss }; },
  loadtemptrainer: (s, g) => {
    if (!s.trainer) throw new UnsupportedScript("loadtemptrainer without a trainer");
    g.battleSetup = { kind: "trainer", klass: s.trainer.klass, id: s.trainer.id, winLoss: [s.trainer.win, s.trainer.loss] };
  },
  winlosstext: s => { s.winLoss = [s.pointer(), s.pointer()]; },
  startbattle: async (_, g) => { g.scriptVar = await g.startBattle(); },
  // A loss that whites out jumps to Script_BattleWhiteout: the rest of the script never runs.
  reloadmapafterbattle: async (_, g) => (await g.afterBattle() ? END_ALL : undefined),
  catchtutorial: async (s, g) => { s.byte(); await g.catchTutorial(); },
  trainertext: async (s, g) => {
    const which = s.byte();
    if (!s.trainer) return;
    await g.writeText([s.trainer.seen, s.trainer.win, s.trainer.loss][which] ?? s.trainer.seen);
  },
  trainerflagaction: (s, g) => {
    const action = s.byte();
    if (!s.trainer) return;
    if (action === C("SET_FLAG")) g.setEvent(s.trainer.flag, true);
    else if (action === C("RESET_FLAG")) g.setEvent(s.trainer.flag, false);
    else g.scriptVar = g.event(s.trainer.flag) ? 1 : 0;
  },
  scripttalkafter: s => { if (s.trainer) s.pos = s.trainer.after; else return end(s); },
  endifjustbattled: s => { if (s.justBattled) return END_ALL; },
  checkjustbattled: (s, g) => { g.scriptVar = s.justBattled ? 1 : 0; },

  // ---------------------------------------------------------------- services
  pokemart: async (s, g) => { const kind = s.byte(), id = s.word(); await g.pokemart(kind, id); },
  elevator: async (s, g) => { g.scriptVar = await g.elevator(s.pointer()) ? 1 : 0; },
  trade: async (s, g) => { await g.npcTrade(s.byte()); },
  // The cartridge's FruitTreeScript, for tree n.
  fruittree: (s, g) => { g.poke(RAM.wCurFruitTree, s.byte()); s.pos = g.rom.sym("FruitTreeScript"); },
  swarm: (s, g) => { const kind = s.byte(), group = s.byte(), number = s.byte(); g.swarm(kind, group, number); },
  halloffame: async (_, g) => { await g.hallOfFame(); return END_ALL; },
  credits: async (_, g) => { await g.credits(); return END_ALL; },

  // ---------------------------------------------------------------- the phone
  askforphonenumber: async (s, g) => {
    const yes = await g.yesNo();
    const contact = s.byte();
    if (!yes) { g.scriptVar = C("PHONE_CONTACT_REFUSED"); return; }
    g.scriptVar = g.addPhoneNumber(contact) ? 0 : C("PHONE_CONTACTS_FULL");
  },
  addcellnum: (s, g) => { g.scriptVar = g.addPhoneNumber(s.byte()) ? 1 : 0; },
  delcellnum: (s, g) => { g.scriptVar = g.deletePhoneNumber(s.byte()) ? 1 : 0; },
  checkcellnum: (s, g) => { g.scriptVar = g.save.phone.includes(s.byte()) ? 1 : 0; },
  phonecall: async (s, g) => { await g.phoneCallText(s.pointer()); },
  hangup: async (_, g) => { await g.hangUp(); },
  specialphonecall: (s, g) => { g.save.specialCall = s.word(); },
  checkphonecall: (_, g) => { g.scriptVar = g.save.specialCall ? 1 : 0; },
};

function bigdt(s: Script) {
  const a = s.byte(), b = s.byte(), c = s.byte();
  return (a << 16) | (b << 8) | c;
}
function compare(have: number, want: number) {
  return have > want ? C("HAVE_MORE") : have === want ? C("HAVE_AMOUNT") : C("HAVE_LESS");
}
async function jumpText(g: CrystalGame, at: number) {
  g.lastText = at;
  await g.writeText(at);
  await g.waitButton();
  g.closeText();
}

/** Every command the interpreter has, for the coverage test. */
export const SUPPORTED_COMMANDS = new Set([...Object.keys(COMMANDS), ...Object.keys(ALIASES)]);
/** RAM labels the interpreter reads by name. */
export const ramAddress = (name: string) => {
  const v = RAM[name];
  if (v === undefined) throw Error(`Unknown RAM label ${name}`);
  return v;
};
