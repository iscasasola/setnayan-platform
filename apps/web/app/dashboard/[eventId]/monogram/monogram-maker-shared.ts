/**
 * monogram-maker-shared.ts — non-client constants for the lettered monogram
 * data model (typeface options + per-lockup defaults). Used by the server-side
 * saveMonogram action (actions.ts) + onboarding; the standalone lettered Maker
 * UI was retired 2026-06-19 in favour of the Vector Studio + Upload paths.
 *
 * These previously lived in monogram-maker.tsx (`'use client'`). A Server
 * Component importing a VALUE export from a `'use client'` module gets
 * `undefined` in the PRODUCTION RSC build (dev is lenient about it), so the
 * monogram page crashed at render with
 *   `TypeError: MONO_FONT_OPTIONS.some is not a function`
 * — a hidden-in-prod Server Components error (digest only). Keeping these in a
 * plain module means the server import is a real array. Do NOT add `'use
 * client'` here, and never import these from monogram-maker.tsx into a server
 * component.
 */

export type MonoStyle = 'bar' | 'script' | 'duo' | 'framed' | 'infinity';

/**
 * The typeface picker (2026-06-11 expansion). Keys MUST mirror MonoFontKey /
 * MONO_FONT_STACK in lib/monogram.ts and FONT_KEYS in ./actions.ts; the CSS
 * vars are loaded globally in app/layout.tsx (next/font/google).
 */
export type MonoFontOption = {
  key: string;
  label: string;
  css: string; // CSS var stack
  fontStyle: 'italic' | 'normal';
};

export const MONO_FONT_OPTIONS: MonoFontOption[] = [
  { key: 'cormorant', label: 'Cormorant', css: 'var(--font-display)', fontStyle: 'italic' },
  { key: 'playfair', label: 'Playfair', css: 'var(--font-playfair)', fontStyle: 'italic' },
  { key: 'cinzel', label: 'Cinzel', css: 'var(--font-cinzel)', fontStyle: 'normal' },
  { key: 'script', label: 'Great Vibes', css: 'var(--font-script)', fontStyle: 'normal' },
  { key: 'libre_caslon', label: 'Libre Caslon', css: 'var(--font-libre-caslon)', fontStyle: 'normal' },
  { key: 'tangerine', label: 'Tangerine', css: 'var(--font-tangerine)', fontStyle: 'normal' },
  { key: 'luxurious', label: 'Luxurious Script', css: 'var(--font-luxurious)', fontStyle: 'normal' },
  { key: 'vidaloka', label: 'Vidaloka', css: 'var(--font-vidaloka)', fontStyle: 'normal' },
];

/** Each lockup's default face — what saveMonogram stores when the couple never
 *  touches the typeface row (mirrors DESIGNS in ./actions.ts). */
export const DEFAULT_FONT_FOR_STYLE: Record<MonoStyle, string> = {
  bar: 'cormorant',
  script: 'script',
  duo: 'playfair',
  framed: 'cinzel',
  infinity: 'cormorant',
};
