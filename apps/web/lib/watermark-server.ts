/**
 * THE SERVER-SIDE SETNAYAN MARKS (MB9 · MB11 · MB20) — `sharp`, not Canvas.
 *
 * ── WHY `lib/watermark.ts` COULD NOT DO THIS ──────────────────────────────
 * That module is the 2026-05-21 watermark, and its own header says what it is:
 * "client-side Canvas watermarking before upload… Upgrade to server-side
 * sharp.js compositing in V1.x if takedown evasion becomes a real problem."
 * It calls `document.createElement('canvas')`. A Mood Board render is produced
 * entirely server-side — the Gemini pipeline hands `render-actions.ts` raw
 * bytes that no browser ever touches — so there is no document to draw on and
 * no upload to intercept. Not a shortcoming of that module; a different place
 * in the pipeline.
 *
 * This is the sharp-based equivalent for bytes. It does not replace
 * `watermark.ts`, which still marks vendor marketplace uploads client-side, and
 * the two are deliberately not merged: one takes a `File` in a browser, the
 * other takes bytes in a lambda, and a single "universal" helper would have to
 * carry the browser half into every server bundle.
 *
 * ── WHAT IT IS FOR, AND WHAT IT IS NOT FOR ────────────────────────────────
 * 🔒 THE COUPLE'S OWN COPY IS NEVER MARKED. This runs on the GALLERY copy —
 * the derived image other couples browse — and never on `image_key`, the
 * photograph the couple paid for. `moodboard-gallery-copy.ts` is the only
 * caller on that side and it names both keys, so the two cannot be confused at
 * the call site.
 *
 * The mark is a DETERRENT, not anti-tamper: anyone determined can crop it. The
 * owner directive it serves is about scraping and attribution, and a visible
 * mark is what that asks for.
 *
 * ── TWO MARKS, ONE URL (MB20, owner directive 2026-09-04) ─────────────────
 * Every photograph entering an inspiration pool now carries `WWW.SETNAYAN.COM`
 * — the URL, not the bare word, because attribution that cannot be typed into
 * a browser is decoration.
 *
 *   'stamp'  the default. A filled pill in the bottom-right with the URL in it.
 *            Every photo whose row has NO `source_event_id` — a supplier's
 *            back-catalogue upload, a render.
 *   'seal'   a photograph from a celebration Setnayan actually ran
 *            (`source_event_id IS NOT NULL`). A thin OUTLINED badge —
 *            SETNAYAN over a hairline rule with CELEBRATION beneath — plus the
 *            URL small and low-contrast in the opposite bottom corner. No
 *            filled plate.
 *
 * 🔑 THE SEAL IS SMALLER THAN THE STAMP, DELIBERATELY. A heavier mark on
 * Setnayan's own celebrations would deface exactly the material it exists to
 * distinguish. The standing-out is done in the picker, not in the pixels.
 * `mark-fits-and-marks.test.ts` asserts the footprint ordering so a later
 * "make the seal more prominent" cannot quietly invert it.
 *
 * ── THE PLATE IS MEASURED, NOT ESTIMATED (THE MB20 BUG) ───────────────────
 * 🛑 THIS IS THE DEFECT MB20 EXISTS TO FIX, AND IT SHIPPED LOOKING FINE. The
 * plate used to be sized `fontSize * (WATERMARK_TEXT.length * 0.72 + 1.4)` —
 * an estimate tuned against the 8-letter word, where it left 33–46px of slack.
 * At 16 characters it goes the OTHER WAY. Measured 2026-09-04 by rendering it:
 *
 *   short=600  font=33  "SETNAYAN"         plate 236  ink 203   −33px slack
 *   short=600  font=33  "WWW.SETNAYAN.COM" plate 426  ink 441   +15px OVERFLOW
 *   short=700  font=39  "WWW.SETNAYAN.COM" plate 504  ink 524   +20px OVERFLOW
 *   short=800  font=44  "WWW.SETNAYAN.COM" plate 568  ink 581   +13px OVERFLOW
 *
 * 7–10px sheared off EACH END of the URL — and the composite still succeeded,
 * the corner still stopped being flat, and every pixel test that only asked
 * "is there ink in the bottom-right" stayed green. An overflow is not a crash.
 *
 * So no constant is tuned here. The wordmark is rasterised, `sharp().trim()`
 * measures the ink that actually exists, and the plate is sized to THAT. The
 * type is scaled to ~62% so the mark keeps roughly the physical footprint the
 * 8-letter word had. `assertInside` then refuses to composite a mark that does
 * not fit — the failure is a throw, never a shear.
 *
 * ── THE GLYPHS ARE VECTOR PATHS, NOT A FONT-FAMILY REQUEST ────────────────
 * ⚠ THIS IS A CORRECTION TO WHAT THIS FILE SAID ON 2026-09-04, AND IT IS
 * LOAD-BEARING. The original note here read: "No font FILE is referenced. sharp
 * renders SVG text through librsvg/fontconfig using whatever the host has… A
 * generic family is available everywhere the app runs." That is an assumption,
 * and if it is wrong the failure is silent and lands exactly where it must not:
 * the scrim composites, the pixels change, every pixel-reading test still
 * passes — and the mark is a blank grey pill on a public gallery photograph.
 *
 * The repo's own shipped evidence points the other way. `lib/social/card.tsx`
 * carries the finding in its docblock — "librsvg's fontconfig path is flaky on
 * Vercel" — which is why every social card, the lockup PDF and the Papic
 * display ref all render text through satori with an EXPLICIT font buffer.
 *
 * So every glyph here is rendered by satori into vector PATHS from a bundled
 * TTF and composited as an image. No host font is consulted, on any runtime.
 * The plate, the badge outline and the hairline rule stay plain SVG shapes (no
 * font needed).
 *
 * 🔑 FLAGGED FOR THE OWNER rather than assumed: if the DejaVu/Helvetica
 * assumption was in fact verified against a Vercel lambda, say so and this can
 * go back — but it should not rest on a claim nobody measured.
 *
 * ── VIDEO IS PHASE 2, AND A VIDEO IS REFUSED, NOT PASSED (MB27) ───────────
 * 🔒 OWNER RULING 2026-09-05: **no video watermarking in V1.** Recorded, not
 * built. Papic clips, Panood recordings and vendor showcase reels ship
 * unmarked in V1 by decision, and the decision is the owner's to revisit.
 *
 * 🛑 BUT "WE DON'T MARK VIDEO" MUST NOT MEAN "WE QUIETLY DON'T MARK VIDEO".
 * `watermarkImageBytes` takes raw bytes and is called from a lambda; the
 * caller's own MIME check is the only thing standing between it and an MP4.
 * Handed one, the honest outcomes are a loud throw or a marked video — never a
 * successful call that returns the clip untouched, because every artefact of
 * success (a key, a content type, a row) would be present and the file on the
 * public pool would carry no mark at all. That is the failure-looks-like-
 * success disease, and it is the one this module's header already refuses in
 * three other places.
 *
 * So the bytes are SNIFFED before sharp sees them (`assertNotVideoBytes`), and
 * a video container throws with the ruling in the message. Not left to sharp's
 * decode error: sharp says "unsupported image format", which reads like a
 * corrupt upload and sends the next engineer looking in the wrong place.
 *
 * ⚠ THE SNIFF IS BRAND-AWARE ON PURPOSE. `ftyp` at offset 4 is ISO-BMFF, which
 * is MP4 *and* HEIC *and* AVIF — and AVIF is an image this pipeline must keep
 * accepting (`preserveMime` in `lib/watermark.ts` names it). Only known VIDEO
 * brands are refused; an unrecognised brand falls through to sharp, which is
 * the component that actually knows what it can decode.
 *
 * ── OUTPUT IS ALWAYS JPEG, ON PURPOSE ─────────────────────────────────────
 * One format out means one extension, one content type and one set of bytes to
 * assert on. A render is a photograph; JPEG loses nothing that matters here and
 * the gallery copy is a browse thumbnail, not an archival master (the master IS
 * `image_key`, untouched).
 */

import sharp from 'sharp';
import { WATERMARK_TEXT } from './watermark-text';

/**
 * The URL every marked photograph carries. Owner directive 2026-09-04; MB27
 * moved the string itself to `lib/watermark-text.ts` so the browser-side
 * marker can share it (this module cannot be imported by a browser — `sharp`
 * above is a native addon). Re-exported because the MB20 guards import it from
 * here, and because "the server's watermark text" is a thing callers look for
 * at this address.
 */
export { WATERMARK_TEXT };

/** The two lines inside the seal's badge. Brand lock: never STNYN. */
export const SEAL_NAME_TEXT = 'SETNAYAN';
export const SEAL_SUB_TEXT = 'CELEBRATION';

/**
 * ~62% of MB9's 0.055. The URL is twice the word's length, so holding the old
 * type size would have doubled the mark's width across the photograph; holding
 * the old WIDTH instead keeps it the same object on the page.
 */
const STAMP_FONT_RATIO = 0.034;
const STAMP_MIN_FONT_PX = 10;

/**
 * Longest edge of the gallery copy. A pool tile is browsed at ~200px; 1280 is
 * generous for a full-size preview and keeps the object small enough that a
 * page of six is cheap. The couple's own copy is not resized.
 */
export const GALLERY_MAX_EDGE = 1280;

/** Which of the two marks a photograph gets. */
export type WatermarkVariant = 'stamp' | 'seal';

export type MarkBox = { left: number; top: number; width: number; height: number };

/**
 * WHERE THE MARK WAS DRAWN — a map, NOT a receipt.
 *
 * 🔑 READ THIS BEFORE WRITING A TEST AGAINST IT. Nothing in this object proves
 * a mark exists; a sabotage that skipped the composite entirely would still
 * return it, populated and correct. Its only job is to tell a guard WHERE to
 * point its `.raw()` read, so an assertion can face the plate instead of
 * guessing at a third of the image. The verdict must always come from the
 * pixels at these coordinates — see [[a-flag-in-an-object-is-not-ink-in-the-pixels]].
 *
 * It is what makes the overflow above CHECKABLE rather than merely fixed: with
 * the plate and the ink both stated, a test can assert the ink sits inside the
 * plate AND that the strip just outside the plate is untouched.
 */
export type MarkGeometry = {
  variant: WatermarkVariant;
  /** The stamp's filled pill. `null` for the seal, which has no filled plate. */
  plate: MarkBox | null;
  /** Every box this mark puts ink in. Each must sit inside `plate` when there is one. */
  ink: MarkBox[];
};

export type ServerWatermarkResult = {
  bytes: Buffer;
  contentType: 'image/jpeg';
  width: number;
  height: number;
  geometry: MarkGeometry;
};

/**
 * Which mark a row's photograph gets, from the one column that decides it.
 *
 * `source_event_id IS NULL` is already the whole back-catalogue/event-linked
 * distinction everywhere else in the gallery (the quota counts on it, the DB
 * CHECK `moodboard_library_assets_editorial_import_has_event` enforces it), so
 * the mark reads the SAME column rather than introducing a second, competing
 * source of truth for "is this one of ours".
 */
export function markVariantForSource(
  sourceEventId: string | null | undefined,
): WatermarkVariant {
  return sourceEventId == null ? 'stamp' : 'seal';
}

/**
 * Composite the Setnayan mark onto image bytes and return JPEG bytes.
 *
 * Throws on bytes sharp cannot decode — the caller treats that as "no gallery
 * copy", which is the honest outcome: a render whose bytes we could not read is
 * one we cannot prove we marked, and an unmarked image must never reach the
 * pool. There is no "return the original on failure" branch here, deliberately;
 * that branch is exactly how an unmarked image would get published.
 *
 * It also throws when the measured mark will not FIT — see `assertInside`. A
 * mark that does not fit is the bug MB20 fixed, and shearing it silently is
 * what let that bug ship.
 *
 * And it throws on VIDEO bytes rather than returning them: video marking is
 * Phase 2 by owner ruling 2026-09-05, and this function is images only. See
 * the header — a video that "succeeds" here is an unmarked clip on a public
 * pool with every sign of success around it.
 */
export async function watermarkImageBytes(
  input: Uint8Array | Buffer,
  variant: WatermarkVariant = 'stamp',
): Promise<ServerWatermarkResult> {
  assertNotVideoBytes(input);

  const base = sharp(Buffer.from(input), { failOn: 'error' }).rotate();
  const resized = await base
    .resize({
      width: GALLERY_MAX_EDGE,
      height: GALLERY_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer({ resolveWithObject: true });

  const { width, height } = resized.info;
  const mark =
    variant === 'seal'
      ? await sealLayers(width, height)
      : await stampLayers(width, height);

  const bytes = await sharp(resized.data)
    .composite(mark.layers)
    .jpeg({ quality: 86 })
    .toBuffer();

  return { bytes, contentType: 'image/jpeg', width, height, geometry: mark.geometry };
}

type Layer = { input: Buffer; top: number; left: number };
type Mark = { layers: Layer[]; geometry: MarkGeometry };

/* ══════════════════════════════════════════════════════════════════════════
   THE STAMP — a filled pill, sized to the ink inside it
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * LAYER 1 — the plate: a rounded `<rect>`, bottom-right. Plain SVG geometry,
 * no text. It is why this is not just translucent white lettering: white-on-
 * white is a watermark that marks nothing, and it would still pass any test
 * that only asked "did we composite something".
 *
 * LAYER 2 — the wordmark: `WWW.SETNAYAN.COM` as vector paths, centred on the
 * plate. The plate is derived FROM this raster's measured size, which is the
 * whole point of MB20 — see the header.
 *
 * Both are sized off the SHORT edge so a wide render and a tall one get a mark
 * of the same visual weight.
 */
async function stampLayers(width: number, height: number): Promise<Mark> {
  const short = Math.min(width, height);
  const fontSize = Math.max(STAMP_MIN_FONT_PX, Math.round(short * STAMP_FONT_RATIO));
  const margin = Math.max(10, Math.round(short * 0.03));

  let ink = await rasterizeText({
    text: WATERMARK_TEXT,
    fontSizePx: fontSize,
    face: 'bold',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: Math.round(fontSize * 0.12),
  });

  let padX = Math.max(4, Math.round(fontSize * 0.5));
  let padY = Math.max(4, Math.round(fontSize * 0.62));

  // ⚠ THE ONLY BRANCH THAT MAY SHRINK THE MARK, and it is reached only on an
  // image narrower than its own wordmark — the minimum type size is 10px and
  // a 16-character URL wants ~130px, so this is for thumbnails, not renders.
  // It shrinks the RASTER, never the plate around it, so the ink-inside-plate
  // invariant below holds either way.
  const room = Math.max(1, width - 2 * margin);
  if (ink.width + 2 * padX > room) {
    padX = Math.max(0, Math.floor((room - ink.width) / 2));
    if (ink.width > room) {
      ink = await scaleInk(ink, room);
      padX = 0;
    }
  }
  const vroom = Math.max(1, height - 2 * margin);
  if (ink.height + 2 * padY > vroom) {
    padY = Math.max(0, Math.floor((vroom - ink.height) / 2));
  }

  const plate: MarkBox = {
    width: ink.width + 2 * padX,
    height: ink.height + 2 * padY,
    left: 0,
    top: 0,
  };
  plate.left = Math.max(0, width - plate.width - margin);
  plate.top = Math.max(0, height - plate.height - margin);

  const inkBox: MarkBox = {
    left: plate.left + Math.round((plate.width - ink.width) / 2),
    top: plate.top + Math.round((plate.height - ink.height) / 2),
    width: ink.width,
    height: ink.height,
  };

  assertInside(inkBox, plate, 'the wordmark must sit inside its plate');
  assertInside(plate, { left: 0, top: 0, width, height }, 'the plate must sit inside the image');

  const plateSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="${plate.left}" y="${plate.top}" width="${plate.width}" height="${plate.height}" rx="${Math.round(
      plate.height / 2,
    )}" fill="rgba(20,18,16,0.42)"/>
</svg>`,
  );

  return {
    layers: [
      { input: plateSvg, top: 0, left: 0 },
      { input: ink.buffer, top: inkBox.top, left: inkBox.left },
    ],
    geometry: { variant: 'stamp', plate, ink: [inkBox] },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   THE SEAL — an outlined badge, for a celebration Setnayan actually ran
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A thin outlined badge bottom-right — SETNAYAN over a hairline rule with
 * CELEBRATION beneath — and the URL small and low-contrast bottom-LEFT.
 *
 * ⚠ WHY THE URL IS IN THE OPPOSITE CORNER, not tucked into the badge. The
 * owner's rule is that EVERY inspiration photo carries the URL; the seal's
 * badge is the thing that distinguishes it, and stacking a third line of type
 * inside a badge already carrying two would make the seal heavier than the
 * stamp it is supposed to undercut. Opposite corner, small, 0.55 alpha.
 *
 * 🪤 NO FILLED PLATE MEANS NO CONTRAST GUARANTEE, so every element is drawn
 * TWICE: a near-black copy offset by a pixel, then the light one on top. White
 * ink alone disappears on an overexposed sky — that is exactly the failure the
 * stamp's dark pill exists to prevent, and the seal cannot borrow the pill.
 * The offset is a hard 1–2px rather than a blur because a blur would spread
 * past the raster it was computed from and get clipped at that edge.
 */
async function sealLayers(width: number, height: number): Promise<Mark> {
  const short = Math.min(width, height);
  const margin = Math.max(8, Math.round(short * 0.028));
  const nameSize = Math.max(8, Math.round(short * 0.026));
  const subSize = Math.max(6, Math.round(nameSize * 0.58));
  const urlSize = Math.max(6, Math.round(short * 0.015));
  const offset = Math.max(1, Math.round(short * 0.0018));

  const [name, sub, url] = await Promise.all([
    rasterizeText({
      text: SEAL_NAME_TEXT,
      fontSizePx: nameSize,
      face: 'medium',
      color: 'rgba(255,255,255,0.94)',
      letterSpacing: Math.round(nameSize * 0.22),
    }),
    rasterizeText({
      text: SEAL_SUB_TEXT,
      fontSizePx: subSize,
      face: 'medium',
      color: 'rgba(255,255,255,0.88)',
      letterSpacing: Math.max(1, Math.round(subSize * 0.3)),
    }),
    rasterizeText({
      text: WATERMARK_TEXT,
      fontSizePx: urlSize,
      face: 'medium',
      color: 'rgba(255,255,255,0.55)',
      letterSpacing: Math.max(1, Math.round(urlSize * 0.06)),
    }),
  ]);

  const strokeW = Math.max(1, Math.round(short * 0.0018));
  const innerW = Math.max(name.width, sub.width);
  const bpadX = Math.max(6, Math.round(nameSize * 0.95));
  const bpadY = Math.max(5, Math.round(nameSize * 0.6));
  const gap = Math.max(3, Math.round(nameSize * 0.36));
  const ruleH = Math.max(1, Math.round(short * 0.0014));

  const badge: MarkBox = {
    width: innerW + 2 * bpadX,
    height: bpadY + name.height + gap + ruleH + gap + sub.height + bpadY,
    left: 0,
    top: 0,
  };
  badge.left = Math.max(0, width - badge.width - margin);
  badge.top = Math.max(0, height - badge.height - margin);

  const nameBox: MarkBox = {
    left: badge.left + Math.round((badge.width - name.width) / 2),
    top: badge.top + bpadY,
    width: name.width,
    height: name.height,
  };
  const ruleY = nameBox.top + name.height + gap;
  const ruleW = Math.max(2, Math.round(innerW * 0.72));
  const ruleX = badge.left + Math.round((badge.width - ruleW) / 2);
  const subBox: MarkBox = {
    left: badge.left + Math.round((badge.width - sub.width) / 2),
    top: ruleY + ruleH + gap,
    width: sub.width,
    height: sub.height,
  };
  const urlBox: MarkBox = {
    left: margin,
    top: Math.max(0, height - url.height - margin),
    width: url.width,
    height: url.height,
  };

  const image: MarkBox = { left: 0, top: 0, width, height };
  assertInside(nameBox, badge, 'SETNAYAN must sit inside the seal badge');
  assertInside(subBox, badge, 'CELEBRATION must sit inside the seal badge');
  assertInside(badge, image, 'the seal badge must sit inside the image');
  assertInside(urlBox, image, 'the seal URL must sit inside the image');

  // The badge outline and the hairline rule: plain shapes, drawn dark-then-
  // light so neither vanishes on a white dress or a black tuxedo.
  const frame = (dx: number, dy: number, stroke: string, rule: string) =>
    `<rect x="${badge.left + dx}" y="${badge.top + dy}" width="${badge.width}" height="${
      badge.height
    }" rx="${Math.max(2, Math.round(nameSize * 0.35))}" fill="none" stroke="${stroke}" stroke-width="${strokeW}"/>
  <rect x="${ruleX + dx}" y="${ruleY + dy}" width="${ruleW}" height="${ruleH}" fill="${rule}"/>`;

  const shapes = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${frame(offset, offset, 'rgba(16,14,12,0.55)', 'rgba(16,14,12,0.55)')}
  ${frame(0, 0, 'rgba(255,255,255,0.82)', 'rgba(255,255,255,0.82)')}
</svg>`,
  );

  const [nameShadow, subShadow, urlShadow] = await Promise.all([
    shadowOf(name),
    shadowOf(sub),
    shadowOf(url),
  ]);

  return {
    layers: [
      { input: nameShadow, top: nameBox.top + offset, left: nameBox.left + offset },
      { input: subShadow, top: subBox.top + offset, left: subBox.left + offset },
      { input: urlShadow, top: urlBox.top + offset, left: urlBox.left + offset },
      { input: shapes, top: 0, left: 0 },
      { input: name.buffer, top: nameBox.top, left: nameBox.left },
      { input: sub.buffer, top: subBox.top, left: subBox.left },
      { input: url.buffer, top: urlBox.top, left: urlBox.left },
    ],
    geometry: { variant: 'seal', plate: null, ink: [badge, urlBox] },
  };
}

/**
 * The same glyphs in near-black, for the offset shadow underneath.
 *
 * `blend: 'in'` keeps the DESTINATION's alpha and takes the SOURCE's colour, so
 * this is the identical letterform recoloured — not a second satori render that
 * could drift a subpixel out of register with the light copy on top.
 */
async function shadowOf(ink: Ink): Promise<Buffer> {
  return await sharp(ink.buffer)
    .composite([
      {
        input: {
          create: {
            width: ink.width,
            height: ink.height,
            channels: 4,
            background: { r: 16, g: 14, b: 12, alpha: 1 },
          },
        },
        blend: 'in',
      },
    ])
    .png()
    .toBuffer();
}

/* ══════════════════════════════════════════════════════════════════════════
   MEASURING, NOT ESTIMATING
   ══════════════════════════════════════════════════════════════════════════ */

type Ink = { buffer: Buffer; width: number; height: number };

const FACES = { bold: ['Poppins-Bold.ttf', 700], medium: ['Poppins-Medium.ttf', 500] } as const;
const fontCache = new Map<string, Buffer>();

/**
 * Text as vector paths on a transparent ground, TRIMMED TO ITS OWN INK.
 *
 * 🔑 THE TRIM IS THE FIX. satori lays the text out on a canvas we choose; what
 * we need back is the size of the marks it actually made, which is a fact about
 * the font, the string, the size and the letter-spacing together. `.trim()`
 * reports exactly that, and every plate in this file is sized from it.
 *
 * 🪤 AND IT DETECTS ITS OWN CLIPPING. If the string is wider than the canvas,
 * satori's centred flex row overflows and the SVG viewport shears it — which is
 * precisely the MB20 bug, one layer down, and it would produce a trimmed ink
 * box exactly as wide as the canvas. So a trim that fills the canvas is treated
 * as a clip and retried on a bigger one; three failures throw rather than
 * returning a measurement of a sheared word.
 */
async function rasterizeText(opts: {
  text: string;
  fontSizePx: number;
  face: keyof typeof FACES;
  color: string;
  letterSpacing: number;
}): Promise<Ink> {
  const [file, weight] = FACES[opts.face];
  const [{ default: satori }, fs, path] = await Promise.all([
    import('satori'),
    import('node:fs'),
    import('node:path'),
  ]);
  let fontData = fontCache.get(file);
  if (!fontData) {
    fontData = fs.readFileSync(path.join(process.cwd(), 'lib', 'social', 'fonts', file));
    fontCache.set(file, fontData);
  }

  const tree = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      },
      children: {
        type: 'span',
        props: {
          style: {
            fontFamily: 'Poppins',
            fontSize: opts.fontSizePx,
            fontWeight: weight,
            letterSpacing: opts.letterSpacing,
            color: opts.color,
            whiteSpace: 'nowrap',
          },
          children: opts.text,
        },
      },
    },
  };

  let canvasW = Math.ceil((opts.fontSizePx + opts.letterSpacing) * (opts.text.length + 2) * 1.4);
  let canvasH = Math.ceil(opts.fontSizePx * 3);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    // The object element form, cast at the boundary — the app's tsconfig is
    // `jsx: preserve` and satori wants React-element-SHAPED objects but not
    // real React. Same cast, for the same reason, as every card in lib/social.
    const svg = await satori(tree as unknown as React.ReactNode, {
      width: canvasW,
      height: canvasH,
      fonts: [
        { name: 'Poppins', data: fontData, weight: weight as 500 | 700, style: 'normal' as const },
      ],
    });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const { data, info } = await sharp(png)
      .trim({ threshold: 1 })
      .toBuffer({ resolveWithObject: true });

    if (info.width < 2 || info.height < 2) {
      // Nothing was drawn. A blank pill on a public gallery photograph is the
      // exact failure this module's header refuses to ship silently.
      throw new Error(`watermark: "${opts.text}" rendered no glyphs`);
    }
    if (info.width < canvasW && info.height < canvasH) {
      return { buffer: data, width: info.width, height: info.height };
    }
    canvasW *= 2;
    canvasH *= 2;
  }
  throw new Error(`watermark: "${opts.text}" could not be rasterised without clipping`);
}

/** Shrink a measured raster to an exact width, keeping its aspect. */
async function scaleInk(ink: Ink, targetWidth: number): Promise<Ink> {
  const width = Math.max(1, Math.min(targetWidth, ink.width));
  const { data, info } = await sharp(ink.buffer)
    .resize({ width, fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

/**
 * Refuse to composite a mark that does not fit.
 *
 * 🛑 THE DIRECTION MATTERS, and it is the lesson of the bug above. sharp will
 * happily composite an overlay that hangs off its canvas — it clips and
 * returns success — so "it rendered" has never been evidence that the mark is
 * whole. This throws instead, and the caller's contract for a throw is already
 * "this photograph gets no gallery copy", never "publish it unmarked".
 */
function assertInside(inner: MarkBox, outer: MarkBox, what: string): void {
  const fits =
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.left + inner.width <= outer.left + outer.width &&
    inner.top + inner.height <= outer.top + outer.height;
  if (!fits) {
    throw new Error(
      `watermark: ${what} — ${inner.width}x${inner.height} at (${inner.left},${inner.top}) ` +
        `does not fit ${outer.width}x${outer.height} at (${outer.left},${outer.top})`,
    );
  }
}

/**
 * REFUSE A VIDEO OUT LOUD (MB27 · owner ruling 2026-09-05).
 *
 * Container sniffing, not MIME: this function is handed BYTES by a lambda, and
 * the MIME string that came with them is the caller's claim, not a fact about
 * the file. The bytes are the fact.
 *
 * 🪤 `ftyp` IS NOT ENOUGH ON ITS OWN. ISO-BMFF is the container for MP4 and
 * MOV *and* for HEIC and AVIF — images this pipeline must keep marking. So the
 * BRAND at offset 8 decides, and only brands that are unambiguously video are
 * refused. Anything else falls through to sharp, which is the component that
 * actually knows what it can decode; a wrong guess here would reject a real
 * photograph, which is the more expensive mistake.
 */
const VIDEO_FTYP_BRANDS = new Set([
  'isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'mp4v', 'avc1',
  'dash', 'm4v ', 'M4V ', 'M4VP', 'qt  ', '3gp4', '3gp5', '3gp6', '3g2a',
]);

export function assertNotVideoBytes(input: Uint8Array | Buffer): void {
  const b = Buffer.from(
    input.buffer,
    input.byteOffset,
    Math.min(input.byteLength, 16),
  );
  const refuse = (container: string): never => {
    throw new Error(
      `watermark: refusing to mark a video (${container}). Video marking is ` +
        'Phase 2 by owner ruling 2026-09-05 — watermarkImageBytes is images ' +
        'only. Returning the clip unmarked would look exactly like success.',
    );
  };
  if (b.length >= 12 && b.toString('latin1', 4, 8) === 'ftyp') {
    const brand = b.toString('latin1', 8, 12);
    if (VIDEO_FTYP_BRANDS.has(brand)) refuse(`ISO-BMFF brand "${brand.trim()}"`);
  }
  // Matroska / WebM share the EBML magic; the DocType that separates them sits
  // further in, and neither is an image, so the magic alone is enough here.
  if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3) refuse('Matroska/WebM');
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'AVI ')
    refuse('AVI');
  if (b.length >= 3 && b.toString('latin1', 0, 3) === 'FLV') refuse('FLV');
  if (b.length >= 4 && b.readUInt32BE(0) === 0x000001ba) refuse('MPEG program stream');
}

/**
 * Read back the greyscale statistics of one quadrant of an ENCODED image.
 *
 * The instrument the watermark guards measure with: it looks at the pixels that
 * were actually produced, so a change that skips the mark shows up as a flat
 * corner and the test goes red. Nothing here reads a flag or a return value
 * claiming the mark was applied.
 *
 * 🪤 sharp's own `.stats()` READS THE INPUT IMAGE and silently DISCARDS the
 * pipeline queued in front of it — an `.extract()` before it is thrown away.
 * Measured 2026-09-04 on a flat 800×600 test image: all four quadrants of a
 * MARKED image came back identical (mean 139.584 · stdev 6.200), so a guard
 * built on `.stats()` could never have gone red no matter what it watched. The
 * region is read out with `.raw()` and the statistics computed by hand.
 */
export async function imageRegionStats(
  bytes: Uint8Array,
  region: 'bottom_right' | 'top_left',
): Promise<{ mean: number; stdev: number }> {
  const meta = await sharp(Buffer.from(bytes)).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 4 || height < 4) throw new Error('imageRegionStats: image too small');

  const w = Math.floor(width / 2);
  const h = Math.floor(height / 2);
  const left = region === 'bottom_right' ? width - w : 0;
  const top = region === 'bottom_right' ? height - h : 0;

  const raw = await sharp(Buffer.from(bytes))
    .extract({ left, top, width: w, height: h })
    .greyscale()
    .raw()
    .toBuffer();
  if (raw.length === 0) throw new Error('imageRegionStats: empty region');

  let sum = 0;
  for (const v of raw) sum += v;
  const mean = sum / raw.length;
  let variance = 0;
  for (const v of raw) variance += (v - mean) * (v - mean);
  return { mean, stdev: Math.sqrt(variance / raw.length) };
}
