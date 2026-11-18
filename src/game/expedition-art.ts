import type { WorldMap, WorldObject } from "../world";
import { paintRelief } from "./trail-landmarks";

type Canvas = CanvasRenderingContext2D;
const motifs = {
  wheel: [
    "   kkkkk   ",
    " kkbbhbbkk ",
    " kbhkhkhbk ",
    "kbkkkhkkkbk",
    "khhhhhhhhhk",
    "kbkkkhkkkbk",
    " kbhkhkhbk ",
    " kkbbhbbkk ",
    "   kkbkk   ",
    "    kbk    ",
  ],
  meter: [
    " kkkkkkkkkk ",
    "khhhhhhhhhhk",
    "khlwwwwwwbhk",
    "khwkkkwkkwhk",
    "khwwwkkwwwhk",
    "khhhhhhhhhhk",
    "kbbbbrbbgbbk",
    "kkkkkkkkkkkk",
    "  kbk  kbk  ",
  ],
  disk: [
    "    kkkk    ",
    "  kkllhhkk  ",
    " kllhkkhhbk ",
    "klhhkwwkhhbk",
    "khhhkwwkhbbk",
    " kbhhkkhbbk ",
    "  kkbbbbkk  ",
    "    kbbk    ",
    "   khbbhk   ",
    "  kkkkkkkk  ",
  ],
  file: [
    "  kkkkkkkk  ",
    " khllllllhk ",
    " khkkkkklhk ",
    " khllllllhk ",
    " khkkklllhk ",
    " khlllllrhk ",
    " khkkkkrlhk ",
    " khlllrllhk ",
    "  kkkkkkkk  ",
  ],
  nest: ["          ", "    ww    ", "   kllkw  ", "  hklwklk ", "khbhhkbhbk", " kbkhhbkk ", "  kkkkkk  "],
  rope: [
    "    kbbk   ",
    "   khhhhk  ",
    "  khkkkkhk ",
    " khk    khk",
    " khk    khk",
    "  khkkkkhk ",
    "   khhhhk  ",
    "    kbkhhk ",
    "    kbk khk",
  ],
  blossom: [
    "  w   w   ",
    " wlw wlw  ",
    " wlw wlw  ",
    "  w g w   ",
    " gg ggg   ",
    "  gbgg    ",
    "    g  gg ",
    "  ggg gg  ",
    "    bg    ",
  ],
  bowl: [
    "    w  w   ",
    "     w  w  ",
    " kkkkkkkkk ",
    "khlllllllhk",
    "khwwwwwwwbk",
    " khhhhhbbk ",
    "  kkbbbkk  ",
    "   kkkkk   ",
  ],
  reeds: [
    " g  g   g  ",
    " bg gg gbg ",
    " bg  g  bg ",
    " gg bg  gg ",
    " bg gg  bg ",
    " bg bg ggg ",
    "ggg gg  bg ",
    " bb bg bbb ",
    "   bbbb    ",
  ],
  horn: [
    "         kk ",
    "       kkhhk",
    "    kkkhhllk",
    "kkkkhhhhlwwk",
    "khhhhhhhlllk",
    "kkbbbkbbbhhk",
    "  kbk kkbbbk",
    "  kbk   kkk ",
    " khhhk      ",
  ],
  drum: [
    "  kkkkkkkkk ",
    " khlllllhhbk",
    "khlhbhbhbhbk",
    "khlhbhbhbhbk",
    "khhhbhbkhbbk",
    " kbbbbbbbbk ",
    "  kkkhhkkk  ",
    "    kbbk    ",
    "   kkkkkk   ",
  ],
} as const;
const regionInk: Record<string, [string, string, string]> = {
  autumn: ["#70513d", "#d69952", "#ffe29a"],
  coast: ["#47657a", "#78acaa", "#ebddae"],
  industrial: ["#57545b", "#c28857", "#f3cd84"],
  desert: ["#906149", "#ce975b", "#ffdb87"],
  wetland: ["#566748", "#9ab870", "#e6de94"],
  volcanic: ["#784b46", "#b97954", "#f9bd6c"],
  snow: ["#527c90", "#8fbfcb", "#dcffff"],
  violet: ["#645274", "#b38cad", "#eecfa2"],
  night: ["#4a516e", "#8992af", "#f5d989"],
  mountain: ["#5e5a58", "#aba08a", "#eed4a0"],
};
function stamp(c: Canvas, rows: readonly string[], palette: string, x: number, y: number, scale: number) {
  const [dark, body, light] = regionInk[palette] ?? regionInk.autumn;
  const ink: Record<string, string> = {
    k: "#333b42",
    b: dark,
    h: body,
    l: light,
    w: "#f1ecce",
    r: "#b45a49",
    g: "#698557",
  };
  const left = x - Math.floor((rows[0].length * scale) / 2);
  const top = y + 4 - rows.length * scale;
  c.fillStyle = "#303e413a";
  c.fillRect(left + 1, y + 3, rows[0].length * scale, 3);
  rows.forEach((row, j) =>
    Array.from(row).forEach((ch, i) => {
      if (ch !== " ") {
        c.fillStyle = ink[ch];
        c.fillRect(left + i * scale, top + j * scale, scale, scale);
      }
    }),
  );
}

const carved = {
  ice: "ice",
  shell: "fossil",
  ore: "cairn",
  oven: "kiln",
  bell: "chime",
  scope: "scope",
  tent: "blind",
  cairn: "cairn",
  signal: "signal",
} as const;
const storyArt: Record<string, string> = {
  undertow_objective: "horn",
  copperworks_objective: "meter",
  hourglass_objective: "disk",
  ember_objective: "file",
  frostvault_objective: "cairn",
  echo_objective: "drum",
  starfall_objective: "disk",
  victory_objective: "cairn",
  aurora_objective: "blossom",
};
export function paintFieldObject(
  c: Canvas,
  map: WorldMap,
  o: WorldObject,
  x: number,
  y: number,
  time: number,
  done: boolean,
) {
  const key = o.field?.illustration ?? storyArt[o.id];
  if (!key) return false;
  if (key in carved) paintRelief(c, carved[key as keyof typeof carved], map.palette, x, y, time);
  else if (key in motifs)
    stamp(
      c,
      motifs[key as keyof typeof motifs],
      map.palette,
      x,
      y,
      map.kind === "dungeon" || key === "bowl" ? 2 : 1,
    );
  else return false;
  if (key === "oven" && done) {
    c.fillStyle = "#ffd98a";
    c.fillRect(x - 2, y - 4, 4, 5);
  }
  if (key === "meter" && done) {
    c.fillStyle = "#bce8a6";
    c.fillRect(x + 4, y - 3, 3, 2);
  }
  return true;
}

// Architectural details sit behind actors. Use integer raster outlines so the
// brasswork and instrument scales stay crisp at the game's native resolution.
function ellipse(c: Canvas, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color;
  for (let i = 0; i < 360; i += 1) {
    const angle = (i * Math.PI) / 180;
    c.fillRect(Math.round(x + Math.cos(angle) * rx), Math.round(y + Math.sin(angle) * ry), 1, 1);
  }
}
function architecture(c: Canvas, m: WorldMap) {
  const pos = (id: string) => {
    const o = m.objects.find((o) => o.id === id)!;
    return [o.x * 16 + 8, o.y * 16 + 8];
  };
  if (m.id === "echo_2") {
    const [x, y] = pos("echo_carillon");
    c.fillStyle = "#503c4d";
    c.fillRect(x - 34, y - 35, 68, 5);
    c.fillStyle = "#d59f75";
    c.fillRect(x - 34, y - 35, 68, 1);
    for (const [dx, size] of [
      [-22, 6],
      [0, 5],
      [20, 4],
    ]) {
      const bx = x + dx,
        by = y - 30,
        h = size + 3;
      c.fillStyle = "#65536a";
      c.fillRect(bx - 1, by, 2, 19);
      c.fillStyle = "#5a404a";
      c.fillRect(bx - size, by + 6, size * 2 + 1, h);
      c.fillStyle = "#c99a62";
      c.fillRect(bx - size + 1, by + 6, size * 2 - 1, h - 2);
      c.fillStyle = "#f4d294";
      c.fillRect(bx - size + 2, by + 5, size * 2 - 3, 2);
      c.fillRect(bx - size, by + h + 3, size * 2 + 1, 2);
      c.fillStyle = "#885e4b";
      c.fillRect(bx - 1, by + h + 5, 2, 12);
      c.fillStyle = "#edc086";
      c.fillRect(bx - 2, by + h + 16, 4, 2);
    }
  }
  if (m.id === "starfall_2" || m.id === "starfall_3") {
    const [x, y] = pos(m.id === "starfall_2" ? "starfall_scope" : "celestial_engine");
    ellipse(c, x, y, 50, 19, "#9f8a70");
    ellipse(c, x, y, 42, 16, "#5a6d83");
    ellipse(c, x, y, 22, 10, "#9f8a70");
    for (const [dx, dy] of [
      [-47, 5],
      [-26, -17],
      [29, 15],
      [39, -10],
    ]) {
      c.fillStyle = "#edc993";
      c.fillRect(x + dx - 2, y + dy, 5, 1);
      c.fillRect(x + dx, y + dy - 2, 1, 5);
    }
  }
  if (m.id === "copperworks_4") {
    const [x, y] = pos("copper_load");
    for (const [dy, color] of [
      [0, "#7d594f"],
      [3, "#b78a61"],
      [6, "#596a68"],
    ] as const) {
      c.fillStyle = color;
      c.fillRect(x - 58, y + dy, 46, 2);
      c.fillRect(x - 13, y - 6 + dy, 2, 8);
      c.fillRect(x + 7, y - 7 + dy, 49, 2);
    }
    c.fillStyle = "#364849";
    c.fillRect(x - 25, y - 1, 3, 10);
    c.fillRect(x + 32, y - 8, 3, 10);
  }
  if (m.id === "ember_3") {
    for (const key of ["ember_cyndaquil", "ember_slugma"]) {
      const [x, y] = pos(key);
      c.fillStyle = "#503e45";
      c.fillRect(x - 16, y + 1, 31, 8);
      c.fillRect(x - 12, y + 10, 5, 3);
      c.fillRect(x + 6, y + 10, 5, 3);
      c.fillStyle = "#ae775b";
      c.fillRect(x - 15, y + 2, 29, 5);
      c.fillStyle = "#edbc86";
      c.fillRect(x - 15, y + 2, 29, 1);
      for (const dx of [-14, -3, 10]) {
        c.fillStyle = "#6f5551";
        c.fillRect(x + dx, y - 6, 2, 14);
      }
    }
  }
  if (m.id === "victory_2") {
    const [x, y] = pos("victory_falls");
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? "#80bcc3" : "#5790a3";
      c.fillRect(x - 6 + i * 2, y - 32, 2, 31);
      c.fillStyle = "#c4e6e1";
      c.fillRect(x - 6 + i * 2, y - 26 + (i % 3) * 3, 1, 4);
      c.fillRect(x - 6 + i * 2, y - 4, 2, 3);
    }
    const [rx, ry] = pos("victory_crag");
    c.fillStyle = "#79614f";
    c.fillRect(rx - 2, ry - 33, 3, 31);
    c.fillStyle = "#e0ba7f";
    for (let i = 0; i < 6; i++) c.fillRect(rx - 3, ry - 5 * i - 5, 4, 2);
  }
  if (m.id === "bamboo_1" || m.id === "bamboo_2" || m.id === "bamboo_3") {
    for (let y = 1; y < m.height - 1; y++)
      for (let x = 1; x < m.width - 1; x++) {
        if (m.tiles[y][x] !== "o" || m.tiles[y + 1]?.[x] !== "," || (x + y) % 2 !== 0) continue;
        stamp(c, motifs.reeds, "wetland", x * 16 + 8, y * 16 + 15, 1);
      }
  }
}
/** Dress traversable tiles, keeping the silhouette of each obstruction legible. */
export function paintExpeditionFloor(c: Canvas, m: WorldMap) {
  const site = m.id.split("_")[0];
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      const tile = m.tiles[y][x],
        px = x * 16,
        py = y * 16;
      if (site === "copperworks" && tile === "C") {
        c.fillStyle = "#384e50";
        c.fillRect(px, py + 1, 16, 13);
        for (let coil = 1; coil < 15; coil += 3) {
          c.fillStyle = "#bd845c";
          c.fillRect(px + coil, py + 3, 2, 9);
          c.fillStyle = "#e3bb7d";
          c.fillRect(px + coil, py + 3, 1, 7);
        }
      } else if (site === "meridian" && tile === "B") {
        c.fillStyle = "#475a62";
        c.fillRect(px, py, 16, 16);
        for (const dy of [1, 8]) {
          c.fillStyle = "#8ba099";
          c.fillRect(px + 1, py + dy, 14, 6);
          c.fillStyle = "#e5d6ad";
          c.fillRect(px + 5, py + dy + 1, 6, 2);
          c.fillStyle = "#40535a";
          c.fillRect(px + 6, py + dy + 4, 4, 1);
        }
      } else if (site === "ember" && tile === "C") {
        c.fillStyle = "#473e42";
        c.fillRect(px, py + 1, 16, 13);
        for (let k = 1; k < 16; k += 4) {
          c.fillStyle = "#ad7a5e";
          c.fillRect(px + k, py + 2, 2, 11);
        }
        c.fillStyle = "#d4a171";
        c.fillRect(px, py + 2, 16, 2);
        c.fillStyle = "#6c5650";
        c.fillRect(px, py + 12, 16, 2);
      } else if (site === "echo" && tile === "B") {
        c.fillStyle = "#573e57";
        c.fillRect(px, py + 2, 16, 13);
        c.fillStyle = "#a47b79";
        c.fillRect(px, py + 2, 16, 2);
        c.fillRect(px + 2, py + 5, 12, 6);
        c.fillStyle = "#e5bd80";
        c.fillRect(px + 6, py + 6, 4, 1);
      } else if (site === "starfall" && tile === ".") {
        c.fillStyle = (x + y) % 2 ? "#43475d" : "#484b63";
        c.fillRect(px, py, 16, 16);
        if ((x * 3 + y) % 4 === 0) {
          c.fillStyle = "#868ba0";
          c.fillRect(px + 7, py + 6, 1, 3);
          c.fillRect(px + 6, py + 7, 3, 1);
        }
      } else if (site === "hourglass" && tile === "=") {
        c.fillStyle = "#84b9ab";
        c.fillRect(px, py, 16, 16);
        c.fillStyle = "#c1e4c6";
        c.fillRect(px, py + 2, 16, 2);
        c.fillRect(px + 3, py + 8, 6, 1);
        c.fillStyle = "#689a95";
        c.fillRect(px, py + 14, 16, 2);
      } else if (site === "undertow" && tile === ":") {
        c.fillStyle = "#c3ab8a";
        c.fillRect(px, py, 16, 16);
        c.fillStyle = "#faf1d9";
        c.fillRect(px + 2, py + 4, 4, 2);
        c.fillRect(px + 10, py + 10, 3, 2);
        c.fillStyle = "#907e78";
        c.fillRect(px + 3, py + 6, 3, 1);
        c.fillRect(px + 11, py + 12, 2, 1);
      } else if (site === "bamboo" && tile === "=") {
        c.fillStyle = "#716846";
        c.fillRect(px, py, 16, 16);
        for (let k = 0; k < 16; k += 4) {
          c.fillStyle = "#b5b478";
          c.fillRect(px, py + k, 16, 3);
          c.fillStyle = "#d7c98a";
          c.fillRect(px, py + k, 16, 1);
          c.fillStyle = "#787957";
          c.fillRect(px + 3 + (k % 3), py + k, 1, 3);
        }
      }
    }
  architecture(c, m);
  if (m.id === "hourglass_2") {
    const o = m.objects.find((o) => o.id === "hourglass_mirror")!;
    c.fillStyle = "#70584682";
    c.fillRect(o.x * 16 - 25, o.y * 16 + 8, 32, 5);
    c.fillStyle = "#b98e55";
    c.fillRect(o.x * 16 - 12, o.y * 16 + 10, 5, 1);
  }
  if (m.id === "frostvault_2") {
    const first = m.tiles.findIndex((row) => row.includes(":::"));
    const x = (m.tiles[first].indexOf(":::") + 2) * 16,
      y = first * 16;
    c.fillStyle = "#40616b";
    c.fillRect(x + 1, y + 3, 14, 11);
    c.fillStyle = "#c0d4c7";
    for (let k = 3; k < 14; k += 3) c.fillRect(x + k, y + 4, 1, 9);
  }
}

export function expeditionActivity(c: Canvas, m: WorldMap, time: number, flags: ReadonlySet<string>) {
  if (m.id === "lantern_2" || m.id === "aurora_1") {
    for (let y = 1; y < m.height - 1; y++)
      for (let x = 1; x < m.width - 1; x++) {
        if (m.tiles[y].slice(x, x + 2) !== "ff" || m.tiles[y][x - 1] === "f") continue;
        const t = time / 650 + x + y,
          ax = Math.round(x * 16 + 11 + Math.sin(t) * 5),
          ay = Math.round(y * 16 + 2 + Math.cos(t) * 3);
        c.fillStyle = "#fff3bd";
        c.fillRect(ax - 2, ay, 2, 2);
        c.fillRect(ax + 1, ay, 2, 2);
        c.fillStyle = "#7a664a";
        c.fillRect(ax, ay + 1, 1, 2);
      }
  }
  if (m.id === "frostvault_2") {
    const row = m.tiles.findIndex((r) => r.includes(":::")),
      col = m.tiles[row].indexOf(":::") + 2;
    for (let i = 0; i < (flags.has("ice_thawed") ? 5 : 2); i++) {
      const rise = (Math.floor(time / 120) + i * 4) % 18;
      c.fillStyle = "#e7f6f4ae";
      c.fillRect(col * 16 + 5 + (i % 3) * 2 + Math.round(Math.sin(rise / 3) * 2), row * 16 + 5 - rise, 3, 2);
    }
  }
}

/** Draw the transport the player actually returns on, with its landing on the exit tile. */
export function paintReturn(c: Canvas, m: WorldMap, to: string, x: number, y: number) {
  if (m.kind !== "dungeon") return false;
  const [site, floor] = m.id.split("_");
  if (!((floor === "1" && to === site + "_3") || (floor === "3" && to === site + "_1"))) return false;
  const box = (dx: number, dy: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x + dx, y + dy, w, h);
  };
  switch (site) {
    case "ember":
      box(2, 0, 2, 16, "#65616a");
      box(12, 0, 2, 16, "#65616a");
      box(0, 3, 16, 8, "#453f43");
      box(2, 3, 12, 5, "#b77e58");
      box(2, 10, 3, 3, "#453f43");
      box(11, 10, 3, 3, "#453f43");
      return true;
    case "bamboo":
    case "aurora":
      box(0, 1, 16, 15, "#56898c");
      for (let k = 0; k < 4; k++) box(1, 3 + k * 3, 14, 2, "#d2b77c");
      box(4, 2, 2, 12, "#847551");
      box(11, 2, 2, 12, "#847551");
      return true;
    case "meridian":
    case "copperworks":
      box(0, 0, 16, 16, "#485b60");
      box(2, 1, 12, 13, "#798d89");
      box(3, 2, 4, 11, "#b5bfb0");
      box(9, 2, 4, 11, "#9caea7");
      box(6, 15, 5, 1, "#ebd198");
      return true;
    case "lantern":
    case "victory":
    case "undertow":
    case "echo":
      box(2, 0, 12, 16, "#514d46");
      box(3, 0, 2, 16, "#d2ac77");
      box(11, 0, 2, 16, "#d2ac77");
      for (let k = 1; k < 16; k += 4) box(4, k, 8, 1, "#eee0b0");
      return true;
    case "hourglass":
    case "frostvault":
      box(1, 1, 14, 14, site === "hourglass" ? "#a6805c" : "#638ba0");
      for (let k = 0; k < 3; k++) {
        box(3 + k * 2, 3 + k * 3, 10 - k * 4, 2, site === "hourglass" ? "#f1d294" : "#cbebed");
      }
      return true;
    default:
      return false;
  }
}
