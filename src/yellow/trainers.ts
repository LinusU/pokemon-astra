import { RAM } from "./symbols";
import type { MapHeader, YellowRom } from "./rom";
import type { Facing } from "./world";

export interface TrainerHeader {
  /** File offset of the header. */
  at: number;
  /** Sprite slot of the trainer on the map. */
  object: number;
  /** Event flag set once the trainer is beaten. */
  event: number;
  range: number;
  before: number;
  after: number;
  end: number;
}

function parseHeaders(rom: YellowRom, map: MapHeader, at: number) {
  const headers: TrainerHeader[] = [];
  for (let o = at; rom.u8(o) !== 0xff && headers.length < 16; o += 12) {
    const object = rom.u8(o), flag = rom.u16(o + 2);
    if (flag < RAM.wEventFlags || flag > RAM.wEventFlags + 320) break;
    headers.push({
      at: o, object, range: rom.u8(o + 1) >> 4,
      event: (flag - RAM.wEventFlags) * 8 + object,
      before: rom.far(map.bank, rom.u16(o + 4)),
      after: rom.far(map.bank, rom.u16(o + 6)),
      end: rom.far(map.bank, rom.u16(o + 8)),
    });
  }
  return headers;
}

/**
 * The map script loads its trainer list with `ld hl, Headers` before
 * `ld de, ScriptPointers`. Talk handlers point into the same list.
 */
export function trainerHeaders(rom: YellowRom, map: MapHeader): TrainerHeader[] {
  if (!map.objects.some(o => o.trainer || o.pokemon)) return [];
  for (let o = map.script; o < map.script + 48; o++) {
    if (rom.u8(o) === 0x21 && rom.u8(o + 3) === 0x11) {
      const headers = parseHeaders(rom, map, rom.far(map.bank, rom.u16(o + 1)));
      if (headers.length) return headers;
    }
  }
  return [];
}

type Seen = { x: number; y: number; facing: Facing; object: { index: number; trainer?: unknown } };
type Watcher = { save: { events: number[]; party: { hp: number }[] }; playerState: { x: number; y: number } };

/** A trainer who can see the player along their facing line, like CheckSpriteCanSeePlayer. */
export function trainerTrigger(game: Watcher, headers: TrainerHeader[], npcs: Seen[]) {
  if (!game.save.party.some(m => m.hp > 0)) return;
  const { x, y } = game.playerState;
  for (const header of headers) {
    if (game.save.events.includes(header.event) || !header.range) continue;
    const npc = npcs.find(n => n.object.index === header.object);
    if (!npc || !npc.object.trainer) continue;
    const dx = x - npc.x, dy = y - npc.y;
    const inLine =
      (npc.facing === "down" && dx === 0 && dy > 0 && dy <= header.range) ||
      (npc.facing === "up" && dx === 0 && dy < 0 && -dy <= header.range) ||
      (npc.facing === "left" && dy === 0 && dx < 0 && -dx <= header.range) ||
      (npc.facing === "right" && dy === 0 && dx > 0 && dx <= header.range);
    if (inLine) return { header, index: header.object };
  }
}
