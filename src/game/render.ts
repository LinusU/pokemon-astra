import { WORLD, type WorldMap, type WorldObject } from "../world";
import type { Engine } from "../engine";

export interface RendererVisualState {
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
    roof: "#4f9c91",
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
    grass: "#d9ca8b",
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
    grass: "#b19e7e",
    shade: "#8b786a",
    path: "#c5b18b",
    ink: "#62575d",
    roof: "#a75e58",
    wall: "#d7b79a",
    water: "#bc6c4c",
  },
  snow: {
    grass: "#dae2d5",
    shade: "#acbfb6",
    path: "#e9e7d7",
    ink: "#718995",
    roof: "#879cac",
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
const ART_SLOT: Record<string, number> = {
  autumn: 8,
  wetland: 9,
  volcanic: 10,
  night: 11,
  violet: 11,
  snow: 10,
};
const WORLD_SCALE = 16;

/** Crisp cartridge graphics, original environment art, and continuous sub-tile movement. */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  cameraX = 0;
  cameraY = 0;
  private engine?: Engine;
  private terrains = new Map<string, HTMLCanvasElement>();
  private mapId = "";
  private art = new Image();
  private sprites = new Map<string, HTMLCanvasElement>();
  private lastX = 0;
  private lastY = 0;
  private movingUntil = 0;
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
    this.art.src = "./assets/astra-environments.png";
    document.fonts?.ready.then(() => {
      this.terrains.clear();
    });
  }
  setEngine(engine: Engine) {
    this.engine = engine;
    this.sprites.clear();
    this.terrains.clear();
  }
  setNight(night: boolean) {
    if (this.night !== night) {
      this.night = night;
      this.terrains.clear();
      this.sprites.clear();
    }
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
  private cell(
    c: CanvasRenderingContext2D,
    set: string,
    index: number,
    x: number,
    y: number,
    roof = 0,
  ): boolean {
    if (!this.engine) return false;
    const image = this.sprite(`${set}:${index}:${roof}:${this.night}`, () =>
      this.engine!.cell(set, index, roof, this.night),
    );
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
    const s = this.art.naturalWidth / 4;
    c.drawImage(
      this.art,
      (slot % 4) * s,
      Math.floor(slot / 4) * s,
      s,
      s,
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
  private tile(
    c: CanvasRenderingContext2D,
    m: WorldMap,
    x: number,
    y: number,
    p: Palette,
  ) {
    const ch = m.tiles[y][x],
      px = x * 16,
      py = y * 16,
      out = this.outdoor(m),
      q = (y % 2) * 2 + (x % 2);
    const set =
      m.palette === "snow"
        ? "ice"
        : m.id.startsWith("hourglass")
          ? "ruins"
          : "cave";
    const ground = out ? p.grass : p.path;
    c.fillStyle = ground;
    c.fillRect(px, py, 16, 16);
    if (ch === "#") {
      if (m.kind === "interior" || m.kind === "gym") {
        c.fillStyle = p.ink;
        c.fillRect(px, py, 16, 16);
        c.fillStyle = "#b6c5ac";
        c.fillRect(px, py + 1, 16, 10);
        c.fillStyle = "#e7dfc0";
        c.fillRect(px, py + 1, 16, 2);
        c.fillStyle = "#8a9a83";
        c.fillRect(px, py + 10, 16, 3);
        c.fillStyle = p.ink;
        c.fillRect(px, py + 13, 16, 3);
        return;
      }
      if (!out) {
        if (!this.cell(c, set, 4 + q, px, py)) this.rock(c, px, py, p);
        return;
      }
      if (["volcanic", "mountain", "desert", "snow"].includes(m.palette)) {
        if (!this.cell(c, m.palette === "snow" ? "ice" : "cave", 4 + q, px, py))
          this.rock(c, px, py, p);
        return;
      }
      // Johto cell 20 is a complete 16×16 tree. Adjacent metatile
      // quadrants include other objects, so do not assemble them as a tree.
      if (this.cell(c, "johto", 20, px, py)) {
        if (m.palette === "autumn") {
          c.fillStyle = "#d784322d";
          c.fillRect(px, py, 16, 16);
        }
        return;
      }
      c.fillStyle = p.ink;
      c.fillRect(px + 1, py + 3, 14, 12);
      c.fillStyle = p.shade;
      c.fillRect(px + 3, py, 10, 11);
      return;
    }
    if (ch === "~") {
      c.fillStyle = p.water;
      c.fillRect(px, py, 16, 16);
      c.fillStyle = "#c2e1d29c";
      c.fillRect(px + ((y * 3) % 8), py + 4, 5, 1);
      c.fillRect(px + 8, py + 11, 4, 1);
      const n = (xx: number, yy: number) => m.tiles[yy]?.[xx] !== "~";
      c.fillStyle = p.shade;
      if (n(x, y - 1)) c.fillRect(px, py, 16, 2);
      if (n(x, y + 1)) c.fillRect(px, py + 14, 16, 2);
      if (n(x - 1, y)) c.fillRect(px, py, 2, 16);
      if (n(x + 1, y)) c.fillRect(px + 14, py, 2, 16);
      return;
    }
    if (ch === "r") {
      // Joined roof tiles, outlined only at the building perimeter.
      c.fillStyle = p.ink;
      c.fillRect(px, py, 16, 16);
      c.fillStyle = p.roof;
      c.fillRect(px + 1, py + 1, 15, 15);
      for (let sy = 2; sy < 16; sy += 5) {
        c.fillStyle = "#ffffff40";
        c.fillRect(px + 1, py + sy, 15, 1);
        c.fillStyle = "#183c3c60";
        c.fillRect(px + (sy % 2) * 4 + 2, py + sy + 1, 1, 4);
        c.fillRect(px + 11, py + sy + 1, 1, 4);
      }
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
      c.fillStyle = "#85634d";
      c.fillRect(px, py, 16, 16);
      for (let sy = 1; sy < 16; sy += 4) {
        c.fillStyle = "#cfb37c";
        c.fillRect(px + 1, py + sy, 14, 2);
        c.fillStyle = "#584d40";
        c.fillRect(px, py + sy + 2, 16, 1);
      }
      return;
    }
    if ("BCPTS".includes(ch)) {
      c.fillStyle = "#d8d0b4";
      c.fillRect(px, py, 16, 16);
      if (ch === "B") {
        c.fillStyle = "#555a46";
        c.fillRect(px, py, 16, 16);
        c.fillStyle = "#b89868";
        c.fillRect(px + 1, py + 1, 14, 13);
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
          c.fillStyle = "#8a9a91";
          c.fillRect(px, py + 10, 16, 2);
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
      if (!this.cell(c, "johto", 12 + q, px, py)) {
        c.fillStyle = p.grass;
        c.fillRect(px, py, 16, 16);
        c.fillStyle = p.ink;
        for (let i = 0; i < 4; i++) {
          const gx = px + 1 + i * 4,
            gy = py + 6 + ((x + y + i) % 3);
          c.fillRect(gx, gy, 1, 5);
          c.fillRect(gx - 1, gy - 2, 1, 3);
          c.fillRect(gx + 1, gy - 1, 1, 3);
        }
      }
      return;
    }
    if (ch === "," || ch === "f") {
      if (!this.cell(c, "johto", 8 + q, px, py)) {
        c.fillStyle = p.grass;
        c.fillRect(px, py, 16, 16);
      }
      if (["autumn", "snow", "wetland", "night"].includes(m.palette)) {
        c.fillStyle = p.grass + "55";
        c.fillRect(px, py, 16, 16);
      }
      if (ch === "f") {
        c.fillStyle = m.palette === "autumn" ? "#d57c61" : "#f4db9c";
        c.fillRect(px + 3, py + 4, 3, 3);
        c.fillRect(px + 10, py + 10, 3, 3);
        c.fillStyle = "#fff0d0";
        c.fillRect(px + 4, py + 5, 1, 1);
        c.fillRect(px + 11, py + 11, 1, 1);
      }
      return;
    }
    if (!out) {
      if (
        m.kind === "dungeon" &&
        !m.id.startsWith("meridian") &&
        !m.id.startsWith("starfall")
      ) {
        this.cell(
          c,
          set,
          m.id.startsWith("hourglass") ? 12 + q : 8 + q,
          px,
          py,
        );
        return;
      }
      c.fillStyle = (x + y) % 2 ? p.path : "#e3dbc1";
      c.fillRect(px, py, 16, 16);
      c.fillStyle = "#c2b995";
      c.fillRect(px, py + 15, 16, 1);
      c.fillRect(px + 15, py, 1, 16);
    } else {
      c.fillStyle = p.path;
      c.fillRect(px, py, 16, 16);
      // Fine gravel with stable positions; no per-frame noise or flicker.
      c.fillStyle = "#8c8b633f";
      if ((x * 3 + y * 7) % 4 === 0) {
        c.fillRect(px + 4, py + 5, 2, 1);
        c.fillRect(px + 11, py + 12, 1, 1);
      }
    }
  }
  private rock(c: CanvasRenderingContext2D, x: number, y: number, p: Palette) {
    c.fillStyle = p.ink;
    c.fillRect(x, y, 16, 16);
    c.fillStyle = p.shade;
    c.fillRect(x + 1, y + 1, 14, 12);
    c.fillStyle = p.path;
    c.fillRect(x + 2, y + 2, 11, 2);
    c.fillStyle = p.ink;
    c.fillRect(x + 1, y + 12, 13, 2);
  }
  private rebuild(m: WorldMap): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = m.width * 16;
    c.height = m.height * 16;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const p = PALETTES[m.palette] || PALETTES.meadow;
    for (let y = 0; y < m.height; y++)
      for (let x = 0; x < m.width; x++) this.tile(ctx, m, x, y, p);
    // Original atlas landmarks replace occasional 2×2 obstacle clusters.
    const slot = ART_SLOT[m.palette];
    if (slot !== undefined)
      for (let y = 2; y < m.height - 3; y += 4)
        for (let x = 2; x < m.width - 3; x += 4) {
          if (
            (x + y * 3) % 5 === 0 &&
            [0, 1].every((dy) =>
              [0, 1].every((dx) => m.tiles[y + dy][x + dx] === "#"),
            )
          )
            this.atlas(ctx, slot, x * 16, y * 16);
        }
    for (const e of m.exits) {
      const px = e.x * 16,
        py = e.y * 16;
      if (e.entrance === "cave") {
        // A dark opening framed by stone, visible even when approached from below.
        ctx.fillStyle = p.ink;
        ctx.fillRect(px - 3, py - 8, 22, 23);
        ctx.fillStyle = p.shade;
        ctx.fillRect(px - 2, py - 7, 20, 6);
        ctx.fillRect(px - 2, py - 1, 4, 14);
        ctx.fillRect(px + 14, py - 1, 4, 14);
        ctx.fillStyle = "#273b38";
        ctx.fillRect(px + 2, py, 12, 14);
        ctx.fillStyle = p.path;
        ctx.fillRect(px + 2, py + 14, 12, 2);
      } else if (e.entrance === "stairs") {
        ctx.fillStyle = p.ink;
        ctx.fillRect(px + 1, py + 1, 14, 14);
        ctx.fillStyle = p.shade;
        ctx.fillRect(px + 2, py + 2, 12, 12);
        ctx.fillStyle = p.path;
        for (let step = 0; step < 4; step++)
          ctx.fillRect(px + 3, py + 3 + step * 3, 10, 1);
      }
      if (m.tiles[e.y]?.[e.x] === "d") {
        const label = e.to.endsWith("_center")
          ? "P.C."
          : e.to.endsWith("_mart")
            ? "SHOP"
            : e.to.startsWith("gym")
              ? "GYM"
              : e.to === "lab"
                ? "LAB"
                : e.to === "home"
                  ? "HOME"
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
            ".": ["000", "000", "000", "000", "010"],
          };
          ctx.fillStyle = "#f8e5b1";
          ctx.fillRect(px - 8, py - 20, 32, 10);
          ctx.fillStyle = p.ink;
          const start = px + 8 - (label.length * 4 - 1) / 2;
          for (let i = 0; i < label.length; i++) {
            const glyph = glyphs[label[i]];
            if (!glyph) continue;
            for (let row = 0; row < 5; row++)
              for (let col = 0; col < 3; col++)
                if (glyph[row][col] === "1")
                  ctx.fillRect(
                    Math.round(start + i * 4 + col),
                    py - 18 + row,
                    1,
                    1,
                  );
          }
        }
      }
    }
    return c;
  }
  private terrainFor(map: WorldMap): HTMLCanvasElement {
    let terrain = this.terrains.get(map.id);
    if (!terrain) {
      terrain = this.rebuild(map);
      if (this.terrains.size >= 16)
        this.terrains.delete(this.terrains.keys().next().value!);
      this.terrains.set(map.id, terrain);
    }
    return terrain;
  }
  private person(o: WorldObject): string {
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
    const image =
      this.engine &&
      this.sprite(`npc:${kind}:${facing}:${frame}:${this.night}`, () =>
        this.engine!.npc(kind, this.night, facing, frame),
      );
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
  private object(
    c: CanvasRenderingContext2D,
    o: WorldObject,
    time: number,
    done: boolean,
    state?: RendererVisualState["npcs"] extends
      | Record<string, infer T>
      | undefined
      ? T
      : never,
  ) {
    const x = state ? state.x * 16 : o.x * 16 + 8,
      y = state ? state.y * 16 : o.y * 16 + 8;
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
    if (o.kind === "item") {
      if (!done) this.npc(c, "item", x, y);
      return;
    }
    if (o.kind === "legendary") {
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
    if (o.kind === "switch") {
      c.fillStyle = "#455e5d";
      c.fillRect(x - 5, y - 5, 10, 12);
      c.fillStyle = "#c7bea0";
      c.fillRect(x - 6, y - 6, 12, 7);
      c.fillStyle = done ? "#7ca882" : "#d7ac68";
      c.fillRect(x - 3, y - 5, 6, 4);
      if (!done && Math.floor(time / 650) % 2) {
        c.fillStyle = "#fff0b9";
        c.fillRect(x - 1, y - 12, 2, 3);
        c.fillRect(x - 2, y - 11, 4, 1);
      }
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
  render(
    map: WorldMap,
    x: number,
    y: number,
    facing: string,
    time: number,
    flags: string[] = [],
    visualState: RendererVisualState = {},
  ) {
    const c = this.ctx,
      changed = this.mapId !== map.id;
    if (changed) this.mapId = map.id;
    const terrain = this.terrainFor(map);
    const targetX = this.outdoor(map)
      ? x * WORLD_SCALE - 160
      : map.width * WORLD_SCALE < 320
        ? (map.width * WORLD_SCALE - 320) / 2
        : Math.max(
            0,
            Math.min(map.width * WORLD_SCALE - 320, x * WORLD_SCALE - 160),
          );
    const targetY = this.outdoor(map)
      ? y * WORLD_SCALE - 120
      : map.height * WORLD_SCALE < 240
        ? (map.height * WORLD_SCALE - 240) / 2
        : Math.max(
            0,
            Math.min(map.height * WORLD_SCALE - 240, y * WORLD_SCALE - 120),
          );
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
      Math.hypot(x - this.lastX, y - this.lastY) > 0.001 &&
      map.tiles[tileY]?.[tileX] === "g"
    )
      this.rustles.push({ x: tileX, y: tileY, start: time });
    this.grassTile = tileKey;
    this.rustles = this.rustles.filter((r) => time - r.start < 380);
    this.cameraX = targetX;
    this.cameraY = targetY;
    if (Math.hypot(x - this.lastX, y - this.lastY) > 0.001)
      this.movingUntil = time + 80;
    this.lastX = x;
    this.lastY = y;
    c.fillStyle = this.outdoor(map)
      ? (PALETTES[map.palette] || PALETTES.meadow).shade
      : "#233d37";
    c.fillRect(0, 0, 320, 240);
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
            const q = (((ty % 2) + 2) % 2) * 2 + (((tx % 2) + 2) % 2);
            c.fillStyle = p.grass;
            c.fillRect(px, py, 16, 16);
            this.cell(c, "johto", 8 + q, px, py);
            if (
              ["volcanic", "mountain", "desert", "snow"].includes(map.palette)
            ) {
              if (
                !this.cell(
                  c,
                  map.palette === "snow" ? "ice" : "cave",
                  4 + q,
                  px,
                  py,
                )
              )
                this.rock(c, px, py, p);
            } else if (!this.cell(c, "johto", 20, px, py)) {
              c.fillStyle = p.ink;
              c.fillRect(px + 2, py + 4, 12, 11);
              c.fillStyle = p.shade;
              c.fillRect(px + 3, py + 1, 10, 11);
            }
          }
        }
    }
    const done = new Set(flags);
    if (this.outdoor(map)) {
      for (const e of map.exits) {
        const neighbor = WORLD[e.to];
        if (!e.direction || !neighbor || !this.outdoor(neighbor)) continue;
        const ox =
          e.direction === "east"
            ? map.width * 16
            : e.direction === "west"
              ? -neighbor.width * 16
              : (e.x - e.toX) * 16;
        const oy =
          e.direction === "south"
            ? map.height * 16
            : e.direction === "north"
              ? -neighbor.height * 16
              : (e.y - e.toY) * 16;
        if (
          ox >= this.cameraX + 320 ||
          oy >= this.cameraY + 240 ||
          ox + neighbor.width * 16 <= this.cameraX ||
          oy + neighbor.height * 16 <= this.cameraY
        )
          continue;
        c.save();
        c.translate(ox, oy);
        c.drawImage(this.terrainFor(neighbor), 0, 0);
        for (const o of [...neighbor.objects].sort((a, b) => a.y - b.y))
          this.object(c, o, time, !!o.setsFlag && done.has(o.setsFlag), {
            x: o.x + 0.5,
            y: o.y + 0.5,
            facing:
              o.facing ?? ["down", "left", "up", "right"][o.id.length % 4],
          });
        c.restore();
      }
    }
    c.drawImage(terrain, 0, 0);
    const objects = map.objects.filter(
      (o) => !(o.kind === "item" && o.setsFlag && done.has(o.setsFlag)),
    );
    const actors = objects.map((o) => ({
      y: visualState.npcs?.[o.id]?.y ?? o.y + 0.5,
      object: o,
    }));
    const sorted: { y: number; object?: WorldObject }[] = [...actors, { y }];
    sorted.sort((a, b) => a.y - b.y);
    for (const actor of sorted) {
      if (actor.object) {
        const o = actor.object;
        this.object(
          c,
          o,
          time,
          !!o.setsFlag && done.has(o.setsFlag),
          visualState.npcs?.[o.id],
        );
      } else {
        this.npc(
          c,
          "player",
          x * 16,
          y * 16,
          facing,
          time < this.movingUntil
            ? [0, 1, 0, 2][Math.floor(time / 110) % 4]
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
          c.fillStyle = "#e1f4df80";
          c.fillRect(
            tx * 16 + ((Math.floor(time / 450) + ty * 3) % 12),
            ty * 16 + 7,
            3,
            1,
          );
        }
        if (tile === "f" && (tx + ty + Math.floor(time / 1000)) % 4 === 0) {
          c.fillStyle = "#fff4d0";
          c.fillRect(tx * 16 + 4, ty * 16 + 4, 1, 2);
        }
      }
    c.restore();
    if (this.night) {
      c.fillStyle = "#20355d22";
      c.fillRect(0, 0, 320, 240);
    }
    if (visualState.hideHud) return;
    c.font = "12px VT323, monospace";
    c.save();
    c.globalAlpha = Math.max(
      0,
      Math.min(1, (this.enteredAt + 3500 - time) / 500),
    );
    const title = map.name.toUpperCase(),
      width = Math.min(290, c.measureText(title).width + 18);
    c.fillStyle = "#244c42e8";
    c.fillRect(7, 7, width, 17);
    c.fillStyle = "#a7c391";
    c.fillRect(7, 7, 2, 17);
    c.fillStyle = "#f5efcf";
    c.fillText(title, 15, 19);
    c.restore();
    const distance = (o: WorldObject) => {
      const position = visualState.npcs?.[o.id];
      return Math.hypot(
        (position?.x ?? o.x + 0.5) - x,
        (position?.y ?? o.y + 0.5) - y,
      );
    };
    const nearby = objects
      .filter(
        (o) =>
          !(o.kind === "legendary" && o.setsFlag && done.has(o.setsFlag)) &&
          distance(o) < 1.8,
      )
      .sort((a, b) => distance(a) - distance(b))[0];
    const exit = map.exits.find(
      (e) => Math.hypot(e.x + 0.5 - x, e.y + 0.5 - y) < 2,
    );
    if (nearby || exit) {
      const hint = nearby ? `A · ${nearby.name}` : `→ ${exit!.label}`,
        w = Math.min(300, c.measureText(hint).width + 16);
      c.fillStyle = "#f4edcfe8";
      c.fillRect(160 - w / 2, 218, w, 15);
      c.fillStyle = "#2b5043";
      c.fillText(hint, 168 - w / 2, 229);
    }
  }
}
