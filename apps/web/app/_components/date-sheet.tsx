'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarDays, Check, ChevronLeft, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { CALENDAR_MOTION, dayWords, monthOf, monthTitle, stepMonth, type CalendarDay, type CalendarDayState, type CalendarMonth } from '@/lib/calendar-grid';
import {
  DATE_SHEET_HINT_MANY,
  DATE_SHEET_HINT_ONE,
  DATE_SHEET_MONTH_GAP_PX,
  DATE_SHEET_REASON_MS,
  DATE_SHEET_SWIPE_PX,
  busyWords,
  choicesInRange,
  dateSheetCanSet,
  dateSheetMonthPx,
  dateSheetNeighbours,
  longDay,
  rangeWords,
  refusalLine,
  shortDay,
  slotsHeadWords,
  timeWords,
  type DateSheetChoice,
  type DateSheetRefusal,
  type DateSheetSlots,
  type SheetTime,
} from '@/lib/date-sheet';
import { inertBehind } from '@/lib/popup-behind';
import { useHydrated } from '@/lib/use-hydrated';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { CalendarGrid, CalendarLegend } from './calendar';
import { InfoTip } from './info-tip';
import { OverlayBackdrop } from './overlay-backdrop';
import { pressMs } from './press-feel';

/**
 * THE DATE SHEET — the app's ONE date pop-up (Build 3 · Lane D part 1). Owner, 9 Nov 2026: *"show me a date picker that
 * should apply to all date pickers"* → *"date picker approved"* on v3.1 (`Setnayan-specs/prototypes/date_picker_2026-11-09/`,
 * artifact MfhZ3LUJpns19SDzFGDtTx v4; DECISION_LOG 📆 2026-11-09). Built ON the shipped parts, never beside them: the
 * month is `CalendarGrid` (`calendar.tsx`), the buttons are `ActionButton`, the ⓘ is `InfoTip`, the dark is
 * `OverlayBackdrop`, the modal contract is `useModalA11y` + `inertBehind` — the same as `CalendarPop`'s sheet.
 *
 *   · THE HOUSE BOTTOM SHEET, from the thumb zone, at every width (Option A). It spans the screen; what is INSIDE never
 *     stretches — the head, the month and the Cancel | Set foot keep ONE column: the sheet minus its 16-px sides, never
 *     more than 360 (`lib/date-sheet.ts` → `dateSheetMonthPx`).
 *   · QUICK CHOICES FIRST: it opens on the common answers for its use (`choices`); the month appears only after
 *     **Pick a date**; a use with no choices opens straight on the month.
 *   · THE MONTH STRIP: the month on show centred; whole neighbours GREYED beside it when they fit (none on a phone, one a
 *     side at 1280); a swipe, ‹ ›, or a tap on a greyed month glides the months at the press family's one speed
 *     (`--sn-pill-dur`, read through `press-feel.tsx`'s `pressMs`) and its spring (`--sn-pill-spring`). No duration is
 *     written here. Under "reduce motion" nothing moves — the same states, at once.
 *   · 🚫 A NOT-AVAILABLE DAY CAN NEVER BE CHOSEN (owner: *"why can i tap on the not available?"*): `refuse` names its reason;
 *     the grid draws it struck or hatched, out of the tab order, never the chosen circle; a tap writes
 *     "Fri 20 Nov — Lumina is not available" on the line under the month for a moment, and Set stays off.
 *   · THE CHOSEN DAY is the accent circle with the on-accent ink (white in light; the token's own ink in dark).
 *   · A MEETING (`slots`): Next → only the times on the list, a busy one greyed with WHO (`busyWords`) and never chosen;
 *     Set lights only on a time free for everyone. ‹ Day goes back.
 *   · Cancel | Set at equal widths (neutral | brand main). Set is the only way an answer leaves this sheet.
 *
 * 📦 NEVER IMPORTED BY A SCREEN — screens mount `LazyDateSheet` (`date-sheet-lazy.tsx`), so this code is its own chunk,
 * fetched on the first open (the shared bundle has ~20 B of room). 🔒 `app/_components/the-date-sheet.test.ts`.
 * Neutral: it knows no screen, no row and no save — the screen hands it the rules and hears `onSet` once.
 */

export type DateSheetProps = {
  /** The use's name — the sheet's head ("Valid until"). */
  title: string;
  /** What the ⓘ beside the title says: the range's reason, who has not added a schedule… Left out, no ⓘ. */
  about?: string | null;
  /** The day as it stands (`YYYY-MM-DD`), or null. A refused day is never shown as chosen. */
  value: CalendarDay | null;
  /** The time as it stands (`HH:MM`) — a meeting only. */
  time?: SheetTime | null;
  /** Today (the screen's clock): the ring, and the month to open on. */
  today: CalendarDay;
  /** The earliest / latest day that may be picked — out of range is grey and cannot be pressed. */
  min?: CalendarDay | null;
  max?: CalendarDay | null;
  /** The quick choices, in order (`validUntilChoices` · `meetingChoices` · `paymentAskChoices`). None → straight to the month. */
  choices?: readonly DateSheetChoice[] | null;
  /** What each day holds (kind 31: dots, the hatch for a blocked day). */
  states?: ReadonlyMap<CalendarDay, CalendarDayState> | null;
  /** A day that can never be chosen, and why ("Lumina is not available"). */
  refuse?: DateSheetRefusal | null;
  /** A meeting: the times, and who is busy at each. Given, the sheet is two steps (the day, then the time). */
  slots?: DateSheetSlots | null;
  /** Set: the answer, once. */
  onSet: (pick: { day: CalendarDay; time: SheetTime | null }) => void;
  /** Cancel · a tap on the dark · Esc. Nothing is kept. */
  onCancel: () => void;
  /** `data-date-sheet="<data>"`. */
  data?: string;
};

/** One column for the head, the lists and the foot: the month's own width plus the sheet's two 16-px sides. */
const COLUMN = 'mx-auto w-full max-w-[392px] px-4';
/** A row of the house list (quick choices, times): 48 px, the accent wash when chosen, grey and refusing when busy. */
const OPTION_CLASS =
  'sn-press flex min-h-12 w-full min-w-0 items-center justify-between gap-2.5 rounded-lg px-2.5 text-left text-[15px] font-medium leading-snug text-ink aria-selected:bg-sn-accent/10 aria-disabled:cursor-not-allowed aria-disabled:text-ink/35';
/** The meaning token for "why not" (the prototype's `--color-warn`), never a colour written here. */
const WHY_STYLE = { color: 'rgb(var(--color-warn))' } as const;

const still = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const token = (name: string) => (typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim());
/** The press family's one speed, in ms — the token `--sn-pill-dur` (700 ms), read the way `press-feel.tsx` reads it. */
const familyMs = () => pressMs(token('--sn-pill-dur'));
/** The press family's spring — the token `--sn-pill-spring`. */
const familyEase = () => token('--sn-pill-spring') || 'ease-out';

type Step = 'choices' | 'month' | 'time';

export function DateSheet({ title, about = null, value, time = null, today, min = null, max = null, choices: given = null, states = null, refuse = null, slots = null, onSet, onCancel, data }: DateSheetProps) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const headId = useId();
  /* A choice outside [min, max] is HIDDEN, never greyed — whatever list the screen handed in. */
  const choices = choicesInRange(given ?? [], min, max);
  const hasChoices = choices.length > 0;
  const fair = (day: CalendarDay | null) => (day && !(refuse && refuse(day) !== null) ? day : null);
  const [day, setDay] = useState<CalendarDay | null>(() => fair(value));
  const [at, setAt] = useState<SheetTime | null>(() => (slots && fair(value) ? time : null));
  const [step, setStep] = useState<Step>(hasChoices ? 'choices' : 'month');
  /** Where the day was chosen — ‹ Day goes back there. */
  const dayStep = useRef<Exclude<Step, 'time'>>(hasChoices ? 'choices' : 'month');
  const [view, setView] = useState<CalendarMonth>(() => monthOf(fair(value), min && min > today ? min : today, today) ?? { y: 2026, m: 1 });

  /* Nothing behind works, Esc closes, Tab stays inside, the page does not scroll — the house modal contract. */
  useLayoutEffect(() => {
    const el = root.current;
    return el ? inertBehind(el) : undefined;
  }, []);
  useModalA11y({ open: true, onClose: onCancel, containerRef: panel });
  /* It rises from the bottom on the family's speed and spring (the shipped `CalendarSheet`'s share of it). */
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el?.animate || still()) return;
    el.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: familyMs() * CALENDAR_MOTION.sheet, easing: familyEase() });
  }, []);

  const choose = (next: CalendarDay) => {
    setDay(next);
    setAt(null);
  };
  const dayOk = dateSheetCanSet({ day, min, max, refuse });
  const twoSteps = slots !== null && step !== 'time';
  const ok = twoSteps ? dayOk : dateSheetCanSet({ day, time: at, min, max, refuse, slots });
  const main = () => {
    if (!ok || !day) return;
    if (twoSteps) {
      dayStep.current = step === 'choices' ? 'choices' : 'month';
      setStep('time');
      return;
    }
    onSet({ day, time: slots ? at : null });
  };

  const back =
    step === 'month' && hasChoices
      ? { label: 'Choices', go: () => setStep('choices') }
      : step === 'time'
        ? { label: 'Day', go: () => (setAt(null), setStep(dayStep.current)) }
        : null;
  const sub = slots ? (step === 'time' && day ? `Step 2 of 2 · the time on ${longDay(day)}` : 'Step 1 of 2 · the day') : rangeWords(min, max);

  /* Drawn only once the page has hydrated (it is only ever mounted by a press — this keeps it so). */
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(
    <div ref={root} data-date-sheet={data ?? ''} data-date-sheet-step={step} className="fixed inset-0 z-[96]">
      {/* A tap on the dark is Cancel — the dark IS the close button. */}
      <OverlayBackdrop onClose={onCancel} label="Cancel" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        tabIndex={-1}
        data-date-sheet-panel=""
        /* `after:` — the sheet's own skirt: while it lands with the spring's small overshoot nothing behind shows under it. */
        className="absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-48px)] flex-col rounded-t-2xl bg-raised pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-ink shadow-[0_-14px_40px_-18px_rgba(44,42,41,.5)] after:absolute after:inset-x-0 after:top-full after:h-16 after:bg-raised after:content-[''] focus:outline-none"
      >
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-ink/15" />
        <div data-date-sheet-head="" className={`${COLUMN} flex min-h-12 flex-none items-center gap-2.5 pb-1 pt-2.5`}>
          {back ? <ActionButton tone="neutral" icon={ChevronLeft} label={back.label} onClick={back.go} data-testid="date-sheet-back" /> : null}
          <div className="min-w-0 flex-1">
            {about ? (
              <InfoTip label={title} labelAs="p" labelId={headId} labelClassName="text-[15px] font-bold text-ink" align="end" ariaLabel="About the days">
                {about}
              </InfoTip>
            ) : (
              <p id={headId} className="text-[15px] font-bold text-ink">
                {title}
              </p>
            )}
            <p data-date-sheet-sub="" className="text-[12.5px] font-medium tabular-nums text-ink/55">
              {sub}
            </p>
          </div>
        </div>

        <div data-date-sheet-body="" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-2 pt-1">
          {step === 'choices' ? (
            <Choices title={title} choices={choices} day={day} refuse={refuse} onChoose={choose} onMonth={() => setStep('month')} />
          ) : step === 'month' ? (
            <MonthStrip
              view={view}
              onView={setView}
              day={day}
              today={today}
              min={min}
              max={max}
              states={states}
              refuse={refuse}
              onPick={choose}
            />
          ) : day && slots ? (
            <Times day={day} slots={slots} at={at} onChoose={setAt} />
          ) : null}
        </div>

        <div data-date-sheet-foot="" className={`${COLUMN} grid flex-none grid-cols-2 gap-2.5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3`}>
          <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onCancel} className="!w-full !min-w-0" data-testid="date-sheet-cancel" />
          <ActionButton
            tone="brand"
            main
            icon={twoSteps ? ArrowRight : Check}
            label={twoSteps ? 'Next' : 'Set'}
            disabled={!ok}
            onClick={main}
            className="!w-full !min-w-0"
            data-testid="date-sheet-set"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── STEP 1 · the quick choices, then "Pick a date" ────────────────────────── */

function Choices({
  title,
  choices,
  day,
  refuse,
  onChoose,
  onMonth,
}: {
  title: string;
  choices: readonly DateSheetChoice[];
  day: CalendarDay | null;
  refuse: DateSheetRefusal | null;
  onChoose: (day: CalendarDay) => void;
  onMonth: () => void;
}) {
  const own = day !== null && !choices.some((c) => c.day === day);
  return (
    <div role="listbox" aria-label={title} data-date-sheet-choices="" className={`${COLUMN} flex flex-col`}>
      {choices.map((c) => {
        const why = refuse ? refuse(c.day) : null;
        const on = c.day === day;
        return (
          <button
            key={`${c.label}-${c.day}`}
            type="button"
            role="option"
            aria-selected={on}
            aria-disabled={why !== null ? true : undefined}
            data-date-sheet-choice={c.day}
            onClick={() => (why === null ? onChoose(c.day) : undefined)}
            className={OPTION_CLASS}
          >
            <span className="min-w-0">
              <span className="block">{c.label}</span>
              <span className="mt-0.5 block text-[12.5px] font-normal tabular-nums text-ink/55" style={why !== null ? WHY_STYLE : undefined}>
                {why ?? shortDay(c.day)}
              </span>
            </span>
            {on ? <Check aria-hidden className="h-[18px] w-[18px] flex-none text-sn-accent" strokeWidth={2.4} /> : null}
          </button>
        );
      })}
      <button type="button" role="option" aria-selected={false} data-date-sheet-pick="" onClick={onMonth} className={OPTION_CLASS}>
        <span className="min-w-0">
          <span className="block">Pick a date</span>
          {own ? <span className="mt-0.5 block text-[12.5px] font-normal tabular-nums text-ink/55">{dayWords(day)}</span> : null}
        </span>
        <CalendarDays aria-hidden className="h-[18px] w-[18px] flex-none text-ink/45" strokeWidth={2} />
      </button>
    </div>
  );
}

/* ── STEP 1b · the month strip ─────────────────────────────────────────────── */

function MonthStrip({
  view,
  onView,
  day,
  today,
  min,
  max,
  states,
  refuse,
  onPick,
}: {
  view: CalendarMonth;
  onView: (month: CalendarMonth) => void;
  day: CalendarDay | null;
  today: CalendarDay;
  min: CalendarDay | null;
  max: CalendarDay | null;
  states: ReadonlyMap<CalendarDay, CalendarDayState> | null;
  refuse: DateSheetRefusal | null;
  onPick: (day: CalendarDay) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const monthPx = dateSheetMonthPx(width);
  const side = dateSheetNeighbours(width);

  /* The months glide toward the side the new one came from — one month's width, on the family's speed and spring. */
  const came = useRef(0);
  const move = (n: number) => {
    if (!n) return;
    came.current = n > 0 ? 1 : -1;
    onView(stepMonth(view, n));
  };
  useLayoutEffect(() => {
    const from = came.current;
    came.current = 0;
    const el = track.current;
    if (!from || !el?.animate || still()) return;
    el.animate([{ transform: `translateX(${from * (monthPx + DATE_SHEET_MONTH_GAP_PX)}px)` }, { transform: 'none' }], { duration: familyMs(), easing: familyEase() });
  }, [view.y, view.m, monthPx]);

  /* The line under the month: how to move — or, for a moment after a refused day is tapped, why it cannot be chosen. */
  const [why, setWhy] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => void (timer.current !== null && window.clearTimeout(timer.current)), []);
  const say = (line: string | null) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = line ? window.setTimeout(() => setWhy(null), DATE_SHEET_REASON_MS) : null;
    setWhy(line);
  };
  const pick = (d: CalendarDay) => {
    say(null);
    onPick(d);
  };

  /* A swipe: a finger that travels far enough sideways moves one month; the tap it ends on is not a pick. */
  const x0 = useRef<number | null>(null);
  const swiped = useRef(false);
  const down = (e: ReactPointerEvent) => {
    x0.current = e.clientX;
    swiped.current = false;
  };
  const up = (e: ReactPointerEvent) => {
    if (x0.current === null) return;
    const dx = e.clientX - x0.current;
    x0.current = null;
    if (Math.abs(dx) < DATE_SHEET_SWIPE_PX) return;
    swiped.current = true;
    move(dx < 0 ? 1 : -1);
  };

  const offsets = Array.from({ length: side * 2 + 1 }, (_, i) => i - side);
  const dots = states ? [...new Set([...states.values()].flatMap((s) => (s.blocked ? [] : (s.dots ?? []))))] : [];
  const anyBlocked = states ? [...states.values()].some((s) => s.blocked) : false;
  return (
    <div
      ref={box}
      data-date-sheet-strip=""
      data-date-sheet-neighbours={side}
      className="relative w-full touch-pan-y select-none overflow-hidden"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={() => (x0.current = null)}
      onClickCapture={(e) => {
        if (!swiped.current) return;
        swiped.current = false;
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <div ref={track} data-date-sheet-track="" className="flex justify-center" style={{ gap: DATE_SHEET_MONTH_GAP_PX }}>
        {width > 0
          ? offsets.map((k) => {
              const m = stepMonth(view, k);
              const key = `${m.y}-${String(m.m).padStart(2, '0')}`;
              const grid = (
                <CalendarGrid
                  data="sheet"
                  month={m}
                  onMonth={(next) => move(next.y * 12 + next.m - (view.y * 12 + view.m))}
                  steps={k === 0}
                  glide={false}
                  value={day}
                  today={today}
                  min={min}
                  max={max}
                  states={states}
                  refuse={refuse}
                  onRefused={(d, reason) => say(refusalLine(d, reason))}
                  onPick={pick}
                />
              );
              return k === 0 ? (
                <div key={k} data-date-sheet-month={key} data-date-sheet-centre="" className="flex-none" style={{ width: monthPx }}>
                  {grid}
                </div>
              ) : (
                /* A greyed neighbour: one button — a tap (or Enter) brings it to the centre; its days are not pressable. */
                <div
                  key={k}
                  role="button"
                  tabIndex={0}
                  aria-label={`Show ${monthTitle(m)}`}
                  data-date-sheet-month={key}
                  data-date-sheet-ghost=""
                  onClick={() => move(k)}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    move(k);
                  }}
                  className="flex-none cursor-pointer rounded-xl opacity-[.38] transition-opacity duration-sn-control ease-sn hover:opacity-[.55] motion-reduce:transition-none"
                  style={{ width: monthPx }}
                >
                  <div inert className="pointer-events-none">
                    {grid}
                  </div>
                </div>
              );
            })
          : null}
      </div>
      <p
        aria-live="polite"
        data-date-sheet-hint={why ? 'why' : 'how'}
        className={`mx-auto min-h-[25px] px-4 pt-2 text-center text-[12px] ${why ? 'font-medium' : 'text-ink/50'}`}
        style={{ ...(why ? WHY_STYLE : null), maxWidth: monthPx + 32 }}
      >
        {why ?? (side > 0 ? DATE_SHEET_HINT_MANY : DATE_SHEET_HINT_ONE)}
      </p>
      <div className="mx-auto px-4" style={{ maxWidth: monthPx + 32 }}>
        <p data-date-sheet-legend="" className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-0.5 pt-2 text-[12px] text-ink/70">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="block h-2 w-2 rounded-full ring-[1.5px] ring-inset ring-ink/35" />
            Today
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="block h-2 w-2 rounded-full bg-sn-accent" />
            Chosen
          </span>
          {min || max ? (
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="block h-2 w-2 rounded-full bg-ink/20" />
              Not in range
            </span>
          ) : null}
          {refuse && !anyBlocked ? (
            <span className="inline-flex items-center gap-1.5">
              <b aria-hidden className="font-normal text-ink/35 line-through">
                14
              </b>
              Not available
            </span>
          ) : null}
        </p>
        {states && (dots.length > 0 || anyBlocked) ? <CalendarLegend dots={dots} blocked={anyBlocked} /> : null}
      </div>
    </div>
  );
}

/* ── STEP 2 · the time — only the slots free for everyone can be chosen ────── */

function Times({ day, slots, at, onChoose }: { day: CalendarDay; slots: DateSheetSlots; at: SheetTime | null; onChoose: (t: SheetTime) => void }) {
  return (
    <div className={COLUMN}>
      <p data-date-sheet-free="" className="px-2.5 pb-2 pt-1 text-[12px] text-ink/55">
        {slotsHeadWords(day, slots.free)}
      </p>
      <div role="listbox" aria-label={`Times on ${longDay(day)}`} data-date-sheet-times="" className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {slots.times.map((t) => {
          const busy = slots.busy(day, t);
          const on = t === at;
          return (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={on}
              aria-disabled={busy ? true : undefined}
              data-date-sheet-time={t}
              onClick={() => (busy ? undefined : onChoose(t))}
              className={`${OPTION_CLASS} !min-h-11 !text-[14px]`}
            >
              <span className="min-w-0">
                <span className="block tabular-nums">{timeWords(t)}</span>
                {busy ? (
                  <span className="mt-0.5 block text-[11.5px] font-normal leading-tight" style={WHY_STYLE}>
                    {busyWords(busy, t)}
                  </span>
                ) : null}
              </span>
              {on ? <Check aria-hidden className="h-[18px] w-[18px] flex-none text-sn-accent" strokeWidth={2.4} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
