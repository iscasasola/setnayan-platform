'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { CALENDAR_CLOSE_AFTER_PICK_MS, dayParts, dayWords, type CalendarDay } from '@/lib/calendar-grid';
import { saveFailedWords, type KeepAnswer } from '@/lib/form-row';
import { useOneOpen } from '@/lib/one-open';
import { CalendarGrid, CalendarPop } from './calendar';
import { FORM_PILL_CLASS, FORM_ROW_TICK_MS, FormRow, usePillWidth, type FormRowAbout } from './form-row';

/**
 * FORM ROW WITH A DATE — the third mark of the Form row (`INTERACTION_RULES.md` § 9, kind 6: *"a pencil = type · an
 * arrow = choose · a calendar = pick a date"*; approved gallery `prototypes/control_templates_2026-10-08.html` § 6,
 * its "Reply by" row). Owner, 2026-10-08: *"form row with date"*.
 *
 *   · the answer is the SAME white pill as every other row of its list (the list's one width), with a small accent
 *     CALENDAR mark at its right; it reads the day in words ("November 12, 2026");
 *   · a tap opens the app's one calendar (`calendar.tsx`) the way a dropdown opens — a sheet from the bottom on a
 *     phone, a panel under the pill on a computer; one open at a time on the screen (`useOneOpen`);
 *   · a tap on a day IS the answer: the pill reads it at once, the circle is seen landing, then the calendar closes
 *     and the screen is told ONCE (`onKeep`). Opening it, changing the month, closing it, or tapping the day already
 *     picked tells nothing;
 *   · after a save lands the mark shows a tick for a moment (no "Saved" word); a save that did not land says so
 *     under the row with Try again, and the pill is back on what it held.
 *
 * In its own file so a screen with no date never carries the calendar. Neutral: nothing here knows the Maker; no
 * accent colour is written here (`sn-accent` only). A native `<input type="date">` is what this replaces.
 */
export function DateRow({
  name,
  about,
  value,
  shown = null,
  empty = 'Pick a date',
  today = null,
  min = null,
  max = null,
  onKeep,
  note,
  below,
  data,
  attrs,
  pillAttrs,
}: {
  name: string;
  about?: FormRowAbout | null;
  /** The day as it stands (`YYYY-MM-DD`; '' or null = none of its own yet). */
  value: CalendarDay | null;
  /** The day the pill reads while there is none of its own (a default that applies) — never sent by itself. */
  shown?: CalendarDay | null;
  /** What the pill says while there is no day at all. */
  empty?: string;
  /** Today, for the calendar's ring (the screen's clock). Left out, it is read from the device when the pill is pressed. */
  today?: CalendarDay | null;
  /** The earliest / latest day that may be picked. Left out, every day may. */
  min?: CalendarDay | null;
  max?: CalendarDay | null;
  /** Keep this day. It may answer `{ ok: false, error }` (or throw) when the save did not land. */
  onKeep: (day: CalendarDay) => KeepAnswer | Promise<KeepAnswer>;
  note?: ReactNode;
  below?: ReactNode;
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
  /** The screen's own hooks on the pill (a door other code looks for). */
  pillAttrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  const width = usePillWidth();
  const [open, setOpen] = useState(false);
  useOneOpen(open, setOpen);
  const pill = useRef<HTMLButtonElement>(null);
  /* The day just tapped — on the pill at once, until its save has answered. */
  const [picked, setPicked] = useState<CalendarDay | null>(null);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'failed'; day: CalendarDay; reason: string | null }>({ kind: 'idle' });
  const [clock, setClock] = useState<CalendarDay | null>(today);
  const newest = useRef(0);
  const closing = useRef<number | null>(null);
  useEffect(() => () => void (closing.current !== null && window.clearTimeout(closing.current)), []);

  const send = (day: CalendarDay) => {
    const mine = ++newest.current;
    setPicked(day);
    setState({ kind: 'saving' });
    const settle = (answer: KeepAnswer | 'threw') => {
      if (mine !== newest.current) return;
      setPicked(null);
      if (answer === 'threw') setState({ kind: 'failed', day, reason: null });
      else if (answer && answer.ok === false) setState({ kind: 'failed', day, reason: answer.error ?? null });
      else setState({ kind: 'saved' });
    };
    let answer: KeepAnswer | Promise<KeepAnswer>;
    try {
      answer = onKeep(day);
    } catch {
      settle('threw');
      return;
    }
    void Promise.resolve(answer).then(settle, () => settle('threw'));
  };
  /* The tick is there for a moment, then the calendar mark is back. */
  useEffect(() => {
    if (state.kind !== 'saved') return;
    const t = window.setTimeout(() => setState((s) => (s.kind === 'saved' ? { kind: 'idle' } : s)), FORM_ROW_TICK_MS);
    return () => window.clearTimeout(t);
  }, [state.kind]);

  const own = dayParts(value) ? (value as CalendarDay) : null;
  const reads = picked ?? own ?? (dayParts(shown) ? shown : null);
  const words = dayWords(reads);
  const failed = state.kind === 'failed';
  const close = () => {
    if (closing.current !== null) window.clearTimeout(closing.current);
    closing.current = null;
    setOpen(false);
  };
  const pick = (day: CalendarDay) => {
    /* The day already picked: nothing to keep — the calendar simply closes. */
    if (day !== (picked ?? own)) send(day);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduced) return close();
    if (closing.current !== null) window.clearTimeout(closing.current);
    closing.current = window.setTimeout(close, CALENDAR_CLOSE_AFTER_PICK_MS);
  };
  return (
    <FormRow
      name={name}
      about={about}
      note={note}
      below={below}
      data={data}
      attrs={{ ...attrs, 'data-form-row-kind': 'date', 'data-form-row-state': state.kind }}
      problem={
        failed ? (
          <span data-form-row-unsaved="" className="flex flex-wrap items-center gap-x-2">
            <span>{saveFailedWords(name, state.reason)}</span>
            <button type="button" data-form-row-retry="" onClick={() => send(state.day)} className="sn-press inline-flex min-h-11 items-center underline">
              Try again
            </button>
          </span>
        ) : null
      }
    >
      <button
        ref={pill}
        type="button"
        {...pillAttrs}
        data-form-row-pill="date"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={state.kind === 'saving' || undefined}
        aria-label={`${name}: ${words || 'not set yet'}. Tap to change`}
        onClick={() => {
          if (!open && !clock) {
            const now = new Date();
            setClock(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
          }
          if (open) close();
          else setOpen(true);
        }}
        className={`${FORM_PILL_CLASS} ${width} ${failed ? 'border-danger-700' : 'border-ink/15 aria-expanded:border-sn-accent'}`}
      >
        <span data-form-row-words="" className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${words ? '' : 'font-normal text-ink/45'}`}>
          {words || empty}
        </span>
        {state.kind === 'saved' ? (
          <Check aria-hidden data-form-row-mark="tick" className="h-4 w-4 flex-none text-success-700" strokeWidth={2.6} />
        ) : (
          <CalendarDays aria-hidden data-form-row-mark="calendar" className={`h-4 w-4 flex-none ${failed ? 'text-danger-700' : 'text-sn-accent'}`} strokeWidth={2} />
        )}
      </button>
      {open ? (
        <CalendarPop title={name} anchor={pill} onClose={close}>
          {/* The circle sits on the day the pill reads — a default that applies included. */}
          <CalendarGrid data="row" value={reads} today={clock} min={min} max={max} onPick={pick} />
        </CalendarPop>
      ) : null}
    </FormRow>
  );
}
