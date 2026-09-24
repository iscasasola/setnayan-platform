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
 *   photograph   the couple uploaded a hero. It fills the sheet, a veil darkens
 *                it, and the type sits on top in white. **Nothing derived beats
 *                the real photograph.**
 *   letterpress  no accent at all. Ink on house stock, heavy rule, stacked
 *                caps. **Plainness as intent** — this is Movie Night, a third
 *                of his page, and the case most likely to look broken if it is
 *                treated as a failure instead of a style.
 *   moon         an accent that cannot carry a letter. A white disc nearly the
 *                sheet's width holds every word, in ink.
 *   sheet        an accent that can. White type directly on the colour.
 *
 * ⚖ A PHOTOGRAPH NEVER GETS THE MOON — owner ruled 2026-09-23, asked in plain
 * terms whether a real photo should be darkened behind the words or keep the
 * white circle floating over it. He chose the darkened photo.
 *
 * 🔑 THE MOON IS A COLOUR-LEGIBILITY DEVICE, NOT PART OF THE COUPLE'S IDENTITY.
 * That is what his answer settles. It exists because a measured colour could
 * carry neither white nor ink — and **a photograph has no single contrast to
 * measure**, so the threshold rule below cannot extend to it. A scrim can:
 * `event-card-art.ts` already validated the veil for all 360 hues at four scrim
 * depths against both a pure-white and a pure-black photograph.
 *
 * 🔑 THE CHOICE BETWEEN `moon` AND `sheet` IS CONTRAST, NOT TASTE, and the
 * prototype says so in its own CSS comment: *"Gold cannot carry text, so the art
 * makes room."* Measured with this repo's own `contrastRatio`:
 *
 *   wine #9a244f   white on it 7.67   → sheet
 *   gold #9b7e00   white on it 3.90   → moon
 *
 * ⚠ GOLD FAILS AGAINST INK TOO, AND NAME THE INK OR THE NUMBER MISLEADS. Against
 * `--m-ink` #2C2A29 — the ink the poster actually sets type in — it is **3.66**.
 * Against `--sn-ink-900` #1B1A17 it is 4.46. Two sessions computed it against
 * different inks and got different figures; both were right and the conclusion
 * is the same, but 4.46 reads as "nearly passing" and 3.66 does not. The one
 * that governs is the ink the type is set in: 3.66.
 *
 * So gold carries NEITHER white nor ink, which is exactly why the art gives the
 * words their own white ground rather than tinting the sheet a little darker.
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

export type PosterSheet = 'photograph' | 'letterpress' | 'moon' | 'sheet';

export type PosterInput = {
  /** The couple's own hero. When it exists it IS the poster. */
  landing_page_hero_image_url?: string | null;
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

  /*
    THE PHOTOGRAPH OUTRANKS EVERYTHING, INCLUDING THE ACCENT. A couple who
    uploaded a hero gets it, veiled, whatever colour they also chose — and the
    accent is still reported so the frame and sash can carry it, but it no
    longer decides the sheet. There is deliberately NO branch here that keeps
    the moon over a photograph: the owner ruled it out, so leaving one would be
    a dead path a later reader would wonder about.
  */
  const heroUrl = event.landing_page_hero_image_url?.trim() || null;
  if (heroUrl) {
    const hrgb = accentHex ? rgbOfHex(accentHex) : null;
    return {
      sheet: 'photograph',
      accentHex,
      whiteOnAccent: hrgb ? contrastRatio(hrgb, WHITE) : null,
      sprigs: false,
      capiz: false,
      credits: [],
    };
  }
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

  /*
    ⛔ "DEFAULT" IS NOT A CREDIT. `std_theme = 'default'` is a real stored value
    — `themeChosen` is true for it — but it names the house face, not an art
    direction, and a film poster crediting "Default" reads as debug output that
    escaped. Seen on Maria & Jose's gold sheet the first time these rendered:
    the prototype's gold poster carries no credit line at all, and with this
    exclusion it does not, which is how the translation was checked.

    The rule is the same one `sprigs` already follows — a credit names art the
    reader can SEE. Nothing on the sheet changes for a default theme, so there
    is nothing to name.
  */
  const namedTheme = themeChosen && resolveStdTheme(event.std_theme) !== 'default';

  const credits = [
    namedTheme ? creditName(event.std_theme!) : '',
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
