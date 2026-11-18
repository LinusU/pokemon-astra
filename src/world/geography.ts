import type { Exit, WorldMap } from "./index";

import { dungeonPlans } from "./dungeon-plans";
import { expeditionFloor, expeditions, sidePassages } from "./expeditions";
import { gyms } from "./gyms";
import { routes, settlements, surveyTrail, type Point } from "./atlas";
type Patch = [
  x: number,
  y: number,
  width: number,
  height: number,
  tile: string,
];
type Region = Record<string, WorldMap>;

export const dimensions = (id: string, kind: WorldMap["kind"]): Point => {
  if (kind === "route" || kind === "town") {
    const site = kind === "route" ? routes[id.slice(5)] : settlements[id as keyof typeof settlements];
    return [site.width, site.height];
  }
  if (kind === "dungeon") {
    const [site, n] = id.split("_");
    const { plan } = dungeonPlans[site][Number(n) - 1];
    return [plan[0].length, plan.length];
  }
  if (kind === "gym") return [gyms[id].plan[0].length, gyms[id].plan.length];
  if (id.startsWith("league")) return [24, 16];
  if (id === "lab") return [13, 10];
  if (id.endsWith("_center")) return [12, 9];
  return [11, 9];
};

const walkableWithoutSurf = (ch: string | undefined) =>
  ch !== undefined && !"#orw~BCPTS".includes(ch);

function resizeLayout(map: WorldMap, width: number, height: number) {
  const point = ([x, y]: Point): Point => [
    Math.round((x * (map.width - 1)) / (width - 1)),
    Math.round((y * (map.height - 1)) / (height - 1)),
  ];
  const patch = ([x, y, w, h, tile]: Patch): Patch => {
    const [left, top] = point([x, y]);
    const [right, bottom] = point([x + w - 1, y + h - 1]);
    return [left, top, right - left + 1, bottom - top + 1, tile];
  };
  const anchors = (points: Record<string, Point>) =>
    Object.fromEntries(Object.entries(points).map(([id, p]) => [id, point(p)]));
  return { point, patch, anchors };
}

function floorPlan(map: WorldMap, ground: string) {
  const { width, height } = map;
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "#" : ground,
    ),
  );
  function patch([x, y, w, h, tile]: Patch) {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++) {
        if (row <= 0 || col <= 0 || row >= height - 1 || col >= width - 1)
          throw new Error(`Invalid patch in ${map.id} at ${col},${row}`);
        grid[row][col] = tile;
      }
  }
  function trail(points: Point[], shoulder = 0) {
    function paint(x: number, y: number) {
      for (let row = y - shoulder; row <= y + shoulder; row++)
        for (let col = x - shoulder; col <= x + shoulder; col++) {
          if (row <= 0 || col <= 0 || row >= height - 1 || col >= width - 1)
            continue;
          const tile = grid[row][col];
          grid[row][col] = tile === "~" || tile === "=" ? "=" : ".";
        }
    }
    let [x, y] = points[0];
    paint(x, y);
    for (const [tx, ty] of points.slice(1)) {
      while (x !== tx) {
        x += Math.sign(tx - x);
        paint(x, y);
      }
      while (y !== ty) {
        y += Math.sign(ty - y);
        paint(x, y);
      }
    }
  }
  return { grid, patch, trail };
}

function relocateExit(world: Region, map: WorldMap, exit: Exit, [x, y]: Point) {
  const back = world[exit.to].exits.find(
    (other) =>
      other.to === map.id && other.x === exit.toX && other.y === exit.toY,
  );
  if (!back)
    throw new Error(`Missing reciprocal exit for ${map.id} → ${exit.to}`);
  back.toX = exit.x = x;
  back.toY = exit.y = y;
}

function roadApproach(map: WorldMap, exit: Exit): Point {
  if (exit.direction === "west") return [2, exit.y];
  if (exit.direction === "east") return [map.width - 3, exit.y];
  if (exit.direction === "north") return [exit.x, 2];
  return [exit.x, map.height - 3];
}

type Layout = ReturnType<typeof floorPlan>;
function finish(map: WorldMap, plan: Layout) {
  const { grid } = plan;
  for (const exit of map.exits) {
    if (!exit.direction) {
      for (let x = exit.x; x < exit.x + (exit.width ?? 1); x++) {
        if (grid[exit.y][x] !== "d") grid[exit.y][x] = ".";
        if (exit.entrance === "mat" && !walkableWithoutSurf(grid[exit.y - 1][x]))
          grid[exit.y - 1][x] = ".";
      }
      continue;
    }
    const vertical = exit.direction === "north" || exit.direction === "south";
    for (let offset = -1; offset <= 1; offset++) {
      const x = exit.x + (vertical ? offset : 0);
      const y = exit.y + (vertical ? 0 : offset);
      grid[y][x] = ".";
    }
  }
  map.tiles = grid.map((row) => row.join(""));
}

const sightDirections = [
  ["down", 0, 1], ["left", -1, 0], ["up", 0, -1], ["right", 1, 0],
] as const;

function aimTrainers(map: WorldMap) {
  const occupied = new Set(
    map.objects
      .filter((object) => ["person", "trainer", "leader", "healer", "shop", "starter"].includes(object.kind))
      .map(({ x, y }) => y * map.width + x),
  );
  for (const trainer of map.objects) {
    if (trainer.kind !== "trainer") continue;
    const maxRange = trainer.sightRange ?? (
      trainer.id.includes("_optional_") ? 3 : map.kind === "dungeon" ? 4 : 5
    );
    let bestScore = -1;
    let bestRange = 0;
    let bestFacing = trainer.facing;
    for (const [facing, dx, dy] of sightDirections) {
      if (trainer.facing && trainer.facing !== facing) continue;
      let range = 0;
      let pathTiles = 0;
      for (let step = 1; step <= maxRange; step++) {
        const x = trainer.x + dx * step;
        const y = trainer.y + dy * step;
        const tile = map.tiles[y]?.[x];
        if (!walkableWithoutSurf(tile) || occupied.has(y * map.width + x)) break;
        range = step;
        if (tile === "." || tile === "=") pathTiles++;
      }
      // Face along a clear walking route when possible. Side-path trainers have a shorter reach.
      const score = pathTiles * 2 + range;
      if (score > bestScore) {
        bestScore = score;
        bestRange = range;
        bestFacing = facing;
      }
    }
    trainer.facing ??= bestFacing;
    trainer.sightRange ??= bestRange;
  }
}

function placeObjects(
  map: WorldMap,
  plan: Layout,
  anchors: Record<string, Point>,
  fallback: Point,
) {
  const { grid } = plan;
  const distance = (x: number, y: number, point: Point) =>
    Math.abs(point[0] - x) + Math.abs(point[1] - y);
  const used: Point[] = [...map.exits.map((exit): Point => [exit.x, exit.y])];
  const cells: Point[] = [];
  for (let y = 2; y < map.height - 2; y++)
    for (let x = 2; x < map.width - 2; x++)
      if (walkableWithoutSurf(grid[y][x])) cells.push([x, y]);

  // Reserve deliberate landmarks first. Other interactions settle near their
  // own anchor instead of collecting in the geometric center of every map.
  const ordered = [...map.objects].sort(
    (a, b) => Number(Boolean(anchors[b.id])) - Number(Boolean(anchors[a.id])),
  );
  for (const object of ordered) {
    const anchor = anchors[object.id] ?? fallback;
    let best: Point | undefined;
    let nearest = Infinity;
    for (const [x, y] of cells) {
      const d = distance(x, y, anchor);
      if (d >= nearest || used.some((point) => distance(x, y, point) < 2))
        continue;
      if (
        map.exits.some(
          (e) => e.direction && distance(x, y, roadApproach(map, e)) <= 1,
        )
      )
        continue;
      best = [x, y];
      nearest = d;
    }
    if (!best)
      throw new Error(`No landmark position for ${map.id}:${object.id}`);
    [object.x, object.y] = best;
    used.push(best);
    const tile = grid[object.y][object.x];
    if (tile === "g") grid[object.y][object.x] = ",";
  }
}

interface TownPlan {
  square: Point;
  sites: [x: number, y: number, width: number][];
  ground: Patch[];
  anchors: Record<string, Point>;
  /** Secondary lane or promenade. */
  lane?: Point[];
  house?: [x: number, y: number, width: number];
}

const towns: Record<string, TownPlan> = {
  dewdrop: {
    square: [12, 10],
    sites: [
      [2, 3, 5],
      [17, 6, 5],
      [9, 2, 7],
      [2, 13, 5],
    ],
    ground: [
      [1, 1, 6, 2, "#"],
      [18, 1, 6, 3, "#"],
      [20, 16, 4, 3, "#"],
      [17, 13, 5, 3, "~"],
      [18, 12, 4, 5, "~"],
      [15, 12, 2, 4, "f"],
      [2, 7, 5, 2, "f"],
      [15, 2, 3, 3, "f"],
      [8, 16, 2, 3, "#"],
    ],
    anchors: {
      robin_start: [10, 8],
      quest_hearth: [15, 13],
      resident_dewdrop_0: [7, 6],
      resident_dewdrop_1: [19, 10],
    },
    lane: [
      [4, 16],
      [7, 16],
      [7, 10],
      [12, 10],
    ],
  },
  mossford: {
    house: [3, 2, 5],
    square: [12, 9],
    sites: [
      [17, 4, 6],
      [3, 12, 6],
    ],
    ground: [
      [1, 1, 3, 5, "#"],
      [21, 1, 3, 2, "#"],
      [2, 11, 8, 1, "~"],
      [1, 15, 2, 4, "~"],
      [1, 17, 10, 2, "~"],
      [10, 16, 6, 3, "~"],
      [15, 14, 9, 3, "~"],
      [5, 2, 2, 2, "#"],
      [8, 2, 2, 2, "#"],
      [5, 5, 2, 2, "#"],
      [8, 5, 2, 2, "#"],
      [3, 7, 2, 2, "f"],
      [20, 11, 4, 2, "f"],
    ],
    anchors: {
      robin_mossford: [10, 9],
      quest_parcel: [15, 9],
      quest_pollinators: [7, 7],
      quest_medicine: [17, 11],
      resident_mossford_0: [8, 7],
      resident_mossford_1: [8, 15],
    },
    lane: [
      [12, 7],
      [12, 15],
      [6, 15],
    ],
  },
  bramble: {
    house: [15, 12, 5],
    square: [13, 10],
    sites: [
      [4, 2, 7],
      [16, 3, 5],
      [5, 14, 5],
    ],
    ground: [
      [1, 1, 6, 1, "#"],
      [1, 1, 3, 6, "#"],
      [7, 1, 4, 3, "#"],
      [13, 1, 4, 5, "#"],
      [21, 13, 4, 6, "#"],
      [14, 14, 5, 4, "f"],
      [2, 12, 3, 5, "#"],
    ],
    anchors: {
      parcel_recipient: [6, 12],
      resident_bramble_0: [16, 7],
      resident_bramble_1: [7, 6],
    },
    lane: [
      [6, 12],
      [13, 12],
      [13, 10],
      [21, 10],
    ],
  },
  tideglass: {
    house: [9, 2, 5],
    square: [13, 8],
    sites: [
      [17, 2, 7],
      [2, 3, 5],
      [18, 7, 5],
    ],
    ground: [
      [1, 12, 24, 7, "~"],
      [9, 11, 6, 1, "~"],
      [18, 15, 5, 3, ","],
      [3, 13, 5, 2, "="],
      [18, 13, 5, 2, "="],
      [19, 2, 5, 2, "#"],
      [22, 17, 1, 1, "#"],
    ],
    anchors: {
      quest_angler: [5, 13],
      quest_lighthouse: [21, 15],
      resident_tideglass_0: [12, 6],
      resident_tideglass_1: [17, 11],
    },
    lane: [
      [3, 13],
      [5, 13],
      [5, 11],
      [21, 11],
      [21, 16],
    ],
  },
  copperwick: {
    square: [15, 10],
    sites: [
      [2, 12, 7],
      [18, 12, 5],
      [17, 3, 7],
    ],
    ground: [
      [10, 1, 3, 18, "~"],
      [1, 5, 9, 2, "~"],
      [2, 1, 6, 3, "w"],
      [20, 1, 5, 2, "#"],
      [2, 17, 6, 2, "f"],
    ],
    anchors: {
      quest_collector: [5, 10],
      robin_copperwick: [14, 14],
      resident_copperwick_0: [14, 5],
      resident_copperwick_1: [7, 8],
    },
    lane: [
      [5, 15],
      [5, 10],
      [15, 10],
      [20, 10],
      [20, 15],
    ],
  },
  sunspire: {
    house: [3, 1, 5],
    square: [13, 12],
    sites: [
      [17, 1, 7],
      [3, 11, 5],
      [17, 13, 5],
    ],
    ground: [
      [4, 3, 7, 4, "~"],
      [5, 2, 5, 6, "~"],
      [3, 4, 1, 4, "f"],
      [11, 4, 1, 5, "f"],
      [3, 1, 2, 2, "#"],
      [19, 6, 6, 3, "#"],
      [3, 17, 6, 2, "#"],
    ],
    anchors: {
      quest_oasis: [8, 8],
      oasis_spring: [10, 7],
      resident_sunspire_0: [5, 15],
      resident_sunspire_1: [12, 6],
    },
    lane: [
      [6, 9],
      [14, 9],
      [14, 5],
      [20, 5],
    ],
  },
  reedhaven: {
    house: [14, 13, 5],
    square: [14, 9],
    sites: [
      [16, 4, 7],
      [4, 11, 5],
    ],
    ground: [
      [1, 2, 9, 7, "~"],
      [8, 7, 5, 12, "~"],
      [14, 13, 11, 6, "~"],
      [16, 14, 5, 3, "#"],
      [2, 15, 4, 4, "#"],
      [1, 1, 9, 1, "#"],
      [4, 1, 6, 2, "#"],
      [20, 1, 5, 2, "#"],
    ],
    anchors: {
      ranger: [15, 6],
      quest_census: [13, 13],
      resident_reedhaven_0: [6, 14],
      resident_reedhaven_1: [16, 10],
    },
    lane: [
      [5, 14],
      [7, 14],
      [7, 9],
      [17, 9],
    ],
  },
  cinderfall: {
    square: [13, 9],
    sites: [
      [2, 13, 7],
      [16, 12, 5],
      [4, 3, 7],
    ],
    ground: [
      [18, 2, 6, 5, "#"],
      [1, 1, 6, 2, "#"],
      [15, 4, 6, 3, "~"],
      [15, 5, 4, 3, "~"],
      [21, 14, 4, 5, "#"],
      [2, 10, 4, 2, "#"],
    ],
    anchors: {
      quest_furnace: [18, 16],
      resident_cinderfall_0: [15, 3],
      resident_cinderfall_1: [20, 8],
    },
    lane: [
      [6, 16],
      [10, 16],
      [10, 8],
      [20, 8],
    ],
  },
  rimepeak: {
    house: [8, 11, 5],
    square: [12, 12],
    sites: [
      [3, 3, 7],
      [16, 2, 5],
      [17, 13, 7],
    ],
    ground: [
      [1, 9, 5, 8, "#"],
      [9, 2, 4, 4, "#"],
      [21, 4, 4, 4, "#"],
      [6, 14, 4, 4, "~"],
      [10, 15, 4, 3, "f"],
      [20, 8, 5, 2, "#"],
    ],
    anchors: { medicine_spring: [8, 17], resident_rimepeak_0: [15, 6], resident_rimepeak_1: [9, 12] },
    lane: [
      [6, 6],
      [6, 7],
      [16, 7],
      [16, 15],
      [20, 15],
    ],
  },
  bellweather: {
    square: [12, 10],
    sites: [
      [2, 7, 7],
      [16, 13, 5],
      [9, 2, 7],
    ],
    ground: [
      [2, 2, 4, 4, "#"],
      [3, 14, 6, 5, "f"],
      [17, 2, 4, 3, "w"],
      [21, 2, 4, 3, "#"],
      [21, 17, 4, 2, "#"],
      [15, 8, 4, 3, "f"],
    ],
    anchors: {
      meridian_director: [19, 6],
      robin_bellweather: [9, 12],
      resident_bellweather_0: [14, 6],
      resident_bellweather_1: [6, 13],
    },
    lane: [
      [5, 14],
      [11, 14],
      [11, 10],
      [19, 10],
      [19, 6],
    ],
  },
  aster: {
    house: [2, 11, 4],
    square: [13, 9],
    sites: [
      [5, 13, 7],
      [17, 12, 5],
      [17, 1, 7],
    ],
    ground: [
      [3, 2, 5, 5, "f"],
      [4, 3, 3, 3, "~"],
      [9, 2, 3, 3, "#"],
      [22, 8, 3, 3, "f"],
      [6, 10, 3, 2, "f"],
      [13, 15, 3, 4, "#"],
    ],
    anchors: {
      quest_chart: [7, 7],
      quest_promise: [14, 13],
      robin_aster: [6, 9],
      resident_aster_0: [15, 5],
      resident_aster_1: [21, 11],
    },
    lane: [
      [4, 8],
      [8, 8],
      [8, 10],
      [20, 10],
      [20, 4],
    ],
  },
  crown: {
    square: [13, 10],
    sites: [
      [3, 11, 7],
      [18, 11, 5],
      [8, 2, 11],
    ],
    ground: [
      [1, 1, 6, 7, "#"],
      [19, 1, 6, 7, "#"],
      [2, 15, 4, 4, "#"],
      [20, 16, 5, 3, "#"],
      [6, 7, 3, 3, "f"],
      [17, 7, 3, 3, "f"],
    ],
    anchors: { resident_crown_0: [9, 8], resident_crown_1: [16, 8] },
    lane: [
      [6, 14],
      [6, 10],
      [20, 10],
      [20, 14],
    ],
  },
};

function townLayout(world: Region, map: WorldMap, spec: TownPlan) {
  if (map.id !== "dewdrop" && map.id !== "mossford") {
    const { point, patch, anchors } = resizeLayout(map, 26, 20);
    const site = ([x, y, w]: [number, number, number]): [
      number,
      number,
      number,
    ] => {
      const [left, top, width] = patch([x, y, w, 3, "r"]);
      return [left, top, width];
    };
    spec = {
      square: point(spec.square),
      ground: spec.ground.map(patch),
      sites: spec.sites.map(site),
      anchors: anchors(spec.anchors),
      lane: spec.lane?.map(point),
      house: spec.house && site(spec.house),
    };
  }
  const plan = floorPlan(map, ",");
  const [cx, cy] = spec.square;
  spec.ground.forEach(plan.patch);
  plan.patch([cx - 2, cy - 1, 5, 3, "."]);
  if (spec.lane) plan.trail(spec.lane);

  const portals = map.exits.filter((e) => !e.direction);
  const buildings = portals.filter((e) => world[e.to].kind !== "dungeon");
  // Keep services together in the specification while allowing each town to
  // put the keeper on the far side of a canal, plaza, ridge or market.
  const priority = (e: Exit) =>
    e.to.endsWith("_center")
      ? 0
      : e.to.endsWith("_mart")
        ? 1
        : e.to === "home" || e.to.endsWith("_house")
          ? 3
          : 2;
  const site = (exit: Exit, index: number) =>
    exit.to.endsWith("_house") ? spec.house! : spec.sites[index];
  buildings.sort((a, b) => priority(a) - priority(b));
  for (const e of map.exits.filter((e) => e.direction))
    plan.trail([spec.square, roadApproach(map, e), [e.x, e.y]], 1);
  buildings.forEach((e, i) => {
    const [x, y, width] = site(e, i);
    relocateExit(world, map, e, [x + Math.floor(width / 2), y + 2]);
    const door: Point = [e.x, e.y + 1];
    plan.trail([spec.square, [cx, door[1]], door], 1);
  });
  for (const e of portals.filter((exit) => world[exit.to].kind === "dungeon")) {
    const point: Point = map.id === "bellweather" ? [19, 5] : [21, 5];
    relocateExit(world, map, e, point);
    plan.trail([spec.square, [point[0], cy], point], 1);
  }
  buildings.forEach((e, i) => {
    const [x, y, width] = site(e, i);
    plan.patch([x, y, width, 2, "r"]);
    plan.patch([x, y + 2, width, 1, "w"]);
    plan.grid[e.y][e.x] = "d";
  });
  placeObjects(
    map,
    plan,
    { [`sign_${map.id}`]: [cx - 2, cy + 2], ...spec.anchors },
    [cx + 3, cy + 2],
  );
  finish(map, plan);
}

const walkers: Record<string, [string, string, number]> = {
  route08: ["Glass carrier", "My wagon has to keep to the long bend. On foot you can cut behind the saddle and pass the blue pool.", 0.12],
  route12: ["Charcoal burner", "I ship the charcoal down to the reed beds. My daughter takes the kiln path while I take the cart road. She always beats me home.", 0.84],
  route14: ["Mountain guide", "See the white line on the ridge? That’s Rimepeak. Neve takes challengers as soon as they’ve reopened Frostvault, even if they haven’t met Flint yet.", 0.33],
  route17: ["Bell keeper", "Hear that rustle? Murkrow and Umbreon feed along Pilgrim Walk. Lyra’s Psychic attacks can’t touch a Dark Pokémon.", 0.18],
  route21: ["Orchard forager", "Mossford is just beyond those trees. This old drovers’ path skirts the orchards all the way from Dewdrop to Bramble.", 0.24],
  route22: ["Ferry pilot", "The middle bank is dry at both tides. From the far landing you can go east to the dunes or ask the rangers about the ash road west.", 0.48],
  route23: ["Rail inspector", "The old freight line carried cinders down and apples back up. Follow it north to the furnace town or south to Mossford.", 0.17],
  route24: ["Bell diver", "I can hear the first bell through the hull on a still day. Bellweather is across the western sound.", 0.72],
};

function routeLayout(world: Region, map: WorldMap) {
  const spec = routes[map.id.slice(5)];
  const { trail, at, beside, bypass, turnout } = surveyTrail(map.id.slice(5));
  const coast = map.palette === "coast", marsh = map.palette === "wetland";
  const crossing = map.id === "route22";
  const plan = floorPlan(map, coast || marsh ? "o" : "#");
  const { grid } = plan;
  if (coast || marsh) {
    for (const row of grid) row.fill("o");
  }
  const interior = (x: number, y: number) => x > 0 && x < map.width - 1 && y > 0 && y < map.height - 1;
  function oval([x, y]: Point, rx: number, ry: number, tile: string) {
    for (let j = -ry; j <= ry; j++)
      for (let i = -rx; i <= rx; i++)
        if (interior(x + i, y + j) && i * i / rx ** 2 + j * j / ry ** 2 <= 1)
          grid[y + j][x + i] = tile;
  }
  for (let i = 0; i < trail.length; i++) {
    const radius = 4 + Math.round(1.5 + 1.5 * Math.sin(i / 8));
    if (coast || marsh) oval(trail[i], radius + 2, radius + 1, "~");
    oval(trail[i], radius, radius - 1, ",");
  }
  for (const p of bypass) oval(p, 3, 3, ",");
  if (map.id === "route06") {
    for (const [x, y] of trail.slice(10, -9)) oval([x, y + 4], 3, 3, "~");
  }
  if (map.id === "route08" || map.id === "route14") {
    const pool = beside(0.52, spec.turnout / 2);
    oval(pool, 5, 4, "~");
  }
  const glade = beside(0.75, -Math.sign(spec.turnout) * 5);
  oval(glade, 6, 4, ",");
  oval(glade, 5, 3, "g");
  oval(beside(0.18, 4), 4, 3, "g");
  oval(turnout, 5, 4, "g");
  const pond = beside(0.40, -Math.sign(spec.turnout) * 4);
  if (coast || marsh || ["meadow", "snow", "night", "orchard"].includes(spec.palette))
    oval(pond, 6, 3, "~");
  if (map.id === "route02" || marsh) oval(at(0.69), 5, 4, "~");

  // Orchard rows, tilted dune ridges, basalt shelves and flowering meadows
  // interrupt the shoulders without cutting through either surveyed path.
  for (let y = 1; y < map.height - 1; y++)
    for (let x = 1; x < map.width - 1; x++) {
      if (grid[y][x] !== ",") continue;
      const gx = x + spec.x, gy = y + spec.y;
      if (spec.palette === "orchard" && gx % 4 === 0 && gy % 3 === 0) grid[y][x] = "#";
      else if (["mountain", "volcanic", "desert"].includes(spec.palette) &&
        (gx + 2 * gy) % 17 < 2 && Math.cos(gx / 3) > 0.45) grid[y][x] = "#";
      else if (Math.sin(gx / 3) + Math.cos(gy / 2) > 0.65)
        grid[y][x] = ["volcanic", "industrial", "mountain", "desert"].includes(spec.palette) ? "," : "f";
    }
  for (const p of bypass) oval(p, 1, 1, ",");
  for (const [x, y] of bypass) grid[y][x] = ":";
  for (const [x, y] of trail)
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        if (!interior(x + i, y + j)) continue;
        grid[y + j][x + i] = ["~", "="].includes(grid[y + j][x + i]) ? "=" : ".";
      }
  if (map.id === "route07" || map.id === "route23")
    for (const [x, y] of trail.slice(5, -5)) grid[y][x] = "t";
  if (crossing || map.id === "route24") {
    // Two stretches of the Aurora Current separate the ferry's grass islands.
    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        const fraction = crossing ? (y + 1.5 * Math.sin(x/4)) / map.height : x / map.width;
        if (grid[y][x] !== "o" && ((fraction > 0.23 && fraction < 0.38) ||
          (crossing && fraction > 0.64 && fraction < 0.82))) grid[y][x] = "~";
      }
    }
  }
  const onward = map.exits[1];
  if (!onward.direction) relocateExit(world, map, onward, trail.at(-1)!);
  const walker = walkers[map.id];
  if (walker) map.objects.push({ kind: "person", id: "walker_" + map.id, name: walker[0],
    dialogue: walker[1], roam: 1, x: 0, y: 0 });
  const sign = "sign_" + map.id;
  map.objects.push({ kind: "sign", id: sign, x: 0, y: 0, name: spec.landmark, dialogue: spec.note });
  const anchors: Record<string, Point> = {
    [sign]: turnout,
    ["resident_" + map.id]: glade,
    ["trainer_" + map.id]: beside(0.22, -2),
    ["item_" + map.id]: bypass[Math.floor(bypass.length * 0.69)],
    [map.id + "_optional_0"]: beside(0.70, 3),
    [map.id + "_optional_1"]: bypass[Math.floor(bypass.length * 0.29)],
  };
  if (walker) anchors["walker_" + map.id] = beside(walker[2], -3);
  const others = map.objects.filter(o => !anchors[o.id]);
  others.forEach((o, i) => {
    anchors[o.id] = beside(0.60 + 0.30 * (i + 1) / (others.length + 1), i % 2 ? -3 : 3);
  });
  placeObjects(map, plan, anchors, turnout);
  finish(map, plan);
}

function dungeonLayout(world: Region, map: WorldMap) {
  const [id, n] = map.id.split("_");
  const i = Number(n) - 1;
  const rooms = dungeonPlans[id];
  const room = rooms[i];
  map.name = expeditions[id].name + " · " + room.name;
  const byMark = new Map(room.marks.map((key, j) => [String(j), key]));
  const placed = new Set<string>();
  map.tiles = room.plan.map((row, y) => Array.from(row, (tile, x) => {
    const key = byMark.get(tile);
    if (key) {
      const object = map.objects.find(o => o.id === key);
      if (!object || placed.has(key)) throw Error("Invalid anchor " + key + " in " + map.id);
      placed.add(key);
      object.x = x; object.y = y;
      return ".";
    }
    if (tile === "+" || tile === "^") {
      const link = sidePassages[id].find(([a,b,mark]) => (a === i+1 || b === i+1) && tile === mark)!;
      const other = link[0] === i+1 ? link[1] : link[0];
      const exit = map.exits.find(e => e.to === id + "_" + other)!;
      relocateExit(world, map, exit, [x, y]);
      return ".";
    }
    if ("@><".includes(tile)) {
      const exit = map.exits.find(e => tile === "@"
        ? (i ? e.to === id + "_" + i : !e.to.startsWith(id + "_"))
        : e.to === id + "_" + (tile === ">" ? i + 2 : i ? 1 : 3))!;
      relocateExit(world, map, exit, [x, y]);
      if (tile === "<") {
        exit.label = expeditions[id].shortcut;
        exit.lockedDialogue = "This return opens once you finish the expedition.";
      } else if (tile === ">") {
        exit.label = rooms[i + 1].name;
        exit.lockedDialogue = expeditions[id].clue[1];
      } else if (i) exit.label = rooms[i - 1].name;
      return ".";
    }
    return expeditionFloor(map.id, tile);
  }).join(""));
  for (const object of map.objects)
    if (!placed.has(object.id)) throw Error("Missing anchor for " + object.id + " in " + map.id);
}

function gymLayout(world: Region, map: WorldMap) {
  const gym = gyms[map.id];
  const anchors = new Map<string, Point>();
  map.tiles = gym.plan.map((row, y) => {
    if (row.length !== map.width) throw Error(`Uneven row ${y} in ${map.id}`);
    return Array.from(row, (tile, x) => {
      if (tile === "@") {
        relocateExit(world, map, map.exits[0], [x, y]);
        return ".";
      }
      const id = tile === "L" ? "leader_" + map.id.slice(3) :
        /^[1-9]$/.test(tile) ? map.id + "_" + tile : gym.landmarks?.[tile]?.id;
      if (id) {
        anchors.set(id, [x, y]);
        return gym.landmarks?.[tile]?.wildlife ? "b" : ".";
      }
      return gym.passages?.[tile]?.floor ?? tile;
    }).join("");
  });
  for (const object of map.objects) {
    const point = anchors.get(object.id);
    if (!point) throw Error(`Missing ${object.id} in ${map.id}`);
    [object.x, object.y] = point;
  }
}

const leagueTerrain: Record<string, Patch[]> = {
  league: [
    [4, 4, 4, 2, "P"],
    [16, 4, 4, 2, "P"],
    [5, 10, 2, 1, "P"],
    [17, 10, 2, 1, "P"],
    [10, 4, 5, 8, "a"],
  ],
  league_petra: [
    [1, 1, 6, 3, "#"],
    [17, 1, 6, 3, "#"],
    [5, 6, 2, 3, "#"],
    [17, 6, 2, 3, "#"],
    [7, 4, 11, 7, "a"],
    [8, 12, 1, 1, "l"],
    [16, 12, 1, 1, "l"],
  ],
  league_nyx: [
    [2, 3, 4, 4, "#"],
    [17, 8, 6, 4, "#"],
    [7, 4, 10, 7, "a"],
    [10, 11, 5, 2, "a"],
    [7, 3, 1, 1, "l"],
    [16, 3, 1, 1, "l"],
    [7, 11, 1, 1, "l"],
    [16, 11, 1, 1, "l"],
  ],
  league_gale: [
    [1, 4, 4, 2, "#"],
    [19, 4, 4, 2, "#"],
    [2, 11, 3, 1, "#"],
    [19, 11, 3, 1, "#"],
    [4, 7, 16, 3, "a"],
    [9, 3, 7, 10, "a"],
    [6, 6, 1, 1, "l"],
    [18, 6, 1, 1, "l"],
  ],
  league_mira: [
    [1, 1, 7, 2, "#"],
    [17, 1, 6, 2, "#"],
    [1, 3, 4, 2, "#"],
    [19, 3, 4, 2, "#"],
    [9, 3, 7, 10, "a"],
    [7, 4, 11, 8, "a"],
    [5, 6, 15, 4, "a"],
    [11, 13, 3, 1, "a"],
    [12, 4, 1, 1, "h"],
    [6, 5, 1, 1, "l"],
    [18, 5, 1, 1, "l"],
    [5, 10, 1, 1, "l"],
    [19, 10, 1, 1, "l"],
    [8, 12, 1, 1, "l"],
    [16, 12, 1, 1, "l"],
  ],
};

function leagueLayout(world: Region, map: WorldMap) {
  const plan = floorPlan(map, ".");
  const first = map.id === "league";
  const final = map.id === "league_mira";
  const opponent = map.objects.find((object) => object.trainer)!;
  leagueTerrain[map.id].forEach(plan.patch);
  relocateExit(world, map, map.exits[0], [12, first ? map.height - 1 : 14]);
  const onward = map.exits[1];
  if (onward) relocateExit(world, map, onward, [12, 2]);
  if (first) relocateExit(world, map, map.exits[2], [20, 12]);
  if (final)
    onward.lockedDialogue =
      "The Hall of Fame opens after defeating Champion Mira.";
  placeObjects(map, plan, { [opponent.id]: [12, 6] }, [12, 10]);
  finish(map, plan);
}

const servicePlans: Record<string, Patch[]> = {
  center: [
    [1, 1, 10, 1, "#"],
    [4, 3, 4, 1, "C"],
    [5, 1, 2, 1, "S"],
    [1, 3, 1, 1, "P"],
    [10, 3, 1, 1, "P"],
    [2, 6, 2, 1, "T"],
    [8, 6, 2, 1, "T"],
    [4, 7, 4, 1, "a"],
  ],
  mart: [
    [1, 1, 9, 1, "B"],
    [2, 3, 3, 1, "C"],
    [7, 3, 2, 1, "B"],
    [7, 4, 2, 1, "B"],
    [7, 6, 2, 1, "B"],
    [1, 6, 1, 1, "P"],
  ],
  lab: [
    [1, 1, 11, 1, "B"],
    [2, 3, 3, 1, "T"],
    [2, 4, 1, 1, "S"],
    [8, 3, 3, 1, "C"],
    [3, 7, 1, 1, "P"],
    [9, 7, 1, 1, "P"],
    [5, 6, 3, 3, "a"],
  ],
  home: [
    [1, 1, 4, 1, "B"],
    [1, 3, 1, 1, "C"],
    [2, 4, 2, 1, "T"],
    [7, 2, 2, 1, "T"],
    [9, 1, 1, 1, "B"],
    [9, 6, 1, 1, "P"],
    [4, 3, 3, 4, "a"],
  ],
};

function interiorLayout(world: Region, map: WorldMap) {
  const type = map.id.endsWith("_center")
    ? "center"
    : map.id.endsWith("_mart")
      ? "mart"
      : map.id === "lab"
        ? "lab"
        : "home";
  const plan = floorPlan(map, ".");
  servicePlans[type].forEach(plan.patch);
  const x = Math.floor(map.width / 2);
  const [door] = map.exits;
  relocateExit(world, map, door, [x, map.height - 1]);
  // The entrance aisle leads to the service counter or the central room.
  const clerk: Point =
    type === "center"
      ? [6, 2]
      : type === "mart"
        ? [3, 2]
        : type === "lab"
          ? [6, 4]
          : [3, 3];
  const [person, visitor] = map.objects;
  const anchors = { [person.id]: clerk };
  if (visitor) anchors[visitor.id] = type === "center" ? [2, 5] : [8, 5];
  placeObjects(map, plan, anchors, [x, 5]);
  person.facing = "down";
  if (visitor) visitor.facing = "left";
  finish(map, plan);
}

function townDirections(map: WorldMap) {
  const guide = map.objects.find((o) => o.id === `sign_${map.id}`);
  if (!guide) return;
  const directions = map.exits
    .filter((e) => e.direction)
    .map((e) => `${e.label} ${e.direction}`);
  const last = directions.pop();
  if (last) {
    const junctions = directions.length
      ? `${directions.join(", ")} and ${last}`
      : last;
    guide.dialogue += ` Roads lead to ${junctions}.`;
  }
}

export function composeGeography(world: Region) {
  for (const map of Object.values(world)) {
    if (map.kind === "town") townDirections(map);
    if (map.kind === "town") townLayout(world, map, towns[map.id]);
    if (map.kind === "route") routeLayout(world, map);
    if (map.kind === "gym") gymLayout(world, map);
    if (map.kind === "interior") {
      if (map.id.startsWith("league")) leagueLayout(world, map);
      else interiorLayout(world, map);
    }
  }
  for (const map of Object.values(world))
    if (map.kind === "dungeon") dungeonLayout(world, map);
  for (const map of Object.values(world))
    if (map.kind === "route" || map.kind === "dungeon") aimTrainers(map);
}
