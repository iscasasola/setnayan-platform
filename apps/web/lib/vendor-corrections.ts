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
// 🏷 A SHOP SETNAYAN SET UP CHANGES ITS NAME AND ADDRESS BY REQUEST
// (owner 2026-10-29: "the name of her shop is wrong so i want her to be able to
// send a request shop name change … I will create their shop manually on the
// suppliers").
//
// A shop an admin pre-created (`createAdminVendorInvite` stamps
// `created_by_admin_user_id`, kept for audit after the claim) carries a name —
// and maybe an address — Setnayan typed. The supplier may still FILL a blank
// one (owner: "I want her to create her address"), but may not OVERWRITE one:
// she asks through the SAME `vendor_correction_requests` door a verified shop
// uses, and an admin applies it on /admin/corrections. Not a second feature —
// the verified lock's own path, with one more reason to take it.
//
// A shop the admin made for THEMSELVES (`created_by_admin_user_id = user_id`,
// the owner's own all-services shop) is not "set up by Setnayan" for anyone
// else, so it keeps today's inline edit. Everything else (unverified,
// self-opened shops) is unchanged.
// ---------------------------------------------------------------------------

/** The checklist row key → the locked field it writes (`maps_pin` writes `hq_address`). */
export const ADMIN_SET_UP_ROW_FIELD = {
  business_name: 'business_name',
  maps_pin: 'hq_address',
} as const satisfies Record<string, LockedIdentityFieldKey>;

export type IdentityLockInput = {
  public_visibility?: string | null;
  created_by_admin_user_id?: string | null;
  user_id?: string | null;
  business_name?: string | null;
  hq_address?: string | null;
};

export type IdentityLock = {
  /** Verified — every identity field changes by request (owner 2026-07-02). */
  verified: boolean;
  /** Pre-created by an admin for somebody else (owner 2026-10-29). */
  setUpBySetnayan: boolean;
  /** Which locked fields this shop changes ONLY by request, today. */
  requestOnly: LockedIdentityFieldKey[];
};

/** The one rule — pure, so the server refusal, My Shop's rows and the ask card all read it. */
export function identityLockOf(row: IdentityLockInput | null | undefined): IdentityLock {
  const verified = row?.public_visibility === 'verified';
  const by = row?.created_by_admin_user_id ?? null;
  const setUpBySetnayan = by !== null && by !== (row?.user_id ?? null);
  if (verified) return { verified, setUpBySetnayan, requestOnly: [...LOCKED_IDENTITY_FIELD_KEYS] };
  const requestOnly: LockedIdentityFieldKey[] = ['business_slug'];
  if (setUpBySetnayan) {
    // Only a value that is THERE is Setnayan's to protect — a blank one is hers to create.
    if (row?.business_name?.trim()) requestOnly.push('business_name');
    if (row?.hq_address?.trim()) requestOnly.push('hq_address');
  }
  return { verified, setUpBySetnayan, requestOnly };
}

/**
 * May the inline editor write this checklist/inline FIELD (`business_name`, `maps_pin`, …)? Null = yes; otherwise
 * the refusal to show. The verified refusal is unchanged.
 */
export function identityLockRefusal(lock: IdentityLock, inlineField: string): string | null {
  if (lock.verified) return VERIFIED_LOCK_ERROR;
  const writes = (ADMIN_SET_UP_ROW_FIELD as Record<string, LockedIdentityFieldKey>)[inlineField];
  if (writes && lock.requestOnly.includes(writes)) return ADMIN_SET_UP_LOCK_ERROR;
  return null;
}

/**
 * Does THIS checklist row change by request? Only a FILLED name / address row whose field is request-only — a blank
 * one is hers to create (owner 2026-10-29: "I want her to create her address"). 'pending' once a request is waiting.
 */
export function rowAsks(
  rowKey: string,
  filled: boolean,
  asks: { requestOnly: readonly LockedIdentityFieldKey[]; pending: readonly string[] } | undefined,
): 'ask' | 'pending' | null {
  if (!asks || !filled) return null;
  const field = (ADMIN_SET_UP_ROW_FIELD as Record<string, LockedIdentityFieldKey>)[rowKey];
  if (!field || !asks.requestOnly.includes(field)) return null;
  return asks.pending.includes(field) ? 'pending' : 'ask';
}

/** The refusal for a shop Setnayan set up — names the remedy that IS on the screen. */
export const ADMIN_SET_UP_LOCK_ERROR =
  'Setnayan set up your shop, so its name and address change by request. Ask us under “Something wrong?”.';

/**
 * This shop's lock, read as the supplier (`vendor_profiles_self` — `created_by_admin_user_id` is off
 * `authenticated`'s column allowlist on the table). Defensive like `fetchVerifiedLock`: a refused read means NOT
 * locked (a probe hiccup never bricks a save), and the reason reaches the logs.
 */
export async function fetchIdentityLock(supabase: SupabaseClient, vendorProfileId: string): Promise<IdentityLock> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles_self')
      .select('public_visibility, created_by_admin_user_id, user_id, business_name, hq_address')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) console.error('[supabase-error] lib/vendor-corrections.ts · from:vendor_profiles_self.select', error);
    return identityLockOf((data as IdentityLockInput | null) ?? null);
  } catch {
    return identityLockOf(null);
  }
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
export async function fetchCorrectionRequestsMeasured(
  supabase: SupabaseClient,
  opts: {
    status?: CorrectionRequestStatus | 'all';
    limit?: number;
    /**
     * Scope to ONE shop. Required by any vendor-facing caller.
     *
     * 🚨 RLS IS NOT THE SCOPE HERE. `vendor_correction_requests_owner_read` is
     * `USING (owns the profile OR is_admin())` — deliberately widened, because
     * the SAME helper backs /admin/corrections. So for a vendor who is ALSO an
     * admin (production has one: the owner's own shop) an unfiltered read
     * returns EVERY shop's requests. On My Shop that renders another shop's
     * request as "waiting on Setnayan" and removes that field from the ones
     * they can ask about — and with enough foreign requests the ask button
     * disappears entirely, restoring the exact unreachable-doorway defect the
     * card was built to fix.
     *
     * Omitted only by the admin queue, which is meant to see everything.
     */
    vendorProfileId?: string | null;
  } = {},
): Promise<{ ok: boolean; rows: VendorCorrectionRequestRow[] }> {
  try {
    let query = supabase
      .from('vendor_correction_requests')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 200);
    const status = opts.status ?? 'open';
    if (status !== 'all') query = query.eq('status', status);
    if (opts.vendorProfileId) query = query.eq('vendor_profile_id', opts.vendorProfileId);
    const { data, error } = await query;
    if (error || !data) return { ok: false, rows: [] };
    return { ok: true, rows: data as VendorCorrectionRequestRow[] };
  } catch {
    return { ok: false, rows: [] };
  }
}

/**
 * The rows alone — what the supplier-facing callers want (a refused read there
 * degrades to "nothing", which is safe for them). The ADMIN queue must call
 * `fetchCorrectionRequestsMeasured` instead: for it, "[]" over a refused read
 * reads as "No correction requests", and nobody learns a request is waiting.
 */
export async function fetchCorrectionRequests(
  supabase: SupabaseClient,
  opts: Parameters<typeof fetchCorrectionRequestsMeasured>[1] = {},
): Promise<VendorCorrectionRequestRow[]> {
  return (await fetchCorrectionRequestsMeasured(supabase, opts)).rows;
}

/**
 * Whether THIS shop's profile is verified-locked. Defensive: any read
 * error means NOT locked (the profile save then proceeds exactly as before —
 * never brick a vendor's save on a probe hiccup).
 *
 * 🔀 Takes the shop id (2026-10-22), from the active-shop resolver — it used to
 * find the shop by the login's own id, which names the wrong shop once an
 * account switches between shops from the avatar sheet.
 */
export async function fetchVerifiedLock(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('public_visibility')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) {
      if (error) console.error('[supabase-error] lib/vendor-corrections.ts · from:vendor_profiles.select', error);
      return false;
    }
    return (
      (data as { public_visibility?: string | null }).public_visibility ===
      'verified'
    );
  } catch {
    return false;
  }
}
