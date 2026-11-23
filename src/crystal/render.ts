/** Draws the Crystal overworld: the map and its neighbours, animated tiles, people and the player. */
import { C, CONST } from "./symbols";
import { CrystalGraphics, type Rgb, type TimeOfDay } from "./gfx";
import type { CrystalGame, Mover, Obj } from "./runtime";
import type { LiveMap } from "./world";

const WALK_SECONDS = 1 / 4.2;
const EMOTES: Record<string, string> = { EMOTE_SHOCK: "!", EMOTE_QUESTION: "?", EMOTE_HAPPY: "♪", EMOTE_SAD: "…", EMOTE_HEART: "♥", EMOTE_BOLT: "⚡", EMOTE_SLEEP: "z", EMOTE_FISH: "~" };

export class CrystalRenderer {
  readonly gfx: CrystalGraphics;
  private ctx2d: CanvasRenderingContext2D;
  constructor(private game: CrystalGame, canvas: HTMLCanvasElement) {
    this.gfx = new CrystalGraphics(game.rom, data => game.engine.decompress(data));
    this.ctx2d = canvas.getContext("2d")!;
  }
  private time(map: LiveMap): TimeOfDay {
    return this.gfx.timeFor(map, this.game.timeOfDay(), this.game.flash);
  }
  render(now: number) {
    const g = this.game, c = this.ctx2d, map = g.map;
    c.imageSmoothingEnabled = false;
    const pos = (m: Mover) => {
      if (!m.from) return { x: (m.free?.x ?? m.x) * 16, y: (m.free?.y ?? m.y) * 16, lift: 0 };
      const t = Math.min(1, m.from.t);
      return { x: (m.from.x + (m.x - m.from.x) * t) * 16, y: (m.from.y + (m.y - m.from.y) * t) * 16, lift: m.from.hop ? Math.sin(t * Math.PI) * 8 : 0 };
    };
    const p = pos(g.me);
    const shake = g.shake > 0 ? Math.round(Math.sin(now / 30) * 2) : 0;
    const camX = Math.round(p.x + 8 - 160) + shake, camY = Math.round(p.y + 8 - 120);
    const time = this.time(map), pals = this.gfx.bgPalettes(map, time), key = `${time}:${pals[6].flat().join(",")}`;
    c.fillStyle = `rgb(${pals[0][0].join(",")})`;
    c.fillRect(0, 0, 320, 240);
    // The border block fills everything beyond the map and its neighbours.
    const border = this.gfx.block(map.tileset, map.border, pals, key);
    const bx0 = Math.floor(camX / 32), by0 = Math.floor(camY / 32);
    for (let by = by0; by <= by0 + 8; by++)
      for (let bx = bx0; bx <= bx0 + 10; bx++) c.drawImage(border, bx * 32 - camX, by * 32 - camY);
    for (const conn of map.connections) {
      const o = g.world.connectionOrigin(map, conn.dir);
      const t = g.neighbour(o.target.group, o.target.number);
      const tPals = this.gfx.bgPalettes(t, this.time(t));
      c.drawImage(this.gfx.map(t, tPals, `${this.time(t)}:${tPals[6].flat().join(",")}`), o.x * 16 - camX, o.y * 16 - camY);
    }
    const ground = this.gfx.map(map, pals, key, map.version);
    c.drawImage(ground, -camX, -camY);
    const frame = Math.floor(now / 280);
    for (const t of this.gfx.animatedTiles(map, map.version)) {
      const x = t.x - camX, y = t.y - camY;
      if (x < -8 || y < -8 || x > 320 || y > 240) continue;
      c.drawImage(this.gfx.frame(t.kind, frame, pals[t.slot]), x, y);
    }
    // People, back to front.
    const objPals = this.gfx.objPalettes(time);
    const drawn: { y: number; draw: () => void }[] = [];
    const add = (m: Mover, sprite: number, pal: Rgb[], palKey: string) => {
      if (m.invisible || !sprite) return;
      const at = pos(m);
      const walking = m.from ? Math.floor(m.from.t * 2) % 2 === 0 && Math.floor(m.walkFrame / WALK_SECONDS) % 2 === 0 : !!m.moving && Math.floor((m.stride ?? 0) * 2) % 2 === 1;
      const leg = m.from ? Math.floor(m.walkFrame / WALK_SECONDS) : Math.floor(m.stride ?? 0);
      drawn.push({
        y: at.y, draw: () => {
          const img = this.gfx.sprite(sprite, m.facing, walking, leg, pal, palKey);
          if (!img) return;
          const x = Math.round(at.x - camX), y = Math.round(at.y - camY - 4 - at.lift);
          c.drawImage(img, x, y);
          if (!at.lift) this.grass(c, map, pals, key, Math.round(at.x), Math.round(at.y - 4), camX, camY);
          if (m.emote) this.emote(c, m.emote.kind, x, y - 16);
        },
      });
    };
    for (const o of g.objects) if (o.visible) {
      const sprite = g.spriteOf(o), pal = this.objectPalette(o, sprite);
      add(o, sprite, objPals[pal], `${time}:${pal}`);
    }
    const player = this.playerSprite();
    const playerPal = this.gfx.spritePalette(player);
    add(g.me, player, objPals[playerPal], `${time}:${playerPal}`);
    drawn.sort((a, b) => a.y - b.y).forEach(d => d.draw());
    // Dark caves without Flash.
    if (map.palette === C("PALETTE_DARK") && !g.flash) {
      const px = Math.round(p.x - camX + 8), py = Math.round(p.y - camY + 4);
      const grad = c.createRadialGradient(px, py, 10, px, py, 30);
      grad.addColorStop(0, "rgba(4,4,10,0)");
      grad.addColorStop(1, "rgba(4,4,10,0.97)");
      c.fillStyle = grad;
      c.fillRect(0, 0, 320, 240);
    }
    if (g.fade > 0) {
      c.fillStyle = `rgba(8,8,16,${g.fade})`;
      c.fillRect(0, 0, 320, 240);
    }
  }
  private objectPalette(o: Obj, sprite: number) {
    // object_event colors with bit 3 set replace the sprite's own palette.
    if (o.event.color & 8) return o.event.color & 7;
    return this.gfx.spritePalette(sprite);
  }
  private playerSprite() {
    const g = this.game, girl = g.save.gender === 1;
    if (g.save.state === "surf") return C("SPRITE_SURF");
    if (g.save.state === "bike") return C(girl ? "SPRITE_KRIS_BIKE" : "SPRITE_CHRIS_BIKE");
    return C(girl ? "SPRITE_KRIS" : "SPRITE_CHRIS");
  }
  /**
   * Tall grass: Crystal puts the lower half of anyone standing in it behind the
   * background (OAM_PRIO), so the grass blades cover it and it shows through
   * the gaps between them (the tiles' color 0).
   */
  private grass(c: CanvasRenderingContext2D, map: LiveMap, pals: Rgb[][], key: string, sx: number, sy: number, camX: number, camY: number) {
    const top = sy + 8, bottom = sy + 16, g = this.game;
    for (let tx = Math.floor(sx / 16); tx <= Math.floor((sx + 15) / 16); tx++)
      for (let ty = Math.floor(top / 16); ty <= Math.floor((bottom - 1) / 16); ty++) {
        if (!g.world.inside(map, tx, ty) || !g.world.isTallGrass(g.world.collision(map, tx, ty))) continue;
        const x0 = Math.max(sx, tx * 16), x1 = Math.min(sx + 16, tx * 16 + 16), y0 = Math.max(top, ty * 16), y1 = Math.min(bottom, ty * 16 + 16);
        if (x1 <= x0 || y1 <= y0) continue;
        const bx = tx >> 1, by = ty >> 1, cover = this.gfx.block(map.tileset, g.world.block(map, bx, by), pals, key, true);
        c.drawImage(cover, x0 - bx * 32, y0 - by * 32, x1 - x0, y1 - y0, x0 - camX, y0 - camY, x1 - x0, y1 - y0);
      }
  }
  private emote(c: CanvasRenderingContext2D, kind: number, x: number, y: number) {
    const name = Object.keys(EMOTES).find(n => CONST[n] === kind);
    c.fillStyle = "#fff";
    c.strokeStyle = "#222";
    c.beginPath();
    c.roundRect(x + 1.5, y + 1.5, 13, 12, 3);
    c.fill();
    c.stroke();
    c.fillStyle = name === "EMOTE_SHOCK" ? "#d03030" : "#2a2a2a";
    c.font = "bold 11px monospace";
    c.textAlign = "center";
    c.fillText(name ? EMOTES[name] : "!", x + 8, y + 11);
    c.textAlign = "start";
  }
}
