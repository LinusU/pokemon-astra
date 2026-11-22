/** Browser bridge to the actual Crystal battle engine and ROM decoders. */
import { dvWord, type PokemonPortrait } from "./appearance";
import { CRYSTAL_SFX_COUNT, decodeBattleSound, type CaptureSoundState } from "./battle-sound";

export interface Pokemon {
  species: number;
  item: number;
  moves: number[];
  ot_id: number;
  exp: number;
  stat_exp: number[];
  dvs: number[];
  pp: number[];
  happiness: number;
  pokerus: number;
  caught: number[];
  level: number;
  status: number;
  hp: number;
  stats: number[];
  nickname: string;
  ot_name: string;
}
export interface BattleMon {
  species: number;
  dvs: number;
  moves: number[];
  pp: number[];
  level: number;
  status: number;
  hp: number;
  max_hp: number;
}
interface BattleSide {
  active: BattleMon;
  active_slot: number;
  party?: BattleMon[];
  substatus?: number[];
}
export interface BattleSnapshot {
  site: string | null;
  exp_progress: number[];
  bag: BattleBag;
  legal: unknown[];
  state: {
    battle_mode?: number;
    player: BattleSide;
    enemy: BattleSide;
  };
  learning_slot?: number | null;
  events: unknown[];
  outcome: string | null;
  result: BattleResult | null;
}
export interface BattleBag {
  items: [number, number][];
  balls: [number, number][];
}
export interface BattleResult {
  outcome: string;
  party: Pokemon[];
  caught: number | null;
  money: number;
  bag: BattleBag;
  may_evolve: number[];
  world: { seen: number[]; caught: number[] };
}
export interface BattleOptions {
  party: Pokemon[];
  /**
   * A wild Pokémon, or a trainer: a party of the adventure's own, or with
   * `trainer` alone the game data's own party for that class and id.
   */
  opponent:
    | { species: number; level: number; stationary?: boolean }
    | { party?: Pokemon[]; prizeMoney?: number; trainer?: { class: number; id: number } };
  balls?: [number, number][];
  items?: [number, number][];
  money?: number;
  badges?: number;
  seed?: number;
  night?: boolean;
  seen?: number[];
  caught?: number[];
  /** The player and world as the battle shows them (defaults: Astra's). */
  player?: { name: string; id: number; gender: number; kantoBadges?: number };
  rivalName?: string;
  /** MORN_F, DAY_F or NITE_F; overrides `night`. */
  timeOfDay?: number;
  unlockedUnowns?: number;
  unownDex?: number[];
  location?: number;
}
type Exports = {
  memory: WebAssembly.Memory;
  alloc(n: number): number;
  dealloc(p: number, n: number): void;
  request(p: number, n: number): number;
  output_len(): number;
  decompress(p: number, n: number): number;
  music(
    p: number,
    n: number,
    bank: number,
    addr: number,
    start: number,
    count: number,
  ): number;
  music_start(p: number, n: number, bank: number, addr: number): number;
  music_next(count: number): number;
  cry(p: number, n: number, id: number, lengthOffset: number): number;
  sound_effect(p: number, n: number, id: number): number;
};

const TRAINING_LEVELS = [12, 18, 24, 30, 37, 43, 48, 53, 60];

const textSymbols: Record<number, string> = {
  0x4e: "\n", 0x54: "POKé", 0x7f: " ", 0x9a: "(", 0x9b: ")", 0x9c: ":", 0xd3: "’r", 0xd4: "’s",
  0xd5: "’t", 0xe0: "’", 0xe3: "-", 0xe8: ".", 0xe9: "&", 0xf3: "/", 0xf4: ",",
};

function flowingText(text: string) {
  return text.replace(/-\n(?=type\b|strike\b)/g, "-").replace(/-\n/g, "").replace(/\n/g, " ").replaceAll("POKéMON", "Pokémon");
}

/** A species in the battle engine's game data: `BaseData`'s 32 bytes, evolutions and level-up moves. */
interface SpeciesData {
  base: number[];
  evolutions: { method: number; parameter: number; condition?: number; species: number }[];
  learnset: { level: number; move: number }[];
}

export class Engine {
  constructor(
    private wasm: Exports,
    private rom: Uint8Array,
  ) {}
  private bytes(
    data: Uint8Array,
    fn: (p: number, n: number) => number,
  ): Uint8Array {
    const p = this.wasm.alloc(data.length);
    new Uint8Array(this.wasm.memory.buffer, p, data.length).set(data);
    try {
      const out = fn(p, data.length);
      return new Uint8Array(
        this.wasm.memory.buffer,
        out,
        this.wasm.output_len(),
      ).slice();
    } finally {
      this.wasm.dealloc(p, data.length);
    }
  }
  /** The Crystal cartridge, read-only by convention, for renderers that draw its graphics. */
  get cartridge(): Uint8Array {
    return this.rom;
  }
  /** Decompresses Crystal LZ data, such as tileset graphics. */
  decompress(data: Uint8Array): Uint8Array {
    return this.bytes(data, (p, n) => this.wasm.decompress(p, n));
  }
  private call<T>(value: unknown): T {
    const bytes = this.bytes(
      new TextEncoder().encode(JSON.stringify(value)),
      (p, n) => this.wasm.request(p, n),
    );
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (result.error) throw Error(result.error);
    return result as T;
  }
  private speciesCache = new Map<number, SpeciesData>();
  /** A species' base data, evolutions and level-up moves: the battle engine's game data (Crystal Legacy's). */
  private speciesData(id: number): SpeciesData {
    if (!Number.isInteger(id) || id < 1 || id > 251) throw Error("Invalid species");
    let data = this.speciesCache.get(id);
    if (!data) {
      data = this.call<SpeciesData>({ op: "species_data", id });
      this.speciesCache.set(id, data);
    }
    return data;
  }
  species(id: number): { id: number; name: string; types: number[] } {
    const v = this.call<{ id: number; name: string }>({ op: "species", id });
    const base = this.speciesData(id).base;
    return { ...v, types: [base[7], base[8]] };
  }
  private cartridgeText(offset: number) {
    let text = "", cursor = offset;
    for (let ch = this.rom[cursor++]; ch !== 0x50; ch = this.rom[cursor++]) {
      if (ch >= 0x80 && ch <= 0x99) text += String.fromCharCode(65 + ch - 0x80);
      else if (ch >= 0xa0 && ch <= 0xb9) text += String.fromCharCode(97 + ch - 0xa0);
      else if (ch >= 0xf6) text += String(ch - 0xf6);
      else if (textSymbols[ch]) text += textSymbols[ch];
      else throw Error("Invalid cartridge text");
    }
    return { text, next: cursor };
  }
  /** Crystal 1.1 stores two pages per species across four Pokédex banks. */
  dexEntry(id: number) {
    if (!Number.isInteger(id) || id < 1 || id > 251) throw Error("Invalid species");
    const index = id - 1;
    const bank = this.rom[0xec4c + (index >> 6)];
    const pointer = 0x44378 + index * 2;
    const offset = bank * 0x4000 + ((this.rom[pointer] | (this.rom[pointer + 1] << 8)) & 0x3fff);
    const category = this.cartridgeText(offset);
    const first = this.cartridgeText(category.next + 4); // Height and weight precede the first page.
    const second = this.cartridgeText(first.next);
    return { category: category.text, description: flowingText(first.text + "\n" + second.text) };
  }
  move(id: number, dvs?: PokemonPortrait["dvs"]) {
    if (id < 1 || id > 251) throw Error("Invalid move");
    const move = this.call<{ id: number; name: string; pp: number; type: number; power: number; accuracy: number }>({
      op: "move",
      id,
      dvs: id === 237 && dvs !== undefined ? dvWord(dvs) : undefined,
    });
    const pointer = 0x2cb52 + (id - 1) * 2; // MoveDescriptions, bank 0x0b in Crystal 1.1.
    const description = this.cartridgeText(0x2c000 + ((this.rom[pointer] | (this.rom[pointer + 1] << 8)) & 0x3fff));
    return { ...move, description: flowingText(description.text.replace("\n2nd turn", " · 2nd turn")) };
  }
  training({ species, level, exp }: Pokemon) {
    return this.call<{ next: number | null; percent: number }>({ op: "training", species, level, exp });
  }
  itemName(id: number) {
    return this.call<string>({ op: "item_name", id });
  }
  /** Evolution records (`EVOLVE_*` method, parameter, condition) and level-up moves, from the battle engine's game data. */
  evolutionData(id: number): Pick<SpeciesData, "evolutions" | "learnset"> {
    const { evolutions, learnset } = this.speciesData(id);
    return { evolutions, learnset };
  }
  /** Apply a selected evolution while preserving individual values and damage. */
  evolvePokemon(mon: Pokemon, target: number): Pokemon {
    if (
      !this.evolutionData(mon.species).evolutions.some(
        (e) => e.species === target,
      )
    )
      throw Error("Invalid evolution");
    const stats = this.statsFor(mon, target);
    const oldName = this.species(mon.species).name;
    return {
      ...mon,
      species: target,
      stats,
      hp:
        mon.hp === 0 ? 0 : Math.min(stats[0], mon.hp + stats[0] - mon.stats[0]),
      nickname:
        mon.nickname === oldName ? this.species(target).name : mon.nickname,
    };
  }
  statsFor(mon: Pokemon, id = mon.species): number[] {
    const base = this.speciesData(id).base;
    const atk = mon.dvs[0] >> 4,
      def = mon.dvs[0] & 15,
      spd = mon.dvs[1] >> 4,
      special = mon.dvs[1] & 15;
    const hp = (atk & 1) * 8 + (def & 1) * 4 + (spd & 1) * 2 + (special & 1);
    const dvs = [hp, atk, def, spd, special, special];
    const exp = [
      mon.stat_exp[0],
      mon.stat_exp[1],
      mon.stat_exp[2],
      mon.stat_exp[3],
      mon.stat_exp[4],
      mon.stat_exp[4],
    ];
    return dvs.map((dv, i) => {
      const contribution = Math.floor(
        Math.min(255, Math.ceil(Math.sqrt(exp[i]))) / 4,
      );
      const scaled = Math.floor(
        (((base[1 + i] + dv) * 2 + contribution) * mon.level) / 100,
      );
      return scaled + (i === 0 ? mon.level + 10 : 5);
    });
  }
  /**
   * A stored Pokémon with its stats recalculated from the current game data
   * (journeys begun on Crystal's), keeping the HP it has already lost.
   */
  restat(mon: Pokemon): Pokemon {
    const stats = this.statsFor(mon);
    if (stats.every((stat, i) => stat === mon.stats[i])) return mon;
    const lost = mon.stats[0] - mon.hp;
    return { ...mon, stats, hp: mon.hp === 0 ? 0 : Math.min(stats[0], Math.max(1, stats[0] - lost)) };
  }
  /** Experience group from the base data (0 medium fast … 5 slow). */
  growthRate(id: number) {
    return this.speciesData(id).base[22];
  }
  breedingData(id: number) {
    const base = this.speciesData(id).base;
    const groups = base[23];
    return { genderRatio: base[13], cycles: base[15],
      groups: [groups >> 4, groups & 15] };
  }
  private earlierStages?: Map<number, number>;
  firstStage(id: number) {
    if (!this.earlierStages) {
      this.earlierStages = new Map();
      for (let species = 1; species <= 251; species++) {
        for (const evo of this.evolutionData(species).evolutions)
          this.earlierStages.set(evo.species, species);
      }
    }
    while (this.earlierStages.has(id)) id = this.earlierStages.get(id)!;
    return id;
  }
  private machines?: number[];
  /** The moves Crystal's TMs, HMs and move tutor teach. Crystal Legacy keeps the list, so it comes from the cartridge. */
  machineList(): readonly number[] {
    if (!this.machines) {
      this.machines = [];
      for (let i = 0; this.rom[0x1167a + i]; i++) this.machines.push(this.rom[0x1167a + i]);
    }
    return this.machines;
  }
  /** The TM, HM and tutor moves a species can learn, from the game data. */
  machineMoves(id: number) {
    const base = this.speciesData(id).base;
    return new Set(this.machineList().filter((_, i) => base[24 + (i >> 3)] & (1 << (i & 7))));
  }
  /** Egg moves and the TM/HM moves a species can learn. Crystal Legacy keeps Crystal's egg moves, so those come from the cartridge. */
  inheritableMoves(id: number) {
    const moves = this.machineMoves(id);
    const ptr = 0x23b11 + (id - 1) * 2;
    let cursor = 0x20000 + ((this.rom[ptr] | (this.rom[ptr + 1] << 8)) & 0x3fff);
    while (this.rom[cursor] !== 0xff) moves.add(this.rom[cursor++]);
    return moves;
  }
  teachMove(mon: Pokemon, move: number, slot: number): Pokemon {
    if (slot < 0 || slot > 3 || move < 1 || move > 251)
      throw Error("Invalid move or slot");
    const moves = [...mon.moves],
      pp = [...mon.pp];
    moves[slot] = move;
    pp[slot] = this.move(move).pp;
    return { ...mon, moves, pp };
  }
  makePokemon(id: number, level: number): Pokemon {
    return this.call({ op: "make", id, level });
  }
  makeStarter(id: number): Pokemon {
    const moves: Record<number, number> = { 58: 52, 60: 55, 69: 33 };
    const move = moves[id];
    if (!move) throw Error("Invalid Astra partner");
    const mon = this.makePokemon(id, 6);
    // A partner may already know its signature move (Crystal Legacy's Growlithe knows Ember at 6).
    return mon.moves.includes(move) ? mon : this.teachMove(mon, move, mon.moves.indexOf(0));
  }
  healPokemon(mon: Pokemon): Pokemon {
    return this.call({ op: "heal", mon });
  }
  startBattle(options: BattleOptions): Battle {
    const opp =
      "species" in options.opponent
        ? { Wild: { species: options.opponent.species, level: options.opponent.level } }
        : {
            Trainer: {
              class: 1,
              id: 1,
              party: options.opponent.party,
              items: null,
              ai_flags: null,
              control: "original",
            },
          };
    const setup = {
      player: {
        name: options.player?.name ?? "ASTRA",
        id: options.player?.id ?? 0x1234,
        gender: options.player?.gender ?? 0,
        money: options.money ?? 3000,
        johto_badges: options.badges ?? 0,
        kanto_badges: options.player?.kantoBadges ?? 0,
        mom_saving: 0,
        mom_money: 0,
      },
      party: options.party,
      bag: {
        items: (options.items ?? [[18, 5]]).filter(([, count]) => count > 0),
        balls: (options.balls ?? [[5, 10]]).filter(([, count]) => count > 0),
      },
      opponent: opp,
      options: { battle_scene: true, stationary_wild: "species" in options.opponent && options.opponent.stationary === true },
      world: {
        time_of_day: options.timeOfDay ?? (options.night ? 2 : 1),
        // Astra’s wild letter habitat is independent of Johto’s four ruin puzzles.
        unlocked_unowns: options.unlockedUnowns ?? 0x0f,
        rival_name: options.rivalName ?? "ROBIN",
        seen: options.seen ?? [],
        caught: options.caught ?? [],
        unown_dex: options.unownDex ?? [],
        location: options.location ?? 0,
      },
    };
    return new Battle(
      this,
      this.call({
        op: "start",
        setup,
        trainer_prize: "species" in options.opponent ? undefined : options.opponent.prizeMoney,
        seed: options.seed ?? Math.floor(Math.random() * 0xffffffff),
        training_level: "Trainer" in opp ? TRAINING_LEVELS[popcount(options.badges ?? 0)] : 0,
      }),
    );
  }
  act(index: number): BattleSnapshot {
    return this.call({ op: "act", index });
  }
  private color(p: number): number[] {
    const c = this.rom[p] | (this.rom[p + 1] << 8);
    return [
      ((c & 31) * 255) / 31,
      (((c >> 5) & 31) * 255) / 31,
      (((c >> 10) & 31) * 255) / 31,
      255,
    ];
  }
  private paint(
    out: Uint8ClampedArray,
    width: number,
    source: Uint8Array,
    ox: number,
    oy: number,
    colors: number[][],
    transparent: boolean,
    flip = false,
  ): void {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const bit = 7 - x;
        const c =
          ((source[y * 2] >> bit) & 1) |
          (((source[y * 2 + 1] >> bit) & 1) << 1);
        if (!transparent || c)
          out.set(colors[c], ((oy + y) * width + ox + (flip ? 7 - x : x)) * 4);
      }
  }
  npc(kind: string, night = false, facing = "down", frame = 0): ImageData {
    const table: Record<string, [number, number]> = {
      player: [0xc0000, 0],
      fisher: [0xc51c0, 2],
      silkKeeper: [0xc1b00, 2],
      captain: [0xc27c0, 1],
      lineChief: [0xc2ac0, 2],
      excavator: [0xc2400, 2],
      kilnKeeper: [0xc1140, 0],
      mountaineer: [0xc2100, 1],
      bellKeeper: [0xc2f40, 3],
      astronomer: [0xc2280, 3],
      bugCatcher: [0xc33c0, 2],
      sailor: [0xc6600, 1],
      scientist: [0xc54c0, 3],
      hiker: [0xc4000, 2],
      biker: [0xc6780, 0],
      skier: [0xc3240, 1],
      medium: [0xc5640, 0],
      dragonTamer: [0xc2940, 1],
      rival: [0xc03c0, 0],
      lass: [0xc3840, 1],
      elder: [0xc4300, 3],
      item: [0xc7380, 0],
      nurse: [0xc4e00, 0],
      clerk: [0xc5040, 1],
      professor: [0xc15c0, 3],
      sage: [0xc57c0, 3],
    };
    const [base, pal] = table[kind] ?? [0xc36c0, 0];
    const colors = Array.from({ length: 4 }, (_, i) =>
      this.color(0xb469 + (night ? 128 : 64) + pal * 8 + i * 2),
    );
    const off =
      base +
      (facing === "up"
        ? 64
        : facing === "left" || facing === "right"
          ? 128
          : 0) +
      (frame ? 192 : 0);
    const pixels = new Uint8ClampedArray(16 * 16 * 4);
    const flip =
      facing === "right" ||
      (frame === 2 && (facing === "down" || facing === "up"));
    for (let i = 0; i < 4; i++)
      this.paint(
        pixels,
        16,
        this.rom.subarray(off + i * 16, off + i * 16 + 16),
        (flip ? 1 - (i % 2) : i % 2) * 8,
        Math.floor(i / 2) * 8,
        colors,
        false,
        flip,
      );
    this.clearExterior(pixels, 16, 16);
    return new ImageData(pixels, 16, 16);
  }
  /** Remove only the background connected to the edge; enclosed highlights stay opaque. */
  private clearExterior(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
  ) {
    const background = pixels.slice(0, 4);
    const seen = new Uint8Array(width * height);
    const queue: number[] = [];
    const add = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x,
        p = i * 4;
      if (
        seen[i] ||
        pixels[p] !== background[0] ||
        pixels[p + 1] !== background[1] ||
        pixels[p + 2] !== background[2]
      )
        return;
      seen[i] = 1;
      queue.push(i);
    };
    for (let x = 0; x < width; x++) {
      add(x, 0);
      add(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      add(0, y);
      add(width - 1, y);
    }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head],
        x = i % width,
        y = Math.floor(i / width);
      pixels[i * 4 + 3] = 0;
      add(x - 1, y);
      add(x + 1, y);
      add(x, y - 1);
      add(x, y + 1);
    }
  }
  private tilesets = new Map<
    string,
    { graphics: Uint8Array; meta: number; pal: number }
  >();
  cell(set: string, cell: number, roof = 0, night = false): ImageData {
    const ids: Record<string, number> = {
      johto: 1,
      modern: 2,
      house: 5,
      center: 7,
      mart: 12,
      lab: 10,
      cave: 24,
      ice: 29,
      forest: 31,
      ruins: 26,
      park: 25,
      gate: 8,
      league: 15,
      tower: 23,
    };
    const index = ids[set];
    if (index === undefined) throw Error("Unknown tileset");
    let ts = this.tilesets.get(set);
    if (!ts) {
      const h = 0x4d596 + index * 15;
      const ptr = (p: number) =>
        this.rom[p] * 0x4000 +
        ((this.rom[p + 1] | (this.rom[p + 2] << 8)) & 0x3fff);
      const g = ptr(h);
      const graphics = this.bytes(this.rom.subarray(g, g + 0x4000), (p, n) =>
        this.wasm.decompress(p, n),
      );
      ts = {
        graphics,
        meta: ptr(h + 3),
        pal: 0x4c000 + ((this.rom[h + 13] | (this.rom[h + 14] << 8)) & 0x3fff),
      };
      this.tilesets.set(set, ts);
    }
    const pixels = new Uint8ClampedArray(16 * 16 * 4);
    const block = Math.floor(cell / 4),
      q = cell % 4,
      indoor = !["johto", "modern", "park", "forest"].includes(set);
    for (let ty = 0; ty < 2; ty++)
      for (let tx = 0; tx < 2; tx++) {
        const id =
          this.rom[
            ts.meta +
              block * 16 +
              (Math.floor(q / 2) * 2 + ty) * 4 +
              (q % 2) * 2 +
              tx
          ];
        const attr =
          (this.rom[ts.pal + Math.floor(id / 2)] >> ((id % 2) * 4)) & 15;
        const ix = attr & 8 ? Math.max(0, id - 128) + 96 : id;
        let source = ts.graphics.subarray(ix * 16, ix * 16 + 16);
        if (["johto", "modern"].includes(set) && ix >= 10 && ix < 19) {
          const r = [0x190a8, 0x1c0cc, 0x1c15c, 0x1c1ec, 0x1c27c][roof % 5];
          source = this.rom.subarray(r + (ix - 10) * 16, r + (ix - 9) * 16);
        }
        const p = attr & 7,
          time = indoor ? 4 : night ? 2 : 1;
        let colors = Array.from({ length: 4 }, (_, i) =>
          this.color(0xb319 + time * 64 + p * 8 + i * 2),
        );
        if (p === 6 && !indoor) {
          const groups = [24, 10, 8, 1, 11],
            a = 0xb569 + groups[roof % 5] * 8 + (night ? 4 : 0);
          colors[1] = this.color(a);
          colors[2] = this.color(a + 2);
        }
        if (p === 3 && !indoor)
          colors = Array.from({ length: 4 }, (_, i) =>
            this.color(0xb319 + 320 + (night ? 8 : 0) + i * 2),
          );
        this.paint(pixels, 16, source, tx * 8, ty * 8, colors, false);
      }
    return new ImageData(pixels, 16, 16);
  }
  sprite(id: number, back = false, { form = 0, shiny = false } = {}): ImageData {
    const egg = id === 253 && !back;
    if (!egg && (id < 1 || id > 251)) throw Error("Invalid species");
    const ptr =
      (id === 201 ? 0x124000 + form * 6 : 0x120000 + (id - 1) * 6) + (back ? 3 : 0);
    const bank = this.rom[ptr] + 0x36;
    const address = this.rom[ptr + 1] | (this.rom[ptr + 2] << 8);
    const offset = bank * 0x4000 + (address & 0x3fff);
    const bytes = this.bytes(
      this.rom.subarray(offset, Math.min(offset + 0x4000, this.rom.length)),
      (p, n) => this.wasm.decompress(p, n),
    );
    const side = egg ? 5 : back ? 6 : this.rom[0x51424 + (id - 1) * 32 + 17] >> 4;
    const size = side * 8;
    const pixels = new Uint8ClampedArray(size * size * 4);
    const pal = 0xa8ce + id * 8 + (shiny ? 4 : 0);
    const colors = [
      [255, 255, 255],
      ...[0, 1].map((i) => {
        const c = this.rom[pal + i * 2] | (this.rom[pal + i * 2 + 1] << 8);
        return [
          ((c & 31) * 255) / 31,
          (((c >> 5) & 31) * 255) / 31,
          (((c >> 10) & 31) * 255) / 31,
        ];
      }),
      [0, 0, 0],
    ];
    for (let x = 0; x < size; x++)
      for (let y = 0; y < size; y++) {
        const t =
          (Math.floor(x / 8) * side + Math.floor(y / 8)) * 16 + (y % 8) * 2;
        const bit = 7 - (x % 8);
        const c = ((bytes[t] >> bit) & 1) | (((bytes[t + 1] >> bit) & 1) << 1);
        const dst = (y * size + x) * 4;
        pixels.set([...colors[c], 255], dst);
      }
    this.clearExterior(pixels, size, size);
    return new ImageData(pixels, size, size);
  }
  /** Synthesize a cartridge sound-effect ID using the imported ROM. Sample rate: 47662 Hz. */
  soundEffect(id: number): Float32Array {
    if (!Number.isInteger(id) || id <= 0 || id >= CRYSTAL_SFX_COUNT)
      throw Error("Unsupported sound effect");
    const bytes = this.bytes(this.rom, (p, n) =>
      this.wasm.sound_effect(p, n, id),
    );
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
  }
  battleSound(id: number, param: number, capture?: CaptureSoundState) {
    return decodeBattleSound(this.rom, id, param, capture);
  }
  cry(id: number, lengthOffset = 0): Float32Array {
    if (id < 1 || id > 251) throw Error("Invalid species");
    const bytes = this.bytes(this.rom, (p, n) => this.wasm.cry(p, n, id, lengthOffset));
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
  }
  startMusic(bank: number, addr: number): void {
    const p = this.wasm.alloc(this.rom.length);
    new Uint8Array(this.wasm.memory.buffer, p, this.rom.length).set(this.rom);
    try {
      if (!this.wasm.music_start(p, this.rom.length, bank, addr))
        throw Error("Invalid music header");
    } finally {
      this.wasm.dealloc(p, this.rom.length);
    }
  }
  musicAddress(id: number): [number, number] {
    if (!Number.isInteger(id) || id < 0 || id >= 0x67)
      throw Error("Unsupported music track");
    // Crystal 1.1's Music table at 3a:506e.
    const offset = 0x3a * 0x4000 + 0x106e + id * 3;
    return [this.rom[offset], this.rom[offset + 1] | (this.rom[offset + 2] << 8)];
  }
  startMusicTrack(id: number): void {
    this.startMusic(...this.musicAddress(id));
  }
  nextMusicChunk(count = 48000): Float32Array {
    const p = this.wasm.music_next(count);
    const bytes = new Uint8Array(
      this.wasm.memory.buffer,
      p,
      this.wasm.output_len(),
    ).slice();
    return new Float32Array(bytes.buffer);
  }
  music(
    bank = 0x3a,
    addr = 0x7808,
    start = 0,
    count = 48000 * 10,
  ): Float32Array {
    const bytes = this.bytes(this.rom, (p, n) =>
      this.wasm.music(p, n, bank, addr, start, count),
    );
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
  }
}
function popcount(mask: number): number {
  let count = 0;
  for (let bits = mask & 255; bits; bits &= bits - 1) count++;
  return count;
}
export class Battle {
  constructor(
    private engine: Engine,
    private current: BattleSnapshot,
  ) {}
  snapshot(): BattleSnapshot {
    return this.current;
  }
  act(index: number): BattleSnapshot {
    return (this.current = this.engine.act(index));
  }
}
export class UnsupportedCartridge extends Error {}

export async function initEngine(rom: Uint8Array): Promise<Engine> {
  if (rom.length !== 2097152)
    throw new UnsupportedCartridge("Please choose an English Pokémon Crystal 1.1 ROM.");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-1", new Uint8Array(rom).buffer),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== "f4cd194bdee0d04ca4eac29e09b8e4e9d818c133")
    throw new UnsupportedCartridge(
      "Unsupported ROM: Pokémon Crystal (English) version 1.1 is required.",
    );
  const response = await fetch("./astra_native.wasm");
  if (!response.ok) throw Error("Native engine unavailable");
  const { instance } = await WebAssembly.instantiate(
    await response.arrayBuffer(),
    {},
  );
  return new Engine(instance.exports as unknown as Exports, rom.slice());
}
