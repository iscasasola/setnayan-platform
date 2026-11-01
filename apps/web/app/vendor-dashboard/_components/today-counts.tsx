'use client';

import { useRef, useState, type ReactNode } from 'react';
import { usePinFold } from '@/app/_components/pinned-row/use-pin-fold';
import { PinDoor, PinDoors, PinWord } from '@/app/_components/pinned-row/pin-door';
import { TodayFigure } from './today-figure';
import { SupplierOpenScope } from './supplier-open-row';

export type TodayFilter = 'waiting' | 'week' | 'money';

/**
 * 📌 TODAY'S PINNED ROW — Today · waiting · this week · ₱ to come in · ⚙ (the ONE SELECTOR's word form + the one door,
 * owner 2026-10-30 "all yes") (owner 2026-10-28, DECISION_LOG "SUPPLIER DASHBOARD
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
  after = null,
  initial = 'waiting',
}: {
  /** What follows the lists in the same column (Events you run · Coming up · the Shop row). */
  after?: ReactNode;
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
  // 📌 Folds into one slim line once the page runs under it (owner 2026-10-29, the shared `usePinFold`).
  const pinRef = useRef<HTMLDivElement>(null);
  usePinFold(pinRef);
  // 📌 THE ONE COUNT DOOR (owner 2026-10-30 "all yes", Q3 — `PinDoor`, the People door): the number bold, the word quiet,
  // filtering = the number underlined. Was a two-line round tile, pressed = the accent fill — a fourth door shape.
  const door = (key: TodayFilter, value: string | null, word: string, hot = false) => (
    <PinDoor
      value={value === null ? null : <TodayFigure word={value} id={`today-${key}`} />}
      word={word}
      hot={hot}
      on={on === key}
      onTap={() => setOn(key)}
      controls={`today-list-${key}`}
      mark={{ 'data-today-number': key, 'data-today-filter': key }}
      data-tour={key === 'money' ? 'today-money' : undefined}
      unreadMark="data-today-unread"
    />
  );

  return (
    <>
      <div
        ref={pinRef}
        className="sticky top-0 z-[5] -mx-4 mb-3 border-b border-ink/10 px-4 py-1.5 sm:-mx-6 sm:px-6"
        style={{ background: 'var(--sn-canvas)' }}
        data-today-numbers=""
        data-pin-fold=""
        data-pinned-row=""
        data-first-row=""
        data-tour="today-numbers"
      >
        <div className="flex min-h-11 items-center gap-1" role="group" aria-label="Show on Today">
          {/* The WORD form of the one selector — Today has no view to pick (DECISION_LOG 2026-10-30, "word-only when
              there are no choices"). From 701 the shell's bar already says "Today", so the page's copy steps aside. */}
          <PinWord mark={{ 'data-today-word': '' }} barAbove>
            Today
          </PinWord>
          <PinDoors>
            {door('waiting', waiting, 'waiting', waitingNow)}
            {door('week', thisWeek, 'this week')}
            {door('money', toComeIn, 'to come in')}
          </PinDoors>
          <span className="min-w-0 flex-1" aria-hidden />
          {gear}
        </div>
      </div>
      {/* 🖥 THE TWO COLUMNS (supplier dashboard v13, 2026-10-29): from 701 the lists sit left and the opened row is drawn
          on the right (`SupplierOpenScope`); on a phone the row opens in place. The count filter re-seats the right
          column on the first row it shows. */}
      <SupplierOpenScope name="today" paneLabel="The opened row" rest="Nothing waiting on you." watch={on}>
        {between}
        {(['waiting', 'week', 'money'] as const).map((key) => (
          <div key={key} id={`today-list-${key}`} data-today-list={key} hidden={on !== key}>
            {panels[key]}
          </div>
        ))}
        {after}
      </SupplierOpenScope>
    </>
  );
}
