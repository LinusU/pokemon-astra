import type { WorldMap } from "../world";

const colors: Record<string, string> = {
  i: "#98cdd8",
  P: "#716d67", B: "#6f6571", C: "#647374", T: "#815e64",
  o: "#426d82",
  "#": "#57775c",
  ".": "#ebdaa8",
  ",": "#a2c68c",
  f: "#b9c685",
  g: "#83a66b",
  "~": "#6bacae",
  r: "#987959",
  w: "#b69a73",
  d: "#ebdda9",
  ":": "#c5bd94",
  t: "#997c67",
  "=": "#c89c68",
};
/** Draw the same tile grid used for exploration and collision, with north at the top. */
export function drawFieldMap(
  canvas: HTMLCanvasElement,
  map: WorldMap,
  x: number,
  y: number,
  marker?: { x: number; y: number },
) {
  const scale = 6;
  canvas.width = map.width * scale;
  canvas.height = map.height * scale;
  const c = canvas.getContext("2d")!;
  map.tiles.forEach((row, ty) =>
    [...row].forEach((tile, tx) => {
      c.fillStyle = colors[tile] || "#9a9377";
      c.fillRect(tx * scale, ty * scale, scale, scale);
    }),
  );
  for (const e of map.exits) {
    c.fillStyle = "#354e42";
    c.fillRect(e.x * scale, e.y * scale, scale, scale);
  }
  const radius = Math.max(4, Math.round(Math.max(map.width, map.height) / 11));
  if (marker) {
    const mx = (marker.x + 0.5) * scale,
      my = (marker.y + 0.5) * scale;
    c.fillStyle = "#722e25";
    c.fillRect(mx - radius, my - radius, radius * 2, radius * 2);
    c.fillStyle = "#ffd069";
    c.fillRect(mx - radius * 0.6, my - radius * 0.6, radius * 1.2, radius * 1.2);
  }
  c.beginPath();
  c.arc(x * scale, y * scale, radius, 0, Math.PI * 2);
  c.fillStyle = "#f9f1d4";
  c.fill();
  c.lineWidth = Math.max(2, radius / 3);
  c.strokeStyle = "#263e36";
  c.stroke();
}
