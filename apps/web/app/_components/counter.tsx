'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * COUNTER — a small number, one step at a time (`INTERACTION_RULES.md` § 9, kind 17; approved gallery
 * `prototypes/control_templates_2026-10-08.html` § 17 "Counter and slider": *"Counter for a small number … the
 * counter's number ticks; the minus goes grey at the lowest it can be."*).
 *
 *   · a white pill, 44 px tall: − · the number · + — each sign a 44-px round target in the app's accent (the small
 *     mark that says "you can tap this"); a sign that cannot go further greys and cannot be pressed;
 *   · the number is the form's value (a hidden field named `name`), so a plain form posts it;
 *   · `saveAfterMs` — it SAVES ITSELF: a pause after the last tap submits the form it sits in (the same press
 *     family's "saves on close" — no Save button beside a counter). Each tap restarts the wait, so 1 → 3 is one save.
 *
 * Neutral: it knows no screen. No colour is written here for the accent.
 */
export function Counter({
  name,
  value,
  min = 0,
  max = 99,
  label,
  saveAfterMs,
  data,
}: {
  /** The form field it posts. */
  name: string;
  value: number;
  min?: number;
  max?: number;
  /** What it counts — "Events a day" (its group's name for a screen reader). */
  label: string;
  /** Submit the form it sits in this long after the last tap. Left out, it never submits by itself. */
  saveAfterMs?: number;
  /** `data-counter="<data>"`. */
  data?: string;
}) {
  const [n, setN] = useState(() => Math.min(max, Math.max(min, value)));
  const field = useRef<HTMLInputElement>(null);
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* A new figure from the server (after a save) is the one shown. */
  useEffect(() => setN(Math.min(max, Math.max(min, value))), [value, min, max]);
  useEffect(() => () => {
    if (wait.current) clearTimeout(wait.current);
  }, []);
  const step = (by: number) => {
    const next = Math.min(max, Math.max(min, n + by));
    if (next === n) return;
    setN(next);
    if (saveAfterMs === undefined) return;
    if (wait.current) clearTimeout(wait.current);
    wait.current = setTimeout(() => {
      if (field.current) field.current.value = String(next);
      field.current?.form?.requestSubmit();
    }, saveAfterMs);
  };
  const sign = 'sn-press flex h-11 min-h-11 w-11 flex-none items-center justify-center rounded-full p-0 text-sn-accent disabled:text-ink/25';
  return (
    <span role="group" aria-label={label} data-counter={data ?? ''} className="inline-flex h-11 flex-none items-center rounded-full border border-ink/15 bg-white">
      <input ref={field} type="hidden" name={name} value={n} />
      <button type="button" aria-label="One less" disabled={n <= min} onClick={() => step(-1)} className={sign}>
        <Minus aria-hidden className="h-5 w-5" strokeWidth={2} />
      </button>
      <b aria-live="polite" className="min-w-[2.25rem] text-center text-[16px] font-semibold tabular-nums text-ink" data-counter-value="">
        {n}
      </b>
      <button type="button" aria-label="One more" disabled={n >= max} onClick={() => step(1)} className={sign}>
        <Plus aria-hidden className="h-5 w-5" strokeWidth={2} />
      </button>
    </span>
  );
}
