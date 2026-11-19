import type { Engine, Pokemon } from "../engine";
import { bagKeyForItem } from "../game/items";
import { gender } from "../game/nursery";
import { typeNames } from "../game/type-names";
import type { Action } from "../game/input";
import { battleStatus } from "./party";
import { escapeHtml as html } from "./shell";
import "./partner-summary.css";

type Control = Extract<Action, "up" | "down" | "left" | "right" | "a">;
type Page = "Stats" | "Moves" | "Growth";
const pages: Page[] = ["Stats", "Moves", "Growth"];
const controllers = new WeakMap<Element, { input: (action: Control) => void }>();
export function summaryController(layer: HTMLElement) {
  const screen = layer.querySelector(".partner-card");
  return screen ? controllers.get(screen) : undefined;
}

type Options = {
  engine: Engine;
  image: string;
  itemName: (key: string) => string;
  onLead?: () => void;
  onItem?: () => void;
  onBack: () => void;
};

function evolutionCondition(e: ReturnType<Engine["evolutionData"]>["evolutions"][number], itemName: Options["itemName"]) {
  switch (e.method) {
    case 1: return `Reach Lv ${e.parameter}`;
    case 2: return `Use a ${itemName(bagKeyForItem(e.parameter))}`;
    case 3: return e.parameter === 255 ? "Use a Link Cable" : `Link Cable + held ${itemName(bagKeyForItem(e.parameter))}`;
    case 4: return `Level up at 220 friendship${e.parameter === 2 ? " by day" : e.parameter === 3 ? " at night" : ""}`;
    case 5: return `Lv ${e.parameter} · Attack ${e.condition === 1 ? ">" : e.condition === 2 ? "<" : "="} Defense`;
    default: return "";
  }
}

export function mountPartnerSummary(host: HTMLElement, mon: Pokemon, options: Options) {
  const { engine } = options;
  const data = engine.species(mon.species), name = mon.nickname || data.name;
  const types = [...new Set(data.types)].map(t => typeNames[t]).join(" / ");
  const sex = gender(mon, engine);
  const status = !mon.hp ? "Fainted" : battleStatus(mon.status)?.[1] ?? "Healthy";
  const held = mon.item ? options.itemName(bagKeyForItem(mon.item)) : "None";
  const experience = engine.training(mon);
  const healed = engine.healPokemon(mon);
  const moves = mon.moves.flatMap((id, i) => id ? [{ ...engine.move(id), ppLeft: mon.pp[i] & 63, ppMax: healed.pp[i] & 63 }] : []);
  const evolutions = engine.evolutionData(mon.species).evolutions.map(e => ({
    name: engine.species(e.species).name, condition: evolutionCondition(e, options.itemName),
  }));
  const commands = [
    ...(options.onLead ? [{ name: "Make lead", id: "lead", run: options.onLead }] : []),
    ...(options.onItem ? [{ name: mon.item ? "Take held item" : "Give held item", id: mon.item ? "take" : "give", run: options.onItem }] : []),
  ];
  if (commands.length) commands.push({ name: "Cancel", id: "cancel", run: dismiss });
  const root = host.ownerDocument.createElement("section");
  root.className = "partner-card";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", `Summary of ${name}`);
  host.replaceChildren(root);
  let page: Page = "Stats", move = 0, evolution = 0, command = -1;
  const line = (label: string, value: string | number) => `<div class="partner-line"><span>${label}</span><b>${value}</b></div>`;
  function contents() {
    if (page === "Stats") {
      return `<h3>Battle stats</h3><div class="partner-stats">${["Attack", "Defense", "Speed", "Sp. Atk", "Sp. Def"]
        .map((label, i) => line(label, mon.stats[i + 1])).join("")}</div>`;
    }
    if (page === "Moves") {
      const current = moves[move];
      return `<h3>Moves ↕ <small>PP</small></h3><div class="partner-moves">${moves.map((entry, i) =>
        `<button data-move="${i}" aria-pressed="${i === move}"><b>${html(entry.name)}</b><small>${entry.ppLeft}/${entry.ppMax}</small></button>`).join("")}</div>
        <p class="move-readout">${current ? `${typeNames[current.type] ?? "???"} · ${current.power === 0 ? "Status" : current.power === 1 ? "Special power" : "Power " + current.power}` : "No known moves"}</p>`;
    }
    const next = evolutions[evolution];
    return `<div class="partner-growth">${line("EXP", mon.exp)}
      <div class="partner-bar exp" role="meter" aria-label="Level progress" aria-valuenow="${experience.percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${experience.percent}%"></i></div>
      <small>${experience.next === null ? "Maximum level" : `${Math.max(0, experience.next - mon.exp)} to Lv ${mon.level + 1}`}</small>
      ${line("Friendship", `${mon.happiness}/255`)}
      <div class="partner-evo"><h3>Evolution ${evolutions.length > 1 ? `<button data-next-evo aria-label="Next evolution">${evolution + 1}/${evolutions.length} ▸</button>` : ""}</h3>
      ${next ? `<b>${html(next.name)}</b><p>${html(next.condition)}</p>` : "<p>No further evolution.</p>"}</div></div>`;
  }
  function render() {
    const managing = command !== -1;
    root.innerHTML = `<header><h2>${html(name)} <small>${sex === "—" ? "" : sex}</small></h2><span>Lv ${mon.level}</span></header>
      <nav aria-label="Summary pages">${pages.map(p => `<button data-page="${p}" aria-pressed="${p === page}">${p}</button>`).join("")}</nav>
      <div class="partner-body"><aside><div class="partner-picture"><small>№ ${String(mon.species).padStart(3, "0")}</small><img src="${options.image}" alt="${html(data.name)}"></div>
      <b>${html(data.name)}</b><span>${types}</span><div class="partner-health-readout">${line("HP", mon.hp + "/" + mon.stats[0])}
      <div class="partner-bar"><i style="width:${100 * mon.hp / Math.max(1, mon.stats[0])}%"></i></div><small>${status}</small></div></aside>
      <section class="partner-data" aria-label="${page}">${contents()}</section></div>
      <div class="partner-held"><span>Held item</span><b>${html(held)}</b></div>
      <footer><span>◂ ▸ Pages</span>${commands.length ? '<button data-manage><kbd>A</kbd> Manage</button>' : '<button data-next-page><kbd>A</kbd> Next page</button>'}<button id="back"><kbd>B</kbd> Back</button></footer>
      ${managing ? `<div class="partner-popup" aria-label="Manage partner">${commands.map((c,i) => `<button data-command="${i}" id="${c.id}" aria-current="${command === i}">${c.name}</button>`).join("")}</div>` : ""}`;
    if (managing) {
      for (const area of root.querySelectorAll<HTMLElement>("nav, .partner-body, [data-manage]")) area.inert = true;
    }
    const selected = managing ? '[aria-current="true"]' : `[data-page="${page}"]`;
    root.querySelector<HTMLButtonElement>(selected)?.focus({ preventScroll: true });
  }
  function dismiss() {
    if (command === -1) return options.onBack();
    command = -1;
    render();
  }
  function input(action: Control) {
    const delta = action === "left" || action === "up" ? -1 : 1;
    if (command !== -1) {
      if (action === "a") return commands[command].run();
      if (action === "up" || action === "down") command = Math.min(commands.length - 1, Math.max(0, command + delta));
    } else if (action === "a" && commands.length) command = 0;
    else if (action === "left" || action === "right" || action === "a") page = pages[(pages.indexOf(page) + pages.length + delta) % pages.length];
    else if (page === "Moves") move = Math.max(0, Math.min(moves.length - 1, move + delta));
    else if (page === "Growth" && evolutions.length) evolution = (evolution + evolutions.length + delta) % evolutions.length;
    render();
  }
  root.onclick = event => {
    const b = event.target instanceof Element ? event.target.closest("button") : null;
    if (!b) return;
    if (b.id === "back") return dismiss();
    if (b.hasAttribute("data-next-page")) return input("right");
    if (b.dataset.command !== undefined) return commands[Number(b.dataset.command)].run();
    if (b.dataset.page) page = b.dataset.page as Page;
    if (b.dataset.move !== undefined) move = Number(b.dataset.move);
    if (b.hasAttribute("data-next-evo")) evolution = (evolution + 1) % evolutions.length;
    if (b.hasAttribute("data-manage")) command = 0;
    render();
  };
  controllers.set(root, { input });
  render();
}
