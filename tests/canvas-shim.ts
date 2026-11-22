/** Just enough of the 2D canvas for the Crystal renderer to draw in Node, and a PNG writer to look at the result. */
import { deflateSync } from "node:zlib";

class FakeImageData {
  data: Uint8ClampedArray;
  constructor(readonly width: number, readonly height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

function parseColor(style: string): [number, number, number, number] {
  const m = /rgba?\(([^)]+)\)/.exec(style);
  if (m) {
    const [r, g, b, a = "1"] = m[1].split(",").map(s => s.trim());
    return [+r, +g, +b, Math.round(+a * 255)];
  }
  if (style.startsWith("#")) {
    const hex = style.length === 4 ? style.slice(1).split("").map(c => c + c).join("") : style.slice(1);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 255];
  }
  return [0, 0, 0, 0];
}

export class FakeCanvas {
  width = 300;
  height = 150;
  private buffer?: FakeImageData;
  private ctx?: FakeContext;
  get pixels() {
    if (!this.buffer || this.buffer.width !== this.width || this.buffer.height !== this.height) this.buffer = new FakeImageData(this.width, this.height);
    return this.buffer;
  }
  getContext() {
    return (this.ctx ??= new FakeContext(this));
  }
}

class FakeContext {
  fillStyle: string | object = "#000";
  strokeStyle = "#000";
  font = "";
  textAlign = "start";
  lineWidth = 1;
  imageSmoothingEnabled = true;
  constructor(readonly canvas: FakeCanvas) {}
  createImageData(w: number, h: number) { return new FakeImageData(w, h); }
  putImageData(img: FakeImageData, x: number, y: number) {
    const dst = this.canvas.pixels;
    for (let j = 0; j < img.height; j++)
      for (let i = 0; i < img.width; i++) {
        const dx = x + i, dy = y + j;
        if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
        const s = (j * img.width + i) * 4, d = (dy * dst.width + dx) * 4;
        dst.data.set(img.data.subarray(s, s + 4), d);
      }
  }
  drawImage(src: FakeCanvas, ...a: number[]) {
    let [sx, sy, sw, sh, dx, dy] = [0, 0, src.width, src.height, a[0], a[1]];
    if (a.length >= 8) [sx, sy, sw, sh, dx, dy] = [a[0], a[1], a[2], a[3], a[4], a[5]];
    const s = src.pixels, d = this.canvas.pixels;
    for (let j = 0; j < sh; j++)
      for (let i = 0; i < sw; i++) {
        const x = Math.round(dx) + i, y = Math.round(dy) + j, u = sx + i, v = sy + j;
        if (x < 0 || y < 0 || x >= d.width || y >= d.height || u < 0 || v < 0 || u >= s.width || v >= s.height) continue;
        const si = (v * s.width + u) * 4;
        if (s.data[si + 3] === 0) continue;
        d.data.set(s.data.subarray(si, si + 4), (y * d.width + x) * 4);
      }
  }
  fillRect(x: number, y: number, w: number, h: number) {
    if (typeof this.fillStyle !== "string") return;
    const [r, g, b, a] = parseColor(this.fillStyle), d = this.canvas.pixels;
    for (let j = Math.max(0, y); j < Math.min(d.height, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(d.width, x + w); i++) {
        const k = (j * d.width + i) * 4, t = a / 255;
        d.data[k] = d.data[k] * (1 - t) + r * t;
        d.data[k + 1] = d.data[k + 1] * (1 - t) + g * t;
        d.data[k + 2] = d.data[k + 2] * (1 - t) + b * t;
        d.data[k + 3] = 255;
      }
  }
  createRadialGradient() { return { addColorStop() {} }; }
  beginPath() {}
  roundRect() {}
  fill() {}
  stroke() {}
  fillText() {}
}

/** Installs a `document` that makes these canvases. */
export function installCanvas() {
  (globalThis as unknown as { document: unknown }).document = { createElement: () => new FakeCanvas() };
}

export function png(canvas: FakeCanvas): Buffer {
  const { width, height, data } = canvas.pixels;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4, d = y * (width * 3 + 1) + 1 + x * 3;
      raw[d] = data[s];
      raw[d + 1] = data[s + 1];
      raw[d + 2] = data[s + 2];
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Buffer) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const t = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
