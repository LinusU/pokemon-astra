/**
 * Reads Pokémon Yellow's map, text, object, trainer and encounter data from the
 * player's own cartridge. Offsets come from the pret disassembly's symbol file
 * (see scripts/yellow-symbols.mjs); the data itself is never bundled.
 */
import { YELLOW_SHA1 } from "./generated/symbols";
import { MAP_LABELS, SYM, type Cartridge } from "./symbols";

export class UnsupportedYellowCartridge extends Error {}

/**
 * Yellow Legacy V1.0.10 (github.com/cRz-Shadows/Pokemon_Yellow_Legacy): the
 * official patch applied to the English Pokémon Yellow. Its symbol table is
 * generated from a build of the tag, the same ROM.
 */
export const LEGACY_SHA1 = "2ac87de42afc70ef6016805acb3b206644417f97";
const CARTRIDGES: Record<Cartridge, { sha1: string; size: number }> = {
  yellow: { sha1: YELLOW_SHA1, size: 0x100000 },
  legacy: { sha1: LEGACY_SHA1, size: 0x200000 },
};

async function sha1(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-1", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/** Which supported cartridge `bytes` is, if any. */
export async function identifyYellow(bytes: Uint8Array): Promise<Cartridge | undefined> {
  const known = Object.entries(CARTRIDGES).filter(([, c]) => c.size === bytes.length);
  if (!known.length) return undefined;
  const hash = await sha1(bytes);
  return known.find(([, c]) => c.sha1 === hash)?.[0] as Cartridge | undefined;
}

export async function verifyYellow(bytes: Uint8Array, cartridge: Cartridge = "yellow") {
  if (bytes.length !== CARTRIDGES[cartridge].size)
    throw new UnsupportedYellowCartridge(cartridge === "legacy"
      ? "Please choose Pokémon Yellow patched with Yellow Legacy V1.0.10, or the patch itself."
      : "Please choose an English Pokémon Yellow ROM (.gbc).");
  if (await sha1(bytes) !== CARTRIDGES[cartridge].sha1)
    throw new UnsupportedYellowCartridge(cartridge === "legacy"
      ? "Unsupported ROM: Yellow Legacy V1.0.10, patched onto the English Pokémon Yellow, is required."
      : "Unsupported ROM: the English release of Pokémon Yellow is required.");
}

export type Direction = "north" | "south" | "west" | "east";
export interface Connection { dir: Direction; map: number; offset: number }
export interface Warp { x: number; y: number; map: number; warp: number }
export interface Sign { x: number; y: number; text: number }
export interface MapObject {
  /** 1-based, the sprite slot used by scripts. */
  index: number;
  sprite: number;
  x: number;
  y: number;
  walk: boolean;
  /** WALK: 0 any, 1 up/down, 2 left/right. STAY: facing ($D0 down, $D1 up, $D2 left, $D3 right) or $FF. */
  range: number;
  text: number;
  item?: number;
  /** Trainer class (OPP id - 200) and party number, or a static Pokémon's internal id and level. */
  trainer?: { klass: number; index: number };
  pokemon?: { species: number; level: number };
}
export interface MapHeader {
  id: number;
  label: string;
  bank: number;
  tileset: number;
  width: number;
  height: number;
  blocks: Uint8Array;
  textPointers: number;
  script: number;
  connections: Connection[];
  border: number;
  warps: Warp[];
  signs: Sign[];
  objects: MapObject[];
}
export interface Tileset {
  id: number;
  blocks: number;
  gfx: number;
  passable: Set<number>;
  counters: number[];
  grass?: number;
  animation: number;
  warpTiles: Set<number>;
  doorTiles: Set<number>;
}
export interface WildMon { level: number; species: number }
export interface WildTable { grassRate: number; grass: WildMon[]; waterRate: number; water: WildMon[] }
export interface HiddenObject { x: number; y: number; arg: number; routine: string }

/** A decoded text script. Strings use \n for a new line, \f for a new box and \v to scroll. */
export type TextOp =
  | { op: "text"; s: string }
  | { op: "ram"; addr: number }
  | { op: "num"; addr: number; bytes: number; digits: number }
  | { op: "bcd"; addr: number; flags: number }
  | { op: "asm"; at: number }
  | { op: "sound"; id: number }
  | { op: "pause" }
  | { op: "dots"; n: number }
  | { op: "wait" }
  | { op: "script"; kind: number; at: number };

const CHARS: Record<number, string> = {
  0x4f: "\n", 0x4e: "\n", 0x51: "\f", 0x55: "\v", 0x4b: "\v", 0x4c: "\v", 0x49: "\f",
  0x52: "{PLAYER}", 0x53: "{RIVAL}", 0x54: "POKé", 0x56: "……", 0x5b: "PC", 0x5c: "TM", 0x5d: "TRAINER",
  0x5e: "ROCKET", 0x4a: "PKMN", 0x59: "{TARGET}", 0x5a: "{USER}", 0x5f: "\f",
  0x6d: ":", 0x70: "‘", 0x71: "’", 0x72: "“", 0x73: "”", 0x74: "·", 0x75: "…",
  0x7f: " ", 0x9a: "(", 0x9b: ")", 0x9c: ":", 0x9d: ";", 0x9e: "[", 0x9f: "]", 0xba: "é",
  0xbb: "'d", 0xbc: "'l", 0xbd: "'s", 0xbe: "'t", 0xbf: "'v", 0xe0: "'", 0xe1: "PK", 0xe2: "MN",
  0xe3: "-", 0xe4: "'r", 0xe5: "'m", 0xe6: "?", 0xe7: "!", 0xe8: ".", 0xec: "▷", 0xed: "▶",
  0xee: "▼", 0xef: "♂", 0xf0: "¥", 0xf1: "×", 0xf2: ".", 0xf3: "/", 0xf4: ",", 0xf5: "♀",
};
for (let i = 0; i < 26; i++) {
  CHARS[0x80 + i] = String.fromCharCode(65 + i);
  CHARS[0xa0 + i] = String.fromCharCode(97 + i);
}
for (let i = 0; i < 10; i++) CHARS[0xf6 + i] = String(i);

const addr = (name: string) => {
  const v = SYM[name];
  if (v === undefined) throw Error(`Unknown Yellow symbol ${name}`);
  return v;
};
const DIRECTIONS: [Direction, number][] = [["north", 8], ["south", 4], ["west", 2], ["east", 1]];

export class YellowRom {
  private maps = new Map<number, MapHeader>();
  private tilesets = new Map<number, Tileset>();
  private labels?: Map<number, string>;
  constructor(readonly bytes: Uint8Array) {}

  u8(o: number) { return this.bytes[o]; }
  u16(o: number) { return this.bytes[o] | (this.bytes[o + 1] << 8); }
  /** File offset of a banked pointer. */
  far(bank: number, ptr: number) { return ptr < 0x4000 ? ptr : bank * 0x4000 + (ptr - 0x4000); }
  bankOf(offset: number) { return offset < 0x4000 ? 0 : Math.floor(offset / 0x4000); }
  sym(name: string) { return addr(name); }
  /** The published label at a file offset, if any. */
  label(offset: number) {
    this.labels ??= new Map(Object.entries(SYM).map(([k, v]) => [v, k]));
    return this.labels.get(offset);
  }

  /** Decodes characters until "@" (or a length limit). */
  string(offset: number, max = 64) {
    let s = "";
    for (let i = 0; i < max; i++) {
      const c = this.bytes[offset + i];
      if (c === 0x50) break;
      s += CHARS[c] ?? "";
    }
    return s;
  }
  private stringLength(offset: number) {
    let n = 0;
    while (this.bytes[offset + n] !== 0x50) n++;
    return n + 1;
  }

  get mapCount() { return MAP_LABELS.length; }
  mapLabel(id: number) { return MAP_LABELS[id] ?? undefined; }

  map(id: number): MapHeader | undefined {
    if (this.maps.has(id)) return this.maps.get(id);
    const label = MAP_LABELS[id];
    if (!label) return undefined;
    const bank = this.u8(addr("MapHeaderBanks") + id);
    const h = this.far(bank, this.u16(addr("MapHeaderPointers") + id * 2));
    const tileset = this.u8(h), height = this.u8(h + 1), width = this.u8(h + 2);
    const blocksAt = this.far(bank, this.u16(h + 3));
    const flags = this.u8(h + 9);
    let p = h + 10;
    const connections: Connection[] = [];
    for (const [dir, bit] of DIRECTIONS) {
      if (!(flags & bit)) continue;
      const map = this.u8(p), y = (this.u8(p + 7) << 24) >> 24, x = (this.u8(p + 8) << 24) >> 24;
      connections.push({ dir, map, offset: dir === "north" || dir === "south" ? -x / 2 : -y / 2 });
      p += 11;
    }
    let o = this.far(bank, this.u16(p));
    const border = this.u8(o++);
    const warps: Warp[] = [];
    for (let n = this.u8(o++); n--; o += 4) warps.push({ y: this.u8(o), x: this.u8(o + 1), warp: this.u8(o + 2), map: this.u8(o + 3) });
    const signs: Sign[] = [];
    for (let n = this.u8(o++); n--; o += 3) signs.push({ y: this.u8(o), x: this.u8(o + 1), text: this.u8(o + 2) });
    const objects: MapObject[] = [];
    for (let n = this.u8(o++), index = 1; n--; index++) {
      const sprite = this.u8(o), y = this.u8(o + 1) - 4, x = this.u8(o + 2) - 4;
      const walk = this.u8(o + 3) === 0xfe, range = this.u8(o + 4), text = this.u8(o + 5);
      const object: MapObject = { index, sprite, x, y, walk, range, text: text & 0x3f };
      o += 6;
      if (text & 0x40) {
        const klass = this.u8(o), level = this.u8(o + 1);
        if (klass >= 200) object.trainer = { klass: klass - 200, index: level };
        else object.pokemon = { species: klass, level };
        o += 2;
      } else if (text & 0x80) {
        object.item = this.u8(o);
        o += 1;
      }
      objects.push(object);
    }
    const header: MapHeader = {
      id, label, bank, tileset, width, height,
      blocks: this.bytes.slice(blocksAt, blocksAt + width * height),
      textPointers: this.far(bank, this.u16(h + 5)),
      script: this.far(bank, this.u16(h + 7)),
      connections, border, warps, signs, objects,
    };
    this.maps.set(id, header);
    return header;
  }

  tileset(id: number): Tileset {
    const cached = this.tilesets.get(id);
    if (cached) return cached;
    const t = addr("Tilesets") + id * 12;
    const bank = this.u8(t);
    const collBank = this.bankOf(addr("Overworld_Coll"));
    const passable = new Set<number>();
    for (let o = this.far(collBank, this.u16(t + 5)); this.u8(o) !== 0xff; o++) passable.add(this.u8(o));
    const list = (table: string) => {
      const base = addr(table), b = this.bankOf(base), set = new Set<number>();
      for (let o = this.far(b, this.u16(base + id * 2)); this.u8(o) !== 0xff; o++) set.add(this.u8(o));
      return set;
    };
    const counters = [this.u8(t + 7), this.u8(t + 8), this.u8(t + 9)].filter(c => c !== 0xff);
    const grass = this.u8(t + 10);
    const value: Tileset = {
      id,
      blocks: this.far(bank, this.u16(t + 1)),
      gfx: this.far(bank, this.u16(t + 3)),
      passable, counters,
      grass: grass === 0xff ? undefined : grass,
      animation: this.u8(t + 11),
      warpTiles: list("WarpTileIDPointers"),
      doorTiles: this.doorTiles(id),
    };
    this.tilesets.set(id, value);
    return value;
  }
  private doorTiles(tileset: number) {
    // DoorTileIDPointers: db tileset, dw list ... db -1
    const base = addr("DoorTileIDPointers"), bank = this.bankOf(base), set = new Set<number>();
    for (let o = base; this.u8(o) !== 0xff; o += 3) {
      if (this.u8(o) !== tileset) continue;
      for (let p = this.far(bank, this.u16(o + 1)); this.u8(p) !== 0x00 && this.u8(p) !== 0xff; p++) set.add(this.u8(p));
    }
    return set;
  }

  /** Tile ids of a block in a tileset, row-major 4×4. */
  block(tileset: Tileset, block: number) {
    return this.bytes.subarray(tileset.blocks + block * 16, tileset.blocks + block * 16 + 16);
  }
  /** Tile ids at the four 8×8 positions of each 16×16 step square. */
  tileAt(map: MapHeader, x: number, y: number) {
    const block = this.blockAt(map, x >> 1, y >> 1);
    const tiles = this.block(this.tileset(map.tileset), block);
    // Collision uses the lower-left 8×8 tile of each square.
    return tiles[((y & 1) * 2 + 1) * 4 + (x & 1) * 2];
  }
  blockAt(map: MapHeader, bx: number, by: number) {
    if (bx < 0 || by < 0 || bx >= map.width || by >= map.height) return map.border;
    return map.blocks[by * map.width + bx];
  }

  /** Ledges: [facing ($0 down, $4 up, $8 left, $C right), standing tile, ledge tile]. */
  ledges() {
    const out: { facing: number; from: number; ledge: number }[] = [];
    for (let o = addr("LedgeTiles"); this.u8(o) !== 0xff; o += 4) out.push({ facing: this.u8(o), from: this.u8(o + 1), ledge: this.u8(o + 2) });
    return out;
  }
  /** Tile pairs that cannot be crossed in either direction on land (cave ledges and edges). */
  tilePairs() {
    const out: { tileset: number; a: number; b: number }[] = [];
    for (let o = addr("TilePairCollisionsLand"); this.u8(o) !== 0xff; o += 3) out.push({ tileset: this.u8(o), a: this.u8(o + 1), b: this.u8(o + 2) });
    return out;
  }

  /** Two-bit pixel indices for one 8×8 tile at a file offset. */
  tile2bpp(offset: number) {
    const out = new Uint8Array(64);
    for (let row = 0; row < 8; row++) {
      const lo = this.bytes[offset + row * 2], hi = this.bytes[offset + row * 2 + 1];
      for (let col = 0; col < 8; col++) {
        const bit = 7 - col;
        out[row * 8 + col] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1);
      }
    }
    return out;
  }

  /** Overworld sprite sheet: offset and number of 16×16 frames (1, or 6 with walking frames). */
  spriteSheet(sprite: number) {
    const o = addr("SpriteSheetPointerTable") + (sprite - 1) * 4;
    const size = this.u8(o + 2);
    return { offset: this.far(this.u8(o + 3), this.u16(o)), frames: size >= 0xc0 ? 6 : 1 };
  }

  // ---------------------------------------------------------------- text
  /** Decodes a text script, following text_far jumps. */
  text(offset: number): TextOp[] {
    const ops: TextOp[] = [];
    let o = offset, guard = 0;
    while (guard++ < 400) {
      const c = this.u8(o);
      if (c === 0x00) {
        const start = o + 1;
        let s = "";
        let p = start;
        for (; this.u8(p) !== 0x50; p++) {
          const ch = this.u8(p);
          if (ch === 0x57 || ch === 0x58) { // <DONE> / <PROMPT> end the text
            if (s) ops.push({ op: "text", s });
            if (ch === 0x58) ops.push({ op: "wait" });
            return ops;
          }
          s += CHARS[ch] ?? "";
        }
        if (s) ops.push({ op: "text", s });
        o = p + 1;
      } else if (c === 0x01) { ops.push({ op: "ram", addr: this.u16(o + 1) }); o += 3; }
      else if (c === 0x02) { ops.push({ op: "bcd", addr: this.u16(o + 1), flags: this.u8(o + 3) }); o += 4; }
      else if (c === 0x03) o += 3;
      else if (c === 0x04) o += 5;
      else if (c === 0x05 || c === 0x07) o += 1;
      else if (c === 0x06 || c === 0x0d) { ops.push({ op: "wait" }); o += 1; }
      else if (c === 0x08) { ops.push({ op: "asm", at: o + 1 }); return ops; }
      else if (c === 0x09) {
        const n = this.u8(o + 3);
        ops.push({ op: "num", addr: this.u16(o + 1), bytes: n >> 4, digits: n & 15 });
        o += 4;
      } else if (c === 0x0a) { ops.push({ op: "pause" }); o += 1; }
      else if (c === 0x0c) { ops.push({ op: "dots", n: this.u8(o + 1) }); o += 2; }
      else if (c >= 0x0b && c <= 0x16) { ops.push({ op: "sound", id: c }); o += 1; }
      else if (c === 0x17) {
        ops.push(...this.text(this.far(this.u8(o + 3), this.u16(o + 1))));
        o += 4;
      } else if (c >= 0xf5) { ops.push({ op: "script", kind: c, at: o + 1 }); return ops; }
      else return ops; // TX_END ($50) or anything unexpected
    }
    return ops;
  }
  /** Text pointer table entry (1-based text id) of a map. */
  mapText(map: MapHeader, id: number) {
    return this.far(map.bank, this.u16(map.textPointers + (id - 1) * 2));
  }
  /** A mart's stock: item ids following TX_SCRIPT_MART. */
  martStock(at: number) {
    const n = this.u8(at), items: number[] = [];
    for (let i = 0; i < n; i++) items.push(this.u8(at + 1 + i));
    return items;
  }

  // ---------------------------------------------------------------- names and data
  /** National Pokédex number of an internal species id. */
  dex(species: number) { return this.u8(addr("PokedexOrder") + species - 1); }
  /** Internal species id of a Pokédex number. */
  internal(dex: number) {
    for (let i = 1; i < 256; i++) if (this.dex(i) === dex) return i;
    return 0;
  }
  monName(species: number) { return this.string(addr("MonsterNames") + (species - 1) * 10, 10); }
  itemName(item: number) {
    if (item >= 0xc4 && item <= 0xc8) return `HM0${item - 0xc3}`;
    if (item >= 0xc9) return `TM${String(item - 0xc8).padStart(2, "0")}`;
    let o = addr("ItemNames");
    for (let i = 1; i < item; i++) o += this.stringLength(o);
    return this.string(o, 20);
  }
  /** The move a TM or HM item teaches. Like TMToMove, the table lists TM01–TM50, then HM01–HM05. */
  machineMove(item: number) {
    return this.u8(addr("TechnicalMachines") + (item >= 0xc9 ? item - 0xc9 : 50 + item - 0xc4));
  }
  itemPrice(item: number) {
    if (item >= 0xc9) {
      const tm = item - 0xc9, packed = this.u8(addr("TechnicalMachinePrices") + (tm >> 1));
      return (tm & 1 ? packed & 15 : packed >> 4) * 1000;
    }
    const o = addr("ItemPrices") + (item - 1) * 3;
    const bcd = (b: number) => (b >> 4) * 10 + (b & 15);
    return bcd(this.u8(o)) * 10000 + bcd(this.u8(o + 1)) * 100 + bcd(this.u8(o + 2));
  }
  trainerClassName(klass: number) {
    let o = addr("TrainerNames");
    for (let i = 1; i < klass; i++) o += this.stringLength(o);
    return this.string(o, 16);
  }
  /** Base prize money per level of the last Pokémon. */
  trainerMoney(klass: number) {
    const o = this.sym("TrainerPicAndMoneyPointers") + (klass - 1) * 5 + 2;
    const bcd = (b: number) => (b >> 4) * 10 + (b & 15);
    return bcd(this.u8(o)) * 100 + bcd(this.u8(o + 1));
  }
  trainerParty(klass: number, index: number): WildMon[] {
    const base = addr("TrainerDataPointers"), bank = this.bankOf(base);
    let o = this.far(bank, this.u16(base + (klass - 1) * 2));
    for (let i = 1; i < index; i++) {
      while (this.u8(o) !== 0) o++;
      o++;
    }
    const party: WildMon[] = [];
    if (this.u8(o) === 0xff) {
      for (o++; this.u8(o) !== 0; o += 2) party.push({ level: this.u8(o), species: this.u8(o + 1) });
    } else {
      const level = this.u8(o++);
      for (; this.u8(o) !== 0; o++) party.push({ level, species: this.u8(o) });
    }
    return party;
  }
  wild(map: number): WildTable {
    const base = addr("WildDataPointers"), bank = this.bankOf(base);
    let o = this.far(bank, this.u16(base + map * 2));
    const read = () => {
      const rate = this.u8(o++), mons: WildMon[] = [];
      if (rate) for (let i = 0; i < 10; i++, o += 2) mons.push({ level: this.u8(o), species: this.u8(o + 1) });
      return { rate, mons };
    };
    const grass = read(), water = read();
    return { grassRate: grass.rate, grass: grass.mons, waterRate: water.rate, water: water.mons };
  }
  hiddenObjects(map: number): HiddenObject[] {
    const base = addr("HiddenObjectMaps"), bank = this.bankOf(base);
    for (let o = base; this.u8(o) !== 0xff; o += 3) {
      if (this.u8(o) !== map) continue;
      const out: HiddenObject[] = [];
      for (let p = this.far(bank, this.u16(o + 1)); this.u8(p) !== 0xff; p += 6) {
        const routine = this.far(this.u8(p + 3), this.u16(p + 4));
        out.push({ y: this.u8(p), x: this.u8(p + 1), arg: this.u8(p + 2), routine: this.label(routine) ?? `@${routine.toString(16)}` });
      }
      return out;
    }
    return [];
  }
  /** Initial visibility of every toggleable object: [map, object index, shown]. */
  missables() {
    const out: { map: number; object: number; shown: boolean }[] = [];
    for (let o = addr("MissableObjects"); this.u8(o) !== 0xff; o += 3)
      out.push({ map: this.u8(o), object: this.u8(o + 1), shown: this.u8(o + 2) === 0x15 });
    return out;
  }
  /** Music id and bank for a map. */
  mapSong(map: number) {
    const o = addr("MapSongBanks") + map * 2;
    return { id: this.u8(o), bank: this.u8(o + 1) };
  }
  /** Town map name of a map, from the external and internal map tables. */
  mapName(map: number) {
    const names = this.bankOf(addr("ExternalMapEntries"));
    if (map < 0x25) {
      const o = addr("ExternalMapEntries") + map * 3;
      return this.string(this.far(names, this.u16(o + 1)), 24);
    }
    for (let o = addr("InternalMapEntries"); this.u8(o) !== 0xff; o += 4)
      if (map < this.u8(o)) return this.string(this.far(names, this.u16(o + 2)), 24);
    return "";
  }
}
