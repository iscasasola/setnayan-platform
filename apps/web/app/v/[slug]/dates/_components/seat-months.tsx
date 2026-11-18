'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { dayShines } from '@/lib/hot-date';
import { CHECK_DATE_POPULAR, CHECK_DATE_WORDS } from '@/lib/check-a-date';
import s from './seat-months.module.css';

/**
 * 🎟 SEAT MONTHS — Check a date's month, read like a cinema seat plan (SHOP-02 v7, owner-approved 14 Nov 2026; the
 * approved prototype "Check A Date Seats", artifact 5RD3E3YcvY3d7Et6Pz9iij).
 *
 *   · GREEN — a day you can ask about. GREY, striped — the shop closed it: no ask, no book (owner, ruling bc47ffe8).
 *     Tapping a grey day still answers "Not bookable", never why.
 *   · A POPULAR day shines and carries ✦ — the SHIPPED hot-date rule (`lib/hot-date.ts`, tiers In demand · Hottest).
 *     It stays green: popular is never a reason to stop asking. Never colour alone: grey has stripes, a shining day
 *     has its ✦, and a screen reader hears "available", "available, popular" or "not bookable".
 *   · Past days are faint and empty; today has a ring.
 *   · Months SWIPE: each swipe settles on one whole month and the next one peeks. On a computer ‹ › and the arrow
 *     keys do the same. Reduced motion: no glide, and the light stops as a still band.
 *
 * The answer per day is still the shipped one (`checkDateStateOf` in the parent) — this file only draws it.
 */

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export type SeatState = 'available' | 'not_bookable' | null;

function monthsBetween(from: string, to: string): Array<{ y: number; m: number }> {
  const [fy = 1970, fm = 1] = from.split('-').map(Number);
  const [ty = fy, tm = fm] = to.split('-').map(Number);
  const out: Array<{ y: number; m: number }> = [];
  for (let at = fy * 12 + fm - 1; at <= ty * 12 + tm - 1; at++) out.push({ y: Math.floor(at / 12), m: (at % 12) + 1 });
  return out;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function SeatMonths({
  today,
  to,
  value,
  startAt,
  stateOf,
  onPick,
}: {
  today: string;
  to: string;
  value: string | null;
  startAt: string;
  /** The shipped answer for a day: Available · Not bookable · null (past or beyond the window). */
  stateOf: (day: string) => SeatState;
  onPick: (day: string) => void;
}) {
  const months = useMemo(() => monthsBetween(today, to), [today, to]);
  const startIndex = Math.max(0, months.findIndex((x) => iso(x.y, x.m, 1).slice(0, 7) === startAt.slice(0, 7)));
  const [at, setAt] = useState(startIndex);
  const strip = useRef<HTMLDivElement>(null);

  // Open on the month of the picked (or first) day without a glide.
  useEffect(() => {
    const el = strip.current?.children[startIndex] as HTMLElement | undefined;
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - strip.current.offsetLeft, behavior: 'instant' as ScrollBehavior });
  }, [startIndex]);

  const go = (i: number) => {
    const next = Math.min(months.length - 1, Math.max(0, i));
    const el = strip.current?.children[next] as HTMLElement | undefined;
    if (el && strip.current) strip.current.scrollTo({ left: el.offsetLeft - strip.current.offsetLeft });
    setAt(next);
  };
  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    const w = (el.children[0] as HTMLElement | undefined)?.offsetWidth ?? el.clientWidth;
    const i = Math.round(el.scrollLeft / Math.max(1, w + 14));
    if (i !== at) setAt(Math.min(months.length - 1, Math.max(0, i)));
  };

  return (
    <div className={s.wrap} data-seat-months="">
      <button type="button" className={`${s.arrow} ${s.prev}`} aria-label="Previous month" onClick={() => go(at - 1)} disabled={at <= 0}>
        ‹
      </button>
      <button type="button" className={`${s.arrow} ${s.next}`} aria-label="Next month" onClick={() => go(at + 1)} disabled={at >= months.length - 1}>
        ›
      </button>
      <div
        ref={strip}
        className={s.months}
        tabIndex={0}
        aria-label="Months, swipe to change"
        onScroll={onScroll}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(at + 1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(at - 1);
          }
        }}
      >
        {months.map(({ y, m }) => {
          const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
          const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
          const name = `${MONTH_NAMES[m - 1]} ${y}`;
          return (
            <section key={`${y}-${m}`} className={s.month} aria-label={name} data-seat-month={iso(y, m, 1).slice(0, 7)}>
              <p className={s.title}>{name}</p>
              <div className={s.grid}>
                {DOW.map((d, i) => (
                  <span key={i} className={s.dh} aria-hidden>
                    {d}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`l${i}`} aria-hidden />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const day = iso(y, m, i + 1);
                  const state = stateOf(day);
                  const isToday = day === today;
                  if (state === null) {
                    return (
                      <span key={day} className={`${s.day} ${s.past}`} aria-label={`${i + 1}, past`} data-seat="past">
                        {i + 1}
                      </span>
                    );
                  }
                  const pop = state === 'available' && dayShines(day);
                  const cls = [s.day, state === 'not_bookable' ? s.off : '', pop ? s.pop : '', isToday ? s.today : '', value === day ? s.pick : '']
                    .filter(Boolean)
                    .join(' ');
                  const words = state === 'not_bookable' ? 'not bookable' : pop ? 'available, popular' : 'available';
                  return (
                    <button
                      key={day}
                      type="button"
                      className={cls}
                      aria-label={`${i + 1}, ${words}`}
                      aria-pressed={value === day}
                      onClick={() => onPick(day)}
                      data-seat={state === 'not_bookable' ? 'off' : pop ? 'popular' : 'open'}
                      data-day={day}
                    >
                      {i + 1}
                      {pop ? (
                        <i className={s.mark} aria-hidden>
                          ✦
                        </i>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <ul className={s.legend} data-check-date-legend="">
        <li>
          <span className={`${s.sw} ${s.swAv}`} aria-hidden />
          {CHECK_DATE_WORDS.available}
        </li>
        <li>
          <span className={`${s.sw} ${s.swPop}`} aria-hidden>
            ✦
          </span>
          {CHECK_DATE_POPULAR}
        </li>
        <li>
          <span className={`${s.sw} ${s.swOff}`} aria-hidden />
          {CHECK_DATE_WORDS.not_bookable}
        </li>
      </ul>
    </div>
  );
}
