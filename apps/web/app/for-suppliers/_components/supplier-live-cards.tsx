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
 * stay labelled "Booked that day"). A ring marks it, it fades and shrinks out, the cards after it slide into its place,
 * and it comes back the same way on a day it is free. When every sample shop is closed the row says so in words.
 *
 * 💬 THE "WHAT'S HAPPENING" STORY (owner 23 Nov: *"this needs to show what is happening and not just changing"*, then
 * on the preview: *"shouldn't we maximize the screen? so the story telling of what is happening can be under?"*). The
 * stage fills the screen under the top bar, and one plain sentence UNDER the cards says what just happened — a card
 * left or came back, the caterer's new total, the new distance. The pointer is on the card itself: a ring on the card
 * that left or came back, a wash over the price or distance line that changed. Nothing floats over the cards. The
 * panel wears the spotlight tip card's solid surface. Its words are `LIVE_STORY`; it is a `role="status"` region.
 *
 * 🎞 HOW IT PLAYS — on NATIVE scroll: the stage is `position: sticky` inside its scene, and the scene's scroll room is a
 * real block INSIDE it (`.liveRoom`; padding does not give a sticky child room — the drawing's one bug). The page's
 * scroll progress through the scene picks one of four states (`LIVE_SCRIPT`, `liveStepAt`); nothing takes the wheel or
 * the touch. A tap drives the same state: a day, a guest count, a venue, a need chip (phone) or a card (its month).
 *
 * ♿ REDUCED MOTION (or no script): nothing pins, there is no scroll room, the three needs sit open one under the other,
 * and the cards rest in the last state. A card that leaves simply goes; no ring, no wash — the story's words only.
 * Every hidden or pinned rule sits behind `[data-motion]`, which only this script sets
 * (`the-website-moves-by-the-standard.test.ts`).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  LIVE_STORY,
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

type Stage = LiveState & { shop: number };

/** A card's price band for the couple's guest count — the ONE place the live cards ask `mallPrice`. */
function bandOf(c: LiveCardSample, guests: number) {
  return mallPrice({
    perGuest: c.perGuest != null ? { pricePhp: c.perGuest, minPax: null } : null,
    guests,
    price: c.price != null ? formatPhpRounded(c.price) : null,
    priceNote: c.priceNote,
  });
}

/** Restart a one-time mark on an element (the CSS plays it while the attribute is set): a wash, or a card's ring. */
function hit(el: Element | null | undefined, attr = 'data-hit') {
  if (!(el instanceof HTMLElement)) return;
  el.removeAttribute(attr);
  void el.offsetWidth;
  el.setAttribute(attr, '');
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
  /** The next stage change is a jump (first load, reduced motion), not something to tell: no story, no ring. */
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
        // A page opened part-way down lands on its step at once: nothing "happened" to tell.
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

  /* ── A card leaving or coming back. Leaving: a ring marks it, it fades and shrinks (opacity + transform), THEN it
     leaves the row and the cards after it slide from where they were to where they are (FLIP, transform only).
     Coming back: it is laid in, fades up, and the ring marks it. ── */
  const lis = useRef<Array<HTMLLIElement | null>>([]);
  const toggle = useCallback((i: number, out: boolean, animate: boolean) => {
    const li = lis.current[i];
    const list = row.current;
    if (!li || !list) return;
    const move = animate ? tokenMs(list, '--sn-m-move') : 0;
    const slideOthers = (change: () => void) => {
      const before = lis.current.map((el) => (el && !el.hidden ? el.offsetLeft : null));
      change();
      if (!animate) return;
      const ease = getComputedStyle(list).getPropertyValue('--sn-m-settle').trim() || 'ease-out';
      lis.current.forEach((el, k) => {
        const was = before[k];
        if (!el || el.hidden || was == null || k === i) return;
        const dx = was - el.offsetLeft;
        if (dx) el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: move, easing: ease });
      });
    };
    if (out) {
      if (li.hidden || li.hasAttribute('data-leaving')) return;
      if (!animate) {
        li.hidden = true;
        return;
      }
      li.setAttribute('data-leaving', '');
      hit(li, 'data-ring');
      window.setTimeout(() => {
        if (!li.hasAttribute('data-leaving')) return; // came back while it was being marked
        li.setAttribute('data-out', '');
        window.setTimeout(() => {
          if (!li.hasAttribute('data-leaving')) return; // came back while it was fading
          li.removeAttribute('data-leaving');
          slideOthers(() => {
            li.hidden = true;
          });
        }, move);
      }, move);
    } else {
      const leaving = li.hasAttribute('data-leaving');
      if (!li.hidden && !leaving) return;
      li.removeAttribute('data-leaving');
      slideOthers(() => {
        li.hidden = false;
      });
      if (!animate) {
        li.removeAttribute('data-out');
        return;
      }
      li.setAttribute('data-out', '');
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          li.removeAttribute('data-out');
          hit(li, 'data-ring');
        }),
      );
    }
  }, []);

  /* ── The story: one sentence under the cards, swapped at each change. ── */
  const [story, setStory] = useState<{ n: number; text: string }>({ n: 0, text: LIVE_STORY.start });
  const was = useRef<Stage>(stage);

  useEffect(() => {
    const prev = was.current;
    was.current = stage;
    if (prev === stage) {
      // First run (or the motion mark arriving): the row simply matches the day, nothing to tell.
      LIVE_CARD_SAMPLES.forEach((c, i) => toggle(i, c.closed.includes(stage.day), false));
      return;
    }
    const jump = quiet.current;
    quiet.current = false;
    const animate = motion && !jump;
    const tell = (text: string) => {
      if (!jump) setStory((o) => ({ n: o.n + 1, text }));
    };
    const inRow = (c: LiveCardSample) => !c.closed.includes(stage.day);

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
      const day = labelOf(stage.day);
      if (LIVE_CARD_SAMPLES.every((c) => !inRow(c))) tell(LIVE_STORY.none(day));
      else if (leaving.length) tell(LIVE_STORY.leaves(LIVE_CARD_SAMPLES[leaving[0]!]!.shop, day));
      else if (coming.length) tell(LIVE_STORY.returns(LIVE_CARD_SAMPLES[coming[0]!]!.shop, day));
      return;
    }
    if (prev.guests !== stage.guests) {
      const c = LIVE_CARD_SAMPLES.find((x) => x.perGuest != null && inRow(x));
      const total = c ? bandOf(c, stage.guests)?.big : null;
      if (c && total) tell(LIVE_STORY.guests(c.shop, formatCount(stage.guests), total));
      return;
    }
    if (prev.venue !== stage.venue) {
      const c = LIVE_CARD_SAMPLES.find(inRow);
      const km = c ? aboutKmLine(c.km[stage.venue]) : null;
      if (c && km) tell(LIVE_STORY.place(c.shop, LIVE_VENUES[stage.venue]!.name, km));
    }
  }, [stage, motion, toggle, labelOf]);

  const needs: Array<{ slide: 0 | 1 | 2; icon: typeof CalendarDays; words: string }> = [
    { slide: 0, icon: CalendarDays, words: dayLabel },
    { slide: 1, icon: Users, words: `${formatCount(stage.guests)} guests` },
    { slide: 2, icon: MapPin, words: venue.name },
  ];

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
              {LIVE_STORY.none(dayLabel)}
            </li>
          ) : null}
        </ul>
        <p className={s.liveStory} role="status" data-live-story="">
          <span key={story.n} className={s.liveStoryIn}>
            {story.text}
          </span>
        </p>
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
  const band = bandOf(c, stage.guests);
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
