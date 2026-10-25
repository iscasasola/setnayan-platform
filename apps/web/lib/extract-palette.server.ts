import 'server-only';

import sharp from 'sharp';
import { paletteFromRgba } from './extract-palette';
import type { ColorRangeMap } from './color-recolor';

/**
 * lib/extract-palette.server.ts — THE SHIPPED PALETTE EXTRACTOR, ON THE SERVER (2026-10-19).
 *
 * 🌱🖼 Why it exists (controller, on PR #6655, owner goal *"create more inspirations faster"*): the couple's gallery
 * used to WITHHOLD a supplier photo with no tagged colour, and suppliers do not tag colours — so an approved,
 * credited photo was invisible, a success-shaped nothing. Every supplier upload now arrives with its colours read from
 * its own pixels (`autoColourRanges`, written by the upload action), and a photo that still has none is read here at
 * the couple's pick (`applyGalleryPick`).
 *
 * 🔑 THE SAME BUCKETING AS THE CANVAS EXTRACTOR (`paletteFromRgba`, one function, two callers) on the same 100×100
 * downscale — and NOT its cream padding: the Canvas path pads because a tainted cross-origin canvas returns nothing,
 * which is exactly the "fabricated palette that renders like a real one" `shapeGalleryPage` refused. On the server
 * there is no canvas to taint; what comes back is what the photo holds, and an unreadable photo returns `[]`.
 */
export async function extractPaletteFromBytes(bytes: Uint8Array): Promise<string[]> {
  try {
    const { data } = await sharp(Buffer.from(bytes), { failOn: 'none' })
      .rotate()
      .resize(100, 100, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return paletteFromRgba(data);
  } catch {
    return [];
  }
}

/** The tolerance a hand-tagged region starts at in the admin/supplier tagger (`color-range-manipulator.tsx`). */
export const AUTO_RANGE_TOLERANCE_DE = 15;
/** Said on every range this module wrote, so an admin adjusting tags can tell a read colour from a placed one. */
export const AUTO_RANGE_LABEL = 'Auto';

/** The photo's colours as tagger slots 1…6 — the `moodboard_asset_color_ranges` shape. Empty when none were read. */
export async function autoColourRanges(bytes: Uint8Array): Promise<ColorRangeMap> {
  const hexes = await extractPaletteFromBytes(bytes);
  const map: ColorRangeMap = {};
  hexes.slice(0, 6).forEach((hex, i) => {
    map[i + 1] = { slotId: i + 1, sampledHex: hex, toleranceDe: AUTO_RANGE_TOLERANCE_DE, regionLabel: AUTO_RANGE_LABEL };
  });
  return map;
}
