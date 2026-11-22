/**
 * Pokémon Yellow, played with Astra's engine: the Crystal battle engine, menus
 * and audio, over maps, dialogue and events read from the player's cartridge.
 */
import type { Engine, Pokemon } from "../engine";
import type { PokemonPortrait } from "../engine/appearance";
import type { Input } from "../game/input";
import { BODY_RADIUS, WALK_SPEED, bodyTouches, heldHeading, walkFreely, walkSpeed } from "../game/free-movement";
import type { GameAudio } from "../game/audio";
import type { MenuInput } from "../ui/menu-input";
import type { MusicScene } from "../game/music";
import { escapeHtml, panel } from "../ui/shell";
import { BattleLaunch, type FinishedBattle } from "../ui/battle-launch";
import { JourneyConflict, type JourneyStore } from "../game/storage";
import { cartridgeInUse, EVENT, HS, ITEM, MAP, MAP_OBJECT, MAP_SCRIPT, MAP_TEXT, MON, RAM, SPRITE, SYM, TEXT_PREDEFS, TRAINER } from "./symbols";
import { YellowRom, type MapHeader, type MapObject, type TextOp } from "./rom";
import { YellowWorld, STEP, opposite, type Facing } from "./world";
import { YellowGraphics, mapPalette, type Rgb } from "./gfx";
import { CrystalGraphics } from "./crystal-gfx";
import { CrystalSprites } from "./crystal-sprites";
import { yellowSummary, type YellowSave } from "./save";
import { mapScript, sharedText, type Actor, type BattleOutcome, type Emote, type Game } from "./script";
import { textPages } from "./textbox";
import { asmPlan } from "./asm";
import { specialMoves, withMoves } from "./learnsets";
import { crystalItemMap } from "./items";
import { SAFARI_MAPS, safariBattle } from "./safari";
import { safariGameOver } from "./scripts/safari";
import { crystalMusic } from "./music";
import { openYellowMenu } from "./menu";
import { trainerTrigger, trainerHeaders, type TrainerHeader } from "./trainers";
import "./scripts";
import "./yellow.css";

export interface YellowContext {
  engine: Engine;
  rom: YellowRom;
  input: Input;
  menuInput: MenuInput;
  layer: HTMLElement;
  canvas: HTMLCanvasElement;
  sound: GameAudio;
  sprite: (mon: PokemonPortrait | number, back?: boolean) => string;
  cry: (species: number) => void;
  store: JourneyStore;
  save: YellowSave;
  /** Leaves Yellow for the journey list. */
  exit: () => void;
  saveWarning: HTMLElement;
}

interface Mover {
  x: number;
  y: number;
  facing: Facing;
  /** Fractional progress of the current step. */
  from?: { x: number; y: number; t: number; duration: number; hop?: boolean };
  walkFrame: number;
  /**
   * With free movement: the position in squares between steps. `x` and `y`
   * stay the square under the actor's centre, which is what scripts see.
   */
  free?: { x: number; y: number };
  /** Distance walked freely, which sets the walking frame. */
  stride?: number;
  moving?: boolean;
}
interface Npc extends Mover {
  object: MapObject;
  home: { x: number; y: number };
  wait: number;
  path: Facing[];
  onPath?: () => void;
  hidden: boolean;
  emote?: { kind: Emote; until: number };
}

const WALK_SECONDS = 1 / 4.2;
const TEXT_RESET = new Set(["wait", "done"]);

export class YellowGame implements Game {
  readonly rom: YellowRom;
  readonly world: YellowWorld;
  readonly gfx: YellowGraphics;
  readonly crystal: CrystalGraphics;
  readonly crystalSprites: CrystalSprites;
  save: YellowSave;
  private ctx2d: CanvasRenderingContext2D;
  private mode: "world" | "script" | "menu" | "battle" | "text" = "world";
  private me: Mover;
  private pikachu?: Mover & { visible: boolean; trail: { x: number; y: number }[] };
  private npcs: Npc[] = [];
  private header!: MapHeader;
  private palette!: Rgb[];
  private trainers: TrainerHeader[] = [];
  private standingOnWarp = false;
  private textVars = new Map<number, string>();
  private resume?: (value?: unknown) => void;
  private yesNoResolve?: (yes: boolean) => void;
  private pages: string[] = [];
  private lastSave = 0;
  private turnHeld = 0;
  private fadeLevel = 0;
  private currentMusic?: number;
  private clock = 0;
  private encounterCooldown = 0;
  private saveIssue = false;
  private stopped = false;

  constructor(readonly ctx: YellowContext) {
    this.rom = ctx.rom;
    this.world = new YellowWorld(ctx.rom);
    this.gfx = new YellowGraphics(ctx.rom);
    this.crystal = new CrystalGraphics(ctx.rom, ctx.engine.cartridge, data => ctx.engine.decompress(data));
    this.crystalSprites = new CrystalSprites(ctx.rom, ctx.engine.cartridge);
    this.save = ctx.save;
    this.ctx2d = ctx.canvas.getContext("2d")!;
    this.me = { x: this.save.x, y: this.save.y, facing: this.save.facing, walkFrame: 0 };
    this.enterMap(this.save.map, false);
    ctx.input.setGamepadLayout(!!this.save.settings.swapGamepadAB);
    ctx.sound.attach(ctx.engine, this.save.settings.music !== false);
    void this.runScript(() => this.afterArrival(true));
  }

  stop() {
    this.stopped = true;
    this.ctx.layer.replaceChildren();
  }

  // ------------------------------------------------------------ Game interface
  get map() { return this.header.id; }
  get mapLabel() { return this.header.label; }
  get legacy() { return cartridgeInUse() === "legacy"; }
  /** The current map's script, with Yellow Legacy's logic on Legacy's cartridge. */
  private get script() { return mapScript(this.header.label, this.legacy); }
  get playerState() { return this.me; }
  get currentMap() { return this.header; }
  /** Strength stays active until the player leaves the map. */
  strength = false;
  objectAt(x: number, y: number) {
    return this.npcs.find(n => !n.hidden && n.x === x && n.y === y);
  }
  get player() { return this.me; }
  get money() { return this.save.money; }
  set money(v: number) { this.save.money = Math.max(0, Math.min(999999, Math.floor(v))); }
  get coins() { return this.save.coins; }
  set coins(v: number) { this.save.coins = Math.max(0, Math.min(9999, Math.floor(v))); }
  get vars() { return this.save.vars; }
  get state() { return this.save.vars["script:" + this.header.label] ?? 0; }
  set state(v: number) { this.save.vars["script:" + this.header.label] = v; }

  private eventIndex(name: string) {
    const i = EVENT[name];
    if (i === undefined) throw Error(`Unknown event ${name}`);
    return i;
  }
  ev(name: string) { return this.save.events.includes(this.eventIndex(name)); }
  set(name: string) { this.setEvent(this.eventIndex(name), true); }
  reset(name: string) { this.setEvent(this.eventIndex(name), false); }
  setEvent(index: number, on: boolean) {
    const has = this.save.events.includes(index);
    if (on && !has) this.save.events.push(index);
    if (!on && has) this.save.events = this.save.events.filter(e => e !== index);
  }
  private hsIndex(name: string) {
    const i = HS[name];
    if (i === undefined) throw Error(`Unknown object ${name}`);
    return i;
  }
  shown(hs: string) { return !this.save.hidden.includes(this.hsIndex(hs)); }
  show(hs: string) { this.toggle(this.hsIndex(hs), true); }
  hide(hs: string) { this.toggle(this.hsIndex(hs), false); }
  private toggle(index: number, shown: boolean) {
    this.save.hidden = this.save.hidden.filter(h => h !== index);
    if (!shown) this.save.hidden.push(index);
    const entry = this.rom.missables()[index];
    if (entry?.map === this.header.id) {
      const npc = this.npcs.find(n => n.object.index === entry.object);
      if (npc) {
        if (shown && npc.hidden) Object.assign(npc, { x: npc.object.x, y: npc.object.y, from: undefined, path: [] });
        npc.hidden = !shown;
      }
    }
  }
  textVar(name: string, value: string | number) {
    const addr = RAM[name];
    if (addr === undefined) throw Error(`Unknown text variable ${name}`);
    this.textVars.set(addr, String(value));
  }

  npc(index: number) {
    const n = this.npcs.find(n => n.object.index === index && !n.hidden);
    return n && { x: n.x, y: n.y, facing: n.facing };
  }
  private actor(who: Actor): Mover | undefined {
    if (who === "player") return this.me;
    if (who === "pikachu") return this.pikachu;
    return this.npcs.find(n => n.object.index === who);
  }
  face(who: Actor, facing: Facing) {
    const a = this.actor(who);
    if (a) a.facing = facing;
  }
  facePlayer(index: number) {
    const n = this.npcs.find(n => n.object.index === index);
    if (n) n.facing = this.towards(n, this.me);
  }
  private towards(from: { x: number; y: number }, to: { x: number; y: number }): Facing {
    const dx = to.x - from.x, dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  }
  move(who: Actor, path: string, options: { speed?: number; ignoreCollision?: boolean } = {}) {
    const steps: Facing[] = [];
    for (const m of path.toUpperCase().matchAll(/([UDLR])(\d*)/g)) {
      const dir = ({ U: "up", D: "down", L: "left", R: "right" } as const)[m[1] as "U"];
      for (let i = 0; i < (m[2] ? +m[2] : 1); i++) steps.push(dir);
    }
    return this.walk(who, steps, options.speed ?? 1);
  }
  private async walk(who: Actor, steps: Facing[], speed = 1): Promise<void> {
    const a = this.actor(who);
    if (!a || !steps.length) return;
    // Scenes move in whole squares, so the player first finishes the square they are crossing.
    await this.settle();
    return new Promise(resolve => {
      const queue = [...steps];
      const next = () => {
        const dir = queue.shift();
        if (!dir) return resolve();
        a.facing = dir;
        const [dx, dy] = STEP[dir];
        const fromX = a.free?.x ?? a.x, fromY = a.free?.y ?? a.y;
        a.free = undefined;
        if (who === "player") this.pikachuFollow(a.x, a.y);
        a.x += dx;
        a.y += dy;
        a.from = { x: fromX, y: fromY, t: 0, duration: WALK_SECONDS / speed };
        (a as Npc).onPath = next;
        if (who === "player") (this.me as Mover & { onPath?: () => void }).onPath = () => {
          this.crossEdge();
          next();
        };
      };
      next();
    });
  }
  async approach(index: number) {
    const n = this.npcs.find(n => n.object.index === index);
    if (!n) return;
    await this.settle();
    const path: Facing[] = [];
    let { x, y } = n;
    while (Math.abs(this.me.x - x) + Math.abs(this.me.y - y) > 1) {
      const dir = x !== this.me.x && (y === this.me.y || Math.abs(this.me.x - x) > Math.abs(this.me.y - y))
        ? (this.me.x > x ? "right" : "left") : (this.me.y > y ? "down" : "up");
      path.push(dir);
      x += STEP[dir][0];
      y += STEP[dir][1];
      if (path.length > 40) break;
    }
    await this.walk(index, path);
    n.facing = this.towards(n, this.me);
  }
  place(who: Actor, x: number, y: number, facing?: Facing) {
    const a = this.actor(who);
    if (!a) return;
    a.x = x;
    a.y = y;
    a.from = undefined;
    a.free = undefined;
    if (facing) a.facing = facing;
    if (who === "player") this.resetTrail();
    if (who !== "player" && who !== "pikachu") {
      const n = a as Npc;
      n.home = { x, y };
      n.path = [];
    }
  }
  async emote(who: Actor, kind: Emote) {
    const a = this.actor(who) as Npc | undefined;
    if (!a) return;
    a.emote = { kind, until: this.clock + 0.9 };
    await Promise.all([this.delay(54), this.settle()]);
  }

  hasItem(item: string, count = 1) { return (this.save.items[this.itemId(item)] ?? 0) >= count; }
  private itemId(item: string) {
    const id = ITEM[item];
    if (id === undefined) throw Error(`Unknown item ${item}`);
    return id;
  }
  give(item: string, count = 1) {
    const id = this.itemId(item), key = String(id);
    // GiveItem leaves the item's name where "received" texts print it.
    this.textVar("wStringBuffer", this.rom.itemName(id));
    this.textVar("wNameBuffer", this.rom.itemName(id));
    const kinds = Object.keys(this.save.items).filter(k => this.save.items[k] > 0);
    if (!this.save.items[key] && kinds.length >= 20) return false;
    if ((this.save.items[key] ?? 0) + count > 99) return false;
    this.save.items[key] = (this.save.items[key] ?? 0) + count;
    return true;
  }
  take(item: string, count = 1) {
    const key = String(this.itemId(item));
    if ((this.save.items[key] ?? 0) < count) return false;
    this.save.items[key] -= count;
    if (!this.save.items[key]) delete this.save.items[key];
    return true;
  }
  partyHas(species: string) {
    const dex = this.rom.dex(MON[species]);
    return this.save.party.some(m => m.species === dex);
  }
  async giveMon(species: string, level: number, options: { nickname?: string; message?: boolean } = {}) {
    const dex = this.rom.dex(MON[species]);
    const mon = this.makeMon(dex, level, options.nickname);
    this.textVar("wStringBuffer", this.rom.monName(MON[species]));
    this.textVar("wNameBuffer", this.rom.monName(MON[species]));
    if (this.save.party.length < 6) this.save.party.push(mon);
    else this.save.storage.push(mon);
    this.register(dex, true);
    if (options.message !== false) {
      this.ctx.sound.overworld("item");
      await this.say(`${this.me.facing ? "" : ""}{PLAYER} got ${this.rom.monName(MON[species])}!${this.save.party.includes(mon) ? "" : " It was sent to the PC."}`);
    }
    return mon;
  }
  makeMon(dex: number, level: number, nickname?: string): Pokemon {
    const mon = this.ctx.engine.makePokemon(dex, level);
    return { ...mon, ot_id: this.otId(), ot_name: this.save.name, nickname: nickname ?? mon.nickname };
  }
  otId() {
    this.save.vars.otId ??= Math.floor(Math.random() * 65536);
    return this.save.vars.otId;
  }
  register(dex: number, caught: boolean) {
    if (!this.save.seen.includes(dex)) this.save.seen.push(dex);
    if (caught && !this.save.caught.includes(dex)) this.save.caught.push(dex);
  }

  heal() { this.save.party = this.save.party.map(m => this.ctx.engine.healPokemon(m)); }
  badge(index: number) { this.save.badges |= 1 << index; }
  hasBadge(index: number) { return !!(this.save.badges & (1 << index)); }
  private musicOverride?: number | null;
  music(name?: string) {
    this.musicOverride = name ? crystalMusic(name) : undefined;
    this.ctx.sound.refreshMusic();
  }
  sfx(name: string) {
    const kind = ({ SFX_GET_ITEM_1: "item", SFX_GET_KEY_ITEM: "item", SFX_HEAL_MACHINE: "interact", SFX_GO_INSIDE: "door", SFX_GO_OUTSIDE: "exit", SFX_COLLISION: "bump", SFX_LEDGE: "exit", SFX_PUSH_BOULDER: "strength", SFX_TELEPORT_ENTER_1: "fly", SFX_TELEPORT_EXIT_1: "fly", SFX_ENTER_PC: "bootPc", SFX_TURN_OFF_PC: "shutDownPc", SFX_CUT: "cut", SFX_SWAP: "interact", SFX_PRESS_AB: "interact", SFX_START_MENU: "interact", SFX_LEVEL_UP: "item", SFX_POKEDEX_RATING: "item", SFX_TRADE_MACHINE: "interact", SFX_SS_ANNE_HORN: "door", SFX_STOP_ALL_MUSIC: "interact" } as Record<string, string>)[name];
    if (kind) this.ctx.sound.overworld(kind as never);
  }
  cry(species: string) { this.ctx.cry(this.rom.dex(MON[species])); }
  delay(frames: number) {
    return new Promise<void>(resolve => {
      const until = this.clock + frames / 60;
      this.waiters.push({ until, resolve });
    });
  }
  private waiters: { until: number; resolve: () => void }[] = [];
  async fade(during?: () => void | Promise<void>) {
    await this.fadeTo(1);
    await during?.();
    await this.fadeTo(0);
  }
  private fadeTarget = 0;
  private fadeResolve?: () => void;
  private fadeTo(level: number) {
    this.fadeTarget = level;
    return new Promise<void>(resolve => { this.fadeResolve = resolve; });
  }
  log(message: string) { console.info(`[yellow:${this.header.label}]`, message); }

  // ------------------------------------------------------------ text
  /** Shows text from a cartridge label, a TEXT_* name or a map text id. */
  async text(ref: string | number, options: { wait?: boolean } = {}): Promise<void> {
    if (typeof ref === "string" && ref.startsWith("TEXT_")) {
      const id = MAP_TEXT[this.header.label]?.[ref];
      if (id === undefined) throw Error(`Unknown text ${ref} on ${this.header.label}`);
      return this.textId(id, options);
    }
    if (typeof ref === "number") return this.textId(ref, options);
    const at = SYM[ref];
    if (at === undefined) throw Error(`Unknown text label ${ref}`);
    await this.runText(ref, at, options);
  }
  private async textId(id: number, options: { wait?: boolean } = {}): Promise<void> {
    const constants = MAP_TEXT[this.header.label] ?? {};
    const name = Object.keys(constants).find(k => constants[k] === id);
    const override = name && this.script?.texts?.[name];
    if (override) return override(this);
    const at = this.rom.mapText(this.header, id);
    await this.runText(this.rom.label(at) ?? `@${at}`, at, options);
  }
  /** Runs a text entry: printed text, text_asm handlers and special scripts. */
  private async runText(label: string, at: number, options: { wait?: boolean } = {}): Promise<void> {
    const ops = this.rom.text(at);
    const asm = ops.find(op => op.op === "asm");
    const script = ops.find(op => op.op === "script") as Extract<TextOp, { op: "script" }> | undefined;
    const printed = ops.filter(op => op.op !== "asm" && op.op !== "script");
    if (printed.length) await this.showText(printed, asm || script ? false : options.wait !== false);
    if (script) return this.special(script.kind, script.at);
    if (!asm) return;
    const handler = this.textHandler(label, at);
    if (handler) return handler(this);
    const plan = asmPlan(this.rom, this.header.bank, (asm as { at: number }).at);
    if (plan.kind === "end") return;
    if (plan.kind === "print") {
      if (plan.pikachu !== undefined) this.ctx.cry(25);
      for (const at of plan.at) await this.runText(this.rom.label(at) ?? `@${at}`, at, options);
      return;
    }
    if (plan.kind === "trainer") {
      const trainer = this.trainers.find(t => t.at === plan.at);
      if (trainer) return this.talkToTrainer(trainer);
    }
    if (plan.kind === "far") {
      const routine = this.rom.label(plan.at);
      const far = routine && this.textHandler(routine, plan.at);
      if (far) return far(this);
      label = routine ?? label;
    }
    this.log(`No handler for ${label}`);
    if (!printed.length) await this.say("…");
  }
  /** The handler for a text, by its label or any other label at the same address. */
  private textHandler(label: string, at?: number) {
    const texts = this.script?.texts;
    for (const name of [label, ...at === undefined ? [] : this.rom.labelsAt(at)]) {
      const handler = texts?.[name] ?? sharedText(name, this.legacy);
      if (handler) return handler;
    }
  }
  /** Shows a literal string (with {PLAYER} and {RIVAL}). */
  say(text: string, wait = true) {
    return this.showText([{ op: "text", s: text }], wait);
  }
  private resolveVar = (op: TextOp) => {
    if (op.op === "ram") return this.ramString(op.addr);
    if (op.op === "num" || op.op === "bcd") return this.ramString(op.addr);
    return "";
  };
  private ramString(addr: number) {
    if (addr === RAM.wPlayerName) return this.save.name;
    if (addr === RAM.wRivalName) return this.save.rival;
    if (addr === RAM.wPlayerMoney) return String(this.save.money);
    if (addr === RAM.wPlayerCoins) return String(this.save.coins);
    return this.textVars.get(addr) ?? "";
  }
  /** Displays pages of text and resolves once the player has read them. */
  showText(ops: TextOp[], wait = true): Promise<void> {
    for (const op of ops) if (op.op === "sound") this.ctx.sound.overworld("item");
    const pages = textPages(ops, this.resolveVar, this.save.name, this.save.rival);
    if (!pages.length) return Promise.resolve();
    this.pages = pages;
    const previous = this.mode;
    this.mode = "text";
    return new Promise(resolve => {
      this.resume = () => {
        this.mode = previous === "text" ? "script" : previous;
        resolve();
      };
      this.renderPage(wait);
    });
  }
  private lastPageWait = true;
  private renderPage(wait = this.lastPageWait) {
    this.lastPageWait = wait;
    const page = this.pages[0] ?? "";
    const last = this.pages.length === 1;
    this.ctx.layer.innerHTML = `<div class="dialogue yellow-text" role="status">${escapeHtml(page)}${!last || wait ? `<span class="advance">${this.ctx.input.confirmLabel} ▸</span>` : ""}</div>`;
    this.ctx.layer.querySelector(".dialogue")?.addEventListener("click", () => this.advanceText());
    if (last && !wait) {
      const done = this.resume;
      this.resume = undefined;
      done?.();
    }
  }
  private advanceText() {
    if (this.mode !== "text" && !(this.pages.length && this.resume)) return;
    this.pages.shift();
    if (this.pages.length) return this.renderPage();
    this.ctx.layer.replaceChildren();
    const done = this.resume;
    this.resume = undefined;
    done?.();
  }
  yesNo(): Promise<boolean> {
    const previous = this.mode;
    this.mode = "menu";
    return new Promise(resolve => {
      const box = document.createElement("div");
      box.className = "yellow-yesno";
      box.innerHTML = `<button data-yes>YES</button><button data-no>NO</button>`;
      this.ctx.layer.append(box);
      const finish = (yes: boolean) => {
        this.yesNoResolve = undefined;
        this.ctx.layer.replaceChildren();
        this.mode = previous === "menu" ? "script" : previous;
        resolve(yes);
      };
      this.yesNoResolve = finish;
      box.querySelector<HTMLButtonElement>("[data-yes]")!.onclick = () => finish(true);
      box.querySelector<HTMLButtonElement>("[data-no]")!.onclick = () => finish(false);
      box.querySelector<HTMLButtonElement>("[data-yes]")!.focus({ preventScroll: true });
    });
  }

  // ------------------------------------------------------------ maps
  private enterMap(id: number, fromWarp: boolean) {
    // A private copy of the blocks lets scripts open doors and move gates.
    const base = this.world.map(id);
    const fromOutside = !this.header || this.header.id < 0x25;
    this.header = { ...base, blocks: base.blocks.slice() };
    this.strength = false;
    this.save.vars.noWildBattles = 0;
    if (id < 0x25) this.save.vars.dark = 0;
    else if (id === MAP.ROCK_TUNNEL_1F && fromOutside && fromWarp) this.save.vars.dark = 1;
    this.blocksVersion++;
    this.save.map = id;
    if (id < 0x25) {
      this.save.lastMap = id;
      if (!this.save.visited.includes(id) && id < 0x0b) this.save.visited.push(id);
    }
    this.palette = mapPalette(this.rom, this.header, this.save.lastMap);
    this.trainers = trainerHeaders(this.rom, this.header);
    const missables = this.rom.missables();
    this.npcs = this.header.objects.map(object => {
      const hs = missables.findIndex(m => m.map === id && m.object === object.index);
      const stay = !object.walk;
      const facing: Facing = stay ? ({ 0xd0: "down", 0xd1: "up", 0xd2: "left", 0xd3: "right" } as Record<number, Facing>)[object.range] ?? "down" : "down";
      return {
        object, x: object.x, y: object.y, facing, walkFrame: 0, home: { x: object.x, y: object.y },
        wait: 1 + Math.random() * 2, path: [], hidden: hs >= 0 && this.save.hidden.includes(hs),
      };
    });
    this.standingOnWarp = fromWarp;
    this.encounterCooldown = 3;
    this.musicOverride = undefined;
    this.ctx.sound.refreshMusic();
    this.placePikachu();
    // Map setup (blocks, objects) runs before the map is shown.
    void this.script?.onEnter?.(this);
  }
  private blocksVersion = 0;
  setBlock(bx: number, by: number, block: number) {
    if (bx < 0 || by < 0 || bx >= this.header.width || by >= this.header.height) return;
    this.header.blocks[by * this.header.width + bx] = block;
    this.blocksVersion++;
    this.animTiles.delete(this.header.id);
  }
  get scene() { return this.mode === "battle" ? "battle" : "world"; }
  /** Battle themes by opponent, then the map's own song. */
  musicScene(): MusicScene | number {
    if (this.mode === "battle") {
      if (this.battleCue) return this.battleCue as MusicScene;
      if (!this.inBattle?.trainer) return 8;
      const klass = this.inBattle.klass ?? 0;
      if (klass === TRAINER.RIVAL3) return 47;
      return isLeader(klass) ? 6 : 7;
    }
    return this.musicTrack() ?? 0;
  }
  /** Where the map's music comes from: the cartridge's song table, played with Crystal's Kanto arrangements. */
  musicTrack(): number | undefined {
    if (this.mode === "battle") return undefined;
    if (this.musicOverride !== undefined) return this.musicOverride ?? undefined;
    if (this.save.surfing) return crystalMusic("MUSIC_SURFING");
    if (this.save.bike) return crystalMusic("MUSIC_BIKE_RIDING");
    const song = this.rom.mapSong(this.header.id);
    return crystalMusic(song.id);
  }

  private crossEdge() {
    const { w, h } = this.world.cells(this.header);
    if (this.me.x >= 0 && this.me.y >= 0 && this.me.x < w && this.me.y < h) return;
    const place = this.world.resolve(this.header, this.me.x, this.me.y);
    if (!place) return;
    const dx = place.x - this.me.x, dy = place.y - this.me.y;
    const shift = (m?: Mover) => {
      if (!m) return;
      m.x += dx;
      m.y += dy;
      for (const p of [m.from, m.free]) if (p) {
        p.x += dx;
        p.y += dy;
      }
    };
    shift(this.me);
    shift(this.pikachu);
    if (this.pikachu) this.pikachu.trail = this.pikachu.trail.map(p => ({ x: p.x + dx, y: p.y + dy }));
    const pikachu = this.pikachu;
    this.enterMap(place.map, false);
    if (pikachu && this.pikachu) Object.assign(this.pikachu, { x: pikachu.x, y: pikachu.y, from: pikachu.from, free: pikachu.free, trail: pikachu.trail, visible: pikachu.visible });
  }

  /** Teleports to a map square, as a script warp or a door. */
  async warp(map: string, x: number, y: number, facing?: Facing) {
    const id = MAP[map];
    if (id === undefined) throw Error(`Unknown map ${map}`);
    await this.fade(() => {
      this.me.x = x;
      this.me.y = y;
      this.me.from = undefined;
      this.me.free = undefined;
      if (facing) this.me.facing = facing;
      this.enterMap(id, true);
    });
    await this.script?.onStep?.(this);
  }

  private async useWarp(index: number) {
    const warp = this.header.warps[index];
    let target = warp.map === 0xff ? this.save.lastMap : warp.map;
    const dest = this.rom.map(target);
    if (!dest) return;
    const arrival = dest.warps[warp.warp];
    if (!arrival) return;
    const outdoorsBefore = this.header.id < 0x25;
    this.ctx.sound.overworld(outdoorsBefore ? "door" : "exit");
    await this.fade(() => {
      this.me.x = arrival.x;
      this.me.y = arrival.y;
      this.me.from = undefined;
      this.me.free = undefined;
      this.enterMap(target, true);
    });
    target = this.header.id;
    // Leaving a building through a door steps the player out onto the street.
    if (this.world.door(this.header, this.me.x, this.me.y)) {
      await this.walk("player", ["down"]);
      this.standingOnWarp = false;
    }
    await this.script?.onStep?.(this);
    this.persist();
  }

  // ------------------------------------------------------------ main loop
  frame(now: number, dt: number) {
    if (this.stopped) return;
    this.clock += dt;
    this.save.seconds += dt;
    const input = this.ctx.input;
    for (const w of [...this.waiters]) if (this.clock >= w.until) {
      this.waiters.splice(this.waiters.indexOf(w), 1);
      w.resolve();
    }
    // Fades
    const target = this.fadeTarget;
    if (this.fadeLevel !== target) {
      this.fadeLevel += Math.sign(target - this.fadeLevel) * Math.min(Math.abs(target - this.fadeLevel), dt * 5);
      if (this.fadeLevel === target) {
        const r = this.fadeResolve;
        this.fadeResolve = undefined;
        r?.();
      }
    }
    if (this.mode === "text") {
      if (input.hit("a") || input.hit("b")) this.advanceText();
    } else if (this.mode === "menu") {
      if (this.showcaseNext) {
        if (input.hit("a") || input.hit("b")) this.showcaseNext();
      } else if (this.yesNoResolve) {
        const buttons = [...this.ctx.layer.querySelectorAll<HTMLButtonElement>(".yellow-yesno button")];
        const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (input.hit("up") || input.hit("down")) buttons[focused === 0 ? 1 : 0]?.focus({ preventScroll: true });
        else if (input.hit("a")) this.yesNoResolve(focused !== 1);
        else if (input.hit("b")) this.yesNoResolve(false);
      } else {
        if (input.hit("b")) {
          const back = this.ctx.layer.querySelector<HTMLButtonElement>("[data-bag-cancel], #back, #close");
          if (back) back.click();
        } else if (input.hit("menu")) this.ctx.layer.querySelector<HTMLButtonElement>("#close")?.click();
        else this.ctx.menuInput.update(this.ctx.layer, input, now, false);
      }
    } else if (this.mode === "battle") {
      if (input.hit("b")) this.battleLaunch?.back();
      else this.ctx.menuInput.update(this.ctx.layer, input, now, true);
    }
    this.updateMovers(dt);
    if (this.mode === "world") this.control(dt);
    if (this.mode !== "battle") this.render(now);
    if (this.mode === "world" && this.save.steps - this.lastSave >= 16) this.persist();
  }

  private moveDuration() {
    if (this.save.bike) return WALK_SECONDS / 2;
    return WALK_SECONDS / (this.ctx.input.held("speed") || this.ctx.input.held("b") ? 1.6 : 1);
  }

  private control(dt: number) {
    if (this.save.settings.movement !== "grid") return this.controlFree(dt);
    // Switching to steps mid-square lines everyone up on their squares.
    if (!this.me.from) this.me.free = undefined;
    if (this.pikachu && !this.pikachu.from) this.pikachu.free = undefined;
    this.controlGrid(dt);
  }

  /** Square-by-square steps, as on the Game Boy. */
  private controlGrid(dt: number) {
    const input = this.ctx.input;
    const tapped = (["up", "down", "left", "right"] as const).find(d => input.hit(d));
    if (this.me.from) {
      // A tap during a step is remembered so quick taps still walk square by square.
      if (tapped) this.queued = tapped;
      return;
    }
    if (input.hit("menu")) {
      void this.openMenu();
      return;
    }
    if (input.hit("a")) {
      // Yellow runs map scripts every frame; running them after an interaction lets follow-up scenes start.
      void this.runScript(async () => {
        await this.interact();
        await this.afterControl();
      });
      return;
    }
    const queued = this.queued;
    this.queued = undefined;
    const dir = (["up", "down", "left", "right"] as const).find(d => input.held(d) || input.hit(d)) ?? queued;
    if (!dir) {
      this.turnHeld = 0;
      return;
    }
    if (queued === dir && !input.held(dir)) {
      this.player.facing = dir;
      this.tryStep(dir);
      return;
    }
    if (dir !== this.me.facing && !this.turnHeld) {
      this.me.facing = dir;
      this.turnHeld = 0.0001;
      return;
    }
    this.turnHeld += dt;
    if (dir !== this.me.facing) this.me.facing = dir;
    if (this.turnHeld < 0.07 && !input.hit(dir)) return;
    this.tryStep(dir);
  }

  private blocked(x: number, y: number, mover?: Mover) {
    return this.npcs.some(n => !n.hidden && n !== mover &&
      ((n.x === x && n.y === y) || (n.from && n.from.x === x && n.from.y === y)));
  }

  private tryStep(dir: Facing) {
    const p = this.me, [dx, dy] = STEP[dir];
    const nx = p.x + dx, ny = p.y + dy;
    const map = this.header;
    if (this.standingOnWarp && this.world.edgeWarp(map, p.x, p.y, dir)) {
      const index = this.world.warpAt(map, p.x, p.y);
      if (index >= 0) {
        void this.runScript(() => this.useWarp(index));
        return;
      }
    }
    if (this.world.ledge(map, p.x, p.y, dir) && !this.blocked(nx + dx, ny + dy)) {
      this.pikachuFollow(p.x, p.y);
      p.from = { x: p.x, y: p.y, t: 0, duration: WALK_SECONDS * 2, hop: true };
      p.x += dx * 2;
      p.y += dy * 2;
      this.ctx.sound.overworld("exit");
      return;
    }
    const boulder = this.objectAt(nx, ny);
    if (boulder?.object.sprite === SPRITE.SPRITE_BOULDER && this.strength && !boulder.from) {
      if (this.pushBoulder(boulder, dir)) return;
    }
    const surfing = !!this.save.surfing;
    const from = this.world.tile(map, p.x, p.y), to = this.world.tile(map, nx, ny);
    let ok = !this.blocked(nx, ny) && !this.world.pairBlocked(map, from, to, surfing);
    if (ok) ok = surfing ? this.world.isWater(map, nx, ny) || this.landFromSurf(nx, ny) : this.world.passable(map, nx, ny);
    if (ok && !surfing && this.world.isWater(map, nx, ny) && !this.world.passable(map, nx, ny)) ok = false;
    if (!ok) {
      if (this.standingOnWarp) {
        const index = this.world.warpAt(map, p.x, p.y);
        if (index >= 0 && this.world.edgeWarp(map, p.x, p.y, dir)) {
          void this.runScript(() => this.useWarp(index));
          return;
        }
      }
      if (!this.bumped) this.ctx.sound.overworld("bump");
      this.bumped = true;
      return;
    }
    this.bumped = false;
    this.pikachuFollow(p.x, p.y);
    p.from = { x: p.x, y: p.y, t: 0, duration: this.moveDuration() };
    p.x = nx;
    p.y = ny;
  }
  private bumped = false;
  private queued?: Facing;
  private pushTries = 0;
  /** Strength: the boulder moves after the player pushes against it a second time. */
  private pushBoulder(boulder: Npc, dir: Facing) {
    if (++this.pushTries < 2) return false;
    this.pushTries = 0;
    return this.moveBoulder(boulder, dir);
  }
  private moveBoulder(boulder: Npc, dir: Facing) {
    const [dx, dy] = STEP[dir], x = boulder.x + dx, y = boulder.y + dy;
    const map = this.header;
    if (!this.world.passable(map, x, y) || this.blocked(x, y, boulder) ||
      this.world.pairBlocked(map, this.world.tile(map, boulder.x, boulder.y), this.world.tile(map, x, y)) ||
      this.world.tile(map, x, y) === 0x15) return false;
    boulder.from = { x: boulder.x, y: boulder.y, t: 0, duration: WALK_SECONDS * 1.5 };
    boulder.x = x;
    boulder.y = y;
    boulder.home = { x, y };
    this.ctx.sound.overworld("strength");
    boulder.onPath = () => void this.runScript(() => this.script?.onStep?.(this));
    return true;
  }

  // ------------------------------------------------------------ free movement
  private pushing = 0;
  /**
   * Astra-style movement: any direction, diagonals included, with the map's
   * rules applied whenever the player's centre enters a new square.
   */
  private controlFree(dt: number) {
    const input = this.ctx.input, me = this.me;
    if (me.from) return;
    if (input.hit("menu")) {
      void this.openMenu();
      return;
    }
    if (input.hit("a")) {
      void this.runScript(async () => {
        await this.interact();
        await this.afterControl();
      });
      return;
    }
    const heading = heldHeading(input, me.facing);
    if (!heading) {
      this.pushing = 0;
      this.bumped = false;
      me.moving = false;
      return;
    }
    const { across, along } = heading;
    me.facing = heading.facing;
    const map = this.header;
    // Mats and carpets lead out when the player keeps walking into the edge beyond them.
    const warp = this.world.warpAt(map, me.x, me.y);
    if (warp >= 0) for (const dir of [along, across]) if (dir && this.world.edgeWarp(map, me.x, me.y, dir)) {
      me.facing = dir;
      me.moving = false;
      void this.runScript(() => this.useWarp(warp));
      return;
    }
    // The shared walk works on body centres; Yellow keeps the sprite's top-left square.
    const from = me.free ?? { x: me.x, y: me.y };
    const centre = { x: from.x + 0.5, y: from.y + 0.5 };
    // A new square ends the frame, so its events run before the player walks on.
    const moved = walkFreely(centre, heading, walkSpeed(input, { bike: !!this.save.bike }) * Math.min(dt, 0.05),
      (x, y) => this.freeBlocked(x, y), p => Math.floor(p.x) !== me.x || Math.floor(p.y) !== me.y);
    const pos = { x: centre.x - 0.5, y: centre.y - 0.5 };
    me.free = pos;
    me.moving = moved > 0;
    me.stride = (me.stride ?? 0) + moved;
    const [fx, fy] = STEP[me.facing];
    const forward = (pos.x - from.x) * fx + (pos.y - from.y) * fy;
    if (forward > 1e-4 || (across && along && moved > 0)) {
      this.pushing = 0;
      this.bumped = false;
    } else if (this.pushAgainst(me.facing, pos, dt)) return;
    const tx = Math.floor(centre.x), ty = Math.floor(centre.y);
    if (tx === me.x && ty === me.y) return;
    me.x = tx;
    me.y = ty;
    if (this.save.surfing && !this.world.isWater(map, tx, ty) && this.landFromSurf(tx, ty)) this.placePikachu();
    void this.runScript(() => this.arrived());
  }

  /** Walking straight into something: ledges, Strength boulders and walls. */
  private pushAgainst(dir: Facing, pos: { x: number; y: number }, dt: number) {
    const me = this.me, map = this.header, [dx, dy] = STEP[dir];
    const lateral = dx ? Math.abs(pos.y - me.y) : Math.abs(pos.x - me.x);
    if (lateral < 0.35 && this.world.ledge(map, me.x, me.y, dir) && !this.blocked(me.x + dx * 2, me.y + dy * 2)) {
      me.from = { x: pos.x, y: pos.y, t: 0, duration: WALK_SECONDS * 2, hop: true };
      me.free = undefined;
      me.x += dx * 2;
      me.y += dy * 2;
      this.ctx.sound.overworld("exit");
      return true;
    }
    const boulder = this.objectAt(me.x + dx, me.y + dy);
    if (boulder?.object.sprite === SPRITE.SPRITE_BOULDER && this.strength && !boulder.from) {
      this.pushing += dt;
      if (this.pushing >= 0.3) {
        this.pushing = 0;
        this.moveBoulder(boulder, dir);
      }
      return false;
    }
    if (!this.bumped) this.ctx.sound.overworld("bump");
    this.bumped = true;
    return false;
  }

  /** Whether the player's body, centred at (x, y), would overlap a wall, a person or a raised edge. */
  private freeBlocked(x: number, y: number) {
    const map = this.header, me = this.me;
    const surfing = !!this.save.surfing, here = this.world.tile(map, me.x, me.y);
    return bodyTouches(x, y, (px, py) => {
      const tx = Math.floor(px), ty = Math.floor(py);
      if (tx === me.x && ty === me.y) return false;
      if (this.blocked(tx, ty)) return true;
      const open = surfing ? this.world.isWater(map, tx, ty) || this.world.passable(map, tx, ty) : this.world.passable(map, tx, ty);
      return !open || this.world.pairBlocked(map, here, this.world.tile(map, tx, ty), surfing);
    });
  }

  /** Finishes the square the player is crossing, so a scene starts from its centre. */
  private settle(): Promise<void> {
    const me = this.me as Mover & { onPath?: () => void };
    const free = me.free;
    me.free = undefined;
    me.moving = false;
    if (!free || me.from) return Promise.resolve();
    const distance = Math.hypot(free.x - me.x, free.y - me.y);
    if (distance < 0.02) return Promise.resolve();
    return new Promise(resolve => {
      me.from = { x: free.x, y: free.y, t: 0, duration: Math.max(0.03, distance * WALK_SECONDS) };
      me.onPath = resolve;
    });
  }

  /** Whether the player's body covers a square, so people do not walk into them. */
  private playerCovers(x: number, y: number) {
    const me = this.me;
    if (me.from && Math.round(me.from.x) === x && Math.round(me.from.y) === y) return true;
    const p = me.free ?? me;
    return Math.abs(p.x - x) < 0.5 + BODY_RADIUS && Math.abs(p.y - y) < 0.5 + BODY_RADIUS;
  }

  /** Pikachu walks the player's own path, a square behind. */
  private resetTrail() {
    const p = this.pikachu;
    if (p) p.trail = [{ x: p.free?.x ?? p.x, y: p.free?.y ?? p.y }, { ...this.playerPos() }];
  }
  private playerPos() {
    const m = this.me;
    if (m.from) {
      const t = Math.min(1, m.from.t);
      return { x: m.from.x + (m.x - m.from.x) * t, y: m.from.y + (m.y - m.from.y) * t };
    }
    return m.free ?? { x: m.x, y: m.y };
  }
  private followTrail(dt: number) {
    const p = this.pikachu;
    if (!p) return;
    p.moving = false;
    if (!p.visible || p.from) return;
    const pos = this.playerPos(), trail = p.trail;
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) >= 0.05) trail.push({ ...pos });
    if (trail.length > 80) trail.splice(0, trail.length - 80);
    let need = 1, cur = pos, target: { x: number; y: number } | undefined;
    for (let i = trail.length - 1; i >= 0 && !target; i--) {
      const point = trail[i], seg = Math.hypot(cur.x - point.x, cur.y - point.y);
      if (seg >= need) target = { x: cur.x + (point.x - cur.x) * (need / seg), y: cur.y + (point.y - cur.y) * (need / seg) };
      else {
        need -= seg;
        cur = point;
      }
    }
    if (!target) return;
    const at = p.free ?? { x: p.x, y: p.y };
    const dx = target.x - at.x, dy = target.y - at.y, distance = Math.hypot(dx, dy);
    if (distance < 1e-3) return;
    const k = distance > 3 ? 1 : Math.min(1, (WALK_SPEED * 2.5 * dt) / distance);
    const next = { x: at.x + dx * k, y: at.y + dy * k };
    if (distance > 0.02) p.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    p.free = next;
    p.moving = true;
    p.stride = (p.stride ?? 0) + distance * k;
    p.x = Math.round(next.x);
    p.y = Math.round(next.y);
  }

  /** Development helper: jump to a map square. */
  debugWarp(map: string, x: number, y: number) {
    void this.runScript(() => this.warp(map, x, y));
  }
  private landFromSurf(x: number, y: number) {
    if (!this.world.passable(this.header, x, y)) return false;
    this.save.surfing = false;
    this.ctx.sound.refreshMusic();
    return true;
  }

  private updateMovers(dt: number) {
    const advance = (m: Mover & { onPath?: () => void }) => {
      if (!m.from) return false;
      m.from.t += dt / m.from.duration;
      m.walkFrame += dt;
      if (m.from.t < 1) return false;
      m.from = undefined;
      return true;
    };
    const player = this.me as Mover & { onPath?: () => void };
    if (advance(player)) {
      const scripted = player.onPath;
      player.onPath = undefined;
      if (scripted) scripted();
      else void this.runScript(() => this.arrived());
    }
    if (this.pikachu) advance(this.pikachu);
    if (this.save.settings.movement !== "grid") this.followTrail(dt);
    for (const n of this.npcs) {
      if (n.hidden) continue;
      if (advance(n)) {
        const cb = n.onPath;
        n.onPath = undefined;
        cb?.();
        continue;
      }
      if (n.from || this.mode !== "world" || !n.object.walk) continue;
      n.wait -= dt;
      if (n.wait > 0) continue;
      n.wait = 1 + Math.random() * 3;
      const options: Facing[] = n.object.range === 1 ? ["up", "down"] : n.object.range === 2 ? ["left", "right"] : ["up", "down", "left", "right"];
      const dir = options[Math.floor(Math.random() * options.length)];
      n.facing = dir;
      const [dx, dy] = STEP[dir], x = n.x + dx, y = n.y + dy;
      const { w, h } = this.world.cells(this.header);
      if (x < 0 || y < 0 || x >= w || y >= h || Math.abs(x - n.home.x) > 3 || Math.abs(y - n.home.y) > 3) continue;
      if (!this.world.passable(this.header, x, y) || this.world.isGrass(this.header, x, y) && false) continue;
      if (this.blocked(x, y, n) || this.playerCovers(x, y)) continue;
      if (this.pikachu?.visible && this.pikachu.x === x && this.pikachu.y === y) continue;
      if (this.header.warps.some(wp => wp.x === x && wp.y === y)) continue;
      n.from = { x: n.x, y: n.y, t: 0, duration: WALK_SECONDS * 1.4 };
      n.x = x;
      n.y = y;
    }
  }

  /** The player finished a step. */
  private async arrived() {
    this.save.x = this.me.x;
    this.save.y = this.me.y;
    this.save.facing = this.me.facing;
    this.crossEdge();
    this.save.steps++;
    if (this.save.safari && SAFARI_MAPS.has(this.header.id) && this.ev("EVENT_IN_SAFARI_ZONE")) {
      this.save.safari.steps = Math.max(0, this.save.safari.steps - 1);
      if (!this.save.safari.steps) return safariGameOver(this);
    }
    if (this.save.repel && !--this.save.repel) {
      const { repelWoreOff } = await import("./items");
      await repelWoreOff(this);
    }
    if (this.save.steps % 256 === 0) this.save.party = this.save.party.map(m => ({ ...m, happiness: Math.min(255, m.happiness + 1) }));
    const map = this.header;
    const warp = this.world.warpAt(map, this.me.x, this.me.y);
    this.standingOnWarp = warp >= 0;
    if (warp >= 0 && this.world.instantWarp(map, this.me.x, this.me.y)) return this.useWarp(warp);
    if (warp >= 0 && this.world.edgeWarp(map, this.me.x, this.me.y, this.me.facing)) {
      const held = this.ctx.input.held(this.me.facing);
      if (held) return this.useWarp(warp);
    }
    await this.afterArrival(false);
  }

  /** Map scripts, trainer sightlines and grass encounters after each step. */
  private async afterArrival(entering: boolean) {
    await this.script?.onStep?.(this);
    if (this.mode !== "world" && this.mode !== "script") return;
    const spotted = trainerTrigger(this, this.trainers, this.npcs.filter(n => !n.hidden));
    if (spotted) {
      await this.trainerSpotted(spotted.header, spotted.index);
      return;
    }
    if (!entering) await this.encounter();
  }

  private async encounter() {
    if (this.save.vars.noWildBattles) return;
    if (this.encounterCooldown > 0) {
      this.encounterCooldown--;
      return;
    }
    if (!this.save.party.some(m => m.hp > 0)) return;
    const wild = this.rom.wild(this.header.id);
    const onWater = this.save.surfing;
    const inGrass = this.world.isGrass(this.header, this.me.x, this.me.y);
    const caveFloor = !onWater && wild.grassRate && !this.rom.tileset(this.header.tileset).grass;
    const rate = onWater ? wild.waterRate : inGrass || caveFloor ? wild.grassRate : 0;
    const table = onWater ? wild.water : wild.grass;
    if (!rate || !table.length || Math.random() * 256 >= rate) return;
    const roll = Math.random() * 256;
    const slots = [51, 51, 39, 25, 25, 25, 13, 13, 11, 3];
    let acc = 0, slot = 0;
    for (; slot < 9; slot++) if (roll < (acc += slots[slot])) break;
    const pick = table[slot];
    if (this.save.repel && pick.level < (this.save.party.find(m => m.hp > 0)?.level ?? 0)) return;
    if (this.save.safari && SAFARI_MAPS.has(this.header.id)) return this.safariEncounter(pick.species, pick.level);
    if (!this.hasItem("SILPH_SCOPE") && this.header.label.startsWith("PokemonTower") && /GASTLY|HAUNTER|GENGAR/.test(this.rom.monName(pick.species)))
      return void await this.wildBattle(pick.species, pick.level, { ghost: true });
    await this.wildBattle(pick.species, pick.level);
  }

  // ------------------------------------------------------------ interaction
  private async interact() {
    const [dx, dy] = STEP[this.me.facing];
    let fx = this.me.x + dx, fy = this.me.y + dy;
    if (this.pikachu?.visible && this.pikachu.x === fx && this.pikachu.y === fy) return this.talkToPikachu();
    let npc = this.npcs.find(n => !n.hidden && n.x === fx && n.y === fy);
    const free = this.me.free;
    if (!npc && free) {
      // With free movement, someone half a square to the side still counts as in front.
      const off = dx ? free.y - this.me.y : free.x - this.me.x;
      if (Math.abs(off) > 0.15) {
        const side = Math.sign(off);
        npc = this.npcs.find(n => !n.hidden && n.x === fx + (dx ? 0 : side) && n.y === fy + (dx ? side : 0));
      }
    }
    if (!npc && this.world.counter(this.header, fx, fy)) {
      fx += dx;
      fy += dy;
      npc = this.npcs.find(n => !n.hidden && n.x === fx && n.y === fy);
    }
    if (npc) {
      if (npc.object.walk || npc.object.range !== 0xff) npc.facing = opposite(this.me.facing);
      this.ctx.sound.overworld("interact");
      if (npc.object.item !== undefined) return this.pickUp(npc);
      return this.textId(npc.object.text);
    }
    const sign = this.header.signs.find(s => s.x === this.me.x + dx && s.y === this.me.y + dy);
    if (sign) {
      this.ctx.sound.overworld("interact");
      return this.textId(sign.text);
    }
    const hidden = this.rom.hiddenObjects(this.header.id).find(h => h.x === this.me.x + dx && h.y === this.me.y + dy);
    if (hidden) return this.hiddenObject(hidden);
    if (await this.script?.onInteract?.(this)) return;
    const { fieldPrompt } = await import("./field");
    if (await fieldPrompt(this)) return;
    // Bookshelves, statues and displays in buildings without their own sign.
    if (this.me.facing === "up") {
      const tile = this.world.tile(this.header, this.me.x, this.me.y - 1);
      for (let o = SYM.BookshelfTileIDs; this.rom.u8(o) !== 0xff; o += 3) {
        if (this.rom.u8(o) === this.header.tileset && this.rom.u8(o + 1) === tile) {
          this.ctx.sound.overworld("interact");
          return this.predefText(this.rom.u8(o + 2));
        }
      }
    }
  }

  private async pickUp(npc: Npc) {
    const item = npc.object.item!;
    const name = this.rom.itemName(item);
    const key = String(item);
    const kinds = Object.keys(this.save.items).filter(k => this.save.items[k] > 0).length;
    if (!this.save.items[key] && kinds >= 20) return this.say(`{PLAYER} found ${name}!\fNo more room for items!`);
    this.save.items[key] = (this.save.items[key] ?? 0) + 1;
    const hs = this.rom.missables().findIndex(m => m.map === this.header.id && m.object === npc.object.index);
    if (hs >= 0) this.toggle(hs, false);
    else npc.hidden = true;
    this.ctx.sound.overworld("item");
    await this.say(`{PLAYER} found ${name}!`);
    this.persist();
  }

  private async hiddenObject(h: { x: number; y: number; arg: number; routine: string }) {
    if (h.routine === "StartSlotMachine") {
      const { slotMachine } = await import("./game-corner");
      const index = this.rom.hiddenObjects(this.header.id).indexOf(h);
      return slotMachine(this, h.arg, index);
    }
    const handler = sharedText("hidden:" + h.routine, this.legacy);
    if (handler) {
      this.hidden = h;
      return handler(this);
    }
    if (h.routine === "HiddenItems" || h.routine === "HiddenCoins") {
      const key = `hidden:${this.header.id}:${h.x}:${h.y}`;
      if (this.save.vars[key]) return;
      if (h.routine === "HiddenCoins") {
        if (!this.hasItem("COIN_CASE")) return;
        this.save.vars[key] = 1;
        const amount = h.arg === 0 ? 10 : h.arg;
        this.coins += amount;
        this.ctx.sound.overworld("item");
        return this.say(`{PLAYER} found ${amount} coins!`);
      }
      const name = this.rom.itemName(h.arg);
      const key2 = String(h.arg);
      const kinds = Object.keys(this.save.items).filter(k => this.save.items[k] > 0).length;
      if (!this.save.items[key2] && kinds >= 20) return this.say(`{PLAYER} found ${name}!\fNo more room for items!`);
      this.save.vars[key] = 1;
      this.save.items[key2] = (this.save.items[key2] ?? 0) + 1;
      this.ctx.sound.overworld("item");
      await this.say(`{PLAYER} found ${name}!`);
      this.persist();
      return;
    }
    if (h.routine === "OpenPokemonCenterPC" || h.routine === "OpenRedsPC" || h.routine === "BillsHousePC") return this.service("pc");
    this.log(`Hidden object ${h.routine}`);
  }
  private hidden?: { x: number; y: number; arg: number; routine: string };
  get hiddenArg() { return this.hidden?.arg ?? 0; }
  predefText(id: number): Promise<void> {
    const label = TEXT_PREDEFS[id - 1];
    if (!label) return Promise.resolve();
    return this.text(label);
  }

  /** Runs an interaction or cutscene with the player locked. */
  async runScript(action: () => Promise<void> | void) {
    if (this.mode !== "world") return action();
    this.mode = "script";
    try {
      await action();
    } catch (error) {
      console.error(error);
      await this.say(`Something went wrong: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.mode = "world";
      void this.persist();
    }
  }

  // ------------------------------------------------------------ special text scripts
  async service(kind: "mart" | "nurse" | "pc" | "bills_pc", arg?: number[]) {
    const { openService } = await import("./services");
    this.mode = "menu";
    try {
      await openService(this, kind, arg);
    } finally {
      this.ctx.layer.replaceChildren();
      this.mode = "script";
    }
  }
  private async special(kind: number, at: number) {
    if (kind === 0xff) return this.service("nurse");
    if (kind === 0xfe) return this.service("mart", this.rom.martStock(at));
    if (kind === 0xfd || kind === 0xfc || kind === 0xf9) return this.service("pc");
    if (kind === 0xf5) {
      const { vendingMachine } = await import("./services");
      return vendingMachine(this);
    }
    if (kind === 0xf7) {
      const { prizeVendor } = await import("./services");
      return prizeVendor(this);
    }
    if (kind === 0xf6) return this.say("The link is not available in this adventure.");
  }

  // ------------------------------------------------------------ trainers
  private trainerNpc(header: TrainerHeader) {
    return this.npcs.find(n => n.object.index === header.object);
  }
  private async talkToTrainer(header: TrainerHeader) {
    const npc = this.trainerNpc(header);
    if (this.save.events.includes(header.event)) return this.showText(this.rom.text(header.after));
    if (npc) npc.facing = this.towards(npc, this.me);
    await this.fightTrainer(header, npc);
  }
  private async trainerSpotted(header: TrainerHeader, index: number) {
    const npc = this.npcs.find(n => n.object.index === index);
    if (!npc) return;
    if (npc.object.trainer) this.music(trainerIntro(npc.object.trainer.klass));
    await this.emote(index, "exclamation");
    await this.approach(index);
    this.me.facing = opposite(npc.facing);
    await this.fightTrainer(header, npc);
  }
  private async fightTrainer(header: TrainerHeader, npc?: Npc) {
    const trainer = npc?.object.trainer;
    const pokemon = npc?.object.pokemon;
    if (!trainer && !pokemon) return;
    const intro = this.textHandler(this.rom.label(header.before) ?? "", header.before);
    if (intro) await intro(this);
    else await this.showText(this.rom.text(header.before));
    this.music();
    if (pokemon) {
      // Legendaries and other static Pokémon use the trainer engine with a species in place of a class.
      this.ctx.cry(this.rom.dex(pokemon.species));
      const outcome = await this.wildBattle(pokemon.species, pokemon.level, { stationary: true });
      if (outcome === "win" || outcome === "caught") {
        this.setEvent(header.event, true);
        const hs = this.rom.missables().findIndex(m => m.map === this.header.id && m.object === npc!.object.index);
        if (hs >= 0) this.toggle(hs, false);
        else npc!.hidden = true;
        const after = this.script?.texts?.["after:" + header.object];
        if (after) await after(this);
      }
      return;
    }
    if (!trainer) return;
    const won = await this.battleTrainer(trainer.klass, trainer.index, { endText: header.end });
    if (won) {
      this.setEvent(header.event, true);
      const after = this.script?.texts?.["after:" + header.object];
      if (after) await after(this);
    }
  }

  // ------------------------------------------------------------ battles
  private battleLaunch?: BattleLaunch;
  private crystalItems?: Map<number, number>;
  /** Gen 1 item id -> Crystal item id, matched by name. */
  crystalItem(id: number) {
    if (!this.crystalItems) {
      this.crystalItems = crystalItemMap(this.ctx.engine, this.rom);
    }
    return this.crystalItems.get(id);
  }
  private battleBag() {
    const balls: [number, number][] = [], items: [number, number][] = [];
    for (const [key, count] of Object.entries(this.save.items)) {
      const id = +key, crystal = this.crystalItem(id);
      if (!crystal || !count) continue;
      if (id >= 1 && id <= 4) balls.push([crystal, count]);
      else items.push([crystal, count]);
    }
    return { balls, items };
  }
  private badgeMask() {
    // Yellow's stat badges line up with the Crystal badges that grant the same boosts.
    const order = [0, 1, 2, 3, 5, 4, 6, 7];
    let mask = 0;
    for (let i = 0; i < 8; i++) if (this.save.badges & (1 << i)) mask |= 1 << order[i];
    return mask;
  }
  async trainerBattle(klass: string, index: number, options: { canLose?: boolean; win?: string; lose?: string } = {}) {
    const id = TRAINER[klass];
    if (id === undefined) throw Error(`Unknown trainer class ${klass}`);
    const won = await this.battleTrainer(id, index, options);
    const after = won ? options.win : options.lose;
    if (after) await this.text(after);
    return won;
  }
  async showcase(species: string, lines: string[], ghost = false) {
    const dex = this.rom.dex(MON[species]);
    const previous = this.mode;
    this.mode = "menu";
    this.ctx.layer.innerHTML = `<section class="battle-scene yellow-showcase" data-arena="field"><div class="battle-field"><div class="battle-mon battle-enemy${ghost ? " yellow-ghost" : ""}"><img alt="" src="${this.ctx.sprite(dex)}"></div></div><div class="battle-box"><div class="battle-copy" aria-live="polite"></div></div></section>`;
    if (!ghost) this.ctx.cry(dex);
    const copy = this.ctx.layer.querySelector<HTMLElement>(".battle-copy")!;
    for (const line of lines) {
      copy.textContent = line.replaceAll("{PLAYER}", this.save.name).replaceAll("{RIVAL}", this.save.rival);
      await new Promise<void>(resolve => {
        this.showcaseNext = resolve;
        copy.onclick = () => resolve();
      });
    }
    this.showcaseNext = undefined;
    this.ctx.layer.replaceChildren();
    this.mode = previous === "menu" ? "script" : previous;
  }
  private showcaseNext?: () => void;
  block(bx: number, by: number) { return this.rom.blockAt(this.header, bx, by); }
  setWarp(index: number, map: string, warp: number) {
    const id = MAP[map];
    if (id === undefined || !this.header.warps[index]) return;
    this.header.warps = this.header.warps.map((w, i) => i === index ? { ...w, map: id, warp } : w);
  }
  async modal<T>(run: () => Promise<T>): Promise<T> {
    const previous = this.mode;
    this.mode = "menu";
    try {
      return await run();
    } finally {
      this.mode = previous === "menu" ? "script" : previous;
    }
  }
  async takeWarp() {
    const index = this.world.warpAt(this.header, this.me.x, this.me.y);
    if (index >= 0) await this.useWarp(index);
  }
  async hallOfFame() {
    const { hallOfFame } = await import("./ceremony");
    const previous = this.mode;
    this.mode = "menu";
    try {
      await hallOfFame(this);
    } finally {
      this.mode = previous === "menu" ? "script" : previous;
    }
  }
  itemName(item: string) { return this.rom.itemName(this.itemId(item)); }
  async gainExp(mon: Pokemon, exp: number) {
    const { gainExperience } = await import("./growth");
    return gainExperience(this, mon, exp);
  }
  learnset(dex: number) { return this.ctx.engine.evolutionData(dex).learnset; }
  moveName(move: number) { return this.ctx.engine.move(move).name; }
  async learnMove(slot: number, move: number) {
    const { learn } = await import("./evolution");
    return learn(this, slot, move);
  }
  async fieldMove(move: "strength") {
    const { fieldUser, useStrength } = await import("./field");
    const mon = fieldUser(this, move);
    if (!mon) return false;
    await useStrength(this, mon);
    return true;
  }
  dex(species: string) {
    const id = MON[species];
    if (id === undefined) throw Error(`Unknown species ${species}`);
    return this.rom.dex(id);
  }
  async trade(index: number) {
    const { inGameTrade } = await import("./trades");
    await inGameTrade(this, index);
  }
  async choosePartyMon(title: string, usable: (mon: Pokemon) => boolean = () => true) {
    const { mountParty } = await import("../ui/party");
    const previous = this.mode;
    this.mode = "menu";
    const slot = await new Promise<number | undefined>(resolve => {
      this.ctx.layer.replaceChildren();
      mountParty(this.ctx.layer, {
        title, confirm: "Choose",
        rows: this.save.party.map(mon => ({
          name: mon.nickname || this.ctx.engine.species(mon.species).name, sprite: this.ctx.sprite(mon), level: mon.level,
          status: mon.status, hp: mon.hp, maxHp: mon.stats[0], disabled: !usable(mon),
        })),
        onSelect: resolve, onBack: () => resolve(undefined),
      });
    });
    this.ctx.layer.replaceChildren();
    this.mode = previous === "menu" ? "script" : previous;
    return slot;
  }
  async showDex(species: string) {
    const dex = this.dex(species);
    this.register(dex, false);
    const data = this.ctx.engine.species(dex), entry = this.ctx.engine.dexEntry(dex);
    const { specimenCard } = await import("../ui/specimen");
    const previous = this.mode;
    this.mode = "menu";
    await new Promise<void>(resolve => {
      specimenCard(this.ctx.layer, "Pokédex", { ...data, ...entry, image: this.ctx.sprite(dex) }, `№${String(dex).padStart(3, "0")}`, "Close", resolve);
    });
    this.ctx.layer.replaceChildren();
    this.mode = previous === "menu" ? "script" : previous;
  }
  async rename(slot: number) {
    const mon = this.save.party[slot];
    if (!mon) return false;
    const previous = this.mode;
    this.mode = "menu";
    const name = await new Promise<string | undefined>(resolve => {
      const p = panel(this.ctx.layer, "Nickname", `<label class="yellow-intro">New name<input id="nickname" maxlength="10" value="${escapeHtml(mon.nickname)}" autocomplete="off"></label><div class="buttons"><button id="confirm">OK</button><button class="secondary" id="back">Cancel</button></div>`);
      const input = p.querySelector<HTMLInputElement>("#nickname")!;
      input.focus();
      input.select();
      p.querySelector<HTMLButtonElement>("#confirm")!.onclick = () => resolve(input.value.toUpperCase().replace(/[^A-Z0-9 .'-]/g, "").trim().slice(0, 10) || undefined);
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => resolve(undefined);
    });
    this.ctx.layer.replaceChildren();
    this.mode = previous === "menu" ? "script" : previous;
    if (!name) return false;
    mon.nickname = name;
    this.textVar("wNameBuffer", name);
    return true;
  }
  follower(on: boolean) {
    this.save.vars.pikachuStarter = on ? 1 : 0;
    this.placePikachu();
  }
  choose(title: string, options: string[]) {
    return import("./services").then(async ({ choose }) => {
      const previous = this.mode;
      this.mode = "menu";
      const pick = await choose(this, title, options);
      this.ctx.layer.replaceChildren();
      this.mode = previous === "menu" ? "script" : previous;
      return pick;
    });
  }
  private async battleTrainer(klass: number, index: number, options: { canLose?: boolean; endText?: number } = {}) {
    const party = this.rom.trainerParty(klass, index);
    const pp = (move: number) => this.ctx.engine.move(move).pp;
    // Level-up moves from the game data, then the cartridge's hand-picked ones.
    const opponents = party.map(m => this.ctx.engine.makePokemon(this.rom.dex(m.species), m.level));
    for (const { mon, slot, move } of specialMoves(this.rom, klass, index)) {
      if (!opponents[mon]) continue;
      const moves = [...opponents[mon].moves];
      moves[slot] = move;
      opponents[mon] = withMoves(opponents[mon], moves.filter((m, i) => m || i < slot), pp);
    }
    const prize = this.rom.trainerMoney(klass) * (party[party.length - 1]?.level ?? 1);
    const outcome = await this.battle({ party: opponents, prizeMoney: prize }, {
      trainer: /^RIVAL/.test(this.rom.trainerClassName(klass)) ? this.save.rival : titleCase(this.rom.trainerClassName(klass)),
      canLose: options.canLose,
      klass,
    });
    return outcome === "win";
  }
  async wildBattle(species: string | number, level: number, options: { stationary?: boolean; ghost?: boolean } = {}): Promise<BattleOutcome> {
    const internal = typeof species === "string" ? MON[species] : species;
    if (options.ghost && !this.hasItem("SILPH_SCOPE")) {
      await this.showcase("GASTLY", ["A GHOST appeared!", "Darn! The GHOST can't be ID'd!", "Get out... Get out...", `${this.save.name} got away safely!`], true);
      return "run";
    }
    // An identified ghost still can't be caught, so no balls go into that battle.
    return this.battle({ species: this.rom.dex(internal), level, stationary: options.stationary }, { noCatch: options.ghost });
  }
  private battle(opponent: Parameters<Engine["startBattle"]>[0]["opponent"], options: { trainer?: string; canLose?: boolean; klass?: number; noCatch?: boolean }): Promise<BattleOutcome> {
    const engine = this.ctx.engine;
    if (!this.save.party.some(m => m.hp > 0)) return Promise.resolve("lose");
    const bag = this.battleBag();
    if (options.noCatch) bag.balls = [];
    this.battleItems = new Set([...bag.balls, ...bag.items].map(([id]) => id));
    const launch = new BattleLaunch(this.ctx, {
      start: {
        party: this.save.party, opponent, balls: bag.balls, items: bag.items, money: this.save.money,
        badges: this.badgeMask(), seen: this.save.seen, caught: this.save.caught,
      },
      trainerName: options.trainer,
      speed: this.save.settings.battleSpeed,
      itemName: id => engine.itemName(id),
      party: () => this.save.party,
      music: cue => {
        this.battleCue = cue === "Capture" ? "capture" : options.trainer ? (options.klass && isLeader(options.klass) ? "gymVictory" : "trainerVictory") : "wildVictory";
        this.ctx.sound.refreshMusic();
      },
      auto: this.autoBattle,
    });
    const previous = this.mode;
    this.battleLaunch = launch;
    this.mode = "battle";
    this.inBattle = { trainer: !!options.trainer, klass: options.klass };
    this.ctx.sound.refreshMusic();
    return new Promise(resolve => {
      const finish = (outcome: BattleOutcome) => {
        this.battleLaunch = undefined;
        this.inBattle = undefined;
        this.mode = previous === "battle" ? "script" : previous;
        this.ctx.layer.replaceChildren();
        this.ctx.sound.refreshMusic();
        resolve(outcome);
      };
      launch.finished.then(battle => this.battleResult(battle, options, finish), e => {
        console.error(e);
        finish("draw");
      });
    });
  }
  inBattle?: { trainer: boolean; klass?: number };
  private battleItems = new Set<number>();
  /** Development: resolve battles instantly on the native engine. */
  autoBattle = false;
  battleCue?: string;

  private async battleResult(battle: FinishedBattle, options: { trainer?: string; canLose?: boolean }, finish: (o: BattleOutcome) => void) {
    const result = battle.result;
    this.battleCue = undefined;
    // Pikachu grows fonder as it levels up and sulks when it faints.
    const before = this.save.party.find(m => m.species === 25 && m.ot_id === this.save.vars.otId);
    const after = result.party.find(m => m.species === 25 && m.ot_id === this.save.vars.otId && m.exp >= (before?.exp ?? Infinity));
    if (before && after) {
      const change = (after.level - before.level) * 5 - (before.hp > 0 && after.hp === 0 ? 3 : 0);
      after.happiness = Math.max(0, Math.min(255, after.happiness + change));
    }
    this.save.party = battle.party;
    for (const mon of battle.overflow) this.save.storage.push({ ...mon, ot_name: mon.ot_name || this.save.name });
    this.save.money = result.money;
    // Return the native bag counts to Gen 1 item ids.
    for (const [key] of Object.entries(this.save.items)) {
      const crystal = this.crystalItem(+key);
      // Only items that went into the battle come back from it.
      if (!crystal || !this.battleItems.has(crystal)) continue;
      const left = [...result.bag.balls, ...result.bag.items].find(([id]) => id === crystal)?.[1] ?? 0;
      if (left) this.save.items[key] = left;
      else delete this.save.items[key];
    }
    this.save.seen = result.world.seen.filter(n => n <= 251);
    this.save.caught = result.world.caught.filter(n => n <= 251);
    const caught = battle.end === "caught", lost = battle.end === "loss";
    this.ctx.layer.replaceChildren();
    this.mode = "script";
    if (caught) {
      const mon = result.party[result.caught!];
      if (mon && !mon.ot_name) mon.ot_name = this.save.name;
      await this.say(`${engine_name(this, mon.species)} ${result.caught! >= 6 ? "was transferred to the PC" : "joined your party"}!`);
    }
    if (lost && options.canLose) {
      this.heal();
      finish("lose");
      return;
    }
    if (lost) {
      await this.blackout();
      finish("lose");
      return;
    }
    await this.evolveAfterBattle(result.may_evolve);
    this.persist();
    // Escapes and draws both send the player on their way.
    finish(battle.end === "win" ? "win" : caught ? "caught" : "run");
  }

  /** The map script, as it runs once the player has control again. */
  private async afterControl() {
    if (this.mode !== "script") return;
    await this.script?.onStep?.(this);
  }
  private async safariEncounter(species: number, level: number) {
    const previous = this.mode;
    this.mode = "menu";
    try {
      await safariBattle(this, species, level);
    } finally {
      this.mode = previous === "menu" ? "script" : previous;
    }
    if (!this.save.safari?.balls) await safariGameOver(this);
  }
  private async evolveAfterBattle(slots: number[]) {
    const { evolveAfterBattle } = await import("./evolution");
    await evolveAfterBattle(this, slots);
  }

  async blackout() {
    await this.say("{PLAYER} is out of useable POKéMON!\f{PLAYER} blacked out!");
    this.save.money = Math.floor(this.save.money / 2);
    this.heal();
    const town = this.save.blackout;
    const { blackoutSpot } = await import("./services");
    const spot = blackoutSpot(this, town);
    await this.fade(() => {
      this.me.x = spot.x;
      this.me.y = spot.y;
      this.me.facing = "down";
      this.me.from = undefined;
      this.me.free = undefined;
      this.enterMap(spot.map, true);
    });
    this.persist();
  }

  // ------------------------------------------------------------ Pikachu
  private starterPikachu() {
    const lead = this.save.party.find(m => m.species === 25 && m.ot_id === this.save.vars.otId && this.save.vars.pikachuStarter);
    return lead && lead.hp > 0 ? lead : undefined;
  }
  private placePikachu() {
    const follows = !!this.starterPikachu() && !this.save.surfing && !this.save.bike;
    if (!follows) {
      this.pikachu = undefined;
      return;
    }
    const behind = STEP[opposite(this.me.facing)];
    let x = this.me.x + behind[0], y = this.me.y + behind[1];
    if (!this.world.passable(this.header, x, y) || this.blocked(x, y)) {
      x = this.me.x;
      y = this.me.y;
    }
    this.pikachu = { x, y, facing: this.me.facing, walkFrame: 0, visible: true, trail: [] };
    this.resetTrail();
  }
  private pikachuFollow(fromX: number, fromY: number) {
    const p = this.pikachu;
    if (!p || this.save.settings.movement !== "grid") return;
    if (p.x === fromX && p.y === fromY) return;
    const dx = fromX - p.x, dy = fromY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) {
      p.x = fromX;
      p.y = fromY;
      return;
    }
    p.facing = this.towards(p, { x: fromX, y: fromY });
    p.from = { x: p.x, y: p.y, t: 0, duration: this.me.from?.duration ?? WALK_SECONDS };
    p.x = fromX;
    p.y = fromY;
  }
  private async talkToPikachu() {
    const { talkToPikachu } = await import("./pikachu");
    if (this.pikachu) this.pikachu.facing = opposite(this.me.facing);
    await talkToPikachu(this);
  }

  // ------------------------------------------------------------ menus and saving
  private async openMenu() {
    this.mode = "menu";
    this.ctx.sound.overworld("interact");
    const after = await openYellowMenu(this);
    this.ctx.layer.replaceChildren();
    this.mode = "world";
    await this.runScript(async () => {
      if (after) await after();
      await this.afterControl();
    });
  }
  get layer() { return this.ctx.layer; }
  get engine() { return this.ctx.engine; }

  persist(force = false) {
    this.lastSave = this.save.steps;
    this.save.x = Math.round(this.me.from ? this.me.from.x : this.me.x);
    this.save.y = Math.round(this.me.from ? this.me.from.y : this.me.y);
    this.save.facing = this.me.facing;
    return this.ctx.store.write(this.save, !force).then(() => {
      if (this.saveIssue) this.ctx.saveWarning.hidden = true;
      this.saveIssue = false;
    }, error => {
      this.saveIssue = true;
      this.ctx.saveWarning.hidden = false;
      this.ctx.saveWarning.textContent = error instanceof JourneyConflict ? "Newer save in another window" : "Unsaved progress · Menu → Save";
    });
  }
  summary() {
    return yellowSummary(this.save, id => titleCase(this.rom.mapName(id) || this.rom.mapLabel(id) || "Kanto"));
  }

  // ------------------------------------------------------------ rendering
  private render(now: number) {
    const c = this.ctx2d, map = this.header;
    c.imageSmoothingEnabled = false;
    const pos = (m: Mover) => {
      if (!m.from) return { x: (m.free?.x ?? m.x) * 16, y: (m.free?.y ?? m.y) * 16, lift: 0 };
      const t = Math.min(1, m.from.t);
      const lift = m.from.hop ? Math.sin(t * Math.PI) * 8 : 0;
      return { x: (m.from.x + (m.x - m.from.x) * t) * 16, y: (m.from.y + (m.y - m.from.y) * t) * 16, lift };
    };
    const p = pos(this.me);
    const camX = Math.round(p.x + 8 - 160), camY = Math.round(p.y + 8 - 120);
    const crystal = this.crystalLook(map);
    c.fillStyle = `rgb(${(crystal ? this.crystal.backdrop(map) : this.palette[0]).join(",")})`;
    c.fillRect(0, 0, 320, 240);
    // Border blocks around everything.
    const border = crystal ? this.crystal.block(map, map.border) : this.gfx.block(map, map.border, this.palette);
    const bx0 = Math.floor(camX / 32), by0 = Math.floor(camY / 32);
    for (let by = by0; by <= by0 + 8; by++)
      for (let bx = bx0; bx <= bx0 + 10; bx++) c.drawImage(border, bx * 32 - camX, by * 32 - camY);
    const ground = crystal ? this.crystal.map(map, this.blocksVersion) : this.gfx.map(map, this.palette, this.blocksVersion);
    c.drawImage(ground, -camX, -camY);
    for (const conn of map.connections) {
      const target = this.world.map(conn.map);
      const img = this.crystalLook(target) ? this.crystal.map(target) : this.gfx.map(target, mapPalette(this.rom, target, this.save.lastMap));
      const ox = conn.dir === "north" || conn.dir === "south" ? conn.offset * 32 : conn.dir === "west" ? -target.width * 32 : map.width * 32;
      const oy = conn.dir === "west" || conn.dir === "east" ? conn.offset * 32 : conn.dir === "north" ? -target.height * 32 : map.height * 32;
      c.drawImage(img, ox - camX, oy - camY);
    }
    this.animateTiles(c, camX, camY, now);
    // Characters, back to front.
    type Drawn = { y: number; draw: () => void };
    const drawn: Drawn[] = [];
    const add = (m: Mover, sprite: number, emote?: Npc["emote"], object?: MapObject) => {
      const at = pos(m);
      const walking = m.from
        ? Math.floor(m.from.t * 2) % 2 === 0 && Math.floor(m.walkFrame / WALK_SECONDS) % 2 === 0
        : !!m.moving && Math.floor((m.stride ?? 0) * 2) % 2 === 1;
      const leg = m.from ? Math.floor(m.walkFrame / WALK_SECONDS) : Math.floor(m.stride ?? 0);
      const choice = this.save.settings.look !== "yellow" ? this.crystalSprites.choose(sprite, object, map.label) : undefined;
      drawn.push({
        y: at.y, draw: () => {
          const img = choice ? this.crystalSprites.sprite(choice, sprite, m.facing, walking, leg) : this.gfx.sprite(sprite, m.facing, walking, this.palette);
          if (!img) return;
          const x = Math.round(at.x - camX), y = Math.round(at.y - camY - 4 - at.lift);
          c.drawImage(img, x, y);
          if (!at.lift) this.coverWithGrass(c, ground, Math.round(at.x), Math.round(at.y - 4), camX, camY);
          if (emote && emote.until > this.clock) this.drawEmote(c, emote.kind, x, y - 16);
        },
      });
    };
    for (const n of this.npcs) if (!n.hidden) add(n, n.object.sprite, n.emote, n.object);
    if (this.pikachu?.visible) add(this.pikachu, SPRITE.SPRITE_PIKACHU);
    add(this.me, this.save.surfing ? SPRITE.SPRITE_SEEL : this.save.bike ? SPRITE.SPRITE_RED_BIKE ?? SPRITE.SPRITE_RED : SPRITE.SPRITE_RED, (this.me as Npc).emote);
    drawn.sort((a, b) => a.y - b.y).forEach(d => d.draw());
    if (this.save.vars.dark) {
      // Without Flash only the squares right around the player are visible.
      const px = Math.round(p.x - camX + 8), py = Math.round(p.y - camY + 4);
      const g = c.createRadialGradient(px, py, 12, px, py, 34);
      g.addColorStop(0, "rgba(8,8,14,0)");
      g.addColorStop(1, "rgba(8,8,14,0.96)");
      c.fillStyle = g;
      c.fillRect(0, 0, 320, 240);
    }
    if (this.fadeLevel > 0) {
      c.fillStyle = `rgba(16,16,24,${this.fadeLevel})`;
      c.fillRect(0, 0, 320, 240);
    }
  }
  private animTiles = new Map<number, { x: number; y: number; tile: number }[]>();
  private animateTiles(c: CanvasRenderingContext2D, camX: number, camY: number, now: number) {
    const map = this.header, tileset = this.rom.tileset(map.tileset);
    if (this.crystalLook(map)) {
      const frame = Math.floor(now / 280);
      for (const t of this.crystal.animatedTiles(map, this.blocksVersion)) {
        const x = t.x - camX, y = t.y - camY;
        if (x < -8 || y < -8 || x > 320 || y > 240) continue;
        c.drawImage(this.crystal.frame(map, t.tile, frame), x, y);
      }
      return;
    }
    if (!tileset.animation) return;
    let list = this.animTiles.get(map.id);
    if (!list) {
      list = [];
      for (let by = 0; by < map.height; by++)
        for (let bx = 0; bx < map.width; bx++) {
          const tiles = this.rom.block(tileset, map.blocks[by * map.width + bx]);
          for (let i = 0; i < 16; i++) {
            const t = tiles[i];
            if (t === 0x14 || (t === 0x03 && tileset.animation === 2))
              list.push({ x: bx * 32 + (i & 3) * 8, y: by * 32 + (i >> 2) * 8, tile: t });
          }
        }
      this.animTiles.set(map.id, list);
    }
    const frame = Math.floor(now / 333);
    for (const t of list) {
      const x = t.x - camX, y = t.y - camY;
      if (x < -8 || y < -8 || x > 320 || y > 240) continue;
      c.drawImage(this.gfx.animatedTile(map, t.tile, this.palette, frame), x, y);
    }
  }
  /** Tall grass hides the lower half of anyone standing in it, as on the Game Boy. */
  private coverWithGrass(c: CanvasRenderingContext2D, ground: HTMLCanvasElement, sx: number, sy: number, camX: number, camY: number) {
    const map = this.header, top = sy + 8, bottom = sy + 16;
    for (let tx = Math.floor(sx / 16); tx <= Math.floor((sx + 15) / 16); tx++)
      for (let ty = Math.floor(top / 16); ty <= Math.floor((bottom - 1) / 16); ty++) {
        if (tx < 0 || ty < 0 || tx >= map.width * 2 || ty >= map.height * 2 || !this.world.isGrass(map, tx, ty)) continue;
        const x0 = Math.max(sx, tx * 16), x1 = Math.min(sx + 16, tx * 16 + 16);
        const y0 = Math.max(top, ty * 16), y1 = Math.min(bottom, ty * 16 + 16);
        if (x1 > x0 && y1 > y0) c.drawImage(ground, x0, y0, x1 - x0, y1 - y0, x0 - camX, y0 - camY, x1 - x0, y1 - y0);
      }
  }
  /** Whether a map is drawn with Crystal's graphics. */
  private crystalLook(map: MapHeader) {
    return this.save.settings.look !== "yellow" && this.crystal.covers(map);
  }
  private drawEmote(c: CanvasRenderingContext2D, kind: Emote, x: number, y: number) {
    c.fillStyle = "#fff";
    c.strokeStyle = "#222";
    c.lineWidth = 1;
    c.beginPath();
    c.roundRect(x + 1.5, y + 1.5, 13, 12, 3);
    c.fill();
    c.stroke();
    c.fillStyle = kind === "exclamation" ? "#d03030" : "#2a2a2a";
    c.font = "bold 11px monospace";
    c.textAlign = "center";
    c.fillText(kind === "exclamation" ? "!" : kind === "question" ? "?" : "♪", x + 8, y + 11);
    c.textAlign = "start";
  }
}

const LEADER_CLASSES = new Set(["BROCK", "MISTY", "LT_SURGE", "ERIKA", "KOGA", "SABRINA", "BLAINE", "GIOVANNI", "LORELEI", "BRUNO", "AGATHA", "LANCE", "RIVAL3"]);
function isLeader(klass: number) {
  return [...LEADER_CLASSES].some(name => TRAINER[name] === klass);
}
function trainerIntro(klass: number) {
  const name = Object.keys(TRAINER).find(k => TRAINER[k] === klass) ?? "";
  if (/ROCKET|GIOVANNI/.test(name)) return "MUSIC_MEET_EVIL_TRAINER";
  if (/RIVAL/.test(name)) return "MUSIC_MEET_RIVAL";
  if (/LASS|BEAUTY|JR_TRAINER_F|COOLTRAINER_F|CHANNELER|SWIMMER_F|PICNICKER|JANINE|JOY|JENNY/.test(name)) return "MUSIC_MEET_FEMALE_TRAINER";
  return "MUSIC_MEET_MALE_TRAINER";
}
function engine_name(game: YellowGame, dex: number) {
  return game.engine.species(dex).name.toUpperCase();
}
export function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s.'-])([a-zé])/g, (_, a, b) => a + b.toUpperCase()).replace(/\bPokémon\b/i, "Pokémon");
}
void MAP_OBJECT;
void MAP_SCRIPT;
void TEXT_RESET;
