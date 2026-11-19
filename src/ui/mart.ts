import type { Action } from "../game/input";
import { MEDICINE } from "../game/medicine";
import type { Save } from "../game/save";
import { itemInfo } from "./bag";
import { escapeHtml as html } from "./shell";
import "./mart.css";

type Department = "Supplies" | "Medicine" | "Evolution";
type Item = { key: string; cost: number; badges: number; department: Department };
const stock: Item[] = [];
function department(name: Department, items: [string, number, number][]) {
  for (const [key, cost, badges] of items) stock.push({ key, cost, badges, department: name });
}
department("Supplies", [["poke_ball",200,0], ["repel",350,0], ["great_ball",600,2], ["ultra_ball",1200,5]]);
department("Medicine", Object.entries(MEDICINE).map(([key, m]) => [key, m.price, m.badges]));
department("Evolution", [
  ["fire_stone",2100,2], ["water_stone",2100,2], ["leaf_stone",2100,2], ["thunder_stone",2100,3],
  ["moon_stone",2100,4], ["sun_stone",2100,4], ["link_cable",2500,4], ["metal_coat",2500,5],
  ["kings_rock",2500,5], ["dragon_scale",2500,6], ["up_grade",2500,6],
]);

type Control = Extract<Action, "up" | "down" | "left" | "right" | "a">;
const controllers = new WeakMap<Element, { input: (action: Control) => void }>();
export function martController(layer: HTMLElement) {
  const root = layer.querySelector(".astra-mart");
  return root ? controllers.get(root) : undefined;
}
type Options = { save: Save; name: (key: string) => string; onPurchase: () => void; onClose: () => void };
export function mountMart(host: HTMLElement, options: Options) {
  const { save, name } = options;
  const stocked = stock.filter(item => save.badges >= item.badges);
  const departments = [...new Set(stocked.map(item => item.department))];
  const rows = 5;
  let tab: Department = "Supplies", quantity = 0, receipt = "";
  const cursors = { Supplies: 0, Medicine: 0, Evolution: 0 };
  const root = host.ownerDocument.createElement("section");
  root.className = "astra-mart";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Astra Mart");
  host.replaceChildren(root);

  const list = () => stocked.filter(item => item.department === tab);
  const selected = () => list()[cursors[tab]];
  const owned = () => save.items[selected().key] || 0;
  const limit = () => Math.min(99 - owned(), Math.floor(save.money / selected().cost));
  const reason = () => owned() >= 99 ? "Your Bag already holds 99." : "You need more money for this item.";
  const turn = (delta: number) => {
    const items = list();
    cursors[tab] = Math.max(0, Math.min(items.length - 1, cursors[tab] + delta));
    receipt = "";
  };
  function render() {
    const items = list(), chosen = selected(), index = cursors[tab], start = Math.floor(index / rows) * rows;
    const max = limit(), buying = quantity > 0;
    const controls = buying ? `<div class="mart-sale"><h3>${html(name(chosen.key))}</h3>
      <div class="mart-quantity"><button data-adjust="-1" aria-label="One fewer">◂</button>
      <span>× ${quantity}</span><button data-adjust="1" aria-label="One more">▸</button></div>
      <div class="mart-bill"><span>Total <b>₽${quantity * chosen.cost}</b></span><span>Left <b>₽${save.money - quantity * chosen.cost}</b></span></div></div>`
      : `<div class="mart-stock"><div class="mart-rule">Item <div>${items.length > rows ? `<button data-page="-1" aria-label="Previous stock page" ${!start ? "disabled" : ""}>◂</button>
        ${start / rows + 1}/${Math.ceil(items.length / rows)} <button data-page="1" aria-label="Next stock page" ${start + rows >= items.length ? "disabled" : ""}>▸</button>` : "Price"}</div></div>
      <div class="mart-rows">${items.slice(start, start + rows).map((item, i) => `<button data-item="${item.key}" aria-current="${i + start === index}"><strong>${html(name(item.key))}</strong><span>₽${item.cost}</span></button>`).join("")}</div></div>`;
    root.innerHTML = `<header><h2>Astra Mart</h2><span>Funds <b>₽${save.money}</b></span></header>
      <nav aria-label="Departments">${departments.map(d => `<button data-tab="${d}" ${buying ? "disabled" : ""} aria-pressed="${tab === d}">${d}</button>`).join("")}</nav>
      ${controls}<div class="mart-summary"><div><strong>${html(name(chosen.key))}</strong><span>In Bag ${owned()}</span></div>
      <p role="status">${html(receipt || itemInfo(chosen.key).description || "")}</p></div>
      <footer><span>${buying ? "↑↓ 1 · ◂▸ 10" : "◂ ▸ Departments"}</span><button data-confirm><kbd>A</kbd> ${buying ? "Buy" : "Choose"}</button>
      <button id="back"><kbd>B</kbd> ${buying ? "Cancel" : "Leave"}</button></footer>`;
    const target = buying ? "[data-confirm]" : '[aria-current="true"]';
    root.querySelector<HTMLButtonElement>(target)?.focus({ preventScroll: true });
    for (const b of root.querySelectorAll<HTMLButtonElement>("[data-adjust]"))
      b.disabled = Number(b.dataset.adjust) < 0 ? quantity <= 1 : quantity >= max;
  }
  function confirm() {
    if (limit() < 1) { quantity = 0; receipt = reason(); }
    else if (!quantity) { quantity = 1; receipt = ""; }
    else if (quantity <= limit()) {
      const item = selected();
      save.money -= quantity * item.cost;
      save.items[item.key] = owned() + quantity;
      receipt = `Bought ${quantity} × ${name(item.key)} for ₽${quantity * item.cost}.`;
      quantity = 0;
      options.onPurchase();
    } else quantity = limit();
    render();
  }
  function back() {
    if (!quantity) return options.onClose();
    quantity = 0;
    receipt = "";
    render();
  }
  function adjust(delta: number) { quantity = Math.max(1, Math.min(limit(), quantity + delta)); }
  function input(action: Control) {
    if (action === "a") return confirm();
    const horizontal = action === "left" || action === "right";
    if (quantity) adjust((action === "right" || action === "up" ? 1 : -1) * (horizontal ? 10 : 1));
    else if (horizontal) {
      tab = departments[(departments.indexOf(tab) + departments.length + (action === "right" ? 1 : -1)) % departments.length];
      receipt = "";
    } else turn(action === "up" ? -1 : 1);
    render();
  }
  root.onclick = event => {
    const b = event.target instanceof Element ? event.target.closest("button") : null;
    if (!b || b.disabled) return;
    if (b.id === "back") return back();
    if (b.hasAttribute("data-confirm")) return confirm();
    if (b.dataset.item) {
      cursors[tab] = list().findIndex(item => item.key === b.dataset.item);
      return confirm();
    }
    if (b.dataset.tab) { tab = b.dataset.tab as Department; receipt = ""; }
    if (b.dataset.page) turn(Number(b.dataset.page) * rows);
    if (b.dataset.adjust) adjust(Number(b.dataset.adjust));
    render();
  };
  controllers.set(root, { input });
  render();
}
