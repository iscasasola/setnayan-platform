/**
 * wedding-roadmap-signals.ts — derives the couple's planning "signals" (hard,
 * structural completion facts) that feed the Studio "Recommended for you now"
 * strip (lib/studio-recommendations.ts, via studio/page.tsx).
 *
 * History (kept honest): this was extracted 2026-07-10 from the Home "Things to
 * complete" list (`WeddingRoadmapAsync`) to be a shared source of truth. That
 * component was RETIRED 2026-07-11 — the 2026-07-10 refactor made
 * `<EventDashboard>` the event Home and dropped the roadmap surface, which used
 * a different "where are you" model (progress-stages + today's-one-thing). So
 * Studio is now the SOLE consumer, and this powers Studio's own phase-aware
 * recommendation heuristic — NOT a cross-surface contract. `roadmap_completed`
 * has no writer anymore (its check-off UI went with the component), so the
 * `completed` dimension is inert for new couples; existing values still read.
 *
 * Deterministic structural facts only — never AI or inference (same contract as
 * lib/wedding-roadmap.ts). `deriveRoadmapSignals` is a pure derivation;
 * `fetchRoadmapState` is the thin server wrapper that runs the five lightweight
 * reads. (This header used to claim both pure derivations were "unit-tested".
 * Neither had a test file — corrected rather than left standing. The date
 * ladder is now covered by lib/event-dates.test.ts at its new home.)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { earliestKnownEventDate, type EventDateFields } from '@/lib/event-dates';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { monthsUntil, type RoadmapSignals } from '@/lib/wedding-roadmap';

// Canonical reception/ceremony venue categories — reused from PLAN_GROUPS so the
// auto-signal can never drift from the plan-card bucketing. Reception = ['venue'];
// ceremony = ['religious_venue','church_fees'] (kept disjoint by design).
const RECEPTION_VENUE_CATEGORIES = new Set<string>(
  PLAN_GROUPS.find((g) => g.id === 'reception_venue')?.categories ?? [],
);
const CEREMONY_VENUE_CATEGORIES = new Set<string>(
  PLAN_GROUPS.find((g) => g.id === 'ceremony_venue')?.categories ?? [],
);
const VENUE_CATEGORIES = new Set<string>([
  ...RECEPTION_VENUE_CATEGORIES,
  ...CEREMONY_VENUE_CATEGORIES,
]);
// Setnayan capture SKU families (Papic / Panood / Patiktok). Prefix-matched so
// new variants (papic_guest_captures, panood_daily_broadcast, …) still count.
const CAPTURE_SKU_RE = /^(papic|panood|patiktok)/i;

/**
 * The exact `events` columns the roadmap state reads. The three date columns
 * come from `EventDateFields` so this row and the shared ladder can never drift
 * apart — widening the ladder widens the SELECT this type describes.
 */
export type RoadmapEventRow = EventDateFields & {
  roadmap_completed?: string[] | null;
  estimated_budget_centavos?: number | null;
};

// The "earliest chosen date" ladder (committed `event_date` → earliest
// candidate → window start) used to be a local `resolveEarliestDate()` here.
// It now lives in lib/event-dates.ts — a neutral, dependency-free home shared
// with the checklist's deadline anchor, which layers a wedding gate on top of
// the same three steps. The local copy is gone rather than aliased: it had no
// caller outside this file, and leaving an export here would invite a future
// surface to reach the ladder THROUGH this server module (which imports
// Supabase types + lib/events) instead of the pure one. Behaviour is unchanged
// — the two implementations were equivalent on every input.

/**
 * Pure signal derivation from already-fetched rows. A vendor counts as "booked"
 * once its status reaches contracted+ (CONFIRMED_VENDOR_STATUSES). No query, no
 * inference — fully unit-testable.
 */
export function deriveRoadmapSignals(input: {
  event: RoadmapEventRow;
  vendors: ReadonlyArray<{ category: string; status: string | null }>;
  guestCount: number;
  tableCount: number;
  captureServiceKeys: ReadonlyArray<string | null>;
}): RoadmapSignals {
  const isConfirmed = (status: string | null) =>
    status !== null && (CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(status);
  return {
    dateLocked: input.event.event_date != null,
    receptionVenueBooked: input.vendors.some(
      (v) => isConfirmed(v.status) && RECEPTION_VENUE_CATEGORIES.has(v.category),
    ),
    ceremonyVenueBooked: input.vendors.some(
      (v) => isConfirmed(v.status) && CEREMONY_VENUE_CATEGORIES.has(v.category),
    ),
    budgetSet: Number(input.event.estimated_budget_centavos ?? 0) > 0,
    hasGuests: input.guestCount > 0,
    coreVendorBooked: input.vendors.some(
      (v) => isConfirmed(v.status) && !VENUE_CATEGORIES.has(v.category),
    ),
    seatingStarted: input.tableCount > 0,
    setnayanCaptureSet: input.captureServiceKeys.some((k) => CAPTURE_SKU_RE.test(k ?? '')),
  };
}

export type RoadmapState = {
  /** Months to the earliest chosen date, or null when no date/window is set. */
  months: number | null;
  /** Manually checked-off roadmap item keys (`events.roadmap_completed`). */
  completed: string[];
  /** The hard structural completion signals. */
  signals: RoadmapSignals;
  /** The resolved earliest date (yyyy-mm-dd) or null. */
  earliest: string | null;
};

/**
 * Fetch the couple's roadmap state — one `events` read plus four lightweight
 * signal reads (vendors / guest count / table count / capture orders), in
 * parallel. Returns null when the event row is missing. Supabase reads resolve
 * to `{data,error}` rather than throwing, so a flaky signal degrades to
 * "not satisfied" without hiding work or faking completion — same behavior the
 * Home roadmap had inline.
 */
export async function fetchRoadmapState(
  supabase: SupabaseClient,
  eventId: string,
  now: Date,
): Promise<RoadmapState | null> {
  const [evRes, vendorsRes, guestCountRes, tableCountRes, captureRes] = await Promise.all([
    supabase
      // SEC-2b: public.events_host, not public.events — this select names a column
      // (budget / birth data / Drive folder) that is SELECT-denied to `authenticated`
      // on the base table by 20271008731642. The view is the couple/moderator-scoped
      // read path; same columns, same row shape, guests get zero rows.
      .from('events_host')
      .select(
        'event_date, date_candidates, date_window_start, roadmap_completed, estimated_budget_centavos',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase.from('event_vendors').select('category, status').eq('event_id', eventId),
    supabase
      .from('guests')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('event_tables')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_id', eventId),
    supabase
      .from('orders')
      .select('service_key')
      .eq('event_id', eventId)
      .in('status', ['paid', 'fulfilled']),
  ]);

  const ev = evRes.data as RoadmapEventRow | null;
  if (!ev) return null;

  const signals = deriveRoadmapSignals({
    event: ev,
    vendors: (vendorsRes.data ?? []) as { category: string; status: string | null }[],
    guestCount: guestCountRes.count ?? 0,
    tableCount: tableCountRes.count ?? 0,
    captureServiceKeys: ((captureRes.data ?? []) as { service_key: string | null }[]).map(
      (o) => o.service_key,
    ),
  });

  const earliest = earliestKnownEventDate(ev);
  return {
    months: monthsUntil(earliest, now.getTime()),
    completed: (ev.roadmap_completed ?? []) as string[],
    signals,
    earliest,
  };
}
