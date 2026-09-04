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

test('bytes that cannot be marked THROW — there is no publish-the-original fallback', async () => {
  await assert.rejects(() =>
    buildGalleryCopy({ eventId: 'e', renderId: 'r', bytes: Buffer.from('nope') }),
  );
});
