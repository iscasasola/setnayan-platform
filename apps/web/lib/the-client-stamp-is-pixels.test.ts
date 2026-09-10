/**
 * THE BROWSER STAMP, IN PIXELS, AT THE SMALLEST SIZE THE UPLOADER ACCEPTS
 * (MB27).
 *
 * `one-mark-everywhere.test.ts` asserts the GEOMETRY — pure, swept, adversarial.
 * This file asks the harder question the geometry cannot answer on its own:
 * when `watermarkFile` actually runs, does the ink land where the geometry said
 * it would, and is the ring just outside the plate untouched?
 *
 * ── THE CANVAS IS A DOUBLE, AND HERE IS EXACTLY WHAT IT IS ────────────────
 * There is no browser in this suite, so `document`, `Image`, `FileReader` and
 * a 2D context are provided below. The double is NOT a spy that records calls
 * — a spy would prove the code called `fillText`, which is the "presence of
 * ink" answer this session exists to reject. It is a real RGBA framebuffer:
 *
 *   · `drawImage` blits real decoded pixels;
 *   · `fillText` blits a REAL GLYPH RASTER from a real TTF, rendered through
 *     satori → sharp, the same path `watermark-server.ts` rasterises with;
 *   · `roundRect` + `fill` fills a real rounded rectangle with real alpha
 *     compositing;
 *   · `measureText` returns the raster's real trimmed extents.
 *
 * So the geometry code, the draw order and the resulting pixels are the shipped
 * ones, and an assertion here reads bytes that were composited, not a flag.
 *
 * ⚠ WHAT IT IS NOT, said plainly:
 *   · the FONT is Poppins-Bold, the only heavy TTF this repo bundles. The
 *     browser resolves `ui-monospace / SF Mono / Menlo`. Different metrics —
 *     which is precisely why the shipped code MEASURES instead of estimating,
 *     and why the geometry sweep in the sibling file brackets advance ratios
 *     from 0.45em to 0.95em. A font surprise changes the measurement that goes
 *     IN, not the geometry that comes out.
 *   · antialiasing, colour management and `toBlob` encoding are the double's.
 * A real-Chromium check belongs in `tests/e2e`; this file does not claim to be
 * one. [[a-double-that-composites-is-not-a-double-that-records]]
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { WATERMARK_TEXT } from './watermark-text';
import { stampFontSize, stampGeometry, watermarkFile, type MarkBox } from './watermark';

/* ══════════════════════════════════════════════════════════════════════════
   A CANVAS THAT COMPOSITES
   ══════════════════════════════════════════════════════════════════════════ */

type Raster = { data: Buffer; width: number; height: number };

const FONT = path.join(process.cwd(), 'lib', 'social', 'fonts', 'Poppins-Bold.ttf');

/** The wordmark as real glyphs, trimmed to its own ink — the server's method. */
async function rasterizeInk(text: string, fontSizePx: number): Promise<Raster> {
  const { default: satori } = await import('satori');
  const fontData = fs.readFileSync(FONT);
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
            fontSize: fontSizePx,
            fontWeight: 700,
            color: 'rgba(255,255,255,1)',
            whiteSpace: 'nowrap',
          },
          children: text,
        },
      },
    },
  };
  const canvasW = Math.ceil(fontSizePx * (text.length + 4) * 1.4);
  const canvasH = Math.ceil(fontSizePx * 3);
  const svg = await satori(tree as unknown as React.ReactNode, {
    width: canvasW,
    height: canvasH,
    fonts: [{ name: 'Poppins', data: fontData, weight: 700, style: 'normal' }],
  });
  const { data, info } = await sharp(Buffer.from(svg))
    .png()
    .trim({ threshold: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.ok(info.width < canvasW, 'the harness raster clipped — widen its canvas');
  return { data, width: info.width, height: info.height };
}

function parseRgba(style: string): [number, number, number, number] {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/.exec(style);
  if (!m) return [255, 255, 255, 1];
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

/** Real source-over compositing into an RGBA framebuffer. */
function blend(buf: Buffer, i: number, r: number, g: number, b: number, a: number): void {
  if (a <= 0) return;
  buf[i] = Math.round(r * a + buf[i]! * (1 - a));
  buf[i + 1] = Math.round(g * a + buf[i + 1]! * (1 - a));
  buf[i + 2] = Math.round(b * a + buf[i + 2]! * (1 - a));
  buf[i + 3] = 255;
}

class FakeCtx {
  font = '10px sans-serif';
  fillStyle = '#000';
  strokeStyle = '#000';
  lineWidth = 1;
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';

  private tx = 0;
  private ty = 0;
  private scale_ = 1;
  private stack: Array<{ tx: number; ty: number; s: number; fill: string }> = [];
  private pathRects: Array<{ x: number; y: number; w: number; h: number; r: number }> = [];

  constructor(
    private readonly buf: Buffer,
    private readonly W: number,
    private readonly H: number,
    private readonly rasters: Map<number, Raster>,
  ) {}

  private fontPx(): number {
    const m = /(\d+(?:\.\d+)?)px/.exec(this.font);
    return m ? Number(m[1]) : 10;
  }

  private raster(): Raster {
    const px = this.fontPx();
    const r = this.rasters.get(px);
    if (!r) throw new Error(`harness: no glyph raster prewarmed for ${px}px`);
    return r;
  }

  save() {
    this.stack.push({ tx: this.tx, ty: this.ty, s: this.scale_, fill: this.fillStyle });
  }
  restore() {
    const p = this.stack.pop();
    if (p) {
      this.tx = p.tx;
      this.ty = p.ty;
      this.scale_ = p.s;
      this.fillStyle = p.fill;
    }
  }
  translate(x: number, y: number) {
    this.tx += x * this.scale_;
    this.ty += y * this.scale_;
  }
  scale(x: number, _y: number) {
    this.scale_ *= x;
  }
  rotate(_a: number) {
    throw new Error('harness: rotate is only used by the tile position, which is not exercised');
  }

  drawImage(img: { raster: Raster }, dx: number, dy: number) {
    const { data, width, height } = img.raster;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const px = dx + x;
        const py = dy + y;
        if (px < 0 || py < 0 || px >= this.W || py >= this.H) continue;
        const s = (y * width + x) * 4;
        const d = (py * this.W + px) * 4;
        blend(this.buf, d, data[s]!, data[s + 1]!, data[s + 2]!, data[s + 3]! / 255);
      }
    }
  }

  measureText(text: string) {
    assert.equal(text, WATERMARK_TEXT, 'the harness only rasterises the wordmark');
    const r = this.raster();
    return {
      width: r.width,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: r.width,
      actualBoundingBoxAscent: r.height,
      actualBoundingBoxDescent: 0,
    } as TextMetrics;
  }

  beginPath() {
    this.pathRects = [];
  }
  rect(x: number, y: number, w: number, h: number) {
    this.pathRects.push({ x, y, w, h, r: 0 });
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.pathRects.push({ x, y, w, h, r });
  }
  fill() {
    const [r, g, b, a] = parseRgba(this.fillStyle);
    for (const box of this.pathRects) {
      for (let y = 0; y < box.h; y += 1) {
        for (let x = 0; x < box.w; x += 1) {
          if (!insideRounded(x, y, box.w, box.h, box.r)) continue;
          const px = Math.round(this.tx + (box.x + x) * this.scale_);
          const py = Math.round(this.ty + (box.y + y) * this.scale_);
          if (px < 0 || py < 0 || px >= this.W || py >= this.H) continue;
          blend(this.buf, (py * this.W + px) * 4, r, g, b, a);
        }
      }
    }
    this.pathRects = [];
  }

  fillText(text: string, x: number, y: number) {
    const src = this.raster();
    const [r, g, b, a] = parseRgba(this.fillStyle);
    // The alignment point is a baseline point; the ink's top sits `ascent`
    // above it. Nearest-neighbour for the scaled case — the shipped code's only
    // transform is a uniform scale.
    const ascent = src.height;
    const outW = Math.max(1, Math.round(src.width * this.scale_));
    const outH = Math.max(1, Math.round(src.height * this.scale_));
    const originX = Math.round(this.tx + x * this.scale_);
    const originY = Math.round(this.ty + (y - ascent) * this.scale_);
    for (let oy = 0; oy < outH; oy += 1) {
      for (let ox = 0; ox < outW; ox += 1) {
        const sx = Math.min(src.width - 1, Math.floor((ox / outW) * src.width));
        const sy = Math.min(src.height - 1, Math.floor((oy / outH) * src.height));
        const s = (sy * src.width + sx) * 4;
        const alpha = (src.data[s + 3]! / 255) * a;
        if (alpha <= 0) continue;
        const px = originX + ox;
        const py = originY + oy;
        if (px < 0 || py < 0 || px >= this.W || py >= this.H) continue;
        blend(this.buf, (py * this.W + px) * 4, r, g, b, alpha);
      }
    }
  }

  strokeText() {
    throw new Error('harness: the stamp draws no stroked text — the plate is the contrast');
  }
}

function insideRounded(x: number, y: number, w: number, h: number, r: number): boolean {
  if (r <= 0) return true;
  const rr = Math.min(r, w / 2, h / 2);
  const cx = x < rr ? rr : x > w - rr - 1 ? w - rr - 1 : x;
  const cy = y < rr ? rr : y > h - rr - 1 ? h - rr - 1 : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= rr * rr + rr;
}

/**
 * Run the SHIPPED `watermarkFile` against the double and hand back the pixels.
 *
 * The globals are installed for the duration of one call and removed after, so
 * no other test in the suite inherits a fake `document`.
 */
async function markLikeABrowser(opts: {
  width: number;
  height: number;
  grey?: number;
  margin?: number;
  opacity?: number;
  position?: 'bottom-right' | 'bottom-center';
  /** Start from these RGBA pixels instead of a flat field — used to mark an
   *  already-marked image, which is the state Part 2 has to be able to see. */
  base?: Buffer;
}): Promise<{ pixels: Buffer; width: number; height: number; geometry: StampLike }> {
  const { width: W, height: H } = opts;
  const grey = opts.grey ?? 128;
  const fontSize = stampFontSize(W, H);
  const ink = await rasterizeInk(WATERMARK_TEXT, fontSize);
  const rasters = new Map<number, Raster>([[fontSize, ink]]);

  const buf = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i += 1) {
    buf[i * 4] = grey;
    buf[i * 4 + 1] = grey;
    buf[i * 4 + 2] = grey;
    buf[i * 4 + 3] = 255;
  }
  // The base photograph the component would have decoded: a flat field, so any
  // pixel that is not `grey` afterwards is ink this code drew.
  const baseRaster: Raster = {
    data: opts.base ? Buffer.from(opts.base) : Buffer.alloc(W * H * 4, 0),
    width: W,
    height: H,
  };
  if (!opts.base) {
    for (let i = 0; i < W * H; i += 1) {
      baseRaster.data[i * 4] = grey;
      baseRaster.data[i * 4 + 1] = grey;
      baseRaster.data[i * 4 + 2] = grey;
      baseRaster.data[i * 4 + 3] = 255;
    }
  }

  const ctx = new FakeCtx(buf, W, H, rasters);
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => (kind === '2d' ? ctx : null),
    toBlob: (cb: (b: Blob | null) => void) => cb(new Blob([new Uint8Array(0)])),
  };

  const g = globalThis as unknown as Record<string, unknown>;
  const saved = {
    document: g.document,
    Image: g.Image,
    FileReader: g.FileReader,
  };
  g.document = { createElement: (tag: string) => (tag === 'canvas' ? canvas : null) };
  g.Image = class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    raster = baseRaster;
    set src(_v: string) {
      this.naturalWidth = W;
      this.naturalHeight = H;
      queueMicrotask(() => this.onload?.());
    }
  };
  g.FileReader = class {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsDataURL(_f: File) {
      this.result = 'harness://base';
      queueMicrotask(() => this.onload?.());
    }
  };

  try {
    await watermarkFile(new File([new Uint8Array([1])], 'showcase.png', { type: 'image/png' }), {
      position: opts.position ?? 'bottom-right',
      opacity: opts.opacity ?? 0.55,
      ...(opts.margin === undefined ? {} : { margin: opts.margin }),
    });
  } finally {
    g.document = saved.document;
    g.Image = saved.Image;
    g.FileReader = saved.FileReader;
  }

  const geometry = stampGeometry({
    imageWidth: W,
    imageHeight: H,
    ink: { width: ink.width, height: ink.height, ascent: ink.height },
    fontSize,
    margin: opts.margin ?? 24,
    position: opts.position ?? 'bottom-right',
  });

  return { pixels: buf, width: W, height: H, geometry };
}

type StampLike = ReturnType<typeof stampGeometry>;

/** Mean |pixel − background| over a box. Zero means nothing was drawn there. */
function deviation(px: Buffer, W: number, box: MarkBox, grey: number): number {
  let sum = 0;
  let n = 0;
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      const i = (y * W + x) * 4;
      sum += Math.abs(px[i]! - grey);
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/** Fraction of pixels in a box that differ from the background at all. */
function coverage(px: Buffer, W: number, box: MarkBox, grey: number): number {
  let hit = 0;
  let n = 0;
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      const i = (y * W + x) * 4;
      if (Math.abs(px[i]! - grey) > 2) hit += 1;
      n += 1;
    }
  }
  return n === 0 ? 0 : hit / n;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE ASSERTIONS
   ══════════════════════════════════════════════════════════════════════════ */

test('the mark is really composited, and the plate really covers its box', async () => {
  const { pixels, width, geometry } = await markLikeABrowser({ width: 800, height: 600 });
  assert.ok(
    coverage(pixels, width, geometry.plate, 128) > 0.9,
    'the plate must be a filled pill, not a few letters',
  );
  assert.ok(
    deviation(pixels, width, geometry.ink, 128) > 8,
    'there must be real ink inside the ink box',
  );
});

test('THE RING JUST OUTSIDE THE PLATE IS UNTOUCHED — the mark did not overflow', async () => {
  // 🔑 THIS IS THE ASSERTION THE OLD CODE COULD NOT HAVE PASSED at small sizes,
  // and the one "is there ink in the bottom-right third" never asked. An
  // overflow is not a crash: canvas clips silently, and every other signal of
  // success survives it.
  for (const [w, h] of [
    [800, 600],
    [320, 240],
    [240, 180],
  ] as Array<[number, number]>) {
    const { pixels, width, height, geometry } = await markLikeABrowser({ width: w, height: h });
    const p = geometry.plate;
    const ring = 2;
    const strips: MarkBox[] = [];
    if (p.left - ring >= 0)
      strips.push({ left: p.left - ring, top: p.top, width: ring, height: p.height });
    if (p.top - ring >= 0)
      strips.push({ left: p.left, top: p.top - ring, width: p.width, height: ring });
    if (p.left + p.width + ring <= width)
      strips.push({ left: p.left + p.width, top: p.top, width: ring, height: p.height });
    if (p.top + p.height + ring <= height)
      strips.push({ left: p.left, top: p.top + p.height, width: p.width, height: ring });
    assert.ok(strips.length > 0, `no ring available at ${w}x${h}`);
    for (const strip of strips) {
      assert.equal(
        deviation(pixels, width, strip, 128),
        0,
        `ink outside the plate at ${w}x${h} — the mark overflowed`,
      );
    }
  }
});

test('the ink sits inside the plate with real padding on all four sides', async () => {
  const { pixels, width, geometry } = await markLikeABrowser({ width: 800, height: 600 });
  const p = geometry.plate;
  const i = geometry.ink;

  // The padding bands are plate, not wordmark: covered by the plate's fill, and
  // carrying none of the wordmark's brightness. Read from the PIXELS.
  const bands: Array<[string, MarkBox]> = [
    ['left', { left: p.left, top: p.top, width: i.left - p.left, height: p.height }],
    [
      'right',
      { left: i.left + i.width, top: p.top, width: p.left + p.width - (i.left + i.width), height: p.height },
    ],
    ['top', { left: p.left, top: p.top, width: p.width, height: i.top - p.top }],
    [
      'bottom',
      { left: p.left, top: i.top + i.height, width: p.width, height: p.top + p.height - (i.top + i.height) },
    ],
  ];
  for (const [side, band] of bands) {
    assert.ok(band.width > 0 && band.height > 0, `${side} padding band must exist`);
    // Plate is dark over grey → deviation well above zero; wordmark is near
    // white → far brighter. The band must be plate-dark, never wordmark-bright.
    let brightest = 0;
    for (let y = band.top; y < band.top + band.height; y += 1) {
      for (let x = band.left; x < band.left + band.width; x += 1) {
        brightest = Math.max(brightest, pixels[(y * width + x) * 4]!);
      }
    }
    assert.ok(brightest < 200, `${side} padding band carries wordmark ink (max ${brightest})`);
  }
});

test('AT THE SMALLEST SIZE THE COMPONENT ACCEPTS, the plate is still whole', async () => {
  // `file-upload.tsx` has no dimension check — MIME and byte size only — so
  // every one of these is a size it hands to this code.
  //
  // 🔑 A MEASURED LIMIT, FOUND BY THIS TEST AND KEPT RATHER THAN HIDDEN. The
  // first version of this assertion demanded visible ink at EVERY size and went
  // red at 1x1 with `dev=1`. Not a bug in the mark: at one pixel the plate
  // darkens the pixel to 83 and the wordmark's antialiased edge lightens it
  // back to 129 — one step from the 128 it started at. A one-pixel image cannot
  // carry a legible URL, and a threshold tuned until that case passed would
  // have been a number invented to make a test green.
  //
  // So the guarantee is split where the physics splits it: FIT is promised at
  // every size (and a throw here would mean an UNMARKED upload — see the
  // module header), while VISIBLE INK is asserted wherever the plate is big
  // enough for the claim to mean anything.
  const MEANINGFUL_PLATE_PX = 100;
  for (const [w, h] of [
    [240, 180],
    [120, 90],
    [40, 40],
    [8, 8],
    [1, 1],
  ] as Array<[number, number]>) {
    const { pixels, width, height, geometry } = await markLikeABrowser({ width: w, height: h });
    assert.ok(
      geometry.plate.left >= 0 &&
        geometry.plate.top >= 0 &&
        geometry.plate.left + geometry.plate.width <= width &&
        geometry.plate.top + geometry.plate.height <= height,
      `the plate must be inside a ${w}x${h} image`,
    );
    assert.ok(
      geometry.ink.left >= geometry.plate.left &&
        geometry.ink.top >= geometry.plate.top &&
        geometry.ink.left + geometry.ink.width <= geometry.plate.left + geometry.plate.width &&
        geometry.ink.top + geometry.ink.height <= geometry.plate.top + geometry.plate.height,
      `the ink must be inside the plate at ${w}x${h}`,
    );
    if (geometry.plate.width * geometry.plate.height >= MEANINGFUL_PLATE_PX) {
      assert.ok(
        deviation(pixels, width, geometry.plate, 128) > 8,
        `a ${w}x${h} image must carry a visible mark`,
      );
    }
  }
});

test('LEGIBLE AT THE 18px FLOOR — measured off the ink, not asserted from the font size', async () => {
  // 450px short edge is where the 18px floor takes over. The question is not
  // "is there ink" but "can it be read": the wordmark must occupy a real share
  // of its plate, at a real per-character width, with real contrast against it.
  const W = 450;
  const { pixels, width, geometry } = await markLikeABrowser({ width: W, height: 450 });
  assert.equal(stampFontSize(W, 450), 18);
  assert.equal(geometry.scale, 1, 'no shrink is needed at 450px — the type is full size');

  const perChar = geometry.ink.width / WATERMARK_TEXT.length;
  assert.ok(perChar >= 6, `each character needs real width (got ${perChar.toFixed(1)}px)`);
  assert.ok(geometry.ink.height >= 9, `the glyphs need real height (got ${geometry.ink.height}px)`);

  // Contrast: the wordmark's brightest pixels against the plate's darkest. A
  // mark you cannot separate from its own plate is not legible however well it
  // fits. The plate is rgba(20,18,16,0.42) over grey; the ink is near-white.
  let inkMax = 0;
  for (let y = geometry.ink.top; y < geometry.ink.top + geometry.ink.height; y += 1) {
    for (let x = geometry.ink.left; x < geometry.ink.left + geometry.ink.width; x += 1) {
      inkMax = Math.max(inkMax, pixels[(y * width + x) * 4]!);
    }
  }
  const plateSample = pixels[((geometry.plate.top + 1) * width + geometry.plate.left + 1) * 4]!;
  assert.ok(
    inkMax - plateSample > 90,
    `wordmark must stand off its plate (ink ${inkMax} vs plate ${plateSample})`,
  );

  // And the ink must fill a real share of the plate — a legible mark, not a
  // correctly-positioned speck in a correctly-sized pill.
  const share = (geometry.ink.width * geometry.ink.height) / (geometry.plate.width * geometry.plate.height);
  assert.ok(share > 0.3, `the wordmark must fill its plate (share ${share.toFixed(2)})`);
});

test('bottom-center puts the plate inside the image too', async () => {
  const { width, height, geometry } = await markLikeABrowser({
    width: 320,
    height: 240,
    position: 'bottom-center',
  });
  assert.ok(geometry.plate.left >= 0);
  assert.ok(geometry.plate.left + geometry.plate.width <= width);
  assert.ok(geometry.plate.top + geometry.plate.height <= height);
});

/**
 * The deliverable sample: a marketplace upload at the smallest size the
 * component accepts that a person can still look at, marked, written to disk
 * for the session report. Not an assertion — a receipt a human can open.
 */
test('write the report sample: a small marketplace upload, marked', async () => {
  const out = process.env.MB27_SAMPLE_OUT;
  if (!out) return; // only when the session asks for it
  const { pixels, width, height } = await markLikeABrowser({ width: 240, height: 180, grey: 150 });
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(out);
});

/* ══════════════════════════════════════════════════════════════════════════
   PART 2 · EXACTLY ONE MARK REGION, PROVEN OFF THE PIXELS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The source side of this claim lives in `one-mark-everywhere.test.ts`, which
 * quotes the line from `app/admin/moodboard-library/actions.ts` that settled
 * it: the action passes `await file.arrayBuffer()` straight to
 * `.upload(objectKey, arrayBuffer, …)` and never marks. So the admin path is
 * ONE client mark, and the pixels below are what that produces.
 *
 * 🔑 WHY DARKNESS AND NOT A COUNT OF SHAPES. A second mark from either path
 * lands in the SAME bottom-right corner as the first, so "how many plates are
 * there" is not a question a connected-component count can answer — one plate
 * drawn twice is still one shape. What a second plate DOES change is the
 * pixel: `rgba(20,18,16,0.42)` composited twice is measurably darker than once
 * (measured below, and asserted as a gap, not as a magic constant).
 *
 * The test proves it can tell the two apart BEFORE it uses the distinction:
 * the double-marked case is constructed here and asserted to differ. A guard
 * that cannot demonstrate its own discrimination is a guard that will one day
 * pass over the bug it was written for.
 */
test('a fixture through the full admin path carries ONE mark region, not two', async () => {
  const size = { width: 800, height: 600 };

  // What the admin path actually produces: library-editor.tsx's single call,
  // with its own options, then bytes straight to storage.
  const once = await markLikeABrowser({ ...size, opacity: 0.55 });

  // The state MB27 was sent to look for: marked again on top of the mark.
  const twice = await markLikeABrowser({ ...size, opacity: 0.55, base: once.pixels });

  // 🪤 NOT THE PLATE'S TOP-LEFT PIXEL — the plate is a pill with a radius of
  // half its height, so its corner is OUTSIDE the fill and reads as untouched
  // background. The first version of this test sampled there and reported
  // "once 128, twice 128", which is the plate saying nothing at all. Sample the
  // top padding band at the horizontal centre: plate fill, no wordmark.
  const plateFill = (px: Buffer, g: StampLike): number => {
    const band: MarkBox = {
      left: g.plate.left + Math.floor(g.plate.width / 2) - 5,
      top: g.plate.top + 1,
      width: 10,
      height: Math.max(1, g.ink.top - g.plate.top - 2),
    };
    let sum = 0;
    let n = 0;
    for (let y = band.top; y < band.top + band.height; y += 1) {
      for (let x = band.left; x < band.left + band.width; x += 1) {
        sum += px[(y * size.width + x) * 4]!;
        n += 1;
      }
    }
    return sum / n;
  };
  const plateOnce = plateFill(once.pixels, once.geometry);
  const plateTwice = plateFill(twice.pixels, twice.geometry);

  // The instrument works: two plates are darker than one, by a wide margin.
  assert.ok(
    plateOnce - plateTwice > 10,
    `this test cannot tell one mark from two (once ${plateOnce}, twice ${plateTwice})`,
  );

  // And the admin path is the single-mark case.
  assert.ok(
    plateOnce > plateTwice,
    'the admin path is showing double-mark darkness — something marks it twice',
  );

  // A mark IS present: "exactly one" must never be satisfied by zero.
  assert.ok(coverage(once.pixels, size.width, once.geometry.plate, 128) > 0.9);
});
