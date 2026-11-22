import { describe, expect, it } from "vitest";
import { applyBps, BpsError, crc32, isBps } from "../src/yellow/bps";

/** A BPS patch from its actions: source reads, target reads, then the CRCs. */
function bps(source: Uint8Array, target: Uint8Array, actions: number[]) {
  const num = (n: number) => {
    const out: number[] = [];
    for (;;) {
      const x = n & 0x7f;
      n = Math.floor(n / 128);
      if (n === 0) { out.push(x | 0x80); return out; }
      out.push(x);
      n--;
    }
  };
  const bytes = [0x42, 0x50, 0x53, 0x31, ...num(source.length), ...num(target.length), ...num(0), ...actions];
  const word = (v: number) => [v & 0xff, v >>> 8 & 0xff, v >>> 16 & 0xff, v >>> 24];
  bytes.push(...word(crc32(source)), ...word(crc32(target)));
  bytes.push(...word(crc32(new Uint8Array(bytes))));
  return new Uint8Array(bytes);
}

describe("BPS patches", () => {
  it("reads the source and the patch", () => {
    const source = new Uint8Array([1, 2, 3, 4]);
    const target = new Uint8Array([1, 2, 9, 9, 9]);
    // SourceRead 2 ((2 - 1) << 2 | 0), TargetRead 3 ((3 - 1) << 2 | 1) of 9s.
    const patch = bps(source, target, [(1 << 2 | 0) | 0x80, (2 << 2 | 1) | 0x80, 9, 9, 9]);
    expect(isBps(patch)).toBe(true);
    expect([...applyBps(source, patch)]).toEqual([...target]);
    expect(() => applyBps(new Uint8Array([1, 2, 3, 5]), patch)).toThrow(BpsError);
  });
});
