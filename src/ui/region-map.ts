import { chartAreas, regionPosition, routeIds, townIds } from "../game/region";
import { WORLD } from "../world";
import { routes, settlements, surveyTrail, traceTrail, type Point, type Town } from "../world/atlas";
import type { Save } from "../game/save";

const W = 384,
  H = 231,
  scale = 0.73;
const project = ([x, y]: Point): Point => [Math.round((x + 28) * scale), Math.round((y + 27) * scale)];
const ink = "#364c50",
  paper = "#fff3c9";
const land: Point[][] = [
  // Orchard country and the scalloped shores of the southern harbor.
  [
    [-22, 166],
    [2, 157],
    [16, 165],
    [23, 182],
    [45, 188],
    [65, 198],
    [85, 185],
    [105, 189],
    [121, 198],
    [148, 195],
    [160, 184],
    [177, 187],
    [194, 174],
    [216, 167],
    [231, 162],
    [241, 174],
    [232, 188],
    [248, 195],
    [268, 190],
    [285, 181],
    [304, 181],
    [324, 191],
    [336, 207],
    [327, 222],
    [341, 239],
    [339, 258],
    [318, 275],
    [294, 275],
    [288, 252],
    [277, 244],
    [257, 252],
    [238, 244],
    [223, 252],
    [205, 250],
    [186, 268],
    [161, 264],
    [144, 283],
    [101, 286],
    [73, 273],
    [52, 276],
    [20, 256],
    [13, 237],
    [-3, 235],
    [-16, 216],
    [-11, 194],
    [-22, 188],
  ],
  // The mountain spine and its interior headlands.
  [
    [54, 166],
    [62, 135],
    [54, 118],
    [65, 101],
    [64, 78],
    [74, 58],
    [90, 51],
    [93, 35],
    [110, 30],
    [115, 10],
    [130, 4],
    [130, -20],
    [155, -23],
    [174, -9],
    [165, 11],
    [186, 17],
    [209, 8],
    [231, 1],
    [254, 7],
    [274, 1],
    [292, 15],
    [317, 16],
    [325, 2],
    [341, -17],
    [362, -18],
    [360, 9],
    [379, 20],
    [371, 42],
    [353, 60],
    [333, 63],
    [321, 53],
    [304, 59],
    [290, 47],
    [266, 48],
    [250, 53],
    [263, 59],
    [287, 52],
    [310, 63],
    [313, 86],
    [295, 99],
    [273, 89],
    [259, 98],
    [251, 114],
    [269, 125],
    [279, 103],
    [293, 103],
    [301, 118],
    [293, 138],
    [280, 148],
    [271, 162],
    [252, 166],
    [232, 156],
    [204, 171],
    [183, 180],
    [166, 180],
    [144, 169],
    [137, 150],
    [117, 142],
    [106, 126],
    [93, 125],
    [91, 147],
    [104, 165],
    [96, 180],
    [117, 200],
    [112, 217],
    [94, 214],
    [79, 192],
    [77, 177],
  ],
  // Saffron peninsula, the coastal locks and the eastern breaker islands.
  [
    [359, 34],
    [380, 32],
    [393, 46],
    [399, 56],
    [417, 63],
    [433, 53],
    [439, 37],
    [459, 29],
    [478, 38],
    [488, 61],
    [478, 82],
    [491, 98],
    [473, 108],
    [455, 105],
    [448, 118],
    [435, 123],
    [431, 143],
    [446, 157],
    [460, 149],
    [477, 156],
    [484, 179],
    [472, 204],
    [452, 206],
    [444, 222],
    [421, 224],
    [402, 207],
    [384, 217],
    [360, 203],
    [347, 205],
    [332, 215],
    [321, 206],
    [334, 193],
    [350, 183],
    [375, 175],
    [398, 177],
    [406, 163],
    [386, 153],
    [388, 131],
    [406, 115],
    [410, 101],
    [391, 90],
    [379, 80],
    [379, 62],
    [363, 56],
  ],
  [
    [23, 61],
    [34, 55],
    [42, 63],
    [37, 73],
    [23, 77],
    [16, 71],
  ],
  [
    [42, 84],
    [53, 77],
    [56, 87],
    [48, 97],
    [39, 95],
  ],
  [
    [388, 245],
    [398, 237],
    [414, 240],
    [418, 249],
    [408, 258],
    [393, 256],
  ],
  [
    [380, 261],
    [388, 258],
    [392, 265],
    [382, 270],
  ],
  [
    [314, 114],
    [320, 106],
    [327, 110],
    [327, 120],
    [318, 126],
    [311, 122],
  ],
  [
    [329, 145],
    [340, 136],
    [349, 139],
    [347, 148],
    [336, 154],
  ],
  [
    [273, 172],
    [284, 167],
    [293, 174],
    [287, 182],
    [272, 180],
  ],
];

function inside(x: number, y: number, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = polygon[i],
      [u, v] = polygon[j];
    if (b > y !== v > y && x < ((u - a) * (y - b)) / (v - b) + a) result = !result;
  }
  return result;
}

// Pixel lettering keeps the names legible at cartridge resolution and offline.
const letters: Record<string, string> = {
  A: "2/5/7/5/5",
  B: "6/5/6/5/6",
  C: "3/4/4/4/3",
  D: "6/5/5/5/6",
  E: "7/4/6/4/7",
  F: "7/4/6/4/4",
  G: "3/4/5/5/3",
  H: "5/5/7/5/5",
  I: "7/2/2/2/7",
  J: "1/1/1/5/2",
  K: "5/5/6/5/5",
  L: "4/4/4/4/7",
  M: "5/7/7/5/5",
  N: "5/7/7/7/5",
  O: "2/5/5/5/2",
  P: "6/5/6/4/4",
  Q: "2/5/5/3/1",
  R: "6/5/6/5/5",
  S: "3/4/2/1/6",
  T: "7/2/2/2/2",
  U: "5/5/5/5/7",
  V: "5/5/5/5/2",
  W: "5/5/7/7/5",
  X: "5/5/2/5/5",
  Y: "5/5/2/2/2",
  Z: "7/1/2/4/7",
  "0": "7/5/5/5/7",
  "1": "2/6/2/2/7",
  "2": "6/1/2/4/7",
  "3": "6/1/2/1/6",
  "4": "5/5/7/1/1",
  "5": "7/4/6/1/6",
  "6": "3/4/7/5/7",
  "7": "7/1/2/2/2",
  "8": "7/5/7/5/7",
  "9": "7/5/7/1/6",
  " ": "0/0/0/0/0",
};
type Ctx = CanvasRenderingContext2D;

function label(c: Ctx, word: string, x: number, y: number, color: string, outline?: string) {
  const dots: Point[] = [];
  [...word.toUpperCase()].forEach((ch, i) => {
    (letters[ch] || letters[" "]).split("/").forEach((bits, row) => {
      for (let k = 0; k < 3; k++) if (+bits & (4 >> k)) dots.push([x + 4 * i + k, y + row]);
    });
  });
  if (outline) {
    c.fillStyle = outline;
    for (const [u, v] of dots) c.fillRect(u - 1, v - 1, 3, 3);
  }
  c.fillStyle = color;
  for (const [u, v] of dots) c.fillRect(u, v, 1, 1);
}

function stamp(c: Ctx, point: Point, rows: string[], colors: string[]) {
  const [x, y] = point;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === " ") continue;
      c.fillStyle = colors[+row[i]];
      c.fillRect(x + i, y + j, 1, 1);
    }
  });
}

const peak = [
  "      0      ",
  "     020     ",
  "    02230    ",
  "   0223230   ",
  "  012113330  ",
  " 01111131330 ",
  "0112113133330",
  " 11111333333 ",
];
const pine = ["   0   ", "  010  ", " 01120 ", "  012  ", "0111220", "  003  "];
const dune = ["        0  ", "      0010 ", "    0022110", "00002221111"];
const mountainRanges: [Point[], string[]][] = [
  [
    [
      [115, 21],
      [135, 9],
      [153, 13],
      [163, 22],
      [185, 14],
      [207, 10],
    ],
    ["#725e59", "#b17f62", "#dbab7d", "#966e62"],
  ],
  [
    [
      [105, 73],
      [117, 81],
      [126, 91],
      [110, 91],
      [131, 105],
      [143, 118],
      [165, 116],
    ],
    ["#596c71", "#9cae9b", "#ecebd1", "#82968d"],
  ],
  [
    [
      [165, 48],
      [180, 54],
      [192, 56],
      [176, 65],
      [191, 71],
      [208, 52],
    ],
    ["#636d70", "#b0b4a1", "#f4eed5", "#909c94"],
  ],
];

function terrain(c: Ctx) {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / scale - 28,
        v = y / scale - 27;
      const a = u + 2 * Math.sin(v / 3.7) + Math.cos(u / 2.6);
      const b = v + 2 * Math.cos(u / 4.3) + Math.sin(v / 3.1);
      mask[y * W + x] = Number(land.some((poly) => inside(a, b, poly)));
    }
  const isLand = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && !!mask[y * W + x];
  const near = (x: number, y: number, d: number, target: boolean) =>
    [
      [-d, 0],
      [d, 0],
      [0, -d],
      [0, d],
    ].some(([a, b]) => isLand(x + a, y + b) === target);
  const pixels = c.createImageData(W, H);
  const paint: Record<string, number[]> = {};
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / scale - 28,
        v = y / scale - 27;
      const boundary = 6 * Math.sin(u / 13) + 5 * Math.cos(v / 14);
      const ripple = Math.sin(u / 21 + Math.cos(v / 17)) + Math.cos(v / 7 + u / 37);
      let color = ripple > 0.7 ? "#76a8ae" : "#70a1ab";
      if (!isLand(x, y)) {
        if (near(x, y, 6, true)) color = "#88b9b5";
        if (near(x, y, 3, true)) color = "#acd0bb";
        if (near(x, y, 1, true)) color = "#547e7c";
      } else {
        color = "#aec390";
        const ridge = Math.sin(u / 14 + v / 20) + Math.cos(v / 9 - u / 27);
        if (ridge > 0.55) color = "#9cb787";
        if (ridge < -0.8) color = "#c0ce98";
        if (v < 54 + 12 * Math.sin(u / 60) + boundary && u < 294 + boundary)
          color = ridge > 0.35 ? "#a6907d" : "#c3ab86";
        if (u > 384 + 9 * Math.cos(v / 12) && v < 165 + boundary)
          color = ridge > 0.35 ? "#d4b789" : "#e5cb97";
        if (((v - 111) / 48) ** 2 + ((u - 139) / 49) ** 2 < 1 + boundary / 32)
          color = ridge > 0.35 ? "#b3c3b1" : "#cfdbc2";
        if (((v - 202) / 38) ** 2 + ((u - 226) / 64) ** 2 < 1 + boundary / 32)
          color = ridge > 0.35 ? "#c0ae76" : "#d3c38a";
        if (near(x, y, 2, false)) color = "#e1d49f";
        if (!isLand(x, y + 1)) color = "#88936d";
      }
      const rgb = (paint[color] ??= [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)).concat(255));
      pixels.data.set(rgb, 4 * (y * W + x));
    }
  c.putImageData(pixels, 0, 0);
  // Wavelets and groves follow the land mask. The peaks are named-route landmarks.
  for (let y = 6; y < H - 6; y += 8)
    for (let x = 5 + (y % 3) * 5; x < W - 8; x += 13) {
      const n = Math.abs((x * 73 + y * 137) % 23);
      if (!isLand(x, y) && !near(x, y, 4, true) && n < 8) stamp(c, [x, y], [" 00  0", "0  00 "], ["#a1c9bf"]);
      if (isLand(x, y) && !near(x, y, 5, false) && n < 10) {
        const u = x / scale - 28,
          v = y / scale - 27;
        if (u > 380 && v < 157) stamp(c, [x, y], dune, ["#b1946a", "#cfad7b", "#edcf95"]);
        else if ((v > 178 && u < 244) || (v > 106 && v < 161 && u < 264) || (u > 292 && u < 369 && v < 54))
          stamp(c, [x, y], pine, ["#648773", "#8eaf7d", "#769877", "#547a67"]);
      }
    }
  for (const [points, colors] of mountainRanges)
    for (const [u, v] of points) {
      const [x, y] = project([u, v]);
      stamp(c, [x - 6, y - 5], peak, colors);
    }
  const symbols: [Point, string[]][] = [
    [
      [122, 219],
      ["0   1  ", " 01 1  ", "   01  ", "  10200", "11 00 1", "  0330 ", "  0310 ", " 000000"],
    ], // Mossford mill
    [
      [324, 216],
      ["   0   ", "  020  ", " 01110 ", "  020  ", "  010  ", "  030  ", " 01110 ", " 01110 ", "0000000"],
    ], // harbor light
    [
      [432, 180],
      ["   03 0 ", "   03 0 ", "   03 0 ", " 0023000", "02333230", "02133210", "00000000"],
    ], // Copperworks
    [
      [222, 134],
      [
        "    0    ",
        "   020   ",
        " 0222220 ",
        "   030   ",
        " 0222220 ",
        "000000000",
        "  01310  ",
        "  00000  ",
      ],
    ], // bell tower
    [
      [291, 85],
      ["   0    ", "  0210  ", " 022110 ", "02221110", "00000000", " 021130 ", " 011330 ", "00000000"],
    ], // observatory dome
    [
      [196, 78],
      ["  01110", "  0333 ", "  0    ", "  0    ", "  0    ", "  0    ", "00000  "],
    ], // League pennant
  ];
  for (const [p, rows] of symbols) {
    const [x, y] = project(p);
    stamp(c, [x - 4, y - 4], rows, ["#56695f", "#faf0c3", "#c7b585", "#9a7966"]);
  }
  const [u, v] = project([370, 118]);
  label(c, "Aurora", u - 12, v, "#496f80");
  label(c, "Current", u - 14, v + 7, "#496f80");
  // Compass rose in the ocean west of the inhabited islands.
  label(c, "N", 17, 10, ink);
  stamp(
    c,
    [13, 17],
    [
      "     0     ",
      "    010    ",
      "    010    ",
      "   01120   ",
      "00011122000",
      " 001112200 ",
      "   02220   ",
      "    020    ",
      "    020    ",
      "     0     ",
    ],
    [ink, paper, "#83aa9e"],
  );
}

const centers: Record<string, Point> = {};
const trails: Record<string, Point[]> = {};
for (const n of routeIds) {
  const r = routes[n],
    id = "route" + n;
  const spine = [settlements[r.from].center, ...r.line];
  if (r.arrival) spine.push(settlements[r.to as Town].center);
  const steps = traceTrail(spine.map(project));
  trails[id] = steps;
  centers[id] = steps[Math.floor(steps.length * 0.52)];
}
for (const id of townIds) centers[id] = project(settlements[id].center);

function ribbon(c: Ctx, cells: Point[], fill: string, width: number) {
  c.fillStyle = fill;
  for (const [x, y] of cells) c.fillRect(x - (width >> 1), y - (width >> 1), width, width);
}

// Offsets keep the labels clear of the settlement's own road junctions.
const names: Record<Town, [string, number, number]> = {
  dewdrop: ["Dewdrop", -14, -12],
  mossford: ["Mossford", -16, 8],
  bramble: ["Bramble", -14, -12],
  tideglass: ["Tideglass", -20, 9],
  copperwick: ["Copperwick", -20, 9],
  sunspire: ["Sunspire", -13, -12],
  reedhaven: ["Reedhaven", -16, -12],
  cinderfall: ["Cinderfall", -23, -12],
  rimepeak: ["Rimepeak", -16, 8],
  bellweather: ["Bellweather", -24, 8],
  aster: ["Aster", -8, -12],
  crown: ["Crown", -12, 8],
};

let base: HTMLCanvasElement | undefined;
function printedChart() {
  if (base) return base;
  base = document.createElement("canvas");
  base.width = W;
  base.height = H;
  const c = base.getContext("2d")!;
  terrain(c);
  for (const n of routeIds) {
    const r = routes[n];
    const branch = surveyTrail(n).bypass.map(([x, y]) => project([r.x + x, r.y + y]));
    c.fillStyle = "#8e926f";
    branch.forEach(([x, y], i) => {
      if (i % 4 < 2) c.fillRect(x, y, 1, 1);
    });
  }
  for (const n of routeIds) {
    const cells = trails["route" + n];
    const sea = n === "22" || n === "24";
    ribbon(c, cells, sea ? "#4c7580" : "#7d7557", 3);
    ribbon(c, cells, sea ? "#a2ccce" : "#f5d995", 1);
    if (sea)
      cells.forEach(([x, y], i) => {
        if (i % 6 < 2) {
          c.fillStyle = "#497a86";
          c.fillRect(x, y, 1, 1);
        }
      });
    if (!routes[n].arrival) {
      const [x, y] = cells.at(-1)!;
      stamp(
        c,
        [x - 3, y - 3],
        ["   0   ", "  010  ", " 01110 ", "0112110", " 01110 ", "  010  ", "   0   "],
        [ink, "#f3dcaa", "#ab7b58"],
      );
    }
  }
  // Two-digit shields identify every trail, including the field shortcuts.
  for (const n of routeIds) {
    const [x, y] = centers["route" + n];
    c.fillStyle = "#777f64";
    c.fillRect(x - 5, y - 4, 11, 8);
    c.fillStyle = "#efdfb2";
    c.fillRect(x - 4, y - 3, 9, 6);
    label(c, n, x - 3, y - 3, "#485c50");
  }
  for (const id of townIds) {
    const [x, y] = centers[id],
      [name, dx, dy] = names[id];
    stamp(
      c,
      [x - 3, y - 3],
      [" 00000 ", "0111110", "0122210", "0123210", "0122210", "0111110", " 00000 "],
      [ink, paper, ["dewdrop", "reedhaven", "mossford"].includes(id) ? "#629981" : "#b76f59", "#f1b877"],
    );
    label(c, name, x + dx, y + dy, ink, "#e8e5be");
  }
  return base;
}

function locateArea(x: number, y: number) {
  for (const id of townIds) {
    const [u, v] = centers[id],
      [name, dx, dy] = names[id];
    if (x >= u + dx - 1 && x < u + dx + 4 * name.length && y >= v + dy - 1 && y <= v + dy + 5) return id;
  }
  let best = "",
    distance = 13;
  for (const id of chartAreas) {
    const points = trails[id] ?? [centers[id]];
    for (const [u, v] of points) {
      const d = Math.hypot(x - u, y - v) + (trails[id] ? 2 : 0);
      if (d < distance) {
        distance = d;
        best = id;
      }
    }
  }
  return best;
}

function markTrainer(c: Ctx, position: Point) {
  const [x, y] = project(position);
  stamp(c, [x - 3, y - 8],
    ["  000  ", " 01110 ", "0222220", "0111110", " 01210 ", "  010  ", "   0   "],
    ["#3f3c45", "#fff2c7", "#bf614e"]);
}

function markSelection(c: Ctx, x: number, y: number) {
  // Leave the printed road number visible between the brackets.
  c.fillStyle = "#773e43";
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    c.fillRect(x + dx * 7 - (dx > 0 ? 2 : 0), y + dy * 6, 3, 1);
    c.fillRect(x + dx * 7, y + dy * 6 - (dy > 0 ? 2 : 0), 1, 3);
  }
}

export function drawHabitatChart(canvas: HTMLCanvasElement, save: Save, position: ReturnType<typeof regionPosition>, wholeArea: boolean, zoom: number) {
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  const [x, y] = wholeArea ? centers[position.area] : project(position.point);
  const left = Math.round(Math.max(0, Math.min(W - W / zoom, x - W / (zoom * 2))));
  const top = Math.round(Math.max(0, Math.min(H - H / zoom, y - H / (zoom * 2))));
  c.setTransform(zoom, 0, 0, zoom, -left * zoom, -top * zoom);
  c.imageSmoothingEnabled = false;
  c.drawImage(printedChart(), 0, 0);
  stamp(c, [x - 3, y - 14], ["0000000", "0111110", "0111110", " 01110 ", "  010  ", "   0   "], ["#633c37", "#ffdf67"]);
  markSelection(c, x, y);
  markTrainer(c, regionPosition(save.map, save.x, save.y).point);
}

export function mountRegionChart(panel: HTMLElement, save: Save, objective?: Point) {
  const canvas = panel.querySelector<HTMLCanvasElement>(".region-chart")!;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  const here = regionPosition(save.map, save.x, save.y);
  let selected = here.area,
    zoom = 1,
    left = 0,
    top = 0;
  const zoomButton = panel.querySelector<HTMLButtonElement>("[data-zoom]")!;
  const title = panel.querySelector<HTMLElement>("[data-place]")!;
  const detail = panel.querySelector<HTMLElement>("[data-links]")!;
  function draw() {
    const [x, y] = centers[selected];
    const focus = selected === here.area ? project(here.point) : [x, y];
    left = Math.round(Math.max(0, Math.min(W - W / zoom, focus[0] - W / (zoom * 2))));
    top = Math.round(Math.max(0, Math.min(H - H / zoom, focus[1] - H / (zoom * 2))));
    c.setTransform(zoom, 0, 0, zoom, -left * zoom, -top * zoom);
    c.imageSmoothingEnabled = false;
    c.drawImage(printedChart(), 0, 0);
    if (selected.startsWith("route")) {
      for (const [u, v] of trails[selected]) {
        // Keep printed numbers and town symbols intact along the selected road.
        if (
          Math.hypot(u - x, v - y) > 7 &&
          !townIds.some((t) => Math.hypot(u - centers[t][0], v - centers[t][1]) < 5)
        ) {
          c.fillStyle = "#ad5b45";
          c.fillRect(u, v, 1, 1);
        }
      }
    }
    markSelection(c, x, y);
    if (objective) {
      const [gx, gy] = project(objective);
      stamp(
        c,
        [gx - 3, gy - 6],
        ["   0   ", "  010  ", "0011100", "  010  ", "   0   "],
        ["#79503e", "#ffdf72"],
      );
    }
    markTrainer(c, here.point);
    title.textContent = WORLD[selected].name;
    const r = routes[selected.slice(5)];
    detail.textContent = r
      ? WORLD[r.from].name + " → " + WORLD[r.to].name.split(" · ")[0] + " · " + r.landmark
      : WORLD[selected].exits
          .filter((e) => e.direction)
          .map((e) => e.label)
          .join(" · ");
    const fly = panel.querySelector<HTMLButtonElement>(".atlas-fly")!;
    fly.hidden = !(
      WORLD[selected].kind === "town" &&
      save.abilities.includes("fly") &&
      save.visited.includes(selected) &&
      selected !== save.map
    );
    fly.dataset.travel = selected;
    fly.textContent = "Fly to " + WORLD[selected].name;
    canvas.setAttribute(
      "aria-label",
      "Astra region. You are in " + WORLD[save.map].name + ". Selected " + title.textContent,
    );
  }
  for (const b of panel.querySelectorAll<HTMLButtonElement>("[data-map-step]")) {
    b.onclick = () => {
      selected =
        chartAreas[
          (chartAreas.indexOf(selected) + Number(b.dataset.mapStep) + chartAreas.length) % chartAreas.length
        ];
      draw();
    };
  }
  zoomButton.onclick = () => {
    zoom = zoom === 1 ? 2 : 1;
    zoomButton.textContent = zoom === 1 ? "Zoom +" : "Zoom −";
    zoomButton.setAttribute("aria-pressed", String(zoom > 1));
    draw();
  };
  canvas.onclick = (event) => {
    const box = canvas.getBoundingClientRect();
    const id = locateArea(
      left + ((event.clientX - box.left) * W) / (zoom * box.width),
      top + ((event.clientY - box.top) * H) / (zoom * box.height),
    );
    if (id) {
      selected = id;
      draw();
    }
  };
  draw();
}
