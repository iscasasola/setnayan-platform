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
};

/** The exact copy surfaced when a verified vendor tries to edit a locked field. */
export const VERIFIED_LOCK_ERROR =
  'Your shop is verified, so these details are locked. Request a correction instead.';

/**
 * ADDING A MISSING LOGO IS A COMPLETION, NOT A CORRECTION (2026-07-21).
 *
 * The verified-lock exists to stop a verified shop from *changing* the
 * identity an admin signed off on. It was never meant to stop a vendor from
 * FILLING IN a field that is empty — and until the logo became optional at
 * registration, an empty logo on a verified shop was unreachable, so nobody
 * noticed the difference.
 *
 * It is reachable now, and the consequence is a trap: `requestProfileCorrection`
 * has no UI wired to it anywhere in the app (grep it — the only references are
 * its own definition and a comment), so a verified vendor with a NULL logo had
 * NO path to add one. That is strictly worse than the old registration wall.
 *
 * So: blank → non-blank on `logo_url` is allowed while verified. Non-blank →
 * anything else stays locked, which is the rule that actually protects the
 * signed-off identity. `null`/blank on the incoming value is never a
 * "completion" — clearing a logo is not something this unlocks.
 */
export function isLockedLogoCompletion(
  currentLogoUrl: string | null | undefined,
  nextLogoUrl: string | null | undefined,
): boolean {
  return !currentLogoUrl?.trim() && !!nextLogoUrl?.trim();
}

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
