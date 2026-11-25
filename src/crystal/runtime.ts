/**
 * Pokémon Crystal (and Crystal Legacy), played with Astra's engine: the
 * Crystal battle engine, menus and audio, over Johto and Kanto read from the
 * player's cartridge, with the cartridge's own scripts run by script.ts.
 */
import type { Engine, Pokemon } from "../engine";
import type { PokemonPortrait } from "../engine/appearance";
import type { PortraitEntrance } from "../emerald/portraits";
import type { Input } from "../game/input";
import type { GameAudio } from "../game/audio";
import type { MusicScene } from "../game/music";
import type { MenuInput } from "../ui/menu-input";
import { dismissMenu } from "../ui/menu-controller";
import { evolutionInput } from "../ui/evolution";
import { BODY_RADIUS, bodyEntersBlockedTile, heldHeading, walkFreely, walkSpeed, type Position } from "../game/free-movement";
import { JourneyConflict, type JourneyStore } from "../game/storage";
import { C, CONST, ENGINE_RAM, ITEM, MAP, MON, RAM, SYM, TEXT, cartridgeInUse, constName, mapName, ramName } from "./symbols";
import { CrystalRom, type BgEvent, type CrystalMap, type ObjectEvent, type TextOp } from "./rom";
import { CrystalWorld, FACINGS, STEP, opposite, type Facing, type LiveMap } from "./world";
import { crystalSummary, type CrystalMon, type CrystalSave } from "./save";
import { readTrainerHeader, runScript, UnsupportedScript, type TrainerHeader } from "./script";
import { startRandomCall } from "./phone";
import { DomUi, paginate, type CrystalUi } from "./ui";
import type { TimeOfDay } from "./gfx";
import type { NicknameText } from "./menu";

export interface CrystalContext {
  engine: Engine;
  rom: CrystalRom;
  input: Input;
  menuInput?: MenuInput;
  layer?: HTMLElement;
  canvas?: HTMLCanvasElement;
  sound?: GameAudio;
  sprite?: (mon: PokemonPortrait | number, back?: boolean) => string;
  spriteEntrance?: (mon: PokemonPortrait, back: boolean) => PortraitEntrance | undefined;
  cry?: (species: number) => void;
  store?: JourneyStore;
  save: CrystalSave;
  exit?: () => void;
  saveWarning?: HTMLElement;
  /** Tests answer dialogue without a page. */
  ui?: CrystalUi;
  /** The clock, for tests. */
  now?: () => Date;
}

export interface Mover {
  x: number;
  y: number;
  facing: Facing;
  from?: { x: number; y: number; t: number; duration: number; hop?: boolean };
  walkFrame: number;
  free?: { x: number; y: number };
  stride?: number;
  moving?: boolean;
  onPath?: () => void;
  emote?: { kind: number; until: number };
  treeShakeSince?: number;
  /** Hidden by a movement script (hide_object), but still there. */
  invisible?: boolean;
  fixedFacing?: boolean;
  sliding?: boolean;
}
export interface Obj extends Mover {
  slot: number;
  event: ObjectEvent;
  visible: boolean;
  home: { x: number; y: number };
  wait: number;
  /** The movement data: function and facing. */
  fn: number;
}

export type BattleSetup =
  | { kind: "wild"; species: number; level: number; shiny?: boolean; type?: number }
  | { kind: "random" }
  | { kind: "trainer"; klass: number; id: number; winLoss?: [number, number] };

const WALK_SECONDS = 1 / 4.2;
const TREE_SHAKE_FRAMES = 24;
const PHONE_CALL_DELAYS = [20, 10, 5, 3]; // In clock minutes.

export class CrystalGame {
  readonly rom: CrystalRom;
  readonly world: CrystalWorld;
  readonly ui: CrystalUi;
  save: CrystalSave;
  map!: LiveMap;
  me: Mover;
  objects: Obj[] = [];
  stopped = false;
  mode: "world" | "script" | "menu" | "battle" = "world";
  scriptVar = 0;
  lastTalked = 0;
  lastText?: number;
  lastItem = 0;
  /** wCurPartySpecies: the Pokémon a party menu last chose, for PlayCurMonCry. */
  curPartySpecies = 0;
  textOpen = false;
  menuHeader?: number;
  battleSetup?: BattleSetup;
  battleResult = 0;
  keepMusic = false;
  /** RAM strings: string buffers and names, by address. */
  strings = new Map<number, string>();
  private events: Set<number>;
  private flags: Set<number>;
  private deferred: number[] = [];
  private clock = 0;
  private phoneDelayIndex = 0;
  private nextPhoneCallMinute = 0;
  private waiters: { until: number; resolve: () => void }[] = [];
  private musicOverride?: number;
  private lastSave = 0;
  private saveIssue = false;
  private encounterCooldown = 0;
  private bumped = false;
  private turnHeld = 0;
  private queued?: Facing;
  following?: { leader: number; follower: number };
  fade = 0;
  private fadeTarget = 0;
  private fadeResolve?: () => void;
  /** Flash's light in a dark cave (STATUSFLAGS_FLASH), kept with the save. */
  get flash() { return !!this.save.vars.flash; }
  set flash(on: boolean) {
    if (on) this.save.vars.flash = 1;
    else delete this.save.vars.flash;
  }
  shake = 0;
  /** HealMachineAnim's lights and Poké Balls while a healing machine is in use, in map pixels. */
  healMachine?: { sprites: { x: number; y: number; tile: number; flip: boolean }[]; since: number };
  renderer?: { render(now: number): void };
  inBattle?: { trainer: boolean; klass?: number };
  battleCue?: string;
  autoBattle = false;

  constructor(readonly ctx: CrystalContext) {
    this.rom = ctx.rom;
    this.world = new CrystalWorld(ctx.rom);
    this.save = ctx.save;
    this.events = new Set(this.save.events);
    this.flags = new Set(this.save.flags);
    this.ui = ctx.ui ?? new DomUi(ctx.layer!, ctx.input, ctx.menuInput!);
    this.me = { x: this.save.x, y: this.save.y, facing: this.save.facing, walkFrame: 0 };
    this.resetPhoneCallTimer();
    this.dailyReset();
    this.enterMap(this.save.map[0], this.save.map[1], { arrival: "continue" });
    ctx.input.setGamepadLayout?.(!!this.save.settings.swapGamepadAB);
    ctx.sound?.attach(ctx.engine, this.save.settings.music);
  }
  /** Starts the game once the first map is ready: callbacks and scene scripts. */
  async begin() {
    await this.runScript(async () => {
      await this.mapCallbacks();
      await this.afterArrival(true);
    });
  }
  stop() {
    this.stopped = true;
    this.ctx.layer?.replaceChildren();
  }
  get legacy() { return cartridgeInUse() === "legacy"; }
  get engine() { return this.ctx.engine; }
  get layer() { return this.ctx.layer!; }

  // ------------------------------------------------------------ flags, scenes, variables
  event(i: number) { return this.events.has(i); }
  setEvent(i: number, on: boolean) {
    if (i === 0xffff || i < 0) return;
    if (on) this.events.add(i);
    else this.events.delete(i);
    // As on the cartridge, objects tied to the flag only follow it when the map
    // loads again; scripts use appear and disappear to change them at once.
  }
  ev(name: string) { return this.event(C(name)); }
  flag(i: number) {
    // The player's gender lives in its own byte, not in the flag set.
    if (i === CONST.ENGINE_PLAYER_IS_FEMALE) return this.save.gender === 1;
    return this.flags.has(i);
  }
  setFlag(i: number, on: boolean) {
    if (on) this.flags.add(i);
    else this.flags.delete(i);
  }
  hasFlag(name: string) { return this.flag(C(name)); }
  sceneOf(group: number, number: number) { return this.save.scenes[`${group}:${number}`] ?? 0; }
  setScene(group: number, number: number, scene: number) { this.save.scenes[`${group}:${number}`] = scene; }

  /** wUnlockedUnowns, from its engine flags (A–K, L–R, S–W, X–Z). */
  unlockedUnowns() {
    let bits = 0, n = 0;
    ENGINE_RAM.forEach((byte, i) => { if (byte === "wUnlockedUnowns") { if (this.flag(i)) bits |= 1 << n; n++; } });
    return bits;
  }
  badges() {
    let johto = 0, kanto = 0;
    for (let i = 0; i < 8; i++) {
      if (this.flag(C("ENGINE_ZEPHYRBADGE") + i)) johto |= 1 << i;
      if (this.flag(C("ENGINE_BOULDERBADGE") + i)) kanto |= 1 << i;
    }
    return { johto, kanto, count: popcount(johto) + popcount(kanto) };
  }

  /** A RAM byte, with the variables the save holds elsewhere. */
  peek(addr: number): number {
    const live = this.live(addr);
    if (live !== undefined) return live & 0xff;
    return this.save.ram[addr] ?? 0;
  }
  poke(addr: number, v: number) {
    v &= 0xff;
    if (this.writeLive(addr, v)) return;
    this.save.ram[addr] = v;
  }
  private liveAt(name: string, addr: number, size = 1) {
    const base = RAM[name];
    return base !== undefined && addr >= base && addr < base + size ? addr - base : -1;
  }
  private live(addr: number): number | undefined {
    let i: number;
    if (addr === RAM.wScriptVar) return this.scriptVar;
    if ((i = this.liveAt("wMoney", addr, 3)) >= 0) return (this.save.money >> (8 * (2 - i))) & 0xff;
    if ((i = this.liveAt("wMomsMoney", addr, 3)) >= 0) return (this.save.momMoney >> (8 * (2 - i))) & 0xff;
    if ((i = this.liveAt("wCoins", addr, 2)) >= 0) return (this.save.coins >> (8 * (1 - i))) & 0xff;
    if (addr === RAM.wPartyCount) return this.save.party.length;
    if (addr === RAM.wPlayerGender) return this.save.gender;
    if (addr === RAM.wBattleResult) return this.battleResult;
    if (addr === RAM.wTimeOfDay) return this.timeOfDay();
    if (addr === RAM.wMapGroup) return this.map.group;
    if (addr === RAM.wMapNumber) return this.map.number;
    if (addr === RAM.wXCoord) return this.me.x;
    if (addr === RAM.wYCoord) return this.me.y;
    if (addr === RAM.wUnlockedUnowns) return this.unlockedUnowns();
    if (addr === RAM.wPlayerState) return this.playerStateValue();
    if (addr === RAM.wSpecialPhoneCallID) return this.save.specialCall & 0xff;
    return undefined;
  }
  private writeLive(addr: number, v: number) {
    let i: number;
    if (addr === RAM.wScriptVar) { this.scriptVar = v; return true; }
    if ((i = this.liveAt("wMoney", addr, 3)) >= 0) { this.save.money = setByte(this.save.money, 2 - i, v); return true; }
    if ((i = this.liveAt("wMomsMoney", addr, 3)) >= 0) { this.save.momMoney = setByte(this.save.momMoney, 2 - i, v); return true; }
    if ((i = this.liveAt("wCoins", addr, 2)) >= 0) { this.save.coins = setByte(this.save.coins, 1 - i, v); return true; }
    if (addr === RAM.wUnlockedUnowns) {
      ENGINE_RAM.forEach((byte, i) => { if (byte === "wUnlockedUnowns") this.setFlag(i, !!(v & (1 << ENGINE_RAM.slice(0, i).filter(b => b === byte).length))); });
      return true;
    }
    if (addr === RAM.wPlayerGender) { this.save.gender = (v & 1) as 0 | 1; return true; }
    if (addr === RAM.wSpecialPhoneCallID) { this.save.specialCall = v; return true; }
    return false;
  }
  /** A 3-byte banked pointer held in RAM. */
  ramPointer(addr: number) {
    return this.rom.at(this.peek(addr), this.peek(addr + 1) | (this.peek(addr + 2) << 8));
  }
  readVar(v: number): number {
    const name = constName("VAR_", v) ?? "";
    switch (name) {
      case "VAR_STRINGBUFFER2": return this.peek(RAM.wStringBuffer2);
      case "VAR_PARTYCOUNT": return this.save.party.length;
      case "VAR_BATTLERESULT": return this.battleResult & ~0xc0 & 0xff;
      case "VAR_BATTLETYPE": return this.save.vars.battleType ?? 0;
      case "VAR_TIMEOFDAY": return this.timeOfDay();
      case "VAR_DEXCAUGHT": return this.save.caught.length;
      case "VAR_DEXSEEN": return this.save.seen.length;
      case "VAR_BADGES": return this.badges().count;
      case "VAR_MOVEMENT": return this.playerStateValue();
      case "VAR_FACING": return FACINGS.indexOf(this.me.facing);
      case "VAR_HOUR": return this.now().getHours();
      case "VAR_WEEKDAY": return this.now().getDay();
      case "VAR_MAPGROUP": return this.map.group;
      case "VAR_MAPNUMBER": return this.map.number;
      case "VAR_UNOWNCOUNT": return this.save.unownDex.length;
      case "VAR_ENVIRONMENT": return this.map.environment;
      // Astra's PC keeps Bill's boxes as one collection: room in any box counts, up to a box's worth.
      case "VAR_BOXSPACE": return Math.min(20, this.save.boxes.reduce((n, b) => n + 20 - b.length, 0));
      case "VAR_CONTESTMINUTES": return this.contestMinutes();
      case "VAR_XCOORD": return this.me.x;
      case "VAR_YCOORD": return this.me.y;
      case "VAR_SPECIALPHONECALL": return this.save.specialCall & 0xff;
      case "VAR_BT_WIN_STREAK": return 0;
      case "VAR_KURT_APRICORNS": return this.peek(RAM.wKurtApricornQuantity);
      case "VAR_CALLERID": return this.save.vars.caller ?? 0;
      case "VAR_BLUECARDBALANCE": return this.save.vars.blueCard ?? 0;
      case "VAR_BUENASPASSWORD": return this.peek(RAM.wBuenasPassword);
      case "VAR_KENJI_BREAK": return this.save.vars.kenji ?? 0;
    }
    return 0;
  }
  writeVar(v: number, value: number) {
    const name = constName("VAR_", v) ?? "";
    if (name === "VAR_STRINGBUFFER2") this.poke(RAM.wStringBuffer2, value);
    else if (name === "VAR_BATTLETYPE") this.save.vars.battleType = value;
    else if (name === "VAR_MOVEMENT") this.setPlayerState(value);
    else if (name === "VAR_CALLERID") this.save.vars.caller = value;
    else if (name === "VAR_BLUECARDBALANCE") this.save.vars.blueCard = value;
    else if (name === "VAR_BUENASPASSWORD") this.poke(RAM.wBuenasPassword, value);
    else if (name === "VAR_KURT_APRICORNS") this.poke(RAM.wKurtApricornQuantity, value);
    else if (name === "VAR_KENJI_BREAK") this.save.vars.kenji = value;
    else if (name === "VAR_SPECIALPHONECALL") this.save.specialCall = value;
  }
  playerStateValue() {
    return this.save.state === "bike" ? C("PLAYER_BIKE") : this.save.state === "surf" ? C("PLAYER_SURF") : C("PLAYER_NORMAL");
  }
  setPlayerState(v: number) {
    this.save.state = v === C("PLAYER_BIKE") ? "bike" : v === C("PLAYER_SURF") || v === CONST.PLAYER_SURF_PIKA ? "surf" : "normal";
    this.ctx.sound?.refreshMusic();
  }

  // ------------------------------------------------------------ time
  now() { return this.ctx.now?.() ?? new Date(); }
  /** MORN_F, DAY_F or NITE_F, from the real clock as Crystal's own clock would show. */
  timeOfDay(): TimeOfDay {
    const h = this.now().getHours();
    if (h >= C("NITE_HOUR") || h < C("MORN_HOUR")) return 2;
    if (h >= C("DAY_HOUR")) return 1;
    return 0;
  }
  timeOfDayFlag() { return [C("MORN"), C("DAY"), C("NITE")][this.timeOfDay()]; }
  /** Daily events reset at midnight (fruit trees, Buena, the lucky number, phone rematches…). */
  dailyReset() {
    const d = this.now();
    const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (this.save.day === day) return;
    const first = !this.save.day;
    this.save.day = day;
    if (first) return;
    // CheckDailyResetTimer: the daily, swarm and phone flags clear at midnight.
    const daily = /^w(Daily(Flags[12]|RematchFlags|PhoneItemFlags|PhoneTimeOfDayFlags)|SwarmFlags)$/;
    ENGINE_RAM.forEach((byte, i) => { if (daily.test(byte)) this.flags.delete(i); });
    this.save.vars.fruitTrees = 0;
    delete this.save.swarm;
    delete this.save.vars.luckyDay;
  }

  // ------------------------------------------------------------ party and bag
  isEgg(m: CrystalMon) { return !!m.egg; }
  monName(species: number) { return this.engine.species(species).name.toUpperCase(); }
  /** ITEM_FROM_MEM ($ff) means the item in the script variable. */
  itemArg(item: number) { return item === 0xff ? this.scriptVar : item; }
  itemCount(item: number) { return this.save.items[item] ?? 0; }
  giveItem(item: number, count = 1) {
    if (!item) return false;
    const have = this.save.items[item] ?? 0;
    if (have + count > 99) return false;
    const pocket = this.rom.itemPocket(item);
    const kinds = Object.keys(this.save.items).filter(k => this.save.items[k] > 0 && this.rom.itemPocket(+k) === pocket).length;
    const room = pocket === C("ITEM") ? 20 : pocket === C("BALL") ? 12 : pocket === C("KEY_ITEM") ? 25 : 99;
    if (!have && kinds >= room) return false;
    this.save.items[item] = have + count;
    this.lastItem = item;
    return true;
  }
  takeItem(item: number, count = 1) {
    const have = this.save.items[item] ?? 0;
    if (have < count) return false;
    if (have === count) delete this.save.items[item];
    else this.save.items[item] = have - count;
    return true;
  }
  money(account: number) { return account ? this.save.momMoney : this.save.money; }
  addMoney(account: number, delta: number) {
    const v = Math.max(0, Math.min(999999, this.money(account) + delta));
    if (account) this.save.momMoney = v;
    else this.save.money = v;
  }
  makeMon(species: number, level: number): CrystalMon {
    const mon = this.engine.makePokemon(species, level);
    return { ...mon, ot_id: this.save.playerId, ot_name: this.save.name };
  }
  register(species: number, caught: boolean) {
    if (!this.save.seen.includes(species)) this.save.seen.push(species);
    if (caught && !this.save.caught.includes(species)) this.save.caught.push(species);
  }
  ownsRoamer(species: number) {
    return [...this.save.party, ...this.save.boxes.flat()].some(m => !m.egg && m.species === species && m.ot_id === this.save.playerId);
  }
  /**
   * Adds a Pokémon to the party, or to Bill's PC when the party is full. The
   * PC keeps its boxes as one collection, so any box with room takes it.
   */
  addMon(mon: CrystalMon) {
    if (this.save.party.length < 6) {
      this.save.party.push(mon);
      return "party";
    }
    const boxes = this.save.boxes;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[(this.save.box + i) % boxes.length];
      if (box.length >= 20) continue;
      box.push(mon);
      return "box";
    }
    return undefined;
  }
  async givePoke(species: number, level: number, item: number, ot?: { name: number; nickname: number }) {
    const mon = this.makeMon(species, level);
    mon.item = item;
    if (ot) {
      mon.nickname = this.rom.string(ot.nickname, 11);
      mon.ot_name = this.rom.string(ot.name, 8);
      mon.ot_id = Math.floor(Math.random() * 65536);
    }
    const where = this.addMon(mon);
    if (!where) return false;
    this.register(species, true);
    this.setBuffer(0, this.monName(species));
    if (!ot) await this.offerNickname(mon, "CaughtAskNicknameText");
    if (where === "box") {
      // GivePoke: "<MON> was sent to BILL's PC."
      this.strings.set(RAM.wStringBuffer1, mon.nickname || this.monName(species));
      const text = TEXT._WasSentToBillsPCText;
      if (text !== undefined) await this.engineText(text);
      else await this.say(`${mon.nickname || this.monName(species)} was sent to BILL's PC.`);
    }
    return true;
  }
  /** Crystal asks whether to give a nickname to a Pokémon that joins the player. */
  async offerNickname(mon: CrystalMon, label?: NicknameText) {
    const { askNickname } = await import("./menu");
    await askNickname(this, mon, label);
  }
  giveEgg(species: number, level: number) {
    const mon = this.makeMon(species, level);
    mon.egg = true;
    mon.eggCycles = this.engine.breedingData(species).cycles || 20;
    mon.nickname = "EGG";
    return !!this.addMon(mon);
  }
  async givePokeMail(at: number) { void at; }
  checkPokeMail(at: number) { void at; return 0; }
  heal() {
    this.save.party = this.save.party.map(m => m.egg ? m : { ...this.engine.healPokemon(m), egg: undefined } as CrystalMon);
  }
  trainerName(klass: number, id: number) {
    if (this.legacy) return this.rom.trainerClassName(klass);
    return this.rom.trainerParty(klass, id).name;
  }
  nameOf(type: number, index: number) {
    const name = constName("", type);
    void name;
    if (type === C("MON_NAME")) return this.monName(index);
    if (type === C("ITEM_NAME")) return this.rom.itemName(index);
    if (type === C("MOVE_NAME")) return this.engine.move(index).name.toUpperCase();
    if (type === C("TRAINER_NAME")) return this.rom.trainerClassName(index);
    return "";
  }
  setBuffer(index: number, value: string) {
    const base = RAM.wStringBuffer3 + Math.min(index, C("NUM_STRING_BUFFERS") - 1) * C("STRING_BUFFER_LENGTH");
    this.strings.set(base, value);
    this.strings.set(RAM.wStringBuffer1, value);
  }
  landmark() {
    if (this.map.landmark === C("LANDMARK_SPECIAL")) {
      const [g, n] = this.save.lastOutdoor;
      return g ? this.rom.mapHeader(g, n).landmark : this.map.landmark;
    }
    return this.map.landmark;
  }

  // ------------------------------------------------------------ text
  private textString(ops: TextOp[]): { pages: string[]; prompt: boolean } {
    const { s, prompt } = this.rawText(ops);
    return { pages: paginate(s), prompt };
  }
  /** A text's characters, with buffers and numbers filled in, before it is split into pages. */
  private rawText(ops: TextOp[]): { s: string; prompt: boolean } {
    let s = "", prompt = false;
    const pointers = ["wStringBuffer3", "wStringBuffer4", "wStringBuffer5", "wStringBuffer2", "wStringBuffer1", "wEnemyMonNickname", "wBattleMonNickname"];
    for (const op of ops) {
      if (op.op === "text") s += op.s;
      else if (op.op === "ram") s += this.ramString(op.addr);
      else if (op.op === "buffer") s += this.ramString(RAM[pointers[op.index]] ?? 0);
      else if (op.op === "decimal") {
        let n = 0;
        for (let i = 0; i < (op.bytes & 0xf); i++) n = n * 256 + this.peek(op.addr + i);
        s += String(n);
      } else if (op.op === "bcd") {
        let n = "";
        for (let i = 0; i < (op.flags & 0x1f); i++) n += this.peek(op.addr + i).toString(16).padStart(2, "0");
        s += String(+n || 0);
      } else if (op.op === "dots") s += "…".repeat(Math.max(1, Math.min(op.n, 4)));
      else if (op.op === "wait") s += "\f";
      else if (op.op === "today") s += ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][this.now().getDay()];
      else if (op.op === "sound") this.sfx(op.kind === "item" ? "SFX_ITEM" : op.kind === "caught" ? "SFX_CAUGHT_MON" : "SFX_DEX_FANFARE_50_79");
      else if (op.op === "end") prompt = op.prompt;
    }
    s = s.replaceAll("{PLAYER}", this.save.name).replaceAll("{RIVAL}", this.save.rival).replaceAll("{MOM}", this.save.mom);
    return { s, prompt };
  }
  ramString(addr: number): string {
    if (addr === RAM.wPlayerName) return this.save.name;
    if (addr === RAM.wRivalName) return this.save.rival;
    if (addr === RAM.wMomsName) return this.save.mom;
    if (addr === RAM.wRedsName) return "RED";
    if (addr === RAM.wGreensName) return "GREEN";
    const s = this.strings.get(addr);
    if (s !== undefined) return s;
    const name = ramName(addr);
    if (name && /Nickname|Name/.test(name)) return this.strings.get(addr) ?? "";
    return "";
  }
  /** A cartridge text as one string, its pages joined. */
  textOf(at: number) {
    return this.textString(this.rom.text(at)).pages.join("\f");
  }
  /** A cartridge text as written, leading and trailing spaces included, to join to other words. */
  rawTextOf(at: number) {
    return this.rawText(this.rom.text(at)).s;
  }
  /**
   * Shows a cartridge text. The box stays open on its last page until closed.
   * Resolves true when the text ended with `prompt`, already waiting for A.
   */
  async writeText(at: number) {
    const ops = this.rom.text(at);
    const asm = ops.find(op => op.op === "asm");
    const { pages, prompt } = this.textString(ops);
    const prompted = prompt && pages.length > 0;
    this.textOpen = true;
    if (pages.length) await this.ui.text(pages, prompt);
    if (asm && asm.op === "asm") {
      const { runTextAsm } = await import("./specials");
      await runTextAsm(this, asm.at);
    }
    return prompted;
  }
  /** A text the engine prints itself: shown, then A is waited for once, even if the text prompts. */
  async engineText(at: number, wait = true) {
    const prompted = await this.writeText(at);
    if (wait && !prompted) await this.waitButton();
  }
  /** Shows a literal message, waiting for A. */
  async say(text: string, wait = true) {
    const pages = paginate(text.replaceAll("{PLAYER}", this.save.name).replaceAll("{RIVAL}", this.save.rival));
    this.textOpen = true;
    await this.ui.text(pages, wait);
  }
  async waitButton() { await this.ui.waitButton(); }
  closeText() {
    this.textOpen = false;
    this.ui.closeText();
  }
  yesNo() { return this.ui.yesNo(); }
  choose(options: string[], o?: { title?: string; cancel?: boolean; columns?: number }) { return this.ui.choose(options, o); }
  /** A script's `loadmenu` header: its choices, read from the cartridge. Returns the 1-based pick, or 0. */
  async scriptMenu(twoD: boolean) {
    const header = this.menuHeader;
    if (header === undefined) return 0;
    const { readMenuHeader } = await import("./services");
    const menu = readMenuHeader(this, header);
    const pick = await this.choose(menu.items, { cancel: menu.cancel, columns: twoD ? menu.columns : 1 });
    this.menuHeader = undefined;
    return pick === undefined ? 0 : pick + 1;
  }
  async pokepic(species: number) {
    const { showPokepic } = await import("./services");
    showPokepic(this, species);
  }
  closePokepic() { this.layer?.querySelector?.(".crystal-pokepic")?.remove(); }
  async describeDecoration(kind: number) {
    const { describeDecoration } = await import("./services");
    await describeDecoration(this, kind);
  }

  // ------------------------------------------------------------ sound
  musicId(name: string) { return C(name); }
  playMusic(id: number | undefined) {
    this.musicOverride = id;
    this.ctx.sound?.refreshMusic();
  }
  encounterMusic() {
    const klass = this.battleSetup?.kind === "trainer" ? this.battleSetup.klass : undefined;
    void klass;
  }
  sfx(name: string) {
    const id = CONST[name];
    if (id !== undefined) this.sfxId(id);
  }
  sfxId(id: number) {
    try {
      this.ctx.sound?.soundEffect?.(id);
    } catch { /* sound is optional */ }
  }
  cry(species: number) { if (species) this.ctx.cry?.(species); }
  get scene() { return this.mode === "battle" ? "battle" : "world"; }
  musicScene(): MusicScene | number {
    // Battle songs are Crystal song ids; victory and capture are Astra's music scenes.
    if (this.mode === "battle") return this.battleCue && /^\d+$/.test(this.battleCue) ? +this.battleCue : (this.battleCue as MusicScene) ?? 0;
    return this.musicTrack() ?? 0;
  }
  musicTrack(): number | undefined {
    if (this.musicOverride !== undefined) return this.musicOverride || undefined;
    if (this.save.state === "surf") return C("MUSIC_SURF");
    if (this.save.state === "bike") return C("MUSIC_BICYCLE");
    if (this.save.contest && this.map.name.startsWith("NATIONAL_PARK")) return C("MUSIC_BUG_CATCHING_CONTEST");
    return this.mapMusic(this.map);
  }
  private mapMusic(map: CrystalMap) {
    // MUSIC_MAHOGANY_MART and MUSIC_RADIO_TOWER play Team Rocket's song while Rockets hold them.
    if (map.music === CONST.MUSIC_RADIO_TOWER && !this.ev("EVENT_GOLDENROD_CITY_ROCKET_TAKEOVER")) return C("MUSIC_GOLDENROD_CITY");
    return map.music || undefined;
  }

  // ------------------------------------------------------------ waiting
  delay(frames: number) {
    if (this.ctx.ui && !this.ctx.canvas) return Promise.resolve();
    return new Promise<void>(resolve => this.waiters.push({ until: this.clock + frames / 60, resolve }));
  }
  fadeTo(level: number) {
    if (!this.ctx.canvas) { this.fade = level; return Promise.resolve(); }
    this.fadeTarget = level;
    return new Promise<void>(resolve => { this.fadeResolve = resolve; });
  }
  async fadeAround(during: () => void | Promise<void>) {
    await this.fadeTo(1);
    await during();
    await this.fadeTo(0);
  }

  // ------------------------------------------------------------ maps
  private loaded = new Map<string, CrystalMap>();
  header(group: number, number: number) {
    return this.rom.mapHeader(group, number);
  }
  /**
   * Loads a map: blocks, objects (with their flags and hours) and the
   * variable sprites. Callbacks run afterwards, in `mapCallbacks`.
   */
  enterMap(group: number, number: number, options: { arrival: "warp" | "connection" | "continue" }) {
    const header = this.header(group, number);
    this.map = this.world.live(header);
    this.save.map = [group, number];
    const env = header.environment;
    if (env === C("TOWN") || env === C("ROUTE")) this.save.lastOutdoor = [group, number];
    // ResetFlashIfOutOfCave: Flash lasts until the player is out in a town or on a route.
    if (env === C("TOWN") || env === C("ROUTE")) this.flash = false;
    if (options.arrival !== "continue") {
      // HandleNewMap → ResetMapBufferEventFlags: EVENT_TEMPORARY_UNTIL_MAP_RELOAD_1–8 clear.
      for (let i = 1; i <= 8; i++) { const e = CONST[`EVENT_TEMPORARY_UNTIL_MAP_RELOAD_${i}`]; if (e !== undefined) this.events.delete(e); }
    }
    // Walks still under way on the map being left finish at once.
    for (const o of this.objects) if (o.onPath) { const cb = o.onPath; o.onPath = undefined; cb(); }
    this.objects = header.objects.map((event, i) => ({
      slot: i + 1, event, x: event.x, y: event.y, facing: this.defaultFacing(event), walkFrame: 0,
      visible: this.objectVisible(event), home: { x: event.x, y: event.y }, wait: 1 + Math.random() * 2,
      fn: this.rom.u8(SYM.SpriteMovementData + event.movement * 6), fixedFacing: false,
    }));
    this.calmEncounters();
    // The map's CMDQUEUE callback writes its command queue again.
    delete this.save.vars.cmdQueue;
    if (options.arrival !== "continue") {
      this.roam();
      // Strength lasts until the player leaves the map.
      if (CONST.ENGINE_STRENGTH_ACTIVE !== undefined) this.flags.delete(CONST.ENGINE_STRENGTH_ACTIVE);
    }
    if (!this.keepMusic) this.musicOverride = undefined;
    this.keepMusic = false;
    this.following = undefined;
    // Biking indoors and surfing onto land end when the map changes.
    if (this.save.state === "bike" && (env === C("INDOOR") || env === C("DUNGEON") || env === C("ENVIRONMENT_5"))) this.save.state = "normal";
    // .CheckForcedBiking: Cycling Road puts the player on the Bicycle.
    if (this.hasFlag("ENGINE_ALWAYS_ON_BIKE")) this.save.state = "bike";
    if (this.save.state === "surf" && options.arrival === "warp") this.save.state = "normal";
    this.ctx.sound?.refreshMusic();
    this.mapNameSign(options.arrival === "continue");
  }
  /** The landmark the last map name sign check was made in (wPrevLandmark); -1 for a gate. */
  private prevLandmark = -1;
  /**
   * InitMapNameSign: entering a new landmark shows its name. Not on continuing,
   * within one landmark or out of a LANDMARK_SPECIAL map, and gates and a few
   * landmarks (.CheckSpecialMap) never get a sign.
   */
  private mapNameSign(continuing: boolean) {
    const [group, number] = this.save.map;
    const parkGate = ["ROUTE_35_NATIONAL_PARK_GATE", "ROUTE_36_NATIONAL_PARK_GATE"].some(n => MAP[n]?.[0] === group && MAP[n]?.[1] === number);
    const here = parkGate || this.map.environment === C("GATE") ? -1 : this.map.landmark;
    const before = this.prevLandmark;
    this.prevLandmark = here;
    if (continuing || here === before || before === C("LANDMARK_SPECIAL") || here === -1) return;
    const unsigned = ["LANDMARK_SPECIAL", "LANDMARK_RADIO_TOWER", "LANDMARK_LAV_RADIO_TOWER", "LANDMARK_UNDERGROUND_PATH", "LANDMARK_INDIGO_PLATEAU", "LANDMARK_POWER_PLANT"];
    if (unsigned.some(name => CONST[name] === here)) return;
    const name = this.rom.landmarkName(here);
    if (name) this.ui.place(titleCase(name));
  }
  private defaultFacing(event: ObjectEvent): Facing {
    const f = this.rom.u8(SYM.SpriteMovementData + event.movement * 6 + 1);
    return FACINGS[f & 3] ?? "down";
  }
  objectTime(e: ObjectEvent) {
    if (e.h1 === -1) {
      if (e.h2 === -1) return true;
      return !!(e.h2 & this.timeOfDayFlag());
    }
    const h = this.now().getHours();
    if (e.h1 === e.h2) return true;
    if (e.h1 > e.h2) return h >= e.h1 || h <= e.h2;
    return h >= e.h1 && h <= e.h2;
  }
  private objectVisible(e: ObjectEvent) {
    if (e.flag >= 0 && this.event(e.flag)) return false;
    return this.objectTime(e);
  }
  /** Runs the map's callbacks of `type`, in order. */
  async callbacks(type: number) {
    for (const cb of this.map.callbacks.filter(c => c.type === type)) await runScript(this, cb.script, { callback: true });
  }
  /** The callbacks a map runs as it loads. */
  async mapCallbacks() {
    await this.callbacks(C("MAPCALLBACK_NEWMAP"));
    await this.callbacks(C("MAPCALLBACK_TILES"));
    await this.callbacks(C("MAPCALLBACK_OBJECTS"));
    await this.callbacks(C("MAPCALLBACK_SPRITES"));
    await this.callbacks(C("MAPCALLBACK_CMDQUEUE"));
  }
  /** Raikou and Entei move to a neighbouring route whenever the player changes maps (RoamMaps). */
  private roam() {
    const roamers = this.save.roamers;
    if (!roamers?.length) return;
    const r = this.rom, next = new Map<string, [number, number][]>();
    for (let o = SYM.RoamMaps; r.u8(o) !== 0xff;) {
      const key = `${r.u8(o)}:${r.u8(o + 1)}`, n = r.u8(o + 2);
      next.set(key, Array.from({ length: n }, (_, i) => [r.u8(o + 3 + i * 2), r.u8(o + 4 + i * 2)] as [number, number]));
      o += 3 + n * 2 + 1;
    }
    for (const mon of roamers) {
      const options = next.get(`${mon.group}:${mon.number}`) ?? [...next.keys()].map(k => k.split(":").map(Number) as [number, number]);
      const [group, number] = options[Math.floor(Math.random() * options.length)];
      Object.assign(mon, { group, number });
    }
  }
  defer(at: number) { this.deferred.push(at); }
  /** Work queued to run once the current script has ended (LoadScriptBDE), such as Mom's shopping call. */
  private afterScript: (() => Promise<void>)[] = [];
  queueAfterScript(action: () => Promise<void>) { this.afterScript.push(action); }
  /** Runs the scene script for the map's scene and anything it defers. */
  async sceneScript() {
    for (let guard = 0; guard < 4; guard++) {
      const scene = this.sceneOf(this.map.group, this.map.number);
      const at = this.map.scenes[scene];
      if (at !== undefined) await runScript(this, at);
      if (!this.deferred.length) return;
      await this.runDeferred();
      if (this.sceneOf(this.map.group, this.map.number) === scene) return;
    }
  }
  async runDeferred() {
    while (this.deferred.length) await runScript(this, this.deferred.shift()!);
  }
  changeBlock(x: number, y: number, block: number) {
    const bx = x >> 1, by = y >> 1;
    if (bx < 0 || by < 0 || bx >= this.map.width || by >= this.map.height) return;
    this.map.live[by * this.map.width + bx] = block;
    this.map.version++;
  }
  changeMapBlocks(at: number) {
    this.map.live = this.rom.bytes.slice(at, at + this.map.width * this.map.height);
    this.map.version++;
  }
  redraw() { this.map.version++; }
  /** Warps to a map square (`warp` in scripts, Fly, Escape Rope…). */
  async warpTo(group: number, number: number, x: number, y: number, facing?: Facing) {
    if (!group) return this.blackoutWarp();
    await this.fadeAround(async () => {
      this.place(0, x, y, facing);
      this.enterMap(group, number, { arrival: "warp" });
      await this.mapCallbacks();
    });
  }
  /**
   * MapSetupScript_ReloadMap (`reloadmap`, after a battle): the map's blocks
   * again with its TILES callback, and its music. People stay where scripts
   * left them, and the map's other callbacks don't run again.
   */
  async reloadMap() {
    this.map.live = this.map.blocks.slice();
    await this.callbacks(C("MAPCALLBACK_TILES"));
    this.map.version++;
    if (!this.keepMusic) this.musicOverride = undefined;
    this.keepMusic = false;
    this.ctx.sound?.refreshMusic();
  }
  async warpCheck() {
    const i = this.world.warpAt(this.map, this.me.x, this.me.y);
    if (i >= 0) await this.useWarp(i);
  }
  /** Takes warp event `index` of the current map. */
  async useWarp(index: number) {
    const warp = this.map.warps[index];
    let { group, number } = warp;
    let dest = warp.warp;
    // CopyWarpData: a warp to -1 (Pokémon Center 2F's stairs, elevators) leads back where the player came from.
    if (dest === 0xff) {
      const back = this.save.backupWarp;
      if (!back) return;
      ({ group, number } = back);
      dest = back.warp;
    }
    const target = this.header(group, number);
    const arrival = target.warps[dest - 1];
    if (!arrival) return;
    // EnterMapSpawnPoint: arriving on a warp that leads to -1 remembers the warp just taken.
    if (arrival.warp === 0xff) this.save.backupWarp = { warp: index + 1, group: this.map.group, number: this.map.number };
    const coll = this.world.collision(this.map, this.me.x, this.me.y);
    this.sfx(this.world.isDoor(coll) ? "SFX_ENTER_DOOR" : coll === C("COLL_WARP_PANEL") ? "SFX_WARP_TO" : "SFX_EXIT_BUILDING");
    const outdoors = (m: CrystalMap) => m.environment === C("TOWN") || m.environment === C("ROUTE");
    const indoors = (m: CrystalMap) => [C("INDOOR"), C("CAVE"), C("DUNGEON"), C("GATE")].includes(m.environment);
    if (outdoors(this.map) && indoors(target)) {
      // EnterMapWarp: Dig and the Escape Rope lead back to this door (not from Mt. Moon Square or the Tin Tower roof)…
      if (!["MOUNT_MOON_SQUARE", "TIN_TOWER_ROOF"].includes(this.map.name))
        Object.assign(this.save.vars, { digGroup: this.map.group, digNumber: this.map.number, digX: warp.x, digY: warp.y });
      // …and a Pokémon Center becomes the blackout spot.
      if (target.tileset === CONST.TILESET_POKECENTER || target.tileset === CONST.TILESET_POKECOM_CENTER) this.save.spawn = { group: this.map.group, number: this.map.number };
    }
    await this.fadeAround(async () => {
      this.place(0, arrival.x, arrival.y);
      this.enterMap(group, number, { arrival: "warp" });
      await this.mapCallbacks();
    });
    this.persist();
    const map = this.map;
    await this.afterArrival(true);
    if (this.map !== map || this.mode === "battle") return;
    await this.walkOffEntrance();
  }
  /** Doors, staircases and cave mouths walk the player down off them: an ordinary step, with its events. */
  async walkOffEntrance() {
    const here = this.world.collision(this.map, this.me.x, this.me.y);
    if (![C("COLL_DOOR"), CONST.COLL_DOOR_79, C("COLL_STAIRCASE"), C("COLL_CAVE")].includes(here)) return;
    this.me.facing = "down";
    const { x, y } = this.front();
    if (this.blocked(x, y) || !this.passable(x, y, this.me)) return;
    await this.walk(0, ["down"]);
    await this.arrived();
  }
  async blackoutWarp() {
    const { blackoutSpot } = await import("./services");
    const spot = blackoutSpot(this);
    await this.warpTo(spot.group, spot.number, spot.x, spot.y, "down");
  }
  /** Crosses into a connected map. */
  private crossEdge() {
    if (this.world.inside(this.map, this.me.x, this.me.y)) return false;
    const across = this.world.across(this.map, this.me.x, this.me.y);
    if (!across) return false;
    const dx = across.x - this.me.x, dy = across.y - this.me.y;
    this.me.x = across.x;
    this.me.y = across.y;
    for (const p of [this.me.from, this.me.free]) if (p) { p.x += dx; p.y += dy; }
    this.enterMap(across.group, across.number, { arrival: "connection" });
    void this.runScript(async () => {
      await this.mapCallbacks();
      await this.afterArrival(false);
    });
    return true;
  }

  // ------------------------------------------------------------ objects
  obj(slot: number): Obj | undefined { return slot > 0 ? this.objects[slot - 1] : undefined; }
  mover(slot: number): Mover | undefined { return slot === 0 ? this.me : this.obj(slot); }
  spriteOf(o: Obj) {
    const s = o.event.sprite, vars = CONST.SPRITE_VARS ?? 0xf0;
    return s >= vars ? this.save.variableSprites[s - vars] ?? 0 : s;
  }
  setVariableSprite(index: number, sprite: number) { this.save.variableSprites[index] = sprite; }
  facePlayer() {
    const o = this.obj(this.lastTalked);
    if (o) o.facing = towards(o, this.me);
  }
  faceObject(a: number, b: number) {
    const m = this.mover(a), t = this.mover(b);
    if (m && t) m.facing = towards(m, t);
  }
  turn(slot: number, facing: Facing) {
    const m = this.mover(slot);
    if (m && !m.fixedFacing) m.facing = facing;
  }
  appear(slot: number, on: boolean) {
    const o = this.obj(slot);
    if (!o) return;
    if (o.event.flag >= 0) {
      if (on) this.events.delete(o.event.flag);
      else this.events.add(o.event.flag);
    }
    // An object appears where its map object says: `moveobject` and `writeobjectxy` change that square.
    if (on && !o.visible) Object.assign(o, { x: o.home.x, y: o.home.y, from: undefined, free: undefined, invisible: false });
    o.visible = on;
  }
  moveObject(slot: number, x: number, y: number) {
    const o = this.obj(slot);
    if (!o) return;
    Object.assign(o, { x, y, from: undefined, free: undefined, home: { x, y } });
  }
  /** Makes an object's current square its home (after a movement script). */
  writeObjectXY(slot: number) {
    const o = this.obj(slot);
    if (o) o.home = { x: o.x, y: o.y };
  }
  place(slot: number, x: number, y: number, facing?: Facing) {
    const m = this.mover(slot);
    if (!m) return;
    Object.assign(m, { x, y, from: undefined, free: undefined });
    if (facing) m.facing = facing;
  }
  /**
   * HealMachineAnim: the machine's two lights (not in the Hall of Fame) and a
   * Poké Ball for each party Pokémon, at the cartridge's sprite positions. Those
   * are screen pixels with the player's square at (64, 64), and OAM's (8, 16) on top.
   */
  showHealMachine(kind: number) {
    const hof = kind === C("HEALMACHINE_HALL_OF_FAME");
    const table = SYM[hof ? "HealMachineAnim.HOF_OAM" : "HealMachineAnim.PC_ElmsLab_OAM"];
    // Elm's Lab moves the Pokémon Center's sprites to the player's left (bcpixel 2, 4).
    const [dx, dy] = kind === C("HEALMACHINE_ELMS_LAB") ? [16, 32] : [0, 0];
    const ox = this.me.x * 16 - 72 + dx, oy = this.me.y * 16 - 80 + dy;
    const count = (hof ? 0 : 2) + Math.min(6, this.save.party.length);
    const sprites = Array.from({ length: count }, (_, i) => {
      const at = table + i * 4;
      return { x: ox + this.rom.u8(at + 1), y: oy + this.rom.u8(at), tile: this.rom.u8(at + 2) & 1, flip: (this.rom.u8(at + 3) & 0x20) !== 0 };
    });
    this.healMachine = { sprites, since: this.clock };
  }
  /** How far the machine's palette has turned: FlashPalettes rotates it 8 times, 10 frames apart. */
  healMachineFlash() {
    const h = this.healMachine;
    return h ? Math.min(8, Math.floor((this.clock - h.since) * 6)) % 4 : 0;
  }
  follow(leader: number, follower: number) { this.following = { leader, follower }; }
  stopFollow() { this.following = undefined; }
  async showEmote(kind: number, slot: number, frames: number) {
    const m = this.mover(slot);
    if (!m) return;
    m.emote = { kind, until: this.clock + Math.max(frames, 20) / 60 };
    await this.delay(Math.max(frames, 20));
    m.emote = undefined;
  }
  async earthquake(frames: number) {
    this.shake = frames / 60;
    await this.delay(frames);
    this.shake = 0;
  }
  async shakeTree(m: Mover) {
    m.treeShakeSince = this.clock;
    await this.delay(TREE_SHAKE_FRAMES);
    m.treeShakeSince = undefined;
  }
  treeShakeFrame(m: Mover) {
    if (m.treeShakeSince === undefined) return;
    const elapsed = (this.clock - m.treeShakeSince) * 60;
    // SetFacingWeirdTree cycles through four poses, four frames per pose.
    if (elapsed < TREE_SHAKE_FRAMES) return Math.floor((elapsed + 1) / 4) % 4;
  }
  async applyMovement(slot: number, at: number) {
    const { applyMovement } = await import("./movement");
    await applyMovement(this, slot, at);
  }
  /** Walks steps, square by square, as scripts do. */
  async walk(slot: number, steps: Facing[], options: { speed?: number; hop?: boolean; turn?: boolean; slide?: boolean } = {}) {
    const m = this.mover(slot);
    if (!m) return;
    if (slot === 0) await this.settle();
    for (const dir of steps) {
      if (!options.slide && !m.fixedFacing) m.facing = dir;
      const [dx, dy] = STEP[dir], dist = options.hop ? 2 : 1;
      const fx = m.free?.x ?? m.x, fy = m.free?.y ?? m.y;
      m.free = undefined;
      const prior = { x: m.x, y: m.y };
      m.x += dx * dist;
      m.y += dy * dist;
      if (this.following && this.following.leader === slot) this.followStep(prior, WALK_SECONDS * dist / (options.speed ?? 1));
      if (!this.ctx.canvas) {
        if (slot === 0) this.crossEdge();
        continue;
      }
      await new Promise<void>(resolve => {
        m.from = { x: fx, y: fy, t: 0, duration: WALK_SECONDS * dist / (options.speed ?? 1), hop: options.hop };
        m.onPath = resolve;
      });
      if (slot === 0) this.crossEdge();
    }
  }
  /** Steps the follower onto the square the leader just left, in time with the leader. */
  private followStep(prior: { x: number; y: number }, duration: number) {
    const f = this.mover(this.following!.follower);
    if (!f) return;
    // A player stopped partway across a square (free movement) steps on from where they stand.
    const fx = f.free?.x ?? f.x, fy = f.free?.y ?? f.y;
    f.free = undefined;
    f.moving = false;
    const dir = (["down", "up", "left", "right"] as Facing[]).find(d => f.x + STEP[d][0] === prior.x && f.y + STEP[d][1] === prior.y);
    if (dir) f.facing = dir;
    if (dir && this.ctx.canvas) {
      f.from = { x: fx, y: fy, t: 0, duration };
      // Being led is part of the cutscene: no step is counted and nothing triggers on arrival.
      f.onPath = () => {};
    }
    f.x = prior.x;
    f.y = prior.y;
  }

  // ------------------------------------------------------------ scripts
  /** Runs an interaction or cutscene with the player locked. */
  async runScript(action: () => Promise<void> | void) {
    if (this.mode !== "world") return action();
    this.mode = "script";
    try {
      await action();
      await this.runDeferred();
      while (this.afterScript.length) await this.afterScript.shift()!();
      // Crystal runs the scene script every frame the player is free; a scene a script just set may start the next cutscene.
      await this.sceneScript();
    } catch (error) {
      console.error(error);
      if (this.ctx.ui && !this.ctx.canvas) throw error;
      await this.say(`Something went wrong: ${error instanceof UnsupportedScript || error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.closeText();
      // The machine's sprites last until the scene that used it is over.
      this.healMachine = undefined;
      this.mode = "world";
      this.persist();
    }
  }
  /** The scene script, trainers and wild Pokémon after the player arrives somewhere. */
  async afterArrival(entering: boolean) {
    await this.sceneScript();
    if (this.mode !== "world" && this.mode !== "script") return;
    if (await this.trainerSighting()) return;
    if (!entering) await this.encounter();
  }

  // ------------------------------------------------------------ main loop
  frame(now: number, dt: number) {
    if (this.stopped) return;
    this.clock += dt;
    this.save.seconds += dt;
    for (const w of [...this.waiters]) if (this.clock >= w.until) {
      this.waiters.splice(this.waiters.indexOf(w), 1);
      w.resolve();
    }
    if (this.fade !== this.fadeTarget) {
      this.fade += Math.sign(this.fadeTarget - this.fade) * Math.min(Math.abs(this.fadeTarget - this.fade), dt * 5);
      if (this.fade === this.fadeTarget) {
        const r = this.fadeResolve;
        this.fadeResolve = undefined;
        r?.();
      }
    }
    const input = this.ctx.input;
    if (evolutionInput(this.ctx.layer, input)) {
      // The evolution scene holds the controls until it is continued.
    } else if (this.mode === "battle") {
      if (input.hit("b")) this.battleLaunch?.back();
      else this.ctx.menuInput?.update(this.layer, input, now, true);
    } else if (this.ui.busy) this.ui.frame(input, now);
    else if (this.mode === "menu") {
      // The topmost overlay, such as a party chooser over the Pack, takes the input.
      const overlays = this.layer.querySelectorAll<HTMLElement>(":scope > .crystal-overlay, :scope > .cartridge-map-overlay");
      const top = overlays[overlays.length - 1] ?? this.layer;
      if (input.hit("b")) {
        const back = top.querySelector<HTMLButtonElement>("[data-bag-cancel], #back");
        if (back) back.click();
        else dismissMenu(top);
      } else if (input.hit("menu")) dismissMenu(top);
      else this.ctx.menuInput?.update(top, input, now, false);
    }
    this.updateMovers(dt);
    if (this.mode === "world") this.checkForPhoneCall();
    if (this.mode === "world") this.control(dt);
    if (this.mode === "world") this.lookForTrainers();
    if (this.mode !== "battle") this.renderer?.render(now);
    if (this.mode === "world" && this.save.steps - this.lastSave >= 16) this.persist();
  }
  battleLaunch?: { back(): void };

  private moveDuration() {
    if (this.save.state === "bike") return WALK_SECONDS / 2;
    return WALK_SECONDS / (this.ctx.input.held("speed") || this.ctx.input.held("b") ? 1.6 : 1);
  }
  /** Cycling Road downhill (BIKEFLAGS_DOWNHILL): with no direction held, the Bicycle rolls down. */
  private controlInput(): Input {
    const input = this.ctx.input;
    if (!this.hasFlag("ENGINE_DOWNHILL") || this.save.state !== "bike") return input;
    if ((["up", "down", "left", "right"] as const).some(d => input.held(d))) return input;
    const rolling = Object.create(input) as Input;
    rolling.held = (a: Parameters<Input["held"]>[0]) => a === "down" || input.held(a);
    return rolling;
  }
  private control(dt: number) {
    const input = this.controlInput();
    if (this.me.from) {
      const tapped = (["up", "down", "left", "right"] as const).find(d => input.hit(d));
      if (tapped) this.queued = tapped;
      return;
    }
    if (input.hit("menu")) return void this.openMenu();
    if (input.hit("a")) return void this.runScript(() => this.interact());
    if (this.save.settings.movement !== "grid") return this.controlFree(dt);
    this.me.free = undefined;
    const queued = this.queued;
    this.queued = undefined;
    const dir = (["up", "down", "left", "right"] as const).find(d => input.held(d) || input.hit(d)) ?? queued;
    if (!dir) {
      this.turnHeld = 0;
      return;
    }
    if (dir !== this.me.facing && !this.turnHeld && !input.held(dir)) {
      this.me.facing = dir;
      this.turnHeld = 0.0001;
      return;
    }
    this.turnHeld += dt;
    this.me.facing = dir;
    this.tryStep(dir);
  }

  /** Whether a square is blocked for the player (or for `self`). */
  blocked(x: number, y: number, self?: Mover) {
    if (self !== this.me && this.playerCovers(x, y)) return true;
    return this.objects.some(o => o.visible && o !== self && ((o.x === x && o.y === y) || (o.from && Math.round(o.from.x) === x && Math.round(o.from.y) === y)));
  }
  private playerCovers(x: number, y: number) {
    const me = this.me;
    if (me.x === x && me.y === y) return true;
    const p = me.free;
    return !!p && Math.abs(p.x - x) < 0.5 + BODY_RADIUS && Math.abs(p.y - y) < 0.5 + BODY_RADIUS;
  }
  /** Whether the player may enter square (x, y), with collision across connections. */
  passable(x: number, y: number, from?: { x: number; y: number }) {
    let map: LiveMap = this.map, sx = x, sy = y;
    if (!this.world.inside(map, x, y)) {
      const across = this.world.across(map, x, y);
      if (!across) return false;
      map = this.neighbour(across.group, across.number);
      sx = across.x;
      sy = across.y;
    }
    const coll = this.world.collision(map, sx, sy);
    if (from && map === this.map && this.world.inside(this.map, from.x, from.y)) {
      const dir = (Object.keys(STEP) as Facing[]).find(d => from.x + STEP[d][0] === x && from.y + STEP[d][1] === y);
      if (dir && this.world.sideBlocked(this.map, from.x, from.y, dir)) return false;
    }
    // Ledges are land: the player walks onto them, and jumps from them (hopLedge).
    if (this.save.state === "surf") return this.world.isWater(coll) || this.world.isLand(coll);
    return this.world.isLand(coll);
  }
  private neighbours = new Map<string, LiveMap>();
  neighbour(group: number, number: number): LiveMap {
    const key = `${group}:${number}`;
    let m = this.neighbours.get(key);
    if (!m) {
      m = this.world.live(this.header(group, number));
      if (this.neighbours.size > 8) this.neighbours.clear();
      this.neighbours.set(key, m);
    }
    return m;
  }
  collisionAt(x: number, y: number) {
    if (this.world.inside(this.map, x, y)) return this.world.collision(this.map, x, y);
    const across = this.world.across(this.map, x, y);
    if (!across) return C("COLL_WALL");
    return this.world.collision(this.neighbour(across.group, across.number), across.x, across.y);
  }

  private tryStep(dir: Facing) {
    const me = this.me, [dx, dy] = STEP[dir], nx = me.x + dx, ny = me.y + dy;
    const here = this.world.collision(this.map, me.x, me.y);
    // Warp carpets lead out when walking off them in their direction.
    if (this.world.carpet(here) === dir) {
      const warp = this.world.warpAt(this.map, me.x, me.y);
      if (warp >= 0) return void this.runScript(() => this.useWarp(warp));
    }
    const ahead = this.collisionAt(nx, ny);
    const boulder = this.objects.find(o => o.visible && o.x === nx && o.y === ny);
    if (boulder && this.pushBoulder(boulder)) return;
    if (this.blocked(nx, ny) || !this.passable(nx, ny, me)) {
      if (this.hopLedge(dir)) return;
      if (!this.bumped) this.sfx("SFX_BUMP");
      this.bumped = true;
      return;
    }
    if (this.save.state === "surf" && this.world.isLand(ahead) && !this.world.isWater(ahead)) this.save.state = "normal";
    this.bumped = false;
    me.from = { x: me.x, y: me.y, t: 0, duration: this.moveDuration() };
    me.x = nx;
    me.y = ny;
  }

  /**
   * TryJump: a ledge is the square the player stands on. When the step ahead is
   * blocked (by the cliff below it), facing the ledge's way jumps two squares.
   */
  private hopLedge(dir: Facing, from?: { x: number; y: number }) {
    const me = this.me, [dx, dy] = STEP[dir];
    if (this.save.state === "surf" || !this.world.canHop(this.world.collision(this.map, me.x, me.y), dir)) return false;
    if (this.blocked(me.x + dx * 2, me.y + dy * 2)) return false;
    me.from = { x: from?.x ?? me.x, y: from?.y ?? me.y, t: 0, duration: WALK_SECONDS * 2, hop: true };
    me.free = undefined;
    me.x += dx * 2;
    me.y += dy * 2;
    this.bumped = false;
    this.sfx("SFX_JUMP_OVER_LEDGE");
    return true;
  }

  private pushing = 0;
  /** Astra-style movement: any direction, with the map's rules applied as the player's centre enters a square. */
  private controlFree(dt: number) {
    const input = this.controlInput(), me = this.me;
    const heading = heldHeading(input, me.facing);
    if (!heading) {
      this.pushing = 0;
      this.bumped = false;
      me.moving = false;
      return;
    }
    const { across, along } = heading;
    me.facing = heading.facing;
    const here = this.world.collision(this.map, me.x, me.y);
    for (const dir of [along, across]) if (dir && this.world.carpet(here) === dir) {
      const warp = this.world.warpAt(this.map, me.x, me.y);
      if (warp >= 0) {
        me.facing = dir;
        me.moving = false;
        return void this.runScript(() => this.useWarp(warp));
      }
    }
    const from = me.free ?? { x: me.x, y: me.y };
    const centre = { x: from.x + 0.5, y: from.y + 0.5 };
    const moved = walkFreely(centre, heading, walkSpeed(input, { bike: this.save.state === "bike" }) * Math.min(dt, 0.05),
      (x, y) => this.freeBlocked(centre, x, y), p => Math.floor(p.x) !== me.x || Math.floor(p.y) !== me.y);
    const pos = { x: centre.x - 0.5, y: centre.y - 0.5 };
    me.free = pos;
    me.moving = moved > 0;
    me.stride = (me.stride ?? 0) + moved;
    const [fx, fy] = STEP[me.facing];
    const forward = (pos.x - from.x) * fx + (pos.y - from.y) * fy;
    if (forward > 1e-4 || (across && along && moved > 0)) {
      this.pushing = 0;
      this.bumped = false;
    } else if (this.pushAgainst(me.facing, pos)) return;
    const tx = Math.floor(centre.x), ty = Math.floor(centre.y);
    if (tx === me.x && ty === me.y) return;
    const coll = this.collisionAt(tx, ty);
    if (this.save.state === "surf" && this.world.isLand(coll) && !this.world.isWater(coll)) {
      this.save.state = "normal";
      this.ctx.sound?.refreshMusic();
    }
    me.x = tx;
    me.y = ty;
    void this.runScript(() => this.arrived());
  }
  private pushAgainst(dir: Facing, pos: { x: number; y: number }) {
    const me = this.me, [dx, dy] = STEP[dir];
    const lateral = dx ? Math.abs(pos.y - me.y) : Math.abs(pos.x - me.x);
    if (lateral < 0.35 && this.hopLedge(dir, pos)) return true;
    const boulder = this.objects.find(o => o.visible && o.x === me.x + dx && o.y === me.y + dy);
    if (boulder && lateral < 0.35) {
      this.pushing += 1 / 60;
      if (this.pushing > 0.25 && this.pushBoulder(boulder)) this.pushing = 0;
      return false;
    }
    if (!this.bumped) this.sfx("SFX_BUMP");
    this.bumped = true;
    return false;
  }
  /** Strength: walking into a boulder pushes it a square. */
  private pushBoulder(o: Obj) {
    if (!this.hasFlag("ENGINE_STRENGTH_ACTIVE")) return false;
    if (o.event.movement !== CONST.SPRITEMOVEDATA_STRENGTH_BOULDER) return false;
    void import("./field").then(f => f.pushBoulder(this, o));
    return true;
  }
  private freeBlocked(from: Position, x: number, y: number) {
    const me = this.me;
    return bodyEntersBlockedTile(from, x, y, (tx, ty) => {
      if (this.objects.some(o => o.visible && o.x === tx && o.y === ty)) return true;
      return !this.passable(tx, ty, Math.abs(tx - me.x) + Math.abs(ty - me.y) === 1 ? me : undefined);
    });
  }
  /** Finishes the square the player is crossing, so a scene starts from its centre. */
  settle(): Promise<void> {
    const me = this.me, free = me.free;
    me.free = undefined;
    me.moving = false;
    if (!free || me.from || !this.ctx.canvas) return Promise.resolve();
    const distance = Math.hypot(free.x - me.x, free.y - me.y);
    if (distance < 0.02) return Promise.resolve();
    return new Promise(resolve => {
      me.from = { x: free.x, y: free.y, t: 0, duration: Math.max(0.03, distance * WALK_SECONDS) };
      me.onPath = resolve;
    });
  }

  private updateMovers(dt: number) {
    const advance = (m: Mover) => {
      if (!m.from) return false;
      m.from.t += dt / m.from.duration;
      m.walkFrame += dt;
      if (m.from.t < 1) return false;
      m.from = undefined;
      return true;
    };
    if (advance(this.me)) {
      const scripted = this.me.onPath;
      this.me.onPath = undefined;
      if (scripted) scripted();
      else void this.runScript(() => this.arrived());
    }
    for (const o of this.objects) {
      if (!o.visible) {
        // A person hidden mid-walk has arrived, so a script waiting on the walk goes on.
        if (o.onPath) { const cb = o.onPath; Object.assign(o, { onPath: undefined, from: undefined }); cb(); }
        continue;
      }
      if (advance(o)) {
        const cb = o.onPath;
        o.onPath = undefined;
        cb?.();
        continue;
      }
      if (o.from || this.mode !== "world") continue;
      this.idle(o, dt);
    }
  }
  /** People's own movement: wandering, pacing and looking around. */
  private idle(o: Obj, dt: number) {
    o.wait -= dt;
    if (o.wait > 0) return;
    o.wait = 1 + Math.random() * 3;
    const fn = constName("SPRITEMOVEFN_", o.fn) ?? "";
    const spin = () => { o.facing = FACINGS[Math.floor(Math.random() * 4)]; };
    let options: Facing[] = [];
    if (fn === "SPRITEMOVEFN_RANDOM_WALK_XY") options = ["up", "down", "left", "right"];
    else if (fn === "SPRITEMOVEFN_RANDOM_WALK_Y") options = ["up", "down"];
    else if (fn === "SPRITEMOVEFN_RANDOM_WALK_X") options = ["left", "right"];
    else if (fn === "SPRITEMOVEFN_SLOW_RANDOM_SPIN" || fn === "SPRITEMOVEFN_FAST_RANDOM_SPIN") return spin();
    else if (fn === "SPRITEMOVEFN_SPIN_CLOCKWISE") { o.facing = ({ down: "left", left: "up", up: "right", right: "down" } as const)[o.facing]; return; }
    else if (fn === "SPRITEMOVEFN_SPIN_COUNTERCLOCKWISE") { o.facing = ({ down: "right", right: "up", up: "left", left: "down" } as const)[o.facing]; return; }
    if (!options.length) return;
    const dir = options[Math.floor(Math.random() * options.length)];
    o.facing = dir;
    const [dx, dy] = STEP[dir], x = o.x + dx, y = o.y + dy;
    const rx = o.event.radiusX || 1, ry = o.event.radiusY || 1;
    if (Math.abs(x - o.home.x) > rx || Math.abs(y - o.home.y) > ry) return;
    if (!this.world.inside(this.map, x, y) || this.blocked(x, y, o)) return;
    const coll = this.world.collision(this.map, x, y);
    if (!this.world.isLand(coll) || this.world.isWarp(coll) || this.world.ledge(coll)) return;
    if (this.map.warps.some(w => w.x === x && w.y === y)) return;
    o.from = { x: o.x, y: o.y, t: 0, duration: WALK_SECONDS * 1.4 };
    o.x = x;
    o.y = y;
  }

  /** The player finished a step: warps, coord events, step counters and encounters. */
  async arrived(): Promise<void> {
    if (this.crossEdge()) return;
    // CheckDailyResetTimer runs all the time on the cartridge: midnight passes while playing too.
    this.dailyReset();
    this.save.x = this.me.x;
    this.save.y = this.me.y;
    this.save.facing = this.me.facing;
    this.save.steps++;
    const coll = this.world.collision(this.map, this.me.x, this.me.y);
    const warp = this.world.warpAt(this.map, this.me.x, this.me.y);
    if (warp >= 0 && this.world.isWarp(coll) && !this.world.carpet(coll)) return this.useWarp(warp);
    const coord = this.map.coords.find(c => c.x === this.me.x && c.y === this.me.y && c.scene === this.sceneOf(this.map.group, this.map.number));
    if (coord) {
      // The cartridge starts the scene with the player on the square, so finish the step first.
      await this.settle();
      await runScript(this, coord.script);
      return;
    }
    const { countStep } = await import("./steps");
    if (await countStep(this)) return;
    // Ice, currents and spinners keep the player moving.
    const push = this.world.isIce(coll) ? this.me.facing : this.world.current(coll);
    if (push && !this.world.isBrake(coll)) {
      const [dx, dy] = STEP[push];
      if (this.passable(this.me.x + dx, this.me.y + dy, this.me) && !this.blocked(this.me.x + dx, this.me.y + dy)) {
        await this.walk(0, [push], { speed: 2, slide: this.world.isIce(coll) });
        return this.arrived();
      }
    }
    await this.afterArrival(false);
  }

  // ------------------------------------------------------------ trainers and encounters
  /**
   * _CheckTrainerBattle: an unbeaten trainer in the player's row or column,
   * facing them and within sight range. Water, walls and people in between
   * don't hide the player, as on the cartridge.
   */
  private watchingTrainer() {
    for (const o of this.objects) {
      if (!o.visible || o.event.type !== C("OBJECTTYPE_TRAINER") || !o.event.sight || o.event.script < 0x4000) continue;
      const [dx, dy] = STEP[o.facing];
      const ax = this.me.x - o.x, ay = this.me.y - o.y;
      const d = dx ? ax * dx : ay * dy;
      if ((dx ? ay : ax) !== 0 || d < 1 || d > o.event.sight) continue;
      const header = readTrainerHeader(this, o.event.script);
      if (this.event(header.flag)) continue;
      return { o, header };
    }
    return undefined;
  }
  /** A trainer who can see the player walks up and challenges them. */
  private async trainerSighting() {
    const seen = this.watchingTrainer();
    if (!seen) return false;
    // The trainer walks up to the player's square, so the player finishes stepping onto it.
    await this.settle();
    await this.trainerBattle(seen.o, seen.header, true);
    return true;
  }
  private lastLook = 0;
  /** The cartridge looks every frame, so a trainer who turns to face a player standing still sees them too. */
  private lookForTrainers() {
    if (this.clock - this.lastLook < 0.1) return;
    this.lastLook = this.clock;
    if (this.me.from || this.me.moving || !this.watchingTrainer()) return;
    void this.runScript(async () => { await this.trainerSighting(); });
  }
  async trainerBattle(o: Obj, header: TrainerHeader, seen: boolean) {
    this.lastTalked = o.slot;
    const { trainerScript } = await import("./battle");
    await trainerScript(this, o, header, seen);
  }
  /** SetUpFiveStepWildEncounterCooldown: entering a map (or coming back from a battle) keeps wild Pokémon away for four steps. */
  calmEncounters() { this.encounterCooldown = 4; }
  private async encounter() {
    if (this.encounterCooldown > 0) {
      this.encounterCooldown--;
      return;
    }
    const { tryWildEncounter } = await import("./battle");
    await tryWildEncounter(this);
  }
  startBattle(): Promise<number> {
    return import("./battle").then(m => m.startBattle(this));
  }
  /** After a battle: true when the player whited out, which ends the script that started it. */
  async afterBattle() {
    const { afterBattle } = await import("./battle");
    return afterBattle(this);
  }
  async catchTutorial() {
    const { catchTutorial } = await import("./battle");
    await catchTutorial(this);
  }

  // ------------------------------------------------------------ interaction
  front() {
    const [dx, dy] = STEP[this.me.facing];
    return { x: this.me.x + dx, y: this.me.y + dy };
  }
  async interact() {
    await this.settle();
    this.dailyReset();
    let { x, y } = this.front();
    let o = this.objects.find(o => o.visible && o.x === x && o.y === y);
    if (!o && this.world.isCounter(this.collisionAt(x, y))) {
      const [dx, dy] = STEP[this.me.facing];
      x += dx;
      y += dy;
      o = this.objects.find(o => o.visible && o.x === x && o.y === y);
    }
    if (o) return this.talkTo(o);
    ({ x, y } = this.front());
    const bg = this.map.bgs.find(b => b.x === x && b.y === y);
    if (bg && await this.bgEvent(bg)) return;
    const { tileCollisionScript } = await import("./services");
    if (await tileCollisionScript(this, this.collisionAt(x, y))) return;
    const { fieldPrompt } = await import("./field");
    await fieldPrompt(this);
  }
  async talkTo(o: Obj) {
    this.lastTalked = o.slot;
    this.sfx("SFX_READ_TEXT_2");
    const type = o.event.type;
    if (type === C("OBJECTTYPE_TRAINER") && o.event.script >= 0x4000) {
      if (!o.fixedFacing) o.facing = towards(o, this.me);
      return this.trainerBattle(o, readTrainerHeader(this, o.event.script), false);
    }
    if (type === C("OBJECTTYPE_ITEMBALL")) {
      const { pickUpItemBall } = await import("./services");
      return pickUpItemBall(this, o);
    }
    await runScript(this, o.event.script);
  }
  private async bgEvent(bg: BgEvent) {
    const kind = constName("BGEVENT_", bg.kind) ?? "";
    const facing: Record<string, Facing> = { BGEVENT_UP: "up", BGEVENT_DOWN: "down", BGEVENT_LEFT: "left", BGEVENT_RIGHT: "right" };
    if (facing[kind] && facing[kind] !== this.me.facing) return false;
    if (kind === "BGEVENT_ITEM") {
      const { hiddenItem } = await import("./services");
      return hiddenItem(this, bg);
    }
    if (kind === "BGEVENT_IFSET" || kind === "BGEVENT_IFNOTSET") {
      const flag = this.rom.u16(bg.script), at = this.rom.at(this.map.bank, this.rom.u16(bg.script + 2));
      if (this.event(flag) !== (kind === "BGEVENT_IFSET")) return false;
      await runScript(this, at);
      return true;
    }
    if (kind === "BGEVENT_COPY") return false;
    await runScript(this, bg.script);
    return true;
  }

  // ------------------------------------------------------------ services the commands use
  async receivedItem(item: number, count: number, ok: boolean) {
    const { receivedItem } = await import("./services");
    await receivedItem(this, item, count, ok);
  }
  async itemNotify() {
    const { itemNotify } = await import("./services");
    await itemNotify(this);
  }
  async pocketIsFull() {
    const { pocketIsFull } = await import("./services");
    await pocketIsFull(this);
  }
  async pokemart(kind: number, id: number) {
    const { pokemart } = await import("./services");
    await this.modal(() => pokemart(this, kind, id));
  }
  async elevator(at: number) {
    const { elevator } = await import("./services");
    return elevator(this, at);
  }
  async npcTrade(index: number) {
    const { npcTrade } = await import("./services");
    await npcTrade(this, index);
  }
  swarm(kind: number, group: number, number: number) { this.save.swarm = { kind, group, number }; }
  async hallOfFame() {
    const { hallOfFame } = await import("./services");
    await this.modal(() => hallOfFame(this));
  }
  async credits() {
    await this.say("Congratulations! Your adventure continues…");
  }
  resetPhoneCallTimer() {
    this.phoneDelayIndex = 0;
    this.nextPhoneCallMinute = Math.floor(this.now().getTime() / 60_000) + PHONE_CALL_DELAYS[0];
  }
  private checkForPhoneCall() {
    if (this.me.from || this.save.contest) return;
    const minute = Math.floor(this.now().getTime() / 60_000);
    if (minute < this.nextPhoneCallMinute) return;
    const tile = this.world.collision(this.map, this.me.x, this.me.y);
    if ([CONST.COLL_DOOR, CONST.COLL_DOOR_79, CONST.COLL_STAIRCASE, CONST.COLL_CAVE].includes(tile)) return;
    // Each expired timer starts the next delay, even if the roll misses or nobody can call.
    this.phoneDelayIndex = Math.min(this.phoneDelayIndex + 1, PHONE_CALL_DELAYS.length - 1);
    this.nextPhoneCallMinute = minute + PHONE_CALL_DELAYS[this.phoneDelayIndex];
    if (Math.random() < 0.5 && !this.map.phoneService) startRandomCall(this);
  }
  addPhoneNumber(contact: number) {
    if (this.save.phone.includes(contact)) return true;
    if (this.save.phone.length >= 10) return false;
    this.save.phone.push(contact);
    return true;
  }
  deletePhoneNumber(contact: number) {
    const had = this.save.phone.includes(contact);
    this.save.phone = this.save.phone.filter(c => c !== contact);
    return had;
  }
  async phoneCallText(at: number) {
    await this.writeText(at);
  }
  async hangUp() {
    this.sfx("SFX_HANG_UP");
    this.closeText();
  }
  contestMinutes() {
    const c = this.save.contest;
    if (!c) return 0;
    return Math.max(0, Math.ceil(c.minutes - (this.save.seconds - c.started) / 60));
  }
  writeCmdQueue(at: number) { this.save.vars.cmdQueue = at; }
  delCmdQueue(index: number) { void index; const had = !!this.save.vars.cmdQueue; delete this.save.vars.cmdQueue; return had; }

  /** Runs a screen over the map (menus, marts, the PC) with the player locked. */
  /** Runs a screen that takes menu input, then gives input back to whatever had it (the start menu, a script). */
  async modal<T>(run: () => Promise<T>): Promise<T> {
    const previous = this.mode;
    this.mode = "menu";
    try {
      return await run();
    } finally {
      this.mode = previous;
    }
  }
  private async openMenu() {
    this.mode = "menu";
    this.sfx("SFX_MENU");
    const { openCrystalMenu } = await import("./menu");
    const after = await openCrystalMenu(this);
    this.layer.replaceChildren();
    this.mode = "world";
    if (after) await this.runScript(after);
  }

  // ------------------------------------------------------------ saving
  persist(force = false) {
    this.lastSave = this.save.steps;
    this.save.events = [...this.events];
    this.save.flags = [...this.flags];
    this.save.x = Math.round(this.me.from ? this.me.from.x : this.me.x);
    this.save.y = Math.round(this.me.from ? this.me.from.y : this.me.y);
    this.save.facing = this.me.facing;
    this.save.vars.badgeCount = this.badges().count;
    if (!this.ctx.store) return Promise.resolve();
    return this.ctx.store.write(this.save, !force).then(() => {
      if (this.saveIssue && this.ctx.saveWarning) this.ctx.saveWarning.hidden = true;
      this.saveIssue = false;
    }, error => {
      this.saveIssue = true;
      if (!this.ctx.saveWarning) return;
      this.ctx.saveWarning.hidden = false;
      this.ctx.saveWarning.textContent = error instanceof JourneyConflict ? "Newer save in another window" : "Unsaved progress · Menu → Save";
    });
  }
  summary() {
    return crystalSummary(this.save, titleCase(this.rom.landmarkName(this.landmark()) || mapName(this.map.group, this.map.number) || "Johto"));
  }
}

export function towards(from: { x: number; y: number }, to: { x: number; y: number }): Facing {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
/** A cartridge name in title case: "LAKE OF RAGE" → "Lake of Rage", "DRAGON'S DEN" → "Dragon's Den", "MT.MORTAR" → "Mt. Mortar". */
export function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s.-])([a-zé])/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\bPokémon\b/i, "Pokémon").replace(/(?<=\S) Of (?=\S)/g, " of ").replace(/\bMt\.(?=\S)/g, "Mt. ");
}
function popcount(n: number) {
  let c = 0;
  for (; n; n &= n - 1) c++;
  return c;
}
function setByte(value: number, byte: number, v: number) {
  return (value & ~(0xff << (8 * byte))) | (v << (8 * byte));
}
void ITEM;
void MON;
void opposite;
export type { Pokemon };
