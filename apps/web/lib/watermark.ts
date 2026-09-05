/**
 * SETNAYAN watermark utility — the BROWSER side of the mark.
 *
 * Per owner directive 2026-05-21: every photo posted to the app gets an auto
 * SETNAYAN watermark EXCEPT event photos (Papic captures, Panood recordings,
 * host's wedding photos — those belong to the host). Vendor marketplace
 * photos MUST have watermarks (default-on for IP protection against scraping).
 *
 * V1 approach: client-side Canvas watermarking before upload. Simpler than
 * server-side, and fine for V1 since the watermark is a deterrent, not
 * anti-tamper security.
 *
 * ⚠ AMENDED 2026-09-04 (MB9), NOT REVERSED. This header used to say
 * "no sharp/node-canvas dependency" and to file server-side compositing under
 * "upgrade in V1.x". Both are now out of date: `sharp` IS a dependency
 * (apps/web/package.json), and `lib/watermark-server.ts` is the sharp-based
 * equivalent that marks BYTES.
 *
 * The two are deliberately NOT merged and this module is not deprecated. It
 * takes a `File` in a browser and intercepts an upload; the other takes bytes
 * in a lambda for an image no browser ever touched (a Mood Board render). One
 * "universal" helper would have to drag the browser half into every server
 * bundle. Pick by where the image is: `watermarkFile` here for anything a
 * person uploads, `watermarkImageBytes` for anything we generate.
 *
 * ── ONE MARK EVERYWHERE, AND IT IS THE WEB ADDRESS (MB27) ─────────────────
 * 🔒 OWNER RULING 2026-09-05. Until MB27 this module marked with the bare word
 * `SETNAYAN` while `watermark-server.ts` marked with `WWW.SETNAYAN.COM`, and
 * the two paths had drifted apart with nothing comparing them. The pool that
 * carried the weaker mark was the MARKETPLACE — vendor showcase and service
 * photographs, the images most likely to be scraped and reposted, and the ones
 * where attribution matters most. A word is not an address: someone who sees
 * the photograph outside the app cannot type `SETNAYAN` into a browser.
 *
 * The string now lives in `lib/watermark-text.ts`, which has NO imports, so
 * both markers can share it (this file cannot import `watermark-server.ts` —
 * that module pulls `sharp`, a native addon, and this one ships to the
 * browser). `one-mark-everywhere.test.ts` reads both modules' source and fails
 * if either re-introduces a literal of its own.
 *
 * ── THE MARK IS A PLATE NOW, AND IT IS MEASURED (MB27) ────────────────────
 * 🛑 PRESENCE OF INK IS NOT FIT OF INK. This module used to draw stroked white
 * lettering straight onto the photograph, anchored `margin` in from the
 * bottom-right, with nothing checking that the lettering fit. At the 18px
 * floor a 16-character URL is ~170–190px of ink; the component that calls this
 * has NO minimum image dimension (measured 2026-09-05: `file-upload.tsx`
 * validates MIME and byte size only), so a 200px-wide showcase thumbnail would
 * have had the front of the URL run off the left edge — silently, because
 * canvas clips and reports success, and because a test that asks "is there ink
 * in the bottom-right" stays green over `ETNAYAN.COM`. That is the same defect
 * MB20 found on the server path, one platform over.
 *
 * So the geometry is computed from a MEASUREMENT — `ctx.measureText`'s actual
 * bounding box, the ink that will really be drawn, not an estimate from the
 * string's length — and `stampGeometry` below is pure, exported, and asserted
 * against directly. The plate's padding ratios are MB20's, unchanged.
 *
 * 🔑 WHERE THIS DELIBERATELY DIVERGES FROM THE SERVER, AND WHY: MB20 THROWS
 * when the mark will not fit. Here a throw is the wrong answer — `uploadOne`
 * in `file-upload.tsx` catches it and uploads the ORIGINAL, so on this path a
 * throw means an UNMARKED photograph reaches R2. So the client stamp always
 * fits: the type scales down until it does, on both axes, and the margin
 * collapses before the plate does. `stampGeometry` reports the scale it had to
 * use and the effective type size it ended at, so a guard can assert
 * LEGIBILITY rather than mere fit.
 *
 * ── VIDEO IS PHASE 2, AND A VIDEO IS REFUSED, NOT PASSED (MB27) ───────────
 * 🔒 OWNER RULING 2026-09-05: **no video watermarking in V1.** Recorded, not
 * built. `watermarkFile` is IMAGES ONLY and throws on a video MIME type rather
 * than handing back the clip untouched. Today `file-upload.tsx` gates this
 * call behind its own `isImage()` check, so the throw should be unreachable
 * from that caller — which is exactly why it is here: the next caller will not
 * have that gate, and a video that sails through this function unmarked would
 * arrive on a public pool with every artefact of success around it.
 */

import { WATERMARK_TEXT } from './watermark-text';

export type WatermarkOptions = {
  /** Text to render (default: the shared `WATERMARK_TEXT`, the web address) */
  text?: string;
  /** Where to anchor the watermark on the image */
  position?: 'bottom-right' | 'bottom-center' | 'tile';
  /** 0–1 opacity (default 0.45) */
  opacity?: number;
  /** Margin from edges in pixels at the image's native resolution (default 24) */
  margin?: number;
};

const DEFAULT_OPTIONS: Required<WatermarkOptions> = {
  text: WATERMARK_TEXT,
  position: 'bottom-right',
  opacity: 0.45,
  margin: 24,
};

/** A rectangle in image pixels. Same shape as the server's `MarkBox`. */
export type MarkBox = { left: number; top: number; width: number; height: number };

/**
 * WHERE THE CLIENT STAMP WILL BE DRAWN.
 *
 * 🔑 A MAP, NOT A RECEIPT — the same warning the server's `MarkGeometry`
 * carries. Nothing in this object proves ink exists; a change that computed it
 * correctly and then forgot to draw would return it intact. Its job is to let
 * an assertion point at the right pixels, and to make FIT and LEGIBILITY
 * checkable without a browser.
 */
export type StampGeometry = {
  /** The filled pill. Always inside the image. */
  plate: MarkBox;
  /** The wordmark's ink, at its final size. Always inside `plate`. */
  ink: MarkBox;
  /** Horizontal padding between ink and plate edge, per side. */
  padX: number;
  /** Vertical padding between ink and plate edge, per side. */
  padY: number;
  /** Distance from the plate to the nearest image edges. Collapses before the plate does. */
  margin: number;
  /** 1 when the measured ink fit as-is; < 1 when the type had to shrink. */
  scale: number;
  /** `fontSize * scale` — the type size a viewer actually sees. The legibility number. */
  effectiveFontSize: number;
};

/**
 * The measured ink of the wordmark, in image pixels, at `fontSize`.
 *
 * `width`/`height` are the ACTUAL BOUNDING BOX where the browser reports one —
 * the extent of the marks the font really makes — not the advance width, which
 * includes side bearings the plate would then pad twice.
 */
export type InkMeasurement = { width: number; height: number; ascent: number };

/**
 * MB20's plate padding, unchanged. `0.5em` either side of the ink, `0.62em`
 * above and below. Do not re-tune these here: the two marks are supposed to be
 * the same object on the page, and MB20 measured them.
 */
const PAD_X_RATIO = 0.5;
const PAD_Y_RATIO = 0.62;
const PAD_MIN = 4;

/** The plate fill. MB20's `rgba(20,18,16,0.42)`, so both marks read alike. */
const PLATE_FILL = 'rgba(20, 18, 16, 0.42)';

/**
 * Compute the stamp's plate and ink boxes from a MEASUREMENT. Pure: no DOM, no
 * canvas, no globals — so it can be asserted against directly, at every image
 * size the uploader accepts, without a browser.
 *
 * The fit rules are MB20's, in MB20's order — pad first, shrink only if the
 * ink itself is wider than the room — with two additions this path needs
 * because it must never throw (see the header):
 *
 *   · the margin collapses before the plate does, so a photograph smaller than
 *     two margins still gets a plate instead of a thrown error;
 *   · the shrink applies to BOTH axes and keeps the aspect, so a very short
 *     image cannot produce a plate taller than itself.
 *
 * The returned `ink` box is already at its FINAL size (scale applied), so the
 * drawing code has nothing left to work out.
 */
export function stampGeometry(args: {
  imageWidth: number;
  imageHeight: number;
  ink: InkMeasurement;
  fontSize: number;
  margin: number;
  position: 'bottom-right' | 'bottom-center';
}): StampGeometry {
  const { imageWidth: W, imageHeight: H, fontSize } = args;

  // The margin is the first thing to give. A 40px-wide avatar crop cannot
  // afford 24px of margin on each side and still carry a mark.
  const margin = Math.max(0, Math.min(args.margin, Math.floor(Math.min(W, H) / 8)));

  let padX = Math.max(PAD_MIN, Math.round(fontSize * PAD_X_RATIO));
  let padY = Math.max(PAD_MIN, Math.round(fontSize * PAD_Y_RATIO));

  const room = Math.max(1, W - 2 * margin);
  const vroom = Math.max(1, H - 2 * margin);

  let inkW = Math.max(1, Math.round(args.ink.width));
  let inkH = Math.max(1, Math.round(args.ink.height));
  let scale = 1;

  // Squeeze the padding first — MB20's branch, same order.
  if (inkW + 2 * padX > room) padX = Math.max(0, Math.floor((room - inkW) / 2));
  if (inkH + 2 * padY > vroom) padY = Math.max(0, Math.floor((vroom - inkH) / 2));

  // Then, and only then, shrink the type. Uniform on both axes so the
  // letterforms are not stretched; the plate follows the ink, never the
  // reverse, which is what keeps ink-inside-plate true at every size.
  if (inkW > room || inkH > vroom) {
    scale = Math.min(room / inkW, vroom / inkH);
    inkW = Math.max(1, Math.floor(inkW * scale));
    inkH = Math.max(1, Math.floor(inkH * scale));
    padX = 0;
    padY = Math.max(0, Math.min(padY, Math.floor((vroom - inkH) / 2)));
  }

  const plateW = Math.min(W, inkW + 2 * padX);
  const plateH = Math.min(H, inkH + 2 * padY);

  const left =
    args.position === 'bottom-center'
      ? Math.max(0, Math.round((W - plateW) / 2))
      : Math.max(0, W - plateW - margin);
  const top = Math.max(0, H - plateH - margin);

  const plate: MarkBox = { left, top, width: plateW, height: plateH };
  const ink: MarkBox = {
    left: plate.left + Math.floor((plate.width - inkW) / 2),
    top: plate.top + Math.floor((plate.height - inkH) / 2),
    width: inkW,
    height: inkH,
  };

  return {
    plate,
    ink,
    padX,
    padY,
    margin,
    scale,
    effectiveFontSize: fontSize * scale,
  };
}

/**
 * The type size for an image, before any fit shrink. Unchanged from the
 * 2026-05-21 rule: 4% of the short edge, never below 18px.
 */
export function stampFontSize(imageWidth: number, imageHeight: number): number {
  return Math.max(18, Math.round(Math.min(imageWidth, imageHeight) * 0.04));
}

/**
 * Refuse a video out loud (MB27 · owner ruling 2026-09-05).
 *
 * MIME first because that is what a `File` carries, then the extension,
 * because a file dragged from some Android pickers arrives with an empty
 * `type` and the name is then the only evidence there is.
 */
export function assertNotVideoFile(file: { type?: string; name?: string }): void {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const byExt = /\.(mp4|mov|m4v|webm|mkv|avi|flv|3gp|mpg|mpeg|wmv)$/.test(name);
  if (type.startsWith('video/') || (!type && byExt) || (byExt && type.startsWith('application/'))) {
    throw new Error(
      `watermark: refusing to mark a video (${type || name || 'unknown type'}). ` +
        'Video marking is Phase 2 by owner ruling 2026-09-05 — watermarkFile is ' +
        'images only. Returning the clip unmarked would look exactly like success.',
    );
  }
}

/**
 * Apply the SETNAYAN watermark to an image file and return a new File ready
 * to upload. Runs entirely client-side via Canvas. Preserves the original
 * format (PNG / JPEG / WebP); falls back to PNG for unknown types.
 *
 * Throws on video input (see `assertNotVideoFile`). Callers that treat a throw
 * as "upload the original" must keep their own image check in front of this —
 * `file-upload.tsx` does.
 */
export async function watermarkFile(file: File, opts: WatermarkOptions = {}): Promise<File> {
  assertNotVideoFile(file);
  const options = { ...DEFAULT_OPTIONS, ...opts };

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // Original image first
  ctx.drawImage(img, 0, 0);

  const fontSize = stampFontSize(canvas.width, canvas.height);
  ctx.font = `600 ${fontSize}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.textBaseline = 'alphabetic';

  const text = options.text;

  if (options.position === 'tile') {
    // Diagonal tile — repeated rotated lettering across the whole photograph.
    // NO PLATE HERE, deliberately: a grid of filled pills would obliterate the
    // image it is supposed to protect. Tiling is its own trade-off (coverage
    // over legibility of any single instance) and no caller ships it today.
    ctx.fillStyle = `rgba(255, 255, 255, ${options.opacity})`;
    ctx.strokeStyle = `rgba(0, 0, 0, ${options.opacity * 0.75})`;
    ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.08));
    const textW = ctx.measureText(text).width;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = 'center';
    const tile = Math.max(textW * 2.5, 220);
    const halfDiag = Math.ceil(Math.hypot(canvas.width, canvas.height) / 2);
    for (let y = -halfDiag; y <= halfDiag; y += tile * 0.6) {
      for (let x = -halfDiag; x <= halfDiag; x += tile) {
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
  } else {
    const geometry = stampGeometry({
      imageWidth: canvas.width,
      imageHeight: canvas.height,
      ink: measureInk(ctx, text, fontSize),
      fontSize,
      margin: options.margin,
      position: options.position,
    });
    drawStamp(ctx, text, geometry, options.opacity);
  }

  const mimeType = preserveMime(file.type);
  const blob = await canvasToBlob(canvas, mimeType);
  const filename = renameForMime(file.name, mimeType);
  return new File([blob], filename, { type: mimeType });
}

/**
 * The ink the font will really make, not the advance width.
 *
 * 🔑 `metrics.width` is the ADVANCE — it includes the side bearings, the empty
 * space a font leaves around its glyphs. Padding a plate around the advance
 * pads the whitespace twice and the mark drifts visually off-centre. The
 * actual bounding box is the honest measurement, and it is the same quantity
 * `sharp().trim()` reports on the server. Falls back to the advance on the
 * (now rare) engine that omits the bounding-box metrics — the fallback is a
 * slightly loose plate, never a sheared one.
 */
function measureInk(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
): InkMeasurement {
  const m = ctx.measureText(text);
  const left = m.actualBoundingBoxLeft;
  const right = m.actualBoundingBoxRight;
  const ascent = m.actualBoundingBoxAscent;
  const descent = m.actualBoundingBoxDescent;
  const hasBox =
    typeof left === 'number' &&
    typeof right === 'number' &&
    typeof ascent === 'number' &&
    typeof descent === 'number' &&
    right + left > 0;
  if (!hasBox) {
    return { width: m.width, height: fontSize, ascent: fontSize * 0.75 };
  }
  return { width: right + left, height: ascent + descent, ascent };
}

/**
 * Draw the plate, then the wordmark inside it.
 *
 * The plate is why this is not just translucent white lettering: white-on-white
 * is a watermark that marks nothing, and it would still pass any test that only
 * asked whether something had been drawn. Same reasoning, same fill, as the
 * server stamp.
 *
 * The ink is drawn through a transform rather than at a recomputed font size,
 * so what lands on the canvas is exactly the box `stampGeometry` reported —
 * there is no second rounding between the assertion and the pixels.
 */
function drawStamp(
  ctx: CanvasRenderingContext2D,
  text: string,
  g: StampGeometry,
  opacity: number,
): void {
  const { plate, ink } = g;

  ctx.save();
  ctx.fillStyle = PLATE_FILL;
  const radius = Math.min(plate.height / 2, plate.width / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(plate.left, plate.top, plate.width, plate.height, radius);
  } else {
    // Safari < 16 has no roundRect. A square plate marks the photograph just
    // as well; the corner radius is cosmetic and not worth a polyfill.
    ctx.rect(plate.left, plate.top, plate.width, plate.height);
  }
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(ink.left, ink.top);
  if (g.scale !== 1) ctx.scale(g.scale, g.scale);
  ctx.textAlign = 'left';
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, Math.max(opacity, 0.85))})`;
  // The wordmark sits on a dark plate, so it needs no dark outline to survive a
  // pale photograph — the plate is the contrast guarantee the old stroked text
  // was trying and failing to be.
  const origin = inkOrigin(ctx, text, g);
  ctx.fillText(text, origin.x, origin.y);
  ctx.restore();
}

/**
 * Where to put `fillText`'s alignment point so the INK lands with its top-left
 * corner exactly on the ink box's top-left corner, in the pre-scale coordinate
 * space the draw transform is working in.
 *
 * 🪤 `fillText(text, 0, ascent)` IS NOT ENOUGH, and getting this wrong is how a
 * measured box and a drawn glyph drift apart by a couple of pixels — which is
 * precisely the kind of gap a bounds assertion is supposed to catch, so it must
 * not be baked into the drawing. The glyphs do not start at the alignment
 * point: `actualBoundingBoxLeft` is the signed distance from it to the ink's
 * left edge (positive to the LEFT), so the alignment point has to be offset by
 * that amount for the ink's left edge to land on zero.
 */
function inkOrigin(
  ctx: CanvasRenderingContext2D,
  text: string,
  g: StampGeometry,
): { x: number; y: number } {
  const m = ctx.measureText(text);
  const ascent = m.actualBoundingBoxAscent;
  const left = m.actualBoundingBoxLeft;
  return {
    x: typeof left === 'number' ? left : 0,
    y: typeof ascent === 'number' && ascent > 0 ? ascent : g.ink.height / g.scale / 1.25,
  };
}

// ---- helpers ----

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load image'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas toBlob returned null'));
      },
      mime,
      mime === 'image/jpeg' ? 0.92 : undefined,
    );
  });
}

function preserveMime(originalMime: string): string {
  // Prefer the original mime if it's a known image type we can re-encode
  const supported = ['image/jpeg', 'image/png', 'image/webp'];
  if (supported.includes(originalMime)) return originalMime;
  // AVIF + others fall back to PNG so we don't silently lose quality + format
  return 'image/png';
}

function renameForMime(name: string, mime: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';
  return `${base}.${ext}`;
}
