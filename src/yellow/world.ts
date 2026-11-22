import { MAP, SYM, TILESET } from "./symbols";
import type { MapHeader, Tileset, YellowRom } from "./rom";

export type Facing = "down" | "up" | "left" | "right";
export const STEP: Record<Facing, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
/** Gen 1 sprite facing values ($0 down, $4 up, $8 left, $C right). */
export const FACING_CODE: Record<Facing, number> = { down: 0, up: 4, left: 8, right: 12 };
export const opposite = (f: Facing): Facing => ({ down: "up", up: "down", left: "right", right: "left" } as const)[f];

export interface Place { map: number; x: number; y: number }

/** Collision and terrain queries over the cartridge's maps, in 16×16 step squares. */
export class YellowWorld {
  readonly ledges: { facing: number; from: number; ledge: number }[];
  readonly pairs: { tileset: number; a: number; b: number }[];
  readonly waterPairs: { tileset: number; a: number; b: number }[];
  readonly waterTilesets = new Set<number>();
  readonly shoreTiles: number[] = [];
  readonly carpet: Record<Facing, Set<number>>;

  constructor(readonly rom: YellowRom) {
    this.ledges = rom.ledges();
    this.pairs = rom.tilePairs();
    this.waterPairs = [];
    for (let o = SYM.TilePairCollisionsWater; rom.u8(o) !== 0xff; o += 3)
      this.waterPairs.push({ tileset: rom.u8(o), a: rom.u8(o + 1), b: rom.u8(o + 2) });
    for (let o = SYM.WaterTilesets; rom.u8(o) !== 0xff; o++) this.waterTilesets.add(rom.u8(o));
    for (let o = SYM.ShoreTiles; rom.u8(o) !== 0xff; o++) this.shoreTiles.push(rom.u8(o));
    const list = (i: number) => {
      const set = new Set<number>(), bank = rom.bankOf(SYM.WarpTileListPointers);
      for (let o = rom.far(bank, rom.u16(SYM.WarpTileListPointers + i * 2)); rom.u8(o) !== 0xff; o++) set.add(rom.u8(o));
      return set;
    };
    this.carpet = { down: list(0), up: list(1), left: list(2), right: list(3) };
  }

  map(id: number): MapHeader {
    const m = this.rom.map(id);
    if (!m) throw Error(`No Yellow map ${id}`);
    return m;
  }
  tileset(map: MapHeader): Tileset { return this.rom.tileset(map.tileset); }
  cells(map: MapHeader) { return { w: map.width * 2, h: map.height * 2 }; }

  /** Moves a position across a map connection when it lies past an edge. */
  resolve(map: MapHeader, x: number, y: number): Place | undefined {
    const { w, h } = this.cells(map);
    if (x >= 0 && y >= 0 && x < w && y < h) return { map: map.id, x, y };
    for (const c of map.connections) {
      const target = this.map(c.map), t = this.cells(target);
      if (c.dir === "north" && y < 0 && x >= 0 && x < w) {
        const tx = x - c.offset * 2;
        if (tx >= 0 && tx < t.w) return { map: c.map, x: tx, y: t.h + y };
      } else if (c.dir === "south" && y >= h && x >= 0 && x < w) {
        const tx = x - c.offset * 2;
        if (tx >= 0 && tx < t.w) return { map: c.map, x: tx, y: y - h };
      } else if (c.dir === "west" && x < 0 && y >= 0 && y < h) {
        const ty = y - c.offset * 2;
        if (ty >= 0 && ty < t.h) return { map: c.map, x: t.w + x, y: ty };
      } else if (c.dir === "east" && x >= w && y >= 0 && y < h) {
        const ty = y - c.offset * 2;
        if (ty >= 0 && ty < t.h) return { map: c.map, x: x - w, y: ty };
      }
    }
    return undefined;
  }

  /** The collision tile of a square, looking through connections and the border. */
  tile(map: MapHeader, x: number, y: number) {
    const place = this.resolve(map, x, y);
    if (place) return this.rom.tileAt(place.map === map.id ? map : this.map(place.map), place.x, place.y);
    return this.rom.tileAt(map, x, y);
  }
  passable(map: MapHeader, x: number, y: number) {
    const place = this.resolve(map, x, y);
    const target = place ? this.map(place.map) : map;
    return this.tileset(target).passable.has(this.tile(map, x, y));
  }
  isGrass(map: MapHeader, x: number, y: number) {
    const grass = this.tileset(map).grass;
    return grass !== undefined && this.rom.tileAt(map, x, y) === grass;
  }
  /** Surfable water ahead, including shore tiles where the tileset allows it. */
  isWater(map: MapHeader, x: number, y: number) {
    if (!this.waterTilesets.has(map.tileset)) return false;
    const tile = this.tile(map, x, y);
    const skipShore = [TILESET.SHIP_PORT, TILESET.GYM, TILESET.DOJO].includes(map.tileset);
    return tile === 0x14 || (!skipShore && this.shoreTiles.includes(tile));
  }
  /** Whether an elevation edge separates two squares (cave ledges, forest edges). */
  pairBlocked(map: MapHeader, from: number, to: number, surfing = false) {
    return (surfing ? this.waterPairs : this.pairs).some(p => p.tileset === map.tileset &&
      ((p.a === from && p.b === to) || (p.a === to && p.b === from)));
  }
  /** A ledge the player hops over when walking in this direction. */
  ledge(map: MapHeader, x: number, y: number, facing: Facing) {
    if (map.tileset !== TILESET.OVERWORLD) return false;
    const [dx, dy] = STEP[facing];
    const from = this.tile(map, x, y), ahead = this.tile(map, x + dx, y + dy);
    return this.ledges.some(l => l.facing === FACING_CODE[facing] && l.from === from && l.ledge === ahead);
  }
  warpAt(map: MapHeader, x: number, y: number) {
    return map.warps.findIndex(w => w.x === x && w.y === y);
  }
  /** Doors, stairs and holes warp as soon as the player steps on them. */
  instantWarp(map: MapHeader, x: number, y: number) {
    const t = this.tileset(map), tile = this.rom.tileAt(map, x, y);
    return t.doorTiles.has(tile) || t.warpTiles.has(tile);
  }
  door(map: MapHeader, x: number, y: number) {
    return this.tileset(map).doorTiles.has(this.rom.tileAt(map, x, y));
  }
  /** Mats and carpets warp when the player keeps walking into the edge beyond them. */
  edgeWarp(map: MapHeader, x: number, y: number, facing: Facing) {
    const { w, h } = this.cells(map);
    const carpet = map.id !== MAP.SS_ANNE_3F && (
      [MAP.ROCKET_HIDEOUT_B1F, MAP.ROCKET_HIDEOUT_B2F, MAP.ROCKET_HIDEOUT_B4F, MAP.ROCK_TUNNEL_1F].includes(map.id) ||
      [TILESET.OVERWORLD, TILESET.SHIP, TILESET.SHIP_PORT, TILESET.PLATEAU].includes(map.tileset));
    if (!carpet)
      return (facing === "down" && y === h - 1) || (facing === "up" && y === 0) || (facing === "left" && x === 0) || (facing === "right" && x === w - 1);
    const [dx, dy] = STEP[facing];
    if (map.id === MAP.SS_ANNE_BOW) return this.tile(map, x + dx, y + dy) === 0x15;
    return this.carpet[facing].has(this.tile(map, x + dx, y + dy));
  }
  /** Counter tiles let the player talk across a shop or center desk. */
  counter(map: MapHeader, x: number, y: number) {
    return this.tileset(map).counters.includes(this.tile(map, x, y));
  }
}
