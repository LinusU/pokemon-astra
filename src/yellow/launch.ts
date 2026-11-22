/** Starting and continuing Yellow journeys from the journey list. */
import type { Engine } from "../engine";
import type { PokemonPortrait } from "../engine/appearance";
import type { GameAudio } from "../game/audio";
import type { Input } from "../game/input";
import type { MusicScene } from "../game/music";
import { createJourney, get, JourneyStore, set, type JourneyEntry } from "../game/storage";
import type { MenuInput } from "../ui/menu-input";
import { escapeHtml, panel } from "../ui/shell";
import type { YellowAdventure } from "./save";
import type { Cartridge } from "./symbols";

export interface YellowHost {
  engine: Engine;
  input: Input;
  menuInput: MenuInput;
  layer: HTMLElement;
  canvas: HTMLCanvasElement;
  sound: GameAudio;
  saveWarning: HTMLElement;
  sprite: (mon: PokemonPortrait | number, back?: boolean) => string;
  cry: (species: number) => void;
  /** Called with the running game, or undefined once it stops. */
  activate: (game: YellowRunner | undefined) => void;
  /** Return to the journey list. */
  journeys: (error?: string) => void;
}
export interface YellowRunner {
  frame(now: number, dt: number): void;
  musicScene(): MusicScene | number;
  readonly scene: string;
}

/** Each Yellow adventure plays from its own cartridge, kept under its own key. */
const ADVENTURES: Record<YellowAdventure, { cartridge: Cartridge; key: string }> = {
  yellow: { cartridge: "yellow", key: "rom-yellow" },
  "yellow-legacy": { cartridge: "legacy", key: "rom-yellow-legacy" },
};

export function isYellowAdventure(adventure: unknown): adventure is YellowAdventure {
  return typeof adventure === "string" && Object.hasOwn(ADVENTURES, adventure);
}

async function stored(key: string) {
  const bytes = await get(key).catch(() => undefined);
  return bytes instanceof Uint8Array ? bytes : undefined;
}

export async function hasYellowCartridge(adventure: YellowAdventure) {
  return !!await stored(ADVENTURES[adventure].key);
}

/** Switch to `adventure`'s symbol table, for the cartridge it plays from. */
async function useAdventure(adventure: YellowAdventure) {
  const { useCartridge } = await import("./symbols");
  await useCartridge(ADVENTURES[adventure].cartridge);
}

/** A Yellow backup checked against its adventure's cartridge, or undefined when it is not valid. */
export async function readYellowBackup(data: { adventure: YellowAdventure }) {
  await useAdventure(data.adventure);
  const { isYellowSave } = await import("./save");
  return isYellowSave(data, data.adventure) ? data : undefined;
}

const COPY: Record<YellowAdventure, { title: string; about: (yellowStored: boolean) => string; accept: string }> = {
  yellow: {
    title: "Pokémon Yellow",
    about: () => "<p>This adventure reads Kanto's maps, story and dialogue from your English Pokémon Yellow cartridge (.gbc). Battles, menus and sound still use Astra's engine and your Crystal cartridge.</p>",
    accept: ".gb,.gbc,application/octet-stream",
  },
  "yellow-legacy": {
    title: "Pokémon Yellow Legacy",
    about: yellowStored => `<p>This adventure plays Kanto as rebalanced by Yellow Legacy (by TheSmithPlays), read from your own cartridge. Choose your Pokémon Yellow patched with Yellow Legacy V1.0.10, or ${yellowStored ? "just the official V1.0.10 patch (.bps): Astra applies it in this browser to the Yellow cartridge you already gave it" : "your English Pokémon Yellow (.gbc) together with the official V1.0.10 patch (.bps), which Astra applies in this browser"}.</p>`,
    accept: ".gb,.gbc,.bps,application/octet-stream",
  },
};

/**
 * Asks for the cartridge `adventure` plays from, verifies and keeps it. Yellow
 * Legacy's may come patched, or as the player's Yellow and the official patch,
 * in one go or one after the other.
 */
function importCartridge(host: YellowHost, adventure: YellowAdventure, back: () => void): Promise<Uint8Array | undefined> {
  const { cartridge, key } = ADVENTURES[adventure];
  const copy = COPY[adventure];
  return new Promise(resolve => {
    let yellow: Uint8Array | undefined, patch: Uint8Array | undefined;
    const show = async (message = "", error = true) => {
      if (cartridge === "legacy") yellow ??= await stored(ADVENTURES.yellow.key);
      const p = panel(host.layer, copy.title,
        `${copy.about(!!yellow)}<div class="drop"><button id="choose-rom">Choose ${cartridge === "legacy" ? "files" : "ROM"}</button><input hidden type="file" multiple accept="${copy.accept}"><span class="drop-hint">or drop ${cartridge === "legacy" ? "them" : "it"} onto the screen</span></div>${message ? `<p ${error ? 'role="alert" class="error"' : 'role="status"'}>${escapeHtml(message)}</p>` : ""}<p class="cartridge-note">Your cartridge stays in this browser.</p><div class="buttons"><button class="secondary" id="back">Back</button></div>`,
        "rom-import arrival-card");
      const input = p.querySelector<HTMLInputElement>("input")!;
      p.querySelector<HTMLButtonElement>("#choose-rom")!.onclick = () => input.click();
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { resolve(undefined); back(); };
      const load = async (files: File[]) => {
        let bytes: Uint8Array | undefined;
        try {
          bytes = await read(files);
        } catch (error) {
          return void show(error instanceof Error ? error.message : "The file could not be read.");
        }
        if (!bytes) return;
        try {
          await set(key, bytes);
        } catch {
          // Playing still works; the cartridge is asked for again next time.
        }
        resolve(bytes);
      };
      /** The cartridge from `files`, or undefined once the next file is asked for. */
      const read = async (files: File[]) => {
        const [{ identifyYellow, verifyYellow, UnsupportedYellowCartridge }, { applyBps, isBps, BpsError }] =
          await Promise.all([import("./rom"), import("./bps")]);
        if (cartridge === "yellow") {
          const bytes = new Uint8Array(await files[0].arrayBuffer());
          await verifyYellow(bytes);
          return bytes;
        }
        for (const file of files) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (isBps(bytes)) { patch = bytes; continue; }
          const kind = await identifyYellow(bytes);
          if (kind === "legacy") return bytes;
          if (kind === "yellow") { yellow = bytes; continue; }
          throw new UnsupportedYellowCartridge(`${file.name} is neither Pokémon Yellow, Yellow Legacy V1.0.10 nor its patch.`);
        }
        if (!patch) return void show("Now choose the Yellow Legacy V1.0.10 patch (.bps).", false);
        if (!yellow) return void show("Now choose your English Pokémon Yellow (.gbc) to apply the patch to.", false);
        let legacy: Uint8Array;
        try {
          legacy = applyBps(yellow, patch);
        } catch (error) {
          patch = undefined;
          throw error instanceof BpsError ? new UnsupportedYellowCartridge(`${error.message} Choose the official Yellow Legacy V1.0.10 patch for the English Pokémon Yellow.`) : error;
        }
        if (await identifyYellow(legacy) !== "legacy") {
          patch = undefined;
          throw new UnsupportedYellowCartridge("That patch is a different Yellow Legacy version: V1.0.10 is required.");
        }
        return legacy;
      };
      input.onchange = () => { if (input.files?.length) void load([...input.files]); input.value = ""; };
      const screen = p.parentElement!;
      screen.ondragover = e => { e.preventDefault(); p.classList.add("drag"); };
      screen.ondragleave = () => p.classList.remove("drag");
      screen.ondrop = e => {
        e.preventDefault();
        if (e.dataTransfer?.files.length) void load([...e.dataTransfer.files]);
      };
    };
    void show();
  });
}

async function cartridge(host: YellowHost, adventure: YellowAdventure, back: () => void) {
  const bytes = await stored(ADVENTURES[adventure].key);
  if (bytes) {
    const { verifyYellow } = await import("./rom");
    try {
      await verifyYellow(bytes, ADVENTURES[adventure].cartridge);
      return bytes;
    } catch { /* ask again */ }
  }
  return importCartridge(host, adventure, back);
}

export async function newYellowJourney(host: YellowHost, adventure: YellowAdventure, back: () => void) {
  const bytes = await cartridge(host, adventure, back);
  if (!bytes) return;
  await useAdventure(adventure);
  const [{ YellowRom }, { freshYellowSave, yellowSummary }] = await Promise.all([import("./rom"), import("./save")]);
  const rom = new YellowRom(bytes);
  const p = panel(host.layer, "Welcome to the world of Pokémon!",
    `<p>First, what is your name? And your rival's?</p>
    <label class="yellow-intro">Your name<input id="name" maxlength="7" value="RED" autocomplete="off"></label>
    <label class="yellow-intro">Rival's name<input id="rival" maxlength="7" value="BLUE" autocomplete="off"></label>
    <div class="buttons"><button id="begin">Begin journey</button><button class="secondary" id="back">Back</button></div>`,
    "opening-panel arrival-card yellow-intro");
  p.querySelector<HTMLButtonElement>("#back")!.onclick = back;
  p.querySelector<HTMLButtonElement>("#begin")!.onclick = async () => {
    const clean = (id: string, fallback: string) =>
      (p.querySelector<HTMLInputElement>(id)!.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim() || fallback).slice(0, 7);
    const save = freshYellowSave(rom, adventure, clean("#name", "RED"), clean("#rival", "BLUE"));
    save.settings.music = host.sound.enabled;
    let id: string;
    try {
      id = await createJourney(adventure, save, yellowSummary(save, () => "Pallet Town"));
    } catch {
      return host.journeys("Your adventure could not be saved. Allow browser storage or free some space.");
    }
    await start(host, { id, adventure, created: Date.now(), updated: Date.now() }, rom);
  };
}

export async function continueYellowJourney(host: YellowHost, entry: JourneyEntry & { adventure: YellowAdventure }) {
  const bytes = await cartridge(host, entry.adventure, () => host.journeys());
  if (!bytes) return;
  await useAdventure(entry.adventure);
  const { YellowRom } = await import("./rom");
  await start(host, entry, new YellowRom(bytes));
}

async function start(host: YellowHost, entry: JourneyEntry & { adventure: YellowAdventure }, rom: import("./rom").YellowRom) {
  panel(host.layer, "Opening your journey", "<p>Reading your browser save…</p>", "opening-panel");
  const [{ YellowGame }, { isYellowSave }] = await Promise.all([import("./runtime"), import("./save")]);
  let game: InstanceType<typeof YellowGame> | undefined;
  const store = new JourneyStore(entry.id, () => game?.summary());
  let data: unknown;
  try {
    data = await store.read();
  } catch {
    return host.journeys("Your browser could not read that journey.");
  }
  if (!isYellowSave(data, entry.adventure)) return host.journeys("That Yellow journey could not be read. Export it from the journey list to keep a copy.");
  // Journeys begun on Crystal's data get the current data's stats.
  data.party = data.party.map(mon => host.engine.restat(mon));
  data.storage = data.storage.map(mon => host.engine.restat(mon));
  host.layer.replaceChildren();
  game = new YellowGame({
    engine: host.engine, rom, input: host.input, menuInput: host.menuInput, layer: host.layer, canvas: host.canvas,
    sound: host.sound, sprite: host.sprite, cry: host.cry, store, save: data, saveWarning: host.saveWarning,
    exit: () => {
      game?.stop();
      host.activate(undefined);
      host.journeys();
    },
  });
  host.activate(game);
  if (import.meta.env.DEV) {
    (window as unknown as { __yellow: unknown }).__yellow = game;
    const started = game;
    (window as unknown as { yellowDebug: () => Promise<unknown> }).yellowDebug = () => import("./debug").then(m => m.attachDebug(started));
  }
  void host.sound.unlock();
}
