'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { deepSearchAiConfigured, type VendorDossier } from '@/lib/vendor-deep-search';
import {
  runAndRecordVendorDeepSearch,
  buildVendorDeepSearchInputs,
} from '@/lib/vendor-deep-search-run';
import {
  VENDOR_DEEP_SEARCH_SKU_CODE,
  deepSearchEligibility,
  deepSearchCycleStartMs,
  countDeepSearchUsesSince,
  resolveDeepSearchPricePhp,
  DEEP_SEARCH_DENY_MESSAGE,
} from '@/lib/vendor-deep-search-addon';

/**
 * Deep Search (vendor-facing) — run the web-research deep search on the vendor's
 * OWN business and return the "What We Learned" review to auto-fill their
 * profile. Owner-locked 2026-07-22: ₱500 / search, PAID tiers (Solo+) + verified;
 * Pro/Enterprise/Custom get 1 free per 28-day cycle, Solo always pays.
 *
 * ── WHY the gate + price re-check is HERE, server-side ──────────────────────
 * Nothing else gates a vendor add-on on the orders spine. This action is the
 * ONLY gate: it rejects — BEFORE pricing — a free/verified tier or an unverified
 * shop, then COUNTS the vendor's own uses since the current 28-day cycle start
 * (admin-read for authority) and re-reads the ₱500 authoritative price + the
 * SKU's is_active flag from vendor_billing_catalog (mirrors the AI-addon /
 * Photo-Challenge actions). The client sends only the pay channel — never a
 * price and never the free/paid decision.
 *
 * TWO paths, one action (recurring billing is UNBUILT, so this is the cleanest
 * split):
 *   • FREE search (resolved price ₱0 · Pro+ with 0 uses this cycle) → RUN NOW,
 *     record was_free=true, return the dossier. Nothing to pay.
 *   • PAID search (₱500 · Solo, or a Pro+ vendor's 2nd+ run this cycle) →
 *     apply-then-pay: a 'submitted' order + a pending 'payments' row that lands
 *     in /admin/payments. On admin approval, the sku-activation hook
 *     ('vendor_deep_search') RUNS the search, stores the dossier, and records
 *     was_free=false — pay-then-run, because there is no credit ledger to draw a
 *     pre-paid run from yet.
 */

export type VendorDeepSearchActionState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** Free search ran instantly — the dossier is ready to review now. */
  | { status: 'ran'; dossier: VendorDossier; wasFree: boolean; message: string }
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

function parseChannel(raw: FormDataEntryValue | null): 'bdo' | 'gcash' {
  return String(raw ?? '').trim() === 'gcash' ? 'gcash' : 'bdo';
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
  if (!profile) return err('No vendor profile found.');
  const vendorProfileId = profile.vendor_profile_id;

  // Scope the role check to THIS vendor profile (not the user's global-highest
  // role) so an agent/viewer on this shop can't spend on Deep Search via a role
  // they hold on some other vendor.
  const role = await resolveVendorRoleForProfile(supabase, user.id, vendorProfileId);
  if (!canManageVendor(role)) {
    return err('Only the owner or an admin can run Deep Search.');
  }

  // ── Tier + verification gate (BEFORE pricing) ──────────────────────────────
  // tier_state / tier_expires_at / verification_state are not in
  // FULL_VENDOR_PROFILE_SELECT — soft probe them together.
  const { data: gateRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at, verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (gateRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const tierExpiresAt =
    (gateRow as { tier_expires_at?: string | null } | null)?.tier_expires_at ?? null;
  const verification =
    (gateRow as { verification_state?: string | null } | null)?.verification_state ?? null;

  const eligibility = deepSearchEligibility({ tier, verification });
  if (!eligibility.ok) {
    return err(DEEP_SEARCH_DENY_MESSAGE[eligibility.reason]);
  }

  // ── Allowance count → the price decision (admin-read for authority) ─────────
  const admin = createAdminClient();
  const cycleStartIso = new Date(deepSearchCycleStartMs(tierExpiresAt, Date.now())).toISOString();
  const usesThisCycle = await countDeepSearchUsesSince(admin, vendorProfileId, cycleStartIso);

  // Re-read the authoritative ₱500 price + is_active from the admin-managed
  // catalog (mirrors the AI-addon is_active guard). A retired SKU (row exists,
  // is_active=false) blocks the sale; a missing row falls back to ₱500.
  const { data: skuRow } = await supabase
    .from('vendor_billing_catalog')
    .select('price_php, is_active')
    .eq('sku_code', VENDOR_DEEP_SEARCH_SKU_CODE)
    .maybeSingle();
  if (skuRow && (skuRow as { is_active?: boolean | null }).is_active === false) {
    return err('Deep Search is temporarily unavailable. Please try again later.');
  }
  const cyclePricePhp =
    skuRow && (skuRow as { is_active?: boolean | null }).is_active !== false
      ? Number((skuRow as { price_php: number | string }).price_php)
      : null;
  let pricePhp = resolveDeepSearchPricePhp({ tier, usesThisCycle, cyclePricePhp });

  const inputs = buildVendorDeepSearchInputs({
    business_name: profile.business_name,
    website: profile.website ?? null,
    location_city: profile.location_city ?? null,
    services: profile.services ?? [],
    gallery_video_links: profile.gallery_video_links ?? [],
  });

  // ── FREE search → ATOMICALLY CLAIM the allowance, THEN run ──────────────────
  // The old flow was read-decide-run: count uses → ₱0 → run → write the usage row
  // AFTER. Concurrent requests all read 0 uses and all ran free. Now we CLAIM the
  // one free run per cycle BEFORE running: the partial unique index
  // (vendor_profile_id, free_cycle_start) WHERE was_free serializes a burst —
  // exactly one INSERT wins, the rest hit a unique violation and fall through to
  // the paid ₱500 path. Matches the AI/booth add-ons' atomic trial claims.
  if (pricePhp <= 0) {
    const { data: claimRow, error: claimErr } = await admin
      .from('vendor_deep_search_uses')
      .insert({
        vendor_profile_id: vendorProfileId,
        was_free: true,
        free_cycle_start: cycleStartIso,
        order_id: null,
        dossier_id: null,
      })
      .select('id')
      .maybeSingle();

    if (!claimErr && claimRow) {
      // Won the claim → run the free search against this pre-claimed usage row.
      const claimUseId = (claimRow as { id: number }).id;
      const result = await runAndRecordVendorDeepSearch({
        admin,
        vendorProfileId,
        requestedByUserId: user.id,
        inputs,
        wasFree: true,
        orderId: null,
        claimUseId,
      });
      if (result.status === 'failed') {
        // Roll the claim back so a retry still gets this cycle's free run — a
        // failed run must never burn the allowance.
        await admin.from('vendor_deep_search_uses').delete().eq('id', claimUseId);
        return err(result.error);
      }
      revalidatePath(DEEP_SEARCH_PAGE);
      return {
        status: 'ran',
        dossier: result.dossier,
        wasFree: true,
        message: 'Deep Search finished — review what we learned and apply it to your profile.',
      };
    }

    // Lost the claim (unique violation) or a transient insert error → the free run
    // for this cycle is gone. FAIL TOWARD CHARGING: re-price to the paid ₱500 and
    // continue to apply-then-pay (never hand out a second free run).
    pricePhp = resolveDeepSearchPricePhp({
      tier,
      usesThisCycle: usesThisCycle + 1,
      cyclePricePhp,
    });
  }

  // ── PAID search → apply-then-pay (runs on admin approval) ───────────────────
  // Without the AI research engine (ANTHROPIC_API_KEY unset) a run silently
  // degrades to the free keyless Lite pass — so a paid ₱500 charge would buy
  // nothing the free tier doesn't already get. Block the SALE (the free Lite path
  // above still works at ₱0). No order is created, so nothing is charged.
  if (!deepSearchAiConfigured()) {
    return err(
      'Deep Search is temporarily unavailable — the research engine is offline. You won’t be charged.',
    );
  }

  const channel = parseChannel(formData.get('channel'));
  const referenceCode = generateReferenceCode();

  const { data: orderRow, error: oErr } = await supabase
    .from('orders')
    .insert({
      event_id: null,
      user_id: user.id,
      vendor_profile_id: vendorProfileId,
      service_key: VENDOR_DEEP_SEARCH_SKU_CODE,
      description: 'Deep Search (per search)',
      requested_total_php: pricePhp,
      status: 'submitted',
      reference_code: referenceCode,
    })
    .select('order_id')
    .maybeSingle();
  if (oErr || !orderRow) {
    return err('Could not start the Deep Search order. Please try again.');
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
    return err('Could not start the Deep Search payment. Please try again.');
  }

  revalidatePath(DEEP_SEARCH_PAGE);
  return {
    status: 'ordered',
    referenceCode,
    amountPhp: pricePhp,
    message: `Order started. Pay ₱${pricePhp.toLocaleString('en-PH')} with reference ${referenceCode} — your Deep Search runs once our team confirms your payment (within 24 hours).`,
  };
}
