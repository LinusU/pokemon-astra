import { battleGlyph } from "./battle-glyphs";
import { colors, type MoveVisual } from "./move-visuals";

type Point = { x: number; y: number };
const TAU = Math.PI * 2;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const between = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const offset = (p: Point, x: number, y: number): Point => ({ x: p.x + x, y: p.y + y });
const peak = (t: number) => Math.sin(Math.PI * clamp(t));
const angleOf = (a: Point, b: Point) => Math.atan2(b.y - a.y, b.x - a.x);

export function drawMove(
  ctx: CanvasRenderingContext2D,
  visual: MoveVisual,
  from: Point,
  opponent: Point,
  t: number,
  miss: boolean,
  param: number,
) {
  const { width, height } = ctx.canvas;
  const at = visual.anchor === "field" ? { x: width / 2, y: height / 2 }
    : visual.anchor === "user" ? from : opponent;
  const [light, fill, ink] = colors[visual.palette];
  const size = (visual.scale ?? 1) * 26;
  const count = visual.count ?? 1;
  const along = angleOf(from, at);
  const end = miss ? offset(between(from, at, 1.2), 0, -20) : at;
  const glyph = (p: Point, scale: number, opacity = 1, angle = 0, motif = visual.motif) => {
    ctx.globalAlpha = clamp(opacity);
    battleGlyph(ctx, motif, visual.palette, p.x, p.y, size * scale, t, angle);
  };

  switch (visual.pattern) {
    case "hit": {
      if (miss) break;
      const p = offset(at, param % 2 ? 5 : 0, param % 2 ? -4 : 0);
      const open = visual.motif === "jaw" || visual.motif === "grip";
      const pointsAtTarget = ["horn", "tongue"].includes(visual.motif);
      if (!open) {
        for (let i = 0; i < 5; i++) {
          const angle = i * TAU / 5 + param;
          glyph(offset(p, Math.cos(angle) * 32 * t, Math.sin(angle) * 26 * t),
            0.18, 0.72 * peak(t), angle, "glint");
        }
      }
      glyph(p, open ? 1.2 : 0.6 + 0.5 * peak(t), Math.min(peak(t) * 2.6, 1), pointsAtTarget ? along : 0);
      break;
    }
    case "shot":
    case "arc": {
      const travel = miss ? 1 : 0.72;
      for (let i = 0; i < count; i++) {
        const f = (t - 0.20 * i / count) / travel;
        if (f < 0 || f >= 1) continue;
        const p = between(from, end, f);
        const lift = visual.pattern === "arc" ? -44 * peak(f) : 0;
        const spread = (i - (count - 1) / 2) * 5 * peak(f);
        const directional = ["needle", "wing", "leaf", "glint"].includes(visual.motif);
        const rotation = visual.pattern === "arc" ? f * TAU : directional ? along : 0;
        glyph(offset(p, 0, lift + spread), count > 2 ? 0.52 + 0.18 * (i % 2) : 0.86, 1, rotation);
      }
      if (!miss && t > 0.58) {
        const hit = clamp((t - 0.58) / 0.42);
        glyph(at, 0.65 + hit * 0.45, peak(hit), 0, "spark");
      }
      break;
    }
    case "beam": {
      const head = between(from, end, clamp(t * 3.8));
      const tail = between(from, end, clamp((t - 0.66) * 3));
      const thickness = size * (0.21 + 0.08 * peak(t));
      ctx.lineCap = "round";
      ctx.globalAlpha = peak(t) * 0.8;
      for (const [color, factor] of [[ink, 1.8], [fill, 1.4], [light, 0.44]] as const) {
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(head.x, head.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness * factor;
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++)
        glyph(between(tail, head, ((t * 5 + i) % 6) / 6), 0.40, peak(t), along);
      if (!miss && t > 0.28) glyph(at, 0.9 + peak(t) * 0.25, peak(t), 0, "glint");
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
    case "fall":
    case "rise": {
      if (miss && visual.anchor !== "user") break;
      const rising = visual.pattern === "rise";
      for (let i = 0; i < count; i++) {
        const f = clamp(t * 1.6 - i * 0.09);
        const scatter = (i - (count - 1) / 2) * size / Math.max(2, count * 0.42);
        const y = rising ? 13 - f * 55 : -61 + f * f * 64;
        glyph(offset(at, scatter + (i ? Math.sin(f * 4 + i) * 5 : 0), y),
          count > 3 ? 0.46 + (i % 2) * 0.16 : 1, peak(f));
      }
      if (!rising && t > 0.53) glyph(at, 1.2, peak((t - 0.53) / 0.47), 0, "spark");
      break;
    }
    case "ground": {
      if (miss && visual.anchor !== "field") break;
      const field = visual.anchor === "field";
      const footprint = offset(at, 0, field ? height * 0.18 : height * 0.16);
      const total = field ? Math.max(count, 5) : Math.max(count, 1);
      for (let i = 0; i < total; i++) {
        const f = clamp(t * 1.4 - i * 0.045);
        const spread = (i - (total - 1) / 2) * (field ? width * 0.145 : 14);
        glyph(offset(footprint, spread + (field ? 0 : Math.sin(f * Math.PI) * 9), -peak(f) * 8),
          field ? 1.4 + 0.38 * f : 0.8 + 0.6 * f, peak(f), visual.motif === "rock" ? f * TAU : 0);
      }
      break;
    }
    case "wave": {
      // Curved fronts read as sound, breath, surf or a gust depending on the glyphs that ride them.
      for (let i = 0; i < Math.max(3, count); i++) {
        const f = t * 1.35 - i * 0.095;
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
    case "weather": {
      ctx.globalAlpha = 0.24 * peak(t);
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < (visual.count ?? 18); i++) {
        const x = (i * 71 + t * (visual.motif === "drop" ? 18 : 56)) % width;
        const y = (i * 47 + t * 78) % height;
        glyph({ x, y }, visual.motif === "sun" ? 0.83 : 0.30 + (i % 3) * 0.13, peak(t) * 0.85);
      }
      break;
    }
  }
  ctx.globalAlpha = 1;
}

const movement: Record<NonNullable<MoveVisual["motion"]>, (x: number, y: number) => Keyframe[]> = {
  dash: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x}px, ${y}px)`, offset: 0.36 }, { transform: "translate(0)" }],
  leap: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x}px, ${y - 18}px)`, offset: 0.38 }, { transform: "translate(0)" }],
  spin: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x / 2}px, ${y / 2}px) rotate(180deg)` }, { transform: "rotate(360deg)" }],
  stomp: (x, y) => [{ transform: "translate(0)" }, { transform: "translateY(-10px)", offset: 0.2 }, { transform: `translate(${x}px, ${y}px) scaleY(.92)`, offset: 0.45 }, { transform: "translate(0)" }],
  hop: () => [{ transform: "translateY(0)" }, { transform: "translateY(-14px)", offset: 0.4 }, { transform: "translateY(0)" }],
  fade: (x, y) => [{ opacity: 1 }, { opacity: 0.22, transform: `translate(${x}px, ${y}px)`, offset: 0.48 }, { opacity: 1 }],
  recoil: (x, y) => [{ transform: "translate(0)" }, { transform: `translate(${x}px, ${y}px)`, offset: 0.34 },
    { transform: `translate(${-x / 3}px, ${-y / 3}px)`, offset: 0.66 }, { transform: "translate(0)" }],
  shake: () => [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" },
    { transform: "translateX(-4px)" }, { transform: "translateX(0)" }],
};

export function playMove(
  canvas: HTMLCanvasElement,
  attacker: HTMLElement,
  defender: HTMLElement,
  visual: MoveVisual,
  options: { speed: number; miss: boolean; hit: boolean; param: number },
  finish: () => void,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const frame = requestAnimationFrame(finish);
    return () => cancelAnimationFrame(frame);
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = (reduced ? 180 : visual.duration ?? 540) / Math.max(0.25, options.speed);
  const animations: Animation[] = [];
  const source = attacker.getBoundingClientRect();
  const destination = defender.getBoundingClientRect();
  if (!reduced && visual.motion) {
    const x = visual.anchor === "user" ? 0 : (destination.left - source.left) * 0.19;
    const y = visual.anchor === "user" ? 0 : (destination.top - source.top) * 0.14;
    animations.push(attacker.querySelector("img")!.animate(movement[visual.motion](x, y), { duration, easing: "ease-in-out" }));
  }
  if (!reduced && options.hit && !options.miss && visual.anchor !== "user") {
    const direction = destination.left > source.left ? 1 : -1;
    animations.push(defender.querySelector("img")!.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(${5 * direction}px)`, offset: 0.25 }, { transform: "translateX(0)" }],
      { duration: duration * 0.3, delay: duration * (["shot", "arc", "fall"].includes(visual.pattern) ? 0.61 : 0.4) },
    ));
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
      drawMove(ctx, visual, center(attacker), center(defender), reduced ? 0.62 : t, options.miss, options.param);
    }
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return stop;
}
