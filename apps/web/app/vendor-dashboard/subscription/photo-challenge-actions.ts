'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, compOrderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { isVendorAddonTieredPricingEnabled } from '@/lib/vendor-addon-tiered-pricing-flag';
import { resolveVendorAddonPricePhp } from '@/lib/vendor-addon-tier-pricing';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { appendLedger } from '@/lib/ledger';
import { payPath } from '@/lib/pay-path';
import { isVendorAddonFirst5FreeEnabled } from '@/lib/vendor-addon-first5-free-flag';
import {
  addonIsFreeUnderFirst5,
  fetchVendorCommittedBookingCount,
  first5BookingsRemaining,
} from '@/lib/vendor-addon-first5-free';
import { FREE_BOOKING_LIMIT } from '@/lib/booking-fee-lock';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import {
  VENDOR_PHOTO_CHALLENGE_SKU_CODE,
  VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS,
  resolveVendorPhotoChallengePricePhp,
  photoChallengePurchaseEligibility,
  isPhotoChallengeSubscriptionActive,
  nextPhotoChallengeExpiry,
  fetchPhotoChallengeExpiry,
  PHOTO_CHALLENGE_DENY_MESSAGE,
} from '@/lib/vendor-photo-challenge';

/**
 * Papic Challenges — the vendor turns guest photo missions ON FOR THEIR SHOP.
 *
 * OWNER 2026-08-28, verbatim: **"unlimited us 2500 for 4 weeks."** ₱2,500 per
 * 28 days, unlimited challenges, across EVERY celebration the shop is booked
 * for. It replaces the ₱400-per-event sponsorship locked on 2026-07-22. Guests
 * and the couple still play free; the shop pays.
 *
 * ── WHY THIS ACTION NO LONGER TAKES AN EVENT ID ─────────────────────────────
 * It used to, and the event id came FROM THE FORM — which is why the old
 * docblock spent a paragraph on the authorization binding that stopped a forged
 * one (an admin-client `event_vendors` read filtered to the caller's own shop).
 * A subscription is bought by the SHOP, so there is nothing to bind: the field
 * is gone, `orders.event_id` is null, and the whole forged-event-id class goes
 * with it. **A parameter you do not accept cannot be forged.**
 *
 * The per-event questions did not disappear, they moved to where they belong —
 * `photoChallengeEventReady` decides whether a challenge can run at ONE
 * celebration (booked + Papic active + entitled), and the database asks the
 * entitlement half again itself in `vendor_papic_challenge_entitled`, called by
 * both the authoring RPC and the photo-delivery RPC.
 *
 * ── WHY the gate + price re-check is HERE, server-side ──────────────────────
 * Nothing else gates a vendor add-on on the orders spine. This action rejects —
 * BEFORE pricing — tier < Pro (unless the tiered model is on), unverified, and
 * already-subscribed, then re-reads the authoritative price + the SKU's
 * is_active flag from the admin-managed vendor_billing_catalog. The client
 * sends only the pay channel — never a price, and no longer an event.
 *
 * Apply-then-pay: a 'submitted' order (vendor_profile_id set,
 * service_key='vendor_photo_challenge') + a pending 'payments' row that lands in
 * /admin/payments. On admin approval the sku-activation hook stamps
 * vendor_profiles.papic_challenge_expires_at 28 days out.
 */

export type PhotoChallengeActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
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

/**
 * Where to send the caller back to after a ₱0 activation. Taken from the form
 * only to REVALIDATE a path the vendor is already looking at — it never reaches
 * a query, a policy or the order, so an unexpected value costs a stale cache and
 * nothing else. Bounded to our own dashboard for that reason.
 */
function parseReturnPath(raw: FormDataEntryValue | null): string {
  const s = String(raw ?? '').trim();
  return s.startsWith('/vendor-dashboard/') ? s : '/vendor-dashboard/subscription';
}

export async function sponsorPhotoChallenge(
  _prev: PhotoChallengeActionState,
  formData: FormData,
): Promise<PhotoChallengeActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No vendor profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scope the role check to THIS vendor profile (not the user's global-highest
  // role) so an agent/viewer on this shop can't buy a paid add-on via a role
  // they hold on some other vendor.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can turn on Papic Challenges.');
  }

  // ── Feature-availability gate (defence in depth) ───────────────────────────
  // Papic Challenges rides the flag-dark Papic Games engine. The buy surface
  // already renders null when NEXT_PUBLIC_PAPIC_GAMES_V1 is off, but the flag
  // can flip between render and submit — never take money for a product that
  // cannot run.
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

  // Already subscribed? Read with the ADMIN client for authority — the window is
  // the thing being sold, and a read the vendor's own session could refuse would
  // degrade to "not subscribed", i.e. toward charging them twice.
  const currentExpiry = await fetchPhotoChallengeExpiry(admin, vendorProfileId);
  const subscriptionActive = isPhotoChallengeSubscriptionActive(currentExpiry);

  // ⚠ THE TIER FLOOR NO LONGER RIDES ON THIS FLAG. Owner 2026-08-29: *"they can
  // only buy if they are solo, pro, enterprise, custom. but not when they are
  // free"*. The flag still decides the PRICE BAND (below); who may buy is a
  // rule of its own, enforced unconditionally inside
  // `photoChallengePurchaseEligibility` and re-asserted by the SQL RPC.
  const tieredPricing = isVendorAddonTieredPricingEnabled();
  const eligibility = photoChallengePurchaseEligibility({
    tier,
    verification,
    subscriptionActive,
  });
  if (!eligibility.ok) {
    return err(PHOTO_CHALLENGE_DENY_MESSAGE[eligibility.reason]);
  }

  // ── Pending-order guard (double-charge prevention) ─────────────────────────
  // The window is stamped only on APPROVAL, so two quick submits before an admin
  // approves would mint TWO orders for one cycle. Reject a second submit while a
  // 'submitted' order for this (vendor, SKU) is still in review.
  // ⚠ SCOPED BY VENDOR, NOT BY EVENT. Under the per-event model this filtered on
  // event_id as well — which under a subscription would let the same shop mint a
  // second pending order from a different celebration's screen and be charged
  // twice for one 28-day window.
  const { data: pendingOrder } = await admin
    .from('orders')
    .select('order_id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('service_key', VENDOR_PHOTO_CHALLENGE_SKU_CODE)
    .eq('status', 'submitted')
    .limit(1)
    .maybeSingle();
  if (pendingOrder) {
    return err(
      'You already have a Papic Challenges order in review — it turns on once our team confirms your payment.',
    );
  }

  // ── Re-read the authoritative price + is_active from the catalog ───────────
  // A retired SKU (row exists, is_active=false) blocks the sale; a missing row
  // falls back to the code figure.
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
  // Setnayan charges them no booking fee — the cycle costs ₱0. The count comes
  // from event_vendors (NOT booking_fee_ledger, which is empty while the
  // booking-fee flag is off) and fails CLOSED, so a bad read charges rather than
  // gives away. Flag off → `first5Free` is false and everything below is
  // byte-identical to a paid cycle.
  // ⚠ Under the subscription this grants a whole free 28-DAY CYCLE rather than a
  // single event. That follows the owner's 2026-07-25 rule as written; it is
  // named here rather than quietly narrowed, because narrowing an owner ruling
  // is his call and the flag is off in production either way.
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
  const returnPath = parseReturnPath(formData.get('return_to'));

  // ── FREE cycle → direct activation (no payment, no admin step) ─────────────
  // Mirrors the 3D booth's free path: an audit-only ₱0 'paid' order (no payments
  // row — payments.amount_php has a > 0 CHECK) plus the window written HERE
  // rather than by the sku-activation hook, which only ever runs on admin
  // approval of a real payment. `subscriptionActive` (checked above) is the
  // dedupe; `nextPhotoChallengeExpiry` stacks from the later of now / the
  // current expiry, so even a race can only ever extend, never double-count.
  if (pricePhp <= 0) {
    const referenceCode = generateReferenceCode();
    const { data: freeOrder, error: foErr } = await createMoneyWriterClient()
      .from('orders')
      .insert(
        // SEC-4b · F1 — comp mint. `compOrderRowFor` stamps status='paid' +
        // requested/confirmed_total_php=0 and forbids all three, so this path
        // cannot become a non-zero charge. `orderRowFor` deliberately rejects
        // 'paid' (it is the status that skips /admin/payments reconciliation).
        compOrderRowFor(
          { userId: user.id, eventId: null, vendorProfileId },
          {
            service_key: VENDOR_PHOTO_CHALLENGE_SKU_CODE,
            description: `Papic Challenges (unlimited · ${VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS} days · free · first 5 bookings)`,
            reference_code: referenceCode,
          },
        ),
      )
      .select('order_id')
      .maybeSingle();
    if (foErr || !freeOrder) {
      return err('Could not turn on Papic Challenges right now. Please try again.');
    }
    const freeOrderId = (freeOrder as { order_id: string }).order_id;

    const newExpiry = nextPhotoChallengeExpiry(currentExpiry, Date.now());
    const { error: grantErr } = await admin
      .from('vendor_profiles')
      .update({ papic_challenge_expires_at: newExpiry })
      .eq('vendor_profile_id', vendorProfileId);
    if (grantErr) {
      // Roll the audit order back so a retry re-mints cleanly and no 'paid' order
      // is left claiming a window that was never written.
      await createMoneyWriterClient().from('orders').delete().eq('order_id', freeOrderId);
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
        kind: 'papic_challenge_free_first5_bookings',
        committed_bookings: committedBookings,
        expires_at: newExpiry,
      },
    });

    revalidatePath(returnPath);
    revalidatePath('/vendor-dashboard/subscription');
    const remaining = first5BookingsRemaining(committedBookings);
    return {
      status: 'activated',
      message:
        `Papic Challenges is on for every celebration you're booked for — free while you're on your first ${FREE_BOOKING_LIMIT} bookings` +
        (remaining > 0 ? ` (${remaining} to go)` : '') +
        `. From your ${FREE_BOOKING_LIMIT + 1}th booking it's ₱${listPricePhp.toLocaleString('en-PH')} every ${VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS} days.`,
    };
  }

  // ── Apply-then-pay: a submitted order + a pending payment row ───────────────
  const channel = parseChannel(formData.get('channel'));
  const referenceCode = generateReferenceCode();

  // ── SEC-4b · service-role mint ─────────────────────────────────────────────
  // `orders` + `payments` INSERT are revoked from `authenticated` (migration
  // 20271008178212). service_role bypasses `orders_owner_write`'s
  // `WITH CHECK (user_id = auth.uid())`, which was RLS's only contribution — it
  // checked neither event_id nor vendor_profile_id.
  //
  // AUTHORIZATION IS UNCHANGED AND IS NOW SIMPLER than it was: this used to be
  // the one converted vendor site whose event_id ORIGINATED IN THE FORM, and the
  // booked-on-this-event read was what bound it. The subscription takes no event
  // at all, so every identity on the order comes from the session:
  // authenticated → `fetchOwnVendorProfile` → `resolveVendorRoleForProfile` +
  // canManageVendor (PROFILE-scoped) → `papicGamesEnabled()` → the
  // already-subscribed dedupe → the pending-order double-charge guard → the SKU
  // is_active reject. Every gate stays BEFORE pricing.
  const { data: orderRow, error: oErr } = await createMoneyWriterClient()
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId: null, vendorProfileId },
        {
          service_key: VENDOR_PHOTO_CHALLENGE_SKU_CODE,
          description: `Papic Challenges (unlimited · ${VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS} days)`,
          requested_total_php: pricePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the Papic Challenges order. Please try again.');
  }
  const orderId = (orderRow as { order_id: string }).order_id;

  const { error: pErr } = await createMoneyWriterClient().from('payments').insert(
    paymentRowFor(
      { userId: user.id, verifiedOrderId: orderId },
      {
        amount_php: pricePhp,
        channel,
        reference_number: null,
        screenshot_url: null,
        paid_at: new Date().toISOString().slice(0, 10),
      },
    ),
  );
  if (pErr) {
    // Same client that minted it — a mixed-client compensation is how a
    // rollback silently stops rolling back.
    await createMoneyWriterClient().from('orders').delete().eq('order_id', orderId);
    return err('Could not start the Papic Challenges payment. Please try again.');
  }

  revalidatePath(returnPath);
  revalidatePath('/vendor-dashboard/subscription');

  // ── THE BUYER GOES WHERE THEY CAN ACTUALLY PAY ─────────────────────────
  // Owner, 2026-08-21: "this can apply to all purchasable buttons." This path
  // was missed by the conversion once and kept the panel every other buy button
  // shed: it printed the amount and the reference and told the vendor to "pay
  // to our BDO or GCash account" — WITHOUT NAMING EITHER ACCOUNT, with no QR
  // carrying the amount, and with nowhere to send the screenshot.
  redirect(payPath(referenceCode));
}
