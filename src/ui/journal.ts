import { badgeMask } from "../game/badges";
import type { Action } from "../game/input";
import { directions, journalPaths, journalRequests, type JournalNote } from "../game/journal";
import type { Save } from "../game/save";
import { ABILITIES, BADGES, type Requirement } from "../world";
import { escapeHtml as html } from "./shell";
import "./journal.css";

const sections = ["Survey", "Requests", "Paths", "Badges"] as const;
type Section = typeof sections[number];
type Index = Extract<Section, "Requests" | "Paths">;
type Leaf = "index" | "note" | "beacons" | "team";
type Control = Extract<Action, "up" | "down" | "left" | "right" | "a">;
export type JournalState = { section?: Section; selected?: Partial<Record<Index, string>> };
type Options = {
  save: Save;
  state: JournalState;
  permitted: (requirement?: Requirement) => boolean;
  typesOf: (id: number) => number[];
  partner: (mon: NonNullable<Save["hallOfFame"]>[number]) => { name: string; sprite: string };
  onSurvey: (id: number) => void;
  onCancel: () => void;
};

const controllers = new WeakMap<Element, { input: (action: Control) => void }>();
export function journalController(layer: HTMLElement) {
  const root = layer.querySelector(".beacon-journal");
  return root ? controllers.get(root) : undefined;
}

const pageSize = 4;
const shores = [
  { id: 4, town: "Sunspire", keeper: "Sable" },
  { id: 5, town: "Cinderfall", keeper: "Flint" },
  { id: 6, town: "Rimepeak", keeper: "Neve" },
];
export const badgeArt = (i: number) => `<i class="jn-badge" style="--stamp:${i}" aria-hidden="true"></i>`;
const toolArt = (tool: "book" | "letter" | "sign") => `<i class="jn-tool jn-${tool}" aria-hidden="true"></i>`;
const status = (note: JournalNote) => `<span class="jn-status" data-status="${note.status}">${note.status}</span>`;

function pager(index: number, count: number, unit: string) {
  return `<div class="jn-pager"><button data-turn="-1" aria-label="Previous ${unit}" ${index === 0 ? "disabled" : ""}>◂</button>
    <span>${index + 1} / ${count}</span><button data-turn="1" aria-label="Next ${unit}" ${index + 1 >= count ? "disabled" : ""}>▸</button></div>`;
}

export function mountJournal(host: HTMLElement, options: Options) {
  const { save, state, permitted } = options;
  const selected = state.selected ??= {};
  const records = { Requests: journalRequests(save, permitted, options.typesOf), Paths: journalPaths(save, permitted) };
  const mask = badgeMask(save);
  const earned = (i: number) => !!(mask & (1 << i));
  const count = BADGES.filter((_, i) => earned(i)).length;
  const available = save.badges >= 3 && save.badges < 6
    ? shores.filter(shore => !save.flags.includes("badge" + shore.id)) : [];
  let shoreIndex = Math.max(0, available.findIndex(shore => shore.id === save.survey));
  let section = state.section ?? "Survey";
  let leaf: Leaf = "index";
  let goal = directions(save, permitted);
  const root = host.ownerDocument.createElement("section");
  root.className = "beacon-journal";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Beacon Journal");
  host.replaceChildren(root);

  const notes = (): JournalNote[] => section === "Requests" || section === "Paths" ? records[section] : [];
  function index() {
    if (section !== "Requests" && section !== "Paths") return 0;
    const id = selected[section];
    return Math.max(0, records[section].findIndex(note => note.id === id));
  }

  function survey() {
    return `<div class="jn-survey"><div class="jn-coast" aria-hidden="true"></div>
      <div class="jn-objective"><span class="jn-label">Current objective</span>
      <h2>${html(goal.title)}</h2><p><i aria-hidden="true">▸</i>${html(goal.hint)}</p></div></div>`;
  }

  function courses() {
    return `<div class="jn-courses"><h2>Choose your next beacon</h2><div>${available.map((shore, i) =>
      `<button class="jn-row" data-shore="${i}" aria-pressed="${save.survey === shore.id}" ${i === shoreIndex ? 'aria-current="true"' : ""}>
        ${badgeArt(shore.id - 1)}<span>${shore.town} <small>· ${shore.keeper}</small></span>${save.survey === shore.id ? "<small>Selected</small>" : ""}</button>`,
    ).join("")}</div></div>`;
  }

  function catalogue() {
    const entries = notes(), i = index(), page = Math.floor(i / pageSize);
    const requests = section === "Requests";
    if (!entries.length) return `<div class="jn-empty">${toolArt(requests ? "letter" : "sign")}
      <h2>${requests ? "No requests yet" : "No paths marked"}</h2>
      <p>${requests ? "Talk to people along the way to pick up a field request." : "Inspect a blocked path with A to mark it here for a return visit."}</p></div>`;
    return `<div class="jn-index"><div class="jn-rule"><span class="jn-label">${entries.length} ${requests ? "request" : "path"}${entries.length === 1 ? "" : "s"} recorded</span>
      ${pager(page, Math.ceil(entries.length / pageSize), "page")}</div><div class="jn-rows">${entries.slice(page * pageSize, (page + 1) * pageSize).map((note, row) => {
        const slot = page * pageSize + row;
        // The register uses the local place names. The full route is on the entry.
        const label = requests ? html(note.title) : `<span>${html(note.title.split(" · ").at(-1)!)}</span>
          <small>From ${html(note.place.split(" · ").at(-1)!)}</small>`;
        return `<button class="jn-row" data-record="${slot}" ${slot === i ? 'aria-current="true"' : ""}><span class="jn-pointer" aria-hidden="true"></span>
          <span${requests ? "" : ' class="jn-path"'}>${label}</span>${status(note)}</button>`;
      }).join("")}</div></div>`;
  }

  function record() {
    const entries = notes(), i = index(), note = entries[i];
    return `<article class="jn-record"><div class="jn-record-head"><h2 tabindex="-1">${html(note.title)}</h2>${pager(i, entries.length, "entry")}</div>
      <div class="jn-byline">${status(note)}<small>${section === "Paths" ? "From " : ""}${html(note.place)}</small></div>
      <p>${html(note.note)}</p>
      ${note.reward ? `<div class="jn-reward"><span class="jn-label">${note.status === "Filed" ? "Received" : "Reward"}</span> ${html(note.reward)}</div>` : ""}
      </article>`;
  }

  function badges() {
    return `<div class="jn-case"><div class="jn-stamps">${BADGES.map((name, i) => {
      const ability = ABILITIES[i] === "rockSmash" ? "Rock Smash" : ABILITIES[i][0].toUpperCase() + ABILITIES[i].slice(1);
      return `<div class="jn-slot ${earned(i) ? "earned" : ""}" aria-label="${name} Badge, ${earned(i) ? ability : "unearned"}">
        ${badgeArt(i)}<span>${name}</span><small>${earned(i) ? ability : "—"}</small></div>`;
    }).join("")}</div>
    <p>${count === 0 ? "First keeper · Fern in Bramble Town" : count === BADGES.length ? "All eight beacons are shining." : "Each badge unlocks a field ability."}</p></div>`;
  }

  function team() {
    return `<div class="jn-team"><h2 tabindex="-1">Hall of Fame</h2><div class="jn-roster">${save.hallOfFame!.map(mon => {
      const partner = options.partner(mon);
      return `<div><img alt="" src="${html(partner.sprite)}"><span>${html(partner.name)}</span><small>Lv ${mon.level}</small></div>`;
    }).join("")}</div></div>`;
  }

  function confirmLabel() {
    if (leaf === "beacons") return "Set course";
    if (leaf !== "index") return "";
    if (section === "Survey" && available.length) return "Choose beacon";
    if (section === "Badges" && save.hallOfFame) return "Hall of Fame";
    return notes().length ? "Read" : "";
  }

  function render() {
    const body = leaf === "note" ? record() : leaf === "beacons" ? courses() : leaf === "team" ? team()
      : section === "Survey" ? survey() : section === "Badges" ? badges() : catalogue();
    const confirm = confirmLabel();
    const hint = leaf === "beacons" ? "↕ Choose" : leaf === "note" ? "↔ Entry"
      : leaf === "team" ? "" : notes().length ? "↔ Tabs　↕ Select" : "↔ Tabs";
    root.innerHTML = `<header class="jn-head"><h1>${toolArt("book")}Beacon Journal</h1><span class="jn-total">${count}/8 badges</span></header>
      <nav class="jn-tabs" aria-label="Journal sections">${sections.map(name => `<button data-section="${name}" aria-pressed="${name === section}">${name}</button>`).join("")}</nav>
      <div class="jn-paper">${body}</div>
      <footer class="jn-foot"><span>${hint}</span>${confirm ? `<button data-confirm><kbd>A</kbd> ${confirm}</button>` : ""}
        <button id="back"><kbd>B</kbd> ${leaf === "index" ? "Menu" : "Back"}</button></footer>`;
    const target = root.querySelector<HTMLElement>('[aria-current="true"], h2[tabindex]') ??
      root.querySelector<HTMLElement>('[data-section][aria-pressed="true"]');
    target?.focus({ preventScroll: true });
  }

  function changeSection(next: Section) {
    state.section = section = next;
    leaf = "index";
    render();
  }
  function select(i: number) {
    if (section !== "Requests" && section !== "Paths") return;
    const note = records[section][i];
    if (note) selected[section] = note.id;
  }
  function move(delta: number) {
    if (leaf === "beacons") shoreIndex = Math.max(0, Math.min(available.length - 1, shoreIndex + delta));
    else select(index() + delta);
    render();
  }
  function confirm() {
    if (leaf === "beacons") {
      options.onSurvey(available[shoreIndex].id);
      goal = directions(save, permitted);
      leaf = "index";
    } else if (leaf !== "index") return;
    else if (section === "Survey" && available.length) leaf = "beacons";
    else if (section === "Badges" && save.hallOfFame) leaf = "team";
    else if (notes().length) leaf = "note";
    else return;
    render();
  }
  function back() {
    if (leaf === "index") return options.onCancel();
    leaf = "index";
    render();
  }
  function input(action: Control) {
    if (action === "a") return confirm();
    const horizontal = action === "left" || action === "right";
    const delta = action === "left" || action === "up" ? -1 : 1;
    if (leaf === "index" && horizontal) {
      changeSection(sections[(sections.indexOf(section) + delta + sections.length) % sections.length]);
    } else if (leaf === "note" || leaf === "beacons" || notes().length) move(delta);
  }
  root.onclick = e => {
    const b = e.target instanceof Element ? e.target.closest<HTMLButtonElement>("button") : null;
    if (!b || b.disabled) return;
    if (b.id === "back") return back();
    if (b.dataset.section) return changeSection(b.dataset.section as Section);
    if (b.dataset.turn) {
      const delta = Number(b.dataset.turn);
      if (leaf === "note") move(delta);
      else {
        select((Math.floor(index() / pageSize) + delta) * pageSize);
        render();
      }
      return;
    }
    if (b.dataset.record !== undefined) select(Number(b.dataset.record));
    if (b.dataset.shore !== undefined) shoreIndex = Number(b.dataset.shore);
    confirm();
  };
  root.addEventListener("wheel", event => { if (!event.ctrlKey) event.preventDefault(); }, { passive: false });
  controllers.set(root, { input });
  render();
}
