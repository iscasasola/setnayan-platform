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

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import {
  computeAuspiciousReasonsDetailed,
  type CeremonyType,
  type MeaningfulDate,
} from '@/lib/auspicious-date';

/** Summary view caps at the top N reasons across all categories — the
 *  full grouped breakdown lives behind the "Learn more about this date"
 *  expander. 5 chosen as the most-the-host-can-scan-without-glazing
 *  number that still surfaces enough variety to feel rich. */
const SUMMARY_REASON_CAP = 5;
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

/** Compare two {year, month, day} triples · returns < 0 if a < b, 0 if equal,
 *  > 0 if a > b. Pure date arithmetic, no Date constructor needed. */
function ymdCompare(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function SetWeddingDateCard({
  eventId,
  ceremonyType,
  initialDate,
  meaningfulDates,
}: Props) {
  // Owner-locked 2026-05-24: wedding date must be TODAY or later, AND
  // at most 3 years from today. Past dates make no sense for an active
  // wedding plan; planning runways past 3 years are exceedingly rare
  // and align with the [[project_setnayan_event_lifecycle]] 24-month
  // Concierge cap with a small buffer for long-engagement edge cases.
  //
  // `today` + `maxDate` are computed once at first render. Stable across
  // renders even if the user keeps the tab open across midnight (a tiny
  // edge case · fixes itself on next page load).
  const today = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }, []);

  const maxDate = useMemo(() => {
    return { ...today, year: today.year + 3 };
  }, [today]);

  // Year quick-pick options: today's year through +3. Four options total.
  const yearOptions = useMemo(
    () => Array.from({ length: 4 }, (_, i) => today.year + i),
    [today.year],
  );

  // Default selection · preserves saved event_date when in-range,
  // otherwise defaults to EXACTLY 12 months from today (2026-05-24 owner
  // directive: this is the ideal earliest booking date — far enough out
  // for venue / photo / coordinator inventory to be open, close enough
  // to feel real). Host has full freedom to slide to any in-range date.
  // When the saved date is in the past, clamp to today.
  const defaultPicked = useMemo(() => {
    const parsed = parseIsoYmd(initialDate);
    if (
      parsed &&
      ymdCompare(parsed, today) >= 0 &&
      ymdCompare(parsed, maxDate) <= 0
    ) {
      return parsed;
    }
    const target = new Date();
    target.setFullYear(target.getFullYear() + 1);
    const candidate = {
      day: target.getDate(),
      month: target.getMonth() + 1,
      year: target.getFullYear(),
    };
    // Safety clamp · 12 months from now is always inside [today, today+3y]
    // but make it explicit in case the math ever drifts.
    if (ymdCompare(candidate, maxDate) > 0) return maxDate;
    if (ymdCompare(candidate, today) < 0) return today;
    return candidate;
  }, [initialDate, today, maxDate]);

  // 2026-05-24 owner directive: when the host has no saved date yet AND
  // hasn't touched the picker, show explainer copy that calls out the
  // 12-month preset as the "ideal earliest" recommendation (not a saved
  // pick). The copy hides once the host changes the date OR if they
  // already saved one previously — both signals mean they're decisive
  // about their pick, no nudge needed.
  const hasSavedDate = useMemo(() => {
    const parsed = parseIsoYmd(initialDate);
    return (
      parsed !== null &&
      ymdCompare(parsed, today) >= 0 &&
      ymdCompare(parsed, maxDate) <= 0
    );
  }, [initialDate, today, maxDate]);
  const [showPresetExplainer, setShowPresetExplainer] = useState(!hasSavedDate);

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
  // Grouped shape drives the inline "Learn more about this date" expander.
  const reasonGroups = useMemo(
    () => computeAuspiciousReasonsDetailed(selectedDate, ceremonyType, meaningfulDates),
    [selectedDate, ceremonyType, meaningfulDates],
  );
  // 2026-05-24 owner directive: each date must show 5 distinct things,
  // and adjacent dates must read distinctly. Round-robin selection
  // across categories (instead of first-N-in-priority-order) guarantees
  // the summary pulls from multiple layers — so the host always sees a
  // mix of numerology + astrology + cultural framings, not all from one
  // bucket. Each category's variant indexing already ensures adjacent
  // dates pull different framings.
  const summaryReasons = useMemo(() => {
    const flat: string[] = [];
    if (reasonGroups.length === 0) return flat;
    const cursors: number[] = reasonGroups.map(() => 0);
    let safetyBound = SUMMARY_REASON_CAP * reasonGroups.length + 1;
    while (flat.length < SUMMARY_REASON_CAP && safetyBound-- > 0) {
      let pickedThisPass = false;
      for (let gIdx = 0; gIdx < reasonGroups.length; gIdx++) {
        const g = reasonGroups[gIdx]!;
        const c = cursors[gIdx]!;
        if (c < g.reasons.length) {
          flat.push(g.reasons[c]!);
          cursors[gIdx] = c + 1;
          pickedThisPass = true;
          if (flat.length >= SUMMARY_REASON_CAP) break;
        }
      }
      if (!pickedThisPass) break; // every group exhausted
    }
    return flat;
  }, [reasonGroups]);
  // Total reason count drives the "Learn more" CTA copy and visibility.
  const totalReasonCount = useMemo(
    () => reasonGroups.reduce((sum, g) => sum + g.reasons.length, 0),
    [reasonGroups],
  );
  const hasMoreReasons = totalReasonCount > summaryReasons.length;
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  // Reset expander state every time the date changes · prevents a stale
  // "Learn more" tray from one date carrying over into another.
  useEffect(() => {
    setLearnMoreOpen(false);
  }, [selectedDate]);

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
        setViewYear((y) => Math.max(today.year, y - 1));
        return 12;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => Math.min(maxDate.year, y + 1));
        return 1;
      }
      return m + 1;
    });
  }

  function pickDay(day: number) {
    const candidate = { day, month: viewMonth, year: viewYear };
    // Past dates are blocked at the cell render layer (disabled buttons)
    // but double-guard here in case the cell logic ever regresses.
    if (ymdCompare(candidate, today) < 0) return;
    if (ymdCompare(candidate, maxDate) > 0) return;
    setSelected(candidate);
    // Host took agency over the preset · explainer goes away. We don't
    // re-show it even if they slide back to the original 12-month pick
    // because they've now confirmed intent.
    if (showPresetExplainer) setShowPresetExplainer(false);
  }

  /** Is the given visible-month cell BEFORE today? Drives `disabled`. */
  function isCellInPast(day: number): boolean {
    return ymdCompare({ day, month: viewMonth, year: viewYear }, today) < 0;
  }

  /** Is the given visible-month cell AFTER the 3-year window? */
  function isCellPastMax(day: number): boolean {
    return ymdCompare({ day, month: viewMonth, year: viewYear }, maxDate) > 0;
  }

  function handleYearJump(yearString: string) {
    const year = Number.parseInt(yearString, 10);
    if (!Number.isFinite(year)) return;
    // Guard against year-jump landing outside [today.year, maxDate.year]
    // (shouldn't happen since the <select> options are clamped, but be
    // defensive in case a future refactor changes the option source).
    const clampedYear = Math.max(today.year, Math.min(maxDate.year, year));
    setViewYear(clampedYear);
    // If selected month doesn't exist (we don't gate this) the grid
    // still renders correctly because daysInMonth handles leap years.
    // Re-clamp the selected day if necessary so e.g. Feb-29 doesn't
    // persist into a non-leap year.
    const maxDay = daysInMonth(clampedYear, selected.month);
    if (selected.day > maxDay) {
      setSelected((s) => ({ ...s, day: maxDay, year: clampedYear }));
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

  // Selected date is out of range (past or beyond 3-year window) ·
  // submit button stays disabled and an inline notice appears. This is
  // belt + suspenders on top of the disabled cell rendering · the host
  // can't reach this state through the picker, but a server action
  // rejection on a bad payload would be a worse UX.
  const selectedIsInRange =
    ymdCompare(selected, today) >= 0 && ymdCompare(selected, maxDate) <= 0;

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    if (!selectedIsInRange) {
      setErrorMessage(
        'Your wedding date needs to be today or later — and within the next 3 years.',
      );
      return;
    }

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
      {/* 12-month preset explainer · only shows when the host hasn't
       *  saved a date yet AND hasn't touched the calendar. Calls out the
       *  default as a *recommendation* — not a saved pick — so the host
       *  knows they can slide to any in-range day. Auto-hides on first
       *  tap of a day cell. */}
      {showPresetExplainer ? (
        <div className="rounded-xl border border-terracotta/25 bg-terracotta/5 p-3 text-sm leading-relaxed text-ink/80 sm:p-4">
          <p>
            We&apos;ve picked <strong className="font-medium text-ink">12 months from today</strong>{' '}
            as a starting point — the ideal earliest window where most
            venues, photographers, and coordinators still have inventory
            open. Slide to any day that feels right for you.
          </p>
        </div>
      ) : null}

      {/* Calendar header · month label + prev/next month arrows + year quick-pick.
       *  The label is the source of truth for the visible month — host can
       *  flip months without changing selection. */}
      <div className="rounded-xl border border-ink/10 bg-white/60 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            disabled={viewYear === today.year && viewMonth === today.month}
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
            disabled={viewYear === maxDate.year && viewMonth === maxDate.month}
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
         *  cell has the terracotta ring + cream fill. Past dates + dates
         *  beyond the 3-year window render disabled (line-through) so the
         *  host can SEE they're out of range, not just have nothing to tap. */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (cell.isPadding) {
              return <div key={`pad-${idx}`} aria-hidden className="h-10" />;
            }
            const selectedCell = isSelected(cell.day);
            const isWeekend = cell.weekday === 0 || cell.weekday === 6;
            const isPast = isCellInPast(cell.day);
            const isPastMax = isCellPastMax(cell.day);
            const disabled = isPast || isPastMax;
            const baseHeight = 'h-10';
            return (
              <button
                key={cell.day}
                type="button"
                onClick={() => pickDay(cell.day)}
                disabled={disabled}
                aria-pressed={selectedCell}
                aria-label={`${MONTHS_FULL[viewMonth - 1]} ${cell.day}, ${viewYear}${disabled ? ' — unavailable' : ''}`}
                className={
                  disabled
                    ? `${baseHeight} rounded-lg text-sm font-medium text-ink/25 line-through cursor-not-allowed`
                    : selectedCell
                      ? `${baseHeight} rounded-lg bg-terracotta text-sm font-semibold text-cream shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream`
                      : `${baseHeight} rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-terracotta/40 ${
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
        {summaryReasons.length > 0 ? (
          <ul className="space-y-1.5">
            {summaryReasons.map((reason, idx) => (
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

        {/* "Learn more about this date" inline expander · 2026-05-24
         *  owner directive. Shows the FULL grouped breakdown by
         *  category (Numerology · Cultural meaning · Ceremony notes ·
         *  etc.) when expanded. Stays inside the card · no navigation
         *  out · preserves the wizard's NO LINKS rule. */}
        {hasMoreReasons || reasonGroups.length > 1 ? (
          <button
            type="button"
            onClick={() => setLearnMoreOpen((open) => !open)}
            aria-expanded={learnMoreOpen}
            className="inline-flex items-center gap-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta transition-colors hover:text-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta/30 rounded-md"
          >
            {learnMoreOpen ? (
              <>
                <ChevronUp aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                Hide details
              </>
            ) : (
              <>
                <ChevronDown aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                Learn more about this date
              </>
            )}
          </button>
        ) : null}

        {learnMoreOpen ? (
          <div className="mt-3 space-y-4 border-t border-terracotta/15 pt-3">
            {reasonGroups.map((group) => (
              <div key={group.category}>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta/90">
                  {group.label}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {group.reasons.map((reason, idx) => (
                    <li
                      key={`${group.category}-${idx}`}
                      className="flex gap-2 text-sm text-ink/80"
                    >
                      <span aria-hidden className="select-none text-terracotta">
                        ·
                      </span>
                      <span className="leading-relaxed">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
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
          disabled={isPending || !selectedIsInRange}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
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
