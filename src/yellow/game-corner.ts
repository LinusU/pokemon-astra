import type { YellowGame } from "./runtime";
import { choose } from "./services";
import { MON, ITEM } from "./generated/symbols";

/** Celadon's prize corner. Yellow's prizes: Abra, Vulpix, Wigglytuff / Scyther, Pinsir, Porygon / TMs. */
const PRIZES: { kind: "mon" | "item"; name: string; level?: number; cost: number }[][] = [
  [{ kind: "mon", name: "ABRA", level: 15, cost: 180 }, { kind: "mon", name: "VULPIX", level: 20, cost: 1000 }, { kind: "mon", name: "WIGGLYTUFF", level: 25, cost: 2680 }],
  [{ kind: "mon", name: "SCYTHER", level: 30, cost: 5500 }, { kind: "mon", name: "PINSIR", level: 30, cost: 5500 }, { kind: "mon", name: "PORYGON", level: 20, cost: 6500 }],
  [{ kind: "item", name: "TM_DRAGON_RAGE", cost: 3300 }, { kind: "item", name: "TM_HYPER_BEAM", cost: 5500 }, { kind: "item", name: "TM_SUBSTITUTE", cost: 7700 }],
];

export async function prizeExchange(game: YellowGame) {
  if (!game.hasItem("COIN_CASE")) return game.say("A COIN CASE is required!");
  for (;;) {
    const window = await choose(game, `Coins ${game.coins}`, ["Prizes 1", "Prizes 2", "Prizes 3"], "We exchange your coins for prizes.");
    if (window === undefined) break;
    const list = PRIZES[window];
    const label = (p: typeof list[number]) => p.kind === "mon" ? game.rom.monName(MON[p.name]) : game.rom.itemName(ITEM[p.name]);
    const pick = await choose(game, `Coins ${game.coins}`, list.map(p => `${label(p)}  ${p.cost}C`));
    if (pick === undefined) continue;
    const prize = list[pick];
    game.layer.replaceChildren();
    if (game.coins < prize.cost) {
      await game.say("You don't have enough coins.");
      continue;
    }
    if (prize.kind === "item" ? !game.give(prize.name) : !(await game.giveMon(prize.name, prize.level!))) {
      await game.say("You have no room for this prize.");
      continue;
    }
    game.coins -= prize.cost;
    if (prize.kind === "item") await game.say(`Here you go! You got ${label(prize)}.`);
  }
  game.layer.replaceChildren();
}

// ------------------------------------------------------------ slot machines
type Symbol = "7" | "BAR" | "CHERRY" | "FISH" | "BIRD" | "MOUSE";
const REEL: Symbol[][] = [
  ["7", "MOUSE", "FISH", "BAR", "CHERRY", "BIRD", "7", "FISH", "MOUSE", "BAR", "CHERRY", "FISH", "BIRD", "MOUSE", "CHERRY"],
  ["7", "FISH", "CHERRY", "BIRD", "MOUSE", "BAR", "CHERRY", "FISH", "BIRD", "CHERRY", "7", "MOUSE", "BAR", "FISH", "BIRD"],
  ["7", "BIRD", "FISH", "CHERRY", "MOUSE", "BIRD", "BAR", "FISH", "MOUSE", "CHERRY", "BIRD", "7", "FISH", "MOUSE", "BAR"],
];
const PAYOUT: Record<Symbol, number> = { "7": 300, BAR: 100, CHERRY: 8, FISH: 15, BIRD: 15, MOUSE: 15 };
const LABEL: Record<Symbol, string> = { "7": "7", BAR: "BAR", CHERRY: "♣", FISH: "FISH", BIRD: "BIRD", MOUSE: "PIKA" };
let luckyMachine = -1;

/** A slot machine. `arg` is the hidden object's argument ($FD out of order, $FE lunch, $FF keys). */
export async function slotMachine(game: YellowGame, arg: number, machine: number) {
  if (arg === 0xfd) return game.text("GameCornerOutOfOrderText");
  if (arg === 0xfe) return game.text("GameCornerOutToLunchText");
  if (arg === 0xff) return game.text("GameCornerSomeonesKeysText");
  if (!game.hasItem("COIN_CASE")) return game.text("GameCornerCoinCaseText");
  if (!game.coins) return game.text("_OutOfCoinsSlotMachineText");
  await game.text("_PlaySlotMachineText", { wait: false });
  if (!(await game.yesNo())) return;
  if (luckyMachine < 0) luckyMachine = Math.floor(Math.random() * 36);
  const lucky = machine === luckyMachine;
  await game.modal(() => play(game, lucky));
}

function play(game: YellowGame, lucky: boolean) {
  return new Promise<void>(resolve => {
    const pos = [0, 0, 0];
    let bet = 0, spinning = -1, timer = 0;
    const root = document.createElement("section");
    root.className = "yellow-slots";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Slot machine");
    game.layer.replaceChildren(root);
    const cell = (r: number, offset: number) => REEL[r][(pos[r] + offset + REEL[r].length) % REEL[r].length];
    const render = (message: string, buttons: string) => {
      root.innerHTML = `<div class="slots-reels">${[0, 1, 2].map(r => `<div class="slots-reel${spinning === r ? " spinning" : ""}">${[-1, 0, 1].map(o => {
        const s = cell(r, o);
        return `<span class="sym sym-${s.toLowerCase()}">${LABEL[s]}</span>`;
      }).join("")}</div>`).join("")}</div>
        <div class="slots-lines" data-bet="${bet}"></div>
        <p class="slots-coins">Coins ${game.coins}${bet ? ` · Bet ${bet}` : ""}</p>
        <p class="slots-message" aria-live="polite">${message}</p><div class="buttons">${buttons}</div>`;
      root.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    };
    const quit = () => {
      window.clearInterval(timer);
      game.layer.replaceChildren();
      resolve();
    };
    const betMenu = (message = "Bet how many coins?") => {
      bet = 0;
      spinning = -1;
      render(message, `${[1, 2, 3].map(n => `<button data-bet="${n}"${game.coins < n ? " disabled" : ""}>${n}</button>`).join("")}<button class="secondary" id="back">Quit</button>`);
      for (const b of root.querySelectorAll<HTMLButtonElement>("[data-bet]")) b.onclick = () => start(+b.dataset.bet!);
      root.querySelector<HTMLButtonElement>("#back")!.onclick = quit;
    };
    const start = (n: number) => {
      if (game.coins < n) return betMenu("Not enough coins!");
      bet = n;
      game.coins -= n;
      spinning = 0;
      game.sfx("SFX_SLOTS_NEW_SPIN");
      timer = window.setInterval(() => {
        for (let r = spinning; r < 3; r++) pos[r] = (pos[r] + 1) % REEL[r].length;
        render("Press A to stop the reel.", `<button id="stop">Stop</button>`);
        root.querySelector<HTMLButtonElement>("#stop")!.onclick = stop;
      }, 90);
    };
    const lines = () => {
      const rows: Symbol[][] = [[cell(0, 0), cell(1, 0), cell(2, 0)]];
      if (bet >= 2) rows.push([cell(0, -1), cell(1, -1), cell(2, -1)], [cell(0, 1), cell(1, 1), cell(2, 1)]);
      if (bet >= 3) rows.push([cell(0, -1), cell(1, 0), cell(2, 1)], [cell(0, 1), cell(1, 0), cell(2, -1)]);
      return rows;
    };
    const stop = () => {
      if (spinning < 0) return;
      // The reels slip a little, and an unlucky machine rarely lets 7s or BARs line up.
      if (Math.random() < (lucky ? 0.35 : 0.2)) {
        const first = cell(0, 0);
        if (spinning > 0 && (first !== "7" && first !== "BAR" || lucky || Math.random() < 0.3)) {
          const target = REEL[spinning].indexOf(first);
          if (target >= 0) pos[spinning] = target;
        }
      }
      game.sfx("SFX_SLOTS_STOP_WHEEL");
      spinning++;
      if (spinning < 3) return;
      window.clearInterval(timer);
      spinning = -1;
      const win = lines().filter(l => l[0] === l[1] && l[1] === l[2]).map(l => l[0]);
      const reward = win.reduce((n, s) => n + PAYOUT[s], 0);
      if (reward) {
        game.coins += reward;
        game.sfx("SFX_SLOTS_REWARD");
        render(`${win.map(s => LABEL[s]).join(", ")} lined up! Scored ${reward} coins!`, `<button id="again">One more go</button><button class="secondary" id="back">Quit</button>`);
      } else render("Not this time!", `<button id="again">One more go</button><button class="secondary" id="back">Quit</button>`);
      root.querySelector<HTMLButtonElement>("#again")!.onclick = () => game.coins ? betMenu() : quit();
      root.querySelector<HTMLButtonElement>("#back")!.onclick = quit;
    };
    betMenu();
  });
}
