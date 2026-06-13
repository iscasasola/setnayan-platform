import type { SupabaseClient } from '@supabase/supabase-js';
import { appendLedger } from '@/lib/ledger';
import { activateConcierge } from '@/app/dashboard/profile/concierge/actions';
import { branchIdFromServiceKey } from '@/lib/vendor-branches';

/**
 * apps/web/lib/sku-activation.ts
 *
 * Per-SKU activation dispatcher. After admin approvePayment flips an order to
 * 'paid', SOME SKUs need a side effect to actually unlock the capability
 * (Setnayan AI boolean, concierge state machine, vendor branch flag, and — PR4
 * — Papic seat-pass provisioning). MOST SKUs need nothing: ownership is read
 * straight off orders.status by checkOrderOwnership(), so their entry is a no-op.
 *
 * CONTRACT (do not break):
 *   • Every hook is NON-FATAL. activateOrderSku NEVER throws. The order is
 *     already 'paid' + payment 'matched' before this runs; a failed activation
 *     leaves a recoverable state (admin re-runs / flips the row manually) but
 *     MUST NOT roll back the approval.
 *   • Hooks are idempotent (re-running on a re-approved order is safe).
 *   • The dispatcher map is Object.frozen — PR4 adds PAPIC_SEATS by editing
 *     THIS file's map, never approvePayment.
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
    await ctx.admin
      .from('events')
      .update({ setnayan_ai_active: true })
      .eq('event_id', ctx.eventId);
  },

  // PR4 will register: PAPIC_SEATS: async (ctx) => { /* seat-pass provisioning */ },
});

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
