import type { Engine, Pokemon } from "../engine";

export const MEDICINE = {
  potion: { id: 18, name: "Potion", price: 300, badges: 0, hp: 20, description: "Restores 20 HP to one Pokémon." },
  super_potion: { id: 17, name: "Super Potion", price: 700, badges: 2, hp: 50, description: "Restores 50 HP to one Pokémon." },
  hyper_potion: { id: 16, name: "Hyper Potion", price: 1200, badges: 5, hp: 200, description: "Restores up to 200 HP to one Pokémon." },
  full_restore: { id: 14, name: "Full Restore", price: 3000, badges: 8, description: "Fully restores HP and cures a Pokémon’s status condition." },
  revive: { id: 39, name: "Revive", price: 1500, badges: 4, description: "Revives a fainted Pokémon with half its maximum HP." },
  antidote: { id: 9, name: "Antidote", price: 100, badges: 0, status: 8, description: "Cures one Pokémon of poisoning." },
  parlyz_heal: { id: 13, name: "Parlyz Heal", price: 200, badges: 0, status: 64, description: "Cures paralysis so a Pokémon can move freely." },
  awakening: { id: 12, name: "Awakening", price: 250, badges: 0, status: 7, description: "Wakes a sleeping Pokémon." },
  burn_heal: { id: 10, name: "Burn Heal", price: 250, badges: 0, status: 16, description: "Heals a Pokémon’s burn." },
  ice_heal: { id: 11, name: "Ice Heal", price: 250, badges: 0, status: 32, description: "Thaws a frozen Pokémon." },
  full_heal: { id: 38, name: "Full Heal", price: 600, badges: 3, status: 255, description: "Cures any status condition on one Pokémon." },
  ether: { id: 63, name: "Ether", price: 600, badges: 2, description: "Restores up to 10 PP to one move of your choice." },
  max_elixer: { id: 21, name: "Max Elixer", price: 2000, badges: 8, description: "Fully restores PP for all of a Pokémon’s moves." },
} as const;

export function isMedicine(key: string): key is keyof typeof MEDICINE {
  return Object.hasOwn(MEDICINE, key);
}

export function useMedicine(
  key: keyof typeof MEDICINE,
  mon: Pokemon,
  engine: Pick<Engine, "healPokemon">,
  slot?: number,
): Pokemon | undefined {
  const max = mon.stats[0], medicine = MEDICINE[key];
  if (key === "ether" || key === "max_elixer") {
    const full = engine.healPokemon(mon).pp;
    const pp = mon.pp.map((value, i) => {
      if (!mon.moves[i] || (value & 63) >= (full[i] & 63)) return value;
      if (key === "max_elixer") return full[i];
      return slot === i ? (value & 192) | Math.min(full[i] & 63, (value & 63) + 10) : value;
    });
    return pp.some((value, i) => value !== mon.pp[i]) ? { ...mon, pp } : undefined;
  }
  if (key === "revive")
    return mon.hp === 0 ? { ...mon, hp: Math.max(1, Math.floor(max / 2)), status: 0 } : undefined;
  if (mon.hp === 0) return;
  if ("status" in medicine) return (mon.status & medicine.status) ? { ...mon, status: 0 } : undefined;
  if (key === "full_restore") return mon.hp < max || mon.status ? { ...mon, hp: max, status: 0 } : undefined;
  if ("hp" in medicine && mon.hp < max) return { ...mon, hp: Math.min(max, mon.hp + medicine.hp) };
}
