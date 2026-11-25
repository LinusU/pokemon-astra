import { hasCrystalCartridge, importCrystalLegacy } from "../crystal/launch";
import { EMERALD_ROM_KEY, EmeraldPortraits, UnsupportedEmeraldCartridge } from "../emerald/portraits";
import { get, remove, set } from "../game/storage";
import { hasYellowCartridge, importYellowCartridge } from "../yellow/launch";
import { escapeHtml, panel, type PanelCursor } from "./shell";
import "./rom-manager.css";

export async function storedEmerald() {
  const bytes = await get<Uint8Array<ArrayBuffer>>(EMERALD_ROM_KEY);
  if (bytes instanceof Uint8Array) return EmeraldPortraits.open(bytes);
}

interface Options {
  crystal?: Uint8Array;
  emerald?: EmeraldPortraits;
  onEmerald: (emerald: EmeraldPortraits | undefined) => void;
  back: () => void;
  addCrystal?: () => void;
}

export function mountRomManager(layer: HTMLElement, options: Options) {
  const cursor: PanelCursor = {};
  let emerald = options.emerald;
  let yellow = false, yellowLegacy = false, crystalLegacy = false;

  function show(error = "") {
    const status = (added: boolean) => added ? "Added" : "Missing";
    const p = panel(layer, "ROM manager", `
      <dl class="rom-list">
        <div><dt>Pokémon Crystal</dt><dd>${status(!!options.crystal)}${options.addCrystal ? '<button id="add-crystal">Add Crystal</button>' : ""}</dd></div>
        <div><dt>Pokémon Yellow</dt><dd>${status(yellow)}${yellow ? "" : '<button id="add-yellow">Add Yellow</button>'}</dd></div>
        <div><dt>Yellow Legacy</dt><dd>${status(yellowLegacy)}${yellowLegacy ? "" : '<button id="add-yellow-legacy">Add Yellow Legacy</button>'}</dd></div>
        <div><dt>Crystal Legacy</dt><dd>${status(crystalLegacy)}${crystalLegacy || !options.crystal ? "" : '<button id="add-crystal-legacy">Add Crystal Legacy</button>'}</dd></div>
        <div><dt>Pokémon Emerald <small>Optional sprites</small></dt><dd>${emerald ? 'Added<button class="secondary" id="remove-emerald">Remove Emerald</button>' : 'Missing<button id="add-emerald">Add Emerald</button>'}</dd></div>
      </dl>
      <input hidden type="file" accept=".gba,application/octet-stream">
      ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
      <p class="cartridge-note">ROMs stay in this browser. Adding Emerald uses its Pokémon sprites in every journey.</p>
      <div class="buttons"><button id="back" class="secondary">Back</button></div>`, "opening-panel arrival-card rom-manager", cursor);

    const button = (id: string) => p.querySelector<HTMLButtonElement>("#" + id);
    const onClick = (id: string, action: () => void) => button(id)?.addEventListener("click", action);
    const file = p.querySelector<HTMLInputElement>("input")!;
    onClick("back", options.back);
    if (options.addCrystal) onClick("add-crystal", options.addCrystal);
    for (const adventure of ["yellow", "yellow-legacy"] as const) {
      onClick("add-" + adventure, async () => {
        if (await importYellowCartridge(layer, adventure, show)) await readStatus();
      });
    }
    onClick("add-crystal-legacy", async () => {
      if (await importCrystalLegacy(layer, options.crystal!, show)) await readStatus();
    });
    onClick("add-emerald", () => file.click());
    const load = async (chosen: File) => {
      panel(layer, "Checking Pokémon Emerald", "<p>Reading your cartridge…</p>", "opening-panel");
      let added: EmeraldPortraits;
      let bytes: Uint8Array<ArrayBuffer>;
      try {
        bytes = new Uint8Array(await chosen.arrayBuffer());
        added = await EmeraldPortraits.open(bytes);
      } catch (error) {
        return show(error instanceof UnsupportedEmeraldCartridge ? error.message : "The Emerald ROM could not be verified. Try choosing the file again.");
      }
      try {
        await set(EMERALD_ROM_KEY, bytes);
      } catch {
        return show("The browser could not store Emerald. Free some space and try again.");
      }
      options.onEmerald(emerald = added);
      cursor.key = "remove-emerald";
      show();
    };
    file.onchange = () => { if (file.files?.[0]) void load(file.files[0]); };
    if (!emerald) {
      p.ondragover = event => {
        if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
      };
      p.ondrop = event => {
        event.preventDefault();
        if (event.dataTransfer?.files[0]) void load(event.dataTransfer.files[0]);
      };
    }
    onClick("remove-emerald", async () => {
      panel(layer, "Removing Pokémon Emerald", "<p>Updating your cartridges…</p>", "opening-panel");
      try {
        await remove(EMERALD_ROM_KEY);
      } catch {
        return show("The browser could not remove Emerald. Try again.");
      }
      options.onEmerald(emerald = undefined);
      cursor.key = "add-emerald";
      show();
    });
  }

  async function readStatus() {
    panel(layer, "ROM manager", "<p>Reading your cartridges…</p>", "opening-panel");
    [yellow, yellowLegacy, crystalLegacy] = await Promise.all([
      hasYellowCartridge("yellow"),
      hasYellowCartridge("yellow-legacy"),
      hasCrystalCartridge("crystal-legacy"),
    ]);
    show();
  }
  void readStatus();
}
