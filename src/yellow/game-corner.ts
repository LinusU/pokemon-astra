import type { YellowGame } from "./runtime";
import { mountSlots } from "../ui/slots";
import { choose } from "./services";
import type { YellowRom } from "./rom";
import { MON, ITEM, SYM } from "./symbols";

interface Prize { kind: "mon" | "item"; name: string; level?: number; cost: number }

/**
 * Celadon's prize corner, from the cartridge's tables: two windows of Pokémon
 * (their levels from PrizeMonLevelDictionary), then one of TMs. Costs are BCD.
 */
export function prizes(rom: YellowRom): Prize[][] {
  const menus = SYM.PrizeDifferentMenuPtrs, bank = rom.bankOf(menus);
  const bcd = (b: number) => (b >> 4) * 10 + (b & 15);
  const nameOf = (table: Record<string, number>, id: number) => Object.keys(table).find(k => table[k] === id) ?? "";
  const level = (species: number) => {
    for (let o = SYM.PrizeMonLevelDictionary, i = 0; i < 9; i++, o += 2) if (rom.u8(o) === species) return rom.u8(o + 1);
  };
  return [0, 1, 2].map(window => {
    const entries = rom.far(bank, rom.u16(menus + window * 4)), costs = rom.far(bank, rom.u16(menus + window * 4 + 2));
    const list: Prize[] = [];
    for (let i = 0; i < 8 && rom.u8(entries + i) !== 0x50; i++) {
      const id = rom.u8(entries + i), cost = bcd(rom.u8(costs + i * 2)) * 100 + bcd(rom.u8(costs + i * 2 + 1));
      list.push(window < 2 ? { kind: "mon", name: nameOf(MON, id), level: level(id), cost } : { kind: "item", name: nameOf(ITEM, id), cost });
    }
    return list;
  });
}

export async function prizeExchange(game: YellowGame) {
  if (!game.hasItem("COIN_CASE")) return game.say("A COIN CASE is required!");
  for (;;) {
    const window = await choose(game, `Coins ${game.coins}`, ["Prizes 1", "Prizes 2", "Prizes 3"], "We exchange your coins for prizes.");
    if (window === undefined) break;
    const list = prizes(game.rom)[window];
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
    const sounds = { spin: "SFX_SLOTS_NEW_SPIN", stop: "SFX_SLOTS_STOP_WHEEL", win: "SFX_SLOTS_REWARD" };
    mountSlots(game.layer, {
      reels: REEL, payout: PAYOUT, label: LABEL,
      coins: () => game.coins,
      pay: coins => { game.coins += coins; },
      sfx: sound => game.sfx(sounds[sound]),
      // An unlucky machine rarely lets 7s or BARs line up.
      slips: first => Math.random() < (lucky ? 0.35 : 0.2) && (first !== "7" && first !== "BAR" || lucky || Math.random() < 0.3),
      onDone: () => {
        game.layer.replaceChildren();
        resolve();
      },
    });
  });
}
