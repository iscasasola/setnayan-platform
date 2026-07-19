/**
 * Unit suite for the DCT perceptual hash (pHash) used by the cross-vendor
 * reverse-image repost-watch (Node built-in test runner via tsx — `pnpm
 * test:unit`; CI runs it in the "unit tests" step).
 *
 * Locks the two properties the WHOLE feature rests on (the adversarial review
 * required this test before merge):
 *
 *   (1) ROBUSTNESS — re-encoding the SAME image (PNG → JPEG, the dominant theft
 *       vector: right-click-save → re-upload) keeps the pHash within a few bits.
 *       Asserted: distance <= 6.
 *
 *   (2) DISCRIMINATION — two genuinely DIFFERENT images land far apart, well
 *       above the default match threshold (10). Asserted: distance > 20.
 *
 * Plus the algebraic invariants of the Hamming + serialization helpers (which
 * must mirror the SQL public.hamming_distance(bigint,bigint)).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import {
  computePHash,
  hammingDistance,
  phashToDbString,
  phashFromDb,
} from './perceptual-hash';

// --- Test image generators (all via sharp, no fixtures on disk) -------------

/**
 * A textured, photo-like image: overlapping radial rings + a diagonal carrier,
 * which puts strong MID-frequency energy into the DCT (coefficients land well
 * clear of the median). This is what a real marketing photo looks like to a
 * pHash — unlike a smooth gradient, whose near-median coefficients are
 * pathologically sensitive to JPEG quantization. Lossless PNG; the JPEG
 * re-encode below is what we compare against.
 */
async function photoLikePng(width = 256, height = 256): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(width * height * channels);
  const cx = width * 0.4;
  const cy = height * 0.55;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const v = Math.round(127 + 90 * Math.sin(r / 9) + 30 * Math.sin((x + y) / 13));
      const c = Math.max(0, Math.min(255, v));
      data[i] = c;
      data[i + 1] = Math.max(0, Math.min(255, c + 25));
      data[i + 2] = Math.max(0, Math.min(255, 255 - c));
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * A smooth diagonal gradient — used only as a DISTINCT image for the
 * discrimination test (its low-frequency signature diverges hard from both the
 * textured photo and the stripes).
 */
async function gradientPng(width = 256, height = 256): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const v = Math.round(((x + y) / (width + height)) * 255);
      data[i] = v; // R
      data[i + 1] = Math.round((x / width) * 255); // G
      data[i + 2] = Math.round((y / height) * 255); // B
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/**
 * A completely different structure — vertical stripes — so its low-frequency
 * DCT signature diverges hard from the smooth gradient.
 */
async function stripesPng(width = 256, height = 256): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const on = Math.floor(x / 16) % 2 === 0 ? 255 : 0;
      data[i] = on;
      data[i + 1] = on;
      data[i + 2] = on;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function reencodeJpeg(png: Buffer, quality = 60): Promise<Buffer> {
  return sharp(png).jpeg({ quality }).toBuffer();
}

// --- Robustness: same image re-encoded stays within <=6 bits ----------------

test('pHash is stable across JPEG re-encode (same image → <=6 bits)', async () => {
  const png = await photoLikePng();
  const jpeg = await reencodeJpeg(png, 60);

  const a = await computePHash(png);
  const b = await computePHash(jpeg);
  assert.ok(a !== null && b !== null, 'both images must hash');

  const dist = hammingDistance(a!, b!);
  assert.ok(
    dist <= 6,
    `re-encode distance should be <=6 (near-duplicate), got ${dist}`,
  );
});

test('pHash is stable across a hard JPEG re-encode + slight downscale', async () => {
  const png = await photoLikePng(256, 256);
  // Simulate a sloppy reposter: re-encode at low quality AND resize a little.
  const tampered = await sharp(png)
    .resize(232, 232)
    .jpeg({ quality: 45 })
    .toBuffer();

  const a = await computePHash(png);
  const b = await computePHash(tampered);
  assert.ok(a !== null && b !== null);

  const dist = hammingDistance(a!, b!);
  assert.ok(dist <= 6, `tampered re-encode distance should be <=6, got ${dist}`);
});

// --- Discrimination: different images stay >20 bits apart --------------------

test('pHash discriminates distinct images (gradient vs stripes → >20 bits)', async () => {
  const grad = await computePHash(await gradientPng());
  const stripes = await computePHash(await stripesPng());
  assert.ok(grad !== null && stripes !== null);

  const dist = hammingDistance(grad!, stripes!);
  assert.ok(
    dist > 20,
    `distinct images should be >20 bits apart, got ${dist}`,
  );
});

test('pHash discriminates a textured photo from stripes (>20 bits)', async () => {
  const photo = await computePHash(await photoLikePng());
  const stripes = await computePHash(await stripesPng());
  assert.ok(photo !== null && stripes !== null);

  const dist = hammingDistance(photo!, stripes!);
  assert.ok(dist > 20, `distinct images should be >20 bits apart, got ${dist}`);
});

// --- Decode failure → null (caller skips, no crash) -------------------------

test('computePHash returns null on undecodable bytes', async () => {
  const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const h = await computePHash(garbage);
  assert.equal(h, null);
});

// --- Hamming + serialization invariants (must mirror SQL) --------------------

test('hammingDistance: identical → 0, all-bits-different → 64', () => {
  assert.equal(hammingDistance(0n, 0n), 0);
  assert.equal(hammingDistance(-1n, -1n), 0); // 0xFFFF…FFFF vs itself
  // 0x0000…0000 vs 0xFFFF…FFFF differ in all 64 bits. -1n is all-ones in 2s-comp.
  assert.equal(hammingDistance(0n, -1n), 64);
});

test('hammingDistance counts a known bit pattern', () => {
  // 0b1011 vs 0b0001 → differ at bits 1 and 3 → distance 2.
  assert.equal(hammingDistance(0b1011n, 0b0001n), 2);
});

test('phashToDbString / phashFromDb round-trips through signed 64-bit', () => {
  // A value with the top bit set becomes negative in signed 64-bit form, which
  // is exactly how Postgres BIGINT stores it.
  const big = BigInt.asIntN(64, 0xfedcba9876543210n);
  const s = phashToDbString(big);
  assert.equal(typeof s, 'string');
  assert.equal(phashFromDb(s), big);
  // String, number, and bigint inputs all parse identically.
  assert.equal(phashFromDb(0n), 0n);
  assert.equal(phashFromDb('42'), 42n);
});
