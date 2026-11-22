import { SYM } from "./symbols";
import type { YellowGame } from "./runtime";

/** In-game trades, read from the cartridge's TradeMons table (14 bytes each). */
export function tradeEntry(game: YellowGame, index: number) {
  const o = SYM.TradeMons + index * 14, rom = game.rom;
  return { give: rom.u8(o), get: rom.u8(o + 1), dialog: rom.u8(o + 2), nickname: rom.string(o + 3, 11) };
}

export async function inGameTrade(game: YellowGame, index: number) {
  const trade = tradeEntry(game, index), set = trade.dialog + 1;
  const giveName = game.rom.monName(trade.give), getName = game.rom.monName(trade.get);
  game.textVar("wInGameTradeGiveMonName", giveName);
  game.textVar("wInGameTradeReceiveMonName", getName);
  const key = `trade:${index}`;
  if (game.save.vars[key]) return game.text(`_AfterTrade${set}Text`);
  await game.text(`_WannaTrade${set}Text`, { wait: false });
  if (!(await game.yesNo())) return game.text(`_NoTrade${set}Text`);
  const giveDex = game.rom.dex(trade.give);
  const slot = await game.choosePartyMon(`Trade for ${getName}`, mon => mon.species === giveDex);
  const mon = slot === undefined ? undefined : game.save.party[slot];
  if (!mon || mon.species !== giveDex) return game.text(`_WrongMon${set}Text`);
  const received = game.makeMon(game.rom.dex(trade.get), mon.level, trade.nickname);
  received.ot_name = "TRAINER";
  received.ot_id = (game.otId() + 1 + index * 7919) & 0xffff;
  game.textVar("wNameOfPlayerMonToBeTraded", mon.nickname || giveName);
  game.save.party[slot!] = received;
  game.register(received.species, true);
  game.save.vars[key] = 1;
  game.sfx("SFX_GET_ITEM_1");
  await game.text("_TradedForText");
  await game.text(`_Thanks${set}Text`);
}
