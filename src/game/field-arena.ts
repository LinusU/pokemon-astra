type FieldColors = { grass: string; shade: string; path: string; ink: string; water: string };
const backdrops = new Map<string, string>();

/** A low horizon keeps the opponent and its HP distinct from the scenery. */
export function fieldArena(region: string, colors: FieldColors, fishing: boolean, night: boolean) {
  const key = `${region}/${fishing}/${night}`;
  const cached = backdrops.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext("2d")!;
  function rect(color: string, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  const water = fishing || region === "coast" || region === "wetland";
  const peak = ["mountain", "snow", "volcanic"].includes(region);
  const sand = region === "desert";
  const sky = night ? "#647998" : sand ? "#f0d4a3" : "#bbd8d3";
  rect(sky, 0, 0, 160, 90);
  rect(night ? "#92a1ad" : "#deebd4", 0, 22, 160, 18);
  if (night) {
    for (let i = 1; i <= 20; i++) rect("#e2e1bd", i * 37 % 160, i * i % 21, 1, 1);
    rect("#f8e7ba", 96, 7, 5, 5);
    rect(sky, 98, 6, 4, 4);
  } else {
    for (const [x, y] of [[18, 8], [85, 14], [139, 5]]) {
      rect("#eaf0d9", x, y, 10, 2);
      rect("#eaf0d9", x - 3, y + 2, 19, 2);
    }
  }
  for (let x = 0; x < 160; x++) {
    const ridge = peak
      ? 12 + Math.round(Math.min(Math.abs(x - 30), Math.abs(x - 85), Math.abs(x - 144)) * 0.78)
      : 28 + Math.round(4 * Math.sin(x / 17) + 2 * Math.sin(x / 29));
    rect(colors.shade, x, ridge, 1, 43 - ridge);
    if (region === "snow" && ridge < 21) rect("#e6f0e6", x, ridge, 1, 21 - ridge + x % 3);
  }
  if (!peak && !sand && !water) {
    for (let x = -4; x < 160; x += 7) {
      const y = 29 + Math.round(3 * Math.cos(x / 13));
      rect(colors.ink, x + 2, y, 3, 11);
      rect(colors.ink, x, y + 3, 7, 7);
      rect(colors.shade, x + 1, y + 2, 3, 2);
    }
  }
  rect(water ? colors.water : colors.grass, 0, 40, 160, 50);
  for (let i = 0; i < 45; i++) {
    const x = (i * 47 + 11) % 160, y = 42 + (i * 13 % 46);
    if (water) rect("#d8ece2aa", x, y, 2 + i % 6, 1);
    else {
      rect(colors.shade, x, y, 2 + i % 3, 1);
      if (!sand && !peak) rect(i % 4 ? colors.shade : "#efe4ac", x + 1, y - 1, 1, 1);
    }
  }
  // Shallow, stepped banks anchor the sprites to their actual battle positions.
  for (const [cx, cy, rx, ry] of [[125, 48, 29, 4], [39, 89, 43, 7]]) {
    for (let y = -ry; y <= ry; y++) {
      const width = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2));
      rect(y >= ry - 1 ? colors.shade : colors.path, cx - width, cy + y, width * 2 + 1, 1);
    }
  }
  if (night) rect("#24335458", 0, 23, 160, 67);
  const url = canvas.toDataURL();
  backdrops.set(key, url);
  return url;
}
