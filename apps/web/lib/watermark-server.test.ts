/**
 * THE WATERMARK IS ASSERTED ON PIXELS, NOT ON A FLAG.
 *
 * 🔑 THE FAILURE THIS FILE EXISTS TO CATCH: a pipeline that records
 * `gallery_image_key` while the bytes at that key are the untouched original.
 * Every artefact of "we watermarked it" would be present — the column filled,
 * the object stored, the pool listing it — and nothing on any screen would look
 * wrong. A test that asserted `result.watermarked === true`, or that the
 * function was called, would pass through that unchanged.
 *
 * So every assertion below DECODES THE OUTPUT AND READS ITS PIXELS. The input
 * is a flat, single-colour image, which makes the question exact: any pixel
 * that is no longer that colour is ink this function put there.
 *
 * ⚠ AND IT CHECKS *WHERE*. Asserting only "the bytes changed" would pass on a
 * JPEG re-encode of the original — sharp changes almost every byte of a PNG
 * turned into a JPEG without drawing anything at all. So the corner the mark is
 * anchored in must differ, AND the opposite corner must still be the original
 * colour: together those say a mark was drawn rather than the image merely
 * having been through the encoder.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { watermarkImageBytes, GALLERY_MAX_EDGE } from './watermark-server';

/** A flat mid-grey canvas: every pixel identical, so any change is the mark. */
const FLAT = { r: 128, g: 128, b: 128 };

async function flatImage(width = 900, height = 600): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 3, background: FLAT },
  })
    .png()
    .toBuffer();
}

/** Mean absolute deviation from the flat colour inside one region. */
async function inkIn(
  bytes: Buffer,
  region: { left: number; top: number; width: number; height: number },
): Promise<number> {
  const { data, info } = await sharp(bytes)
    .extract(region)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let sum = 0;
  const channels = info.channels;
  for (let i = 0; i < data.length; i += channels) {
    sum +=
      Math.abs(data[i]! - FLAT.r) +
      Math.abs(data[i + 1]! - FLAT.g) +
      Math.abs(data[i + 2]! - FLAT.b);
  }
  return sum / (data.length / channels);
}

test('the mark is drawn into the bottom-right of the output, in real pixels', async () => {
  const input = await flatImage();
  const out = await watermarkImageBytes(input);

  const meta = await sharp(out.bytes).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // The quarter the mark is anchored in, and the quarter it is nowhere near.
  const qw = Math.floor(width / 3);
  const qh = Math.floor(height / 3);
  const marked = await inkIn(out.bytes, {
    left: width - qw,
    top: height - qh,
    width: qw,
    height: qh,
  });
  const untouched = await inkIn(out.bytes, { left: 0, top: 0, width: qw, height: qh });

  // JPEG is lossy, so "untouched" is near-zero rather than exactly zero. The
  // gap between the two is what says a mark exists.
  assert.ok(untouched < 3, `top-left should still be flat grey, deviation was ${untouched}`);
  assert.ok(
    marked > 12,
    `bottom-right should carry the SETNAYAN mark, deviation was only ${marked}`,
  );
  assert.ok(marked > untouched * 6, 'the mark must be the only thing that changed the image');
});

test('the output is JPEG and is not the input bytes', async () => {
  const input = await flatImage();
  const out = await watermarkImageBytes(input);
  assert.equal(out.contentType, 'image/jpeg');
  assert.equal((await sharp(out.bytes).metadata()).format, 'jpeg');
  assert.notEqual(Buffer.compare(Buffer.from(input), out.bytes), 0);
});

test('a huge render is bounded, and a small one is never enlarged', async () => {
  const big = await watermarkImageBytes(await flatImage(3000, 2000));
  assert.equal(big.width, GALLERY_MAX_EDGE);

  const small = await watermarkImageBytes(await flatImage(320, 240));
  assert.equal(small.width, 320);
  assert.equal(small.height, 240);
});

test('the mark scales with the image rather than vanishing on a large one', async () => {
  for (const [w, h] of [
    [640, 640],
    [1600, 900],
    [700, 1400],
  ] as const) {
    const out = await watermarkImageBytes(await flatImage(w, h));
    const meta = await sharp(out.bytes).metadata();
    const qw = Math.floor(meta.width! / 3);
    const qh = Math.floor(meta.height! / 3);
    const marked = await inkIn(out.bytes, {
      left: meta.width! - qw,
      top: meta.height! - qh,
      width: qw,
      height: qh,
    });
    assert.ok(marked > 12, `${w}x${h} lost its mark (deviation ${marked})`);
  }
});

test('bytes that are not an image THROW rather than passing the original through', async () => {
  // 🔒 THE DIRECTION MATTERS. A "return the input on failure" branch is exactly
  // how an unmarked image would reach the pool, so there must not be one.
  await assert.rejects(() => watermarkImageBytes(Buffer.from('not an image at all')));
});
