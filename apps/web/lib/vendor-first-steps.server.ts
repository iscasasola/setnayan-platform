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
): Promise<FirstStepsRail | null> {
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;

  const verified = await isShopVerified(supabase, vendorProfileId);
  if (verified) return null;

  // The profile checklist needs no query — it is derived from the row the
  // Overview already loaded.
  const profileChecklist = businessProfileChecklist(profile);

  const [application, serviceCount, customerCount, registrationNumberOnFile] =
    await Promise.all([
      fetchLatestApplication(supabase, vendorProfileId).catch(() => null),
      countVendorServices(supabase, vendorProfileId),
      countVendorCustomers(supabase, vendorProfileId),
      hasRegistrationNumber(supabase, vendorProfileId),
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
      .from('vendor_profiles')
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
