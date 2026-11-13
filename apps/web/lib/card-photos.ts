/**
 * 🖼 A SERVICE CARD'S PHOTOS ARE ONE GALLERY (owner 2026-11-13, DECISION_LOG "CARD MAKER GALLERY UPLOAD APPROVED";
 * approved drawing `prototypes/card_maker_gallery_upload_2026-11-13/`).
 *
 * The data did not change: the PRIMARY photo is still `vendor_services.primary_photo_r2_key` (the card's cover — the
 * word on screen is "Primary", the column keeps its name) and the rest are still `showcase_photo_r2_keys`. What changed
 * is that the maker draws them as ONE ordered list — the primary first — so "Set as primary" is a swap and "Delete the
 * primary" promotes the next photo. These pure functions are that list's rules, shared by the maker and the server, so
 * the two can never disagree about which photo is the primary or how many a card holds.
 *
 * Framework-free: no React, no DOM — loadable from a server action and a client component alike.
 */

import { formatCount } from '@/lib/format-number';

/**
 * The showcase photos a card may hold — NOT a new number. The database holds it:
 * `CHECK (cardinality(showcase_photo_r2_keys) <= 5)` in migration
 * `20270502342558_vendor_service_card_pricing_media_discounts.sql`. `lib/card-photos.test.ts` reads that CHECK and fails
 * if this constant ever stops matching it. (Not `vendor-tier-caps.ts` `portfolioPhotos` — that is the shop's portfolio.)
 */
export const CARD_SHOWCASE_MAX_PHOTOS = 5;

/** Every photo a card may hold: the primary + the showcase photos (6). The grid's add tile hides at this. */
export const CARD_MAX_PHOTOS = 1 + CARD_SHOWCASE_MAX_PHOTOS;

/** The grid's ordered list from the two stored fields: the primary first, then the showcase photos. No blanks, no repeats. */
export function cardPhotoOrder(primary: string | null | undefined, showcase: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const r of [primary ?? null, ...(showcase ?? [])]) {
    const ref = typeof r === 'string' ? r.trim() : '';
    if (ref && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/**
 * The two stored fields from what was posted — the SERVER's rule, so a card is never saved without a valid primary
 * while it has photos, and never past the CHECK:
 *   · a repeat is dropped (the primary never also sits in the showcase);
 *   · no primary but showcase photos → the first showcase photo IS the primary (the grid's rule: the first is primary);
 *   · past the limit, the extras are dropped — the CHECK would refuse the whole save otherwise.
 */
export function cardPhotoFields(
  primary: string | null | undefined,
  showcase: readonly string[] | null | undefined,
): { primary_photo_r2_key: string | null; showcase_photo_r2_keys: string[] } {
  const order = cardPhotoOrder(primary, showcase).slice(0, CARD_MAX_PHOTOS);
  return { primary_photo_r2_key: order[0] ?? null, showcase_photo_r2_keys: order.slice(1) };
}

/** "Set as primary photo": the chosen photo moves to the front; the old primary moves into the showcase, right after it. */
export function setPrimaryPhoto(order: readonly string[], ref: string): string[] {
  if (!order.includes(ref) || order[0] === ref) return [...order];
  return [ref, ...order.filter((r) => r !== ref)];
}

/**
 * "Delete photo": the photo leaves the list. When it was the primary, the next photo becomes the primary — `promoted`
 * names it (null when the deleted photo was not the primary, or was the last one), so the maker can say it in one line.
 */
export function deleteCardPhoto(order: readonly string[], ref: string): { order: string[]; promoted: string | null } {
  if (!order.includes(ref)) return { order: [...order], promoted: null };
  const next = order.filter((r) => r !== ref);
  return { order: next, promoted: order[0] === ref ? (next[0] ?? null) : null };
}

/**
 * The add tile shows only below the limit. `onTheWay` counts photos still uploading and failed tiles still on screen —
 * each holds a slot, exactly as the shipped uploader counts them (`items + inFlight`).
 */
export function canAddCardPhoto(photos: number, onTheWay = 0): boolean {
  return photos + onTheWay < CARD_MAX_PHOTOS;
}

/**
 * The uploader reports its set in upload order; the grid keeps ITS order (a swapped primary stays first) and appends
 * what is new. A ref the uploader no longer holds leaves.
 */
export function mergeUploadedPhotos(order: readonly string[], uploaded: readonly string[]): string[] {
  const held = new Set(uploaded);
  const kept = order.filter((r) => held.has(r));
  for (const r of uploaded) if (!kept.includes(r)) kept.push(r);
  return kept;
}

/** "N of 6 photos" — the grid's quiet count line. */
export function cardPhotoCountLine(n: number): string {
  return `${formatCount(n)} of ${formatCount(CARD_MAX_PHOTOS)} photos`;
}
