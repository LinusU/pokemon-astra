/** Marts, PCs, found items, trades, elevators and the other shared services of the Crystal adventures. */
import { mountStoragePc, type PcState } from "../ui/storage-pc";
import { escapeHtml, panel } from "../ui/shell";
import type { Save } from "../game/save";
import { C, CONST, MOVE, RAM, SYM, TEXT, constName, itemConst } from "./symbols";
import type { CrystalGame } from "./runtime";
import { titleCase } from "./runtime";
import { runScript } from "./script";
import type { BgEvent } from "./rom";
import type { Obj } from "./runtime";
import type { CrystalMon } from "./save";

/** Shows an engine text by label, or `fallback` on a cartridge without it. */
export async function engineText(game: CrystalGame, label: string, fallback = "", wait = true) {
  const at = TEXT[label];
  if (at !== undefined) return game.engineText(at, wait);
  if (fallback) await game.say(fallback, false);
  if (wait) await game.waitButton();
}

export function itemTitle(name: string) {
  return titleCase(name).replace(/Poké/i, "Poké").replace(/\bHm/, "HM").replace(/\bTm/, "TM").replace(/\bPp\b/, "PP").replace(/\bS\.s\./i, "S.S.");
}

// ------------------------------------------------------------------ menus from scripts
/** A `loadmenu` header: its strings, whether B cancels, and its columns. */
export function readMenuHeader(game: CrystalGame, at: number) {
  const r = game.rom;
  const data = r.near(at + 5);
  const flags = r.u8(data);
  const cancel = !(flags & (CONST.STATICMENU_DISABLE_B ?? 0));
  // Vertical menus list their strings after a count; 2D menus point at them.
  const second = r.u8(data + 1);
  const twoD = (second >> 4) >= 1 && (second & 0xf) >= 1 && r.u8(data + 2) < 20 && r.u8(data + 3) > 0x3f;
  if (twoD) {
    const rows = second >> 4, cols = second & 0xf;
    const text = r.far(data + 3);
    const items = Array.from({ length: rows * cols }, (_, i) => r.nthString(text, i, 20));
    return { items, cancel, columns: cols };
  }
  const items = Array.from({ length: second }, (_, i) => r.nthString(data + 2, i, 20));
  return { items, cancel, columns: 1 };
}

export function showPokepic(game: CrystalGame, species: number) {
  if (!game.ctx.layer || !game.ctx.sprite) return;
  const box = document.createElement("div");
  box.className = "crystal-pokepic";
  box.innerHTML = `<img alt="" src="${game.ctx.sprite(species)}">`;
  game.layer.append(box);
}

export async function describeDecoration(game: CrystalGame, kind: number) {
  void kind;
  await engineText(game, "LookTownMapText", "It's a decoration.");
  game.closeText();
}

// ------------------------------------------------------------------ the map
/** Where a blackout leads: the spawn point of the last town with a Pokémon Center. */
export function blackoutSpot(game: CrystalGame) {
  const r = game.rom, { group, number } = game.save.spawn;
  let home: { group: number; number: number; x: number; y: number } | undefined;
  for (let o = SYM.SpawnPoints; r.u8(o) !== 0xff; o += 4) {
    const spot = { group: r.u8(o), number: r.u8(o + 1), x: r.u8(o + 2), y: r.u8(o + 3) };
    home ??= spot;
    if (spot.group === group && spot.number === number) return spot;
  }
  return home!;
}
export function spawnPoint(game: CrystalGame, index: number) {
  const o = SYM.SpawnPoints + index * 4, r = game.rom;
  return { group: r.u8(o), number: r.u8(o + 1), x: r.u8(o + 2), y: r.u8(o + 3) };
}

/** Bookshelves, PCs, the TV and other tiles that run a standard script when inspected. */
export async function tileCollisionScript(game: CrystalGame, coll: number) {
  const r = game.rom;
  for (let o = SYM.TileCollisionStdScripts; r.u8(o) !== 0xff; o += 3) {
    if (r.u8(o) !== coll) continue;
    const std = r.u16(o + 1);
    await runScript(game, r.far(SYM.StdScripts + std * 3));
    return true;
  }
  return false;
}

/** An item ball: the cartridge's FindItemInBallScript with the ball's item. */
export async function pickUpItemBall(game: CrystalGame, o: Obj) {
  const r = game.rom;
  game.poke(RAM.wItemBallItemID, r.u8(o.event.script));
  game.poke(RAM.wItemBallQuantity, r.u8(o.event.script + 1) || 1);
  game.lastItem = r.u8(o.event.script);
  await runScript(game, SYM.FindItemInBallScript);
}

/** A hidden item: the cartridge's HiddenItemScript, once. */
export async function hiddenItem(game: CrystalGame, bg: BgEvent) {
  const r = game.rom, flag = r.u16(bg.script), item = r.u8(bg.script + 2);
  if (game.event(flag)) return false;
  game.poke(RAM.wHiddenItemID, item);
  game.poke(RAM.wHiddenItemEvent, flag & 0xff);
  game.poke(RAM.wHiddenItemEvent + 1, flag >> 8);
  game.lastItem = item;
  game.sfx("SFX_READ_TEXT_2");
  await runScript(game, SYM.HiddenItemScript);
  return true;
}

// ------------------------------------------------------------------ items received
const POCKETS = ["ITEM POCKET", "BALL POCKET", "KEY POCKET", "TM POCKET"];
function pocketName(game: CrystalGame, item: number) {
  const pocket = game.rom.itemPocket(item);
  const names: Record<number, string> = { [C("ITEM")]: POCKETS[0], [C("BALL")]: POCKETS[1], [C("KEY_ITEM")]: POCKETS[2], [C("TM_HM")]: POCKETS[3] };
  return names[pocket] ?? POCKETS[0];
}
/** An item's name; Crystal Legacy shows a TM's or HM's move with it ("TM01 DYNAMICPUNCH"). */
function itemName(game: CrystalGame, item: number) {
  const name = game.rom.itemName(item);
  const id = itemConst(item) ?? "";
  if (game.legacy && /^(TM|HM)_/.test(id)) {
    const move = MOVE[id.slice(3)];
    if (move) return `${name} ${game.engine.move(move).name.toUpperCase()}`;
  }
  return name;
}
/** `verbosegiveitem`: the cartridge's GiveItemScript. */
export async function receivedItem(game: CrystalGame, item: number, count: number, ok: boolean) {
  void count;
  game.lastItem = item;
  game.strings.set(RAM.wStringBuffer4, itemName(game, item));
  await engineText(game, "_ReceivedItemText", `{PLAYER} received ${itemName(game, item)}.`, false);
  if (!ok) {
    await game.waitButton();
    return pocketIsFull(game);
  }
  game.sfx(game.rom.itemPocket(item) === C("TM_HM") ? "SFX_GET_TM" : "SFX_ITEM");
  await game.waitButton();
  await itemNotify(game);
}
export async function itemNotify(game: CrystalGame) {
  game.strings.set(RAM.wStringBuffer3, pocketName(game, game.lastItem));
  game.strings.set(RAM.wStringBuffer1, itemName(game, game.lastItem));
  await engineText(game, "_PutItemInPocketText", `{PLAYER} put the ${itemName(game, game.lastItem)} in the ${pocketName(game, game.lastItem)}.`);
}
export async function pocketIsFull(game: CrystalGame) {
  game.strings.set(RAM.wStringBuffer3, pocketName(game, game.lastItem));
  game.strings.set(RAM.wStringBuffer1, itemName(game, game.lastItem));
  await engineText(game, "_PocketIsFullText", `The ${pocketName(game, game.lastItem)} is full…`);
}

// ------------------------------------------------------------------ marts
async function martText(game: CrystalGame, label: string, fallback: string, wait = true) {
  await engineText(game, label, fallback, wait);
}
/** A count chooser: up and down change it, A confirms. */
export async function quantity(game: CrystalGame, title: string, max: number, price = 0) {
  const options = Array.from({ length: Math.max(1, Math.min(max, 99)) }, (_, i) => `×${String(i + 1).padStart(2, "0")}${price ? `  ¥${price * (i + 1)}` : ""}`);
  const pick = await game.choose(options, { title, cancel: true });
  return pick === undefined ? 0 : pick + 1;
}

export async function pokemart(game: CrystalGame, kind: number, id: number) {
  const r = game.rom;
  let stock: { item: number; price: number }[];
  const type = constName("MARTTYPE_", kind) ?? "MARTTYPE_STANDARD";
  const priced = (at: number) => {
    const list: { item: number; price: number }[] = [];
    for (let o = at + 1; r.u8(o) !== 0xff && list.length < 20; o += 3) list.push({ item: r.u8(o), price: r.u16(o + 1) });
    return list;
  };
  if (type === "MARTTYPE_BARGAIN" && SYM.BargainShopData !== undefined) stock = priced(SYM.BargainShopData);
  else if (type === "MARTTYPE_ROOFTOP" && SYM.RooftopSaleMart1 !== undefined) // After the Hall of Fame the rooftop sale has better stock.
    stock = priced(game.ev("EVENT_BEAT_ELITE_FOUR") ? SYM.RooftopSaleMart2 : SYM.RooftopSaleMart1);
  else stock = r.martStock(id).map(item => ({ item, price: r.itemPrice(item) }));
  const intro: Record<string, [string, string]> = {
    MARTTYPE_BITTER: ["HerbShopLadyIntroText", "HerbalLadyComeAgainText"],
    MARTTYPE_BARGAIN: ["BargainShopIntroText", "BargainShopComeAgainText"],
    MARTTYPE_PHARMACY: ["PharmacyIntroText", "PharmacyComeAgainText"],
  };
  const standard = type === "MARTTYPE_STANDARD" || type === "MARTTYPE_ROOFTOP";
  await martText(game, intro[type]?.[0] ?? "MartWelcomeText", "Welcome! How may I help you?", false);
  for (;;) {
    const action = standard ? await game.choose(["BUY", "SELL", "QUIT"], { title: `¥${game.save.money}` }) : 0;
    if (action === 0) await buy(game, stock, type);
    else if (action === 1) await sell(game);
    if (!standard || action === undefined || action === 2) break;
    await martText(game, "MartAskMoreText", "Is there anything else I can do?", false);
  }
  await martText(game, intro[type]?.[1] ?? "MartComeAgainText", "Please come again!");
  game.closeText();
}
/** The numbers the mart's texts print: quantity, item name and price. */
function martVars(game: CrystalGame, item: number, n: number, money: number) {
  game.poke(RAM.wItemQuantityChange, n);
  game.strings.set(RAM.wStringBuffer2, game.rom.itemName(item));
  game.poke(RAM.hMoneyTemp, money >> 16);
  game.poke(RAM.hMoneyTemp + 1, (money >> 8) & 0xff);
  game.poke(RAM.hMoneyTemp + 2, money & 0xff);
}
async function buy(game: CrystalGame, stock: { item: number; price: number }[], type: string) {
  for (;;) {
    const pick = await game.choose(stock.map(s => `${itemTitle(game.rom.itemName(s.item))}  ¥${s.price}`), { title: `¥${game.save.money}`, cancel: true });
    if (pick === undefined) return;
    const { item, price } = stock[pick];
    const have = game.itemCount(item);
    const max = type === "MARTTYPE_BARGAIN" ? 1 : Math.min(99 - have, Math.floor(game.save.money / Math.max(1, price)));
    if (max <= 0) {
      await martText(game, game.save.money < price ? "MartNoMoneyText" : "MartPackFullText", game.save.money < price ? "You don't have enough money." : "You can't carry any more items.");
      continue;
    }
    await martText(game, "MartHowManyText", "How many?", false);
    const n = await quantity(game, itemTitle(game.rom.itemName(item)), max, price);
    if (!n) continue;
    martVars(game, item, n, price * n);
    await martText(game, "MartFinalPriceText", `${n} ${game.rom.itemName(item)}(S) will be ¥${price * n}. OK?`, false);
    if (!(await game.yesNo())) continue;
    if (!game.giveItem(item, n)) {
      await martText(game, "MartPackFullText", "You can't carry any more items.");
      continue;
    }
    game.save.money -= price * n;
    game.sfx("SFX_TRANSACTION");
    await martText(game, "MartThanksText", "Here you are. Thank you!");
  }
}
async function sell(game: CrystalGame) {
  for (;;) {
    const sellable = Object.keys(game.save.items).map(Number).filter(id => game.save.items[id] > 0 && game.rom.itemPrice(id) > 0 && game.rom.itemPocket(id) !== C("KEY_ITEM"));
    if (!sellable.length) return;
    const pick = await game.choose(sellable.map(id => `${itemTitle(game.rom.itemName(id))} ×${game.save.items[id]}  ¥${Math.floor(game.rom.itemPrice(id) / 2)}`), { title: `¥${game.save.money}`, cancel: true });
    if (pick === undefined) return;
    const id = sellable[pick], price = Math.floor(game.rom.itemPrice(id) / 2);
    await martText(game, "MartSellHowManyText", "How many?", false);
    const n = await quantity(game, itemTitle(game.rom.itemName(id)), game.save.items[id], price);
    if (!n) continue;
    martVars(game, id, n, price * n);
    await martText(game, "MartSellPriceText", `I can pay you ¥${price * n}.`, false);
    if (!(await game.yesNo())) continue;
    game.takeItem(id, n);
    game.addMoney(0, price * n);
    game.sfx("SFX_TRANSACTION");
    await martText(game, "MartBoughtText", `Got ¥${price * n} for ${game.rom.itemName(id)}(S).`);
  }
}

// ------------------------------------------------------------------ elevators
export async function elevator(game: CrystalGame, at: number) {
  const r = game.rom, count = r.u8(at);
  const floors = Array.from({ length: count }, (_, i) => ({ floor: r.u8(at + 1 + i * 4), warp: r.u8(at + 2 + i * 4), group: r.u8(at + 3 + i * 4), number: r.u8(at + 4 + i * 4) }));
  const here = floors.findIndex(f => f.group === game.map.group && f.number === game.map.number);
  const names = floors.map(f => (constName("FLOOR_", f.floor) ?? "FLOOR_?").slice(6));
  const pick = await game.choose(names, { title: "Which floor?", cancel: true });
  if (pick === undefined || pick === here) return false;
  const f = floors[pick];
  game.save.backupWarp = { warp: f.warp, group: f.group, number: f.number };
  return true;
}

// ------------------------------------------------------------------ in-game trades
export async function npcTrade(game: CrystalGame, index: number) {
  const r = game.rom, t = r.npcTrade(index);
  const flags = game.save.vars.tradeFlags ?? 0;
  const text = (dialog: number) => r.near(SYM.TradeTexts + (dialog * 4 + t.dialog) * 2);
  const gender = t.gender === C("TRADE_GENDER_MALE") ? "♂" : t.gender === C("TRADE_GENDER_FEMALE") ? "♀" : "";
  game.strings.set(RAM.wStringBuffer1, game.monName(t.request) + gender);
  game.strings.set(RAM.wMonOrItemNameBuffer, game.monName(t.request) + gender);
  game.strings.set(RAM.wStringBuffer2, game.monName(t.offer));
  const show = async (dialog: number) => {
    await game.writeText(text(dialog));
    await game.waitButton();
  };
  if (flags & (1 << index)) return show(C("TRADE_DIALOG_AFTER"));
  await game.writeText(text(C("TRADE_DIALOG_INTRO")));
  if (!(await game.yesNo())) return show(C("TRADE_DIALOG_CANCEL"));
  const { choosePartyMon } = await import("./menu");
  const slot = await choosePartyMon(game, "Trade which POKéMON?");
  if (slot === undefined) return show(C("TRADE_DIALOG_CANCEL"));
  const mon = game.save.party[slot];
  if (mon.egg || mon.species !== t.request) return show(C("TRADE_DIALOG_WRONG"));
  game.save.vars.tradeFlags = flags | (1 << index);
  let received = game.makeMon(t.offer, mon.level);
  received = { ...received, nickname: t.nickname, ot_name: t.otName, ot_id: t.otId, dvs: [t.dvs[0], t.dvs[1]], item: t.item };
  received = { ...received, stats: game.engine.statsFor(received) };
  received.hp = received.stats[0];
  game.save.party[slot] = received as CrystalMon;
  game.register(t.offer, true);
  if (TEXT.NPCTradeCableText !== undefined) await engineText(game, "NPCTradeCableText");
  game.strings.set(RAM.wStringBuffer2, t.nickname);
  if (TEXT.TradedForText !== undefined) await engineText(game, "TradedForText");
  const { evolutionTarget, evolveTo } = await import("./battle");
  const evolves = evolutionTarget(game, received, "trade");
  if (evolves) await evolveTo(game, slot, evolves);
  await show(C("TRADE_DIALOG_COMPLETE"));
}

// ------------------------------------------------------------------ PCs
/**
 * The Pokémon Center PC (engine/events/pokecenter_pc.asm): Bill's PC and the
 * player's, Prof. Oak's once the Pokédex is in hand, and the Hall of Fame
 * after the credits. The player's own PC at home opens the item PC directly.
 */
export async function pokemonCenterPC(game: CrystalGame, home = false) {
  game.sfx("SFX_BOOT_PC");
  await engineText(game, home ? "PlayersPCTurnOnText" : "PokecenterPCTurnOnText", `${game.save.name} turned on the PC.`, false);
  if (home) await game.modal(() => itemPc(game));
  else for (;;) {
    const dex = game.hasFlag("ENGINE_POKEDEX"), fame = dex && game.save.hallOfFame.length > 0;
    const options = ["BILL's PC", `${game.save.name}'s PC`, ...(dex ? ["PROF.OAK's PC"] : []), ...(fame ? ["HALL OF FAME"] : []), "TURN OFF"];
    const pick = await game.choose(options, { cancel: true });
    const choice = pick === undefined ? "TURN OFF" : options[pick];
    if (choice === "BILL's PC") await game.modal(() => storage(game));
    else if (choice === "PROF.OAK's PC") await profOaksPC(game);
    else if (choice === "HALL OF FAME") await game.modal(() => hallOfFameList(game));
    else if (choice.endsWith("'s PC")) await game.modal(() => itemPc(game));
    else break;
  }
  game.sfx("SFX_SHUT_DOWN_PC");
  game.closeText();
}
function storage(game: CrystalGame) {
  if (!game.ctx.layer || !game.ctx.sprite) return Promise.resolve();
  return new Promise<void>(resolve => {
    const state: PcState = {};
    game.closeText();
    // Astra's PC shows Bill's boxes as one collection.
    const roster = { party: game.save.party.filter(m => !m.egg), storage: game.save.boxes.flat() };
    // Eggs stay in the party, in their places, and take up room in it.
    const eggs = game.save.party.map((m, i) => [i, m] as const).filter(([, m]) => m.egg);
    mountStoragePc(game.layer, {
      save: roster as unknown as Save, state, engine: game.engine, sprite: game.ctx.sprite!, itemName: key => itemTitle(key.replace(/_/g, " ")),
      reserved: eggs.length,
      saveTransfer: async next => {
        const party = [...(next.party as CrystalMon[])];
        for (const [i, egg] of eggs) party.splice(Math.min(i, party.length), 0, egg);
        game.save.party = party.slice(0, 6);
        const all = next.storage as CrystalMon[];
        game.save.boxes = Array.from({ length: 14 }, (_, i) => all.slice(i * 20, i * 20 + 20));
        Object.assign(roster, next);
        await game.persist(true);
      },
      onClose: () => resolve(),
    });
  });
}
/** Prof. Oak's PC (engine/events/prof_oaks_pc.asm): rates the Pokédex on request. */
async function profOaksPC(game: CrystalGame) {
  await engineText(game, "OakPCText1", "Want to get your POKéDEX rated?", false);
  if (await game.yesNo()) await profOaksPCBoot(game);
  await engineText(game, "OakPCText4", "The link to PROF.OAK's PC closed.");
}
/** ProfOaksPCBoot: "Current POKéDEX completion level:", then the rating. */
export async function profOaksPCBoot(game: CrystalGame) {
  await engineText(game, "OakPCText2", "Current POKéDEX completion level:");
  await profOaksPCRating(game);
}
/** Rate: the counts, then Oak's words and sound for the number owned (OakRatings). */
export async function profOaksPCRating(game: CrystalGame) {
  const seen = game.save.seen.length, owned = game.save.caught.length;
  game.strings.set(RAM.wStringBuffer3, String(seen));
  game.strings.set(RAM.wStringBuffer4, String(owned));
  await engineText(game, "OakPCText3", `${seen} POKéMON seen, ${owned} POKéMON owned.\fPROF.OAK's Rating:`);
  const table = SYM.OakRatings;
  if (table === undefined) return;
  // FindOakRating: the first entry whose count is at least the number owned.
  let o = table;
  for (let i = 0; i < 32 && game.rom.u8(o) < owned; i++) o += 5;
  const sfx = constName("SFX_", game.rom.u16(o + 1));
  await game.writeText(game.rom.near(o + 3));
  if (sfx) game.sfx(sfx);
  await game.waitButton();
}

async function itemPc(game: CrystalGame) {
  const save = game.save;
  for (;;) {
    const action = await game.choose(["WITHDRAW ITEM", "DEPOSIT ITEM", "TOSS ITEM", "LOG OFF"], { cancel: true });
    if (action === undefined || action === 3) return;
    const from = action === 1 ? save.items : save.pcItems;
    // Crystal Legacy keeps HMs out of the PC, so they can't be left behind.
    const hm = (id: number) => game.legacy && /^HM_/.test(itemConst(id) ?? "");
    const ids = Object.keys(from).map(Number).filter(id => from[id] > 0 && (action !== 1 || game.rom.itemPocket(id) !== C("KEY_ITEM") && !hm(id)));
    if (!ids.length) {
      await game.say(action === 1 ? "There's nothing to deposit." : "There are no items stored.");
      continue;
    }
    const pick = await game.choose(ids.map(id => `${itemTitle(game.rom.itemName(id))} ×${from[id]}`), { cancel: true });
    if (pick === undefined) continue;
    const id = ids[pick];
    // A stack holds 99 at most, in the PC as in the Pack.
    const to = action === 1 ? save.pcItems : action === 0 ? save.items : undefined;
    const room = to ? 99 - (to[id] ?? 0) : from[id];
    if (room <= 0) {
      await game.say(action === 1 ? "There's no more room in the PC." : "There's no more room in the PACK.");
      continue;
    }
    const n = await quantity(game, itemTitle(game.rom.itemName(id)), Math.min(from[id], room));
    if (!n) continue;
    if (action === 0 && !game.giveItem(id, n)) {
      await game.say("There's no more room in the PACK.");
      continue;
    }
    if (action === 1) save.pcItems[id] = (save.pcItems[id] ?? 0) + n;
    from[id] -= n;
    if (!from[id]) delete from[id];
  }
}

// ------------------------------------------------------------------ the Hall of Fame
/** The PC's HALL OF FAME: every induction, the latest first. */
function hallOfFameList(game: CrystalGame) {
  if (!game.ctx.layer || !game.ctx.sprite) return Promise.resolve();
  const entries = game.save.hallOfFame.map((e, i) => ({ ...e, n: i + 1 })).reverse();
  const p = panel(game.layer, "Hall of Fame", entries.map(e => `<h3>No. ${e.n}</h3><ul class="crystal-hof">${e.party.map(m =>
    `<li><img alt="" src="${game.ctx.sprite!(m)}"><span>${escapeHtml(m.nickname || game.monName(m.species))} Lv${m.level}</span></li>`).join("")}</ul>`).join("") +
    `<div class="buttons"><button id="back">Back</button></div>`, "crystal-hof-panel");
  return new Promise<void>(resolve => {
    p.querySelector<HTMLButtonElement>("#back")!.onclick = () => { p.remove(); resolve(); };
  });
}

export async function hallOfFame(game: CrystalGame) {
  game.save.hallOfFame.push({
    party: game.save.party.filter(m => !m.egg).map(m => ({ species: m.species, level: m.level, nickname: m.nickname, dvs: [...m.dvs] })),
    time: Date.now(),
  });
  game.setEvent(C("EVENT_BEAT_ELITE_FOUR"), true);
  game.playMusic(C("MUSIC_HALL_OF_FAME"));
  if (game.ctx.layer && game.ctx.sprite) {
    const p = panel(game.layer, "Hall of Fame", `<p>Congratulations, ${escapeHtml(game.save.name)}! Your POKéMON have entered the HALL OF FAME.</p><ul class="crystal-hof">${game.save.party.filter(m => !m.egg).map(m =>
      `<li><img alt="" src="${game.ctx.sprite!(m)}"><span>${escapeHtml(m.nickname || game.monName(m.species))} Lv${m.level}</span></li>`).join("")}</ul><div class="buttons"><button id="back">Continue</button></div>`, "crystal-hof-panel");
    await new Promise<void>(resolve => { p.querySelector<HTMLButtonElement>("#back")!.onclick = () => resolve(); });
    game.layer.replaceChildren();
  }
  // After the credits, the journey continues in New Bark Town (SPAWN_NEW_BARK); the blackout spot stays as it was.
  game.heal();
  const home = spawnPoint(game, CONST.SPAWN_NEW_BARK ?? 0);
  game.playMusic(undefined);
  await game.warpTo(home.group, home.number, home.x, home.y, "down");
  game.persist(true);
}
