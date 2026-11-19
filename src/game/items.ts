import { MEDICINE } from "./medicine";

export const ballIds: Record<string, number> = {
  master_ball: 1, ultra_ball: 2, great_ball: 4, poke_ball: 5,
};
export const stoneIds: Record<string, number> = {
  moon_stone: 8, fire_stone: 22, thunder_stone: 23, water_stone: 24, leaf_stone: 34, sun_stone: 169,
};
const heldIds: Record<string, number> = {
  exp_share: 57, kings_rock: 82, metal_coat: 143, dragon_scale: 151, up_grade: 172,
};
const known: Record<string, number> = {
  ...ballIds, ...stoneIds, ...heldIds, repel: 20,
  ...Object.fromEntries(Object.entries(MEDICINE).map(([key, item]) => [key, item.id])),
};
const keys = new Map(Object.entries(known).map(([key, id]) => [id, key]));

export function bagKeyForItem(id: number) {
  return keys.get(id) ?? `held_${id}`;
}
export function nativeItemId(key: string): number | undefined {
  if (Object.hasOwn(known, key)) return known[key];
  const match = /^held_([1-9]\d{0,2})$/.exec(key);
  if (match && +match[1] <= 255) return +match[1];
}
export function giveFromBag(key: string) {
  return Object.hasOwn(heldIds, key) || (key.startsWith("held_") && nativeItemId(key) !== undefined);
}
