import { fieldArena } from "./field-arena";
import { paintFieldObject, paintExpeditionFloor, paintReturn, expeditionActivity } from "./expedition-art";
import { paintGymTile, paintGymFixtures, paintGymActivity } from "./gym-art";
import { trailPalette } from "../world/atlas";
import { trailLandmark } from "./trail-landmarks";
import { WORLD, isWildEncounter, type Exit, type WorldMap, type WorldObject } from "../world";
import type { Engine } from "../engine";
import { interactionTarget, objectVisible } from "./actors";
import { barrierTarget, barrierTiles, connectionOffset } from "./navigation";

export interface RendererVisualState {
  nest?: { species: number }[];
  npcs?: Record<
    string,
    {
      x: number;
      y: number;
      facing?: string;
      moving?: boolean;
      notice?: boolean;
    }
  >;
  hideHud?: boolean;
  confirmLabel?: string;
  canFish?: boolean;
  exitOpen?: (exit: Exit) => boolean;
}

type Palette = {
  grass: string;
  shade: string;
  path: string;
  ink: string;
  roof: string;
  wall: string;
  water: string;
};
const PALETTES: Record<string, Palette> = {
  meadow: {
    grass: "#a9cf86",
    shade: "#6e9b60",
    path: "#e2d6a9",
    ink: "#315d4c",
    roof: "#568daa",
    wall: "#f0d9ae",
    water: "#578fb9",
  },
  orchard: {
    grass: "#aec981",
    shade: "#779457",
    path: "#e2cd98",
    ink: "#426a48",
    roof: "#c97c63",
    wall: "#f0d9ae",
    water: "#548db0",
  },
  autumn: {
    grass: "#c5bf78",
    shade: "#ad814f",
    path: "#e6cb95",
    ink: "#6d6044",
    roof: "#976b64",
    wall: "#ead1a2",
    water: "#648ba7",
  },
  coast: {
    grass: "#a2c69b",
    shade: "#6a9c81",
    path: "#e7d7a6",
    ink: "#3e746e",
    roof: "#648eaf",
    wall: "#f1dfb4",
    water: "#568eb7",
  },
  industrial: {
    grass: "#aabf8e",
    shade: "#798c6d",
    path: "#d5cfac",
    ink: "#4e6b64",
    roof: "#879cad",
    wall: "#d2d4bc",
    water: "#6b9da8",
  },
  desert: {
    grass: "#dec083",
    shade: "#b59e64",
    path: "#ead89e",
    ink: "#877750",
    roof: "#ca8c68",
    wall: "#f1dda9",
    water: "#58a69b",
  },
  wetland: {
    grass: "#98b97d",
    shade: "#638564",
    path: "#c8bc8b",
    ink: "#396a56",
    roof: "#779d7a",
    wall: "#e4d1a4",
    water: "#568e92",
  },
  volcanic: {
    grass: "#a58b79",
    shade: "#8b786a",
    path: "#c5b18b",
    ink: "#62575d",
    roof: "#a75e58",
    wall: "#d7b79a",
    water: "#bc6c4c",
  },
  snow: {
    grass: "#dce7e5",
    shade: "#a5bbc5",
    path: "#c8d5d3",
    ink: "#57788c",
    roof: "#7195ae",
    wall: "#eee6d3",
    water: "#81b5cf",
  },
  mountain: {
    grass: "#b3bba2",
    shade: "#87937c",
    path: "#d0c5a5",
    ink: "#64726a",
    roof: "#819c91",
    wall: "#dfd3b6",
    water: "#749da5",
  },
  violet: {
    grass: "#b2c69a",
    shade: "#81946f",
    path: "#e0cead",
    ink: "#605a78",
    roof: "#9780ab",
    wall: "#e8d3b7",
    water: "#818caf",
  },
  night: {
    grass: "#8cb6a1",
    shade: "#628d82",
    path: "#c4c8a9",
    ink: "#3f6170",
    roof: "#718aab",
    wall: "#d7d3b5",
    water: "#4d779a",
  },
};
const GROVE_ART: Record<string, number> = {
  autumn: 8,
  wetland: 9,
  volcanic: 10,
  night: 11,
  violet: 11,
};
const WORLD_SCALE = 16;
const WIDTH = 320;
const HEIGHT = 240;
const BARREN = new Set([
  "desert",
  "snow",
  "volcanic",
  "mountain",
  "industrial",
]);
const ROOM_PALETTES: Record<string, [string, string, string]> = {
  home: ["#cfa97a", "#d9b484", "#8e654f"],
  lab: ["#c7d3bb", "#d9dfc6", "#5f8b79"],
  center: ["#e1cdc0", "#eddbcf", "#b86c6e"],
  mart: ["#c6d5da", "#d8e1e2", "#647dab"],
  league: ["#91a498", "#aebe9c", "#536f65"],
  league_petra: ["#a19a8e", "#b7ada0", "#696259"],
  league_nyx: ["#766d88", "#8e829d", "#4a405f"],
  league_gale: ["#97afbc", "#bdcad1", "#56748c"],
  league_mira: ["#8f90ac", "#acabc4", "#545170"],
  meadow: ["#bacb92", "#cbd6a9", "#587d54"],
  autumn: ["#bea881", "#d5bb93", "#8e6651"],
  coast: ["#91b3bb", "#a8c8cb", "#4c7b91"],
  industrial: ["#9daea5", "#b5c3b7", "#607e78"],
  desert: ["#c3a777", "#d6bd8d", "#93664c"],
  volcanic: ["#a48479", "#ba9b87", "#85574f"],
  snow: ["#a9c6d7", "#c3dbe5", "#6185aa"],
  violet: ["#afa1bc", "#c2b4cc", "#736080"],
  night: ["#8d9cbb", "#acb6cf", "#5f6591"],
  mountain: ["#9ba99c", "#b4bca6", "#60786a"],
};
const DUNGEON_STONE: Record<string, [string, string, string]> = {
  undertow: ["#6b8191", "#8eabb5", "#455f73"],
  hourglass: ["#a99069", "#ceb181", "#755f51"],
  ember: ["#7e6165", "#aa806e", "#554652"],
  frostvault: ["#839eb5", "#b4cfde", "#566c8b"],
  victory: ["#7e8684", "#a3aca1", "#525e64"],
};
const BUILDING_ACCENTS: Record<string, string> = {
  center: "#bb6e72",
  mart: "#658bac",
  gym: "#82688e",
};
const DIRECTION_ARROW = { east: "→", west: "←", north: "↑", south: "↓" };
const SWITCH_SYMBOLS: Record<string, string[]> = {
  autumn: ["00011", "00111", "01110", "11100", "10000"],
  coast: ["00100", "01110", "01110", "11111", "01110"],
  industrial: ["00110", "01100", "11111", "00110", "01100"],
  desert: ["11111", "01010", "00100", "01010", "11111"],
  wetland: ["01010", "11111", "01010", "11111", "01010"],
  volcanic: ["00100", "00110", "01111", "11011", "01110"],
  snow: ["10101", "01110", "11111", "01110", "10101"],
  violet: ["00100", "01110", "01110", "11111", "00100"],
  night: ["00100", "00100", "11111", "00100", "00100"],
  mountain: ["00100", "01110", "11011", "10001", "11111"],
};

function paintGlyph(
  c: CanvasRenderingContext2D,
  pattern: string[],
  x: number,
  y: number,
) {
  for (let row = 0; row < pattern.length; row++)
    for (let col = 0; col < pattern[row].length; col++)
      if (pattern[row][col] === "1") c.fillRect(x + col, y + row, 1, 1);
}

function buildingType(id: string) {
  if (id.endsWith("_center")) return "center";
  if (id.endsWith("_mart")) return "mart";
  if (id.startsWith("gym")) return "gym";
  if (id.endsWith("_house")) return "home";
  return id;
}

function noise(x: number, y: number) {
  return (Math.imul(x + 73, 374761393) ^ Math.imul(y + 127, 668265263)) >>> 0;
}

function rgb(hex: string) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/** Crisp cartridge graphics, original environment art, and continuous sub-tile movement. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  cameraX = 0;
  cameraY = 0;
  private engine?: Engine;
  private terrains = new Map<string, HTMLCanvasElement>();
  private currentMap?: WorldMap;
  private art = new Image();
  private sprites = new Map<string, HTMLCanvasElement>();
  private lastX = 0;
  private lastY = 0;
  private movingUntil = 0;
  private walkDistance = 0;
  private lastTime = 0;
  private grassTile = "";
  private rustles: { x: number; y: number; start: number }[] = [];
  private night = false;
  private enteredAt = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.art.onload = () => {
      this.terrains.clear();
    };
    this.art.src = new URL(
      "assets/astra-environments.png",
      document.baseURI,
    ).href;
  }
  setEngine(engine: Engine) {
    this.engine = engine;
    this.sprites.clear();
    this.terrains.clear();
  }
  setNight(night: boolean) {
    this.night = night;
  }
  private sprite(
    key: string,
    make: () => ImageData,
  ): HTMLCanvasElement | undefined {
    if (this.sprites.has(key)) return this.sprites.get(key);
    try {
      const data = make(),
        c = document.createElement("canvas");
      c.width = data.width;
      c.height = data.height;
      c.getContext("2d")!.putImageData(data, 0, 0);
      this.sprites.set(key, c);
      return c;
    } catch {
      return undefined;
    }
  }
  private foliage(
    c: CanvasRenderingContext2D,
    index: number,
    x: number,
    y: number,
    palette: string,
    p: Palette,
  ): boolean {
    if (!this.engine) return false;
    const image = this.sprite(`foliage:${index}:${palette}`, () => {
      const data = this.engine!.cell("johto", index);
      const colors = new Map([
        [181, rgb(p.grass)],
        [99, rgb(p.shade)],
        [41, rgb(p.ink)],
        [58, rgb(p.ink)],
      ]);
      for (let i = 0; i < data.data.length; i += 4) {
        const color = colors.get(data.data[i]);
        if (color) data.data.set(color, i);
      }
      return data;
    });
    if (!image) return false;
    c.drawImage(image, x, y);
    return true;
  }
  private atlas(
    c: CanvasRenderingContext2D,
    slot: number,
    x: number,
    y: number,
    size = 32,
  ) {
    if (!this.art.complete || !this.art.naturalWidth) return false;
    const width = this.art.naturalWidth / 4;
    const height = this.art.naturalHeight / 4;
    c.drawImage(
      this.art,
      (slot % 4) * width,
      Math.floor(slot / 4) * height,
      width,
      height,
      x,
      y,
      size,
      size,
    );
    return true;
  }
  private outdoor(m: WorldMap) {
    return (
      m.kind === "town" ||
      m.kind === "route" ||
      m.id.startsWith("lantern") ||
      m.id.startsWith("bamboo") ||
      m.id.startsWith("aurora")
    );
  }
  private ground(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    p: Palette,
    theme: string,
  ) {
    const n = noise(x, y);
    const px = x * 16,
      py = y * 16;
    c.fillStyle = p.grass;
    c.fillRect(px, py, 16, 16);
    c.fillStyle = p.shade + "70";
    const dx = px + 2 + ((n >>> 5) % 9);
    const dy = py + 3 + ((n >>> 12) % 8);
    if (theme === "snow" || theme === "desert") {
      c.fillRect(dx, dy, 3 + (n % 3), 1);
      c.fillStyle = "#fff7e599";
      c.fillRect(dx - 1, dy - 1, 4, 1);
      if (n % 3 === 0) c.fillRect(px + 3, py + 12, 3, 1);
    } else if (BARREN.has(theme)) {
      c.fillRect(dx, dy, 3, 2);
      c.fillRect(px + 2, py + 11, 2, 1);
      c.fillStyle = "#f5ddb580";
      c.fillRect(dx, dy - 1, 2, 1);
    } else {
      c.fillRect(dx, dy, 3, 1);
      c.fillRect(dx + 1, dy - 2, 1, 2);
      if (n % 3 === 0) {
        c.fillRect(px + 3, py + 12, 2, 1);
        c.fillRect(px + 4, py + 10, 1, 2);
      }
    }
  }
  private barrier(
    c: CanvasRenderingContext2D,
    m: WorldMap,
    x: number,
    y: number,
    p: Palette,
  ) {
    const px = x * 16,
      py = y * 16;
    if (!BARREN.has(m.palette) && this.foliage(c, 20, px, py, m.palette, p)) {
      if (m.palette === "orchard" && noise(x, y) % 3 !== 0) {
        c.fillStyle = "#c36c4e";
        c.fillRect(px + 5, py + 7, 2, 2);
        c.fillRect(px + 11, py + 9, 2, 2);
        c.fillStyle = "#e7b073";
        c.fillRect(px + 5, py + 7, 1, 1);
      }
      return;
    }
    this.ground(c, x, y, p, m.palette);
    this.rock(c, px, py, p, m.palette);
  }
  private ridge(c: CanvasRenderingContext2D, m: WorldMap, x: number, y: number, p: Palette) {
    const px = x * 16, py = y * 16;
    const joins = (dx: number, dy: number) => (m.tiles[y + dy]?.[x + dx] ?? "#") === "#";
    const sandy = m.palette === "desert", snowy = m.palette === "snow", lava = m.palette === "volcanic";
    const top = snowy ? "#dbe4da" : sandy ? "#ddc28e" : lava ? "#98776d" : "#99a394";
    const light = snowy ? "#f5f3de" : sandy ? "#efdaa2" : lava ? "#b5957e" : "#c1c6ac";
    const face = snowy ? "#91acbd" : sandy ? "#bb945e" : lava ? "#81615f" : "#7d8986";
    const shadow = snowy ? "#71899a" : sandy ? "#987a58" : lava ? "#634d52" : "#596d6b";
    c.fillStyle = top;
    c.fillRect(px, py, 16, 16);
    const seed = noise(x,y);
    // Broken strata run across neighboring cells. Grit, snowdrifts and hot
    // cracks distinguish the ridge tops even when their faces are out of view.
    for (let i = 0; i < 16; i++) {
      const u = px + i;
      const offset = Math.round(5*Math.sin(u/27) + 3*Math.cos(u/16) + u/11);
      const contour = ((offset - py) % 29 + 29) % 29;
      if (contour < 14 && Math.sin(u/17 + (py+contour)/23) > -0.18) {
        c.fillStyle = light;
        c.fillRect(u, py+contour, 1, 1);
        c.fillStyle = face;
        c.fillRect(u, py+contour+1, 1, sandy ? 1 : 2);
      }
    }
    if (seed % 4 < 2) {
      const u = px+2+seed%6, v = py+3+(seed >>> 5)%8;
      c.fillStyle = face;
      c.fillRect(u,v,3,1);
      if (!sandy) c.fillRect(u+2,v+1,4,1);
      c.fillStyle = light;
      c.fillRect(u+1,v-1,2,1);
    }
    if (!sandy && !snowy && seed % 11 === 0) {
      c.fillStyle = shadow;
      c.fillRect(px+3,py+4,4,1); c.fillRect(px+6,py+5,3,1); c.fillRect(px+8,py+6,1,3);
      if (lava) { c.fillStyle = "#d89163"; c.fillRect(px+6,py+6,2,1); }
    }
    if (!joins(0,-1)) {
      c.fillStyle = p.shade; c.fillRect(px,py,16,2);
      c.fillStyle = light; c.fillRect(px,py+2,16,2);
    }
    if (!joins(-1,0)) { c.fillStyle = light; c.fillRect(px,py,2,16); }
    if (!joins(1,0)) { c.fillStyle = face; c.fillRect(px+14,py,2,16); }
    if (!joins(0,1)) {
      c.fillStyle = light; c.fillRect(px,py+3,16,2);
      c.fillStyle = shadow; c.fillRect(px,py+6,16,10);
      c.fillStyle = face; c.fillRect(px,py+6,16,6);
      const split = noise(x,y)%8+2;
      c.fillStyle = shadow;
      c.fillRect(px+split,py+7,2,3); c.fillRect(px+split-1,py+10,2,3);
      c.fillStyle = light; c.fillRect(px+1,py+6,7,1);
    }
  }
  private room(m: WorldMap) {
    const type = buildingType(m.id);
    return (
      ROOM_PALETTES[type] ?? ROOM_PALETTES[m.palette] ?? ROOM_PALETTES.meadow
    );
  }
  private roomWall(
    c: CanvasRenderingContext2D,
    m: WorldMap,
    x: number,
    y: number,
  ) {
    const [wall, cap, border] = this.room(m);
    const px = x * 16,
      py = y * 16;
    const open = (dx: number, dy: number) => m.tiles[y + dy]?.[x + dx] !== "#";
    const face = open(0, 1);
    const left = Number(open(-1, 0));
    const right = Number(open(1, 0));
    c.fillStyle = border;
    c.fillRect(px, py, 16, 16);
    c.fillStyle = wall;
    c.fillRect(px + left, py, 16 - left - right, face ? 10 : 16);
    c.fillStyle = cap;
    if (open(0, -1)) c.fillRect(px + left, py, 16 - left - right, 2);
    if (face) {
      c.fillRect(px + left, py + 9, 16 - left - right, 1);
      c.fillStyle = "#21253346";
      c.fillRect(px, py + 15, 16, 1);
    } else {
      c.fillStyle = border + "48";
      c.fillRect(px + (y % 2 ? 2 : 10), py + 1, 1, 6);
      c.fillRect(px + (y % 2 ? 2 : 10), py + 7, 6, 1);
    }
  }
  private solidStone(
    c: CanvasRenderingContext2D,
    m: WorldMap,
    x: number,
    y: number,
    colors: [string, string, string],
  ) {
    const [, top, wall] = colors;
    const px = x * 16,
      py = y * 16;
    const edge = (dx: number, dy: number) => m.tiles[y + dy]?.[x + dx] !== "#";
    c.fillStyle = wall;
    c.fillRect(px, py, 16, 16);
    c.fillStyle = top;
    c.fillRect(
      px + Number(edge(-1, 0)),
      py + Number(edge(0, -1)),
      16 - Number(edge(-1, 0)) - Number(edge(1, 0)),
      edge(0, 1) ? 9 : 15,
    );
    c.fillStyle = "#161f3044";
    const seam = 4 + (noise(x, y) % 8);
    c.fillRect(px + seam, py + 3, 1, 4);
    c.fillRect(px + seam - 3, py + 7, 4, 1);
    if (edge(0, 1)) {
      c.fillRect(px, py + 15, 16, 1);
      c.fillStyle = top + "75";
      c.fillRect(px + 2, py + 10, 2, 4);
      c.fillRect(px + 11, py + 10, 2, 2);
    }
  }
  private arenaTile(
    c: CanvasRenderingContext2D,
    m: WorldMap,
    x: number,
    y: number,
    room: [string, string, string],
  ) {
    const px = x * 16;
    const py = y * 16;
    const tile = m.tiles[y][x];
    if (tile === "l") {
      c.fillStyle = room[0];
      c.fillRect(px, py, 16, 16);
      c.fillStyle = "#fff2bd45";
      c.fillRect(px + 1, py + 3, 14, 10);
      c.fillRect(px + 3, py + 1, 10, 14);
      c.fillStyle = room[2];
      c.fillRect(px + 4, py + 4, 8, 8);
      c.fillStyle = "#efc684";
      c.fillRect(px + 5, py + 5, 6, 6);
      c.fillStyle = "#ffefb3";
      c.fillRect(px + 7, py + 6, 2, 4);
      c.fillRect(px + 6, py + 7, 4, 2);
      return;
    }
    const champion = m.id === "league_mira";
    c.fillStyle = champion ? ((x + y) % 2 ? "#393653" : "#413958") : room[2];
    c.fillRect(px, py, 16, 16);
    const edge = (dx: number, dy: number) => {
      const neighbor = m.tiles[y + dy]?.[x + dx];
      return neighbor !== "a" && neighbor !== "h";
    };
    c.fillStyle = champion ? "#e7c083" : room[1];
    if (edge(0, -1)) c.fillRect(px, py + 1, 16, 2);
    if (edge(0, 1)) c.fillRect(px, py + 13, 16, 2);
    if (edge(-1, 0)) c.fillRect(px + 1, py, 2, 16);
    if (edge(1, 0)) c.fillRect(px + 13, py, 2, 16);
    if (tile === "h") {
      // Eight points mark the keepers around the illuminated beacon inlay.
      paintGlyph(
        c,
        [
          "0000001000000",
          "0000001000000",
          "0010001000100",
          "0001011101000",
          "0000111110000",
          "0001111111000",
          "1111111111111",
          "0001111111000",
          "0000111110000",
          "0001011101000",
          "0010001000100",
          "0000001000000",
          "0000001000000",
        ],
        px + 1,
        py + 1,
      );
      c.fillStyle = "#fff3b7";
      c.fillRect(px + 6, py + 6, 3, 3);
    } else if (champion && (x + y * 2) % 5 === 0) {
      c.fillStyle = "#8a7caa";
      c.fillRect(px + 7, py + 6, 1, 3);
      c.fillRect(px + 6, py + 7, 3, 1);
    }
  }
  private tile(
    c: CanvasRenderingContext2D,
    m: WorldMap,
    x: number,
    y: number,
    p: Palette,
  ) {
    const ch = m.tiles[y][x];
    const px = x * 16,
      py = y * 16;
    const out = this.outdoor(m);
    const dungeon = DUNGEON_STONE[m.id.split("_")[0]];
    const room = dungeon ?? this.room(m);
    if (ch === "a" || ch === "h" || ch === "l") {
      this.arenaTile(c, m, x, y, room);
      return;
    }
    if (ch === "#") {
      if (m.kind === "route" && BARREN.has(m.palette) &&
          [[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dy]) => m.tiles[y+dy]?.[x+dx] === "#"))
        this.ridge(c,m,x,y,p);
      else if (out) this.barrier(c, m, x, y, p);
      else if (dungeon) this.solidStone(c, m, x, y, dungeon);
      else this.roomWall(c, m, x, y);
      return;
    }
    if (ch === ":") {
      this.ground(c, x, y, p, m.palette);
      c.fillStyle = p.path + "90";
      c.fillRect(px, py, 16, 16);
      const grit = noise(x, y) % 8;
      c.fillStyle = p.shade;
      c.fillRect(px + grit + 1, py + 5, 2, 1);
      c.fillRect(px + 10, py + 10 + grit % 3, 1, 1);
      return;
    }
    if (ch === "t") {
      c.fillStyle = p.path;
      c.fillRect(px, py, 16, 16);
      const track = (dx: number, dy: number) => m.tiles[y + dy]?.[x + dx] === "t";
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || !track(dx, dy)) continue;
        if (dx && dy && (track(dx, 0) || track(0, dy))) continue;
        const ties = (distance: number, across: number) =>
          [px + 8 + dx * distance - dy * across, py + 8 + dy * distance + dx * across];
        for (let k = -4; k <= 4; k++) {
          c.fillStyle = "#9a795e";
          const [u, v] = ties(4, k);
          c.fillRect(u, v, 2, 2);
        }
        for (const side of [-3, 3]) for (let i = 0; i <= 8; i++) {
          const [u, v] = ties(i, side);
          c.fillStyle = "#61666a"; c.fillRect(u, v, 2, 2);
          c.fillStyle = "#a9ae9d"; c.fillRect(u, v, 1, 1);
        }
      }
      return;
    }
    if (ch === "o") {
      c.fillStyle = "#426d82";
      c.fillRect(px, py, 16, 16);
      c.fillStyle = "#63929e";
      const phase = noise(x, y) % 7;
      c.fillRect(px + phase, py + 6, 4, 1);
      c.fillRect(px + phase + 4, py + 5, 2, 1);
      return;
    }
    if (ch === "~") {
      c.fillStyle = p.water;
      c.fillRect(px, py, 16, 16);
      c.fillStyle = "#c2e1d29c";
      c.fillRect(px + ((y * 3) % 8), py + 4, 5, 1);
      c.fillRect(px + 8, py + 11, 4, 1);
      const n = (xx: number, yy: number) => !"o~".includes(m.tiles[yy]?.[xx] ?? "o");
      c.fillStyle = p.shade;
      if (n(x, y - 1)) c.fillRect(px, py, 16, 2);
      if (n(x, y + 1)) c.fillRect(px, py + 14, 16, 2);
      if (n(x - 1, y)) c.fillRect(px, py, 2, 16);
      if (n(x + 1, y)) c.fillRect(px + 14, py, 2, 16);
      return;
    }
    if (ch === "r") {
      // Joined roof tiles, outlined only at the building perimeter.
      const door = this.roofDoor(m, x, y);
      const accent = door ? BUILDING_ACCENTS[buildingType(door.to)] : undefined;
      const leftEdge = m.tiles[y][x - 1] !== "r";
      const rightEdge = m.tiles[y][x + 1] !== "r";
      c.fillStyle = accent || p.roof;
      c.fillRect(px, py, 16, 16);
      for (let sy = 2; sy < 16; sy += 5) {
        c.fillStyle = "#ffffff40";
        c.fillRect(px, py + sy, 16, 1);
        c.fillStyle = "#18343f68";
        const offset = sy % 2 ? 4 : 0;
        c.fillRect(px + offset + 1, py + sy + 1, 1, 4);
        c.fillRect(px + offset + 9, py + sy + 1, 1, 4);
      }
      c.fillStyle = p.ink;
      if (leftEdge) c.fillRect(px, py, 1, 16);
      if (rightEdge) c.fillRect(px + 15, py, 1, 16);
      if (m.tiles[y - 1]?.[x] !== "r") {
        c.fillStyle = p.ink;
        c.fillRect(px, py, 16, 2);
        c.fillStyle = "#e8ddad";
        c.fillRect(px, py + 2, 16, 1);
      }
      if (m.tiles[y + 1]?.[x] !== "r") {
        c.fillStyle = p.ink;
        c.fillRect(px, py + 14, 16, 2);
      }
      return;
    }
    if (ch === "w") {
      c.fillStyle = p.wall;
      c.fillRect(px, py, 16, 16);
      c.fillStyle = p.ink;
      c.fillRect(px, py + 14, 16, 2);
      c.fillStyle = "#b9a183";
      c.fillRect(px, py + 1, 16, 2);
      if (x % 2) {
        c.fillStyle = p.ink;
        c.fillRect(px + 3, py + 3, 10, 9);
        c.fillStyle = "#9bd0cf";
        c.fillRect(px + 4, py + 4, 8, 6);
        c.fillStyle = "#edf6cf";
        c.fillRect(px + 4, py + 4, 3, 3);
        c.fillStyle = p.wall;
        c.fillRect(px + 7, py + 4, 1, 7);
      }
      return;
    }
    if (ch === "d") {
      c.fillStyle = p.wall;
      c.fillRect(px, py, 16, 16);
      c.fillStyle = p.ink;
      c.fillRect(px + 2, py + 1, 12, 15);
      c.fillStyle = "#233d47";
      c.fillRect(px + 4, py + 3, 8, 11);
      c.fillStyle = "#d9bd83";
      c.fillRect(px, py + 14, 16, 2);
      return;
    }
    if (ch === "=") {
      c.fillStyle = "#a7815e";
      c.fillRect(px, py, 16, 16);
      for (let sy = 0; sy < 16; sy += 4) {
        c.fillStyle = (y + sy + x) % 3 ? "#c5a579" : "#bb996e";
        c.fillRect(px, py + sy, 16, 3);
        c.fillStyle = "#d7bb8a";
        c.fillRect(px + (x + sy) % 6, py + sy, 7, 1);
      }
      for (const [dx, edge] of [[-1, 0], [1, 14]]) {
        if (!"~o".includes(m.tiles[y]?.[x + dx] ?? ".")) continue;
        c.fillStyle = "#765d4b";
        c.fillRect(px + edge, py, 2, 16);
        if (y % 2 === 0) {
          c.fillStyle = "#5d5142"; c.fillRect(px + edge - 1, py + 1, 4, 6);
          c.fillStyle = "#ead1a0"; c.fillRect(px + edge - 1, py + 1, 4, 2);
        }
      }
      return;
    }
    if ("BCPTS".includes(ch)) {
      const type = buildingType(m.id);
      c.fillStyle = room[0];
      c.fillRect(px, py, 16, 16);
      if (ch === "B") {
        c.fillStyle = "#555a46";
        c.fillRect(px, py, 16, 16);
        c.fillStyle = type === "mart" ? "#beb58b" : "#b89868";
        c.fillRect(px + 1, py + 1, 14, 13);
        if (type === "mart") {
          c.fillStyle = "#506777";
          c.fillRect(px + 2, py + 3, 12, 5);
          c.fillRect(px + 2, py + 9, 12, 4);
          for (let col = 0; col < 3; col++) {
            const left = px + 2 + col * 4;
            c.fillStyle = "#dfa0a1";
            c.fillRect(left + 1, py + 3, 2, 1);
            c.fillRect(left, py + 4, 4, 2);
            c.fillStyle = "#eee4cc";
            c.fillRect(left + 1, py + 6, 2, 1);
            c.fillStyle = ["#9acaad", "#e4c67d", "#99b8d3"][(x + y + col) % 3];
            c.fillRect(left + 1, py + 9, 2, 3);
            c.fillStyle = "#e4ddd0";
            c.fillRect(left + 1, py + 8, 2, 1);
          }
        } else {
          for (let row = 0; row < 2; row++) {
            c.fillStyle = "#514e40";
            c.fillRect(px + 2, py + 2 + row * 7, 12, 5);
            for (let book = 0; book < 4; book++) {
              c.fillStyle = ["#9fae7a", "#648e91", "#be7b64", "#e0c294"][
                (book + row + x) % 4
              ];
              c.fillRect(px + 3 + book * 3, py + 2 + row * 7, 2, 5);
            }
          }
        }
      } else if (ch === "P") {
        c.fillStyle = "#825f4b";
        c.fillRect(px + 5, py + 10, 6, 5);
        c.fillStyle = "#c99969";
        c.fillRect(px + 4, py + 10, 8, 2);
        c.fillStyle = "#3f7756";
        c.fillRect(px + 3, py + 4, 10, 5);
        c.fillRect(px + 6, py + 1, 4, 10);
        c.fillStyle = "#87ac6b";
        c.fillRect(px + 4, py + 3, 4, 3);
        c.fillRect(px + 9, py + 6, 3, 2);
      } else if (ch === "T" && type === "center") {
        c.fillStyle = "#806361";
        c.fillRect(px, py + 4, 16, 10);
        c.fillStyle = "#b77b79";
        c.fillRect(px, py + 4, 16, 3);
        c.fillStyle = "#e5ac9b";
        c.fillRect(px + 1, py + 7, 14, 5);
        c.fillStyle = "#efd4b6";
        c.fillRect(px + 2, py + 7, 12, 1);
      } else if (ch === "S" && type === "center") {
        const monitor = m.tiles[y][x - 1] !== "S";
        c.fillStyle = "#635a63";
        c.fillRect(px, py + 3, 16, 12);
        c.fillStyle = "#dfb8ae";
        c.fillRect(px, py + 4, 16, 9);
        if (monitor) {
          c.fillStyle = "#3f5561";
          c.fillRect(px + 3, py + 1, 11, 8);
          c.fillStyle = "#9bd0b1";
          c.fillRect(px + 4, py + 2, 9, 5);
          c.fillStyle = "#4a7a77";
          paintGlyph(c, ["0001000", "0010100", "1100011"], px + 5, py + 3);
        } else {
          c.fillStyle = "#86757e";
          c.fillRect(px + 1, py + 6, 14, 5);
          for (let slot = 2; slot < 14; slot += 4) {
            c.fillStyle = "#ca6869";
            c.fillRect(px + slot, py + 6, 3, 2);
            c.fillStyle = "#f6e7d6";
            c.fillRect(px + slot, py + 8, 3, 1);
          }
        }
      } else if (ch === "T" && type === "home" && x >= 7) {
        c.fillStyle = "#754e45";
        c.fillRect(px, py + 2, 16, 13);
        c.fillStyle = "#e7d3a9";
        c.fillRect(px, py + 3, 16, 10);
        c.fillStyle = "#819c92";
        c.fillRect(px, py + 8, 16, 5);
        c.fillStyle = "#aac5ac";
        c.fillRect(px, py + 8, 16, 1);
        c.fillStyle = "#fff0ca";
        c.fillRect(px + 1, py + 4, 13, 3);
      } else {
        c.fillStyle = "#655643";
        c.fillRect(px + 1, py + 2, 14, 13);
        c.fillStyle = "#bca37c";
        c.fillRect(px, py + 1, 16, 10);
        c.fillStyle = "#ead6a3";
        c.fillRect(px + 1, py + 1, 14, 2);
        c.fillStyle = "#d3bb8f";
        c.fillRect(px + 1, py + 4, 14, 6);
        if (ch === "C") {
          c.fillStyle = "#f0e5c7";
          c.fillRect(px + 1, py + 2, 14, 6);
          c.fillStyle = BUILDING_ACCENTS[type] ?? room[2];
          c.fillRect(px, py + 10, 16, 2);
          if (m.palette === "industrial" || type === "gym") {
            c.fillStyle = "#53666b";
            c.fillRect(px + 3, py + 3, 10, 4);
            c.fillStyle = "#a3d1ad";
            c.fillRect(px + 4, py + 4, 2, 1);
            c.fillRect(px + 7, py + 4, 4, 1);
          }
        }
        if (ch === "S") {
          c.fillStyle = "#303f3b";
          c.fillRect(px + 5, py + 1, 6, 7);
          c.fillRect(px + 4, py + 2, 8, 5);
          c.fillStyle = "#cd6b5c";
          c.fillRect(px + 5, py + 1, 6, 3);
          c.fillStyle = "#f7eed2";
          c.fillRect(px + 5, py + 5, 6, 2);
          c.fillStyle = "#fff6dd";
          c.fillRect(px + 7, py + 3, 2, 2);
        }
      }
      return;
    }
    if (ch === "g") {
      const q = (y % 2) * 2 + (x % 2);
      if (
        !BARREN.has(m.palette) &&
        this.foliage(c, 12 + q, px, py, m.palette, p)
      )
        return;
      this.ground(c, x, y, p, m.palette);
      c.fillStyle = p.shade;
      c.fillRect(px, py + 2, 16, 12);
      c.fillStyle = p.ink;
      for (let i = 0; i < 4; i++) {
        const gx = px + 2 + i * 4;
        const gy = py + 6 + ((x + y + i) % 3);
        c.fillRect(gx, gy, 1, 5);
        c.fillRect(gx - 1, gy - 2, 1, 3);
        c.fillRect(gx + 1, gy - 1, 1, 3);
      }
      return;
    }
    if (ch === "," || ch === "f") {
      this.ground(c, x, y, p, m.palette);
      if (ch === "f") {
        const n = noise(x, y);
        const dx = px + 2 + (n % 6),
          dy = py + 2 + ((n >>> 7) % 5);
        const colors =
          m.palette === "autumn"
            ? ["#a66849", "#d87d52"]
            : m.palette === "snow"
              ? ["#927d9c", "#fff1e2"]
              : ["#d18d8a", "#f2d478", "#f0e2c7"];
        c.fillStyle = p.shade;
        c.fillRect(dx + 1, dy + 3, 1, 3);
        c.fillRect(px + 12, py + 11, 1, 3);
        c.fillStyle = colors[(n >>> 10) % colors.length];
        c.fillRect(dx, dy, 3, 3);
        c.fillRect(px + 11, py + 10, 3, 2);
        c.fillStyle = "#fff0d0";
        c.fillRect(dx + 1, dy + 1, 1, 1);
      }
      return;
    }
    if (!out) {
      c.fillStyle = room[0];
      c.fillRect(px, py, 16, 16);
      c.fillStyle = room[1];
      if (dungeon) {
        const n = noise(x, y);
        c.fillRect(px + 2 + (n % 9), py + 3 + ((n >>> 6) % 9), 3, 1);
        if (n % 3 === 0) c.fillRect(px + 10, py + 11, 2, 1);
      } else {
        c.fillRect(px, py, 16, 1);
        c.fillRect(px + (y % 2 ? 8 : 0), py + 1, 1, 15);
      }
    } else {
      c.fillStyle = p.path;
      c.fillRect(px, py, 16, 16);
      c.fillStyle = p.shade + "46";
      const pathEdge = (dx: number, dy: number) =>
        ",fg#".includes(m.tiles[y + dy]?.[x + dx] ?? ".");
      if (pathEdge(0, -1)) c.fillRect(px, py, 16, 1);
      if (pathEdge(-1, 0)) c.fillRect(px, py, 1, 16);
      if (pathEdge(1, 0)) c.fillRect(px + 15, py, 1, 16);
      if (pathEdge(0, 1)) c.fillRect(px, py + 15, 16, 1);
      const n = noise(x, y);
      c.fillRect(px + 2 + (n % 11), py + 3 + ((n >>> 5) % 10), 2, 1);
      if (
        m.kind === "town" &&
        ["industrial", "violet", "night"].includes(m.palette)
      ) {
        c.fillRect(px, py + 15, 16, 1);
        c.fillRect(px + (y % 2 ? 8 : 0), py, 1, 15);
      }
    }
  }
  private roofDoor(m: WorldMap, x: number, y: number) {
    return m.exits.find((e) => {
      const dy = e.y - y;
      if (
        m.tiles[e.y]?.[e.x] !== "d" ||
        dy < 1 ||
        dy > 3 ||
        Math.abs(e.x - x) > 5
      )
        return false;
      const row = m.tiles[y];
      return !/[^r]/.test(row.slice(Math.min(e.x, x), Math.max(e.x, x) + 1));
    });
  }
  private rock(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    p: Palette,
    theme: string,
  ) {
    const snow = theme === "snow";
    c.fillStyle = p.ink;
    c.fillRect(x + 1, y + 6, 14, 8);
    c.fillRect(x + 4, y + 2, 8, 14);
    c.fillRect(x + 2, y + 4, 12, 11);
    c.fillStyle = p.shade;
    c.fillRect(x + 2, y + 6, 12, 4);
    c.fillRect(x + 4, y + 3, 8, 7);
    c.fillStyle = snow ? "#f7f4e9" : p.path;
    c.fillRect(x + 4, y + 3, 7, 2);
    c.fillRect(x + 3, y + 5, 5, 2);
    c.fillStyle = p.shade;
    c.fillRect(x + 3, y + 11, 4, 2);
    c.fillRect(x + 10, y + 12, 3, 1);
  }
  private landmarkFoot(map: WorldMap) {
    if (
      map.id === "mossford" &&
      map.tiles[2][8] === "#" &&
      map.tiles[3][9] === "#"
    )
      return 4;
    if (map.id === "tideglass" && map.tiles[15][20] === "#") return 16;
    return undefined;
  }
  private freestandingLandmark(c: CanvasRenderingContext2D, map: WorldMap) {
    if (map.id === "mossford") {
      const x = 144,
        y = 47;
      c.fillStyle = "#5c5746";
      c.fillRect(x - 10, y - 11, 20, 27);
      c.fillRect(x - 7, y - 17, 14, 11);
      c.fillStyle = "#e1c797";
      c.fillRect(x - 8, y - 9, 15, 23);
      c.fillStyle = "#b18964";
      c.fillRect(x + 3, y - 7, 4, 21);
      c.fillStyle = "#574a45";
      c.fillRect(x - 2, y + 5, 5, 10);
      c.fillStyle = "#835548";
      c.fillRect(x - 8, y - 15, 16, 7);
      c.fillRect(x - 5, y - 19, 10, 5);
      c.fillStyle = "#fff0c5";
      for (let i = 3; i <= 15; i++) {
        c.fillRect(x + i - 1, y - 10 - i, 3, 3);
        c.fillRect(x - i - 1, y - 10 + i, 3, 3);
        c.fillRect(x + i - 1, y - 10 + i, 3, 3);
        c.fillRect(x - i - 1, y - 10 - i, 3, 3);
      }
      c.fillStyle = "#6b574a";
      c.fillRect(x - 3, y - 13, 6, 6);
      c.fillStyle = "#edcd93";
      c.fillRect(x - 2, y - 12, 4, 4);
    }
    if (map.id === "tideglass") {
      const x = 328,
        y = 255;
      c.fillStyle = "#39576a";
      c.fillRect(x - 12, y - 4, 24, 5);
      c.fillRect(x - 9, y - 41, 18, 41);
      c.fillStyle = "#f0e6c8";
      c.fillRect(x - 7, y - 35, 14, 30);
      c.fillStyle = "#cb796e";
      c.fillRect(x - 7, y - 26, 14, 7);
      c.fillRect(x - 7, y - 13, 14, 5);
      c.fillStyle = "#973f47";
      c.fillRect(x - 11, y - 42, 22, 3);
      c.fillRect(x - 8, y - 45, 16, 3);
      c.fillRect(x - 4, y - 48, 8, 3);
      c.fillStyle = "#f8da8e";
      c.fillRect(x - 6, y - 37, 12, 6);
      c.fillStyle = "#846a61";
      c.fillRect(x - 1, y - 37, 2, 6);
    }
  }
  private roofLandmark(c: CanvasRenderingContext2D, map: WorldMap) {
    if (map.id === "aster" || map.id === "bellweather") {
      const roof = map.exits.find((e) => buildingType(e.to) === "gym");
      if (!roof || map.tiles[roof.y - 1]?.[roof.x] !== "r") return;
      const x = roof.x * 16 + 8,
        y = roof.y * 16 - 11;
      if (map.id === "bellweather") {
        c.fillStyle = "#6a506b";
        c.fillRect(x - 12, y - 25, 24, 25);
        c.fillRect(x - 15, y - 27, 30, 5);
        c.fillRect(x - 12, y - 31, 24, 5);
        c.fillRect(x - 8, y - 35, 16, 5);
        c.fillStyle = "#d4aac2";
        c.fillRect(x - 10, y - 21, 3, 19);
        c.fillRect(x + 7, y - 21, 3, 19);
        c.fillStyle = "#dcab70";
        c.fillRect(x - 4, y - 19, 8, 8);
        c.fillRect(x - 6, y - 11, 12, 2);
        c.fillRect(x - 1, y - 9, 2, 3);
        c.fillStyle = "#fae0a3";
        c.fillRect(x - 3, y - 18, 3, 5);
        return;
      }
      c.fillStyle = "#4c526e";
      c.fillRect(x - 19, y - 10, 38, 10);
      c.fillRect(x - 15, y - 17, 30, 8);
      c.fillRect(x - 10, y - 21, 20, 5);
      c.fillStyle = "#a4aac2";
      c.fillRect(x - 13, y - 16, 26, 6);
      c.fillRect(x - 8, y - 20, 16, 4);
      c.fillRect(x - 17, y - 9, 34, 3);
      c.fillStyle = "#f5d89c";
      paintGlyph(c, SWITCH_SYMBOLS[map.palette], x - 2, y - 15);
    }
  }
  private rebuild(m: WorldMap, left: number, top: number, width: number, height: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = width * 16;
    c.height = height * 16;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const p = PALETTES[m.palette] || PALETTES.meadow;
    ctx.translate(-left * 16, -top * 16);
    const themes: Record<string, WorldMap> = { [m.palette]: m };
    for (let y = top; y < top + height; y++)
      for (let x = left; x < left + width; x++) {
        const palette = m.kind === "route" ? trailPalette(m.id, x, y, m.palette) : m.palette;
        const theme = themes[palette] ??= { ...m, palette };
        if (m.kind === "gym") paintGymTile(ctx, m, x, y);
        else this.tile(ctx, theme, x, y, PALETTES[palette] ?? p);
      }
    // Original atlas landmarks replace occasional 2×2 obstacle clusters.
    const slot = GROVE_ART[m.palette];
    if (slot !== undefined && this.outdoor(m) && m.kind !== "route")
      for (let y = top + 2; y < Math.min(m.height - 3, top + height); y += 4)
        for (let x = left + 2; x < Math.min(m.width - 3, left + width); x += 4) {
          if (
            (x + y * 3) % 5 === 0 &&
            [0, 1].every((dy) =>
              [0, 1].every((dx) => m.tiles[y + dy][x + dx] === "#"),
            )
          )
            this.atlas(ctx, slot, x * 16, y * 16);
        }
    if (m.kind === "dungeon") paintExpeditionFloor(ctx, m);
    if (m.kind === "gym") paintGymFixtures(ctx, m);
    if (m.kind === "town") this.roofLandmark(ctx, m);
    for (const e of m.exits) {
      const px = e.x * 16,
        py = e.y * 16;
      if (paintReturn(ctx, m, e.to, px, py)) continue;
      if (e.entrance === "cave") {
        // The base stays on the portal tile while the arch extends over its back.
        ctx.fillStyle = p.ink;
        ctx.fillRect(px - 4, py + 1, 24, 14);
        ctx.fillRect(px - 2, py - 5, 20, 9);
        ctx.fillRect(px + 2, py - 8, 12, 5);
        ctx.fillStyle = p.shade;
        ctx.fillRect(px, py - 4, 16, 5);
        ctx.fillRect(px - 2, py + 1, 5, 10);
        ctx.fillRect(px + 13, py + 1, 5, 10);
        ctx.fillStyle = "#263037";
        ctx.fillRect(px + 3, py + 3, 10, 11);
        ctx.fillRect(px + 5, py + 1, 6, 3);
        ctx.fillStyle = p.wall + "80";
        ctx.fillRect(px + 3, py - 6, 9, 2);
        ctx.fillRect(px - 2, py + 1, 4, 2);
        ctx.fillRect(px + 14, py + 1, 4, 2);
        ctx.fillStyle = p.shade;
        ctx.fillRect(px + 1, py + 14, 14, 2);
      } else if (e.entrance === "stairs") {
        ctx.fillStyle = p.ink;
        ctx.fillRect(px + 1, py + 1, 14, 14);
        ctx.fillStyle = p.shade;
        ctx.fillRect(px + 2, py + 2, 12, 12);
        ctx.fillStyle = p.path;
        for (let step = 0; step < 4; step++)
          ctx.fillRect(px + 3, py + 3 + step * 3, 10, 1);
      } else if (e.entrance === "mat") {
        const [floor, highlight, trim] = this.room(m);
        const width = (e.width ?? 1) * 16;
        ctx.fillStyle = trim;
        ctx.fillRect(px + 1, py - 4, width - 2, 17);
        ctx.fillStyle = floor;
        ctx.fillRect(px + 3, py - 2, width - 6, 13);
        ctx.fillStyle = highlight;
        ctx.fillRect(px + 3, py - 1, width - 6, 1);
        ctx.fillRect(px + 3, py + 9, width - 6, 1);
        for (let i = 3; i <= width - 3; i += 2) ctx.fillRect(px + i, py - 5, 1, 1);
        ctx.fillStyle = "#473e3b";
        ctx.fillRect(px, py + 13, width, 3);
      }
      if (m.tiles[e.y]?.[e.x] === "d") {
        const label = e.to.endsWith("_center")
          ? "CENTER"
          : e.to.endsWith("_mart")
            ? "SHOP"
            : e.to.startsWith("gym")
              ? "GYM"
              : e.to === "lab"
                ? "LAB"
                : e.to === "home"
                  ? "HOME"
                  : e.to === "league"
                    ? "LEAGUE"
                    : "";
        if (label) {
          const glyphs: Record<string, string[]> = {
            P: ["111", "101", "111", "100", "100"],
            C: ["111", "100", "100", "100", "111"],
            L: ["100", "100", "100", "100", "111"],
            A: ["010", "101", "111", "101", "101"],
            B: ["110", "101", "110", "101", "110"],
            S: ["111", "100", "111", "001", "111"],
            H: ["101", "101", "111", "101", "101"],
            O: ["111", "101", "101", "101", "111"],
            G: ["111", "100", "101", "101", "111"],
            Y: ["101", "101", "010", "010", "010"],
            M: ["101", "111", "111", "101", "101"],
            E: ["111", "100", "110", "100", "111"],
            N: ["101", "111", "111", "111", "101"],
            T: ["111", "010", "010", "010", "010"],
            R: ["110", "101", "110", "101", "101"],
            U: ["101", "101", "101", "101", "111"],
          };
          const width = label.length * 4 + 5;
          const left = px + 8 - Math.floor(width / 2);
          ctx.fillStyle = BUILDING_ACCENTS[buildingType(e.to)] ?? p.ink;
          ctx.fillRect(left, py - 20, width, 10);
          ctx.fillStyle = "#fff1c8";
          ctx.fillRect(left + 1, py - 19, width - 2, 1);
          ctx.fillStyle = "#fff5de";
          for (let i = 0; i < label.length; i++) {
            paintGlyph(ctx, glyphs[label[i]], left + 3 + i * 4, py - 17);
          }
        }
      }
    }
    if (m.id.startsWith("starfall")) {
      const [, outline, trim] = this.room(m);
      for (const o of m.objects) {
        if (o.kind !== "switch" && o.kind !== "leader") continue;
        const x = o.x * 16,
          y = o.y * 16;
        ctx.fillStyle = trim;
        ctx.fillRect(x + 1, y + 3, 14, 10);
        ctx.fillRect(x + 3, y + 1, 10, 14);
        ctx.fillStyle = outline;
        ctx.fillRect(x + 2, y + 4, 12, 8);
        ctx.fillRect(x + 4, y + 2, 8, 12);
      }
    }
    if (buildingType(m.id) === "center") {
      const [door] = m.exits;
      const x = (door.x + 0.5) * 16;
      const y = (door.y - 2) * 16;
      ctx.fillStyle = "#bc797853";
      ctx.fillRect(x - 12, y - 15, 24, 28);
      ctx.fillRect(x - 15, y - 12, 30, 22);
      ctx.fillStyle = "#fff4da92";
      ctx.fillRect(x - 3, y - 9, 6, 16);
      ctx.fillRect(x - 8, y - 4, 16, 6);
    }
    return c;
  }
  private drawTerrain(c: CanvasRenderingContext2D, map: WorldMap, ox = 0, oy = 0) {
    // A long crossing can encompass several screens of ocean. Rasterize only
    // visible 16-tile sections, including the neighboring shore before a seam.
    const size = map.kind === "route" ? 16 : Math.max(map.width, map.height);
    const left = Math.max(0, Math.floor((this.cameraX - ox) / (16 * size)) * size);
    const top = Math.max(0, Math.floor((this.cameraY - oy) / (16 * size)) * size);
    const right = Math.min(map.width, (this.cameraX - ox + WIDTH) / 16);
    const bottom = Math.min(map.height, (this.cameraY - oy + HEIGHT) / 16);
    for (let y = top; y < bottom; y += size)
      for (let x = left; x < right; x += size) {
        const key = map.id + (map.terrainVariant ?? "") + ":" + x + "," + y;
        let image = this.terrains.get(key);
        if (!image) {
          image = this.rebuild(map, x, y, Math.min(size, map.width - x), Math.min(size, map.height - y));
          if (this.terrains.size >= 32) this.terrains.delete(this.terrains.keys().next().value!);
          this.terrains.set(key, image);
        }
        c.drawImage(image, x * 16, y * 16);
      }
  }
  private person(o: WorldObject): string {
    if (o.sprite) return o.sprite;
    if (o.kind === "starter") return "professor";
    if (o.kind === "healer") return "nurse";
    if (o.kind === "shop") return "clerk";
    if (/elder|historian|sage/i.test(o.name)) return "elder";
    if (/angler|sailor|fisher/i.test(o.name)) return "fisher";
    if (o.kind === "leader") return "sage";
    return o.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 2
      ? "lass"
      : "youngster";
  }
  private npcImage(kind: string, facing: string, frame: number) {
    return (
      this.engine &&
      this.sprite(`npc:${kind}:${facing}:${frame}:${this.night}`, () =>
        this.engine!.npc(kind, this.night, facing, frame),
      )
    );
  }
  private npc(
    c: CanvasRenderingContext2D,
    kind: string,
    x: number,
    y: number,
    facing = "down",
    frame = 0,
  ) {
    c.fillStyle = "#183e3636";
    c.fillRect(Math.round(x) - 6, Math.round(y) + 3, 12, 4);
    const image = this.npcImage(kind, facing, frame);
    if (image) {
      c.drawImage(image, Math.round(x) - 8, Math.round(y) - 10);
      return;
    }
    c.fillStyle = "#344d43";
    c.fillRect(x - 4, y - 6, 8, 12);
    c.fillStyle = "#efd7a3";
    c.fillRect(x - 3, y - 5, 6, 5);
    c.fillStyle = "#688a73";
    c.fillRect(x - 4, y, 8, 6);
  }
  private surfer(
    c: CanvasRenderingContext2D,
    map: WorldMap,
    x: number,
    y: number,
    facing: string,
    time: number,
    dx: number,
    dy: number,
  ) {
    const px = Math.round(x * WORLD_SCALE);
    const py = Math.round(y * WORLD_SCALE);
    const moving = time < this.movingUntil;
    const speed = Math.hypot(dx, dy);
    if (speed <= 0.001) {
      dx = Number(facing === "right") - Number(facing === "left");
      dy = Number(facing === "down") - Number(facing === "up");
    } else {
      dx /= speed;
      dy /= speed;
    }
    const ripple = (xx: number, yy: number, width: number) => {
      const tx = Math.floor(xx / WORLD_SCALE);
      const ty = Math.floor(yy / WORLD_SCALE);
      if (map.tiles[ty]?.[tx] !== "~") return;
      // Keep foam in the water at banks and bridge edges.
      c.fillRect(xx, yy, Math.min(width, (tx + 1) * WORLD_SCALE - xx), 1);
    };
    const spread = Math.floor(time / 110) % 4;
    if (moving) {
      for (let i = 0; i < 3; i++) {
        const trail = 11 + i * 5 + spread;
        const split = 3 + i * 2;
        c.fillStyle = i === 0 ? "#eff9e4" : "#cdeee4a0";
        for (const side of [-1, 1]) {
          const xx = Math.round(px - dx * trail - side * dy * split);
          const yy = Math.round(py + 6 - dy * trail + side * dx * split);
          ripple(xx, yy, i === 0 ? 4 : 2);
        }
      }
    } else {
      c.fillStyle = "#d5f1ecca";
      const reach = Math.floor(time / 240) % 3;
      ripple(px - 13 - reach, py + 9, 6);
      ripple(px + 7 + reach, py + 11, 7);
    }

    // The rim hides the rider's legs and bobs independently of the ripples.
    const deck = py + (Math.floor(time / 170) % 4 === 2 ? 3 : 2);
    const crosswise = facing === "left" || facing === "right";
    const half = crosswise ? 13 : 10;
    const left = px - half;
    const width = half * 2;
    c.fillStyle = "#273e4c";
    c.fillRect(left + 4, deck - 4, width - 8, 16);
    c.fillRect(left + 2, deck - 2, width - 4, 12);
    c.fillRect(left, deck + 1, width, 6);
    c.fillStyle = "#ae6354";
    c.fillRect(left + 2, deck + 1, width - 4, 8);
    c.fillRect(left + 5, deck + 8, width - 10, 2);
    c.fillStyle = "#edb977";
    c.fillRect(left + 3, deck - 2, width - 6, 7);
    c.fillRect(left + 1, deck + 1, width - 2, 2);
    c.fillStyle = "#704d4c";
    c.fillRect(left + 5, deck, width - 10, 4);

    const rider = this.npcImage("player", facing, 0);
    if (rider) c.drawImage(rider, 0, 0, 16, 12, px - 8, deck - 10, 16, 12);
    else {
      c.fillStyle = "#344d43";
      c.fillRect(px - 4, deck - 8, 8, 10);
      c.fillStyle = "#efd7a3";
      c.fillRect(px - 3, deck - 7, 6, 5);
    }
    c.fillStyle = "#ffe5aa";
    c.fillRect(left + 3, deck + 3, width - 6, 2);
    c.fillStyle = "#efa779";
    c.fillRect(left + 4, deck + 6, width - 8, 2);
  }
  private roadBarriers(
    c: CanvasRenderingContext2D,
    map: WorldMap,
    isOpen: (exit: Exit) => boolean,
  ) {
    const p = PALETTES[map.palette] || PALETTES.meadow;
    for (const e of map.exits) {
      if (!e.barrier || isOpen(e)) continue;
      const { kind } = e.barrier;
      for (const { x, y } of barrierTiles(e)) {
        const px = x * 16,
          py = y * 16;
        const middle = e.x === x && e.y === y;
        if (kind === "cut") {
          c.fillStyle = "#40563a";
          c.fillRect(px + 1, py + 4, 14, 10);
          c.fillRect(px + 3, py + 1, 10, 14);
          c.fillStyle = "#6a8b50";
          c.fillRect(px + 2, py + 4, 12, 6);
          c.fillRect(px + 5, py + 2, 7, 9);
          c.fillStyle = "#a5b668";
          c.fillRect(px + 4, py + 5, 4, 2);
          c.fillRect(px + 10, py + 8, 3, 2);
          c.fillStyle = "#775440";
          c.fillRect(px + 7, py + 10, 2, 5);
        } else if (kind === "strength" || kind === "rockSmash") {
          this.rock(c, px, py, p, map.palette);
          if (kind === "rockSmash") {
            c.fillStyle = p.ink;
            paintGlyph(
              c,
              ["1100", "0110", "0011", "0110", "1100"],
              px + 7,
              py + 4,
            );
          }
        } else if (
          kind === "surf" ||
          kind === "whirlpool" ||
          kind === "waterfall"
        ) {
          c.fillStyle = p.water;
          c.fillRect(px, py, 16, 16);
          c.fillStyle = "#b5dcea";
          if (kind === "waterfall") {
            c.fillRect(px + 2, py, 2, 13);
            c.fillRect(px + 7, py + 4, 2, 11);
            c.fillRect(px + 12, py, 2, 12);
            c.fillRect(px + 1, py + 14, 14, 1);
          } else if (kind === "whirlpool") {
            paintGlyph(
              c,
              [
                "00111100",
                "01000010",
                "10011001",
                "10110001",
                "10000010",
                "01111100",
              ],
              px + 4,
              py + 5,
            );
          } else {
            c.fillRect(px + 1, py + 10, 5, 1);
            c.fillRect(px + 11, py + 4, 4, 1);
            c.fillStyle = "#e9d39b";
            c.fillRect(px + 6, py + 7, 4, 3);
            c.fillStyle = "#ad686b";
            c.fillRect(px + 7, py + 4, 2, 4);
          }
        } else if (kind === "flash") {
          c.fillStyle = p.shade;
          c.fillRect(px, py + 3, 16, 13);
          c.fillStyle = "#1e2832";
          c.fillRect(px + 1, py + 6, 14, 10);
          c.fillRect(px + 3, py + 3, 10, 5);
          c.fillStyle = "#56636c";
          c.fillRect(px + 4, py + 2, 8, 2);
          c.fillRect(px, py + 6, 2, 9);
          c.fillRect(px + 14, py + 6, 2, 9);
        } else {
          c.fillStyle = "#4b3d3a";
          const vertical = e.direction === "east" || e.direction === "west";
          if (vertical) {
            c.fillRect(px + 6, py, 4, 16);
            c.fillRect(px + 4, py + 6, 8, 4);
            c.fillStyle = "#d1a471";
            c.fillRect(px + 6, py, 2, 16);
          } else {
            c.fillRect(px, py + 6, 16, 7);
            c.fillRect(px + 6, py + 4, 4, 11);
            c.fillStyle = "#d1a471";
            c.fillRect(px, py + 7, 16, 2);
          }
          if (middle) {
            c.fillStyle = "#604e3f";
            c.fillRect(px + 3, py + 2, 10, 8);
            c.fillStyle = "#e3be80";
            c.fillRect(px + 4, py + 3, 8, 5);
            c.fillStyle = "#63443e";
            c.fillRect(px + 7, py + 4, 2, 3);
          }
        }
      }
    }
  }
  private object(
    c: CanvasRenderingContext2D,
    map: WorldMap,
    o: WorldObject,
    time: number,
    done: boolean,
    state?: RendererVisualState["npcs"] extends
      | Record<string, infer T>
      | undefined
      ? T
      : never,
  ) {
    const x = state ? Math.round(state.x * 16) : o.x * 16 + 8,
      y = state ? Math.round(state.y * 16) : o.y * 16 + 8;
    if (
      ["person", "trainer", "leader", "healer", "shop", "starter"].includes(
        o.kind,
      )
    ) {
      this.npc(
        c,
        this.person(o),
        x,
        y,
        state?.facing ?? "down",
        state?.moving ? [0, 1, 0, 2][Math.floor(time / 110) % 4] : 0,
      );
      if (state?.notice) {
        c.fillStyle = "#253e38";
        c.fillRect(x - 5, y - 24, 10, 11);
        c.fillStyle = "#fff8df";
        c.fillRect(x - 4, y - 23, 8, 9);
        c.fillStyle = "#b34435";
        c.fillRect(x - 1, y - 22, 2, 4);
        c.fillRect(x - 1, y - 17, 2, 1);
      }
      if (o.kind === "leader" && !done) {
        c.fillStyle = "#e3bd61";
        c.fillRect(x - 2, y - 16, 4, 3);
      }
      return;
    }
    if (o.kind === "pc" && this.engine) {
      // The upright Center terminal spans the top and bottom right cells of block 08.
      for (const [cell, top] of [[0x21, y - 24], [0x23, y - 8]]) {
        const tile = this.sprite("center-pc:" + cell, () => this.engine!.cell("center", cell));
        if (!tile) continue;
        // Crop the original room's wallpaper and floor away from the cabinet.
        const inset = cell === 0x21 ? 2 : 1;
        const cropY = cell === 0x21 ? 7 : 0;
        c.drawImage(tile, inset, cropY, 16 - 2 * inset, 16 - cropY,
          x - 8 + inset, top + cropY, 16 - 2 * inset, 16 - cropY);
      }
      return;
    }
    if (o.kind === "item") {
      if (!done) this.npc(c, "item", x, y);
      return;
    }
    if (o.field?.light && (o.field.light === "night") !== this.night) {
      c.fillStyle = this.night ? "#798b77" : "#81a6a0";
      c.fillRect(x-4,y+2,3,1); c.fillRect(x+2,y,4,1);
      return;
    }
    if (o.wildlife && this.engine) {
      const species = o.wildlife;
      const creature = this.sprite("mon:" + species, () => this.engine!.sprite(species));
      if (creature) {
        const phase = Math.floor(time / 160 + species) % 26;
        const lift = phase < 5 ? [0,2,3,2,0][phase] : 0;
        c.fillStyle = "#34483d47";
        c.fillRect(x-5,y+3,10,2);
        c.drawImage(creature,x-11,y-17-lift,22,22);
        return;
      }
    }
    if (isWildEncounter(o)) {
      if (done) return;
      const id = o.trainer?.team[0]?.species || o.reward?.species;
      const image =
        id && this.engine
          ? this.sprite(`mon:${id}`, () => this.engine!.sprite(id))
          : undefined;
      if (image) c.drawImage(image, x - 14, y - 19, 28, 28);
      else this.npc(c, "sage", x, y);
      return;
    }
    if (paintFieldObject(c, map, o, x, y, time, done)) return;
    if (o.kind === "switch") {
      this.switch(c, o, map, x, y, time, done);
      return;
    }
    if (map.kind === "route" && o.id === "sign_" + map.id) {
      trailLandmark(c, map, x, y, time);
      return;
    }
    if (o.kind === "gate") {
      c.fillStyle = "#403c47";
      c.fillRect(x - 7, y - 5, 14, 10);
      c.fillRect(x - 8, y - 7, 3, 14);
      c.fillRect(x + 5, y - 7, 3, 14);
      c.fillStyle = done ? "#a5c58a" : "#deb078";
      c.fillRect(x - 5, y - 4, 10, 1);
      c.fillRect(x - 1, y - 3, 3, 6);
      return;
    }
    c.fillStyle = "#74694d";
    c.fillRect(x - 1, y + 2, 3, 5);
    c.fillStyle = "#3e5946";
    c.fillRect(x - 6, y - 6, 12, 9);
    c.fillStyle = "#d2c799";
    c.fillRect(x - 5, y - 5, 10, 7);
    c.fillStyle = "#817456";
    c.fillRect(x - 3, y - 3, 6, 1);
    c.fillRect(x - 3, y - 1, 4, 1);
  }
  private switch(
    c: CanvasRenderingContext2D,
    object: WorldObject,
    map: WorldMap,
    x: number,
    y: number,
    time: number,
    done: boolean,
  ) {
    const [, metal, base] = this.room(map);
    const console = ["industrial", "snow", "night"].includes(map.palette);
    const bell = map.palette === "violet";
    const engine = object.id === "celestial_engine";
    const width = engine ? 24 : console || bell ? 14 : 12;
    const left = x - width / 2;
    c.fillStyle = "#262d36";
    c.fillRect(left + 1, y - 7, width - 2, 13);
    c.fillRect(left, y - 6, width, 11);
    c.fillStyle = base;
    c.fillRect(left + 1, y + 1, width - 2, 4);
    c.fillStyle = metal;
    c.fillRect(left + 1, y - 6, width - 2, 7);
    if (console || engine) {
      c.fillStyle = "#39464f";
      c.fillRect(left + 2, y - 5, width - 4, 6);
    } else if (bell) {
      c.fillStyle = "#dda46b";
      c.fillRect(x - 4, y - 6, 8, 7);
    }
    c.fillStyle = done ? "#e0f3a7" : console ? "#ffd78d" : base;
    paintGlyph(
      c,
      SWITCH_SYMBOLS[map.palette] ?? SWITCH_SYMBOLS.mountain,
      x - 2,
      y - 5,
    );
    c.fillStyle = done
      ? "#9ed980"
      : Math.floor(time / 450) % 2
        ? "#edb873"
        : "#a57465";
    c.fillRect(x - 1, y + 2, 3, 2);
    if (engine) {
      c.fillRect(left + 3, y - 3, 3, 2);
      c.fillRect(left + width - 6, y - 3, 3, 2);
    }
  }
  private follow(map: WorldMap, x: number, y: number, time: number) {
    const previous = this.currentMap;
    const changed = previous?.id !== map.id;
    const outside = this.outdoor(map);
    // Frame the town itself at its edges. Pan across a connecting road as the
    // player approaches its mouth so the next route scrolls into view.
    const axis = (
      position: number,
      size: number,
      screen: number,
      horizontal: boolean,
    ) => {
      const target = position * WORLD_SCALE - screen / 2;
      const extra = size * WORLD_SCALE - screen;
      if (extra < 0) return extra / 2;
      const bounded = Math.max(0, Math.min(extra, target));
      if (!outside || target === bounded) return bounded;
      const side = horizontal
        ? target < 0
          ? "west"
          : "east"
        : target < 0
          ? "north"
          : "south";
      let blend = 0;
      for (const exit of map.exits) {
        if (exit.direction !== side) continue;
        const lateral = Math.abs(
          horizontal ? y - exit.y - 0.5 : x - exit.x - 0.5,
        );
        blend = Math.max(
          blend,
          Math.min(1, ((exit.span ?? 1) + 4 - lateral) / 3),
        );
      }
      return bounded + (target - bounded) * blend;
    };
    const targetX = axis(x, map.width, WIDTH, true);
    const targetY = axis(y, map.height, HEIGHT, false);
    let dx = x - this.lastX;
    let dy = y - this.lastY;
    let continuous = !changed;
    if (changed && previous && outside && this.outdoor(previous)) {
      const exit = previous.exits.find((e) => e.to === map.id && e.direction);
      if (exit) {
        const offset = connectionOffset(previous, exit);
        dx += offset.x;
        dy += offset.y;
        if (Math.hypot(dx, dy) < 2) {
          continuous = true;
          this.cameraX -= offset.x * WORLD_SCALE;
          this.cameraY -= offset.y * WORLD_SCALE;
        }
      }
    }
    const distance = continuous ? Math.hypot(dx, dy) : 0;
    if (!continuous || distance >= 3) {
      this.cameraX = targetX;
      this.cameraY = targetY;
      this.movingUntil = 0;
      this.walkDistance = 0;
    } else {
      const elapsed = Math.max(0, Math.min(time - this.lastTime, 100));
      const decay = Math.exp(-elapsed / 48);
      const trail = (current: number, target: number) =>
        target + Math.max(-12, Math.min(12, (current - target) * decay));
      this.cameraX = trail(this.cameraX, targetX);
      this.cameraY = trail(this.cameraY, targetY);
      if (distance > 0.001) {
        if (time >= this.movingUntil) this.walkDistance = 0;
        this.movingUntil = time + 80;
        this.walkDistance += distance;
      }
    }
    this.lastTime = time;
    this.lastX = x;
    this.lastY = y;
    this.currentMap = map;
    return {
      changed,
      distance,
      dx: continuous && distance < 3 ? dx : 0,
      dy: continuous && distance < 3 ? dy : 0,
    };
  }
  private animateGround(
    c: CanvasRenderingContext2D,
    map: WorldMap,
    time: number,
  ) {
    // Small animated highlights add movement without rebuilding the terrain cache.
    for (
      let ty = Math.max(0, Math.floor(this.cameraY / 16));
      ty < Math.min(map.height, Math.ceil((this.cameraY + 240) / 16));
      ty++
    )
      for (
        let tx = Math.max(0, Math.floor(this.cameraX / 16));
        tx < Math.min(map.width, Math.ceil((this.cameraX + 320) / 16));
        tx++
      ) {
        const tile = map.tiles[ty][tx];
        if (tile === "~") {
          const seed = noise(tx, ty);
          c.fillStyle = "#e1f4df80";
          c.fillRect(
            tx * 16 + ((Math.floor(time / 450) + (seed % 12)) % 12),
            ty * 16 + 7,
            3,
            1,
          );
          if (
            (["cinderfall", "rimepeak", "route13", "route15"].includes(map.id)) &&
            seed % 5 === 0
          ) {
            const rise = Math.floor(time / 145 + (seed % 13)) % 10;
            const sx = tx * 16 + 7 + ((rise + (seed % 7)) % 4);
            const sy = ty * 16 + 8 - rise;
            c.fillStyle = rise < 6 ? "#f4e7cb86" : "#f4e7cb40";
            c.fillRect(sx - 2, sy, 5, 2);
            c.fillRect(sx - 1, sy - 1, 3, 1);
          }
        }
        if (tile === "f" && (tx + ty + Math.floor(time / 1000)) % 4 === 0) {
          c.fillStyle = "#fff4d0";
          c.fillRect(tx * 16 + 4, ty * 16 + 4, 1, 2);
        }
      }
  }
  battleBackdrop(map: WorldMap, x: number, y: number, fishing: boolean) {
    if (!this.outdoor(map)) return;
    const region = map.kind === "route" ? trailPalette(map.id, x, y, map.palette) : map.palette;
    const onWater = map.tiles[Math.floor(y)]?.[Math.floor(x)] === "~";
    return fieldArena(region, PALETTES[region] ?? PALETTES.meadow, fishing || onWater, this.night);
  }

  render(
    map: WorldMap,
    x: number,
    y: number,
    facing: string,
    time: number,
    flags: string[] = [],
    visualState: RendererVisualState = {},
  ) {
    const c = this.ctx;
    const { changed, distance, dx, dy } = this.follow(map, x, y, time);
    if (changed) {
      this.enteredAt = time;
      this.grassTile = `${Math.floor(x)},${Math.floor(y)}`;
      this.rustles = [];
    }
    const tileX = Math.floor(x),
      tileY = Math.floor(y),
      tileKey = `${tileX},${tileY}`;
    if (
      tileKey !== this.grassTile &&
      distance > 0.001 &&
      map.tiles[tileY]?.[tileX] === "g"
    )
      this.rustles.push({ x: tileX, y: tileY, start: time });
    this.grassTile = tileKey;
    this.rustles = this.rustles.filter((r) => time - r.start < 380);
    c.fillStyle = this.outdoor(map)
      ? (PALETTES[map.palette] || PALETTES.meadow).shade
      : "#26313b";
    c.fillRect(0, 0, WIDTH, HEIGHT);
    c.save();
    c.translate(-Math.round(this.cameraX), -Math.round(this.cameraY));
    if (this.outdoor(map)) {
      const p = PALETTES[map.palette] || PALETTES.meadow;
      const minX = Math.floor(this.cameraX / 16),
        maxX = Math.ceil((this.cameraX + 320) / 16);
      const minY = Math.floor(this.cameraY / 16),
        maxY = Math.ceil((this.cameraY + 240) / 16);
      for (let ty = minY; ty < maxY; ty++)
        for (let tx = minX; tx < maxX; tx++) {
          if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) continue;
          const px = tx * 16,
            py = ty * 16;
          if (map.palette === "coast" || map.palette === "wetland") {
            c.fillStyle = p.water;
            c.fillRect(px, py, 16, 16);
            c.fillStyle = "#d9eee080";
            c.fillRect(px + ((tx * 7 + ty * 3 + 1000) % 10), py + 6, 4, 1);
          } else {
            this.barrier(c, map, tx, ty, p);
          }
        }
    }
    const done = new Set(flags);
    const isOpen = visualState.exitOpen ?? ((e: Exit) => !e.barrier);
    if (this.outdoor(map)) {
      for (const e of map.exits) {
        const neighbor = WORLD[e.to];
        if (!e.direction || !neighbor || !this.outdoor(neighbor)) continue;
        const offset = connectionOffset(map, e);
        const ox = offset.x * WORLD_SCALE,
          oy = offset.y * WORLD_SCALE;
        if (
          ox >= this.cameraX + 320 ||
          oy >= this.cameraY + 240 ||
          ox + neighbor.width * 16 <= this.cameraX ||
          oy + neighbor.height * 16 <= this.cameraY
        )
          continue;
        c.save();
        c.translate(ox, oy);
        this.drawTerrain(c, neighbor, ox, oy);
        this.roadBarriers(c, neighbor, isOpen);
        if (this.landmarkFoot(neighbor) !== undefined)
          this.freestandingLandmark(c, neighbor);
        for (const o of neighbor.objects
          .filter((o) => objectVisible(o, done))
          .sort((a, b) => a.y - b.y))
          this.object(c, neighbor, o, time, done.has(o.setsFlag || o.id), {
            x: o.x + 0.5,
            y: o.y + 0.5,
            facing:
              o.facing ?? ["down", "left", "up", "right"][o.id.length % 4],
          });
        c.restore();
      }
    }
    this.drawTerrain(c, map);
    this.animateGround(c, map, time);
    if (map.id === "reedhaven_house") {
      for (const [i, y] of [2, 4].entries()) {
        const px = 6 * 16, py = y * 16;
        c.fillStyle = "#685e3c";
        c.fillRect(px, py + 1, 32, 14);
        c.fillStyle = "#b69b63";
        c.fillRect(px + 1, py + 2, 30, 11);
        c.fillStyle = "#e1cb91";
        for (let n = 0; n < 7; n++) c.fillRect(px + 2 + n * 4, py + 4 + n % 3, 3, 2);
        const id = visualState.nest?.[i]?.species;
        if (id && this.engine) {
          const image = this.sprite("mon:" + id, () => this.engine!.sprite(id));
          if (image) c.drawImage(image, px + 5, py - 12 - Math.floor(time / 650 + i) % 2, 24, 24);
        }
      }
    }
    if (map.kind === "dungeon") expeditionActivity(c, map, time, done);
    if (map.kind === "gym") paintGymActivity(c, map, done, time);
    this.roadBarriers(c, map, isOpen);
    const objects = map.objects.filter((o) => objectVisible(o, done));
    const actors = objects.map((o) => ({
      y: visualState.npcs?.[o.id]?.y ?? o.y + 0.5,
      object: o,
    }));
    const sorted: { y: number; object?: WorldObject; landmark?: boolean }[] = [
      ...actors,
      { y },
    ];
    const foot = this.landmarkFoot(map);
    if (foot !== undefined) sorted.push({ y: foot, landmark: true });
    sorted.sort((a, b) => a.y - b.y);
    for (const actor of sorted) {
      if (actor.landmark) {
        this.freestandingLandmark(c, map);
        continue;
      }
      if (actor.object) {
        const o = actor.object;
        this.object(
          c,
          map,
          o,
          time,
          done.has(o.setsFlag || o.id),
          visualState.npcs?.[o.id],
        );
      } else if (map.tiles[tileY]?.[tileX] === "~") {
        this.surfer(c, map, x, y, facing, time, dx, dy);
      } else {
        this.npc(
          c,
          "player",
          x * 16,
          y * 16,
          facing,
          time < this.movingUntil
            ? [0, 1, 0, 2][Math.floor(this.walkDistance * 2.2) % 4]
            : 0,
        );
      }
      // Grass overlaps feet, while the rest of each character remains in front.
      const ax = actor.object
        ? (visualState.npcs?.[actor.object.id]?.x ?? actor.object.x + 0.5)
        : x;
      const ay = actor.y;
      const tx = Math.floor(ax),
        ty = Math.floor(ay);
      if (map.tiles[ty]?.[tx] === "g") {
        const p = PALETTES[map.palette] || PALETTES.meadow;
        c.fillStyle = p.ink;
        for (let i = 0; i < 5; i++) {
          const gx = tx * 16 + 1 + i * 3;
          c.fillRect(gx, ty * 16 + 13 - (i % 2), 1, 3);
          c.fillRect(gx - 1, ty * 16 + 12 - (i % 2), 1, 2);
        }
      }
    }
    for (const rustle of this.rustles) {
      const p = PALETTES[map.palette] || PALETTES.meadow;
      const progress = Math.max(0, (time - rustle.start) / 380);
      const spread = Math.round(progress * 3),
        hop = Math.round(3 * Math.sin(progress * Math.PI));
      c.save();
      c.globalAlpha = 1 - progress;
      c.fillStyle = p.ink;
      c.fillRect(rustle.x * 16 + 3 - spread, rustle.y * 16 + 12 - hop, 3, 1);
      c.fillRect(rustle.x * 16 + 10 + spread, rustle.y * 16 + 11 - hop, 3, 1);
      c.fillStyle = p.shade;
      c.fillRect(rustle.x * 16 + 5 - spread, rustle.y * 16 + 8 - hop, 2, 2);
      c.fillRect(rustle.x * 16 + 9 + spread, rustle.y * 16 + 8 - hop, 2, 2);
      c.restore();
    }
    c.restore();
    if (this.night) {
      c.fillStyle = "#20355d22";
      c.fillRect(0, 0, 320, 240);
    }
    if (visualState.hideHud) return;
    c.font = "15px VT323, monospace";
    c.save();
    c.globalAlpha = Math.max(
      0,
      Math.min(1, (this.enteredAt + 3500 - time) / 500),
    );
    const width = Math.min(298, c.measureText(map.name).width + 18);
    c.fillStyle = "#263a36ed";
    c.fillRect(8, 8, width, 20);
    c.fillStyle = "#a7c391";
    c.fillRect(8, 8, 2, 20);
    c.fillStyle = "#f5efcf";
    c.fillText(map.name, 16, 22, width - 13);
    c.restore();
    const target = interactionTarget(
      map,
      { x, y, facing },
      done,
      (o) => visualState.npcs?.[o.id] ?? { x: o.x + 0.5, y: o.y + 0.5 },
    );
    const barrier = barrierTarget(map, { x, y, facing }, isOpen);
    const exit = map.exits
      .filter(isOpen)
      .map((e) => ({ e, distance: Math.hypot(e.x + 0.5 - x, e.y + 0.5 - y) }))
      .filter(({ distance }) => distance < 2.25)
      .sort((a, b) => a.distance - b.distance)[0]?.e;
    if (barrier || target || visualState.canFish || exit) {
      const confirm = visualState.confirmLabel ?? "A";
      const hint = barrier
        ? `${confirm} · Inspect ${barrier.label}`
        : target
          ? `${confirm} · ${target.name}`
          : visualState.canFish ? `${confirm} · Fish`
          : `${exit!.direction ? DIRECTION_ARROW[exit!.direction] : "→"} ${exit!.label}`;
      const w = Math.ceil(Math.min(300, c.measureText(hint).width + 16));
      const left = Math.floor((WIDTH - w) / 2);
      c.fillStyle = "#263a36e8";
      c.fillRect(left, HEIGHT - 26, w, 19);
      c.fillStyle = "#f5efcf";
      c.fillText(hint, left + 8, HEIGHT - 13, w - 16);
    }
  }
}
