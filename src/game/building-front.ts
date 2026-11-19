import type { Exit, WorldMap } from "../world";
import type { Palette } from "./field-palette";

/** Draw across a whole roof so the ridge, awning and front door share one footprint. */
export function paintBuildingFront(c: CanvasRenderingContext2D, map: WorldMap, e: Exit, p: Palette) {
  const row = map.tiles[e.y - 1];
  if (map.tiles[e.y]?.[e.x] !== "d" || row?.[e.x] !== "r") return;
  let first = e.x, last = e.x, top = e.y - 1;
  while (row[first - 1] === "r") first--;
  while (row[last + 1] === "r") last++;
  while (map.tiles[top - 1]?.[e.x] === "r") top--;
  const left = first * 16, right = (last + 1) * 16, ridge = top * 16;
  const door = e.x * 16 + 8, sill = e.y * 16;
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color; c.fillRect(x, y, w, h);
  };
  // Two stepped hips lead the eye up to the ridge; the shingle texture shows through.
  for (let y = ridge + 2; y < sill - 2; y += 2) {
    const inset = Math.ceil((sill - 2 - y) * 0.45);
    rect("#f9ecd332", left + 1, y, inset, 2);
    rect("#1f384852", right - inset - 1, y, inset, 2);
    rect("#f9ecd35e", left + inset, y, 2, 2);
  }
  rect(p.ink, left, sill - 3, right - left, 3);
  rect("#fff0c0a6", left + 2, sill - 3, right - left - 4, 1);
  rect("#554b544d", left + 1, sill, right - left - 2, 3);
  if (map.palette === "snow") {
    rect("#f1f3df", left + 2, ridge + 1, right - left - 4, 3);
    for (let x = left + 3; x < right - 4; x += 9) rect("#f1f3df", x, ridge + 4, 5, 2);
  }
  if (e.to.endsWith("_mart")) {
    // Canvas scallops hang above the shopfront windows, clear of the shop sign.
    const a = left + 5, b = right - 5;
    rect("#40526a", a, sill - 6, b - a, 9);
    for (let x = a + 1, stripe = 0; x < b - 1; x += 6, stripe++) {
      const w = Math.min(6, b - 1 - x);
      rect(stripe % 2 ? "#f3dfad" : "#729eab", x, sill - 5, w, 5);
      rect(stripe % 2 ? "#c8b790" : "#547f96", x, sill, w, 2);
      if (w > 2) rect(stripe % 2 ? "#e6d6b0" : "#6993a1", x + 1, sill + 2, w - 2, 1);
    }
  } else if (e.to.endsWith("_center")) {
    // The cream pediment and two-tone ball are visible well before the lettering.
    for (let k = 0; k < 6; k++) {
      rect("#674a53", door - 13 + 2 * k, ridge - k, 26 - 4 * k, 2);
      rect("#edc8a6", door - 12 + 2 * k, ridge + 1 - k, 24 - 4 * k, 1);
    }
    const x = door, y = ridge + 5;
    rect("#664a54", x - 5, y - 2, 10, 5); rect("#664a54", x - 3, y - 4, 6, 9);
    rect("#c87569", x - 3, y - 3, 6, 3); rect("#f8e8c8", x - 3, y + 1, 6, 3);
    rect("#fff3d1", x - 1, y - 1, 2, 2);
  } else if (e.to === "home") {
    rect("#615658", left + 12, ridge - 6, 7, 12);
    rect("#c48e76", left + 13, ridge - 4, 4, 8);
    rect("#66575a", left + 11, ridge - 7, 9, 3);
    rect("#d6a487", left + 11, ridge - 7, 9, 1);
    // A little gable over the family door.
    for (let i = 0; i < 7; i++) {
      rect(p.ink, door - 15 + 2 * i, sill - i - 3, 30 - 4 * i, 2);
      rect(p.roof, door - 13 + 2 * i, sill - i - 2, 26 - 4 * i, 1);
    }
  }
  // Sidelights frame the opening while keeping the threshold clearly visible.
  for (const x of [door - 9, door + 7]) {
    rect("#705e53", x, sill + 4, 3, 6);
    rect("#d7bc87", x, sill + 5, 2, 3);
  }
}

/** The lamp glass and lit windows retain their warm colors against the night palette. */
export function lightTownWindows(c: CanvasRenderingContext2D, map: WorldMap) {
  for (const e of map.exits) {
    if (map.tiles[e.y]?.[e.x] !== "d") continue;
    const door = e.x * 16 + 8, sill = e.y * 16;
    for (const side of [-1, 1]) {
      for (let x = e.x + side; map.tiles[e.y][x] === "w"; x += side) {
        if (x % 2 === 0) continue;
        c.fillStyle = "#e6ae69";
        c.fillRect(x * 16 + 4, sill + 4, 3, 6);
        c.fillRect(x * 16 + 8, sill + 4, 4, 6);
        c.fillStyle = "#ffe3a0";
        c.fillRect(x * 16 + 4, sill + 4, 3, 2);
      }
    }
    c.fillStyle = "#ffdc7d";
    c.fillRect(door - 9, sill + 5, 2, 3);
    c.fillRect(door + 7, sill + 5, 2, 3);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = ["#ffd78855", "#ffd78840", "#ffd7882b", "#ffd78816"][i];
      c.fillRect(door - 5 - i, sill + 14 + i * 3, 10 + i * 2, 3);
    }
  }
}
