'use client';

/**
 * The moving parts of /for-suppliers (the owner-approved 6 Nov 2026 page), each the prototype's own script turned
 * into a component: the five-person hero, the reveals, the check-a-date phone, the QR sheet, the price-shape cards,
 * the event-day status, the fee slider, the Grow tabs and the phone dock. The words are passed in or are the
 * prototype's; every money figure is computed from what the page read (the fee from the live schedule through
 * `bookingFeePhp`), or is an illustration named as one (`PRICE_SHAPE_EXAMPLES`).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { SwitchTrack } from '@/app/_components/switch-track';
import { bookingFeePhp, type BookingFeeSchedule } from '@/lib/booking-fee';
import { FEE_SLIDER, type GrowLine, type GrowTier } from './supplier-front-data';
import s from './supplier-front.module.css';

/** A peso amount as people read it ("₱300,000") — the formatter carries the sign; no figure is typed here. */
const peso = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Math.round(n));
const count = (n: number) => n.toLocaleString('en-PH');
const pct = (n: number) => `${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 }).format(n)}%`;

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/* ───────────────────────── the root: reveals + sequences that play once ───────────────────────── */

/**
 * The page's root. Once the script runs (and motion is allowed) it marks the root `data-motion`, so `[data-rv]`
 * blocks start hidden and rise in as they come into view, and `[data-play-once]` sequences play once. Without the
 * script, or with reduced motion, everything is simply shown.
 */
export function SupplierFrontRoot({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      el.querySelectorAll<HTMLElement>('[data-play-once]').forEach((p) => p.setAttribute('data-play', ''));
      return;
    }
    el.setAttribute('data-motion', '');
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).setAttribute('data-in', '');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    el.querySelectorAll<HTMLElement>('[data-rv]').forEach((b) => {
      const sib = b.parentElement ? Array.prototype.indexOf.call(b.parentElement.children, b) : 0;
      b.style.transitionDelay = `${Math.min(sib, 5) * 90}ms`;
      io.observe(b);
    });
    const plays = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).setAttribute('data-play', '');
          plays.unobserve(e.target);
        }
      },
      { threshold: 0.3 },
    );
    el.querySelectorAll<HTMLElement>('[data-play-once]').forEach((p) => plays.observe(p));
    return () => {
      io.disconnect();
      plays.disconnect();
    };
  }, []);
  return (
    <div ref={root} className={s.root}>
      {children}
    </div>
  );
}

/* ───────────────────────── 1 · the hero: five people, cross-faded by scroll ───────────────────────── */

export type HeroSlide = { src: string; alt: string; dot: string; line: string };

export function HeroStage({ slides }: { slides: readonly HeroSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const [swapKey, setSwapKey] = useState(0);
  const reduce = useReducedMotion();
  const show = useCallback((i: number) => {
    setCur((c) => {
      if (c === i) return c;
      setSwapKey((k) => k + 1);
      return i;
    });
  }, []);
  useEffect(() => {
    if (reduce) return;
    let ticking = false;
    const on = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const t = track.current;
        if (!t) return;
        const r = t.getBoundingClientRect();
        const travel = r.height - window.innerHeight;
        if (travel > 40) {
          const p = Math.min(1, Math.max(0, -r.top / travel));
          show(Math.min(slides.length - 1, Math.floor(p * slides.length)));
        }
      });
    };
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    on();
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, [reduce, show, slides.length]);
  const pick = (k: number) => {
    const t = track.current;
    if (t && !reduce) {
      const r = t.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      if (travel > 40) window.scrollTo({ top: window.scrollY + r.top + (travel * (k + 0.5)) / slides.length, behavior: 'smooth' });
    }
    show(k);
  };
  return (
    <div className={s.heroTrack} ref={track}>
      <div className={s.heroSticky}>
        <div className={s.stage} aria-roledescription="slideshow" aria-label="Five suppliers">
          {slides.map((sl, k) => (
            <figure key={sl.src} className={`${s.slide} ${k === cur ? s.slideOn : ''}`}>
              <Image src={sl.src} alt={sl.alt} fill sizes="100vw" priority={k === 0} />
            </figure>
          ))}
          <p className={s.slideLine} aria-live="polite">
            <span key={swapKey} className={swapKey ? s.swap : undefined}>
              {slides[cur]!.line}
            </span>
          </p>
          <div className={s.dots} role="group" aria-label="Choose a person">
            {slides.map((sl, k) => (
              <button key={sl.dot} type="button" aria-label={sl.dot} aria-current={k === cur} onClick={() => pick(k)} />
            ))}
          </div>
          <span className={`${s.hint} ${cur > 0 ? s.hintGone : ''}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 5 · check a date, in the phone ───────────────────────── */

/**
 * The sample month the phone shows — a DRAWING of the shipped check-a-date page (`/v/<slug>/dates`), not a live read:
 * the prototype's November, starting on a Saturday, with six days taken.
 */
const CAL = { month: 'NOVEMBER', short: 'Nov', long: 'November', offset: 6, days: 30, blocked: [1, 8, 9, 15, 16, 29], start: 22 } as const;
const DOWS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CheckADateDemo() {
  const [day, setDay] = useState<number>(CAL.start);
  const [asked, setAsked] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const nb = (CAL.blocked as readonly number[]).includes(day);
  const wd = DAY_NAMES[(CAL.offset + day - 1) % 7];
  return (
    <div className={s.cal} aria-label="Check a date on a live Setnayan shop">
      <div className={s.calTop}>
        <b>Check a date</b>
        <span>{CAL.month}</span>
      </div>
      <div className={s.calGrid} ref={grid}>
        {DOWS.map((d, i) => (
          <span key={`dow-${i}`} className={s.dow}>
            {d}
          </span>
        ))}
        {Array.from({ length: CAL.offset }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: CAL.days }, (_, i) => {
          const d = i + 1;
          const no = (CAL.blocked as readonly number[]).includes(d);
          return (
            <button
              key={d}
              type="button"
              data-d={d}
              data-free={no ? undefined : ''}
              className={`${s.day} ${no ? s.dayNo : ''}`}
              aria-pressed={d === day}
              aria-label={`${d} ${CAL.long}, ${no ? 'not bookable' : 'available'}`}
              onClick={() => {
                setDay(d);
                setAsked(false);
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className={s.legend}>
        <span>
          <i className={s.legendFree} />
          Available
        </span>
        <span>
          <i className={s.legendNo} />
          Not bookable
        </span>
      </div>
      <div className={s.sheet} aria-live="polite">
        <p className={s.when}>
          {wd}, {day} {CAL.short} · {nb ? <em className={s.nb}>Not bookable</em> : <em>Available</em>}
        </p>
        <p className={s.small}>{nb ? 'This day is taken. Pick another day.' : 'Ask the shop about this day. They reply in your chat.'}</p>
        <div className={s.sheetBtns}>
          <button type="button" className={s.primary} disabled={nb} onClick={() => setAsked(true)}>
            Ask about this date
          </button>
          <button
            type="button"
            onClick={() => {
              grid.current?.querySelector<HTMLButtonElement>('[data-free]')?.focus();
              setAsked(false);
            }}
          >
            Pick another day
          </button>
        </div>
        <p className={s.sheetNote} hidden={!asked}>
          In the app, this opens the shop&apos;s chat with your date attached.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── the QR chips and their sheet ───────────────────────── */

export type QrKey = 'shortlist' | 'dates' | 'page' | 'review' | 'booked' | 'crew';
/** One code the sheet shows. `svg`/`url`/`go` are absent for a code that is made per client or per event. */
export type QrEntry = { title: string; body: string; svg?: string; url?: string; go?: string };

const QrCtx = createContext<{ open: (k: QrKey, from: HTMLElement) => void; entries: Record<QrKey, QrEntry> } | null>(null);

/** Holds the QR sheet for every chip below it. `kicker` names whose codes these are. */
export function QrSheetProvider({ entries, kicker, children }: { entries: Record<QrKey, QrEntry>; kicker: string; children: ReactNode }) {
  const [key, setKey] = useState<QrKey | null>(null);
  const last = useRef<HTMLElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const open = useCallback((k: QrKey, from: HTMLElement) => {
    last.current = from;
    setKey(k);
  }, []);
  const sheet = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setKey(null);
  }, []);
  // The shared modal hook: Escape, Tab trap, scroll lock, focus back to the chip that opened it.
  useModalA11y({ open: key !== null, onClose: close, containerRef: sheet, initialFocusRef: closeBtn });
  const ctx = useMemo(() => ({ open, entries }), [open, entries]);
  const d = key ? entries[key] : null;
  return (
    <QrCtx.Provider value={ctx}>
      {children}
      {d ? (
        <div
          ref={sheet}
          className={s.qsheet}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sf-qr-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className={s.qsCard}>
            <button ref={closeBtn} type="button" className={s.qsX} aria-label="Close" onClick={close}>
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
            <p className={s.qsK}>{kicker}</p>
            <h3 id="sf-qr-title">{d.title}</h3>
            {d.svg ? <div className={s.qsCode} dangerouslySetInnerHTML={{ __html: d.svg }} /> : null}
            <p className={s.qsD}>{d.body}</p>
            {d.url ? <p className={`${s.qsU} ${s.mono}`}>{d.url.replace(/^https?:\/\/(www\.)?/, '')}</p> : null}
            {d.url && d.go ? (
              <a className={`${s.btn} ${s.btnSm}`} href={d.url} target="_blank" rel="noopener noreferrer">
                {d.go}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </QrCtx.Provider>
  );
}

const LOCK_ICON = (
  <svg className={s.qi} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);
const CREW_ICON = (
  <svg className={s.qi} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" />
  </svg>
);

/** A chip that opens one code in the sheet: the real code in miniature, or an icon for a per-client/per-event code. */
export function QrChip({ k }: { k: QrKey }) {
  const ctx = useContext(QrCtx);
  if (!ctx) return null;
  const d = ctx.entries[k];
  return (
    <button type="button" className={s.code} aria-haspopup="dialog" onClick={(e) => ctx.open(k, e.currentTarget)}>
      {d.svg ? (
        <span className={s.qrMini} aria-hidden="true" dangerouslySetInnerHTML={{ __html: d.svg }} />
      ) : k === 'crew' ? (
        CREW_ICON
      ) : (
        LOCK_ICON
      )}
      <span>{d.title}</span>
    </button>
  );
}

/* ───────────────────────── 7 · four price shapes ───────────────────────── */

const MINUS = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 12h12" />
  </svg>
);
const PLUS = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 6v12M6 12h12" />
  </svg>
);

type Shape =
  | { kind: 'n'; rate: number; n: number; step: number; min: number; max: number; unit: string; group: string }
  | { kind: 'list'; start: number; list: ReadonlyArray<{ label: string; value: number }>; group: string };

/** The calculator under one price-shape card — an illustration that counts, never a price from the app. */
export function PriceShapeCalc({ shape }: { shape: Shape }) {
  const [n, setN] = useState(shape.kind === 'n' ? shape.n : shape.start);
  const [bump, setBump] = useState(0);
  const min = shape.kind === 'n' ? shape.min : 0;
  const max = shape.kind === 'n' ? shape.max : shape.list.length - 1;
  const step = shape.kind === 'n' ? shape.step : 1;
  const total = shape.kind === 'n' ? shape.rate * n : shape.list[n]!.value;
  const move = (dir: 1 | -1) => {
    setN((v) => Math.min(max, Math.max(min, v + dir * step)));
    setBump((b) => b + 1);
  };
  return (
    <div className={s.pcCalc}>
      <span className={s.ex}>
        {shape.kind === 'n' ? (
          <>
            {peso(shape.rate)} × <b>{count(n)}</b> {shape.unit}
          </>
        ) : (
          <b>{shape.list[n]!.label}</b>
        )}
      </span>
      <div className={s.pcRow}>
        <div className={s.stepper} role="group" aria-label={shape.group}>
          <button type="button" aria-label="Less" disabled={n <= min} onClick={() => move(-1)}>
            {MINUS}
          </button>
          <button type="button" className={s.stUp} aria-label="More" disabled={n >= max} onClick={() => move(1)}>
            {PLUS}
          </button>
        </div>
        <output key={bump} className={`${s.tot} ${bump ? s.bump : ''}`} aria-live="polite">
          {peso(total)}
        </output>
      </div>
    </div>
  );
}

/* ───────────────────────── 8 · the event-day status ───────────────────────── */

const STATUSES: ReadonlyArray<{ label: string; warn?: true }> = [
  { label: 'On site' },
  { label: 'Setup done' },
  { label: 'Ready to start' },
  { label: 'Packed up' },
  { label: 'Running late', warn: true },
  { label: 'Need help', warn: true },
];

export function DayStatus() {
  const [on, setOn] = useState(0);
  return (
    <>
      <div className={s.sts} role="group" aria-label="Your status">
        {STATUSES.map((st, k) => (
          <button
            key={st.label}
            type="button"
            className={`${s.st} ${st.warn ? s.stWarn : ''} ${k === on ? s.stOn : ''}`}
            aria-pressed={k === on}
            onClick={() => setOn(k)}
          >
            {st.label}
          </button>
        ))}
      </div>
      <p className={s.seen} aria-live="polite">
        The coordinator sees: <b>{STATUSES[on]!.label}</b>
      </p>
    </>
  );
}

/* ───────────────────────── 11 · the fee, on a slider ───────────────────────── */

/**
 * The fee story: the two steps the page passes in, then "One ₱300,000 booking. Booking fee ₱7,000 · 2.3%" — the fee is
 * `bookingFeePhp` on the LIVE schedule the page read; the slider only picks an example booking price — then the fee's
 * share of the booking as a bar, and the payoff line.
 */
export function FeeStory({ schedule, steps, payoff }: { schedule: BookingFeeSchedule; steps: ReactNode; payoff: string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState<number>(FEE_SLIDER.start);
  const [touched, setTouched] = useState(false);
  const fee = bookingFeePhp(v, schedule);
  const share = (fee / v) * 100;
  const [shown, setShown] = useState({ v, fee });
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    if (reduce) {
      setShown({ v, fee });
      return;
    }
    const from = shownRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 320);
      const e = 1 - Math.pow(1 - k, 3);
      setShown({ v: from.v + (v - from.v) * e, fee: from.fee + (fee - from.fee) * e });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v, fee, reduce]);
  const p = ((v - FEE_SLIDER.min) / (FEE_SLIDER.max - FEE_SLIDER.min)) * 100;
  return (
    <div>
      <ol className={s.feeSteps}>
        {steps}
        <li data-rv="">
          <div>
            <b>One {peso(shown.v)} booking.</b>
            <div className={s.feeout}>
              <span className={s.fk}>Booking fee</span>
              <b className={s.feeBig}>{peso(shown.fee)}</b>
              <span className={`${s.pill} ${s.plan} ${s.fpct}`}>{pct(share)}</span>
            </div>
            <label className={s.feelab} htmlFor="sf-fee-range">
              Slide the booking price
            </label>
            <input
              id="sf-fee-range"
              className={`${s.feerange} ${touched ? s.touched : ''}`}
              type="range"
              min={FEE_SLIDER.min}
              max={FEE_SLIDER.max}
              step={FEE_SLIDER.step}
              value={v}
              style={{ ['--p' as string]: `${p}%` }}
              aria-valuetext={`${peso(v)} booking, fee ${peso(fee)}, ${pct(share)}`}
              onPointerDown={() => setTouched(true)}
              onChange={(e) => {
                setTouched(true);
                setV(Number(e.target.value));
              }}
            />
          </div>
        </li>
      </ol>
      <div className={s.share} aria-hidden="true" data-rv="">
        <i style={{ width: `${Math.max(0.6, share)}%` }} />
      </div>
      <p className={s.payoff} data-rv="">
        {payoff}
      </p>
    </div>
  );
}

/* ───────────────────────── 13 · Grow: Solo · Pro · Ultra ───────────────────────── */

/** One plan card of the picker (drawing § 1): Free, or a paid plan with its own "Pay for the year" switch. */
export type PlanCard = {
  key: 'free' | GrowTier;
  name: string;
  /** The catalogue's 4-week price, or null when it could not be read. Free: its own zero. */
  price: string | null;
  /** The catalogue's year price, or null (Free has none). */
  year: string | null;
  /** What the year saves against 13 blocks of 4 weeks, or null. */
  save: string | null;
  /** Free's words, or a paid plan's spec line. */
  spec: string;
  plus: string | null;
  lines: GrowLine[];
  cta: string;
  /** Ruling 5735: this plan's shop-page preview row (`PlanPagePreview`). */
  preview?: ReactNode;
};

/** A paid card's price + its year switch. The switch is the card's own (drawing § 1: "Each keeps its own year switch"). */
function PlanPrice({ c }: { c: PlanCard }) {
  const [yearOn, setYearOn] = useState(false);
  if (c.key === 'free') {
    return (
      <p className={s.pickPrice}>
        {c.price ?? '—'} <small>always</small>
      </p>
    );
  }
  const showYear = yearOn && c.year !== null;
  return (
    <>
      <p className={s.pickPrice} aria-live="polite">
        {showYear ? c.year : (c.price ?? '—')} <small>{showYear ? 'a year' : 'every 4 weeks'}</small>
      </p>
      {c.year ? (
        <button type="button" role="switch" aria-checked={yearOn} className={s.pickYear} onClick={() => setYearOn((v) => !v)}>
          <span>
            {yearOn ? `Paying for the year${c.save ? ` · you save ${c.save}` : ''}` : `Pay for the year${c.save ? `, save ${c.save}` : ''}`}
            <small>{yearOn ? `${c.price ?? '—'} every 4 weeks if you switch off` : `${c.year} a year`}</small>
          </span>
          <SwitchTrack on={yearOn} />
        </button>
      ) : null}
    </>
  );
}

/**
 * THE PLAN PICKER (owner-approved 2026-11-14, DECISION_LOG "SIMPLER SUPPLIER PLANS", drawing § 1): four tabs — Free ·
 * Plus · Pro · Ultra — and the open plan's card on a phone; the four cards side by side from 960. Every figure arrives
 * from the catalogue (the page read it); every line from the code that applies it.
 */
export function PlanPicker({ cards, start, href }: { cards: readonly PlanCard[]; start: PlanCard['key']; href: string }) {
  const [on, setOn] = useState<PlanCard['key']>(start);
  return (
    <>
      <div className={`${s.tiers} ${s.pickTabs}`} role="tablist" aria-label="Plans">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            id={`sf-tab-${c.key}`}
            className={s.tier}
            aria-selected={c.key === on}
            aria-controls={`sf-t-${c.key}`}
            onClick={() => setOn(c.key)}
          >
            <b>{c.name}</b>
            <span>{c.price ?? '—'}</span>
          </button>
        ))}
      </div>
      <div className={s.pickCards}>
        {cards.map((c) => (
          <div
            key={c.key}
            className={s.pickCard}
            id={`sf-t-${c.key}`}
            role="tabpanel"
            aria-labelledby={`sf-tab-${c.key}`}
            data-shown={c.key === on}
            data-open={c.key === on}
            data-first={c.key === start}
          >
            <p className={s.pickName}>{c.name}</p>
            <PlanPrice c={c} />
            <p className={s.spec}>{c.spec}</p>
            {c.plus ? <p className={s.tplus}>{c.plus}</p> : null}
            {c.lines.length ? (
              <ul className={s.tlist}>
                {c.lines.map((l) => (
                  <li key={l.text}>
                    {l.lead ? <b>{l.text}</b> : l.text}
                    {l.tail ?? null}
                  </li>
                ))}
              </ul>
            ) : null}
            <a className={`${s.btn} ${s.btnSm} ${s.pickCta}`} href={href} data-sf-cta="">
              {c.cta}
            </a>
            {c.preview ?? null}
          </div>
        ))}
      </div>
    </>
  );
}

/* ───────────────────────── the phone dock ───────────────────────── */

/**
 * The floating "Create your shop free" on a phone: shown once the story has started, never while another CTA is on
 * screen or the close is near, and only while scrolling up or resting. Hidden at desktop widths by the stylesheet.
 */
export function CtaDock({ href, label }: { href: string; label: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let dirUp = false;
    let idle = true;
    let idleT: ReturnType<typeof setTimeout> | undefined;
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 3) {
        dirUp = y < lastY;
        lastY = y;
        idle = false;
        clearTimeout(idleT);
        idleT = setTimeout(() => {
          idle = true;
          update();
        }, 1600);
      }
      const ctas = Array.from(document.querySelectorAll<HTMLElement>('[data-sf-cta]'));
      const ctaVisible = ctas.some((a) => {
        const r = a.getBoundingClientRect();
        return r.bottom > 0 && r.top < vh;
      });
      const close = document.getElementById('close');
      const closeTop = close ? close.getBoundingClientRect().top : Infinity;
      setOn(y > vh * 0.6 && !ctaVisible && closeTop > vh * 0.9 && (dirUp || idle));
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      clearTimeout(idleT);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <div className={`${s.dock} ${on ? s.dockOn : ''}`} aria-hidden={!on}>
      <a className={s.btn} href={href} tabIndex={on ? 0 : -1}>
        {label}
      </a>
    </div>
  );
}
