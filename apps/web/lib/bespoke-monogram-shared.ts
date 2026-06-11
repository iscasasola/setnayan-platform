/**
 * apps/web/lib/bespoke-monogram-shared.ts
 *
 * Client-safe half of the Setnayan AI Bespoke Monogram engine: the style
 * registry, the round caps, and the data-URI helper the studio tiles + hero
 * renderers use. The generation API + SVG sanitizer live in
 * lib/bespoke-monogram.ts (server-only).
 *
 * BRANDING (locked, 0037 § 5): customer-facing name is "Setnayan AI" — the
 * underlying vendor is never named in customer-visible strings.
 */

export const MAX_BESPOKE_ROUNDS_PER_EVENT = 12;
export const CANDIDATES_PER_ROUND = 4;

export type BespokeStyleKey = 'interlocked' | 'botanical' | 'crest' | 'geometric';

export type BespokeStyle = {
  key: BespokeStyleKey;
  label: string;
  hint: string;
};

export const BESPOKE_STYLES: BespokeStyle[] = [
  {
    key: 'interlocked',
    label: 'Interlocked',
    hint: 'Two letters woven into one mark',
  },
  {
    key: 'botanical',
    label: 'Botanical',
    hint: 'Initials in a fine-line wreath',
  },
  {
    key: 'crest',
    label: 'Heirloom Crest',
    hint: 'Engraved-stationery shield',
  },
  {
    key: 'geometric',
    label: 'Modern Geometric',
    hint: 'Clean lines, art-deco calm',
  },
];

export function isBespokeStyleKey(v: unknown): v is BespokeStyleKey {
  return typeof v === 'string' && BESPOKE_STYLES.some((s) => s.key === v);
}

/** Data-URI for inert <img> rendering (no script execution context). */
export function bespokeSvgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
