import type { WorldMap } from "../world";

const colors: Record<string, string> = {
  "#": "#57775c",
  ".": "#ebdaa8",
  ",": "#a2c68c",
  f: "#b9c685",
  g: "#83a66b",
  "~": "#6bacae",
  r: "#987959",
  w: "#b69a73",
  d: "#ebdda9",
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
  if (marker) {
    const mx = (marker.x + 0.5) * scale,
      my = (marker.y + 0.5) * scale;
    c.fillStyle = "#722e25";
    c.fillRect(mx - 5, my - 5, 10, 10);
    c.fillStyle = "#ffd069";
    c.fillRect(mx - 3, my - 3, 6, 6);
  }
  c.beginPath();
  c.arc(x * scale, y * scale, 4, 0, Math.PI * 2);
  c.fillStyle = "#f9f1d4";
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = "#263e36";
  c.stroke();
}
