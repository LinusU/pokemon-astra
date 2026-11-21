/** Pokémon Centers, Marts, PCs and other shared services. */
import { mountStoragePc, type PcState } from "../ui/storage-pc";
import { sortCollection } from "../game/collection";
import { escapeHtml, panel } from "../ui/shell";
import { ITEM, MAP, MON, SYM } from "./generated/symbols";
import type { YellowGame } from "./runtime";
import { titleItem } from "./menu";
import { STEP } from "./world";
import type { Save } from "../game/save";

/** A list menu inside the overworld. Resolves to the chosen index, or undefined for B. */
export function choose(game: YellowGame, title: string, options: string[], prompt = ""): Promise<number | undefined> {
  return new Promise(resolve => {
    const p = panel(game.layer, title, `${prompt ? `<p>${escapeHtml(prompt)}</p>` : ""}<nav class="journey-list">${options.map((o, i) =>
      `<button data-choice="${i}">${escapeHtml(o)}</button>`).join("")}</nav><div class="buttons"><button class="secondary" id="back">Cancel</button></div>`, "yellow-choice");
    p.querySelector<HTMLButtonElement>("[data-choice]")?.focus({ preventScroll: true });
    for (const b of p.querySelectorAll<HTMLButtonElement>("[data-choice]"))
      b.onclick = () => resolve(+b.dataset.choice!);
    p.querySelector<HTMLButtonElement>("#back")!.onclick = () => resolve(undefined);
  });
}

function quantity(game: YellowGame, title: string, price: number, max: number): Promise<number | undefined> {
  return new Promise(resolve => {
    let n = 1;
    const render = () => {
      const p = panel(game.layer, title, `<p class="yellow-qty">×${String(n).padStart(2, "0")} · ₽${price * n}</p><p class="small">Up/down change the amount.</p><div class="buttons"><button id="more">+</button><button id="less">−</button><button id="confirm">OK</button><button class="secondary" id="back">Cancel</button></div>`, "yellow-choice");
      p.querySelector<HTMLButtonElement>("#more")!.onclick = () => { n = n >= max ? 1 : n + 1; render(); p.isConnected; };
      p.querySelector<HTMLButtonElement>("#less")!.onclick = () => { n = n <= 1 ? max : n - 1; render(); };
      p.querySelector<HTMLButtonElement>("#confirm")!.onclick = () => resolve(n);
      p.querySelector<HTMLButtonElement>("#back")!.onclick = () => resolve(undefined);
      p.querySelector<HTMLButtonElement>("#confirm")!.focus({ preventScroll: true });
      const keys = (e: KeyboardEvent) => {
        if (e.key === "ArrowUp" || e.key === "w") { n = n >= max ? 1 : n + 1; render(); }
        else if (e.key === "ArrowDown" || e.key === "s") { n = n <= 1 ? max : n - 1; render(); }
        else return;
        e.preventDefault();
        window.removeEventListener("keydown", keys, true);
      };
      window.addEventListener("keydown", keys, true);
      const observer = new MutationObserver(() => {
        if (!p.isConnected) {
          window.removeEventListener("keydown", keys, true);
          observer.disconnect();
        }
      });
      observer.observe(game.layer, { childList: true });
    };
    render();
  });
}

const kinds = (items: Record<string, number>) => Object.keys(items).filter(k => items[k] > 0).length;

async function mart(game: YellowGame, stock: number[]) {
  const save = game.save;
  await game.text("_PokemartGreetingText");
  for (;;) {
    const action = await choose(game, `Money ₽${save.money}`, ["Buy", "Sell", "Quit"]);
    if (action === 0) {
      for (;;) {
        const pick = await choose(game, `Money ₽${save.money}`, stock.map(id => `${titleItem(game.rom.itemName(id))}  ₽${game.rom.itemPrice(id)}`));
        if (pick === undefined) break;
        const id = stock[pick], price = game.rom.itemPrice(id), have = save.items[id] ?? 0;
        const max = Math.min(99 - have, Math.floor(save.money / price));
        if (max <= 0) {
          await game.text(have >= 99 ? "_PokemartItemBagFullText" : "_PokemartNotEnoughMoneyText");
          continue;
        }
        const n = await quantity(game, titleItem(game.rom.itemName(id)), price, max);
        if (!n) continue;
        if (!have && kinds(save.items) >= 20) {
          await game.text("_PokemartItemBagFullText");
          continue;
        }
        save.money -= price * n;
        save.items[id] = have + n;
        game.ctx.sound.overworld("purchase");
        await game.text("_PokemartBoughtItemText");
      }
    } else if (action === 1) {
      for (;;) {
        const sellable = Object.keys(save.items).map(Number).filter(id => save.items[id] > 0 && game.rom.itemPrice(id) > 0 && id < 0xc4 && !isKeyItem(id));
        if (!sellable.length) {
          await game.text("_PokemartItemBagEmptyText");
          break;
        }
        const pick = await choose(game, `Money ₽${save.money}`, sellable.map(id => `${titleItem(game.rom.itemName(id))} ×${save.items[id]}  ₽${Math.floor(game.rom.itemPrice(id) / 2)}`));
        if (pick === undefined) break;
        const id = sellable[pick], price = Math.floor(game.rom.itemPrice(id) / 2);
        const n = await quantity(game, titleItem(game.rom.itemName(id)), price, save.items[id]);
        if (!n) continue;
        save.items[id] -= n;
        if (!save.items[id]) delete save.items[id];
        game.money += price * n;
        game.ctx.sound.overworld("purchase");
      }
    } else break;
  }
  game.layer.replaceChildren();
  await game.text("_PokemartThankYouText");
}
const KEY = ["TOWN_MAP", "BICYCLE", "SURFBOARD", "POKEDEX", "OLD_AMBER", "DOME_FOSSIL", "HELIX_FOSSIL", "SECRET_KEY", "BIKE_VOUCHER", "CARD_KEY", "S_S_TICKET", "GOLD_TEETH", "COIN_CASE", "OAKS_PARCEL", "ITEMFINDER", "SILPH_SCOPE", "POKE_FLUTE", "LIFT_KEY", "EXP_ALL", "OLD_ROD", "GOOD_ROD", "SUPER_ROD"];
const isKeyItem = (id: number) => KEY.some(k => ITEM[k] === id);

async function nurse(game: YellowGame) {
  await game.text("PokemonCenterWelcomeText");
  await game.text("ShallWeHealYourPokemonText", { wait: false });
  if (!(await game.yesNo())) {
    await game.text("PokemonCenterFarewellText");
    return;
  }
  await game.text("NeedYourPokemonText", { wait: false });
  game.save.blackout = game.save.lastMap;
  game.heal();
  game.ctx.sound.heal();
  await game.delay(90);
  await game.text("PokemonFightingFitText");
  await game.text("PokemonCenterFarewellText");
  game.persist();
}

function storage(game: YellowGame) {
  return new Promise<void>(resolve => {
    const state: PcState = {};
    game.ctx.sound.overworld("bootPc");
    sortCollection(game.save.storage);
    mountStoragePc(game.layer, {
      save: game.save as unknown as Save, state, engine: game.engine, sprite: game.ctx.sprite, itemName: () => "",
      saveTransfer: async roster => {
        Object.assign(game.save, roster);
        await game.persist(true);
        game.ctx.sound.overworld("pcTransfer");
      },
      onClose: () => {
        game.ctx.sound.overworld("shutDownPc");
        resolve();
      },
    });
  });
}

async function pcMenu(game: YellowGame) {
  await game.text("_TurnedOnPC1Text");
  for (;;) {
    const choice = await choose(game, "PC", ["Pokémon storage", `${game.save.name}'s PC`, "PROF.OAK's PC", "Log off"]);
    if (choice === 0) await storage(game);
    else if (choice === 1) await itemPc(game);
    else if (choice === 2) {
      game.layer.replaceChildren();
      await game.say(`POKéDEX: ${game.save.seen.filter(n => n <= 151).length} seen, ${game.save.caught.filter(n => n <= 151).length} owned.`);
    } else break;
  }
}

async function itemPc(game: YellowGame) {
  const save = game.save;
  for (;;) {
    const action = await choose(game, `${save.name}'s PC`, ["Withdraw item", "Deposit item", "Toss item", "Log off"]);
    if (action === undefined || action === 3) return;
    const from = action === 1 ? save.items : save.pcItems, to = action === 1 ? save.pcItems : save.items;
    const ids = Object.keys(from).map(Number).filter(id => from[id] > 0);
    if (!ids.length) {
      game.layer.replaceChildren();
      await game.say(action === 1 ? "You have nothing to deposit." : "There's nothing stored.");
      continue;
    }
    const pick = await choose(game, action === 0 ? "Withdraw" : action === 1 ? "Deposit" : "Toss", ids.map(id => `${titleItem(game.rom.itemName(id))} ×${from[id]}`));
    if (pick === undefined) continue;
    const id = ids[pick];
    const n = await quantity(game, titleItem(game.rom.itemName(id)), 0, from[id]);
    if (!n) continue;
    if (action !== 2) {
      if (!to[id] && kinds(to) >= (action === 0 ? 20 : 50)) {
        game.layer.replaceChildren();
        await game.say("There's no more room.");
        continue;
      }
      to[id] = Math.min(99, (to[id] ?? 0) + n);
    }
    from[id] -= n;
    if (!from[id]) delete from[id];
  }
}

export async function openService(game: YellowGame, kind: "mart" | "nurse" | "pc" | "bills_pc", arg?: number[]) {
  if (kind === "nurse") return nurse(game);
  if (kind === "mart") return mart(game, arg ?? []);
  return pcMenu(game);
}

export async function vendingMachine(game: YellowGame) {
  await game.text("VendingMachineText1");
  const drinks: [string, number][] = [["FRESH_WATER", 200], ["SODA_POP", 300], ["LEMONADE", 350]];
  const pick = await choose(game, `Money ₽${game.money}`, drinks.map(([d, p]) => `${titleItem(game.rom.itemName(ITEM[d]))}  ₽${p}`));
  game.layer.replaceChildren();
  if (pick === undefined) return game.text("VendingMachineText7");
  const [drink, price] = drinks[pick];
  if (game.money < price) return game.text("VendingMachineText4");
  if (!game.give(drink)) return game.text("VendingMachineText6");
  game.money -= price;
  game.sfx("SFX_PUSH_BOULDER");
  await game.text("VendingMachineText5");
}

export async function prizeVendor(game: YellowGame) {
  const { prizeExchange } = await import("./game-corner");
  return prizeExchange(game);
}

/** Where a blackout or Escape Rope lands: outside the Pokémon Center of a town. */
export function blackoutSpot(game: YellowGame, town: number) {
  const rom = game.rom, base = SYM.FlyWarpDataPtr, bank = rom.bankOf(base);
  for (let o = base; rom.u8(o) !== 0xff && o < base + 64; o += 4) {
    if (rom.u8(o) !== town) continue;
    const p = rom.far(bank, rom.u16(o + 2));
    return { map: town, x: rom.u8(p + 3), y: rom.u8(p + 2) };
  }
  return { map: MAP.PALLET_TOWN, x: 5, y: 6 };
}

export async function escapeRope(game: YellowGame) {
  const outdoors = game.map < 0x25;
  if (outdoors || !game.rom.tileset(game.world.map(game.map).tileset).grass && !isDungeon(game)) return false;
  const spot = blackoutSpot(game, game.save.blackout);
  await game.warp(mapName(spot.map), spot.x, spot.y, "down");
  return true;
}
function isDungeon(game: YellowGame) {
  return game.rom.wild(game.map).grassRate > 0 || game.rom.tileset(game.world.map(game.map).tileset).id === 17;
}
function mapName(id: number) {
  return Object.keys(MAP).find(k => MAP[k] === id)!;
}

export async function fish(game: YellowGame, rod: "OLD_ROD" | "GOOD_ROD" | "SUPER_ROD") {
  await game.runScript(async () => {
    const [dx, dy] = STEP[game.playerState.facing];
    const map = game.world.map(game.map);
    if (game.save.surfing || !game.world.isWater(map, game.playerState.x + dx, game.playerState.y + dy)) {
      await game.say("Can't use that here.");
      return;
    }
    await game.delay(40);
    let pick: { species: number; level: number } | undefined;
    if (rod === "OLD_ROD") pick = { species: MON.MAGIKARP, level: 5 };
    else if (rod === "GOOD_ROD") {
      if (Math.random() < 0.5) pick = Math.random() < 0.5 ? { species: MON.GOLDEEN, level: 10 } : { species: MON.POLIWAG, level: 10 };
    } else pick = superRod(game);
    if (!pick || Math.random() < 0.25) {
      await game.say("Not even a nibble!");
      return;
    }
    await game.say("Oh! It's a bite!");
    await game.wildBattle(pick.species, pick.level);
  });
}
function superRod(game: YellowGame) {
  // Yellow's Super Rod table: map id, then four (species, level) pairs.
  const rom = game.rom, base = SYM.SuperRodFishingSlots;
  for (let o = base; rom.u8(o) !== 0xff && o < base + 2000; o += 9) {
    if (rom.u8(o) !== game.map) continue;
    const i = Math.floor(Math.random() * 4);
    return { species: rom.u8(o + 1 + i * 2), level: rom.u8(o + 2 + i * 2) };
  }
  return undefined;
}

export function itemfinder(game: YellowGame) {
  const near = game.rom.hiddenObjects(game.map).some(h => h.routine === "HiddenItems" &&
    !game.save.vars[`hidden:${game.map}:${h.x}:${h.y}`] &&
    Math.abs(h.x - game.playerState.x) <= 4 && Math.abs(h.y - game.playerState.y) <= 4);
  return near ? "Yes! ITEMFINDER indicates there's an item nearby." : "Nope! ITEMFINDER isn't responding.";
}

export async function pokeFlute(game: YellowGame) {
  const woke = game.save.party.some(m => m.status & 7);
  game.save.party = game.save.party.map(m => ({ ...m, status: m.status & 7 ? 0 : m.status }));
  const handler = (globalThis as { __yellowFlute?: (g: YellowGame) => Promise<boolean> }).__yellowFlute;
  if (handler && await handler(game)) return "close";
  return woke ? "All sleeping POKéMON woke up." : "Played the POKé FLUTE. Now, that's a catchy tune!";
}

export async function teachMachine(game: YellowGame, id: number) {
  const move = game.rom.u8(SYM.TechnicalMachines + id - 0xc4);
  const { teachMove } = await import("./evolution");
  return teachMove(game, id, move);
}
