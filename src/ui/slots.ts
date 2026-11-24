import { setMenuController, type MenuControl } from "./menu-controller";
import "./menu-keys.css";
import "./slots.css";

export interface SlotsOptions<S extends string> {
  /** The three reel strips, top to bottom. */
  reels: S[][];
  payout: Record<S, number>;
  label: Record<S, string>;
  coins: () => number;
  /** Takes the bet (negative) or pays the winnings. */
  pay: (coins: number) => void;
  sfx: (sound: "spin" | "stop" | "win") => void;
  /** Whether a stopping reel slips onto the first reel's symbol. */
  slips: (first: S) => boolean;
  onDone: () => void;
}

/** The bet after a press: it comes round at either end. */
export function betStep(bet: number, action: Exclude<MenuControl, "a">, max: number) {
  if (max < 1) return 0;
  const next = bet + (action === "up" || action === "right" ? 1 : -1);
  return next > max ? 1 : next < 1 ? max : next;
}

/** The rows a bet plays: the middle, then the outer two, then the diagonals. */
export function betLines(bet: number): [number, number, number][] {
  const lines: [number, number, number][] = [[0, 0, 0]];
  if (bet >= 2) lines.push([-1, -1, -1], [1, 1, 1]);
  if (bet >= 3) lines.push([-1, 0, 1], [1, 0, -1]);
  return lines;
}

/**
 * A slot machine under the pad alone: the D-pad sets the bet, A starts the
 * reels and then stops them one at a time, B leaves between spins.
 */
export function mountSlots<S extends string>(host: HTMLElement, options: SlotsOptions<S>) {
  const { reels } = options;
  const root = document.createElement("section");
  root.className = "slots-screen";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Slot machine");
  root.innerHTML = `<div class="slots-reels">${reels.map(() => `<div class="slots-reel"><span class="sym"></span><span class="sym"></span><span class="sym"></span></div>`).join("")}</div>
    <p class="slots-coins"></p>
    <p class="slots-message" aria-live="polite"></p>
    <footer class="menu-keys"><span class="slots-bet"><button id="less" aria-label="Bet less">◂</button> Bet <strong></strong> <button id="more" aria-label="Bet more">▸</button></span><button id="go"><kbd>A</kbd> <span></span></button><button id="back"><kbd>B</kbd> Quit</button></footer>`;
  host.replaceChildren(root);
  const pos = reels.map(reel => Math.floor(Math.random() * reel.length));
  const strips = [...root.querySelectorAll<HTMLElement>(".slots-reel")];
  const one = <E extends HTMLElement>(selector: string) => root.querySelector<E>(selector)!;
  let bet = Math.min(1, options.coins()), spinning = -1, timer = 0, message = "Bet how many coins?";
  const cell = (r: number, offset: number) => reels[r][(pos[r] + offset + reels[r].length) % reels[r].length];
  const paint = () => {
    for (const [r, strip] of strips.entries()) {
      strip.classList.toggle("spinning", spinning >= 0 && r >= spinning);
      for (const [i, sym] of [...strip.children].entries()) {
        const s = cell(r, i - 1);
        sym.className = `sym sym-${s.toLowerCase()}`;
        sym.textContent = options.label[s];
      }
    }
    one(".slots-reels").dataset.bet = String(bet);
    one(".slots-coins").textContent = `Coins ${options.coins()}`;
    one(".slots-message").textContent = message;
    one(".slots-bet strong").textContent = String(bet);
    one(".slots-bet").classList.toggle("locked", spinning >= 0 || !bet);
    one("#go span").textContent = spinning >= 0 ? "Stop" : bet ? "Spin" : "Leave";
    one("#back").hidden = spinning >= 0;
  };
  const quit = () => {
    if (spinning >= 0) return;
    options.onDone();
  };
  const step = (action: Exclude<MenuControl, "a">) => {
    if (spinning >= 0) return;
    bet = betStep(bet, action, Math.min(3, options.coins()));
    paint();
  };
  const start = () => {
    options.pay(-bet);
    spinning = 0;
    message = "Press A to stop the reel.";
    options.sfx("spin");
    timer = window.setInterval(() => {
      if (!root.isConnected) return window.clearInterval(timer);
      for (let r = spinning; r < reels.length; r++) pos[r] = (pos[r] + 1) % reels[r].length;
      paint();
    }, 90);
    paint();
  };
  const stop = () => {
    // The reels slip a little: now and then one lands on what the first shows.
    if (spinning > 0 && options.slips(cell(0, 0))) {
      const target = reels[spinning].indexOf(cell(0, 0));
      if (target >= 0) pos[spinning] = target;
    }
    options.sfx("stop");
    if (++spinning < reels.length) return paint();
    window.clearInterval(timer);
    spinning = -1;
    const won = betLines(bet).map(line => line.map((offset, r) => cell(r, offset))).filter(line => line.every(s => s === line[0])).map(line => line[0]);
    const reward = won.reduce((sum, s) => sum + options.payout[s], 0);
    if (reward) {
      options.pay(reward);
      options.sfx("win");
    }
    message = reward ? `${won.map(s => options.label[s]).join(", ")} lined up! Scored ${reward} coins!` : "Not this time!";
    bet = Math.min(bet, options.coins());
    if (!bet) message += " You're out of coins.";
    paint();
  };
  const go = () => spinning >= 0 ? stop() : bet ? start() : quit();
  one<HTMLButtonElement>("#less").onclick = () => step("left");
  one<HTMLButtonElement>("#more").onclick = () => step("right");
  one<HTMLButtonElement>("#go").onclick = go;
  one<HTMLButtonElement>("#back").onclick = quit;
  setMenuController(root, action => action === "a" ? go() : step(action));
  paint();
  return root;
}
