/**
 * THE MARK IS WHOLE, IT IS INSIDE ITS PLATE, AND THE RIGHT ONE IS ON THE RIGHT
 * PHOTOGRAPH (MB20).
 *
 * ── THE DEFECT THIS FILE IS SHAPED AROUND ─────────────────────────────────
 * 🛑 AN OVERFLOW IS NOT A CRASH. The plate used to be sized by an estimate —
 * `fontSize * (WATERMARK_TEXT.length * 0.72 + 1.4)` — tuned against the
 * 8-letter word. At 16 characters the ink came out WIDER than the plate
 * (measured 2026-09-04: 441 vs 426 · 524 vs 504 · 581 vs 568), so satori's
 * centred row was sheared 7–10px off EACH END by the SVG viewport. And then
 * everything succeeded: sharp composited, the corner stopped being flat, the
 * bytes changed, the content type was right. Every test that asked "is there
 * ink in the bottom-right third" stayed green while the public gallery carried
 * `WW.SETNAYAN.CO`.
 *
 * So "a mark was drawn" is not the question this file asks. It asks THREE
 * harder ones, all of them off the produced pixels:
 *
 *   1. is there ink where the mark claims to be, on BOTH pools' images?
 *   2. does the wordmark sit INSIDE its plate with real padding on every side
 *      — and is the area just outside the plate untouched?
 *   3. is the seal on the celebrations and the stamp on everything else?
 *
 * ── HOW GEOMETRY IS USED HERE, AND HOW IT IS NOT ──────────────────────────
 * 🔑 `result.geometry` IS A MAP, NOT A RECEIPT, and this file never lets it be
 * the verdict. A sabotage that dropped the composite entirely would return the
 * same geometry, fully populated — so geometry only ever chooses WHERE the
 * `.raw()` read points, and the answer always comes from the bytes at those
 * coordinates. See [[a-flag-in-an-object-is-not-ink-in-the-pixels]].
 *
 * One test deliberately uses NO geometry at all (`a fixed corner`), so a
 * sabotage that moved the mark somewhere convenient and reported it honestly
 * still goes red.
 *
 * ⚠ Regions are read with `.raw()`, never `.stats()` — sharp evaluates
 * `.stats()` against the INPUT and discards an `.extract()` queued in front of
 * it. See [[sharp-stats-ignores-extract]].
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  watermarkImageBytes,
  markVariantForSource,
  WATERMARK_TEXT,
  SEAL_NAME_TEXT,
  SEAL_SUB_TEXT,
  type MarkBox,
  type WatermarkVariant,
} from './watermark-server';

/** A flat canvas: every pixel identical, so any other value is ink we drew. */
async function flat(width = 900, height = 600, grey = 128): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 3, background: { r: grey, g: grey, b: grey } },
  })
    .png()
    .toBuffer();
}

/** One region of the OUTPUT, as greyscale bytes. Never `.stats()`. */
async function readRegion(
  bytes: Buffer,
  box: MarkBox,
): Promise<{ px: number[]; width: number; height: number }> {
  const { data, info } = await sharp(bytes)
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { px: [...data], width: info.width, height: info.height };
}

/** Mean |pixel − background| inside a region: 0 means nothing was drawn there. */
async function deviation(bytes: Buffer, box: MarkBox, background: number): Promise<number> {
  const { px } = await readRegion(bytes, box);
  let sum = 0;
  for (const v of px) sum += Math.abs(v - background);
  return sum / px.length;
}

const area = (b: MarkBox) => b.width * b.height;
const footprint = (g: { plate: MarkBox | null; ink: MarkBox[] }) =>
  g.plate ? area(g.plate) : g.ink.reduce((s, b) => s + area(b), 0);

function contains(outer: MarkBox, inner: MarkBox): boolean {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width &&
    inner.top + inner.height <= outer.top + outer.height
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1 · EVERY PHOTO ENTERING EITHER POOL CARRIES A MARK
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: both marks put real ink on the produced image', async () => {
  // Sabotage run, restored after: `watermarkImageBytes` was changed to skip
  // `.composite(mark.layers)` and re-encode the resized bytes alone — the shape
  // of "drop the watermark" in a diff, and it still returns a populated
  // `geometry`, the right width/height and a valid JPEG. Every deviation below
  // fell to 0.00 and this test went RED on the first variant. Restored.
  for (const variant of ['stamp', 'seal'] as const) {
    const out = await watermarkImageBytes(await flat(), variant);
    const boxes = out.geometry.plate ? [out.geometry.plate] : out.geometry.ink;
    for (const [i, box] of boxes.entries()) {
      const dev = await deviation(out.bytes, box, 128);
      assert.ok(
        dev > 6,
        `${variant} box ${i} carries no ink — mean deviation ${dev.toFixed(2)}`,
      );
    }
    // And the far corner is still the photograph, so the deviation above is a
    // mark and not a re-encode of the whole frame.
    const clean = await deviation(
      out.bytes,
      { left: 0, top: 0, width: 200, height: 150 },
      128,
    );
    assert.ok(clean < 1, `${variant} disturbed the top-left corner (${clean.toFixed(2)})`);
  }
});

test('the mark survives a white dress and a black tuxedo, in both variants', async () => {
  // A white translucent mark alone vanishes on an overexposed sky; a dark mark
  // alone vanishes on a black suit. The stamp answers this with its plate; the
  // seal — which has no plate, on purpose — answers it with the offset dark
  // copy under every element. Both claims are checked here rather than assumed.
  for (const grey of [12, 248]) {
    for (const variant of ['stamp', 'seal'] as const) {
      const out = await watermarkImageBytes(await flat(1000, 700, grey), variant);
      for (const box of out.geometry.ink) {
        const dev = await deviation(out.bytes, box, grey);
        assert.ok(
          dev > 6,
          `${variant} on grey ${grey}: mark is invisible (deviation ${dev.toFixed(2)})`,
        );
      }
    }
  }
});

test('a fixed corner carries the mark, with no geometry consulted at all', async () => {
  // 🔒 THE ONE TEST THAT TRUSTS NOTHING THE FUNCTION SAYS. If a change moved
  // the mark and updated `geometry` to match, every other assertion here would
  // follow it. This one does not: the bottom-right quarter is where the mark
  // belongs, and it is named as a constant, not read back.
  for (const variant of ['stamp', 'seal'] as const) {
    const out = await watermarkImageBytes(await flat(1000, 800), variant);
    const dev = await deviation(
      out.bytes,
      { left: 500, top: 400, width: 500, height: 400 },
      128,
    );
    assert.ok(dev > 0.5, `${variant}: the bottom-right quarter is bare (${dev.toFixed(2)})`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · THE MARK FITS — INSIDE THE IMAGE, AND INSIDE ITS PLATE
   ══════════════════════════════════════════════════════════════════════════ */

test('SABOTAGE-PROVEN: the wordmark has clear plate on all four sides', async () => {
  // 🛑 THIS IS THE MB20 BUG, ASSERTED. Sabotage run, restored after: the plate
  // was sized back to `fontSize * (WATERMARK_TEXT.length * 0.72 + 1.4)` and the
  // satori canvas back to that plate. The composite still succeeded, the image
  // still looked marked, and ELEVEN OF THE TWELVE TESTS IN THIS FILE STAYED
  // GREEN — only this one went red, on `padding 1px` at the left of the plate,
  // where the sheared "W" runs into the edge. Measured padding with the fix:
  // 11–15px horizontally, 13–18px vertically.
  for (const [w, h] of [
    [900, 600],
    [1000, 800],
    [700, 1400],
  ] as const) {
    const out = await watermarkImageBytes(await flat(w, h), 'stamp');
    const plate = out.geometry.plate;
    assert.ok(plate, 'the stamp must have a plate');

    const { px, width, height } = await readRegion(out.bytes, plate!);
    // Glyphs are near-white over a dark plate; the plate itself is far darker
    // than the flat grey. "Light" therefore means letterform, unambiguously.
    let firstCol = -1;
    let lastCol = -1;
    let firstRow = -1;
    let lastRow = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (px[y * width + x]! > 190) {
          if (firstCol < 0 || x < firstCol) firstCol = x;
          if (x > lastCol) lastCol = x;
          if (firstRow < 0) firstRow = y;
          lastRow = y;
        }
      }
    }
    assert.ok(firstCol >= 0, `${w}x${h}: no glyphs on the plate at all`);
    const pads = {
      left: firstCol,
      right: width - 1 - lastCol,
      top: firstRow,
      bottom: height - 1 - lastRow,
    };
    for (const [side, value] of Object.entries(pads)) {
      assert.ok(
        value >= 3,
        `${w}x${h}: the wordmark touches the ${side} of its plate (padding ${value}px) — ` +
          `this is what a sheared "${WATERMARK_TEXT}" looks like`,
      );
    }
  }
});

test('nothing is drawn OUTSIDE the plate', async () => {
  // The other half of the same question. A mark that hung off its plate would
  // still be "inside the image" and would still light up every corner test.
  // Measured with the fix: exactly 0 light and 0 dark pixels in these bands.
  // The band starts 6px clear of the plate so JPEG ringing is not the finding.
  const out = await watermarkImageBytes(await flat(1000, 800), 'stamp');
  const plate = out.geometry.plate!;
  const bands: Array<[string, MarkBox]> = [
    [
      'left of the plate',
      { left: plate.left - 30, top: plate.top, width: 24, height: plate.height },
    ],
    [
      'above the plate',
      { left: plate.left, top: plate.top - 30, width: plate.width, height: 24 },
    ],
  ];
  for (const [where, box] of bands) {
    const { px } = await readRegion(out.bytes, box);
    const strayLight = px.filter((v) => v > 190).length;
    const strayDark = px.filter((v) => v < 110).length;
    assert.ok(strayLight <= 2, `${strayLight} glyph pixels ${where}`);
    assert.ok(strayDark <= 2, `${strayDark} plate pixels ${where}`);
  }
});

test('every box the geometry names is inside the image, and the ink inside its plate', async () => {
  // The arithmetic half. `watermark-server.ts` throws on a mark that does not
  // fit (`assertInside`), so this is a second, independent statement of the
  // same invariant — including on the two shapes most likely to break it: a
  // very tall crop and an image narrower than the wordmark's natural width.
  for (const [w, h] of [
    [900, 600],
    [320, 240],
    [700, 1400],
    [1280, 300],
  ] as const) {
    for (const variant of ['stamp', 'seal'] as const) {
      const out = await watermarkImageBytes(await flat(w, h), variant);
      const image: MarkBox = { left: 0, top: 0, width: out.width, height: out.height };
      for (const box of out.geometry.ink) {
        assert.ok(box.width > 0 && box.height > 0, `${w}x${h} ${variant}: empty ink box`);
        assert.ok(contains(image, box), `${w}x${h} ${variant}: ink escapes the image`);
        if (out.geometry.plate) {
          assert.ok(
            contains(out.geometry.plate, box),
            `${w}x${h} ${variant}: ink escapes its plate`,
          );
        }
      }
      if (out.geometry.plate) {
        assert.ok(contains(image, out.geometry.plate), `${w}x${h}: plate escapes the image`);
      }
    }
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE SEAL ONLY ON A CELEBRATION, THE STAMP ONLY ON EVERYTHING ELSE
   ══════════════════════════════════════════════════════════════════════════ */

test('the column decides the mark, in both directions', () => {
  assert.equal(markVariantForSource(null), 'stamp');
  assert.equal(markVariantForSource(undefined), 'stamp');
  assert.equal(markVariantForSource('S89E-7QK2M4XR0N'), 'seal');
  // 🔑 BOTH DIRECTIONS, because a function that returned 'stamp' for everything
  // passes the first two lines on its own, and one that returned 'seal' for
  // everything passes the third.
  const variants = new Set<WatermarkVariant>([
    markVariantForSource(null),
    markVariantForSource('e'),
  ]);
  assert.equal(variants.size, 2, 'the two inputs must not map to the same mark');
});

test('the stamp has a filled plate and the seal does not — measured, not declared', async () => {
  // `plate: null` is a claim; this reads the pixels the claim is about. A filled
  // pill is overwhelmingly darker than the photograph across its whole box; an
  // outlined badge is mostly untouched photograph with a thin frame and two
  // words in it. Measured: stamp 0.798–0.806 dark, seal 0.066–0.080.
  const stamp = await watermarkImageBytes(await flat(1000, 800), 'stamp');
  const seal = await watermarkImageBytes(await flat(1000, 800), 'seal');

  assert.notEqual(stamp.geometry.plate, null);
  assert.equal(seal.geometry.plate, null);

  const stampFill = (await readRegion(stamp.bytes, stamp.geometry.plate!)).px;
  const sealFill = (await readRegion(seal.bytes, seal.geometry.ink[0]!)).px;
  const darkFrac = (px: number[]) => px.filter((v) => v < 110).length / px.length;

  assert.ok(darkFrac(stampFill) > 0.6, `the stamp's plate is not filled (${darkFrac(stampFill)})`);
  assert.ok(
    darkFrac(sealFill) < 0.25,
    `the seal drew a filled plate (${darkFrac(sealFill)}) — it is supposed to be an outline`,
  );
});

test('the seal is SMALLER than the stamp, on every shape', async () => {
  // 🔑 THE OWNER'S RULE, PINNED. A heavier mark on Setnayan's own celebrations
  // would deface exactly the material it exists to distinguish, so a later
  // "make the seal stand out more" has to argue with this test rather than
  // slip past it. The standing-out is done in the picker, not in the pixels.
  for (const [w, h] of [
    [900, 600],
    [1000, 800],
    [700, 1400],
    [320, 240],
  ] as const) {
    const stamp = await watermarkImageBytes(await flat(w, h), 'stamp');
    const seal = await watermarkImageBytes(await flat(w, h), 'seal');
    assert.ok(
      footprint(seal.geometry) < footprint(stamp.geometry),
      `${w}x${h}: seal ${footprint(seal.geometry)} is not smaller than stamp ${footprint(
        stamp.geometry,
      )}`,
    );
  }
});

test('the two variants really produce different pixels', async () => {
  // Otherwise the whole split is a parameter nothing reads.
  const input = await flat(1000, 800);
  const stamp = await watermarkImageBytes(input, 'stamp');
  const seal = await watermarkImageBytes(input, 'seal');
  assert.notEqual(Buffer.compare(stamp.bytes, seal.bytes), 0);
  // And the seal marks the bottom-LEFT, which the stamp never touches. A FIXED
  // box, not one read back from `geometry` — measured on this fixture at
  // 3.96 for the seal against 0.00 for the stamp.
  const box: MarkBox = { left: 8, top: 750, width: 220, height: 44 };
  const sealDev = await deviation(seal.bytes, box, 128);
  const stampDev = await deviation(stamp.bytes, box, 128);
  assert.ok(sealDev > 1.5, `the seal's URL is missing bottom-left (${sealDev.toFixed(2)})`);
  assert.ok(stampDev < 0.5, `the stamp marked the bottom-left (${stampDev.toFixed(2)})`);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE WORDS THEMSELVES
   ══════════════════════════════════════════════════════════════════════════ */

test('the mark is the URL, and the seal spells SETNAYAN out', () => {
  assert.equal(WATERMARK_TEXT, 'WWW.SETNAYAN.COM');
  // Brand lock: never STNYN, and never a truncation of it.
  assert.equal(SEAL_NAME_TEXT, 'SETNAYAN');
  assert.equal(SEAL_SUB_TEXT, 'CELEBRATION');
  assert.ok(WATERMARK_TEXT.includes(SEAL_NAME_TEXT));
});

test('bytes that are not an image THROW in either variant', async () => {
  // 🔒 THE DIRECTION MATTERS. A "return the input on failure" branch is exactly
  // how an unmarked image would reach a public pool, so there must not be one
  // on either path.
  for (const variant of ['stamp', 'seal'] as const) {
    await assert.rejects(() => watermarkImageBytes(Buffer.from('not an image'), variant));
  }
});
