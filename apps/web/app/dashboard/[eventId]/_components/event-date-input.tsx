'use client';

/**
 * Inline wedding-date editor on event home. Task #39 (2026-05-22) adds
 * 3-mode precision selection: year (lowest commitment, "Sometime in 2027"),
 * month ("August 2027"), or day (full specific date). Hosts start at year
 * precision by default and narrow as their plans solidify.
 *
 * Refine-only ratchet: when the host has confirmed vendors, the precision
 * selector hides the wider modes (year/month) once they've narrowed to
 * day. The server action runs the same gate as defense-in-depth.
 *
 * Per the 2026-05-21 owner directive: hosts need a place to input the
 * wedding date. This is the V1 implementation — a focused inline form
 * on event home. A fuller "Event basics" settings page can layer on top
 * in V1.x.
 */

import { useState, useTransition } from 'react';
import { CalendarDays, Lock, Pencil } from 'lucide-react';
import { updateEventDate } from '../actions';
import {
  formatEventDateWithPrecision,
  PRECISION_ORDER,
  type EventDatePrecision,
} from '@/lib/events';

type Props = {
  eventId: string;
  /** YYYY-MM-DD or null when not yet set */
  initial: string | null;
  /** 'year' | 'month' | 'day' — defaults to 'year' for new events */
  initialPrecision?: EventDatePrecision;
  /**
   * Task #37 (2026-05-22) — count of vendors at-or-past `contracted`.
   * When ≥1, the Edit affordance is replaced with a locked tooltip
   * pointing the host at support (mirrors the 2026-05-17 § 10 date-edit
   * gate). Defaults to 0 to preserve the prior unlocked behavior for
   * any caller that hasn't passed the prop yet.
   *
   * Task #39 — also gates the refine-only ratchet: wider precisions
   * disappear from the selector once ≥1 confirmed vendor exists AND the
   * host is currently at narrower precision.
   */
  confirmedVendorCount?: number;
  /**
   * Task #65 (2026-05-22) — when true, the editor mounts directly into
   * edit mode (skips the read-mode chip + Edit button entirely). Used by
   * the consolidated EventMetaLine component which already renders the
   * meta line + pencil affordance externally; the embedded editor only
   * needs to surface the form.
   */
  autoEdit?: boolean;
  /**
   * Task #65 — optional callback fired when the host saves the date
   * successfully OR clicks Cancel. Used by EventMetaLine to dismiss the
   * outer wrapper without leaving a stale read-mode chip behind.
   */
  onClose?: () => void;
};

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth() + 1; // 1-12
// Task #41 (2026-05-22) — YEAR_OPTIONS starts at CURRENT_YEAR so past
// years can never be picked. 6 options = currentYear … currentYear+5.
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);
// ISO today, used as the `min` attr on the day-precision date input so
// the native picker disables past dates entirely.
const TODAY_ISO = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}`;
const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function EventDateInput({
  eventId,
  initial,
  initialPrecision = 'year',
  confirmedVendorCount = 0,
  autoEdit = false,
  onClose,
}: Props) {
  const dateLocked = confirmedVendorCount > 0 && Boolean(initial);
  // Task #65 — autoEdit forces edit mode on first mount (unless locked).
  // Otherwise preserve the prior behavior: edit when there's no initial
  // value, read when there is one.
  const [editing, setEditing] = useState((!initial || autoEdit) && !dateLocked);
  const [precision, setPrecision] = useState<EventDatePrecision>(initialPrecision);

  // Derive initial part-state from the stored event_date placeholder.
  // Task #41 (2026-05-22) — if the stored event_date is already in the
  // past (e.g. the "Bonbon and Chihuahua" Jan 2026 event surfaced this
  // bug), snap the editor's defaults to currentYear so the host doesn't
  // see a past selection pre-populated in the picker. The pretty display
  // (when not editing) still shows the original value via the parent
  // page's warning chip + EventDateInput's read-mode rendering.
  const initialParts = parseParts(initial);
  const safeYear =
    initialParts.year && initialParts.year >= CURRENT_YEAR
      ? initialParts.year
      : CURRENT_YEAR;
  const safeMonth =
    initialParts.year && initialParts.year > CURRENT_YEAR
      ? initialParts.month ?? 1
      : Math.max(initialParts.month ?? CURRENT_MONTH, CURRENT_MONTH);
  const safeDay =
    initial && !isInitialDayInPast(initial) ? initial : '';
  const [year, setYear] = useState<number>(safeYear);
  const [month, setMonth] = useState<number>(safeMonth);
  const [dayDraft, setDayDraft] = useState<string>(safeDay);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Refine-only ratchet: with ≥1 confirmed vendor, widening is blocked.
  // We hide modes wider than the host's current saved precision.
  const minPrecisionAllowed: EventDatePrecision =
    confirmedVendorCount > 0 ? initialPrecision : 'year';
  const visibleModes: EventDatePrecision[] = (['year', 'month', 'day'] as const).filter(
    (p) => PRECISION_ORDER[p] >= PRECISION_ORDER[minPrecisionAllowed],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Build the event_date placeholder per precision.
    let eventDateStr: string | null = null;
    if (precision === 'year') {
      eventDateStr = `${year}-01-01`;
    } else if (precision === 'month') {
      eventDateStr = `${year}-${pad(month)}-01`;
    } else {
      // day mode — validate the day input
      if (!dayDraft || !/^\d{4}-\d{2}-\d{2}$/.test(dayDraft)) {
        setError('Pick a specific date.');
        return;
      }
      eventDateStr = dayDraft;
    }

    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('event_date', eventDateStr);
    fd.set('precision', precision);

    startTransition(async () => {
      try {
        await updateEventDate(fd);
        setEditing(false);
        // Task #65 — bubble up close signal to the EventMetaLine wrapper
        // so the inline editor dismisses cleanly on save instead of
        // collapsing into a duplicate read-mode chip beneath the meta line.
        onClose?.();
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  if (!editing && initial) {
    const pretty = formatEventDateWithPrecision(initial, initialPrecision);
    const noun = confirmedVendorCount === 1 ? 'vendor' : 'vendors';
    const lockTooltip = `Date is locked — ${confirmedVendorCount} confirmed ${noun}. Contact support to discuss changes.`;
    return (
      <div className="flex items-center gap-2 text-sm text-ink/70">
        <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>
          Wedding date · <strong className="font-medium text-ink">{pretty}</strong>
        </span>
        {dateLocked && initialPrecision === 'day' ? (
          <>
            <Lock aria-hidden className="h-3.5 w-3.5 text-ink/50" strokeWidth={1.75} />
            <button
              type="button"
              disabled
              title={lockTooltip}
              aria-label={lockTooltip}
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-ink/10 px-2 py-0.5 text-xs text-ink/45"
            >
              <Pencil aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Edit
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              // Task #41 — re-snap to future-safe defaults when re-opening
              // the editor so a past stored value never pre-populates the
              // picker.
              const parts = parseParts(initial);
              const reopenYear =
                parts.year && parts.year >= CURRENT_YEAR
                  ? parts.year
                  : CURRENT_YEAR;
              const reopenMonth =
                parts.year && parts.year > CURRENT_YEAR
                  ? parts.month ?? 1
                  : Math.max(parts.month ?? CURRENT_MONTH, CURRENT_MONTH);
              setYear(reopenYear);
              setMonth(reopenMonth);
              setDayDraft(initial && !isInitialDayInPast(initial) ? initial : '');
              setPrecision(initialPrecision);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2 py-0.5 text-xs text-ink/70 hover:border-ink/30 hover:text-ink"
            aria-label="Edit wedding date"
          >
            <Pencil aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm text-ink/70">
        <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Wedding date</span>
      </div>

      {/* Precision selector — segmented control */}
      <div
        role="radiogroup"
        aria-label="Date precision"
        className="flex flex-col gap-1 sm:flex-row sm:gap-0 sm:rounded-md sm:border sm:border-ink/15 sm:bg-cream sm:p-0.5"
      >
        {visibleModes.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={precision === mode}
            onClick={() => setPrecision(mode)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              precision === mode
                ? 'bg-terracotta text-cream'
                : 'text-ink/65 hover:text-ink'
            }`}
          >
            {modeLabel(mode)}
          </button>
        ))}
      </div>

      {/* Per-mode input */}
      <div className="flex flex-wrap items-center gap-2">
        {precision === 'year' && (
          <select
            aria-label="Year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-ink/15 bg-cream px-2 py-1 text-sm focus:border-terracotta focus:outline-none"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}

        {precision === 'month' && (
          <>
            {/* Task #41 — when the host has picked the current year, only
               surface months ≥ current month so a past month-year combo
               can never be selected. Future years show all 12 months. */}
            <select
              aria-label="Month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-md border border-ink/15 bg-cream px-2 py-1 text-sm focus:border-terracotta focus:outline-none"
            >
              {MONTH_OPTIONS.filter((m) =>
                year > CURRENT_YEAR ? true : m.value >= CURRENT_MONTH,
              ).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={year}
              onChange={(e) => {
                const next = Number(e.target.value);
                setYear(next);
                // Task #41 — if switching to current year, clamp month
                // up to current month so a stale past-month selection
                // can't be smuggled in by toggling year back down.
                if (next === CURRENT_YEAR && month < CURRENT_MONTH) {
                  setMonth(CURRENT_MONTH);
                }
              }}
              className="rounded-md border border-ink/15 bg-cream px-2 py-1 text-sm focus:border-terracotta focus:outline-none"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        )}

        {precision === 'day' && (
          <input
            type="date"
            aria-label="Specific date"
            value={dayDraft}
            min={TODAY_ISO}
            onChange={(e) => setDayDraft(e.target.value)}
            className="rounded-md border border-ink/15 bg-cream px-2 py-1 text-sm focus:border-terracotta focus:outline-none"
          />
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-mulberry px-3 py-1 text-xs font-medium text-cream disabled:opacity-50"
        >
          {isPending ? 'Saving…' : initial ? 'Save' : 'Save date'}
        </button>

        {(initial || (autoEdit && onClose)) && (
          <button
            type="button"
            onClick={() => {
              // Task #41 — re-snap to future-safe defaults when re-opening
              // the editor so a past stored value never pre-populates the
              // picker.
              if (initial) {
                const parts = parseParts(initial);
                const reopenYear =
                  parts.year && parts.year >= CURRENT_YEAR
                    ? parts.year
                    : CURRENT_YEAR;
                const reopenMonth =
                  parts.year && parts.year > CURRENT_YEAR
                    ? parts.month ?? 1
                    : Math.max(parts.month ?? CURRENT_MONTH, CURRENT_MONTH);
                setYear(reopenYear);
                setMonth(reopenMonth);
                setDayDraft(initial && !isInitialDayInPast(initial) ? initial : '');
                setPrecision(initialPrecision);
              }
              setError(null);
              setEditing(false);
              // Task #65 — also dismiss the EventMetaLine wrapper.
              onClose?.();
            }}
            className="rounded-md border border-ink/15 px-3 py-1 text-xs text-ink/65 hover:border-ink/30"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-terracotta">
          {error}
        </p>
      )}
    </form>
  );
}

function modeLabel(p: EventDatePrecision): string {
  if (p === 'year') return 'Year';
  if (p === 'month') return 'Month + Year';
  return 'Specific Day';
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Task #41 — pre-edit guard so the date input doesn't pre-populate a
// past day value (the native browser picker would reject it anyway via
// the `min` attr, but we'd rather show empty than a value that fails on
// first click).
function isInitialDayInPast(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return false;
  const candidate = new Date(y, m - 1, d);
  candidate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return candidate.getTime() < today.getTime();
}

function parseParts(iso: string | null): { year: number | null; month: number | null; day: number | null } {
  if (!iso) return { year: null, month: null, day: null };
  const [y, m, d] = iso.split('-');
  return {
    year: Number(y) || null,
    month: Number(m) || null,
    day: Number(d) || null,
  };
}
