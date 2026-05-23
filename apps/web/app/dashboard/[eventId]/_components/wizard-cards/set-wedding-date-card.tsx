'use client';

/**
 * Phase 1 · Card 01 Set Wedding Date · wheel-spinner inline picker.
 *
 * Iteration 0016 · CLAUDE.md Sixth 2026-05-23 row. UX locked in
 * [[feedback_setnayan_concierge_wizard_ux]] · Day · Month · Year wheel
 * spinner via react-mobile-picker · live auspicious reasoning below the
 * wheels · single [Save date] action that calls completeSetWeddingDateTask.
 *
 * Pattern this card validates: every wizard card is a CLIENT component
 * that owns its own form state + computes any client-side display logic
 * (in this case auspicious reasoning), then submits via a hidden form
 * field array to the server action. The server action does its own
 * defense-in-depth validation + writes events.* + wizard_state JSONB,
 * then revalidatePath so the WizardHero re-renders with the next task.
 *
 * Auspicious reasoning runs CLIENT-SIDE on every wheel change · no server
 * round-trip · uses the same computeAuspiciousReasons function the
 * /date-selection page uses + the server action uses on save. Three
 * call-sites all agree on what makes a date auspicious — single source
 * of truth.
 *
 * Day-of-month clamping: when month or year changes, the day options
 * adjust (Feb 28/29 · Apr/Jun/Sep/Nov 30 · other months 31). If the
 * currently-selected day is out of bounds for the new month, clamp to
 * the last valid day. The wheel snaps visually to the clamped value.
 *
 * Defaults: pre-populated with the host's prior event_date if set;
 * otherwise defaults to ~12 months out (the modal Filipino-wedding
 * planning runway).
 */

import { useEffect, useMemo, useState, useTransition } from 'react';
import Picker from 'react-mobile-picker';
import { ArrowRight, Sparkles } from 'lucide-react';
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

/** Days in each month for the year · accounts for leap years. */
function daysInMonth(year: number, month: number): number {
  // month is 1-12 here. Date(year, month, 0) returns last day of `month`.
  return new Date(year, month, 0).getDate();
}

/** Parse "YYYY-MM-DD" → { day, month, year } numeric components. Returns
 *  null on any parse failure so the caller can fall back to defaults. */
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
  // 6-year window: today's year through 5 years out. Most PH planning
  // runways are 6-24 months · 5 years is the long tail per
  // [[project_setnayan_event_lifecycle]] (long-engagement advisory in
  // iteration 0016).
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear + i),
    [currentYear],
  );

  // Default pickerValue:
  //   - If host already has event_date, pre-populate to that
  //   - Else default to ~12 months out (modal planning runway)
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

  // pickerValue is the live state of the three wheels. react-mobile-picker
  // expects all values to be strings even when they're conceptually numeric.
  const [pickerValue, setPickerValue] = useState<{
    day: string;
    month: string;
    year: string;
  }>({
    day: String(defaultPicked.day),
    month: String(defaultPicked.month),
    year: String(defaultPicked.year),
  });

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Derived current selection · numeric for math + Date construction.
  const selectedYear = Number.parseInt(pickerValue.year, 10);
  const selectedMonth = Number.parseInt(pickerValue.month, 10);
  const selectedDay = Number.parseInt(pickerValue.day, 10);

  // Day options · clamps to the actual days in the picked month/year.
  // Feb 2027 = 28 days · Feb 2028 = 29 days (leap) · Apr = 30 days · etc.
  const maxDay = useMemo(
    () => daysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => i + 1),
    [maxDay],
  );

  // When month or year changes, clamp day if it's now out of bounds.
  // Example: host has day=31 selected · changes month to Feb · day must
  // clamp to 28 (or 29 in leap year).
  useEffect(() => {
    if (selectedDay > maxDay) {
      setPickerValue((v) => ({ ...v, day: String(maxDay) }));
    }
  }, [selectedDay, maxDay]);

  // Construct the Date the wheels point at · for the auspicious-reason
  // computation. Local-time construction matches the YMD parts so no
  // timezone drift.
  const selectedDate = useMemo(
    () => new Date(selectedYear, selectedMonth - 1, Math.min(selectedDay, maxDay)),
    [selectedYear, selectedMonth, selectedDay, maxDay],
  );

  // Live auspicious reasoning · recomputed every time the wheels change.
  // The function is pure + fast (<1ms typical) so calling on every render
  // is fine. Same library /date-selection uses + the server action uses.
  const reasons = useMemo(
    () => computeAuspiciousReasons(selectedDate, ceremonyType, meaningfulDates),
    [selectedDate, ceremonyType, meaningfulDates],
  );

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('day', String(Math.min(selectedDay, maxDay)));
    formData.set('month', String(selectedMonth));
    formData.set('year', String(selectedYear));

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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Wheel spinner · 3 columns (Day · Month · Year) · react-mobile-picker
          handles touch-drag, mouse-wheel scroll, and click-to-snap
          interactions across mobile + desktop natively. */}
      <div className="rounded-xl border border-ink/10 bg-white/60 p-3 sm:p-4">
        <Picker
          value={pickerValue}
          onChange={setPickerValue}
          height={180}
          itemHeight={36}
          wheelMode="natural"
        >
          <Picker.Column name="day">
            {dayOptions.map((d) => (
              <Picker.Item key={d} value={String(d)}>
                {String(d).padStart(2, '0')}
              </Picker.Item>
            ))}
          </Picker.Column>
          <Picker.Column name="month">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <Picker.Item key={m} value={String(m)}>
                {MONTHS_FULL[m - 1]}
              </Picker.Item>
            ))}
          </Picker.Column>
          <Picker.Column name="year">
            {yearOptions.map((y) => (
              <Picker.Item key={y} value={String(y)}>
                {String(y)}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
      </div>

      {/* Live auspicious reasoning · positive-only per the auspicious-date
          library's brand voice rules. Reasons can be empty for ordinary
          dates (no special pattern, no resonance, no day-of-week magic);
          we still surface a base line in that case to avoid a blank slot. */}
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
