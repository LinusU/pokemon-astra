import { portraitNumber } from "../engine/appearance";
import type { Engine, Pokemon } from "../engine";
import { canDeposit, depositPokemon, withdrawPokemon, type Collection } from "../game/collection";
import type { Save } from "../game/save";
import { JourneyConflict } from "../game/storage";
import { typeNames } from "../game/type-names";
import { battleStatus, mountParty } from "./party";
import { mountPartnerSummary } from "./partner-summary";
import { mountStorageIndex, type PcControl } from "./storage-index";
import { escapeHtml as html } from "./shell";
import "./storage-pc.css";

type Tab = "storage" | "party";
export type PcState = { tab?: Tab; storage?: number; party?: number };
type Options = {
  save: Save;
  state: PcState;
  engine: Engine;
  itemName: (key: string) => string;
  sprite: (mon: Pokemon) => string;
  saveTransfer: (roster: Collection) => Promise<void>;
  onClose: () => void;
  /** Party slots the PC doesn't list but that count towards six, such as Eggs. */
  reserved?: number;
};

const controllers = new WeakMap<Element, { input: (action: PcControl) => void }>();
export function pcController(layer: HTMLElement) {
  const root = layer.querySelector(".storage-pc");
  return root ? controllers.get(root) : undefined;
}

const pageSize = 6;
export function mountStoragePc(host: HTMLElement, options: Options) {
  const { save, state, engine } = options;
  let tab: Tab = state.tab ?? (save.storage.length ? "storage" : "party");
  let mode: "tabs" | "roster" | "detail" = "tabs";
  let receipt = "";
  let writing = false;
  const root = host.ownerDocument.createElement("section");
  root.className = "storage-pc";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Pokémon Storage PC");
  host.replaceChildren(root);

  const list = () => save[tab];
  const index = () => Math.max(0, Math.min(state[tab] ?? 0, list().length - 1));
  const name = (mon: Pokemon) => mon.nickname || engine.species(mon.species).name;
  const condition = (mon: Pokemon) => mon.hp === 0 ? "FNT" : battleStatus(mon.status)?.[0] ?? "";
  const reserved = options.reserved ?? 0;
  const full = () => save.party.length + reserved >= 6;
  const action = () => tab === "party" ? "Deposit" : !full() ? "Withdraw" : "Swap";
  const canFind = () => tab === "storage" && mode === "tabs" && save.storage.length > pageSize;
  const eligible = () => tab === "party" ? canDeposit(save.party, index())
    : !full() || save.party.some((_, i) => canDeposit(save.party, i, list()[index()]));

  function profile(mon: Pokemon) {
    const species = engine.species(mon.species);
    const types = [...new Set(species.types)].map(type => typeNames[type]).join(" / ");
    const hp = Math.min(100, 100 * mon.hp / Math.max(1, mon.stats[0]));
    return `<div class="pc-profile"><div class="pc-portrait">
      <span>${portraitNumber(mon)}</span><img src="${options.sprite(mon)}" alt="${html(species.name)}">
      </div><strong>${html(name(mon))}</strong><small>${types}</small>
      <div class="pc-vitals"><div>Lv ${mon.level}<b>${condition(mon)}</b></div>
        <div class="pc-hp"><i style="width:${hp}%"></i></div><div>HP ${mon.hp}/${mon.stats[0]}</div></div></div>`;
  }

  function roster() {
    const mons = list(), i = index(), start = Math.floor(i / pageSize) * pageSize;
    if (!mons.length) return `<div class="pc-empty"><i class="pc-terminal" aria-hidden="true"></i>
      <h2>${tab === "storage" ? "Storage is empty" : "No partners yet"}</h2>
      <p>${tab === "storage" ? "Choose Party to deposit a Pokémon. Extra catches arrive here when your party is full." : "Visit Professor Alder in Dewdrop to choose a partner."}</p></div>`;
    const detail = mode === "detail";
    const mon = mons[i];
    const pages = Math.ceil(mons.length / pageSize);
    const heading = detail ? "Known moves" : tab === "storage" ? "Pokédex order" : "Party order";
    const content = detail
      ? `<div class="pc-moves">${mon.moves.map((id, slot) => id ? `<div>${html(engine.move(id).name)}<small>${mon.pp[slot] & 63} PP</small></div>` : "").join("")}</div>
        ${eligible() ? `<button class="pc-action" data-command="confirm"><kbd>A</kbd> ${action()}${action() === "Swap" ? " with party" : ""}</button>`
          : '<p class="pc-locked">Keep one healthy Pokémon in your party.</p>'}`
      : `<div class="pc-rows">${mons.slice(start, start + pageSize).map((entry, j) =>
        `<button data-row="${start + j}" ${start + j === i ? 'aria-current="true"' : ""}>
          <span>${tab === "party" ? start + j + 1 : String(entry.species).padStart(3, "0")}</span>
          <strong>${html(name(entry))}</strong><small>Lv${entry.level}</small></button>`).join("")}</div>`;
    return `<div class="pc-body">${profile(mon)}<div class="pc-register"><div class="pc-rule"><span>${heading}</span>
      ${!detail && pages > 1 ? `<div class="pc-pages"><button data-jump="-1" aria-label="Previous page" ${start === 0 ? "disabled" : ""}>◂</button>
        <span>${start / pageSize + 1}/${pages}</span><button data-jump="1" aria-label="Next page" ${start + pageSize >= mons.length ? "disabled" : ""}>▸</button></div>` : ""}</div>${content}</div></div>`;
  }

  function render() {
    const detail = mode === "detail";
    const transferAvailable = detail && eligible();
    let tip = mode === "tabs" ? "← → Select   ↓ Browse" : "↑ ↓ Select   ← → Page";
    if (detail) {
      if (!transferAvailable) tip = "You can still inspect this Pokémon.";
      else if (action() === "Swap") tip = "Choose a party member to exchange.";
      else tip = tab === "party" ? "Send this Pokémon to the Center PC." : "Add this Pokémon to your party.";
    }
    const primary = detail
      ? `<button data-summary><kbd>${transferAvailable ? "→" : "A"}</kbd> Summary</button>`
      : list().length ? `<button data-command="confirm"><kbd>A</kbd> ${mode === "tabs" ? "Browse" : "Inspect"}</button>` : "<span></span>";
    root.dataset.mode = mode;
    root.innerHTML = `<header class="pc-head"><h1><i class="pc-terminal" aria-hidden="true"></i>Pokémon Storage</h1><span>Center PC</span></header>
      <nav class="pc-tabs" aria-label="Pokémon lists">
      <button data-tab="storage" aria-pressed="${tab === "storage"}">Stored <b>${save.storage.length}</b></button>
      <button data-tab="party" aria-pressed="${tab === "party"}">Party <b>${save.party.length + reserved}/6</b></button></nav>
      ${roster()}<p class="pc-tip" role="status">${html(receipt || tip)}</p>
      <footer class="pc-foot">${primary}
      ${canFind() ? '<button data-find><kbd>↑</kbd> Find species</button>' : ""}
      <button id="back"><kbd>B</kbd> ${mode === "tabs" ? "Log off" : "Back"}</button></footer>`;
    const target = detail ? ".pc-action, [data-summary]" : mode === "tabs" ? '[aria-pressed="true"]' : '[aria-current="true"]';
    root.querySelector<HTMLButtonElement>(target)?.focus({ preventScroll: true });
  }

  function selectTab(next: Tab) {
    state.tab = tab = next;
    mode = "tabs";
    receipt = "";
    render();
  }
  function findSpecies() {
    const restore = () => { host.replaceChildren(root); render(); };
    const finder = mountStorageIndex(host, save.storage, index(), id => engine.species(id).name, i => {
      state.storage = i;
      mode = "roster";
      receipt = "";
      restore();
    }, restore);
    controllers.set(finder.root, finder);
  }
  async function transfer(change: (roster: Collection) => boolean, text: string) {
    if (writing) return;
    const roster = { party: [...save.party], storage: [...save.storage] };
    if (!change(roster)) return;
    writing = true;
    receipt = "Saving transfer…";
    host.replaceChildren(root);
    root.inert = true;
    render();
    try {
      await options.saveTransfer(roster);
      state[tab] = index();
      mode = list().length ? "roster" : "tabs";
      receipt = text;
    } catch (error) {
      mode = "detail";
      receipt = error instanceof JourneyConflict ? "Another window saved. Check Menu → Options." : "Save failed. Try the transfer again.";
    }
    writing = false;
    root.inert = false;
    render();
  }
  function swap(incoming: Pokemon) {
    host.replaceChildren();
    mountParty(host, {
      title: "Swap for " + name(incoming), confirm: "Swap",
      rows: save.party.map((mon, i) => ({
        name: name(mon), level: mon.level, status: mon.status, hp: mon.hp, maxHp: mon.stats[0],
        sprite: options.sprite(mon), disabled: !canDeposit(save.party, i, incoming),
      })),
      onSelect: i => {
        const outgoing = name(save.party[i]);
        void transfer(roster => withdrawPokemon(roster, incoming, i), `${name(incoming)} joined your party. ${outgoing} was stored.`);
      },
      onBack: () => { host.replaceChildren(root); render(); },
    });
  }
  function summary() {
    const mon = list()[index()];
    mountPartnerSummary(host, mon, {
      engine, image: options.sprite(mon), itemName: options.itemName,
      onBack: () => { host.replaceChildren(root); render(); },
    });
  }
  function confirm() {
    const mon = list()[index()];
    if (!mon) return;
    receipt = "";
    if (mode !== "detail") {
      mode = mode === "tabs" ? "roster" : "detail";
      render();
    } else if (eligible()) {
      if (tab === "party") {
        void transfer(roster => depositPokemon(roster, index()), `${name(mon)} was deposited.`);
      } else if (full()) swap(mon);
      else void transfer(roster => withdrawPokemon(roster, mon), `${name(mon)} joined your party.`);
    } else summary();
  }
  function back() {
    receipt = "";
    if (mode === "tabs") return options.onClose();
    mode = mode === "detail" ? "roster" : "tabs";
    render();
  }
  function move(delta: number) {
    receipt = "";
    mode = "roster";
    state[tab] = Math.max(0, Math.min(index() + delta, list().length - 1));
    render();
  }
  function input(action: PcControl) {
    if (writing) return;
    if (action === "a") return confirm();
    if (mode === "detail") {
      if (action === "right") summary();
      return;
    }
    const horizontal = action === "left" || action === "right";
    if (mode === "tabs") {
      if (horizontal) selectTab(tab === "party" ? "storage" : "party");
      else if (action === "up" && canFind()) findSpecies();
      else if (action === "down" && list().length) move(0);
    } else if (action === "up" && index() === 0) back();
    else if (horizontal) {
      const page = Math.floor(index() / pageSize) + (action === "left" ? -1 : 1);
      if (page >= 0 && page * pageSize < list().length) move(action === "left" ? -pageSize : pageSize);
    } else move(action === "up" ? -1 : 1);
  }
  root.onclick = event => {
    const b = event.target instanceof Element ? event.target.closest("button") : null;
    if (!b || b.disabled) return;
    if (b.id === "back") back();
    else if (b.hasAttribute("data-find")) findSpecies();
    else if (b.hasAttribute("data-summary")) summary();
    else if (b.dataset.tab) selectTab(b.dataset.tab as Tab);
    else if (b.dataset.jump) move(Number(b.dataset.jump) * pageSize);
    else if (b.dataset.row !== undefined) {
      receipt = "";
      state[tab] = Number(b.dataset.row);
      mode = "detail";
      render();
    } else if (b.dataset.command) confirm();
  };
  controllers.set(root, { input });
  render();
}
