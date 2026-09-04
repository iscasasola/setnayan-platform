/**
 * moodboard-gallery-image-checks.test.ts — the three checks that need REAL
 * PIXELS, exercised on real pixels.
 *
 * 🔑 EVERY ASSERTION HERE READS AN IMAGE THAT WAS ACTUALLY PRODUCED OR
 * ACTUALLY DECODED. Nothing reads a flag, a column, or a return value claiming
 * the work was done — a boolean `watermarked: true` written beside the row
 * would survive deleting the watermark step, and this file exists because that
 * is precisely the failure MB11's brief refuses.
 *
 * 🪤 A TRAP THIS FILE ALREADY CAUGHT, MEASURED 2026-09-04. The first version of
 * `imageRegionStats` used sharp's own `.stats()` after an `.extract()`. sharp
 * evaluates `.stats()` against the INPUT image and silently DISCARDS the
 * pipeline queued in front of it, so all four quadrants of a marked 800×600
 * test image came back identical — mean 139.584, stdev 6.200 — and the
 * watermark guard could never have gone red no matter what it was pointed at.
 * The region is now read out with `.raw()` and the statistics computed by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { watermarkImageBytes, imageRegionStats, WATERMARK_TEXT } from './watermark-server';
import { decodeQrPayloadFromImage } from './qr-decode';
import { computePHash, hammingDistance } from './perceptual-hash';

/** A photograph-shaped image with no watermark and no QR in it. */
async function flatPhoto(
  width = 900,
  height = 700,
  grey = 190,
): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: grey, g: grey, b: grey } },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
  return new Uint8Array(buf);
}

/* ══════════════════════════════════════════════════════════════════════════
   THE WATERMARK — asserted on the produced pixels
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: every photo comes out of the pipeline marked', async () => {
  // Sabotage run: `watermarkImageBytes` was changed to return the input bytes
  // re-encoded WITHOUT the composite step — exactly what "skip the watermark"
  // looks like in a diff. This test went RED on the bottom-right assertion
  // below (stdev stayed 0.000), and the tsc/lint passes stayed green, which is
  // the whole point of measuring the output. Restored.
  const plain = await flatPhoto();

  const before = await imageRegionStats(plain, 'bottom_right');
  assert.equal(before.stdev, 0, 'the test image must start perfectly flat');

  const marked = await watermarkImageBytes(plain, 'image/jpeg');
  const after = await imageRegionStats(marked.bytes, 'bottom_right');
  const untouched = await imageRegionStats(marked.bytes, 'top_left');

  assert.ok(
    after.stdev > 3,
    `bottom-right must carry the mark (stdev ${after.stdev.toFixed(3)})`,
  );
  assert.ok(
    untouched.stdev < 0.5,
    `top-left must be untouched (stdev ${untouched.stdev.toFixed(3)})`,
  );
});

test('the mark lands on a dark photo too', async () => {
  // A white translucent wordmark alone vanishes on an overexposed sky and a
  // dark plate alone vanishes on a black tuxedo; the overlay carries both.
  for (const grey of [12, 245]) {
    const marked = await watermarkImageBytes(await flatPhoto(800, 600, grey), 'image/jpeg');
    const stats = await imageRegionStats(marked.bytes, 'bottom_right');
    assert.ok(stats.stdev > 3, `grey ${grey}: mark must be visible (${stats.stdev})`);
  }
});

test('the wordmark is SETNAYAN, spelled out', () => {
  // Brand lock: never STNYN.
  assert.equal(WATERMARK_TEXT, 'SETNAYAN');
});

test('an oversized upload is capped, and still marked', async () => {
  const huge = await flatPhoto(4200, 2800);
  const marked = await watermarkImageBytes(huge, 'image/jpeg');
  assert.ok(Math.max(marked.width, marked.height) <= 2000);
  const stats = await imageRegionStats(marked.bytes, 'bottom_right');
  assert.ok(stats.stdev > 3);
});

test('an undecodable upload throws rather than storing an unmarked file', async () => {
  await assert.rejects(
    () => watermarkImageBytes(new Uint8Array([1, 2, 3, 4, 5]), 'image/jpeg'),
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   THE QR CHECK — a real QR code, really decoded
   ══════════════════════════════════════════════════════════════════════════ */

test('a QR code printed into a photo is found', async () => {
  const payload = 'https://bloomandvine.ph/book-us';
  const qr = await QRCode.toBuffer(payload, { width: 320, margin: 2 });
  const photo = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 210, g: 205, b: 198 } },
  })
    .composite([{ input: qr, top: 400, left: 820 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  const found = await decodeQrPayloadFromImage(new Uint8Array(photo));
  assert.equal(found, payload);
});

test('ANY QR blocks here — not only a Setnayan-funnel one', async () => {
  // ⚠ This is deliberately a DIFFERENT rule from lib/vendor-qr-media-guard.ts,
  // which allows non-funnel QR codes because a vendor's own website legitimately
  // shows photos with guest/table QRs in them. On somebody ELSE'S mood board
  // there is no such case, so the payload's content is irrelevant — only that
  // one decoded.
  const qr = await QRCode.toBuffer('table 14 seating', { width: 300, margin: 2 });
  const photo = await sharp({
    create: { width: 1000, height: 700, channels: 3, background: { r: 240, g: 240, b: 240 } },
  })
    .composite([{ input: qr, top: 60, left: 60 }])
    .jpeg()
    .toBuffer();
  const found = await decodeQrPayloadFromImage(new Uint8Array(photo));
  assert.equal(found, 'table 14 seating');
});

test('a clean photograph decodes no QR', async () => {
  assert.equal(await decodeQrPayloadFromImage(await flatPhoto()), null);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE OWN-LOGO CHECK — the technique, on real images
   ══════════════════════════════════════════════════════════════════════════ */

/** A logo with real structure — four elements, the kind a DCT pHash can hold. */
async function richLogo(fmt: 'png' | 'jpeg' = 'png', quality = 90): Promise<Uint8Array> {
  const block = (w: number, h: number, c: [number, number, number]) =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: c[0], g: c[1], b: c[2] } } })
      .png()
      .toBuffer();
  const pipeline = sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).composite([
    { input: await block(120, 120, [30, 40, 90]), top: 40, left: 40 },
    { input: await block(80, 200, [200, 60, 50]), top: 120, left: 220 },
    { input: await block(300, 40, [20, 20, 20]), top: 330, left: 50 },
    { input: await block(60, 60, [240, 200, 40]), top: 20, left: 300 },
  ]);
  const buf = await (fmt === 'png' ? pipeline.png() : pipeline.jpeg({ quality })).toBuffer();
  return new Uint8Array(buf);
}

test('a re-encode of the shop’s own logo stays inside the block threshold', async () => {
  const a = await computePHash(await richLogo('png'));
  const b = await computePHash(await richLogo('jpeg', 70));
  assert.ok(a !== null && b !== null);
  assert.equal(
    hammingDistance(a!, b!) <= 6,
    true,
    'the same logo, re-encoded, must still match itself',
  );
});

test('a different picture falls outside the block threshold', async () => {
  const logo = await computePHash(await richLogo('png'));
  const photo = await computePHash(await flatPhoto(400, 400, 150));
  assert.ok(logo !== null && photo !== null);
  assert.ok(hammingDistance(logo!, photo!) > 6);
});

test('MEASURED: a pHash is UNSTABLE on a low-detail logo, which is why the check calibrates itself', async () => {
  // 🛑 THE FINDING THAT SHAPED lib/moodboard-gallery-screen.server.ts. A single
  // dark bar on white — an extremely common shop-logo shape — hashes 28 of 64
  // bits away FROM ITS OWN JPEG RE-ENCODE. Comparing an upload against a hash
  // that unstable produces a random verdict, and a random HARD BLOCK on a
  // supplier's business is worse than no check. `logoIsHashable` therefore
  // hashes the logo against a re-encode of itself and skips the check when they
  // disagree. If this assertion ever flips — i.e. a flat logo becomes stable —
  // the skip is over-cautious and can be revisited; it is not, today.
  const simple = async (fmt: 'png' | 'jpeg') => {
    const bar = await sharp({
      create: { width: 220, height: 90, channels: 3, background: { r: 30, g: 40, b: 90 } },
    })
      .png()
      .toBuffer();
    const p = sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).composite([{ input: bar, top: 155, left: 90 }]);
    return new Uint8Array(await (fmt === 'png' ? p.png() : p.jpeg({ quality: 70 })).toBuffer());
  };
  const a = await computePHash(await simple('png'));
  const b = await computePHash(await simple('jpeg'));
  assert.ok(a !== null && b !== null);
  assert.ok(
    hammingDistance(a!, b!) > 6,
    'a flat logo is expected to be unstable — that is the reason for the skip',
  );
});
