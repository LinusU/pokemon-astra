/** Field moves: Cut, Surf, Strength, Flash, Fly, Dig, Teleport and Softboiled. */
import type { Pokemon } from "../engine";
import { MAP, SPRITE, SYM, TILESET } from "./symbols";
import type { YellowGame } from "./runtime";
import { STEP } from "./world";

export const FIELD_MOVES = {
  cut: { move: 15, badge: 1, name: "CUT" },
  fly: { move: 19, badge: 2, name: "FLY" },
  surf: { move: 57, badge: 4, name: "SURF" },
  strength: { move: 70, badge: 3, name: "STRENGTH" },
  flash: { move: 148, badge: 0, name: "FLASH" },
  dig: { move: 91, badge: -1, name: "DIG" },
  teleport: { move: 100, badge: -1, name: "TELEPORT" },
  softboiled: { move: 135, badge: -1, name: "SOFTBOILED" },
} as const;
export type FieldMove = keyof typeof FIELD_MOVES;

export function knownFieldMoves(mon: Pokemon): FieldMove[] {
  return (Object.keys(FIELD_MOVES) as FieldMove[]).filter(k => mon.moves.includes(FIELD_MOVES[k].move));
}
/** The first party member that knows a field move, if the badge allows using it. */
export function fieldUser(game: YellowGame, move: FieldMove) {
  const { badge } = FIELD_MOVES[move];
  if (badge >= 0 && !game.hasBadge(badge)) return undefined;
  // As in Yellow, a fainted Pokémon can still use its field moves.
  return game.save.party.find(m => m.moves.includes(FIELD_MOVES[move].move));
}

const name = (game: YellowGame, mon: Pokemon) => mon.nickname || game.engine.species(mon.species).name;

function front(game: YellowGame) {
  const [dx, dy] = STEP[game.playerState.facing];
  return { x: game.playerState.x + dx, y: game.playerState.y + dy };
}

/** Whether the square ahead holds something Cut can clear. */
export function cuttableAhead(game: YellowGame) {
  const map = game.currentMap, { x, y } = front(game);
  const tile = game.world.tile(map, x, y);
  if (map.tileset === TILESET.OVERWORLD) return tile === 0x3d;
  return map.tileset === TILESET.GYM && tile === 0x50;
}

function cutSwap(game: YellowGame, block: number) {
  for (let o = game.rom.sym("CutTreeBlockSwaps"); game.rom.u8(o) !== 0xff; o += 2)
    if (game.rom.u8(o) === block) return game.rom.u8(o + 1);
  return undefined;
}

export async function useCut(game: YellowGame, mon: Pokemon) {
  const map = game.currentMap, { x, y } = front(game);
  const tile = game.world.tile(map, x, y);
  const tree = cuttableAhead(game) || (map.tileset === TILESET.OVERWORLD && tile === 0x52);
  if (!tree) return game.text("UsedCut.NothingToCutText");
  const bx = x >> 1, by = y >> 1, swap = cutSwap(game, game.block(bx, by));
  game.textVar("wNameBuffer", name(game, mon));
  await game.text("UsedCutText");
  if (swap !== undefined) game.setBlock(bx, by, swap);
  game.sfx("SFX_CUT");
}

export async function useSurf(game: YellowGame, mon: Pokemon) {
  const map = game.currentMap, { x, y } = front(game);
  if (game.save.surfing) return game.say("You're already surfing.");
  if (!game.world.isWater(map, x, y)) return game.text("NoSurfingHereText");
  game.textVar("wNameBuffer", name(game, mon));
  game.save.bike = false;
  game.save.surfing = true;
  game.follower(!!game.save.vars.pikachuStarter);
  await game.text("SurfingGotOnText");
  await game.move("player", game.playerState.facing[0].toUpperCase());
}

export async function useStrength(game: YellowGame, mon: Pokemon) {
  game.textVar("wNameBuffer", name(game, mon));
  game.strength = true;
  game.ctx.cry(mon.species);
  await game.text("UsedStrengthText");
  await game.text("CanMoveBouldersText");
}

/** Rock Tunnel stays dark until Flash lights it. */
export async function useFlash(game: YellowGame) {
  if (!game.save.vars.dark) return game.say("It's not dark here.");
  game.save.vars.dark = 0;
  await game.text("_FlashLightsAreaText");
}

const TOWNS = ["PALLET_TOWN", "VIRIDIAN_CITY", "PEWTER_CITY", "CERULEAN_CITY", "LAVENDER_TOWN", "VERMILION_CITY", "CELADON_CITY", "FUCHSIA_CITY", "CINNABAR_ISLAND", "INDIGO_PLATEAU", "SAFFRON_CITY"];

export async function useFly(game: YellowGame) {
  if (game.map >= 0x25) return game.say("You can't FLY indoors!");
  const towns = TOWNS.filter(t => game.save.visited.includes(MAP[t]));
  if (!towns.length) return game.say("There's nowhere to fly yet.");
  const destination = await game.townMap({ kind: "fly", destinations: towns.map(t => MAP[t]) }, "Fly to");
  const town = towns.find(t => MAP[t] === destination);
  if (!town) return;
  const { blackoutSpot } = await import("./services");
  const spot = blackoutSpot(game, MAP[town]);
  game.sfx("SFX_TELEPORT_ENTER_1");
  await game.warp(town, spot.x, spot.y, "down");
}

/** Dig and Teleport, like an Escape Rope, return to the last Pokémon Center. */
export async function useEscape(game: YellowGame, move: "dig" | "teleport") {
  const { escapeRope, blackoutSpot } = await import("./services");
  if (move === "dig") {
    if (!(await escapeRope(game))) return game.say("Can't use that here.");
    return;
  }
  if (game.map >= 0x25 && !(await escapeRope(game))) return game.say("Can't use that here.");
  const spot = blackoutSpot(game, game.save.blackout);
  const town = Object.keys(MAP).find(k => MAP[k] === spot.map)!;
  await game.warp(town, spot.x, spot.y, "down");
}

export async function useSoftboiled(game: YellowGame, user: number) {
  const mon = game.save.party[user];
  const cost = Math.floor(mon.stats[0] / 5);
  if (mon.hp <= cost) return game.say("Not enough HP!");
  const target = await game.choosePartyMon("Use on which POKéMON?", m => m !== mon && m.hp > 0 && m.hp < m.stats[0]);
  if (target === undefined) return;
  const other = game.save.party[target];
  mon.hp -= cost;
  other.hp = Math.min(other.stats[0], other.hp + cost);
  game.ctx.sound.heal();
  await game.say(`${name(game, other)} regained health!`);
}

export async function useFieldMove(game: YellowGame, slot: number, move: FieldMove) {
  const mon = game.save.party[slot];
  const { badge } = FIELD_MOVES[move];
  if (badge >= 0 && !game.hasBadge(badge)) return game.text("_NewBadgeRequiredText");
  if (move === "cut") return useCut(game, mon);
  if (move === "surf") return useSurf(game, mon);
  if (move === "strength") return useStrength(game, mon);
  if (move === "flash") return useFlash(game);
  if (move === "fly") return useFly(game);
  if (move === "dig" || move === "teleport") return useEscape(game, move);
  return useSoftboiled(game, slot);
}

/** Offers Cut, Surf or Strength when the player inspects a tree, water or a boulder. */
export async function fieldPrompt(game: YellowGame): Promise<boolean> {
  const map = game.currentMap, { x, y } = front(game);
  if (cuttableAhead(game)) {
    const mon = fieldUser(game, "cut");
    if (!mon) {
      await game.say("This tree looks like it can be CUT!");
      return true;
    }
    if (await ask(game, `This tree looks like it can be CUT! Use CUT with ${name(game, mon)}?`)) await useCut(game, mon);
    return true;
  }
  if (!game.save.surfing && game.world.isWater(map, x, y) && !game.world.passable(map, x, y)) {
    const mon = fieldUser(game, "surf");
    if (!mon) return false;
    if (await ask(game, `The water is calm. Use SURF with ${name(game, mon)}?`)) await useSurf(game, mon);
    return true;
  }
  const boulder = game.objectAt(x, y);
  if (boulder?.object.sprite === SPRITE.SPRITE_BOULDER && !game.strength) {
    const mon = fieldUser(game, "strength");
    if (!mon) return false;
    if (await ask(game, `A boulder. Use STRENGTH with ${name(game, mon)}?`)) await useStrength(game, mon);
    return true;
  }
  return false;
}
async function ask(game: YellowGame, question: string) {
  await game.say(question, false);
  return game.yesNo();
}
