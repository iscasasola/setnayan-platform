import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { businessProfileChecklist, type VendorProfileRow } from '@/lib/vendor-profile';
import {
  fetchLatestApplication,
  countCompleteVendorSlots,
  verificationSubmitMissing,
  VENDOR_DOC_SLOTS,
  type DocUploadMap,
} from '@/lib/vendor-verification';
import {
  buildFirstStepsRail,
  type FirstStepsRail,
  type VerificationAppStatus,
} from '@/lib/vendor-first-steps';

/**
 * The DB-touching half of the vendor order-of-operations rail. The ordering
 * rules live in the pure `lib/vendor-first-steps.ts` so they stay unit-testable;
 * this only gathers live state and hands it over.
 *
 * COSTS ALMOST NOTHING ON A LIVE SHOP. Returns null after ONE cheap read as soon
 * as the shop is verified — a verified vendor has finished the rail, so the
 * Overview must not pay four more queries per render to be told so.
 *
 * ⚠ `verification_state` is NOT in `FULL_VENDOR_PROFILE_SELECT`, so it cannot be
 * read off the row the caller already holds — it is probed here, the same way
 * My Shop, the subscription page and the marketplace all probe it. Reading it
 * off `profile` would return undefined, which compares unequal to 'verified' and
 * would show a live shop a getting-started rail forever.
 *
 * FAIL-SOFT THROUGHOUT. Every read degrades to its "not done yet" value rather
 * than throwing. A rail is a nudge; it must never be the thing that takes down
 * the vendor's home page. The one asymmetry worth naming: a failed read makes a
 * step look UNFINISHED, which nags a vendor who is actually done. That is the
 * safe direction — the opposite (a failed read reading as "done") would tell a
 * vendor to stop working on the step that is blocking their own approval.
 */
export async function fetchVendorFirstStepsState(
  supabase: SupabaseClient,
  profile: VendorProfileRow,
  /**
   * 🔢 WHAT THE CALLER ALREADY READ (simpler supplier dashboard, 2026-10-14 — Today must not grow).
   *   `verified` — the shop's `verification_state === 'verified'`, read by Today in its ONE `vendor_profiles`
   *                row read; when given, this function does not read it again. Absent → probed here, as before.
   *   `blocks`   — days marked not available and bookings from outside (steps 4 and 5), counted from the
   *                calendar-blocks read Today already makes for Coming up. Absent → both steps read as not done.
   */
  known: { verified?: boolean; blocks?: { notAvailable: number; outside: number } } = {},
): Promise<FirstStepsRail | null> {
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;

  const verified = known.verified ?? (await isShopVerified(supabase, vendorProfileId));
  if (verified) return null;

  // The profile checklist needs no query — it is derived from the row the
  // Overview already loaded.
  const profileChecklist = businessProfileChecklist(profile);

  const [application, serviceCount, customerCount, registrationNumberOnFile, shopWideDaysOff] =
    await Promise.all([
      fetchLatestApplication(supabase, vendorProfileId).catch(() => null),
      countVendorServices(supabase, vendorProfileId),
      countVendorCustomers(supabase, vendorProfileId),
      hasRegistrationNumber(supabase, vendorProfileId),
      // Step 4 — a shop-wide day off belongs to no schedule, so Today's schedules read cannot see it. Asked only
      // here, on a shop not yet approved (the one that sees this rail), and only when the caller counted the rest.
      known.blocks ? countShopWideDaysOff(supabase, vendorProfileId) : Promise.resolve(0),
    ]);

  const uploads = (application?.doc_uploads ?? {}) as DocUploadMap;

  return buildFirstStepsRail({
    verified,
    profileDone: profileChecklist.done,
    profileTotal: profileChecklist.total,
    serviceCount,
    docsStatus: (application?.status as VerificationAppStatus | undefined) ?? 'none',
    docsIn: countCompleteVendorSlots(uploads),
    docsTotal: VENDOR_DOC_SLOTS.length,
    // The ONE source of truth for why Submit is refused, shared with the
    // Get-verified stepper so the rail can never invent a different reason.
    submitMissing: verificationSubmitMissing({
      profileComplete: profileChecklist.complete,
      uploads,
      registrationNumberOnFile,
    }),
    customerCount,
    notAvailableCount: (known.blocks?.notAvailable ?? 0) + shopWideDaysOff,
    outsideCount: known.blocks?.outside ?? 0,
    rejectionReason: (application?.decision_reason as string | null) ?? null,
  });
}

/**
 * Service cards authored by this shop, in ANY state. Deliberately unfiltered by
 * `is_active`: the step asks "have you built one yet", and a vendor who built a
 * card and left it unlisted HAS done the step. Filtering here would reset their
 * progress for using a feature exactly as intended.
 */
async function countVendorServices(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('vendor_services')
    .select('vendor_service_id', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendorProfileId);
  // `count === null` means NOT MEASURED, never zero — but for this rail both
  // land on "step not done", which is the safe direction (see the header).
  if (error) {
    console.error('[supabase-error] lib/vendor-first-steps.server.ts · from:vendor_services.select', error);
  }
  return error || count == null ? 0 : count;
}

/** Days off marked for the whole shop (`pool_id` null), not yet over. A failed read → 0 (step not done — the safe side). */
async function countShopWideDaysOff(supabase: SupabaseClient, vendorProfileId: string): Promise<number> {
  const { count, error } = await supabase
    .from('vendor_calendar_blocks')
    .select('block_id', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('block_source', 'manual')
    .is('pool_id', null)
    .gte('blocked_until', new Date().toISOString());
  if (error) console.error('[supabase-error] lib/vendor-first-steps.server.ts · from:vendor_calendar_blocks.select', error);
  return error || count == null ? 0 : count;
}

/**
 * Couples on this vendor's books — the same population My Customers shows:
 * every event they are attached to. Counts shortlist rows too, because both QRs
 * put a couple here and the step is "bring in the customers you already have".
 */
async function countVendorCustomers(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('marketplace_vendor_id', vendorProfileId);
  if (error) console.error('[supabase-error] lib/vendor-first-steps.server.ts · from:event_vendors.select', error);
  return error || count == null ? 0 : count;
}

/**
 * Soft probe for the shop's verification state.
 *
 * FAILS TOWARD SHOWING THE RAIL. On a read error this returns false, so an
 * already-verified shop would briefly see a getting-started rail — visibly odd
 * but harmless, and every step in it reads `done`. The opposite default would
 * hide the rail from the brand-new vendor who is the entire reason it exists.
 */
async function isShopVerified(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('verification_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    return (
      (data as { verification_state?: string | null } | null)?.verification_state === 'verified'
    );
  } catch {
    return false;
  }
}

/**
 * Soft probe — `registration_number_raw` landed in its own migration, so a
 * pre-migration read must degrade to "not on file" rather than crash the
 * Overview. Mirrors the identical guarded read on My Shop.
 */
async function hasRegistrationNumber(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      // `vendor_profiles_self` (migration 20271217955839), never the table —
      // the column is off `authenticated`'s allowlist and the catch below
      // swallows the refusal into a silent "not on file".
      .from('vendor_profiles_self')
      .select('registration_number_raw')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    return Boolean(
      (data as { registration_number_raw?: string | null } | null)?.registration_number_raw,
    );
  } catch {
    return false;
  }
}
