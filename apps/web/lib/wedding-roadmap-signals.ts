/**
 * wedding-roadmap-signals.ts — the ONE place the couple's roadmap "signals"
 * (hard, structural completion facts) are derived, so every surface that asks
 * "where is this couple in their planning?" reads the SAME answer.
 *
 * Extracted 2026-07-10 from wedding-roadmap-async.tsx (the free Home "Things to
 * complete" list), which now imports `fetchRoadmapState` instead of building
 * signals inline. The Studio "Recommended for you now" strip
 * (lib/studio-recommendations.ts, via studio/page.tsx) consumes the same state —
 * previously it guessed from the raw date alone, so Studio could push day-of
 * capture while the couple was still behind on foundations. Sharing this helper
 * is what keeps Studio and the Home roadmap from disagreeing.
 *
 * Deterministic structural facts only — never AI or inference (same contract as
 * lib/wedding-roadmap.ts). The pure derivations (`resolveEarliestDate`,
 * `deriveRoadmapSignals`) are unit-tested; `fetchRoadmapState` is the thin
 * server wrapper that runs the five lightweight reads.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
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

/** The exact `events` columns the roadmap state reads. */
export type RoadmapEventRow = {
  event_date?: string | null;
  date_candidates?: string[] | null;
  date_window_start?: string | null;
  roadmap_completed?: string[] | null;
  estimated_budget_centavos?: number | null;
};

/**
 * Earliest chosen date — committed `event_date` → earliest candidate → window
 * start (the same anchor the countdown + roadmap use). ISO yyyy-mm-dd sorts
 * chronologically. This is deliberately precision-agnostic: planning timing
 * starts as soon as there's ANY target, even a rough window — the app's
 * canonical answer to "how far out are we for planning?".
 */
export function resolveEarliestDate(ev: RoadmapEventRow): string | null {
  const candidates = ((ev.date_candidates ?? []) as string[])
    .filter(Boolean)
    .slice()
    .sort();
  return ev.event_date ?? candidates[0] ?? ev.date_window_start ?? null;
}

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
      .from('events')
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

  const earliest = resolveEarliestDate(ev);
  return {
    months: monthsUntil(earliest, now.getTime()),
    completed: (ev.roadmap_completed ?? []) as string[],
    signals,
    earliest,
  };
}
