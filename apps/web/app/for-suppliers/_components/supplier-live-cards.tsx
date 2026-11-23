'use client';

/**
 * /for-suppliers § 5 · "Your service cards" — THE LIVE CARDS (owner-approved drawing
 * `prototypes/for_suppliers_redraw_2026-11-23/for_suppliers_redraw_fable.html`, owner 23 Nov: *"Approved, build it"*).
 *
 * Four Card 14 samples (the shipped `ServiceFace layout="mall"`) answer one couple: their DATE on the real Check a date
 * month (`SeatMonths`, reused, never copied), their GUESTS (the per-guest caterer's band becomes "for your N guests",
 * `mallPrice`) and their VENUE (each card's distance, `aboutKmLine`).
 *
 * 📅 A SHOP THAT IS NOT FREE THAT DAY LEAVES THE ROW (owner 23 Nov, after the drawing: the card must disappear, not
 * stay labelled "Booked that day"). It fades and shrinks out, the cards after it slide into its place, and it comes
 * back the same way on a day it is free. When every sample shop is closed the row says so in words.
 *
 * 💬 THE "WHAT'S HAPPENING" TIP (owner 23 Nov: *"this needs to show what is happening and not just changing"* ·
 * *"pointing at something like a what's happening pop up"*). Each change gets one small tip that points at what changed
 * (the card that left or came back, the caterer's total, a distance), reads for a moment, then settles away. Its look is
 * the approved spotlight tip card (`spotlight-tour.tsx`, corpus `prototypes/spotlight_tour_sample_2026-10-02.html`)
 * without the dim: the page stays live underneath. Its words are `LIVE_TIPS`. It is a `role="status"` region, so a
 * screen reader hears the same sentence.
 *
 * 🎞 HOW IT PLAYS — on NATIVE scroll: the stage is `position: sticky` inside its scene, and the scene's scroll room is a
 * real block INSIDE it (`.liveRoom`; padding does not give a sticky child room — the drawing's one bug). The page's
 * scroll progress through the scene picks one of four states (`LIVE_SCRIPT`, `liveStepAt`); nothing takes the wheel or
 * the touch. A tap drives the same state: a day, a guest count, a venue, a need chip (phone) or a card (its month).
 * A line that changed glows and rises once (transform + opacity, the motion standard's tokens).
 *
 * ♿ REDUCED MOTION (or no script): nothing pins, there is no scroll room, the three needs sit open one under the other,
 * and the cards rest in the last state. A card that leaves simply goes; the tip appears and goes without moving. Every
 * hidden or pinned rule sits behind `[data-motion]`, which only this script sets
 * (`the-website-moves-by-the-standard.test.ts`).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { ServiceFace } from '@/app/_components/service-face';
import { CardBadgeRow } from '@/app/_components/card-badges/card-badge-row';
import { PillSelector } from '@/app/_components/pill-selector';
import { SeatMonths, type SeatState } from '@/app/v/[slug]/dates/_components/seat-months';
import { aboutKmLine, mallPrice } from '@/lib/mall-card';
import { formatPhpRounded } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import {
  LIVE_CARD_SAMPLES,
  LIVE_GUESTS,
  LIVE_GUESTS_PER_DOT,
  LIVE_SCRIPT,
  LIVE_TIPS,
  LIVE_VENUES,
  liveStepAt,
  type LiveCardSample,
  type LiveState,
} from './supplier-front-data';
import { SampleDateFit } from './sample-card-date-fit';
import s from './supplier-front.module.css';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** How long a tip stays to be read before it settles away — a reading time, not a motion (those are the tokens). */
const TIP_READ = 4200;
/** The tip's widest and its gap from the edges of the stage and from what it points at. */
const TIP_W = 300;
const TIP_EDGE = 8;
const TIP_GAP = 10;

type Stage = LiveState & { shop: number };
type Tip = { n: number; title: string; body: string; anchor: HTMLElement };
type TipAt = { left: number; top: number; width: number; caret: number; below: boolean };

/** Restart a one-time "this changed" mark on an element (the CSS plays it while `data-hit` is set). */
function hit(el: Element | null | undefined) {
  if (!(el instanceof HTMLElement)) return;
  el.removeAttribute('data-hit');
  void el.offsetWidth;
  el.setAttribute('data-hit', '');
}

/** A motion token's length in ms as the page defines it (`--sn-m-move: 320ms`); 0 when it cannot be read. */
function tokenMs(el: Element, name: string): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) ? v : 0;
}

export function SupplierLiveCards({ month, today }: { month: { y: number; m: number }; today: string }) {
  const { y, m } = month;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const first = isoOf(y, m, 1);
  const last = isoOf(y, m, days);

  const [stage, setStage] = useState<Stage>({ ...LIVE_SCRIPT[0]!, shop: 0 });
  const [motion, setMotion] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLUListElement>(null);
  const step = useRef(-1);
  /** The next stage change is a jump (first load, reduced motion), not something to explain: no tip, no slide. */
  const quiet = useRef(false);

  // Reduced motion: no pinning, the last state at rest. Otherwise the script marks the scene and the scroll plays it.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      quiet.current = true;
      setStage((st) => ({ ...LIVE_SCRIPT[LIVE_SCRIPT.length - 1]!, shop: st.shop }));
      return;
    }
    setMotion(true);
  }, []);

  useEffect(() => {
    if (!motion) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const sc = scene.current;
      const p = pin.current;
      if (!sc || !p) return;
      const bar = parseFloat(getComputedStyle(sc).getPropertyValue('--fd-bar'));
      const top = Math.min(Number.isFinite(bar) ? bar : 56, window.innerHeight - p.offsetHeight - 8);
      sc.style.setProperty('--live-top', `${Math.round(top)}px`);
      const r = sc.getBoundingClientRect();
      const room = r.height - p.offsetHeight;
      const progress = room > 0 ? Math.min(1, Math.max(0, (top - r.top) / room)) : 0;
      const next = liveStepAt(progress);
      if (next !== step.current) {
        // A page opened part-way down lands on its step at once: nothing "happened" to explain.
        if (step.current === -1 && next !== 0) quiet.current = true;
        step.current = next;
        setStage((st) => ({ ...LIVE_SCRIPT[next]!, shop: st.shop }));
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [motion]);

  const set = useCallback((patch: Partial<Stage>) => setStage((st) => ({ ...st, ...patch })), []);
  const shop = LIVE_CARD_SAMPLES[stage.shop]!;
  const closed = useMemo(() => new Set(shop.closed), [shop]);
  const stateOf = useCallback(
    (day: string): SeatState => {
      if (day < first || day > last) return null;
      return closed.has(Number(day.slice(8))) ? 'not_bookable' : 'available';
    },
    [closed, first, last],
  );
  const labelOf = useCallback((d: number) => `${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MON[m - 1]}`, [y, m]);
  const dayLabel = labelOf(stage.day);
  const venue = LIVE_VENUES[stage.venue]!;
  const allOut = LIVE_CARD_SAMPLES.every((c) => c.closed.includes(stage.day));

  // The guest count rises when it changes (the dots follow by their own transition).
  const gBig = useRef<HTMLElement>(null);
  const lastGuests = useRef(stage.guests);
  useEffect(() => {
    if (lastGuests.current !== stage.guests) hit(gBig.current);
    lastGuests.current = stage.guests;
  }, [stage.guests]);

  /* ── A card leaving or coming back: it fades and shrinks (opacity + transform), THEN leaves the row; the cards after
     it slide from where they were to where they are (FLIP, transform only). Nothing here is laid out on a timer. ── */
  const lis = useRef<Array<HTMLLIElement | null>>([]);
  const toggle = useCallback(
    (i: number, out: boolean, animate: boolean) => {
      const li = lis.current[i];
      const list = row.current;
      if (!li || !list) return;
      const slideOthers = (change: () => void) => {
        const before = lis.current.map((el) => (el && !el.hidden ? el.offsetLeft : null));
        change();
        if (!animate) return;
        const move = tokenMs(list, '--sn-m-move');
        const ease = getComputedStyle(list).getPropertyValue('--sn-m-settle').trim() || 'ease-out';
        lis.current.forEach((el, k) => {
          const was = before[k];
          if (!el || el.hidden || was == null || k === i) return;
          const dx = was - el.offsetLeft;
          if (dx) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: move, easing: ease });
        });
      };
      if (out) {
        if (li.hidden) return;
        if (!animate) {
          li.hidden = true;
          return;
        }
        li.setAttribute('data-out', '');
        const wait = tokenMs(list, '--sn-m-move');
        window.setTimeout(() => {
          if (!li.hasAttribute('data-out')) return; // came back while it was leaving
          slideOthers(() => {
            li.hidden = true;
          });
        }, wait);
      } else {
        if (!li.hidden && !li.hasAttribute('data-out')) return;
        slideOthers(() => {
          li.hidden = false;
        });
        if (!animate) {
          li.removeAttribute('data-out');
          return;
        }
        li.setAttribute('data-out', '');
        requestAnimationFrame(() => requestAnimationFrame(() => li.removeAttribute('data-out')));
      }
    },
    [],
  );

  /* ── The tip: what changed, pointed at. ── */
  const [tip, setTip] = useState<Tip | null>(null);
  const [tipAt, setTipAt] = useState<TipAt | null>(null);
  const [tipOn, setTipOn] = useState(false);
  const tipBox = useRef<HTMLDivElement>(null);
  const was = useRef<Stage>(stage);
  const tipN = useRef(0);

  useEffect(() => {
    const prev = was.current;
    was.current = stage;
    if (prev === stage) {
      // First run (or the motion mark arriving): the row simply matches the day, nothing to explain.
      LIVE_CARD_SAMPLES.forEach((c, i) => toggle(i, c.closed.includes(stage.day), false));
      return;
    }
    const jump = quiet.current;
    quiet.current = false;
    const animate = motion && !jump;
    const say = (t: Omit<Tip, 'n'>) => {
      if (jump) return;
      tipN.current += 1;
      setTip({ ...t, n: tipN.current });
    };

    if (prev.day !== stage.day) {
      const leaving: number[] = [];
      const coming: number[] = [];
      LIVE_CARD_SAMPLES.forEach((c, i) => {
        const wasOut = c.closed.includes(prev.day);
        const out = c.closed.includes(stage.day);
        if (out && !wasOut) leaving.push(i);
        if (!out && wasOut) coming.push(i);
        toggle(i, out, animate);
      });
      const i = leaving[0] ?? coming[0];
      const el = i != null ? lis.current[i] : null;
      if (i != null && el && !LIVE_CARD_SAMPLES.every((c) => c.closed.includes(stage.day))) {
        const words = leaving.length ? LIVE_TIPS.leaves : LIVE_TIPS.returns;
        say({ ...words(LIVE_CARD_SAMPLES[i]!.shop, labelOf(stage.day)), anchor: el });
      }
      return;
    }
    if (prev.guests !== stage.guests) {
      const k = LIVE_CARD_SAMPLES.findIndex((c) => c.perGuest != null && !c.closed.includes(stage.day));
      const el = k >= 0 ? lis.current[k]?.querySelector<HTMLElement>('[data-mall-price]') : gBig.current;
      if (el) say({ ...LIVE_TIPS.guests(formatCount(stage.guests)), anchor: el });
      return;
    }
    if (prev.venue !== stage.venue) {
      const k = LIVE_CARD_SAMPLES.findIndex((c) => !c.closed.includes(stage.day));
      const el = k >= 0 ? lis.current[k]?.querySelector<HTMLElement>('[data-mall-distance]') : null;
      if (el) say({ ...LIVE_TIPS.place(LIVE_VENUES[stage.venue]!.name), anchor: el });
    }
  }, [stage, motion, toggle, labelOf]);

  // Place the tip over what it points at (inside the stage, so it moves with it), above when there is room.
  const place = useCallback(() => {
    const p = pin.current;
    const box = tipBox.current;
    if (!p || !box || !tip) return;
    const a = tip.anchor;
    if (a.closest('[hidden]')) return; // a card that has left keeps the tip where it last was
    const pr = p.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    if (!ar.width) return;
    const width = Math.min(TIP_W, pr.width - TIP_EDGE * 2);
    const h = box.offsetHeight;
    const cx = ar.left - pr.left + ar.width / 2;
    const left = Math.min(Math.max(cx - width / 2, TIP_EDGE), pr.width - width - TIP_EDGE);
    const above = ar.top - pr.top - TIP_GAP - h;
    const below = above < 0;
    const top = below ? ar.bottom - pr.top + TIP_GAP : above;
    const caret = Math.min(Math.max(cx - left, 18), width - 18);
    setTipAt((o) => (o && o.left === left && o.top === top && o.width === width && o.caret === caret && o.below === below ? o : { left, top, width, caret, below }));
  }, [tip]);

  useLayoutEffect(() => {
    if (!tip) return;
    place();
    setTipOn(true);
    // A card coming back is drawn a frame later: place again once it is there.
    const f = requestAnimationFrame(() => requestAnimationFrame(place));
    const off = window.setTimeout(() => setTipOn(false), TIP_READ);
    return () => {
      cancelAnimationFrame(f);
      window.clearTimeout(off);
    };
  }, [tip, place]);

  useEffect(() => {
    const list = row.current;
    if (!list || !tip) return;
    list.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      list.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [tip, place]);

  const needs: Array<{ slide: 0 | 1 | 2; icon: typeof CalendarDays; words: string }> = [
    { slide: 0, icon: CalendarDays, words: dayLabel },
    { slide: 1, icon: Users, words: `${formatCount(stage.guests)} guests` },
    { slide: 2, icon: MapPin, words: venue.name },
  ];

  const tipStyle: CSSProperties | undefined = tipAt
    ? ({ left: tipAt.left, top: tipAt.top, width: tipAt.width, ['--caret' as string]: `${tipAt.caret}px` } as CSSProperties)
    : undefined;

  return (
    <div ref={scene} className={s.liveScene} data-motion={motion ? '' : undefined} data-live-cards="">
      <div ref={pin} className={s.livePin}>
        <div className={s.needs} role="group" aria-label="What the couple needs">
          {needs.map((n) => (
            <button key={n.slide} type="button" className={s.need} aria-pressed={stage.slide === n.slide} onClick={() => set({ slide: n.slide })}>
              <n.icon aria-hidden className={s.needIc} strokeWidth={2} />
              <span>{n.words}</span>
            </button>
          ))}
        </div>
        <div className={s.slides}>
          <div className={`${s.slide} ${stage.slide === 0 ? s.slideOn : ''}`} data-live-slide="date">
            <div className={s.cal}>
              <p className={s.calWho}>
                <CalendarDays aria-hidden className={s.needIc} strokeWidth={2} />
                <b>{shop.shop}</b>
              </p>
              <SeatMonths
                today={today}
                from={first}
                to={last}
                startAt={first}
                value={isoOf(y, m, stage.day)}
                stateOf={stateOf}
                onPick={(day) => set({ day: Number(day.slice(8)), slide: 0 })}
              />
            </div>
          </div>
          <div className={`${s.slide} ${stage.slide === 1 ? s.slideOn : ''}`} data-live-slide="guests">
            <p className={s.gNum}>
              <b ref={gBig}>{formatCount(stage.guests)}</b>
              <span>guests</span>
            </p>
            <div className={s.gDots} aria-hidden="true">
              {Array.from({ length: Math.max(...LIVE_GUESTS) / LIVE_GUESTS_PER_DOT }, (_, i) => (
                <i key={i} className={i < Math.round(stage.guests / LIVE_GUESTS_PER_DOT) ? s.gOn : undefined} style={{ ['--i' as string]: Math.min(i, 12) }} />
              ))}
            </div>
            <PillSelector
              label="Guests"
              grow={false}
              value={String(stage.guests)}
              options={LIVE_GUESTS.map((g) => ({ key: String(g), label: formatCount(g) }))}
              onPick={(k) => set({ guests: Number(k), slide: 1 })}
              data="live-guests"
            />
          </div>
          <div className={`${s.slide} ${stage.slide === 2 ? s.slideOn : ''}`} data-live-slide="venue">
            <svg className={s.vMap} viewBox="0 0 300 150" role="img" aria-label={`The venue in ${venue.name} and the four sample shops`}>
              <path className={s.vLand} d="M120 6c40-8 96 4 110 34 12 26-14 44-40 52-22 8-30 30-52 46-22 16-66 14-74-12-8-24 20-36 28-58 8-22-6-54 28-62z" />
              {LIVE_VENUES.map((v, i) => (
                <g key={v.name} className={`${s.vOne} ${i === stage.venue ? s.vOn : ''}`}>
                  {LIVE_CARD_SAMPLES.map((c) => (
                    <path key={c.shop} className={s.vLine} d={`M${v.pin[0]} ${v.pin[1]}L${c.at[0]} ${c.at[1]}`} />
                  ))}
                </g>
              ))}
              {LIVE_CARD_SAMPLES.map((c) => (
                <circle key={c.shop} className={s.vShop} cx={c.at[0]} cy={c.at[1]} r="4" />
              ))}
              {LIVE_VENUES.map((v) => (
                <text key={v.name} className={s.vText} x={v.pin[0] + 8} y={v.pin[1] + 4}>
                  {v.name}
                </text>
              ))}
              {LIVE_VENUES.map((v, i) => (
                <g key={v.name} className={`${s.vOne} ${i === stage.venue ? s.vOn : ''}`}>
                  <path className={s.vPin} d={`M${v.pin[0]} ${v.pin[1] + 2}c-7-9-10-13-10-18a10 10 0 0 1 20 0c0 5-3 9-10 18z`} />
                  <circle className={s.vPinDot} cx={v.pin[0]} cy={v.pin[1] - 16} r="3.5" />
                </g>
              ))}
            </svg>
            <PillSelector
              label="Venue"
              grow={false}
              value={String(stage.venue)}
              options={LIVE_VENUES.map((v, i) => ({ key: String(i), label: v.name }))}
              onPick={(k) => set({ venue: Number(k), slide: 2 })}
              data="live-venue"
            />
          </div>
        </div>
        <ul ref={row} className={s.liveRow}>
          {LIVE_CARD_SAMPLES.map((c, i) => (
            <LiveCard
              key={c.shop}
              ref={(el) => {
                lis.current[i] = el;
              }}
              sample={c}
              stage={stage}
              selected={i === stage.shop}
              onPick={() => set({ shop: i, slide: 0 })}
            />
          ))}
          {allOut ? (
            <li className={s.liveNone} data-live-none="">
              {LIVE_TIPS.none(dayLabel)}
            </li>
          ) : null}
        </ul>
        <div
          ref={tipBox}
          className={s.liveTip}
          role="status"
          data-show={tip && tipOn && tipAt ? '' : undefined}
          data-below={tipAt?.below ? '' : undefined}
          style={tipStyle}
          data-live-tip=""
        >
          {tip ? (
            <span key={tip.n} className={s.liveTipIn}>
              <b>{tip.title}</b>
              <span>{tip.body}</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className={s.liveRoom} aria-hidden="true" />
    </div>
  );
}

function LiveCard({
  ref,
  sample: c,
  stage,
  selected,
  onPick,
}: {
  ref: (el: HTMLLIElement | null) => void;
  sample: LiveCardSample;
  stage: Stage;
  selected: boolean;
  onPick: () => void;
}) {
  const band = mallPrice({
    perGuest: c.perGuest != null ? { pricePhp: c.perGuest, minPax: null } : null,
    guests: stage.guests,
    price: c.price != null ? formatPhpRounded(c.price) : null,
    priceNote: c.priceNote,
  });
  const km = aboutKmLine(c.km[stage.venue]);
  const keys = { price: `${band?.big}|${band?.you}`, km: km ?? '' };
  const li = useRef<HTMLLIElement | null>(null);
  const was = useRef(keys);
  useEffect(() => {
    const box = li.current;
    if (!box) return;
    if (was.current.price !== keys.price) hit(box.querySelector('[data-mall-price]'));
    if (was.current.km !== keys.km) hit(box.querySelector('[data-mall-distance]'));
    was.current = keys;
  });
  return (
    <li
      ref={(el) => {
        li.current = el;
        ref(el);
      }}
      className={s.liveCard}
      data-sel={selected ? '' : undefined}
      data-live-card={c.shop}
    >
      <ServiceFace
        layout="mall"
        name={c.name}
        coverUrl={c.cover}
        shop={{ name: c.shop, href: null, logoUrl: null, verified: c.badges.some((b) => b.key === 'verified') }}
        city={c.city}
        rating={c.rating}
        mallPrice={band}
        medals={<CardBadgeRow badges={c.badges} cardName={c.name} shopName={c.shop} now={0} />}
        lines={<SampleDateFit fit="free" />}
        distance={km}
        door={{ label: `Show the month of ${c.shop}`, onOpen: onPick }}
      />
    </li>
  );
}
