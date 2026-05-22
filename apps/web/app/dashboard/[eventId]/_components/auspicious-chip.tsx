/**
 * Phase 0 Date Selection — event-home auspicious chip (server component).
 *
 * Renders one of two states on event home, just below the welcome strip
 * and above the inline date input:
 *
 *   (a) date_status='locked' → polite chip "⭐ Your date · {date} · See why
 *       this date works ▸" that links to /dashboard/[eventId]/date-selection.
 *       Tapping the chip opens the full Phase 0 surface where the
 *       AuspiciousCard renders inline alongside the calendar picker (so the
 *       host can review the reasoning + re-pick).
 *   (b) date_status != 'locked' → a small "Pick your date →" prompt that
 *       routes to the same surface for the host to enter the flow.
 *
 * Per CLAUDE.md 2026-05-22 Phase 0 lock — every string is polite brand
 * voice, no dev text post-launch per [[feedback_setnayan_no_dev_text_post_launch]].
 *
 * Per orphan-prevention rule — these are the two canonical entry points
 * from event home to /dashboard/[eventId]/date-selection.
 */

import { Sparkles, ChevronRight, CalendarHeart } from 'lucide-react';
import { formatAuspiciousDate } from '@/lib/auspicious-date';

type Props = {
  eventId: string;
  /** YYYY-MM-DD or null */
  eventDate: string | null;
  /** From events.date_status — drives which variant renders. */
  dateStatus: string | null;
};

export function AuspiciousChip({ eventId, eventDate, dateStatus }: Props) {
  const href = `/dashboard/${eventId}/date-selection`;

  // Locked state — show the date + invitation to see why it works.
  if (dateStatus === 'locked' && eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return (
      <a
        href={href}
        className="group inline-flex w-full items-center gap-2.5 rounded-full border border-terracotta/30 bg-terracotta/[0.06] px-4 py-2 text-sm text-ink/85 transition-colors hover:border-terracotta/55 hover:bg-terracotta/[0.10] sm:w-auto"
      >
        <Sparkles
          aria-hidden
          className="h-4 w-4 flex-shrink-0 text-terracotta"
          strokeWidth={1.75}
        />
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Your date
          </span>
          <span className="font-display text-base italic text-ink">
            {formatAuspiciousDate(eventDate)}
          </span>
          <span className="text-xs text-ink/60">See why this date works</span>
        </span>
        <ChevronRight
          aria-hidden
          className="ml-auto h-4 w-4 flex-shrink-0 text-ink/45 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
          strokeWidth={1.75}
        />
      </a>
    );
  }

  // Unlocked / tentative / undecided — soft prompt.
  return (
    <a
      href={href}
      className="group inline-flex w-full items-center gap-2.5 rounded-full border border-ink/15 bg-cream px-4 py-2 text-sm text-ink/75 transition-colors hover:border-terracotta/45 hover:bg-terracotta/[0.04] hover:text-ink sm:w-auto"
    >
      <CalendarHeart
        aria-hidden
        className="h-4 w-4 flex-shrink-0 text-terracotta"
        strokeWidth={1.75}
      />
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          Phase 0
        </span>
        <span className="text-sm font-medium text-ink">Pick your date</span>
        <span className="hidden text-xs text-ink/55 sm:inline">
          {dateStatus === 'tentative' ? 'Continue from where you left off' : 'Start with the most loved moment'}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="ml-auto h-4 w-4 flex-shrink-0 text-ink/45 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
        strokeWidth={1.75}
      />
    </a>
  );
}
