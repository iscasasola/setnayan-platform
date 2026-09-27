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
 * — in `app/layout.tsx`, or (every face past the first nine, 2026-09-27: "use
 * all our fonts on the dropdown") in `app/_fonts/choice-faces.ts` with
 * `preload: false` — and served from our own origin, so choosing one cannot be
 * blocked, and a face nobody chose costs a guest's phone no download at all. A couple-uploaded font file would
 * mean a runtime `@font-face` against R2 on every guest's first paint, a
 * licensing question nobody has answered, and a face that fails to load
 * silently — the page would simply be set in something else and nobody would
 * know. The list is the honest version of "custom fonts".
 *
 * ⛔ AND EVERY ENTRY MUST BE A FACE THAT ACTUALLY LOADS. A key naming a
 * variable nothing declares renders as the fallback stack with no error
 * anywhere — the couple picks Cinzel and gets Georgia, on their own wedding
 * page. `hub-fonts-are-loaded.test.ts` reads `layout.tsx` and
 * `choice-faces.ts` and fails on any entry it cannot find declared AND applied.
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

/**
 * The stored value. `null` / absent means "the theme's own face".
 *
 * ⛔ THE FIRST NINE ARE STORED IN LIVE DRAFTS, `canvas.elements` AND
 * `events.site_font_key` — they are never renamed or removed. New faces are
 * APPENDED. Every key is `[a-z]+` because the `site_font_key` CHECK (and the
 * guard that compares it with this list) is written in that alphabet.
 */
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
  // ── 2026-09-27 · "use all our fonts on the dropdown" — every other face we ship.
  'cormorantsc',
  'playfairsc',
  'bodoni',
  'prata',
  'instrument',
  'cardo',
  'gilda',
  'cinzeldeco',
  'italiana',
  'marcellus',
  'yeseva',
  'limelight',
  'alfaslab',
  'oswald',
  'syne',
  'poiret',
  'pinyon',
  'herrvon',
  'haviland',
  'manrope',
  'hanken',
  'jost',
  'quicksand',
  'outfit',
  'schibsted',
  'poppins',
] as const;
export type HubFontKey = (typeof HUB_FONT_KEYS)[number];

/** The dropdown's shelves, in the order they are shown. */
export const HUB_FONT_GROUPS = ['Serif', 'Script', 'Sans', 'Display'] as const;
export type HubFontGroup = (typeof HUB_FONT_GROUPS)[number];

export type HubFont = {
  key: HubFontKey;
  /** What the couple reads in the picker — shown SET IN THE FACE. */
  label: string;
  /** The family's real name — what `lib/invite-themes.ts` calls it, for the count. */
  family: string;
  /** One honest line about where it belongs. */
  note: string;
  /** Which shelf of the dropdown it sits on. */
  group: HubFontGroup;
  /**
   * The CSS variable that loads it: declared by `app/layout.tsx` (the original
   * nine + the two chrome sans faces) or by `app/_fonts/choice-faces.ts`
   * (every other face, never preloaded).
   */
  cssVar: string;
  /** The stack behind it, for the moment before the face arrives. */
  fallback: string;
};

const SERIF = 'Georgia, serif';
const SANS = 'system-ui, sans-serif';

export const HUB_FONTS: readonly HubFont[] = [
  { key: 'cormorant', label: 'Cormorant', family: 'Cormorant Garamond', note: 'Refined classic serif', group: 'Serif', cssVar: '--font-editorial-display', fallback: SERIF },
  { key: 'fraunces', label: 'Fraunces', family: 'Fraunces', note: 'Warm, modern serif', group: 'Serif', cssVar: '--font-pahina-display', fallback: SERIF },
  { key: 'playfair', label: 'Playfair', family: 'Playfair Display', note: 'High-contrast editorial', group: 'Serif', cssVar: '--font-playfair', fallback: SERIF },
  { key: 'caslon', label: 'Libre Caslon', family: 'Libre Caslon Display', note: 'Timeless book serif', group: 'Serif', cssVar: '--font-libre-caslon', fallback: SERIF },
  { key: 'vidaloka', label: 'Vidaloka', family: 'Vidaloka', note: 'Bold modern display', group: 'Display', cssVar: '--font-vidaloka', fallback: SERIF },
  { key: 'cinzel', label: 'Cinzel', family: 'Cinzel', note: 'Engraved, formal capitals', group: 'Display', cssVar: '--font-cinzel', fallback: SERIF },
  { key: 'script', label: 'Great Vibes', family: 'Great Vibes', note: 'Romantic handwriting', group: 'Script', cssVar: '--font-script', fallback: 'cursive' },
  { key: 'tangerine', label: 'Tangerine', family: 'Tangerine', note: 'Fine calligraphy', group: 'Script', cssVar: '--font-tangerine', fallback: 'cursive' },
  { key: 'luxurious', label: 'Luxurious', family: 'Luxurious Script', note: 'Ornate, high-ceremony', group: 'Script', cssVar: '--font-luxurious', fallback: SERIF },

  { key: 'cormorantsc', label: 'Cormorant SC', family: 'Cormorant SC', note: 'Small capitals, classic', group: 'Serif', cssVar: '--font-hub-cormorantsc', fallback: SERIF },
  { key: 'playfairsc', label: 'Playfair SC', family: 'Playfair Display SC', note: 'Editorial small capitals', group: 'Serif', cssVar: '--font-hub-playfairsc', fallback: SERIF },
  { key: 'bodoni', label: 'Bodoni Moda', family: 'Bodoni Moda', note: 'Fashion-house contrast', group: 'Serif', cssVar: '--font-hub-bodoni', fallback: SERIF },
  { key: 'prata', label: 'Prata', family: 'Prata', note: 'Regency elegance', group: 'Serif', cssVar: '--font-hub-prata', fallback: SERIF },
  { key: 'instrument', label: 'Instrument Serif', family: 'Instrument Serif', note: 'Slim, gallery modern', group: 'Serif', cssVar: '--font-hub-instrument', fallback: SERIF },
  { key: 'cardo', label: 'Cardo', family: 'Cardo', note: 'Old-world book face', group: 'Serif', cssVar: '--font-hub-cardo', fallback: SERIF },
  { key: 'gilda', label: 'Gilda Display', family: 'Gilda Display', note: 'Soft, airy display serif', group: 'Serif', cssVar: '--font-hub-gilda', fallback: SERIF },
  { key: 'cinzeldeco', label: 'Cinzel Decorative', family: 'Cinzel Decorative', note: 'Capitals with flourishes', group: 'Display', cssVar: '--font-hub-cinzeldeco', fallback: SERIF },
  { key: 'italiana', label: 'Italiana', family: 'Italiana', note: 'Thin, fairy-tale capitals', group: 'Display', cssVar: '--font-hub-italiana', fallback: SERIF },
  { key: 'marcellus', label: 'Marcellus', family: 'Marcellus', note: 'Carved Roman capitals', group: 'Display', cssVar: '--font-hub-marcellus', fallback: SERIF },
  { key: 'yeseva', label: 'Yeseva One', family: 'Yeseva One', note: 'Plump, playful display', group: 'Display', cssVar: '--font-hub-yeseva', fallback: SERIF },
  { key: 'limelight', label: 'Limelight', family: 'Limelight', note: 'Art deco marquee', group: 'Display', cssVar: '--font-hub-limelight', fallback: SERIF },
  { key: 'alfaslab', label: 'Alfa Slab One', family: 'Alfa Slab One', note: 'Heavy poster slab', group: 'Display', cssVar: '--font-hub-alfaslab', fallback: SERIF },
  { key: 'oswald', label: 'Oswald', family: 'Oswald', note: 'Tall, condensed poster', group: 'Display', cssVar: '--font-hub-oswald', fallback: SANS },
  { key: 'syne', label: 'Syne', family: 'Syne', note: 'Wide, futuristic', group: 'Display', cssVar: '--font-hub-syne', fallback: SANS },
  { key: 'poiret', label: 'Poiret One', family: 'Poiret One', note: 'Hairline deco', group: 'Display', cssVar: '--font-hub-poiret', fallback: SANS },
  { key: 'pinyon', label: 'Pinyon Script', family: 'Pinyon Script', note: 'Copperplate calligraphy', group: 'Script', cssVar: '--font-hub-pinyon', fallback: 'cursive' },
  { key: 'herrvon', label: 'Herr Von Muellerhoff', family: 'Herr Von Muellerhoff', note: 'Quick, signature hand', group: 'Script', cssVar: '--font-hub-herrvon', fallback: 'cursive' },
  { key: 'haviland', label: 'Mr De Haviland', family: 'Mr De Haviland', note: 'Looping, formal hand', group: 'Script', cssVar: '--font-hub-haviland', fallback: 'cursive' },
  { key: 'manrope', label: 'Manrope', family: 'Manrope', note: 'Clean, friendly sans', group: 'Sans', cssVar: '--font-editorial-sans', fallback: SANS },
  { key: 'hanken', label: 'Hanken Grotesk', family: 'Hanken Grotesk', note: 'Crisp, modern sans', group: 'Sans', cssVar: '--font-hanken', fallback: SANS },
  { key: 'jost', label: 'Jost', family: 'Jost', note: 'Geometric, Bauhaus sans', group: 'Sans', cssVar: '--font-hub-jost', fallback: SANS },
  { key: 'quicksand', label: 'Quicksand', family: 'Quicksand', note: 'Rounded and soft', group: 'Sans', cssVar: '--font-hub-quicksand', fallback: SANS },
  { key: 'outfit', label: 'Outfit', family: 'Outfit', note: 'Even, contemporary sans', group: 'Sans', cssVar: '--font-hub-outfit', fallback: SANS },
  { key: 'schibsted', label: 'Schibsted Grotesk', family: 'Schibsted Grotesk', note: 'Bold newsroom sans', group: 'Sans', cssVar: '--font-hub-schibsted', fallback: SANS },
  { key: 'poppins', label: 'Poppins', family: 'Poppins', note: 'Round geometric sans', group: 'Sans', cssVar: '--font-hub-poppins', fallback: SANS },
];

/**
 * ⭐ THE FIVE MOST-USED FACES ON THE EVENT HUB — shown first in the dropdown.
 *
 * Owner, 2026-09-27: *"place on top the top 5 most used fonts on the website.
 * so it is easy for them to manage."*
 *
 * 🔑 MEASURED, NOT PICKED. This is the output of `countHubFontUse` /
 * `mostUsedHubFontKeys` (`lib/hub-fonts-most-used.ts`) over the ten Event Hub
 * themes in `lib/invite-themes.ts`: how many of the themes' face slots
 * (heading · body · labels · script) name each family we offer. It is a
 * constant (so the client bundle does not carry the theme registry) and
 * `hub-fonts-most-used.test.ts` fails the moment it and the count disagree —
 * change a theme's faces and that test prints the five to paste here.
 */
export const HUB_FONTS_MOST_USED: readonly HubFontKey[] = ['cormorant', 'cormorantsc', 'jost', 'quicksand', 'outfit'];

/** The group heading the five sit under. */
export const HUB_FONTS_MOST_USED_GROUP = 'Most used';

/**
 * The dropdown's order: the five most used first, then every other face on its
 * shelf. ⛔ A face appears ONCE — the five are not repeated below.
 */
export function hubFontsForPicker(): Array<HubFont & { pickGroup: string }> {
  const top = new Set<string>(HUB_FONTS_MOST_USED);
  const out: Array<HubFont & { pickGroup: string }> = HUB_FONTS_MOST_USED.map((k) => ({
    ...HUB_FONT_BY_KEY[k],
    pickGroup: HUB_FONTS_MOST_USED_GROUP,
  }));
  for (const g of HUB_FONT_GROUPS) {
    for (const f of HUB_FONTS) if (f.group === g && !top.has(f.key)) out.push({ ...f, pickGroup: g });
  }
  return out;
}

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

/**
 * 🅱 WHAT EACH FACE CAN DO — the weights and the italic this app actually LOADS
 * for it (`app/layout.tsx` + `app/_fonts/choice-faces.ts`), so the Maker's
 * Text tab offers Weight only where a face has more than one (the approved
 * prototype: *"pick a script face and Weight disappears"*) and B · I only where
 * the face has them. A weight nobody loaded would be faked by the browser —
 * smeared, not bold — so it is never offered.
 *
 * 🔒 `hub-font-faces-are-loaded.test.ts` reads both loader files and fails the
 * moment this table and the files disagree, either way.
 */
export const HUB_FONT_FACES: Readonly<Record<HubFontKey, { weights: readonly number[]; italic: boolean }>> = {
  cormorant: { weights: [400, 500, 600, 700], italic: false },
  fraunces: { weights: [300, 400, 500, 600], italic: true },
  playfair: { weights: [400, 600], italic: true },
  caslon: { weights: [400], italic: false },
  vidaloka: { weights: [400], italic: false },
  cinzel: { weights: [400, 600], italic: false },
  script: { weights: [400], italic: false },
  tangerine: { weights: [400, 700], italic: false },
  luxurious: { weights: [400], italic: false },
  cormorantsc: { weights: [400, 600], italic: false },
  playfairsc: { weights: [400], italic: false },
  bodoni: { weights: [600], italic: false },
  prata: { weights: [400], italic: false },
  instrument: { weights: [400], italic: true },
  cardo: { weights: [400, 700], italic: true },
  gilda: { weights: [400], italic: false },
  cinzeldeco: { weights: [400], italic: false },
  italiana: { weights: [400], italic: false },
  marcellus: { weights: [400], italic: false },
  yeseva: { weights: [400], italic: false },
  limelight: { weights: [400], italic: false },
  alfaslab: { weights: [400], italic: false },
  oswald: { weights: [500], italic: false },
  syne: { weights: [400, 700], italic: false },
  poiret: { weights: [400], italic: false },
  pinyon: { weights: [400], italic: false },
  herrvon: { weights: [400], italic: false },
  haviland: { weights: [400], italic: false },
  manrope: { weights: [400, 500, 600, 700], italic: false },
  hanken: { weights: [400, 500, 600, 700, 800], italic: false },
  jost: { weights: [400, 500], italic: false },
  quicksand: { weights: [400, 500], italic: false },
  outfit: { weights: [400, 500], italic: false },
  schibsted: { weights: [600], italic: false },
  poppins: { weights: [400, 500, 700], italic: false },
};

/** The face's heaviest loaded weight from 600 to 700 — what B makes it — or null (no B). */
export function hubFontBoldWeight(key: HubFontKey): number | null {
  const heavy = HUB_FONT_FACES[key].weights.filter((w) => w >= 600 && w <= 700);
  return heavy.length > 0 ? Math.max(...heavy) : null;
}
