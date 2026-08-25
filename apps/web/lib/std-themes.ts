/**
 * Save-the-Date film FONTS — the couple's one look choice (iteration 0024).
 *
 * 2026-06-19 (owner): the old multi-property "themes" (background + colours +
 * font) are reduced to a FONT choice only — "look doesn't matter because we
 * have a custom background now." The Step-1 Background sets the scene, and the
 * legibility tone (lib/std-backgrounds · resolveStdLegibility → the film's
 * applyTextTone) drives the text colours over it. So every entry shares one
 * neutral palette and differs ONLY by its display font.
 *
 * The 5 ids are kept stable (no migration); each is repurposed as a distinct,
 * wedding-elegant font. Unknown/legacy ids fall back to the first via
 * resolveStdTheme. All Tailwind classes are complete string literals so JIT
 * includes them without safelisting; the font utilities are the registered
 * next/font families (tailwind.config fontFamily).
 */

export const STD_THEME_IDS = [
  'default',
  'moodboard',
  'heritage',
  'noir',
  'botanical',
] as const;

export type StdThemeId = (typeof STD_THEME_IDS)[number];

export type StdTheme = {
  id: StdThemeId;
  /** Font name shown in the picker (rendered IN the font). */
  label: string;
  description: string;
  /** Outer stage background class (moot — the Step-1 background shows through). */
  outerBg: string;
  /** Outer stage text class (moot — the legibility tone overrides it). */
  outerFg: string;
  /** Mono-uppercase accent label class (tone overrides the colour). */
  labelCls: string;
  /** Accent text colour (tone overrides). */
  accentText: string;
  /** Accent background (CTA buttons — kept, shared across fonts). */
  accentBg: string;
  /** Accent background hover state. */
  accentBgHover: string;
  /** Foreground colour ON the accent background (button text). */
  accentFgOnBg: string;
  /** Subtle/secondary text colour (tone overrides). */
  subtleText: string;
  /** Display font class — THE choice. Drives every heading + name/date/venue. */
  fontCls: string;
  /** Scrub-bar active fill (the bars are removed; tone overrides anyway). */
  scrubFill: string;
  /** CSS hex for the picker swatch background. */
  swatchBg: string;
  /** CSS hex for the picker swatch text. */
  swatchFg: string;
};

// One shared neutral palette — colours come from the background + tone, so only
// the accent button colour (mulberry on cream) is meaningful here.
const SHARED = {
  outerBg: 'bg-cream',
  outerFg: 'text-ink',
  /* THE FACE, AND ONLY THE FACE (H-2 · owner approved 2026-08-24, "lettering
     YES", after a side-by-side). These small announcements — "Save the Date",
     "Together with their families", "Mark your calendars" — sit directly above
     the couple's names and read as terminal type there. `font-serif` resolves
     inside `.sn-editorial` to `--font-editorial-display`, which IS the face the
     names themselves are set in on the default theme, so the label now reads as
     engraved small caps rather than a receipt.
     🔒 The size, the tracking, the uppercase and the tone are UNCHANGED. Moving
     any of them would be a second, unrequested design change riding along — and
     `text-terracotta` is the gold at 3.37:1, so moving the colour here would
     exceed the approval outright. */
  labelCls: 'font-serif text-sm uppercase tracking-[0.18em] text-terracotta',
  accentText: 'text-mulberry',
  accentBg: 'bg-mulberry',
  accentBgHover: 'hover:bg-mulberry-600',
  accentFgOnBg: 'text-cream',
  subtleText: 'text-ink/60',
  scrubFill: 'bg-mulberry',
  swatchBg: '#f5f0e8',
  swatchFg: '#1a1412',
} as const;

export const STD_THEMES: StdTheme[] = [
  { id: 'default', label: 'Cormorant', description: 'Refined classic serif', fontCls: 'font-display', ...SHARED },
  { id: 'moodboard', label: 'Playfair', description: 'High-contrast editorial', fontCls: 'font-playfair', ...SHARED },
  { id: 'heritage', label: 'Caslon', description: 'Warm, timeless book serif', fontCls: 'font-caslon', ...SHARED },
  { id: 'noir', label: 'Vidaloka', description: 'Bold modern display', fontCls: 'font-vidaloka', ...SHARED },
  { id: 'botanical', label: 'Script', description: 'Romantic handwritten', fontCls: 'font-script', ...SHARED },
];

export function resolveStdTheme(id: unknown): StdThemeId {
  return STD_THEME_IDS.includes(id as StdThemeId) ? (id as StdThemeId) : 'default';
}
