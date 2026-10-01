import type { ReactNode } from 'react';

import { sceneCardClass } from '@/lib/scene-card-look';
import { monthName, monthWeeks, calendarDay, weekdayName } from '@/lib/scene-style-text';

/**
 * THE COUNTDOWN'S OTHER TWO STYLES — B · Big number and C · The calendar
 * (prototype `every_scene_three_styles_2026-09-29.html` §1). A · Four tiles is
 * `CountdownWidget` itself.
 *
 * Pure and props-in: `CountdownWidget` reads the clock (after mount only — the
 * #418 rule), decides whether a countdown may be drawn at all (no anchorable
 * date, the day has started, a solemn event), and hands the reading here. So
 * every style hides exactly when the shipped one does, because none of them
 * decides it.
 *
 * `remaining` is null until the clock is read: the shell draws `––` in the
 * same places, so the server markup never depends on the instant.
 */

export type CountdownReading = { days: number; hours: number; minutes: number; seconds: number };

const two = (n: number | null | undefined) => (n === null || n === undefined ? '––' : String(n).padStart(2, '0'));

/** B · Big number — the days are the hero; hours, minutes and seconds tick in one small line. */
export function CountdownBigNumber({
  label,
  remaining,
  targetIso,
  bare = false,
}: {
  label: ReactNode;
  remaining: CountdownReading | null;
  targetIso: string;
  bare?: boolean;
}) {
  const day = calendarDay(targetIso);
  return (
    <section
      data-scene-card={bare ? 'bare' : 'own'}
      data-scene-style="big-number"
      className={`${sceneCardClass('countdown', bare)} text-center`}
    >
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-terracotta">{label}</p>
      <p className="mt-4 font-pahina text-[5.5rem] font-light leading-none tabular-nums text-ink sm:text-[7rem]">
        {remaining ? String(remaining.days) : '––'}
      </p>
      <p className="mt-1 font-sans text-xs uppercase tracking-[0.2em] text-ink/70">
        {remaining?.days === 1 ? 'day' : 'days'}
      </p>
      <p className="mt-3 font-mono text-sm tabular-nums tracking-[0.12em] text-ink/70">
        {two(remaining?.hours)} H · {two(remaining?.minutes)} M · {two(remaining?.seconds)} S
      </p>
      {day ? (
        <p className="mt-4 font-pahina text-lg italic text-ink/80">
          <span aria-hidden className="mr-2 text-gild">✦</span>
          {weekdayName(day.weekday)}, {day.day} {monthName(day.month)} {day.year}
        </p>
      ) : null}
    </section>
  );
}

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** C · The calendar — the month with the day marked, and the count under it. */
export function CountdownCalendar({
  label,
  remaining,
  targetIso,
  bare = false,
}: {
  label: ReactNode;
  remaining: CountdownReading | null;
  targetIso: string;
  bare?: boolean;
}) {
  const month = monthWeeks(targetIso);
  return (
    <section
      data-scene-card={bare ? 'bare' : 'own'}
      data-scene-style="calendar"
      className={sceneCardClass('countdown', bare)}
    >
      <p className="font-sans text-xs uppercase tracking-[0.2em] text-terracotta">{label}</p>
      {month ? (
        <div className="mt-4">
          <p className="font-pahina text-2xl font-light text-ink">
            {monthName(month.month)} {month.year}
          </p>
          <table className="mt-3 w-full table-fixed border-collapse text-center" aria-label={`${monthName(month.month)} ${month.year}`}>
            <thead>
              <tr>
                {WEEKDAY_INITIALS.map((d, i) => (
                  <th key={i} scope="col" className="pb-1 font-sans text-xs font-normal uppercase text-ink/60">
                    <span aria-hidden>{d}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {month.weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((d, di) => (
                    <td key={di} className="py-1">
                      {d === null ? null : d === month.day ? (
                        <span
                          data-calendar-day="the-day"
                          className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-terracotta font-mono text-sm tabular-nums text-terracotta"
                        >
                          {d}
                        </span>
                      ) : (
                        <span className="font-mono text-sm tabular-nums text-ink/70">{d}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-4 text-center font-mono text-sm tabular-nums tracking-[0.08em] text-ink">
        {remaining ? `${remaining.days} ${remaining.days === 1 ? 'day' : 'days'}` : '–– days'}{' '}
        {two(remaining?.hours)}:{two(remaining?.minutes)}:{two(remaining?.seconds)}
      </p>
    </section>
  );
}
