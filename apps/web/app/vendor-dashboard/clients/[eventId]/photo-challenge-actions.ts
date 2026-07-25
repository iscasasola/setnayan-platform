'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isVendorAddonTieredPricingEnabled } from '@/lib/vendor-addon-tiered-pricing-flag';
import { resolveVendorAddonPricePhp } from '@/lib/vendor-addon-tier-pricing';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { appendLedger } from '@/lib/ledger';
import { isVendorAddonFirst5FreeEnabled } from '@/lib/vendor-addon-first5-free-flag';
import {
  COMMITTED_BOOKING_STATUSES,
  addonIsFreeUnderFirst5,
  fetchVendorCommittedBookingCount,
  first5BookingsRemaining,
} from '@/lib/vendor-addon-first5-free';
import { FREE_BOOKING_LIMIT } from '@/lib/booking-fee-lock';
import { eventPapicActive } from '@/lib/papic-seats';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import {
  VENDOR_PHOTO_CHALLENGE_SKU_CODE,
  resolveVendorPhotoChallengePricePhp,
  photoChallengeEligibility,
  fetchPhotoChallengeSponsored,
  PHOTO_CHALLENGE_DENY_MESSAGE,
} from '@/lib/vendor-photo-challenge';

/**
 * Photo Challenge add-on — a booked Pro/Enterprise vendor SPONSORS guest photo
 * challenges (the flag-dark Papic Games / missions feature) for one booked event
 * where Papic is active. Owner-locked 2026-07-22: FLAT ₱400 / EVENT (metered,
 * NOT a subscription → NO free first cycle; the owner set a trial only for the
 * AI + 3D add-ons). Guests + couple play free; the vendor pays ₱400.
 *
 * ── WHY the gate + price re-check is HERE, server-side ──────────────────────
 * Nothing else gates a vendor add-on on the orders spine. This action is the
 * ONLY gate: it rejects — BEFORE pricing — any of tier < Pro, unverified,
 * not-booked-on-the-event, Papic-not-active, or already-sponsored, then re-reads
 * the ₱400 authoritative price + the SKU's is_active flag from the admin-managed
 * vendor_billing_catalog (mirrors the AI-addon action). The client sends only
 * the event id + pay channel — never a price.
 *
 * Apply-then-pay: a 'submitted' order (event_id + vendor_profile_id set,
 * service_key='vendor_photo_challenge') + a pending 'payments' row that lands in
 * /admin/payments. On admin approval, the sku-activation hook
 * (lib/sku-activation.ts · 'vendor_photo_challenge') writes the
 * papic_photo_challenge_sponsorships entitlement, which the
 * papic_create_vendor_challenge RPC requires before a vendor may author a
 * challenge.
 */

export type PhotoChallengeActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** Apply-then-pay order created — pay by reference, activates on admin approval. */
  | { status: 'ordered'; referenceCode: string; amountPhp: number; message: string }
  /** Granted at ₱0 under "free until your 6th booking" — live immediately. */
  | { status: 'activated'; message: string };

function err(message: string): PhotoChallengeActionState {
  return { status: 'error', message };
}

/** 'SN' + 8 uppercase hex — matches the branch / couple / AI-addon reference format. */
function generateReferenceCode(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function parseChannel(raw: FormDataEntryValue | null): 'bdo' | 'gcash' {
  return String(raw ?? '').trim() === 'gcash' ? 'gcash' : 'bdo';
}

/** Booked = a contracted-or-further event_vendors row (mirrors the challenge RPC).
 *  Shared with the first-5-free counter so the two can never drift — a pinned
 *  drift test in vendor-addon-first5-free.test.ts guards the list. */
const BOOKED_STATUSES = COMMITTED_BOOKING_STATUSES;

export async function sponsorPhotoChallenge(
  _prev: PhotoChallengeActionState,
  formData: FormData,
): Promise<PhotoChallengeActionState> {
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
  // role) so an agent/viewer on this shop can't sponsor a paid Photo Challenge via
  // a role they hold on some other vendor.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can sponsor Papic Challenges.');
  }

  // ── Feature-availability gate (defence in depth) ───────────────────────────
  // Photo Challenge rides the flag-dark Papic Games engine. The buy surface
  // (VendorChallengeSection) already renders null when NEXT_PUBLIC_PAPIC_GAMES_V1
  // is off, but the flag can flip between render and submit — never take money
  // for a challenge that can't run.
  if (!papicGamesEnabled()) {
    return err('Papic Challenges isn’t available yet — it’s launching shortly. You won’t be charged.');
  }

  const admin = createAdminClient();

  // ── Gather the gate inputs (all reads BEFORE pricing) ──────────────────────
  // tier_state + verification_state are not in FULL_VENDOR_PROFILE_SELECT — soft
  // probe them together.
  const { data: gateRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (gateRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const verification =
    (gateRow as { verification_state?: string | null } | null)?.verification_state ?? null;

  // Booked on THIS event (admin-read: event_vendors is couple-scoped; we filter
  // by our own marketplace_vendor_id so this only ever matches our own booking).
  const { data: bookedRow } = await admin
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    .in('status', BOOKED_STATUSES as unknown as string[])
    .limit(1)
    .maybeSingle();
  const booked = bookedRow != null;

  // Papic active on the event (admin-read: paparazzi_seats + couple orders are
  // couple-RLS — the vendor can't see them under their own session).
  const papicActive = booked ? await eventPapicActive(admin, eventId) : false;

  // Already sponsored? (admin-read for authority.)
  const alreadySponsored = await fetchPhotoChallengeSponsored(admin, eventId, vendorProfileId);

  // 2026-07-25 tiered add-on model: when enabled, Papic Challenge opens to every
  // tier (Free/Solo pay the entry price) and the tier-based price applies. Mirrors
  // the SQL gate (papic_create_vendor_challenge reads the DB twin of this flag).
  const tieredPricing = isVendorAddonTieredPricingEnabled();
  const eligibility = photoChallengeEligibility({
    tier,
    verification,
    booked,
    papicActive,
    alreadySponsored,
    allTiersAllowed: tieredPricing,
  });
  if (!eligibility.ok) {
    return err(PHOTO_CHALLENGE_DENY_MESSAGE[eligibility.reason]);
  }

  // ── Pending-order guard (double-charge prevention) ─────────────────────────
  // The entitlement dedupes only on APPROVAL (alreadySponsored, above), so two
  // quick submits before an admin approves would mint TWO ₱400 orders for one
  // event. Reject a second submit while a 'submitted' order for this
  // (event, vendor, SKU) is still in review — mirrors the couple-3D buy's
  // owned-includes-submitted guard.
  const { data: pendingOrder } = await admin
    .from('orders')
    .select('order_id')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('service_key', VENDOR_PHOTO_CHALLENGE_SKU_CODE)
    .eq('status', 'submitted')
    .limit(1)
    .maybeSingle();
  if (pendingOrder) {
    return err(
      'You already have a Papic Challenges order in review for this event — it unlocks once our team confirms your payment.',
    );
  }

  // ── Re-read the authoritative ₱400 price + is_active from the catalog ───────
  // (mirrors the AI-addon is_active guard.) A retired SKU (row exists,
  // is_active=false) blocks the sale; a missing row falls back to ₱400.
  const { data: skuRow } = await supabase
    .from('vendor_billing_catalog')
    .select('price_php, is_active')
    .eq('sku_code', VENDOR_PHOTO_CHALLENGE_SKU_CODE)
    .maybeSingle();
  if (skuRow && (skuRow as { is_active?: boolean | null }).is_active === false) {
    return err('Papic Challenges is temporarily unavailable. Please try again later.');
  }
  const cyclePricePhp =
    skuRow && (skuRow as { is_active?: boolean | null }).is_active !== false
      ? Number((skuRow as { price_php: number | string }).price_php)
      : null;
  const listPricePhp = tieredPricing
    ? resolveVendorAddonPricePhp('papic_challenge', tier)
    : resolveVendorPhotoChallengePricePhp(cyclePricePhp);

  // ── "Free until your 6th booking" (owner 2026-07-25, flag-dark) ────────────
  // While the vendor is inside their first 5 bookings — the same window in which
  // Setnayan charges them no booking fee — sponsoring costs ₱0. The count comes
  // from event_vendors (NOT booking_fee_ledger, which is empty while the
  // booking-fee flag is off) and fails CLOSED, so a bad read charges rather than
  // gives away. Flag off → `first5Free` is false and everything below is
  // byte-identical to today.
  const first5Enabled = isVendorAddonFirst5FreeEnabled();
  const committedBookings = first5Enabled
    ? await fetchVendorCommittedBookingCount(supabase, vendorProfileId)
    : Number.NaN;
  const first5Free = addonIsFreeUnderFirst5({
    sku: 'papic_challenge',
    committedBookingCount: committedBookings,
    enabled: first5Enabled,
  });
  const pricePhp = first5Free ? 0 : listPricePhp;

  // ── FREE sponsorship → direct activation (no payment, no admin step) ────────
  // Mirrors the 3D booth's free path: an audit-only ₱0 'paid' order (no payments
  // row — payments.amount_php has a > 0 CHECK) plus the entitlement written HERE
  // rather than by the sku-activation hook, which only ever runs on admin
  // approval of a real payment. `alreadySponsored` (checked above) is the dedupe;
  // the upsert's (event_id, vendor_profile_id) UNIQUE is the backstop, so a
  // double-click can never mint two sponsorships.
  if (pricePhp <= 0) {
    const referenceCode = generateReferenceCode();
    const { data: freeOrder, error: foErr } = await admin
      .from('orders')
      .insert({
        event_id: eventId,
        user_id: user.id,
        vendor_profile_id: vendorProfileId,
        service_key: VENDOR_PHOTO_CHALLENGE_SKU_CODE,
        description: 'Papic Challenges (per event · free · first 5 bookings)',
        requested_total_php: 0,
        confirmed_total_php: 0,
        status: 'paid',
        reference_code: referenceCode,
      })
      .select('order_id')
      .maybeSingle();
    if (foErr || !freeOrder) {
      return err('Could not turn on Papic Challenges right now. Please try again.');
    }
    const freeOrderId = (freeOrder as { order_id: string }).order_id;

    const { error: grantErr } = await admin.from('papic_photo_challenge_sponsorships').upsert(
      { event_id: eventId, vendor_profile_id: vendorProfileId, order_id: freeOrderId },
      { onConflict: 'event_id,vendor_profile_id', ignoreDuplicates: true },
    );
    if (grantErr) {
      // Roll the audit order back so a retry re-mints cleanly and no 'paid' order
      // is left claiming an entitlement that was never written.
      await admin.from('orders').delete().eq('order_id', freeOrderId);
      return err('Could not turn on Papic Challenges right now. Please try again.');
    }

    await appendLedger(admin, {
      order_id: freeOrderId,
      event_type: 'service_activated',
      actor_user_id: user.id,
      actor_role: 'system',
      amount_centavos: 0,
      metadata: {
        service_key: VENDOR_PHOTO_CHALLENGE_SKU_CODE,
        vendor_profile_id: vendorProfileId,
        event_id: eventId,
        kind: 'papic_challenge_free_first5_bookings',
        committed_bookings: committedBookings,
      },
    });

    revalidatePath(`/vendor-dashboard/clients/${eventId}`);
    const remaining = first5BookingsRemaining(committedBookings);
    return {
      status: 'activated',
      message:
        `Papic Challenges is on for this event — free while you're on your first ${FREE_BOOKING_LIMIT} bookings` +
        (remaining > 0 ? ` (${remaining} to go)` : '') +
        `. From your ${FREE_BOOKING_LIMIT + 1}th booking it's ₱${listPricePhp.toLocaleString('en-PH')} per event.`,
    };
  }

  // ── Apply-then-pay: a submitted order + a pending payment row ───────────────
  const channel = parseChannel(formData.get('channel'));
  const referenceCode = generateReferenceCode();

  const { data: orderRow, error: oErr } = await supabase
    .from('orders')
    .insert({
      event_id: eventId,
      user_id: user.id,
      vendor_profile_id: vendorProfileId,
      service_key: VENDOR_PHOTO_CHALLENGE_SKU_CODE,
      description: 'Papic Challenges (per event)',
      requested_total_php: pricePhp,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the Papic Challenges order. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    amount_php: pricePhp,
    channel,
    reference_number: null,
    screenshot_url: null,
    paid_at: new Date().toISOString().slice(0, 10),
  });
  if (pErr) {
    await supabase.from('orders').delete().eq('order_id', orderId);
    return err('Could not start the Papic Challenges payment. Please try again.');
  }

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  return {
    status: 'ordered',
    referenceCode,
    amountPhp: pricePhp,
    message: `Order started. Pay ₱${pricePhp.toLocaleString('en-PH')} with reference ${referenceCode} — Papic Challenges unlocks once our team confirms your payment (within 24 hours).`,
  };
}
