import type { SupabaseClient } from '@supabase/supabase-js';
import { appendLedger } from '@/lib/ledger';
import { activateConcierge } from '@/app/dashboard/(account)/profile/concierge/actions';
import { branchIdFromServiceKey } from '@/lib/vendor-branches';
import {
  seatServiceKey,
  vendorProfileIdFromSeatServiceKey,
} from '@/lib/vendor-seats';
import { BUNDLE_CHILD_SKUS, eventSkuActive } from '@/lib/entitlements';
import { provisionPapicSeatsAdmin } from '@/lib/papic-seats';
import {
  AI_SUB_SKU,
  cyclesFromAmount,
  extendUserAiSubscription,
} from '@/lib/setnayan-ai-subscription';

/**
 * apps/web/lib/sku-activation.ts
 *
 * Per-SKU activation dispatcher. After admin approvePayment flips an order to
 * 'paid', SOME SKUs need a side effect to actually unlock the capability
 * (Setnayan AI boolean, concierge state machine, vendor branch flag, Papic seat
 * provisioning, and — PR4 — Custom-QR seat-pass QR publication). MOST SKUs need
 * nothing: ownership is read straight off orders.status by checkOrderOwnership(),
 * so their entry is a no-op.
 *
 * CONTRACT (do not break):
 *   • Every hook is NON-FATAL. activateOrderSku NEVER throws. The order is
 *     already 'paid' + payment 'matched' before this runs; a failed activation
 *     leaves a recoverable state (admin re-runs / flips the row manually) but
 *     MUST NOT roll back the approval.
 *   • Hooks are idempotent (re-running on a re-approved order is safe).
 *   • The dispatcher map is Object.frozen — new hooks (e.g. PR4's CUSTOM_QR_GUEST
 *     seat-pass gating SKU) are added by editing THIS file's map, never approvePayment.
 *   • Default (unmatched service_key) = no-op. New couple SKUs activate purely
 *     via orders.status with no entry here.
 */

export type ActivationContext = {
  admin: SupabaseClient;
  orderId: string;
  eventId: string | null;
  serviceKey: string;
  actorUserId: string;
};

type ActivationHook = (ctx: ActivationContext) => Promise<void>;

// Exact-match hooks keyed by literal service_key.
const EXACT_HOOKS: Readonly<Record<string, ActivationHook>> = Object.freeze({
  // 'concierge_complete' (TODAYS_FOCUS) → wedding-anchored concierge state machine.
  concierge_complete: async (ctx) => {
    if (!ctx.eventId) return;
    const result = await activateConcierge({
      eventId: ctx.eventId,
      orderId: ctx.orderId,
    });
    if (result.status === 'activated') {
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: {
          service_key: ctx.serviceKey,
          event_id: ctx.eventId,
          concierge_expires_at: result.expiresAt ?? null,
        },
      });
    } else {
      console.warn('[sku-activation] concierge activation blocked by enforcement:', {
        order_id: ctx.orderId,
        event_id: ctx.eventId,
      });
    }
  },

  // 'SETNAYAN_AI' → flat per-event boolean, idempotent.
  //
  // SETNAYAN_AI is now a ₱499 / 28-day subscription (owner 2026-06-29; was a
  // ₱3,999 one-time unlock). For V1 the entitlement model is UNCHANGED: one
  // approved order flips this per-event flag and the planner is on for the
  // wedding. Pricing.md / migration 20270322883953 only changed the price +
  // the recurrence UNIT; the activation contract is the same boolean.
  //
  // V1.5: a recurring per-28-day charge (until the wedding day, then auto-end)
  // hooks in HERE. On approval, stamp the per-user window
  // `user_ai_subscription.active_until` anchored to events.event_date (the
  // wedding-anchor rule — recorded on that column's comment), gated by
  // platform_settings.setnayan_ai_per_user_enabled (default OFF, foundation in
  // PR #2407), then schedule the next-cycle charge via the provider-run
  // subscription (PayMongo / GCash). Until then the couple pays one term up
  // front via the manual apply-then-pay rails and this boolean is the gate.
  SETNAYAN_AI: async (ctx) => {
    if (!ctx.eventId) return;
    const { error } = await ctx.admin
      .from('events')
      .update({ setnayan_ai_active: true })
      .eq('event_id', ctx.eventId);
    // Surface a write failure so activateOrderSku's outer catch logs it —
    // otherwise the paid AI silently never provisions with no retry signal.
    // Throwing is safe: the order is already 'paid', the dispatcher swallows +
    // logs and never rolls back the approval.
    if (error) throw new Error(`SETNAYAN_AI activation write failed: ${error.message}`);
  },

  // 'SETNAYAN_AI_SUB' → per-USER subscription term pass (₱499 / 28-day cycle,
  // owner 2026-06-29). Extends the BUYER's user_ai_subscription window by
  // (paid amount ÷ admin unit price) cycles × 28 days, fanning AI out to all
  // their events. Idempotent two ways: a prior 'service_activated' ledger row
  // for this order, OR the window already carrying this order as last_order_id —
  // either short-circuits so a re-approval never double-grants. INERT while the
  // per-user flag is off (the gate ignores the window), but the grant records
  // safely regardless. Throws only on the write so the dispatcher logs + retries.
  [AI_SUB_SKU]: async (ctx) => {
    // (1) Idempotency — already activated this order?
    const { data: priorLedger } = await ctx.admin
      .from('order_ledger')
      .select('order_id')
      .eq('order_id', ctx.orderId)
      .eq('event_type', 'service_activated')
      .limit(1)
      .maybeSingle();
    if (priorLedger) return;

    // (2) Buyer + paid amount off the order.
    const { data: order } = await ctx.admin
      .from('orders')
      .select('user_id, confirmed_total_php, requested_total_php')
      .eq('order_id', ctx.orderId)
      .maybeSingle();
    if (!order?.user_id) return;
    const amountPhp = Number(order.confirmed_total_php ?? order.requested_total_php ?? 0);

    // (3) Admin-managed unit price (single source = the catalog).
    const { data: sku } = await ctx.admin
      .from('platform_retail_catalog_v2')
      .select('retail_price_php')
      .eq('service_code', AI_SUB_SKU)
      .maybeSingle();
    const cycles = cyclesFromAmount(amountPhp, sku?.retail_price_php ?? null);
    if (cycles <= 0) return;

    // (4) Current window (one row per user) → extend, with a second idempotency
    // guard for the upsert-succeeded-but-ledger-failed retry case.
    const { data: existing } = await ctx.admin
      .from('user_ai_subscription')
      .select('active_until, last_order_id')
      .eq('user_id', order.user_id)
      .maybeSingle();
    if (existing?.last_order_id === ctx.orderId) return;
    const newUntil = extendUserAiSubscription(
      existing?.active_until ?? null,
      cycles,
      new Date(),
    );

    const { error } = await ctx.admin.from('user_ai_subscription').upsert(
      {
        user_id: order.user_id,
        active_until: newUntil.toISOString(),
        source: 'paid',
        last_order_id: ctx.orderId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      throw new Error(`SETNAYAN_AI_SUB activation write failed: ${error.message}`);
    }

    await appendLedger(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'service_activated',
      actor_user_id: ctx.actorUserId,
      actor_role: 'admin',
      metadata: { service_key: ctx.serviceKey, cycles, active_until: newUntil.toISOString() },
    });
  },

  // 'PAPIC_SEATS' → paid Papic upgrade. Ownership reads off orders.status (no
  // stored unlock flag). On approval the hook PROVISIONS the 5 paparazzi seats
  // so the feature is READY with no manual "Set up your seats" step (owner-locked:
  // the approval IS the activation). provisionPapicSeatsAdmin is idempotent
  // (top-up of missing indexes only) so re-approval / a couple who already
  // self-served via /crew is safe. Best-effort (never throws). Also fires for
  // bundle buyers via activateBundleChildren (Papic is a MEDIA_PACK child).
  PAPIC_SEATS: async (ctx) => {
    if (!ctx.eventId) return;
    const eventId = ctx.eventId;
    // Materialize the seats — the no-manual-step half of the feature.
    try {
      await provisionPapicSeatsAdmin(ctx.admin, eventId);
    } catch (e) {
      console.error('[sku-activation] PAPIC_SEATS seat provisioning threw (non-fatal):', e);
    }
  },

  // Seat-pass activation (seat-finding PR4). The seat pass (/[slug]/seat)
  // resolves + gates on CUSTOM_QR_GUEST — the SKU whose branded per-guest /
  // per-table QR codes point at the pass — so the hook binds to CUSTOM_QR_GUEST
  // (distinct from PAPIC_SEATS above, the already-'live' photo-crew SKU). When a
  // CUSTOM_QR_GUEST order is approved, ensure every table for the event has its
  // QR sheet marked published so the printed Custom-QR sheet + the table-QR
  // resolver work immediately. Idempotent + defensive: event_tables.qr_token
  // already default-exists from row creation (migration 20261101000000), so this
  // is a published-at STAMP, not a destructive reset — it touches only rows still
  // NULL. NEVER throws (dispatcher contract).
  CUSTOM_QR_GUEST: async (ctx) => {
    if (!ctx.eventId) return;
    // event_tables.qr_token already has a NOT NULL DEFAULT token; this only
    // stamps qr_published_at so the table-QR resolver knows the sheet is live.
    // No row mutation if already set.
    await ctx.admin
      .from('event_tables')
      .update({ qr_published_at: new Date().toISOString() })
      .eq('event_id', ctx.eventId)
      .is('qr_published_at', null);
    await appendLedger(ctx.admin, {
      order_id: ctx.orderId,
      event_type: 'service_activated',
      actor_user_id: ctx.actorUserId,
      actor_role: 'admin',
      metadata: { service_key: ctx.serviceKey, event_id: ctx.eventId },
    });
  },

  // Bundle activation (bundle-buyer dead-flag repair) — fan the bundle's
  // children through their own hooks. See activateBundleChildren below.
  GUIDED_PACK: (ctx) => activateBundleChildren(ctx),
  MEDIA_PACK: (ctx) => activateBundleChildren(ctx),
});

/**
 * Fan a freshly-approved BUNDLE order (GUIDED_PACK / MEDIA_PACK) through each of
 * its child SKUs' activation hooks. WHY: a bundle purchase lands as a SINGLE
 * orders row keyed by the bundle code — it never decomposes into per-child
 * orders (app/dashboard/[eventId]/studio/bundle/page.tsx). activateOrderSku
 * dispatches on the literal service_key, so a child whose capability depends on
 * a STORED side-effect flag (today only SETNAYAN_AI → events.setnayan_ai_active)
 * would never activate for a bundle buyer. Children whose ownership is read
 * straight off orders.status (monogram, custom-QR, papic, …) need no hook here —
 * their gates already read the bundle order via eventOwnsSku(). Membership comes
 * from BUNDLE_CHILD_SKUS (the read-side mirror) so this can't drift from the
 * gate. Idempotent (child hooks are idempotent); a child with no hook is
 * skipped; bundle codes are never children, so there is no recursion.
 */
async function activateBundleChildren(ctx: ActivationContext): Promise<void> {
  const children =
    BUNDLE_CHILD_SKUS[ctx.serviceKey as keyof typeof BUNDLE_CHILD_SKUS];
  if (!children) return;
  for (const child of children) {
    const childHook = EXACT_HOOKS[child];
    if (!childHook) continue;
    try {
      await childHook({ ...ctx, serviceKey: child });
    } catch (e) {
      // Fault-isolate each child: one failing hook must not starve its siblings
      // (e.g. a SETNAYAN_AI write error must not stop PAPIC_SEATS seat
      // provisioning from running). Honors the file's "every hook is non-fatal"
      // contract; the dispatcher's outer catch would otherwise abort the rest.
      console.error(
        `[sku-activation] bundle child ${child} of ${ctx.serviceKey} threw (non-fatal):`,
        e,
      );
    }
  }
}

// Prefix/predicate hooks for dynamic-suffix service_keys (e.g. branch ids).
const PREFIX_HOOKS: ReadonlyArray<{
  match: (serviceKey: string) => boolean;
  run: ActivationHook;
}> = Object.freeze([
  {
    // 'vendor_additional_branch__{branch_id}' → flip branch active + stamp 28d period.
    match: (serviceKey) => branchIdFromServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const branchId = branchIdFromServiceKey(ctx.serviceKey);
      if (!branchId) return;
      const expiresAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
      await ctx.admin
        .from('vendor_branches')
        .update({ branch_subscription_active: true, cancelled_at: null })
        .eq('branch_id', branchId);
      await ctx.admin
        .from('orders')
        .update({ expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq('order_id', ctx.orderId);
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: { service_key: ctx.serviceKey, branch_id: branchId },
      });
    },
  },
  {
    // 'vendor_extra_seat__{vendor_profile_id}' → recompute the vendor's paid
    // extra-seat count (Enterprise ₱500/28d add-on, owner 2026-07-02). Unlike
    // the branch flag, seats are a COUNT — so rather than a non-idempotent
    // increment, RECOMPUTE extra_agent_seats = the number of PAID
    // vendor_extra_seat orders for this vendor (the current order is already
    // 'paid' before this runs). Idempotent + self-healing on re-approval and
    // safe against a mid-hook crash (no double-count). The count folds into the
    // Enterprise renewal amount in PR-B; here it just makes the seat usable.
    match: (serviceKey) => vendorProfileIdFromSeatServiceKey(serviceKey) !== null,
    run: async (ctx) => {
      const vendorProfileId = vendorProfileIdFromSeatServiceKey(ctx.serviceKey);
      if (!vendorProfileId) return;
      const { count } = await ctx.admin
        .from('orders')
        .select('order_id', { count: 'exact', head: true })
        .eq('service_key', seatServiceKey(vendorProfileId))
        .eq('status', 'paid');
      const paidSeats = Math.max(count ?? 0, 0);
      const { error } = await ctx.admin
        .from('vendor_profiles')
        .update({ extra_agent_seats: paidSeats })
        .eq('vendor_profile_id', vendorProfileId);
      if (error) {
        throw new Error(`vendor_extra_seat activation write failed: ${error.message}`);
      }
      await appendLedger(ctx.admin, {
        order_id: ctx.orderId,
        event_type: 'service_activated',
        actor_user_id: ctx.actorUserId,
        actor_role: 'admin',
        metadata: {
          service_key: ctx.serviceKey,
          vendor_profile_id: vendorProfileId,
          extra_agent_seats: paidSeats,
        },
      });
    },
  },
]);

/**
 * Run the activation hook (if any) for a freshly-paid order. NEVER throws —
 * each hook is wrapped; failures are logged and swallowed so the parent
 * approval flow completes. No-op for any service_key without a registered hook.
 */
export async function activateOrderSku(ctx: ActivationContext): Promise<void> {
  const exact = EXACT_HOOKS[ctx.serviceKey];
  const hook = exact ?? PREFIX_HOOKS.find((h) => h.match(ctx.serviceKey))?.run;
  if (!hook) return; // default no-op
  try {
    await hook(ctx);
  } catch (e) {
    console.error(`[sku-activation] hook for ${ctx.serviceKey} threw (non-fatal):`, e);
  }
}

// ===========================================================================
// Deactivation (revoke-on-reversal) — the inverse of activation.
// ===========================================================================
//
// WHY: SETNAYAN_AI's capability is read from a STORED flag
// (events.setnayan_ai_active) rather than live off orders.status, so unlike the
// orders-backed gates (monogram / custom-QR / papic / website — which re-lock
// for free when their order flips to cancelled/refunded), the flag is a one-way
// latch: activation stamps it true and nothing ever cleared it. A full refund
// (or reject) of the SETNAYAN_AI order — direct OR the bundle that granted it —
// left the paid AI capability live forever ("refund the money, keep the AI").
// This closes that on the reversal side, symmetric to activateOrderSku.

/**
 * Re-derive events.setnayan_ai_active from the CURRENT order state and clear it
 * if the event no longer owns SETNAYAN_AI by ANY live order. Re-derive (not
 * blind-clear) because the couple may still own it via another order — a second
 * à-la-carte buy, or another bundle that also grants it. eventOwnsSku() is
 * bundle-aware + refund-aware and reads the post-flip state (the reversed order
 * is already out of the owned set), so it returns false only when truly unowned.
 * Uses the admin client (RLS-bypassed) so it sees every order for the event.
 */
async function deactivateSetnayanAiIfUnowned(ctx: ActivationContext): Promise<void> {
  if (!ctx.eventId) return;
  if (await eventSkuActive(ctx.admin, ctx.eventId, 'SETNAYAN_AI')) return; // still owned → keep
  const { error } = await ctx.admin
    .from('events')
    .update({ setnayan_ai_active: false })
    .eq('event_id', ctx.eventId);
  if (error) throw new Error(`SETNAYAN_AI deactivation write failed: ${error.message}`);
}

/**
 * Reverse the flag-backed side effects of an order that was just REVERSED
 * (rejectPayment → cancelled · refundOrder → refunded). NEVER throws (wrapped +
 * logged), symmetric to activateOrderSku. MUST be called AFTER the order's
 * status flip is committed so the re-derivation sees the new state.
 *
 * Only entitlements with a STORED flag need reversing — today just SETNAYAN_AI.
 * PAPIC_SEATS' activation (seat provisioning) is orders-backed and needs no
 * reversal. Orders-backed gates need
 * nothing here. Fires for a direct SETNAYAN_AI reversal OR a bundle reversal
 * (the bundle that granted it).
 */
export async function deactivateOrderSku(ctx: ActivationContext): Promise<void> {
  const grantsAi =
    ctx.serviceKey === 'SETNAYAN_AI' ||
    (BUNDLE_CHILD_SKUS[ctx.serviceKey as keyof typeof BUNDLE_CHILD_SKUS]?.includes(
      'SETNAYAN_AI',
    ) ??
      false);
  if (!grantsAi) return;
  try {
    await deactivateSetnayanAiIfUnowned(ctx);
  } catch (e) {
    console.error(`[sku-activation] deactivation for ${ctx.serviceKey} threw (non-fatal):`, e);
  }
}
