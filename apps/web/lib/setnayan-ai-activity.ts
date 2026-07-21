/**
 * setnayan-ai-activity.ts — the "what is Setnayan AI actually keeping for THIS
 * event, right now?" loader for the studio buy/active surface.
 *
 * The studio page's ACTIVE state used to say only "your shortlist is ranked"
 * and link to /vendors — it never showed the breadth of what the assistant is
 * continuously doing for the couple (owner note 2026-07-21: "Setnayan AI does
 * not list all the information they provide for this event. Show the value of
 * what they save and what's practically impossible for a person to keep by
 * hand"). This loader produces the LIVE per-event figures that page renders.
 *
 * It is a THIN orchestrator over already-proven pure libs — it invents no
 * business logic:
 *   • buildCockpitModel (setnayan-ai-cockpit)  → the % locked / decisions-need-
 *     you / next-deadline briefing, byte-identical to the couple Overview's.
 *   • pickTodaysOneThing + countUnlockedCategories (todays-one-thing) → the lock
 *     counts + the resolver's #1 task, same as the Overview.
 *   • fetchUpcomingItems (upcoming-items)       → the tracked-deadline + payment-
 *     due figures, from the same source the Home "Needs you" stream reads.
 *
 * HONESTY RULE (owner "no fake doors"): every figure here maps to a capability
 * that is actually WIRED and running (matchmaking, deadline tracking, payment-
 * due + over-budget guards, quiet-vendor chase). Designed-but-dormant guards
 * (price-drop GRD-03, availability-change GRD-09, contract-window GRD-07, the
 * consent-gated Inference/Trend categories) have no live data source — see
 * setnayan-ai-snapshot.ts "Still EMPTY (never fabricate)" — so they are NOT
 * counted here and NOT listed on the surface.
 *
 * Every query fail-softs to empty: a partial-load event still yields a valid
 * (all-zero) activity rather than throwing the couple's page. The event fields
 * are passed in (the page already fetched the event row) so this adds no second
 * events query.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildCockpitModel,
  type CockpitModel,
} from './setnayan-ai-cockpit';
import { PLAN_GROUPS, type EventVendorRowInput } from './wedding-plan-groups';
import { countUnlockedCategories, pickTodaysOneThing } from './todays-one-thing';
import { fetchUpcomingItems } from './upcoming-items';
import {
  DOCUMENT_META,
  completeByDate as paperworkCompleteByDate,
  type PaperworkRow,
} from './paperwork';

/** The live snapshot the studio ACTIVE state renders. */
export type AiActivity = {
  /** The Overview's cockpit briefing + decisions + upcoming, for THIS event. */
  cockpit: CockpitModel;
  /** Saved + booked vendors the assistant watches (silence, payments, progress). */
  vendorsTracked: number;
  /** Vendor payments falling due within the next 30 days. */
  paymentsDue30d: number;
  /** Deadlines under watch — PH-marriage statutory pack + recommended reminders. */
  deadlinesTracked: number;
};

/** Event fields the loader needs — passed in so we don't re-query `events`. */
export type AiActivityEvent = {
  eventDate: string | null;
  eventDatePrecision: string | null;
  eventType: string | null;
  ceremonyType: string | null;
};

/** Whole-day countdown to an ISO date (null when unparseable / absent). Mirrors
 *  the local helper in event-dashboard so daysOut resolves identically. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Assemble the live per-event activity snapshot. Only call this once the caller
 * has already established that Setnayan AI is ACTIVE for the event (this file
 * reports what the assistant is doing; it does not gate on entitlement).
 */
export async function loadAiActivity(
  supabase: SupabaseClient,
  eventId: string,
  event: AiActivityEvent,
  now: Date = new Date(),
): Promise<AiActivity> {
  // Precision resolution — same rule as the Overview: a present date with a
  // null precision column is a real committed 'day'.
  const rawPrecision = event.eventDatePrecision;
  const precision =
    rawPrecision === 'day' || rawPrecision === 'month' || rawPrecision === 'year'
      ? rawPrecision
      : event.eventDate
        ? 'day'
        : 'year';
  const daysOut = precision === 'day' ? daysUntil(event.eventDate) : null;

  // Lean, fail-soft loads — mirror the Overview's selects. Each degrades to
  // empty (Supabase resolves errors as {data:null}; the try/catch also absorbs
  // any thrown exception) so a partial event still renders an honest (zero)
  // figure rather than throwing the couple's page.
  const [vendorsRes, sponsorsRes, paperworkRes, upcoming] = await Promise.all([
    (async () => {
      try {
        return await supabase
          .from('event_vendors')
          .select('vendor_id, vendor_name, category, status, total_cost_php')
          .eq('event_id', eventId)
          .is('archived_at', null)
          .order('created_at', { ascending: true });
      } catch {
        return { data: [] as unknown[] };
      }
    })(),
    (async () => {
      try {
        return await supabase
          .from('event_sponsors')
          .select('sponsor_tier, invitation_status')
          .eq('event_id', eventId);
      } catch {
        return { data: [] as unknown[] };
      }
    })(),
    (async () => {
      try {
        return await supabase
          .from('event_paperwork')
          .select('id, document_type, status, expected_completion_date')
          .eq('event_id', eventId);
      } catch {
        return { data: [] as unknown[] };
      }
    })(),
    fetchUpcomingItems({
      supabase,
      eventId,
      eventDate: event.eventDate,
      ceremonyType: event.ceremonyType,
      now,
      // The count reflects what the assistant CAN track; the couple's reminder
      // toggle governs surfacing, not tracking. Statutory pack is wedding-only.
      remindersEnabled: true,
      statutory: (event.eventType ?? 'wedding') === 'wedding',
      limit: 6,
    }).catch(() => ({
      items: [],
      paymentItemsNext30d: [],
      sourceCounts: {
        meeting: 0,
        schedule_block: 0,
        vendor_payment: 0,
        setnayan_sku_expiry: 0,
        document_deadline: 0,
        recommended_deadline: 0,
      },
    })),
  ]);

  const vendors = (vendorsRes.data ?? []) as ReadonlyArray<EventVendorRowInput>;
  const sponsors = (sponsorsRes.data ?? []) as ReadonlyArray<{
    sponsor_tier: string | null;
    invitation_status: string | null;
  }>;
  const paperworkRows = (paperworkRes.data ?? []) as ReadonlyArray<PaperworkRow>;

  const totalLockableCategories = PLAN_GROUPS.filter(
    (g) => g.countsTowardLockable !== false,
  ).length;
  const lockedVendorCount = Math.max(
    0,
    totalLockableCategories - countUnlockedCategories(vendors),
  );
  const topPriorityTask =
    event.eventDate && precision === 'day'
      ? pickTodaysOneThing(vendors, event.eventDate, now)
      : null;

  const cockpit = buildCockpitModel(
    {
      eventId,
      daysOut,
      lockedVendorCount,
      totalLockableCategories,
      vendors,
      sponsors,
      topPriorityTask,
      paperwork: paperworkRows
        .filter((r) => r.status !== 'received' && r.status !== 'expired')
        .map((r) => ({
          id: r.id,
          label: DOCUMENT_META[r.document_type]?.label ?? 'Paperwork',
          dueIso:
            r.expected_completion_date ??
            paperworkCompleteByDate(r.document_type, event.eventDate),
        })),
    },
    now,
  );

  const deadlinesTracked =
    upcoming.sourceCounts.document_deadline +
    upcoming.sourceCounts.recommended_deadline;

  return {
    cockpit,
    vendorsTracked: vendors.length,
    paymentsDue30d: upcoming.paymentItemsNext30d.length,
    deadlinesTracked,
  };
}

// ---- Live-figure formatters (pure · unit-tested) ---------------------------
// The short peso/percent/count strings the ACTIVE surface appends to each
// capability. Kept here (not inline in the server component) so pluralization
// and the zero-state fallbacks are covered by tests, never fabricated.

const plural = (n: number) => (n === 1 ? '' : 's');

/** "62% locked in · 4 vendors on your board" */
export function figureRanked(a: AiActivity): string {
  return `${a.cockpit.briefing.lockedPct}% locked in · ${a.vendorsTracked} vendor${plural(
    a.vendorsTracked,
  )} on your board`;
}

/** "3 deadlines on watch" — or the reassuring zero-state. */
export function figureDeadlines(a: AiActivity): string {
  return a.deadlinesTracked > 0
    ? `${a.deadlinesTracked} deadline${plural(a.deadlinesTracked)} on watch`
    : 'Nothing overdue — you’re clear';
}

/** "2 decisions waiting on you" — or the calm zero-state. */
export function figureNextMove(a: AiActivity): string {
  const n = a.cockpit.briefing.decisionCount;
  return n > 0
    ? `${n} decision${plural(n)} waiting on you`
    : 'Nothing needs a decision right now';
}

/** "1 payment due in the next 30 days" — or the reassuring zero-state. */
export function figurePayments(a: AiActivity): string {
  const n = a.paymentsDue30d;
  return n > 0
    ? `${n} payment${plural(n)} due in the next 30 days`
    : 'No payments due in the next 30 days';
}
