import { Check, ListChecks } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { resolveRoadmap, monthsUntil, ROADMAP_TOTAL } from '@/lib/wedding-roadmap';
import { toggleRoadmapItem } from '../actions';

/**
 * WeddingRoadmapAsync — the free "things to complete" list on the couple Home
 * (owner 2026-06-05).
 *
 * The ordered wedding tasks, timed by months-to-EARLIEST-date. The couple TAPS
 * each one done themselves (manual check-off → `toggleRoadmapItem` → removed and
 * stays removed). NO automation: this reads only the event's date + the
 * `roadmap_completed` array — it never inspects vendors/guests/etc. to infer
 * "done." Plain text reminders + a Done button; no links.
 *
 * Self-fetching server component (streams in its own Suspense). Hidden in
 * Manual mode by the Home (same as the rest of the assist).
 */
export async function WeddingRoadmapAsync({
  eventId,
  now,
}: {
  eventId: string;
  now: Date;
}) {
  const supabase = await createClient();
  const { data: ev } = await supabase
    .from('events')
    .select('event_date, date_candidates, date_window_start, roadmap_completed')
    .eq('event_id', eventId)
    .maybeSingle();
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

  const months = monthsUntil(earliest, now.getTime());
  const items = resolveRoadmap(months, completed);

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
          {completed.length}/{ROADMAP_TOTAL} done
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
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                  {item.band}
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
