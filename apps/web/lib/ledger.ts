/**
 * apps/web/lib/ledger.ts
 *
 * Canonical append-only helper for the `public.order_ledger` table.
 *
 * WHY · Day 2 of the 4-day pre-pilot voucher + inline-checkout sprint
 *       (CLAUDE.md 2026-05-29 Day 2 row · V1 SCOPE EXPANSION approved
 *       by owner · pilot 2026-06-01 in 4 days). Day 1.5 migration
 *       20260529020000_voucher_system_day1_5_spec_alignment.sql introduced
 *       the `order_ledger` immutable audit table; this is the only sanctioned
 *       write path. Every transition in the orders state machine
 *       (CHECKOUT → PENDING_PAYMENT → PENDING_APPROVAL → APPROVED →
 *        ACTIVE → COMPLETED · REJECTED · REFUNDED) appends one row.
 *
 *       The table has `REVOKE UPDATE, DELETE, TRUNCATE` from authenticated
 *       (migration line 220) so this helper is the structural guarantee
 *       that writes only flow forward.
 *
 * Best-effort semantics: the ledger is an audit trail, NOT the source of
 * truth for the order itself. If the insert fails (e.g. transient DB
 * error · RLS misconfig · network blip), we log + return — we NEVER throw
 * back up the call chain because that would block the parent mutation
 * (createOrder · approvePayment · etc) from completing. Operational
 * audit gaps are recoverable; blocking a couple's order submit during
 * pilot is not.
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-29 Day 2 row (this work)
 *   • PR #594 · PR #595 (Day 1 + Day 1.5 schema substrate)
 *   • supabase/migrations/20260529020000_voucher_system_day1_5_spec_alignment.sql
 *     (order_ledger table + 8 event_type values + RLS policies)
 *   • iteration 0023 § 9.1 admin discipline (admin_audit_log per mutation)
 *   • Canonical "best-effort log" pattern: apps/web/lib/email.ts sendEmail
 *     swallow-and-log behaviour from CLAUDE.md 2026-05-28 row 14 RED #2
 *
 * NOTE on actor_role: must be one of 'couple' | 'admin' | 'system' per
 * the migration CHECK constraint. 'system' is reserved for cron-style
 * sweeps + automated triggers (none on this code path yet). Day 2
 * server actions are all couple-side · admin-side approval lands Day 3.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The 8 event_type values from migration 20260529020000 line 173-182.
 * Keeping the union here (mirror of the SQL CHECK constraint) gives
 * TypeScript callers the right exhaustiveness check at compile time.
 *
 * Day 2 writes 3 of these on order submit (order_created · voucher_applied
 * when a voucher was applied · payment_uploaded since the inline drawer
 * always uploads a screenshot as part of submit). Day 3 admin approval
 * adds payment_approved + payment_rejected + payment_resubmit_requested.
 * Day 3+ service activation hooks add service_activated + order_refunded.
 */
export type LedgerEventType =
  | 'order_created'
  | 'voucher_applied'
  | 'payment_uploaded'
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_resubmit_requested'
  | 'service_activated'
  | 'order_refunded';

export type LedgerActorRole = 'couple' | 'admin' | 'system';

/**
 * Append-only ledger write. Always best-effort: logs failure to the
 * server console but never throws. Callers can chain multiple appends
 * without try/catch because this never throws.
 *
 * Snapshot semantics: voucher_code + amount_centavos + payment_id are
 * frozen at write time (no FKs · admin could later edit the discount_codes
 * row or housekeeping could hard-delete the payment row · ledger row
 * preserves the historical value at write moment).
 *
 * Idempotency: NOT idempotent. Callers must ensure they only call once
 * per state transition (e.g. createOrder calls 3 times in a single
 * transaction · NOT 3 times per click). Replays would double-stamp.
 */
export async function appendLedger(
  supabase: SupabaseClient,
  args: {
    order_id: string;
    event_type: LedgerEventType;
    actor_user_id: string;
    actor_role: LedgerActorRole;
    amount_centavos?: number | null;
    voucher_code?: string | null;
    payment_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from('order_ledger').insert({
      order_id: args.order_id,
      event_type: args.event_type,
      actor_user_id: args.actor_user_id,
      actor_role: args.actor_role,
      amount_centavos: args.amount_centavos ?? null,
      voucher_code: args.voucher_code ?? null,
      payment_id: args.payment_id ?? null,
      metadata: args.metadata ?? {},
    });
    if (error) {
      // RLS misconfig · column drift · transient DB error. Log but never
      // throw — parent mutation has already done the real work.
      console.warn(
        '[appendLedger] insert failed (best-effort, NOT throwing):',
        {
          order_id: args.order_id,
          event_type: args.event_type,
          code: (error as { code?: string }).code,
          message: error.message,
        },
      );
    }
  } catch (err) {
    // Defensive: import-time / driver-level throws. Same swallow-and-log
    // posture as the sendEmail wrapper in apps/web/app/dashboard/[eventId]/
    // orders/actions.ts (PR #591 lineage).
    console.warn('[appendLedger] threw unexpectedly (best-effort, swallowed):', err);
  }
}
