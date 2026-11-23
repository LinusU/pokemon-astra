#!/usr/bin/env node
// Builds src/yellow/generated/symbols.ts from a local, built pret/pokeyellow
// checkout (or a fork of it, such as Yellow Legacy).
//
// The output only holds ROM offsets and identifier names, and the SHA-1 of the
// built ROM. Maps, text, graphics, music and every other part of the game are
// read from the player's own cartridge at runtime. Usage:
//   node scripts/yellow-symbols.mjs ../pokeyellow
//   node scripts/yellow-symbols.mjs LEGACY_DIR --out symbols-legacy.ts --source "Yellow Legacy V1.0.10"
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string", default: "symbols.ts" }, source: { type: "string", default: "pret/pokeyellow" } },
});
const root = positionals[0] ?? "../pokeyellow";
const read = path => readFileSync(join(root, path), "utf8");
const romSha1 = createHash("sha1").update(readFileSync(join(root, "pokeyellow.gbc"))).digest("hex");

// ---------------------------------------------------------------- symbols
const sym = new Map(), ram = new Map();
for (const line of read("pokeyellow.sym").split("\n")) {
  const m = /^([0-9a-f]{2}):([0-9a-f]{4}) (\S+)$/.exec(line.trim());
  if (!m) continue;
  const bank = parseInt(m[1], 16), addr = parseInt(m[2], 16);
  if ((addr >= 0xc000 && addr < 0xe000) || (addr >= 0xff80 && addr < 0xffff)) ram.set(m[3], addr);
  if (addr >= 0x8000) continue; // RAM labels are not cartridge data.
  if (bank === 0 && addr >= 0x4000) continue;
  sym.set(m[3], bank === 0 ? addr : bank * 0x4000 + (addr - 0x4000));
}
// Labels pret has since renamed, by their current and earlier names. The Cinnabar Gym
// quiz trainers' entries lack the Text suffix every other text entry has.
for (const [current, earlier] of [
  ["CGBBasePalettes", "GBCBasePalettes"],
  ...[1, 2, 3, 4, 5, 6, 7].map(n => [`CinnabarGymSuperNerd${n}Text`, `CinnabarGymSuperNerd${n}`]),
])
  if (!sym.has(current) && sym.has(earlier)) sym.set(current, sym.get(earlier));
const offset = name => {
  const v = sym.get(name);
  if (v === undefined) throw Error(`Missing symbol ${name}`);
  return v;
};

// ---------------------------------------------------------------- constants
const values = new Map();
let constValue = 0, constInc = 1;
function evaluate(expr) {
  const source = expr.replace(/;.*$/, "").trim()
    .replace(/\$([0-9a-fA-F]+)/g, (_, h) => String(parseInt(h, 16)))
    .replace(/%([01]+)/g, (_, b) => String(parseInt(b, 2)))
    .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, name => {
      if (!values.has(name)) throw Error(`Unknown ${name}`);
      return `(${values.get(name)})`;
    });
  if (!/^[0-9()+\-*/<>|&~ ^]*$/.test(source)) throw Error(`Unsafe ${expr}`);
  return Math.trunc(Function(`return (${source})`)());
}
function tryEvaluate(expr) {
  try { return evaluate(expr); } catch { return undefined; }
}
function define(name, value) {
  if (value !== undefined) values.set(name, value);
}
function processConstants(text, onConst) {
  for (const raw of text.split("\n")) {
    const line = raw.replace(/;.*$/, "").trim();
    let m;
    if ((m = /^const_def\s*(.*)$/.exec(line)) || line === "object_const_def" || line === "def_text_pointers" || line === "def_script_pointers") {
      if (line === "object_const_def" || line === "def_text_pointers") { constValue = 1; constInc = 1; continue; }
      if (line === "def_script_pointers") { constValue = 0; constInc = 1; continue; }
      const args = m[1] ? m[1].split(",").map(s => s.trim()) : [];
      constValue = args[0] ? evaluate(args[0]) : 0;
      constInc = args[1] ? evaluate(args[1]) : 1;
    } else if ((m = /^(?:const|const_export|map_const|trainer_const)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*(.*))?$/.exec(line))) {
      define(m[1], constValue);
      onConst?.(m[1], constValue, m[2]);
      if (line.startsWith("trainer_const")) define("OPP_" + m[1], 200 + constValue);
      if (line.startsWith("map_const")) {
        const [w, h] = m[2].split(",").map(s => evaluate(s));
        define(m[1] + "_WIDTH", w);
        define(m[1] + "_HEIGHT", h);
      }
      constValue += constInc;
    } else if ((m = /^shift_const\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(line))) {
      define(m[1], 1 << constValue);
      constValue += constInc;
    } else if ((m = /^dw_const\s+([^,]+),\s*([A-Za-z_][A-Za-z0-9_]*)$/.exec(line))) {
      define(m[2], constValue);
      onConst?.(m[2], constValue, m[1].trim());
      constValue += constInc;
    } else if ((m = /^const_skip\s*(.*)$/.exec(line))) {
      constValue += constInc * (m[1] ? evaluate(m[1]) : 1);
    } else if ((m = /^const_next\s+(.+)$/.exec(line))) {
      constValue = evaluate(m[1]);
    } else if ((m = /^DEF\s+([A-Za-z_][A-Za-z0-9_]*)\s+(?:EQU|=)\s+(.+)$/.exec(line))) {
      values.set("const_value", constValue);
      define(m[1], tryEvaluate(m[2]));
    } else if ((m = /^([A-Za-z_][A-Za-z0-9_]*)\s+EQU\s+(.+)$/.exec(line))) {
      define(m[1], tryEvaluate(m[2]));
    }
  }
}

const groups = {};
function collect(file, group, pattern) {
  const found = {};
  processConstants(read(file), (name, value) => { if (pattern.test(name)) found[name] = value; });
  groups[group] = { ...(groups[group] ?? {}), ...found };
}
for (const file of ["hardware_constants", "misc_constants", "gfx_constants", "input_constants", "type_constants",
  "battle_constants", "pokemon_data_constants", "map_data_constants", "sprite_data_constants", "text_constants",
  "menu_constants", "list_constants", "palette_constants", "script_constants", "ram_constants", "oam_constants",
  "tileset_constants", "pikachu_emotion_constants", "icon_constants", "serial_constants", "credits_constants",
  "audio_constants", "move_effect_constants"]) {
  // (Older checkouts, such as Yellow Legacy's, have no ram_constants.)
  if (existsSync(join(root, `constants/${file}.asm`))) processConstants(read(`constants/${file}.asm`));
}
collect("constants/pokemon_constants.asm", "MON", /^(?!NUM_)[A-Z_0-9]+$/);
collect("constants/pokedex_constants.asm", "DEX", /^DEX_/);
collect("constants/item_constants.asm", "ITEM", /^(?!NUM_)[A-Z_0-9]+$/);
collect("constants/move_constants.asm", "MOVE", /^(?!NUM_)[A-Z_0-9]+$/);
collect("constants/map_constants.asm", "MAP", /^(?!NUM_)[A-Z_0-9]+$/);
collect("constants/sprite_constants.asm", "SPRITE", /^SPRITE_/);
collect("constants/trainer_constants.asm", "TRAINER", /^(?!NUM_)[A-Z_0-9]+$/);
collect("constants/event_constants.asm", "EVENT", /^EVENT_/);
// Names pret has since given to events that older checkouts (Yellow Legacy's)
// still call by their earlier names: [current, earlier]. There, a map's first
// "trainer" event is Jessie and James's.
for (const [current, earlier] of [
  ["EVENT_BEAT_POKEMONTOWER_7_JESSIE_JAMES", "EVENT_BEAT_POKEMONTOWER_7_TRAINER_0"],
  ["EVENT_POKEMONTOWER_7_JESSIE_JAMES_ON_LEFT", "EVENT_BEAT_POKEMONTOWER_7_TRAINER_1"],
  ["EVENT_BEAT_MT_MOON_3_JESSIE_JAMES", "EVENT_BEAT_MT_MOON_3_TRAINER_0"],
  ["EVENT_BEAT_ROCKET_HIDEOUT_4_JESSIE_JAMES", "EVENT_BEAT_ROCKET_HIDEOUT_4_TRAINER_0"],
  ["EVENT_ROCKET_HIDEOUT_4_JESSIE_JAMES_ON_LEFT", "EVENT_BEAT_ROCKET_HIDEOUT_4_TRAINER_1"],
  ["EVENT_BEAT_SILPH_CO_11F_JESSIE_JAMES", "EVENT_BEAT_SILPH_CO_11F_TRAINER_0"],
]) if (!(current in groups.EVENT) && earlier in groups.EVENT) groups.EVENT[current] = groups.EVENT[earlier];
collect("constants/hide_show_constants.asm", "HS", /^HS_/);
collect("constants/sprite_set_constants.asm", "SPRITE_SET", /.*/);
collect("constants/tileset_constants.asm", "TILESET", /.*/);
collect("constants/palette_constants.asm", "PAL", /^PAL_/);
const CONST = Object.fromEntries(["NUM_CITY_MAPS", "FIRST_ROUTE_MAP", "FIRST_INDOOR_MAP", "NUM_MAPS"].map(n => [n, values.get(n)]));
// TMs and HMs are defined with their own macros after the item list.
{
  const text = read("constants/item_constants.asm");
  // HM01 follows the last ordinary item; the TMs follow the HMs.
  let hm = values.get("HM01") ?? 0xc4;
  for (const m of text.matchAll(/^\s*add_hm\s+([A-Z_]+)/gm)) groups.ITEM["HM_" + m[1]] = hm++;
  let tm = hm;
  for (const m of text.matchAll(/^\s*add_tm\s+([A-Z_]+)/gm)) groups.ITEM["TM_" + m[1]] = tm++;
}
// Music ids are offsets into each audio bank's header table.
const music = {};
for (const m of read("constants/music_constants.asm").matchAll(/music_const\s+(MUSIC_[A-Z0-9_]+),\s*(\w+)/g)) {
  const at = offset(m[2]);
  music[m[1]] = { id: ((at % 0x4000) - 0) / 3, bank: Math.floor(at / 0x4000) };
}
const sfx = {};
for (const m of read("constants/music_constants.asm").matchAll(/^\s*music_const\s+(SFX_[A-Z0-9_]+),\s*(\w+)/gm)) {
  const at = sym.get(m[2]);
  if (at === undefined) continue;
  sfx[m[1]] = { id: (at % 0x4000) / 3, bank: Math.floor(at / 0x4000) };
}

// ---------------------------------------------------------------- per-map constants
const mapText = {}, mapScripts = {}, mapObjects = {};
for (const file of readdirSync(join(root, "scripts")).filter(f => f.endsWith(".asm"))) {
  const label = file.replace(/\.asm$/, "");
  const text = read(`scripts/${file}`);
  const texts = {}, scripts = {};
  let mode;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/;.*$/, "").trim();
    if (line === "def_text_pointers") { mode = texts; constValue = 1; continue; }
    if (line === "def_script_pointers") { mode = scripts; constValue = 0; continue; }
    const m = /^dw_const\s+([^,]+),\s*([A-Z_0-9]+)$/.exec(line);
    if (m && mode) { mode[m[2]] = constValue; values.set(m[2], constValue); constValue++; }
    else if (line && !line.startsWith("dw_const") && mode && !/^\w+:/.test(line) === false) mode = undefined;
  }
  if (Object.keys(texts).length) mapText[label] = texts;
  if (Object.keys(scripts).length) mapScripts[label] = scripts;
}
for (const file of readdirSync(join(root, "data/maps/objects")).filter(f => f.endsWith(".asm"))) {
  const label = file.replace(/\.asm$/, "");
  const objects = {};
  let index = 1;
  for (const m of read(`data/maps/objects/${file}`).matchAll(/^\s*(object_const_def|const_export\s+([A-Z_0-9]+))/gm)) {
    if (m[1] === "object_const_def") index = 1;
    else objects[m[2]] = index++;
  }
  if (Object.keys(objects).length) mapObjects[label] = objects;
}

// ---------------------------------------------------------------- map labels
// Map id -> label prefix (PalletTown), taken from the header pointer table.
const mapLabels = [];
{
  const lines = read("data/maps/map_header_pointers.asm").split("\n");
  for (const line of lines) {
    const m = /^\s*dw\s+(\w+)_h\b/.exec(line);
    if (m) mapLabels.push(m[1]);
    else if (/^\s*dw\s+\w+/.test(line)) mapLabels.push(null);
  }
}

// ---------------------------------------------------------------- addresses
// Only the addresses the runtime looks up by name are published.
const wanted = [...sym.keys()].filter(name =>
  /Text|Movement|TrainerHeader|_TextPointers$|_Script$|_Object$|_Blocks$|_h$|Coords|Mart|HS$|Pointers$|Names$|Prices$|Table$/.test(name) ||
  [
    "MapHeaderPointers", "MapHeaderBanks", "Tilesets", "WildDataPointers", "TrainerDataPointers", "TrainerNames",
    "ItemNames", "ItemPrices", "TechnicalMachinePrices", "PokedexOrder", "MonsterNames", "SpriteSheetPointerTable",
    "MapSongBanks", "MapHSPointers", "MissableObjects", "HiddenObjectMaps", "HiddenObjectPointers", "TownMapEntries",
    "InternalMapEntries", "TownMapOrder", "TownMapOrderEnd", "CompressedMap", "WorldMapTileGraphics", "CollisionTiles", "WarpTileIDPointers", "DoorTileIDPointers",
    "LedgeTiles", "TrainerClassMoveChoiceModifications", "TrainerPicAndMoneyPointers", "TradeMons", "ExternalMapEntries",
    "BaseStats", "FlyWarpDataPtr", "NewGameWarps", "BikeRidingTilesets", "DungeonMaps1", "DungeonMaps2",
    "ForcedBikeOrSurfMaps", "SpecialTrainerMoves", "YellowLeaderMoves", "TilePairCollisionsLand", "TilePairCollisionsWater",
    "CeladonPrizeMenu", "PrizeDifferentMenuPtrs", "RedsHouse1FDefaultText", "WaterTilesets", "EvosMovesPointerTable",
    "MonPartyData", "IndigoPlateauStatues", "FossilsList", "SuperRodData", "FishingSlots", "GoodRodMons", "OldRodMons", "PrizeMonLevelDictionary",
    "SpecialWarpData", "BadgeMaps", "BadgeMaps.end", "DungeonWarpList", "DungeonWarpData", "SafariZoneEncounterLevels",
    "Music_PalletTown", "CutTreeBlockSwaps", "SpecialTrainerMoves", "BookshelfTileIDs", "MapBadgeFlags", "PlayPikachuSoundClip", "PrintText", "Bankswitch", "CheckFightingMapTrainers", "DisplayEnemyTrainerTextAndStartBattle", "EndTrainerBattle", "EnableAutoTextBoxDrawing", "ExecuteCurMapScriptInTable", "CallFunctionInTable", "SuperRodFishingSlots", "TechnicalMachines", "FlowerTile1", "FlowerTile2", "FlowerTile3", "TalkToTrainer", "TextScriptEnd", "CGBBasePalettes", "WaterTilesets", "ShoreTiles", "TilePairCollisionsWater", "WarpTileListPointers",
  ].includes(name) || /^(Tileset|Overworld|RedsHouse|Mart|Forest|Dojo|Pokecenter|Gym|House|ForestGate|Museum|Underground|Gate|Ship|ShipPort|Cemetery|Interior|Cavern|Lobby|Mansion|Lab|Club|Facility|Plateau|BeachHouse)_(GFX|Block|Coll)$/.test(name) ||
  /Sprite$/.test(name) || /^Music_[A-Za-z0-9]+$/.test(name) || /^Pikachu/.test(name),
);
// Routines that map texts reach with callfar, farcall or jpfar.
for (const file of readdirSync(join(root, "scripts")).filter(f => f.endsWith(".asm")))
  for (const m of read(`scripts/${file}`).matchAll(/\b(?:callfar|farcall|jpfar|farjp)\s+(\w+)/g))
    if (sym.has(m[1]) && !wanted.includes(m[1])) wanted.push(m[1]);
// Routines that hidden objects call by address.
for (const m of read("data/events/hidden_objects.asm").matchAll(/hidden_object\s+[^,]+,[^,]+,[^,]+,\s*(\w+)/g))
  if (sym.has(m[1]) && !wanted.includes(m[1])) wanted.push(m[1]);
const addresses = Object.fromEntries(wanted.sort().map(n => [n, sym.get(n)]));
// Work RAM read by text commands, so the runtime can fill in names and numbers.
const ramNames = new Set(["hOaksAideRequirement", "hOaksAideNumMonsOwned", "hOaksAideRewardItem", "wEventFlags", "wPlayerName", "wRivalName", "wPlayerMoney", "wPlayerCoins", "wStringBuffer", "wNameBuffer", "wcd6d", "wPikachuHappiness"]);
const walk = dir => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".asm") ? [join(dir, e.name)] : []);
for (const file of [...walk("text"), ...walk("scripts"), ...walk("engine"), ...walk("data"), ...walk("home")])
  for (const m of read(file).matchAll(/\b(?:text_ram|text_decimal|text_bcd)\s+(\w+)/g)) ramNames.add(m[1]);
const ramTable = Object.fromEntries([...ramNames].filter(n => ram.has(n)).sort().map(n => [n, ram.get(n)]));

// Text predefs, 1-based, as used by hidden objects and tx_pre.
const textPredefs = [...read("data/text_predef_pointers.asm").matchAll(/^\s*add_tx_pre\s+(\w+)/gm)].map(m => m[1]);
for (const name of textPredefs) if (sym.has(name) && !(name in addresses)) addresses[name] = sym.get(name);

// ---------------------------------------------------------------- write
const out = `// Generated by scripts/yellow-symbols.mjs from ${options.source}. Do not edit.
// Offsets and identifier names only. All game content is read from the player's cartridge.
/* eslint-disable */
export const YELLOW_SHA1 = "${romSha1}";
export const SYM: Record<string, number> = ${JSON.stringify(addresses)};
export const RAM: Record<string, number> = ${JSON.stringify(ramTable)};
export const MAP: Record<string, number> = ${JSON.stringify(groups.MAP)};
export const MAP_LABELS: (string | null)[] = ${JSON.stringify(mapLabels)};
/** TextPredefs labels; index + 1 is the predef text id. */
export const TEXT_PREDEFS: string[] = ${JSON.stringify(textPredefs)};
export const EVENT: Record<string, number> = ${JSON.stringify(groups.EVENT)};
export const HS: Record<string, number> = ${JSON.stringify(groups.HS)};
export const ITEM: Record<string, number> = ${JSON.stringify(groups.ITEM)};
export const MON: Record<string, number> = ${JSON.stringify(groups.MON)};
export const DEX: Record<string, number> = ${JSON.stringify(groups.DEX)};
export const MOVE: Record<string, number> = ${JSON.stringify(groups.MOVE)};
export const SPRITE: Record<string, number> = ${JSON.stringify(groups.SPRITE)};
export const TRAINER: Record<string, number> = ${JSON.stringify(groups.TRAINER)};
export const TILESET: Record<string, number> = ${JSON.stringify(groups.TILESET)};
export const PAL: Record<string, number> = ${JSON.stringify(groups.PAL)};
export const CONST: Record<string, number> = ${JSON.stringify(CONST)};
export const MUSIC: Record<string, { id: number; bank: number }> = ${JSON.stringify(music)};
export const SFX: Record<string, { id: number; bank: number }> = ${JSON.stringify(sfx)};
/** TEXT_* ids by map script label. */
export const MAP_TEXT: Record<string, Record<string, number>> = ${JSON.stringify(mapText)};
/** SCRIPT_* ids by map script label. */
export const MAP_SCRIPT: Record<string, Record<string, number>> = ${JSON.stringify(mapScripts)};
/** Object indexes (starting at 1) by map label. */
export const MAP_OBJECT: Record<string, Record<string, number>> = ${JSON.stringify(mapObjects)};
`;
mkdirSync("src/yellow/generated", { recursive: true });
writeFileSync(join("src/yellow/generated", options.out), out);
console.log(`symbols: ${Object.keys(addresses).length}, maps: ${mapLabels.length}, events: ${Object.keys(groups.EVENT).length}, hs: ${Object.keys(groups.HS).length}, size ${(out.length / 1024).toFixed(0)}k`);
