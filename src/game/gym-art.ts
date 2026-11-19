import type { WorldMap } from "../world";

type Canvas = CanvasRenderingContext2D;
interface Colors {
  dark: string;
  edge: string;
  wall: string;
  trim: string;
  floor: string;
  grain: string;
  accent: string;
  light: string;
}
const themes: Record<string, Colors> = {
  gym1: {
    dark: "#35483a",
    edge: "#656046",
    wall: "#829263",
    trim: "#aec693",
    floor: "#d6bd8a",
    grain: "#c4a776",
    accent: "#965442",
    light: "#f8e5a8",
  },
  gym2: {
    dark: "#253e51",
    edge: "#415869",
    wall: "#79959b",
    trim: "#b9d7cf",
    floor: "#c6a77d",
    grain: "#ab8769",
    accent: "#ba574d",
    light: "#fce2a3",
  },
  gym3: {
    dark: "#26383e",
    edge: "#3e5b62",
    wall: "#668083",
    trim: "#a3bbb0",
    floor: "#859b96",
    grain: "#738c89",
    accent: "#d28653",
    light: "#f4ce73",
  },
  gym4: {
    dark: "#724b49",
    edge: "#9b6453",
    wall: "#c18b62",
    trim: "#edc891",
    floor: "#e2bd8b",
    grain: "#ca9e71",
    accent: "#a36a53",
    light: "#ffedb4",
  },
  gym5: {
    dark: "#483e47",
    edge: "#785455",
    wall: "#a16a5d",
    trim: "#d69a71",
    floor: "#c29d84",
    grain: "#ad8776",
    accent: "#cf7354",
    light: "#ffe5a0",
  },
  gym6: {
    dark: "#36546c",
    edge: "#688a9e",
    wall: "#b1ced5",
    trim: "#e3efe3",
    floor: "#d0ac75",
    grain: "#ae8c68",
    accent: "#c8705b",
    light: "#fff5c5",
  },
  gym7: {
    dark: "#3a354f",
    edge: "#62516c",
    wall: "#8d7291",
    trim: "#ba9eb6",
    floor: "#b49a95",
    grain: "#a48a89",
    accent: "#884965",
    light: "#f4d599",
  },
  gym8: {
    dark: "#1d2542",
    edge: "#3e4665",
    wall: "#636c89",
    trim: "#99aac0",
    floor: "#687795",
    grain: "#5e6d8a",
    accent: "#bf9863",
    light: "#ffe1a2",
  },
};
function rect(c: Canvas, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function planks(c: Canvas, p: Colors, x: number, y: number, light: boolean) {
  for (let i = 0; i < 16; i += 5) {
    rect(c, p.grain, x, y + i, 16, 1);
    rect(c, light ? p.light : p.grain, x + ((y / 16 + i) % 11), y + i + 2, 3, 1);
  }
}
function bricks(c: Canvas, base: string, mortar: string, x: number, y: number) {
  rect(c, base, x, y, 16, 16);
  for (const [dy, offset] of [
    [0, 4],
    [8, 12],
  ]) {
    rect(c, mortar, x, y + dy, 16, 1);
    rect(c, mortar, x + offset, y + dy, 1, 8);
  }
}
function gymWall(c: Canvas, m: WorldMap, x: number, y: number, p: Colors) {
  const px = x * 16,
    py = y * 16;
  const exposed = (dx: number, dy: number) => {
    const tile = m.tiles[y + dy]?.[x + dx];
    return !!tile && tile !== "#";
  };
  const face = exposed(0, 1);
  rect(c, p.dark, px, py, 16, 16);
  if (m.id === "gym8") {
    const sx = (x * 37 + y * 13) % 16,
      sy = (x * 11 + y * 23) % 15;
    if ((x + y) % 3) rect(c, (x + y) % 2 ? p.wall : p.trim, px + sx, py + sy, 1, 1);
  } else if (m.id === "gym4") {
    // Rock bands continue over tile seams. The fossil cut has no masonry joints.
    for (let i = 0; i < 16; i++) {
      const height = (Math.floor(2 * Math.sin((px + i) / 17)) + y + 12) % 10;
      rect(c, p.edge, px + i, py + height, 1, 2);
      rect(c, p.wall, px + i, py + height + 2, 1, 1);
    }
  } else if (face) {
    bricks(c, p.wall, p.edge, px, py);
    if (m.id === "gym1") {
      rect(c, p.trim, px + 2, py + 2, 12, 7);
      rect(c, p.wall, px + 7, py + 2, 1, 7);
    } else if (m.id === "gym3") {
      rect(c, p.trim, px + 2, py + 3, 1, 1);
      rect(c, p.edge, px + 3, py + 9, 10, 3);
    } else if (m.id === "gym6") {
      rect(c, p.trim, px, py, 16, 7);
      rect(c, p.trim, px + 3, py + 7, 3, 2);
    } else if (m.id === "gym7") {
      rect(c, p.edge, px + 3, py + 2, 10, 9);
      rect(c, p.wall, px + 5, py + 4, 6, 7);
    }
  }
  if (face) {
    rect(c, p.trim, px, py + 1, 16, 2);
    rect(c, p.edge, px, py + 12, 16, 3);
    rect(c, p.dark, px, py + 15, 16, 1);
  }
  if (exposed(-1, 0)) rect(c, p.edge, px, py, 2, 16);
  if (exposed(1, 0)) rect(c, p.edge, px + 14, py, 2, 16);
  if (exposed(0, -1)) rect(c, p.trim, px, py, 16, 2);
}

export function paintGymTile(c: Canvas, m: WorldMap, x: number, y: number) {
  const p = themes[m.id],
    tile = m.tiles[y][x];
  const px = x * 16,
    py = y * 16,
    seed = (x * 17 + y * 31) % 13;
  const box = (color: string, dx: number, dy: number, w: number, h: number) =>
    rect(c, color, px + dx, py + dy, w, h);
  if (tile === "#") {
    gymWall(c, m, x, y, p);
    return;
  }
  box(p.floor, 0, 0, 16, 16);
  switch (m.id) {
    case "gym1":
      if (tile === "P" || tile === "f") {
        box(tile === "P" ? "#53634b" : "#879b62", 0, 0, 16, 16);
        for (let i = 0; i < 4; i++) {
          const dx = (i * 5 + seed) % 13,
            dy = (i * 7 + seed) % 12;
          box("#607747", dx, dy + 1, 4, 2);
          box("#a4ba70", dx + 1, dy, 3, 2);
          if (tile === "f") box(i % 2 ? "#da8d69" : "#f6d38a", dx + 1, dy - 1, 2, 2);
        }
      } else {
        planks(c, p, px, py, false);
        if (tile === ":") {
          box("#a96c4f", 0, 0, 16, 16);
          box("#b67a59", 0, 7, 16, 1);
        }
      }
      break;
    case "gym2":
      if (tile === "~" || tile === "w") {
        box("#497b91", 0, 0, 16, 16);
        box("#568ba0", seed, 4, 3, 1);
        if (tile === "w") {
          const edge = m.tiles[y][x - 1] === "=" ? 0 : 12;
          box("#714f49", edge, 1, 4, 14);
          box(p.light, edge + 1, 2, 2, 3);
          for (let i = 3; i < 14; i += 4) box(p.edge, edge, i, 4, 1);
        }
      } else if (tile === "o") {
        box("#8a6054", 0, 0, 16, 16);
        const sea = (dx: number, dy: number) => "~w".includes(m.tiles[y + dy]?.[x + dx] ?? "!");
        if (sea(0, -1)) {
          box(p.accent, 0, 0, 16, 4);
          box("#f2d19a", 0, 4, 16, 2);
        }
        if (sea(0, 1)) {
          box(p.accent, 0, 8, 16, 6);
          box("#f2d19a", 0, 8, 16, 2);
          box("#385a6a", 0, 14, 16, 2);
        }
        if (sea(-1, 0)) {
          box(p.accent, 0, 0, 5, 16);
          box("#f2d19a", 4, 0, 2, 16);
        }
        if (sea(1, 0)) {
          box(p.accent, 11, 0, 5, 16);
          box("#f2d19a", 10, 0, 2, 16);
        }
        if (!sea(0, 1) && !sea(0, -1)) box("#c29777", 7, 3, 2, 9);
      } else {
        planks(c, p, px, py, tile === "=");
        if (tile === "=") {
          if (m.tiles[y][x - 1] === "~") box("#836954", 1, 0, 2, 16);
          if (m.tiles[y][x + 1] === "~") box("#836954", 13, 0, 2, 16);
          if (m.tiles[y - 1]?.[x] === "~") box("#836954", 0, 0, 16, 2);
          if (m.tiles[y + 1]?.[x] === "~") box("#836954", 0, 13, 16, 2);
          box(p.dark, 3, 4, 1, 1);
          box(p.dark, 12, 12, 1, 1);
        }
        if (tile === "P") {
          box(p.dark, 3, 3, 10, 11);
          box(p.edge, 4, 2, 8, 8);
          box(p.light, 3, 7, 10, 2);
          box("#d6ae71", 4, 10, 8, 2);
        }
      }
      break;
    case "gym3":
      box(p.grain, 0, 15, 16, 1);
      box(p.grain, 15, 0, 1, 16);
      box(p.trim, 2, 2, 1, 1);
      box(p.edge, 13, 12, 1, 1);
      if (tile === "=" || tile === "w") {
        box(p.edge, 0, 0, 16, 16);
        const horizontal = [m.tiles[y][x - 1], m.tiles[y][x + 1]].includes("=");
        for (let i = 0; i < 16; i += 4) {
          if (horizontal) box(p.wall, i, 2, 2, 12);
          else box(p.wall, 2, i, 12, 2);
        }
        if (horizontal) {
          box(p.light, 0, 0, 16, 1);
          box(p.light, 0, 15, 16, 1);
        } else {
          box(p.light, 0, 0, 2, 16);
          box(p.light, 14, 0, 2, 16);
        }
        if (tile === "w") {
          box(p.dark, 0, 4, 16, 6);
          for (let i = 0; i < 14; i += 5) {
            box(p.accent, i, 5, 3, 2);
            box(p.accent, i + 2, 7, 3, 2);
          }
        }
      } else if (tile === "C") {
        box(p.dark, 0, 1, 16, 14);
        box(p.wall, 1, 1, 14, 8);
        box("#c4d8aa", 3, 3, 7, 4);
        box(p.accent, 12, 4, 1, 2);
        for (let i = 3; i < 14; i += 3) box(p.edge, i, 10, 1, 3);
      }
      break;
    case "gym4":
      box(p.grain, seed, 4, 3, 1);
      box("#efd29a", 2, 8 + (seed % 6), 3, 1);
      if (tile === "B") {
        box("#cc9973", 0, 0, 16, 16);
        box("#bd8b68", 0, 9, 16, 1);
      }
      break;
    case "gym5":
      bricks(c, p.floor, p.grain, px, py);
      if (tile === "=") {
        const vertical = m.tiles[y - 1]?.[x] === "=" || m.tiles[y + 1]?.[x] === "=";
        const horizontal = m.tiles[y][x - 1] === "=" || m.tiles[y][x + 1] === "=";
        if (vertical) {
          box(p.edge, 5, 0, 6, 16);
          box(p.trim, 6, 0, 2, 16);
        }
        if (horizontal) {
          box(p.edge, 0, 6, 16, 6);
          box(p.trim, 0, 7, 16, 2);
        }
      }
      if (tile === "P" || tile === "b") {
        box("#74584e", 1, 2, 14, 13);
        box("#d98768", 2, 4, 12, 8);
        box("#f2d5aa", 2, 3, 12, 3);
        box("#ae6859", 3, 10, 10, 2);
      }
      break;
    case "gym6":
      if (tile === "i") {
        box("#9acdd6", 0, 0, 16, 16);
        // Broken reflected bands cross multiple tiles on the lake.
        for (let i = 0; i < 16; i++) {
          const dy = (px + i + py + 1024) % 29;
          if (dy < 16) box("#bfdfdd", i, dy, 1, 1);
        }
        if (seed < 3) {
          box("#e6f1df", 4, 6, 5, 1);
          box("#e6f1df", 9, 5, 2, 1);
        }
      } else if (tile === "P") {
        box(p.edge, 0, 0, 16, 16);
        box(p.trim, 1, 2, 14, 10);
        box(p.wall, 3, 11, 12, 2);
      } else {
        for (let i = 0; i < 6; i++)
          box(i % 2 ? p.grain : p.light, (seed + i * 5) % 15, (seed + i * 3) % 15, 2, 1);
      }
      break;
    case "gym7":
      planks(c, p, px, py, false);
      if (tile === ":") {
        box(p.accent, 0, 0, 16, 16);
        box("#a26178", seed, 7, 2, 1);
        if (m.tiles[y][x - 1] !== ":") box("#d4ad77", 1, 0, 1, 16);
        if (m.tiles[y][x + 1] !== ":") box("#d4ad77", 14, 0, 1, 16);
      }
      if (tile === "C") {
        box("#644355", 0, 4, 16, 4);
        box(p.light, 0, 4, 16, 1);
        for (const dx of [1, 7, 13]) {
          box("#765665", dx, 8, 2, 5);
          box("#c09177", dx, 8, 1, 4);
        }
        box("#765665", 0, 12, 16, 2);
      }
      if (tile === "T") {
        box("#4d3b50", 0, 3, 16, 11);
        box("#80576a", 0, 2, 16, 6);
        box("#be8c81", 0, 2, 16, 1);
        box("#997069", 0, 9, 16, 3);
        box("#5c4554", 2, 13, 2, 2);
      }
      break;
    case "gym8": {
      const meridian = Math.round(m.width / 2) - 2;
      box(p.grain, 0, 15, 16, 1);
      if (tile === ":") {
        box(p.grain, 0, 0, 16, 16);
        box(p.accent, 6, 6, 4, 4);
        box(p.light, 7, 7, 2, 2);
      }
      if (tile === "=" || (x === meridian && y > 8)) {
        box(p.accent, 7, 0, 2, 16);
        box(p.light, 3, 7, 6, 1);
      }
      if (tile === "P") {
        box(p.dark, 1, 1, 14, 14);
        box(p.trim, 2, 2, 12, 7);
        box(p.edge, 3, 3, 10, 5);
        box(p.light, 5, 5, 2, 1);
        box(p.accent, 3, 11, 7, 1);
      }
      break;
    }
  }
}

// Integer scanlines keep the instruments and specimens on the cartridge pixel grid.
function ellipse(c: Canvas, color: string, cx: number, cy: number, rx: number, ry: number) {
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    rect(c, color, cx - w, cy + y, 2 * w + 1, 1);
  }
}
function line(c: Canvas, color: string, x: number, y: number, tx: number, ty: number, width = 1) {
  const steps = Math.max(Math.abs(tx - x), Math.abs(ty - y), 1);
  for (let i = 0; i <= steps; i++)
    rect(
      c,
      color,
      Math.round(x + ((tx - x) * i) / steps),
      Math.round(y + ((ty - y) * i) / steps),
      width,
      width,
    );
}
function installation(c: Canvas, id: string, p: Colors) {
  // Local origin is the middle of the installation's front edge.
  const r = (color: string, x: number, y: number, w: number, h: number) => rect(c, color, x, y, w, h);
  const l = (color: string, x: number, y: number, tx: number, ty: number, width = 1) =>
    line(c, color, x, y, tx, ty, width);
  const e = (color: string, x: number, y: number, rx: number, ry: number) =>
    ellipse(c, color, x, y, rx, ry);
  switch (id) {
    case "gym1":
      // Three silk cocoons hang at different heights on the winding frame.
      r("#745442", -21, -21, 3, 21);
      r("#745442", 18, -21, 3, 21);
      r("#604b3e", -22, -22, 44, 4);
      r("#e3b67e", -21, -22, 42, 1);
      for (const [x, y] of [
        [-12, -9],
        [0, -7],
        [12, -10],
      ]) {
        r("#eee1b2", x, -19, 1, 19 + y);
        e("#687554", x, y, 4, 6);
        e("#cdcd8d", x - 1, y - 1, 3, 4);
        l("#f7e9b0", x - 2, y - 2, x + 1, y, 1);
        r("#939c68", x - 2, y + 3, 3, 1);
      }
      break;
    case "gym2":
      // Wheelhouse and lantern on the forward deck.
      r("#584b50", -20, -13, 40, 12);
      r("#ebd8af", -18, -18, 36, 15);
      r("#455968", -19, -15, 38, 7);
      for (let x = -16; x < 16; x += 8) {
        r("#81b3b8", x, -14, 6, 5);
        r("#c6d9c5", x + 1, -14, 2, 2);
      }
      r("#a25350", -21, -19, 42, 4);
      r("#df9c78", -18, -20, 36, 2);
      r(p.dark, -5, -27, 10, 9);
      r(p.light, -3, -26, 6, 6);
      r(p.accent, -6, -28, 12, 2);
      r("#9e6658", -14, -6, 28, 2);
      break;
    case "gym3":
      // A copper armature with close-wound turns between two cast end bells.
      r(p.dark, -38, -6, 76, 6);
      r(p.wall, -34, -26, 68, 19);
      e(p.dark, -23, -17, 10, 13);
      e(p.trim, -23, -18, 8, 10);
      r("#6b534b", -18, -27, 40, 21);
      for (let x = -17; x < 22; x += 4) {
        r("#ae6c4e", x, -26, 3, 19);
        r("#e5a46a", x, -24, 2, 7);
        r("#8e5949", x + 1, -11, 2, 3);
      }
      e(p.dark, 24, -17, 10, 13);
      e(p.wall, 24, -18, 8, 11);
      e(p.edge, 26, -18, 5, 7);
      e(p.trim, 27, -18, 2, 3);
      for (const x of [-24, 21]) {
        r(p.edge, x, -6, 7, 4);
        r(p.trim, x + 1, -6, 5, 1);
      }
      break;
    case "gym4":
      // An articulated fossil in situ. A few vertebrae have slipped below the spine.
      e("#b58365", 0, -18, 29, 15);
      for (let i = 0; i < 9; i++) {
        const x = -5 + i * 3,
          y = -18 + Math.round(4 * Math.sin(i / 2));
        l("#966e59", x + 1, y + 1, x - 1, y + 7, 2);
        l("#f5d99c", x, y, x - 2, y + 6, 2);
        r("#fff0bf", x, y - 1, 3, 2);
      }
      l("#e6c58f", 19, -20, 28, -29, 2);
      e("#916c59", -14, -20, 11, 9);
      e("#edce97", -15, -22, 10, 8);
      r("#ecce97", -26, -22, 11, 5);
      r("#74594f", -21, -25, 4, 4);
      l("#fff0bf", -19, -29, -12, -31, 2);
      l("#e5c08b", -13, -27, -7, -34, 2);
      l("#f4d6a1", -24, -15, -15, -14, 2);
      r("#fff1c4", -24, -17, 2, 3);
      break;
    case "gym5":
      // The fire door is set into an insulated brick hood, with a flue overhead.
      r(p.dark, -22, -27, 44, 27);
      r("#9b6658", -20, -27, 40, 21);
      r("#ad7962", -17, -32, 34, 6);
      r("#b98a6b", -12, -36, 24, 5);
      r("#654e50", -7, -46, 14, 10);
      r(p.trim, -5, -45, 3, 9);
      r(p.dark, -9, -47, 18, 3);
      e(p.dark, 0, -12, 14, 12);
      r(p.dark, -14, -12, 29, 11);
      e("#c56145", 0, -11, 10, 8);
      r("#dd8752", -10, -10, 21, 8);
      l("#ffcd78", -6, -5, -4, -12, 3);
      l("#fff1a0", 0, -6, 2, -16, 3);
      r(p.dark, -17, -3, 34, 3);
      r(p.trim, -18, -3, 36, 1);
      break;
    case "gym7":
      // Two bell foundries flank the witness dais.
      r("#593e50", -17, -24, 3, 24);
      r("#593e50", 15, -24, 3, 24);
      r("#77576a", -19, -25, 38, 4);
      r("#c39982", -18, -25, 36, 1);
      r(p.dark, -2, -21, 4, 4);
      e("#755450", 0, -10, 8, 9);
      e("#d1a469", -1, -11, 6, 7);
      r("#edc67f", -6, -10, 3, 6);
      r("#92694e", -9, -6, 18, 3);
      r("#e7bd7a", -10, -5, 20, 2);
      e("#977454", 0, -2, 2, 2);
      break;
    case "gym8":
      // Brass refractor. Two feet bolt to the meridian and the finder runs parallel to the tube.
      l(p.dark, 1, -10, -13, -1, 3);
      l(p.dark, 2, -10, 15, -1, 3);
      l("#bd956b", 0, -12, -12, -2, 2);
      l("#d6b483", 1, -12, 14, -2, 2);
      e("#65718c", 0, -13, 6, 5);
      e("#dbbc85", 0, -14, 3, 3);
      l("#3a3c53", -22, -10, 18, -26, 8);
      l("#bd966e", -21, -10, 18, -26, 5);
      l("#f1d497", -21, -10, 17, -25, 2);
      l("#918168", -24, -7, -19, -9, 3);
      l("#544d60", 15, -27, 19, -18, 4);
      l("#e2bf88", 17, -28, 21, -19, 3);
      l("#addece", 20, -28, 24, -19, 2);
      l("#c6ac82", -2, -22, 8, -26, 2);
      r("#9d846b", 2, -21, 2, 4);
      break;
  }
}

/** Draw once over the floor so tall fixtures can rise above their footprint. */
export function paintGymFixtures(c: Canvas, m: WorldMap) {
  if (m.id === "gym1") {
    for (const side of [-1, 1]) {
      const peg = 136 + side * 95;
      line(c, "#e8dbb9", peg, 34, peg - side * 19, 42);
      line(c, "#e8dbb9", peg - side * 19, 42, peg - side * 45, 34);
      line(c, "#d5cba9", peg, 34, peg - side * 20, 54);
      line(c, "#e8dbb9", peg - side * 20, 54, peg - side * 45, 34);
      line(c, "#ded2ae", peg - side * 19, 42, peg - side * 20, 54);
    }
  }
  for (let y = 0; y < m.height; y++)
    for (let x = 0; x < m.width; x++) {
      if (m.tiles[y][x] !== "B" || m.tiles[y][x - 1] === "B" || m.tiles[y - 1]?.[x] === "B") continue;
      let right = x + 1,
        bottom = y + 1;
      while (m.tiles[y][right] === "B") right++;
      while (m.tiles[bottom]?.[x] === "B") bottom++;
      c.save();
      c.translate((x + right) * 8, bottom * 16 - 2);
      installation(c, m.id, themes[m.id]);
      c.restore();
    }
}

export function paintGymActivity(c: Canvas, m: WorldMap, flags: ReadonlySet<string>, time: number) {
  if (m.id === "gym2" && flags.has("fog_signal")) {
    const x = 19.5 * 16,
      y = 2 * 16 + 4,
      sweep = Math.round(8 * Math.sin(time / 1700));
    line(c, "#fff2bc88", x, y, x + 32, y + sweep, 2);
    line(c, "#fff2bc44", x + 32, y + sweep, x + 70, y + sweep * 2, 3);
  }
  if (m.id === "gym3" && flags.has("power_restored")) {
    for (let i = 0; i < 6; i++)
      rect(c, i === Math.floor(time / 170) % 6 ? "#f9dc85" : "#89ad8c", 137 + i * 7, 123, 3, 2);
    for (const x of [4, 16]) {
      const released = m.tiles[4][x] === "=";
      // The striped stop bar and forward arrow are readable without color.
      rect(c, "#34494b", x * 16 + 3, 74, 10, 6);
      if (released) {
        rect(c, "#d9e9ad", x * 16 + 7, 75, 2, 4);
        rect(c, "#d9e9ad", x * 16 + 5, 77, 6, 1);
      } else {
        rect(c, "#edbb72", x * 16 + 4, 76, 8, 2);
        rect(c, "#674b46", x * 16 + 7, 76, 2, 2);
      }
    }
  }
  if (m.id === "gym4" && flags.has("lens_restored")) {
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) {
        if (m.tiles[y][x] !== ":" || (x + y) % 2) continue;
        rect(c, "#ab805e", x * 16 + 4, y * 16 + 4, 2, 3);
        rect(c, "#b38765", x * 16 + 9, y * 16 + 9, 2, 3);
      }
  }
  if (m.id === "gym7" && flags.has("gym7_testimony")) {
    // Robin leaves the signed deposition and company badge on the witness rail.
    rect(c, "#6e5360", 178, 85, 11, 7);
    rect(c, "#efd7ad", 179, 84, 8, 6);
    rect(c, "#a99583", 181, 86, 4, 1);
    rect(c, "#bd7963", 185, 88, 4, 3);
  }
  if (m.id === "gym8" && flags.has("last_lens")) {
    // The recovered glass projects the migration chart onto the north dome.
    const points = [
      [51, 58],
      [80, 69],
      [111, 51],
      [97, 31],
      [112, 18],
      [135, 11],
    ];
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      if (i) line(c, "#8faac3", points[i - 1][0], points[i - 1][1], x, y);
      const lit = i === Math.floor(time / 370) % points.length;
      rect(c, lit ? "#ffe3a7" : "#c8d9d7", x - 1, y - 1, 3, 3);
      if (lit) {
        rect(c, "#fff1bd", x - 3, y, 7, 1);
        rect(c, "#fff1bd", x, y - 3, 1, 7);
      }
    }
  }
}

const backdrops = new Map<string, string>();
export function gymBattleBackdrop(map: WorldMap) {
  if (map.kind !== "gym") return;
  const existing = backdrops.get(map.id);
  if (existing) return existing;
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const c = canvas.getContext("2d")!,
    p = themes[map.id];
  rect(c, p.wall, 0, 0, 160, 48);
  rect(c, p.floor, 0, 48, 160, 42);
  switch (map.id) {
    case "gym1":
      rect(c, "#bacda2", 0, 0, 160, 39);
      for (let x = -20; x < 160; x += 30) {
        line(c, "#8da490", x, 0, x + 24, 17);
        rect(c, "#8da490", x + 24, 17, 1, 21);
      }
      rect(c, "#e2d4a6", 0, 16, 160, 2);
      for (let x = 0; x < 160; x += 7) ellipse(c, "#79915f", x, 43 - (x % 3), 7, 5);
      break;
    case "gym2":
      rect(c, "#b1d2d0", 0, 0, 160, 25);
      rect(c, "#6797aa", 0, 25, 160, 22);
      for (let x = 0; x < 160; x += 14) rect(c, "#9cbdc1", x, 28 + (x % 9), 6, 1);
      rect(c, "#815e53", 0, 38, 160, 2);
      for (let x = 4; x < 160; x += 27) rect(c, "#685b56", x, 36, 3, 12);
      break;
    case "gym3":
      for (let x = 0; x < 160; x += 32) {
        rect(c, p.edge, x, 0, 3, 48);
        line(c, p.trim, x, 2, x + 32, 32);
        rect(c, p.light, x + 12, 7, 12, 2);
      }
      rect(c, p.dark, 0, 39, 160, 9);
      break;
    case "gym4":
      rect(c, "#f4d5a1", 0, 0, 160, 48);
      for (let x = 0; x < 160; x++) {
        const ridge = 19 + Math.round(5 * Math.sin(x / 14) + 4 * Math.sin(x / 9));
        rect(c, p.trim, x, ridge, 1, 48 - ridge);
        rect(c, p.wall, x, ridge + 9, 1, 4);
        rect(c, p.edge, x, ridge + 13, 1, 2);
      }
      break;
    case "gym5":
      for (let x = 0; x < 160; x += 16) for (let y = 0; y < 48; y += 16) bricks(c, p.wall, p.edge, x, y);
      rect(c, p.dark, 0, 8, 160, 5);
      rect(c, p.trim, 0, 9, 160, 2);
      break;
    case "gym6":
      rect(c, "#c4dcd9", 0, 0, 160, 42);
      for (let x = 0; x < 160; x++) {
        const ridge = 11 + Math.round(Math.abs((x % 42) - 21) * 0.7);
        rect(c, "#85acbf", x, ridge, 1, 43 - ridge);
        rect(c, "#e4eeea", x, ridge, 1, 4);
      }
      rect(c, "#dde7d7", 0, 37, 160, 11);
      rect(c, "#a0cdd4", 0, 48, 160, 42);
      for (let x = 3; x < 160; x += 23) line(c, "#d6e4dc", x, 63 + (x % 14), x + 9, 60 + (x % 14));
      break;
    case "gym7":
      for (let x = 10; x < 160; x += 28) {
        ellipse(c, p.edge, x, 18, 8, 11);
        rect(c, p.edge, x - 8, 18, 17, 20);
        ellipse(c, p.trim, x, 18, 5, 8);
        rect(c, p.trim, x - 5, 18, 11, 16);
        rect(c, p.wall, x, 10, 1, 24);
        rect(c, p.wall, x - 5, 20, 11, 1);
      }
      rect(c, p.dark, 0, 43, 160, 4);
      break;
    case "gym8":
      rect(c, p.dark, 0, 0, 160, 48);
      for (let i = 0; i < 38; i++)
        rect(c, i % 3 ? p.trim : p.light, (i * 37) % 157, (i * i * 7) % 43, 1, 1);
      for (let x = 0; x < 160; x++) {
        const y = 4 + Math.round(((x - 81) / 14) ** 2);
        rect(c, p.edge, x, y, 1, 2);
      }
      rect(c, p.edge, 0, 46, 160, 3);
      break;
  }
  c.save();
  c.translate(83, 48);
  installation(c, map.id, p);
  c.restore();
  ellipse(c, p.grain, 124, 54, 29, 4);
  ellipse(c, p.grain, 38, 89, 42, 7);
  const url = canvas.toDataURL();
  backdrops.set(map.id, url);
  return url;
}
