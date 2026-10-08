'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  CALENDAR_MOTION,
  CALENDAR_MONTH_SLIDE_PX,
  CALENDAR_WEEKDAYS,
  calendarOpensAs,
  dayLook,
  dayOf,
  dayWords,
  monthCells,
  monthOf,
  monthTitle,
  stepMonth,
  type CalendarDay,
  type CalendarMonth,
  type CalendarRange,
} from '@/lib/calendar-grid';
import { inertBehind } from '@/lib/popup-behind';
import { placeTickerPop } from '@/lib/timeline';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { PILL_ON_CLASS } from './pill-selector';
import { pressMs } from './press-feel';

/**
 * CALENDAR — the app's ONE month grid (`INTERACTION_RULES.md` § 9, kind 8; approved gallery
 * `prototypes/control_templates_2026-10-08.html` § 6 "Reply by" and § 8).
 *
 * Owner, 2026-10-08: *"form row with date"* · and the gallery he approved: **"Three uses, one look. Pick one day.
 * Pick a range of days. See what is on each day."** A date is picked on THIS — the ticker is for a time, and for a
 * Love Story chapter's loose "when".
 *
 *   · THE GRID (`CalendarGrid`): ‹ · the month and year · › over seven columns, Sunday first. The picked day is the
 *     app's accent circle with the ink that reads on it (the pill selector's own "on"); today wears a hairline ring;
 *     a range fills softly between its two ends; a dot under a day means something is on it; a day that may not be
 *     picked is grey and cannot be pressed. A day is 44 px on a phone, 40 px on a computer.
 *   · THE PRESS is the family's (every day is a button — `press-feel.tsx`); changing the month slides the new one in
 *     from the side it came from. Nothing moves under "reduce motion".
 *   · THE POP (`CalendarPop`) is the calendar that BELONGS TO A ROW — it opens the way a dropdown does:
 *       – on a phone a SHEET FROM THE BOTTOM, and the pop-up rule holds: the rest of the screen is dark and blurred
 *         (`.sn-popup-dark`), nothing behind it works (`inertBehind`), the page behind does not scroll and Esc closes
 *         (`useModalA11y`), and a tap on the dark closes it. Never taller than the screen;
 *       – on a computer a PANEL UNDER ITS PILL, attached to it — it does not darken the page; a press anywhere else,
 *         or Esc, closes it.
 *
 * Neutral: nothing here knows a screen, a row or a save — the screen says which day is picked and hears a tap. No
 * colour is written here for the accent (`lib/the-accent-is-one-token.test.ts`). The rules are `lib/calendar-grid.ts`.
 */

const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const EASE = 'cubic-bezier(.2,.8,.2,1)';

const still = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
/** The press family's one speed, in ms (700 until the token says otherwise). */
const familyMs = () => (typeof window === 'undefined' ? 700 : pressMs(getComputedStyle(document.documentElement).getPropertyValue('--sn-pill-dur')));

/** One day's button: the column's width, 44 px tall on a phone and 40 on a computer (its corners are the day's own — a circle, or square inside a range). */
export const CALENDAR_DAY_CLASS =
  'sn-press sn-press-ring relative flex h-11 min-h-11 w-full items-center justify-center p-0 text-[16px] tabular-nums transition-colors duration-sn-control ease-sn motion-reduce:transition-none lg:h-10 lg:min-h-10 lg:text-[14px]';
/** ‹ and › — round, 44 px, the accent arrow (the small mark that says "you can tap this"). */
const STEP_CLASS = 'sn-press flex h-11 min-h-11 w-11 flex-none items-center justify-center rounded-full p-0 text-sn-accent disabled:opacity-40';

/* ── THE GRID ───────────────────────────────────────────────────────────── */

export function CalendarGrid({
  value = null,
  range = null,
  marks = null,
  today = null,
  min = null,
  max = null,
  startAt = null,
  onPick,
  data,
}: {
  /** The one day picked (`YYYY-MM-DD`). */
  value?: CalendarDay | null;
  /** A range picked, or being picked — its ends are circles, the days between fill softly. */
  range?: CalendarRange | null;
  /** Days with something on: a dot under each. */
  marks?: ReadonlySet<CalendarDay> | null;
  /** Today (the screen's clock — this file has none). */
  today?: CalendarDay | null;
  /** The earliest / latest day that may be picked. Left out, every day may. */
  min?: CalendarDay | null;
  max?: CalendarDay | null;
  /** The month to open on when no day is picked yet. */
  startAt?: CalendarDay | null;
  /** A day was tapped. */
  onPick: (day: CalendarDay) => void;
  /** `data-calendar="<data>"`. */
  data?: string;
}) {
  const [view, setView] = useState<CalendarMonth>(() => monthOf(value, range?.from, startAt, today) ?? { y: 2026, m: 1 });
  const grid = useRef<HTMLDivElement>(null);
  const titleId = useId();
  /** The side the month on show came in from: +1 a later month, −1 an earlier one. */
  const came = useRef(0);
  useLayoutEffect(() => {
    const side = came.current;
    came.current = 0;
    const el = grid.current;
    if (!side || !el?.animate || still()) return;
    el.animate(
      [
        { opacity: 0, transform: `translateX(${side * CALENDAR_MONTH_SLIDE_PX}px)` },
        { opacity: 1, transform: 'none' },
      ],
      { duration: familyMs() * CALENDAR_MOTION.month, easing: EASE },
    );
  }, [view]);
  const step = (n: number) => {
    came.current = n;
    setView((v) => stepMonth(v, n));
  };
  const { lead, days } = monthCells(view);
  return (
    <div data-calendar={data ?? ''} data-calendar-month={`${view.y}-${String(view.m).padStart(2, '0')}`} className="w-full select-none">
      <div className="flex items-center gap-1.5 px-0.5 pb-2 pt-0.5">
        <button type="button" aria-label="Earlier month" data-calendar-step="-1" onClick={() => step(-1)} className={STEP_CLASS}>
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
        <b id={titleId} aria-live="polite" data-calendar-title="" className="min-w-0 flex-1 text-center text-[15px] font-semibold text-ink">
          {monthTitle(view)}
        </b>
        <button type="button" aria-label="Later month" data-calendar-step="1" onClick={() => step(1)} className={STEP_CLASS}>
          <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
      <div ref={grid} role="group" aria-labelledby={titleId} data-calendar-days="" className="grid grid-cols-7 gap-0.5 text-center">
        {CALENDAR_WEEKDAYS.map((w) => (
          <span key={w.name} aria-hidden data-calendar-weekday="" className="py-1 text-[11px] font-bold text-ink/45">
            {w.letter}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <i key={`lead-${i}`} aria-hidden />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = dayOf(view.y, view.m, i + 1);
          const look = dayLook(day, { value, range, today, marks, min, max });
          return (
            <button
              key={day}
              type="button"
              disabled={look.out}
              aria-pressed={look.picked}
              aria-current={look.today ? 'date' : undefined}
              aria-label={`${dayWords(day)}${look.marked ? ' — something is on' : ''}`}
              data-calendar-day={day}
              data-calendar-in-range={look.inRange ? '' : undefined}
              onClick={() => onPick(day)}
              /* ONE shape per day: a circle — or, strictly between a range's two ends, a square of the soft fill. */
              className={`${CALENDAR_DAY_CLASS} ${
                look.picked
                  ? `rounded-full ${PILL_ON_CLASS} font-bold`
                  : look.out
                    ? 'pointer-events-none rounded-full text-ink/25'
                    : look.inRange
                      ? 'rounded-none bg-sn-accent/[0.14] text-ink'
                      : 'rounded-full text-ink'
              } ${look.today && !look.picked ? 'ring-1 ring-inset ring-ink/15' : ''}`}
            >
              {i + 1}
              {look.marked ? (
                <span aria-hidden data-calendar-dot="" className={`absolute bottom-[5px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full ${look.picked ? 'bg-current' : 'bg-sn-accent'}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── THE POP — the calendar that belongs to a row ───────────────────────── */

/**
 * The pop a row's calendar opens in: a sheet from the bottom on a phone, a panel under its pill on a computer.
 * Mounted only while open (the row decides) — mounting it IS opening it.
 */
export function CalendarPop({
  title,
  anchor,
  align = 'end',
  onClose,
  children,
}: {
  /** The pop's name — the row's ("Reply by"). */
  title: string;
  /** The pill that opened it. */
  anchor: RefObject<HTMLButtonElement | null>;
  /** Which edge of the pill a computer's panel lines up with. */
  align?: 'start' | 'end';
  onClose: () => void;
  children: ReactNode;
}) {
  /* Decided once per opening, from the screen it opened on. */
  const [as] = useState<'sheet' | 'panel'>(() => (typeof window === 'undefined' ? 'sheet' : calendarOpensAs(window.innerWidth)));
  if (typeof document === 'undefined') return null;
  return createPortal(
    as === 'sheet' ? (
      <CalendarSheet title={title} onClose={onClose}>
        {children}
      </CalendarSheet>
    ) : (
      <CalendarPanel title={title} anchor={anchor} align={align} onClose={onClose}>
        {children}
      </CalendarPanel>
    ),
    document.body,
  );
}

/** A phone: the sheet rises from the bottom; the rest of the screen is dark, blurred and out of reach. */
function CalendarSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const headId = useId();
  /* Nothing behind works: every branch of the page but this one is out of reach, and put back exactly on close. */
  useLayoutEffect(() => {
    const el = root.current;
    return el ? inertBehind(el) : undefined;
  }, []);
  /* The app's one modal contract: Esc closes, Tab stays inside, the page behind does not scroll. */
  useModalA11y({ open: true, onClose, containerRef: panel });
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el?.animate || still()) return;
    el.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: familyMs() * CALENDAR_MOTION.sheet, easing: SPRING });
  }, []);
  return (
    <div ref={root} data-calendar-sheet="" className="fixed inset-0 z-[96]">
      {/* A tap on the dark closes it. */}
      <button type="button" aria-label="Close" data-calendar-scrim="" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default touch-none" />
      <span aria-hidden className="sn-popup-dark pointer-events-none absolute inset-0" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        tabIndex={-1}
        /* `after:` — the sheet's own skirt: while it lands with the family's small overshoot nothing behind shows under it. */
        className="absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-48px)] flex-col overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-2.5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_40px_-18px_rgba(44,42,41,.5)] after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-white after:content-[''] focus:outline-none"
      >
        <span aria-hidden className="mx-auto h-1 w-10 flex-none rounded-full bg-ink/15" />
        <p id={headId} data-calendar-pop-title="" className="flex-none px-3 pb-2 pt-3 text-[13px] font-bold text-ink/70">
          {title}
        </p>
        <div className="mx-auto w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}

/** A computer: a panel under the pill. It is attached to its pill and does not darken the page. */
function CalendarPanel({
  title,
  anchor,
  align,
  onClose,
  children,
}: {
  title: string;
  anchor: RefObject<HTMLButtonElement | null>;
  align: 'start' | 'end';
  onClose: () => void;
  children: ReactNode;
}) {
  const pop = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const shut = useRef(onClose);
  shut.current = onClose;
  useLayoutEffect(() => {
    const place = () => {
      const b = anchor.current?.getBoundingClientRect();
      const p = pop.current;
      if (!b || !p) return;
      const next = placeTickerPop({ button: b, pop: { width: p.offsetWidth, height: p.scrollHeight }, viewport: { width: window.innerWidth, height: window.innerHeight }, align });
      setAt((was) => (was && was.top === next.top && was.left === next.left && was.maxHeight === next.maxHeight ? was : next));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, align]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !anchor.current?.contains(t)) shut.current();
    };
    /* Esc peels ONE layer — heard before a sheet or a modal this panel may sit in. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      shut.current();
      anchor.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [anchor]);
  /* It lands once it has its place. */
  const placed = at !== null;
  useLayoutEffect(() => {
    const el = pop.current;
    if (!placed || !el?.animate || still()) return;
    el.animate([{ opacity: 0, transform: 'translateY(-6px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: familyMs() * CALENDAR_MOTION.panel, easing: SPRING });
  }, [placed]);
  return (
    <div
      ref={pop}
      role="dialog"
      aria-label={title}
      data-calendar-panel=""
      style={{ top: at?.top ?? 0, left: at?.left ?? 0, maxHeight: at?.maxHeight, visibility: at ? 'visible' : 'hidden', transformOrigin: align === 'end' ? 'top right' : 'top left' }}
      className="fixed z-[95] w-[320px] overflow-y-auto overscroll-contain rounded-2xl bg-white p-2.5 shadow-[0_14px_34px_-14px_rgba(44,42,41,.4)] ring-1 ring-ink/15"
    >
      {children}
    </div>
  );
}
