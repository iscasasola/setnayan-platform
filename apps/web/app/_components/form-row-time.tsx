'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, Clock } from 'lucide-react';
import { ClearButton } from '@/components/clear-field';
import { saveFailedWords, type KeepAnswer } from '@/lib/form-row';
import { FORM_PILL_CLASS, FORM_ROW_TICK_MS, FormRow, usePillWidth, type FormRowAbout } from './form-row';

/**
 * FORM ROW WITH A TIME — the clock beside `DateRow`'s calendar (the Field template's exception for *"date and time
 * (picker)"*, corpus SCHEDULE_CHAPTERS_BUILD_PLAN §6). The answer is the SAME white pill as every other row of its
 * list, with a small accent CLOCK mark; it reads the time in words ("2:00 PM").
 *
 *   · a tap opens the phone's own time wheel (iPhone Safari) or the browser's picker: a real `<input type="time">` lies
 *     over the pill, unseen, so the press lands on it — no second picker is drawn;
 *   · the time is KEPT when the picker is left (blur), and told ONCE (`onKeep`) only when it changed;
 *   · `clearable` — an optional time ("Ingress from": blank means none) carries a ✕ inside the pill that keeps "none";
 *   · after a save lands the mark shows a tick for a moment; a save that did not land says so under the row with Try
 *     again, and the pill is back on what it held.
 *
 * In its own file so a screen with no time never carries it. Neutral: nothing here knows the schedule.
 */
export function TimeRow({
  name,
  about,
  value,
  empty = 'Not set',
  clearable = false,
  onKeep,
  note,
  line,
  below,
  data,
  attrs,
}: {
  name: string;
  about?: FormRowAbout | null;
  /** The time as it stands ("14:00"; '' = none). */
  value: string;
  /** What the pill says while there is no time. */
  empty?: string;
  /** An optional time: the pill carries a ✕ that keeps "none" (''). */
  clearable?: boolean;
  /** Keep this time ('' = none). It may answer `{ ok: false, error }` (or throw) when the save did not land. */
  onKeep: (hhmm: string) => KeepAnswer | Promise<KeepAnswer>;
  note?: ReactNode;
  line?: ReactNode;
  below?: ReactNode;
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  const width = usePillWidth();
  const id = useId();
  const box = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => setShown(value), [value]);
  const kept = useRef(value);
  useEffect(() => {
    kept.current = value;
  }, [value]);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'failed'; hhmm: string; reason: string | null }>({ kind: 'idle' });
  const newest = useRef(0);

  const send = (hhmm: string) => {
    if (hhmm === kept.current) return;
    const before = kept.current;
    kept.current = hhmm;
    setShown(hhmm);
    const mine = ++newest.current;
    setState({ kind: 'saving' });
    const settle = (answer: KeepAnswer | 'threw') => {
      if (mine !== newest.current) return;
      const failed = answer === 'threw' || (answer && answer.ok === false);
      if (failed) {
        kept.current = before;
        setShown(before);
        setState({ kind: 'failed', hhmm, reason: answer !== 'threw' && answer && answer.ok === false ? (answer.error ?? null) : null });
      } else setState({ kind: 'saved' });
    };
    let answer: KeepAnswer | Promise<KeepAnswer>;
    try {
      answer = onKeep(hhmm);
    } catch {
      settle('threw');
      return;
    }
    void Promise.resolve(answer).then(settle, () => settle('threw'));
  };
  useEffect(() => {
    if (state.kind !== 'saved') return;
    const t = window.setTimeout(() => setState((s) => (s.kind === 'saved' ? { kind: 'idle' } : s)), FORM_ROW_TICK_MS);
    return () => window.clearTimeout(t);
  }, [state.kind]);

  const words = clockWordsOf(shown);
  const failed = state.kind === 'failed';
  return (
    <FormRow
      name={name}
      about={about}
      line={line}
      note={note}
      below={below}
      data={data}
      attrs={{ ...attrs, 'data-form-row-kind': 'time', 'data-form-row-state': state.kind }}
      problem={
        failed ? (
          <span data-form-row-unsaved="" className="flex flex-wrap items-center gap-x-2">
            <span>{saveFailedWords(name, state.reason)}</span>
            <button type="button" data-form-row-retry="" onClick={() => send(state.hhmm)} className="sn-press inline-flex min-h-11 items-center underline">
              Try again
            </button>
          </span>
        ) : null
      }
    >
      <span
        data-form-row-pill="time"
        aria-busy={state.kind === 'saving' || undefined}
        className={`${FORM_PILL_CLASS} ${width} relative ${failed ? 'border-danger-700' : 'border-ink/15 focus-within:border-sn-accent'}`}
      >
        <span data-form-row-words="" className={`pointer-events-none min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${words ? '' : 'font-normal text-ink/45'}`}>
          {words || empty}
        </span>
        {clearable && shown ? (
          <ClearButton
            label={`Clear ${name}`}
            data-form-row-clear=""
            onClear={() => send('')}
            className="relative z-10 -mr-1 grid h-7 w-7 flex-none place-items-center rounded-full"
          />
        ) : state.kind === 'saved' ? (
          <Check aria-hidden data-form-row-mark="tick" className="pointer-events-none h-4 w-4 flex-none text-success-700" strokeWidth={2.6} />
        ) : (
          <Clock aria-hidden data-form-row-mark="clock" className={`pointer-events-none h-4 w-4 flex-none ${failed ? 'text-danger-700' : 'text-sn-accent'}`} strokeWidth={2} />
        )}
        {/* The real time box, over the pill and unseen: the press lands on it and opens the phone's own wheel. */}
        <input
          ref={box}
          id={id}
          type="time"
          step={300}
          aria-label={`${name}: ${words || 'not set yet'}. Tap to change`}
          data-form-row-time=""
          value={shown}
          onChange={(e) => setShown(e.target.value)}
          onBlur={(e) => send(e.target.value)}
          onClick={() => {
            try {
              box.current?.showPicker?.();
            } catch {
              /* a browser without showPicker opens its own way */
            }
          }}
          className={`absolute inset-0 h-full cursor-pointer opacity-0 ${clearable && shown ? 'w-[calc(100%-36px)]' : 'w-full'}`}
        />
      </span>
    </FormRow>
  );
}

/** "14:00" → "2:00 PM" ('' stays ''). */
export function clockWordsOf(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  if (!m) return '';
  const h = Number(m[1]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
