/** Starting and continuing Yellow journeys from the journey list. */
import type { Engine } from "../engine";
import type { PokemonPortrait } from "../engine/appearance";
import type { GameAudio } from "../game/audio";
import type { Input } from "../game/input";
import type { MusicScene } from "../game/music";
import { createJourney, get, JourneyStore, set, type JourneyEntry } from "../game/storage";
import type { MenuInput } from "../ui/menu-input";
import { escapeHtml, panel } from "../ui/shell";

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

const ROM_KEY = "rom-yellow";

export async function hasYellowCartridge() {
  try {
    return (await get(ROM_KEY)) instanceof Uint8Array;
  } catch {
    return false;
  }
}

/** Asks for the player's own Yellow cartridge, verifies and keeps it. */
function importCartridge(host: YellowHost, back: () => void): Promise<Uint8Array | undefined> {
  return new Promise(resolve => {
    const show = (error = "") => {
      const p = panel(host.layer, "Pokémon Yellow",
        `<p>This adventure reads Kanto's maps, story and dialogue from your English Pokémon Yellow cartridge (.gbc). Battles, menus and sound still use Astra's engine and your Crystal cartridge.</p><div class="drop"><button id="choose-rom">Choose ROM</button><input hidden type="file" accept=".gb,.gbc,application/octet-stream"><span class="drop-hint">or drop it onto the screen</span></div>${error ? `<p role="alert" class="error">${escapeHtml(error)}</p>` : ""}<p class="cartridge-note">Your cartridge stays in this browser.</p><div class="buttons"><button class="secondary" id="back">Back</button></div>`,
        "rom-import arrival-card");
      const input = p.querySelector<HTMLInputElement>("input")!;
      p.querySelector<HTMLButtonElement>("#choose-rom")!.onclick = () => input.click();
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { resolve(undefined); back(); };
      const load = async (file: File) => {
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(await file.arrayBuffer());
          const { verifyYellow } = await import("./rom");
          await verifyYellow(bytes);
        } catch (error) {
          return show(error instanceof Error ? error.message : "The file could not be read.");
        }
        try {
          await set(ROM_KEY, bytes);
        } catch {
          // Playing still works; the cartridge is asked for again next time.
        }
        resolve(bytes);
      };
      input.onchange = () => { if (input.files?.[0]) void load(input.files[0]); };
      const screen = p.parentElement!;
      screen.ondragover = e => { e.preventDefault(); p.classList.add("drag"); };
      screen.ondragleave = () => p.classList.remove("drag");
      screen.ondrop = e => {
        e.preventDefault();
        if (e.dataTransfer?.files[0]) void load(e.dataTransfer.files[0]);
      };
    };
    show();
  });
}

async function cartridge(host: YellowHost, back: () => void) {
  const stored = await get(ROM_KEY).catch(() => undefined);
  if (stored instanceof Uint8Array) {
    const { verifyYellow } = await import("./rom");
    try {
      await verifyYellow(stored);
      return stored;
    } catch { /* ask again */ }
  }
  return importCartridge(host, back);
}

export async function newYellowJourney(host: YellowHost, back: () => void) {
  const bytes = await cartridge(host, back);
  if (!bytes) return;
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
    const save = freshYellowSave(rom, clean("#name", "RED"), clean("#rival", "BLUE"));
    save.settings.music = host.sound.enabled;
    let id: string;
    try {
      id = await createJourney("yellow", save, yellowSummary(save, () => "Pallet Town"));
    } catch {
      return host.journeys("Your adventure could not be saved. Allow browser storage or free some space.");
    }
    await start(host, { id, adventure: "yellow", created: Date.now(), updated: Date.now() }, rom);
  };
}

export async function continueYellowJourney(host: YellowHost, entry: JourneyEntry) {
  const bytes = await cartridge(host, () => host.journeys());
  if (!bytes) return;
  const { YellowRom } = await import("./rom");
  await start(host, entry, new YellowRom(bytes));
}

async function start(host: YellowHost, entry: JourneyEntry, rom: import("./rom").YellowRom) {
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
  if (!isYellowSave(data)) return host.journeys("That Yellow journey could not be read. Export it from the journey list to keep a copy.");
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
