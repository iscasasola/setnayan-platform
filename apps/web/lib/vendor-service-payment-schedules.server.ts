/**
 * Server-only companion to lib/vendor-service-payment-schedules.ts.
 *
 * Holds the couple-facing fetch for a vendor service's PAYMENT SCHEDULE. PR-B
 * renders the result on the couple's workspace; PR-A only persists + exposes the
 * read. Kept server-side (no client import) so the security model below stays on
 * the server boundary, matching vendor-payment-methods.server.ts.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeStepper,
  rowToCoupleFacing,
  type CoupleFacingScheduleItem,
  type PaymentScheduleItemRow,
  type PaymentSeqState,
  type PlanInstance,
  type PlanProgress,
  type PolicySnapshot,
} from '@/lib/vendor-service-payment-schedules';
import { displayUrlForStoredAsset } from '@/lib/uploads';

/**
 * A booked vendor service's payment schedule, seq-ordered, for couple display.
 * Security model mirrors fetchPublishedMethodsForCouple:
 *   • `authedClient` (couple RLS) proves the couple owns this event_vendor row
 *     AND that the service genuinely belongs to that vendor;
 *   • `adminClient` then reads the schedule (owner-RLS'd on the vendor side),
 *     but only AFTER ownership is proven above.
 * Returns [] for off-platform/manual vendors (no marketplace profile), when the
 * couple doesn't own the event_vendor row, when the service doesn't belong to
 * that vendor, or when the service simply has no schedule defined.
 */
export async function fetchScheduleForCouple(opts: {
  authedClient: SupabaseClient;
  adminClient: SupabaseClient;
  eventId: string;
  eventVendorId: string;
  vendorServiceId: string;
}): Promise<CoupleFacingScheduleItem[]> {
  const { authedClient, adminClient, eventId, eventVendorId, vendorServiceId } = opts;

  // 1. Prove the couple owns this event_vendor (RLS-scoped read), and resolve
  //    the marketplace vendor the booking points at.
  const { data: ev } = await authedClient
    .from('event_vendors')
    .select('vendor_id, event_id, marketplace_vendor_id')
    .eq('vendor_id', eventVendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const marketplaceVendorId =
    (ev as { marketplace_vendor_id: string | null } | null)?.marketplace_vendor_id ?? null;
  if (!marketplaceVendorId) return []; // off-platform/manual vendor → no schedule

  // 2. The service must belong to that same marketplace vendor — otherwise a
  //    couple could read any service's schedule by id. (admin client bypasses
  //    owner RLS; the ownership match is the guard.)
  const { data: svc } = await adminClient
    .from('vendor_services')
    .select('vendor_service_id, vendor_profile_id')
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', marketplaceVendorId)
    .maybeSingle();
  if (!svc) return [];

  // 3. Read the schedule (admin client bypasses owner RLS; ownership proven).
  const { data: rows } = await adminClient
    .from('vendor_service_payment_schedules')
    .select('*')
    .eq('vendor_service_id', vendorServiceId)
    .order('seq', { ascending: true });

  return ((rows ?? []) as PaymentScheduleItemRow[]).map(rowToCoupleFacing);
}

/**
 * The frozen per-booking PAYMENT PLAN (Phase 2 PR-B) for the couple's
 * workspace. finalizeVendor snapshots the booked service's schedule into
 * event_vendor_payment_plan at lock; this reads it back for display.
 *
 * Couple-scoped by RLS: the host-select policy on event_vendor_payment_plan
 * gates the row to event members (current_event_ids()), so the couple's own
 * `authedClient` is sufficient — no admin escalation needed (the plan is the
 * couple's own booking, unlike the schedule template which lives behind owner
 * RLS on the vendor side).
 *
 * Returns:
 *   • null  → no plan row yet (booking not locked, or pre-PR-B booking).
 *   • []    → a plan exists but the service had no schedule → render the
 *             direct-pay fallback.
 *   • [...] → the frozen installments, seq-ordered.
 */
export async function fetchPlanForCouple(opts: {
  authedClient: SupabaseClient;
  eventId: string;
  eventVendorId: string;
}): Promise<PlanInstance[] | null> {
  const { authedClient, eventId, eventVendorId } = opts;
  const { data } = await authedClient
    .from('event_vendor_payment_plan')
    .select('instances_json')
    .eq('event_id', eventId)
    .eq('event_vendor_id', eventVendorId)
    .maybeSingle();
  if (!data) return null;
  const raw = (data as { instances_json: unknown }).instances_json;
  if (!Array.isArray(raw)) return [];
  return (raw as PlanInstance[]).slice().sort((a, b) => a.seq - b.seq);
}

/**
 * The full per-booking PLAN PROGRESS for the couple's stepper (Phase 2 PR-D):
 * the frozen installments folded with the couple's logged payments (matched by
 * schedule_instance_seq) into per-installment states (due / pending / paid),
 * plus the plan-level cleared_at.
 *
 * Couple-scoped by RLS: both event_vendor_payment_plan and event_vendor_payments
 * are gated to event members (current_event_ids()), so the couple's own
 * authedClient reads both directly — no admin escalation.
 *
 * Returns { steps: null, clearedAt: null } when there's no frozen plan (booking
 * not locked / pre-PR-B). steps = [] for a locked-but-no-schedule booking.
 */
export async function fetchPlanProgressForCouple(opts: {
  authedClient: SupabaseClient;
  eventId: string;
  eventVendorId: string;
}): Promise<PlanProgress> {
  const { authedClient, eventId, eventVendorId } = opts;

  const { data: planRow } = await authedClient
    .from('event_vendor_payment_plan')
    .select('instances_json, cleared_at, is_default_seeded')
    .eq('event_id', eventId)
    .eq('event_vendor_id', eventVendorId)
    .maybeSingle();
  if (!planRow) return { steps: null, clearedAt: null };

  const raw = (planRow as { instances_json: unknown }).instances_json;
  const instances: PlanInstance[] = Array.isArray(raw) ? (raw as PlanInstance[]) : [];
  const clearedAt = (planRow as { cleared_at: string | null }).cleared_at ?? null;
  const isDefaultSeeded =
    (planRow as { is_default_seeded: boolean | null }).is_default_seeded ?? false;

  // The couple's logged payments on this booking (couple-RLS) — only the seq +
  // confirmation flag matter for the stepper.
  const { data: payRows } = await authedClient
    .from('event_vendor_payments')
    .select('schedule_instance_seq, vendor_confirmed_at')
    .eq('event_id', eventId)
    .eq('vendor_id', eventVendorId);
  const payments: PaymentSeqState[] = ((payRows ?? []) as Array<{
    schedule_instance_seq: number | null;
    vendor_confirmed_at: string | null;
  }>).map((p) => ({
    schedule_instance_seq: p.schedule_instance_seq,
    vendor_confirmed: p.vendor_confirmed_at != null,
  }));

  return { steps: computeStepper(instances, payments), clearedAt, isDefaultSeeded };
}

/**
 * The vendor-side read of a booking's PLAN PROGRESS for the thread stepper +
 * "Mark payment cleared" gate (Phase 2 PR-D). event_vendor_payment_plan +
 * event_vendor_payments are both couple-RLS'd, so this mirrors
 * fetchPendingVendorPayments: prove the CALLING VENDOR owns the booking (its
 * marketplace_vendor_id === the caller's vendor_profile_id), THEN admin-read the
 * plan + payments. Returns one entry per booking of the vendor's on this event
 * that carries a frozen plan; bookings with no plan are omitted.
 */
export async function fetchPlanProgressForVendor(opts: {
  adminClient: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
}): Promise<
  Array<
    PlanProgress & {
      eventVendorId: string;
      vendorLabel: string;
      // No-Show Downpayment Protection — when this booking locked under a
      // protected reservation policy the couple acknowledged, the ISO date they
      // acknowledged it. Drives the "Protected by your reservation policy" badge.
      reservationAcknowledgedAt: string | null;
    }
  >
> {
  const { adminClient, eventId, vendorProfileId } = opts;

  // 1. The vendor's bookings on this event (ownership-scoped).
  const { data: bookings } = await adminClient
    .from('event_vendors')
    .select('vendor_id, vendor_name')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId);
  const evRows = (bookings ?? []) as Array<{ vendor_id: string; vendor_name: string | null }>;
  if (evRows.length === 0) return [];
  const eventVendorIds = evRows.map((b) => b.vendor_id).filter(Boolean);

  // 2. Frozen plans on those bookings.
  const { data: plans } = await adminClient
    .from('event_vendor_payment_plan')
    .select('event_vendor_id, instances_json, cleared_at')
    .eq('event_id', eventId)
    .in('event_vendor_id', eventVendorIds);
  const planRows = (plans ?? []) as Array<{
    event_vendor_id: string;
    instances_json: unknown;
    cleared_at: string | null;
  }>;
  if (planRows.length === 0) return [];

  // 3. All logged payments on those bookings (seq + confirm flag).
  const { data: payRows } = await adminClient
    .from('event_vendor_payments')
    .select('vendor_id, schedule_instance_seq, vendor_confirmed_at')
    .in('vendor_id', eventVendorIds);
  const paymentsByVendor = new Map<string, PaymentSeqState[]>();
  for (const p of (payRows ?? []) as Array<{
    vendor_id: string;
    schedule_instance_seq: number | null;
    vendor_confirmed_at: string | null;
  }>) {
    const list = paymentsByVendor.get(p.vendor_id) ?? [];
    list.push({
      schedule_instance_seq: p.schedule_instance_seq,
      vendor_confirmed: p.vendor_confirmed_at != null,
    });
    paymentsByVendor.set(p.vendor_id, list);
  }

  const nameByVendor = new Map(evRows.map((b) => [b.vendor_id, b.vendor_name]));

  // No-Show Downpayment Protection — frozen reservation acknowledgements on these
  // bookings (admin-read; ownership already proven via the bookings query above).
  const ackByVendor = new Map<string, string>();
  const { data: ackRows } = await adminClient
    .from('event_vendor_policy_acknowledgements')
    .select('event_vendor_id, acknowledged_at')
    .eq('event_id', eventId)
    .in('event_vendor_id', eventVendorIds);
  for (const a of (ackRows ?? []) as Array<{
    event_vendor_id: string;
    acknowledged_at: string;
  }>) {
    ackByVendor.set(a.event_vendor_id, a.acknowledged_at);
  }

  return planRows.map((plan) => {
    const instances: PlanInstance[] = Array.isArray(plan.instances_json)
      ? (plan.instances_json as PlanInstance[])
      : [];
    return {
      eventVendorId: plan.event_vendor_id,
      vendorLabel: nameByVendor.get(plan.event_vendor_id)?.trim() || 'this booking',
      steps: computeStepper(instances, paymentsByVendor.get(plan.event_vendor_id) ?? []),
      clearedAt: plan.cleared_at,
      reservationAcknowledgedAt: ackByVendor.get(plan.event_vendor_id) ?? null,
    };
  });
}

/** One couple-logged payment awaiting the vendor's confirmation. */
export type PendingVendorPayment = {
  paymentId: string;
  eventVendorId: string;
  amountPhp: number;
  paidAt: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  /** The installment label this payment was attributed to, if any. */
  installmentLabel: string | null;
  /** Presigned GET URL for the couple's attached receipt, if any. */
  proofUrl: string | null;
};

/**
 * Vendor-side read of the couple's PENDING (unconfirmed) payments on a booking,
 * for the Accept card in the vendor chat thread (Phase 2 PR-C).
 *
 * event_vendor_payments is the COUPLE's table (couple-RLS) — the vendor's own
 * client can't read it. So this mirrors the pax-actions / fetchScheduleForCouple
 * security model in reverse: prove the CALLING VENDOR owns the booking (the
 * event_vendor's marketplace_vendor_id === the caller's vendor_profile_id, both
 * read via the admin client), THEN admin-read the unconfirmed payments. Returns
 * [] when the booking isn't the vendor's, or there's nothing pending.
 *
 * The installment label is resolved from the booking's frozen plan
 * (event_vendor_payment_plan.instances_json) by schedule_instance_seq; the proof
 * is presigned for a short-lived GET. Best-effort enrichment — a missing plan /
 * proof just yields nulls, never an empty list.
 */
export async function fetchPendingVendorPayments(opts: {
  adminClient: SupabaseClient;
  eventId: string;
  vendorProfileId: string;
}): Promise<PendingVendorPayment[]> {
  const { adminClient, eventId, vendorProfileId } = opts;

  // 1. The vendor's bookings on this event (ownership-scoped).
  const { data: bookings } = await adminClient
    .from('event_vendors')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId);
  const eventVendorIds = (bookings ?? [])
    .map((b) => (b as { vendor_id: string }).vendor_id)
    .filter(Boolean);
  if (eventVendorIds.length === 0) return [];

  // 2. Unconfirmed payments on those bookings.
  const { data: rows } = await adminClient
    .from('event_vendor_payments')
    .select(
      'payment_id, vendor_id, amount_php, paid_at, method, reference, notes, proof_r2_key, schedule_instance_seq, vendor_confirmed_at',
    )
    .in('vendor_id', eventVendorIds)
    .is('vendor_confirmed_at', null)
    .order('paid_at', { ascending: false });
  const payments = (rows ?? []) as Array<{
    payment_id: string;
    vendor_id: string;
    amount_php: number;
    paid_at: string;
    method: string | null;
    reference: string | null;
    notes: string | null;
    proof_r2_key: string | null;
    schedule_instance_seq: number | null;
  }>;
  if (payments.length === 0) return [];

  // 3. Resolve installment labels from each booking's frozen plan (seq → label).
  //    ONE batched read keyed by event_vendor_id — not N per-vendor round-trips
  //    (this runs on the vendor message-thread page, once per pending vendor).
  const planByVendor = new Map<string, Map<number, string>>();
  const uniqueVendorIds = Array.from(new Set(payments.map((p) => p.vendor_id)));
  const { data: plans } = await adminClient
    .from('event_vendor_payment_plan')
    .select('event_vendor_id, instances_json')
    .eq('event_id', eventId)
    .in('event_vendor_id', uniqueVendorIds);
  for (const plan of (plans ?? []) as Array<{ event_vendor_id: string; instances_json?: unknown }>) {
    const raw = plan.instances_json;
    const map = new Map<number, string>();
    if (Array.isArray(raw)) {
      for (const inst of raw as PlanInstance[]) {
        if (typeof inst?.seq === 'number') map.set(inst.seq, inst.label);
      }
    }
    planByVendor.set(plan.event_vendor_id, map);
  }

  // 4. Presign proof receipts in parallel + assemble.
  return await Promise.all(
    payments.map(async (p): Promise<PendingVendorPayment> => {
      const label =
        p.schedule_instance_seq != null
          ? (planByVendor.get(p.vendor_id)?.get(p.schedule_instance_seq) ?? null)
          : null;
      let proofUrl: string | null = null;
      if (p.proof_r2_key) {
        try {
          proofUrl = await displayUrlForStoredAsset(p.proof_r2_key);
        } catch {
          proofUrl = null;
        }
      }
      return {
        paymentId: p.payment_id,
        eventVendorId: p.vendor_id,
        amountPhp: Number(p.amount_php ?? 0),
        paidAt: p.paid_at,
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        installmentLabel: label,
        proofUrl,
      };
    }),
  );
}

// ===========================================================================
// No-Show Downpayment Protection — frozen-evidence snapshot + reads.
//
// At lock, finalizeVendor freezes the booked service's seq-0 downpayment
// reservation policy into event_vendor_policy_acknowledgements as write-once
// evidence (Setnayan holds no money — this is the defensible paper trail). The
// couple's workspace renders the acknowledgement read-only; the admin dispute
// surface reads the frozen snapshot to adjudicate a forfeit.
// ===========================================================================

/** A frozen policy acknowledgement row for couple / admin display. */
export type PolicyAcknowledgement = {
  ackId: string;
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string | null;
  snapshot: PolicySnapshot;
  acknowledgedBy: string | null;
  acknowledgedAt: string;
};

/**
 * Snapshot the downpayment reservation policy into the write-once ack row at
 * lock. Best-effort + idempotent: inserts only when no acknowledgement exists
 * for the booking yet (evidence is immutable — a re-lock must NOT overwrite the
 * original acknowledgement). Uses the service-role `adminClient` (the same
 * client finalizeVendor's plan upsert rides), so it never depends on the
 * couple's RLS at the lock boundary. Returns true when a row was written.
 *
 * Only call when the policy is "protected" (isProtectedPolicy) — i.e. the
 * couple was shown + ticked the acknowledgement gate before the lock committed.
 */
export async function snapshotPolicyAcknowledgement(opts: {
  adminClient: SupabaseClient;
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string | null;
  snapshot: PolicySnapshot;
  acknowledgedBy: string | null;
}): Promise<boolean> {
  const { adminClient, eventId, eventVendorId, vendorProfileId, snapshot, acknowledgedBy } = opts;

  // Write-once: if an acknowledgement already exists for this booking, leave the
  // original frozen evidence untouched.
  const { data: existing } = await adminClient
    .from('event_vendor_policy_acknowledgements')
    .select('ack_id')
    .eq('event_id', eventId)
    .eq('event_vendor_id', eventVendorId)
    .maybeSingle();
  if (existing) return false;

  const { error } = await adminClient
    .from('event_vendor_policy_acknowledgements')
    .insert({
      event_id: eventId,
      event_vendor_id: eventVendorId,
      vendor_profile_id: vendorProfileId,
      policy_snapshot_json: snapshot,
      acknowledged_by: acknowledgedBy,
    });
  return !error;
}

/**
 * The frozen reservation-policy acknowledgement for the couple's workspace
 * (read-only render beside the PaymentPlanStepper). Couple-scoped by RLS via
 * the host-select policy (current_event_ids()), so the couple's own
 * authedClient reads it directly. Returns null when no acknowledgement exists.
 */
export async function fetchPolicyAcknowledgementForCouple(opts: {
  authedClient: SupabaseClient;
  eventId: string;
  eventVendorId: string;
}): Promise<PolicyAcknowledgement | null> {
  const { authedClient, eventId, eventVendorId } = opts;
  const { data } = await authedClient
    .from('event_vendor_policy_acknowledgements')
    .select('ack_id, event_id, event_vendor_id, vendor_profile_id, policy_snapshot_json, acknowledged_by, acknowledged_at')
    .eq('event_id', eventId)
    .eq('event_vendor_id', eventVendorId)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    ack_id: string;
    event_id: string;
    event_vendor_id: string;
    vendor_profile_id: string | null;
    policy_snapshot_json: PolicySnapshot;
    acknowledged_by: string | null;
    acknowledged_at: string;
  };
  return {
    ackId: row.ack_id,
    eventId: row.event_id,
    eventVendorId: row.event_vendor_id,
    vendorProfileId: row.vendor_profile_id,
    snapshot: row.policy_snapshot_json,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
  };
}

/**
 * Every frozen policy acknowledgement for a set of vendor profiles, keyed by
 * vendor_profile_id, for the admin dispute surface. Admin-only (the caller is
 * the /admin layer which already gates on is_admin); uses the service-role
 * adminClient. Used to attach immutable forfeit evidence to a dispute row.
 */
export async function fetchPolicyAcknowledgementsByVendor(opts: {
  adminClient: SupabaseClient;
  vendorProfileIds: string[];
}): Promise<Map<string, PolicyAcknowledgement[]>> {
  const { adminClient, vendorProfileIds } = opts;
  const out = new Map<string, PolicyAcknowledgement[]>();
  if (vendorProfileIds.length === 0) return out;
  const { data } = await adminClient
    .from('event_vendor_policy_acknowledgements')
    .select('ack_id, event_id, event_vendor_id, vendor_profile_id, policy_snapshot_json, acknowledged_by, acknowledged_at')
    .in('vendor_profile_id', vendorProfileIds)
    .order('acknowledged_at', { ascending: false });
  for (const row of (data ?? []) as Array<{
    ack_id: string;
    event_id: string;
    event_vendor_id: string;
    vendor_profile_id: string | null;
    policy_snapshot_json: PolicySnapshot;
    acknowledged_by: string | null;
    acknowledged_at: string;
  }>) {
    if (!row.vendor_profile_id) continue;
    const list = out.get(row.vendor_profile_id) ?? [];
    list.push({
      ackId: row.ack_id,
      eventId: row.event_id,
      eventVendorId: row.event_vendor_id,
      vendorProfileId: row.vendor_profile_id,
      snapshot: row.policy_snapshot_json,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at,
    });
    out.set(row.vendor_profile_id, list);
  }
  return out;
}
