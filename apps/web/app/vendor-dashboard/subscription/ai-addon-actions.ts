'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { appendLedger } from '@/lib/ledger';
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

  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can manage the Vendor AI add-on.');
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
  const cyclePricePhp =
    skuRow && (skuRow as { is_active?: boolean | null }).is_active !== false
      ? Number((skuRow as { price_php: number | string }).price_php)
      : null;
  const pricePhp = resolveVendorAiAddonPricePhp({ trialUsed, cyclePricePhp });

  // ── FREE first cycle → atomic claim + direct activation ────────────────────
  if (pricePhp <= 0) {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();
    const newExpiry = nextVendorAiAddonExpiry(null, Date.now());

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
      return err('Your free cycle was just used. Refresh to buy the next cycle (₱1,500 / 28 days).');
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
        description: 'Vendor AI — AI Chatbot (first cycle · free)',
        requested_total_php: 0,
        confirmed_total_php: 0,
        status: 'paid',
        reference_code: referenceCode,
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
          kind: 'ai_addon_free_first_cycle',
          expires_at: newExpiry,
        },
      });
    }

    revalidatePath('/vendor-dashboard/subscription');
    revalidatePath('/vendor-dashboard/shop');
    return {
      status: 'activated',
      message:
        'Vendor AI is on — your free first 28-day cycle is active. After it ends, it’s ₱1,500 / 28 days.',
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
