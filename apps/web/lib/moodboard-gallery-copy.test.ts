/**
 * THE PUBLIC COPY AND THE PRIVATE COPY ARE PROVABLY DIFFERENT THINGS.
 *
 * MB9's whole exposure story rests on one render existing as two objects:
 *
 *   renders/<event>/<render>.<ext>          the couple's. UNMARKED.
 *   render-gallery/<event>/<render>.jpg     everyone else's. MARKED.
 *
 * Two ways that could collapse into one, both silent:
 *
 *   · the keys converge, so the marked bytes overwrite the couple's own
 *     photograph — they paid for a render and got it defaced;
 *   · `buildGalleryCopy` returns the ORIGINAL bytes under the gallery key, so
 *     an unmarked render is published while every artefact of the watermark
 *     step (the column, the object, the pool listing) is present.
 *
 * This file asserts against both, and against PIXELS for the second — because
 * a boolean saying "marked: true" is precisely what would survive the bug.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  buildGalleryCopy,
  galleryObjectKey,
  pickedRenderObjectKey,
} from './moodboard-gallery-copy';
import { bucketForPrefix } from './bucket-routing';

const FLAT = { r: 128, g: 128, b: 128 };

async function flatImage(width = 800, height = 600): Promise<Buffer> {
  return await sharp({ create: { width, height, channels: 3, background: FLAT } })
    .png()
    .toBuffer();
}

async function deviationInBottomRight(bytes: Buffer): Promise<number> {
  const meta = await sharp(bytes).metadata();
  const w = Math.floor(meta.width! / 3);
  const h = Math.floor(meta.height! / 3);
  const { data, info } = await sharp(bytes)
    .extract({ left: meta.width! - w, top: meta.height! - h, width: w, height: h })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    sum +=
      Math.abs(data[i]! - FLAT.r) +
      Math.abs(data[i + 1]! - FLAT.g) +
      Math.abs(data[i + 2]! - FLAT.b);
  }
  return sum / (data.length / info.channels);
}

test('the gallery key can never collide with the couple’s own render key', () => {
  const key = galleryObjectKey('event-1', 'render-1');
  assert.equal(key, 'render-gallery/event-1/render-1.jpg');
  // `renderObjectKey` in render-actions.ts writes `renders/<event>/<render>.<ext>`.
  // The two prefixes cannot be confused by a `startsWith` in either direction,
  // which is what keeps the marked bytes from ever landing on the unmarked key.
  assert.equal(key.startsWith('renders/'), false);
  assert.equal('renders/event-1/render-1.png'.startsWith('render-gallery/'), false);
});

test('both private keys route to the PRIVATE bucket, and the picked copy to the public one', () => {
  // 🔒 `render-gallery/` does not start with `renders/`, so without its own
  // rule it would fall through to the public `media` default and publish every
  // render — consented or not — the moment it was made.
  assert.equal(bucketForPrefix(galleryObjectKey('e', 'r')), 'threadFiles');
  assert.equal(bucketForPrefix('renders/e/r.png'), 'threadFiles');
  // The picked copy IS public, and only exists once a couple picked a render
  // whose event had consented.
  assert.equal(bucketForPrefix(pickedRenderObjectKey('e', 'r')), 'media');
  assert.equal(pickedRenderObjectKey('e', 'r'), 'inspiration/e/render-r.jpg');
});

test('buildGalleryCopy returns MARKED bytes, not the original, under the gallery key', async () => {
  const original = await flatImage();
  const copy = await buildGalleryCopy({
    eventId: 'event-1',
    renderId: 'render-1',
    bytes: original,
  });

  assert.equal(copy.key, 'render-gallery/event-1/render-1.jpg');
  assert.equal(copy.contentType, 'image/jpeg');
  assert.notEqual(Buffer.compare(copy.bytes, original), 0);

  // THE ASSERTION THAT MATTERS: ink in the pixels, not a flag in an object.
  const marked = await deviationInBottomRight(copy.bytes);
  const unmarked = await deviationInBottomRight(original);
  assert.equal(unmarked, 0, 'the fixture must start out perfectly flat');
  assert.ok(marked > 12, `the gallery copy carries no mark (deviation ${marked})`);
});

test('the key and the bytes come back TOGETHER, so a caller cannot pair one with the other’s', async () => {
  // The upload call site does `r2Upload({ key: gallery.key, body: gallery.bytes })`.
  // Because both fields are produced by one call, there is no arrangement of
  // this function's output that puts unmarked bytes at a `render-gallery/` key
  // — the only way to do that is to stop calling it, which the pixel assertion
  // above and the pool's `gallery_image_key` requirement both catch.
  const copy = await buildGalleryCopy({
    eventId: 'e',
    renderId: 'r',
    bytes: await flatImage(200, 200),
  });
  assert.deepEqual(Object.keys(copy).sort(), ['bytes', 'contentType', 'key']);
});

test('SABOTAGE-PROVEN: the couple’s own copy comes back byte-for-byte untouched', async () => {
  // 🔒 THE OTHER HALF OF THE TWO-KEY STORY, AND THE ONE NOTHING ASSERTED UNTIL
  // MB20. The tests above prove the GALLERY copy is marked. They say nothing
  // about the buffer that was handed in — which is the same buffer the caller
  // then uploads to `renders/<event>/<render>.<ext>`, the photograph the couple
  // paid for. sharp is perfectly capable of mutating a buffer in place, and a
  // marker that did would deface the private master while every assertion in
  // this file stayed green: the gallery copy would still be marked, the keys
  // would still differ, the pixels would still be right.
  //
  // Sabotage run, restored after: `watermarkImageBytes` was changed to write
  // its JPEG back over `input` before returning. This test went RED on the byte
  // comparison, naming the defect. Two neighbouring tests also went red — but
  // on `VipsJpeg: premature end of JPEG image`, because they happened to re-read
  // the fixture afterwards. That is the symptom, several steps downstream, and
  // it reads like a broken test fixture rather than a defaced master. The
  // difference between those two failures is the reason this test is written
  // as a byte comparison against a copy taken BEFORE the call.
  const original = await flatImage(640, 480);
  const pristine = Buffer.from(original); // an independent copy, taken first

  const copy = await buildGalleryCopy({
    eventId: 'event-1',
    renderId: 'render-1',
    bytes: original,
  });

  assert.equal(
    Buffer.compare(original, pristine),
    0,
    'the bytes handed in — the couple’s own copy — were modified in place',
  );
  // And the marked copy is genuinely a different object, not an alias of it.
  assert.notEqual(Buffer.compare(copy.bytes, pristine), 0);
  assert.notEqual(copy.key, 'renders/event-1/render-1.png');

  // The unmarked master still reads as unmarked: no ink anywhere in it.
  assert.equal(await deviationInBottomRight(original), 0);
});

test('bytes that cannot be marked THROW — there is no publish-the-original fallback', async () => {
  await assert.rejects(() =>
    buildGalleryCopy({ eventId: 'e', renderId: 'r', bytes: Buffer.from('nope') }),
  );
});

/**
 * MB27 · THE RENDER POOL GETS THE **STAMP**, AND WOULD NOTICE IF IT DIDN'T.
 *
 * `buildGalleryCopy` calls `watermarkImageBytes(args.bytes)` with no variant,
 * and the parameter defaults to `'stamp'` — so renders already carry
 * `WWW.SETNAYAN.COM` on a filled pill, and owner question 4 of 2026-09-05 was
 * closed by the code as it stood. Nothing was built here. This is the guard
 * that keeps it closed.
 *
 * 🔑 THE SECOND SABOTAGE IS ALREADY COVERED — cited, not duplicated. Dropping
 * the `watermarkImageBytes` call entirely goes red on "buildGalleryCopy returns
 * MARKED bytes, not the original, under the gallery key" above, which reads the
 * bottom-right pixels. What NOTHING asserted before MB27 is WHICH mark: a
 * refactor that threaded a variant through and passed `'seal'` would keep every
 * existing test green while putting the celebration badge — the mark reserved
 * for photographs of events Setnayan actually ran — on generated renders.
 *
 * ⚠ THE DISCRIMINATOR IS THE OPPOSITE CORNER, not the bottom-right one. Both
 * marks put ink bottom-right, so reading there cannot tell them apart. The seal
 * is the only variant that also writes the URL in the bottom-LEFT (see
 * `sealLayers`), and the stamp is the only one with a filled plate. Both are
 * asserted, so the test fails on `'seal'` for two independent reasons.
 */
test('the gallery copy is produced with the STAMP variant, not the seal', async () => {
  const { bytes } = await buildGalleryCopy({
    eventId: 'event-mb27',
    renderId: 'render-mb27',
    bytes: await flatImage(900, 700),
  });

  const meta = await sharp(bytes).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const qw = Math.floor(w / 3);
  const qh = Math.floor(h / 4);

  const region = async (left: number, top: number) => {
    const { data, info } = await sharp(bytes)
      .extract({ left, top, width: qw, height: qh })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let dev = 0;
    let dark = 0;
    for (const v of data) {
      dev += Math.abs(v - FLAT.r);
      if (v < FLAT.r - 12) dark += 1;
    }
    return { dev: dev / data.length, darkShare: dark / (info.width * info.height) };
  };

  const right = await region(w - qw, h - qh);
  const left = await region(0, h - qh);

  // The stamp's filled pill: a real block of darker-than-background pixels.
  assert.ok(right.darkShare > 0.03, `the stamp's plate must be there (got ${right.darkShare})`);
  // The seal's giveaway: it is the only variant that marks the bottom-LEFT.
  assert.ok(
    left.dev < 0.5,
    `the bottom-left corner carries ink — that is the SEAL, and renders take the stamp (dev ${left.dev})`,
  );
});
