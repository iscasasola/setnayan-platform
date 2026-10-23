/**
 * The row-major vertical blur (2026-10-23) is BIT-IDENTICAL to the column-major
 * one it replaced — so every photo's look is unchanged; only Safari stopped
 * spending ~15 s on it (measured in Playwright WebKit: ORIG on 2560×1440 took
 * 15.6 s vs Chromium's 0.76 s).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyPapicStylePixels, boxBlurRGBA } from './papic-photo-styles';

/** The previous implementation, verbatim (column-major vertical pass). */
function boxBlurRGBAColumnMajor(buf: Float32Array, w: number, h: number, radius: number, passes: number): Float32Array {
  const tmp = new Float32Array(buf.length);
  const win = radius * 2 + 1;
  for (let p = 0; p < passes; p += 1) {
    for (let y = 0; y < h; y += 1) {
      const row = y * w * 4;
      for (let c = 0; c < 4; c += 1) {
        let acc = 0;
        for (let k = -radius; k <= radius; k += 1) acc += buf[row + Math.min(w - 1, Math.max(0, k)) * 4 + c]!;
        for (let x = 0; x < w; x += 1) {
          tmp[row + x * 4 + c] = acc / win;
          acc += buf[row + Math.min(w - 1, x + radius + 1) * 4 + c]! - buf[row + Math.max(0, x - radius) * 4 + c]!;
        }
      }
    }
    for (let x = 0; x < w; x += 1) {
      const col = x * 4;
      for (let c = 0; c < 4; c += 1) {
        let acc = 0;
        for (let k = -radius; k <= radius; k += 1) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w * 4 + col + c]!;
        for (let y = 0; y < h; y += 1) {
          buf[y * w * 4 + col + c] = acc / win;
          acc += tmp[Math.min(h - 1, y + radius + 1) * w * 4 + col + c]! - tmp[Math.max(0, y - radius) * w * 4 + col + c]!;
        }
      }
    }
  }
  return buf;
}

function noise(n: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    out[i] = s & 255;
  }
  return out;
}

test('the row-major blur equals the column-major one, bit for bit', () => {
  for (const [w, h, r, p] of [
    [37, 23, 1, 2],
    [64, 48, 2, 3],
    [5, 90, 1, 2],
    [120, 4, 3, 1],
  ] as const) {
    const a = noise(w * h * 4, w * 31 + h);
    const b = new Float32Array(a);
    boxBlurRGBA(a, w, h, r, p);
    boxBlurRGBAColumnMajor(b, w, h, r, p);
    assert.deepEqual(Buffer.from(a.buffer), Buffer.from(b.buffer), `${w}×${h} r${r} p${p} differs`);
  }
});

test('every look still runs on raw pixels and changes them', () => {
  for (const style of ['ORIG', 'RETRO', 'MONO', 'CINE', 'LOMO'] as const) {
    const d = new Uint8ClampedArray(noise(32 * 24 * 4, 7));
    const before = Buffer.from(d);
    applyPapicStylePixels(d, 32, 24, style);
    assert.notDeepEqual(Buffer.from(d), before, `${style} left the pixels alone`);
  }
});
