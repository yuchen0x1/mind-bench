import { createHash } from 'node:crypto';

/**
 * Convert a user supplied seed into a stable unsigned 32 bit value.
 * Keeping the conversion here makes the selection algorithm portable and
 * allows a run manifest to reproduce randomized challenge ordering later.
 */
export function seedToUint32(seed) {
  const text = String(seed ?? '').trim() || 'mind-bench-default-seed';
  const digest = createHash('sha256').update(text).digest();
  return digest.readUInt32BE(0);
}

/** Fisher–Yates shuffle with a deterministic mulberry32 PRNG. */
export function seededShuffle(items, seed) {
  const result = [...items];
  let state = seedToUint32(seed);
  const random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
