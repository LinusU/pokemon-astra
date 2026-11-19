import type { WorldMap } from "../world";
import type { Town } from "../world/atlas";

interface Pavement {
  stone: string;
  joint: string;
  edge: string;
  glaze: string;
  tile: string[];
}

// Seven-cell patterns can be picked out in the paving at the game's native resolution.
const pavements: Record<Town, Pavement> = {
  dewdrop: {
    stone: "#d8cfac", joint: "#c5bc96", edge: "#f2e1b7", glaze: "#709876",
    tile: ["...x...", ".xx.xx.", ".xxxxx.", "...x...", ".x.x.x.", "..xxx..", "...x..."],
  },
  mossford: {
    stone: "#d8c397", joint: "#c0a67d", edge: "#f1d6a5", glaze: "#9e6452",
    tile: [".xx..x.", "..xx.x.", "...xx..", "xxxxxxx", "..xx...", ".x.xx..", ".x..xx."],
  },
  bramble: {
    stone: "#d3b38b", joint: "#bb9976", edge: "#efce99", glaze: "#906845",
    tile: [".....xx", "...xxxx", "..xxx.x", ".xxx.xx", ".xx.xx.", "..xxx..", ".x....."],
  },
  tideglass: {
    stone: "#b9c8ba", joint: "#9eafa5", edge: "#e5ddbd", glaze: "#567b8b",
    tile: ["..xxx..", "..x.x..", "...x...", ".xxxxx.", "x..x..x", "xx.x.xx", "..xxx.."],
  },
  copperwick: {
    stone: "#b9b9a7", joint: "#a3a392", edge: "#d8ceb1", glaze: "#427d78",
    tile: ["..xxxx.", "..xxx..", ".xxx...", ".xxxxx.", "...xx..", "..xx...", "..x...."],
  },
  sunspire: {
    stone: "#ddc597", joint: "#c7aa7e", edge: "#f2dda6", glaze: "#418f86",
    tile: ["x..x..x", ".x...x.", "..xxx..", "x.xxx.x", "..xxx..", ".x...x.", "x..x..x"],
  },
  reedhaven: {
    stone: "#b4bb98", joint: "#a0a586", edge: "#dcd1a6", glaze: "#517660",
    tile: ["..x....", "..x..x.", "x.x..x.", "x.x..x.", ".xx.x..", "..xxx..", ".xxxxx."],
  },
  cinderfall: {
    stone: "#bba89a", joint: "#a18f86", edge: "#dac29d", glaze: "#ae654b",
    tile: ["...x...", "..xx...", "..xxx..", ".xxxx.x", "xx.x.xx", ".x...x.", "..xxx.."],
  },
  rimepeak: {
    stone: "#c3d1d0", joint: "#b0bdbf", edge: "#e6e5d4", glaze: "#7793aa",
    tile: ["x..x..x", ".x.x.x.", "..xxx..", "xxxxxxx", "..xxx..", ".x.x.x.", "x..x..x"],
  },
  bellweather: {
    stone: "#c9b6b9", joint: "#b5a2aa", edge: "#e2d1b5", glaze: "#896e91",
    tile: ["...x...", "..xxx..", ".xxxxx.", ".xxxxx.", ".x...x.", "xxxxxxx", "...x..."],
  },
  aster: {
    stone: "#aebeb5", joint: "#98aaa5", edge: "#d8d3b0", glaze: "#667995",
    tile: ["...x...", "...x.x.", "..xxx..", "xxxxxxx", "..xxx..", ".x.x...", "...x..."],
  },
  crown: {
    stone: "#c7c2ac", joint: "#aea994", edge: "#e3d4b2", glaze: "#797587",
    tile: ["...x...", "x..x..x", "xx.x.xx", "xxxxxxx", ".xxxxx.", ".x.x.x.", ".xxxxx."],
  },
};

export function paintSquareTile(c: CanvasRenderingContext2D, map: WorldMap, x: number, y: number) {
  const p = pavements[map.id as Town];
  const px = x * 16, py = y * 16;
  const outside = (dx: number, dy: number) => !"+*".includes(map.tiles[y + dy]?.[x + dx] ?? " ");
  c.fillStyle = p.stone;
  c.fillRect(px, py, 16, 16);
  c.fillStyle = p.joint;
  c.fillRect(px, py + 7, 16, 1);
  c.fillRect(px, py + 15, 16, 1);
  c.fillRect(px + 3, py, 1, 7);
  c.fillRect(px + 11, py + 8, 1, 7);
  c.fillStyle = p.edge;
  if (outside(-1, 0)) c.fillRect(px, py, 2, 16);
  if (outside(1, 0)) c.fillRect(px + 14, py, 2, 16);
  if (outside(0, -1)) c.fillRect(px, py, 16, 2);
  if (outside(0, 1)) c.fillRect(px, py + 14, 16, 2);
}

function townEmblem(c: CanvasRenderingContext2D, map: WorldMap) {
  const y = map.tiles.findIndex(row => row.includes("*"));
  if (y < 0) return;
  const x = map.tiles[y].indexOf("*") * 16 + 8, foot = y * 16 + 8;
  const p = pavements[map.id as Town];
  const octagon = (color: string, radius: number) => {
    c.fillStyle = color;
    for (let i = -radius; i <= radius; i++) {
      const width = radius - Math.max(0, Math.abs(i) - Math.floor(radius / 2));
      c.fillRect(x - width, foot + i, width * 2 + 1, 1);
    }
  };
  octagon(p.joint, 17);
  octagon(p.edge, 16);
  octagon(p.glaze, 14);
  octagon(p.stone, 12);
  p.tile.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== "x") continue;
      const left = x - 10 + i * 3, top = foot - 10 + j * 3;
      c.fillStyle = p.glaze;
      c.fillRect(left, top, 3, 3);
      c.fillStyle = "#fff8d638";
      c.fillRect(left, top, 2, 1);
    }
  });
}

function greenhouse(c: CanvasRenderingContext2D, x: number, y: number, width: number) {
  c.fillStyle = "#456762";
  c.fillRect(x - 1, y + 2, width + 2, 10);
  c.fillRect(x + 1, y - 1, width - 1, 3);
  c.fillStyle = "#88b7ac";
  c.fillRect(x, y + 2, width, 7);
  c.fillStyle = "#c6dfc5";
  for (let col = 1; col < width - 2; col += 6) {
    c.fillRect(x + col + 1, y + 2, 3, 2);
    c.fillRect(x + col, y + 4, 2, 2);
    c.fillStyle = "#59877e";
    c.fillRect(x + col + 4, y + 1, 1, 8);
    c.fillStyle = "#c6dfc5";
  }
  c.fillStyle = "#ead2a1"; c.fillRect(x - 1, y + 10, width + 2, 1);
}

function awning(c: CanvasRenderingContext2D, x: number, y: number, half: number, stripes: string[]) {
  c.fillStyle = "#534e4e"; c.fillRect(x - half - 1, y - 1, half * 2 + 2, 8);
  for (let i = -half; i < half; i += 4) {
    c.fillStyle = stripes[((i + half) / 4) % stripes.length];
    c.fillRect(x + i, y, 4, 5);
    c.fillRect(x + i + 1, y + 5, 2, 2);
  }
}

function chimneys(c: CanvasRenderingContext2D, x: number, y: number, coil: boolean) {
  for (const [dx, rise] of [[-22, 12], [22, 8]]) {
    const px = x + dx, top = y - rise;
    c.fillStyle = "#534e51"; c.fillRect(px - 4, top + 1, 8, rise + 3);
    c.fillStyle = coil ? "#71a099" : "#ab7466"; c.fillRect(px - 2, top, 4, rise + 3);
    c.fillStyle = coil ? "#c5c9a2" : "#d49d81";
    for (let sy = top + 1; sy < y; sy += 4) c.fillRect(px - 4, sy, 8, 1);
    c.fillStyle = "#5c5657"; c.fillRect(px - 4, top - 1, 8, 2);
    c.fillStyle = "#c39a79"; c.fillRect(px - 3, top - 1, 6, 1);
  }
}

export function paintTownFixtures(c: CanvasRenderingContext2D, map: WorldMap) {
  townEmblem(c, map);
  const special =
    map.id === "dewdrop" ? "lab" : map.id === "reedhaven" || map.id === "rimepeak" ? map.id + "_house" :
    map.id === "crown" ? "league" : undefined;
  const door = map.exits.find(e => special ? e.to === special : e.to.startsWith("gym"));
  if (!door) return;
  const x = door.x * 16 + 8, y = (door.y - 2) * 16;
  switch (map.id) {
    case "dewdrop":
      greenhouse(c, x - 40, y + 3, 19);
      greenhouse(c, x + 22, y + 3, 19);
      break;
    case "bramble":
      // A silk merchant's spools ornament the ridge over Fern's nursery.
      for (const left of [x - 29, x + 23]) {
        c.fillStyle = "#5e5144"; c.fillRect(left, y - 5, 7, 18);
        c.fillStyle = "#dac5a1"; c.fillRect(left + 1, y - 2, 5, 12);
        c.fillStyle = "#b29782";
        for (let sy = 0; sy < 9; sy += 3) c.fillRect(left + 1, y + sy, 5, 1);
        c.fillStyle = "#ba8653"; c.fillRect(left - 1, y - 5, 9, 3); c.fillRect(left - 1, y + 10, 9, 3);
      }
      awning(c, x, y + 28, 16, ["#8c6964", "#dfbe91"]);
      break;
    case "tideglass":
      awning(c, x, y + 29, 24, ["#53979c", "#e8ddbc"]);
      for (const dx of [-22, 20]) {
        c.fillStyle = "#aa6659"; c.fillRect(x + dx - 3, y + 9, 7, 7);
        c.fillStyle = "#f4e5bd"; c.fillRect(x + dx - 1, y + 9, 3, 2); c.fillRect(x + dx - 1, y + 14, 3, 2);
        c.fillStyle = "#5c7886"; c.fillRect(x + dx - 1, y + 11, 3, 3);
      }
      break;
    case "copperwick":
    case "cinderfall":
      chimneys(c, x, y + 3, map.id === "copperwick");
      break;
    case "sunspire":
      greenhouse(c, x - 38, y + 5, 19); greenhouse(c, x + 19, y + 5, 17);
      awning(c, x, y + 29, 20, ["#a86c50", "#d5a573", "#c79369"]);
      break;
    case "reedhaven":
      c.fillStyle = "#6a654b"; c.fillRect(x - 37, y, 63, 2);
      for (let i = -39; i < 24; i += 3) {
        c.fillStyle = i % 2 ? "#b0a370" : "#c9b985";
        c.fillRect(x + i + 1, y + 2, 2, 15); c.fillRect(x + i, y + 16, 2, 13 - Math.abs(i % 2));
      }
      c.fillStyle = "#807555"; c.fillRect(x - 39, y + 12, 63, 2);
      break;
    case "rimepeak":
      awning(c, x, y + 28, 16, ["#698b9c", "#e7e4ce"]);
      c.fillStyle = "#695c55"; c.fillRect(x - 18, y + 32, 3, 13); c.fillRect(x + 15, y + 32, 3, 13);
      c.fillStyle = "#f2eee1"; c.fillRect(x - 18, y + 27, 36, 3);
      break;
    case "crown":
      for (const side of [-1, 1]) {
        const pole = x + side * 44;
        c.fillStyle = "#5b5d5c"; c.fillRect(pole, y - 6, 3, 32);
        c.fillStyle = "#d8b17b"; c.fillRect(pole, y - 8, 3, 3);
        c.fillStyle = "#6a617c"; c.fillRect(pole + 3, y - 5, 11, 16);
        c.fillStyle = "#d2b576"; c.fillRect(pole + 4, y - 4, 9, 1); c.fillRect(pole + 8, y, 2, 6);
        c.fillRect(pole + 6, y + 2, 6, 2);
      }
      break;
  }
}
