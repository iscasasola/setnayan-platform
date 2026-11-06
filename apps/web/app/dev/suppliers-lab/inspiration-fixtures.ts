/**
 * 💡 The lab's inspiration board (`&insp=1|empty|unread`) — Suppliers › Find's row A and each category's strip B
 * (`lib/find-inspiration.ts`, reorg R5), on the fallback parts (no database) and drawn stand-in photos (no network).
 * `p-lola` is in the lab's picks, so its bouquet shows "On your list".
 */
import { fallbackInspirationParts, inspirationPartsInOrder } from '@/lib/inspiration-parts';
import { buildFindInspiration, type FindInspiration, type FindInspirationPhoto } from '@/lib/find-inspiration';

const swatch = (a: string, b: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="40" height="40" fill="url(#g)"/></svg>`,
  )}`;

const PHOTOS: FindInspirationPhoto[] = [
  { slotKey: 'bridal_bouquet', imageUrl: swatch('#f3c6d3', '#c97a93'), fromSupplier: true, vendorProfileId: 'p-lola' },
  { slotKey: 'bridal_bouquet', imageUrl: swatch('#f6d9c9', '#d99a7c'), fromSupplier: false, vendorProfileId: null },
  { slotKey: 'centrepieces', imageUrl: swatch('#e9dcc0', '#bfa36f'), fromSupplier: true, vendorProfileId: 'p-elsewhere' },
  { slotKey: 'centrepieces', imageUrl: swatch('#dfe8d0', '#9fb489'), fromSupplier: false, vendorProfileId: null },
  { slotKey: 'flowers', imageUrl: swatch('#d6e3cf', '#8ea783'), fromSupplier: false, vendorProfileId: null },
  { slotKey: 'cake', imageUrl: swatch('#f4e6cf', '#d2b07a'), fromSupplier: false, vendorProfileId: null },
  { slotKey: 'cake', imageUrl: swatch('#f0d8c8', '#c98f73'), fromSupplier: true, vendorProfileId: 'p-bituin' },
  { slotKey: 'stage', imageUrl: swatch('#d9dff0', '#8d9bc6'), fromSupplier: false, vendorProfileId: null },
];

/** The lab's picks — `p-lola` and `p-bituin` are on the list (`fixtures.ts`). */
const ON_LIST = new Set(['p-lola', 'p-bituin', 'p-hiraya']);

export function labInspiration(mode: string | undefined): FindInspiration | null {
  const parts = inspirationPartsInOrder(fallbackInspirationParts());
  if (mode === 'unread') return buildFindInspiration(parts, null, ON_LIST);
  if (mode === 'empty') return buildFindInspiration(parts, [], ON_LIST);
  if (mode === '1') return buildFindInspiration(parts, PHOTOS, ON_LIST);
  return null;
}
