'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { payPath } from '@/lib/pay-path';
import { railForNewOrder } from '@/lib/rail-for-new-order';
import { PAYMENTS_PAUSED_MESSAGE } from '@/lib/payment-channels';
import { createClient } from '@/lib/supabase/server';
import { createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor, paymentRowFor } from '@/lib/order-mint-identity';
import { vendorAddonSkuCode } from '@/lib/vendor-addon-tier-pricing';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { deepSearchAiConfigured } from '@/lib/vendor-deep-search';
import {
  VENDOR_DEEP_SEARCH_SKU_CODE,
  deepSearchEligibility,
  resolveDeepSearchPricePhp,
  DEEP_SEARCH_DENY_MESSAGE,
} from '@/lib/vendor-deep-search-addon';

/**
 * Deep Search (vendor-facing) — buy ONE web-research deep search on the vendor's OWN business; it runs on payment
 * approval and its "What We Learned" review auto-fills their profile. Owner-locked 2026-07-22, repriced 2026-11-09
 * (DECISION_LOG 🔎💳 "DEEP SEARCH = ₱499, ONE USE, EVERY PLAN — NO FREE SEARCH ON PRO/ULTRA"): ONE catalogue price on
 * every plan, ONE search per purchase, and ⛔ NO free search — the Pro/Ultra "1 free per 28-day cycle" path (its
 * atomic `was_free` claim and the instant free run) was removed with it.
 *
 * ── WHY the gate + price re-check is HERE, server-side ──────────────────────
 * Nothing else gates a vendor add-on on the orders spine. This action is the ONLY gate: it rejects — BEFORE pricing —
 * an unverified shop (and, while the paywall switch is on, a plan below Solo), then re-reads the authoritative price +
 * the SKU's is_active flag from vendor_billing_catalog. The client sends only the pay channel — never a price.
 *
 * ONE path: apply-then-pay — a 'submitted' order + a pending 'payments' row that lands in /admin/payments. On admin
 * approval, the sku-activation hook ('vendor_deep_search') RUNS the one search, stores the dossier, and records it
 * (was_free=false) — pay-then-run, one order = one search.
 */

export type VendorDeepSearchActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** Paid search — an apply-then-pay order was created; runs on admin approval. */
  | { status: 'ordered'; referenceCode: string; amountPhp: number; message: string };

function err(message: string): VendorDeepSearchActionState {
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


const DEEP_SEARCH_PAGE = '/vendor-dashboard/deep-search';

export async function runVendorDeepSearch(
  _prev: VendorDeepSearchActionState,
  formData: FormData,
): Promise<VendorDeepSearchActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // DPO gate — Deep Search is a privacy-sensitive flow (AI web-research over
  // public sources + dossier storage). Fail-closed until the owner approves it
  // at /admin/data-privacy, so it never runs (or charges) while undisclosed.
  if (!(await isDataPrivacyControlActive('vendor_deep_search'))) {
    return err('Deep Search isn’t available yet — it’s pending a privacy review.');
  }

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return err('No supplier profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scope the role check to THIS vendor profile (not the user's global-highest
  // role) so an agent/viewer on this shop can't spend on Deep Search via a role
  // they hold on some other vendor.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can run Deep Search.');
  }

  // ── Tier + verification gate (BEFORE pricing) ──────────────────────────────
  // tier_state / verification_state are not in
  // FULL_VENDOR_PROFILE_SELECT — soft probe them together.
  const { data: gateRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (gateRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const verification =
    (gateRow as { verification_state?: string | null } | null)?.verification_state ?? null;

  // The paid-plan requirement is asked through the one flag-aware question —
  // here, at the final action (Run), and only while the switch is on.
  const eligibility = deepSearchEligibility({
    tier,
    verification,
    tierPaywall: vendorPaywallApplies(isTierAtLeast(tier, 'solo')),
  });
  if (!eligibility.ok) {
    return err(DEEP_SEARCH_DENY_MESSAGE[eligibility.reason]);
  }

  // ── The price decision ─────────────────────────────────────────────────────
  // Re-read the authoritative price + is_active from the admin-managed catalog — the ONE row on every plan (owner
  // 2026-11-09). A retired row (is_active=false) blocks the sale. The ORDER carries `VENDOR_DEEP_SEARCH_SKU_CODE`.
  const { data: skuRow } = await supabase
    .from('vendor_billing_catalog')
    .select('price_php, is_active')
    .eq('sku_code', vendorAddonSkuCode('deep_search_about_you', tier))
    .maybeSingle();
  if (skuRow && (skuRow as { is_active?: boolean | null }).is_active === false) {
    return err('Deep Search is temporarily unavailable. Please try again later.');
  }
  const cyclePricePhp = skuRow ? Number((skuRow as { price_php: number | string }).price_php) : null;
  const pricePhp = resolveDeepSearchPricePhp({ cyclePricePhp });

  // ── apply-then-pay (runs on admin approval) ─────────────────────────────────
  // Without the AI research engine (ANTHROPIC_API_KEY unset) a run silently
  // degrades to the keyless Lite pass — so a paid charge would buy nothing worth
  // paying for. Block the SALE. No order is created, so nothing is charged.
  if (!deepSearchAiConfigured()) {
    return err(
      'Deep Search is temporarily unavailable — the research engine is offline. You won’t be charged.',
    );
  }

  // The rail kill switch (lib/rail-for-new-order.ts): never mint an order
  // nobody can pay into.
  const channel = await railForNewOrder(supabase, formData.get('channel'));
  if (!channel) return err(PAYMENTS_PAUSED_MESSAGE);
  const referenceCode = generateReferenceCode();

  // ── SEC-4b · service-role mint ─────────────────────────────────────────────
  // `orders` + `payments` INSERT are revoked from `authenticated` (migration
  // 20271008178212). service_role bypasses `orders_owner_write`'s
  // `WITH CHECK (user_id = auth.uid())`, which was RLS's only contribution here
  // — it never validated vendorProfileId, tier, verification or the allowance.
  //
  // AUTHORIZATION IS UNCHANGED and is the strongest of the converted set:
  // authenticated → `isDataPrivacyControlActive('vendor_deep_search')` (DPO
  // gate, fail-closed) → `fetchOwnVendorProfile` (server-resolved id) →
  // `resolveVendorRoleForProfile` + canManageVendor (PROFILE-scoped, so a role
  // held on another shop does not count) → `deepSearchEligibility` on a fresh
  // tier/verification read → the SKU is_active reject → `deepSearchAiConfigured`.
  const { data: orderRow, error: oErr } = await createMoneyWriterClient()
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId: null, vendorProfileId },
        {
          service_key: VENDOR_DEEP_SEARCH_SKU_CODE,
          description: 'Deep Search (per search)',
          requested_total_php: pricePhp,
          status: 'submitted',
          reference_code: referenceCode,
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the Deep Search order. Please try again.');
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
    return err('Could not start the Deep Search payment. Please try again.');
  }

  revalidatePath(DEEP_SEARCH_PAGE);
  // The ONE payment page (owner 2026-08-21): the amount rides inside the QR,
  // and it is the only screen that can take the screenshot and the reference.
  // The old panel just quoted a code and left them to work the rest out.
  redirect(payPath(referenceCode));
}
