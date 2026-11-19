import type { Pokemon } from "../engine";
import type { Action } from "../game/input";
import { escapeHtml as html } from "./shell";

export type PcControl = Extract<Action, "up" | "down" | "left" | "right" | "a">;
type Entry = { species: number; name: string; first: number; count: number };

/** Look up a species by name, then return to its first partner in the Pokédex-ordered register. */
export function mountStorageIndex(
  host: HTMLElement, storage: Pokemon[], current: number, speciesName: (id: number) => string,
  locate: (index: number) => void, cancel: () => void,
) {
  const species = new Map<number, Entry>();
  storage.forEach((mon, first) => {
    const entry = species.get(mon.species);
    if (entry) entry.count++;
    else species.set(mon.species, { species: mon.species, name: speciesName(mon.species), first, count: 1 });
  });
  const groups = new Map<string, Entry[]>();
  for (const entry of [...species.values()].sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const initial = entry.name[0];
    if (!groups.has(initial)) groups.set(initial, []);
    groups.get(initial)!.push(entry);
  }
  const initials = [...groups.keys()];
  const here = species.get(storage[current].species)!;
  let letter = initials.indexOf(here.name[0]);
  const names = () => groups.get(initials[letter])!;
  let row = names().indexOf(here);
  let browsingNames = false;
  const columns = 5, pageSize = 6;
  const root = host.ownerDocument.createElement("section");
  root.className = "storage-pc pc-index";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Find a stored species");
  host.replaceChildren(root);

  function render() {
    const entries = names(), page = Math.floor(row / pageSize);
    root.dataset.mode = browsingNames ? "roster" : "letters";
    root.innerHTML = `<header class="pc-head"><h1><i class="pc-terminal" aria-hidden="true"></i>Find species</h1><span>Center PC</span></header>
      <div class="pc-index-total">Stored species <b>${species.size}</b></div>
      <div class="pc-body"><div class="pc-register"><div class="pc-rule">Initial</div><div class="pc-letters">
      ${initials.map((l, i) => `<button data-letter="${i}" aria-label="Species starting with ${html(l)}" aria-pressed="${i === letter}">${html(l)}</button>`).join("")}</div></div>
      <div class="pc-register"><div class="pc-rule"><span>${html(initials[letter])} · ${entries.length} species</span>
      ${entries.length > pageSize ? `<div class="pc-pages"><button data-page="-1" aria-label="Previous page" ${page === 0 ? "disabled" : ""}>◂</button>
        <span>${page + 1}/${Math.ceil(entries.length / pageSize)}</span><button data-page="1" aria-label="Next page" ${(page + 1) * pageSize >= entries.length ? "disabled" : ""}>▸</button></div>` : ""}</div>
      <div class="pc-rows">${entries.slice(page * pageSize, (page + 1) * pageSize).map((entry, i) =>
        `<button data-match="${page * pageSize + i}" aria-current="${page * pageSize + i === row}">
        <span>${String(entry.species).padStart(3, "0")}</span><strong>${html(entry.name)}</strong><small>×${entry.count}</small></button>`
      ).join("")}</div></div></div>
      <p class="pc-tip">${browsingNames ? "↑ ↓ Select   ← → Page" : "Choose the first letter of the species name."}</p>
      <footer class="pc-foot"><button data-confirm><kbd>A</kbd> ${browsingNames ? "Locate" : "Names"}</button>
      <button id="back"><kbd>B</kbd> ${browsingNames ? "Initials" : "Cancel"}</button></footer>`;
    root.querySelector<HTMLButtonElement>(browsingNames ? '[aria-current="true"]' : '[aria-pressed="true"]')?.focus({ preventScroll: true });
  }

  function confirm() {
    if (browsingNames) return locate(names()[row].first);
    browsingNames = true;
    render();
  }
  function turnPage(delta: number) {
    const entries = names(), page = Math.floor(row / pageSize) + delta;
    if (page < 0 || page * pageSize >= entries.length) return;
    row = Math.min(entries.length - 1, row + delta * pageSize);
    browsingNames = true;
    render();
  }
  function input(action: PcControl) {
    if (action === "a") return confirm();
    const horizontal = action === "left" || action === "right";
    const delta = action === "up" || action === "left" ? -1 : 1;
    if (browsingNames) {
      if (horizontal) return turnPage(delta);
      row = Math.max(0, Math.min(names().length - 1, row + delta));
    } else {
      const next = Math.max(0, Math.min(initials.length - 1, letter + delta * (horizontal ? 1 : columns)));
      if (next === letter) return;
      letter = next;
      row = 0;
    }
    render();
  }
  root.onclick = event => {
    const b = event.target instanceof Element ? event.target.closest("button") : null;
    if (!b || b.disabled) return;
    if (b.id === "back") {
      if (!browsingNames) return cancel();
      browsingNames = false;
    } else if (b.dataset.letter !== undefined) {
      letter = Number(b.dataset.letter);
      row = 0;
      browsingNames = true;
    } else if (b.dataset.match !== undefined) return locate(names()[Number(b.dataset.match)].first);
    else if (b.dataset.page) return turnPage(Number(b.dataset.page));
    else return confirm();
    render();
  };
  render();
  return { root, input };
}
