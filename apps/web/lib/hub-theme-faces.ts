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
 * ── NO STAND-INS (2026-10-04) ───────────────────────────────────────────────
 * Until this date ten of the spec's families were worn through the closest
 * face we shipped. The owner then asked for the real ones (*"Can you add them
 * for me?"*), and every family below is now its own face, from google/fonts
 * (`scripts/build-theme-faces.py`, declared in `app/_fonts/choice-faces.ts`).
 * A family missing from this table THROWS — there is no "closest face" path
 * left to fall back through. `lib/theme-faces-are-real.test.ts` holds it.
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
  // ── 2026-10-04 · the ten that used to be stand-ins, now the real faces.
  Lora: '--font-hub-lora',
  'Libre Baskerville': '--font-hub-baskerville',
  'Crimson Pro': '--font-hub-crimson',
  'Josefin Sans': '--font-hub-josefin',
  'Kaushan Script': '--font-hub-kaushan',
  'Alex Brush': '--font-hub-alexbrush',
  Parisienne: '--font-hub-parisienne',
  Cookie: '--font-hub-cookie',
  'Mrs Saint Delafield': '--font-hub-delafield',
  Monoton: '--font-hub-monoton',
};

/** The CSS variable a spec family is worn through — its own face, never another's. */
export function themeFaceVar(family: string): string {
  const own = THEME_FACE_VAR[family];
  if (!own) throw new Error(`No loaded face for "${family}" — add its file (scripts/build-theme-faces.py) and its row to THEME_FACE_VAR`);
  return own;
}
