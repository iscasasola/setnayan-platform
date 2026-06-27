import type { SupabaseClient } from '@supabase/supabase-js';
import { appendLedger } from '@/lib/ledger';
import { activateConcierge } from '@/app/dashboard/(account)/profile/concierge/actions';
import { branchIdFromServiceKey } from '@/lib/vendor-branches';
import { BUNDLE_CHILD_SKUS, eventSkuActive } from '@/lib/entitlements';
import { provisionPapicSeatsAdmin } from '@/lib/papic-seats';

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
