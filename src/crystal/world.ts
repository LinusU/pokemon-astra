/**
 * Johto and Kanto as squares: Crystal's 16×16-pixel movement grid, two
 * squares to a block, with each square's collision from its tileset.
 */
import { C } from "./symbols";
import type { CrystalMap, CrystalRom, Dir, Tileset } from "./rom";

export type Facing = "down" | "up" | "left" | "right";
export const STEP: Record<Facing, [number, number]> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
export const opposite = (f: Facing): Facing => ({ down: "up", up: "down", left: "right", right: "left" } as const)[f];
/** Crystal's facing values (DOWN 0, UP 1, LEFT 2, RIGHT 3). */
export const FACINGS: Facing[] = ["down", "up", "left", "right"];

/** A map as the runtime plays it: a private copy of its blocks for scripts to change. */
export interface LiveMap extends CrystalMap {
  live: Uint8Array;
  version: number;
}

const HOPS: Record<string, Facing> = {
  COLL_HOP_RIGHT: "right", COLL_HOP_LEFT: "left", COLL_HOP_UP: "up", COLL_HOP_DOWN: "down",
  COLL_HOP_DOWN_RIGHT: "down", COLL_HOP_DOWN_LEFT: "down", COLL_HOP_UP_RIGHT: "up", COLL_HOP_UP_LEFT: "up",
};
const SIDE: Record<string, Facing[]> = {
  // The side of the square that can't be crossed.
  RIGHT: ["right"], LEFT: ["left"], UP: ["up"], DOWN: ["down"],
  DOWN_RIGHT: ["down", "right"], DOWN_LEFT: ["down", "left"], UP_RIGHT: ["up", "right"], UP_LEFT: ["up", "left"],
};

export class CrystalWorld {
  private tilesets = new Map<number, Tileset>();
  private named = new Map<string, number>();
  constructor(readonly rom: CrystalRom) {}

  /** A collision constant's value (cached by name). */
  c(name: string) {
    let v = this.named.get(name);
    if (v === undefined) this.named.set(name, v = C(name));
    return v;
  }
  tileset(id: number) {
    let t = this.tilesets.get(id);
    if (!t) this.tilesets.set(id, t = this.rom.tileset(id));
    return t;
  }
  live(map: CrystalMap): LiveMap {
    return { ...map, live: map.blocks.slice(), version: 0 };
  }

  size(map: CrystalMap) {
    return { w: map.width * 2, h: map.height * 2 };
  }
  inside(map: CrystalMap, x: number, y: number) {
    return x >= 0 && y >= 0 && x < map.width * 2 && y < map.height * 2;
  }
  block(map: LiveMap, bx: number, by: number) {
    if (bx < 0 || by < 0 || bx >= map.width || by >= map.height) return map.border;
    return map.live[by * map.width + bx];
  }
  /** The collision id of a square, or COLL_WALL outside the map. */
  collision(map: LiveMap, x: number, y: number) {
    if (!this.inside(map, x, y)) return this.c("COLL_WALL");
    const block = this.block(map, x >> 1, y >> 1);
    return this.rom.blockCollision(this.tileset(map.tileset), block)[(y & 1) * 2 + (x & 1)];
  }
  /** The map and square across a connection, for a square just outside `map`. */
  across(map: CrystalMap, x: number, y: number): { dir: Dir; group: number; number: number; x: number; y: number } | undefined {
    const { w, h } = this.size(map);
    const dir: Dir | undefined = y < 0 ? "north" : y >= h ? "south" : x < 0 ? "west" : x >= w ? "east" : undefined;
    if (!dir) return undefined;
    const conn = map.connections.find(c => c.dir === dir);
    if (!conn) return undefined;
    const target = this.rom.mapHeader(conn.group, conn.number);
    const t = this.size(target);
    if (dir === "north") return { dir, group: conn.group, number: conn.number, x: x + conn.delta, y: y + t.h };
    if (dir === "south") return { dir, group: conn.group, number: conn.number, x: x + conn.delta, y: y - h };
    if (dir === "west") return { dir, group: conn.group, number: conn.number, x: x + t.w, y: y + conn.delta };
    return { dir, group: conn.group, number: conn.number, x: x - w, y: y + conn.delta };
  }
  /** Where a connected map is drawn, in squares from this map's origin. */
  connectionOrigin(map: CrystalMap, dir: Dir) {
    const conn = map.connections.find(c => c.dir === dir)!;
    const target = this.rom.mapHeader(conn.group, conn.number), t = this.size(target), { w, h } = this.size(map);
    if (dir === "north") return { x: -conn.delta, y: -t.h, target };
    if (dir === "south") return { x: -conn.delta, y: h, target };
    if (dir === "west") return { x: -t.w, y: -conn.delta, target };
    return { x: w, y: -conn.delta, target };
  }

  private is(coll: number, ...names: string[]) {
    return names.some(n => this.c(n) === coll);
  }
  permission(coll: number) {
    return this.rom.permission(coll) & 0x0f;
  }
  isWater(coll: number) {
    return this.permission(coll) === this.c("WATER_TILE");
  }
  isLand(coll: number) {
    return this.permission(coll) === this.c("LAND_TILE");
  }
  /** Grass and the other squares where wild Pokémon appear outdoors. */
  isGrass(coll: number) {
    return this.is(coll, "COLL_CUT_08", "COLL_TALL_GRASS", "COLL_LONG_GRASS", "COLL_CUT_28", "COLL_WATER", "COLL_GRASS_48", "COLL_GRASS_49", "COLL_GRASS_4A", "COLL_GRASS_4B", "COLL_GRASS_4C");
  }
  /** Tall grass that hides the lower half of a person, as Crystal draws it. */
  isTallGrass(coll: number) {
    return this.is(coll, "COLL_TALL_GRASS", "COLL_LONG_GRASS");
  }
  isIce(coll: number) {
    return this.is(coll, "COLL_ICE", "COLL_ICE_2B");
  }
  isWarp(coll: number) {
    return this.is(coll, "COLL_PIT", "COLL_PIT_68") || (coll & 0xf0) === this.c("HI_NYBBLE_WARPS");
  }
  isPit(coll: number) {
    return this.is(coll, "COLL_PIT", "COLL_PIT_68");
  }
  isDoor(coll: number) {
    return this.is(coll, "COLL_DOOR", "COLL_DOOR_79", "COLL_DOOR_75", "COLL_DOOR_7D");
  }
  /** The direction a warp carpet leads out, or undefined for a warp that triggers on arrival. */
  carpet(coll: number): Facing | undefined {
    if (coll === this.c("COLL_WARP_CARPET_DOWN")) return "down";
    if (coll === this.c("COLL_WARP_CARPET_UP")) return "up";
    if (coll === this.c("COLL_WARP_CARPET_LEFT")) return "left";
    if (coll === this.c("COLL_WARP_CARPET_RIGHT")) return "right";
    return undefined;
  }
  /** The direction a ledge can be jumped. */
  ledge(coll: number): Facing | undefined {
    if ((coll & 0xf0) !== this.c("HI_NYBBLE_LEDGES")) return undefined;
    for (const [name, dir] of Object.entries(HOPS)) if (this.c(name) === coll) return dir;
    return undefined;
  }
  /** A ledge square jumped from `dir`: down-right ledges also take a step down from the left. */
  canHop(coll: number, dir: Facing) {
    const ledge = this.ledge(coll);
    if (!ledge) return false;
    if (ledge === dir) return true;
    const name = Object.entries(HOPS).find(([n]) => this.c(n) === coll)?.[0] ?? "";
    return (dir === "right" && /RIGHT/.test(name)) || (dir === "left" && /LEFT/.test(name)) || (dir === "down" && /DOWN/.test(name)) || (dir === "up" && /_UP/.test(name));
  }
  /** One-way walls and buoys: the sides of a square that block. */
  sides(coll: number): Facing[] {
    const hi = coll & 0xf0;
    if (hi !== this.c("HI_NYBBLE_SIDE_WALLS") && hi !== this.c("HI_NYBBLE_SIDE_BUOYS")) return [];
    const kind = hi === this.c("HI_NYBBLE_SIDE_WALLS") ? "WALL" : "BUOY";
    for (const [side, dirs] of Object.entries(SIDE)) {
      const name = `COLL_${side}_${kind}`;
      try {
        if (this.c(name) === coll) return dirs;
      } catch { /* not every version names every side */ }
    }
    return [];
  }
  /** Whether moving from (x, y) in `dir` crosses a blocking side. */
  sideBlocked(map: LiveMap, x: number, y: number, dir: Facing) {
    const [dx, dy] = STEP[dir];
    if (this.sides(this.collision(map, x, y)).includes(dir)) return true;
    return this.sides(this.collision(map, x + dx, y + dy)).includes(opposite(dir));
  }
  /** Waterfalls, currents and spinners that push the player along. */
  current(coll: number): Facing | undefined {
    const map: Record<string, Facing> = {
      COLL_WATERFALL: "down", COLL_CURRENT_RIGHT: "right", COLL_CURRENT_LEFT: "left", COLL_CURRENT_UP: "up", COLL_CURRENT_DOWN: "down",
      COLL_WALK_RIGHT: "right", COLL_WALK_LEFT: "left", COLL_WALK_UP: "up", COLL_WALK_DOWN: "down",
      COLL_WALK_RIGHT_ALT: "right", COLL_WALK_LEFT_ALT: "left", COLL_WALK_UP_ALT: "up", COLL_WALK_DOWN_ALT: "down",
    };
    for (const [name, dir] of Object.entries(map)) if (this.c(name) === coll) return dir;
    return undefined;
  }
  isBrake(coll: number) {
    return this.is(coll, "COLL_BRAKE", "COLL_BRAKE_ALT", "COLL_BRAKE_45", "COLL_BRAKE_46", "COLL_BRAKE_47", "COLL_BRAKE_55", "COLL_BRAKE_56", "COLL_BRAKE_57");
  }
  isWaterfall(coll: number) {
    return this.is(coll, "COLL_WATERFALL", "COLL_WATERFALL_RIGHT", "COLL_WATERFALL_LEFT", "COLL_WATERFALL_UP");
  }
  isWhirlpool(coll: number) {
    return this.is(coll, "COLL_WHIRLPOOL", "COLL_WHIRLPOOL_2C");
  }
  isCutTree(coll: number) {
    return this.is(coll, "COLL_CUT_TREE", "COLL_CUT_TREE_1A");
  }
  isHeadbuttTree(coll: number) {
    return this.is(coll, "COLL_HEADBUTT_TREE", "COLL_HEADBUTT_TREE_1D");
  }
  isCounter(coll: number) {
    return this.is(coll, "COLL_COUNTER", "COLL_COUNTER_98");
  }
  /** The warp event index (0-based) at a square, or -1. */
  warpAt(map: CrystalMap, x: number, y: number) {
    return map.warps.findIndex(w => w.x === x && w.y === y);
  }
}
