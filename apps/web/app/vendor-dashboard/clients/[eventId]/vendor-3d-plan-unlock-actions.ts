'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import {
  fetchVendor3dBoothState,
  isVendor3dBoothActive,
} from '@/lib/vendor-3d-booth-pricing';
import {
  VENDOR_3D_PLAN_UNLOCK_TABLE,
  VENDOR_3D_PLAN_UNLOCK_PRICE_PHP,
  VENDOR_3D_PLAN_UNLOCK_BOOKED_STATUSES,
  vendor3dPlanUnlockEligibility,
  eventHasVendor3dPlanUnlock,
  VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE,
} from '@/lib/vendor-3d-plan-unlock';

/**
 * 3D Plan unlock — a booked vendor with an ACTIVE 3D Booth add-on UNLOCKS the
 * discounted 3D Plan for one of their booked couples. Owner-locked 2026-07-22:
 * the ₱1,500/28d 3D Booth add-on is the vendor's charge; unlocks are UNLIMITED
 * and FREE (there is NO order/payment here — contrast the ₱400 Photo Challenge
 * apply-then-pay). Unlocking marks the event ELIGIBLE for a discounted ₱1,000
 * SEATING_3D (vs the standard ₱2,999); the COUPLE then buys it via the normal
 * apply-then-pay checkout, and the server-authoritative resolver charges ₱1,000.
 *
 * ── THREE gates, rejected BEFORE writing (this action is the only gate) ──────
 *   1. active 3D Booth add-on — isVendor3dBoothActive(booth_addon_expires_at).
 *   2. booked on THIS event — a contracted-or-further event_vendors row scoped
 *      to the caller's own marketplace_vendor_id.
 *   3. idempotent per event — an existing event_vendor_3d_plan_unlocks row is a
 *      clean no-op (never a double-grant); the INSERT also uses ON CONFLICT
 *      (event_id) DO NOTHING as the race backstop.
 *
 * SAFETY: this UNLOCKS the couple's own discounted SEATING_3D purchase — it does
 * NOT grant SEATING_3D free and does NOT publish anything. The couple stays in
 * control of what they buy and what they publish.
 */

export type Vendor3dPlanUnlockActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** The event is now (or was already) unlocked — the couple can buy at ₱1,000. */
  | { status: 'unlocked'; message: string };

function err(message: string): Vendor3dPlanUnlockActionState {
  return { status: 'error', message };
}

export async function unlockVendor3dPlanForCouple(
  _prev: Vendor3dPlanUnlockActionState,
  formData: FormData,
): Promise<Vendor3dPlanUnlockActionState> {
  const eventId = formData.get('event_id');
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return err('Missing event.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No vendor profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scope the role check to THIS vendor profile (not the user's global-highest
  // role) so an agent/viewer on this shop can't unlock the discount via a role
  // they hold on some other vendor.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can unlock the 3D Plan for a couple.');
  }

  const admin = createAdminClient();

  // ── Gate inputs (all reads BEFORE the write) ───────────────────────────────
  // (1) Active 3D Booth add-on — read the vendor's entitlement window.
  const boothState = await fetchVendor3dBoothState(supabase, vendorProfileId);
  const boothAddonActive = isVendor3dBoothActive(boothState.expiresAt);

  // (2) Booked on THIS event (admin-read: event_vendors is couple-scoped; we
  //     filter by our own marketplace_vendor_id so this only ever matches our
  //     own booking).
  const { data: bookedRow } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', VENDOR_3D_PLAN_UNLOCK_BOOKED_STATUSES as unknown as string[])
    .limit(1)
    .maybeSingle();
  const booked = bookedRow != null;

  // (3) Already unlocked? (admin-read for authority — idempotent per event.)
  const alreadyUnlocked = await eventHasVendor3dPlanUnlock(admin, eventId);

  const eligibility = vendor3dPlanUnlockEligibility({
    boothAddonActive,
    booked,
    alreadyUnlocked,
  });
  if (!eligibility.ok) {
    // Already-unlocked is a benign no-op, not an error — surface the success
    // state so the couple-can-buy message still shows.
    if (eligibility.reason === 'already_unlocked') {
      return {
        status: 'unlocked',
        message: `Already unlocked — this couple can add the 3D Plan for ₱${VENDOR_3D_PLAN_UNLOCK_PRICE_PHP.toLocaleString('en-PH')} from their dashboard.`,
      };
    }
    return err(VENDOR_3D_PLAN_UNLOCK_DENY_MESSAGE[eligibility.reason]);
  }

  // ── Record the unlock (admin client; RLS-bypassed) ─────────────────────────
  // Idempotent: ON CONFLICT (event_id) DO NOTHING is the race backstop for two
  // concurrent unlocks — the first wins the attribution, the second no-ops.
  const { error: insertErr } = await admin
    .from(VENDOR_3D_PLAN_UNLOCK_TABLE)
    .upsert(
      {
        event_id: eventId,
        vendor_profile_id: vendorProfileId,
      },
      { onConflict: 'event_id', ignoreDuplicates: true },
    );
  if (insertErr) {
    return err('Could not unlock the 3D Plan for this couple. Please try again.');
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  return {
    status: 'unlocked',
    message: `Unlocked. This couple can now add the 3D Plan for ₱${VENDOR_3D_PLAN_UNLOCK_PRICE_PHP.toLocaleString('en-PH')} (usually ₱2,999) from their dashboard.`,
  };
}
