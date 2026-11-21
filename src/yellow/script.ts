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

  trainerBattle(klass: string, index: number, options?: { canLose?: boolean; intro?: string; music?: string }): Promise<boolean>;
  wildBattle(species: string, level: number, options?: { stationary?: boolean; noRun?: boolean }): Promise<BattleOutcome>;

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
  /** For script-specific feedback while porting. */
  log(message: string): void;
}

export interface MapScript {
  /** Runs once whenever the map is entered, before the player gains control. */
  onEnter?(g: Game): void | Promise<void>;
  /** Runs when the player arrives on a square or regains control. */
  onStep?(g: Game): void | Promise<void>;
  /** Handlers for text_asm entries, keyed by their cartridge label. */
  texts?: Record<string, (g: Game) => Promise<void>>;
}

export const MAP_SCRIPTS: Record<string, MapScript> = {};
/** Shared text_asm handlers used on many maps, keyed by label. */
export const SHARED_TEXTS: Record<string, (g: Game) => Promise<void>> = {};

export function defineMap(label: string, script: MapScript) {
  MAP_SCRIPTS[label] = script;
}
