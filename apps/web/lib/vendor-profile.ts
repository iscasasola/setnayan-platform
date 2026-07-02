import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type VendorProfileRow = {
  vendor_profile_id: string;
  public_id: string;
  user_id: string;
  business_name: string;
  business_slug: string | null;
  tagline: string | null;
  /**
   * Logo storage. May hold:
   *   - A legacy http(s) URL the vendor pasted before file-upload shipped
   *   - An `r2://bucket/key` ref emitted by /api/upload + <FileUpload>
   *   - NULL (no logo yet)
   * Render via `displayLogoUrl(profile)` from lib/uploads.ts — it presigns
   * R2 refs and passes legacy URLs through unchanged.
   */
  logo_url: string | null;
  services: string[];
  /**
   * Business owner / representative name — the person who owns or runs the
   * business, distinct from the login account. Required field of the vendor
   * Business Profile (added 2026-06-28). Kept private (not shown publicly).
   */
  business_owner_name: string | null;
  /**
   * Year the business started operating. A required Business Profile field
   * (surfaced 2026-06-28 independent of the experience-verification flag).
   * Public profile shows "X years in business".
   */
  in_business_since_year: number | null;
  location_city: string | null;
  /** Free-text street address for the vendor's HQ. Optional. Used by
   *  the geocoder + the marketplace distance chip. Added 2026-05-21. */
  hq_address: string | null;
  hq_latitude: number | null;
  hq_longitude: number | null;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_published: boolean;
  /**
   * Portfolio gallery. Each entry is an `r2://bucket/key` ref. Empty array
   * means no portfolio uploaded yet — column has a NOT NULL DEFAULT '{}'
   * in the database (see migration 20260514130000_vendor_portfolio.sql).
   */
  portfolio_r2_keys: string[];
  /**
   * Per-vendor toggle on the Completed-events backend card. FALSE (default)
   * = the card shows the same team-excluded count the public sees. TRUE =
   * the card shows the full unfiltered count with the team/internal delta
   * inline and the public count as a footnote. Public count is NEVER
   * toggleable. Column added in 20260515000000_public_stats_exclusion.sql.
   */
  show_team_bookings_in_backend_count: boolean;
  /**
   * Public visibility state (added in 20260515000000_vendor_public_visibility.sql).
   * Drives marketplace surfaces + payout schedule (verified → immediate T+1,
   * coming_soon → 20/60/20 staged). Defaults to 'coming_soon' for new
   * registrations; flipped to 'verified' by /admin/verify approval.
   */
  public_visibility: 'hidden' | 'coming_soon' | 'verified' | 'archived';
  /**
   * Iteration 0043 — wedding-type compatibility tags.
   *
   * NULL = "open to all" (legacy vendors who pre-date 0043 default here).
   * Non-empty array = vendor explicitly serves only these ceremony types.
   * Empty array = vendor has explicitly opted out of every type (rare; the
   * UI submits NULL when all checkboxes are unchecked rather than `{}`).
   *
   * Drives the "Match my wedding" toggle on /vendors (iteration 0043 §
   * compatibility filter). Couples toggle ON to filter the marketplace
   * to vendors whose tags include their event's ceremony_type.
   */
  compatible_ceremony_types: string[] | null;
  compatible_venue_settings: string[] | null;
  /**
   * Iteration 0041 — multi-event support. Which event_types this vendor
   * serves. Default ['wedding'] for legacy / V1.1 vendors (backfilled in
   * migration 20260521090000). The `vendor_profiles_event_types_check`
   * constraint guarantees a non-empty array of valid public.event_type
   * enum values.
   *
   * Drives the marketplace `?event_type=` filter at /vendors — a vendor
   * appears in the debut marketplace only if 'debut' is in this array.
   */
  event_types: string[];
  created_at: string;
  updated_at: string;
};

// Iteration 0043 — graceful fallback when the compatibility columns aren't
// yet in the database (migration 20260521000000 pending push). The legacy
// SELECT excludes them so the page can render against pre-0043 schemas;
// callers see compatible_* as null in that mode, identical to a vendor
// who hasn't picked any tags yet — "open to all" semantics.
const FULL_VENDOR_PROFILE_SELECT =
  'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,business_owner_name,in_business_since_year,location_city,hq_address,hq_latitude,hq_longitude,website,contact_email,contact_phone,is_published,portfolio_r2_keys,show_team_bookings_in_backend_count,public_visibility,compatible_ceremony_types,compatible_venue_settings,event_types,created_at,updated_at';

// LEGACY select omits hq_address/lat/lng + 0043 compat cols so the page
// can render against pre-0043 / pre-0521 schemas. Callers see hq_*
// as null in fallback mode, identical to a vendor who hasn't entered
// an HQ yet — distance chips simply don't render.
const LEGACY_VENDOR_PROFILE_SELECT =
  'vendor_profile_id,public_id,user_id,business_name,business_slug,tagline,logo_url,services,location_city,website,contact_email,contact_phone,is_published,portfolio_r2_keys,show_team_bookings_in_backend_count,public_visibility,created_at,updated_at';

/**
 * Fetch the caller's own vendor profile (or the one they're a team member of).
 *
 * Wrapped in React `cache()` (2026-07-01 perf): the vendor dashboard layout and
 * the page it renders each fetch the profile in the SAME request. Since the
 * server `createClient()` is request-cached, both call sites share the identical
 * client reference, so `cache()` keyed on `(supabase, userId)` dedupes the two
 * calls into a single set of reads (this fn can fire up to 3 queries) instead of
 * running the whole chain twice per render.
 */
export const fetchOwnVendorProfile = cache(async (
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorProfileRow | null> => {
  let { data, error } = await supabase
    .from('vendor_profiles')
    .select(FULL_VENDOR_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Defensive fallback (hardened 2026-05-20 after digest-486685855 crash):
    // always retry against the legacy SELECT regardless of error shape. The
    // original fallback only fired on 42703 / "column does not exist" but
    // other failure modes (RLS edge, expired JWT, transient PostgREST 500)
    // crashed the page with a generic 5xx. We now log the first-attempt
    // error via console.error so Sentry's nodejs runtime hook captures it
    // for diagnosis, then try the LEGACY select as a graceful fallback.
    // Worst case: legacy also fails → we throw with both error messages.
    // eslint-disable-next-line no-console
    console.error('[fetchOwnVendorProfile] FULL select failed; falling back to LEGACY', {
      user_id: userId,
      error_code: (error as { code?: string }).code,
      error_message: error.message,
    });
    const fallback = await supabase
      .from('vendor_profiles')
      .select(LEGACY_VENDOR_PROFILE_SELECT)
      .eq('user_id', userId)
      .maybeSingle();
    if (fallback.error) {
      throw new Error(
        `fetchOwnVendorProfile failed: FULL=[${error.message}] LEGACY=[${fallback.error.message}]`,
      );
    }
    if (!fallback.data) return null;
    data = {
      ...(fallback.data as Record<string, unknown>),
      compatible_ceremony_types: null,
      compatible_venue_settings: null,
      event_types: ['wedding'],
      // 2026-05-21 — geocode columns added after the legacy SELECT was
      // pinned. Default to nulls so the type stays a clean contract; the
      // distance chip simply doesn't render until the schema migrates and
      // the vendor saves their HQ.
      hq_address: null,
      hq_latitude: null,
      hq_longitude: null,
      // Business Profile fields added 2026-06-28 — null in the legacy/pre-
      // migration read; the completion gate simply reads them as "missing".
      business_owner_name: null,
      in_business_since_year: null,
    } as typeof data;
  }
  if (!data) {
    // Member path (Phase 2b) — the user doesn't OWN a vendor_profiles row but
    // may be a team member (admin / agent / viewer). Resolve their vendor via
    // vendor_team_members, then fetch that profile by id. The
    // `vendor_profiles_member_read` RLS policy admits members; agent data
    // scoping happens on the per-table policies (services / chat), not here.
    const { data: memberships } = await supabase
      .from('vendor_team_members')
      .select('vendor_profile_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    const memberVendorProfileId = (memberships?.[0] as { vendor_profile_id?: string } | undefined)
      ?.vendor_profile_id;
    if (!memberVendorProfileId) return null;
    const { data: byId } = await supabase
      .from('vendor_profiles')
      .select(FULL_VENDOR_PROFILE_SELECT)
      .eq('vendor_profile_id', memberVendorProfileId)
      .maybeSingle();
    if (!byId) return null;
    data = byId;
  }
  // Defensive: column has NOT NULL DEFAULT '{}' so this is null only if the
  // migration hasn't run yet. Normalise so callers can assume an array.
  // Same defensive default for `show_team_bookings_in_backend_count` — the
  // column has NOT NULL DEFAULT FALSE but pre-migration rows may surface
  // as `null` until the migration runs.
  const row = data as Omit<
    VendorProfileRow,
    | 'portfolio_r2_keys'
    | 'show_team_bookings_in_backend_count'
    | 'public_visibility'
    | 'event_types'
  > & {
    portfolio_r2_keys: string[] | null;
    show_team_bookings_in_backend_count: boolean | null;
    public_visibility: VendorProfileRow['public_visibility'] | null;
    event_types: string[] | null;
  };
  return {
    ...row,
    portfolio_r2_keys: row.portfolio_r2_keys ?? [],
    show_team_bookings_in_backend_count:
      row.show_team_bookings_in_backend_count ?? false,
    public_visibility: row.public_visibility ?? 'coming_soon',
    // Defensive: vendor_profiles.event_types is NOT NULL DEFAULT
    // ARRAY['wedding'] per migration 20260521090000. A null surfaces only
    // pre-migration; collapse to the V1 baseline so callers can rely on a
    // non-empty array.
    event_types: row.event_types && row.event_types.length > 0
      ? row.event_types
      : ['wedding'],
  };
});

/**
 * Per-vendor public + full completed-event counts. Wraps the two
 * materialized views from 20260515000000_public_stats_exclusion.sql.
 *
 *  - `public_completed_count` is what the marketplace / public profile
 *    surfaces. Team / internal / self-comp bookings are filtered out.
 *  - `full_completed_count` is the unfiltered sibling. Only the vendor's
 *    own backend card reads this when their toggle is ON.
 *
 * Returns 0 for either count if the vendor has no row in the view yet
 * (a brand-new profile or no completed bookings).
 */
export type VendorCompletedEventStats = {
  public_completed_count: number;
  full_completed_count: number;
};

export async function fetchVendorCompletedEventStats(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorCompletedEventStats> {
  const [publicRes, fullRes] = await Promise.all([
    supabase
      .from('vendor_public_completed_events_stats')
      .select('public_completed_count')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
    supabase
      .from('vendor_full_completed_events_stats')
      .select('full_completed_count')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
  ]);
  // We deliberately swallow "view doesn't exist yet" errors so the
  // dashboard still renders for environments where the migration hasn't
  // run. Both counts fall back to 0.
  const publicCount = publicRes.data?.public_completed_count ?? 0;
  const fullCount = fullRes.data?.full_completed_count ?? 0;
  return {
    public_completed_count: Number(publicCount) || 0,
    full_completed_count: Number(fullCount) || 0,
  };
}

export type VendorCustomerSourceCounts = {
  /** Customers who inquired via Setnayan (Explore + the vendor's Website). */
  inHouse: number;
  /** Customers imported / locked by the vendor via QR Code. */
  imported: number;
};

/**
 * In-house vs Import customer counts for the vendor's Home CRM signal (owner
 * taxonomy locked 2026-06-30). Calls the `vendor_customer_source_counts`
 * SECURITY DEFINER RPC — event_vendors is couple-RLS, so the vendor's own
 * session can't read it directly; the RPC returns just the two aggregate counts
 * for the vendor's own profile (gated to owner/team, else 0/0). Fail-soft: any
 * RPC error (e.g. pre-migration deploy) collapses to 0/0 so Home still renders.
 */
export async function fetchVendorCustomerSourceCounts(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorCustomerSourceCounts> {
  const { data, error } = await supabase.rpc('vendor_customer_source_counts', {
    p_vendor_profile_id: vendorProfileId,
  });
  if (error || !data) return { inHouse: 0, imported: 0 };
  // RETURNS TABLE → supabase returns an array of rows; take the first.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { in_house?: number | string; imported?: number | string }
    | undefined;
  return {
    inHouse: Number(row?.in_house ?? 0) || 0,
    imported: Number(row?.imported ?? 0) || 0,
  };
}

/**
 * Whether the vendor has uploaded their full set of required business
 * documents (the "Updated Business Documents" item of the Business Profile).
 * Reads `vendor_verification_applications.docs_complete` — TRUE once every
 * required VENDOR_DOC_SLOT in the verification flow is filled. Swallows a
 * missing-table error (pre-migration envs) → false.
 */
export async function fetchHasBusinessDocuments(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('vendor_verification_applications')
    .select('docs_complete')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean((data as { docs_complete?: boolean } | null)?.docs_complete);
}

/**
 * The required Business Profile (vendor onboarding · owner 2026-06-28;
 * relabelled + Logo added 2026-07-02; documents item REMOVED 2026-07-03).
 *
 * A vendor "must have their Business Profile" — these 8 identity fields —
 * before they can be published / listed / take inquiries. Each item maps to a
 * concrete `vendor_profiles` column. `complete` gates publication; the
 * checklist drives the My Shop Profile tile + the profile completion UI.
 *
 * Verification DOCUMENTS are no longer a checklist item (owner-approved
 * redesign): they moved to the always-visible "Get verified" section on My
 * Shop and gate only the verified BADGE, never publication. `surface` is kept
 * in the type for compatibility but every item is now 'profile'.
 */
export type BusinessProfileItem = {
  key: string;
  label: string;
  ok: boolean;
  /** Where to fix it. Post-2026-07-03 every checklist item is 'profile'. */
  surface: 'profile' | 'documents';
};

/**
 * Canonical Business-Profile field labels (owner-relabel 2026-07-02).
 *
 * ONE source of truth for the checklist wording, shared by the completion card
 * (`businessProfileChecklist`) and the save-time publish gate in
 * `app/vendor-dashboard/actions.ts`. Both surfaces used to hard-code the same
 * strings and drifted apart on every rename — importing this constant keeps
 * them locked together. Keyed by the checklist item `key`.
 */
export const BUSINESS_PROFILE_LABELS = {
  logo: 'Logo',
  business_name: 'Shop name',
  business_owner_name: 'Business owner',
  maps_pin: 'Company address',
  contact_phone: 'Contact number',
  contact_email: 'Company email',
  services: 'Services covered',
  in_business_since_year: 'EST',
} as const;

export function businessProfileChecklist(
  profile: VendorProfileRow | null,
): { items: BusinessProfileItem[]; done: number; total: number; complete: boolean; missing: string[] } {
  const L = BUSINESS_PROFILE_LABELS;
  const items: BusinessProfileItem[] = [
    { key: 'logo', label: L.logo, surface: 'profile', ok: !!profile?.logo_url?.trim() },
    { key: 'business_name', label: L.business_name, surface: 'profile', ok: !!profile?.business_name?.trim() },
    { key: 'business_owner_name', label: L.business_owner_name, surface: 'profile', ok: !!profile?.business_owner_name?.trim() },
    {
      key: 'maps_pin',
      label: L.maps_pin,
      surface: 'profile',
      // Address text is enough — matches the save-time publish gate in
      // actions.ts (which only checks hq_address), since the lat/lng geocode
      // runs asynchronously AFTER save and may legitimately be null on a fresh
      // address. The distance chip still renders once geocoding resolves.
      ok: !!profile?.hq_address?.trim(),
    },
    { key: 'contact_phone', label: L.contact_phone, surface: 'profile', ok: !!profile?.contact_phone?.trim() },
    { key: 'contact_email', label: L.contact_email, surface: 'profile', ok: !!profile?.contact_email?.trim() },
    { key: 'services', label: L.services, surface: 'profile', ok: (profile?.services?.length ?? 0) > 0 },
    {
      key: 'in_business_since_year',
      label: L.in_business_since_year,
      surface: 'profile',
      ok: !!profile?.in_business_since_year && profile.in_business_since_year > 1900,
    },
  ];
  const done = items.filter((i) => i.ok).length;
  return {
    items,
    done,
    total: items.length,
    complete: done === items.length,
    missing: items.filter((i) => !i.ok).map((i) => i.label),
  };
}

/**
 * Profile-fields-only gauge. Since 2026-07-03 (documents item removed) this is
 * the SAME set as `businessProfileChecklist` — kept as the stable entry point
 * for callers that only care about the counts (e.g. the vendor-activity score).
 */
export function profileCompletion(profile: VendorProfileRow | null): {
  done: number;
  total: number;
  missing: string[];
} {
  const { items } = businessProfileChecklist(profile);
  const done = items.filter((i) => i.ok).length;
  return { done, total: items.length, missing: items.filter((i) => !i.ok).map((i) => i.label) };
}
