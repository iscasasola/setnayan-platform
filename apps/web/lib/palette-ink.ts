/**
 * 🖋 THE INK THAT SITS ON A PALETTE COLOUR — decided by CONTRAST.
 *
 * Paint chips put the colour's name ON the colour; Fabric's stitch and the
 * Circles' thread holes are drawn in it too. Each colour takes whichever of the
 * two inks reads better against it, by WCAG contrast (`contrastRatio`,
 * `lib/hub-legibility.ts`) — not by the 150-mean shortcut `outlineOf()` uses
 * for a figure's edge. The approved prototype's note on why: Gold #B8934A sits
 * at 149.7 on the mean and would be handed the LIGHT ink (2.6:1); by contrast
 * the dark ink wins (5.3:1).
 *
 * The inks are fixed, not the theme's: they sit on the colour, never on the page.
 *
 * Pure. No I/O.
 */
import { contrastRatio } from '@/lib/hub-legibility';

export const PALETTE_INK_DARK = '#2b241c';
export const PALETTE_INK_LIGHT = '#f6f1e7';

/** The ink with the higher contrast on `hex` (a tie keeps the dark ink). */
export function paletteInkOn(hex: string): string {
  return contrastRatio(hex, PALETTE_INK_LIGHT) > contrastRatio(hex, PALETTE_INK_DARK) ? PALETTE_INK_LIGHT : PALETTE_INK_DARK;
}
