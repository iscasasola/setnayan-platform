import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from './supabase/error-detect';
import {
  computeStepper,
  type PaymentSeqState,
  type PlanInstance,
  type PlanProgress,
} from './vendor-service-payment-schedules';

/**
 * EVERY BOOKED SUPPLIER'S PAYMENT PLAN, IN TWO READS — for the Booked body's
 * "Next: first payment · ₱528,000 · by Oct 5".
 *
 * The same fold `fetchPlanProgressForCouple`
 * (`lib/vendor-service-payment-schedules.server.ts`) makes for ONE booking on
 * the supplier's workspace — the plan frozen at booking
 * (`event_vendor_payment_plan`) with the couple's logged payments folded in by
 * `computeStepper` — made once for the whole event, so a page with twelve
 * booked suppliers asks twice, not twenty-four times.
 *
 * Couple-scoped by RLS: both tables are gated to the event's members.
 *
 * 🛑 `null` = A READ WAS REFUSED. Not "no plans": a caller that turned it into
 * an empty map would tell a couple with a payment due on Friday that nothing
 * is. A supplier simply absent from the map has no frozen plan.
 */
export async function readBookedPlans(
  supabase: SupabaseClient,
  eventId: string,
  vendorIds: readonly string[],
): Promise<Map<string, PlanProgress> | null> {
  const out = new Map<string, PlanProgress>();
  if (vendorIds.length === 0) return out;
  const ids = [...new Set(vendorIds)];
  const [plans, pays] = await Promise.all([
    supabase
      .from('event_vendor_payment_plan')
      .select('event_vendor_id, instances_json, cleared_at, is_default_seeded')
      .eq('event_id', eventId)
      .in('event_vendor_id', ids),
    supabase
      .from('event_vendor_payments')
      .select('vendor_id, schedule_instance_seq, vendor_confirmed_at, payment_refused_at')
      .eq('event_id', eventId)
      .in('vendor_id', ids),
  ]);
  if (plans.error || pays.error) {
    logQueryError('readBookedPlans', plans.error ?? pays.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const paymentsByVendor = new Map<string, PaymentSeqState[]>();
  for (const p of (pays.data ?? []) as Array<{
    vendor_id: string;
    schedule_instance_seq: number | null;
    vendor_confirmed_at: string | null;
    payment_refused_at: string | null;
  }>) {
    const mine = paymentsByVendor.get(p.vendor_id) ?? [];
    mine.push({
      schedule_instance_seq: p.schedule_instance_seq,
      vendor_confirmed: p.vendor_confirmed_at != null,
      refused: p.payment_refused_at != null,
    });
    paymentsByVendor.set(p.vendor_id, mine);
  }
  for (const row of (plans.data ?? []) as Array<{
    event_vendor_id: string;
    instances_json: unknown;
    cleared_at: string | null;
    is_default_seeded: boolean | null;
  }>) {
    const instances: PlanInstance[] = Array.isArray(row.instances_json) ? (row.instances_json as PlanInstance[]) : [];
    out.set(row.event_vendor_id, {
      steps: computeStepper(instances, paymentsByVendor.get(row.event_vendor_id) ?? []),
      clearedAt: row.cleared_at ?? null,
      isDefaultSeeded: row.is_default_seeded ?? false,
    });
  }
  return out;
}
