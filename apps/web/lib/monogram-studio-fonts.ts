/**
 * The Vector Monogram Studio's eight self-hosted faces (OFL), in one module so
 * both the studio's config model (`monogram-studio-shared.ts`) and the Logo
 * layer model (`logo-layers.ts`) read ONE list — neither imports the other.
 */

export const STUDIO_FONT_KEYS = [
  'cardo',
  'gilda',
  'playfairsc',
  'marcellus',
  'yeseva',
  'cinzeldec',
  'script',
  'pinyon',
] as const;
export type StudioFontKey = (typeof STUDIO_FONT_KEYS)[number];

export const STUDIO_FONTS: { key: StudioFontKey; label: string; file: string }[] = [
  { key: 'cardo', label: 'Cardo', file: 'Cardo-Italic.ttf' },
  { key: 'gilda', label: 'Gilda', file: 'GildaDisplay-Regular.ttf' },
  { key: 'playfairsc', label: 'Playfair', file: 'PlayfairDisplaySC-Regular.ttf' },
  { key: 'marcellus', label: 'Marcellus', file: 'Marcellus-Regular.ttf' },
  { key: 'yeseva', label: 'Yeseva', file: 'YesevaOne-Regular.ttf' },
  { key: 'cinzeldec', label: 'Cinzel Dec', file: 'CinzelDecorative-Regular.ttf' },
  { key: 'script', label: 'Vibes', file: 'GreatVibes-Regular.ttf' },
  { key: 'pinyon', label: 'Pinyon', file: 'PinyonScript-Regular.ttf' },
];

/** Public path the client engine fetches a face from (self-hosted, OFL). */
export function studioFontUrl(file: string): string {
  return `/monogram-studio/fonts/${file}`;
}
