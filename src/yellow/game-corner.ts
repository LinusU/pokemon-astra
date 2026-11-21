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
