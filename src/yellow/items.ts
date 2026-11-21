import type { Pokemon } from "../engine";
import { useMedicine, MEDICINE } from "../game/medicine";
import { mountParty } from "../ui/party";
import { ITEM } from "./generated/symbols";
import type { YellowGame } from "./runtime";

const KEY_ITEMS = new Set([
  "TOWN_MAP", "BICYCLE", "SURFBOARD", "POKEDEX", "OLD_AMBER", "DOME_FOSSIL", "HELIX_FOSSIL", "SECRET_KEY", "BIKE_VOUCHER",
  "CARD_KEY", "S_S_TICKET", "GOLD_TEETH", "COIN_CASE", "OAKS_PARCEL", "ITEMFINDER", "SILPH_SCOPE", "POKE_FLUTE",
  "LIFT_KEY", "EXP_ALL", "OLD_ROD", "GOOD_ROD", "SUPER_ROD",
]);
const name = (id: number) => Object.keys(ITEM).find(k => ITEM[k] === id) ?? "";

/** Gen 1 item id -> Crystal item id, matched by name without accents or punctuation ("POKé BALL" is "POKE BALL" in Crystal). */
export function crystalItemMap(engine: { itemName(id: number): string }, rom: { itemName(id: number): string }) {
  const norm = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const byName = new Map<string, number>();
  for (let i = 1; i < 256; i++) {
    try { byName.set(norm(engine.itemName(i)), i); } catch { /* unused id */ }
  }
  const map = new Map<number, number>();
  for (let i = 1; i <= 0x53; i++) {
    const crystal = byName.get(norm(rom.itemName(i)));
    if (crystal) map.set(i, crystal);
  }
  return map;
}

export function itemPocket(id: number) {
  const n = name(id);
  if (id >= 1 && id <= 4 || n === "SAFARI_BALL") return "balls";
  if (KEY_ITEMS.has(n) || id >= 0xc4 && id <= 0xc8) return "key";
  return "items";
}

const MEDICINE_KEYS: Record<string, keyof typeof MEDICINE> = {
  POTION: "potion", SUPER_POTION: "super_potion", HYPER_POTION: "hyper_potion", FULL_RESTORE: "full_restore",
  REVIVE: "revive", ANTIDOTE: "antidote", PARLYZ_HEAL: "parlyz_heal", AWAKENING: "awakening", BURN_HEAL: "burn_heal",
  ICE_HEAL: "ice_heal", FULL_HEAL: "full_heal", ETHER: "ether", MAX_ELIXER: "max_elixer",
};
const HEALS: Record<string, number> = { MAX_POTION: 9999, FRESH_WATER: 50, SODA_POP: 60, LEMONADE: 80 };

export function itemDescription(game: YellowGame, id: number): string | undefined {
  const n = name(id);
  if (MEDICINE_KEYS[n]) return MEDICINE[MEDICINE_KEYS[n]].description;
  if (HEALS[n]) return n === "MAX_POTION" ? "Fully restores the HP of one Pokémon." : `Restores ${HEALS[n]} HP to one Pokémon.`;
  if (/REPEL/.test(n)) return "Keeps weak wild Pokémon away for a while.";
  if (/STONE/.test(n)) return "Evolves certain kinds of Pokémon.";
  if (n === "ESCAPE_ROPE") return "Leads you out of a cave or dungeon to the last Pokémon Center.";
  if (n === "BICYCLE") return "Ride twice as fast as walking.";
  if (id >= 0xc4) {
    const move = game.rom.u8(game.rom.sym("TechnicalMachines") + id - 0xc4);
    return move ? `Teaches ${game.engine.move(move).name}.` : undefined;
  }
}

function pickPartyMember(game: YellowGame, title: string, usable: (mon: Pokemon) => boolean): Promise<number | undefined> {
  return new Promise(resolve => {
    game.layer.replaceChildren();
    mountParty(game.layer, {
      title, confirm: "Use",
      rows: game.save.party.map(mon => ({
        name: mon.nickname || game.engine.species(mon.species).name, sprite: game.ctx.sprite(mon), level: mon.level,
        status: mon.status, hp: mon.hp, maxHp: mon.stats[0], disabled: !usable(mon),
      })),
      onSelect: slot => resolve(slot),
      onBack: () => resolve(undefined),
    });
  });
}

/** Uses an item from the Bag outside battle. Returns a message, "close" to leave the menu, or nothing. */
export async function useYellowItem(game: YellowGame, id: number): Promise<string | "close" | (() => Promise<void>) | undefined> {
  const n = name(id), save = game.save, engine = game.engine;
  const consume = () => {
    save.items[id]--;
    if (!save.items[id]) delete save.items[id];
  };
  if (MEDICINE_KEYS[n] || HEALS[n] || n === "MAX_REVIVE" || n === "MAX_ETHER" || n === "ELIXER") {
    const apply = (mon: Pokemon): Pokemon | undefined => {
      if (MEDICINE_KEYS[n]) return useMedicine(MEDICINE_KEYS[n], mon, engine, n === "ETHER" ? mon.pp.findIndex((p, i) => mon.moves[i] && (p & 63) < (engine.healPokemon(mon).pp[i] & 63)) : undefined);
      const max = mon.stats[0];
      if (HEALS[n]) return mon.hp > 0 && mon.hp < max ? { ...mon, hp: Math.min(max, mon.hp + HEALS[n]) } : undefined;
      if (n === "MAX_REVIVE") return mon.hp === 0 ? { ...mon, hp: max, status: 0 } : undefined;
      const full = engine.healPokemon(mon).pp;
      const pp = mon.pp.map((p, i) => !mon.moves[i] ? p : n === "MAX_ETHER" && i !== mon.pp.findIndex((q, j) => mon.moves[j] && (q & 63) < (full[j] & 63)) ? p : n === "MAX_ETHER" ? full[i] : (p & 192) | Math.min(full[i] & 63, (p & 63) + 10));
      return pp.some((v, i) => v !== mon.pp[i]) ? { ...mon, pp } : undefined;
    };
    const slot = await pickPartyMember(game, game.rom.itemName(id), mon => !!apply(mon));
    if (slot === undefined) return;
    const result = apply(save.party[slot]);
    if (!result) return "It won't have any effect.";
    save.party[slot] = result;
    consume();
    game.ctx.sound.heal();
    return `${result.nickname || engine.species(result.species).name} was restored.`;
  }
  if (n === "REPEL" || n === "SUPER_REPEL" || n === "MAX_REPEL") {
    save.repel = n === "REPEL" ? 100 : n === "SUPER_REPEL" ? 200 : 250;
    consume();
    return `${save.name} used ${game.rom.itemName(id)}.`;
  }
  if (n === "BICYCLE") {
    if (game.save.surfing) return "No cycling while surfing!";
    const indoors = game.map >= 0x25 && !game.rom.mapName(game.map).includes("ROAD");
    if (!save.bike && indoors) return "This isn't the time to use that!";
    save.bike = !save.bike;
    game.ctx.sound.refreshMusic();
    return "close";
  }
  if (n === "ESCAPE_ROPE") {
    const { escapeRope, canEscape } = await import("./services");
    if (!canEscape(game)) return "This isn't the time to use that!";
    consume();
    return async () => { await escapeRope(game); };
  }
  if (/_STONE$/.test(n)) {
    const crystal = game.crystalItem(id);
    const target = (mon: Pokemon) => engine.evolutionData(mon.species).evolutions.find(e => e.method === 2 && e.parameter === crystal && e.species <= 151);
    const slot = await pickPartyMember(game, game.rom.itemName(id), mon => !!target(mon));
    if (slot === undefined) return;
    const evo = target(save.party[slot]);
    if (!evo) return "It won't have any effect.";
    consume();
    const { evolveTo } = await import("./evolution");
    await evolveTo(game, slot, evo.species);
    return;
  }
  if (n === "OLD_ROD" || n === "GOOD_ROD" || n === "SUPER_ROD") {
    const { fish } = await import("./services");
    return () => fish(game, n);
  }
  if (n === "TOWN_MAP") return `You are in ${game.summary().place}.`;
  if (n === "COIN_CASE") return `Coins: ${save.coins}`;
  if (n === "ITEMFINDER") {
    const { itemfinder } = await import("./services");
    return itemfinder(game);
  }
  if (n === "POKE_FLUTE") {
    const { pokeFlute } = await import("./services");
    return async () => {
      const message = await pokeFlute(game);
      if (message !== "close") await game.say(message);
    };
  }
  if (id >= 0xc4) {
    const { teachMachine } = await import("./services");
    return teachMachine(game, id);
  }
  return "This isn't the time to use that!";
}
