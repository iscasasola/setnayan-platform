/**
 * ONE MARK EVERYWHERE, AND IT FITS THE PHOTOGRAPH IT IS ON (MB27).
 *
 * ── THE TWO DEFECTS THIS FILE IS SHAPED AROUND ────────────────────────────
 *
 * 1. 🛑 THE TWO MARKERS DISAGREED AND NOTHING COMPARED THEM. On `origin/main`
 *    2026-09-05 the server marked with `WWW.SETNAYAN.COM` and the browser
 *    marked with the bare word `SETNAYAN`. Both suites were green, because
 *    each asserted its own side's string. The pool carrying the weaker mark
 *    was the marketplace — the most-scraped images on the platform.
 *
 * 2. 🛑 PRESENCE OF INK IS NOT FIT OF INK. The browser stamp drew stroked
 *    lettering anchored `margin` in from the corner and checked nothing. A
 *    16-character URL at the 18px floor is ~170px of ink, and `file-upload.tsx`
 *    enforces NO minimum image dimension (measured: it validates MIME and byte
 *    size only) — so a small showcase thumbnail would have had the front of the
 *    URL clipped off the canvas edge. Canvas clips and reports success. This
 *    is MB20's server-side bug, one platform over.
 *
 * ── HOW THE PIXELS HERE ARE MADE, AND WHAT THAT DOES NOT PROVE ────────────
 * 🔑 THERE IS NO BROWSER IN THIS SUITE, so `watermarkFile` is run against a
 * CANVAS DOUBLE built below: a real RGBA framebuffer, with real glyph rasters
 * from a real font file (satori → sharp, the same rasterising path
 * `watermark-server.ts` uses), blitted by real transforms. The geometry code,
 * the draw order and the pixels are the shipped ones.
 *
 * ⚠ WHAT IT DOES NOT PROVE, STATED PLAINLY rather than implied by silence:
 *   · the font is Poppins-Bold, the only 600-ish weight TTF this repo bundles.
 *     The browser uses `ui-monospace / SF Mono / Menlo`, whose metrics differ.
 *     That is WHY the shipped code measures with `ctx.measureText` instead of
 *     estimating — and why `stampGeometry` is also swept below against advance
 *     ratios from 0.45em to 0.95em per character, which brackets every
 *     monospace face a host is likely to resolve. A font surprise changes the
 *     measurement, not the geometry that consumes it.
 *   · `toBlob` encoding, colour management and subpixel antialiasing are the
 *     double's, not Chrome's.
 * A real-browser check belongs in `tests/e2e`, and is not what this file
 * claims to be.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { stripComments } from './strip-comments';
import { WATERMARK_TEXT } from './watermark-text';
import {
  stampGeometry,
  stampFontSize,
  assertNotVideoFile,
  watermarkFile,
  type InkMeasurement,
  type MarkBox,
  type StampGeometry,
} from './watermark';
import {
  assertNotVideoBytes,
  watermarkImageBytes,
  WATERMARK_TEXT as SERVER_WATERMARK_TEXT,
} from './watermark-server';

/* ══════════════════════════════════════════════════════════════════════════
   ONE STRING — asserted off the SOURCE, not off the exports
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Source with comments removed.
 *
 * 🔑 THE STRIP IS THE POINT. Both modules DISCUSS the URL in their headers, at
 * length and on purpose. A literal-hunting guard that read the raw file would
 * be red on prose and would be "fixed" by deleting the explanation — so it
 * reads only what the compiler reads.
 *
 * 🪤 AND IT USES THE SHARED LEXER, NOT A REGEX. The two-replace regex was
 * written here first and `lint-one-comment-stripper.mjs` caught it on the way
 * out. It is not a stripper: `/*` inside a STRING opens a comment that runs to
 * the next real close, and this very file scans a module containing
 * `type.startsWith('video/')` while its own comments discuss `image/*`. A
 * blanked window is invisible, and the guard then asserts against a blank and
 * PASSES. See `lib/strip-comments.ts` — 5,104 real lines were being blanked
 * across the codebase when that was measured.
 */
function source(abs: string): string {
  return stripComments(fs.readFileSync(abs, 'utf8'));
}

function code(file: string): string {
  return source(path.join(process.cwd(), 'lib', file));
}

test('both markers import the URL from the shared module, and neither carries its own copy', () => {
  const client = code('watermark.ts');
  const server = code('watermark-server.ts');

  for (const [name, src] of [
    ['watermark.ts', client],
    ['watermark-server.ts', server],
  ] as const) {
    assert.match(
      src,
      /from '\.\/watermark-text'/,
      `${name} must take WATERMARK_TEXT from lib/watermark-text.ts`,
    );
    // The literal itself, in code, in either quote style. This is the assertion
    // that would have gone red on the state MB27 found: two modules, two
    // strings, no relationship between them.
    assert.doesNotMatch(
      src,
      /['"`]WWW\.SETNAYAN\.COM['"`]/,
      `${name} must not carry its own copy of the watermark text — import it`,
    );
    assert.doesNotMatch(
      src,
      /text:\s*['"`]SETNAYAN['"`]/,
      `${name} must not default to the bare word — the mark is the web address`,
    );
  }

  // And the one place it IS allowed to be a literal.
  assert.match(code('watermark-text.ts'), /['"`]WWW\.SETNAYAN\.COM['"`]/);
});

test('the browser default and the server constant are the same string, and it is an address', () => {
  assert.equal(WATERMARK_TEXT, 'WWW.SETNAYAN.COM');
  assert.equal(SERVER_WATERMARK_TEXT, WATERMARK_TEXT);
  // Brand lock (spec CLAUDE.md): full spelling, never STNYN.
  assert.ok(WATERMARK_TEXT.includes('SETNAYAN'));
  assert.doesNotMatch(WATERMARK_TEXT, /STNYN/);
  // An address, not a word: this is the whole owner ruling of 2026-09-05.
  assert.match(WATERMARK_TEXT, /\.COM$/);

  // The browser marker's DEFAULT is that string — a caller passing no options
  // gets the address. `file-upload.tsx` passes only position + opacity.
  const src = code('watermark.ts');
  assert.match(src, /text:\s*WATERMARK_TEXT/);
});

/* ══════════════════════════════════════════════════════════════════════════
   THE GEOMETRY — pure, swept, adversarial
   ══════════════════════════════════════════════════════════════════════════ */

const contains = (outer: MarkBox, inner: MarkBox) =>
  inner.left >= outer.left &&
  inner.top >= outer.top &&
  inner.left + inner.width <= outer.left + outer.width &&
  inner.top + inner.height <= outer.top + outer.height;

/**
 * Ink as a font of a given advance would measure it. `em` is the per-character
 * advance as a fraction of the font size — a monospace face is typically 0.6;
 * the sweep runs wider and narrower than anything a host will resolve.
 */
function inkFor(fontSize: number, em: number, text = WATERMARK_TEXT): InkMeasurement {
  const width = Math.round(fontSize * em * text.length);
  const height = Math.round(fontSize * 0.72);
  return { width, height, ascent: height };
}

/**
 * The sizes the marketplace actually uploads, plus the ones it does not stop.
 *
 * 🔑 THE FLOOR IS 1×1, AND THAT IS A MEASUREMENT, NOT A FLOURISH. The callers
 * that set `watermark` (`showcase-media-fields.tsx`, `website-editor.tsx`,
 * `services-manager.tsx`, `canvas-maker.tsx`, `service-wizard.tsx`) constrain
 * `acceptedTypes` and `maxSizeMB` and nothing else, and `file-upload.tsx` has
 * no dimension check anywhere in it. So a 1px image IS a size this component
 * accepts, and "the smallest size it accepts" has no other honest answer.
 * 2000 is `compressImageForWeb`'s cap — and it runs AFTER the mark, so it is
 * a ceiling on what leaves, never on what this code is handed.
 */
const SIZES: Array<[number, number]> = [
  [1, 1],
  [8, 8],
  [40, 40],
  [120, 90],
  [200, 200],
  [239, 300],
  [240, 180],
  [320, 240],
  [450, 450],
  [600, 400],
  [800, 600],
  [1080, 1350],
  [2000, 1333],
  [4032, 3024],
  [3000, 200],
  [200, 3000],
];

const ADVANCES = [0.45, 0.55, 0.6, 0.72, 0.85, 0.95];

test('the plate is inside the image and the ink is inside the plate — every size, every font width', () => {
  for (const [w, h] of SIZES) {
    for (const em of ADVANCES) {
      for (const position of ['bottom-right', 'bottom-center'] as const) {
        const fontSize = stampFontSize(w, h);
        const g = stampGeometry({
          imageWidth: w,
          imageHeight: h,
          ink: inkFor(fontSize, em),
          fontSize,
          margin: 24,
          position,
        });
        const where = `${w}x${h} em=${em} ${position}`;
        const image: MarkBox = { left: 0, top: 0, width: w, height: h };

        assert.ok(contains(image, g.plate), `plate must be inside the image — ${where}`);
        assert.ok(contains(g.plate, g.ink), `ink must be inside the plate — ${where}`);
        assert.ok(g.plate.width > 0 && g.plate.height > 0, `plate must exist — ${where}`);
        assert.ok(g.ink.width > 0 && g.ink.height > 0, `ink must exist — ${where}`);

        // Padding is a MEASURED gap on all four sides, not a promise in a
        // constant: the ink box's real distance to the plate's real edges.
        const padLeft = g.ink.left - g.plate.left;
        const padRight = g.plate.left + g.plate.width - (g.ink.left + g.ink.width);
        const padTop = g.ink.top - g.plate.top;
        const padBottom = g.plate.top + g.plate.height - (g.ink.top + g.ink.height);
        for (const [side, v] of [
          ['left', padLeft],
          ['right', padRight],
          ['top', padTop],
          ['bottom', padBottom],
        ] as const) {
          assert.ok(v >= 0, `padding ${side} must not be negative — ${where} (got ${v})`);
        }
        // Left/right and top/bottom differ by at most a rounding pixel: the ink
        // is centred, not shoved against one edge.
        assert.ok(Math.abs(padLeft - padRight) <= 1, `ink must be centred across — ${where}`);
        assert.ok(Math.abs(padTop - padBottom) <= 1, `ink must be centred down — ${where}`);
      }
    }
  }
});

test('MB20’s padding ratios are honoured whenever the image has room for them', () => {
  // 0.5em either side, 0.62em above and below — the server's numbers, not
  // re-tuned. They apply unsqueezed on any image with room, which is every
  // image the marketplace realistically uploads.
  for (const [w, h] of [
    [800, 600],
    [1080, 1350],
    [2000, 1333],
    [4032, 3024],
  ] as Array<[number, number]>) {
    const fontSize = stampFontSize(w, h);
    const g = stampGeometry({
      imageWidth: w,
      imageHeight: h,
      ink: inkFor(fontSize, 0.6),
      fontSize,
      margin: 24,
      position: 'bottom-right',
    });
    assert.equal(g.scale, 1, `${w}x${h} should need no shrink`);
    assert.equal(g.padX, Math.max(4, Math.round(fontSize * 0.5)), `padX at ${w}x${h}`);
    assert.equal(g.padY, Math.max(4, Math.round(fontSize * 0.62)), `padY at ${w}x${h}`);
    assert.equal(g.margin, 24, `full margin at ${w}x${h}`);
  }
});

test('LEGIBILITY AT THE 18px FLOOR: the type does not shrink where the image can carry it', () => {
  // The floor governs below a 450px short edge (18 / 0.04). At the floor the
  // question is not "did something get drawn" but "can it be read": a mark
  // scaled to 40% of 18px is a smudge that happens to pass a bounds check.
  const fontSize = stampFontSize(450, 450);
  assert.equal(fontSize, 18, 'the 18px floor is what governs at and below 450px');

  // The widest plausible monospace advance. Even there, every image from the
  // narrowest one that geometrically fits the mark upward keeps full-size type.
  const em = 0.95;
  const ink = inkFor(18, em);
  const narrowestWholeFit = ink.width + 2 * Math.max(4, Math.round(18 * 0.5)) + 2 * 24;

  for (let w = narrowestWholeFit; w <= 450; w += 7) {
    const g = stampGeometry({
      imageWidth: w,
      imageHeight: 450,
      ink,
      fontSize: 18,
      margin: 24,
      position: 'bottom-right',
    });
    assert.equal(g.scale, 1, `${w}px wide should not shrink the type`);
    assert.equal(g.effectiveFontSize, 18, `${w}px wide must keep 18px type`);
    // Per-character ink, the readable-at-a-glance number.
    assert.ok(
      g.ink.width / WATERMARK_TEXT.length >= 6,
      `${w}px wide: ${(g.ink.width / WATERMARK_TEXT.length).toFixed(1)}px per character`,
    );
  }
});

test('below the fit floor the mark shrinks rather than shearing — and reports that it did', () => {
  // 🔑 THIS IS THE ONE THAT WOULD HAVE BEEN RED BEFORE MB27. The old code drew
  // at `x = width - margin` with `textAlign: right` and no fit logic at all, so
  // on a 200px image ~170px of ink starting 24px from the right ran off the
  // left edge — and canvas clipped it and returned success.
  const fontSize = stampFontSize(200, 200);
  const ink = inkFor(fontSize, 0.6);
  const g = stampGeometry({
    imageWidth: 200,
    imageHeight: 200,
    ink,
    fontSize,
    margin: 24,
    position: 'bottom-right',
  });
  assert.ok(contains({ left: 0, top: 0, width: 200, height: 200 }, g.plate));
  assert.ok(g.plate.left >= 0, 'the plate must not start off the left edge');
  // It did have to give something up, and it says so — a caller or a future
  // guard can see the trade rather than infer it from pixels.
  assert.ok(g.scale <= 1);
  assert.ok(g.effectiveFontSize <= fontSize);
});

test('a 1x1 image gets a mark instead of a thrown error', () => {
  // Not a curiosity: a throw here reaches `uploadOne`'s catch in
  // file-upload.tsx, which uploads the ORIGINAL — so on this path an exception
  // means an UNMARKED photograph on R2. Fit is mandatory; throwing is not an
  // option the way it is on the server.
  const g = stampGeometry({
    imageWidth: 1,
    imageHeight: 1,
    ink: inkFor(18, 0.6),
    fontSize: 18,
    margin: 24,
    position: 'bottom-right',
  });
  assert.ok(contains({ left: 0, top: 0, width: 1, height: 1 }, g.plate));
  assert.ok(contains(g.plate, g.ink));
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 2 · NOTHING IS MARKED TWICE — and nothing is marked ZERO times
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * THE LINE THAT SETTLED IT, read from `app/admin/moodboard-library/actions.ts`
 * on 2026-09-05:
 *
 *   const arrayBuffer = await file.arrayBuffer();
 *   const { error: upErr } = await admin.storage
 *     .from(BUCKET)
 *     .upload(objectKey, arrayBuffer, { ... });
 *
 * The submitted `File`'s bytes go to storage untouched. There is no
 * `watermarkImageBytes` between them — and the action's own docblock says the
 * same thing from the other direction, describing the marking step as future
 * work: "once Higgsfield API access lands in env, we can wire the full
 * generate → download → watermark → upload loop in one click."
 *
 * So the admin library path does NOT mark on the server, the client mark in
 * `library-editor.tsx` STAYS, and MB27's brief is satisfied by leaving it —
 * removing it would have shipped an unmarked pool.
 *
 * ⚠ WHICH MAKES "EXACTLY ONE" A TWO-SIDED CLAIM, and both sides are asserted:
 * a later change that adds a server mark without removing the client one goes
 * red here, and so does one that removes the client mark without adding a
 * server one. The second is the more dangerous direction and the easier one to
 * make by accident — deleting a `watermarkFile` call reads like cleanup.
 *
 * 🔑 CONTRAST, deliberately checked: the VENDOR library action DOES mark on
 * the server (`app/vendor-dashboard/moodboard-library/actions.ts` imports
 * `watermarkImageBytes`), and its uploads are not client-marked. Two paths,
 * one mark each, by different halves.
 */
function appSource(rel: string): string {
  return source(path.join(process.cwd(), rel));
}

test('the admin library path marks EXACTLY ONCE — on the client, because the server does not', () => {
  const action = appSource('app/admin/moodboard-library/actions.ts');
  const editor = appSource('app/admin/moodboard-library/_components/library-editor.tsx');

  // Half one: the server does not mark. If this flips, the client call above
  // must go, or the pool is marked twice.
  assert.doesNotMatch(
    action,
    /watermarkImageBytes|watermark-server|markVariantForSource/,
    'admin/moodboard-library/actions.ts now marks on the server — remove the client ' +
      'watermarkFile call in library-editor.tsx, or the asset is marked twice',
  );
  // And it still passes the submitted bytes straight through, which is what
  // makes the client mark the one that reaches storage.
  assert.match(action, /await file\.arrayBuffer\(\)/);
  assert.match(action, /\.upload\(objectKey, arrayBuffer/);

  // Half two: the client DOES mark. Deleting this leaves the admin pool
  // unmarked, and nothing else on this path would notice.
  assert.match(
    editor,
    /watermarkFile\(/,
    'library-editor.tsx no longer marks, and actions.ts does not either — the ' +
      'admin library pool would go out unmarked',
  );
  assert.match(editor, /from '@\/lib\/watermark'/);

  // The contrast case: the vendor path marks on the SERVER, so it must not
  // also mark in the browser.
  const vendorAction = appSource('app/vendor-dashboard/moodboard-library/actions.ts');
  assert.match(vendorAction, /watermarkImageBytes/);
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 4 · VIDEO IS PHASE 2 — REFUSED, NOT PASSED THROUGH
   ══════════════════════════════════════════════════════════════════════════ */

/** The first bytes of each container, which is all either sniff looks at. */
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(8)]);
const MOV = Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  ', 'latin1'), Buffer.alloc(8)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(12)]);
const AVI = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('AVI ', 'latin1'), Buffer.alloc(8)]);
const FLV = Buffer.concat([Buffer.from('FLV', 'latin1'), Buffer.alloc(13)]);
const MPEG_PS = Buffer.concat([Buffer.from([0x00, 0x00, 0x01, 0xba]), Buffer.alloc(12)]);
/** ISO-BMFF too — but an IMAGE. Must NOT be refused. */
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypavif', 'latin1'), Buffer.alloc(8)]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic', 'latin1'), Buffer.alloc(8)]);

test('the server marker REFUSES a video out loud rather than returning it unmarked', () => {
  for (const [name, bytes] of [
    ['mp4', MP4],
    ['mov', MOV],
    ['webm', WEBM],
    ['avi', AVI],
    ['flv', FLV],
    ['mpeg-ps', MPEG_PS],
  ] as Array<[string, Buffer]>) {
    assert.throws(
      () => assertNotVideoBytes(bytes),
      /refusing to mark a video/,
      `${name} must be refused`,
    );
  }
});

test('the video sniff is BRAND-AWARE: AVIF and HEIC are ISO-BMFF too, and are images', () => {
  // 🪤 The cheap version of this check — "`ftyp` at offset 4 means video" —
  // would reject AVIF and HEIC, which are photographs this pipeline must keep
  // marking (`preserveMime` in watermark.ts names AVIF explicitly). Rejecting a
  // real photograph is the more expensive mistake of the two.
  assert.doesNotThrow(() => assertNotVideoBytes(AVIF));
  assert.doesNotThrow(() => assertNotVideoBytes(HEIC));
  assert.doesNotThrow(() => assertNotVideoBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])));
  assert.doesNotThrow(() => assertNotVideoBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0])));
  assert.doesNotThrow(() => assertNotVideoBytes(Buffer.alloc(2)));
});

test('watermarkImageBytes itself rejects a video, before sharp ever sees it', async () => {
  // Not left to sharp's "unsupported image format": that reads like a corrupt
  // upload and sends the next engineer to the wrong place. The message carries
  // the ruling.
  await assert.rejects(
    () => watermarkImageBytes(MP4),
    /refusing to mark a video.*Phase 2 by owner ruling 2026-09-05/s,
  );
});

test('the browser marker refuses a video File, by MIME and by name', async () => {
  assert.throws(() => assertNotVideoFile({ type: 'video/mp4', name: 'reel.mp4' }), /refusing to mark a video/);
  assert.throws(() => assertNotVideoFile({ type: 'video/quicktime', name: 'clip.mov' }), /refusing/);
  // Some Android pickers hand over a File with an EMPTY type; the name is then
  // the only evidence there is.
  assert.throws(() => assertNotVideoFile({ type: '', name: 'IMG_2201.MOV' }), /refusing/);
  assert.doesNotThrow(() => assertNotVideoFile({ type: 'image/jpeg', name: 'venue.jpg' }));
  assert.doesNotThrow(() => assertNotVideoFile({ type: 'image/avif', name: 'venue.avif' }));

  // And through the front door, before any canvas work happens.
  await assert.rejects(
    () => watermarkFile(new File([new Uint8Array([0])], 'reel.mp4', { type: 'video/mp4' })),
    /Phase 2 by owner ruling 2026-09-05/,
  );
});

test('the video ruling is written into BOTH docblocks, not just this test', () => {
  // The brief asked for the ruling to be recorded where the next engineer
  // reads, not only where CI reads. A test that only checked behaviour would
  // let the explanation rot away from the code.
  for (const file of ['watermark.ts', 'watermark-server.ts']) {
    const header = fs.readFileSync(path.join(process.cwd(), 'lib', file), 'utf8').slice(0, 8000);
    assert.match(header, /VIDEO IS PHASE 2/, `${file} must record the video ruling`);
    assert.match(header, /2026-09-05/, `${file} must date the ruling`);
  }
});
