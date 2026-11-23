import { escapeHtml } from "./shell";
import type { Action } from "../game/input";
import "./cartridge-map.css";

type Region = "Johto" | "Kanto";
export interface MapSpot {
  id: number;
  name: string;
  region: Region;
  x: number;
  y: number;
}
export interface MapSheet {
  region: Region;
  spots: MapSpot[];
  draw(canvas: HTMLCanvasElement): void;
}
export type MapPurpose = { kind: "browse" } | { kind: "fly"; destinations: number[] } | { kind: "area"; species: number };
type Color = [number, number, number];

/** Mix the cartridge's RGB555 primaries as on a reflective color LCD. */
export function mapInk(word: number): Color {
  const r = (word & 31) / 31, g = ((word >> 5) & 31) / 31, b = ((word >> 10) & 31) / 31;
  return [
    24 + 222 * Math.pow(.65 * r + .23 * g + .12 * b, .8),
    38 + 202 * Math.pow(.14 * r + .65 * g + .21 * b, .8),
    40 + 180 * Math.pow(.12 * r + .21 * g + .67 * b, .8),
  ];
}

/** Both handhelds use a 20 by 18 tile screen and two bitplanes per tile. */
export function paintMap(canvas: HTMLCanvasElement, layout: Uint8Array, tiles: Uint8Array, palettes: Color[][], slot: (tile: number) => number) {
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(160, 144);
  for (let i = 0; i < 360; i++) {
    const tile = layout[i], colors = palettes[slot(tile)];
    for (let y = 0; y < 8; y++) {
      const at = tile * 16 + y * 2;
      for (let x = 0; x < 8; x++) {
        const bit = 7 - x, ink = ((tiles[at] >> bit) & 1) | (((tiles[at + 1] >> bit) & 1) << 1);
        const pixel = ((Math.floor(i / 20) * 8 + y) * 160 + i % 20 * 8 + x) * 4;
        image.data.set(colors[ink], pixel);
        image.data[pixel + 3] = 255;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

type MapControl = Extract<Action, "left" | "right" | "up" | "down" | "a">;
const controllers = new WeakMap<Element, { input: (action: MapControl) => void }>();
export function cartridgeMapController(layer: HTMLElement) {
  const map = layer.querySelector(".cartridge-map");
  return map ? controllers.get(map) : undefined;
}

export function showCartridgeMap(layer: HTMLElement, sheets: MapSheet[], here: MapSpot | undefined, purpose: MapPurpose, title: string): Promise<number | undefined> {
  const previous = document.activeElement;
  const host = document.createElement("div");
  host.className = "cartridge-map-overlay";
  host.innerHTML = `<section class="cartridge-map" tabindex="-1" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
    <header><h2></h2><span>${escapeHtml(title)}</span></header>
    <div class="cm-chart"><div class="cm-paper"><div class="cm-viewport"><canvas width="160" height="144" role="img"></canvas><div class="cm-pins" aria-hidden="true"></div></div></div></div>
    <div class="cm-selection" role="status"><div><small></small><strong></strong></div><div class="cm-position"><span class="cm-count"></span><span class="cm-here"></span></div></div>
    <footer aria-label="Map controls"><span class="cm-browse"><kbd>◂ ▸</kbd> Places</span>
      <button data-input="up"><kbd>↑</kbd> Region</button><button data-input="down"><kbd>↓</kbd> <span></span></button>
      <button data-input="a"><kbd>A</kbd> <span></span></button><button id="back"><kbd>B</kbd> Back</button></footer></section>`;
  const panel = host.querySelector<HTMLElement>(".cartridge-map")!;
  const get = <T extends HTMLElement>(selector: string) => panel.querySelector<T>(selector)!;
  const canvas = get<HTMLCanvasElement>("canvas"), pins = get(".cm-pins"), viewport = get(".cm-viewport");
  const up = get<HTMLButtonElement>('[data-input="up"]');
  const down = get<HTMLButtonElement>('[data-input="down"]');
  const confirm = get<HTMLButtonElement>('[data-input="a"]');
  const home = sheets.find(s => s.region === here?.region);
  const homeIndex = home?.spots.findIndex(p => p.id === here?.id) ?? -1;
  const flying = purpose.kind === "fly";
  let sheet = home ?? sheets[0];
  const indices = new Map<Region, number>();
  const index = () => indices.get(sheet.region) ?? Math.max(0, sheet.spots.findIndex(p => p.id === here?.id));
  const selected = () => sheet.spots[index()];
  up.hidden = sheets.length < 2;
  down.hidden = !flying && (purpose.kind !== "browse" || homeIndex < 0);
  get(".cm-here").textContent = here ? `You: ${here.name}` : "";
  layer.append(host);
  // Suspend the underlying menu until the map closes.
  const underneath = [...layer.children].filter((n): n is HTMLElement => n instanceof HTMLElement && n !== host && !n.inert);
  underneath.forEach(n => { n.inert = true; });
  return new Promise(resolve => {
    const close = (id?: number) => {
      host.remove();
      underneath.forEach(n => { n.inert = false; });
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
      resolve(id);
    };
    const mark = (p: MapSpot, style: string) => {
      const pin = document.createElement("i");
      pin.className = style;
      pin.style.left = `${p.x / 160 * 100}%`;
      pin.style.top = `${p.y / 144 * 100}%`;
      pins.append(pin);
    };
    let magnified = false;
    const frame = () => {
      const center = selected() ?? (here?.region === sheet.region ? here : undefined);
      const left = Math.max(0, Math.min(80, (center?.x ?? 80) - 40));
      const top = Math.max(0, Math.min(72, (center?.y ?? 72) - 36));
      viewport.style.transform = magnified ? `scale(2) translate(${-left / 160 * 100}%, ${-top / 144 * 100}%)` : "";
      const zoomLabel = magnified ? "Zoom out" : "Zoom in";
      down.querySelector("span")!.textContent = flying ? zoomLabel : "Locate me";
      confirm.querySelector("span")!.textContent = flying ? "Fly" : zoomLabel;
    };
    const select = (n: number) => {
      indices.set(sheet.region, n);
      const spot = selected();
      pins.replaceChildren();
      if (purpose.kind !== "browse") sheet.spots.forEach(p => mark(p, "cm-site"));
      if (here?.region === sheet.region) mark(here, "cm-player");
      if (spot) mark(spot, "cm-cursor");
      const kind = spot?.name.match(/^(Route) | (City|Town|Island)$/i);
      get(".cm-selection small").textContent = flying ? "Destination" : purpose.kind === "area" ? "Habitat" : kind?.[1] ?? kind?.[2] ?? "Landmark";
      get(".cm-selection strong").textContent = spot?.name ?? "Area unknown";
      get(".cm-count").textContent = spot ? `${n + 1} / ${sheet.spots.length}` : "";
      get(".cm-browse").hidden = sheet.spots.length < 2;
      confirm.disabled = flying && !spot;
      frame();
    };
    const show = (next: MapSheet) => {
      sheet = next;
      sheet.draw(canvas);
      canvas.setAttribute("aria-label", `${sheet.region} region map`);
      get("h2").textContent = sheet.region;
      select(index());
    };
    function input(action: MapControl) {
      switch (action) {
        case "left":
        case "right": {
          const count = sheet.spots.length;
          if (count > 1) select((index() + (action === "left" ? -1 : 1) + count) % count);
          return;
        }
        case "up":
          if (!up.hidden) show(sheets[(sheets.indexOf(sheet) + 1) % sheets.length]);
          return;
        case "down":
          if (down.hidden) return;
          if (!flying && home) {
            indices.set(home.region, homeIndex);
            show(home);
            return;
          }
          break;
        case "a":
          if (flying) {
            const destination = selected();
            if (destination) close(destination.id);
            return;
          }
          break;
      }
      magnified = !magnified;
      frame();
    }
    for (const b of panel.querySelectorAll<HTMLButtonElement>("[data-input]"))
      b.onclick = () => input(b.dataset.input as MapControl);
    controllers.set(panel, { input });
    canvas.onclick = event => {
      const box = canvas.getBoundingClientRect();
      const x = (event.clientX - box.left) * 160 / box.width, y = (event.clientY - box.top) * 144 / box.height;
      const hits = sheet.spots.map((p, i) => ({ i, distance: Math.hypot(p.x - x, p.y - y) }))
        .filter(h => h.distance <= 8).sort((a, b) => a.distance - b.distance);
      if (!hits.length) return;
      const tied = hits.filter(h => h.distance === hits[0].distance);
      select(tied[(tied.findIndex(h => h.i === index()) + 1) % tied.length].i);
    };
    get<HTMLButtonElement>("#back").onclick = () => close();
    show(sheet);
    panel.focus({ preventScroll: true });
  });
}
