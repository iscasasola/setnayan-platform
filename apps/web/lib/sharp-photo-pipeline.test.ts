import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ============================================================================
// The Papic photo pipeline, pinned against the IMAGE LIBRARY underneath it.
//
// WHY THIS FILE EXISTS: `sharp` is a direct runtime dependency and EVERY
// uploaded photo passes through it — lib/papic-derivatives.ts derives the
// gallery thumb + lightbox display copy, and hands out the metadata-stripped
// full-res download. Until now nothing exercised that path, so a sharp version
// bump could change what a couple sees (wrong-size tiles) or what a guest
// receives (a photo that still carries the venue's GPS coordinates) with the
// whole suite green. Bumping sharp 0.34 -> 0.35 — a release that removed APIs,
// retuned AVIF quality and raised the Node floor — is exactly that risk.
//
// papic-derivatives.ts itself is `import 'server-only'` (plus the Supabase
// admin + R2 clients), so the Node test runner cannot import it. So this file
// works both halves of the guarantee:
//
//   1. BEHAVIOUR — run the same sharp chains against real bytes and assert the
//      two properties the product actually promises: a derivative honours the
//      long-edge cap and never upscales, and an outbound copy carries NO EXIF.
//      The EXIF test ships a NEGATIVE CONTROL: the identical chain with
//      `keepMetadata()` MUST retain the GPS tags. Without it, "no EXIF found"
//      could just mean the fixture never had any and the test proves nothing.
//
//   2. SOURCE — read lib/papic-derivatives.ts and assert the two structural
//      claims its own docblock makes (rotate-before-resize; never ask sharp to
//      keep metadata). Derived from the real file, so it reddens the day
//      someone adds metadata retention to the photo path.
// ============================================================================

const HERE = dirname(fileURLToPath(import.meta.url));
const DERIVATIVES_SRC = readFileSync(
  resolve(HERE, 'papic-derivatives.ts'),
  'utf8',
);

/** The derivative chain from lib/papic-derivatives.ts `toAvif()`. */
const toAvif = (input: Buffer, longEdge: number, quality: number) =>
  sharp(input)
    .rotate()
    .resize({
      width: longEdge,
      height: longEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .avif({ quality, effort: 4 })
    .toBuffer();

/** The outbound chain from lib/papic-derivatives.ts `stripPhotoMetadata()`. */
const stripPhotoMetadata = (input: Buffer) =>
  sharp(input).rotate().jpeg({ quality: 90 }).toBuffer();

const solidJpeg = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#8899aa' } })
    .jpeg()
    .toBuffer();

/**
 * AVIF-ness, read off the FILE rather than off sharp's own report. sharp
 * describes an AVIF as `format: 'heif', compression: 'av1'` (AVIF is a HEIF
 * container) in both 0.34 and 0.35, so `format` alone cannot tell AVIF from
 * plain HEIC. The ISO-BMFF major brand at bytes 8..12 can.
 */
const isAvif = (buf: Buffer) => buf.subarray(8, 12).toString('latin1') === 'avif';

// --- 1. the derivative still lands at the size the gallery expects ---------

test('a landscape photo is capped on its long edge, aspect ratio intact', async () => {
  const src = await solidJpeg(2000, 1200);

  const displayBuf = await toAvif(src, 1280, 60);
  assert.ok(isAvif(displayBuf), 'lightbox copy should be a real AVIF');
  const display = await sharp(displayBuf).metadata();
  assert.equal(display.width, 1280);
  assert.equal(display.height, 768); // 1200 * (1280/2000)

  const thumbBuf = await toAvif(src, 320, 50);
  assert.ok(isAvif(thumbBuf), 'grid tile should be a real AVIF');
  const thumb = await sharp(thumbBuf).metadata();
  assert.equal(thumb.width, 320);
  assert.equal(thumb.height, 192);
});

test('a portrait photo is capped on its long edge (height), not its width', async () => {
  const src = await solidJpeg(1200, 2000);
  const display = await sharp(await toAvif(src, 1280, 60)).metadata();
  assert.equal(display.width, 768);
  assert.equal(display.height, 1280);
});

test('a photo smaller than the cap is never upscaled', async () => {
  // `withoutEnlargement` — a 200x100 upload must come back 200x100, not
  // stretched to 1280 wide (which would waste bytes and look soft).
  const src = await solidJpeg(200, 100);
  const out = await sharp(await toAvif(src, 1280, 60)).metadata();
  assert.equal(out.width, 200);
  assert.equal(out.height, 100);
});

// --- 2. an outbound copy carries no location ------------------------------

test('the outbound copy drops EXIF/GPS, and the negative control proves it', async () => {
  const base = await solidJpeg(400, 300);
  const withGps = await sharp(base)
    .withExif({
      IFD0: { Model: 'Setnayan-Test-Cam' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '14/1 35/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '121/1 0/1 0/1',
      },
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  // Precondition: the fixture really does carry the tags we claim to strip.
  const source = await sharp(withGps).metadata();
  assert.ok(source.exif, 'fixture should carry an EXIF block');
  assert.match(source.exif.toString('latin1'), /Setnayan-Test-Cam/);

  // Production chain: full resolution kept, EXIF (incl. GPS) gone.
  const stripped = await stripPhotoMetadata(withGps);
  const out = await sharp(stripped).metadata();
  assert.equal(out.width, 400);
  assert.equal(out.height, 300);
  assert.equal(
    out.exif,
    undefined,
    'outbound copy must carry no EXIF — that block is where GPS lives',
  );

  // NEGATIVE CONTROL: identical chain that ASKS sharp to keep metadata must
  // retain the tags. If this ever stops holding, the assertion above is
  // vacuous and this whole test is decorative.
  const kept = await sharp(withGps)
    .rotate()
    .keepMetadata()
    .jpeg({ quality: 90 })
    .toBuffer();
  const keptMeta = await sharp(kept).metadata();
  assert.ok(keptMeta.exif, 'negative control should retain EXIF');
  assert.match(keptMeta.exif.toString('latin1'), /Setnayan-Test-Cam/);
});

// --- 3. the real source still has the shape the behaviour above assumes ----

test('papic-derivatives never asks sharp to keep metadata', () => {
  for (const banned of [
    'keepMetadata',
    'withMetadata',
    'keepExif',
    'withExif',
    'keepIccProfile',
  ]) {
    assert.ok(
      !DERIVATIVES_SRC.includes(`.${banned}(`),
      `lib/papic-derivatives.ts must not call .${banned}() — the photo path relies on sharp dropping EXIF (incl. GPS) by default`,
    );
  }
});

test('papic-derivatives bakes EXIF orientation before it drops metadata', () => {
  // `.rotate()` with no argument applies the EXIF orientation tag to the
  // pixels. It has to run BEFORE the tag is discarded, or sideways phone
  // photos ship sideways.
  for (const fn of ['toAvif', 'stripPhotoMetadata']) {
    const start = DERIVATIVES_SRC.indexOf(`export async function ${fn}(`);
    assert.notEqual(start, -1, `${fn} should exist in lib/papic-derivatives.ts`);
    const body = DERIVATIVES_SRC.slice(start, start + 1200);
    const rotateAt = body.indexOf('.rotate()');
    assert.notEqual(rotateAt, -1, `${fn} should call .rotate()`);
    for (const after of ['.resize(', '.jpeg(', '.avif(']) {
      const at = body.indexOf(after);
      if (at !== -1) {
        assert.ok(
          rotateAt < at,
          `${fn}: .rotate() must come before ${after}`,
        );
      }
    }
  }
});
