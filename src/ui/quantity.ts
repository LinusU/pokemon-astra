import { escapeHtml, panel } from "./shell";
import { setMenuController, type MenuControl } from "./menu-controller";
import "./quantity.css";

/** The amount after a press: up and down by one, coming round at the ends; left and right by ten, stopping at them. */
export function quantityStep(n: number, action: Exclude<MenuControl, "a">, max: number) {
  if (action === "up") return n >= max ? 1 : n + 1;
  if (action === "down") return n <= 1 ? max : n - 1;
  return Math.max(1, Math.min(max, n + (action === "right" ? 10 : -10)));
}

export interface QuantityOptions {
  title: string;
  max: number;
  /** The price of one, shown as a running total. */
  price?: number;
  currency?: string;
  /** The amount chosen, or undefined when the player backs out. */
  onDone: (amount: number | undefined) => void;
}

/** "How many?", as the cartridge asks it: the D-pad sets the amount, A takes it, B backs out. */
export function mountQuantity(host: HTMLElement, options: QuantityOptions) {
  const max = Math.max(1, Math.min(options.max, 99));
  const p = panel(host, options.title, `<div class="quantity-box" role="spinbutton" aria-valuemin="1" aria-valuemax="${max}">
      <button data-step="up" aria-label="More">▲</button><strong></strong><button data-step="down" aria-label="Fewer">▼</button></div>
    <footer class="quantity-keys"><span><kbd>▲▼</kbd> ±1</span><span><kbd>◂▸</kbd> ±10</span><button id="confirm"><kbd>A</kbd> OK</button><button id="back"><kbd>B</kbd> Cancel</button></footer>`, "quantity-screen");
  const box = p.querySelector<HTMLElement>(".quantity-box")!, shown = box.querySelector("strong")!;
  let n = 1;
  const paint = () => {
    shown.innerHTML = `×${String(n).padStart(2, "0")}${options.price ? `<small>${escapeHtml(options.currency ?? "")}${options.price * n}</small>` : ""}`;
    box.setAttribute("aria-valuenow", String(n));
  };
  const step = (action: Exclude<MenuControl, "a">) => { n = quantityStep(n, action, max); paint(); };
  for (const b of box.querySelectorAll<HTMLButtonElement>("[data-step]")) b.onclick = () => step(b.dataset.step as "up" | "down");
  p.querySelector<HTMLButtonElement>("#confirm")!.onclick = () => options.onDone(n);
  p.querySelector<HTMLButtonElement>("#back")!.onclick = () => options.onDone(undefined);
  setMenuController(p, action => action === "a" ? options.onDone(n) : step(action));
  paint();
  return p;
}
