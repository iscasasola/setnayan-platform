import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { filterFavoritableVendorIds } from '@/lib/vendor-favorite-gate';
import { resolveVendorDisplayName, displayServiceLabel } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';

/**
 * Library · Saved Vendors data layer.
 *
 * "Saved" is canonical = an `event_vendors` row with a non-null
 * `marketplace_vendor_id` (status 'considering', source 'host_manual' — written
 * by `saveVendorToPicks` in `app/explore/actions.ts`). There is NO
 * `vendor_favorites` table — that's a phantom, do not reach for it.
 *
 * The list query runs under the user's RLS session (`createClient`). The
 * `event_vendors_couple_read` policy (migration
 * `20260513100000_iteration_0006_vendors.sql`) scopes reads to
 * `current_couple_event_ids()` — every event the user hosts — so one query with
 * NO `.eq('event_id')` returns saves across all owned events. We then dedupe by
 * `marketplace_vendor_id` in app code and count the distinct events each vendor
 * was saved in (the "saved in N events" chip).
 *
 * Name / logo / slug hydration goes through the `vendor_market_stats` view
 * (GRANTed to authenticated — same source `app/explore/page.tsx` selects from
 * for its card grid) via the admin client, mirroring the marketplace's
 * server-role read path. `resolveVendorDisplayName` (`lib/vendors`) applies
 * hybrid-anonymity so a Free + Verified vendor whose real name is still hidden
 * surfaces its screen-name placeholder, not the leaked business name. The
 * anonymity-gate fields (`name_revealed_at`, `screen_name`, `tier_state`) are
 * NOT carried by the view, so they're pulled in a follow-up `vendor_profiles`
 * batch — exactly as the marketplace page does.
 */

export type SavedVendorCard = {
  vendorProfileId: string;
  /** Resolved display name post hybrid-anonymity. */
  displayName: string;
  /** Public profile slug for `/v/[slug]`; null → card is not linked. */
  businessSlug: string | null;
  /** Already-public logo URL (R2 / Supabase host) or null. */
  logoUrl: string | null;
  /** Primary canonical service label for the category line, or the
   *  saved-row `category` enum as a fallback. */
  categoryLabel: string | null;
  /** Distinct count of the user's events this vendor is saved in. */
  savedInEventCount: number;
};

type SavedRow = {
  marketplace_vendor_id: string;
  event_id: string;
  category: string | null;
};

type MarketStatsRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  logo_url: string | null;
  services: string[] | null;
  location_city: string | null;
};

type ProfileAnonymityRow = {
  vendor_profile_id: string;
  name_revealed_at: string | null;
  screen_name: string | null;
  tier_state: string | null;
  verification_state: string | null;
};

// Day-1 real-name reveal is derived from the tier capability matrix
// (`isTrueNameTier` → `tierCaps(tier).nameMode === 'true'`), not a hardcoded
// set. Per the "open it up" lock (Vendor_Subscription_Ladder_2026-07-22 §3) a
// vendor's NAME is never gated, so every couple-facing tier resolves to the
// real business name; the old `{pro,enterprise,custom}` set also wrongly
// excluded Solo (nameMode 'true').

/** Title-case the saved-row `category` enum (e.g. `wedding_cake`) as a last
 *  resort when the hydrated vendor has no services array to derive a label. */
function fallbackCategoryLabel(category: string | null): string | null {
  if (!category) return null;
  return category
    .split('_')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export async function fetchSavedVendors(): Promise<SavedVendorCard[]> {
  const supabase = await createClient();

  // RLS scopes this to every couple-event the user hosts — no .eq('event_id').
  const { data: rows, error } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id, event_id, status, vendor_name, category')
    .not('marketplace_vendor_id', 'is', null);

  if (error || !rows || rows.length === 0) return [];

  // Dedupe by marketplace_vendor_id; track distinct event_ids per vendor.
  const eventsByVendor = new Map<string, Set<string>>();
  const categoryByVendor = new Map<string, string | null>();
  for (const r of rows as SavedRow[]) {
    const vid = r.marketplace_vendor_id;
    if (!vid) continue;
    let set = eventsByVendor.get(vid);
    if (!set) {
      set = new Set<string>();
      eventsByVendor.set(vid, set);
      categoryByVendor.set(vid, r.category ?? null);
    }
    set.add(r.event_id);
  }

  const vendorIds = [...eventsByVendor.keys()];
  if (vendorIds.length === 0) return [];

  const admin = createAdminClient();

  // Subscription gate (owner 2026-07-18): drop vendors whose paid subscription
  // has lapsed so a free-tier vendor silently disappears from the saved list —
  // the event_vendors rows are preserved and the card returns on re-subscribe.
  // No-op while VENDOR_FAVORITES_SUBSCRIPTION_GATE is OFF. See lib/vendor-favorite-gate.
  const favoritable = await filterFavoritableVendorIds(admin, vendorIds);
  const gatedIds = vendorIds.filter((id) => favoritable.has(id));
  if (gatedIds.length === 0) return [];

  // Hydrate display fields via the GRANT-to-authenticated marketplace view,
  // read through the admin client (same path the marketplace card grid uses).
  const { data: statsData } = await admin
    .from('vendor_market_stats')
    .select('vendor_profile_id,business_name,business_slug,logo_url,services,location_city')
    .in('vendor_profile_id', gatedIds);

  const statsById = new Map<string, MarketStatsRow>();
  for (const s of (statsData ?? []) as MarketStatsRow[]) {
    statsById.set(s.vendor_profile_id, s);
  }

  // Hybrid-anonymity gate fields — not carried by the view (mirrors
  // app/explore/page.tsx's follow-up vendor_profiles batch).
  const { data: profileData } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id,name_revealed_at,screen_name,tier_state,verification_state')
    .in('vendor_profile_id', gatedIds);

  const profileById = new Map<string, ProfileAnonymityRow>();
  for (const p of (profileData ?? []) as ProfileAnonymityRow[]) {
    profileById.set(p.vendor_profile_id, p);
  }

  const cards: SavedVendorCard[] = gatedIds.map((vid) => {
    const stats = statsById.get(vid);
    const profile = profileById.get(vid);
    const services = stats?.services ?? null;
    const primaryService =
      services && services.length > 0 ? (services[0] ?? null) : null;

    const displayName = resolveVendorDisplayName({
      business_name: stats?.business_name ?? null,
      name_revealed_at: profile?.name_revealed_at ?? null,
      isPaidTier: isTrueNameTier(profile?.tier_state ?? null),
      is_verified: profile?.verification_state === 'verified',
      primary_canonical_service: primaryService,
      location_city: stats?.location_city ?? null,
      services,
      screen_name: profile?.screen_name ?? null,
    });

    // When the name is hidden the display name already encodes the service +
    // city, so a separate category line would be redundant. Surface the
    // category label only when the real name shows; otherwise fall back to the
    // saved-row enum so the card never reads bare.
    const isRevealed = displayName === stats?.business_name;
    const categoryLabel = isRevealed
      ? (primaryService
          ? displayServiceLabelSafe(primaryService)
          : fallbackCategoryLabel(categoryByVendor.get(vid) ?? null))
      : fallbackCategoryLabel(categoryByVendor.get(vid) ?? null);

    return {
      vendorProfileId: vid,
      displayName,
      businessSlug: stats?.business_slug ?? null,
      logoUrl: stats?.logo_url ?? null,
      categoryLabel,
      savedInEventCount: eventsByVendor.get(vid)?.size ?? 1,
    };
  });

  // Stable sort: alphabetical by display name.
  cards.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return cards;
}

function displayServiceLabelSafe(service: string): string {
  try {
    return displayServiceLabel(service);
  } catch {
    return service;
  }
}
