/**
 * apps/web/lib/hub-fonts.ts
 *
 * THE COUPLE'S OWN TYPEFACE — a fixed list, on Event Hub Pro.
 *
 * Owner's Pro list: *"Reveal, Custom Background, Custom Fonts, Custom
 * Background Music, Manual Uploads, E-Gifts"*. Uploads turned out to be free
 * (2026-09-23), so Pro is the LOOK, and the look is a palette, a background and
 * this.
 *
 * ── WHY A FIXED LIST AND NOT AN UPLOAD ─────────────────────────────────────
 * 🔑 `next/font` RESOLVES AT BUILD TIME. Every face below is already declared
 * in `app/layout.tsx` and served from our own origin, so choosing one costs a
 * guest nothing extra and cannot be blocked. A couple-uploaded font file would
 * mean a runtime `@font-face` against R2 on every guest's first paint, a
 * licensing question nobody has answered, and a face that fails to load
 * silently — the page would simply be set in something else and nobody would
 * know. The list is the honest version of "custom fonts".
 *
 * ⛔ AND EVERY ENTRY MUST BE A FACE THAT ACTUALLY LOADS. A key naming a
 * variable `layout.tsx` does not declare renders as the fallback stack with no
 * error anywhere — the couple picks Cinzel and gets Georgia, on their own
 * wedding page. `hub-fonts-are-loaded.test.ts` reads `layout.tsx` and fails on
 * any entry it cannot find there.
 *
 * ── HOW IT REACHES THE PAGE ────────────────────────────────────────────────
 * `--pahina-face` is the hook that already exists: `globals.css` sets
 * `font-family: var(--pahina-face, var(--font-pahina-display))` on the site's
 * display type, and two themes (Velvet, Galeriya) already override it. A
 * couple's choice is the same override, set inline on the site root beside the
 * colour vars. Nothing new is invented and no theme material is re-declared —
 * the themes carry COLOUR, and this carries TYPE.
 *
 * Pure. No I/O.
 */

/** The stored value. `null` / absent means "the theme's own face". */
export const HUB_FONT_KEYS = [
  'cormorant',
  'fraunces',
  'playfair',
  'caslon',
  'vidaloka',
  'cinzel',
  'script',
  'tangerine',
  'luxurious',
] as const;
export type HubFontKey = (typeof HUB_FONT_KEYS)[number];

export type HubFont = {
  key: HubFontKey;
  /** What the couple reads in the picker — shown SET IN THE FACE. */
  label: string;
  /** One honest line about where it belongs. */
  note: string;
  /** The CSS variable `app/layout.tsx` declares for it. */
  cssVar: string;
  /** The stack behind it, for the moment before the face arrives. */
  fallback: string;
};

export const HUB_FONTS: readonly HubFont[] = [
  { key: 'cormorant', label: 'Cormorant', note: 'Refined classic serif', cssVar: '--font-editorial-display', fallback: 'Georgia, serif' },
  { key: 'fraunces', label: 'Fraunces', note: 'Warm, modern serif', cssVar: '--font-pahina-display', fallback: 'Georgia, serif' },
  { key: 'playfair', label: 'Playfair', note: 'High-contrast editorial', cssVar: '--font-playfair', fallback: 'Georgia, serif' },
  { key: 'caslon', label: 'Libre Caslon', note: 'Timeless book serif', cssVar: '--font-libre-caslon', fallback: 'Georgia, serif' },
  { key: 'vidaloka', label: 'Vidaloka', note: 'Bold modern display', cssVar: '--font-vidaloka', fallback: 'Georgia, serif' },
  { key: 'cinzel', label: 'Cinzel', note: 'Engraved, formal capitals', cssVar: '--font-cinzel', fallback: 'Georgia, serif' },
  { key: 'script', label: 'Great Vibes', note: 'Romantic handwriting', cssVar: '--font-script', fallback: 'cursive' },
  { key: 'tangerine', label: 'Tangerine', note: 'Fine calligraphy', cssVar: '--font-tangerine', fallback: 'cursive' },
  { key: 'luxurious', label: 'Luxurious', note: 'Ornate, high-ceremony', cssVar: '--font-luxurious', fallback: 'Georgia, serif' },
];

export const HUB_FONT_BY_KEY: Readonly<Record<HubFontKey, HubFont>> = Object.freeze(
  Object.fromEntries(HUB_FONTS.map((f) => [f.key, f])) as Record<HubFontKey, HubFont>,
);

export function isHubFontKey(value: unknown): value is HubFontKey {
  return typeof value === 'string' && (HUB_FONT_KEYS as readonly string[]).includes(value);
}

/**
 * The stored key, or null.
 *
 * ⛔ Dropped, never repaired. `"Cormorant"` is not lower-cased into place: a
 * value this product did not write came from somewhere else, and guessing what
 * it meant is how a couple ends up with a face they never chose.
 */
export function sanitizeHubFontKey(value: unknown): HubFontKey | null {
  return isHubFontKey(value) ? value : null;
}

/**
 * The inline custom properties a chosen face contributes — or NOTHING at all.
 *
 * 🔑 An unset face returns `{}` so the site root carries no `--pahina-face`,
 * and `globals.css`'s own fallback (`var(--pahina-face, var(--font-pahina-display))`)
 * resolves to the theme's face exactly as it does today. A couple who has not
 * chosen gets byte-identical markup to before this existed.
 */
export function hubFontVars(key: unknown): Record<string, string> {
  const font = sanitizeHubFontKey(key);
  if (!font) return {};
  const f = HUB_FONT_BY_KEY[font];
  return {
    '--pahina-face': `var(${f.cssVar})`,
    /* `--font-display` as well, because the site sets its Tailwind `font-display`
       utility from it inside `.sn-editorial`. Setting only `--pahina-face` would
       move the Pahina headings and leave every `font-display` heading behind —
       one page, two typefaces, and only some of it the couple's choice. */
    '--font-display': `var(${f.cssVar})`,
  };
}

/** `font-family` for the picker chip, so the couple reads each name IN its face. */
export function hubFontPreviewStack(key: HubFontKey): string {
  const f = HUB_FONT_BY_KEY[key];
  return `var(${f.cssVar}), ${f.fallback}`;
}
