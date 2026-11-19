import { buildDex, dexFilters, type DexFilter } from "../game/pokedex";
import type { Action } from "../game/input";
import type { Save } from "../game/save";
import { typeNames } from "../game/type-names";
import { WORLD } from "../world";
import { escapeHtml } from "./shell";
import "./pokedex.css";

export type DexState = { filter?: DexFilter; selected?: Partial<Record<DexFilter, number>> };
type Control = Extract<Action, "up" | "down" | "left" | "right" | "a">;
type Species = { name: string; types: number[] };
type Options = {
  save: Save;
  state: DexState;
  species: (id: number) => Species;
  entry: (id: number) => { category: string; description: string };
  sprite: (id: number) => string;
  cry: (id: number) => void;
  onCancel: () => void;
};

const controllers = new WeakMap<Element, { input: (action: Control) => void }>();
export function dexController(layer: HTMLElement) {
  const dex = layer.querySelector(".pokedex");
  return dex ? controllers.get(dex) : undefined;
}

const pageSize = 6;
const number = (id: number) => String(id).padStart(3, "0");

function arrows(previous: string, next: string, label: string, position: number, total: number) {
  const vertical = label === "record page";
  return `<div class="dex-pager"><button data-command="${previous}" aria-label="Previous ${label}" ${position <= 0 ? "disabled" : ""}>${vertical ? "▴" : "◂"}</button><span>${position + 1} / ${total}</span><button data-command="${next}" aria-label="Next ${label}" ${position + 1 >= total ? "disabled" : ""}>${vertical ? "▾" : "▸"}</button></div>`;
}

export function mountPokedex(host: HTMLElement, options: Options) {
  const { state, save } = options;
  const cache = new Map<number, Species>();
  function species(id: number) {
    const data = cache.get(id) ?? options.species(id);
    cache.set(id, data);
    return data;
  }
  const { lists, habitats, seen, caught } = buildDex(save, id => species(id).types.includes(21));
  let filter = state.filter ?? (seen.size ? "Seen" : "All");
  const selected = state.selected ??= {};
  let mode: "filters" | "list" | "entry" = lists[filter].length ? "list" : "filters";
  let site = 0;
  const root = host.ownerDocument.createElement("section");
  root.className = "pokedex";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Pokédex");
  root.tabIndex = -1;
  host.replaceChildren(root);

  const ids = () => lists[filter];
  const index = () => Math.max(0, ids().indexOf(selected[filter] ?? -1));
  const name = (id: number) => seen.has(id) ? escapeHtml(species(id).name) : "Unknown";
  const status = (id: number) => caught.has(id) ? "Caught" : seen.has(id) ? "Seen" : "Unseen";

  function portrait(id?: number) {
    const known = id !== undefined && seen.has(id);
    const image = known && options.sprite(id);
    const types = known ? [...new Set(species(id).types)].map(type => typeNames[type]).filter(Boolean) : [];
    return `<div class="dex-specimen">
      <div class="dex-plate"><span class="dex-number">${id ? "#" + number(id) : "—"}</span>
        ${image ? `<img src="${image}" alt="">` : `<span class="dex-unknown">${id ? "?" : "—"}</span>`}
        ${id ? `<span class="dex-status"><i class="dex-mark" data-mark="${status(id)}"></i>${status(id)}</span>` : ""}
      </div>
      <strong class="dex-name">${id ? name(id) : "No entry"}</strong>
      <div class="dex-types">${types.map(type => `<span>${type}</span>`).join("")}</div>
    </div>`;
  }

  function catalogue(id: number | undefined, page: number) {
    const items = ids();
    const empty = filter === "Local" ? "No habitat records here." : filter === "Missing" ? "Every species caught!" : "No entries yet.";
    return `<div class="dex-register">
      <div class="dex-subhead"><span>${filter === "Local" ? "Local index" : "Index"}</span>
        ${items.length ? arrows("prev-page", "next-page", "page", page, Math.ceil(items.length / pageSize)) : ""}</div>
      <div class="dex-rows">${items.slice(page * pageSize, (page + 1) * pageSize).map(entry =>
        `<button data-id="${entry}" aria-label="${number(entry)} ${name(entry)}, ${status(entry)}" ${entry === id ? 'aria-current="true"' : ""}>
          <span>${number(entry)}</span><b>${name(entry)}</b><i class="dex-mark" data-mark="${status(entry)}" aria-hidden="true"></i></button>`
      ).join("") || `<div class="dex-empty">${empty}${filter === "Local" ? `<small>${escapeHtml(WORLD[save.map].name)}</small>` : ""}</div>`}</div>
    </div>`;
  }

  function entry(id: number) {
    const records = habitats.get(id) ?? [];
    const hasNotes = caught.has(id);
    const total = records.length + Number(hasNotes);
    const pager = total ? arrows("prev-site", "next-site", "record page", site, total) : "";
    if (hasNotes && site === 0) {
      const notes = options.entry(id);
      return `<div class="dex-register dex-notes">
        <div class="dex-subhead"><span>Field notes</span>${pager}</div>
        <div class="dex-description"><strong>${escapeHtml(notes.category)} Pokémon</strong><p>${escapeHtml(notes.description)}</p></div>
      </div>`;
    }
    const record = records[site - Number(hasNotes)];
    return `<div class="dex-register dex-record">
      <div class="dex-subhead"><span>Habitat</span>${pager}</div>
      ${record ? `<div class="dex-location"><small>${record.map.id === save.map ? "Current location" : save.visited.includes(record.map.id) ? "Visited" : "No visit recorded"}</small>
        <h3>${escapeHtml(record.map.name)}</h3></div>
        <div class="dex-method"><strong>${escapeHtml(record.method)} · Lv ${record.level}</strong><span>${escapeHtml(record.note)}</span></div>` : '<p class="dex-empty">No recorded habitat.</p>'}
    </div>`;
  }

  function render() {
    const i = index(), id = ids()[i];
    const detail = mode === "entry";
    const backLabel = detail ? "Index" : mode === "list" ? "Filters" : "Menu";
    root.dataset.mode = mode;
    root.innerHTML = `<div class="dex-frame">
      <header class="dex-head"><h2><i aria-hidden="true"></i>Pokédex</h2>
        <div class="dex-totals"><span>Seen <b>${seen.size}</b></span><span>Caught <b>${caught.size}/251</b></span></div></header>
      ${detail ? `<div class="dex-entry-nav"><span>Species record</span>${arrows("prev-entry", "next-entry", "species", i, ids().length)}</div>`
        : `<nav class="dex-filters" aria-label="Pokédex filters">${dexFilters.map(f => `<button data-filter="${f}" aria-pressed="${f === filter}">${f}</button>`).join("")}</nav>`}
      <div class="dex-body">${portrait(id)}${detail && id ? entry(id) : catalogue(id, Math.floor(i / pageSize))}</div>
      <footer class="dex-foot">${detail ? `<span>↔ Species</span><span>↕ Pages</span>${seen.has(id) ? '<button data-command="cry"><kbd>A</kbd> Cry</button>' : ""}`
        : mode === "list" ? '<span>↕ Select</span><span>↔ Page</span><button data-command="open"><kbd>A</kbd> Record</button>'
        : `<span>↔ Filter</span>${ids().length ? '<button data-command="browse"><kbd>↓</kbd> Browse</button>' : ""}`}
        <button id="back"><kbd>B</kbd> ${backLabel}</button></footer></div>`;
    const focus = mode === "filters" ? `[data-filter="${filter}"]` : detail ? ".dex-register" : `[data-id="${id}"]`;
    const target = root.querySelector<HTMLElement>(focus) ?? root;
    if (detail) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }

  function changeFilter(next: DexFilter) {
    state.filter = filter = next;
    mode = "filters";
    render();
  }
  function move(offset: number) {
    const i = index(), items = ids();
    const next = Math.max(0, Math.min(i + offset, items.length - 1));
    if (next === i || !items.length) return;
    selected[filter] = items[next];
    site = 0;
    render();
  }
  function turnPage(delta: number) {
    const page = Math.floor(index() / pageSize) + delta;
    if (page < 0 || page * pageSize >= ids().length) return;
    mode = "list";
    move(delta * pageSize);
  }
  function turnSite(delta: number) {
    const next = site + delta;
    const id = ids()[index()];
    const total = (habitats.get(id)?.length ?? 0) + Number(caught.has(id));
    if (next < 0 || next >= total) return;
    site = next;
    render();
  }
  function back() {
    if (mode === "filters") return options.onCancel();
    mode = mode === "entry" ? "list" : "filters";
    render();
  }
  function open() {
    if (!ids().length) return;
    mode = "entry";
    site = 0;
    render();
  }
  function browse() {
    if (!ids().length) return;
    mode = "list";
    render();
  }
  function cry() {
    const id = ids()[index()];
    if (seen.has(id)) options.cry(id);
  }
  function input(action: Control) {
    const delta = action === "up" || action === "left" ? -1 : 1;
    const horizontal = action === "left" || action === "right";
    if (mode === "filters") {
      if (horizontal) changeFilter(dexFilters[(dexFilters.indexOf(filter) + delta + dexFilters.length) % dexFilters.length]);
      else if (action === "down" || action === "a") browse();
    } else if (mode === "entry") {
      if (horizontal) move(delta);
      else if (action === "a") cry();
      else turnSite(delta);
    } else if (horizontal) turnPage(delta);
    else if (action === "a") open();
    else if (action === "up" && index() === 0) back();
    else move(delta);
  }

  const commands: Record<string, () => void> = {
    "prev-page": () => turnPage(-1), "next-page": () => turnPage(1),
    "prev-site": () => turnSite(-1), "next-site": () => turnSite(1),
    "prev-entry": () => move(-1), "next-entry": () => move(1),
    browse, open, cry,
  };
  root.onclick = event => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button || button.disabled) return;
    if (button.id === "back") back();
    else if (button.dataset.filter) changeFilter(button.dataset.filter as DexFilter);
    else if (button.dataset.id) {
      selected[filter] = Number(button.dataset.id);
      open();
    } else if (button.dataset.command) commands[button.dataset.command]?.();
  };
  controllers.set(root, { input });
  render();
}
