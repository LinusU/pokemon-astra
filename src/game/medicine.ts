import type { Engine, Pokemon } from "../engine";

export const MEDICINE = {
  potion: { id: 18, name: "Potion", price: 300, badges: 0 },
  super_potion: { id: 17, name: "Super Potion", price: 700, badges: 2 },
  hyper_potion: { id: 16, name: "Hyper Potion", price: 1200, badges: 5 },
  full_restore: { id: 14, name: "Full Restore", price: 3000, badges: 8 },
  revive: { id: 39, name: "Revive", price: 1500, badges: 4 },
  max_elixer: { id: 21, name: "Max Elixer", price: 2000, badges: 8 },
} as const;

export function isMedicine(key: string): key is keyof typeof MEDICINE {
  return Object.prototype.hasOwnProperty.call(MEDICINE, key);
}

export function useMedicine(
  key: keyof typeof MEDICINE,
  mon: Pokemon,
  engine: Pick<Engine, "healPokemon">,
): Pokemon | undefined {
  const max = mon.stats[0];
  if (key === "revive")
    return mon.hp === 0
      ? { ...mon, hp: Math.max(1, Math.floor(max / 2)), status: 0 }
      : undefined;
  if (mon.hp === 0) return undefined;
  if (key === "max_elixer") {
    const { pp } = engine.healPokemon(mon);
    return pp.some((value, i) => value !== mon.pp[i]) ? { ...mon, pp } : undefined;
  }
  if (key === "full_restore")
    return mon.hp < max || mon.status !== 0
      ? { ...mon, hp: max, status: 0 }
      : undefined;
  if (mon.hp >= max) return undefined;
  const recovery = { potion: 20, super_potion: 50, hyper_potion: 200 };
  return { ...mon, hp: Math.min(max, mon.hp + recovery[key]) };
}
