/**
 * apps/web/lib/encoder/draw-overlays.ts
 *
 * S2 · draws the ₱0 broadcast extras (`ResolvedOverlays`) onto the program canvas —
 * the encoder-side twin of `BroadcastOverlays` in `program-surface.tsx`.
 *
 * ⚠ E2 WAS WRONG about what "the overlay" even is. It guarded `ProgramFrame.overlay` /
 * `WatermarkReason` — the LEGACY full-screen paywall, retired 2026-07-25
 * (`lib/panood-watermark.ts`, `decideWatermark` → `overlay:false`; the unified
 * `ProgramBridgeHost` publishes `overlay:false` unconditionally). This module never
 * reads that field and draws no such thing. What actually rides the broadcast is
 * `ResolvedOverlays` — monogram · lower third · event QR — resolved SERVER-SIDE by
 * `resolveOverlays` in `live-studio-overlays.ts` and handed here already decided.
 *
 * PURE PAINTING ONLY. This module makes no paywall-shaped decision of its own — it
 * draws exactly the `ResolvedOverlays` it is handed, exactly like the DOM draws
 * exactly the `overlays` prop it is handed. Imports ONLY TYPES from
 * `live-studio-overlays.ts` — never `resolveOverlays`, and nothing in `lib/encoder/`
 * may call `canPublishMultiCam` or `decideWatermark` either (rule 18/19/21;
 * `draw-overlays.test.ts` greps the whole directory for all three names).
 *
 * WHETHER to draw at all — "nothing on program yet" (`EMPTY_FRAME`) draws no overlay,
 * because there is nothing to brand — is the CALLER's decision (`shouldDrawOverlays`
 * below, used by `program-canvas.worker.ts`'s overlay hook), not this function's. This
 * function draws unconditionally whatever `ResolvedOverlays` it is given.
 *
 * PARITY WITH THE DOM IS DECISION-LEVEL, NOT PIXEL-LEVEL: the same three layers are
 * present/absent under the same conditions, with the same `lowerThird.forced` colour
 * and the same corner set — every px is `encoder-layout.ts`'s own reference table,
 * not a re-implementation of the DOM's Tailwind box model. A 1280×720 canvas and the
 * pop-out's 1280×720 capture window will not necessarily match to the pixel, and nothing
 * here tries to make them.
 *
 * IMAGES (the monogram mark, the event QR) load asynchronously and are cached BY URL
 * for the life of the module — a `data:` URI or a same-origin PNG never changes bytes
 * for the same key, and re-decoding either one every 33 ms tick would be wasted work
 * for a picture that cannot have changed. A tick that lands before the bitmap is ready
 * draws nothing for that layer, once — no placeholder box, no exception, no throw. The
 * NEXT tick (≤ 33 ms later) draws it as soon as the fetch/decode resolves.
 */

import type { ResolvedOverlays, MonogramPosition, QrPosition } from '../live-studio-overlays';
import type { ProgramFrameWire } from './program-plan';
import {
  cornerBoxOrigin,
  FONT_STACK,
  LOWER_THIRD_BAR_COLOR,
  MONOGRAM_FONT_STACK,
  QR_LABEL_TEXT,
  type EncoderLayout,
} from './encoder-layout';

/** The subset of a 2D context this module draws with — real `OffscreenCanvasRenderingContext2D`
 *  satisfies it structurally; tests pass a recording fake. */
export type OverlayCanvasContext = {
  save(): void;
  restore(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): {
    addColorStop(offset: number, color: string): void;
  };
  fillStyle: string | unknown;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
};

/** `hasStream || hasSecondaryStream`, i.e. an actual camera is airing — not the
 *  no-signal placeholder. `EMPTY_FRAME` (`source: null, stream: null, secondaryStream:
 *  null`) is the canonical instance of "false" here: nothing on program, so nothing to
 *  brand. Exported so the invariant is directly unit-testable, not just implied by the
 *  worker's wiring. */
export function shouldDrawOverlays(frame: Pick<ProgramFrameWire, 'hasStream' | 'hasSecondaryStream'>): boolean {
  return frame.hasStream || frame.hasSecondaryStream;
}

/** The two pieces of DOM parity data `ResolvedOverlays` itself does not carry — the
 *  QR image URL (an event-scoped API route, resolved by the page since a Worker's
 *  relative fetch would resolve against ITS OWN script URL, not the page's) and the
 *  couple's monogram text, used exactly as the DOM's `lowerThirdFallback` is: only
 *  when a paid host enabled the bar but left the title blank. */
export type OverlayAssets = {
  qrSrc: string | null;
  lowerThirdFallback: string;
  /** Injectable so tests never share state; defaults to one module-level cache. */
  imageCache?: OverlayImageCache;
};

type ImageCacheEntry =
  | { status: 'loading' }
  | { status: 'ready'; bitmap: ImageBitmapLike }
  | { status: 'error' };

/** `ImageBitmap` in a browser/worker; tests hand in an opaque marker object instead. */
export type ImageBitmapLike = unknown;

export type OverlayImageCache = Map<string, ImageCacheEntry>;

/** Real fetch + decode, browser/worker only. Tests inject their own cache pre-populated
 *  with `{ status: 'ready', bitmap }`, so this path never runs under `node:test`. */
async function loadImage(url: string, cache: OverlayImageCache): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`overlay image ${res.status}`);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    cache.set(url, { status: 'ready', bitmap });
  } catch {
    cache.set(url, { status: 'error' });
  }
}

const defaultImageCache: OverlayImageCache = new Map();

function getImage(url: string, cache: OverlayImageCache): ImageBitmapLike | null {
  const entry = cache.get(url);
  if (entry?.status === 'ready') return entry.bitmap;
  if (!entry) {
    cache.set(url, { status: 'loading' });
    void loadImage(url, cache);
  }
  return null;
}

/** Draw exactly the overlays given — see the module docblock for what "exactly" excludes. */
export function drawOverlays(
  ctx: OverlayCanvasContext,
  overlays: ResolvedOverlays | null,
  layout: EncoderLayout,
  assets: OverlayAssets,
): void {
  if (!overlays) return;
  const cache = assets.imageCache ?? defaultImageCache;
  if (overlays.monogram) drawMonogram(ctx, overlays.monogram, layout, cache);
  if (overlays.eventQr && assets.qrSrc) drawEventQr(ctx, overlays.eventQr, assets.qrSrc, layout, cache);
  if (overlays.lowerThird) drawLowerThird(ctx, overlays.lowerThird, assets.lowerThirdFallback, layout);
}

/** A rounded-rect PATH only (caller fills/strokes) — built from primitives every
 *  `CanvasPath` implementation has, so a recording test fake needs no `roundRect`. */
function roundedRectPath(ctx: OverlayCanvasContext, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function drawMonogram(
  ctx: OverlayCanvasContext,
  monogram: NonNullable<ResolvedOverlays['monogram']>,
  layout: EncoderLayout,
  cache: OverlayImageCache,
): void {
  const size = layout.monogramMarkSize;
  if (monogram.markDataUri) {
    const bitmap = getImage(monogram.markDataUri, cache);
    if (!bitmap) return; // not decoded yet — next tick draws it, nothing drawn now
    const { x, y } = cornerBoxOrigin(monogram.position, size, size, layout);
    ctx.drawImage(bitmap, x, y, size, size);
    return;
  }
  // No mark uploaded: the derived-initials serif pill, matching the DOM fallback
  // (program-surface.tsx: `rounded-full border border-white/35 bg-black/35 ... italic`).
  ctx.font = `italic 600 ${layout.monogramPillFontSize}px ${MONOGRAM_FONT_STACK}`;
  const textWidth = ctx.measureText(monogram.text).width;
  const boxW = Math.round(textWidth + layout.monogramPillPaddingX * 2);
  const boxH = Math.round(layout.monogramPillFontSize + layout.monogramPillPaddingY * 2);
  const { x, y } = cornerBoxOrigin(monogram.position, boxW, boxH, layout);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundedRectPath(ctx, x, y, boxW, boxH, boxH / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  roundedRectPath(ctx, x, y, boxW, boxH, boxH / 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(monogram.text, x + boxW / 2, y + boxH / 2);
}

function drawEventQr(
  ctx: OverlayCanvasContext,
  eventQr: NonNullable<ResolvedOverlays['eventQr']>,
  qrSrc: string,
  layout: EncoderLayout,
  cache: OverlayImageCache,
): void {
  const inner = layout.qrImageSize;
  ctx.font = `700 ${layout.qrLabelFontSize}px ${FONT_STACK}`;
  const labelWidth = ctx.measureText(QR_LABEL_TEXT).width;
  const cardW = Math.round(Math.max(inner, labelWidth) + layout.qrCardPadding * 2);
  const cardH = Math.round(inner + layout.qrCardGap + layout.qrLabelFontSize + layout.qrCardPadding * 2);
  const { x, y } = cornerBoxOrigin(eventQr.position, cardW, cardH, layout);

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundedRectPath(ctx, x, y, cardW, cardH, layout.qrCardRadius);
  ctx.fill();

  const bitmap = getImage(qrSrc, cache);
  if (bitmap) {
    const imgX = x + Math.round((cardW - inner) / 2);
    ctx.drawImage(bitmap, imgX, y + layout.qrCardPadding, inner, inner);
  }

  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(QR_LABEL_TEXT, x + cardW / 2, y + layout.qrCardPadding + inner + layout.qrCardGap + layout.qrLabelFontSize);
}

function drawLowerThird(
  ctx: OverlayCanvasContext,
  lowerThird: NonNullable<ResolvedOverlays['lowerThird']>,
  fallbackTitle: string,
  layout: EncoderLayout,
): void {
  const bandY = layout.height - layout.lowerThirdBandHeight;
  const gradient = ctx.createLinearGradient(0, bandY, 0, layout.height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.6)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, bandY, layout.width, layout.lowerThirdBandHeight);

  const barX = layout.lowerThirdPaddingX;
  const barY = layout.height - layout.lowerThirdPaddingBottom - layout.lowerThirdBarHeight;
  ctx.fillStyle = LOWER_THIRD_BAR_COLOR;
  ctx.fillRect(barX, barY, layout.lowerThirdBarWidth, layout.lowerThirdBarHeight);

  const textX = barX + layout.lowerThirdBarWidth + layout.lowerThirdGap;
  // A paid host who enabled the bar but typed nothing gets the couple's monogram text
  // — never an empty strip. `resolveOverlays` already sends `title: '' ` for that case.
  const title = lowerThird.title || fallbackTitle;
  const hasSubtitle = Boolean(lowerThird.subtitle);
  const titleY =
    layout.height -
    layout.lowerThirdPaddingBottom -
    (hasSubtitle ? layout.lowerThirdSubtitleFontSize + layout.lowerThirdLineGap : 0);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${layout.lowerThirdTitleFontSize}px ${FONT_STACK}`;
  // `forced` (the free-tier "POWERED BY SETNAYAN" bar) reads in the locked bar colour —
  // the host cannot switch it off, and the colour says so at a glance (rule 18).
  ctx.fillStyle = lowerThird.forced ? LOWER_THIRD_BAR_COLOR : '#fff';
  ctx.fillText(title.toUpperCase(), textX, titleY);

  if (lowerThird.subtitle) {
    ctx.font = `400 ${layout.lowerThirdSubtitleFontSize}px ${FONT_STACK}`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(lowerThird.subtitle, textX, layout.height - layout.lowerThirdPaddingBottom);
  }
}

export type { MonogramPosition, QrPosition };
