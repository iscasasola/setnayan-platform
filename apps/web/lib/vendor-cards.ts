import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveVendorDisplayName, displayServiceLabel } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';

/**
 * Shared marketplace-vendor card hydration (Invite/Join v2). Given a set of
 * vendor_profile_ids, resolve each to a display card — name (hybrid-anonymity
 * applied), slug, logo, category — via the GRANT-to-authenticated
 * `vendor_market_stats` view + a `vendor_profiles` anonymity batch, read through
 * the admin client. This mirrors the marketplace card grid + the Library saved
 * vendors path; both the event-credits list and the attended-saves list use it.
 */

export type VendorCard = {
  vendorProfileId: string;
  /** Resolved display name post hybrid-anonymity. */
  displayName: string;
  /** Public profile slug for `/v/[slug]`; null → card isn't linked. */
  businessSlug: string | null;
  logoUrl: string | null;
  categoryLabel: string | null;
};

// Day-1 real-name reveal is now derived from the tier capability matrix
// (`isTrueNameTier` → `tierCaps(tier).nameMode === 'true'`) rather than a
// hardcoded tier set. Per the owner "open it up" lock (Vendor_Subscription_
// Ladder_2026-07-22 §3): a vendor's NAME is never gated — every couple-facing
// tier shows the real business name. This also fixes the long-standing bug the
// §6 audit flagged: the old `{pro,enterprise,custom}` set excluded Solo (whose
// `nameMode` is already 'true'), anonymizing a paid Solo vendor's card. Which
// vendors are shown at all is still gated by `verification_state='verified'` at
// the query layer — this only decides the NAME shown for an already-visible row.

function fallbackCategoryLabel(category: string | null): string | null {
  if (!category) return null;
  return category
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function displayServiceLabelSafe(service: string): string {
  try {
    return displayServiceLabel(service);
  } catch {
    return service;
  }
}

/**
 * Hydrate vendor cards for the given profile ids. `categoryByVendor` supplies a
 * per-vendor fallback category enum (e.g. from the saving row) used when the
 * vendor's name is hidden or carries no services array. Returns a Map keyed by
 * vendor_profile_id; ids with no marketplace row are simply omitted.
 */
export async function hydrateVendorCards(
  vendorIds: string[],
  categoryByVendor?: Map<string, string | null>,
): Promise<Map<string, VendorCard>> {
  const out = new Map<string, VendorCard>();
  const ids = [...new Set(vendorIds)].filter(Boolean);
  if (ids.length === 0) return out;

  const admin = createAdminClient();

  const { data: statsData } = await admin
    .from('vendor_market_stats')
    .select('vendor_profile_id,business_name,business_slug,logo_url,services,location_city')
    .in('vendor_profile_id', ids);
  const statsById = new Map<string, Record<string, unknown>>();
  for (const s of statsData ?? []) statsById.set(s.vendor_profile_id as string, s);

  const { data: profileData } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id,name_revealed_at,screen_name,tier_state,verification_state')
    .in('vendor_profile_id', ids);
  const profileById = new Map<string, Record<string, unknown>>();
  for (const p of profileData ?? []) profileById.set(p.vendor_profile_id as string, p);

  for (const vid of ids) {
    const stats = statsById.get(vid);
    const profile = profileById.get(vid);
    const services = (stats?.services as string[] | null) ?? null;
    const primaryService = services && services.length > 0 ? (services[0] ?? null) : null;
    const businessName = (stats?.business_name as string | null) ?? null;
    const tierState = (profile?.tier_state as string | null) ?? null;

    const displayName = resolveVendorDisplayName({
      business_name: businessName,
      name_revealed_at: (profile?.name_revealed_at as string | null) ?? null,
      isPaidTier: isTrueNameTier(tierState),
      is_verified: (profile?.verification_state as string | null) === 'verified',
      primary_canonical_service: primaryService,
      location_city: (stats?.location_city as string | null) ?? null,
      services,
      screen_name: (profile?.screen_name as string | null) ?? null,
    });

    const isRevealed = displayName === businessName;
    const fallback = fallbackCategoryLabel(categoryByVendor?.get(vid) ?? null);
    const categoryLabel = isRevealed
      ? primaryService
        ? displayServiceLabelSafe(primaryService)
        : fallback
      : fallback;

    out.set(vid, {
      vendorProfileId: vid,
      displayName,
      businessSlug: (stats?.business_slug as string | null) ?? null,
      logoUrl: (stats?.logo_url as string | null) ?? null,
      categoryLabel,
    });
  }

  return out;
}
