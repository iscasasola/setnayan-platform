import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { normalizeRegistrationNumber } from '@/lib/vendor-registration-number';
import {
  BRANCH_NEEDS_REGISTRATION_MESSAGE,
  BRANCH_REGISTRATION_UNREADABLE,
  approvalRefusal,
  type VerifiedElsewhere,
} from '@/lib/one-registered-business';

/**
 * 🔒 "UNLIMITED" = ONE REGISTERED BUSINESS — the server half (owner 2026-11-22; the words and the decision are in
 * `lib/one-registered-business.ts`, the rule in migration 20271359913146).
 *
 * SERVICE ROLE, by necessity and narrowly: another shop's registration number is never session-readable
 * (20271217955839), and "is anyone else verified under this number?" is a question across shops. Every caller has
 * already decided WHICH shop (an admin action behind `requireAdmin`, or the branch manager's own session-derived shop);
 * nothing here takes a shop id from a request body.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Which other real shop is already verified under this shop's DTI/SEC number — asked through the ONE predicate,
 * `registration_number_verified_holder`, the same one the trigger asks. A refused read is `unreadable`, never `clear`.
 */
export async function verifiedElsewhere(
  vendorProfileId: string,
  admin: AdminClient = createAdminClient(),
): Promise<VerifiedElsewhere> {
  try {
    const own = await admin
      .from('vendor_profiles')
      .select('registration_number_raw, registration_number_normalized')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (own.error) {
      logQueryError('one-registered-business:own-number', own.error);
      return { kind: 'unreadable' };
    }
    const row = own.data as { registration_number_raw: string | null; registration_number_normalized: string | null } | null;
    const raw = row?.registration_number_raw ?? row?.registration_number_normalized ?? null;
    // No number → nothing to hold (the same answer the database gives).
    if (!normalizeRegistrationNumber(raw)) return { kind: 'clear' };

    const holder = await admin.rpc('registration_number_verified_holder', {
      p_vendor_profile_id: vendorProfileId,
      p_registration_raw: raw,
    });
    if (holder.error) {
      logQueryError('one-registered-business:holder', holder.error);
      return { kind: 'unreadable' };
    }
    const holderId = typeof holder.data === 'string' && holder.data ? holder.data : null;
    if (!holderId) return { kind: 'clear' };

    // The name is for the admin's sentence only; an unread name still refuses.
    const named = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', holderId)
      .maybeSingle();
    if (named.error) logQueryError('one-registered-business:holder-name', named.error);
    return {
      kind: 'held',
      holderId,
      holderName: (named.data as { business_name: string | null } | null)?.business_name ?? null,
    };
  } catch (e) {
    logQueryError('one-registered-business:check', e);
    return { kind: 'unreadable' };
  }
}

/**
 * The sentence that refuses an approval about to make this shop verified, or `null` to go on. Asked by every way a
 * shop becomes verified BEFORE it writes anything (the application engine, the visibility approve, the vouch), so a
 * refusal never leaves an application approved with the shop unverified.
 */
export async function verifyRefusalFor(
  vendorProfileId: string,
  fromState: string | null | undefined,
  admin: AdminClient = createAdminClient(),
): Promise<string | null> {
  if (fromState === 'verified') return null;
  return approvalRefusal(fromState, await verifiedElsewhere(vendorProfileId, admin));
}

/**
 * Every branch carries its shop's DTI/SEC registration number: a shop with none cannot open a branch. The friendly
 * answer before the insert — the database (`vendor_branches_carry_shop_registration`) refuses the same row anyway.
 * `vendorProfileId` is the branch manager's own shop, resolved from their session.
 */
export async function branchNeedsRegistrationRefusal(vendorProfileId: string): Promise<string | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('vendor_profiles')
      .select('registration_number_raw, registration_number_normalized')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) {
      logQueryError('one-registered-business:branch-number', error);
      return BRANCH_REGISTRATION_UNREADABLE;
    }
    const row = data as { registration_number_raw: string | null; registration_number_normalized: string | null } | null;
    return normalizeRegistrationNumber(row?.registration_number_raw ?? row?.registration_number_normalized ?? null)
      ? null
      : BRANCH_NEEDS_REGISTRATION_MESSAGE;
  } catch (e) {
    logQueryError('one-registered-business:branch-number', e);
    return BRANCH_REGISTRATION_UNREADABLE;
  }
}
