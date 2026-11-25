// These effects occupy the battlefield canvas, including the space around both sprites.
import { battleGlyph } from "./battle-glyphs";
import { colors, type MoveVisual } from "./move-visuals";

export type Point = { x: number; y: number };
const TAU = 2 * Math.PI;
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const swell = (v: number) => Math.sin(Math.PI * clamp(v));
const smooth = (v: number) => clamp(v) ** 2 * (3 - 2 * clamp(v));

export function drawSurf(ctx: CanvasRenderingContext2D, t: number, rightward: boolean) {
  const { width, height } = ctx.canvas;
  ctx.save();
  if (!rightward) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  // The swell reaches the far top corner, holds, then drains back below both platforms.
  const tide = smooth(t / .48) * (1 - smooth((t - .64) / .36));
  const waterline = (x: number) => height + 20 - (height + 58) * tide
    + (x / width - .5) * 42 * swell(t) + Math.sin(x / 26 - t * 14) * 6
    + Math.sin(x / 11 - t * 21) * 2;
  const palette = ["#b9f8f5", "#59cddf", "#319fce", "#266faa"];
  for (const [layer, shade] of palette.entries()) {
    ctx.beginPath();
    const depth = [0, 3, 10, 24][layer];
    for (let x = 0; x <= width + 4; x += 4) {
      const y = Math.round(waterline(x) + depth + layer * Math.sin(x / 19 - t * 15));
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(width + 4, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.globalAlpha = layer === 0 ? .68 : .46;
    ctx.fillStyle = shade;
    ctx.fill();
    // Confine submerged details to the silhouette of the first (foam) layer.
    if (layer === 0) ctx.clip();
  }
  for (let i = 0; i < 62; i++) {
    const x = (i * 73 + t * (i % 2 ? 105 : 76)) % (width + 36) - 18;
    const y = (i * 37) % height + Math.sin(i + t * 8) * 3;
    ctx.globalAlpha = (.38 + .16 * Math.sin(i + t * 10)) * swell(t);
    ctx.strokeStyle = i % 4 === 0 ? "#e2ffff" : "#99ecf5";
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 2);
    ctx.lineTo(x + 10 + i % 8, y + 1);
    ctx.lineTo(x + 13 + i % 8, y - 1);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDischarge(
  ctx: CanvasRenderingContext2D, visual: MoveVisual, at: Point, t: number, miss: boolean, reduced: boolean,
) {
  const { width, height } = ctx.canvas;
  const total = visual.count ?? 1;
  const scale = visual.scale ?? 1;
  const charge = swell(t / .43);
  const discharge = clamp((t - .33) / .67);
  const [light, gold, ink] = colors.gold;
  ctx.save();
  if (!reduced) {
    ctx.fillStyle = "#343451";
    ctx.globalAlpha = charge * (total > 1 ? .22 : .12);
    ctx.fillRect(0, 0, width, height);
    // One soft field-wide pulse at contact, including at accelerated battle speeds.
    ctx.fillStyle = "#fff5bc";
    ctx.globalAlpha = swell((t - .35) / .28) * (total > 1 ? .30 : .22);
    ctx.fillRect(0, 0, width, height);
  }
  ctx.globalAlpha = charge;
  battleGlyph(ctx, "orb", "gold", at.x, at.y, 9 + charge * 12 * scale, t);
  for (let i = 0; i < total; i++) {
    const f = clamp((t - .22 - i * .065) / .37);
    if (f <= 0 || f >= 1) continue;
    const x0 = at.x + (i - (total - 1) / 2) * 25 - 9;
    const y0 = total > 1 ? -5 : at.y - height * .34;
    ctx.globalAlpha = Math.min(1, swell(f) * 2);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let j = 1; j <= 8; j++) {
      const h = Math.min(j / 8, f * 2.5);
      const bend = j === 8 ? 0 : (j % 2 ? 1 : -1) * (4 + (j * 7 + i * 2) % 9);
      ctx.lineTo(x0 + (at.x - x0) * h + bend, y0 + (at.y - y0) * h);
      if (h === f * 2.5) break;
    }
    ctx.lineJoin = "miter";
    for (const [color, weight] of [[ink, 5.5], [gold, 3.7], [light, 1.6]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = weight * scale;
      ctx.stroke();
    }
  }
  if (!miss && discharge > 0) {
    const radius = (9 + 24 * discharge) * scale;
    for (let i = 0; i < 5 + total; i++) {
      const a = i * TAU / (5 + total) + discharge * .64;
      ctx.globalAlpha = swell(discharge);
      battleGlyph(ctx, "bolt", "gold", at.x + Math.cos(a) * radius,
        at.y + Math.sin(a) * radius * .82, (13 - 6 * discharge) * scale, t, a - Math.PI / 2);
    }
    ctx.globalAlpha = swell(discharge * 1.65);
    battleGlyph(ctx, "spark", "gold", at.x, at.y, 25 * scale, t);
  }
  ctx.restore();
}

export function drawWeather(ctx: CanvasRenderingContext2D, visual: MoveVisual, t: number, direction: number) {
  const { width, height } = ctx.canvas;
  const { motif, palette, count = 18 } = visual;
  const [light, fill, ink] = colors[palette];
  const envelope = swell(t);
  ctx.save();
  ctx.globalAlpha = .24 * envelope;
  ctx.fillStyle = motif === "drop" ? ink : fill;
  ctx.fillRect(0, 0, width, height);
  if (motif === "sun") {
    const x = width * .68, y = height * .15;
    ctx.fillStyle = light;
    for (let i = 0; i < 8; i++) {
      const angle = i * TAU / 8 + t * .22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (const a of [angle - .09, angle + .09])
        ctx.lineTo(x + Math.cos(a) * width, y + Math.sin(a) * width);
      ctx.fill();
    }
    ctx.globalAlpha = envelope;
    battleGlyph(ctx, motif, palette, x, y, 39, t);
  } else {
    for (let i = 0; i < count; i++) {
      const depth = .65 + (i % 3) * .23;
      const wind = motif === "drop" ? -40 : motif === "note" ? 14 : 150;
      const fall = motif === "drop" ? height * 1.6 : motif === "ice" ? 46 : motif === "note" ? -42 : 9;
      const span = width + 48;
      const x = ((i * 71 + span + t * wind * direction * depth) % span) - 24;
      const y = ((i * 47 + height + 32 + t * fall * depth) % (height + 32)) - 16;
      ctx.globalAlpha = envelope * (.6 + .22 * depth);
      if (motif === "drop") {
        ctx.strokeStyle = light;
        ctx.lineWidth = depth * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2.5 * direction, y + depth * 12);
        ctx.stroke();
        // Surface ripples answer the falling streaks at staggered depths.
        if (i % 4 === 0) {
          const ripple = (t * 2 + i / count) % 1;
          ctx.globalAlpha *= 1 - ripple;
          ctx.beginPath();
          ctx.ellipse(x, height * (.64 + i / count * .34), 2 + ripple * 10, 1 + ripple * 2, 0, 0, TAU);
          ctx.stroke();
        }
      } else if (motif === "cloud") {
        // Broad fog banks for Haze, windblown grains for Sandstorm.
        const fog = palette === "dark";
        ctx.globalAlpha *= fog ? .42 : .88;
        ctx.fillStyle = i % 3 ? fill : ink;
        ctx.beginPath();
        ctx.ellipse(x, y, (fog ? 41 : 4.5) * depth, (fog ? 8 : 1.4) * depth, 0, 0, TAU);
        ctx.fill();
      } else {
        battleGlyph(ctx, motif, palette, x, y + Math.sin(i + t * 7) * 5,
          depth * (motif === "note" ? 20 : 15), t, motif === "ice" ? t * 2 + i : Math.sin(t * 5 + i) * .23);
      }
    }
  }
  ctx.restore();
}

/** The split follows the ground plane between the two Pokémon's feet. */
export function drawFault(ctx: CanvasRenderingContext2D, from: Point, to: Point, t: number, wide: boolean) {
  const { width, height } = ctx.canvas;
  const direction = Math.sign(to.x - from.x);
  const start = wide ? from.x - direction * width * .30 : from.x;
  const end = to.x + direction * width * (wide ? .27 : .09);
  const foot = (p: Point) => Math.min(height - 2, p.y + height * (p.y > height * .6 ? .27 : .20));
  const progress = clamp(t / .48);
  const opening = swell(t) * (wide ? 4 : 10);
  const edge: Point[] = [];
  for (let i = 0; i <= 22; i++) {
    const f = Math.min(i / 22, progress);
    const x = start + (end - start) * f;
    const y = foot(from) + (foot(to) - foot(from)) * (x - from.x) / (to.x - from.x || 1)
      + Math.sin(i * 2.3) * 3 + Math.sin(i * 4.8) * 2;
    edge.push({ x, y });
    if (f === progress) break;
  }
  ctx.save();
  ctx.globalAlpha = Math.min(1, swell(t) * 3);
  ctx.beginPath();
  for (const [i, p] of edge.entries()) {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  for (let i = edge.length - 1; i >= 0; i--) {
    const p = edge[i];
    const gap = opening * Math.sin(i / (edge.length - 1 || 1) * Math.PI);
    ctx.lineTo(p.x, p.y + gap * (1 + .35 * Math.sin(i * 2.5)));
  }
  ctx.closePath();
  ctx.fillStyle = "#453942";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#a58563";
  ctx.stroke();
  for (let i = 3; i < edge.length - 1; i += 4) {
    const p = edge[i], side = i % 8 === 3 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + opening * .45);
    ctx.lineTo(p.x + 5 * direction, p.y + opening * side * 1.7);
    ctx.lineTo(p.x + 15 * direction, p.y + opening * side * 2.2);
    ctx.strokeStyle = "#634e47";
    ctx.stroke();
    const bounce = swell((t - i / 55) / .53);
    if (bounce > .01)
      battleGlyph(ctx, "rock", "earth", p.x + side * bounce * 7, p.y - bounce * (14 + i % 8), 6 + i % 4, t, side * t * 4);
  }
  ctx.restore();
}
