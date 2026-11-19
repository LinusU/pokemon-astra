import { initEngine, UnsupportedCartridge, type Engine } from "../engine";
import { get, set } from "../game/storage";
import { escapeHtml, panel } from "./shell";

export function openCartridge(layer: HTMLElement, onReady: (engine: Engine) => void) {
  function busy() {
    panel(layer, "Preparing Astra", "<p>Opening your cartridge…</p>", "opening-panel");
  }

  function choose(error = "") {
    const p = panel(layer, "Pokémon Astra",
      `<p>Choose your English Pokémon Crystal 1.1 cartridge file (.gbc) to begin.</p><div class="drop" id="drop"><button id="choose-rom">Choose ROM</button><input hidden id="rom" type="file" accept=".gbc,application/octet-stream"><span class="drop-hint small"> or drop your file here</span></div><p class="small muted">Your cartridge and save stay in this browser.</p>${error ? `<p role="alert" class="error">${escapeHtml(error)}</p>` : ""}`, "rom-import");
    const input = p.querySelector<HTMLInputElement>("#rom")!;
    p.querySelector<HTMLButtonElement>("#choose-rom")!.onclick = () => input.click();
    input.onchange = () => { if (input.files?.[0]) void loadFile(input.files[0]); };
    const drop = p.querySelector<HTMLElement>("#drop")!;
    drop.ondragover = event => { event.preventDefault(); drop.classList.add("drag"); };
    drop.ondragleave = () => drop.classList.remove("drag");
    drop.ondrop = event => {
      event.preventDefault();
      drop.classList.remove("drag");
      if (event.dataTransfer?.files[0]) void loadFile(event.dataTransfer.files[0]);
    };
  }

  async function loadFile(file: File) {
    busy();
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      return choose("The file could not be read. Choose your cartridge again.");
    }
    await start(bytes, true);
  }

  async function cache(bytes: Uint8Array, engine: Engine) {
    busy();
    try {
      await set("rom", bytes);
    } catch {
      const p = panel(layer, "Cartridge ready",
        '<p>Your cartridge is valid. The browser could not keep a copy. You can play now and choose the file again next time, or free some space and retry.</p><div class="buttons"><button id="play">Play now</button><button class="secondary" id="retry">Retry storage</button></div>', "opening-panel");
      p.querySelector<HTMLButtonElement>("#play")!.onclick = () => onReady(engine);
      p.querySelector<HTMLButtonElement>("#retry")!.onclick = () => void cache(bytes, engine);
      return;
    }
    onReady(engine);
  }

  async function start(bytes: Uint8Array, cacheCopy: boolean) {
    busy();
    let engine: Engine;
    try {
      engine = await initEngine(bytes);
    } catch (error) {
      if (error instanceof UnsupportedCartridge) return choose(error.message);
      const p = panel(layer, "Game engine unavailable",
        '<p>Astra could not open its game engine. Reconnect if this is your first visit, then try again.</p><button id="retry">Try again</button>', "opening-panel");
      p.querySelector<HTMLButtonElement>("#retry")!.onclick = () => void start(bytes, cacheCopy);
      return;
    }
    if (cacheCopy) await cache(bytes, engine);
    else onReady(engine);
  }

  async function readCartridge() {
    busy();
    let bytes: unknown;
    try {
      bytes = await get("rom");
    } catch {
      const p = panel(layer, "Cartridge storage unavailable",
        '<p>Astra could not read this browser’s cartridge storage.</p><div class="buttons"><button id="retry">Try again</button><button class="secondary" id="choose-rom">Choose ROM</button></div>', "opening-panel");
      p.querySelector<HTMLButtonElement>("#retry")!.onclick = () => void readCartridge();
      p.querySelector<HTMLButtonElement>("#choose-rom")!.onclick = () => choose();
      return;
    }
    if (bytes instanceof Uint8Array) await start(bytes, false);
    else choose(bytes === undefined ? "" : "The stored cartridge is unreadable. Choose your original file again.");
  }
  void readCartridge();
}
