/**
 * setnayan-ai-snapshot.ts — the DB → PlanningSnapshot adapter (the engine's feed).
 *
 * The trigger engine (setnayan-ai-triggers.ts) is pure: it needs a typed
 * snapshot of an event's planning state. This file ASSEMBLES that snapshot from
 * real tables, then runs triggers → restraint → weekly digest for a user.
 *
 * Sourced inputs (2026-07-09 · the guards-notify build widened the original
 * budget-only money floor):
 *   • payment-due (GRD-01)   ← event_vendor_line_items (amount + due_date) with
 *     per-line settlement via event_vendor_payments.line_item_id
 *   • over-budget (GRD-05)   ← the Overview/progress "committed" formula:
 *     paid+fulfilled orders + contracted-or-better event_vendors cost, vs the
 *     events.estimated_budget_centavos target; pending = pending_payment orders
 *   • statutory (GRD-02)     ← event_paperwork pipeline + lib/paperwork
 *     completeByDate deadline math (wedding-only; the trigger enforces that)
 *   • vendor-quiet (SEC-04)  ← chat_threads with inquiry_status='pending' (the
 *     accept-gate makes pending definitionally unanswered). The vendor's NAME is
 *     deliberately NOT used — pre-accept threads are name-masked to the couple
 *     (chat accept-gate, 2026-06-02), so the slot carries the anonymous
 *     category label ("A photography vendor") instead. No name leak.
 *
 * Still EMPTY (no real data source — never fabricate):
 *   • priceChanges (GRD-03)  — needs the vendor price-change log, the Market
 *     Intelligence spec's net-new table. Nothing records price history today.
 *   • contracts (GRD-07)     — no decision/cancellation-window model exists on
 *     event_vendors or the 0032 contract tables.
 *   • shortlist (SEC-02/03)  — "stuck for N weeks" needs per-category shortlist
 *     age tracking; the build/shortlist models store current state, not history.
 *   • dateClusters (SEC-07)  — no per-vendor availability-by-date signal to
 *     cluster until the availability log lands.
 *
 * The row→snapshot mapping is split into PURE helpers (unit-tested); the DB
 * fetch is a thin wrapper. Consumers: computeUserAiDigest (the account digest
 * render) and lib/setnayan-ai-notify.ts (the guard-notification sweep).
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
  type SnapshotStatutory,
  type SnapshotInquiry,
} from './setnayan-ai-triggers';
import {
  DOCUMENT_META,
  completeByDate,
  type PaperworkDocumentType,
  type PaperworkStatus,
} from './paperwork';
import { statusOfVendor } from './wedding-plan-groups';

/** A budget line item as stored (event_vendor_line_items + the vendor name). */
export type BudgetLineItem = {
  vendorName: string;
  amountPhp: number;
  dueDate: string | null;
  /** event_vendor_line_items.line_item_id — enables per-line settlement. */
  lineItemId?: string | null;
};

// ---- PURE mapping helpers (unit-tested) -------------------------------------

/**
 * Map budget line items → SnapshotPayment[]. Each due-dated item becomes a
 * payment reminder. `paid` resolution, most-specific first:
 *   1. Per-line: payments logged against THIS line (event_vendor_payments.
 *      line_item_id) covering its amount → paid.
 *   2. Whole-event fallback: the event is FULLY settled (total payments ≥ total
 *      line items) → everything paid. (Unlinked payments can't be attributed to
 *      a single line, so all-or-nothing stays the honest rule for them.)
 */
export function paymentsFromBudget(
  lineItems: BudgetLineItem[],
  totalPaymentsPhp: number,
  paidPhpByLineItem?: ReadonlyMap<string, number>,
): SnapshotPayment[] {
  const totalDue = lineItems.reduce((s, li) => s + li.amountPhp, 0);
  const fullySettled = totalDue > 0 && totalPaymentsPhp >= totalDue;
  return lineItems
    .filter((li) => li.dueDate)
    .map((li) => {
      const linePaid =
        li.lineItemId != null &&
        (paidPhpByLineItem?.get(li.lineItemId) ?? 0) >= li.amountPhp;
      return {
        vendor: li.vendorName,
        amountPhp: li.amountPhp,
        dueDate: li.dueDate as string,
        paid: fullySettled || linePaid,
      };
    });
}

/** A paid/fulfilled order row, as the Overview's committed formula reads it. */
export type CommittedOrderRow = {
  confirmedTotalPhp: number | null;
  requestedTotalPhp: number | null;
};

/** An event_vendors row, as the Overview's committed formula reads it. */
export type CommittedVendorRow = {
  status: string | null;
  totalCostPhp: number | null;
  category: string | null;
  vendorName: string | null;
};

/**
 * Map order + vendor rows → SnapshotBudget (or null when no target is set).
 * `committed` is the SAME formula the Overview + /progress pages render (paid +
 * fulfilled orders at confirmed-else-requested totals, plus every
 * contracted-or-better vendor with a known cost — statusOfVendor === 'locked');
 * `pending` is the pending_payment orders total (money already at checkout);
 * `topDriver` is the costliest locked vendor's category. The over-budget
 * trigger fires when committed + pending exceeds the target.
 */
export function budgetFromCommitted(args: {
  targetPhp: number | null;
  paidOrders: CommittedOrderRow[];
  vendors: CommittedVendorRow[];
  pendingOrdersPhp: number;
}): SnapshotBudget | null {
  if (args.targetPhp == null) return null;
  const paidOrdersPhp = args.paidOrders.reduce((s, o) => {
    const amount = o.confirmedTotalPhp ?? o.requestedTotalPhp ?? 0;
    return s + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  let contractedPhp = 0;
  let topDriverCategory: string | undefined;
  let topCost = -1;
  for (const v of args.vendors) {
    if (statusOfVendor(v.status) !== 'locked') continue;
    const cost = Number.isFinite(v.totalCostPhp ?? NaN) ? (v.totalCostPhp as number) : 0;
    contractedPhp += cost;
    if (cost > topCost) {
      topCost = cost;
      topDriverCategory = v.category ?? v.vendorName ?? undefined;
    }
  }
  return {
    totalPhp: args.targetPhp,
    committedPhp: paidOrdersPhp + contractedPhp,
    pendingPhp: Math.max(0, args.pendingOrdersPhp),
    topDriverCategory,
  };
}

/** An event_paperwork row, narrowed to what the statutory mapping needs. */
export type PaperworkStatusRow = {
  documentType: PaperworkDocumentType;
  status: PaperworkStatus;
};

/**
 * Map paperwork-pipeline rows → SnapshotStatutory[]. A document still needs
 * attention while it isn't `received`; its deadline is the lib/paperwork
 * completeByDate (event_date − the document's statute-driven lead time). Rows
 * whose deadline can't be computed (no event date) are skipped — the GRD-02
 * trigger needs a real date to count down to.
 */
export function statutoryFromPaperwork(
  rows: PaperworkStatusRow[],
  eventDate: string | null,
): SnapshotStatutory[] {
  const out: SnapshotStatutory[] = [];
  for (const r of rows) {
    if (r.status === 'received') continue;
    const meta = DOCUMENT_META[r.documentType];
    const deadline = completeByDate(r.documentType, eventDate);
    if (!meta || !deadline) continue;
    out.push({ document: meta.label, deadline });
  }
  return out;
}

/** A pending inquiry thread, narrowed to what the vendor-quiet mapping needs. */
export type PendingInquiryThread = {
  createdAt: string;
  /** vendor_profiles.category (slug) — the only identity-safe label pre-accept. */
  vendorCategory: string | null;
};

/**
 * Map pending inquiry threads → SnapshotInquiry[] (SEC-04 vendor-quiet).
 * Pre-accept threads are NAME-MASKED to the couple (chat accept-gate), so the
 * `{vendor}` slot carries an anonymous category label ("A photography vendor"),
 * never the business name. `replied` is always false here — pending is
 * definitionally unanswered; accepted/declined threads never reach this list.
 */
export function inquiriesFromThreads(
  threads: PendingInquiryThread[],
  now: Date,
): SnapshotInquiry[] {
  return threads.map((t) => {
    const created = new Date(t.createdAt);
    const sentDaysAgo = Number.isNaN(created.getTime())
      ? 0
      : Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
    const categoryLabel = t.vendorCategory
      ? t.vendorCategory.replace(/[_-]+/g, ' ').trim()
      : null;
    return {
      vendor: categoryLabel ? `A ${categoryLabel} vendor` : 'A vendor you inquired with',
      service: categoryLabel ?? 'your inquiry',
      sentDaysAgo,
      replied: false,
    };
  });
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

/**
 * Build a PlanningSnapshot for one event from real data. Every read is
 * fail-soft (a missing table / column leaves that input empty — the triggers
 * simply don't fire); nothing here fabricates a value.
 */
export async function buildPlanningSnapshot(
  admin: SupabaseClient,
  eventId: string,
  eventType: string,
): Promise<PlanningSnapshot> {
  const snap = emptySnapshot(eventType);

  const [
    { data: eventRow },
    { data: lineRows },
    { data: payRows },
    { data: paidOrderRows },
    { data: pendingOrderRows },
    { data: vendorRows },
    { data: paperworkRows },
    { data: threadRows },
  ] = await Promise.all([
    admin
      .from('events')
      .select('event_date, estimated_budget_centavos')
      .eq('event_id', eventId)
      .maybeSingle(),
    admin
      .from('event_vendor_line_items')
      .select('line_item_id, amount_php, due_date, event_vendors(vendor_name)')
      .eq('event_id', eventId),
    admin
      .from('event_vendor_payments')
      .select('amount_php, line_item_id')
      .eq('event_id', eventId),
    admin
      .from('orders')
      .select('requested_total_php, confirmed_total_php')
      .eq('event_id', eventId)
      .in('status', ['paid', 'fulfilled']),
    admin
      .from('orders')
      .select('requested_total_php')
      .eq('event_id', eventId)
      .eq('status', 'pending_payment'),
    admin
      .from('event_vendors')
      .select('status, total_cost_php, category, vendor_name')
      .eq('event_id', eventId)
      .is('archived_at', null),
    admin
      .from('event_paperwork')
      .select('document_type, status')
      .eq('event_id', eventId),
    admin
      .from('chat_threads')
      // vendor_profiles has no `category` column — services[1] is the canonical
      // service slug (the same convention the marketplace bucketing uses).
      .select('created_at, inquiry_status, vendor_profiles(services)')
      .eq('event_id', eventId)
      .eq('inquiry_status', 'pending'),
  ]);

  // --- GRD-01 payments (line items + per-line settlement) --------------------
  const lineItems: BudgetLineItem[] = (lineRows ?? []).map((r) => {
    const ev = (r as { event_vendors?: { vendor_name?: string } | { vendor_name?: string }[] })
      .event_vendors;
    const vendorName = Array.isArray(ev) ? ev[0]?.vendor_name : ev?.vendor_name;
    return {
      vendorName: vendorName ?? 'a vendor',
      amountPhp: Number((r as { amount_php: number }).amount_php) || 0,
      dueDate: (r as { due_date: string | null }).due_date,
      lineItemId: (r as { line_item_id?: string | null }).line_item_id ?? null,
    };
  });
  let totalPaymentsPhp = 0;
  const paidPhpByLineItem = new Map<string, number>();
  for (const p of payRows ?? []) {
    const amount = Number((p as { amount_php: number }).amount_php) || 0;
    totalPaymentsPhp += amount;
    const lineId = (p as { line_item_id?: string | null }).line_item_id;
    if (lineId) paidPhpByLineItem.set(lineId, (paidPhpByLineItem.get(lineId) ?? 0) + amount);
  }
  snap.payments = paymentsFromBudget(lineItems, totalPaymentsPhp, paidPhpByLineItem);

  // --- GRD-05 budget (the Overview's committed-vs-target formula) ------------
  const targetCentavos = (eventRow as { estimated_budget_centavos?: number | string | null } | null)
    ?.estimated_budget_centavos;
  const targetPhp =
    targetCentavos != null && Number.isFinite(Number(targetCentavos))
      ? Number(targetCentavos) / 100
      : null;
  snap.budget = budgetFromCommitted({
    targetPhp,
    paidOrders: (paidOrderRows ?? []).map((o) => ({
      confirmedTotalPhp:
        (o as { confirmed_total_php: number | string | null }).confirmed_total_php != null
          ? Number((o as { confirmed_total_php: number | string }).confirmed_total_php)
          : null,
      requestedTotalPhp:
        (o as { requested_total_php: number | string | null }).requested_total_php != null
          ? Number((o as { requested_total_php: number | string }).requested_total_php)
          : null,
    })),
    vendors: (vendorRows ?? []).map((v) => ({
      status: (v as { status: string | null }).status,
      totalCostPhp:
        (v as { total_cost_php: number | string | null }).total_cost_php != null
          ? Number((v as { total_cost_php: number | string }).total_cost_php)
          : null,
      category: (v as { category: string | null }).category,
      vendorName: (v as { vendor_name: string | null }).vendor_name,
    })),
    pendingOrdersPhp: (pendingOrderRows ?? []).reduce(
      (s, o) => s + (Number((o as { requested_total_php: number | string | null }).requested_total_php) || 0),
      0,
    ),
  });

  // --- GRD-02 statutory (paperwork pipeline + deadline math) ------------------
  const eventDate = (eventRow as { event_date?: string | null } | null)?.event_date ?? null;
  snap.statutory = statutoryFromPaperwork(
    (paperworkRows ?? []).map((r) => ({
      documentType: (r as { document_type: PaperworkDocumentType }).document_type,
      status: (r as { status: PaperworkStatus }).status,
    })),
    eventDate,
  );

  // --- SEC-04 vendor-quiet (pending inquiry threads, name-masked) -------------
  snap.inquiries = inquiriesFromThreads(
    (threadRows ?? []).map((t) => {
      const vp = (t as { vendor_profiles?: { services?: string[] | null } | { services?: string[] | null }[] })
        .vendor_profiles;
      const services = Array.isArray(vp) ? vp[0]?.services : vp?.services;
      return {
        createdAt: (t as { created_at: string }).created_at,
        vendorCategory: services?.[0] ?? null,
      };
    }),
    new Date(),
  );

  // priceChanges / contracts / shortlist / dateClusters stay [] — no honest
  // data source yet (see the header comment for exactly what would populate
  // each). Never fabricate.
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
