import { bagKeyForItem } from "../game/items";
import "./ball-sprite.css";

const shells = new Set(["poke_ball", "great_ball", "ultra_ball", "master_ball", "safari_ball"]);

/** Field inventories use item keys. Battle bags and throw events use Crystal IDs. */
export function ballSprite(item: string | number) {
  const key = typeof item === "number" || /^\d+$/.test(item) ? bagKeyForItem(Number(item)) : item;
  return shells.has(key) ? `<span class="ball-sprite" data-ball="${key}" aria-hidden="true"></span>` : "";
}
