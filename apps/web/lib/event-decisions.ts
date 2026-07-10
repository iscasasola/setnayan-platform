/**
 * event-decisions.ts — "what needs your decision now?" per event, for the
 * launcher cards (owner 2026-07-10: "show how many tasks need decision now …
 * this applies to all"). The chosen reporting shape is a NAMED action line, not
 * a bare count badge — the card says WHAT before you click.
 *
 * There is deliberately NO reusable notifications aggregation to lean on: the
 * top-bar bell is a flat per-user unread count with no event scoping and no
 * "actionable" flag, so each signal is its own query.
 *
 * Phase 1 (this file) counts three signals, all cheap + batchable across a
 * user's events, no schema change:
 *   • pay      ← orders in `awaiting_payment` (couple owes money on an order)
 *   • approve  ← vendor_proposals in `sent`/`viewed` (a vendor is waiting on the
 *                couple's yes/no)
 *   • overdue  ← checklist items past their derived due date (computed by the
 *                caller, which already loads the checklist for the progress ring)
 *
 * Phase 2 (follow-up PR) adds `message` (unread threads per event) — that one
 * needs a new grouped read-only RPC, since the shipped counter flattens to a
 * single number across the whole account.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type DecisionKind = 'pay' | 'approve' | 'overdue';

/** The raw per-event counts this module resolves (overdue is merged in by the
 *  caller from the checklist it already holds). */
export type EventDecisionCounts = {
  pay: number;
  approve: number;
  overdue: number;
};

export type EventDecisionSummary = {
  /** Open decisions across every counted kind. */
  total: number;
  /** The single highest-priority action to surface on the card, or null when
   *  nothing needs the couple. */
  top: { kind: DecisionKind; count: number; label: string } | null;
};

/**
 * Batched per-event counts for the two DB-backed signals (pay + approve), across
 * ALL the passed events in two queries total. Every event id is seeded to zero
 * so the caller always gets a complete map. Fully graceful-degrading: a failed
 * query contributes zero rather than throwing — the launcher must render.
 */
export async function fetchEventDecisionCounts(
  supabase: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, { pay: number; approve: number }>> {
  const out = new Map<string, { pay: number; approve: number }>();
  for (const id of eventIds) out.set(id, { pay: 0, approve: 0 });
  if (eventIds.length === 0) return out;

  try {
    const [paysRes, proposalsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('event_id')
        .in('event_id', eventIds)
        // `awaiting_payment` is the couple-facing "needs to be paid" order_status
        // (NOT 'pending_payment', which is not an enum member).
        .eq('status', 'awaiting_payment'),
      supabase
        .from('vendor_proposals')
        .select('event_id')
        .in('event_id', eventIds)
        // `sent` + `viewed` are the two states the accept flow acts on — a vendor
        // proposal awaiting the couple's decision.
        .in('status', ['sent', 'viewed']),
    ]);

    for (const row of (paysRes.data ?? []) as Array<{
      event_id: string | null;
    }>) {
      const s = row.event_id ? out.get(row.event_id) : undefined;
      if (s) s.pay += 1;
    }
    for (const row of (proposalsRes.data ?? []) as Array<{
      event_id: string | null;
    }>) {
      const s = row.event_id ? out.get(row.event_id) : undefined;
      if (s) s.approve += 1;
    }
  } catch {
    // graceful-degrade: return the zero-seeded map so the launcher still renders.
  }
  return out;
}

/** Pluralize "N thing" / "N things" — the labels are all count-led. */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Fold raw counts into the card summary. Priority order for the single surfaced
 * line: settle payments first (an unpaid order blocks the service), then approve
 * proposals (a vendor is actively waiting), then clear overdue tasks. Pure —
 * unit-testable, no I/O.
 */
export function summarizeEventDecisions(
  counts: EventDecisionCounts,
): EventDecisionSummary {
  const total = counts.pay + counts.approve + counts.overdue;
  if (total === 0) return { total: 0, top: null };

  let top: EventDecisionSummary['top'];
  if (counts.pay > 0) {
    top = {
      kind: 'pay',
      count: counts.pay,
      label: plural(counts.pay, 'payment to settle', 'payments to settle'),
    };
  } else if (counts.approve > 0) {
    top = {
      kind: 'approve',
      count: counts.approve,
      label: plural(counts.approve, 'quote to approve', 'quotes to approve'),
    };
  } else {
    top = {
      kind: 'overdue',
      count: counts.overdue,
      label: plural(counts.overdue, 'task overdue', 'tasks overdue'),
    };
  }
  return { total, top };
}
