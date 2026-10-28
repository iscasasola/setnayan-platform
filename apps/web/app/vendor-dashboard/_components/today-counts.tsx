'use client';

import { useState, type ReactNode } from 'react';
import { TodayFigure } from './today-figure';

export type TodayFilter = 'waiting' | 'week' | 'money';

/**
 * 📌 TODAY'S PINNED ROW — waiting · this week · ₱ to come in · ⚙ (owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD
 * APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE": "the counts … are the pinned row and they FILTER the list in place";
 * prototype `supplier_in_place_2026-10-28` `.pin`). The app-wide template (owner 2026-10-27, "THE PINNED ROW IS THE
 * APP-WIDE TEMPLATE": selector · counts · action · ⚙) — Today has no view to pick and no one action, so its row is the
 * counts and the ⚙.
 *
 *   · ONE ROW, STICKY: the same box at rest and pinned, so nothing under it moves (`data-pinned-row`).
 *   · A COUNT IS A FILTER: pressing it shows ITS list right under the row, in place (`aria-pressed`); the other two
 *     lists stay drawn but hidden, so a half-typed answer in one is still there when you come back. Each list ends
 *     with the door to the whole of it (Customers · Dates · Payday) — the count still goes somewhere.
 *   · HONEST: a count the page could not read says "couldn't load" in the number's place — never 0, never ₱0 — and
 *     its list says the same.
 *
 * 🔒 app/vendor-dashboard/_components/the-counts-filter-in-place.test.ts
 */
export function TodayCounts({
  waiting,
  waitingNow,
  thisWeek,
  toComeIn,
  panels,
  gear,
  between = null,
  initial = 'waiting',
}: {
  /** Already worded ("3", "2+"), or null = the desk could not be read. */
  waiting: string | null;
  waitingNow: boolean;
  thisWeek: string;
  /** Already worded ("₱48K"), or null = payday could not be read. */
  toComeIn: string | null;
  panels: Readonly<Record<TodayFilter, ReactNode>>;
  /** Today's ⚙ (`TodaySettings`) — the row's right end. */
  gear: ReactNode;
  /** What sits between the row and its lists — Today's Next card (the prototype: the row FIRST, then the card). */
  between?: ReactNode;
  initial?: TodayFilter;
}) {
  const [on, setOn] = useState<TodayFilter>(initial);
  const door = (key: TodayFilter, value: string | null, word: string, hot = false) => (
    <button
      type="button"
      className={`sn-press grid min-h-11 flex-1 content-center gap-0.5 rounded-full px-1 py-1 text-center transition-colors duration-200 motion-reduce:transition-none ${
        on === key ? 'bg-sn-accent' : ''
      }`}
      onClick={() => setOn(key)}
      aria-pressed={on === key}
      aria-controls={`today-list-${key}`}
      data-today-number={key}
      data-today-filter={key}
      data-tour={key === 'money' ? 'today-money' : undefined}
    >
      {value === null ? (
        <>
          <span className="block text-[20px] font-semibold leading-none" style={{ color: on === key ? 'rgb(var(--sn-on-accent))' : 'rgb(var(--color-warn))' }} aria-hidden>
            —
          </span>
          <span className={`block text-[11.5px] ${on === key ? 'text-[rgb(var(--sn-on-accent))]' : 'text-ink/60'}`} data-today-unread="">
            couldn&rsquo;t load
          </span>
        </>
      ) : (
        <>
          {/* Pressed = the prototype's filled pill: the accent fill, the number and word in the on-accent ink. */}
          <span
            className={`block text-[20px] font-semibold leading-none tabular-nums ${
              on === key ? 'text-[rgb(var(--sn-on-accent))]' : hot ? 'text-sn-accent' : 'text-ink'
            }`}
          >
            <TodayFigure word={value} id={`today-${key}`} />
          </span>
          <span className={`block text-[11.5px] ${on === key ? 'text-[rgb(var(--sn-on-accent))]' : 'text-ink/60'}`}>{word}</span>
        </>
      )}
    </button>
  );

  return (
    <>
      <div
        className="sticky top-0 z-[5] -mx-4 mb-3 border-b border-ink/10 px-4 py-1.5 sm:-mx-6 sm:px-6"
        style={{ background: 'var(--sn-canvas)' }}
        data-today-numbers=""
        data-pinned-row=""
        data-first-row=""
        data-tour="today-numbers"
      >
        <div className="flex items-center gap-1" role="group" aria-label="Show on Today">
          {door('waiting', waiting, 'waiting', waitingNow)}
          {door('week', thisWeek, 'this week')}
          {door('money', toComeIn, 'to come in')}
          {gear}
        </div>
      </div>
      {between}
      {(['waiting', 'week', 'money'] as const).map((key) => (
        <div key={key} id={`today-list-${key}`} data-today-list={key} hidden={on !== key}>
          {panels[key]}
        </div>
      ))}
    </>
  );
}
