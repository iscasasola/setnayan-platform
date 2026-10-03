/**
 * lib/hub-theme-faces.ts — WHICH LOADED FACE EACH THEME'S TYPE ROLE WEARS.
 *
 * Every theme in `lib/invite-themes.ts` names four faces (`fonts`: heading ·
 * body · labels · script). Until 2026-10-04 the `[data-hub-theme]` blocks in
 * `app/globals.css` wired only the heading (`--font-display`) and, on five
 * themes, the labels (`--font-mono`) — so every paragraph, RSVP question and
 * button on every theme was set in the app's own face (Hanken Grotesk). B5 of
 * `INVITATION_RSVP_GUEST_FLOW_REMAINING_2026-10-04.md` wires the rest:
 *
 *   · `--font-body`         the theme's body face; the block also points
 *                           `--font-sans` and `font-family` at it, so text that
 *                           names no face (paragraphs, questions, buttons)
 *                           inherits it;
 *   · `--font-theme-script` the theme's script face, read by Tailwind's
 *                           `font-script` (`tailwind.config.ts`). A theme with no
 *                           script (Modern, Great Gatsby) points it at its
 *                           heading face.
 *   · `--font-mono`         the labels face, now on every theme.
 *
 * 🔑 NOT `--font-script`. That name is Great Vibes' own variable (`app/layout.tsx`)
 * and the host's "Great Vibes" font choice resolves through it
 * (`lib/hub-fonts.ts` `cssVar: '--font-script'`). A theme block redefining it
 * would turn a Luxe host's chosen Great Vibes into Pinyon Script — the host's
 * choice must win over the theme for the role it sets.
 *
 * ── FONTS LOAD PER THEME, NEVER IN THE SHARED CHUNK ─────────────────────────
 * Every variable below is ALREADY declared on `<html>` — by `app/layout.tsx` or
 * `app/_fonts/choice-faces.ts` — with `preload: false` (except the first-paint
 * faces). Declaring a variable downloads nothing; a face's file is fetched only
 * when text is set in it, i.e. only on a page wearing the theme that names it.
 * So this wiring adds no font declaration, no JavaScript and no preload.
 *
 * ── STAND-INS (an owner question, not a decision) ───────────────────────────
 * Ten of the spec's body/labels/script families are not in the repo
 * (`app/_fonts/`). Each is worn through the CLOSEST face we ship, named in
 * `THEME_FACE_STAND_INS` with its reason, until the owner says whether the real
 * OFL files may be added from google/fonts. Swapping one in later is one line
 * here plus a declaration in `choice-faces.ts`; `lib/invite-themes.test.ts`
 * re-derives every block from this table, so the CSS follows.
 *
 * Pure data. No I/O.
 */

/** A family the repo SHIPS → the CSS variable that loads it. */
export const THEME_FACE_VAR: Readonly<Record<string, string>> = {
  'Cormorant Garamond': '--font-editorial-display',
  'Cormorant SC': '--font-hub-cormorantsc',
  Cardo: '--font-hub-cardo',
  Jost: '--font-hub-jost',
  Quicksand: '--font-hub-quicksand',
  Outfit: '--font-hub-outfit',
  'Poiret One': '--font-hub-poiret',
  'Pinyon Script': '--font-hub-pinyon',
  'Great Vibes': '--font-script',
  'Mr De Haviland': '--font-hub-haviland',
};

/**
 * A spec family the repo does NOT ship → the shipped face worn in its place, and why.
 * 🔑 Every entry is an open owner question (flagged in the PR): add the real file?
 */
export const THEME_FACE_STAND_INS: Readonly<Record<string, { face: string; why: string }>> = {
  Lora: { face: 'Cardo', why: 'a sturdy old-style book serif for running text, like Lora' },
  'Libre Baskerville': { face: 'Cardo', why: 'a transitional book serif made for body text, like Libre Baskerville' },
  'Crimson Pro': { face: 'Cardo', why: 'a Garalde book serif, like Crimson Pro' },
  'Josefin Sans': { face: 'Jost', why: 'a geometric, vintage-modern sans, like Josefin Sans' },
  'Kaushan Script': { face: 'Great Vibes', why: 'the brush-script role; no casual brush face ships' },
  'Alex Brush': { face: 'Great Vibes', why: 'same designer (Rob Leuschke) and the same formal brush script' },
  Parisienne: { face: 'Great Vibes', why: 'same designer (Rob Leuschke), the same flowing script' },
  Cookie: { face: 'Great Vibes', why: 'the script role; no rounded brush face ships' },
  'Mrs Saint Delafield': { face: 'Mr De Haviland', why: 'same foundry (Sudtipos), the same formal signature hand' },
  Monoton: { face: 'Poiret One', why: 'a thin-line deco display, the closest to a neon tube that ships' },
};

/** The CSS variable a spec family is worn through (its own, or its stand-in's). */
export function themeFaceVar(family: string): string {
  const own = THEME_FACE_VAR[family];
  if (own) return own;
  const stand = THEME_FACE_STAND_INS[family];
  const via = stand ? THEME_FACE_VAR[stand.face] : undefined;
  if (!via) throw new Error(`No loaded face for "${family}" — add it to THEME_FACE_VAR or THEME_FACE_STAND_INS`);
  return via;
}
