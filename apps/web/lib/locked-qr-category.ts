/**
 * 🔳 THE BOOKED QR'S CATEGORY — read from the ONE taxonomy, never matched by spelling (W1 RW-378, live 027f641).
 *
 * Found: Generate refused "Pick at least one service you actually offer." for 6 of the 7 services in production. The
 * picker sends a `vendor_service_id`; its row's `category` is a TAXONOMY id — a tile (`lights_sound`, `photo_booth`)
 * or a leaf (`photoman`, `florals`) — and `issueLockedQr` compared that raw text with the `vendor_category` enum
 * (`lights_and_sound`, `photobooth`, `florist`). Different vocabularies, so only `mobile_bar` (same word in both)
 * ever passed.
 *
 * Owner rule, "the taxonomy has one source": the bridge between the two is `service_categories.coarse_category`
 * (via `canonical_service_taxonomy` for a leaf), read through `getTaxonomy()` — the same resolver the two other
 * `event_vendors` write sites use (`eventVendorCategoryForCardKind`). The token stores THAT enum value, because the
 * couple's scan casts it straight into `event_vendors.category` (`vendor_claim_locked_qr`: `t.category::vendor_category`).
 *
 * 🔒 `app/vendor-dashboard/invite/the-booked-qr-reads-the-one-taxonomy.test.ts`.
 */
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { eventVendorCategoryForCardKind } from '@/lib/event-vendor-category';
import type { CoarseCategorySource } from '@/lib/vendor-branch-category';

/** The slice of `getTaxonomy()` this reads: the leaf → tile map and the tile → coarse category column. */
export type LockedQrTaxonomy = CoarseCategorySource & { map: Readonly<Record<string, { tile?: string } | undefined>> };

export type PickableService = { vendor_service_id: string; category: string | null };

/**
 * The `vendor_category` a picked ref books under, or null (refuse).
 *  · a `vendor_service_id` of the shop's own ACTIVE service → its taxonomy id resolved through the one source;
 *  · otherwise (a shop with no published services) the ref is a coarse key, and must be one the shop covers.
 */
export function lockedQrCategoryOf(
  ref: string,
  activeServices: readonly PickableService[],
  coverage: readonly string[],
  tax: LockedQrTaxonomy,
): VendorCategory | null {
  const svc = activeServices.find((s) => s.vendor_service_id === ref) ?? null;
  if (svc) {
    const kind = (svc.category ?? '').trim();
    if (!kind) return null;
    const coarse = eventVendorCategoryForCardKind(kind, tax.map[kind]?.tile ?? null, tax);
    return VENDOR_CATEGORIES.includes(coarse) ? coarse : null;
  }
  if (!VENDOR_CATEGORIES.includes(ref as VendorCategory)) return null;
  return coverage.includes(ref) ? (ref as VendorCategory) : null;
}
