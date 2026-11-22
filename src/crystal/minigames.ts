/**
 * The Goldenrod Game Corner's slot machines and Card Flip, and the Ruins of
 * Alph's Unown puzzles, played with Astra's panels.
 */
import { escapeHtml, panel } from "../ui/shell";
import type { CrystalGame } from "./runtime";

function overlay(game: CrystalGame) {
  const host = document.createElement("div");
  host.className = "crystal-overlay";
  game.layer.append(host);
  return host;
}

const REELS = ["7", "POKé BALL", "CHERRY", "PIKACHU", "SQUIRTLE", "STARYU"];
const PAYOUT: Record<string, number> = { "7": 300, "POKé BALL": 50, PIKACHU: 15, SQUIRTLE: 15, STARYU: 15, CHERRY: 6 };

/** A slot machine: bet one to three coins on the middle row. */
export function slotMachine(game: CrystalGame): Promise<void> {
  if (!game.ctx.layer) return Promise.resolve();
  game.closeText();
  return new Promise(resolve => {
    const host = overlay(game);
    let result = "Bet coins and spin!";
    const spin = (bet: number) => {
      if (game.save.coins < bet) { result = "Not enough coins."; return show(); }
      game.save.coins -= bet;
      const reels = [0, 1, 2].map(() => REELS[Math.floor(Math.random() * REELS.length)]);
      game.sfx("SFX_STOP_SLOT");
      const win = reels.every(r => r === reels[0]) ? PAYOUT[reels[0]] : reels.filter(r => r === "CHERRY").length >= 2 ? 6 : 0;
      if (win) { game.save.coins = Math.min(9999, game.save.coins + win); game.sfx("SFX_PAY_DAY"); }
      result = `${reels.join(" | ")}${win ? ` — You won ${win} coins!` : ""}`;
      show();
    };
    const show = () => {
      const p = panel(host, "Slot machine", `<p class="crystal-slots">${escapeHtml(result)}</p><p>Coins: ${game.save.coins}</p><div class="buttons"><button data-bet="1">Bet 1</button><button data-bet="2">Bet 2</button><button data-bet="3">Bet 3</button><button class="secondary" id="back">Quit</button></div>`, "crystal-game");
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-bet]")) b.onclick = () => spin(+b.dataset.bet!);
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { host.remove(); resolve(); };
      p.querySelector<HTMLButtonElement>("[data-bet]")?.focus({ preventScroll: true });
    };
    show();
  });
}

const CARDS = ["PIKACHU", "JIGGLYPUFF", "POLIWAG", "ODDISH", "BELLSPROUT", "CLEFAIRY"];
/** Card Flip: bet three coins, guess the card, its row or its column. */
export function cardFlip(game: CrystalGame): Promise<void> {
  if (!game.ctx.layer) return Promise.resolve();
  game.closeText();
  return new Promise(resolve => {
    const host = overlay(game);
    let result = "Pay 3 coins and make a guess.";
    const guesses: { label: string; test: (card: number, level: number) => boolean; pays: number }[] = [
      ...CARDS.map((c, i) => ({ label: c, test: (card: number) => card === i, pays: 6 })),
      ...[1, 2, 3, 4].map(level => ({ label: `Level ${level}`, test: (_: number, l: number) => l === level, pays: 4 })),
      ...CARDS.map((c, i) => ({ label: `${c} Lv${(i % 4) + 1}`, test: (card: number, l: number) => card === i && l === (i % 4) + 1, pays: 18 })),
    ];
    const flip = (g: number) => {
      if (game.save.coins < 3) { result = "Not enough coins."; return show(); }
      game.save.coins -= 3;
      const card = Math.floor(Math.random() * 6), level = 1 + Math.floor(Math.random() * 4);
      const win = guesses[g].test(card, level) ? guesses[g].pays : 0;
      if (win) game.save.coins = Math.min(9999, game.save.coins + win);
      result = `It's ${CARDS[card]} Lv${level}.${win ? ` You won ${win} coins!` : " Sorry!"}`;
      show();
    };
    const show = () => {
      const p = panel(host, "Card Flip", `<p>${escapeHtml(result)}</p><p>Coins: ${game.save.coins}</p><nav class="journey-list crystal-cards">${guesses.slice(0, 10).map((g, i) => `<button data-guess="${i}">${escapeHtml(g.label)} ×${g.pays}</button>`).join("")}</nav><div class="buttons"><button class="secondary" id="back">Quit</button></div>`, "crystal-game");
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-guess]")) b.onclick = () => flip(+b.dataset.guess!);
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { host.remove(); resolve(); };
      p.querySelector<HTMLButtonElement>("[data-guess]")?.focus({ preventScroll: true });
    };
    show();
  });
}

/** An Unown stone panel: slide the 15 pieces into order. Sets the script variable when solved. */
export function unownPuzzle(game: CrystalGame): Promise<void> {
  if (!game.ctx.layer) { game.scriptVar = 1; return Promise.resolve(); }
  game.closeText();
  return new Promise(resolve => {
    const host = overlay(game);
    const tiles = [...Array(15).keys()].map(i => i + 1).concat(0);
    // A solvable shuffle: random moves from the solved state.
    let blank = 15;
    for (let i = 0; i < 200; i++) {
      const options = [blank - 4, blank + 4, blank % 4 ? blank - 1 : -1, blank % 4 < 3 ? blank + 1 : -1].filter(n => n >= 0 && n < 16);
      const n = options[Math.floor(Math.random() * options.length)];
      [tiles[blank], tiles[n]] = [tiles[n], tiles[blank]];
      blank = n;
    }
    const solved = () => tiles.every((t, i) => t === (i === 15 ? 0 : i + 1));
    const show = () => {
      const p = panel(host, "Stone panel", `<div class="crystal-puzzle">${tiles.map((t, i) => `<button data-tile="${i}" ${t ? "" : 'class="empty"'}>${t || ""}</button>`).join("")}</div><div class="buttons"><button class="secondary" id="back">Quit</button></div>`, "crystal-game");
      for (const b of p.querySelectorAll<HTMLButtonElement>("[data-tile]")) b.onclick = () => {
        const i = +b.dataset.tile!, e = tiles.indexOf(0);
        if (![e - 4, e + 4, e % 4 ? e - 1 : -1, e % 4 < 3 ? e + 1 : -1].includes(i)) return;
        [tiles[e], tiles[i]] = [tiles[i], tiles[e]];
        game.sfx("SFX_POUND");
        if (solved()) { host.remove(); game.scriptVar = 1; resolve(); return; }
        show();
      };
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { host.remove(); game.scriptVar = 0; resolve(); };
      p.querySelector<HTMLButtonElement>("[data-tile]")?.focus({ preventScroll: true });
    };
    show();
  });
}
