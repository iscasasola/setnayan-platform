'use client';

/**
 * Phase 1 · Card 01 Set Wedding Date · calendar grid picker.
 *
 * Iteration 0016 · CLAUDE.md Sixth 2026-05-23 row. Owner directive
 * 2026-05-24: wheel-spinner (react-mobile-picker) replaced with a
 * familiar month-view calendar grid · easier to navigate than scroll
 * wheels, taps are larger, day-of-week is visible (Saturdays + Sundays
 * are the modal PH wedding days, weekend tinting calls them out), and
 * prev/next-month arrows + a year quick-pick give the host fast
 * navigation across a 6-year window.
 *
 * Auspicious reasoning runs CLIENT-SIDE on every selection · the same
 * `computeAuspiciousReasons` helper the /date-selection page uses + the
 * server action uses on save. Three call-sites all agree on what makes
 * a date auspicious.
 *
 * Defaults: pre-populated with the host's prior event_date if set;
 * otherwise defaults to ~12 months out (modal Filipino-wedding planning
 * runway). The visible month opens on the default's month so the host
 * sees their tentative pick highlighted in the grid.
 */

import { useMemo, useState, useTransition } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import {
  computeAuspiciousReasons,
  type CeremonyType,
  type MeaningfulDate,
} from '@/lib/auspicious-date';
import { completeSetWeddingDateTask } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** ceremony_type read from events row · drives ceremony-specific
   *  auspicious-date overlays (Catholic Lent windows, INC sabbath, etc.). */
  ceremonyType: CeremonyType | null;
  /** Pre-populate from events.event_date if already set (host re-editing). */
  initialDate: string | null;
  /** Pulled in by parent server component for full auspicious resonance. */
  meaningfulDates: MeaningfulDate[];
};

const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Days in a given month/year. Handles leap years correctly. */
function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

/** Day-of-week (0=Sun .. 6=Sat) for the FIRST day of the given month. */
function firstDayOfMonthWeekday(year: number, month1Based: number): number {
  return new Date(year, month1Based - 1, 1).getDay();
}

/** Parse "YYYY-MM-DD" → { day, month, year }. Returns null on failure. */
function parseIsoYmd(
  iso: string | null,
): { day: number; month: number; year: number } | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return {
    year: Number.parseInt(match[1]!, 10),
    month: Number.parseInt(match[2]!, 10),
    day: Number.parseInt(match[3]!, 10),
  };
}

export function SetWeddingDateCard({
  eventId,
  ceremonyType,
  initialDate,
  meaningfulDates,
}: Props) {
  // 6-year window: today's year through 5 years out · matches the
  // [[project_setnayan_event_lifecycle]] long-engagement advisory cap
  // (Concierge access is capped at 24 months from activation; planning
  // runways past 5 years are exceedingly rare).
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear + i),
    [currentYear],
  );

  // Default selection: existing event_date OR ~12 months out (the modal
  // PH planning runway).
  const defaultPicked = useMemo(() => {
    const parsed = parseIsoYmd(initialDate);
    if (parsed && parsed.year >= currentYear && parsed.year <= currentYear + 5) {
      return parsed;
    }
    const target = new Date();
    target.setFullYear(target.getFullYear() + 1);
    return {
      day: target.getDate(),
      month: target.getMonth() + 1,
      year: target.getFullYear(),
    };
  }, [initialDate, currentYear]);

  // Selected date · the host's current pick. Initialized to defaultPicked
  // (their saved date or 12 months out).
  const [selected, setSelected] = useState(defaultPicked);

  // Visible month/year in the calendar grid. Independent from selected
  // because the host can flip pages without re-selecting · e.g., scroll
  // to October while their pick is in June. Initialized to the selected
  // month so the host immediately sees their pick highlighted.
  const [viewMonth, setViewMonth] = useState(defaultPicked.month);
  const [viewYear, setViewYear] = useState(defaultPicked.year);

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Construct the Date object for the SELECTED date · auspicious-reason
  // computation reads this. Local-time construction matches the YMD
  // parts so no timezone drift.
  const selectedDate = useMemo(
    () => new Date(selected.year, selected.month - 1, selected.day),
    [selected],
  );

  // Live auspicious reasoning · recomputed every time selection changes.
  const reasons = useMemo(
    () => computeAuspiciousReasons(selectedDate, ceremonyType, meaningfulDates),
    [selectedDate, ceremonyType, meaningfulDates],
  );

  // Calendar grid cells: 7 columns × N rows. Empty cells before the
  // first-of-the-month + trailing empties after the last-of-the-month
  // keep the day-of-week alignment correct.
  const calendarCells = useMemo(() => {
    const offset = firstDayOfMonthWeekday(viewYear, viewMonth); // 0..6
    const dayCount = daysInMonth(viewYear, viewMonth);
    const totalCells = Math.ceil((offset + dayCount) / 7) * 7;
    const cells: Array<{ day: number; isPadding: boolean; weekday: number }> = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - offset + 1;
      const isPadding = dayNum < 1 || dayNum > dayCount;
      cells.push({
        day: isPadding ? 0 : dayNum,
        isPadding,
        weekday: i % 7,
      });
    }
    return cells;
  }, [viewMonth, viewYear]);

  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => Math.max(currentYear, y - 1));
        return 12;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => Math.min(currentYear + 5, y + 1));
        return 1;
      }
      return m + 1;
    });
  }

  function pickDay(day: number) {
    setSelected({ day, month: viewMonth, year: viewYear });
  }

  function handleYearJump(yearString: string) {
    const year = Number.parseInt(yearString, 10);
    if (!Number.isFinite(year)) return;
    setViewYear(year);
    // If selected month doesn't exist (we don't gate this) the grid
    // still renders correctly because daysInMonth handles leap years.
    // Re-clamp the selected day if necessary so e.g. Feb-29 doesn't
    // persist into a non-leap year.
    const maxDay = daysInMonth(year, selected.month);
    if (selected.day > maxDay) {
      setSelected((s) => ({ ...s, day: maxDay, year }));
    }
  }

  // Selected-date check for the cell · highlights only when the cell's
  // (day, month, year) matches the selected triple.
  function isSelected(day: number): boolean {
    return (
      day === selected.day &&
      viewMonth === selected.month &&
      viewYear === selected.year
    );
  }

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('day', String(selected.day));
    formData.set('month', String(selected.month));
    formData.set('year', String(selected.year));

    startTransition(async () => {
      try {
        await completeSetWeddingDateTask(formData);
        // Success · WizardHero re-renders via revalidatePath · the next
        // focus card transitions in-place.
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not save your date. Try again.';
        setErrorMessage(message);
      }
    });
  }

  // Format the selected date for the summary line · "Sat, October 17, 2026"
  // matches the brand voice (day-of-week first signals Filipino-wedding
  // weekend preference).
  const selectedDateLabel = useMemo(() => {
    return new Intl.DateTimeFormat('en-PH', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(selectedDate);
  }, [selectedDate]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Calendar header · month label + prev/next month arrows + year quick-pick.
       *  The label is the source of truth for the visible month — host can
       *  flip months without changing selection. */}
      <div className="rounded-xl border border-ink/10 bg-white/60 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            disabled={viewYear === currentYear && viewMonth === 1}
            aria-label="Previous month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg italic text-ink sm:text-xl">
              {MONTHS_FULL[viewMonth - 1]}
            </h3>
            <select
              value={String(viewYear)}
              onChange={(e) => handleYearJump(e.target.value)}
              className="rounded-md border border-ink/15 bg-white px-2 py-1 text-sm font-medium text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              aria-label="Year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={goNextMonth}
            disabled={viewYear === currentYear + 5 && viewMonth === 12}
            aria-label="Next month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-cream hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Day-of-week header row · S M T W T F S */}
        <div className="grid grid-cols-7 gap-1 pb-1.5">
          {DAYS_OF_WEEK.map((d, i) => (
            <div
              key={i}
              className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells · 7×N grid · weekends (Sat/Sun) get subtle warm
         *  tinting since they're the modal Filipino wedding days. Selected
         *  cell has the terracotta ring + cream fill. */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (cell.isPadding) {
              return <div key={`pad-${idx}`} aria-hidden className="h-10" />;
            }
            const selectedCell = isSelected(cell.day);
            const isWeekend = cell.weekday === 0 || cell.weekday === 6;
            return (
              <button
                key={cell.day}
                type="button"
                onClick={() => pickDay(cell.day)}
                aria-pressed={selectedCell}
                aria-label={`${MONTHS_FULL[viewMonth - 1]} ${cell.day}, ${viewYear}`}
                className={
                  selectedCell
                    ? 'h-10 rounded-lg bg-terracotta text-sm font-semibold text-cream shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream'
                    : `h-10 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-terracotta/40 ${
                        isWeekend
                          ? 'bg-terracotta/5 text-ink hover:bg-terracotta/15'
                          : 'text-ink/75 hover:bg-cream'
                      }`
                }
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected-date label · big readable summary so the host always
       *  knows what they've picked without scanning the grid. */}
      <p className="text-center text-base text-ink sm:text-left">
        Picked: <strong className="font-medium">{selectedDateLabel}</strong>
      </p>

      {/* Live auspicious reasoning · pure-function recompute on selection
       *  change · positive-only per the auspicious-date library's brand
       *  voice rules. */}
      <div className="space-y-2 rounded-xl bg-terracotta/5 p-4">
        <div className="flex items-center gap-2">
          <Sparkles
            aria-hidden
            className="h-3.5 w-3.5 text-terracotta"
            strokeWidth={2}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Why this date works
          </p>
        </div>
        {reasons.length > 0 ? (
          <ul className="space-y-1.5">
            {reasons.map((reason, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-ink/80">
                <span aria-hidden className="select-none text-terracotta">
                  ·
                </span>
                <span className="leading-relaxed">{reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-ink/70">
            A clean date — no special pattern, just yours. Sometimes the
            quietest choice is the most personal.
          </p>
        )}
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save your date'}
          {!isPending ? (
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          ) : null}
        </button>
      </div>
    </form>
  );
}
