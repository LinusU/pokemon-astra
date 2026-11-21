/**
 * How each Yellow tileset is drawn with Pokémon Crystal's graphics.
 *
 * Crystal rebuilt Kanto from Yellow's art: its Kanto tileset keeps the same
 * tile numbers as Yellow's overworld, redrawn and colored tile by tile. The
 * other tilesets were reorganized, so their tiles are listed one by one.
 * Only numbers live here; every pixel and color is read from the player's
 * own Crystal cartridge.
 */

/** Crystal background palette slots, as in Crystal's tileset palette maps. */
export const SLOT = { GRAY: 0, RED: 1, GREEN: 2, WATER: 3, YELLOW: 4, BROWN: 5, ROOF: 6, TEXT: 7 } as const;

/**
 * One Yellow tile drawn as:
 * - a Crystal tile id in the look's own Crystal tileset,
 * - a tile from another Crystal tileset, as `[tileset, id]`,
 * - or the Yellow tile itself, colored with a Crystal palette slot, as `{ keep: slot }`.
 */
export type CrystalTile = number | [string, number] | { keep: number };

export interface CrystalLook {
  /** The Crystal tileset (a `CRYSTAL_TILESET` name) that supplies tiles and palettes. */
  tileset: string;
  /**
   * Crystal's background colors: `outdoor` follows the map's roof colors,
   * `indoor` and `dungeon` are Crystal's building and cave sets, and
   * `house` / `mansion` are its special house and Celadon Mansion palettes.
   */
  colors: "outdoor" | "indoor" | "dungeon" | "house" | "mansion";
  /** Unlisted tiles use the Crystal tile with the same number. */
  identity?: boolean;
  /** Yellow tile id → Crystal tile. */
  tiles?: Record<number, CrystalTile>;
  /** Whole Yellow blocks redrawn from 16 Crystal tiles, row by row. */
  blocks?: Record<number, CrystalTile[]>;
}

/** Keyed by Yellow `TILESET` name. Tilesets without an entry keep Yellow's own look. */
export const CRYSTAL_LOOKS: Record<string, CrystalLook> = {
  OVERWORLD: { tileset: "KANTO", colors: "outdoor", identity: true },
};
