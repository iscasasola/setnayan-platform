'use client';

/**
 * The moving parts of /for-coordinators, one per section of the approved prototype
 * (`prototypes/for_coordinators_2026-11-06/index.html`, corpus) — each a port of one of its scripts:
 *
 *   <FcEffects>     reveal-on-scroll, the two "play once" lines, the phone dock     (prototype scripts 1 · 2 · 4)
 *   <HeroStage>     five coordinators, cross-faded by scroll, one line each           (script 1)
 *   <InfoToggle>    the ⓘ: title + one line visible, the rest inside                 (script 1)
 *   <CheckADate>    the Check-a-date calendar inside the phone                         (script 1)
 *   <QrMoments>     three moments, six codes; a chip opens a REAL code in a sheet      (last script)
 *   <AccessCard>    Full Event Access: Edit · View · Off per part                     (script 6)
 *   <RunTheDay>     the coordinator's event-day phone: start the next part, Acknowledge (script 6)
 *   <FeeSlider>     the booking fee for any booking price, from the LIVE schedule      (script 5)
 *   <PlanTiers>     Solo · Pro · Ultra inside the Grow step                            (script 7)
 *
 * Words and numbers all come from the page (a server component), so they ship in the HTML and a
 * failed script leaves a readable page. Every motion stops under `prefers-reduced-motion: reduce`.
 * The ⓘ joins the app-wide reveal-on-open (`useRevealOnOpen`) like every other fold.
 */

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { bookingFeePhp } from '@/lib/booking-fee';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;

/* ── Page-wide effects ─────────────────────────────────────────────────────────────────────── */

const REVEAL = [
  '.fc-beat-head',
  '.fc-hero-landing > div',
  '.fc-prob',
  '.fc-ph.fc-real:not(.fc-slide)',
  '.fc-phone',
  '.fc-notice',
  '.fc-cap',
  '.fc-planstep',
  '.fc-moments > *',
  '.fc-fee-steps > li',
  '.fc-share',
  '.fc-payoff',
  '.fc-sub > h3',
  '.fc-sub > p',
  '.fc-fold',
  '.fc-plans-cta',
  '.fc-ibgrid > .fc-ib',
].join(', ');

/**
 * Reveal-on-scroll (transform + opacity only), the two lines that grow once in view, and the phone
 * dock: shown once the story has started, and never while another "Open your shop free" is on screen.
 */
export function FcEffects({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const cleanups: (() => void)[] = [];
    const reduce = reduced();

    // Reveal on scroll.
    if (!reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('fc-in');
              io.unobserve(e.target);
            }
          }),
        { rootMargin: '0px 0px -8% 0px' },
      );
      root.querySelectorAll<HTMLElement>(REVEAL).forEach((el) => {
        if (el.closest('.fc-hero-track')) return;
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) return; // already on screen: never hide it
        el.classList.add('fc-rv');
        const sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = `${Math.min(sib, 5) * 90}ms`;
        io.observe(el);
      });
      cleanups.push(() => io.disconnect());
    }

    // The two sequences that play once when they come into view.
    for (const sel of ['.fc-rows', '.fc-qs']) {
      const el = root.querySelector(sel);
      if (!el) continue;
      if (reduce || !('IntersectionObserver' in window)) {
        el.classList.add('fc-play');
        continue;
      }
      const o = new IntersectionObserver(
        (es) => {
          if (es[0]?.isIntersecting) {
            el.classList.add('fc-play');
            o.disconnect();
          }
        },
        { threshold: 0.3 },
      );
      o.observe(el);
      cleanups.push(() => o.disconnect());
    }

    // The phone dock.
    const dock = root.querySelector<HTMLElement>('.fc-dock');
    const close = root.querySelector<HTMLElement>('#close');
    if (dock && close) {
      const link = dock.querySelector('a');
      const ctas = [...root.querySelectorAll<HTMLElement>('main a.fc-btn, a.fc-btn')].filter((a) => !dock.contains(a));
      let lastY = window.scrollY;
      let dirUp = false;
      let idle = true;
      let idleT = 0;
      let frame = 0;
      const update = () => {
        const vh = window.innerHeight;
        const y = window.scrollY;
        if (Math.abs(y - lastY) > 3) {
          dirUp = y < lastY;
          lastY = y;
          idle = false;
          window.clearTimeout(idleT);
          idleT = window.setTimeout(() => {
            idle = true;
            update();
          }, 1600);
        }
        const ctaVisible = ctas.some((a) => {
          const r = a.getBoundingClientRect();
          return r.bottom > 0 && r.top < vh;
        });
        const on = y > vh * 0.6 && !ctaVisible && close.getBoundingClientRect().top > vh * 0.9 && (dirUp || idle);
        dock.classList.toggle('fc-show', on);
        dock.setAttribute('aria-hidden', String(!on));
        if (link) link.tabIndex = on ? 0 : -1;
      };
      const onScroll = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(update);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      update();
      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
        window.clearTimeout(idleT);
        cancelAnimationFrame(frame);
      });
    }
    return () => cleanups.forEach((f) => f());
  }, [rootId]);
  return null;
}

/* ── The hero ──────────────────────────────────────────────────────────────────────────────── */

export type HeroPerson = {
  src: string;
  width: number;
  height: number;
  /** What the photo shows (the slide is `role="img"`). */
  alt: string;
  /** Focal-point class from the prototype (`p1` … `p5`). */
  focal: string;
  /** The line over this photo. */
  line: string;
  /** The dot's name. */
  dot: string;
};

/**
 * Five people, cross-faded as the page scrolls through a tall track (the stage stays pinned under the
 * bar), one line each; the dots jump to a person. With reduced motion the track is one screen and
 * only the dots change the photo. The track's height is CSS (`prefers-reduced-motion`), so there is
 * no layout jump when this hydrates.
 */
export function HeroStage({ people, label }: { people: readonly HeroPerson[]; label: string }) {
  const [cur, setCur] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const curRef = useRef(0);

  const show = (i: number) => {
    if (i === curRef.current) return;
    curRef.current = i;
    setCur(i);
    setSwapped(true);
  };

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const el = track.current;
        if (!el || reduced()) return;
        const r = el.getBoundingClientRect();
        const travel = r.height - window.innerHeight;
        if (travel > 40) {
          const p = Math.min(1, Math.max(0, -r.top / travel));
          show(Math.min(people.length - 1, Math.floor(p * people.length)));
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.length]);

  const jump = (k: number) => {
    const el = track.current;
    if (el && !reduced()) {
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      window.scrollTo({ top: window.scrollY + r.top + (travel * (k + 0.5)) / people.length, behavior: 'smooth' });
    }
    show(k);
  };

  return (
    <div className="fc-hero-track" ref={track}>
      <div className="fc-hero-sticky">
        <div className="fc-stage" aria-roledescription="slideshow" aria-label={label}>
          {people.map((p, i) => (
            <div
              key={p.src}
              className={`fc-real fc-slide fc-ph fc-${p.focal}${i === cur ? ' fc-on' : ''}`}
              role="img"
              aria-label={p.alt}
            >
              <Image
                src={p.src}
                alt=""
                width={p.width}
                height={p.height}
                sizes="100vw"
                priority={i === 0}
                loading={i === 0 ? undefined : 'lazy'}
              />
            </div>
          ))}
          <p className="fc-slide-line" aria-live="polite">
            <span key={cur} className={swapped ? 'fc-swap' : undefined}>
              {people[cur]?.line}
            </span>
          </p>
          <div className="fc-dots" role="group" aria-label="Choose a person">
            {people.map((p, k) => (
              <button key={p.dot} type="button" aria-label={p.dot} aria-current={k === cur} onClick={() => jump(k)} />
            ))}
          </div>
          <span className={`fc-hint${cur > 0 ? ' fc-gone' : ''}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* ── The ⓘ ─────────────────────────────────────────────────────────────────────────────────── */

/** "ⓘ title" — the title and one line stay visible; the rest opens beneath, gliding into view. */
export function InfoToggle({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const head = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: head.current, end: panel.current }));
  return (
    <div>
      <button
        ref={head}
        type="button"
        className="fc-info"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (!open) intend();
          setOpen((o) => !o);
        }}
      >
        <span className="fc-i">i</span>
        {label}
      </button>
      <div className="fc-panel" id={id} hidden={!open} ref={panel}>
        {children}
      </div>
    </div>
  );
}

/* ── Check a date ──────────────────────────────────────────────────────────────────────────── */

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** The sample shop's taken days, as the prototype draws them. */
const TAKEN = new Set([1, 8, 9, 15, 16, 29]);

/**
 * A sample month: tap a day to see "Available" or "Not bookable" — never who booked. The month is the
 * current one (the server passes it, so the first paint and the script agree).
 */
export function CheckADate({
  month,
  monthShort,
  offset,
  days,
}: {
  /** "NOVEMBER" */
  month: string;
  /** "Nov" */
  monthShort: string;
  /** Weekday of the 1st (0 = Sunday). */
  offset: number;
  days: number;
}) {
  const [picked, setPicked] = useState(Math.min(22, days));
  const [asked, setAsked] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const taken = TAKEN.has(picked);
  return (
    <div className="fc-cal" aria-label="Check a date on a live Setnayan shop">
      <div className="fc-cal-top">
        <b>Check a date</b>
        <span>{month}</span>
      </div>
      <div className="fc-cal-grid" ref={grid}>
        {DOW.map((d, i) => (
          <span key={`d${i}`} className="fc-dow">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const no = TAKEN.has(d);
          return (
            <button
              key={d}
              type="button"
              className={`fc-day${no ? ' fc-no' : ''}`}
              aria-pressed={d === picked}
              aria-label={`${d} ${month.charAt(0)}${month.slice(1).toLowerCase()}, ${no ? 'not bookable' : 'available'}`}
              onClick={() => {
                setPicked(d);
                setAsked(false);
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="fc-legend">
        <span>
          <i style={{ background: 'var(--paper)', border: '1px solid var(--line)' }} />
          Available
        </span>
        <span>
          <i style={{ background: 'var(--soft)' }} />
          Not bookable
        </span>
      </div>
      <div className="fc-sheet" aria-live="polite">
        <p className="fc-when">
          {DOW_NAME[(offset + picked - 1) % 7]}, {picked} {monthShort} ·{' '}
          {taken ? <em className="fc-nb">Not bookable</em> : <em>Available</em>}
        </p>
        <p className="fc-small">
          {taken ? 'This day is taken. Pick another day.' : 'Ask the shop about this day. They reply in your chat.'}
        </p>
        <div className="fc-sheet-btns">
          <button type="button" className="fc-primary" disabled={taken} onClick={() => setAsked(true)}>
            Ask about this date
          </button>
          <button
            type="button"
            onClick={() => {
              grid.current?.querySelector<HTMLButtonElement>('.fc-day:not(.fc-no)')?.focus();
              setAsked(false);
            }}
          >
            Pick another day
          </button>
        </div>
        <p className="fc-sheet-note" hidden={!asked}>
          In the app, this opens the shop&rsquo;s chat with your date attached.
        </p>
      </div>
    </div>
  );
}

/* ── One QR for every moment ───────────────────────────────────────────────────────────────── */

export type QrCode = {
  key: string;
  /** The chip's words. */
  chip: string;
  /** The sheet's title. */
  title: string;
  desc: string;
  /** Where a scan goes — absent for a code that is made per client or per event (Booked · Crew). */
  url?: string;
  /** The real code, drawn by the app's own QR renderer. */
  svg?: string;
  /** The link's words under the code. */
  go?: string;
  /** For a code with no sample: which icon the chip wears. */
  icon?: 'lock' | 'people';
};

export type QrMoment = {
  photo: { src: string; width: number; height: number; alt: string };
  step: string;
  title: string;
  codes: readonly string[];
  body: string;
  fine: string;
};

function ChipIcon({ code }: { code: QrCode }) {
  if (code.svg) return <span className="fc-qr" aria-hidden="true" dangerouslySetInnerHTML={{ __html: code.svg }} />;
  return (
    <svg className="fc-qi" viewBox="0 0 24 24" aria-hidden="true">
      {code.icon === 'lock' ? (
        <>
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </>
      ) : (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" />
        </>
      )}
    </svg>
  );
}

/** The three moments, and the one sheet a code chip opens (a real, scannable code + "Open it"). */
export function QrMoments({ moments, codes, shop }: { moments: readonly QrMoment[]; codes: readonly QrCode[]; shop: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const last = useRef<HTMLButtonElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const open = codes.find((c) => c.key === openKey) ?? null;

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('fc-qlock');
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('fc-qlock');
      document.removeEventListener('keydown', onKey);
      last.current?.focus();
    };
  }, [open]);

  return (
    <>
      <div className="fc-moments">
        {moments.map((m) => (
          <div className="fc-moment" key={m.title}>
            <div className="fc-real fc-ph fc-ratio-43" role="img" aria-label={m.photo.alt}>
              <Image src={m.photo.src} alt="" width={m.photo.width} height={m.photo.height} sizes="(min-width: 720px) 33vw, 100vw" />
            </div>
            <p className="fc-step">{m.step}</p>
            <h3>{m.title}</h3>
            <div className="fc-codes">
              {m.codes.map((k) => {
                const c = codes.find((x) => x.key === k);
                if (!c) return null;
                return (
                  <button
                    key={k}
                    type="button"
                    className="fc-code"
                    aria-haspopup="dialog"
                    onClick={(e) => {
                      last.current = e.currentTarget;
                      setOpenKey(k);
                    }}
                  >
                    <ChipIcon code={c} />
                    <span>{c.chip}</span>
                  </button>
                );
              })}
            </div>
            <p>{m.body}</p>
            <p className="fc-fine">{m.fine}</p>
          </div>
        ))}
      </div>
      {open ? (
        <div
          className="fc-qsheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fc-qT"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenKey(null);
          }}
        >
          <div className="fc-qs-card">
            <button type="button" className="fc-qs-x" aria-label="Close" ref={closeBtn} onClick={() => setOpenKey(null)}>
              ×
            </button>
            <p className="fc-qs-k">Sample · {shop}</p>
            <h3 id="fc-qT">{open.title}</h3>
            {open.svg ? <div className="fc-qs-code" dangerouslySetInnerHTML={{ __html: open.svg }} /> : null}
            <p className="fc-qs-d">{open.desc}</p>
            {open.url ? (
              <>
                <p className="fc-qs-u fc-mono">{open.url.replace(/^https?:\/\/(www\.)?/, '')}</p>
                <a className="fc-btn fc-sm" href={open.url} target="_blank" rel="noopener">
                  {open.go}
                </a>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ── Full Event Access ─────────────────────────────────────────────────────────────────────── */

export type AccessLevel = 'edit' | 'view' | 'off';
export type AccessRow = {
  key: string;
  label: string;
  small?: string;
  /** The levels the app lets the couple set for this part (`areaChoices`). */
  choices: readonly AccessLevel[];
  /** A coordinator's starting level (`COORDINATOR_AREAS`). */
  start: AccessLevel;
};

const LEVEL_WORD: Readonly<Record<AccessLevel, string>> = { edit: 'Edit', view: 'View', off: 'Off' };
const LEVELS: readonly AccessLevel[] = ['edit', 'view', 'off'];

/** A sample of what the couple shares: tap Edit, View or Off on each part; the tally follows. */
export function AccessCard({ rows, foot }: { rows: readonly AccessRow[]; foot: string }) {
  const [levels, setLevels] = useState<Record<string, AccessLevel>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, r.start])),
  );
  const count = (l: AccessLevel) => Object.values(levels).filter((x) => x === l).length;
  return (
    <div className="fc-access" aria-label="Sample: what the couple shares with their coordinator">
      <div className="fc-ahead">
        <span className="fc-stag">Sample</span>
        <p className="fc-ak">What the couple shares with you</p>
        <p className="fc-asum" aria-live="polite">
          {count('edit')} to edit · {count('view')} to view · {count('off')} off
        </p>
      </div>
      {rows.map((r) => (
        <div className="fc-arow" key={r.key}>
          <div className="fc-an">
            <b>{r.label}</b>
            {r.small ? <small>{r.small}</small> : null}
          </div>
          <div className="fc-seg" role="group" aria-label={r.label}>
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                className="fc-lv"
                data-l={l.charAt(0)}
                aria-pressed={levels[r.key] === l}
                disabled={!r.choices.includes(l)}
                onClick={() => setLevels((s) => ({ ...s, [r.key]: l }))}
              >
                {LEVEL_WORD[l]}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="fc-afoot">{foot}</p>
    </div>
  );
}

/* ── Run the day ───────────────────────────────────────────────────────────────────────────── */

export type RosPart = { at: string; name: string };

/** The coordinator's event-day phone: Now · Next · Arrived, the running order, and one request. */
export function RunTheDay({
  parts,
  arrived,
  request,
}: {
  parts: readonly RosPart[];
  arrived: string;
  request: { initials: string; from: string; what: string };
}) {
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState(false);
  const next = parts[i + 1];
  return (
    <div className="fc-media">
      <div className="fc-phone fc-dayof" aria-label="Sample: the coordinator's event-day screen">
        <div className="fc-screen">
          <div className="fc-abar">
            <span className="fc-mark">
              SET<b>NA</b>YAN
            </span>
          </div>
          <p className="fc-saved">
            <i />
            Saved for offline · updated 2:10 PM
          </p>
          <div className="fc-nn">
            <div>
              <small>Now</small>
              <b>{parts[i]?.name}</b>
            </div>
            <div>
              <small>Next</small>
              <b>{next ? next.name : '—'}</b>
            </div>
            <div>
              <small>Arrived</small>
              <b>{arrived}</b>
            </div>
          </div>
          <p className="fc-d-k">The running order</p>
          <ol className="fc-ros">
            {parts.map((p, k) => (
              <li key={p.name} className={k < i ? 'fc-done' : k === i ? 'fc-on' : undefined}>
                <span>{p.at}</span>
                {p.name}
              </li>
            ))}
          </ol>
          <button type="button" className="fc-go" disabled={!next} onClick={() => next && setI(i + 1)}>
            {next ? 'Start the next part' : 'Last part on now'}
          </button>
          <p className="fc-d-k">Requests inbox</p>
          <div className="fc-req">
            <span className="fc-rq-i" aria-hidden="true">
              {request.initials}
            </span>
            <div>
              <b>{request.from}</b>
              <small>{request.what}</small>
            </div>
            <button type="button" className="fc-ack" aria-pressed={seen} onClick={() => setSeen((s) => !s)}>
              {seen ? 'Seen ✓' : 'Acknowledge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The fee slider ────────────────────────────────────────────────────────────────────────── */

export type FeeSchedule = { rate: number; tailRate: number; tier1LimitPhp: number; minPhp: number };

const FEE_MIN = 10_000;
const FEE_MAX = 1_000_000;
const FEE_START = 300_000;

/**
 * Three steps, the last one live: drag the booking price and the fee and its percent follow — computed
 * by `bookingFeePhp` over the schedule the page READ (never the code default).
 */
export function FeeSlider({
  schedule,
  firstStep,
  secondStep,
  payoff,
  ratePct,
}: {
  schedule: FeeSchedule;
  firstStep: { lead: string; rest: string };
  secondStep: { lead: string; rest: string };
  payoff: string;
  /** "5%" — the head rate, shown while the booking is inside the first band. */
  ratePct: string;
}) {
  const [v, setV] = useState(FEE_START);
  const [touched, setTouched] = useState(false);
  const target = { v, fee: bookingFeePhp(v, schedule) };
  const [shown, setShown] = useState(target);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const totalRef = useRef<HTMLElement>(null);
  const counted = useRef(false);

  // Ease the shown numbers toward the slider (320 ms), as the prototype does.
  useEffect(() => {
    const to = { v, fee: bookingFeePhp(v, schedule) };
    if (reduced()) {
      setShown(to);
      return;
    }
    const from = shownRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 320);
      const e = 1 - Math.pow(1 - k, 3);
      setShown({ v: from.v + (to.v - from.v) * e, fee: from.fee + (to.fee - from.fee) * e });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [v, schedule]);

  // The first time the fee comes into view, it counts up from ₱0.
  useEffect(() => {
    const el = totalRef.current;
    if (!el || reduced() || !('IntersectionObserver' in window)) return;
    const o = new IntersectionObserver((es) => {
      if (!es[0]?.isIntersecting || counted.current) return;
      counted.current = true;
      o.disconnect();
      const to = shownRef.current.fee;
      const t0 = performance.now();
      const f = (t: number) => {
        const k = Math.min(1, (t - t0) / 1100);
        setShown((s) => ({ ...s, fee: to * (1 - Math.pow(1 - k, 3)) }));
        if (k < 1) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const pct = (target.fee / v) * 100;
  const pctText = v > schedule.tier1LimitPhp ? `${pct.toFixed(1)}%` : ratePct;
  return (
    <div>
      <ol className="fc-fee-steps">
        <li>
          <div>
            <b>{firstStep.lead}</b> {firstStep.rest}
          </div>
        </li>
        <li>
          <div>
            <b>{secondStep.lead}</b> {secondStep.rest}
          </div>
        </li>
        <li>
          <div>
            <b>One {peso(shown.v)} booking.</b>
            <div className="fc-feeout">
              <span className="fc-fk">Booking fee</span>
              <b className="fc-count" ref={totalRef}>
                {peso(shown.fee)}
              </b>
              <span className="fc-pill fc-plan fc-fpct">{pctText}</span>
            </div>
            <label className="fc-feelab" htmlFor="fc-feeRange">
              Slide the booking price
            </label>
            <input
              className={`fc-feerange${touched ? ' fc-touched' : ''}`}
              type="range"
              id="fc-feeRange"
              min={FEE_MIN}
              max={FEE_MAX}
              step={5000}
              value={v}
              aria-valuetext={`${peso(v)} booking, fee ${peso(target.fee)}, ${pct.toFixed(1)} percent`}
              style={{ ['--p' as string]: `${((v - FEE_MIN) / (FEE_MAX - FEE_MIN)) * 100}%` }}
              onPointerDown={() => setTouched(true)}
              onChange={(e) => {
                setTouched(true);
                setV(Number(e.target.value));
              }}
            />
          </div>
        </li>
      </ol>
      <div className="fc-share" aria-hidden="true">
        <i style={{ width: `${Math.max(0.6, pct)}%` }} />
      </div>
      <p className="fc-payoff">{payoff}</p>
    </div>
  );
}

/* ── Solo · Pro · Ultra ────────────────────────────────────────────────────────────────────── */

export type TierCard = {
  key: string;
  name: string;
  /** "₱990" — null when the catalogue could not be read (the figure is left out, never guessed). */
  month: string | null;
  /** "₱9,900 a year" — null likewise. */
  year: string | null;
  spec: string;
  plus: string;
  items: readonly { text: string; bold?: boolean; rest?: string }[];
};

/** The Grow step's three tabs; Pro opens first, as drawn. */
export function PlanTiers({ tiers, start }: { tiers: readonly TierCard[]; start: string }) {
  const [on, setOn] = useState(start);
  return (
    <>
      <div className="fc-tiers" role="tablist" aria-label="Grow plans">
        {tiers.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className="fc-tier"
            id={`fc-tab-${t.key}`}
            aria-selected={on === t.key}
            aria-controls={`fc-t-${t.key}`}
            onClick={() => setOn(t.key)}
          >
            <b>{t.name}</b>
            {t.month ? <span>{t.month}</span> : null}
            {t.year ? <small>{t.year}</small> : null}
          </button>
        ))}
      </div>
      {tiers.map((t) => (
        <div className="fc-tdetail" id={`fc-t-${t.key}`} key={t.key} role="tabpanel" aria-labelledby={`fc-tab-${t.key}`} hidden={on !== t.key}>
          <p className="fc-spec">{t.spec}</p>
          <p className="fc-tplus">{t.plus}</p>
          <ul className="fc-tlist">
            {t.items.map((it) => (
              <li key={it.text}>
                {it.bold ? <b>{it.text}</b> : it.text}
                {it.rest ? ` ${it.rest}` : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
