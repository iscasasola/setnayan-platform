/**
 * apps/web/lib/encoder/encoder-layout.ts
 *
 * S2 · THE geometry spec for the broadcast extras (`ResolvedOverlays`) drawn on the
 * program canvas — a 1280×720 reference table with a scale factor for 1080p.
 *
 * NO SUCH SPEC EXISTED BEFORE THIS FILE. `BroadcastOverlays`
 * (`app/panood/program/[eventId]/program-surface.tsx`) places every layer with
 * Tailwind utility classes on a real DOM box model — padding, gap, line-height, font
 * metrics resolved by the browser. A canvas 2D context has none of that: every
 * fillRect/fillText call needs an actual number. The px below are THIS module's own
 * reference table, chosen to read the same way at broadcast scale — not a decode of
 * Tailwind's arithmetic, and not pixel-identical to the DOM by construction. See
 * `draw-overlays.ts`'s docblock for why that gap is fine here.
 *
 * SYMMETRY (unit-tested in encoder-layout.test.ts): opposite corners on the same edge
 * (top-left/top-right, bottom-left/bottom-right) are placed from ONE inset constant
 * per edge, so a box of a given size sits the same distance from its edge on both
 * sides. A future edit that special-cased one corner would be caught there.
 */

import type { MonogramPosition, QrPosition } from '../live-studio-overlays';

/** The window `program-surface.tsx` captures at. */
export const REFERENCE_WIDTH = 1280;
export const REFERENCE_HEIGHT = 720;

/** 1280×720 → 1920×1080 is exactly ×1.5 — the only other size S4/S5 need. */
export const SCALE_1080P = 1080 / REFERENCE_HEIGHT;

/** Top corners sit at the frame edge; bottom corners lift clear of the lower third
 *  (mirrors the DOM's `top-10` vs `bottom-40` — see program-surface.tsx `positionClass`). */
export const TOP_INSET = 40;
export const BOTTOM_INSET = 160;
export const SIDE_INSET = 40;

/* ── Ⓜ monogram bug ─────────────────────────────────────────────────────────────── */
export const MONOGRAM_MARK_SIZE = 64; // the couple's own mark, square (DOM: h-16 w-16)
export const MONOGRAM_PILL_PADDING_X = 20;
export const MONOGRAM_PILL_PADDING_Y = 10;
export const MONOGRAM_PILL_FONT_SIZE = 24; // derived-initials fallback, no mark uploaded

/* ── ⬛ event QR card ───────────────────────────────────────────────────────────── */
export const QR_IMAGE_SIZE = 112; // the same-origin PNG (DOM: h-28 w-28)
export const QR_CARD_PADDING = 10;
export const QR_CARD_GAP = 4;
export const QR_CARD_RADIUS = 12;
export const QR_LABEL_FONT_SIZE = 10;
export const QR_LABEL_TEXT = 'SCAN TO JOIN';

/* ── ▬ lower third ──────────────────────────────────────────────────────────────── */
export const LOWER_THIRD_PADDING_X = 40;
export const LOWER_THIRD_PADDING_BOTTOM = 32;
/** Vertical extent of the gradient band, bottom-anchored. */
export const LOWER_THIRD_BAND_HEIGHT = 190;
export const LOWER_THIRD_BAR_WIDTH = 5;
export const LOWER_THIRD_BAR_HEIGHT = 56;
export const LOWER_THIRD_BAR_COLOR = '#D96B4A'; // the one locked colour (rule/spec, both surfaces)
export const LOWER_THIRD_GAP = 16; // bar → text block
export const LOWER_THIRD_TITLE_FONT_SIZE = 20;
export const LOWER_THIRD_SUBTITLE_FONT_SIZE = 16;
export const LOWER_THIRD_LINE_GAP = 6;

export const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const MONOGRAM_FONT_STACK = 'Georgia, "Times New Roman", serif';

export type EncoderLayout = {
  width: number;
  height: number;
  scale: number;
  topInset: number;
  bottomInset: number;
  sideInset: number;
  monogramMarkSize: number;
  monogramPillPaddingX: number;
  monogramPillPaddingY: number;
  monogramPillFontSize: number;
  qrImageSize: number;
  qrCardPadding: number;
  qrCardGap: number;
  qrCardRadius: number;
  qrLabelFontSize: number;
  lowerThirdPaddingX: number;
  lowerThirdPaddingBottom: number;
  lowerThirdBandHeight: number;
  lowerThirdBarWidth: number;
  lowerThirdBarHeight: number;
  lowerThirdGap: number;
  lowerThirdTitleFontSize: number;
  lowerThirdSubtitleFontSize: number;
  lowerThirdLineGap: number;
};

/** Scale the reference table for a canvas of a different size — `scale` is linear on
 *  every length in the table, so a non-square scale is deliberately not supported. */
export function scaleLayout(scale: number, width = REFERENCE_WIDTH * scale, height = REFERENCE_HEIGHT * scale): EncoderLayout {
  const s = (n: number) => Math.round(n * scale);
  return {
    width,
    height,
    scale,
    topInset: s(TOP_INSET),
    bottomInset: s(BOTTOM_INSET),
    sideInset: s(SIDE_INSET),
    monogramMarkSize: s(MONOGRAM_MARK_SIZE),
    monogramPillPaddingX: s(MONOGRAM_PILL_PADDING_X),
    monogramPillPaddingY: s(MONOGRAM_PILL_PADDING_Y),
    monogramPillFontSize: s(MONOGRAM_PILL_FONT_SIZE),
    qrImageSize: s(QR_IMAGE_SIZE),
    qrCardPadding: s(QR_CARD_PADDING),
    qrCardGap: s(QR_CARD_GAP),
    qrCardRadius: s(QR_CARD_RADIUS),
    qrLabelFontSize: s(QR_LABEL_FONT_SIZE),
    lowerThirdPaddingX: s(LOWER_THIRD_PADDING_X),
    lowerThirdPaddingBottom: s(LOWER_THIRD_PADDING_BOTTOM),
    lowerThirdBandHeight: s(LOWER_THIRD_BAND_HEIGHT),
    lowerThirdBarWidth: s(LOWER_THIRD_BAR_WIDTH),
    lowerThirdBarHeight: s(LOWER_THIRD_BAR_HEIGHT),
    lowerThirdGap: s(LOWER_THIRD_GAP),
    lowerThirdTitleFontSize: s(LOWER_THIRD_TITLE_FONT_SIZE),
    lowerThirdSubtitleFontSize: s(LOWER_THIRD_SUBTITLE_FONT_SIZE),
    lowerThirdLineGap: s(LOWER_THIRD_LINE_GAP),
  };
}

/** The 1280×720 table — what `program-canvas.worker.ts` draws with, since its
 *  `OffscreenCanvas` is already exactly this size (see `program-plan.ts`). */
export const REFERENCE_LAYOUT: EncoderLayout = scaleLayout(1, REFERENCE_WIDTH, REFERENCE_HEIGHT);

/** The 1920×1080 table, for whichever S4/S5 encode surface ends up that size. */
export const LAYOUT_1080P: EncoderLayout = scaleLayout(SCALE_1080P, 1920, 1080);

/**
 * Top-left origin for a `boxWidth`×`boxHeight` box at a monogram/QR corner. The ONE
 * function both overlays place their box with, so "upper right" cannot mean two
 * different things here the way rule 0 warns a duplicated map always eventually does.
 */
export function cornerBoxOrigin(
  position: MonogramPosition | QrPosition,
  boxWidth: number,
  boxHeight: number,
  layout: EncoderLayout,
): { x: number; y: number } {
  switch (position) {
    case 'top-right':
      return { x: layout.width - layout.sideInset - boxWidth, y: layout.topInset };
    case 'top-left':
      return { x: layout.sideInset, y: layout.topInset };
    case 'bottom-right':
      return { x: layout.width - layout.sideInset - boxWidth, y: layout.height - layout.bottomInset - boxHeight };
    case 'bottom-left':
      return { x: layout.sideInset, y: layout.height - layout.bottomInset - boxHeight };
    case 'top-center':
      return { x: Math.round((layout.width - boxWidth) / 2), y: layout.topInset };
  }
}
