/**
 * The interface Yellow map scripts use. Each script is a hand-written port of
 * the original map's logic; its text is read from the cartridge by label.
 */
import type { Pokemon } from "../engine";
import type { YellowSave } from "./save";
import type { Facing } from "./world";

export type Actor = number | "player" | "pikachu";
export type BattleOutcome = "win" | "lose" | "run" | "caught" | "draw";
export type Emote = "exclamation" | "question" | "smile";

export interface Game {
  readonly save: YellowSave;
  /** The cartridge is Yellow Legacy: its additions in scripts/legacy.ts apply. */
  readonly legacy: boolean;
  /** Current map id and its label (PalletTown). */
  readonly map: number;
  readonly mapLabel: string;
  readonly player: { readonly x: number; readonly y: number; readonly facing: Facing };

  ev(name: string): boolean;
  set(name: string): void;
  reset(name: string): void;
  /** Toggleable objects (HS_*). */
  shown(hs: string): boolean;
  show(hs: string): void;
  hide(hs: string): void;

  /** Shows text by cartridge label or by the current map's TEXT_* id / number. */
  text(ref: string | number, options?: { wait?: boolean }): Promise<void>;
  /** Shows a literal line. Prefer cartridge text; use this only for Astra's own additions. */
  say(text: string, wait?: boolean): Promise<void>;
  /** Asks yes or no after the text just shown. */
  yesNo(): Promise<boolean>;
  /** Strings for text commands that print RAM (item and Pokémon names, numbers). */
  textVar(name: string, value: string | number): void;

  npc(index: number): { x: number; y: number; facing: Facing } | undefined;
  face(who: Actor, facing: Facing): void;
  /** Turns an NPC toward the player. */
  facePlayer(index: number): void;
  /** Walks along a path of U/D/L/R steps (repeat counts allowed: "U3R2"). */
  move(who: Actor, path: string, options?: { speed?: number; ignoreCollision?: boolean }): Promise<void>;
  /** Walks an NPC next to the player, facing them. */
  approach(index: number): Promise<void>;
  place(who: Actor, x: number, y: number, facing?: Facing): void;
  emote(who: Actor, emote: Emote): Promise<void>;

  hasItem(item: string, count?: number): boolean;
  /** Adds items to the Bag. Resolves false if the Bag has no room. */
  give(item: string, count?: number): boolean;
  take(item: string, count?: number): boolean;
  money: number;
  coins: number;
  /** Adds a Pokémon to the party or PC. */
  giveMon(species: string, level: number, options?: { nickname?: string; message?: boolean }): Promise<Pokemon | undefined>;
  partyHas(species: string): boolean;

  /**
   * A scripted trainer battle. `win`/`lose` name texts shown afterwards (the
   * cartridge shows them as the opponent's closing line).
   */
  trainerBattle(klass: string, index: number, options?: { canLose?: boolean; win?: string; lose?: string }): Promise<boolean>;
  /**
   * A scripted wild battle. `ghost` marks Pokémon Tower ghosts, which cannot be
   * fought without the Silph Scope (the player can only run).
   */
  wildBattle(species: string, level: number, options?: { stationary?: boolean; ghost?: boolean }): Promise<BattleOutcome>;

  warp(map: string, x: number, y: number, facing?: Facing): Promise<void>;
  heal(): void;
  badge(index: number): void;
  hasBadge(index: number): boolean;
  music(name?: string): void;
  sfx(name: string): void;
  cry(species: string): void;
  delay(frames: number): Promise<void>;
  /** Fade to black, run something, fade back. */
  fade(during?: () => void | Promise<void>): Promise<void>;
  /** Persistent per-map state, like the original wXxxCurScript. */
  state: number;
  vars: Record<string, number>;
  /** Opens a mart, PC or other shared service. */
  service(kind: "mart" | "nurse" | "pc" | "bills_pc", arg?: number[]): Promise<void>;
  /** A battle-styled cut-in with a Pokémon and lines of narration. */
  showcase(species: string, lines: string[]): Promise<void>;
  /** Starts or stops the starter Pikachu following the player. */
  follower(on: boolean): void;
  /** Multiple-choice menu; resolves to the index or undefined for B. */
  townMap(): Promise<number | undefined>;
  choose(title: string, options: string[]): Promise<number | undefined>;
  /** ReplaceTileBlock: changes a 32×32 block of the current map (block coordinates). */
  setBlock(bx: number, by: number, block: number): void;
  /** The block id at block coordinates of the current map. */
  block(bx: number, by: number): number;
  /** An in-game trade (TRADE_FOR_* index), with the cartridge's dialogue. */
  trade(index: number): Promise<void>;
  /** Picks a party Pokémon; resolves to its slot or undefined. */
  choosePartyMon(title: string, usable?: (mon: Pokemon) => boolean): Promise<number | undefined>;
  /** Shows a species' Pokédex entry and registers it as seen. */
  showDex(species: string): Promise<void>;
  /** Lets the player rename a party Pokémon (the Name Rater). */
  rename(slot: number): Promise<boolean>;
  /** Adds experience to a Pokémon (Day-Care, Rare Candy): level, stats and new moves follow. */
  gainExp(mon: Pokemon, exp: number): Promise<Pokemon>;
  /** A species' level-up moves (by Pokédex number), from the game data. */
  learnset(dex: number): readonly { level: number; move: number }[];
  moveName(move: number): string;
  /** Teaches a party Pokémon a move, asking which to forget when it knows four. Resolves true if it learned it. */
  learnMove(slot: number, move: number): Promise<boolean>;
  /** Uses Strength with a party Pokémon that knows it, if the badge allows; resolves false when none can. */
  fieldMove(move: "strength"): Promise<boolean>;
  /** The cartridge's name for an item constant ("HM05", "ITEMFINDER"). */
  itemName(item: string): string;
  /** National Pokédex number of a species constant. */
  dex(species: string): number;
  /** Shows a text predef by its 1-based id (TextPredefs). */
  predefText(id: number): Promise<void>;
  /** The argument byte of the hidden object being inspected. */
  readonly hiddenArg: number;
  /**
   * Redirects one of the current map's warps (0-based index), as elevators do.
   * The change lasts until the map is set up again; elevators set it on entry.
   */
  setWarp(index: number, map: string, warp: number): void;
  /** Runs a full-screen panel or minigame that takes menu input. */
  modal<T>(run: () => Promise<T>): Promise<T>;
  /** Uses the warp the player is standing on (after a scripted walk onto stairs or a mat). */
  takeWarp(): Promise<void>;
  /** The Hall of Fame ceremony and credits. */
  hallOfFame(): Promise<void>;
  /** For script-specific feedback while porting. */
  log(message: string): void;
}

export interface MapScript {
  /** The original map script needs nothing beyond the shared runtime (trainers, texts). */
  generic?: boolean;
  /** Runs once whenever the map is entered, before the player gains control. */
  onEnter?(g: Game): void | Promise<void>;
  /** Runs when the player arrives on a square or regains control. */
  onStep?(g: Game): void | Promise<void>;
  /**
   * Runs when the player presses A and nothing (person, sign, hidden object)
   * is in front. Resolves true when it handled the press.
   */
  onInteract?(g: Game): Promise<boolean>;
  /**
   * Handlers for text_asm entries, keyed by their cartridge label. A handler
   * keyed by a TEXT_* constant replaces that text id entirely (for maps that
   * switch text tables).
   */
  texts?: Record<string, (g: Game) => Promise<void>>;
}

export const MAP_SCRIPTS: Record<string, MapScript> = {};
/** Shared text_asm handlers used on many maps, keyed by label. */
export const SHARED_TEXTS: Record<string, (g: Game) => Promise<void>> = {};

export function defineMap(label: string, script: MapScript) {
  MAP_SCRIPTS[label] = script;
}

type Handler = (g: Game) => Promise<void>;
type Hook = (g: Game) => void | Promise<void>;
export interface LegacyScript {
  /** Runs instead of Yellow's hook, which it receives to run itself where Legacy keeps it. */
  onEnter?(g: Game, yellow?: Hook): void | Promise<void>;
  onStep?(g: Game, yellow?: Hook): void | Promise<void>;
  /** Handlers by label or TEXT_* id, replacing Yellow's (`yellow`) for that entry. */
  texts?: Record<string, (g: Game, yellow?: Handler) => Promise<void>>;
}

/** Yellow Legacy's map logic, layered over Yellow's while Legacy's cartridge is in play. */
const LEGACY_SCRIPTS: Record<string, LegacyScript> = {};
const LEGACY_SHARED_TEXTS: Record<string, (g: Game, yellow?: Handler) => Promise<void>> = {};

export function defineLegacy(label: string, script: LegacyScript) {
  const known = LEGACY_SCRIPTS[label];
  LEGACY_SCRIPTS[label] = { ...known, ...script, texts: { ...known?.texts, ...script.texts } };
}
export function defineLegacyText(label: string, handler: (g: Game, yellow?: Handler) => Promise<void>) {
  LEGACY_SHARED_TEXTS[label] = handler;
}

const merged = new Map<string, MapScript | undefined>();
/** A map's script: Yellow's, with Yellow Legacy's layered on top for Legacy's cartridge. */
export function mapScript(label: string, legacy: boolean): MapScript | undefined {
  const yellow = MAP_SCRIPTS[label], extra = legacy ? LEGACY_SCRIPTS[label] : undefined;
  if (!extra) return yellow;
  let script = merged.get(label);
  if (!script) {
    script = { ...yellow, texts: { ...yellow?.texts } };
    for (const hook of ["onEnter", "onStep"] as const) {
      const own = extra[hook];
      if (own) script[hook] = g => own(g, yellow?.[hook]);
    }
    for (const [name, handler] of Object.entries(extra.texts ?? {})) script.texts![name] = g => handler(g, yellow?.texts?.[name]);
    merged.set(label, script);
  }
  return script;
}
/** A shared text handler, with Yellow Legacy's for Legacy's cartridge. */
export function sharedText(label: string, legacy: boolean): Handler | undefined {
  const yellow = SHARED_TEXTS[label], extra = legacy ? LEGACY_SHARED_TEXTS[label] : undefined;
  return extra ? g => extra(g, yellow) : yellow;
}
