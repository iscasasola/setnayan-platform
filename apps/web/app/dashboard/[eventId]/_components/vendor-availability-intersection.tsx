'use client';

/**
 * Vendor calendar intersection panel — Task #39 (2026-05-22).
 *
 * Renders below the date row on event home when:
 *   - event_date_precision IS 'year' OR 'month'
 *   - AND confirmedVendorCount > 0
 *
 * Shows the days inside the precision window that work for ALL confirmed
 * vendors. Three render modes by available-day count:
 *   - 0 days     → "No day in {window} works across {N} vendors" + release CTA
 *   - 1-15 days  → inline day chip list, each clickable to finalize
 *   - 16+ days   → "{N} days work" + Browse calendar CTA → modal with grid
 *
 * Clicking any day fires updateEventDate with precision='day' and the
 * chosen day, which collapses the host out of year/month mode into the
 * specific day. Refine-only ratchet: this is a narrowing transition so
 * the server action accepts it even with confirmed vendors.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarRange, Users, X } from 'lucide-react';
import { updateEventDate } from '../actions';
import { formatDayKey } from '@/lib/vendor-availability';

type Props = {
  eventId: string;
  /** ISO date strings YYYY-MM-DD from the server-side intersection query. */
  availableDays: string[];
  confirmedVendorCount: number;
  /** Pretty label for the current window: "August 2027" / "2027". */
  windowLabel: string;
  /** Total days inside the window — informs the empty/many copy. */
  totalDaysInRange: number;
};

const FEW_THRESHOLD = 15;

export function VendorAvailabilityIntersection({
  eventId,
  availableDays,
  confirmedVendorCount,
  windowLabel,
  totalDaysInRange,
}: Props) {
  const vendorNoun = confirmedVendorCount === 1 ? 'vendor' : 'vendors';

  if (availableDays.length === 0) {
    return (
      <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm text-ink/80">
        <div className="flex items-start gap-2">
          <CalendarRange aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="space-y-1">
            <p>
              No day in <strong className="font-medium">{windowLabel}</strong> works across all{' '}
              {confirmedVendorCount} confirmed {vendorNoun}.
            </p>
            <p className="text-xs text-ink/65">
              Widen the window — try a different month or move to year precision — or release a
              vendor via the{' '}
              <Link
                href={`/dashboard/${eventId}/vendors`}
                className="underline hover:text-terracotta"
              >
                Vendors panel
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-cream px-4 py-3 text-sm">
      <div className="flex items-start gap-2">
        <CalendarRange aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/65" strokeWidth={1.75} />
        <div className="flex-1 space-y-2">
          <p className="text-ink/80">
            <Users aria-hidden className="mr-1 inline-block h-3.5 w-3.5 align-text-bottom text-ink/55" strokeWidth={1.75} />
            <strong className="font-medium">{availableDays.length}</strong>
            {availableDays.length === 1 ? ' day works' : ' days work'} for all {confirmedVendorCount}{' '}
            confirmed {vendorNoun} in <strong className="font-medium">{windowLabel}</strong>
            {totalDaysInRange > availableDays.length
              ? ` (of ${totalDaysInRange} possible).`
              : '.'}
          </p>

          {availableDays.length <= FEW_THRESHOLD ? (
            <FewDaysList eventId={eventId} days={availableDays} />
          ) : (
            <ManyDaysCallout eventId={eventId} days={availableDays} />
          )}
        </div>
      </div>
    </div>
  );
}

function FewDaysList({ eventId, days }: { eventId: string; days: string[] }) {
  return (
    <>
      <p className="text-xs text-ink/65">Pick one to finalize your wedding date:</p>
      <div className="flex flex-wrap gap-1.5">
        {days.map((d) => (
          <DayChip key={d} eventId={eventId} day={d} />
        ))}
      </div>
    </>
  );
}

function ManyDaysCallout({ eventId, days }: { eventId: string; days: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-ink/15 px-3 py-1 text-xs font-medium text-ink/80 hover:border-terracotta hover:text-terracotta"
      >
        Browse calendar
      </button>
      {open && <CalendarModal eventId={eventId} days={days} onClose={() => setOpen(false)} />}
    </>
  );
}

function DayChip({ eventId, day }: { eventId: string; day: string }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-ink/15 bg-cream px-2 py-1 text-xs text-ink/80 hover:border-terracotta hover:text-terracotta"
      >
        {prettyDay(day)}
      </button>
      {confirming && (
        <FinalizeDayModal eventId={eventId} day={day} onClose={() => setConfirming(false)} />
      )}
    </>
  );
}

function CalendarModal({
  eventId,
  days,
  onClose,
}: {
  eventId: string;
  days: string[];
  onClose: () => void;
}) {
  // Group available days by month for a friendly browse experience.
  const byMonth = new Map<string, string[]>();
  for (const d of days) {
    const [y, m] = d.split('-');
    const key = `${y}-${m}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(d);
  }
  const months = Array.from(byMonth.keys()).sort();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Browse available days"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Available days</h2>
            <p className="text-sm text-ink/65">
              Days highlighted in terracotta work for all your confirmed vendors. Pick one to
              finalize your wedding date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink/55 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-4">
          {months.map((monthKey) => (
            <div key={monthKey}>
              <h3 className="mb-1.5 text-sm font-medium text-ink/85">
                {prettyMonthKey(monthKey)}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {byMonth.get(monthKey)!.map((d) => (
                  <DayChip key={d} eventId={eventId} day={d} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FinalizeDayModal({
  eventId,
  day,
  onClose,
}: {
  eventId: string;
  day: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('event_date', day);
    fd.set('precision', 'day');
    startTransition(async () => {
      try {
        await updateEventDate(fd);
        onClose();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Finalize wedding date"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-cream p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-semibold text-ink">Finalize your wedding date?</h2>
        <p className="mb-4 text-sm text-ink/75">
          Setting your wedding date to <strong className="font-medium">{prettyDay(day)}</strong>{' '}
          narrows your event to a specific day. All your confirmed vendors are available on this
          date.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:border-ink/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-md bg-mulberry px-3 py-1.5 text-sm font-medium text-cream disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Finalize'}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs text-terracotta">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function prettyDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function prettyMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

// Internal helper to avoid the unused import warning since we re-export
// formatDayKey for callers that need to translate Date → YYYY-MM-DD.
export const _formatDayKey = formatDayKey;
