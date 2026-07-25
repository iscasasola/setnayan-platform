'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { seating3dEnabled } from '@/lib/seating-3d-flag';
import { appendLedger } from '@/lib/ledger';
import {
  VENDOR_3D_BOOTH_SKU_CODE,
  resolveVendor3dBoothPricePhp,
  nextVendor3dBoothExpiry,
} from '@/lib/vendor-3d-booth-pricing';
import { isVendorAddonTieredPricingEnabled } from '@/lib/vendor-addon-tiered-pricing-flag';
import { resolveVendorAddonPricePhp } from '@/lib/vendor-addon-tier-pricing';
import { isVendorAddonFirst5FreeEnabled } from '@/lib/vendor-addon-first5-free-flag';
import {
  addonIsFreeUnderFirst5,
  fetchVendorCommittedBookingCount,
  first5BookingsRemaining,
  nonStackingFreeExpiry,
} from '@/lib/vendor-addon-first5-free';
import { isVendorLaunchFreeWindowEnabled } from '@/lib/vendor-launch-free-window-flag';
import {
  isVendorLaunchFreeNow,
  vendorLaunchFreePricePhp,
  VENDOR_LAUNCH_FREE_WINDOW_END_LABEL,
} from '@/lib/vendor-launch-free-window-coverage';
import { FREE_BOOKING_LIMIT } from '@/lib/booking-fee-lock';

/**
 * 3D Booth add-on — buy/activate a 28-day cycle.
 *
 * Owner-locked 2026-07-22: a FLAT ₱1,500 / 28-day add-on on the PRO / ENTERPRISE
 * / CUSTOM tiers (verified only), FREE for the vendor's FIRST cycle (one-time
 * per account). When active, the vendor's booth renders BRANDED inside their
 * couples' published 3D Plans (lib/seating-3d.ts boothIsBranded); without it a
 * Pro/Enterprise vendor keeps the existing GENERIC booth.
 *
 * Two paths, one action (mirrors ai-addon-actions.ts exactly — same trial +
 * apply-then-pay shape):
 *   • FREE first cycle (booth_addon_trial_used_at IS NULL) → direct-activate: an
 *     ATOMIC claim (`UPDATE … WHERE booth_addon_trial_used_at IS NULL`) stamps
 *     the trial + a fresh 28-day window, + a ₱0 'paid' order row for the audit
 *     trail. No payment (payments.amount_php has a > 0 CHECK).
 *   • PAID cycle (trial used) → apply-then-pay: a 'submitted' order + a pending
 *     'payments' row that lands in /admin/payments. On admin approval, the
 *     sku-activation hook (lib/sku-activation.ts · 'vendor_3d_booth') stamps the
 *     entitlement window.
 *
 * ── WHY the tier + price re-check is HERE, server-side ──────────────────────
 * resolveServiceSellability (lib/v2-catalog.ts) only checks the two COUPLE
 * catalogs — a vendor add-on on the orders spine resolves `unknown → ALLOW`. So
 * this action is the ONLY gate: it rejects sub-Pro + unverified vendors BEFORE
 * pricing, and re-reads the ₱1,500 authoritative price + the SKU's is_active
 * flag from vendor_billing_catalog. The client sends only the pay channel —
 * never a price. Booth branding is a Pro/Enterprise perk (boothCanBrand), so the
 * add-on that turns it on is Pro+ too — hence `isTierAtLeast(tier, 'pro')` (vs
 * the AI add-on's Solo+ gate).
 *
 * ── 2026-07-25 TIERED ADD-ON MODEL (owner-locked · flag-dark) ───────────────
 * Behind `NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING` the Pro+ gate LIFTS and 3D
 * Plan Ads becomes buyable on EVERY tier at the tier-banded price —
 * `resolveVendorAddonPricePhp('ads_3d_plan', tier)` → ₱2,000 Free/Solo, ₱1,500
 * Pro/Enterprise. The tier is re-read here from `vendor_profiles.tier_state`, so
 * the band is server-authoritative and a tampered client can never buy at the
 * cheaper Pro price. Everything else is untouched: verified-only, the one-time
 * free first cycle, the atomic trial claim, and apply-then-pay. Flag OFF
 * (default) = byte-identical to today (Pro+ gate, flat catalog price).
 * The matching RENDER gate is `lib/booth-branding-tier-gate` — same flag, so
 * access and price flip together and a Free vendor can never pay for a booth
 * that would still render generic.
 *
 * ── 2026-07-25 LAUNCH FREE WINDOW (owner-locked · flag-dark) ────────────────
 * Behind `NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW` this add-on is ₱0 until
 * 2026-11-30 (`lib/vendor-launch-free-window-coverage`). It activates through
 * the same REPEATABLE, non-trial-consuming grant path as the first-5 policy, so
 * the vendor's one-time free cycle survives the window. Flag OFF (default) =
 * byte-identical to today.
 */

export type Vendor3dBoothActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** Free first cycle activated instantly — the branded booth is live now. */
  | { status: 'activated'; message: string }
  /** Paid renewal — an apply-then-pay order was created. */
  | { status: 'ordered'; referenceCode: string; amountPhp: number; message: string };

function err(message: string): Vendor3dBoothActionState {
  return { status: 'error', message };
}

/** 'SN' + 8 uppercase hex — matches the branch / couple checkout reference format. */
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

export async function activateVendor3dBooth(
  _prev: Vendor3dBoothActionState,
  formData: FormData,
): Promise<Vendor3dBoothActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No vendor profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scope the role check to THIS vendor profile (not the user's global-highest
  // role) so an agent/viewer on this shop can't manage its add-on via a role they
  // hold on some other vendor.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can manage the 3D Booth add-on.');
  }

  // ── Feature-availability gate (defence in depth) ───────────────────────────
  // The branded booth only renders inside a couple's 3D Plan, which is gated by
  // the NEXT_PUBLIC_SEATING_3D kill-switch (on by default). If 3D is switched
  // off there's nowhere for the booth to appear — never take money for it. The
  // card hides its buy CTA in this state; this is the server-side backstop.
  if (!seating3dEnabled()) {
    return err('The 3D Plan is switched off right now, so the 3D Booth can’t run — you won’t be charged.');
  }

  // ── Tier + verification gate (BEFORE pricing) ──────────────────────────────
  // tier_state + verification_state are not in FULL_VENDOR_PROFILE_SELECT — soft
  // probe them together. The add-on is a PRO+ feature (Pro / Enterprise /
  // Custom), verified only (owner 2026-07-22 · booth branding is a Pro perk).
  const { data: gateRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (gateRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const verification =
    (gateRow as { verification_state?: string | null } | null)?.verification_state ?? null;

  // Tiered add-on model ON → every tier may buy (at its own band's price); OFF →
  // today's Pro+ gate, verbatim.
  const tieredPricing = isVendorAddonTieredPricingEnabled();
  if (!tieredPricing && !isTierAtLeast(tier, 'pro')) {
    return err('3D Booth is available on the Pro, Enterprise, and Custom plans. Upgrade to add it.');
  }
  if (verification !== 'verified') {
    return err('Get your shop verified first — 3D Booth unlocks once you’re verified.');
  }

  // ── Add-on state → the price decision ──────────────────────────────────────
  const { data: stateRow } = await supabase
    .from('vendor_profiles')
    .select('booth_addon_trial_used_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const trialUsed =
    (stateRow as { booth_addon_trial_used_at?: string | null } | null)?.booth_addon_trial_used_at !=
    null;

  // Re-read the authoritative ₱1,500 price + is_active from the admin-managed
  // catalog (mirrors the token-RPC is_active guard). A retired SKU (row exists,
  // is_active=false) blocks the sale; a missing row falls back to ₱1,500.
  const { data: skuRow } = await supabase
    .from('vendor_billing_catalog')
    .select('price_php, is_active')
    .eq('sku_code', VENDOR_3D_BOOTH_SKU_CODE)
    .maybeSingle();
  if (skuRow && (skuRow as { is_active?: boolean | null }).is_active === false) {
    return err('3D Booth is temporarily unavailable. Please try again later.');
  }
  const catalogCyclePricePhp =
    skuRow && (skuRow as { is_active?: boolean | null }).is_active !== false
      ? Number((skuRow as { price_php: number | string }).price_php)
      : null;
  // Under the tiered model the CYCLE price comes from the code SSOT band
  // (₱2,000 entry / ₱1,500 growth) instead of the flat catalog row; the free
  // first cycle and every other rule below are unchanged.
  const cyclePricePhp = tieredPricing
    ? resolveVendorAddonPricePhp('ads_3d_plan', tier)
    : catalogCyclePricePhp;

  /** The standing renewal price for THIS vendor — what a cycle costs once any
   *  free grant is spent. Used in copy so no message hardcodes ₱1,500. */
  const renewalPricePhp = resolveVendor3dBoothPricePhp({ trialUsed: true, cyclePricePhp });
  const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

  // ── "Free until your 6th booking" (owner 2026-07-25) ───────────────────────
  // When this policy is live it REPLACES the one-time free 28-day cycle: free is
  // decided ONLY by the first-5 window, and it REPEATS while the vendor is inside
  // it. The count is read from event_vendors (NOT booking_fee_ledger — that is
  // empty while the booking-fee flag is off) and fails CLOSED, so a broken read
  // charges rather than gives away. Flag off → `first5Free` is false and the
  // trial path below runs byte-identically to today.
  const first5Enabled = isVendorAddonFirst5FreeEnabled();
  const committedBookings = first5Enabled
    ? await fetchVendorCommittedBookingCount(supabase, vendorProfileId)
    : Number.NaN;
  const first5Free = addonIsFreeUnderFirst5({
    sku: 'ads_3d_plan',
    committedBookingCount: committedBookings,
    enabled: first5Enabled,
  });

  // ── Launch free window (owner 2026-07-25 · flag-dark) ──────────────────────
  // Selected vendor paid features are ₱0 until 2026-11-30 to seed supply. This
  // is a REPEATABLE grant, NOT a trial: it deliberately does not touch
  // booth_addon_trial_used_at, so the vendor still holds their one free cycle
  // when the window closes. Applied to the RESOLVED price rather than injected
  // as cyclePricePhp because resolveVendor3dBoothPricePhp coerces a ₱0 input
  // back up to the ₱1,500 fallback — and it is safe here only because it can
  // ONLY move the price down to ₱0 (never over a ₱0 trial with a positive
  // number). Flag off → `launchFree` is false and everything below is
  // byte-identical to today.
  const launchInput = {
    sku: 'vendor_3d_booth',
    enabled: isVendorLaunchFreeWindowEnabled(),
    nowMs: Date.now(),
  };
  const launchFree = isVendorLaunchFreeNow(launchInput);

  /** Today's price, before the launch window is considered. */
  const basePricePhp = first5Enabled
    ? first5Free
      ? 0
      : renewalPricePhp
    : resolveVendor3dBoothPricePhp({ trialUsed, cyclePricePhp });
  const pricePhp = vendorLaunchFreePricePhp(basePricePhp, launchInput);

  /** A free cycle that must NOT burn the one-time trial claim. */
  const repeatableFree = first5Free || launchFree;

  // ── FREE cycle → direct activation ─────────────────────────────────────────
  // Three shapes reach here. `launchFree` and `first5Free` are REPEATABLE grants
  // (the launch window / the vendor's first 5 bookings); otherwise it is the
  // legacy one-time trial, unchanged.
  if (pricePhp <= 0) {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const oneCycleFromNow = nextVendor3dBoothExpiry(null, Date.now());
    let newExpiry = oneCycleFromNow;

    if (repeatableFree) {
      // REPEATABLE grant — no trial to claim, so the atomic one-time claim that
      // made the trial double-click-proof does not apply. Clamp the window to ONE
      // cycle ahead instead (nonStackingFreeExpiry), so pressing the button ten
      // times lands on the same ~28-days-from-now rather than stacking 280 free
      // days that would outlive the vendor's 6th booking. Deliberately does NOT
      // touch booth_addon_trial_used_at: the trial is a separate, dormant
      // mechanic while this policy is live, and burning it here would silently
      // cost the vendor their legacy free cycle if the policy is ever switched off.
      const { data: curRow } = await admin
        .from('vendor_profiles')
        .select('booth_addon_expires_at')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle();
      const currentExpiry =
        (curRow as { booth_addon_expires_at?: string | null } | null)?.booth_addon_expires_at ??
        null;
      newExpiry = nonStackingFreeExpiry(currentExpiry, oneCycleFromNow);

      const { error: grantErr } = await admin
        .from('vendor_profiles')
        .update({ booth_addon_expires_at: newExpiry })
        .eq('vendor_profile_id', vendorProfileId);
      if (grantErr) {
        return err('Could not activate 3D Booth right now. Please try again.');
      }
    } else {
      // Atomic one-time claim: only succeeds while the trial is still unused, so a
      // double-click / two tabs can never grant two free cycles.
      const { data: claimed, error: claimErr } = await admin
        .from('vendor_profiles')
        .update({ booth_addon_trial_used_at: nowIso, booth_addon_expires_at: newExpiry })
        .eq('vendor_profile_id', vendorProfileId)
        .is('booth_addon_trial_used_at', null)
        .select('vendor_profile_id');

      if (claimErr) {
        return err('Could not activate 3D Booth right now. Please try again.');
      }
      if (!claimed || claimed.length === 0) {
        // Lost the race (another request just claimed the trial) — the caller
        // should re-submit and land on the paid path. Surface it plainly.
        return err(
          `Your free cycle was just used. Refresh to buy the next cycle (${peso(renewalPricePhp)} / 28 days).`,
        );
      }
    }

    // Audit-only ₱0 'paid' order (no payment row — payments.amount_php > 0).
    const referenceCode = generateReferenceCode();
    const { data: orderRow } = await admin
      .from('orders')
      .insert({
        event_id: null,
        user_id: user.id,
        vendor_profile_id: vendorProfileId,
        service_key: VENDOR_3D_BOOTH_SKU_CODE,
        description: launchFree
          ? '3D Booth — Branded Virtual Booth (free · launch window)'
          : first5Free
            ? '3D Booth — Branded Virtual Booth (free · first 5 bookings)'
            : '3D Booth — Branded Virtual Booth (first cycle · free)',
        requested_total_php: 0,
        confirmed_total_php: 0,
        status: 'paid',
        reference_code: referenceCode,
        // Stamp the order's window so the renewal-reminder job nudges the vendor
        // before the free cycle lapses (subscriptions_due_for_renewal_reminder
        // reads orders.expires_at).
        expires_at: newExpiry,
      })
      .select('order_id')
      .maybeSingle();
    if (orderRow) {
      await appendLedger(admin, {
        order_id: (orderRow as { order_id: string }).order_id,
        event_type: 'service_activated',
        actor_user_id: user.id,
        actor_role: 'system',
        amount_centavos: 0,
        metadata: {
          service_key: VENDOR_3D_BOOTH_SKU_CODE,
          vendor_profile_id: vendorProfileId,
          kind: launchFree
            ? 'booth_addon_free_launch_window'
            : first5Free
              ? 'booth_addon_free_first5_bookings'
              : 'booth_addon_free_first_cycle',
          expires_at: newExpiry,
          ...(first5Free ? { committed_bookings: committedBookings } : {}),
        },
      });
    }

    revalidatePath('/vendor-dashboard/subscription');
    revalidatePath('/vendor-dashboard/shop');
    return {
      status: 'activated',
      message: launchFree
        ? `Your 3D Booth is on — free through ${VENDOR_LAUNCH_FREE_WINDOW_END_LABEL} while we're in launch. After that it's ${peso(renewalPricePhp)} / 28 days` +
          (trialUsed ? '.' : ", and your free first cycle is still waiting for you.")
        : first5Free
          ? `Your 3D Booth is on — free while you're on your first ${FREE_BOOKING_LIMIT} bookings (${first5BookingsRemaining(committedBookings)} to go). From your ${FREE_BOOKING_LIMIT + 1}th booking it's ${peso(renewalPricePhp)} / 28 days.`
          : `Your 3D Booth is on — your free first 28-day cycle is active. After it ends, it’s ${peso(renewalPricePhp)} / 28 days.`,
    };
  }

  // ── PAID cycle → apply-then-pay (activates on admin approval) ───────────────
  const channel = parseChannel(formData.get('channel'));
  const referenceCode = generateReferenceCode();

  const { data: orderRow, error: oErr } = await supabase
    .from('orders')
    .insert({
      event_id: null,
      user_id: user.id,
      vendor_profile_id: vendorProfileId,
      service_key: VENDOR_3D_BOOTH_SKU_CODE,
      description: '3D Booth — Branded Virtual Booth (28-day)',
      requested_total_php: pricePhp,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the 3D Booth order. Please try again.');
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
    return err('Could not start the 3D Booth payment. Please try again.');
  }

  revalidatePath('/vendor-dashboard/subscription');
  return {
    status: 'ordered',
    referenceCode,
    amountPhp: pricePhp,
    message: `Order started. Pay ₱${pricePhp.toLocaleString('en-PH')} with reference ${referenceCode} — 3D Booth switches on once our team confirms your payment (within 24 hours).`,
  };
}
