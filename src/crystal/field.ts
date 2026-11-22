/**
 * Field moves and the things the player can inspect in the field
 * (engine/events/overworld.asm): Cut, Surf, Strength, Whirlpool, Waterfall,
 * Headbutt, Rock Smash, Flash, Fly and Dig, with the cartridge's texts.
 */
import type { Pokemon } from "../engine";
import { C, CONST, MOVE, RAM, SYM, TEXT } from "./symbols";
import type { CrystalGame, Obj } from "./runtime";
import { STEP } from "./world";

export const FIELD_MOVES = {
  cut: { move: "CUT", badge: "ENGINE_HIVEBADGE" },
  fly: { move: "FLY", badge: "ENGINE_STORMBADGE" },
  surf: { move: "SURF", badge: "ENGINE_FOGBADGE" },
  strength: { move: "STRENGTH", badge: "ENGINE_PLAINBADGE" },
  flash: { move: "FLASH", badge: "ENGINE_ZEPHYRBADGE" },
  whirlpool: { move: "WHIRLPOOL", badge: "ENGINE_GLACIERBADGE" },
  waterfall: { move: "WATERFALL", badge: "ENGINE_RISINGBADGE" },
  headbutt: { move: "HEADBUTT", badge: "" },
  rocksmash: { move: "ROCK_SMASH", badge: "" },
  dig: { move: "DIG", badge: "" },
  teleport: { move: "TELEPORT", badge: "" },
  sweetscent: { move: "SWEET_SCENT", badge: "" },
} as const;
export type FieldMove = keyof typeof FIELD_MOVES;

export function knownFieldMoves(mon: Pokemon): FieldMove[] {
  return (Object.keys(FIELD_MOVES) as FieldMove[]).filter(k => mon.moves.includes(MOVE[FIELD_MOVES[k].move]));
}
function hasBadge(game: CrystalGame, move: FieldMove) {
  const badge = FIELD_MOVES[move].badge;
  return !badge || game.hasFlag(badge);
}
/** The first party Pokémon that knows a field move, when the badge allows it. */
export function fieldUser(game: CrystalGame, move: FieldMove) {
  if (!hasBadge(game, move)) return undefined;
  const i = game.save.party.findIndex(m => !m.egg && m.moves.includes(MOVE[FIELD_MOVES[move].move]));
  return i < 0 ? undefined : i;
}
function nameFor(game: CrystalGame, slot: number) {
  const m = game.save.party[slot];
  const name = m.nickname || game.monName(m.species);
  for (const b of ["wStringBuffer1", "wStringBuffer2", "wStringBuffer3"]) game.strings.set(RAM[b], name);
  game.save.vars.curPartyMon = slot;
  return name;
}
async function text(game: CrystalGame, label: string, fallback: string, wait = true) {
  const at = TEXT[label];
  if (at !== undefined) return game.engineText(at, wait);
  await game.say(fallback, false);
  if (wait) await game.waitButton();
}
async function ask(game: CrystalGame, label: string, fallback: string) {
  await text(game, label, fallback, false);
  const yes = await game.yesNo();
  if (!yes) game.closeText();
  return yes;
}

/** Block swaps for Cut and Whirlpool: (facing block, replacement) on the map's tileset. */
function swapBlock(game: CrystalGame, table: number, block: number) {
  const r = game.rom;
  if (table === undefined) return undefined;
  for (let o = table; r.u8(o) !== 0xff; o += 3) {
    if (r.u8(o) !== game.map.tileset) continue;
    for (let e = r.near(o + 1); r.u8(e) !== 0xff; e += 3) if (r.u8(e) === block) return r.u8(e + 1);
  }
  return undefined;
}
function facingBlock(game: CrystalGame) {
  const { x, y } = game.front();
  return { bx: x >> 1, by: y >> 1, x, y, block: game.world.block(game.map, x >> 1, y >> 1) };
}

export async function useCut(game: CrystalGame, slot: number) {
  const f = facingBlock(game), swap = swapBlock(game, SYM.CutTreeBlockPointers, f.block);
  if (swap === undefined) return text(game, "CutNothingText", "There's nothing to CUT here.");
  nameFor(game, slot);
  await text(game, "UseCutText", "Used CUT!", true);
  game.closeText();
  game.sfx("SFX_CUT");
  game.changeBlock(f.x, f.y, swap);
}
export async function useSurf(game: CrystalGame, slot: number) {
  if (game.save.state === "surf") return text(game, "AlreadySurfingText", "You're already SURFING.");
  const { x, y } = game.front();
  if (!game.world.isWater(game.collisionAt(x, y))) return text(game, "CantSurfText", "You can't SURF here.");
  nameFor(game, slot);
  await text(game, "UsedSurfText", "Used SURF!", true);
  game.closeText();
  game.save.state = "surf";
  game.ctx.sound?.refreshMusic();
  await game.walk(0, [game.me.facing]);
}
export async function useStrength(game: CrystalGame, slot: number) {
  nameFor(game, slot);
  game.cry(game.save.party[slot].species);
  await text(game, "Script_UsedStrength.UseStrengthText", "Used STRENGTH!");
  await text(game, "Script_UsedStrength.MoveBoulderText", "It made it possible to move boulders around.");
  game.closeText();
  game.setFlag(C("ENGINE_STRENGTH_ACTIVE"), true);
}
export async function useWhirlpool(game: CrystalGame, slot: number) {
  const f = facingBlock(game), swap = swapBlock(game, SYM.WhirlpoolBlockPointers, f.block);
  if (swap === undefined) return game.say("There's no whirlpool here.");
  nameFor(game, slot);
  await text(game, "UseWhirlpoolText", "Used WHIRLPOOL!");
  game.closeText();
  game.sfx("SFX_SURF");
  game.changeBlock(f.x, f.y, swap);
}
export async function useWaterfall(game: CrystalGame, slot: number) {
  nameFor(game, slot);
  await text(game, "Script_UsedWaterfall.UseWaterfallText", "Used WATERFALL!");
  game.closeText();
  // Climb until the water stops falling.
  for (let guard = 0; guard < 20; guard++) {
    const { x, y } = game.front();
    if (!game.world.isWaterfall(game.collisionAt(x, y))) break;
    await game.walk(0, ["up"], { speed: 0.6 });
  }
  await game.walk(0, ["up"]);
}
export async function useHeadbutt(game: CrystalGame, slot: number) {
  nameFor(game, slot);
  await text(game, "UseHeadbuttText", "Used HEADBUTT!");
  game.closeText();
  game.sfx("SFX_SANDSTORM");
  const trees = game.rom.treeMons(game.map.group, game.map.number);
  const rare = ((game.save.playerId % 10) + game.me.x + game.me.y) % 10;
  const list = trees && (rare === 0 ? trees.rare : trees.common);
  if (!list?.length || Math.random() < 0.4) return text(game, "HeadbuttNothingText", "Nope. Nothing…");
  let roll = Math.random() * 100;
  const pick = list.find(e => (roll -= e.chance) < 0) ?? list[0];
  game.save.vars.battleType = C("BATTLETYPE_TREE");
  game.battleSetup = { kind: "wild", species: pick.species, level: pick.level };
  await game.startBattle();
  await game.afterBattle();
}
export async function useRockSmash(game: CrystalGame, slot: number, rock: Obj) {
  nameFor(game, slot);
  await text(game, "UseRockSmashText", "Used ROCK SMASH!");
  game.closeText();
  game.sfx("SFX_STRENGTH");
  rock.visible = false;
  if (rock.event.flag >= 0) game.setEvent(rock.event.flag, true);
  const rocks = game.rom.treeMons(game.map.group, game.map.number, true);
  if (rocks?.common.length && Math.random() < 0.4) {
    let roll = Math.random() * 100;
    const pick = rocks.common.find(e => (roll -= e.chance) < 0) ?? rocks.common[0];
    game.battleSetup = { kind: "wild", species: pick.species, level: pick.level };
    await game.startBattle();
    await game.afterBattle();
  }
}
export async function useFlash(game: CrystalGame, slot: number) {
  if (game.map.palette !== C("PALETTE_DARK") || game.flash) return game.say("It's not dark here.");
  nameFor(game, slot);
  game.flash = true;
  const at = TEXT._BlindingFlashText;
  if (at !== undefined) await game.engineText(at);
  game.closeText();
}
export async function useFly(game: CrystalGame) {
  const env = game.map.environment;
  if (env !== C("TOWN") && env !== C("ROUTE")) return game.say("You can't FLY here.");
  const r = game.rom, points: { name: string; spawn: number }[] = [];
  // FlyMap: the region the player is in; Kanto's towns once the Indigo Plateau is visited.
  const kantoAt = C("KANTO_LANDMARK"), visited = (spawn: number) => game.flag(C("ENGINE_FLYPOINT_PLAYERS_HOUSE") + spawn);
  const kanto = game.landmark() >= kantoAt && visited(C("SPAWN_INDIGO"));
  for (let i = 0, o = SYM.Flypoints; r.u8(o) !== 0xff && i < 32; i++, o += 2) {
    const landmark = r.u8(o), spawn = r.u8(o + 1);
    // HasVisitedSpawn checks the flag of the point's spawn, not of its place in the list.
    if ((landmark >= kantoAt) !== kanto || !visited(spawn)) continue;
    points.push({ name: r.landmarkName(landmark), spawn });
  }
  if (!points.length) return game.say("There's nowhere to FLY to yet.");
  const pick = await game.choose(points.map(p => p.name), { title: "Where to?", cancel: true });
  if (pick === undefined) return;
  const { spawnPoint } = await import("./services");
  const spot = spawnPoint(game, points[pick].spawn);
  game.sfx("SFX_FLY");
  game.save.state = game.save.state === "surf" ? "normal" : game.save.state;
  await game.warpTo(spot.group, spot.number, spot.x, spot.y, "down");
}
/** Dig, Teleport and the Escape Rope lead back outside or to the last Pokémon Center. */
export async function useEscape(game: CrystalGame, kind: "dig" | "teleport" | "rope") {
  const env = game.map.environment;
  const { blackoutSpot } = await import("./services");
  if (kind === "teleport") {
    if (env !== C("TOWN") && env !== C("ROUTE")) return game.say("You can't TELEPORT here.");
    const spot = blackoutSpot(game);
    return game.warpTo(spot.group, spot.number, spot.x, spot.y, "down");
  }
  if (env !== C("CAVE") && env !== C("DUNGEON")) return game.say("You can't use that here.");
  const dig = game.save.vars.digGroup ? { group: game.save.vars.digGroup, number: game.save.vars.digNumber, x: game.save.vars.digX, y: game.save.vars.digY } : undefined;
  const spot = dig ?? blackoutSpot(game);
  await game.warpTo(spot.group, spot.number, spot.x, spot.y, "down");
}

export async function useFieldMove(game: CrystalGame, slot: number, move: FieldMove) {
  if (!hasBadge(game, move)) return text(game, "_BadgeRequiredText", "Sorry! A new BADGE is required.");
  const { x, y } = game.front();
  const rock = game.objects.find(o => o.visible && o.x === x && o.y === y);
  switch (move) {
    case "cut": return useCut(game, slot);
    case "surf": return useSurf(game, slot);
    case "strength": return useStrength(game, slot);
    case "whirlpool": return useWhirlpool(game, slot);
    case "waterfall": return game.world.isWaterfall(game.collisionAt(x, y)) ? useWaterfall(game, slot) : game.say("There's no waterfall here.");
    case "headbutt": return game.world.isHeadbuttTree(game.collisionAt(x, y)) ? useHeadbutt(game, slot) : game.say("There's nothing to HEADBUTT.");
    case "rocksmash": return rock && isRock(game, rock) ? useRockSmash(game, slot, rock) : game.say("There's no rock to smash.");
    case "flash": return useFlash(game, slot);
    case "fly": return useFly(game);
    case "dig": return useEscape(game, "dig");
    case "teleport": return useEscape(game, "teleport");
    case "sweetscent": {
      const { tryWildEncounter } = await import("./battle");
      return tryWildEncounter(game);
    }
  }
}
function isRock(game: CrystalGame, o: Obj) {
  return o.event.sprite === CONST.SPRITE_ROCK;
}
function isBoulder(game: CrystalGame, o: Obj) {
  return o.event.sprite === CONST.SPRITE_BOULDER || o.event.movement === CONST.SPRITEMOVEDATA_STRENGTH_BOULDER;
}

/** Inspecting a tree, the water, a whirlpool, a waterfall, a boulder or a rock offers the field move. */
export async function fieldPrompt(game: CrystalGame) {
  const { x, y } = game.front();
  const coll = game.collisionAt(x, y);
  const o = game.objects.find(o => o.visible && o.x === x && o.y === y);
  if (game.world.isCutTree(coll)) {
    const slot = fieldUser(game, "cut");
    if (slot === undefined) return text(game, "CanCutText", "This tree can be CUT!");
    if (await ask(game, "AskCutText", "This tree can be CUT! Want to use CUT?")) await useCut(game, slot);
    return;
  }
  if (game.world.isWhirlpool(coll)) {
    const slot = fieldUser(game, "whirlpool");
    if (slot === undefined) return text(game, "Script_MightyWhirlpool.MayPassWhirlpoolText", "It's a vicious whirlpool!");
    if (await ask(game, "AskWhirlpoolText", "A whirlpool is in the way. Want to use WHIRLPOOL?")) await useWhirlpool(game, slot);
    return;
  }
  if (game.world.isWaterfall(coll) && game.save.state === "surf") {
    const slot = fieldUser(game, "waterfall");
    if (slot === undefined) return text(game, "Script_CantDoWaterfall.HugeWaterfallText", "Wow, it's a huge waterfall.");
    if (await ask(game, "Script_AskWaterfall.AskWaterfallText", "Do you want to use WATERFALL?")) await useWaterfall(game, slot);
    return;
  }
  if (game.world.isHeadbuttTree(coll)) {
    const slot = fieldUser(game, "headbutt");
    if (slot !== undefined && await ask(game, "AskHeadbuttText", "A POKéMON could be in this tree. Want to HEADBUTT it?")) await useHeadbutt(game, slot);
    return;
  }
  if (game.save.state !== "surf" && game.world.isWater(coll)) {
    const slot = fieldUser(game, "surf");
    if (slot !== undefined && await ask(game, "AskSurfText", "The water is calm. Want to SURF?")) await useSurf(game, slot);
    return;
  }
  if (o && isRock(game, o)) {
    const slot = fieldUser(game, "rocksmash");
    if (slot !== undefined && await ask(game, "AskRockSmashText", "This rock looks breakable. Want to use ROCK SMASH?")) await useRockSmash(game, slot, o);
    return;
  }
  if (o && isBoulder(game, o) && !game.hasFlag("ENGINE_STRENGTH_ACTIVE")) {
    const slot = fieldUser(game, "strength");
    if (slot !== undefined && await ask(game, "AskStrengthText", "A POKéMON may be able to move this. Want to use STRENGTH?")) await useStrength(game, slot);
  }
}

/** Pushes a Strength boulder ahead of the player. */
export function pushBoulder(game: CrystalGame, o: Obj) {
  if (!game.hasFlag("ENGINE_STRENGTH_ACTIVE") || !isBoulder(game, o) || o.from) return false;
  const [dx, dy] = STEP[game.me.facing], x = o.x + dx, y = o.y + dy;
  const coll = game.collisionAt(x, y);
  if (game.blocked(x, y, o) || !game.world.isLand(coll) && !game.world.isPit(coll)) return false;
  game.sfx("SFX_STRENGTH");
  void game.walk(o.slot, [game.me.facing]).then(async () => {
    o.home = { x: o.x, y: o.y };
    if (!game.world.isPit(game.collisionAt(o.x, o.y))) return;
    // CmdQueue_StoneTable: a boulder that stops on a hole runs the map's script for that
    // hole and boulder, which drops it to the floor below (Ice Path, Blackthorn Gym).
    const script = stoneScript(game, o);
    if (script !== undefined) {
      const { runScript } = await import("./script");
      await game.runScript(() => runScript(game, script));
      return;
    }
    o.visible = false;
    if (o.event.flag >= 0) game.setEvent(o.event.flag, true);
  });
  return true;
}
/** The stone table entry (warp number, object, script) for a boulder sitting on a warp, from the map's command queue. */
function stoneScript(game: CrystalGame, o: Obj) {
  const queue = game.save.vars.cmdQueue, r = game.rom;
  if (!queue || r.u8(queue) !== CONST.CMDQUEUE_STONETABLE) return undefined;
  const bank = r.bankOf(queue), warp = game.map.warps.findIndex(w => w.x === o.x && w.y === o.y) + 1;
  if (!warp) return undefined;
  for (let e = r.at(bank, r.u16(queue + 1)), i = 0; r.u8(e) !== 0xff && i < 32; e += 4, i++)
    if (r.u8(e) === warp && r.u8(e + 1) === o.event.id) return r.at(bank, r.u16(e + 2));
  return undefined;
}

// ------------------------------------------------------------------ fishing
export async function fish(game: CrystalGame, rod: 0 | 1 | 2) {
  const { x, y } = game.front();
  // TryFish: not while surfing, and only at water with nobody in the way.
  if (game.save.state === "surf" || !game.world.isWater(game.collisionAt(x, y)) || game.blocked(x, y)) return game.say("You can't fish here.");
  await game.delay(30);
  const { bite, table } = game.rom.fish(game.map.fishGroup, rod);
  const night = game.timeOfDay() === 2;
  if (Math.random() * 256 >= bite || !table.length) {
    const at = TEXT.RodNothingText ?? TEXT._RodNothingText;
    if (at !== undefined) await game.engineText(at); else await game.say("Not even a nibble!");
    game.closeText();
    return;
  }
  let roll = Math.random() * 256;
  let pick = table.find(e => roll < e.chance + 1) ?? table[table.length - 1];
  void roll;
  if (!pick.species) {
    const t = game.rom.timeFish(pick.level, night);
    pick = { ...pick, species: t.species, level: t.level };
  }
  const at = TEXT.RodBiteText ?? TEXT._RodBiteText;
  if (at !== undefined) await game.engineText(at); else await game.say("Oh! A bite!");
  game.closeText();
  game.save.vars.battleType = C("BATTLETYPE_FISH");
  game.battleSetup = { kind: "wild", species: pick.species, level: pick.level };
  await game.startBattle();
  await game.afterBattle();
}
