/**
 * celebration-poster.ts — which poster a celebration prints.
 *
 * Translating `build-sessions/prototypes/public_profile_icecasa_FABLE3_2026-09-23.html`,
 * approved by the owner after three iterations. **Translate, do not reinterpret**
 * — the three sheets below are his, not this module's invention. What IS this
 * module's job is making the CHOICE between them derivable, so a fourth
 * celebration gets the right sheet without anybody hand-assigning one.
 *
 * ── THE THREE SHEETS ───────────────────────────────────────────────────────
 *   letterpress  no accent at all. Ink on house stock, heavy rule, stacked
 *                caps. **Plainness as intent** — this is Movie Night, a third
 *                of his page, and the case most likely to look broken if it is
 *                treated as a failure instead of a style.
 *   moon         an accent that cannot carry a letter. A white disc nearly the
 *                sheet's width holds every word, in ink.
 *   sheet        an accent that can. White type directly on the colour.
 *
 * 🔑 THE CHOICE BETWEEN `moon` AND `sheet` IS CONTRAST, NOT TASTE, and the
 * prototype says so in its own CSS comment: *"Gold cannot carry text, so the art
 * makes room."* Measured with this repo's own `contrastRatio`:
 *
 *   wine #9a244f   white on it 7.67   → sheet
 *   gold #9b7e00   white on it 3.90   → moon   (and 4.46 on ink: it can hold
 *                                               NEITHER, which is exactly why
 *                                               the art gives the words their
 *                                               own white ground)
 *
 * ⛔ THE FIX IS NEVER A DIFFERENT GOLD. His accent is his accent — it is the
 * colour he chose for his own Save-the-Date film. A poster that "solves"
 * contrast by nudging the hue has taken his decision away from him. The
 * composition moves instead.
 */

import { contrastRatio, rgbOfHex, type Rgb } from './story-light';
import { resolveStdTheme } from './std-themes';

/** WCAG AA for normal text. A name set on a sheet is reading matter, not decoration. */
export const POSTER_TEXT_MIN = 4.5;

const WHITE: Rgb = [255, 255, 255];

export type PosterSheet = 'letterpress' | 'moon' | 'sheet';

export type PosterInput = {
  std_film_accent_hex?: string | null;
  std_theme?: string | null;
  invite_theme?: string | null;
};

export type Poster = {
  sheet: PosterSheet;
  /** The accent, normalised — `null` on a letterpress sheet. */
  accentHex: string | null;
  /** Contrast of white type on the accent. `null` when there is no accent. */
  whiteOnAccent: number | null;
  /** Ornaments the themes earn. Both false on a letterpress sheet. */
  sprigs: boolean;
  capiz: boolean;
  /**
   * The credit line at the foot, the way a film poster carries credits — the
   * themes became the art, so they are named rather than shown as chips.
   * Empty when the celebration chose nothing.
   */
  credits: string[];
};

/** `#rgb` / `#rrggbb` only, lowercased. Anything else is "no accent". */
export function normalizeAccent(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}

/** Title-case a stored theme key for the credit line: `capiz` → `Capiz`. */
function creditName(raw: string): string {
  const t = raw.trim();
  return t ? t[0]!.toUpperCase() + t.slice(1).toLowerCase() : '';
}

/**
 * The poster for a celebration.
 *
 * ⚠ A THEME ONLY EARNS ITS ORNAMENT ON A COLOURED SHEET. The sprigs and the
 * capiz panes are drawn in white at low opacity — on house stock they would be
 * invisible, and a credit line naming art nobody can see is worse than no
 * credit at all. So a celebration with a theme but no accent prints plain, and
 * says nothing it cannot show.
 */
export function resolvePoster(event: PosterInput): Poster {
  const accentHex = normalizeAccent(event.std_film_accent_hex);
  const rgb = accentHex ? rgbOfHex(accentHex) : null;
  const whiteOnAccent = rgb ? contrastRatio(rgb, WHITE) : null;

  if (!accentHex || whiteOnAccent === null) {
    return {
      sheet: 'letterpress',
      accentHex: null,
      whiteOnAccent: null,
      sprigs: false,
      capiz: false,
      credits: [],
    };
  }

  const themeChosen =
    typeof event.std_theme === 'string' && event.std_theme.trim().length > 0;
  const inviteChosen =
    typeof event.invite_theme === 'string' && event.invite_theme.trim().length > 0;

  // `botanical` is the STD theme that draws sprigs; the others are typefaces.
  const sprigs = themeChosen && resolveStdTheme(event.std_theme) === 'botanical';
  const capiz = inviteChosen && event.invite_theme!.trim().toLowerCase() === 'capiz';

  const credits = [
    themeChosen ? creditName(event.std_theme!) : '',
    inviteChosen ? creditName(event.invite_theme!) : '',
  ].filter(Boolean);

  return {
    sheet: whiteOnAccent >= POSTER_TEXT_MIN ? 'sheet' : 'moon',
    accentHex,
    whiteOnAccent,
    sprigs,
    capiz,
    credits,
  };
}
