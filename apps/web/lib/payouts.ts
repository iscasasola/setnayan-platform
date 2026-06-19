import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor Payout dispatcher (spec corpus lock 2026-05-16).
 *
 * Computes the payout schedule for a paid couple-order based on the vendor's
 * verification state, then writes `vendor_payouts` rows with the right
 * scheduled_at + dispute_window_ends_at + audit_log seed.
 *
 * Per 0006 § "Vendor Payout model" (locked 2026-05-16):
 *
 *   • verified      → 1 row, payout_stage='immediate_full',
 *                     scheduled_at = paid_at + 1 day (T+1).
 *                     Net = gross − gateway_fee − BIR 0.5% withholding.
 *                     Setnayan absorbs the ₱15-25 disbursement fee
 *                     (still tracked on the row + on the order for Finance).
 *
 *   • coming_soon   → 3 rows, 20/60/20 milestone release:
 *                     stage_1_confirm     · 20%  · scheduled_at = paid_at + 1 day
 *                                                                (couple's
 *                                                                 booking
 *                                                                 confirmation
 *                                                                 lands the
 *                                                                 moment we
 *                                                                 receive
 *                                                                 payment)
 *                     stage_2_event_start · 60%  · scheduled_at = event_date + 7 days
 *                                                  dispute_window_ends_at =
 *                                                    event_date − 14 days
 *                                                    (T-14 couple confirms prep)
 *                     stage_3_event_end   · 20%  · scheduled_at = event_date + 7 days
 *                                                  dispute_window_ends_at =
 *                                                    event_date + 7 days
 *                                                    (T+7 couple confirms delivery)
 *
 * BIR Marketplace Withholding: 0.5% pass-through per RMC 8-2024. Setnayan is
 * the withholding agent; Form 2307 issued quarterly to the vendor.
 *
 * Source: 0006_vendors_management.md § Vendor Payout model · 0034_payments_and_cart.md
 * § 6.4 BIR + § 6.7 Schema updates.
 */

// Type-aliased so callers can use a literal-typed surface. The DB ENUM is
// `public.payout_stage` (migration 20260516210000_vendor_payout_model.sql).
export type PayoutStage =
  | 'immediate_full'
  | 'stage_1_confirm'
  | 'stage_2_event_start'
  | 'stage_3_event_end';

// Vendor verification states the dispatcher cares about. Sourced from the
// `verification_state` column on vendor_profiles (added by the parallel
// agent's verification flow migration). When that lands, this set is the
// canonical input. Today we map from `public_visibility` as a fallback.
export type VendorVerificationState =
  | 'verified'
  | 'coming_soon'
  | 'demoted'
  | 'hidden'
  | 'archived';

export const PAYOUT_STAGE_LABEL: Record<PayoutStage, string> = {
  immediate_full: 'Immediate (T+1)',
  stage_1_confirm: 'Stage 1 · Booking confirmation (20%)',
  stage_2_event_start: 'Stage 2 · Pre-event (60%)',
  stage_3_event_end: 'Stage 3 · Post-event (20%)',
};

export const PAYOUT_STAGE_TONE: Record<PayoutStage, string> = {
  immediate_full: 'bg-success-100 text-success-800',
  stage_1_confirm: 'bg-blue-100 text-blue-800',
  stage_2_event_start: 'bg-warn-100 text-warn-800',
  stage_3_event_end: 'bg-purple-100 text-purple-800',
};

/** BIR Marketplace Withholding rate (RMC 8-2024) — 0.5% = 50 bps. */
export const BIR_WITHHOLDING_BPS = 50;

/**
 * Default disbursement fee Setnayan absorbs per payout (₱20 midpoint of the
 * ₱15-25 range the spec calls out). Stored on the row for Finance rollup;
 * never deducted from the vendor net.
 */
export const DEFAULT_DISBURSEMENT_FEE_CENTAVOS = 2000;

/**
 * Default Setnayan Pay convenience fee — flat 5.0% across all rails (locked
 * 2026-05-16 row 16, supersedes morning 5.5%/6.5%). Per-method config still
 * lives in setnayan_pay_methods; this constant is the fallback when an order
 * doesn't yet carry a `payment_method_key`.
 */
export const DEFAULT_SETNAYAN_FEE_BPS = 500;

/**
 * Resolve the effective Setnayan Pay convenience-fee rate in basis points,
 * reading the admin-set `platform_settings.setnayan_pay_fee_pct` (the
 * /admin/pricing "Platform fee" editor) and falling back to
 * `DEFAULT_SETNAYAN_FEE_BPS` (5.0% = 500 bps) when the column is unset, the
 * row is missing, or the read fails.
 *
 * Behavior is byte-identical to the pre-settings path whenever the column is
 * NULL — the fee column ships defaulted to the current 5.0% (migration
 * 20261225000000) so existing orders keep charging exactly the same fee.
 *
 * Takes the admin client from the caller (this module stays client-agnostic so
 * it can run in both the cart-approval flow and the payout dispatcher).
 */
export async function getSetnayanFeeBps(
  adminClient: SupabaseClient,
): Promise<number> {
  try {
    const { data, error } = await adminClient
      .from('platform_settings')
      .select('setnayan_pay_fee_pct')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return DEFAULT_SETNAYAN_FEE_BPS;
    const pct = (data as { setnayan_pay_fee_pct?: number | null })
      .setnayan_pay_fee_pct;
    if (pct == null || !Number.isFinite(Number(pct))) {
      return DEFAULT_SETNAYAN_FEE_BPS;
    }
    // pct is a percentage (e.g. 5.0) → bps (500). Round to the nearest bp.
    return Math.round(Number(pct) * 100);
  } catch {
    return DEFAULT_SETNAYAN_FEE_BPS;
  }
}

/**
 * Minimum Setnayan Pay convenience-fee floor — ₱50 = 5,000 centavos (locked
 * CLAUDE.md decision-log 2026-05-17 ninth row). Ensures sub-₱1,000 bookings
 * still clear Setnayan's per-transaction operating cost.
 *
 * Crossover at exactly ₱1,000 (5.0% × ₱1,000 = ₱50). Above ₱1,000 the
 * percentage wins; below ₱1,000 the floor wins. Per-rail config lives in
 * `setnayan_pay_methods.min_fee_centavos` (migration 20260608000000); this
 * constant is the fallback when an order doesn't yet carry a
 * `payment_method_key`.
 */
export const DEFAULT_MIN_FEE_CENTAVOS = 5000;

/** Conservative gateway fee for V1 manual reconciliation (no gateway today). */
export const DEFAULT_GATEWAY_FEE_BPS = 0;

export type PayoutInputs = {
  /** Total customer-paid amount in centavos (after VAT, this is the gross). */
  grossCentavos: number;
  /** Setnayan convenience-fee rate (bps). Defaults to flat 5.0% across rails. */
  setnayanFeeBps?: number;
  /**
   * Minimum convenience-fee floor in centavos. Defaults to ₱50 (5,000
   * centavos) per CLAUDE.md 2026-05-17 ninth row. Per-rail values live in
   * `setnayan_pay_methods.min_fee_centavos`; the order-time snapshot lands
   * on `orders.min_fee_centavos` once that column is wired (V1.x).
   */
  minFeeCentavos?: number;
  /** Gateway fee in centavos (V1 = 0 for manual reconciliation). */
  gatewayFeeCentavos?: number;
  /** Override BIR withholding bps (defaults to 50 = 0.5%). */
  birWithholdingBps?: number;
  /** ₱15-25 disbursement fee absorbed by Setnayan. */
  disbursementFeeCentavos?: number;
};

export type PayoutBreakdown = {
  /** Gross customer payment (post-VAT). */
  grossCentavos: number;
  /** Setnayan convenience fee (% of gross) — platform's slice. */
  setnayanFeeCentavos: number;
  /** Gateway fee (V1 = 0; future Maya 1.5%). */
  gatewayFeeCentavos: number;
  /** BIR 0.5% Marketplace Withholding. */
  birWithholdingCentavos: number;
  /** ₱15-25 outbound disbursement fee Setnayan absorbs (not deducted). */
  disbursementFeeCentavos: number;
  /**
   * Vendor net = gross − setnayan_fee − gateway_fee − bir_withholding.
   * Disbursement fee is NOT deducted (absorbed by Setnayan).
   */
  vendorNetCentavos: number;
};

/**
 * Compute the per-order breakdown that lands on the `orders` row when an
 * admin reconciles a payment. Called by the cart approval flow + the payout
 * dispatcher.
 *
 * Setnayan Pay fee formula (canonical per CLAUDE.md 2026-05-17 ninth row):
 *
 *   fee = MAX(gross × setnayan_fee_bps / 10000, min_fee_centavos)
 *
 * The MAX ensures sub-₱1,000 bookings clear the ₱50 operating-cost floor.
 * At ₱1,000 exactly, both halves equal 5,000 centavos (₱50). Above ₱1,000
 * the percentage wins; below ₱1,000 the floor wins. Floor never applies to
 * a zero-gross order (Math.max above protects that case — fee is 0).
 *
 * All integer centavo math — no floating point in the path.
 */
export function computePayoutBreakdown(inputs: PayoutInputs): PayoutBreakdown {
  const grossCentavos = Math.max(0, Math.round(inputs.grossCentavos));
  const setnayanFeeBps = inputs.setnayanFeeBps ?? DEFAULT_SETNAYAN_FEE_BPS;
  const minFeeCentavos = Math.max(
    0,
    Math.round(inputs.minFeeCentavos ?? DEFAULT_MIN_FEE_CENTAVOS),
  );
  const gatewayFeeCentavos = Math.max(
    0,
    Math.round(inputs.gatewayFeeCentavos ?? 0),
  );
  const birBps = inputs.birWithholdingBps ?? BIR_WITHHOLDING_BPS;
  const disbursementFeeCentavos = Math.max(
    0,
    Math.round(
      inputs.disbursementFeeCentavos ?? DEFAULT_DISBURSEMENT_FEE_CENTAVOS,
    ),
  );

  // MAX(percent, floor) — but only when the order has a non-zero gross. A
  // zero-gross order has zero fee (no floor applied — there's nothing to
  // float over).
  const setnayanFeePercentCentavos = Math.floor(
    (grossCentavos * setnayanFeeBps) / 10000,
  );
  const setnayanFeeCentavos =
    grossCentavos > 0
      ? Math.max(setnayanFeePercentCentavos, minFeeCentavos)
      : 0;
  const birWithholdingCentavos = Math.floor((grossCentavos * birBps) / 10000);
  const vendorNetCentavos = Math.max(
    0,
    grossCentavos -
      setnayanFeeCentavos -
      gatewayFeeCentavos -
      birWithholdingCentavos,
  );

  return {
    grossCentavos,
    setnayanFeeCentavos,
    gatewayFeeCentavos,
    birWithholdingCentavos,
    disbursementFeeCentavos,
    vendorNetCentavos,
  };
}

/**
 * One scheduled stage as emitted by `planPayoutStages`. Caller (the
 * dispatcher) is responsible for persisting these as vendor_payouts rows.
 */
export type PlannedPayoutStage = {
  payout_stage: PayoutStage;
  /** Percentage release (20 / 60 / 20 / 100). */
  pct: number;
  /** Centavos to release at this stage (sums to vendorNetCentavos). */
  amount_centavos: number;
  /** When the cron will release this stage. */
  scheduled_at: Date;
  /** Couple dispute window end. NULL for stage_1_confirm + immediate_full. */
  dispute_window_ends_at: Date | null;
  /**
   * Trigger label persisted on the legacy `stage` text column so the existing
   * read paths keep working. Maps 1-to-1 with payout_stage.
   */
  legacy_stage: 'immediate' | 'reservation' | 'pre_event' | 'post_event';
  legacy_trigger_type:
    | 'booking_confirmed'
    | 'pre_event_check'
    | 'post_event_check'
    | 'admin_override';
};

export type PlanPayoutInputs = {
  verificationState: VendorVerificationState;
  /** Couple's payment confirmation timestamp (orders.paid status flip). */
  paidAt: Date;
  /** Event date the vendor is contracted for. Required for coming_soon vendors. */
  eventDate: Date | null;
  /** Vendor net (post-fees, pre-disbursement-fee). */
  vendorNetCentavos: number;
};

/**
 * Plan the stage release schedule for a single paid order. Returns 1 row for
 * verified (immediate T+1) or 3 rows for coming_soon (20/60/20 milestone).
 *
 * For demoted vendors we use the coming_soon 3-stage schedule — that's the
 * whole point of demotion per 0006 § "Demote-to-coming_soon trigger".
 *
 * For hidden / archived vendors we throw — the caller shouldn't be paying
 * out to those at all (admin needs to reassign or refund first).
 */
export function planPayoutStages(inputs: PlanPayoutInputs): PlannedPayoutStage[] {
  const { verificationState, paidAt, eventDate, vendorNetCentavos } = inputs;

  if (verificationState === 'hidden' || verificationState === 'archived') {
    throw new Error(
      `Cannot schedule payouts for ${verificationState} vendor — admin must reassign or refund first.`,
    );
  }

  const net = Math.max(0, Math.round(vendorNetCentavos));

  // Verified → immediate full T+1.
  if (verificationState === 'verified') {
    return [
      {
        payout_stage: 'immediate_full',
        pct: 100,
        amount_centavos: net,
        scheduled_at: addDays(paidAt, 1),
        dispute_window_ends_at: null,
        legacy_stage: 'immediate',
        legacy_trigger_type: 'booking_confirmed',
      },
    ];
  }

  // coming_soon / demoted → 20/60/20 milestone release.
  if (!eventDate) {
    // Spec: if no event date is set, fall back to immediate stage 1 release
    // only (20%) so the vendor receives the reservation deposit; stages 2 + 3
    // get scheduled when the event date is set on the order. The caller can
    // re-plan if/when event_date is back-filled.
    return [
      {
        payout_stage: 'stage_1_confirm',
        pct: 20,
        amount_centavos: Math.floor((net * 20) / 100),
        scheduled_at: addDays(paidAt, 1),
        dispute_window_ends_at: null,
        legacy_stage: 'reservation',
        legacy_trigger_type: 'booking_confirmed',
      },
    ];
  }

  // Standard 3-stage coming_soon schedule.
  const stage1 = Math.floor((net * 20) / 100);
  const stage2 = Math.floor((net * 60) / 100);
  // Stage 3 mops up the rounding remainder so the three stages always sum
  // exactly to `net` (no centavo lost to integer division).
  const stage3 = net - stage1 - stage2;

  return [
    {
      payout_stage: 'stage_1_confirm',
      pct: 20,
      amount_centavos: stage1,
      scheduled_at: addDays(paidAt, 1),
      dispute_window_ends_at: null,
      legacy_stage: 'reservation',
      legacy_trigger_type: 'booking_confirmed',
    },
    {
      payout_stage: 'stage_2_event_start',
      pct: 60,
      amount_centavos: stage2,
      // Spec: T+7 from event start. The dispute window opens at T-14 and
      // closes 7 days later (auto-release on silence). We use event_date
      // as "event start"; multi-day events back-fill differently when
      // event_end_date lands as a schema column.
      scheduled_at: addDays(eventDate, 7),
      dispute_window_ends_at: addDays(eventDate, -14 + 7),
      legacy_stage: 'pre_event',
      legacy_trigger_type: 'pre_event_check',
    },
    {
      payout_stage: 'stage_3_event_end',
      pct: 20,
      amount_centavos: stage3,
      // Spec: T+7 from event end (using event_date as start; equals event
      // end for single-day events).
      scheduled_at: addDays(eventDate, 7),
      dispute_window_ends_at: addDays(eventDate, 7),
      legacy_stage: 'post_event',
      legacy_trigger_type: 'post_event_check',
    },
  ];
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * Result of `dispatchVendorPayouts` — number of stages written + the inserted
 * row IDs so callers can render confirmation toasts.
 */
export type DispatchPayoutsResult =
  | { ok: true; stages_inserted: number; payout_ids: string[] }
  | { ok: false; error: string };

export type DispatchPayoutsInput = {
  orderId: string;
  vendorProfileId: string;
  verificationState: VendorVerificationState;
  /** ISO timestamp of the paid status flip on the order. */
  paidAt: string;
  /** ISO date string for the event (couples may not have it yet — pass null). */
  eventDate: string | null;
  breakdown: PayoutBreakdown;
  /** Disbursement rail the vendor selected (Maya / GCash / BDO). */
  payoutMethod: 'bank_account' | 'gcash' | 'maya_account' | 'check';
  /** Optional admin who triggered (e.g. /admin/payments approve). */
  actorUserId?: string | null;
};

/**
 * Compute the payout schedule and INSERT one or more vendor_payouts rows.
 *
 * Idempotent on (order_id, payout_stage): if a row for the same order +
 * stage already exists, that stage is skipped (lets the cart-approval flow
 * retry safely after partial failure).
 *
 * Uses the service-role admin client because vendor_payouts is admin-write
 * only per RLS.
 */
export async function dispatchVendorPayouts(
  adminClient: SupabaseClient,
  input: DispatchPayoutsInput,
): Promise<DispatchPayoutsResult> {
  const paidAt = new Date(input.paidAt);
  const eventDate = input.eventDate ? new Date(input.eventDate) : null;

  let stages: PlannedPayoutStage[];
  try {
    stages = planPayoutStages({
      verificationState: input.verificationState,
      paidAt,
      eventDate,
      vendorNetCentavos: input.breakdown.vendorNetCentavos,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Pull existing rows so we can dedupe by (order_id, payout_stage).
  const { data: existing } = await adminClient
    .from('vendor_payouts')
    .select('payout_id, payout_stage')
    .eq('order_id', input.orderId);
  const existingStages = new Set(
    (existing ?? []).map((r) => r.payout_stage as PayoutStage),
  );

  const toInsert = stages.filter((s) => !existingStages.has(s.payout_stage));
  if (toInsert.length === 0) {
    return { ok: true, stages_inserted: 0, payout_ids: [] };
  }

  const now = new Date().toISOString();
  const auditSeed = {
    at: now,
    actor: input.actorUserId ? `admin:${input.actorUserId}` : 'system',
    action: 'scheduled' as const,
    reason: null,
    meta: {
      verification_state: input.verificationState,
      paid_at: input.paidAt,
      event_date: input.eventDate,
    },
  };

  const rows = toInsert.map((s) => ({
    order_id: input.orderId,
    vendor_profile_id: input.vendorProfileId,
    // Legacy text columns (kept for backward compat with the earlier
    // migration's read paths).
    stage: s.legacy_stage,
    stage_pct: s.pct,
    amount_centavos: s.amount_centavos,
    trigger_type: s.legacy_trigger_type,
    trigger_date: s.scheduled_at.toISOString(),
    payout_method: input.payoutMethod,
    // 2026-05-16 audit-trail columns.
    payout_stage: s.payout_stage,
    gross_centavos: input.breakdown.grossCentavos,
    gateway_fee_centavos: input.breakdown.gatewayFeeCentavos,
    bir_withholding_centavos: input.breakdown.birWithholdingCentavos,
    disbursement_fee_centavos: input.breakdown.disbursementFeeCentavos,
    vendor_net_centavos: s.amount_centavos,
    scheduled_at: s.scheduled_at.toISOString(),
    dispute_window_ends_at: s.dispute_window_ends_at?.toISOString() ?? null,
    audit_log: [auditSeed],
  }));

  const { data: inserted, error } = await adminClient
    .from('vendor_payouts')
    .insert(rows)
    .select('payout_id');

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    stages_inserted: inserted?.length ?? 0,
    payout_ids: (inserted ?? []).map((r) => r.payout_id as string),
  };
}

/**
 * Mark a single payout as paid. Admin-only — called from /admin/payouts when
 * the disbursement actually clears (BDO / GCash / Maya transfer confirmed).
 *
 * Appends an `audit_log` entry with the actor + reason so the row's history
 * is preserved.
 */
export async function markPayoutPaid(
  adminClient: SupabaseClient,
  args: {
    payoutId: string;
    actorUserId: string;
    paymentMethod: 'maya' | 'gcash' | 'bdo_transfer' | 'check';
    payoutReference?: string | null;
    reason?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await adminClient
    .from('vendor_payouts')
    .select('payout_id, audit_log, paid_at')
    .eq('payout_id', args.payoutId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: 'Payout not found.' };
  if (row.paid_at) return { ok: false, error: 'Payout already paid.' };

  const now = new Date().toISOString();
  const prevLog: unknown = (row as { audit_log?: unknown }).audit_log;
  const nextLog = Array.isArray(prevLog) ? [...prevLog] : [];
  nextLog.push({
    at: now,
    actor: `admin:${args.actorUserId}`,
    action: 'released',
    reason: args.reason ?? null,
    meta: {
      payment_method: args.paymentMethod,
      payout_reference: args.payoutReference ?? null,
    },
  });

  const { error: updErr } = await adminClient
    .from('vendor_payouts')
    .update({
      paid_at: now,
      released_at: now,
      payment_method: args.paymentMethod,
      payout_reference: args.payoutReference ?? null,
      audit_log: nextLog,
      updated_at: now,
    })
    .eq('payout_id', args.payoutId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}

/**
 * Place a payout on hold (couple opened a dispute, admin escalation, etc.).
 * Appends an audit row; reversal is `releasePayoutHold`.
 */
export async function holdPayout(
  adminClient: SupabaseClient,
  args: {
    payoutId: string;
    actorUserId: string;
    reason: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await adminClient
    .from('vendor_payouts')
    .select('audit_log')
    .eq('payout_id', args.payoutId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: 'Payout not found.' };

  const now = new Date().toISOString();
  const prevLog: unknown = (row as { audit_log?: unknown }).audit_log;
  const nextLog = Array.isArray(prevLog) ? [...prevLog] : [];
  nextLog.push({
    at: now,
    actor: `admin:${args.actorUserId}`,
    action: 'held',
    reason: args.reason,
    meta: null,
  });

  const { error: updErr } = await adminClient
    .from('vendor_payouts')
    .update({
      on_hold: true,
      hold_reason: args.reason,
      audit_log: nextLog,
      updated_at: now,
    })
    .eq('payout_id', args.payoutId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}

/**
 * Release a payout that was previously placed on hold — the reversal of
 * `holdPayout`. Clears `on_hold` + `hold_reason` so the cron / admin can
 * disburse the stage again, and appends a `released_hold` audit row so the
 * full hold→release history is preserved on the row.
 *
 * Without this, a held payout had NO release path — once `holdPayout` set
 * `on_hold=true`, the only way back was a raw DB write. This closes that gap
 * (m3).
 *
 * No-op-safe: releasing a payout that isn't on hold succeeds (returns ok) but
 * still records the audit entry, so a double-click can't error. Refuses to
 * touch an already-paid payout (a release after disbursement is meaningless).
 */
export async function releasePayoutHold(
  adminClient: SupabaseClient,
  args: {
    payoutId: string;
    actorUserId: string;
    reason?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: readErr } = await adminClient
    .from('vendor_payouts')
    .select('audit_log, on_hold, paid_at')
    .eq('payout_id', args.payoutId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row) return { ok: false, error: 'Payout not found.' };
  if ((row as { paid_at?: string | null }).paid_at) {
    return { ok: false, error: 'Payout already paid — nothing to release.' };
  }

  const now = new Date().toISOString();
  const prevLog: unknown = (row as { audit_log?: unknown }).audit_log;
  const nextLog = Array.isArray(prevLog) ? [...prevLog] : [];
  nextLog.push({
    at: now,
    actor: `admin:${args.actorUserId}`,
    action: 'released_hold',
    reason: args.reason ?? null,
    meta: null,
  });

  const { error: updErr } = await adminClient
    .from('vendor_payouts')
    .update({
      on_hold: false,
      hold_reason: null,
      audit_log: nextLog,
      updated_at: now,
    })
    .eq('payout_id', args.payoutId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}

/**
 * Map a vendor_profiles row to its effective verification state.
 *
 * Until the parallel agent's verification flow lands the canonical
 * `verification_state` ENUM, we infer from `public_visibility`:
 *   verified    → verified
 *   coming_soon → coming_soon
 *   hidden      → hidden
 *   archived    → archived
 *
 * When the spec ENUM lands, callers can swap in `vendor_profiles.verification_state`
 * directly without touching the payouts module.
 */
export function resolveVendorVerificationState(
  profile: { public_visibility?: string | null; verification_state?: string | null },
): VendorVerificationState {
  // Prefer the canonical column when present.
  if (profile.verification_state) {
    const v = profile.verification_state;
    if (
      v === 'verified' ||
      v === 'coming_soon' ||
      v === 'demoted' ||
      v === 'hidden' ||
      v === 'archived'
    ) {
      return v;
    }
  }
  switch (profile.public_visibility) {
    case 'verified':
      return 'verified';
    case 'coming_soon':
      return 'coming_soon';
    case 'hidden':
      return 'hidden';
    case 'archived':
      return 'archived';
    default:
      return 'coming_soon';
  }
}

export function centavosToPhp(centavos: number | null | undefined): number {
  if (centavos === null || centavos === undefined) return 0;
  return Math.round(centavos) / 100;
}

export function phpToCentavos(php: number | null | undefined): number {
  if (php === null || php === undefined) return 0;
  return Math.round(Number(php) * 100);
}

export function formatCentavosPhp(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '—';
  return `₱${(Math.round(centavos) / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
