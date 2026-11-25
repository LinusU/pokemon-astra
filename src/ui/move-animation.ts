import { moveSpriteFrames } from "./move-sprite-motion";
import { drawDischarge, drawFault, drawSurf, drawWeather, type Point } from "./battle-field-effects";
import { battleGlyph } from "./battle-glyphs";
import { colors, type MoveVisual } from "./move-visuals";

const TAU = Math.PI * 2;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const between = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const offset = (p: Point, x: number, y: number): Point => ({ x: p.x + x, y: p.y + y });
const peak = (t: number) => Math.sin(Math.PI * clamp(t));
const angleOf = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);

// Shared by the canvas impact, its fragments and the defender's flinch.
function contactTime(visual: MoveVisual) {
  switch (visual.pattern) {
    case "arc": case "shot": return .64;
    case "boomerang": return .5;
    case "fall": case "ground": case "triad": case "toss": return .57;
    case "beam": case "vortex": return .29;
    case "column": return .48;
    case "spectrum": return .52;
    case "flood": case "inferno": return .48;
    case "link": case "rise": return .62;
    default: return .38;
  }
}

export function drawMove(
  ctx: CanvasRenderingContext2D,
  visual: MoveVisual,
  from: Point,
  opponent: Point,
  t: number,
  miss: boolean,
  param: number,
  reduced = false,
) {
  const { width, height } = ctx.canvas;
  const at = visual.anchor === "field" ? { x: width / 2, y: height / 2 }
    : visual.anchor === "user" ? from : opponent;
  const [light, fill, ink] = colors[visual.palette];
  const size = (visual.scale ?? 1) * 26;
  const count = visual.count ?? 1;
  const along = angleOf(from, at);
  const end = miss ? offset(between(from, at, 1.2), 0, -20) : at;
  const direction = opponent.x >= from.x ? 1 : -1;
  const impact = contactTime(visual);
  const glyph = (p: Point, scale: number, opacity = 1, angle = 0, motif = visual.motif) => {
    ctx.globalAlpha = clamp(opacity);
    battleGlyph(ctx, motif, visual.palette, p.x, p.y, size * scale, t, angle);
  };

  if (visual.wash && !reduced) {
    const glow = visual.wash === "light";
    ctx.fillStyle = glow ? light : ink;
    ctx.globalAlpha = glow ? .26 * peak((t - .20) / .63) : .22 * peak(t);
    ctx.fillRect(0, 0, width, height);
  }
  switch (visual.pattern) {
    case "gesture": {
      const beat = Math.sin(t * TAU * (visual.count ?? 2));
      const hand = visual.motif === "hand";
      const center = offset(at, 0, -size * (visual.anchor === "user" ? .6 : .16));
      glyph(center, 1 + Math.abs(beat) * .13, Math.min(1, peak(t) * 2), beat * (hand ? .54 : .15));
      if (visual.motif === "drum") {
        for (const side of [-1, 1])
          glyph(offset(center, side * size * .56, -size * (.25 + side * beat * .2)), .49, peak(t), side * .64, "hand");
      }
      break;
    }
    case "toss": {
      if (miss) break;
      const air = clamp(t / impact);
      const land = clamp((t - impact) / (1 - impact));
      glyph(offset(at, -direction * size * .35, -peak(air) * size * .76), .85, peak(air), direction * air);
      const y = Math.min(height - 3, at.y + height * .18);
      ctx.globalAlpha = peak(land);
      ctx.lineWidth = 3 - land * 2;
      ctx.strokeStyle = fill;
      ctx.beginPath();
      ctx.ellipse(at.x, y, 2 + land * size * 1.6, 1 + land * 10, 0, 0, TAU);
      ctx.stroke();
      glyph(at, 1.15, peak(land), 0, "spark");
      break;
    }
    case "discharge":
      drawDischarge(ctx, visual, end, t, miss, reduced);
      break;
    case "flood":
      drawSurf(ctx, t, direction > 0);
      break;
    case "weather":
      drawWeather(ctx, visual, t, direction);
      break;
    case "slice": {
      // Stagger each cut, drawing the bright cutting edge ahead of its fading scar.
      for (let i = 0; i < count; i++) {
        const f = clamp((t - .12 - i * .065) * 1.85);
        const reach = size * .81;
        const center = offset(end, (i - (count - 1) / 2) * size * .28, 0);
        const slant = param % 2 ? -direction : direction;
        const edge = clamp(f * 2.9);
        const tail = clamp((f - .3) * 1.6);
        const slashPoint = (u: number) => offset(center, slant * (1 - 2 * u) * reach,
          (2 * u - 1) * reach * .81 - peak(u) * size * .19);
        const start = slashPoint(tail), middle = slashPoint((tail + edge) / 2), tip = slashPoint(edge);
        ctx.globalAlpha = Math.min(1, peak(f) * 2);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(middle.x, middle.y - 3);
        ctx.lineTo(tip.x, tip.y);
        ctx.lineTo(middle.x + direction * 2, middle.y + 2);
        ctx.closePath();
        ctx.fillStyle = light;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fill();
        if (visual.motif === "wing" || i === 0)
          glyph(tip, visual.motif === "wing" ? .8 : .31, peak(f), along, visual.motif === "wing" ? "wing" : "glint");
      }
      break;
    }
    case "rush": {
      const dash = clamp((t - .09) / .36);
      const reach = between(from, end, dash * dash);
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 4;
        const tip = offset(reach, -direction * (i % 3) * 4, spread);
        const tail = between(from, tip, clamp(dash - .46 + (i % 2) * .14));
        ctx.globalAlpha = peak(clamp(t / .65)) * .88;
        ctx.strokeStyle = i % 2 ? fill : light;
        ctx.lineWidth = i % 2 ? 2 : 3;
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y + spread);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
      }
      glyph(reach, .6 + .4 * dash, peak(t), along);
      if (!miss) glyph(at, 1.3, peak((t - .38) / .57), 0, "spark");
      break;
    }
    case "inferno": {
      const flight = clamp(t / impact);
      const head = between(from, end, flight);
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + t * 11;
        glyph(offset(head, Math.cos(a) * 9, Math.sin(a) * 9), .52, peak(flight));
      }
      if (miss) break;
      const bloom = clamp((t - .36) / .64);
      // The five strokes of Fire Blast open from the ember at contact.
      for (const [dx, dy] of [[0, -1], [-1, -.26], [1, -.26], [-.72, .85], [.72, .85]]) {
        for (let i = 0; i < 4; i++) {
          const r = size * (i + .6) / 3 * (1 - (1 - bloom) ** 3);
          glyph(offset(at, dx * r, dy * r), .55 - i * .055, peak(bloom));
        }
      }
      break;
    }
    case "triad": {
      const travel = clamp((t - .12) / .45);
      const f = clamp((t - .53) / .47);
      const center = between(from, end, travel);
      const elements = [["fire", "red"], ["ice", "ice"], ["bolt", "gold"]] as const;
      const vertices = elements.map((_, i) => {
        const angle = -Math.PI / 2 + i * TAU / 3 + travel * TAU / 3;
        const radius = size * (.45 + peak(t) * .3 + f * .42);
        return offset(center, Math.cos(angle) * radius, Math.sin(angle) * radius);
      });
      ctx.globalAlpha = peak(t);
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (const p of vertices.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      ctx.stroke();
      elements.forEach(([motif, palette], i) => {
        const p = vertices[i];
        battleGlyph(ctx, motif, palette, p.x, p.y, size * (.46 + f * .25), t);
      });
      if (!miss) glyph(at, .8, peak(f), 0, "spark");
      break;
    }
    case "geyser": {
      const base = at.y + size * .62;
      const rise = Math.min(height * .58, size * 2.7);
      for (let i = 0; i < count; i++) {
        const f = (t * 1.5 + i / count) % 1;
        const lane = Math.sin(i * 2.4) * size * (.13 + f * .32);
        const tip = { x: at.x + lane, y: base - f * rise };
        ctx.globalAlpha = peak(t) * peak(f) * .76;
        ctx.strokeStyle = i % 2 ? light : fill;
        ctx.lineWidth = (1 - f) * 4 + 1;
        ctx.beginPath();
        ctx.moveTo(at.x + lane * .4, base);
        ctx.quadraticCurveTo(tip.x - lane * .35, tip.y + rise * .3, tip.x, tip.y);
        ctx.stroke();
        glyph(tip, (1 - f) * .43 + .22, peak(t) * peak(f));
      }
      break;
    }
    case "radiance": {
      const sky = offset(at, direction * 14, -Math.min(at.y - 12, height * .29));
      ctx.globalAlpha = peak(t) * .25;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(sky.x - 4, sky.y);
      ctx.lineTo(sky.x + 4, sky.y);
      ctx.lineTo(at.x + size, at.y + size * .6);
      ctx.lineTo(at.x - size, at.y + size * .6);
      ctx.fill();
      glyph(sky, .92, peak(t));
      for (let i = 0; i < count; i++) {
        const f = (t + i / count) % 1;
        glyph(offset(between(sky, at, f), Math.sin(i * 2.4) * f * size, 0),
          .18 + .2 * f, peak(t) * peak(f), 0, "glint");
      }
      break;
    }
    case "hit": {
      if (miss) break;
      const strike = clamp((t - .09) / .85);
      const beat = Math.min(count - 1, Math.floor(strike * count));
      const pulse = peak(strike * count - beat);
      const alternate = ((param + beat) % 2) * 2 - 1;
      const open = visual.motif === "jaw" || visual.motif === "grip";
      const p = offset(at, (count > 1 || param % 2 ? alternate * 6 : 0)
        - direction * (1 - pulse) * (open ? 0 : size * .22), count > 1 ? alternate * 4 : 0);
      const pointsAtTarget = ["horn", "tongue", "tail"].includes(visual.motif);
      const rotation = pointsAtTarget ? along : alternate * (count > 1 || param > 0 ? .26 : 0);
      glyph(p, open ? 1.2 : .55 + .65 * pulse, Math.min(1, pulse * 2.5), rotation);
      if (!visual.accent && !open && !visual.anchor) {
        for (let i = 0; i < 4; i++) {
          const a = i * TAU / 4 + .45;
          const f = clamp((t - impact) / .43);
          glyph(offset(at, Math.cos(a) * size * f, Math.sin(a) * size * f),
            .25 - .13 * f, peak(f), a, "glint");
        }
      }
      break;
    }
    case "shot":
    case "arc": {
      const travel = miss ? .78 : impact;
      for (let i = 0; i < count; i++) {
        const f = (t - 0.20 * i / count) / travel;
        if (f < 0 || f >= 1) continue;
        const p = between(from, end, f);
        const lift = visual.pattern === "arc" ? -Math.min(46, (from.y + end.y) * .33) * peak(f) : 0;
        const spread = (i - (count - 1) / 2) * 5 * peak(f);
        const directional = ["needle", "wing", "leaf", "glint", "dragon"].includes(visual.motif);
        const rotation = visual.pattern === "arc" ? f * TAU : directional ? along : 0;
        const tip = offset(p, 0, lift + spread);
        if (count <= 2) {
          const behind = Math.max(0, f - .055);
          const trail = between(from, end, behind);
          glyph(offset(trail, 0, lift + spread), .55, .35 * peak(f), rotation);
        }
        glyph(tip, count > 2 ? 0.52 + 0.18 * (i % 2) : 0.86, 1, rotation);
      }
      if (!visual.accent && !miss && t > impact) {
        const hit = clamp((t - impact) / (1 - impact));
        glyph(at, 0.65 + hit * 0.45, peak(hit), 0, "spark");
      }
      break;
    }
    case "boomerang": {
      const turnsAt = miss ? end : at;
      const f = t <= 0.5 ? t * 2 : (1 - t) * 2;
      const bend = Math.sin(t * TAU) * -27;
      glyph(offset(between(from, turnsAt, f), 0, bend), 1, Math.min(1, peak(t) * 4), t * TAU * 2);
      if (!miss) glyph(at, 0.68, clamp(1 - Math.abs(t - 0.5) * 9), 0, "spark");
      break;
    }
    case "beam": {
      const head = between(from, end, clamp(t / impact));
      const tail = between(from, end, clamp((t - .66) / .34));
      const normal = { x: -Math.sin(along), y: Math.cos(along) };
      const stream = (f: number, sway: number) => offset(between(tail, head, f), normal.x * sway, normal.y * sway);
      const { motif } = visual;
      ctx.lineCap = "round";
      if (motif === "fire" || motif === "bubble") {
        // Flamethrower widens into a plume. Bubblebeam travels in two loose strands.
        for (let i = 0; i < 28; i++) {
          const f = (i / 28 + t * 1.2) % 1;
          const sway = Math.sin(f * 15 - t * 21 + i % 2 * Math.PI) * size * (.08 + .28 * f);
          const p = stream(f, sway);
          glyph(p, .18 + f * (motif === "fire" ? .81 : .49), peak(t) * .95, motif === "fire" ? along + Math.PI / 2 : 0);
        }
      } else {
        const thickness = size * (.18 + .09 * peak(t));
        ctx.globalAlpha = Math.min(1, peak(t) * 1.4);
        for (const [color, factor] of [[ink, 1.8], [fill, 1.4], [light, .44]] as const) {
          ctx.beginPath();
          ctx.moveTo(tail.x, tail.y);
          for (let i = 1; i <= 20; i++) {
            const f = i / 20;
            const sway = motif === "drop" ? Math.sin(f * 17 - t * 24) * 2.6
              : motif === "ice" ? (i % 2 ? -1 : 1) * 2.5 : 0;
            const p = stream(f, sway * peak(f));
            ctx.lineTo(p.x, p.y);
          }
          ctx.strokeStyle = color;
          ctx.lineWidth = thickness * factor;
          ctx.stroke();
        }
        for (let i = 0; i < 7; i++) {
          const f = (i / 7 + t * 1.7) % 1;
          const p = stream(f, Math.sin(f * 12 - t * 9) * thickness * .7);
          if (motif === "drop" || motif === "wing" || motif === "glint") {
            // Pressure rings give the water jet, air cannon and Hyper Beam visible speed.
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, thickness * .29, thickness * (1 + .24 * f), along, 0, TAU);
            ctx.lineWidth = motif === "glint" ? 2.3 : 1.4;
            ctx.strokeStyle = light;
            ctx.stroke();
          } else glyph(p, .33, peak(t), along);
        }
      }
      if (!miss && t > impact) glyph(at, .7 + peak(t) * .5, peak((t - impact) / (1 - impact)), 0, "glint");
      break;
    }
    case "spectrum": {
      const head = clamp(t / impact);
      const tail = clamp((t - .63) / .37);
      const aurora = visual.motif === "ice";
      const bands = aurora ? ["teal", "ice", "lilac", "pink"] as const : ["lilac", "gold", "pink"] as const;
      for (const [i, palette] of bands.entries()) {
        ctx.globalAlpha = peak(t);
        ctx.beginPath();
        for (let j = 0; j <= 28; j++) {
          const f = tail + (head - tail) * j / 28;
          const p = between(from, end, f);
          const sway = aurora ? (i - 1.5) * 3 + Math.sin(f * 8 - t * 10) * 4
            : Math.sin(f * 18 - t * 16 + i * TAU / 3) * 9;
          const y = p.y + sway * peak(f);
          if (j === 0) ctx.moveTo(p.x, y);
          else ctx.lineTo(p.x, y);
        }
        ctx.strokeStyle = colors[palette][1];
        ctx.lineWidth = aurora ? 3.5 : 2.5;
        ctx.stroke();
      }
      if (!miss) glyph(at, .65 + peak(t) * .55, peak((t - impact) / (1 - impact)));
      break;
    }
    case "column": {
      if (miss) break;
      const f = clamp(t / impact);
      ctx.globalAlpha = peak(t) * 0.8;
      ctx.beginPath();
      ctx.moveTo(at.x, Math.max(-10, at.y - height));
      for (let i = 1; i <= 7; i++) {
        const y = -10 + (at.y + 10) * f * i / 7;
        const x = i === 7 ? at.x : at.x + Math.sin(i * 8 + param) * size * 0.29;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = fill;
      ctx.lineWidth = size * 0.46;
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.lineWidth = size * 0.14;
      ctx.stroke();
      for (let i = 0; i < count; i++)
        glyph(offset(at, (i % 2 ? -1 : 1) * size * 0.33, -height * ((i * 0.19 + 1 - f) % 1)),
          0.72, peak(t));
      glyph(at, .93, peak((t - impact) / (1 - impact)), 0, "spark");
      break;
    }
    case "orbit":
    case "link": {
      if (miss && visual.anchor !== "user") break;
      for (let i = 0; i < Math.max(count, 3); i++) {
        const turn = (t * (visual.pattern === "link" ? -0.8 : 0.8) + i / Math.max(count, 3)) * TAU;
        const center = visual.pattern === "link" ? between(at, from, clamp(t * 1.3 - i * 0.06)) : at;
        const radius = visual.pattern === "link" ? size * 0.6 * (1 - t) : size * (0.95 - t * 0.4);
        glyph(offset(center, Math.cos(turn) * radius, Math.sin(turn) * radius * 0.63),
          count === 1 ? 0.66 : 0.55, Math.min(1, peak(t) * 2), visual.motif === "wind" ? turn : 0);
      }
      break;
    }
    case "vortex": {
      if (miss && visual.anchor !== "user") break;
      const total = Math.max(count, 7);
      for (let i = 0; i < total; i++) {
        const spin = t * TAU * 1.5 + i * 2.4;
        const vertical = i / (total - 1);
        const radius = (0.42 + vertical * 1.1) * size * (0.65 + peak(t) * 0.45);
        glyph(offset(at, Math.cos(spin) * radius, 21 - vertical * 55 + Math.sin(spin) * 7),
          0.35 + 0.4 * vertical, peak(t) * (0.76 + Math.sin(spin) * 0.24),
          visual.motif === "wind" || visual.motif === "petal" ? spin : 0);
      }
      break;
    }
    case "burst": {
      if (miss && visual.anchor !== "user") break;
      const spread = 1 - (1 - t) ** 2;
      const total = Math.max(count, 5);
      for (let i = 0; i < total; i++) {
        const angle = i * TAU / total + param * 0.2;
        const radius = spread * size * (1.2 + (i % 3) * 0.38);
        glyph(offset(at, Math.cos(angle) * radius, Math.sin(angle) * radius * 0.79),
          0.72 - t * 0.37, peak(t), visual.motif === "bolt" ? angle : 0);
      }
      glyph(at, peak(t) * 1.25, peak(t), 0, "spark");
      break;
    }
    case "fall":
    case "rise": {
      if (miss && visual.anchor !== "user") break;
      const rising = visual.pattern === "rise";
      for (let i = 0; i < count; i++) {
        const f = clamp((t - .27 * i / Math.max(1, count - 1)) / .72);
        const lane = i % 2 ? Math.ceil(i / 2) : -i / 2;
        const scatter = lane * size / Math.max(2, count * 0.30);
        const y = rising ? 13 - f * 55 : -61 + f * f * 64;
        glyph(offset(at, scatter + (i ? Math.sin(f * 4 + i) * 5 : 0), y),
          count > 3 ? 0.46 + (i % 2) * 0.16 : 1, peak(f));
      }
      if (!rising && !visual.accent && t > 0.53) glyph(at, 1.2, peak((t - 0.53) / 0.47), 0, "spark");
      break;
    }
    case "ground": {
      if (miss && visual.anchor !== "field") break;
      const field = visual.anchor === "field";
      if (field && visual.motif === "crack") {
        drawFault(ctx, from, opponent, t, true);
        break;
      }
      const center = field ? opponent : at;
      const floorY = Math.min(height - 3, center.y + height * (center.y > height * .6 ? .26 : .20));
      if (field || visual.motion === "stomp" || visual.motion === "leap") {
        for (let i = 0; i < 2; i++) {
          const f = clamp((t - .28 - i * .13) / .55);
          ctx.globalAlpha = peak(f) * .8;
          ctx.strokeStyle = i ? fill : ink;
          ctx.lineWidth = 2.5 - 1.5 * f;
          ctx.beginPath();
          ctx.ellipse(center.x, floorY, 2 + f * (field ? width * .5 : size * 1.2), 1 + f * 12, 0, 0, TAU);
          ctx.stroke();
        }
      }
      const total = field ? 7 + Math.min(5, param) : count;
      for (let i = 0; i < total; i++) {
        const f = clamp((t - .19 * i / total) / .81);
        const spread = i - (total - 1) / 2;
        const x = center.x + spread * (field ? 16 + 7 * f : 12);
        const y = floorY - peak(f) * (field ? 12 + i % 3 * 9 : 8);
        glyph({ x, y }, field ? .26 + .11 * (i % 3) : .7 + .5 * f, peak(f),
          visual.motif === "rock" ? f * TAU : 0);
      }
      break;
    }
    case "tether": {
      if (miss) break;
      if (visual.motif === "crack") {
        drawFault(ctx, from, at, t, false);
        break;
      }
      const extent = clamp(t / .34) * (1 - clamp((t - .74) / .26));
      const tip = between(from, at, extent);
      ctx.globalAlpha = Math.min(1, peak(t) * 2.4);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      for (let i = 1; i <= 36; i++) {
        const u = i / 36;
        const p = between(from, tip, u);
        const wave = visual.motif === "coil" ? Math.sin(u * TAU * 3.5 - t * 12) : Math.sin(u * TAU + t * 7);
        const droop = wave * Math.sin(u * Math.PI) * size * .5;
        ctx.lineTo(p.x, p.y + droop);
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = visual.motif === "thread" ? 2.5 : 4;
      ctx.stroke();
      ctx.strokeStyle = visual.motif === "thread" ? light : fill;
      ctx.lineWidth *= .52;
      ctx.stroke();
      glyph(tip, visual.motif === "coil" ? 1.4 : .74, peak(t), visual.motif === "leaf" ? along : 0);
      break;
    }
    case "wave": {
      // Curved fronts read as sound, breath, surf or a gust depending on the glyphs that ride them.
      for (let i = 0; i < Math.max(3, count); i++) {
        const f = (t - .30 * i / Math.max(2, count - 1)) / .70;
        if (f <= 0 || f >= 1) continue;
        const p = between(from, end, f);
        const radius = size * (0.35 + f * 1.0);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, radius, radius * 0.72, along, -1.1, 1.1);
        ctx.globalAlpha = peak(f) * 0.85;
        ctx.strokeStyle = i % 2 ? fill : light;
        ctx.lineWidth = 2.4;
        ctx.stroke();
        glyph(offset(p, Math.sin(i * 3) * 10, Math.cos(i * 3) * 11), 0.58 + f * 0.2, peak(f));
      }
      break;
    }
    case "shield": {
      glyph(offset(at, 0, -4), 0.9 + peak(t) * 1.4, peak(t) * 0.56);
      for (let i = -1; i <= 1; i++)
        glyph(offset(at, i * size * 0.95, -peak(t) * 22), 0.28, peak(t), 0, "glint");
      break;
    }
    case "echo": {
      for (let i = 0; i < 5; i++) {
        const f = clamp((t - i * 0.045) * 1.4);
        const center = between(from, at, f);
        const direction = i % 2 ? -1 : 1;
        glyph(offset(center, direction * i * 8 * peak(f), -i * 4), 0.74, peak(f));
      }
      break;
    }
  }
  if (visual.accent && (!miss || visual.anchor === "user")) {
    const f = clamp((t - impact) / (1 - impact));
    const source = visual.pattern === "link" ? from : at;
    const center = (visual.pattern === "ground" || visual.pattern === "toss") ? offset(source, 0, height * .14) : source;
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5 - Math.PI / 2 + (param % 2) * .3;
      const radius = size * (.2 + (1 - (1 - f) ** 2) * 1.05);
      const p = offset(center, Math.cos(a) * radius, Math.sin(a) * radius * .75 - f * 6);
      glyph(p, .38 - .17 * f, peak(f), 0, visual.accent);
    }
  }
  ctx.globalAlpha = 1;
}

export function playMove(
  canvas: HTMLCanvasElement,
  attacker: HTMLElement,
  defender: HTMLElement,
  visual: MoveVisual,
  options: { speed: number; miss: boolean; hit: boolean; param: number },
  finish: () => void,
  start?: (duration: number) => void,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const frame = requestAnimationFrame(finish);
    return () => cancelAnimationFrame(frame);
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = (reduced ? 180 : visual.duration ?? 540) / Math.max(0.25, options.speed);
  start?.(duration);
  const animations: Animation[] = [];
  const source = attacker.getBoundingClientRect();
  const destination = defender.getBoundingClientRect();
  const sprite = attacker.querySelector("img")!;
  if (!reduced && visual.motion) {
    const x = visual.anchor === "user" ? 0 : (destination.left - source.left) * 0.19;
    const y = visual.anchor === "user" ? 0 : (destination.top - source.top) * 0.14;
    const frames = moveSpriteFrames(visual.motion, x, y, attacker.classList.contains("battle-player"));
    animations.push(sprite.animate(frames, { duration, easing: "ease-in-out" }));
  }
  if (!reduced && options.hit && !options.miss && visual.anchor !== "user") {
    const direction = destination.left > source.left ? 1 : -1;
    const target = defender.querySelector("img")!;
    if (visual.pattern === "toss") {
      const back = defender.classList.contains("battle-player");
      const lift = back ? 0 : -destination.height * .5;
      animations.push(target.animate([
        { transform: "translate(0)" },
        { transform: `translate(${direction * 12}px, ${lift}px)`, offset: .37 },
        { transform: `translate(${direction * 3}px, 6px) scaleY(.91)`, offset: .57 },
        { transform: "translate(0)" },
      ], { duration, easing: "ease-in-out" }));
    } else {
      animations.push(target.animate(
        [{ transform: "translateX(0)" }, { transform: `translateX(${5 * direction}px)`, offset: .25 }, { transform: "translateX(0)" }],
        { duration: duration * .3, delay: duration * contactTime(visual) },
      ));
    }
  }
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    animations.forEach((animation) => animation.cancel());
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const started = performance.now();
  const step = (now: number) => {
    const t = clamp((now - started) / duration);
    if (t >= 1) {
      stop();
      finish();
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) {
      const width = 320;
      const height = Math.max(1, Math.round(width * bounds.height / bounds.width));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const center = (mon: HTMLElement): Point => {
        const rect = mon.getBoundingClientRect();
        return {
          x: (rect.left - bounds.left + rect.width * 0.5) * width / bounds.width,
          y: (rect.top - bounds.top + rect.height * 0.53) * height / bounds.height,
        };
      };
      ctx.clearRect(0, 0, width, height);
      if (!reduced && visual.motion === "duplicate" && sprite.complete && sprite.naturalWidth > 0) {
        // Match object-fit: contain and object-position: center bottom, including
        // the player's two-pixel overscan and non-square portrait frames.
        const rect = sprite.getBoundingClientRect();
        const fit = Math.min(rect.width / sprite.naturalWidth, rect.height / sprite.naturalHeight);
        const w = sprite.naturalWidth * fit * width / bounds.width;
        const h = sprite.naturalHeight * fit * height / bounds.height;
        const x = (rect.left + rect.width / 2 - bounds.left) * width / bounds.width - w / 2;
        const baseline = (rect.bottom - bounds.top) * height / bounds.height;
        ctx.imageSmoothingEnabled = false;
        for (const direction of [-1, 1]) {
          ctx.globalAlpha = peak(t) * .38;
          ctx.drawImage(sprite, x + direction * 45 * t, baseline - h, w, h);
        }
        ctx.globalAlpha = 1;
      }
      drawMove(ctx, visual, center(attacker), center(defender), reduced ? (visual.pattern === "flood" ? .32 : .51) : t, options.miss, options.param, reduced);
    }
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return stop;
}
