/**
 * The Goldenrod Game Corner's slot machines and Card Flip, and the Ruins of
 * Alph's Unown puzzles, played with Astra's panels.
 */
import { setMenuController, type MenuControl } from "../ui/menu-controller";
import { panel } from "../ui/shell";
import "../ui/menu-keys.css";
import { mountSlots } from "../ui/slots";
import type { CrystalGame } from "./runtime";

function overlay(game: CrystalGame) {
  const host = document.createElement("div");
  host.className = "crystal-overlay";
  game.layer.append(host);
  return host;
}

type Reel = "7" | "BALL" | "CHERRY" | "PIKACHU" | "SQUIRTLE" | "STARYU";
const REELS: Reel[][] = [
  ["7", "PIKACHU", "SQUIRTLE", "BALL", "CHERRY", "STARYU", "7", "SQUIRTLE", "PIKACHU", "BALL", "CHERRY", "SQUIRTLE", "STARYU", "PIKACHU", "CHERRY"],
  ["7", "SQUIRTLE", "CHERRY", "STARYU", "PIKACHU", "BALL", "CHERRY", "SQUIRTLE", "STARYU", "CHERRY", "7", "PIKACHU", "BALL", "SQUIRTLE", "STARYU"],
  ["7", "STARYU", "SQUIRTLE", "CHERRY", "PIKACHU", "STARYU", "BALL", "SQUIRTLE", "PIKACHU", "CHERRY", "STARYU", "7", "SQUIRTLE", "PIKACHU", "BALL"],
];
const PAYOUT: Record<Reel, number> = { "7": 300, BALL: 50, PIKACHU: 15, SQUIRTLE: 15, STARYU: 15, CHERRY: 6 };
const LABEL: Record<Reel, string> = { "7": "7", BALL: "BALL", CHERRY: "♣", PIKACHU: "PIKA", SQUIRTLE: "SQUIRT", STARYU: "STARYU" };

/** A slot machine: one to three coins a spin, each coin playing more lines. */
export function slotMachine(game: CrystalGame): Promise<void> {
  if (!game.ctx.layer) return Promise.resolve();
  game.closeText();
  return new Promise(resolve => {
    const host = overlay(game);
    const sounds = { spin: "SFX_SLOT_MACHINE_START", stop: "SFX_STOP_SLOT", win: "SFX_GET_COIN_FROM_SLOTS" };
    mountSlots(host, {
      reels: REELS, payout: PAYOUT, label: LABEL,
      coins: () => game.save.coins,
      pay: coins => { game.save.coins = Math.max(0, Math.min(9999, game.save.coins + coins)); },
      sfx: sound => game.sfx(sounds[sound]),
      slips: first => Math.random() < 0.2 && (first !== "7" || Math.random() < 0.3),
      onDone: () => {
        host.remove();
        resolve();
      },
    });
  });
}

const CARDS: [string, number][] = [["PIKACHU", 25], ["JIGGLYPUFF", 39], ["POLIWAG", 60], ["ODDISH", 43], ["BELLSPROUT", 69], ["CLEFAIRY", 35]];
const LEVELS = 4, FLIP_COST = 3;

/** Where the Card Flip cursor lands: column 0 bets a level's row, row 0 a card's column; the corner is no bet. */
export function cardFlipStep([column, row]: [number, number], action: Exclude<MenuControl, "a">): [number, number] {
  const columns = CARDS.length + 1, rows = LEVELS + 1;
  const dx = action === "left" ? -1 : action === "right" ? 1 : 0, dy = action === "up" ? -1 : action === "down" ? 1 : 0;
  do {
    column = (column + dx + columns) % columns;
    row = (row + dy + rows) % rows;
  } while (!column && !row);
  return [column, row];
}
/** What a bet of three coins pays: a card's column, a level's row or the one card. */
export function cardFlipPays([column, row]: [number, number]) {
  return FLIP_COST * (!row ? CARDS.length : !column ? LEVELS : CARDS.length * LEVELS);
}

/** Card Flip: three coins on a card, on every level of it, or on a level of every card. */
export function cardFlip(game: CrystalGame): Promise<void> {
  if (!game.ctx.layer) return Promise.resolve();
  game.closeText();
  return new Promise(resolve => {
    const host = overlay(game);
    const sprite = game.ctx.sprite;
    const p = panel(host, "Card Flip", `<div class="crystal-flip" style="--columns:${CARDS.length + 1}">${[...Array(LEVELS + 1).keys()].map(row => [...Array(CARDS.length + 1).keys()].map(column => {
      if (!row && !column) return "<span></span>";
      const at = `data-column="${column}" data-row="${row}"`;
      if (!column) return `<button ${at} class="head">Lv${row}</button>`;
      const [name, species] = CARDS[column - 1];
      if (!row) return `<button ${at} class="head" aria-label="${name}">${sprite ? `<img src="${sprite(species)}" alt="">` : name.slice(0, 4)}</button>`;
      return `<button ${at} aria-label="${name} Lv${row}"></button>`;
    }).join("")).join("")}</div>
      <p class="crystal-flip-message" aria-live="polite"></p>
      <footer class="menu-keys"><span class="crystal-flip-coins"></span><button id="flip"><kbd>A</kbd> Flip</button><button id="back"><kbd>B</kbd> Quit</button></footer>`, "crystal-game crystal-flip-screen");
    const cells = [...p.querySelectorAll<HTMLButtonElement>("[data-column]")];
    const message = p.querySelector<HTMLElement>(".crystal-flip-message")!;
    let cursor: [number, number] = [1, 1], drawn: [number, number] | undefined, result = "";
    const covers = ([column, row]: [number, number], [c, r]: [number, number]) => (!column || column === c) && (!row || row === r);
    const name = ([column, row]: [number, number]) => `${column ? CARDS[column - 1][0] : "Any card"}${row ? ` Lv${row}` : ""}`;
    const paint = () => {
      for (const cell of cells) {
        const at: [number, number] = [+cell.dataset.column!, +cell.dataset.row!], on = at[0] === cursor[0] && at[1] === cursor[1];
        if (on) cell.setAttribute("aria-current", "true");
        else cell.removeAttribute("aria-current");
        cell.classList.toggle("bet", !on && !!at[0] && !!at[1] && covers(cursor, at));
        cell.classList.toggle("drawn", !!drawn && at[0] === drawn[0] && at[1] === drawn[1]);
        if (on) cell.focus({ preventScroll: true });
      }
      message.textContent = result || `${name(cursor)} pays ${cardFlipPays(cursor)} for ${FLIP_COST} coins.`;
      p.querySelector(".crystal-flip-coins")!.textContent = `Coins ${game.save.coins}`;
    };
    const move = (to: [number, number]) => {
      cursor = to;
      drawn = undefined;
      result = "";
      paint();
    };
    const flip = () => {
      if (game.save.coins < FLIP_COST) result = "Not enough coins.";
      else {
        game.save.coins -= FLIP_COST;
        drawn = [1 + Math.floor(Math.random() * CARDS.length), 1 + Math.floor(Math.random() * LEVELS)];
        const win = covers(cursor, drawn) ? cardFlipPays(cursor) : 0;
        if (win) {
          game.save.coins = Math.min(9999, game.save.coins + win);
          game.sfx("SFX_GET_COIN_FROM_SLOTS");
        }
        result = `It's ${name(drawn)}. ${win ? `You won ${win} coins!` : "Sorry!"}`;
      }
      paint();
    };
    for (const cell of cells) cell.onclick = () => move([+cell.dataset.column!, +cell.dataset.row!]);
    p.querySelector<HTMLButtonElement>("#flip")!.onclick = flip;
    p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { host.remove(); resolve(); };
    setMenuController(p, action => action === "a" ? flip() : move(cardFlipStep(cursor, action)));
    paint();
  });
}

/** Which tile slides into the gap at `blank` when the pad is pressed, if there is one that way. */
export function slideFrom(blank: number, action: Exclude<MenuControl, "a">) {
  if (action === "up") return blank + 4 < 16 ? blank + 4 : undefined;
  if (action === "down") return blank >= 4 ? blank - 4 : undefined;
  if (action === "left") return blank % 4 < 3 ? blank + 1 : undefined;
  return blank % 4 ? blank - 1 : undefined;
}

/** An Unown stone panel: slide the 15 pieces into order. Sets the script variable when solved. */
export function unownPuzzle(game: CrystalGame): Promise<void> {
  if (!game.ctx.layer) { game.scriptVar = 1; return Promise.resolve(); }
  game.closeText();
  return new Promise(resolve => {
    const host = overlay(game);
    const tiles = [...Array(15).keys()].map(i => i + 1).concat(0);
    const DIRECTIONS = ["up", "down", "left", "right"] as const;
    // A solvable shuffle: random moves from the solved state.
    for (let i = 0; i < 200; i++) {
      const blank = tiles.indexOf(0), from = slideFrom(blank, DIRECTIONS[Math.floor(Math.random() * 4)]);
      if (from !== undefined) [tiles[blank], tiles[from]] = [tiles[from], tiles[blank]];
    }
    const solved = () => tiles.every((t, i) => t === (i === 15 ? 0 : i + 1));
    const p = panel(host, "Stone panel", `<div class="crystal-puzzle">${tiles.map((_, i) => `<button data-tile="${i}"></button>`).join("")}</div>
      <footer class="menu-keys"><span><kbd>✚</kbd> Slide a piece into the gap</span><button id="back"><kbd>B</kbd> Quit</button></footer>`, "crystal-game");
    const buttons = [...p.querySelectorAll<HTMLButtonElement>("[data-tile]")];
    const paint = () => {
      for (const [i, button] of buttons.entries()) {
        button.textContent = tiles[i] ? String(tiles[i]) : "";
        button.classList.toggle("empty", !tiles[i]);
      }
    };
    const slide = (from: number | undefined) => {
      const blank = tiles.indexOf(0);
      if (from === undefined || !DIRECTIONS.some(d => slideFrom(blank, d) === from)) return;
      [tiles[blank], tiles[from]] = [tiles[from], tiles[blank]];
      game.sfx("SFX_POUND");
      if (solved()) { host.remove(); game.scriptVar = 1; resolve(); return; }
      paint();
    };
    for (const [i, button] of buttons.entries()) button.onclick = () => slide(i);
    p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { host.remove(); game.scriptVar = 0; resolve(); };
    setMenuController(p, action => { if (action !== "a") slide(slideFrom(tiles.indexOf(0), action)); });
    paint();
  });
}
