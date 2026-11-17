import type { WorldMap, WorldObject } from "../world";

export type Facing = "up" | "down" | "left" | "right";
export interface ActorState {
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  notice: boolean;
  targetX: number;
  targetY: number;
  wait: number;
}
const PEOPLE = new Set([
  "person",
  "trainer",
  "leader",
  "healer",
  "shop",
  "starter",
]);
const DELTA: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
export function terrainBlocked(
  map: WorldMap,
  x: number,
  y: number,
  surf = false,
  radius = 0.22,
) {
  return [
    [-radius, -radius],
    [radius, -radius],
    [-radius, radius],
    [radius, radius],
  ].some(([dx, dy]) => {
    const tile = map.tiles[Math.floor(y + dy)]?.[Math.floor(x + dx)];
    return !tile || "#rwBCPTS".includes(tile) || (tile === "~" && !surf);
  });
}
export function facingToward(dx: number, dy: number): Facing {
  return Math.abs(dx) > Math.abs(dy)
    ? dx < 0
      ? "left"
      : "right"
    : dy < 0
      ? "up"
      : "down";
}

export function interactionDistance(
  map: WorldMap,
  player: { x: number; y: number; facing: string },
  target: { x: number; y: number },
) {
  const [fx, fy] = DELTA[player.facing as Facing] || DELTA.down;
  const dx = target.x - player.x,
    dy = target.y - player.y,
    distance = Math.hypot(dx, dy);
  if (
    distance > 1.75 ||
    dx * fx + dy * fy < 0.1 ||
    Math.abs(dx * fy - dy * fx) > 0.95
  )
    return Infinity;
  for (let d = 0.25; d < distance - 0.3; d += 0.2) {
    const tile =
      map.tiles[Math.floor(player.y + (dy / distance) * d)]?.[
        Math.floor(player.x + (dx / distance) * d)
      ];
    if (!tile || "#rw~".includes(tile)) return Infinity;
  }
  return distance;
}

/** Moving people have one shared position for drawing, interactions, collisions and trainer sight. */
export class WorldActors {
  states: Record<string, ActorState> = {};
  private mapId = "";
  private randomState = 1;
  private pursuit?: { id: string; delay: number; age: number };
  reset() {
    this.mapId = "";
    this.pursuit = undefined;
  }
  enter(map: WorldMap) {
    if (this.mapId === map.id) return;
    this.mapId = map.id;
    this.states = {};
    this.pursuit = undefined;
    this.randomState =
      [...map.id].reduce((n, c) => n * 31 + c.charCodeAt(0), 1) >>> 0;
    for (const object of map.objects) {
      if (!PEOPLE.has(object.kind)) continue;
      const facing =
        object.facing ||
        (["down", "left", "up", "right"] as Facing[])[object.id.length % 4];
      this.states[object.id] = {
        x: object.x + 0.5,
        y: object.y + 0.5,
        targetX: object.x + 0.5,
        targetY: object.y + 0.5,
        facing,
        moving: false,
        notice: false,
        wait: 0.6 + this.random() * 3,
      };
    }
  }
  private random() {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 0x100000000;
  }
  position(object: WorldObject) {
    return this.states[object.id] || { x: object.x + 0.5, y: object.y + 0.5 };
  }
  solid(map: WorldMap, x: number, y: number, ignoreId?: string) {
    return map.objects.some((object) => {
      if (object.id === ignoreId || !PEOPLE.has(object.kind)) return false;
      const other = this.position(object);
      return Math.abs(x - other.x) < 0.56 && Math.abs(y - other.y) < 0.52;
    });
  }
  face(object: WorldObject, x: number, y: number) {
    const actor = this.states[object.id];
    if (actor) {
      actor.facing = facingToward(x - actor.x, y - actor.y);
      actor.targetX = actor.x;
      actor.targetY = actor.y;
      actor.moving = false;
      actor.wait = 3;
    }
  }
  update(map: WorldMap, dt: number, player: { x: number; y: number }) {
    this.enter(map);
    if (this.pursuit) return;
    for (const object of map.objects) {
      const actor = this.states[object.id];
      if (!actor) continue;
      const radius =
        object.roam ??
        (object.kind === "person" && map.kind === "town" ? 2 : 0);
      actor.wait -= dt;
      if (actor.moving) {
        const distance = Math.hypot(
          actor.targetX - actor.x,
          actor.targetY - actor.y,
        );
        const step = Math.min(distance, dt * 1.7);
        const nx =
          actor.x + ((actor.targetX - actor.x) / (distance || 1)) * step;
        const ny =
          actor.y + ((actor.targetY - actor.y) / (distance || 1)) * step;
        if (
          Math.hypot(nx - player.x, ny - player.y) < 0.8 ||
          this.solid(map, nx, ny, object.id)
        ) {
          actor.targetX = actor.x;
          actor.targetY = actor.y;
          actor.moving = false;
          actor.wait = 1;
        } else {
          actor.x = nx;
          actor.y = ny;
          if (distance <= step + 0.001) {
            actor.moving = false;
            actor.wait = 1.4 + this.random() * 3.2;
          }
        }
      } else if (
        actor.wait <= 0 &&
        radius > 0 &&
        Math.hypot(actor.x - player.x, actor.y - player.y) > 1.3
      ) {
        const facing = (["down", "left", "up", "right"] as Facing[])[
          Math.floor(this.random() * 4)
        ];
        const [dx, dy] = DELTA[facing];
        actor.facing = facing;
        const nx = Math.floor(actor.x) + 0.5 + dx,
          ny = Math.floor(actor.y) + 0.5 + dy;
        actor.wait = 1 + this.random() * 2;
        if (
          Math.abs(nx - object.x - 0.5) <= radius &&
          Math.abs(ny - object.y - 0.5) <= radius &&
          !terrainBlocked(map, nx, ny) &&
          !this.solid(map, nx, ny, object.id) &&
          !map.exits.some(
            (e) => Math.hypot(nx - e.x - 0.5, ny - e.y - 0.5) < 1.5,
          )
        ) {
          actor.targetX = nx;
          actor.targetY = ny;
          actor.moving = true;
        }
      }
    }
  }
  spotTrainer(
    map: WorldMap,
    player: { x: number; y: number },
    eligible: (o: WorldObject) => boolean,
  ) {
    if (this.pursuit) return;
    for (const object of map.objects) {
      if (object.kind !== "trainer" || !object.trainer || !eligible(object))
        continue;
      const actor = this.states[object.id];
      if (!actor) continue;
      const dx = player.x - actor.x,
        dy = player.y - actor.y;
      const [fx, fy] = DELTA[actor.facing];
      const forward = dx * fx + dy * fy,
        lateral = Math.abs(dx * fy - dy * fx);
      if (
        forward < 0.6 ||
        forward > (object.sightRange ?? 4.5) ||
        lateral > 0.6
      )
        continue;
      let clear = true;
      for (let d = 0.5; d < forward - 0.35; d += 0.25) {
        if (
          terrainBlocked(map, actor.x + fx * d, actor.y + fy * d, false, 0.1) ||
          this.solid(map, actor.x + fx * d, actor.y + fy * d, object.id)
        ) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      actor.notice = true;
      actor.moving = false;
      this.pursuit = { id: object.id, delay: 0.75, age: 0 };
      return object;
    }
  }
  get approaching() {
    return !!this.pursuit;
  }
  approach(
    map: WorldMap,
    dt: number,
    player: { x: number; y: number },
  ): WorldObject | undefined {
    const pursuit = this.pursuit;
    if (!pursuit) return;
    const actor = this.states[pursuit.id];
    pursuit.age += dt;
    if (pursuit.delay > 0) {
      pursuit.delay -= dt;
      return;
    }
    actor.notice = false;
    const dx = player.x - actor.x,
      dy = player.y - actor.y;
    actor.facing = facingToward(dx, dy);
    if (pursuit.age > 6) {
      actor.moving = false;
      actor.wait = 3;
      this.pursuit = undefined;
      return;
    }
    if (Math.hypot(dx, dy) <= 1.0) {
      actor.moving = false;
      actor.wait = 3;
      this.pursuit = undefined;
      return map.objects.find((o) => o.id === pursuit.id);
    }
    const step = Math.min(dt * 2.7, Math.hypot(dx, dy) - 0.92);
    const nx = actor.x + (dx / Math.hypot(dx, dy)) * step,
      ny = actor.y + (dy / Math.hypot(dx, dy)) * step;
    if (!terrainBlocked(map, nx, ny) && !this.solid(map, nx, ny, pursuit.id)) {
      actor.x = nx;
      actor.y = ny;
      actor.moving = true;
    } else {
      actor.moving = false;
      actor.wait = 3;
      this.pursuit = undefined;
    }
  }
}
