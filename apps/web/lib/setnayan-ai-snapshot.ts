/**
 * setnayan-ai-snapshot.ts — the DB → PlanningSnapshot adapter (the engine's feed).
 *
 * The trigger engine (setnayan-ai-triggers.ts) is pure: it needs a typed
 * snapshot of an event's planning state. This file ASSEMBLES that snapshot from
 * real tables, then runs triggers → restraint → weekly digest for a user.
 *
 * V1 sources the MONEY GUARD FLOOR — the highest-value, cleanest data:
 *   • payment-due (GRD-01)  ← event_vendor_line_items (amount + due_date)
 *   • over-budget (GRD-05)  ← line items vs budget_builds.budget_php
 * The other snapshot fields (statutory, shortlist, price-changes, contracts,
 * inquiries, date-clusters) return EMPTY for now — they slot in unchanged as
 * each data source matures (the triggers already exist). No fabricated data.
 *
 * The row→snapshot mapping is split into PURE helpers (unit-tested); the DB
 * fetch is a thin wrapper. INERT until the per-user flag is on + a surface calls
 * computeUserAiDigest.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { WEDDING_TERMINOLOGY } from './setnayan-ai-templates';
import {
  runTriggers,
  applyRestraint,
  assembleWeeklyDigest,
  type Intervention,
  type PlanningSnapshot,
  type SnapshotPayment,
  type SnapshotBudget,
} from './setnayan-ai-triggers';

/** A budget line item as stored (event_vendor_line_items + the vendor name). */
export type BudgetLineItem = {
  vendorName: string;
  amountPhp: number;
  dueDate: string | null;
};

// ---- PURE mapping helpers (unit-tested) -------------------------------------

/**
 * Map budget line items → SnapshotPayment[]. Each due-dated item becomes a
 * payment reminder; `paid` is true only when the event is FULLY settled (total
 * payments ≥ total line items), so the payment-due trigger surfaces upcoming
 * dues while anything is still owed and goes quiet once everything is paid.
 * (Per-line settlement isn't tracked, so all-or-nothing is the honest rule.)
 */
export function paymentsFromBudget(
  lineItems: BudgetLineItem[],
  totalPaymentsPhp: number,
): SnapshotPayment[] {
  const totalDue = lineItems.reduce((s, li) => s + li.amountPhp, 0);
  const fullySettled = totalDue > 0 && totalPaymentsPhp >= totalDue;
  return lineItems
    .filter((li) => li.dueDate)
    .map((li) => ({
      vendor: li.vendorName,
      amountPhp: li.amountPhp,
      dueDate: li.dueDate as string,
      paid: fullySettled,
    }));
}

/**
 * Map budget totals → SnapshotBudget (or null when no budget is set). committed
 * = paid so far; pending = the rest of the planned spend; topDriver = the vendor
 * with the largest planned spend. The over-budget trigger fires when committed +
 * pending (= total planned) exceeds the budget.
 */
export function budgetFromTotals(
  budgetTotalPhp: number | null,
  lineItems: BudgetLineItem[],
  totalPaymentsPhp: number,
): SnapshotBudget | null {
  if (budgetTotalPhp == null) return null;
  const totalDue = lineItems.reduce((s, li) => s + li.amountPhp, 0);
  const byVendor = new Map<string, number>();
  for (const li of lineItems) {
    byVendor.set(li.vendorName, (byVendor.get(li.vendorName) ?? 0) + li.amountPhp);
  }
  let topDriverCategory: string | undefined;
  let topAmount = -1;
  for (const [vendor, amount] of byVendor) {
    if (amount > topAmount) {
      topAmount = amount;
      topDriverCategory = vendor;
    }
  }
  return {
    totalPhp: budgetTotalPhp,
    committedPhp: totalPaymentsPhp,
    pendingPhp: Math.max(0, totalDue - totalPaymentsPhp),
    topDriverCategory,
  };
}

/** An empty snapshot for a given event type — the no-fabrication baseline. */
function emptySnapshot(eventType: string): PlanningSnapshot {
  return {
    eventType,
    payments: [],
    statutory: [],
    shortlist: [],
    priceChanges: [],
    contracts: [],
    inquiries: [],
    budget: null,
    dateClusters: [],
  };
}

// ---- DB wrapper -------------------------------------------------------------

/** Build a PlanningSnapshot for one event from real budget data (money floor). */
export async function buildPlanningSnapshot(
  admin: SupabaseClient,
  eventId: string,
  eventType: string,
): Promise<PlanningSnapshot> {
  const snap = emptySnapshot(eventType);

  const [{ data: lineRows }, { data: payRows }, { data: buildRows }] = await Promise.all([
    admin
      .from('event_vendor_line_items')
      .select('amount_php, due_date, event_vendors(vendor_name)')
      .eq('event_id', eventId),
    admin.from('event_vendor_payments').select('amount_php').eq('event_id', eventId),
    admin
      .from('budget_builds')
      .select('budget_php, updated_at')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false })
      .limit(1),
  ]);

  const lineItems: BudgetLineItem[] = (lineRows ?? []).map((r) => {
    const ev = (r as { event_vendors?: { vendor_name?: string } | { vendor_name?: string }[] })
      .event_vendors;
    const vendorName = Array.isArray(ev) ? ev[0]?.vendor_name : ev?.vendor_name;
    return {
      vendorName: vendorName ?? 'a vendor',
      amountPhp: Number((r as { amount_php: number }).amount_php) || 0,
      dueDate: (r as { due_date: string | null }).due_date,
    };
  });
  const totalPaymentsPhp = (payRows ?? []).reduce(
    (s, p) => s + (Number((p as { amount_php: number }).amount_php) || 0),
    0,
  );
  const budgetTotalPhp =
    buildRows && buildRows[0] && (buildRows[0] as { budget_php: number | null }).budget_php != null
      ? Number((buildRows[0] as { budget_php: number }).budget_php)
      : null;

  snap.payments = paymentsFromBudget(lineItems, totalPaymentsPhp);
  snap.budget = budgetFromTotals(budgetTotalPhp, lineItems, totalPaymentsPhp);
  return snap;
}

/**
 * Compute the weekly digest + interventions for a USER across all their couple
 * events. Aggregates each event's snapshot through the trigger engine, applies
 * restraint once over the combined set, and assembles the SEC-01 receipt.
 * Returns the rendered digest + the surfaced interventions (empty-safe).
 */
export async function computeUserAiDigest(
  admin: SupabaseClient,
  userId: string,
  now: Date,
): Promise<{ digest: string; interventions: Intervention[] }> {
  const { data: memberRows } = await admin
    .from('event_members')
    .select('event_id, events(event_type)')
    .eq('user_id', userId)
    .eq('member_type', 'couple');

  const events = (memberRows ?? []).map((m) => {
    const ev = (m as { events?: { event_type?: string } | { event_type?: string }[] }).events;
    const eventType = (Array.isArray(ev) ? ev[0]?.event_type : ev?.event_type) ?? 'wedding';
    return { eventId: (m as { event_id: string }).event_id, eventType };
  });

  if (events.length === 0) {
    const empty = emptySnapshot('wedding');
    return { digest: assembleWeeklyDigest([], empty, now, WEDDING_TERMINOLOGY), interventions: [] };
  }

  const snapshots = await Promise.all(
    events.map((e) => buildPlanningSnapshot(admin, e.eventId, e.eventType)),
  );
  const raw = snapshots.flatMap((s) => runTriggers(s, now));
  const interventions = applyRestraint(raw);
  // Digest over the first event's snapshot (for the horizon line) + all interventions.
  const digest = assembleWeeklyDigest(interventions, snapshots[0]!, now, WEDDING_TERMINOLOGY);
  return { digest, interventions };
}
