import type { Direction, Exit, WorldMap } from "./index";

type Point = [x: number, y: number];
type Patch = [
  x: number,
  y: number,
  width: number,
  height: number,
  tile: string,
];
type Region = Record<string, WorldMap>;

export const routeDirections: Partial<Record<string, Direction>> = {
  "03": "north",
  "05": "south",
  "07": "north",
  "08": "north",
  "10": "west",
  "11": "north",
  "12": "west",
  "13": "north",
  "14": "west",
  "15": "north",
  "16": "north",
  "17": "east",
  "18": "west",
  "19": "west",
  "20": "north",
  "21": "north",
  "22": "north",
  "23": "north",
  "24": "north",
  "25": "south",
};

export const dimensions = (id: string, kind: WorldMap["kind"]): Point => {
  if (id === "route01") return [28, 18];
  if (id === "route02") return [24, 19];
  if (id === "dewdrop" || id === "mossford") return [25, 20];
  if (kind === "town") return [24, 18];
  if (kind === "route") return [23, 16];
  if (kind === "dungeon") return [20, 16];
  if (kind === "gym") return [22, 18];
  if (id.startsWith("league")) return [24, 16];
  if (id === "lab") return [13, 10];
  if (id.endsWith("_center")) return [12, 9];
  return [11, 9];
};

const walkableWithoutSurf = (ch: string | undefined) =>
  ch !== undefined && !"#rw~BCPTS".includes(ch);

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
    anchors: { resident_rimepeak_0: [15, 6], resident_rimepeak_1: [9, 12] },
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

interface RoutePlan {
  road: Point[];
  ground: Patch[];
  training: Point;
  cache: Point;
  clue: string;
  anchors?: Record<string, Point>;
}

const routes: Record<string, RoutePlan> = {
  "01": {
    road: [
      [4, 9],
      [4, 11],
      [13, 11],
      [13, 8],
      [23, 8],
      [23, 9],
    ],
    ground: [
      [1, 1, 7, 5, "#"],
      [8, 3, 5, 2, "g"],
      [14, 2, 7, 3, "f"],
      [19, 4, 6, 2, "~"],
      [20, 3, 3, 4, "~"],
      [3, 13, 7, 3, "g"],
      [16, 11, 6, 4, "g"],
      [1, 15, 2, 2, "#"],
      [24, 12, 3, 5, "#"],
    ],
    training: [8, 10],
    cache: [19, 13],
    anchors: { route01_optional_0: [16, 7], route01_optional_1: [8, 14] },
    clue: "Dewdrop lies west and Mossford east. Wild Pokémon hide in the grass south of the pond.",
  },
  "02": {
    road: [
      [4, 9],
      [4, 7],
      [10, 7],
      [10, 12],
      [18, 12],
      [18, 9],
    ],
    ground: [
      [1, 1, 4, 5, "#"],
      [6, 2, 2, 2, "#"],
      [10, 2, 2, 2, "#"],
      [14, 2, 2, 2, "#"],
      [19, 2, 4, 4, "#"],
      [11, 1, 2, 16, "~"],
      [2, 12, 7, 3, "g"],
      [13, 14, 5, 3, "g"],
      [16, 5, 4, 3, "g"],
      [2, 16, 6, 2, "#"],
      [20, 14, 3, 4, "#"],
      [5, 5, 4, 1, "f"],
    ],
    training: [6, 6],
    cache: [17, 15],
    anchors: {
      rival_1: [14, 11],
      evolution_supply_0: [7, 13],
      route02_optional_0: [8, 11],
      route02_optional_1: [18, 7],
    },
    clue: "The bridge over the orchard stream leads east to Bramble. Look south of the road for wild Pokémon.",
  },
  "03": {
    road: [
      [15, 14],
      [15, 9],
      [9, 9],
      [9, 3],
    ],
    ground: [
      [1, 1, 6, 16, "#"],
      [17, 1, 8, 5, "#"],
      [14, 6, 7, 2, "#"],
      [15, 3, 4, 3, "g"],
      [18, 11, 6, 5, "g"],
      [8, 13, 3, 3, "f"],
    ],
    training: [16, 12],
    cache: [22, 12],
    clue: "Leaves drift toward the glade at the north end. The survey rope starts at the Lantern Wood trailhead.",
  },
  "04": {
    road: [
      [5, 9],
      [5, 5],
      [15, 5],
      [15, 11],
      [22, 11],
    ],
    ground: [
      [9, 6, 3, 11, "~"],
      [8, 10, 3, 7, "~"],
      [12, 1, 2, 8, "~"],
      [2, 11, 5, 5, "g"],
      [18, 4, 6, 4, "g"],
      [17, 13, 6, 4, "#"],
    ],
    training: [6, 8],
    cache: [21, 5],
    anchors: { evolution_supply_1: [4, 14] },
    clue: "The old ford has washed out. The north bridge is the dry way to Tideglass.",
  },
  "05": {
    road: [
      [12, 4],
      [18, 4],
      [18, 11],
      [22, 11],
      [22, 14],
    ],
    ground: [
      [1, 7, 12, 10, "~"],
      [10, 10, 5, 7, "~"],
      [10, 1, 3, 6, "~"],
      [14, 8, 3, 4, "g"],
      [20, 5, 4, 4, "g"],
      [1, 1, 9, 6, "#"],
    ],
    training: [17, 6],
    cache: [22, 7],
    clue: "Follow the causeway to the cliffs. Undertow’s high sluice is nearest the sea.",
  },
  "06": {
    road: [
      [5, 9],
      [5, 13],
      [13, 13],
      [13, 5],
      [20, 5],
      [20, 9],
    ],
    ground: [
      [9, 4, 3, 12, "~"],
      [13, 8, 5, 3, "~"],
      [17, 8, 3, 9, "~"],
      [2, 3, 5, 3, "g"],
      [20, 12, 5, 4, "g"],
      [15, 2, 6, 1, "w"],
    ],
    training: [7, 12],
    cache: [4, 4],
    anchors: { pickup_part_a: [22, 14], rival_2: [14, 5] },
    clue: "Cross two canals to Copperwick. If you collect scrap, check the weeds on the far bank.",
  },
  "07": {
    road: [
      [13, 13],
      [6, 13],
      [6, 5],
      [18, 5],
      [18, 3],
    ],
    ground: [
      [10, 7, 13, 4, "w"],
      [12, 6, 11, 1, "r"],
      [20, 1, 5, 4, "#"],
      [2, 2, 4, 3, "g"],
      [19, 12, 5, 4, "g"],
      [8, 14, 5, 3, "#"],
    ],
    training: [5, 10],
    cache: [4, 3],
    anchors: { pickup_part_b: [22, 13], evolution_supply_2: [20, 12] },
    clue: "Keep the warehouse on your right to reach Copperworks. Only the old stockyard still grows grass.",
  },
  "08": {
    road: [
      [13, 14],
      [19, 14],
      [19, 10],
      [7, 10],
      [7, 4],
      [13, 4],
    ],
    ground: [
      [2, 2, 4, 6, "#"],
      [9, 6, 14, 3, "#"],
      [2, 13, 10, 4, "#"],
      [19, 2, 5, 3, "g"],
      [8, 12, 5, 2, "g"],
      [21, 14, 3, 3, "f"],
    ],
    training: [18, 12],
    cache: [22, 3],
    clue: "Follow the lee side of the dunes. The wind-carved pass turns north toward Sunspire.",
  },
  "09": {
    road: [
      [6, 9],
      [6, 13],
      [14, 13],
      [14, 7],
      [22, 7],
    ],
    ground: [
      [1, 1, 6, 5, "#"],
      [9, 2, 8, 7, "#"],
      [18, 11, 7, 6, "#"],
      [10, 11, 3, 2, "f"],
      [3, 14, 5, 3, "g"],
      [18, 3, 5, 3, "g"],
    ],
    training: [13, 11],
    cache: [20, 4],
    clue: "The broken glass posts mark the way to the ruins. The path bends around the sunken wall.",
  },
  "10": {
    road: [
      [21, 9],
      [21, 13],
      [12, 13],
      [12, 6],
      [4, 6],
      [4, 9],
    ],
    ground: [
      [1, 10, 9, 7, "~"],
      [8, 7, 7, 7, "~"],
      [14, 1, 5, 10, "~"],
      [20, 2, 5, 5, "g"],
      [5, 2, 5, 3, "g"],
      [16, 15, 4, 2, "f"],
    ],
    training: [21, 12],
    cache: [22, 5],
    anchors: { evolution_supply_3: [7, 3] },
    clue: "Stay on the boardwalks until you reach the western reed banks. The deep pools hide the stepping stones.",
  },
  "11": {
    road: [
      [13, 13],
      [9, 13],
      [9, 6],
      [17, 6],
      [17, 3],
    ],
    ground: [
      [1, 1, 6, 16, "#"],
      [11, 8, 9, 3, "~"],
      [20, 5, 5, 9, "#"],
      [11, 2, 4, 4, "g"],
      [17, 13, 6, 3, "g"],
      [8, 4, 2, 3, "f"],
    ],
    training: [11, 12],
    cache: [20, 14],
    clue: "Bamboo posts mark the ranger trail. The sanctuary lies past the northern grove.",
  },
  "12": {
    road: [
      [20, 9],
      [20, 5],
      [13, 5],
      [13, 12],
      [5, 12],
      [5, 9],
    ],
    ground: [
      [1, 1, 9, 5, "#"],
      [7, 7, 4, 4, "#"],
      [15, 7, 4, 9, "#"],
      [20, 12, 5, 5, "g"],
      [2, 13, 7, 4, "g"],
      [21, 2, 4, 2, "#"],
    ],
    training: [15, 5],
    cache: [6, 15],
    anchors: { rival_3: [12, 10] },
    clue: "The old lava tongue splits the trail. The western slope leads to Cinderfall.",
  },
  "13": {
    road: [
      [13, 14],
      [7, 14],
      [7, 8],
      [12, 8],
      [12, 4],
      [20, 4],
    ],
    ground: [
      [1, 1, 5, 16, "#"],
      [8, 1, 3, 6, "#"],
      [13, 7, 8, 4, "#"],
      [18, 2, 6, 2, "g"],
      [16, 12, 7, 4, "g"],
      [22, 7, 3, 5, "#"],
    ],
    training: [10, 8],
    cache: [20, 14],
    clue: "A cut in the lava shelf leads into Ember Mine. The mine crews use the switchback.",
  },
  "14": {
    road: [
      [21, 9],
      [21, 4],
      [14, 4],
      [14, 13],
      [5, 13],
      [5, 9],
    ],
    ground: [
      [1, 1, 10, 6, "#"],
      [7, 8, 5, 4, "#"],
      [17, 7, 3, 8, "#"],
      [15, 15, 6, 2, "#"],
      [21, 12, 4, 4, "g"],
      [4, 14, 6, 3, "g"],
    ],
    training: [18, 5],
    cache: [23, 13],
    anchors: { evolution_supply_5: [7, 15] },
    clue: "Cairns mark the ridge between Cinderfall and Rimepeak. Follow the switchback west.",
  },
  "15": {
    road: [
      [13, 14],
      [17, 14],
      [17, 10],
      [9, 10],
      [9, 4],
      [5, 4],
    ],
    ground: [
      [1, 6, 7, 11, "#"],
      [12, 3, 6, 6, "~"],
      [19, 2, 6, 7, "#"],
      [19, 11, 5, 5, "g"],
      [8, 2, 4, 2, "g"],
      [10, 13, 3, 3, "f"],
    ],
    training: [16, 11],
    cache: [21, 13],
    clue: "Skirt the frozen tarn and head northwest. Frostvault shelters herbs from the mountain wind.",
  },
  "16": {
    road: [
      [13, 13],
      [7, 13],
      [7, 6],
      [17, 6],
      [17, 3],
      [13, 3],
    ],
    ground: [
      [1, 2, 4, 15, "#"],
      [10, 8, 8, 3, "f"],
      [20, 1, 5, 7, "#"],
      [19, 11, 5, 5, "g"],
      [7, 2, 4, 3, "g"],
      [10, 15, 4, 2, "f"],
    ],
    training: [8, 11],
    cache: [21, 13],
    anchors: { evolution_supply_10: [8, 3] },
    clue: "The flowers grow around the stones with bells carved into them. Follow those stones north to Bellweather.",
  },
  "17": {
    road: [
      [5, 9],
      [5, 4],
      [13, 4],
      [13, 12],
      [21, 12],
    ],
    ground: [
      [2, 12, 8, 5, "f"],
      [7, 6, 3, 4, "#"],
      [16, 3, 6, 3, "w"],
      [20, 14, 5, 3, "#"],
      [15, 7, 5, 3, "g"],
      [4, 13, 4, 3, "g"],
    ],
    training: [12, 8],
    cache: [6, 14],
    clue: "At the empty belfry, turn down to the pilgrim court. Echo Bell Tower is at the far end.",
  },
  "18": {
    road: [
      [21, 9],
      [21, 5],
      [12, 5],
      [12, 12],
      [5, 12],
      [5, 9],
    ],
    ground: [
      [2, 2, 7, 5, "g"],
      [14, 8, 4, 6, "~"],
      [18, 10, 5, 3, "f"],
      [3, 14, 7, 3, "g"],
      [21, 14, 4, 3, "#"],
      [11, 7, 1, 3, "f"],
    ],
    training: [18, 6],
    cache: [6, 15],
    anchors: { rival_4: [13, 7], evolution_supply_8: [5, 5] },
    clue: "Follow the reflecting pools west. Aster’s observatory rises on the other side of town.",
  },
  "19": {
    road: [
      [20, 9],
      [20, 13],
      [13, 13],
      [13, 7],
      [5, 7],
      [5, 4],
    ],
    ground: [
      [1, 8, 8, 9, "#"],
      [11, 3, 7, 2, "w"],
      [17, 4, 8, 3, "#"],
      [16, 14, 6, 3, "g"],
      [7, 2, 4, 3, "g"],
      [15, 8, 3, 3, "f"],
    ],
    training: [15, 12],
    cache: [19, 15],
    clue: "The road climbs past two retaining walls. The observatory staff entrance is on the upper terrace.",
  },
  "20": {
    road: [
      [13, 13],
      [19, 13],
      [19, 8],
      [8, 8],
      [8, 4],
      [13, 4],
    ],
    ground: [
      [1, 1, 5, 16, "#"],
      [10, 10, 6, 6, "#"],
      [21, 2, 4, 8, "#"],
      [20, 13, 5, 4, "g"],
      [15, 2, 4, 3, "g"],
      [7, 11, 3, 4, "f"],
    ],
    training: [17, 8],
    cache: [22, 15],
    anchors: { evolution_supply_11: [16, 3] },
    clue: "Follow the ledge north to Crown Summit. The League is in town, but the gate at Victory Ascent opens first.",
  },
  "21": {
    road: [
      [13, 13],
      [7, 13],
      [7, 8],
      [17, 8],
      [17, 4],
      [13, 4],
    ],
    ground: [
      [1, 1, 4, 16, "#"],
      [9, 9, 5, 7, "#"],
      [19, 1, 6, 5, "#"],
      [7, 2, 4, 4, "g"],
      [19, 11, 5, 4, "g"],
      [21, 7, 3, 3, "f"],
    ],
    training: [8, 10],
    cache: [9, 4],
    anchors: { legendary_151: [22, 8] },
    clue: "The north trail rejoins Bramble. Dewdrop’s oldest grove lies east of the trail, past the flowers.",
  },
  "22": {
    road: [
      [13, 13],
      [9, 13],
      [9, 6],
      [17, 6],
      [17, 3],
      [13, 3],
    ],
    ground: [
      [1, 1, 24, 16, "~"],
      [2, 3, 6, 4, ","],
      [2, 4, 5, 3, "g"],
      [12, 8, 6, 8, ","],
      [15, 9, 3, 3, "g"],
      [20, 3, 5, 4, ","],
      [22, 4, 3, 2, "f"],
    ],
    training: [13, 10],
    cache: [5, 5],
    anchors: { legendary_243: [22, 4] },
    clue: "The planks lead to the landing. Surf north across the channel to Reedhaven or explore the islands by the beacon.",
  },
  "23": {
    road: [
      [13, 13],
      [19, 13],
      [19, 5],
      [13, 5],
    ],
    ground: [
      [8, 3, 7, 9, "#"],
      [9, 4, 5, 7, ","],
      [3, 10, 4, 6, "g"],
      [16, 9, 2, 4, "g"],
      [21, 1, 4, 9, "#"],
      [2, 1, 5, 6, "#"],
    ],
    training: [18, 8],
    cache: [6, 13],
    anchors: {
      pickup_fossil: [11, 6],
      quest_fossil: [8, 13],
      legendary_244: [11, 9],
    },
    clue: "The old quarry road climbs to Cinderfall. Take the southwest ramp down to the fossil beds.",
  },
  "24": {
    road: [
      [13, 14],
      [18, 14],
      [18, 10],
      [8, 10],
      [8, 5],
      [13, 5],
    ],
    ground: [
      [1, 1, 24, 16, "~"],
      [3, 12, 7, 5, ","],
      [4, 13, 4, 3, "g"],
      [17, 2, 7, 5, ","],
      [19, 3, 4, 3, "g"],
      [13, 9, 4, 5, ","],
      [13, 11, 3, 2, "f"],
    ],
    training: [15, 11],
    cache: [20, 4],
    anchors: { legendary_245: [6, 14] },
    clue: "The outer boardwalk turns north to Bellweather. The inner pool holds a beacon shrine.",
  },
  "25": {
    road: [
      [13, 4],
      [19, 4],
      [19, 9],
      [11, 9],
      [11, 14],
      [6, 14],
    ],
    ground: [
      [1, 1, 7, 7, "#"],
      [8, 2, 9, 4, "g"],
      [20, 2, 5, 5, "g"],
      [14, 11, 10, 5, "g"],
      [3, 10, 5, 2, "f"],
      [1, 12, 3, 5, "#"],
    ],
    training: [17, 8],
    cache: [21, 13],
    clue: "Begin your survey in the meadows. The seedlings, pool dwellers and fire families have separate habitats inside the sanctuary.",
  },
};

function routeLayout(world: Region, map: WorldMap, spec: RoutePlan) {
  if (map.id !== "route01" && map.id !== "route02") {
    const { point, patch, anchors } = resizeLayout(map, 26, 18);
    spec = {
      ...spec,
      road: spec.road.map(point),
      training: point(spec.training),
      cache: point(spec.cache),
      ground: spec.ground.map(patch),
      anchors: anchors(spec.anchors ?? {}),
    };
  }
  const plan = floorPlan(map, ",");
  spec.ground.forEach(plan.patch);
  const [arrival, onward] = map.exits;
  const end = spec.road[spec.road.length - 1];
  const path: Point[] = [
    [arrival.x, arrival.y],
    roadApproach(map, arrival),
    ...spec.road,
  ];
  if (onward.direction)
    path.push(roadApproach(map, onward), [onward.x, onward.y]);
  else relocateExit(world, map, onward, end);
  plan.trail(path, 1);

  // Short side trails lead to pockets without replacing the encounter grass.
  // Water routes preserve the islands and supply dry bridges to their trainers.
  if (map.id === "route22") {
    plan.trail([
      [9, 5],
      [7, 5],
    ]);
    plan.trail([
      [9, 10],
      [13, 10],
    ]);
    plan.trail([
      [17, 5],
      [20, 5],
    ]);
  }
  if (map.id === "route23")
    plan.trail([
      [13, 13],
      [11, 13],
      [11, 10],
    ]);
  if (map.id === "route24") {
    plan.trail([
      [8, 10],
      [8, 13],
    ]);
    plan.trail([
      [13, 5],
      [18, 5],
    ]);
  }

  // The crossing has a surveyed launch point at each end, with an open
  // stretch of water between the two plank landings.
  if (map.id === "route22")
    plan.patch([1, Math.floor(map.height / 2), map.width - 2, 2, "~"]);

  const middle = spec.road[Math.floor(spec.road.length / 2)];
  map.objects.push({
    id: `sign_${map.id}`,
    name: "Trail marker",
    kind: "sign",
    dialogue: spec.clue,
    x: middle[0],
    y: middle[1],
  });
  placeObjects(
    map,
    plan,
    {
      [`trainer_${map.id}`]: spec.training,
      [`item_${map.id}`]: spec.cache,
      [`sign_${map.id}`]: middle,
      [`${map.id}_optional_0`]: [spec.training[0] + 2, spec.training[1] + 2],
      [`${map.id}_optional_1`]: [spec.cache[0] - 2, spec.cache[1] - 2],
      ...spec.anchors,
    },
    spec.cache,
  );
  finish(map, plan);
}

interface DungeonPlan {
  rooms: [string, string, string];
  terrain: [Patch[], Patch[], Patch[]];
  path: [Point[], Point[], Point[]];
  clue: string;
  anchors?: [
    Record<string, Point>,
    Record<string, Point>,
    Record<string, Point>,
  ];
}

const dungeons: Record<string, DungeonPlan> = {
  lantern: {
    rooms: ["Leaf trail", "Fallen grove", "Survey camp"],
    terrain: [
      [
        [1, 1, 5, 13, "#"],
        [12, 6, 5, 9, "#"],
        [8, 6, 3, 4, "f"],
        [13, 1, 6, 3, "#"],
      ],
      [
        [1, 5, 14, 3, "#"],
        [13, 11, 6, 4, "#"],
        [1, 10, 4, 5, "#"],
        [10, 1, 3, 4, "f"],
      ],
      [
        [1, 1, 5, 9, "#"],
        [14, 1, 5, 7, "#"],
        [4, 11, 11, 2, "#"],
        [7, 3, 6, 3, "f"],
      ],
    ],
    path: [
      [
        [8, 12],
        [8, 6],
        [12, 6],
        [12, 3],
      ],
      [
        [16, 12],
        [16, 9],
        [7, 9],
        [7, 3],
      ],
      [
        [8, 12],
        [8, 7],
        [11, 7],
        [11, 5],
      ],
    ],
    clue: "Look for the leaf marker among the flowers. The surveyor’s rope is deeper in the wood.",
  },
  undertow: {
    rooms: ["High-water shelf", "Sluice tunnels", "Lighthouse intake"],
    terrain: [
      [
        [1, 5, 18, 4, "~"],
        [12, 8, 6, 5, "~"],
        [3, 3, 3, 4, "#"],
        [1, 11, 4, 4, "#"],
      ],
      [
        [6, 1, 3, 14, "~"],
        [11, 1, 3, 14, "~"],
        [15, 1, 4, 3, "#"],
        [2, 11, 3, 4, "#"],
      ],
      [
        [1, 1, 18, 5, "~"],
        [1, 6, 5, 6, "~"],
        [14, 6, 5, 7, "~"],
        [8, 4, 4, 4, "="],
      ],
    ],
    path: [
      [
        [8, 13],
        [8, 4],
        [15, 4],
        [15, 2],
      ],
      [
        [16, 12],
        [16, 10],
        [10, 10],
        [10, 5],
        [4, 5],
        [4, 3],
      ],
      [
        [10, 13],
        [10, 8],
        [8, 8],
        [8, 5],
      ],
    ],
    clue: "Start at the upper valve on the dry ledge. Its relief pipe drains the lower sluice.",
    anchors: [
      { undertow_step1: [12, 4] },
      {},
      { legendary_249: [10, 4], evolution_supply_7: [5, 13] },
    ],
  },
  copperworks: {
    rooms: ["Switchboard", "Relay hall", "Power intake"],
    terrain: [
      [
        [2, 3, 5, 3, "C"],
        [12, 3, 6, 3, "C"],
        [3, 9, 4, 3, "C"],
        [14, 9, 4, 3, "C"],
      ],
      [
        [2, 2, 3, 10, "C"],
        [8, 5, 4, 10, "C"],
        [15, 1, 3, 12, "C"],
      ],
      [
        [4, 2, 12, 2, "C"],
        [4, 5, 3, 6, "C"],
        [13, 5, 3, 6, "C"],
        [8, 11, 4, 1, "C"],
      ],
    ],
    path: [
      [
        [9, 13],
        [9, 8],
        [12, 8],
        [12, 2],
      ],
      [
        [13, 13],
        [13, 4],
        [6, 4],
        [6, 2],
      ],
      [
        [11, 13],
        [11, 6],
        [9, 6],
        [9, 4],
      ],
    ],
    clue: "The intake stays live until the cut-off is thrown. Find it beside the north switchboard before entering the relay hall.",
    anchors: [
      { copperworks_step1: [8, 4] },
      { pickup_part_c: [4, 13] },
      { legendary_145: [16, 12] },
    ],
  },
  hourglass: {
    rooms: ["Sun court", "Moon gallery", "Lens vault"],
    terrain: [
      [
        [4, 4, 3, 3, "#"],
        [12, 4, 3, 3, "#"],
        [4, 9, 3, 3, "#"],
        [12, 9, 3, 3, "#"],
      ],
      [
        [1, 4, 14, 2, "#"],
        [5, 9, 14, 2, "#"],
        [7, 6, 6, 3, "#"],
      ],
      [
        [1, 1, 6, 6, "#"],
        [13, 1, 6, 6, "#"],
        [2, 10, 5, 3, "#"],
        [13, 10, 5, 3, "#"],
        [8, 5, 4, 3, "f"],
      ],
    ],
    path: [
      [
        [9, 13],
        [9, 8],
        [15, 8],
        [15, 3],
      ],
      [
        [16, 13],
        [16, 11],
        [3, 11],
        [3, 7],
        [16, 7],
        [16, 3],
        [9, 3],
      ],
      [
        [10, 13],
        [10, 6],
        [8, 6],
        [8, 4],
      ],
    ],
    clue: "Face the first stone into sunrise. The moon stone below turns toward sunset.",
    anchors: [{ hourglass_step1: [8, 7] }, {}, { evolution_supply_4: [5, 8] }],
  },
  bamboo: {
    rooms: ["Collapsed walk", "Bridgehouse", "Ranger island"],
    terrain: [
      [
        [1, 5, 18, 6, "~"],
        [13, 1, 6, 4, "#"],
        [1, 12, 3, 3, "#"],
        [4, 10, 4, 2, ","],
      ],
      [
        [1, 1, 7, 12, "~"],
        [11, 5, 8, 10, "~"],
        [14, 1, 5, 4, "#"],
        [8, 8, 3, 4, "="],
      ],
      [
        [1, 1, 18, 14, "~"],
        [5, 3, 10, 10, ","],
        [7, 5, 5, 4, "f"],
        [12, 4, 3, 4, "#"],
      ],
    ],
    path: [
      [
        [11, 13],
        [11, 9],
        [6, 9],
        [6, 4],
        [12, 4],
      ],
      [
        [8, 13],
        [8, 8],
        [10, 8],
        [10, 5],
        [15, 5],
        [15, 3],
      ],
      [
        [10, 13],
        [10, 7],
        [7, 7],
        [7, 4],
      ],
    ],
    clue: "Release the latch by the old boardwalk. The winch in the bridgehouse controls the ranger island crossing.",
    anchors: [{ bamboo_step1: [8, 9] }, {}, { quest_bamboo_friend: [13, 10] }],
  },
  ember: {
    rooms: ["Timber adit", "Ore switchback", "Transport depot"],
    terrain: [
      [
        [1, 1, 7, 5, "#"],
        [11, 2, 8, 8, "#"],
        [1, 11, 5, 4, "#"],
        [8, 9, 5, 2, "T"],
      ],
      [
        [1, 5, 12, 3, "#"],
        [7, 10, 12, 3, "#"],
        [2, 1, 4, 3, "#"],
        [14, 1, 5, 4, "#"],
      ],
      [
        [2, 3, 5, 4, "C"],
        [13, 3, 5, 4, "C"],
        [2, 9, 5, 3, "C"],
        [13, 9, 5, 3, "#"],
      ],
    ],
    path: [
      [
        [12, 13],
        [7, 13],
        [7, 7],
        [9, 7],
        [9, 3],
      ],
      [
        [5, 13],
        [5, 9],
        [15, 9],
        [15, 6],
        [10, 6],
        [10, 3],
      ],
      [
        [10, 13],
        [10, 9],
        [8, 9],
        [8, 5],
      ],
    ],
    clue: "Brace the adit before opening the ore chute. The shipment records are past the switchback.",
    anchors: [
      { ember_step1: [8, 8] },
      { pickup_mine_ore: [16, 8] },
      { evolution_supply_6: [6, 13], legendary_146: [12, 4] },
    ],
  },
  frostvault: {
    rooms: ["Brazier ledge", "Frozen cistern", "Pass gate"],
    terrain: [
      [
        [1, 1, 5, 10, "#"],
        [13, 2, 6, 8, "#"],
        [10, 11, 9, 4, "~"],
        [7, 3, 4, 4, "f"],
      ],
      [
        [4, 4, 12, 8, "~"],
        [1, 6, 3, 3, "#"],
        [16, 7, 3, 2, "#"],
        [1, 1, 6, 3, "#"],
        [1, 4, 3, 2, "#"],
      ],
      [
        [1, 4, 6, 5, "#"],
        [13, 3, 6, 8, "#"],
        [6, 6, 8, 3, "~"],
        [8, 1, 4, 3, "f"],
      ],
    ],
    path: [
      [
        [8, 13],
        [8, 9],
        [11, 9],
        [11, 5],
        [9, 5],
        [9, 2],
      ],
      [
        [8, 13],
        [8, 10],
        [12, 10],
        [12, 7],
        [8, 7],
        [8, 3],
      ],
      [
        [10, 13],
        [10, 8],
        [10, 4],
        [10, 2],
      ],
    ],
    clue: "Light the brazier on the ledge. The cistern valve will turn once the pipes are warm.",
    anchors: [
      { frostvault_step1: [8, 5] },
      { pickup_snow_herb: [17, 5] },
      { legendary_144: [11, 3] },
    ],
  },
  echo: {
    rooms: ["Low belfry", "Resonance gallery", "Memory chamber"],
    terrain: [
      [
        [4, 2, 3, 9, "#"],
        [13, 2, 3, 9, "#"],
        [8, 3, 4, 1, "C"],
        [2, 10, 2, 3, "P"],
      ],
      [
        [2, 2, 5, 4, "#"],
        [7, 6, 6, 4, "#"],
        [13, 10, 5, 4, "#"],
        [4, 11, 2, 3, "C"],
      ],
      [
        [1, 1, 6, 6, "#"],
        [13, 1, 6, 6, "#"],
        [3, 9, 3, 3, "C"],
        [14, 9, 3, 3, "C"],
      ],
    ],
    path: [
      [
        [10, 13],
        [10, 8],
        [8, 8],
        [8, 5],
      ],
      [
        [8, 13],
        [8, 11],
        [15, 11],
        [15, 5],
        [11, 5],
        [11, 3],
      ],
      [
        [10, 13],
        [10, 8],
        [11, 8],
        [11, 4],
      ],
    ],
    clue: "The deep note wakes the higher bell. Ring the low bell here before climbing to the gallery.",
    anchors: [
      { echo_step1: [9, 7] },
      {},
      { quest_echoes: [6, 8], legendary_250: [11, 3] },
    ],
  },
  meridian: {
    rooms: ["Records desk", "Security wing", "Control room"],
    terrain: [
      [
        [2, 3, 6, 2, "B"],
        [12, 3, 6, 2, "B"],
        [2, 9, 6, 1, "C"],
        [12, 9, 6, 1, "C"],
      ],
      [
        [4, 4, 12, 1, "#"],
        [4, 5, 1, 7, "#"],
        [15, 5, 1, 7, "#"],
        [7, 8, 6, 2, "C"],
      ],
      [
        [2, 2, 5, 3, "C"],
        [13, 2, 5, 3, "C"],
        [4, 7, 2, 5, "#"],
        [14, 7, 2, 5, "#"],
      ],
    ],
    path: [
      [
        [10, 13],
        [10, 7],
        [14, 7],
        [14, 2],
      ],
      [
        [10, 13],
        [10, 11],
        [17, 11],
        [17, 3],
        [11, 3],
        [11, 6],
      ],
      [
        [10, 13],
        [10, 8],
        [11, 8],
        [11, 5],
      ],
    ],
    clue: "The staff records contain a spare keycard. Find it before approaching the security wing.",
    anchors: [
      { meridian_step1: [6, 6] },
      {},
      { evolution_supply_9: [3, 6], legendary_150: [17, 6] },
    ],
  },
  starfall: {
    rooms: ["North telescope", "Star chart gallery", "Celestial Engine"],
    terrain: [
      [
        [2, 2, 6, 5, "#"],
        [12, 2, 6, 5, "#"],
        [4, 10, 4, 2, "C"],
        [12, 10, 4, 2, "C"],
      ],
      [
        [2, 2, 4, 7, "#"],
        [14, 7, 4, 7, "#"],
        [7, 6, 6, 4, "f"],
        [9, 2, 2, 2, "C"],
      ],
      [
        [2, 3, 5, 7, "#"],
        [13, 3, 5, 7, "#"],
        [7, 2, 6, 1, "C"],
        [3, 11, 4, 2, "C"],
        [13, 11, 4, 2, "C"],
      ],
    ],
    path: [
      [
        [10, 13],
        [10, 8],
        [10, 3],
        [16, 3],
      ],
      [
        [10, 13],
        [10, 10],
        [7, 10],
        [7, 5],
        [14, 5],
        [14, 3],
      ],
      [
        [10, 13],
        [10, 5],
        [10, 3],
      ],
    ],
    clue: "Use the northern telescope to fix the first star. Then match its pair in the star chart gallery.",
    anchors: [
      { starfall_step1: [10, 3] },
      {},
      { starfall_objective: [9, 8], celestial_engine: [10, 4] },
    ],
  },
  victory: {
    rooms: ["Scree ledge", "Switchback bridge", "Summit gate"],
    terrain: [
      [
        [1, 1, 5, 10, "#"],
        [11, 6, 8, 9, "#"],
        [8, 3, 4, 3, "#"],
        [2, 12, 3, 2, "#"],
      ],
      [
        [1, 5, 13, 3, "#"],
        [6, 10, 13, 3, "#"],
        [1, 1, 6, 3, "#"],
        [16, 2, 3, 4, "#"],
      ],
      [
        [1, 1, 7, 13, "#"],
        [12, 1, 7, 13, "#"],
        [8, 5, 4, 2, "f"],
      ],
    ],
    path: [
      [
        [7, 13],
        [7, 8],
        [10, 8],
        [10, 6],
        [14, 6],
        [14, 3],
      ],
      [
        [4, 13],
        [4, 9],
        [15, 9],
        [15, 4],
        [9, 4],
        [9, 2],
      ],
      [
        [10, 13],
        [10, 8],
        [10, 4],
        [10, 2],
      ],
    ],
    clue: "Clear the scree by the cairn. The next ledge has the crank for the climbing bridge.",
  },
  aurora: {
    rooms: ["Research glade", "Beacon terraces", "Time grove"],
    terrain: [
      [
        [1, 1, 4, 14, "#"],
        [14, 3, 5, 9, "#"],
        [8, 5, 4, 6, "f"],
        [5, 2, 4, 3, "g"],
        [14, 12, 5, 3, "g"],
      ],
      [
        [1, 4, 7, 4, "~"],
        [12, 8, 7, 4, "~"],
        [15, 1, 4, 4, "#"],
        [4, 10, 4, 3, "g"],
        [14, 4, 4, 3, "g"],
      ],
      [
        [1, 1, 5, 13, "#"],
        [14, 1, 5, 13, "#"],
        [6, 3, 8, 9, "f"],
        [8, 4, 4, 3, "~"],
        [11, 7, 3, 6, "g"],
      ],
    ],
    path: [
      [
        [9, 13],
        [9, 9],
        [7, 9],
        [7, 5],
        [11, 5],
        [11, 2],
      ],
      [
        [9, 13],
        [9, 10],
        [10, 10],
        [10, 6],
        [13, 6],
        [13, 3],
      ],
      [
        [10, 13],
        [10, 9],
        [7, 9],
        [7, 5],
        [8, 5],
      ],
    ],
    clue: "Read the research inscription beside the flowers. It shows where to set the restored beacon.",
    anchors: [
      { aurora_step1: [9, 6] },
      {},
      { quest_atlas: [13, 9], legendary_251: [12, 5] },
    ],
  },
};

function dungeonLayout(world: Region, id: string, spec: DungeonPlan) {
  const outdoor = ["lantern", "bamboo", "aurora"].includes(id);
  for (let i = 0; i < 3; i++) {
    const map = world[`${id}_${i + 1}`];
    const room = map.name.split(" · ")[0];
    map.name = `${room} · ${spec.rooms[i]}`;
    const plan = floorPlan(map, outdoor ? "," : ".");
    spec.terrain[i].forEach(plan.patch);
    const path = spec.path[i];
    const arrival: Point = [path[0][0], 14];
    const onward = path[path.length - 1];
    // Room 3 has the objective at the head of the hall and a separate exit
    // at the foot, so a newly opened shortcut never requires backtracking.
    const shortcut: Point = i === 0 ? [16, 13] : [15, 13];
    const ingress = map.exits.find((e) =>
      i === 0 ? !e.to.startsWith(`${id}_`) : e.to === `${id}_${i}`,
    )!;
    const stairs = map.exits.find((e) => e.to === `${id}_${i + 2}`);
    const returnStairs =
      i === 0 || i === 2
        ? map.exits.find((e) => e.to === `${id}_${i === 0 ? 3 : 1}`)!
        : undefined;
    relocateExit(world, map, ingress, arrival);
    if (stairs) relocateExit(world, map, stairs, onward);
    if (returnStairs) {
      relocateExit(world, map, returnStairs, shortcut);
      returnStairs.lockedDialogue =
        "Finish the objective in the inner chamber to open this shortcut.";
    }
    plan.trail([arrival, ...path], 1);
    if (returnStairs) plan.trail([[path[0][0], 13], shortcut], 1);
    const middle = path[Math.floor(path.length / 2)];
    if (i === 0) {
      stairs!.requires = { flags: [`${id}_step1`] };
      stairs!.label = spec.rooms[1];
      stairs!.lockedDialogue = spec.clue;
      map.objects.push({
        id: `${id}_trail_clue`,
        name: "Trail notes",
        kind: "sign",
        dialogue: spec.clue,
        x: arrival[0] - 2,
        y: 12,
      });
    }
    if (i === 1) {
      stairs!.label = spec.rooms[2];
      const mechanism = map.objects.find((o) => o.id === `${id}_mechanism`)!;
      stairs!.lockedDialogue = `The way to the ${spec.rooms[2].toLowerCase()} is closed. Check the ${mechanism.name}.`;
    }
    if (i === 2) {
      returnStairs!.label = `Shortcut to ${spec.rooms[0].toLowerCase()}`;
      returnStairs!.lockedDialogue =
        "Finish the objective in this chamber to open the return path.";
    }
    placeObjects(
      map,
      plan,
      {
        [`${id}_trail_clue`]: [arrival[0] - 2, 12],
        [`${id}_guardian_trainer`]: [path[0][0] + 3, 12],
        [`${id}_step1`]: middle,
        [`${id}_step2`]: middle,
        [`${id}_mechanism`]: [onward[0] + 2, onward[1] + 1],
        [`${id}_objective`]: onward,
        ...spec.anchors?.[i],
      },
      [onward[0] + 3, onward[1] + 2],
    );
    finish(map, plan);
  }
}

const gymTerrain: Patch[][] = [
  [
    [3, 3, 5, 5, "#"],
    [14, 3, 5, 5, "#"],
    [3, 11, 5, 3, "P"],
    [14, 11, 5, 3, "P"],
  ],
  [
    [1, 4, 7, 9, "~"],
    [14, 4, 7, 9, "~"],
    [3, 8, 6, 2, "="],
    [13, 8, 6, 2, "="],
  ],
  [
    [3, 3, 5, 2, "C"],
    [14, 3, 5, 2, "C"],
    [3, 8, 4, 2, "C"],
    [15, 8, 4, 2, "C"],
    [9, 13, 4, 1, "C"],
  ],
  [
    [3, 3, 6, 3, "#"],
    [13, 3, 6, 3, "#"],
    [5, 9, 4, 2, "#"],
    [12, 9, 4, 2, "#"],
  ],
  [
    [2, 4, 4, 9, "C"],
    [16, 4, 4, 9, "C"],
    [9, 7, 4, 4, "#"],
  ],
  [
    [2, 4, 8, 3, "~"],
    [12, 9, 8, 3, "~"],
    [5, 7, 3, 2, "="],
    [15, 7, 3, 2, "="],
  ],
  [
    [2, 3, 6, 3, "T"],
    [14, 3, 6, 3, "T"],
    [3, 11, 5, 2, "P"],
    [14, 11, 5, 2, "P"],
  ],
  [
    [4, 2, 3, 3, "S"],
    [15, 2, 3, 3, "S"],
    [4, 10, 3, 3, "S"],
    [15, 10, 3, 3, "S"],
    [9, 7, 4, 3, "C"],
  ],
];

function gymLayout(world: Region, map: WorldMap) {
  const n = Number(map.id.slice(3));
  const plan = floorPlan(map, ".");
  gymTerrain[n - 1].forEach(plan.patch);
  const [door] = map.exits;
  relocateExit(world, map, door, [11, map.height - 1]);
  placeObjects(
    map,
    plan,
    {
      [`leader_${n}`]: [11, 3],
      [`gym${n}_clue`]: [11, 14],
      [`gym${n}_puzzle1`]: n % 2 ? [16, 7] : [7, 9],
      [`gym${n}_puzzle2`]: n % 2 ? [6, 7] : [16, 7],
      [`gym${n}_puzzle3`]: [11, 11],
      [`gym${n}_puzzle4`]: [11, 5],
    },
    [11, 6],
  );
  finish(map, plan);
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
    if (map.kind === "route") routeLayout(world, map, routes[map.id.slice(5)]);
    if (map.kind === "gym") gymLayout(world, map);
    if (map.kind === "interior") {
      if (map.id.startsWith("league")) leagueLayout(world, map);
      else interiorLayout(world, map);
    }
  }
  for (const [id, spec] of Object.entries(dungeons))
    dungeonLayout(world, id, spec);
  for (const map of Object.values(world))
    if (map.kind === "route" || map.kind === "dungeon") aimTrainers(map);
}
