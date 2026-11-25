import { colors, type Motif, type Palette } from "./move-visuals";

type Point = readonly [number, number];

export function battleGlyph(
  ctx: CanvasRenderingContext2D,
  motif: Motif,
  palette: Palette,
  x: number,
  y: number,
  size: number,
  phase: number,
  angle = 0,
) {
  const [light, fill, ink] = colors[palette];
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  ctx.scale(size / 16, size / 16);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  function path(points: Point[]) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
  }
  function line(points: Point[], color: string = light, width = 1.5) {
    path(points);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function shape(points: Point[], color: string = fill) {
    path(points);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  function oval(rx: number, ry: number, ox = 0, oy = 0, color: string = fill) {
    ctx.beginPath();
    ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  function loop(rx: number, ry: number, color: string = fill) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  function rect(x: number, y: number, w: number, h: number, color: string = light) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  switch (motif) {
    case "spark":
    case "glint":
    case "star": {
      const points = motif === "spark" ? 8 : motif === "star" ? 5 : 4;
      const inner = motif === "spark" ? 3.7 : 2.6;
      shape(Array.from({ length: points * 2 }, (_, i) => {
        const turn = i * Math.PI / points - Math.PI / 2;
        const r = i % 2 ? inner : 8;
        return [Math.cos(turn) * r, Math.sin(turn) * r];
      }), light);
      break;
    }
    case "slash":
    case "cross":
      shape([[-8, 7], [-5, 1], [7, -7], [5, -1], [-3, 6]], light);
      if (motif === "cross")
        shape([[-7, -7], [-1, -5], [7, 7], [1, 5]], light);
      else
        line([[-8, 3], [-5, -1], [4, -7]], fill, 1.5);
      break;
    case "fist":
      shape([[-7, 4], [-7, -2], [-5, -3], [-5, -6], [5, -6], [7, -3], [7, 3], [4, 6], [-4, 6]]);
      line([[-5, -3], [-3, -1], [3, -1], [5, 1]], ink);
      line([[-2, -6], [-2, -4]], light);
      line([[2, -6], [2, -4]], light);
      break;
    case "boot":
      shape([[-7, -6], [0, -6], [1, 1], [6, 1], [8, 5], [6, 7], [-6, 7], [-7, 5]]);
      line([[-6, 4], [6, 4]], light, 2);
      break;
    case "hand":
      shape([[-6, 2], [-7, -1], [-5, -3], [-3, 0], [-3, -6], [-1, -7], [0, -6],
        [1, -7], [3, -7], [3, -4], [4, -6], [6, -5], [6, 2], [4, 7], [-3, 7]]);
      line([[-3, 2], [0, 4], [3, 3]], light);
      break;
    case "jaw":
    case "grip": {
      const open = 1.5 + 3.5 * (1 - Math.sin(Math.PI * phase));
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(1, side);
        ctx.translate(0, -open);
        shape(motif === "jaw"
          ? [[-8, -2], [-5, -5], [5, -5], [8, -2], [6, 3], [4, -1], [2, 1], [0, -1], [-2, 1], [-4, -1], [-6, 3]]
          : [[-8, -3], [-3, -5], [6, -4], [8, -1], [4, 0], [-4, 0], [-7, 3]], light);
        ctx.restore();
      }
      break;
    }
    case "horn":
      shape([[-7, 5], [-5, -5], [8, -1], [3, 3], [-2, 6]], light);
      line([[-3, -3], [-2, 0], [-4, 4]], fill);
      break;
    case "wing":
      shape([[-8, 4], [-3, -2], [0, -3], [7, -7], [6, -2], [4, 0], [6, -1], [4, 4], [0, 6]], light);
      line([[-4, 3], [1, 0], [5, -4]], fill);
      break;
    case "rock":
      shape([[-8, 2], [-5, -5], [2, -7], [7, -2], [8, 4], [2, 7], [-5, 6]]);
      shape([[-5, -5], [2, -7], [6, -2], [-1, 1]], light);
      line([[-1, 1], [1, 3], [2, 7]], ink);
      break;
    case "bone":
    case "baton":
      shape([[-8, -3], [-5, -4], [-3, -2], [3, -2], [5, -4], [8, -3], [7, 0], [8, 3],
        [5, 4], [3, 2], [-3, 2], [-5, 4], [-8, 3], [-7, 0]], light);
      if (motif === "baton") rect(-3, -2, 6, 4, fill);
      break;
    case "needle":
      shape([[-8, -2], [4, -1], [8, 0], [4, 1], [-8, 2]], light);
      break;
    case "spike":
      shape([[-6, 5], [-4, -3], [0, 0], [3, -7], [7, 5]], light);
      line([[-4, 4], [-3, 0]], fill);
      break;
    case "coin":
      oval(5, 7);
      line([[-1, -4], [-1, 4]], light, 2);
      break;
    case "egg":
      oval(5.7, 7.4, 0, 0, light);
      rect(-3, 1, 3, 3, fill);
      rect(2, -3, 2, 2, fill);
      break;
    case "gift":
      shape([[-6, -2], [6, -2], [6, 7], [-6, 7]]);
      rect(-1, -3, 2, 10);
      line([[-7, -2], [7, -2]], light, 2);
      line([[-1, -2], [-6, -5], [-4, -7], [0, -3], [4, -7], [6, -5], [1, -2]]);
      break;
    case "tongue":
      shape([[-8, -4], [4, -4], [8, -1], [8, 2], [5, 5], [2, 5], [-2, 2], [-8, 2]]);
      line([[-4, -1], [3, 0], [6, 2]], light);
      break;
    case "fire":
      shape([[-7, 3], [-5, -4], [-2, -2], [1, -8], [3, -4], [6, -1], [7, 4], [4, 7], [-4, 7]]);
      shape([[-3, 5], [0, -1], [4, 4], [3, 7], [-2, 7]], light);
      break;
    case "flameburst":
      shape([[-8, 1], [-4, -2], [-5, -7], [-1, -4], [3, -8], [3, -4], [8, -5],
        [6, 0], [8, 4], [3, 4], [2, 8], [-1, 5], [-6, 7], [-5, 3]]);
      shape([[-3, 2], [-1, -3], [3, -1], [4, 3], [0, 5]], light);
      break;
    case "dragon":
      shape([[-8, 6], [-5, 1], [-6, -7], [-1, -4], [2, -6], [3, -3], [8, -1],
        [8, 2], [3, 2], [4, 4], [-1, 6], [-4, 5]]);
      rect(0, -3, 2, 2);
      line([[-3, 3], [1, 1], [6, 1]], ink);
      break;
    case "bubble":
      oval(6, 6, 0, 0, "transparent");
      line([[-5, -1], [-3, -4], [0, -5]], light, 2);
      line([[5, 0], [3, 4]], fill);
      break;
    case "bubbles":
      oval(4.5, 4.5, -3, 2);
      oval(3.5, 3.5, 4, -3, light);
      rect(-5, 0, 2, 2);
      break;
    case "drop":
      shape([[0, -8], [6, 1], [6, 4], [3, 7], [-3, 7], [-6, 4], [-6, 1]]);
      line([[-3, 0], [-3, 3], [-1, 4]], light, 2);
      break;
    case "ice":
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        line([[-8, 0], [8, 0]], ink, 3);
        line([[-8, 0], [8, 0]], light);
        line([[-7, -3], [-4, 0], [-7, 3]]);
        line([[7, -3], [4, 0], [7, 3]]);
      }
      break;
    case "bolt":
      shape([[-1, -8], [6, -8], [1, -1], [6, -1], [-5, 8], [-2, 1], [-6, 1]], light);
      break;
    case "leaf":
    case "petal":
      shape([[-7, 6], [-5, -2], [1, -6], [7, -7], [6, 0], [1, 5]]);
      line(motif === "leaf" ? [[-5, 5], [4, -3]] : [[-3, 0], [1, -2], [4, -2]]);
      break;
    case "seed":
      oval(4.4, 5.7, 0, 1);
      line([[0, 0], [1, -5], [5, -7]], light);
      break;
    case "orb":
      oval(6.5, 6.5);
      oval(3.4, 2.5, -1.4, -1.8, light);
      break;
    case "cloud":
      oval(4.8, 5.5, -3, 1);
      oval(4.2, 5.5, 3, -1);
      oval(5, 3.8, 1, 3);
      rect(-4, -2, 3, 2);
      break;
    case "note":
      oval(3.2, 2.4, -3, 4);
      line([[0, 3], [0, -7], [5, -4]], ink, 3);
      line([[0, 3], [0, -7], [5, -4]], light, 1.4);
      break;
    case "heart":
      shape([[0, 7], [-7, 1], [-8, -3], [-5, -6], [-2, -6], [0, -4], [2, -6], [5, -6], [8, -3], [7, 1]]);
      rect(-5, -3, 2, 2);
      break;
    case "plus":
      shape([[-2, -7], [2, -7], [2, -2], [7, -2], [7, 2], [2, 2], [2, 7], [-2, 7],
        [-2, 2], [-7, 2], [-7, -2], [-2, -2]], light);
      break;
    case "eye":
      shape([[-8, 0], [-4, -4], [0, -5], [4, -4], [8, 0], [4, 4], [0, 5], [-4, 4]], light);
      oval(2.7, 3.8);
      rect(-1, -2, 2, 4, ink);
      break;
    case "sleep":
      line([[-6, -6], [6, -6], [-6, 6], [6, 6]], ink, 4);
      line([[-6, -6], [6, -6], [-6, 6], [6, 6]], light, 2);
      break;
    case "wind":
      line([[-8, 1], [-3, -3], [3, -4], [7, -2], [8, 1], [4, 3], [0, 1]], fill, 2);
      line([[-6, 5], [-2, 2], [3, 2]], light);
      break;
    case "ring":
      loop(7.5, 5.5, ink);
      loop(7.5, 4.2, light);
      break;
    case "crack":
      line([[-8, -4], [-4, 0], [-2, -2], [1, 2], [4, 0], [8, 4]], ink, 3);
      line([[-8, -4], [-4, 0], [-2, -2], [1, 2], [4, 0], [8, 4]], light, 0.9);
      break;
    case "web":
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 4);
        line([[0, -8], [0, 8]], light, 0.8);
      }
      loop(7, 7, light);
      loop(4.5, 4.5, light);
      break;
    case "coil":
      for (let i = -1; i <= 1; i++) {
        ctx.save();
        ctx.translate(0, i * 3);
        loop(7, 3, ink);
        loop(7, 2.5, light);
        ctx.restore();
      }
      break;
    case "anger":
      for (let i = 0; i < 4; i++) {
        line([[-6, -2], [-3, -3], [-2, -7]], ink, 2.8);
        line([[-6, -2], [-3, -3], [-2, -7]], fill, 1.5);
        ctx.rotate(Math.PI / 2);
      }
      break;
    case "dome":
      oval(7.8, 7.2, 0, 0, fill);
      loop(6.4, 7, light);
      line([[-5, -3], [-1, -6], [2, -6]], light, 1.7);
      break;
    case "screen":
      shape([[-7, -4], [5, -8], [7, -7], [7, 5], [-5, 8], [-7, 7]]);
      line([[-5, 5], [-5, -3], [4, -6]], light);
      break;
    case "mirror":
      shape([[-6, -6], [1, -8], [6, -5], [6, 4], [0, 8], [-6, 4]]);
      line([[-4, 1], [1, -5]], light);
      line([[-3, 4], [4, -4]], light);
      break;
    case "shell":
      shape([[-8, 3], [-5, -4], [0, -7], [5, -4], [8, 3], [4, 6], [-4, 6]]);
      line([[-6, 1], [0, 3], [6, 1]], light);
      line([[0, -5], [0, 4]], ink);
      break;
    case "sword":
      shape([[-2, 3], [-1, -5], [1, -8], [3, -5], [2, 3]], light);
      line([[-5, 3], [5, 3]], fill, 2);
      line([[0, 4], [0, 7]], ink, 2);
      break;
    case "clock":
      oval(7, 7, 0, 0, light);
      line([[0, -4], [0, 0], [3, 2]], ink);
      break;
    case "target":
      loop(6, 6, light);
      line([[-8, 0], [-4, 0]]);
      line([[4, 0], [8, 0]]);
      line([[0, -8], [0, -4]]);
      line([[0, 4], [0, 8]]);
      rect(-1, -1, 2, 2, fill);
      break;
    case "moon":
      shape([[3, -7], [0, -4], [-1, 1], [2, 4], [6, 3], [4, 7], [-1, 8], [-6, 5], [-7, 1], [-5, -5]], light);
      break;
    case "sun":
      oval(4.5, 4.5, 0, 0, light);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        line([[0, -6], [0, -8]], fill);
      }
      break;
    case "question":
      line([[-4, -4], [-2, -6], [2, -6], [4, -4], [4, -2], [0, 1], [0, 2]], ink, 4);
      line([[-4, -4], [-2, -6], [2, -6], [4, -4], [4, -2], [0, 1], [0, 2]], light, 2);
      rect(-1, 5, 2, 2);
      break;
    case "arrow":
      shape([[-5, -1], [0, -7], [5, -1], [2, -1], [2, 6], [-2, 6], [-2, -1]], light);
      break;
    case "doll":
      oval(4, 3.5, 0, 4);
      shape([[-5, -1], [-5, -6], [-2, -4], [2, -4], [5, -6], [5, -1], [2, 2], [-2, 2]]);
      rect(-3, -2, 1, 1, ink);
      rect(2, -2, 1, 1, ink);
      break;
    case "thread":
      line([[-8, 1], [-5, -3], [-2, 2], [2, -2], [5, 3], [8, 0]], ink, 2.6);
      line([[-8, 1], [-5, -3], [-2, 2], [2, -2], [5, 3], [8, 0]], light);
      break;
    case "tail": {
      const flick = Math.sin(phase * Math.PI * 4) * 3;
      line([[-7, 4], [-2, 4], [2, 1], [4, -5], [7, -3 + flick]], ink, 5.4);
      line([[-7, 4], [-2, 4], [2, 1], [4, -5], [7, -3 + flick]], fill, 3.4);
      break;
    }
    case "bell":
      shape([[-7, 4], [-5, 1], [-4, -4], [0, -7], [4, -4], [5, 1], [7, 4]]);
      oval(2, 1.6, 0, 6, light);
      line([[-5, 3], [5, 3]], light);
      break;
    case "drum":
      shape([[-7, -3], [7, -3], [6, 5], [3, 7], [-3, 7], [-6, 5]]);
      oval(7, 3.2, 0, -3, light);
      line([[-5, 1], [-2, 5], [0, 1], [2, 5], [5, 1]], light);
      break;
    case "bottle":
      shape([[-2, -5], [2, -5], [2, -2], [5, 1], [5, 7], [-5, 7], [-5, 1], [-2, -2]], light);
      rect(-3, -8, 6, 3, fill);
      rect(-3, 2, 6, 3, fill);
      break;
    case "brush":
      shape([[-6, 7], [-7, 5], [1, -4], [4, -2]], fill);
      shape([[1, -4], [3, -7], [7, -8], [6, -4], [4, -2]], light);
      break;
  }
  ctx.restore();
}
