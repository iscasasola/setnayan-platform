/**
 * Save-the-Date film themes — visual treatment of the content film.
 * (iteration 0024 PR4 · live builder 2026-06-18)
 *
 * Each theme controls: background, text colour, accent colour, label style,
 * and display font. 'moodboard' is the default — it inherits the couple's
 * mood board palette (cream/ink/mulberry/terracotta). The others are fixed
 * palettes that offer a different aesthetic feel.
 *
 * All Tailwind classes are defined as complete string literals so JIT
 * includes them without safelisting.
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
  label: string;
  description: string;
  /** Outer stage background class. */
  outerBg: string;
  /** Outer stage text class. */
  outerFg: string;
  /** Mono-uppercase accent label class (replaces the hardcoded LABEL const). */
  labelCls: string;
  /** Accent text colour (monogram, decorative dividers). */
  accentText: string;
  /** Accent background (CTA buttons). */
  accentBg: string;
  /** Accent background hover state. */
  accentBgHover: string;
  /** Foreground colour ON the accent background (button text). */
  accentFgOnBg: string;
  /** Subtle/secondary text colour (subtitles, supporting copy). */
  subtleText: string;
  /** Display font class for headings + name/date/venue text. */
  fontCls: string;
  /** Scrub-bar active fill. */
  scrubFill: string;
  /** CSS hex for the theme picker swatch background. */
  swatchBg: string;
  /** CSS hex for the theme picker swatch text. */
  swatchFg: string;
};

export const STD_THEMES: StdTheme[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Clean & timeless',
    outerBg: 'bg-white',
    outerFg: 'text-gray-900',
    labelCls: 'font-mono text-[10px] uppercase tracking-[0.3em] text-gray-500',
    accentText: 'text-gray-900',
    accentBg: 'bg-gray-900',
    accentBgHover: 'hover:bg-gray-800',
    accentFgOnBg: 'text-white',
    subtleText: 'text-gray-500',
    fontCls: 'font-sans',
    scrubFill: 'bg-gray-900',
    swatchBg: '#ffffff',
    swatchFg: '#111827',
  },
  {
    id: 'moodboard',
    label: 'Mood Board',
    description: 'Your palette, your story',
    outerBg: 'bg-cream',
    outerFg: 'text-ink',
    labelCls: 'font-mono text-[10px] uppercase tracking-[0.3em] text-terracotta',
    accentText: 'text-mulberry',
    accentBg: 'bg-mulberry',
    accentBgHover: 'hover:bg-mulberry-600',
    accentFgOnBg: 'text-cream',
    subtleText: 'text-ink/60',
    fontCls: 'font-display',
    scrubFill: 'bg-mulberry',
    swatchBg: '#f5f0e8',
    swatchFg: '#1a1412',
  },
  {
    id: 'heritage',
    label: 'Heritage',
    description: 'Warm, timeless, classic',
    outerBg: 'bg-amber-50',
    outerFg: 'text-amber-950',
    labelCls: 'font-mono text-[10px] uppercase tracking-[0.3em] text-amber-700',
    accentText: 'text-amber-900',
    accentBg: 'bg-amber-900',
    accentBgHover: 'hover:bg-amber-800',
    accentFgOnBg: 'text-amber-50',
    subtleText: 'text-amber-700',
    fontCls: 'font-serif',
    scrubFill: 'bg-amber-900',
    swatchBg: '#fffbeb',
    swatchFg: '#451a03',
  },
  {
    id: 'noir',
    label: 'Noir',
    description: 'Cinematic, bold, dark',
    outerBg: 'bg-zinc-950',
    outerFg: 'text-zinc-50',
    labelCls: 'font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400',
    accentText: 'text-zinc-100',
    accentBg: 'bg-zinc-100',
    accentBgHover: 'hover:bg-white',
    accentFgOnBg: 'text-zinc-950',
    subtleText: 'text-zinc-400',
    fontCls: 'font-display',
    scrubFill: 'bg-zinc-100',
    swatchBg: '#09090b',
    swatchFg: '#fafafa',
  },
  {
    id: 'botanical',
    label: 'Botanical',
    description: 'Natural, garden, serene',
    outerBg: 'bg-stone-50',
    outerFg: 'text-stone-800',
    labelCls: 'font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-700',
    accentText: 'text-emerald-800',
    accentBg: 'bg-emerald-800',
    accentBgHover: 'hover:bg-emerald-900',
    accentFgOnBg: 'text-stone-50',
    subtleText: 'text-stone-500',
    fontCls: 'font-serif',
    scrubFill: 'bg-emerald-800',
    swatchBg: '#fafaf9',
    swatchFg: '#1c1917',
  },
];

export function resolveStdTheme(id: unknown): StdThemeId {
  return STD_THEME_IDS.includes(id as StdThemeId) ? (id as StdThemeId) : 'moodboard';
}
