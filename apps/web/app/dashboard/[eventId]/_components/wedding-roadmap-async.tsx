import { AlertTriangle, Check, ListChecks } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  resolveRoadmap,
  countRoadmapDone,
  monthsUntil,
  ROADMAP_TOTAL,
  type RoadmapSignals,
} from '@/lib/wedding-roadmap';
import { toggleRoadmapItem } from '../actions';

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
 * WeddingRoadmapAsync — the free "things to complete" list on the couple Home
 * (owner 2026-06-05 · hybrid auto/manual 2026-06-05).
 *
 * The ordered wedding tasks, timed by months-to-EARLIEST-date. HYBRID
 * completion: 8 "confirmable" items auto-check the moment the app sees a hard
 * structural fact — date committed, a vendor in that category at status
 * contracted+, a count > 0, a paid capture order — and the remaining 3
 * (reception look, save-the-dates, invitations) plus any auto item the app
 * can't yet confirm keep the couple's manual Done button (→ `toggleRoadmapItem`
 * → removed and stays removed), so nobody is ever stuck. Still NOT Today's-Focus
 * automation: deterministic signals only, no AI/inference. Plain text reminders;
 * no links.
 *
 * Self-fetching server component (streams in its own Suspense). Reads the event
 * row + four lightweight signal queries (vendors / guest count / table count /
 * capture orders), each degrading to "not satisfied" on error. Hidden in Manual
 * mode by the Home (same as the rest of the assist).
 */
export async function WeddingRoadmapAsync({
  eventId,
  now,
}: {
  eventId: string;
  now: Date;
}) {
  const supabase = await createClient();

  // One events read + four lightweight signal reads, in parallel. Each signal
  // degrades to "not satisfied" on error (the item then stays a manual Done), so
  // a flaky query never hides work or fakes completion.
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

  const ev = evRes.data;
  if (!ev) return null;

  // Earliest chosen date — committed date → earliest candidate → window start
  // (same anchor the countdown uses). ISO yyyy-mm-dd sorts chronologically.
  const candidates = (
    ((ev as { date_candidates?: string[] | null }).date_candidates ?? []) as string[]
  )
    .filter(Boolean)
    .slice()
    .sort();
  const earliest =
    (ev as { event_date?: string | null }).event_date ??
    candidates[0] ??
    (ev as { date_window_start?: string | null }).date_window_start ??
    null;
  const completed = ((ev as { roadmap_completed?: string[] | null }).roadmap_completed ??
    []) as string[];

  // ── Hybrid auto-signals (owner 2026-06-05) ────────────────────────────────
  // Deterministic structural facts only — never inference. A vendor counts as
  // "booked" once its status reaches contracted+ (CONFIRMED_VENDOR_STATUSES).
  const vendors = (vendorsRes.data ?? []) as { category: string; status: string | null }[];
  const isConfirmed = (status: string | null) =>
    status !== null && (CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(status);
  const captures = (captureRes.data ?? []) as { service_key: string | null }[];

  const signals: RoadmapSignals = {
    dateLocked: (ev as { event_date?: string | null }).event_date != null,
    receptionVenueBooked: vendors.some(
      (v) => isConfirmed(v.status) && RECEPTION_VENUE_CATEGORIES.has(v.category),
    ),
    ceremonyVenueBooked: vendors.some(
      (v) => isConfirmed(v.status) && CEREMONY_VENUE_CATEGORIES.has(v.category),
    ),
    budgetSet:
      Number(
        (ev as { estimated_budget_centavos?: number | null }).estimated_budget_centavos ?? 0,
      ) > 0,
    hasGuests: (guestCountRes.count ?? 0) > 0,
    coreVendorBooked: vendors.some(
      (v) => isConfirmed(v.status) && !VENUE_CATEGORIES.has(v.category),
    ),
    seatingStarted: (tableCountRes.count ?? 0) > 0,
    setnayanCaptureSet: captures.some((o) => CAPTURE_SKU_RE.test(o.service_key ?? '')),
  };

  const months = monthsUntil(earliest, now.getTime());
  // Show 3 at a time (owner 2026-06-05), overdue-first. The list refills as
  // items complete — this server component re-runs on every revalidate, so the
  // next-most-urgent open item slides into the freed slot. The done count below
  // stays over the full 11-item flow.
  const items = resolveRoadmap(months, completed, signals, 3);
  const doneCount = countRoadmapDone(completed, signals);

  const monthsLabel =
    months === null
      ? null
      : months <= 1
        ? 'Your date is close'
        : `~${Math.round(months)} months to your date`;

  return (
    <section
      aria-labelledby="roadmap-heading"
      className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id="roadmap-heading"
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta"
          >
            <ListChecks aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Things to complete
          </h2>
          {monthsLabel ? <p className="text-xs text-ink/55">{monthsLabel}</p> : null}
        </div>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {doneCount}/{ROADMAP_TOTAL} done
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-ink/15 bg-paper px-3 py-3 text-sm text-ink/65">
          You&rsquo;re on track — nothing to complete right now. The next steps
          appear as your date gets closer.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-ink/10">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-ink/85">{item.label}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                  <span>{item.band}</span>
                  {item.overdue ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px font-medium text-amber-700">
                      <AlertTriangle aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
                      Overdue
                    </span>
                  ) : null}
                </p>
              </div>
              {/* Manual check-off — server-action form, no client JS, no link. */}
              <form action={toggleRoadmapItem} className="shrink-0">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="item_key" value={item.key} />
                <button
                  type="submit"
                  aria-label={`Mark "${item.label}" done`}
                  className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-paper px-3 py-1 text-[11px] font-medium text-ink/55 transition-colors hover:border-terracotta/40 hover:text-terracotta"
                >
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Done
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WeddingRoadmapSkeleton() {
  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="h-3 w-48 animate-pulse rounded bg-ink/10" />
            <div className="h-6 w-14 animate-pulse rounded-full bg-ink/10" />
          </div>
        ))}
      </div>
    </section>
  );
}
