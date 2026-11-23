import { buildDex, dexFilters, locateHabitat, type HabitatRecord } from "../game/pokedex";
import type { Action } from "../game/input";
import { meetsRequirement, type Save } from "../game/save";
import { typeNames } from "../game/type-names";
import { WORLD } from "../world";
import { escapeHtml } from "./shell";
import { drawHabitatChart } from "./region-map";
import "./pokedex.css";

export type DexState = { filter?: string; selected?: Record<string, number> };
type Control = Extract<Action, "up" | "down" | "left" | "right" | "a">;
type Species = { name: string; types: number[] };
/** One place a species is found, as its record page prints it. */
export type DexRecord = { place: string; visit: string; method: string; note: string };
/** What an adventure's Pokédex knows: its lists by filter and its habitat records. */
export type DexData<R extends DexRecord = DexRecord> = {
  filters: readonly string[];
  lists: Record<string, number[]>;
  seen: Set<number>;
  caught: Set<number>;
  total: number;
  habitats: Map<number, R[]>;
  /** The filter listing what lives where the player stands, and that place's name. */
  local?: { filter: string; place: string };
};
type Options<R extends DexRecord> = {
  dex: DexData<R>;
  state: DexState;
  species: (id: number) => Species;
  entry: (id: number) => { category: string; description: string };
  sprite: (id: number) => string;
  cry: (id: number) => void;
  onCancel: () => void;
  /** Draws a record's habitat on the Pokédex's own map page. */
  map?: (canvas: HTMLCanvasElement, record: R, zoom: number) => { label: string; hint: string };
  /** Opens the adventure's own map of where a species lives, as the cartridge's Area page does. */
  area?: (id: number) => void;
};

/** A cartridge adventure's Pokédex: the species it has seen and caught, in order, without habitat records. */
export function cartridgeDex(total: number, seenIds: number[], caughtIds: number[]): DexData {
  const all = Array.from({ length: total }, (_, index) => index + 1);
  const seen = new Set(seenIds.filter(id => id <= total)), caught = new Set(caughtIds.filter(id => id <= total));
  return {
    filters: ["All", "Seen", "Caught", "Missing"], seen, caught, total, habitats: new Map(),
    lists: { All: all, Seen: all.filter(id => seen.has(id)), Caught: all.filter(id => caught.has(id)), Missing: all.filter(id => !caught.has(id)) },
  };
}

/** The Astra region's Pokédex: every habitat on record, with the region chart for its map page. */
export function astraDex(save: Save, species: (id: number) => Species): Pick<Options<DexRecord & { habitat: HabitatRecord }>, "dex" | "map"> {
  const { lists, habitats, seen, caught } = buildDex(save, id => species(id).types.includes(21));
  const records = new Map([...habitats].map(([id, list]) => [id, list.map(habitat => ({
    habitat, place: habitat.map.name, method: `${habitat.method} · Lv ${habitat.level}`, note: habitat.note,
    visit: habitat.map.id === save.map ? "Current location" : save.visited.includes(habitat.map.id) ? "Visited" : "No visit recorded",
  }))]));
  return {
    dex: { filters: dexFilters, lists, seen, caught, total: 251, habitats: records, local: { filter: "Local", place: WORLD[save.map].name } },
    map(canvas, { habitat }, zoom) {
      const { position, hint } = locateHabitat(habitat, save, req => meetsRequirement(save, req, n => species(n).types));
      drawHabitatChart(canvas, save, position, !habitat.contact && position.area === habitat.map.id, zoom);
      return { label: `Habitat in ${WORLD[position.area].name}. You are in ${WORLD[save.map].name}.`, hint };
    },
  };
}

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

export function mountPokedex<R extends DexRecord>(host: HTMLElement, options: Options<R>) {
  const { state } = options;
  const cache = new Map<number, Species>();
  function species(id: number) {
    const data = cache.get(id) ?? options.species(id);
    cache.set(id, data);
    return data;
  }
  const { lists, habitats, seen, caught, filters, local } = options.dex;
  let filter = state.filter && lists[state.filter] ? state.filter : seen.size && lists.Seen ? "Seen" : filters[0];
  const selected = state.selected ??= {};
  let mode: "filters" | "list" | "entry" | "map" = lists[filter].length ? "list" : "filters";
  let site = 0;
  let mapZoom = 2;
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
    const here = filter === local?.filter;
    const empty = here ? "No habitat records here." : filter === "Missing" ? "Every species caught!" : "No entries yet.";
    return `<div class="dex-register">
      <div class="dex-subhead"><span>${here ? "Local index" : "Index"}</span>
        ${items.length ? arrows("prev-page", "next-page", "page", page, Math.ceil(items.length / pageSize)) : ""}</div>
      <div class="dex-rows">${items.slice(page * pageSize, (page + 1) * pageSize).map(entry =>
        `<button data-id="${entry}" aria-label="${number(entry)} ${name(entry)}, ${status(entry)}" ${entry === id ? 'aria-current="true"' : ""}>
          <span>${number(entry)}</span><b>${name(entry)}</b><i class="dex-mark" data-mark="${status(entry)}" aria-hidden="true"></i></button>`
      ).join("") || `<div class="dex-empty">${empty}${here ? `<small>${escapeHtml(local!.place)}</small>` : ""}</div>`}</div>
    </div>`;
  }

  function habitat(id: number) {
    return habitats.get(id)?.[site - Number(caught.has(id))];
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
    const record = habitat(id);
    return `<div class="dex-register dex-record">
      <div class="dex-subhead"><span>${options.area ? "Field notes" : "Habitat"}</span>${pager}</div>
      ${record ? `<div class="dex-location"><small>${escapeHtml(record.visit)}</small>
        <h3>${escapeHtml(record.place)}</h3></div>
        <div class="dex-method"><strong>${escapeHtml(record.method)}</strong><span>${escapeHtml(record.note)}</span></div>`
        : `<p class="dex-empty">${options.area && seen.has(id) ? "Its field notes are filled in once it is caught." : "No recorded habitat."}</p>`}
    </div>`;
  }

  function showMap(id: number, record: R) {
    root.innerHTML = `<div class="dex-atlas">
      <header class="dex-head"><h2>Habitat map</h2><span>#${number(id)} ${name(id)}</span></header>
      <div class="dex-map-paper"><canvas role="img"></canvas></div>
      <div class="dex-map-route" tabindex="-1"><h3>${escapeHtml(record.place)}</h3><p></p></div>
      <footer class="dex-foot"><span class="dex-map-legend"><i aria-hidden="true"></i>Habitat</span>
        <button data-command="zoom" aria-label="${mapZoom === 1 ? "Zoom in" : "Zoom out"}"><kbd>${mapZoom === 1 ? "↑" : "↓"}</kbd> Zoom ${mapZoom === 1 ? "+" : "−"}</button>
        ${seen.has(id) ? '<button data-command="cry"><kbd>A</kbd> Cry</button>' : ""}
        <button id="back"><kbd>B</kbd> Record</button></footer></div>`;
    const canvas = root.querySelector("canvas")!;
    const { label, hint } = options.map!(canvas, record, mapZoom);
    canvas.setAttribute("aria-label", label);
    root.querySelector(".dex-map-route p")!.textContent = hint;
    root.querySelector<HTMLElement>(".dex-map-route")!.focus({ preventScroll: true });
  }

  function render() {
    const i = index(), id = ids()[i];
    root.dataset.mode = mode;
    if (mode === "map") return showMap(id, habitat(id)!);
    const detail = mode === "entry";
    const backLabel = detail ? "Index" : mode === "list" ? "Filters" : "Menu";
    root.innerHTML = `<div class="dex-frame">
      <header class="dex-head"><h2><i aria-hidden="true"></i>Pokédex</h2>
        <div class="dex-totals"><span>Seen <b>${lists.Seen?.length ?? seen.size}</b></span><span>Caught <b>${lists.Caught?.length ?? caught.size}/${options.dex.total}</b></span></div></header>
      ${detail ? `<div class="dex-entry-nav"><span>Species record</span>${arrows("prev-entry", "next-entry", "species", i, ids().length)}</div>`
        : `<nav class="dex-filters" aria-label="Pokédex filters">${filters.map(f => `<button data-filter="${f}" aria-pressed="${f === filter}">${f}</button>`).join("")}</nav>`}
      <div class="dex-body">${portrait(id)}${detail && id ? entry(id) : catalogue(id, Math.floor(i / pageSize))}</div>
      <footer class="dex-foot">${detail ? `<span>↔ Species</span><span>↕ Pages</span>${canMap(id)
        ? '<button data-command="map"><kbd>A</kbd> Map</button>' : options.area && seen.has(id) ? '<button data-command="area"><kbd>A</kbd> Area</button>'
        : seen.has(id) ? '<button data-command="cry"><kbd>A</kbd> Cry</button>' : ""}`
        : mode === "list" ? '<span>↕ Select</span><span>↔ Page</span><button data-command="open"><kbd>A</kbd> Record</button>'
        : `<span>↔ Filter</span>${ids().length ? '<button data-command="browse"><kbd>↓</kbd> Browse</button>' : ""}`}
        <button id="back"><kbd>B</kbd> ${backLabel}</button></footer></div>`;
    const focus = mode === "filters" ? `[data-filter="${filter}"]` : detail ? ".dex-register" : `[data-id="${id}"]`;
    const target = root.querySelector<HTMLElement>(focus) ?? root;
    if (detail) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }

  const canMap = (id: number) => !!options.map && !!habitat(id);
  function changeFilter(next: string) {
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
    mode = mode === "map" ? "entry" : mode === "entry" ? "list" : "filters";
    render();
  }
  function open() {
    if (!ids().length) return;
    mode = "entry";
    site = 0;
    render();
    // The cartridge's Pokédex greets an entry with its cry; there A is for its Area.
    if (options.area) cry();
  }
  function area() {
    const id = ids()[index()];
    if (seen.has(id)) options.area?.(id);
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
  function openMap() {
    if (!canMap(ids()[index()])) return;
    mapZoom = 2;
    mode = "map";
    render();
  }
  function zoom(level: number) {
    if (mapZoom === level) return;
    mapZoom = level;
    render();
  }
  function input(action: Control) {
    const delta = action === "up" || action === "left" ? -1 : 1;
    const horizontal = action === "left" || action === "right";
    if (mode === "map") {
      if (action === "a") cry();
      else if (action === "up" || action === "down") zoom(action === "up" ? 2 : 1);
    } else if (mode === "filters") {
      if (horizontal) changeFilter(filters[(filters.indexOf(filter) + delta + filters.length) % filters.length]);
      else if (action === "down" || action === "a") browse();
    } else if (mode === "entry") {
      if (horizontal) move(delta);
      else if (action === "a") canMap(ids()[index()]) ? openMap() : options.area ? area() : cry();
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
    browse, open, cry, area, map: openMap, zoom: () => zoom(mapZoom === 1 ? 2 : 1),
  };
  root.onclick = event => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (!button || button.disabled) return;
    if (button.id === "back") back();
    else if (button.dataset.filter) changeFilter(button.dataset.filter);
    else if (button.dataset.id) {
      selected[filter] = Number(button.dataset.id);
      open();
    } else if (button.dataset.command) commands[button.dataset.command]?.();
  };
  controllers.set(root, { input });
  render();
}
