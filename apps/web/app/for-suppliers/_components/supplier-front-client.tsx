'use client';

/**
 * /for-suppliers — the two parts of the approved page of 20 Nov 2026 that answer a tap (`prototypes/for_suppliers_2026-
 * 11-20/`, Setnayan-specs): the booking-fee ruler with its "Free when" switches; and, from the redraw of 23 Nov
 * (`prototypes/for_suppliers_redraw_2026-11-23/for_suppliers_redraw_fable.html`), the plans as growth stairs.
 *
 * WHERE EVERY NUMBER COMES FROM:
 *   · each stop's fee → `bookingFeePhp(v, schedule)`, the LIVE schedule the page read (`getLiveBookingFeeSchedule`) —
 *     never the code default; the stops themselves are example booking prices (`FEE_STOPS`), not prices;
 *   · each plan's price → the catalog (`getVendorPrices`), handed in by the page; one that could not be read shows "—";
 *   · each stair's size, meter and five facts → `planStair` (`TIER_CAPS`), built by the page.
 *
 * 🎚 THE DRAWING'S RULER, ON WHAT IS LIVE. 🔒 The ₱100,000 lock is live (PR #8061, `platform_settings.booking_fee_cap_php`),
 * so the ruler draws it as the drawing does: a stop where the fee first reaches the lock (`feeRulerStops`, from the
 * schedule), a tick on the bar there, a "₱100,000 lock" flag (`bookingFeeCapAmount`) and a lock on every stop at the cap.
 * The switches are only the free bookings the app actually gives — handed in by the page (`freeWhen`), never typed here;
 * "every 100,000th fee" is live in billing but its N is not read by this page yet, so it is not a switch.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SWITCH_TRACK } from '@/app/_components/switch-track';
import { ArrowRight, Check, LayoutGrid, Lock, Search, Store, User, Users } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { bookingFeeCapAmount, type BookingFeeSchedule } from '@/lib/booking-fee';
import { FEE_STOP_START, feeRulerStops, type PlanStair, type StairFact } from './supplier-front-data';
import s from './supplier-front.module.css';

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PCT = new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 });
const peso = (n: number) => PESO.format(n);

/** One "Free when" switch: its label, and the line the ruler says while it is the first one on. */
export type FreeWhen = { label: string; hint: string };

export function FeeRuler({ schedule, freeWhen }: { schedule: BookingFeeSchedule; freeWhen: readonly FreeWhen[] }) {
  const stops = useMemo(() => feeRulerStops(schedule), [schedule]);
  /** Where the lock sits on the bar (0–1), or null when no stop reaches it. */
  const lockAt = useMemo(() => {
    const i = stops.findIndex((p) => p.lockPoint);
    return i < 0 ? null : i / Math.max(1, stops.length - 1);
  }, [stops]);
  const [at, setAt] = useState<number>(FEE_STOP_START);
  const [on, setOn] = useState<readonly boolean[]>(() => freeWhen.map(() => false));
  const sc = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  /** The stop a drag, tap or key sent the cards to — scroll events on the way there must not pull the dot back. */
  const goingTo = useRef<number | null>(null);
  const id = useId();
  const last = stops.length - 1;

  /** 🎚 The dot and the cards are ONE control: moving either moves the other. */
  const go = (i: number, smooth: boolean) => {
    const n = Math.max(0, Math.min(last, i));
    setAt(n);
    const el = sc.current;
    const stop = el?.children[n] as HTMLElement | undefined;
    if (!el || !stop) return;
    goingTo.current = n;
    el.scrollTo({ left: stop.offsetLeft - (el.clientWidth - stop.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  };

  // Open on the start stop, centred under the window — after layout, so a snap container that has not measured yet
  // does not leave the cards on the first stop while the dot sits on the start stop (owner, 20 Nov: "stuck").
  useEffect(() => {
    const r = requestAnimationFrame(() => go(FEE_STOP_START, false));
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The stop under a point on the bar. */
  const stopAt = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || r.width === 0) return at;
    return Math.round(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * last);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    go(stopAt(e.clientX), false);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const i = stopAt(e.clientX);
    if (i !== at) go(i, false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -3, PageUp: 3 }[e.key];
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? last : step === undefined ? null : at + step;
    if (to === null) return;
    e.preventDefault();
    go(to, true);
  };

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
    // On the way to a stop the bar sent it to, the cards pass other stops: hold the dot until they arrive.
    if (goingTo.current !== null) {
      if (best === goingTo.current) goingTo.current = null;
      return;
    }
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
        <div
          ref={bar}
          className={s.fxBar}
          role="slider"
          tabIndex={0}
          aria-label="Booking price"
          aria-valuemin={0}
          aria-valuemax={last}
          aria-valuenow={at}
          aria-valuetext={`${peso(cur.v)} booking, ${free ? 'no booking fee' : `fee ${peso(cur.fee)}`}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={onKeyDown}
        >
          {free ? (
            <span className={s.fxFree}>Free · no booking fee</span>
          ) : lockAt !== null ? (
            <span className={s.fxFlag}>
              <Lock aria-hidden className={s.fxLk} strokeWidth={2.2} />
              {bookingFeeCapAmount(schedule)} lock
            </span>
          ) : null}
          {!free && lockAt !== null ? <i className={s.fxTick} style={{ left: `${lockAt * 100}%` }} aria-hidden="true" /> : null}
          <i className={s.fxTrack}>
            <i className={s.fxFill} style={{ transform: `scaleX(${share})` }} />
          </i>
          <i className={s.fxThumb} style={{ left: `${share * 100}%` }} aria-hidden="true" />
          <span className={s.fxEnd} aria-hidden="true">{peso(stops[0]!.v)}</span>
          <span className={`${s.fxEnd} ${s.fxEndR}`} aria-hidden="true">{peso(stops[stops.length - 1]!.v)}</span>
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
          // A hand on the cards takes over from a glide the bar started — the dot follows the cards again at once.
          onPointerDown={() => (goingTo.current = null)}
          onTouchStart={() => (goingTo.current = null)}
          onWheel={() => (goingTo.current = null)}
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
                    {p.locked ? <Lock aria-label="locked" className={s.fxLk} strokeWidth={2.2} /> : null}
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
                  className="peer sr-only"
                  checked={on[i] ?? false}
                  onChange={(e) => setOn((o) => o.map((x, j) => (j === i ? e.target.checked : x)))}
                />
                <span aria-hidden="true" className={SWITCH_TRACK} />
              </label>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** One step of the plan stairs as the page hands it: the read facts (`planStair`), its price as the catalog has it
 *  (or "—" when it could not be read), and its one door. */
export type StairCard = PlanStair & { price: string | null; per: string; cta: string; href: string; main: boolean };

const PEOPLE_ICON = { team: Users, solo: User } as const;

/**
 * 🪜 PLANS AS GROWTH STAIRS (redraw of 23 Nov, owner "Approved, build it"): Free → Verified → Plus → Pro → Ultra, each
 * card its role, its size with a meter, five icon facts, its price and ONE button. On a phone the cards swipe sideways
 * and the five steps above them follow the swipe (a tap on a step glides there); from 760 px all five stand in a row,
 * each a step higher than the one before. The meters and the steps grow once as the part enters — behind the
 * `data-motion` mark this script sets, so without it (or with reduced motion) everything is simply drawn full.
 */
export function PlanStairs({ plans }: { plans: readonly StairCard[] }) {
  const row = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [motion, setMotion] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    setMotion(true);
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const go = (i: number) => {
    const el = row.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: reduce ? 'auto' : 'smooth' });
    setAt(i);
  };
  const onScroll = () => {
    const el = row.current;
    const card = el?.children[0] as HTMLElement | undefined;
    if (!el || !card) return;
    const i = Math.max(0, Math.min(plans.length - 1, Math.round(el.scrollLeft / Math.max(1, card.offsetWidth + 10))));
    if (i !== at) setAt(i);
  };

  return (
    <div ref={box} className={s.stairs} data-motion={motion ? '' : undefined} data-in={seen ? '' : undefined}>
      <div className={s.rail} role="group" aria-label="Plans, smallest to biggest">
        {plans.map((p, i) => (
          <button key={p.tier} type="button" className={s.stop} aria-pressed={i === at} onClick={() => go(i)}>
            <i style={{ ['--h' as string]: (i + 1) / plans.length }} aria-hidden="true" />
            {p.name}
          </button>
        ))}
      </div>
      <div ref={row} className={s.prow} onScroll={onScroll}>
        {plans.map((p, i) => {
          const People = PEOPLE_ICON[p.people.team ? 'team' : 'solo'];
          return (
            <article key={p.tier} className={`${s.stair} ${p.tools ? s.stairPaid : ''}`} style={{ ['--i' as string]: i }} data-plan={p.tier}>
              <div className={s.stairTop}>
                <div>
                  <p className={s.role}>{p.role}</p>
                  <h3>{p.name}</h3>
                </div>
                <p className={s.stairPrice}>
                  <b>{p.price ?? '—'}</b>
                  <small>{p.per}</small>
                </p>
              </div>
              {/* Clients first (owner 2026-11-23 "Yes, clients first"): what the storage keeps, then its size under it. */}
              <div className={s.size}>
                <p>
                  <b>{p.clients ?? p.size}</b>
                  {p.clients ? null : <span>storage</span>}
                </p>
                {p.clients && p.sizeLine ? <p className={s.sizeLine}>{p.sizeLine}</p> : null}
                <span className={s.meter} aria-hidden="true">
                  <i style={{ ['--w' as string]: p.share }} />
                </span>
              </div>
              <ul className={s.facts}>
                <li>
                  <LayoutGrid aria-hidden className={s.factIc} strokeWidth={2} />
                  <Fact f={p.services} />
                </li>
                <li>
                  <People aria-hidden className={s.factIc} strokeWidth={2} />
                  <Fact f={p.people} />
                </li>
                <li>
                  <Store aria-hidden className={s.factIc} strokeWidth={2} />
                  <Fact f={p.branches} />
                </li>
                <li className={p.marketplace ? undefined : s.factNo}>
                  <Search aria-hidden className={s.factIc} strokeWidth={2} />
                  <span>{p.marketplace ? 'On the marketplace' : 'Not on the marketplace'}</span>
                </li>
                <li className={p.tools ? s.factYes : s.factNo}>
                  {p.tools ? <Check aria-hidden className={s.factIc} strokeWidth={2.4} /> : <Lock aria-hidden className={s.factIc} strokeWidth={2} />}
                  <span>{p.tools ? <><b>Every</b> specialized tool</> : 'Specialized tools'}</span>
                </li>
              </ul>
              <ActionButton
                href={p.href}
                tone="brand"
                icon={ArrowRight}
                label={p.cta}
                name={`${p.cta}: ${p.name}, ${p.price ?? 'price unavailable'} ${p.per}`}
                main={p.main}
                className={s.stairBtn}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Fact({ f }: { f: StairFact }) {
  return (
    <span>
      {f.lead ? <b>{f.lead}</b> : null}
      {f.text}
    </span>
  );
}
