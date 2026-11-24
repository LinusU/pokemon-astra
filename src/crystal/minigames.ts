/**
 * The Goldenrod Game Corner's slot machines and Card Flip, and the Ruins of
 * Alph's Unown puzzles, played with Astra's panels.
 */
import { escapeHtml, panel } from "../ui/shell";
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
