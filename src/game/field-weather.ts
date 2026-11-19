import type { WorldMap } from "../world";
import type { Palette } from "./field-palette";

/** A narrow shelf follows the bank, with short runs of foam along exposed edges. */
export function paintWater(c: CanvasRenderingContext2D, map: WorldMap, x: number, y: number, p: Palette, seed: number) {
  const px = x * 16, py = y * 16;
  c.fillStyle = p.water; c.fillRect(px, py, 16, 16);
  c.fillStyle = "#d9efd753";
  const wave = (seed >>> 4) % 9;
  c.fillRect(px + wave, py + 3 + seed % 7, 3 + seed % 3, 1);
  const bank = (dx: number, dy: number) => !"o~=".includes(map.tiles[y + dy]?.[x + dx] ?? "o");
  const north = bank(0,-1), south = bank(0,1), west = bank(-1,0), east = bank(1,0);
  c.fillStyle = "#c5dfb644";
  if (north) c.fillRect(px, py, 16, 4);
  if (south) c.fillRect(px, py + 12, 16, 4);
  if (west) c.fillRect(px, py, 4, 16);
  if (east) c.fillRect(px + 12, py, 4, 16);
  c.fillStyle = p.shade;
  if (north) c.fillRect(px, py, 16, 2);
  if (south) c.fillRect(px, py + 15, 16, 1);
  if (west) c.fillRect(px, py, 1, 16);
  if (east) c.fillRect(px + 15, py, 1, 16);
  c.fillStyle = "#e5efd7c0";
  if (north) c.fillRect(px + wave, py + 3, 6, 1);
  if (south) c.fillRect(px + 8 - wave, py + 13, 6, 1);
  if (west) c.fillRect(px + 2, py + wave, 1, 6);
  if (east) c.fillRect(px + 13, py + wave, 1, 6);
}

/** Each short loop stays anchored to its host tile as the camera crosses a map seam. */
export function fieldLife(c: CanvasRenderingContext2D, tile: string, biome: string, x: number, y: number, seed: number, time: number, night: boolean) {
  const phase = ((time + seed % 8963) % 9000) / 9000;
  const px = x * 16 + 8, py = y * 16 + 7;
  if (tile === "f" && seed % 11 === 0 && phase < .8) {
    const u = px + Math.round(5 * Math.sin(phase * 10)), v = py + Math.round(3 * Math.sin(phase * 15));
    if (night) {
      const pulse = Math.sin(phase * 8);
      if (pulse < .1) return;
      c.fillStyle = "#e2dc834a"; c.fillRect(u - 1, v - 1, 3, 3);
      c.fillStyle = pulse > .6 ? "#fff6a0" : "#d9ce77"; c.fillRect(u, v, 1, 1);
    } else {
      const spread = Math.floor(time / 170) % 2;
      c.fillStyle = "#685766"; c.fillRect(u, v, 1, 2);
      c.fillStyle = biome === "violet" ? "#dfb2da" : "#f3cd86";
      c.fillRect(u - 1 - spread, v - 1, 1 + spread, 2);
      c.fillRect(u + 1, v - 1, 1 + spread, 2);
    }
  } else if (biome === "autumn" && tile === "#" && seed % 13 === 0 && phase < .36) {
    const u = px + Math.round(16 * phase + 4 * Math.sin(phase * 17));
    const v = py - 4 + Math.round(34 * phase);
    c.fillStyle = "#98734d"; c.fillRect(u, v, 3, 1);
    c.fillStyle = "#e9b768"; c.fillRect(u + 1, v - 1, 2, 1);
  } else if (biome === "snow" && seed % 41 === 0 && phase < .65) {
    const u = px + Math.round(6 * phase + 3 * Math.sin(phase * 15));
    const v = py - 4 + Math.round(22 * phase);
    c.fillStyle = "#7b9ba878"; c.fillRect(u, v + 1, 2, 1);
    c.fillStyle = "#fff9e6"; c.fillRect(u, v, 2, 1);
  } else if ((tile === "~" || tile === "o") && seed % 37 === 0 && phase < .26) {
    const r = Math.floor(phase * 20) + 1;
    c.fillStyle = phase < .15 ? "#d6eee4a8" : "#d6eee458";
    c.fillRect(px - r, py, 2, 1); c.fillRect(px + r - 1, py, 2, 1);
    c.fillRect(px - r + 1, py - 1 - (r >> 2), r, 1);
    c.fillRect(px, py + 1 + (r >> 2), r, 1);
  }
}

export function nightfall(c: CanvasRenderingContext2D) {
  c.save();
  c.resetTransform();
  c.globalCompositeOperation = "multiply";
  c.fillStyle = "#8c9acb";
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.globalCompositeOperation = "source-over";
  c.fillStyle = "#25397528";
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.restore();
}
