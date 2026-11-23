import { setMenuController } from "./menu-controller";
import { bearings, type directions } from "../game/journal";
import { exitOpen, fieldActions } from "../game/navigation";
import { PALETTES } from "../game/field-palette";
import type { Save } from "../game/save";
import { trailPalette } from "../world/atlas";
import { WORLD, type Exit, type Requirement, type WorldMap } from "../world";
import { escapeHtml, panel } from "./shell";
import "./field-map.css";

type Pin = { x: number; y: number };
type Stop = {
  kind: "Journal" | "Landmark" | "Center" | "Mart" | "Gym" | "Exit";
  name: string;
  note: string;
  pin?: Pin;
  gate?: "Closed" | "Clearable";
};
type Goal = ReturnType<typeof directions>;
type Access = (requirement?: Requirement) => boolean;

function exitStop(map: WorldMap, exit: Exit, save: Save, has: Access): Stop {
  const destination = WORLD[exit.to];
  const stop: Stop = { kind: "Exit", name: destination.name, pin: exit, note: "" };
  if (exit.to.endsWith("_center")) {
    stop.kind = "Center";
    stop.name = "Pokémon Center";
    stop.note = "Heal your team or use the storage PC.";
  } else if (exit.to.endsWith("_mart")) {
    stop.kind = "Mart";
    stop.name = "Poké Mart";
    stop.note = "Stock up on supplies.";
  } else if (destination.kind === "gym") {
    stop.kind = "Gym";
  } else if (map.kind === "dungeon" && exit.to.split("_")[0] === map.id.split("_")[0]) {
    stop.name = destination.name.split(" · ").at(-1)!;
  }

  if (!exitOpen(exit, has, save.flags)) {
    const tool = exit.barrier?.flag && has(exit.requires) && fieldActions[exit.barrier.kind];
    stop.gate = tool ? "Clearable" : "Closed";
    stop.note = tool ? tool[1] + " at the crossing." : exit.lockedDialogue || "This way is closed.";
  }
  return stop;
}

export function localStops(map: WorldMap, save: Save, goal: Goal, has: Access): Stop[] {
  const stops: Stop[] = [{ kind: "Journal", name: goal.title, note: goal.hint, pin: goal.marker }];
  const sign = map.objects.find(o => o.id === "sign_" + map.id);
  if (sign) stops.push({ kind: "Landmark", name: sign.name, note: "", pin: sign });
  for (const exit of map.exits) stops.push(exitStop(map, exit, save, has));
  return stops;
}

const cell = 6;
const margin = 10;
const glyphs = {
  Journal: ["...X...", "...X...", "..XOX..", "XXOOOXX", "..XOX..", "...X...", "...X..."],
  Landmark: ["..XXX..", ".XOOOX.", "XOOOOOX", ".XOOOX.", "..XXX.."],
  Exit: ["XXXXX", "XOOOX", "XOOOX", "XOOOX", "XX.XX"],
  Center: [".XXXXX.", "XXOOOXX", "XOOOOOX", "XXXOXXX", "XOOXOOX", ".XXXXX."],
  Mart: [".XXXXX.", "XOXOXOX", "XXXXXXX", ".XOOOX.", ".XOOXX.", ".XXXXX."],
  Gym: ["X..X..X", "XXOXOXX", ".XOOOX.", "..XOX..", "...X..."],
  You: ["..XXX..", ".XOOOX.", "XOOOOOX", "XXXXXXX", ".XOOOX.", "..XOX..", "...X..."],
};
const pinColors = { Journal: "#ffda74", Landmark: "#94cdac", Exit: "#e9eace", Center: "#ed9c83", Mart: "#99cfdd", Gym: "#c6aed6", You: "#ef9b78" };
const fixedTiles: Record<string, string> = {
  B: "#85735c", C: "#847e70", T: "#aa8669", S: "#697c80", P: "#638367",
  i: "#a5d5df", o: "#496d83", "=": "#bb9670", t: "#937963", a: "#c69f7a", b: "#c2b58b",
};

function terrain(map: WorldMap) {
  const base = document.createElement("canvas");
  base.width = map.width * cell + margin * 2;
  base.height = map.height * cell + margin * 2;
  const c = base.getContext("2d")!;
  c.translate(margin, margin);
  const tileColors: Record<string, Record<string, string>> = {};
  const indoor = map.kind === "gym" || map.kind === "interior";
  const roofColors = new Map<number, string>();
  if (map.kind === "town") for (const door of map.exits) {
    if (!door.to.endsWith("_center") && !door.to.endsWith("_mart")) continue;
    const ink = door.to.endsWith("_center") ? "#b67570" : "#6593ad";
    for (let y = door.y - 1; map.tiles[y]?.[door.x] === "r"; y--) {
      for (let x = door.x; map.tiles[y][x] === "r"; x++) roofColors.set(y * map.width + x, ink);
      for (let x = door.x - 1; map.tiles[y][x] === "r"; x--) roofColors.set(y * map.width + x, ink);
    }
  }
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const biome = map.kind === "route" ? trailPalette(map.id, x, y, map.palette) : map.palette;
    const p = PALETTES[biome] ?? PALETTES.meadow;
    const tile = map.tiles[y][x], px = x * cell, py = y * cell;
    const colors = tileColors[biome] ??= {
      ...fixedTiles, "#": indoor ? p.ink : p.shade, "~": p.water, r: p.roof, w: p.wall, d: p.wall,
      g: p.shade, ",": p.grass, f: p.grass, ":": "#d7c9a2", "+": "#dbbf99", "*": "#d2b183",
    };
    c.fillStyle = roofColors.get(y * map.width + x) ?? colors[tile] ?? p.path;
    c.fillRect(px, py, cell, cell);
    if (tile === "#" && map.tiles[y + 1]?.[x] !== "#") {
      c.fillStyle = p.ink;
      c.fillRect(px, py + cell - 1, cell, 1);
    } else if (tile === "#" && !indoor && (x + 3 * y) % 7 === 0) {
      c.fillStyle = p.ink + "64";
      c.fillRect(px + 2, py + 1, 1, 1);
      c.fillRect(px + 1, py + 2, 3, 1);
    } else if (tile === "r") {
      c.fillStyle = "#ffffff46";
      c.fillRect(px, py + 1, cell, 1);
      if (map.tiles[y - 1]?.[x] !== "r") {
        c.fillStyle = p.ink; c.fillRect(px, py, cell, 1);
      }
    } else if (tile === "g") {
      c.fillStyle = p.ink;
      c.fillRect(px + 1, py + 2, 1, 2);
      c.fillRect(px + 3, py + 3, 1, 1);
    } else if ((x + 2 * y) % 4 === 0 && (tile === "~" || tile === "o" || tile === "f")) {
      c.fillStyle = "#f8f3cb91";
      c.fillRect(px + 1, py + 3, tile === "f" ? 1 : 3, 1);
    }
  }
  c.strokeStyle = "#495f57"; c.lineWidth = 2;
  c.strokeRect(-1, -1, map.width * cell + 2, map.height * cell + 2);
  return base;
}

export function mountFieldMap(layer: HTMLElement, map: WorldMap, save: Save, goal: Goal, has: Access, back: () => void, fly: () => void) {
  const stops = localStops(map, save, goal, has);
  const root = panel(layer, map.name, `<header class="atlas-header"><h2>${escapeHtml(map.name)}</h2><div class="field-key"><span><i class="field-you"></i>You</span><span><i class="field-journal">✦</i>Journal</span><span><i class="field-exit"></i>Exit</span></div></header>
    <div class="field-paper"><span class="field-north" aria-hidden="true">▲<br>N</span><canvas class="field-map" role="img"></canvas></div>
    <div class="field-readout"><button data-map-step="-1" aria-label="Previous map entry">◀</button><div data-map-note aria-live="polite"><small></small><strong></strong><span></span></div><button data-map-step="1" aria-label="Next map entry">▶</button></div>
    <footer class="atlas-keys" aria-label="Map controls"><span><kbd>◂ ▸</kbd> Places</span>${save.abilities.includes("fly") ? '<button data-fly><kbd>A</kbd> Fly</button>' : ""}<button id="back"><kbd>B</kbd> Region</button></footer>`, "atlas-screen local-sheet");
  const canvas = root.querySelector<HTMLCanvasElement>(".field-map")!;
  const base = terrain(map), c = canvas.getContext("2d")!;
  canvas.width = base.width; canvas.height = base.height;
  canvas.style.aspectRatio = base.width + " / " + base.height;
  const paper = root.querySelector<HTMLElement>(".field-paper")!;
  paper.style.setProperty("--chart-aspect", String(base.width / base.height));
  let index = 0;
  const center = (p: Pin) => [margin + (p.x + 0.5) * cell, margin + (p.y + 0.5) * cell];
  function draw() {
    const selected = stops[index];
    const pixel = Math.max(1, Math.round(Math.max(base.width / 260, base.height / 156)));
    c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(base, 0, 0);
    function pin(kind: keyof typeof glyphs, point: Pin, closed = false) {
      const [x, y] = center(point), rows = glyphs[kind];
      const left = Math.round(x - rows[0].length * pixel / 2), top = Math.round(y - rows.length * pixel / 2);
      for (const [row, line] of rows.entries()) for (let col = 0; col < line.length; col++) {
        if (line[col] === ".") continue;
        c.fillStyle = line[col] === "X" ? "#344d4b" : closed ? "#bc8d85" : pinColors[kind];
        c.fillRect(left + col * pixel, top + row * pixel, pixel, pixel);
      }
    }
    for (const stop of stops.slice(1)) if (stop.pin) pin(stop.kind, stop.pin, !!stop.gate);
    if (goal.marker) pin("Journal", goal.marker);
    pin("You", {x: save.x - 0.5, y: save.y - 0.5});
    if (selected.pin) {
      const [x, y] = center(selected.pin).map(Math.round);
      const d = pixel * 5;
      c.fillStyle = "#763f3a";
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        c.fillRect(x + dx * d - (dx > 0 ? 2 * pixel : 0), y + dy * d, 3 * pixel, pixel);
        c.fillRect(x + dx * d, y + dy * d - (dy > 0 ? 2 * pixel : 0), pixel, 3 * pixel);
      }
    }
    const where = selected.pin ? bearings(save.x, save.y, selected.pin) : "";
    root.querySelector(".field-readout small")!.textContent = [selected.kind, selected.gate, selected.kind === "Journal" ? "" : where].filter(Boolean).join(" · ");
    root.querySelector(".field-readout strong")!.textContent = selected.name;
    root.querySelector(".field-readout span")!.textContent = selected.note;
    root.querySelector<HTMLElement>("[data-map-note]")!.scrollTop = 0;
    canvas.setAttribute("aria-label", `${map.name}. ${selected.name}${where ? ", " + where : ""}.`);
  }
  canvas.onclick = event => {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * base.width / bounds.width;
    const y = (event.clientY - bounds.top) * base.height / bounds.height;
    let best = Math.max(cell, 10 * base.width / bounds.width);
    for (const [i, stop] of stops.entries()) if (stop.pin) {
      const [px, py] = center(stop.pin), d = Math.hypot(px - x, py - y);
      if (d < best) { best = d; index = i; }
    }
    draw();
  };
  const step = (offset: number) => { index = (index + offset + stops.length) % stops.length; draw(); };
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-map-step]"))
    button.onclick = () => step(Number(button.dataset.mapStep));
  root.querySelector<HTMLButtonElement>("#back")!.onclick = back;
  root.querySelector<HTMLButtonElement>("[data-fly]")?.addEventListener("click", fly);
  // The pad turns the entries and reads a long note; nothing on this sheet needs a cursor.
  setMenuController(root, action => {
    if (action === "left" || action === "right") return step(action === "left" ? -1 : 1);
    if (action === "a") return void root.querySelector<HTMLButtonElement>("[data-fly]")?.click();
    const note = root.querySelector<HTMLElement>("[data-map-note]")!;
    note.scrollTop += (action === "down" ? 1 : -1) * Math.max(18, note.clientHeight / 2);
  });
  draw();
}
