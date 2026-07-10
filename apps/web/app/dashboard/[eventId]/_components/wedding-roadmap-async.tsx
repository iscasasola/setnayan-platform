import { AlertTriangle, Check, ListChecks } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import {
  resolveRoadmap,
  countRoadmapDone,
  ROADMAP_TOTAL,
} from '@/lib/wedding-roadmap';
import { fetchRoadmapState } from '@/lib/wedding-roadmap-signals';
import { toggleRoadmapItem } from '../actions';

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

  // Single source of truth for "where is this couple?" — one events read + four
  // lightweight signal reads (shared with the Studio recommendation strip so the
  // two can never disagree). Null when the event row is missing. Each signal
  // degrades to "not satisfied" on error, so a flaky query never hides work or
  // fakes completion.
  const state = await fetchRoadmapState(supabase, eventId, now);
  if (!state) return null;
  const { months, completed, signals } = state;

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
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-warn-100 px-1.5 py-px font-medium text-warn-700">
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
                <SubmitButton
                  pendingLabel="Saving…"
                  aria-label={`Mark "${item.label}" done`}
                  className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-paper px-3 py-1 text-[11px] font-medium text-ink/55 transition-colors hover:border-terracotta/40 hover:text-terracotta"
                >
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  Done
                </SubmitButton>
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
