/** Starting and continuing Crystal and Crystal Legacy journeys from the journey list. */
import type { Engine } from "../engine";
import type { PokemonPortrait } from "../engine/appearance";
import { soundSetting, type GameAudio } from "../game/audio";
import type { Input } from "../game/input";
import type { MusicScene } from "../game/music";
import { createJourney, get, JourneyStore, set, type JourneyEntry } from "../game/storage";
import type { MenuInput } from "../ui/menu-input";
import { escapeHtml, panel, type PanelCursor } from "../ui/shell";
import type { CrystalAdventure } from "./save";
import type { CrystalCartridge } from "./symbols";

export interface CrystalHost {
  engine: Engine;
  input: Input;
  menuInput: MenuInput;
  layer: HTMLElement;
  canvas: HTMLCanvasElement;
  sound: GameAudio;
  saveWarning: HTMLElement;
  sprite: (mon: PokemonPortrait | number, back?: boolean) => string;
  cry: (species: number) => void;
  activate: (game: CrystalRunner | undefined) => void;
  journeys: (error?: string) => void;
}
export interface CrystalRunner {
  frame(now: number, dt: number): void;
  musicScene(): MusicScene | number;
  readonly scene: string;
}

const ADVENTURES: Record<CrystalAdventure, { cartridge: CrystalCartridge; key?: string }> = {
  crystal: { cartridge: "crystal" },
  "crystal-legacy": { cartridge: "legacy", key: "rom-crystal-legacy" },
};

export function isCrystalAdventure(adventure: unknown): adventure is CrystalAdventure {
  return typeof adventure === "string" && Object.hasOwn(ADVENTURES, adventure);
}

async function stored(key: string) {
  const bytes = await get(key).catch(() => undefined);
  return bytes instanceof Uint8Array ? bytes : undefined;
}
/** Whether the adventure still needs a file: Crystal plays from the cartridge Astra already has. */
export async function hasCrystalCartridge(adventure: CrystalAdventure) {
  const key = ADVENTURES[adventure].key;
  return !key || !!await stored(key);
}

async function useAdventure(adventure: CrystalAdventure) {
  const { useCrystalCartridge } = await import("./symbols");
  await useCrystalCartridge(ADVENTURES[adventure].cartridge);
}

export async function readCrystalBackup(data: { adventure: CrystalAdventure }) {
  const { isCrystalSave } = await import("./save");
  return isCrystalSave(data, data.adventure) ? data : undefined;
}

/** Asks for Crystal Legacy: the patched cartridge, or the official patch applied to Astra's Crystal. */
function importLegacy(host: CrystalHost, back: () => void): Promise<Uint8Array | undefined> {
  return new Promise(resolve => {
    const show = (message = "", error = true) => {
      const p = panel(host.layer, "Pokémon Crystal Legacy",
        `<p>This adventure plays Johto and Kanto as rebalanced by Crystal Legacy (by TheSmithPlays), read from your own cartridge. Choose your Pokémon Crystal patched with Crystal Legacy V1.3.1, or just the official V1.3.1 “USA 1.0” patch (.bps): Astra applies it in this browser to the Crystal cartridge you already gave it.</p><div class="drop"><button id="choose-rom">Choose file</button><input hidden type="file" multiple accept=".gb,.gbc,.bps,application/octet-stream"><span class="drop-hint">or drop it onto the screen</span></div>${message ? `<p ${error ? 'role="alert" class="error"' : 'role="status"'}>${escapeHtml(message)}</p>` : ""}<p class="cartridge-note">Your cartridge stays in this browser.</p><div class="buttons"><button class="secondary" id="back">Back</button></div>`,
        "rom-import arrival-card");
      const input = p.querySelector<HTMLInputElement>("input")!;
      p.querySelector<HTMLButtonElement>("#choose-rom")!.onclick = () => input.click();
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { resolve(undefined); back(); };
      const load = async (files: File[]) => {
        const [{ identifyCrystal }, { applyBps, isBps, BpsError }] = await Promise.all([import("./rom"), import("../yellow/bps")]);
        for (const file of files) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let legacy: Uint8Array | undefined;
          if (isBps(bytes)) {
            try {
              legacy = applyBps(host.engine.cartridge, bytes);
            } catch (error) {
              return show(error instanceof BpsError ? `${error.message} Choose the official Crystal Legacy V1.3.1 patch for the English Pokémon Crystal (USA 1.0).` : "The patch could not be applied.");
            }
          } else legacy = bytes;
          if (await identifyCrystal(legacy) !== "legacy") return show(`${file.name} is neither Crystal Legacy V1.3.1 nor its patch for this cartridge.`);
          try { await set(ADVENTURES["crystal-legacy"].key!, legacy); } catch { /* asked for again next time */ }
          return resolve(legacy);
        }
      };
      input.onchange = () => { if (input.files?.length) void load([...input.files]); input.value = ""; };
      const screen = p.parentElement!;
      screen.ondragover = e => { e.preventDefault(); p.classList.add("drag"); };
      screen.ondragleave = () => p.classList.remove("drag");
      screen.ondrop = e => { e.preventDefault(); if (e.dataTransfer?.files.length) void load([...e.dataTransfer.files]); };
    };
    show();
  });
}

async function cartridge(host: CrystalHost, adventure: CrystalAdventure, back: () => void) {
  const { key } = ADVENTURES[adventure];
  if (!key) return host.engine.cartridge;
  const bytes = await stored(key);
  if (bytes) {
    const { verifyCrystal } = await import("./rom");
    try {
      await verifyCrystal(bytes, "legacy");
      return bytes;
    } catch { /* ask again */ }
  }
  return importLegacy(host, back);
}

export async function newCrystalJourney(host: CrystalHost, adventure: CrystalAdventure, back: () => void) {
  const bytes = await cartridge(host, adventure, back);
  if (!bytes) return;
  await useAdventure(adventure);
  const [{ CrystalRom }, { freshCrystalSave, crystalSummary }, { C, MAP, ITEM }] = await Promise.all([import("./rom"), import("./save"), import("./symbols")]);
  const rom = new CrystalRom(bytes);
  const title = adventure === "crystal" ? "Pokémon Crystal" : "Pokémon Crystal Legacy";
  let gender: 0 | 1 = 0, chosen: string | undefined;
  const cursor: PanelCursor = {};
  const playerName = () => chosen ?? (gender ? "KRIS" : "GOLD");
  const intro = () => {
    const p = panel(host.layer, title,
      `<p>Hello! Sorry to keep you waiting! Welcome to the world of POKéMON! Are you a boy or a girl? And what is your name?</p>
      <div class="buttons crystal-gender"><button id="boy" aria-pressed="${gender === 0}">Boy</button><button id="girl" aria-pressed="${gender === 1}">Girl</button></div>
      <button class="name-entry" id="name">Your name<strong>${escapeHtml(playerName())}</strong></button>
      <p class="cartridge-note">Johto runs on your device's clock: morning, day and night come and go as they do for you.</p>
      <div class="buttons"><button id="begin">Begin journey</button><button class="secondary" id="back">Back</button></div>`,
      "opening-panel arrival-card yellow-intro", cursor);
    const pick = (g: 0 | 1) => { gender = g; intro(); };
    p.querySelector<HTMLButtonElement>("#boy")!.onclick = () => pick(0);
    p.querySelector<HTMLButtonElement>("#girl")!.onclick = () => pick(1);
    p.querySelector<HTMLButtonElement>("#name")!.onclick = async () => {
      const { askForName } = await import("../ui/naming");
      const name = await askForName(host.layer, { title: "Your name?", max: 7, fallback: playerName() });
      if (name) chosen = name;
      intro();
    };
    p.querySelector<HTMLButtonElement>("#back")!.onclick = back;
    p.querySelector<HTMLButtonElement>("#begin")!.onclick = begin;
  };
  const begin = async () => {
    const name = playerName();
    const save = freshCrystalSave(adventure, name, gender, "???");
    const [group, number] = MAP.PLAYERS_HOUSE_2F;
    Object.assign(save, { map: [group, number], x: 3, y: 3, facing: "up", spawn: { group, number } });
    save.pcItems[ITEM.POTION] = 1;
    save.settings.music = soundSetting(host.sound.mode);
    void C;
    let id: string;
    try {
      id = await createJourney(adventure, save, crystalSummary(save, "New Bark Town"));
    } catch {
      return host.journeys("Your adventure could not be saved. Allow browser storage or free some space.");
    }
    await start(host, { id, adventure, created: Date.now(), updated: Date.now() }, rom);
  };
  intro();
}

export async function continueCrystalJourney(host: CrystalHost, entry: JourneyEntry & { adventure: CrystalAdventure }) {
  const bytes = await cartridge(host, entry.adventure, () => host.journeys());
  if (!bytes) return;
  await useAdventure(entry.adventure);
  const { CrystalRom } = await import("./rom");
  await start(host, entry, new CrystalRom(bytes));
}

async function start(host: CrystalHost, entry: JourneyEntry & { adventure: CrystalAdventure }, rom: import("./rom").CrystalRom) {
  panel(host.layer, "Opening your journey", "<p>Reading your browser save…</p>", "opening-panel");
  const [{ CrystalGame }, { isCrystalSave }, { CrystalRenderer }] = await Promise.all([import("./runtime"), import("./save"), import("./render")]);
  await import("./crystal.css");
  let game: InstanceType<typeof CrystalGame> | undefined;
  const store = new JourneyStore(entry.id, () => game?.summary());
  let data: unknown;
  try {
    data = await store.read();
  } catch {
    return host.journeys("Your browser could not read that journey.");
  }
  if (!isCrystalSave(data, entry.adventure)) return host.journeys("That journey could not be read. Export it from the journey list to keep a copy.");
  data.party = data.party.map(mon => mon.egg ? mon : { ...host.engine.restat(mon), egg: undefined });
  host.layer.replaceChildren();
  game = new CrystalGame({
    engine: host.engine, rom, input: host.input, menuInput: host.menuInput, layer: host.layer, canvas: host.canvas,
    sound: host.sound, sprite: host.sprite, cry: host.cry, store, save: data, saveWarning: host.saveWarning,
    exit: () => {
      game?.stop();
      host.activate(undefined);
      host.journeys();
    },
  });
  game.renderer = new CrystalRenderer(game, host.canvas);
  host.activate(game);
  if (import.meta.env.DEV) (window as unknown as { __crystal: unknown }).__crystal = game;
  void host.sound.unlock();
  await game.begin();
}
