/**
 * Reads Pokémon Crystal's maps, events, tilesets, text and encounter tables
 * from the player's own cartridge. Offsets and constant values come from the
 * cartridge's disassembly (scripts/crystal-world-symbols.mjs); the data itself
 * is never bundled.
 */
import { C, CHARMAP, CONST, MAP, SYM, mapName, type CrystalCartridge } from "./symbols";
import { SHA1 as CRYSTAL_SHA1 } from "./generated/symbols-crystal";

export class UnsupportedCrystalCartridge extends Error {}

/**
 * Crystal Legacy V1.3.1 (github.com/cRz-Shadows/Pokemon_Crystal_Legacy): the
 * official "USA 1.0" patch applied to the English Pokémon Crystal that Astra
 * already plays from. Its symbol table is generated from a build of the tag,
 * which is the same ROM byte for byte.
 */
export const CRYSTAL_LEGACY_SHA1 = "74a6727e4406c35bc2d4f81347a5c5fdb8970663";
const CARTRIDGES: Record<CrystalCartridge, string> = { crystal: CRYSTAL_SHA1, legacy: CRYSTAL_LEGACY_SHA1 };

async function sha1(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-1", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export async function identifyCrystal(bytes: Uint8Array): Promise<CrystalCartridge | undefined> {
  if (bytes.length !== 0x200000) return undefined;
  const hash = await sha1(bytes);
  return (Object.keys(CARTRIDGES) as CrystalCartridge[]).find(c => CARTRIDGES[c] === hash);
}

export async function verifyCrystal(bytes: Uint8Array, cartridge: CrystalCartridge) {
  if (await identifyCrystal(bytes) !== cartridge)
    throw new UnsupportedCrystalCartridge(cartridge === "legacy"
      ? "Unsupported ROM: Crystal Legacy V1.3.1, patched onto the English Pokémon Crystal, is required."
      : "Unsupported ROM: the English Pokémon Crystal is required.");
}

export type Dir = "north" | "south" | "west" | "east";
export interface Connection { dir: Dir; group: number; number: number; /** Target square = this square + delta along the edge. */ delta: number }
export interface WarpEvent { x: number; y: number; warp: number; group: number; number: number }
export interface CoordEvent { x: number; y: number; scene: number; script: number }
export interface BgEvent { x: number; y: number; kind: number; script: number }
export interface ObjectEvent {
  /** Script object number: map objects start at 2 (0 is the player). */
  id: number;
  sprite: number;
  x: number;
  y: number;
  movement: number;
  radiusX: number;
  radiusY: number;
  h1: number;
  h2: number;
  color: number;
  type: number;
  sight: number;
  script: number;
  flag: number;
}
export interface CrystalMap {
  group: number;
  number: number;
  name: string;
  tileset: number;
  environment: number;
  landmark: number;
  music: number;
  phoneService: boolean;
  palette: number;
  fishGroup: number;
  border: number;
  width: number;
  height: number;
  blocks: Uint8Array;
  /** The bank of the map's scripts and events; their pointers are into it. */
  bank: number;
  scenes: number[];
  callbacks: { type: number; script: number }[];
  warps: WarpEvent[];
  coords: CoordEvent[];
  bgs: BgEvent[];
  objects: ObjectEvent[];
  connections: Connection[];
}
export interface Tileset { gfx: number; meta: number; coll: number; palMap: number }

/** Text, decoded: printed strings and the commands between them. */
export type TextOp =
  | { op: "text"; s: string }
  | { op: "ram"; addr: number }
  | { op: "bcd"; addr: number; flags: number }
  | { op: "decimal"; addr: number; bytes: number; digits: number }
  | { op: "buffer"; index: number }
  | { op: "wait" }
  | { op: "pause" }
  | { op: "dots"; n: number }
  | { op: "sound"; kind: string }
  | { op: "today" }
  | { op: "asm"; at: number }
  | { op: "end"; prompt: boolean };

export interface WildSlot { level: number; species: number }
export interface GrassTable { rates: number[]; /** morn, day, nite: seven slots each. */ slots: WildSlot[][] }
export interface WaterTable { rate: number; slots: WildSlot[] }

export class CrystalRom {
  private maps = new Map<string, CrystalMap>();
  constructor(readonly bytes: Uint8Array) {}

  u8(o: number) { return this.bytes[o]; }
  s8(o: number) { const v = this.bytes[o]; return v >= 0x80 ? v - 0x100 : v; }
  u16(o: number) { return this.bytes[o] | (this.bytes[o + 1] << 8); }
  sym(name: string) {
    const v = SYM[name];
    if (v === undefined) throw Error(`Unknown ROM table ${name}`);
    return v;
  }
  /** The ROM offset of a banked address. */
  at(bank: number, addr: number) {
    // RAM addresses (movement and scripts the engine builds in WRAM) come back negative.
    if (addr >= 0x8000) return -addr;
    return addr < 0x4000 ? addr : bank * 0x4000 + (addr & 0x3fff);
  }
  bankOf(offset: number) {
    return offset < 0x4000 ? 0 : offset >> 14;
  }
  /** A `dba` (bank, then address) pointer. */
  far(o: number) {
    return this.at(this.u8(o), this.u16(o + 1));
  }
  /** A `dw` pointer into the same bank as `o`. */
  near(o: number) {
    return this.at(this.bankOf(o), this.u16(o));
  }

  // ------------------------------------------------------------ maps
  mapHeader(group: number, number: number): CrystalMap {
    const key = `${group}:${number}`;
    const cached = this.maps.get(key);
    if (cached) return cached;
    const groups = this.sym("MapGroupPointers");
    const groupTable = this.near(groups + (group - 1) * 2);
    const h = groupTable + (number - 1) * 9;
    const attributes = this.at(this.u8(h), this.u16(h + 3));
    const name = mapName(group, number) ?? `MAP_${group}_${number}`;
    const border = this.u8(attributes), height = this.u8(attributes + 1), width = this.u8(attributes + 2);
    const blocksAt = this.at(this.u8(attributes + 3), this.u16(attributes + 4));
    const bank = this.u8(attributes + 6);
    const scriptsAt = this.at(bank, this.u16(attributes + 7));
    const eventsAt = this.at(bank, this.u16(attributes + 9));
    const flags = this.u8(attributes + 11);
    const map: CrystalMap = {
      group, number, name,
      tileset: this.u8(h + 1), environment: this.u8(h + 2), landmark: this.u8(h + 5), music: this.u8(h + 6),
      phoneService: !!(this.u8(h + 7) >> 4), palette: this.u8(h + 7) & 0xf, fishGroup: this.u8(h + 8),
      border, width, height, blocks: this.bytes.slice(blocksAt, blocksAt + width * height), bank,
      scenes: [], callbacks: [], warps: [], coords: [], bgs: [], objects: [], connections: [],
    };
    // Connections follow the attributes, in north, south, west, east order.
    let c = attributes + 12;
    for (const [dir, bit] of [["north", 3], ["south", 2], ["west", 1], ["east", 0]] as const) {
      if (!(flags & (1 << bit))) continue;
      const y = this.s8(c + 8), x = this.s8(c + 9);
      map.connections.push({ dir, group: this.u8(c), number: this.u8(c + 1), delta: dir === "north" || dir === "south" ? x : y });
      c += 12;
    }
    // Scene scripts, then callbacks.
    let o = scriptsAt;
    const scenes = this.u8(o++);
    for (let i = 0; i < scenes; i++, o += 4) map.scenes.push(this.at(bank, this.u16(o)));
    const callbacks = this.u8(o++);
    for (let i = 0; i < callbacks; i++, o += 3) map.callbacks.push({ type: this.u8(o), script: this.at(bank, this.u16(o + 1)) });
    // Events: two filler bytes, then warps, coord events, bg events and objects.
    o = eventsAt + 2;
    const warps = this.u8(o++);
    for (let i = 0; i < warps; i++, o += 5)
      map.warps.push({ y: this.u8(o), x: this.u8(o + 1), warp: this.u8(o + 2), group: this.u8(o + 3), number: this.u8(o + 4) });
    const coords = this.u8(o++);
    for (let i = 0; i < coords; i++, o += 8)
      map.coords.push({ scene: this.u8(o), y: this.u8(o + 1), x: this.u8(o + 2), script: this.at(bank, this.u16(o + 4)) });
    const bgs = this.u8(o++);
    for (let i = 0; i < bgs; i++, o += 5)
      map.bgs.push({ y: this.u8(o), x: this.u8(o + 1), kind: this.u8(o + 2), script: this.at(bank, this.u16(o + 3)) });
    const objects = this.u8(o++);
    for (let i = 0; i < objects; i++, o += 13) {
      const flag = this.u16(o + 11);
      map.objects.push({
        id: i + 2, sprite: this.u8(o), y: this.u8(o + 1) - 4, x: this.u8(o + 2) - 4, movement: this.u8(o + 3),
        radiusY: this.u8(o + 4) >> 4, radiusX: this.u8(o + 4) & 0xf, h1: this.s8(o + 5), h2: this.s8(o + 6),
        color: this.u8(o + 7) >> 4, type: this.u8(o + 7) & 0xf, sight: this.u8(o + 8),
        script: this.at(bank, this.u16(o + 9)), flag: flag === 0xffff ? -1 : flag,
      });
    }
    this.maps.set(key, map);
    return map;
  }
  mapByName(name: string) {
    const m = MAP[name];
    if (!m) throw Error(`Unknown map ${name}`);
    return this.mapHeader(m[0], m[1]);
  }
  /** Every map: group, then number. */
  allMaps() {
    return Object.values(MAP).map(([g, n]) => this.mapHeader(g, n));
  }

  tileset(id: number): Tileset {
    const t = this.sym("Tilesets") + id * 15;
    const palBank = this.bankOf(this.sym("TilesetJohtoPalMap"));
    return { gfx: this.far(t), meta: this.far(t + 3), coll: this.far(t + 6), palMap: this.at(palBank, this.u16(t + 13)) };
  }
  /** A block's 16 tile ids, row by row. */
  blockTiles(tileset: Tileset, block: number) {
    return this.bytes.subarray(tileset.meta + block * 16, tileset.meta + block * 16 + 16);
  }
  /** A block's four collision ids: top-left, top-right, bottom-left, bottom-right. */
  blockCollision(tileset: Tileset, block: number) {
    return this.bytes.subarray(tileset.coll + block * 4, tileset.coll + block * 4 + 4);
  }
  /** Whether a collision id is land, water or a wall (and whether it talks). */
  permission(collision: number) {
    return this.u8(this.sym("CollisionPermissionTable") + collision);
  }

  // ------------------------------------------------------------ text
  /** Decodes characters until "@" (or a terminating <DONE>/<PROMPT>). */
  string(o: number, max = 64): string {
    let s = "";
    for (let i = 0; i < max; i++) {
      const b = this.u8(o + i);
      if (b === 0x50) break;
      s += this.char(b);
    }
    return s;
  }
  /** One character: control characters become markers that the text box understands. */
  char(b: number): string {
    const c = CHARMAP[b] ?? "";
    switch (c) {
      case "<LINE>": case "<NEXT>": case "<CONT>": case "<_CONT>": case "<SCROLL>": case "<CR>": case "<LF>": return "\n";
      case "<PARA>": return "\f";
      case "<PLAYER>": case "<PLAY_G>": return "{PLAYER}";
      case "<RIVAL>": return "{RIVAL}";
      case "<MOM>": return "{MOM}";
      case "<RED>": return "RED";
      case "<GREEN>": return "GREEN";
      case "<PKMN>": return "PKMN";
      case "<POKE>": return "POKé";
      case "#": return "POKé";
      case "<PC>": return "PC";
      case "<TM>": return "TM";
      case "<TRAINER>": return "TRAINER";
      case "<ROCKET>": return "ROCKET";
      case "<……>": return "……";
      case "<PK>": return "PK";
      case "<MN>": return "MN";
      case "<DOT>": return ".";
      case "<COLON>": return ":";
      case "<LV>": return "Lv";
      case "<ID>": return "ID";
      case "<TARGET>": case "<USER>": case "<ENEMY>": return "";
      // The breakable space ("¯" in older disassemblies) splits landmark names.
      case "¯": case "<BSP>": return " ";
    }
    if (c.startsWith("<")) return c === "<" ? "<" : "";
    return c;
  }

  /** Decodes text commands from `o` until the text ends. */
  text(o: number): TextOp[] {
    const ops: TextOp[] = [];
    const sounds: Record<string, string> = {
      TX_SOUND_DEX_FANFARE_50_79: "dex", TX_SOUND_DEX_FANFARE_20_49: "dex", TX_SOUND_DEX_FANFARE_80_109: "dex",
      TX_SOUND_ITEM: "item", TX_SOUND_CAUGHT_MON: "caught", TX_SOUND_FANFARE: "fanfare", TX_SOUND_SLOT_MACHINE_START: "slots",
    };
    const names = TEXT_COMMAND_NAMES();
    for (let guard = 0; guard < 400; guard++) {
      const cmd = this.u8(o);
      if (cmd === 0x50) return ops;
      const name = names[cmd];
      o++;
      switch (name) {
        case "TX_START": {
          let s = "";
          for (let i = 0; i < 1024; i++, o++) {
            const b = this.u8(o);
            if (b === 0x50) { o++; break; }
            const c = CHARMAP[b];
            if (c === "<DONE>" || c === "<PROMPT>") {
              if (s) ops.push({ op: "text", s });
              ops.push({ op: "end", prompt: c === "<PROMPT>" });
              return ops;
            }
            s += this.char(b);
          }
          if (s) ops.push({ op: "text", s });
          break;
        }
        case "TX_RAM": ops.push({ op: "ram", addr: this.u16(o) }); o += 2; break;
        case "TX_BCD": ops.push({ op: "bcd", addr: this.u16(o), flags: this.u8(o + 2) }); o += 3; break;
        case "TX_MOVE": o = this.u16(o); break;
        case "TX_BOX": o += 4; break;
        case "TX_LOW": ops.push({ op: "text", s: "\n" }); break;
        case "TX_PROMPT_BUTTON": case "TX_WAIT_BUTTON": ops.push({ op: "wait" }); break;
        case "TX_SCROLL": ops.push({ op: "text", s: "\n" }); break;
        case "TX_START_ASM": ops.push({ op: "asm", at: o }); return ops;
        case "TX_DECIMAL": {
          const p = this.u8(o + 2);
          ops.push({ op: "decimal", addr: this.u16(o), bytes: p >> 4, digits: p & 0xf });
          o += 3;
          break;
        }
        case "TX_PAUSE": ops.push({ op: "pause" }); break;
        case "TX_DOTS": ops.push({ op: "dots", n: this.u8(o) }); o++; break;
        case "TX_STRINGBUFFER": ops.push({ op: "buffer", index: this.u8(o) }); o++; break;
        case "TX_DAY": ops.push({ op: "today" }); break;
        case "TX_FAR": o = this.at(this.u8(o + 2), this.u16(o)); break;
        default:
          if (name && sounds[name]) ops.push({ op: "sound", kind: sounds[name] });
          else return ops;
      }
    }
    return ops;
  }

  // ------------------------------------------------------------ names
  itemName(id: number) { return this.nthString(this.sym("ItemNames"), id - 1, 13); }
  trainerClassName(klass: number) { return this.nthString(this.sym("TrainerClassNames"), klass - 1, 13); }
  landmarkName(landmark: number) {
    const o = this.sym("Landmarks") + landmark * 4;
    return this.string(this.near(o + 2), 24).replace(/\n|¯/g, " ").replace(/\s+/g, " ").trim();
  }
  /** Landmark position on the Pokégear map, in pixels. */
  landmarkSpot(landmark: number) {
    const o = this.sym("Landmarks") + landmark * 4;
    return { x: this.u8(o) - 8, y: this.u8(o + 1) - 16 };
  }
  /** The `n`th "@"-terminated string of a list. */
  nthString(o: number, n: number, max = 24) {
    for (let i = 0; i < n; i++) {
      let guard = 0;
      while (this.u8(o) !== 0x50 && guard++ < max) o++;
      o++;
    }
    return this.string(o, max);
  }
  itemPrice(id: number) { return this.u16(this.sym("ItemAttributes") + (id - 1) * 7); }
  /** ITEM, KEY_ITEM, BALL or TM_HM. */
  itemPocket(id: number) { return this.u8(this.sym("ItemAttributes") + (id - 1) * 7 + 5); }
  itemAttributes(id: number) {
    const o = this.sym("ItemAttributes") + (id - 1) * 7;
    return { price: this.u16(o), held: this.u8(o + 2), param: this.u8(o + 3), property: this.u8(o + 4), pocket: this.u8(o + 5), field: this.u8(o + 6) >> 4, battle: this.u8(o + 6) & 0xf };
  }

  // ------------------------------------------------------------ encounters
  private grassTables?: Map<string, GrassTable>;
  private waterTables?: Map<string, WaterTable>;
  private readGrass(label: string, into: Map<string, GrassTable>) {
    for (let o = this.sym(label); this.u8(o) !== 0xff; o += 47) {
      const slots = [0, 1, 2].map(t => Array.from({ length: 7 }, (_, i) => ({ level: this.u8(o + 5 + (t * 7 + i) * 2), species: this.u8(o + 6 + (t * 7 + i) * 2) })));
      const key = `${this.u8(o)}:${this.u8(o + 1)}`;
      if (!into.has(key)) into.set(key, { rates: [this.u8(o + 2), this.u8(o + 3), this.u8(o + 4)], slots });
    }
  }
  private readWater(label: string, into: Map<string, WaterTable>) {
    for (let o = this.sym(label); this.u8(o) !== 0xff; o += 9) {
      const key = `${this.u8(o)}:${this.u8(o + 1)}`;
      if (!into.has(key)) into.set(key, { rate: this.u8(o + 2), slots: [0, 1, 2].map(i => ({ level: this.u8(o + 3 + i * 2), species: this.u8(o + 4 + i * 2) })) });
    }
  }
  /** The grass table of a map, with a swarm's table first when one is active. */
  grass(group: number, number: number, swarm = false): GrassTable | undefined {
    if (!this.grassTables) {
      this.grassTables = new Map();
      for (const l of ["JohtoGrassWildMons", "KantoGrassWildMons"]) this.readGrass(l, this.grassTables);
    }
    if (swarm) {
      const swarms = new Map<string, GrassTable>();
      this.readGrass("SwarmGrassWildMons", swarms);
      const s = swarms.get(`${group}:${number}`);
      if (s) return s;
    }
    return this.grassTables.get(`${group}:${number}`);
  }
  water(group: number, number: number, swarm = false): WaterTable | undefined {
    if (!this.waterTables) {
      this.waterTables = new Map();
      for (const l of ["JohtoWaterWildMons", "KantoWaterWildMons"]) this.readWater(l, this.waterTables);
    }
    if (swarm) {
      const swarms = new Map<string, WaterTable>();
      this.readWater("SwarmWaterWildMons", swarms);
      const s = swarms.get(`${group}:${number}`);
      if (s) return s;
    }
    return this.waterTables.get(`${group}:${number}`);
  }
  /** A fishing group's table for a rod: (chance, species, level), species 0 meaning a time group. */
  /** A map's fishing group (1-based, as map headers number them: GetFishGroupIndex) for a rod. */
  fish(group: number, rod: 0 | 1 | 2) {
    if (!group) return { bite: 0, table: [] };
    const o = this.sym("FishGroups") + (group - 1) * 7;
    const table = this.near(o + 1 + rod * 2);
    const out: { chance: number; species: number; level: number }[] = [];
    for (let e = table; out.length < 8; e += 3) {
      out.push({ chance: this.u8(e), species: this.u8(e + 1), level: this.u8(e + 2) });
      if (this.u8(e) >= 0xff) break;
    }
    return { bite: this.u8(o), table: out };
  }
  /** A fishing time group's day or night Pokémon. */
  timeFish(index: number, night: boolean) {
    const o = this.sym("TimeFishGroups") + index * 4 + (night ? 2 : 0);
    return { species: this.u8(o), level: this.u8(o + 1) };
  }
  /** Headbutt (or Rock Smash, with `rock`) Pokémon on a map: common and rare lists. */
  treeMons(group: number, number: number, rock = false) {
    let set = -1;
    for (let o = this.sym(rock ? "RockMonMaps" : "TreeMonMaps"); this.u8(o) !== 0xff; o += 3)
      if (this.u8(o) === group && this.u8(o + 1) === number) { set = this.u8(o + 2); break; }
    if (set < 0) return undefined;
    const read = (o: number) => {
      const list: { chance: number; species: number; level: number }[] = [];
      for (; this.u8(o) !== 0xff; o += 3) list.push({ chance: this.u8(o), species: this.u8(o + 1), level: this.u8(o + 2) });
      return { list, end: o + 1 };
    };
    const start = this.near(this.sym("TreeMons") + set * 2);
    const common = read(start);
    const rare = read(common.end);
    return { set, common: common.list, rare: rare.list };
  }
  contestMons() {
    const out: { chance: number; species: number; min: number; max: number }[] = [];
    for (let o = this.sym("ContestMons"); this.u8(o) !== 0xff && out.length < 20; o += 4)
      out.push({ chance: this.u8(o), species: this.u8(o + 1), min: this.u8(o + 2), max: this.u8(o + 3) });
    return out;
  }

  // ------------------------------------------------------------ shops, trades and trainers
  martStock(index: number) {
    const o = this.near(this.sym("Marts") + index * 2);
    const n = this.u8(o);
    return Array.from({ length: n }, (_, i) => this.u8(o + 1 + i)).filter(id => id !== 0xff);
  }
  npcTrade(index: number) {
    const o = this.sym("NPCTrades") + index * 32;
    return {
      dialog: this.u8(o), request: this.u8(o + 1), offer: this.u8(o + 2), nickname: this.string(o + 3, 11),
      dvs: [this.u8(o + 14), this.u8(o + 15)], item: this.u8(o + 16), otId: this.u16(o + 17),
      otName: this.string(o + 19, 11), gender: this.u8(o + 30),
    };
  }
  /** A plain Crystal trainer party: TRAINERTYPE_NORMAL, _MOVES, _ITEM and _ITEM_MOVES. */
  trainerParty(klass: number, id: number) {
    const pointers = this.sym("TrainerGroups");
    let o = this.near(pointers + (klass - 1) * 2);
    for (let n = 1; n < id; n++) {
      while (this.u8(o) !== 0x50) o++;
      o += 2;
      const kind = this.u8(o - 1);
      const size = 2 + (kind & 2 ? 1 : 0) + (kind & 1 ? 4 : 0);
      while (this.u8(o) !== 0xff) o += size;
      o++;
    }
    const name = this.string(o, 12);
    while (this.u8(o) !== 0x50) o++;
    const kind = this.u8(o + 1);
    o += 2;
    const mons: { level: number; species: number; item: number; moves?: number[] }[] = [];
    while (this.u8(o) !== 0xff && mons.length < 6) {
      const level = this.u8(o), species = this.u8(o + 1);
      o += 2;
      let item = 0, moves: number[] | undefined;
      if (kind & 2) item = this.u8(o++);
      if (kind & 1) { moves = [0, 1, 2, 3].map(i => this.u8(o + i)); o += 4; }
      mons.push({ level, species, item, moves });
    }
    return { name, kind, mons };
  }
  /** A trainer class's base prize money. */
  trainerBaseMoney(klass: number) {
    return this.u8(this.sym("TrainerClassAttributes") + (klass - 1) * 7 + 2);
  }

  /** Every map's events, for coverage and the debug overlay. */
  mapNames() {
    return Object.keys(MAP);
  }
  /** A collision constant by name. */
  coll(name: string) { return C(name); }
  hasConst(name: string) { return CONST[name] !== undefined; }
}

let textNames: (string | undefined)[] | undefined;
let textNamesFor: string[] | undefined;
import { TEXT_COMMANDS } from "./symbols";
function TEXT_COMMAND_NAMES() {
  if (textNamesFor !== TEXT_COMMANDS) {
    textNames = [...TEXT_COMMANDS];
    textNamesFor = TEXT_COMMANDS;
  }
  return textNames!;
}
