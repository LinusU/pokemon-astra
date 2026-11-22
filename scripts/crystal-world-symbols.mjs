#!/usr/bin/env node
// Builds a Crystal adventure symbol table (src/crystal/generated/*.ts) from a
// local pret/pokecrystal-style checkout that has been built (pokecrystal.gbc
// and pokecrystal.sym present).
//
// The Crystal adventures read Johto and Kanto from the player's own
// cartridge. The output only holds ROM offsets, RAM addresses, identifier
// names and the numeric values of the source's constants; no game content.
//
//   node scripts/crystal-world-symbols.mjs ../pokecrystal --out symbols-crystal.ts --source "pret/pokecrystal"
//   node scripts/crystal-world-symbols.mjs ../Pokemon_Crystal_Legacy --out symbols-legacy.ts --source "Crystal Legacy V1.3.1"
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : fallback;
};
const outName = option("--out", "symbols-crystal.ts");
const source = option("--source", "pret/pokecrystal");
const root = args[0] ?? "../pokecrystal";
const read = path => readFileSync(join(root, path), "utf8");
const strip = line => line.replace(/;.*$/, "");

// ------------------------------------------------------------------ labels
const rom = new Map(), ram = new Map(), byOffset = new Map();
for (const line of read("pokecrystal.sym").split("\n")) {
  const m = /^([0-9a-f]{2}):([0-9a-f]{4}) (\S+)$/.exec(line.trim());
  if (!m) continue;
  const bank = parseInt(m[1], 16), addr = parseInt(m[2], 16), name = m[3];
  if (addr < 0x8000) {
    if (bank === 0 && addr >= 0x4000) continue;
    const offset = bank === 0 ? addr : bank * 0x4000 + (addr - 0x4000);
    if (!rom.has(name)) rom.set(name, offset);
    if (!byOffset.has(offset)) byOffset.set(offset, []);
    byOffset.get(offset).push(name);
  } else if (addr >= 0xc000 && addr < 0xe000) {
    // WRAM banks 2–7 share $d000–$dfff; keep the bank in the high bits.
    if (!ram.has(name)) ram.set(name, addr >= 0xd000 && bank > 1 ? bank * 0x10000 + addr : addr);
  } else if (addr >= 0xff80 && addr < 0xffff) {
    if (!ram.has(name)) ram.set(name, addr);
  }
}

/** ROM tables the runtime reads by name. A missing one fails the build. */
const WANTED = [
  "MapGroupPointers", "Tilesets", "TilesetBGPalette", "EnvironmentColorsPointers", "RoofPals", "MapObjectPals",
  "OverworldSprites", "SpriteMovementData", ["CollisionPermissionTable", "TileCollisionTable"],
  "JohtoGrassWildMons", "JohtoWaterWildMons", "KantoGrassWildMons", "KantoWaterWildMons",
  "SwarmGrassWildMons", "SwarmWaterWildMons", "FishGroups", "TreeMonMaps", "RockMonMaps", "TreeMons", "ContestMons",
  "Marts", "NPCTrades", "StdScripts", "SpecialsPointers", "TrainerGroups", "TrainerClassNames", "TrainerClassAttributes",
  "ItemNames", "Landmarks", "PhoneContacts", "SpecialPhoneCallList", "IconPointers", "MonMenuIcons", "Emotes",
  "ItemAttributes", "MagikarpLengths", "OddEggs", "FruitTreeItems", "HiddenItemScript",
  "SeenByTrainerScript", "TalkToTrainerScript", "FindItemInBallScript", "PlayerObjectTemplate", "FruitTreeScript", "TradeTexts",
  "EggMovePointers", "MoveNames", "PokemonNames", "TMHMMoves", "Moves", "TilesetJohtoPalMap", "SpriteMons", "TimeFishGroups",
  "TileCollisionStdScripts", "TrainerClassDVs", "TrainerEncounterMusic", "SpawnPoints", "Flypoints",
];
/** Tables that only some versions have. */
const OPTIONAL = [
  "HousePalette", "MansionPalette1", "MansionPalette2", "RadioTowerPalette", "PokeComPalette", "BattleTowerInsidePalette",
  "IcePathPalette", "GatePalette", "MapGroupRoofs", "UnusedTMHMMoves", "AnimateWaterTile.WaterTileFrames",
  "AnimateFlowerTile.FlowerTileFrames", "TilesetAnims", "BugContestantPointers", "DecorationAttributes",
  "EnvironmentColorsPointers.OutdoorColors", "EnvironmentColorsPointers.IndoorColors", "EnvironmentColorsPointers.DungeonColors",
  "BerryNames", "ApricornBalls", "PokeBallMenuTMHM", "UnownWords", "SlotsTilemap", "BargainShopData", "RooftopSaleMart1",
  "RooftopSaleMart2", "DefaultMart", "ItemPocketNames", "MenuHeader_BuySell", "PokemonPicPointers", "BugContestantPointers",
  "BugCatchingContestOverScript", "BugCatchingContestBattleScript", "CutTreeBlockPointers", "WhirlpoolBlockPointers", "HealingHPAmounts", "StatusHealingActions", "EvolutionStones", "SpecialCallOnlyWhenOutside", "SpecialCallWhereverYouAre", "HiddenItemScript",
];
const SYM = {};
// An entry may list the names older sources use; the table keeps the first.
for (const entry of WANTED) {
  const names = [entry].flat(), found = names.find(n => rom.has(n));
  if (!found) throw Error(`Missing ROM label ${names[0]}`);
  SYM[names[0]] = rom.get(found);
}
for (const name of OPTIONAL) if (rom.has(name)) SYM[name] = rom.get(name);

// ------------------------------------------------------------------ sources
function asmFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...asmFiles(path));
    else if (entry.name.endsWith(".asm")) out.push(path);
  }
  return out;
}
const sources = ["maps", "engine", "data", "home", "mobile"].filter(d => existsSync(join(root, d))).flatMap(asmFiles);

/** Assembly routines the scripts run: `callasm` targets and everything in SpecialsPointers. */
const ASM = {};
for (const file of sources) {
  let parent = "";
  for (const line of read(file).split("\n")) {
    const global = /^(\w+)::?/.exec(line);
    if (global) parent = global[1];
    const m = /^\s*(?:callasm|memcallasm)\s+(\.?\w+)/.exec(line);
    if (!m) continue;
    const name = m[1].startsWith(".") ? parent + m[1] : m[1];
    if (rom.has(name)) ASM[name] = rom.get(name);
  }
}
const SPECIALS = [];
for (const line of read("data/events/special_pointers.asm").split("\n")) {
  const m = /^\s*add_special\s+(\w+)/.exec(line);
  if (m) {
    SPECIALS.push(m[1]);
    if (rom.has(m[1])) ASM[m[1]] = rom.get(m[1]);
  }
}
const STD = [];
const stdFile = ["data/events/std_scripts.asm", "engine/events/std_scripts.asm"].find(f => existsSync(join(root, f)));
for (const line of read(stdFile).split("\n")) {
  const m = /^\s*add_stdscript\s+(\w+)/.exec(line);
  if (m) STD.push(m[1]);
}

/** The engine's own texts (menus, marts, fruit trees, phone, …), by label: maps' texts are reached through their scripts. */
const TEXT = {};
for (const file of sources.filter(f => /^(engine|home|data\/text|data\/phone|data\/events)\//.test(f))) {
  let parent = "";
  for (const line of read(file).split("\n")) {
    const global = /^(\w+)::?/.exec(line);
    if (global) parent = global[1];
    const m = /^(\.?\w+Text\w*)::?/.exec(line);
    if (!m) continue;
    const name = m[1].startsWith(".") ? parent + m[1] : m[1];
    if (rom.has(name)) TEXT[name] = rom.get(name);
  }
}

// ------------------------------------------------------------------ constants
/** Values of the source's constants, file by file, with RGBDS's const macros. */
const files = {};
const known = new Map();
let constValue = 0, constInc = 1;
const vars = { __tmhm_value__: 1, __map_value__: 1, __trainer_class__: 0 };
function evaluate(expr) {
  let e = expr.trim();
  if (!e) return undefined;
  e = e.replace(/\$([0-9a-fA-F]+)/g, (_, h) => String(parseInt(h, 16)))
    .replace(/%([01]+)/g, (_, b) => String(parseInt(b, 2)))
    .replace(/&([0-9a-fA-F]+)/g, (_, o) => String(parseInt(o, 8)))
    .replace(/\bconst_value\b/g, String(constValue))
    .replace(/\b(?:DIV|MUL)\b/g, m => (m === "DIV" ? "/" : "*"))
    .replace(/\bHIGH\(([^)]*)\)/g, "(($1) >> 8 & 255)")
    .replace(/\bLOW\(([^)]*)\)/g, "(($1) & 255)");
  let unknown = false;
  e = e.replace(/[A-Za-z_][A-Za-z0-9_.@#]*/g, name => {
    if (name in vars) return String(vars[name]);
    if (known.has(name)) return String(known.get(name));
    unknown = true;
    return "0";
  });
  if (unknown || /[^0-9+\-*/%()<>|&^~!=\s]/.test(e)) return undefined;
  try {
    const v = Function(`"use strict"; return (${e});`)();
    return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : typeof v === "boolean" ? +v : undefined;
  } catch {
    return undefined;
  }
}
function define(file, name, value) {
  if (value === undefined) return;
  known.set(name, value);
  (files[file] ??= {})[name] = value;
}
const MAP = {};
let group = 0;
function constants(file) {
  const lines = read(file).split("\n");
  let inMacro = false;
  for (const raw of lines) {
    const line = strip(raw).trim();
    if (!line) continue;
    // Macro definitions only take effect where they're used.
    if (/^MACRO\b|^\w+:\s*MACRO\b/.test(line)) { inMacro = true; continue; }
    if (inMacro) { if (/^ENDM\b/.test(line)) inMacro = false; continue; }
    let m;
    if ((m = /^const_def\b\s*(.*)$/.exec(line))) {
      const [a, b] = m[1] ? m[1].split(",") : [];
      constValue = a ? evaluate(a) ?? 0 : 0;
      constInc = b ? evaluate(b) ?? 1 : 1;
    } else if ((m = /^const\s+(\w+)$/.exec(line))) {
      define(file, m[1], constValue);
      constValue += constInc;
    } else if ((m = /^shift_const\s+(\w+)$/.exec(line))) {
      define(file, m[1], 1 << constValue);
      constValue += constInc;
    } else if ((m = /^const_skip\b\s*(.*)$/.exec(line))) {
      constValue += constInc * (m[1] ? evaluate(m[1]) ?? 1 : 1);
    } else if ((m = /^const_next\s+(.+)$/.exec(line))) {
      constValue = evaluate(m[1]) ?? constValue;
    } else if ((m = /^add_tm\s+(\w+)$/.exec(line))) {
      define(file, `TM_${m[1]}`, constValue);
      constValue += constInc;
      vars.__tmhm_value__++;
    } else if ((m = /^add_hm\s+(\w+)$/.exec(line))) {
      define(file, `HM_${m[1]}`, constValue);
      constValue += constInc;
      vars.__tmhm_value__++;
    } else if (/^add_mt\s+\w+$/.test(line)) {
      vars.__tmhm_value__++;
    } else if (/^newgroup\b/.test(line)) {
      constValue += constInc;
      group = constValue;
      vars.__map_value__ = 1;
    } else if ((m = /^map_const\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(line))) {
      MAP[m[1]] = [group, vars.__map_value__++, +m[2], +m[3]];
    } else if ((m = /^trainerclass\s+(\w+)$/.exec(line))) {
      define(file, m[1], vars.__trainer_class__++);
      constValue = 1;
      constInc = 1;
    } else if ((m = /^(?:DEF\s+)?(\w+)\s+EQU\s+(.+)$/.exec(line)) || (m = /^(?:DEF\s+)?(\w+)\s*=\s*(.+)$/.exec(line))) {
      if (m[1] in vars) vars[m[1]] = evaluate(m[2]) ?? vars[m[1]];
      else define(file, m[1], evaluate(m[2]));
    } else if ((m = /^(?:DEF\s+)?(\w+)\s*\+=\s*(.+)$/.exec(line))) {
      if (m[1] in vars) vars[m[1]] += evaluate(m[2]) ?? 0;
    }
  }
}
const order = [];
// Newer sources list their includes in includes.asm.
for (const line of read(existsSync(join(root, "includes.asm")) ? "includes.asm" : "constants.asm").split("\n")) {
  const m = /INCLUDE\s+"(constants\/[^"]+\.asm)"/.exec(line);
  if (m) order.push(m[1]);
}
for (const file of order) constants(file);

const pick = (file, filter = () => true) => Object.fromEntries(Object.entries(files[file] ?? {}).filter(([k, v]) => filter(k, v)));
const ITEM = pick("constants/item_constants.asm", k => !/^(NUM_|ITEM_FROM_MEM|NO_ITEM$|__)/.test(k) && !/_TMNUM$|_MOVE$|_VALUE$/.test(k));
const MON = pick("constants/pokemon_constants.asm", (k, v) => v >= 1 && v <= 255 && !/^(NUM_|JOHTO_POKEMON|KANTO_POKEMON|EGG|UNOWN_|FIRST_|LAST_)/.test(k) || k === "EGG");
const MOVE = pick("constants/move_constants.asm", (k, v) => v >= 1 && v <= 255 && !/^(NUM_|STRUGGLE_|FIRST_|LAST_|ANIM_)/.test(k));
const CONST = {};
for (const file of order) {
  if (/item_constants|pokemon_constants|move_constants|hardware_constants|gfx_constants|battle_anim_constants/.test(file)) continue;
  for (const [k, v] of Object.entries(files[file] ?? {})) if (!k.startsWith("__")) CONST[k] = v;
}

// ------------------------------------------------------------------ command tables
/** Names in a `const_def` list that ends each entry with `_command` or that the macros list. */
function commandNames(file, suffix) {
  return [...read(file).matchAll(new RegExp(`^\\s*const\\s+(\\w+)${suffix}\\b`, "gm"))].map(m => m[1]);
}
const SCRIPT_COMMANDS = commandNames("macros/scripts/events.asm", "_command");
const TEXT_COMMANDS = [...read("macros/scripts/text.asm").matchAll(/^\s*const\s+(TX_\w+)/gm)].map(m => m[1]);

// ------------------------------------------------------------------ characters
const CHARMAP = Array(256).fill("");
for (const line of read(existsSync(join(root, "charmap.asm")) ? "charmap.asm" : "constants/charmap.asm").split("\n")) {
  if (/^; Japanese control/.test(line)) break;
  const m = /^\s*charmap\s+"((?:[^"\\]|\\.)*)",\s*\$([0-9a-fA-F]{2})/.exec(line);
  if (!m) continue;
  const byte = parseInt(m[2], 16);
  if (!CHARMAP[byte]) CHARMAP[byte] = m[1].replace(/\\(.)/g, "$1");
}

// ------------------------------------------------------------------ output
const rom_ = readFileSync(join(root, "pokecrystal.gbc"));
const sha1 = createHash("sha1").update(rom_).digest("hex");
const sorted = obj => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const json = v => JSON.stringify(v);
const out = `// Generated by scripts/crystal-world-symbols.mjs from ${source}. Do not edit.
// Offsets, addresses, identifier names and constant values only. All game content is read from the player's cartridge.
/* eslint-disable */
export const SOURCE = ${json(source)};
export const SHA1 = ${json(sha1)};
/** ROM tables the runtime reads. */
export const SYM: Record<string, number> = ${json(sorted(SYM))};
/** Assembly routines scripts call (\`callasm\` and specials), by name. */
export const ASM: Record<string, number> = ${json(sorted(ASM))};
/** The engine's texts, by label. */
export const TEXT: Record<string, number> = ${json(sorted(TEXT))};
/** RAM addresses. WRAM banks above 1 keep their bank in the high bits. */
export const RAM: Record<string, number> = ${json(sorted(Object.fromEntries(ram)))};
/** Map name → [group, number, width, height]. */
export const MAP: Record<string, [number, number, number, number]> = ${json(MAP)};
export const ITEM: Record<string, number> = ${json(ITEM)};
export const MON: Record<string, number> = ${json(MON)};
export const MOVE: Record<string, number> = ${json(MOVE)};
/** Every other constant of the source, by name. */
export const CONST: Record<string, number> = ${json(CONST)};
/** SpecialsPointers order. */
export const SPECIALS: string[] = ${json(SPECIALS)};
/** StdScripts order. */
export const STD: string[] = ${json(STD)};
export const SCRIPT_COMMANDS: string[] = ${json(SCRIPT_COMMANDS)};
export const TEXT_COMMANDS: string[] = ${json(TEXT_COMMANDS)};
/** Byte → character, from the English part of charmap.asm. */
export const CHARMAP: string[] = ${json(CHARMAP)};
`;
mkdirSync("src/crystal/generated", { recursive: true });
writeFileSync(join("src/crystal/generated", outName), out);
console.log(`Wrote src/crystal/generated/${outName}: ${Object.keys(SYM).length} tables, ${Object.keys(TEXT).length} texts, ${Object.keys(ASM).length} routines, ${ram.size} RAM labels, ${Object.keys(MAP).length} maps, ${Object.keys(CONST).length} constants (${sha1}).`);
