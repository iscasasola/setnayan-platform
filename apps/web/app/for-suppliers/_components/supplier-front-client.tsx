'use client';

/**
 * /for-suppliers — the two parts of the approved page of 20 Nov 2026 that answer a tap (`prototypes/for_suppliers_2026-
 * 11-20/`, Setnayan-specs): the booking-fee ruler with its "Free when" switches, and the plan rows.
 *
 * WHERE EVERY NUMBER COMES FROM:
 *   · each stop's fee → `bookingFeePhp(v, schedule)`, the LIVE schedule the page read (`getLiveBookingFeeSchedule`) —
 *     never the code default; the stops themselves are example booking prices (`FEE_STOPS`), not prices;
 *   · each plan's price → the catalog (`getVendorPrices`), handed in by the page; one that could not be read shows "—".
 *
 * 🎚 THE DRAWING'S RULER, ON WHAT IS LIVE. The drawing locks the fee at a ceiling and frees "every 100,000th fee" and
 * "the first supplier on an event". None of those is built (2026-11-20): the live fee has a floor and no ceiling, so
 * the ruler draws no lock, and the switches are only the free bookings the app actually gives — handed in by the page
 * (`freeWhen`), never typed here.
 */
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { bookingFeePhp, type BookingFeeSchedule } from '@/lib/booking-fee';
import { FEE_STOPS, FEE_STOP_START } from './supplier-front-data';
import s from './supplier-front.module.css';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PCT = new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 });
const peso = (n: number) => PESO.format(n);

/** One "Free when" switch: its label, and the line the ruler says while it is the first one on. */
export type FreeWhen = { label: string; hint: string };

export function FeeRuler({ schedule, freeWhen }: { schedule: BookingFeeSchedule; freeWhen: readonly FreeWhen[] }) {
  const stops = useMemo(() => FEE_STOPS.map((v) => ({ v, fee: bookingFeePhp(v, schedule) })), [schedule]);
  const [at, setAt] = useState<number>(FEE_STOP_START);
  const [on, setOn] = useState<readonly boolean[]>(() => freeWhen.map(() => false));
  const sc = useRef<HTMLDivElement>(null);
  const id = useId();

  // Open on the start stop, centred under the window.
  useEffect(() => {
    const el = sc.current;
    const stop = el?.children[FEE_STOP_START] as HTMLElement | undefined;
    if (el && stop) el.scrollLeft = stop.offsetLeft - (el.clientWidth - stop.offsetWidth) / 2;
  }, []);

  const onScroll = () => {
    const el = sc.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let gap = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const k = c as HTMLElement;
      const d = Math.abs(k.offsetLeft + k.offsetWidth / 2 - mid);
      if (d < gap) {
        gap = d;
        best = i;
      }
    });
    if (best !== at) setAt(best);
  };

  const first = on.findIndex(Boolean);
  const free = first >= 0;
  const cur = stops[at] ?? stops[0]!;
  const share = at / Math.max(1, stops.length - 1);

  return (
    <div className={s.fx} data-free={free ? '' : undefined}>
      <p className={s.fxTry}>Test it: drag the bar to see your fee.</p>
      <div className={s.fxRule}>
        <div className={s.fxBar} aria-hidden="true">
          {free ? <span className={s.fxFree}>Free · no booking fee</span> : null}
          <i className={s.fxTrack}>
            <i className={s.fxFill} style={{ transform: `scaleX(${share})` }} />
          </i>
          <i className={s.fxThumb} style={{ left: `${share * 100}%` }} />
          <span className={s.fxEnd}>{peso(stops[0]!.v)}</span>
          <span className={`${s.fxEnd} ${s.fxEndR}`}>{peso(stops[stops.length - 1]!.v)}</span>
        </div>
        <div className={s.fxWin} aria-hidden="true" />
        <div
          ref={sc}
          className={s.fxSc}
          tabIndex={0}
          role="group"
          aria-label={`Booking prices from ${peso(stops[0]!.v)} to ${peso(stops[stops.length - 1]!.v)}, each with its fee. Swipe sideways.`}
          aria-describedby={id}
          onScroll={onScroll}
        >
          {stops.map((p) => (
            <div key={p.v} className={s.fxP}>
              <span className={s.fxB}>{peso(p.v)} booking</span>
              {free ? (
                <>
                  <b className={s.fxFr}>Free · {peso(0)}</b>
                  <span className={s.fxPc}>
                    Fee <s>{peso(p.fee)}</s>
                  </span>
                </>
              ) : (
                <>
                  <span className={s.fxF}>
                    <small>Fee</small>
                    <b>{peso(p.fee)}</b>
                  </span>
                  <span className={s.fxPc}>
                    <b>{PCT.format(p.fee / p.v)}</b> of the booking
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <p className={s.fxHint} id={id} aria-live="polite">
        {free ? <b>{freeWhen[first]!.hint}</b> : 'Swipe sideways. Each stop is a booking price.'}
        <span className="sr-only">
          {` ${peso(cur.v)} booking: ${free ? 'no booking fee' : `fee ${peso(cur.fee)}`}.`}
        </span>
      </p>
      {freeWhen.length > 0 ? (
        <>
          <p className={`${s.feeK} ${s.fxK}`}>Free when</p>
          <div className={s.fxCs}>
            {freeWhen.map((w, i) => (
              <label key={w.label} className={s.fxC}>
                <span>{w.label}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={on[i] ?? false}
                  onChange={(e) => setOn((o) => o.map((x, j) => (j === i ? e.target.checked : x)))}
                />
                <i aria-hidden="true" />
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** One plan row: its name, its one line, and its price as the catalog has it (or "—" when it could not be read). */
export type PlanRow = { name: string; line: string; price: string | null; per: string; cta: string; href?: string };

export function PlanRows({ rows, href }: { rows: readonly PlanRow[]; href: string }) {
  return (
    <ul className={s.plans}>
      {rows.map((c) => (
        <li key={c.name}>
          <Link aria-label={`${c.cta}: ${c.name}, ${c.price ?? 'price unavailable'} ${c.per}`} className={`${s.plan} ${s.pickCta}`} href={c.href ?? href}>
            <span className={s.pw}>
              <b>{c.name}</b>
              <span>{c.line}</span>
            </span>
            <span className={s.pc}>
              <span>{c.price ?? '—'}</span>
              <small>{c.per}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
