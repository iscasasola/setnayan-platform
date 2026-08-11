import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verified-lock + request-a-correction — shared types + helpers (Lane B,
 * PR B2 of the redesigned My Shop verification, owner 2026-07-02).
 *
 * Once a vendor is VERIFIED (vendor_profiles.public_visibility = 'verified')
 * the 8 identity fields below lock server-side in
 * app/vendor-dashboard/actions.ts. Instead of editing, the vendor files a
 * vendor_correction_requests row (migration 20270503892144); an admin applies
 * or declines it on /admin/corrections.
 *
 * Everything that reads/writes the new table degrades gracefully on a
 * pre-migration database (42P01) — reads return empty, writes surface a
 * friendly error.
 */

// ---------------------------------------------------------------------------
// The 8 locked identity fields (MUST mirror the CHECK constraint in
// migration 20270503892144 — never widen one without the other).
// ---------------------------------------------------------------------------

export const LOCKED_IDENTITY_FIELD_KEYS = [
  'business_name',
  'business_owner_name',
  'hq_address',
  'contact_phone',
  'contact_email',
  'services',
  'in_business_since_year',
  'logo_url',
  // Added 2026-08-10. The city is what the marketplace FILTERS on, and it was
  // the one public claim with no way to change it: no field on My Shop, and the
  // only admin writer refuses claimed shops. A vendor who typed their street
  // into it at signup — which prod shows happening — disappeared from every
  // city search permanently, with nobody able to put it right.
  //
  // Locked rather than freely editable, for the same reason the address is: it
  // is a claim about where the business physically is, checked against their
  // DTI registration, BIR 2303 and Mayor's Permit. A verified shop must not be
  // able to quietly relocate.
  //
  // 🚨 ADDING IT HERE IN 2026-08-10 DID NOT ADD IT TO THE CHECK CONSTRAINT the
  // comment above points at, and prod's constraint still listed eight fields
  // until 2026-08-11. A city correction was REJECTED BY THE DATABASE, and the
  // writer turns any insert error into "please try again shortly" — so it would
  // have failed forever while reading like a hiccup. Fixed in migration
  // `20271132819490`; `tests/db/correction-field-keys-parity.db.test.ts` now
  // compares this list against the live constraint so the two cannot drift again.
  'location_city',
  // The shop's web address. UNLIKE every other key here it is not merely
  // "locked while verified" — it is immutable for EVERYONE, enforced by the
  // `vendor_profiles_business_slug_immutable` trigger, and that stays true. It
  // appears in this list because an admin correction is the ONE deliberate door
  // through that trigger, and this table is where such a decision is recorded.
  'business_slug',
] as const;

export type LockedIdentityFieldKey = (typeof LOCKED_IDENTITY_FIELD_KEYS)[number];

export function isLockedIdentityFieldKey(
  raw: unknown,
): raw is LockedIdentityFieldKey {
  return (
    typeof raw === 'string' &&
    (LOCKED_IDENTITY_FIELD_KEYS as readonly string[]).includes(raw)
  );
}

export const LOCKED_FIELD_LABEL: Record<LockedIdentityFieldKey, string> = {
  business_name: 'Shop name',
  business_owner_name: 'Owner / representative name',
  hq_address: 'HQ address',
  contact_phone: 'Contact phone',
  contact_email: 'Contact email',
  services: 'Services',
  in_business_since_year: 'In business since',
  logo_url: 'Logo',
  location_city: 'City',
  business_slug: 'Web address',
};

/** The exact copy surfaced when a verified vendor tries to edit a locked field. */
export const VERIFIED_LOCK_ERROR =
  'Your shop is verified, so these details are locked. Request a correction instead.';

// ---------------------------------------------------------------------------
// Row type + reads
// ---------------------------------------------------------------------------

export type CorrectionRequestStatus = 'open' | 'applied' | 'declined';

export type VendorCorrectionRequestRow = {
  id: number;
  public_id: string;
  vendor_profile_id: string;
  field_key: LockedIdentityFieldKey;
  current_value: string | null;
  requested_value: string | null;
  note: string | null;
  status: CorrectionRequestStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

const SELECT =
  'id,public_id,vendor_profile_id,field_key,current_value,requested_value,note,status,created_at,resolved_at,resolved_by';

/**
 * Correction requests for the admin queue (or, RLS-scoped, a vendor's own).
 * Defensive: returns [] on ANY error — a pre-migration database (42P01)
 * renders an empty queue instead of crashing the page.
 */
export async function fetchCorrectionRequests(
  supabase: SupabaseClient,
  opts: { status?: CorrectionRequestStatus | 'all'; limit?: number } = {},
): Promise<VendorCorrectionRequestRow[]> {
  try {
    let query = supabase
      .from('vendor_correction_requests')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 200);
    const status = opts.status ?? 'open';
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error || !data) return [];
    return data as VendorCorrectionRequestRow[];
  } catch {
    return [];
  }
}

/**
 * Whether this user's vendor profile is verified-locked. Defensive: any read
 * error means NOT locked (the profile save then proceeds exactly as before —
 * never brick a vendor's save on a probe hiccup).
 */
export async function fetchVerifiedLock(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('public_visibility')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return false;
    return (
      (data as { public_visibility?: string | null }).public_visibility ===
      'verified'
    );
  } catch {
    return false;
  }
}
