import { escapeHtml, panel } from "./shell";
import { setMenuController, type MenuControl } from "./menu-controller";
import "./naming.css";

/** Nine to a row, like the cartridge's naming screen. The last row ends with DEL and END. */
const ROWS = ["ABCDEFGHI", "JKLMNOPQR", "STUVWXYZ ", "012345678", "9.'-"];
const COLUMNS = 9;
type Key = { row: number; from: number; to: number; char?: string; command?: "del" | "end" };
const KEYS: Key[] = [
  ...ROWS.flatMap((line, row) => [...line].map((char, from) => ({ row, from, to: from, char }))),
  { row: 4, from: 5, to: 6, command: "del" },
  { row: 4, from: 7, to: 8, command: "end" },
];
const END = KEYS.length - 1;

/** Where the cursor lands from `index`; `column` is the one it was last moved to sideways. */
export function namingStep(index: number, action: Exclude<MenuControl, "a">, column = KEYS[index].from): number {
  const key = KEYS[index];
  if (action === "left" || action === "right") {
    const row = KEYS.map((k, i) => ({ k, i })).filter(({ k }) => k.row === key.row);
    const at = row.findIndex(({ i }) => i === index);
    return row[(at + (action === "left" ? -1 : 1) + row.length) % row.length].i;
  }
  for (let step = 1; step <= ROWS.length; step++) {
    const row = (key.row + (action === "up" ? -step : step) + ROWS.length * 2) % ROWS.length;
    const found = KEYS.findIndex(k => k.row === row && k.from <= column && column <= k.to);
    if (found >= 0) return found;
  }
  return index;
}

export interface NamingOptions {
  title: string;
  max: number;
  /** Shown faintly until a letter is entered, and kept if END is chosen with nothing entered. */
  fallback?: string;
  /** Resolves with the entered name; undefined when the player backs out with nothing entered. */
  onDone: (name: string | undefined) => void;
}

/**
 * The naming screen: a letter grid under the D-pad. A enters the letter under
 * the cursor, B rubs out the last one (and leaves when there is none), END
 * finishes.
 */
export function mountNaming(host: HTMLElement, options: NamingOptions) {
  const max = Math.min(options.max, COLUMNS + 1);
  const p = panel(host, options.title, `<p class="naming-name" aria-live="polite"></p>
    <div class="naming-grid" style="--columns:${COLUMNS}">${KEYS.map((key, i) =>
      `<button data-key="${i}" style="grid-row:${key.row + 1};grid-column:${key.from + 1} / ${key.to + 2}"${key.char === " " ? ' aria-label="Space"' : ""}>${
        key.command ? key.command.toUpperCase() : key.char === " " ? "␣" : escapeHtml(key.char!)}</button>`).join("")}</div>
    <footer class="naming-keys"><span><kbd>A</kbd> Enter</span><button id="back"><kbd>B</kbd> Delete</button></footer>`, "naming-screen");
  const keys = [...p.querySelectorAll<HTMLButtonElement>("[data-key]")];
  const shown = p.querySelector<HTMLElement>(".naming-name")!;
  let name = "", cursor = 0, column = 0;
  const paint = () => {
    const text = name || options.fallback || "";
    shown.classList.toggle("naming-empty", !name);
    shown.textContent = (name ? name.replace(/ /g, "␣") : text).padEnd(max, "_");
    shown.setAttribute("aria-label", name || text || "No name yet");
  };
  const move = (index: number) => {
    keys[cursor].removeAttribute("aria-current");
    cursor = index;
    // Marked here too: a page in the background moves focus without telling anyone.
    keys[index].setAttribute("aria-current", "true");
    keys[index].focus({ preventScroll: true });
  };
  const finish = () => options.onDone(name.trim() || options.fallback || undefined);
  const press = (index: number) => {
    const key = KEYS[index];
    if (key.command === "end") return finish();
    if (key.command === "del") name = name.slice(0, -1);
    else if (name.length < max) name += key.char;
    paint();
    // A full name leaves only END to choose, as on the cartridge.
    if (name.length >= max && !key.command) move(END);
  };
  for (const [i, button] of keys.entries()) button.onclick = () => { cursor = i; column = KEYS[i].from; press(i); };
  p.querySelector<HTMLButtonElement>("#back")!.onclick = () => {
    if (!name) return options.onDone(undefined);
    name = name.slice(0, -1);
    paint();
  };
  setMenuController(p, action => {
    if (action === "a") return press(cursor);
    if (action === "left" || action === "right") {
      move(namingStep(cursor, action));
      column = KEYS[cursor].from;
    } else move(namingStep(cursor, action, column));
  });
  paint();
  move(0);
  return p;
}

/** The naming screen as a question. */
export function askForName(host: HTMLElement, options: Omit<NamingOptions, "onDone">): Promise<string | undefined> {
  return new Promise(resolve => mountNaming(host, { ...options, onDone: resolve }));
}
