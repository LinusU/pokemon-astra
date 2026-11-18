import type { Direction } from "./index";

export type Point = [x: number, y: number];
export interface Footprint {
  x: number;
  y: number;
  width: number;
  height: number;
}

function town(name: string, palette: string, x: number, y: number, width = 24, height = 18) {
  return {
    name,
    palette,
    center: [x, y] as Point,
    width,
    height,
    x: x - Math.floor(width / 2),
    y: y - Math.floor(height / 2),
  };
}

/** North is up. All coordinates, including distances between islands, are walking tiles. */
export const settlements = {
  dewdrop: town("Dewdrop Village", "meadow", 33, 215, 25, 20),
  mossford: town("Mossford", "orchard", 107, 233, 25, 20),
  bramble: town("Bramble Town", "autumn", 203, 216),
  tideglass: town("Tideglass Port", "coast", 310, 202),
  copperwick: town("Copperwick City", "industrial", 419, 194),
  sunspire: town("Sunspire Town", "desert", 434, 90),
  reedhaven: town("Reedhaven", "wetland", 345, 43),
  cinderfall: town("Cinderfall City", "volcanic", 147, 39),
  rimepeak: town("Rimepeak Village", "snow", 152, 135),
  bellweather: town("Bellweather City", "violet", 249, 149),
  aster: town("Aster City", "night", 250, 76),
  crown: town("Crown Summit", "mountain", 190, 86),
};
export type Town = keyof typeof settlements;

const vectors: Record<Direction, Point> = {
  north: [0, -1],
  south: [0, 1],
  west: [-1, 0],
  east: [1, 0],
};
export const opposite: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  west: "east",
  east: "west",
};
type Gate = [town: Town, side: Direction, offset?: number];
type Site = [dungeon: string, x: number, y: number];

function gate([id, side, offset = 0]: Gate): Point {
  const t = settlements[id];
  if (side === "north" || side === "south")
    return [t.center[0] + offset, side === "north" ? t.y - 1 : t.y + t.height];
  return [side === "west" ? t.x - 1 : t.x + t.width, t.center[1] + offset];
}

function road(
  name: string,
  palette: string,
  from: Gate,
  bends: Point[],
  to: Gate | Site,
  landmark: string,
  note: string,
  turnout: number,
) {
  const endGate = typeof to[1] === "string" ? (to as Gate) : undefined;
  const first = gate(from);
  const last: Point = endGate ? gate(endGate) : [to[1] as number, to[2]!];
  const approach = (p: Point, side: Direction): Point => [
    p[0] + 4 * vectors[side][0],
    p[1] + 4 * vectors[side][1],
  ];
  const line = [
    first,
    approach(first, from[1]),
    ...bends,
    ...(endGate ? [approach(last, endGate[1])] : []),
    last,
  ];
  let left = Math.min(...line.map((p) => p[0])) - 12,
    top = Math.min(...line.map((p) => p[1])) - 12;
  let right = Math.max(...line.map((p) => p[0])) + 12,
    bottom = Math.max(...line.map((p) => p[1])) + 12;
  for (const g of [from, ...(endGate ? [endGate] : [])]) {
    const [x, y] = gate(g);
    if (g[1] === "east") left = x;
    if (g[1] === "west") right = x;
    if (g[1] === "south") top = y;
    if (g[1] === "north") bottom = y;
  }
  return {
    name,
    palette,
    from: from[0],
    to: to[0],
    departure: from[1],
    arrival: endGate?.[1],
    line,
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    landmark,
    note,
    turnout,
  };
}

export const routes: Record<string, ReturnType<typeof road>> = {
  "01": road(
    "Dewpath",
    "meadow",
    ["dewdrop", "east"],
    [
      [58, 215],
      [64, 222],
      [73, 222],
      [79, 232],
    ],
    ["mossford", "west"],
    "Minnow Bend",
    "Poliwag eggs cling to the undersides of the lily pads. The smallest ripples swim against the current.",
    6,
  ),
  "02": road(
    "Orchard Lane",
    "orchard",
    ["mossford", "east"],
    [
      [134, 233],
      [143, 242],
      [155, 242],
      [155, 226],
      [167, 216],
    ],
    ["bramble", "west"],
    "Cider Mill Ford",
    "Windfalls drift against the footbridge. The orchard hands leave the bruised ones here for Sentret.",
    -7,
  ),
  "03": road(
    "Lantern Approach",
    "autumn",
    ["bramble", "north"],
    [
      [203, 194],
      [214, 185],
      [214, 178],
    ],
    ["lantern_1", 224, 175],
    "Lamplighter’s Rest",
    "An oil tin hangs from a low branch. Someone has trimmed every wick except the one beside the missing surveyor’s pack.",
    6,
  ),
  "04": road(
    "Amberbank",
    "autumn",
    ["bramble", "east"],
    [
      [232, 216],
      [243, 227],
      [259, 227],
      [269, 212],
      [283, 202],
    ],
    ["tideglass", "west"],
    "Ochre Bluff",
    "The tide has bitten into the red clay. Look closely and each stripe holds a different kind of shell.",
    -8,
  ),
  "05": road(
    "Saltwind Coast",
    "coast",
    ["tideglass", "south"],
    [
      [310, 227],
      [325, 238],
      [325, 251],
      [311, 254],
    ],
    ["undertow_1", 302, 262],
    "Gullwatch Steps",
    "Tin weather vanes creak above the steps. The scratched line on the bottom stair marks last winter’s high tide.",
    7,
  ),
  "06": road(
    "Canal Road",
    "coast",
    ["tideglass", "east"],
    [
      [342, 202],
      [352, 188],
      [367, 188],
      [378, 200],
      [390, 200],
    ],
    ["copperwick", "west"],
    "Three Locks",
    "Three gate wheels, each a little higher than the last. A lock tender has chalked today’s water level on the middle one.",
    8,
  ),
  "07": road(
    "Switchyard",
    "industrial",
    ["copperwick", "east"],
    [
      [447, 194],
      [455, 185],
      [465, 185],
      [465, 171],
    ],
    ["copperworks_1", 456, 165],
    "Signal Box",
    "A little steel flag twitches each time the relay trips. Even from here you can hear the missing beat.",
    -6,
  ),
  "08": road(
    "Saffron Dunes",
    "desert",
    ["copperwick", "north"],
    [
      [419, 169],
      [400, 154],
      [400, 142],
      [423, 133],
      [434, 118],
    ],
    ["sunspire", "south"],
    "Singing Saddle",
    "Wind blows across the hollow ridge with the sound of a bottle flute. The sand on the lee side is perfectly still.",
    9,
  ),
  "09": road(
    "Glassway",
    "desert",
    ["sunspire", "east"],
    [
      [460, 90],
      [469, 81],
      [469, 69],
      [457, 60],
    ],
    ["hourglass_1", 461, 52],
    "Fulgurite Field",
    "Thin glass roots poke out of the dune. The glassworkers dig around them with brushes after every thunderstorm.",
    -7,
  ),
  "10": road(
    "Reedwalk",
    "wetland",
    ["sunspire", "west"],
    [
      [405, 90],
      [390, 78],
      [390, 58],
      [378, 43],
    ],
    ["reedhaven", "east"],
    "Kingfisher Hide",
    "There is a narrow slit in the reeds. Through it you can see Wooper feeding where the fresh water meets the salt.",
    7,
  ),
  "11": road(
    "Bamboo Reach",
    "wetland",
    ["reedhaven", "north"],
    [
      [345, 23],
      [334, 13],
      [335, 4],
      [348, -2],
    ],
    ["bamboo_1", 348, -10],
    "Ranger’s Blind",
    "Bamboo poles are tied in pairs. The rangers count a pair for each Farfetch’d nest they find.",
    -6,
  ),
  "12": road(
    "Ashen Trail",
    "volcanic",
    ["reedhaven", "west"],
    [
      [312, 43],
      [298, 32],
      [276, 32],
      [265, 18],
      [225, 18],
      [208, 30],
      [191, 30],
      [178, 39],
    ],
    ["cinderfall", "east"],
    "Charcoal Kilns",
    "Grass is already growing in the shell of the oldest kiln. Across the slag beds a second chimney still breathes steam.",
    8,
  ),
  "13": road(
    "Ember Slope",
    "volcanic",
    ["cinderfall", "north"],
    [
      [147, 17],
      [159, 8],
      [160, -2],
      [148, -9],
    ],
    ["ember_1", 137, -9],
    "Furnace Lip",
    "Warm air lifts flecks of ash out of the vent. The miners dry their gloves here between shifts.",
    6,
  ),
  "14": road(
    "High Pass",
    "mountain",
    ["cinderfall", "south"],
    [
      [147, 63],
      [132, 76],
      [132, 88],
      [158, 98],
      [160, 111],
      [152, 118],
    ],
    ["rimepeak", "north"],
    "Goatherd’s Cairn",
    "The stones mark the last place you can see both the warm springs below and the white ridge above.",
    -8,
  ),
  "15": road(
    "Snowmelt Road",
    "snow",
    ["rimepeak", "west"],
    [
      [128, 135],
      [119, 124],
      [119, 108],
      [108, 100],
    ],
    ["frostvault_1", 99, 102],
    "Blue Ice Shelf",
    "Fresh water ticks from the eaves. Beneath the blue ice, bubbles are trapped in the shape of a rising spiral.",
    6,
  ),
  "16": road(
    "Bellflower Way",
    "violet",
    ["rimepeak", "south"],
    [
      [152, 157],
      [167, 170],
      [183, 170],
      [195, 157],
      [218, 157],
      [227, 149],
    ],
    ["bellweather", "west"],
    "Shepherd’s Chime",
    "A bronze cup hangs over the meadow. When the wind turns toward Bellweather it rings half a beat before the tower.",
    -7,
  ),
  "17": road(
    "Pilgrim Walk",
    "violet",
    ["bellweather", "east"],
    [
      [274, 149],
      [284, 136],
      [284, 128],
      [273, 118],
    ],
    ["echo_1", 279, 110],
    "Ribbon Gate",
    "Hundreds of purple ribbons face the wind. A little brass clapper hangs from the oldest knot.",
    7,
  ),
  "18": road(
    "Starlit Avenue",
    "night",
    ["bellweather", "north"],
    [
      [249, 130],
      [235, 119],
      [235, 108],
      [250, 99],
    ],
    ["aster", "south"],
    "Mirror Terrace",
    "The pool is lined with black stone. Even before dusk you can pick out a single bright star in its reflection.",
    -7,
  ),
  "19": road(
    "Observatory Approach",
    "night",
    ["aster", "east"],
    [
      [276, 76],
      [286, 66],
      [295, 66],
      [302, 75],
    ],
    ["starfall_1", 302, 84],
    "Transit Stones",
    "Each brass pin casts its shadow onto the next. The final pin points straight at the observatory dome.",
    6,
  ),
  "20": road(
    "Crown Road",
    "mountain",
    ["aster", "west"],
    [
      [225, 76],
      [217, 65],
      [207, 65],
      [207, 79],
    ],
    ["crown", "east"],
    "The Last Mile",
    "Every League challenger adds one pebble. The earliest stones have almost disappeared under the moss.",
    -6,
  ),
  "21": road(
    "Dewdrop Grove",
    "meadow",
    ["dewdrop", "south"],
    [
      [33, 246],
      [54, 259],
      [83, 259],
      [96, 271],
      [136, 271],
      [153, 254],
      [180, 254],
      [203, 235],
    ],
    ["bramble", "south"],
    "The Hollow Oak",
    "The inside of the old trunk is polished smooth. Something small has been slipping through here for years.",
    8,
  ),
  "22": road(
    "Tidal Crossing",
    "coast",
    ["tideglass", "north", 5],
    [
      [315, 176],
      [328, 160],
      [328, 139],
      [342, 127],
      [342, 106],
      [327, 94],
      [327, 77],
      [345, 66],
    ],
    ["reedhaven", "south"],
    "Cormorant Bank",
    "Ferry pilots line up the two striped posts to find the deep channel. Shellder cover the posts below the waterline.",
    8,
  ),
  "23": road(
    "Old Quarry",
    "mountain",
    ["mossford", "north"],
    [
      [107, 207],
      [88, 185],
      [88, 170],
      [72, 155],
      [72, 96],
      [88, 80],
      [88, 62],
      [111, 39],
    ],
    ["cinderfall", "west"],
    "Ammonite Cut",
    "A whole spiral shell shows in the quarry face. The rail bends here because the first crew refused to cut through it.",
    -8,
  ),
  "24": road(
    "Moonwater Reach",
    "coast",
    ["tideglass", "north", -5],
    [
      [305, 180],
      [292, 170],
      [278, 176],
      [267, 176],
      [249, 164],
    ],
    ["bellweather", "south"],
    "Moon Pool",
    "Even at low tide this basin stays full. The silver scales on the rim all point toward the center.",
    -6,
  ),
  "25": road(
    "Aurora Trail",
    "night",
    ["dewdrop", "west"],
    [
      [7, 215],
      [-3, 207],
      [-3, 196],
      [4, 185],
    ],
    ["aurora_1", -4, 177],
    "First Light",
    "Long before the first beacon, migrating Pokémon rested on this bank. Six sets of small footprints lead into the grass.",
    7,
  ),
};

// Long roads have surveyed side excursions. Endpoints rejoin the main trail.
export const excursions: Partial<Record<string, [start: number, waypoints: Point[], end: number]>> = {
  "02": [
    0.29,
    [
      [141, 228],
      [148, 220],
      [159, 220],
    ],
    0.7,
  ],
  "06": [
    0.24,
    [
      [349, 200],
      [362, 201],
      [375, 208],
      [383, 208],
    ],
    0.77,
  ],
  "08": [
    0.28,
    [
      [414, 151],
      [423, 150],
      [431, 145],
      [427, 138],
    ],
    0.72,
  ],
  "12": [
    0.32,
    [
      [270, 44],
      [252, 45],
      [234, 36],
      [226, 29],
    ],
    0.68,
  ],
  "14": [
    0.24,
    [
      [146, 80],
      [151, 85],
      [166, 85],
      [169, 96],
      [167, 105],
    ],
    0.77,
  ],
  "21": [
    0.3,
    [
      [88, 247],
      [107, 251],
      [122, 261],
      [140, 261],
    ],
    0.65,
  ],
  "23": [
    0.36,
    [
      [85, 145],
      [91, 137],
      [90, 119],
      [80, 111],
    ],
    0.61,
  ],
};

export function localTrail(route: (typeof routes)[string]): Point[] {
  return route.line.map(([x, y]) => [x - route.x, y - route.y]);
}

/** Rasterize the survey onto the same tile centers used by the road builder. */
export function traceTrail(points: Point[]) {
  const cells: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1];
    const dx = points[i][0] - x,
      dy = points[i][1] - y;
    const length = Math.max(Math.abs(dx), Math.abs(dy));
    for (let step = 1; step <= length; step++)
      cells.push([x + Math.round((dx * step) / length), y + Math.round((dy * step) / length)]);
  }
  return cells;
}

export function surveyTrail(n: string) {
  const spec = routes[n],
    trail = traceTrail(localTrail(spec));
  const at = (fraction: number) => trail[Math.round(fraction * (trail.length - 1))];
  const constrain = ([x, y]: Point): Point => [
    Math.max(3, Math.min(spec.width - 4, Math.round(x))),
    Math.max(3, Math.min(spec.height - 4, Math.round(y))),
  ];
  function beside(fraction: number, distance: number): Point {
    const [x, y] = at(fraction);
    const before = at(fraction - 0.025),
      after = at(fraction + 0.025);
    const dx = after[0] - before[0],
      dy = after[1] - before[1];
    const length = Math.hypot(dx, dy) || 1;
    return constrain([x - (dy * distance) / length, y + (dx * distance) / length]);
  }
  const excursion = excursions[n];
  const bends = excursion
    ? excursion[1].map(([x, y]) => constrain([x - spec.x, y - spec.y]))
    : [beside(0.38, spec.turnout), beside(0.48, spec.turnout), beside(0.57, spec.turnout)];
  const turnout = bends[Math.floor(bends.length / 2)];
  const bypass = traceTrail([at(excursion?.[0] ?? 0.29), ...bends, at(excursion?.[2] ?? 0.67)]);
  return { trail, at, beside, bypass, turnout };
}

// Transitional belts occupy a particular shore or slope of a through road.
const approaches: Record<string, [near: string, far: string]> = {
  "02": ["orchard", "autumn"],
  "04": ["autumn", "coast"],
  "06": ["coast", "industrial"],
  "08": ["industrial", "desert"],
  "10": ["desert", "wetland"],
  "12": ["wetland", "volcanic"],
  "14": ["volcanic", "snow"],
  "16": ["snow", "violet"],
  "18": ["violet", "night"],
  "20": ["night", "mountain"],
  "23": ["orchard", "volcanic"],
};
export function trailPalette(id: string, x: number, y: number, fallback: string) {
  const n = id.slice(5),
    belt = approaches[n];
  if (!belt) return fallback;
  const r = routes[n],
    [sx, sy] = r.line[0],
    [ex, ey] = r.line.at(-1)!;
  const dx = ex - sx,
    dy = ey - sy;
  const t = ((x + r.x - sx) * dx + (y + r.y - sy) * dy) / (dx * dx + dy * dy) + 0.035 * Math.sin((x + y) / 3);
  return t < 0.19 ? belt[0] : t > 0.78 ? belt[1] : fallback;
}
