'use client';

/**
 * Marketplace calendar intersection banner — Task #45 (2026-05-22).
 *
 * Renders above the vendor grid on /vendors when the host has ≥1 confirmed
 * vendor AND the commonAvailability across those vendors narrows to one of
 * two surface-worthy states inside the event_date_precision window:
 *
 *   - availableDays.length === 0  → conflict — booked vendors share no day
 *     in the window. Host needs to widen or release a vendor.
 *   - availableDays.length ≤ 7    → shortlist — host can pick a specific
 *     day to lock the wedding date right here, before browsing more
 *     candidates against a constraint that already shows zero slack.
 *
 * The "wide" state (≥8 shared days) does not render this banner — the
 * marketplace stays clean; the candidate-filter is still load-bearing
 * (vendors whose calendar doesn't intersect are already dropped server-
 * side), but the banner only fires when the surface-pressure is real.
 *
 * Sibling to the dashboard intersection panel at
 * /dashboard/[eventId]/_components/vendor-availability-intersection.tsx —
 * shares the updateEventDate server action so clicking "Lock this day"
 * collapses the host out of year/month precision into 'day' precision
 * (refine-only ratchet — see actions.ts updateEventDate).
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarRange, Users } from 'lucide-react';
import { updateEventDate } from '@/app/dashboard/[eventId]/actions';

type Props = {
  eventId: string;
  /** ISO date strings YYYY-MM-DD — sorted ascending by the server. */
  availableDays: string[];
  /** Confirmed vendor count — drives banner copy "across your N vendors". */
  lockedCount: number;
  /** Pretty label for the precision window: "August 2027" / "2027". */
  windowLabel: string;
};

export function VendorsAvailabilityBanner({
  eventId,
  availableDays,
  lockedCount,
  windowLabel,
}: Props) {
  const vendorNoun = lockedCount === 1 ? 'vendor' : 'vendors';

  if (availableDays.length === 0) {
    return (
      <div
        role="status"
        className="mt-4 rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/85"
      >
        <div className="flex items-start gap-2">
          <CalendarRange
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
            strokeWidth={1.75}
          />
          <div className="space-y-1">
            <p>
              Your booked vendors have no shared availability in{' '}
              <strong className="font-medium">{windowLabel}</strong>.
            </p>
            <p className="text-xs text-ink/65">
              Widen your date range from{' '}
              <Link
                href={`/dashboard/${eventId}`}
                className="underline underline-offset-2 hover:text-terracotta"
              >
                your event home
              </Link>
              , or release a vendor via the{' '}
              <Link
                href={`/dashboard/${eventId}/vendors`}
                className="underline underline-offset-2 hover:text-terracotta"
              >
                vendor dispute flow
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-4 rounded-lg border border-ink/10 bg-cream px-4 py-3 text-sm"
    >
      <div className="flex items-start gap-2">
        <CalendarRange
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-ink/65"
          strokeWidth={1.75}
        />
        <div className="flex-1 space-y-2">
          <p className="text-ink/85">
            <Users
              aria-hidden
              className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom text-ink/55"
              strokeWidth={1.75}
            />
            <strong className="font-medium">{availableDays.length}</strong>
            {availableDays.length === 1 ? ' day' : ' days'} available across your{' '}
            {lockedCount} booked {vendorNoun} in{' '}
            <strong className="font-medium">{windowLabel}</strong>:{' '}
            <span className="text-ink/75">
              {availableDays.map(prettyDay).join(', ')}
            </span>
            .
          </p>
          <p className="text-xs text-ink/65">
            Pick one to lock your wedding date — only vendors free on that day are
            shown below.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableDays.map((d) => (
              <LockDayButton key={d} eventId={eventId} day={d} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LockDayButton({ eventId, day }: { eventId: string; day: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleLock() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('event_date', day);
    fd.set('precision', 'day');
    startTransition(async () => {
      try {
        await updateEventDate(fd);
        // Server action revalidates the event paths; the marketplace
        // surface will reload with day-precision applied. No client-side
        // navigation needed.
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleLock}
      disabled={isPending}
      aria-label={`Lock wedding date to ${prettyDay(day)}`}
      className="rounded-md border border-ink/15 bg-cream px-2 py-1 text-xs text-ink/80 hover:border-terracotta hover:text-terracotta disabled:opacity-50"
      title={error ?? undefined}
    >
      {isPending ? 'Saving…' : prettyDay(day)}
    </button>
  );
}

function prettyDay(iso: string): string {
  // Parse ISO parts manually to avoid timezone drift on DATE values that
  // arrive as midnight-UTC strings.
  const [yearStr, monthStr, dayStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return iso;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year:
      // Drop the year on within-year windows ("Aug 15" reads cleaner than
      // "Aug 15, 2027" when the banner already shows the year in its
      // window label). Keep the year on year-precision so multi-month
      // displays don't ambiguate ("Aug 15" vs "Aug 15 of next year").
      // Simple heuristic: emit year for non-current-year dates always —
      // safer than threading the precision through.
      d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}
