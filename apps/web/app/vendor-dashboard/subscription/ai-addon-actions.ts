'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { isVendorAddonTieredPricingEnabled } from '@/lib/vendor-addon-tiered-pricing-flag';
import { resolveVendorAddonPricePhp } from '@/lib/vendor-addon-tier-pricing';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { appendLedger } from '@/lib/ledger';
import { nonStackingFreeExpiry } from '@/lib/vendor-addon-first5-free';
import { isVendorLaunchFreeWindowEnabled } from '@/lib/vendor-launch-free-window-flag';
import {
  isVendorLaunchFreeNow,
  vendorLaunchFreePricePhp,
  VENDOR_LAUNCH_FREE_WINDOW_END_LABEL,
} from '@/lib/vendor-launch-free-window-coverage';
import {
  VENDOR_AI_ADDON_SKU_CODE,
  VENDOR_AI_ADDON_FALLBACK_PHP,
  resolveVendorAiAddonPricePhp,
  nextVendorAiAddonExpiry,
} from '@/lib/vendor-addon-pricing';

/**
 * Vendor AI ("the AI Chatbot") add-on — buy/activate a 28-day cycle.
 *
 * Owner-locked 2026-07-22: a FLAT ₱1,500 / 28-day add-on on the PAID tiers
 * (solo/pro/enterprise, verified only), FREE for the vendor's FIRST cycle
 * (one-time per account). Turns ON the existing flag-dark Auto-Reply Assistant.
 *
 * Two paths, one action:
 *   • FREE first cycle (ai_addon_trial_used_at IS NULL) → direct-activate: an
 *     ATOMIC claim (`UPDATE … WHERE ai_addon_trial_used_at IS NULL`) stamps the
 *     trial + a fresh 28-day window, + a ₱0 'paid' order row for the audit
 *     trail. No payment (payments.amount_php has a > 0 CHECK).
 *   • PAID cycle (trial used) → apply-then-pay: a 'submitted' order + a pending
 *     'payments' row that lands in /admin/payments. On admin approval, the
 *     sku-activation hook (lib/sku-activation.ts · 'vendor_ai_addon') stamps the
 *     entitlement window.
 *
 * ── WHY the tier + price re-check is HERE, server-side ──────────────────────
 * resolveServiceSellability (lib/v2-catalog.ts) only checks the two COUPLE
 * catalogs — a vendor add-on on the orders spine resolves `unknown → ALLOW`. So
 * this action is the ONLY gate: it rejects free/verified + unverified vendors
 * BEFORE pricing, and re-reads the ₱1,500 authoritative price + the SKU's
 * is_active flag from vendor_billing_catalog (mirrors the token-purchase RPC's
 * is_active guard). The client sends only the pay channel — never a price.
 *
 * ── 2026-07-25 LAUNCH FREE WINDOW (owner-locked · flag-dark) ────────────────
 * Behind `NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW` this add-on is ₱0 until
 * 2026-11-30 (`lib/vendor-launch-free-window-coverage`). It activates through a
 * REPEATABLE grant that does NOT consume `ai_addon_trial_used_at`, so the
 * vendor's one free cycle survives the window. Flag OFF (default) =
 * byte-identical to today.
 */

export type VendorAiAddonActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** Free first cycle activated instantly — the assistant is live now. */
  | { status: 'activated'; message: string }
  /** Paid renewal — an apply-then-pay order was created. */
  | { status: 'ordered'; referenceCode: string; amountPhp: number; message: string };

function err(message: string): VendorAiAddonActionState {
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

export async function activateVendorAiAddon(
  _prev: VendorAiAddonActionState,
  formData: FormData,
): Promise<VendorAiAddonActionState> {
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
    return err('Only the owner or an admin can manage the Vendor AI add-on.');
  }

  // ── Feature-availability gate (defence in depth) ───────────────────────────
  // Vendor AI is a MASTER-FLAG-DARK feature: the assistant only answers couples
  // once NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 is on. Never take money for an add-on
  // that can't run yet — reject here even if the flag flipped off between the
  // card render and this submit. (The card already hides the buy CTA while the
  // flag is off; this is the server-side backstop.)
  if (!vendorAutoReplyEnabled()) {
    return err('Vendor AI isn’t available yet — it’s launching shortly. You won’t be charged.');
  }

  // ── Tier + verification gate (BEFORE pricing) ──────────────────────────────
  // tier_state + verification_state are not in FULL_VENDOR_PROFILE_SELECT — soft
  // probe them together. The add-on is a PAID-tier feature (Solo+), verified only
  // (owner 2026-07-22 · "free for the FIRST cycle on activation + verification").
  const { data: gateRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (gateRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const verification =
    (gateRow as { verification_state?: string | null } | null)?.verification_state ?? null;

  if (!isTierAtLeast(tier, 'solo')) {
    return err('Vendor AI is available on the paid plans (Solo, Pro, or Enterprise). Upgrade to add it.');
  }
  if (verification !== 'verified') {
    return err('Get your shop verified first — Vendor AI unlocks once you’re verified.');
  }

  // ── Add-on state → the price decision ──────────────────────────────────────
  const { data: stateRow } = await supabase
    .from('vendor_profiles')
    .select('ai_addon_trial_used_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const trialUsed =
    (stateRow as { ai_addon_trial_used_at?: string | null } | null)?.ai_addon_trial_used_at != null;

  // Re-read the authoritative ₱1,500 price + is_active from the admin-managed
  // catalog (mirrors the token-RPC is_active guard). A retired SKU (row exists,
  // is_active=false) blocks the sale; a missing row falls back to ₱1,500.
  const { data: skuRow } = await supabase
    .from('vendor_billing_catalog')
    .select('price_php, is_active')
    .eq('sku_code', VENDOR_AI_ADDON_SKU_CODE)
    .maybeSingle();
  if (skuRow && (skuRow as { is_active?: boolean | null }).is_active === false) {
    return err('Vendor AI is temporarily unavailable. Please try again later.');
  }
  const catalogCyclePricePhp =
    skuRow && (skuRow as { is_active?: boolean | null }).is_active !== false
      ? Number((skuRow as { price_php: number | string }).price_php)
      : null;
  // 2026-07-25 tiered add-on model: the CYCLE price comes from the code SSOT band
  // (₱2,000 Free/Solo · ₱1,500 Pro/Ent) instead of the flat catalog row.
  //
  // ⚠ INJECTED AS THE INPUT, never as the final price. resolveVendorAiAddonPricePhp
  // short-circuits to ₱0 on the free first cycle BEFORE it looks at this value, so
  // overwriting `pricePhp` afterwards would silently bill the trial. Same shape as
  // booth-addon-actions.ts. The tier is re-read server-side above, so a tampered
  // client can never force the cheaper Pro band.
  const cyclePricePhp = isVendorAddonTieredPricingEnabled()
    ? resolveVendorAddonPricePhp('ai_chatbot_basic', tier)
    : catalogCyclePricePhp;
  // ── Launch free window (owner 2026-07-25 · flag-dark) ──────────────────────
  // Behind NEXT_PUBLIC_VENDOR_LAUNCH_FREE_WINDOW this add-on is ₱0 until
  // 2026-11-30 to seed supply. It is a REPEATABLE grant, NOT a trial: the branch
  // below deliberately does not stamp ai_addon_trial_used_at, so the vendor still
  // holds their one free cycle when the window closes. Applied to the RESOLVED
  // price rather than injected as cyclePricePhp because
  // resolveVendorAiAddonPricePhp coerces a ₱0 input back up to the ₱1,500
  // fallback; that is safe ONLY because this can only move the price DOWN to ₱0
  // and can never overwrite the free first cycle with a positive number. Flag off
  // → `launchFree` is false and everything below is byte-identical to today.
  const launchInput = {
    sku: 'vendor_ai_addon',
    enabled: isVendorLaunchFreeWindowEnabled(),
    nowMs: Date.now(),
  };
  const launchFree = isVendorLaunchFreeNow(launchInput);

  const pricePhp = vendorLaunchFreePricePhp(
    resolveVendorAiAddonPricePhp({ trialUsed, cyclePricePhp }),
    launchInput,
  );
  /** What a cycle costs this vendor once the free first cycle is spent — so no
   *  message below hardcodes ₱1,500, which is wrong for the entry band. */
  const renewalPricePhp = resolveVendorAiAddonPricePhp({ trialUsed: true, cyclePricePhp });
  const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

  // ── FREE cycle → direct activation ─────────────────────────────────────────
  // Two shapes reach here: the launch-window REPEATABLE grant (no trial to burn)
  // and the legacy one-time trial with its atomic claim, unchanged.
  if (pricePhp <= 0) {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const oneCycleFromNow = nextVendorAiAddonExpiry(null, Date.now());
    let newExpiry = oneCycleFromNow;

    if (launchFree) {
      // Repeatable grant — there is no one-time claim to serialize a burst on, so
      // clamp the window to ONE cycle ahead (nonStackingFreeExpiry). Pressing the
      // button ten times lands on the same ~28-days-from-now instead of stacking
      // 280 free days that would outlive the launch window. Deliberately leaves
      // ai_addon_trial_used_at alone.
      const { data: curRow } = await admin
        .from('vendor_profiles')
        .select('ai_addon_expires_at')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle();
      const currentExpiry =
        (curRow as { ai_addon_expires_at?: string | null } | null)?.ai_addon_expires_at ?? null;
      newExpiry = nonStackingFreeExpiry(currentExpiry, oneCycleFromNow);

      const { error: grantErr } = await admin
        .from('vendor_profiles')
        .update({ ai_addon_expires_at: newExpiry })
        .eq('vendor_profile_id', vendorProfileId);
      if (grantErr) {
        return err('Could not activate Vendor AI right now. Please try again.');
      }
    } else {
      // Atomic one-time claim: only succeeds while the trial is still unused, so a
      // double-click / two tabs can never grant two free cycles.
      const { data: claimed, error: claimErr } = await admin
        .from('vendor_profiles')
        .update({ ai_addon_trial_used_at: nowIso, ai_addon_expires_at: newExpiry })
        .eq('vendor_profile_id', vendorProfileId)
        .is('ai_addon_trial_used_at', null)
        .select('vendor_profile_id');

      if (claimErr) {
        return err('Could not activate Vendor AI right now. Please try again.');
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
        service_key: VENDOR_AI_ADDON_SKU_CODE,
        description: launchFree
          ? 'Vendor AI — AI Chatbot (free · launch window)'
          : 'Vendor AI — AI Chatbot (first cycle · free)',
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
          service_key: VENDOR_AI_ADDON_SKU_CODE,
          vendor_profile_id: vendorProfileId,
          kind: launchFree ? 'ai_addon_free_launch_window' : 'ai_addon_free_first_cycle',
          expires_at: newExpiry,
        },
      });
    }

    revalidatePath('/vendor-dashboard/subscription');
    revalidatePath('/vendor-dashboard/shop');
    return {
      status: 'activated',
      message: launchFree
        ? `Vendor AI is on — free through ${VENDOR_LAUNCH_FREE_WINDOW_END_LABEL} while we're in launch. After that it's ${peso(renewalPricePhp)} / 28 days` +
          (trialUsed ? '.' : ", and your free first cycle is still waiting for you.")
        : `Vendor AI is on — your free first 28-day cycle is active. After it ends, it’s ${peso(renewalPricePhp)} / 28 days.`,
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
      service_key: VENDOR_AI_ADDON_SKU_CODE,
      description: 'Vendor AI — AI Chatbot (28-day)',
      requested_total_php: pricePhp,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the Vendor AI order. Please try again.');
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
    return err('Could not start the Vendor AI payment. Please try again.');
  }

  revalidatePath('/vendor-dashboard/subscription');
  return {
    status: 'ordered',
    referenceCode,
    amountPhp: pricePhp,
    message: `Order started. Pay ₱${pricePhp.toLocaleString('en-PH')} with reference ${referenceCode} — Vendor AI switches on once our team confirms your payment (within 24 hours).`,
  };
}
