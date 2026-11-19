import type { Exit, WorldMap } from "./index";

import { dungeonPlans } from "./dungeon-plans";
import { layRouteSite } from "./route-sites";
import { expeditionFloor, expeditions, sidePassages } from "./expeditions";
import { gyms } from "./gyms";
import { routes, settlements, surveyTrail, type Point, type Town } from "./atlas";
import { townPlans } from "./town-plans";

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

function townLayout(world: Region, map: WorldMap) {
  const town = map.id as Town;
  const survey = townPlans[town];
  const portals = map.exits.filter(exit => !exit.direction);
  const destination = (mark: string) => portals.find(exit => {
    if (mark === "C") return exit.to.endsWith("_center");
    if (mark === "M") return exit.to.endsWith("_mart");
    if (mark === "H") return exit.to === "home" || exit.to.endsWith("_house");
    if (mark === "G") return exit.to === "league" || world[exit.to].kind === "gym";
    if (mark === "L") return exit.to === "lab";
    return world[exit.to].kind === "dungeon";
  });
  const plan = floorPlan(map, ",");
  survey.plan.forEach((row, y) => {
    plan.grid[y] = [...row].map((tile, x) => {
      if (!"CMHGLX".includes(tile)) return tile;
      const exit = destination(tile);
      if (!exit) throw new Error(`Missing ${tile} entrance in ${map.name}`);
      relocateExit(world, map, exit, [x, y]);
      return tile === "X" ? "." : "d";
    });
  });
  placeObjects(map, plan, survey.anchors, survey.anchors["sign_" + town]);
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
  const bankWidth = (i: number) => 4 + Math.round(1.5 + 1.5 * Math.sin(i / 8));
  // Lay down the whole shoal before drawing its banks. A later water ellipse
  // must not flood the dry ground already laid for an earlier stretch of coast.
  if (coast || marsh) trail.forEach((p, i) => oval(p, bankWidth(i) + 2, bankWidth(i) + 1, "~"));
  trail.forEach((p, i) => oval(p, bankWidth(i), bankWidth(i) - 1, ","));
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
  if (map.id === "route05") oval(at(0.28), 6, 3, "~");
  if (map.id === "route10") oval(at(0.25), 4, 7, "~");
  if (map.id === "route11") oval(at(0.87), 6, 3, "~");

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
  const site = layRouteSite(map.id.slice(5), grid, turnout);
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
    ...site,
    ["trainer_" + map.id]: beside(0.22, -2),
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
        exit.lockedDialogue = expeditions[id].returnHint;
      } else if (tile === ">") {
        exit.label = rooms[i + 1].name;
        exit.lockedDialogue = map.id === "meridian_2"
          ? "The director’s reader needs a signed diversion order. Check the carbon copies in night-shift records."
          : expeditions[id].clue[1];
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
  nursery: [
    [1, 1, 3, 1, "B"],
    [6, 2, 2, 1, "T"], [6, 4, 2, 1, "T"],
    [8, 2, 1, 1, "P"], [8, 4, 1, 1, "P"],
    [2, 5, 1, 1, "C"], [4, 5, 2, 3, "a"],
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
  servicePlans[map.id === "reedhaven_house" ? "nursery" : type].forEach(plan.patch);
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
  const pc = map.objects.find(o => o.kind === "pc");
  if (pc) anchors[pc.id] = [9, 2];
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
    if (map.kind === "town") townLayout(world, map);
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
