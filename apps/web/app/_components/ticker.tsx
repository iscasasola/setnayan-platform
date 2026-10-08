'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as KE, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOneOpen } from '@/lib/one-open';
import { useModalA11y } from '@/lib/use-modal-a11y';
import {
  MONTH_NAMES,
  TICKER_ROW_PX,
  TICKER_SHEET_BELOW_PX,
  WHEN_PRECISIONS,
  WHEN_PRECISION_LABEL,
  clampWhen,
  clockPartsOf,
  daysInMonth,
  minuteChoices,
  minutesOfClock,
  placeTickerPop,
  precisionOf,
  settledIndex,
  whenAt,
  whenWords,
  yearChoices,
  type ClockParts,
  type TimelineWhen,
  type WhenPrecision,
} from '@/lib/timeline';
import { PILL_ON_CLASS, PillSelector } from './pill-selector';

/**
 * TICKER — the app's ONE way to roll to a time or a date (owner 2026-10-08, `INTERACTION_RULES.md` § 9 "Timeline
 * row + the time ticker"; approved gallery `prototypes/control_templates_2026-10-08.html` § 13).
 *
 * Owner, on a list of every quarter-hour: *"the popup exceeded the screen when it went up on schedule row. center
 * the time. how about a ticker instead so it does not eat too much space"*.
 *
 *   · ROLLING COLUMNS with a CENTRE BAND: three choices show, the middle one is the value. Scroll-snap, so a finger
 *     flick lands on a choice; a tap on a choice rolls to it; ↑ ↓ Home End roll it from the keyboard.
 *   · THE VALUE APPLIES AS IT SETTLES — `onChange` fires once a column comes to rest, so the row behind changes as
 *     it rolls. Whoever opened the ticker decides when that is WRITTEN (one write when it closes — a press costs
 *     one request, never one per column).
 *   · ONE LINE ABOVE says the result in words; Done closes.
 *   · TWO USES: `TimeTicker` (hour · minute in 5-minute steps · AM/PM) and `WhenTicker` (a Year · Month · Full date
 *     pill above, and only the columns that precision needs — a precision is the SHAPE of the date, never an
 *     invented day: see `lib/timeline.ts`).
 *   · `TickerPill` is the button a row wears and the pop it opens: on a phone the house sheet from the bottom (the
 *     one handed in as `sheet` — the Maker's — or this file's own), on a desktop a small panel under its button.
 *     NO SHEET IS EVER TALLER THAN THE SCREEN: long content scrolls inside it.
 *
 * Neutral on purpose: nothing here knows the Maker, the Schedule or the Love Story. The accent is not written
 * here as a colour of its own: the fill and its words are the pill selector's `PILL_ON_CLASS`; the accent INK and
 * the open pill's EDGE are the app's ONE accent token (`text-sn-accent`, `ring-sn-accent` — `--sn-accent`).
 */

/** A phone sheet handed in by the surface (structurally the Maker's `PickSheet`). */
export type TickerSheet = (p: { label: string; onClose: () => void; children: ReactNode }) => ReactNode;

type Choice<V> = { v: V; t: string };

/**
 * A roll that has not come to rest yet is not lost when the pop closes: every column of an open pop can be asked
 * to settle NOW (`TickerPill` asks, just before it closes — by Done, the dark part, a tap outside or Esc).
 */
const SettleNow = createContext<Set<() => void> | null>(null);

const still = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/* ── ONE ROLLING COLUMN ─────────────────────────────────────────────────── */

function TickerColumn<V extends string | number | boolean>({
  label,
  choices,
  value,
  onSettle,
}: {
  label: string;
  choices: readonly Choice<V>[];
  value: V;
  onSettle: (v: V) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, choices.findIndex((c) => c.v === value));
  /* The newest props, for the handler a scroll fires later. */
  const now = useRef({ choices, value, onSettle });
  now.current = { choices, value, onSettle };

  /* Placed on the value when it opens, and again only when the value was changed from OUTSIDE this column (a day
     pulled back into a shorter month) — never while the column itself is settling, or it would fight the snap. */
  useLayoutEffect(() => {
    const c = el.current;
    if (c && settledIndex(c.scrollTop, choices.length) !== index) c.scrollTop = index * TICKER_ROW_PX;
  }, [index, choices.length]);
  const settle = () => {
    timer.current = null;
    const c = el.current;
    if (!c) return;
    const { choices: list, value: was, onSettle: tell } = now.current;
    const next = list[settledIndex(c.scrollTop, list.length)];
    if (next && next.v !== was) tell(next.v);
  };
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const pop = useContext(SettleNow);
  useEffect(() => {
    /* Still rolling when the pop closes: settle where it is, now. */
    const now_ = () => {
      if (timer.current === null) return;
      clearTimeout(timer.current);
      settleRef.current();
    };
    pop?.add(now_);
    return () => {
      pop?.delete(now_);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pop]);
  const rollTo = (i: number) => {
    const c = el.current;
    if (!c) return;
    const top = Math.max(0, Math.min(choices.length - 1, i)) * TICKER_ROW_PX;
    if (typeof c.scrollTo === 'function') c.scrollTo({ top, behavior: still() ? 'auto' : 'smooth' });
    else c.scrollTop = top;
  };
  const onKeys = (e: KE) => {
    const to = e.key === 'ArrowDown' ? index + 1 : e.key === 'ArrowUp' ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? choices.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    rollTo(to);
  };
  return (
    <div
      ref={el}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      data-ticker-column={label}
      onKeyDown={onKeys}
      onScroll={() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(settle, 80);
      }}
      className="relative h-[120px] min-w-0 flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-xl py-10 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ink/25 [&::-webkit-scrollbar]:hidden"
    >
      {choices.map((c, i) => (
        <div
          key={String(c.v)}
          role="option"
          aria-selected={i === index}
          data-ticker-choice={String(c.v)}
          onClick={() => rollTo(i)}
          className={`flex h-10 cursor-pointer snap-center items-center justify-center whitespace-nowrap text-[20px] tabular-nums ${
            i === index ? 'font-bold text-ink' : 'font-medium text-ink/40'
          }`}
        >
          {c.t}
        </div>
      ))}
    </div>
  );
}

/* ── THE TICKER'S FRAME: (something above) · the line · the columns · Done ── */

function TickerFrame({ above, line, onDone, children }: { above?: ReactNode; line: string; onDone: () => void; children: ReactNode }) {
  return (
    <div data-ticker="" className="mx-auto w-full max-w-[300px]">
      {above}
      {/* ONE line says the result — read out as it changes. */}
      <p data-ticker-line="" aria-live="polite" className="pb-2.5 pt-0.5 text-center text-[13px] font-semibold tabular-nums text-ink/70">
        {line}
      </p>
      <div className="relative mx-auto flex max-w-[260px] gap-1">
        {/* THE CENTRE BAND — the value is what sits in it. */}
        <span aria-hidden data-ticker-band="" className="pointer-events-none absolute inset-x-0 top-10 h-10 rounded-xl bg-ink/[0.06]" />
        {children}
      </div>
      <button
        type="button"
        data-ticker-done=""
        onClick={onDone}
        className={`sn-press mt-3 flex min-h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold ${PILL_ON_CLASS}`}
      >
        Done
      </button>
    </div>
  );
}

/* ── USE 1 · A TIME: hour · minute (5-minute steps) · AM/PM ─────────────── */

const HOURS: readonly Choice<number>[] = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, t: String(i + 1) }));
const HALVES: readonly Choice<boolean>[] = [
  { v: false, t: 'AM' },
  { v: true, t: 'PM' },
];

export function TimeTicker({
  minutes,
  onChange,
  line,
  onDone,
}: {
  /** The time on the clock, minutes after midnight (0–1439). */
  minutes: number;
  /** A column settled: the new time on the clock (0–1439). */
  onChange: (minutes: number) => void;
  /** The one line above — "5:00 PM – 6:00 PM · 1 h". */
  line: string;
  onDone: () => void;
}) {
  const parts = clockPartsOf(minutes);
  const set = (p: Partial<ClockParts>) => onChange(minutesOfClock({ ...parts, ...p }));
  return (
    <TickerFrame line={line} onDone={onDone}>
      <TickerColumn label="Hour" choices={HOURS} value={parts.hour} onSettle={(hour) => set({ hour })} />
      <TickerColumn
        label="Minute"
        choices={minuteChoices(parts.minute).map((m) => ({ v: m, t: String(m).padStart(2, '0') }))}
        value={parts.minute}
        onSettle={(minute) => set({ minute })}
      />
      <TickerColumn label="AM or PM" choices={HALVES} value={parts.pm} onSettle={(pm) => set({ pm })} />
    </TickerFrame>
  );
}

/* ── USE 2 · A WHEN: Year · Month · Full date, and only the columns it needs ── */

const MONTHS: readonly Choice<number>[] = MONTH_NAMES.map((t, i) => ({ v: i + 1, t }));

export function WhenTicker({
  value,
  onChange,
  onDone,
  thisYear,
}: {
  value: TimelineWhen;
  /** A column settled, or the precision changed — the when, only as exact as chosen. */
  onChange: (next: TimelineWhen) => void;
  onDone: () => void;
  /** The year the column is centred around (the caller's clock — this file has none). */
  thisYear: number;
}) {
  const precision = precisionOf(value);
  /* What this ticker last showed for a part a coarser precision dropped — Full date → Month → Full date brings the
     14th back. Never stored: only the shape on screen is kept. */
  const kept = useRef<{ m?: number; d?: number }>({});
  if (value.m) kept.current.m = value.m;
  if (value.d) kept.current.d = value.d;
  return (
    <TickerFrame
      line={whenWords(value, true)}
      onDone={onDone}
      above={
        <div className="mb-3 flex">
          <PillSelector<WhenPrecision>
            label="How exact"
            data="when-precision"
            value={precision}
            options={WHEN_PRECISIONS.map((key) => ({ key, label: WHEN_PRECISION_LABEL[key] }))}
            onPick={(key) => key !== precision && onChange(whenAt(value, key, kept.current))}
          />
        </div>
      }
    >
      {precision === 'year' ? null : (
        <TickerColumn label="Month" choices={MONTHS} value={value.m ?? 1} onSettle={(m) => onChange(clampWhen({ ...value, m }))} />
      )}
      {precision === 'day' ? (
        <TickerColumn
          label="Day"
          choices={Array.from({ length: daysInMonth(value.y, value.m ?? 1) }, (_, i) => ({ v: i + 1, t: String(i + 1) }))}
          value={value.d ?? 1}
          onSettle={(d) => onChange(clampWhen({ ...value, d }))}
        />
      ) : null}
      <TickerColumn
        label="Year"
        choices={yearChoices(value.y, thisYear).map((y) => ({ v: y, t: String(y) }))}
        value={value.y}
        onSettle={(y) => onChange(clampWhen({ ...value, y }))}
      />
    </TickerFrame>
  );
}

/* ── THE PILL A ROW WEARS, AND THE POP IT OPENS ─────────────────────────── */

/** The pill's look — one height, the width follows its words, the same whether open or not. */
export const TICKER_PILL_CLASS =
  'sn-press sn-press-ring inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white px-2 text-[13px] font-semibold tabular-nums text-sn-accent ring-1 ring-inset ring-ink/15 aria-expanded:ring-sn-accent disabled:cursor-default disabled:text-ink/70';

/** A pill that carries its widest values (`widest`): one column as wide as the widest, the value centred in it. */
export const TICKER_PILL_FIT_CLASS = '!inline-grid grid-cols-1 content-center justify-items-center';

/** This file's own phone sheet, for a surface that hands none in: dark and blurred behind, never taller than the screen. */
function OwnSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: panel });
  return (
    <div data-ticker-sheet="" className="fixed inset-0 z-[95]">
      <button type="button" aria-label="Close" data-ticker-scrim="" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-ink/40 backdrop-blur-sm" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-24px)] flex-col overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-18px_40px_-18px_rgba(30,26,18,.45)] ring-1 ring-ink/10 focus:outline-none"
      >
        <span aria-hidden className="mx-auto mb-1.5 mt-1 h-1 w-10 shrink-0 rounded-full bg-ink/15" />
        <p className="shrink-0 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">{label}</p>
        {children}
      </div>
    </div>
  );
}

/** A desktop's panel: fixed to the screen under its button (portalled — a transformed ancestor would capture it). */
function DeskPop({
  label,
  button,
  align,
  onClose,
  children,
}: {
  label: string;
  button: React.RefObject<HTMLButtonElement | null>;
  align: 'start' | 'end';
  onClose: () => void;
  children: ReactNode;
}) {
  const pop = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const b = button.current?.getBoundingClientRect();
      const p = pop.current;
      if (!b || !p) return;
      const next = placeTickerPop({ button: b, pop: { width: p.offsetWidth, height: p.scrollHeight }, viewport: { width: window.innerWidth, height: window.innerHeight }, align });
      setAt((was) => (was && was.top === next.top && was.left === next.left && was.maxHeight === next.maxHeight ? was : next));
    };
    place();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !button.current?.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      button.current?.focus();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
    // Placed once per opening; `onClose` and `button` are stable for the life of one opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [align]);
  return (
    <div
      ref={pop}
      role="dialog"
      aria-label={label}
      data-ticker-pop=""
      style={{ top: at?.top ?? 0, left: at?.left ?? 0, maxHeight: at?.maxHeight, visibility: at ? 'visible' : 'hidden' }}
      className="fixed z-[95] w-[286px] overflow-y-auto overscroll-contain rounded-2xl bg-white p-3 shadow-[0_14px_34px_-14px_rgba(44,42,41,.4)] ring-1 ring-ink/15"
    >
      {children}
    </div>
  );
}

export function TickerPill({
  text,
  ariaLabel,
  title,
  disabled = false,
  align = 'start',
  sheet = null,
  onClosed,
  hold = false,
  onHeld,
  className = '',
  face,
  widest,
  data,
  children,
}: {
  /** The pill's words — "3:00 PM" · "Jun 2019". */
  text: ReactNode;
  ariaLabel: string;
  /** The pop's name — "Starts · Ceremony". */
  title: string;
  disabled?: boolean;
  /** Which edge of the button a desktop pop lines up with. */
  align?: 'start' | 'end';
  /** The surface's own phone sheet (the Maker's). None handed in → this file's. */
  sheet?: TickerSheet | null;
  /** It closed — by Done, a tap outside, Esc or another thing opening. Whoever rolled it writes NOW, once. */
  onClosed?: () => void;
  /**
   * It must not close right now (something inside would be lost — a file still uploading). While true, EVERY way of
   * closing is refused — Done, the dark part, a tap outside, Esc, the pill itself, another thing opening — and
   * `onHeld` is told, so the wearer can say why in words.
   */
  hold?: boolean;
  onHeld?: () => void;
  /** More classes for the pill (a width floor). */
  className?: string;
  /** A face other than the pill's (a picture square): the whole button's classes. */
  face?: string;
  /**
   * ↔ ONE WIDTH DOWN A LIST (owner 2026-10-08: every "when" pill in a list is the same width, so the names start on
   * one line). The widest values this pill can ever show (`WIDEST_WHEN_WORDS` / `WIDEST_CLOCK_WORDS`, lib/timeline):
   * they are carried inside the pill, unseen and with no height, in its own type — so the pill is as wide as the
   * widest of them needs, measured by the browser, and the value sits centred. It can only GROW the pill: a value
   * wider than all of them is still shown whole, never cut.
   */
  widest?: readonly string[];
  /** `data-ticker-pill="<data>"`. */
  data?: string;
  /** What the pop holds; `close` is its Done. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpenNow] = useState(false);
  const [asSheet, setAsSheet] = useState(false);
  /* The ONE door every closing goes through — held shut while `hold` is on. */
  const held = useRef({ hold, onHeld });
  held.current = { hold, onHeld };
  const setOpen = (next: boolean) => {
    if (!next && held.current.hold) return held.current.onHeld?.();
    setOpenNow(next);
  };
  useOneOpen(open, setOpen);
  const button = useRef<HTMLButtonElement>(null);
  const closed = useRef(onClosed);
  closed.current = onClosed;
  /* Told once per closing, whichever way it closed. */
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !open) closed.current?.();
    was.current = open;
  }, [open]);
  /* It unmounted while open (its row re-sorted away): that is a closing too. */
  useEffect(
    () => () => {
      if (was.current) closed.current?.();
    },
    [],
  );
  const rolling = useRef(new Set<() => void>()).current;
  const close = () => {
    for (const settleNow of rolling) settleNow();
    setOpen(false);
  };
  const body = open ? <SettleNow.Provider value={rolling}>{children(close)}</SettleNow.Provider> : null;
  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-ticker-pill={data ?? ''}
        onClick={() => {
          if (!open) setAsSheet(window.innerWidth < TICKER_SHEET_BELOW_PX);
          setOpen(!open);
        }}
        className={face ?? `${TICKER_PILL_CLASS} ${widest?.length ? TICKER_PILL_FIT_CLASS : ''} ${className}`}
      >
        {text}
        {widest?.map((w) => (
          <span key={w} aria-hidden data-ticker-pill-fit="" className="invisible h-0 overflow-hidden">
            {w}
          </span>
        ))}
      </button>
      {!open || typeof document === 'undefined'
        ? null
        : asSheet
          ? sheet
            ? sheet({ label: title, onClose: close, children: <div className="px-2 pb-1">{body}</div> })
            : createPortal(
                <OwnSheet label={title} onClose={close}>
                  {body}
                </OwnSheet>,
                document.body,
              )
          : createPortal(
              <DeskPop label={title} button={button} align={align} onClose={close}>
                {body}
              </DeskPop>,
              document.body,
            )}
    </>
  );
}
