import { isReservedSlug } from './reserved-slugs';

/**
 * The shop web-address format — the single definition of what
 * `vendor_profiles.business_slug` may contain.
 *
 * Kept in step with the database, which mints a default address for EVERY shop
 * from its business name (migration 20271117527966,
 * `generate_business_slug_for_vendor`). Before that migration nothing minted a
 * slug at all and only Pro+ could set one, so a Free shop had no address and
 * its page was unreachable.
 */
export const VENDOR_SLUG_RE = /^[a-z0-9-]{3,32}$/;

export const VENDOR_SLUG_FORMAT_ERROR =
  'Slug must be 3–32 chars: lowercase letters, numbers, hyphens.';

export const VENDOR_SLUG_RESERVED_ERROR =
  'That address is reserved by Setnayan — try another.';

/**
 * Normalize and validate a submitted shop address.
 *
 * Returns the lowercased slug, or `null` for blank/absent input (which clears
 * the column). Throws with a vendor-readable message on a bad shape.
 *
 * ⚠ THE RESERVED CHECK IS NOT COSMETIC. Vendors, events and users share ONE
 * top-level namespace (`setnayan.com/{slug}`), and `app/[slug]/page.tsx`
 * answers `RESERVED_SLUGS.has(slug)` with notFound() BEFORE it ever looks for a
 * vendor. A shop that claimed `pricing` or `explore` would therefore hold an
 * address that resolves NOWHERE — a silently dead shop, not a shadowed route.
 * The database generator refuses the same words
 * (`public.business_slug_is_reserved`); this is the manual path's half.
 */
export function parseVendorSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const lowered = raw.trim().toLowerCase();
  if (lowered.length === 0) return null;
  if (!VENDOR_SLUG_RE.test(lowered)) {
    throw new Error(VENDOR_SLUG_FORMAT_ERROR);
  }
  if (isReservedSlug(lowered)) {
    throw new Error(VENDOR_SLUG_RESERVED_ERROR);
  }
  return lowered;
}
