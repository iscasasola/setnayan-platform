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

/**
 * 🪜 THE THIRD STEP (owner 2026-10-15, DECISION_LOG "SIX OWNER ANSWERS" (2); the Legibility table of
 * `prototypes/palette_styles_2026-10-15_fable.html`). A mid-tone can sit where NEITHER fixed ink reaches the
 * body-text line (4.5 : 1) — the Principal Sponsors' Taupe #8B7E74 gets 3.89 : 1 from the dark ink. Then the ink
 * falls to pure near-black / white, whichever reads better (Taupe: #111111, 4.80 : 1). Only a word ON a colour
 * needs it (Paint chips, Arch tabs, Paint strokes); the looks that keep their words in the page's ink never do.
 */
export const PALETTE_INK_FALLBACK_DARK = '#111111';
export const PALETTE_INK_FALLBACK_LIGHT = '#ffffff';
/** WCAG AA for body text — the line a fixed ink must reach before the fallback is used. */
const AA = 4.5;

/** The ink for `hex`, and whether it is the fallback step (the markup says so, `data-ink="fallback"`). */
export function paletteInkStep(hex: string): { ink: string; fallback: boolean } {
  const light = contrastRatio(hex, PALETTE_INK_LIGHT);
  const dark = contrastRatio(hex, PALETTE_INK_DARK);
  if (light >= AA || dark >= AA) return { ink: light > dark ? PALETTE_INK_LIGHT : PALETTE_INK_DARK, fallback: false };
  const ink =
    contrastRatio(hex, PALETTE_INK_FALLBACK_LIGHT) > contrastRatio(hex, PALETTE_INK_FALLBACK_DARK) ? PALETTE_INK_FALLBACK_LIGHT : PALETTE_INK_FALLBACK_DARK;
  return { ink, fallback: true };
}

/** The ink with the higher contrast on `hex` (a tie keeps the dark ink); the fallback step when neither reaches 4.5 : 1. */
export function paletteInkOn(hex: string): string {
  return paletteInkStep(hex).ink;
}
