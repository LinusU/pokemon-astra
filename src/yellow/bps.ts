/**
 * Applies a BPS patch (the format Yellow Legacy's releases ship in) to the
 * player's own cartridge, in the browser. The patch's CRC32s of the source,
 * the result and the patch itself are all checked.
 */
export class BpsError extends Error {}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Whether `bytes` look like a BPS patch. */
export function isBps(bytes: Uint8Array) {
  return bytes.length > 16 && bytes[0] === 0x42 && bytes[1] === 0x50 && bytes[2] === 0x53 && bytes[3] === 0x31; // "BPS1"
}

export function applyBps(source: Uint8Array, patch: Uint8Array): Uint8Array {
  if (!isBps(patch)) throw new BpsError("This file is not a BPS patch.");
  const word = (at: number) => (patch[at] | patch[at + 1] << 8 | patch[at + 2] << 16 | patch[at + 3] << 24) >>> 0;
  const end = patch.length - 12;
  if (crc32(patch.subarray(0, patch.length - 4)) !== word(patch.length - 4)) throw new BpsError("The patch is damaged.");
  if (crc32(source) !== word(end)) throw new BpsError("The patch is for a different cartridge.");
  let p = 4;
  const number = () => {
    let data = 0, shift = 1;
    for (;;) {
      if (p >= end) throw new BpsError("The patch is damaged.");
      const x = patch[p++];
      data += (x & 0x7f) * shift;
      if (x & 0x80) return data;
      shift *= 128;
      data += shift;
    }
  };
  const sourceSize = number(), targetSize = number(), metadata = number();
  if (sourceSize !== source.length) throw new BpsError("The patch is for a different cartridge.");
  p += metadata;
  const target = new Uint8Array(targetSize);
  let out = 0, sourceAt = 0, targetAt = 0;
  while (p < end) {
    const action = number();
    const command = action & 3, length = Math.floor(action / 4) + 1;
    if (out + length > targetSize) throw new BpsError("The patch is damaged.");
    if (command === 0) {
      // SourceRead: the source's bytes at the same place.
      target.set(source.subarray(out, out + length), out);
    } else if (command === 1) {
      // TargetRead: bytes from the patch.
      target.set(patch.subarray(p, p + length), out);
      p += length;
    } else {
      const offset = number();
      const delta = (offset & 1 ? -1 : 1) * Math.floor(offset / 2);
      if (command === 2) {
        // SourceCopy
        sourceAt += delta;
        target.set(source.subarray(sourceAt, sourceAt + length), out);
        sourceAt += length;
      } else {
        // TargetCopy: may overlap what it writes, byte by byte.
        targetAt += delta;
        for (let i = 0; i < length; i++) target[out + i] = target[targetAt++];
      }
    }
    out += length;
  }
  if (out !== targetSize || crc32(target) !== word(end + 4)) throw new BpsError("The patch didn't apply cleanly.");
  return target;
}
