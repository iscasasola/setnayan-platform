import Link from 'next/link';
import { Circle, CheckCircle2, ArrowRight } from 'lucide-react';
import {
  CHECKLIST_CATEGORY_LABELS,
  checklistItemHref,
  type ChecklistItemView,
} from '@/lib/checklist';
import { toggleChecklistItem } from '../../checklist-actions';

/**
 * ChecklistCard — the home-page "Up next" planning checklist.
 *
 * Shows ONLY the top-N most time-urgent open items for the couple's current
 * runway (ranking done upstream by rankUrgentChecklistItems). Each row has a
 * one-tap complete button (server action) and a due tag. A progress line shows
 * the full count so the couple knows the list is longer than what's surfaced.
 *
 * Server component — toggles are plain <form action> submits (no client JS),
 * matching the schedule toggle-visibility pattern.
 */

type Props = {
  eventId: string;
  items: ReadonlyArray<ChecklistItemView>;
  totalCount: number;
  doneCount: number;
};

/** Soft urgency tint from days-until-due: overdue/this-week reads warm. */
function dueTag(item: ChecklistItemView): { label: string; tint: string } {
  const d = item.daysUntilDue;
  if (d == null) return { label: 'No date set', tint: 'text-ink/45' };
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, tint: 'text-danger-700' };
  if (d === 0) return { label: 'Due today', tint: 'text-danger-700' };
  if (d === 1) return { label: 'Due tomorrow', tint: 'text-warn-700' };
  if (d < 7) return { label: `Due in ${d}d`, tint: 'text-warn-700' };
  if (d < 30) return { label: `Due in ${d}d`, tint: 'text-ink/55' };
  return { label: `Due in ${Math.round(d / 7)}w`, tint: 'text-ink/55' };
}

export function ChecklistCard({ eventId, items, totalCount, doneCount }: Props) {
  if (totalCount === 0) return null;

  const allDone = doneCount >= totalCount;

  return (
    <section aria-labelledby="checklist-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          id="checklist-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          Up next
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
          {doneCount} of {totalCount} done
        </span>
      </div>

      {items.length === 0 || allDone ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-ink/15 bg-cream px-4 py-3 text-sm text-ink/65">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-success-600" strokeWidth={1.75} />
          <span>
            {allDone
              ? 'Every checklist item is done — you’re all set.'
              : 'Nothing urgent right now — you’re ahead of schedule.'}
          </span>
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const tag = dueTag(item);
            const href = checklistItemHref(eventId, item.template_key);
            return (
              <li
                key={item.item_id}
                className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5 sm:px-4 sm:py-3"
              >
                {/* One-tap complete — server action, no client JS. */}
                <form action={toggleChecklistItem} className="shrink-0">
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="item_id" value={item.item_id} />
                  <input type="hidden" name="desired" value="done" />
                  <button
                    type="submit"
                    aria-label={`Mark "${item.title}" done`}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/35 transition hover:text-success-600"
                  >
                    <Circle className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </form>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                  <p className="truncate text-xs">
                    <span className="text-ink/45">
                      {CHECKLIST_CATEGORY_LABELS[item.category]}
                    </span>
                    <span aria-hidden className="text-ink/25"> · </span>
                    <span className={tag.tint}>{tag.label}</span>
                  </p>
                </div>

                {href ? (
                  <Link
                    href={href}
                    aria-label={`Go to ${item.title}`}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-terracotta transition hover:bg-terracotta/10"
                  >
                    <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href={`/dashboard/${eventId}/checklist`}
        className="inline-flex items-center gap-1 text-xs font-medium text-terracotta-700 transition hover:text-terracotta-800"
      >
        View full checklist ({totalCount}) <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
      </Link>
    </section>
  );
}
