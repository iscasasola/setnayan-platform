'use client';

import { useEffect, useRef, useState } from 'react';
import { Counter } from '@/app/_components/counter';

/**
 * FORM COUNTER — the one Counter (kind 17, `counter.tsx`) inside a plain form: it keeps the number, posts it as a
 * hidden field, and can SAVE ITSELF a pause after the last tap (the press family's "saves on close" — no Save button
 * beside a counter; each tap restarts the wait, so 1 → 3 is one save).
 *
 * 🔗 BATCH 5 JOIN (2026-10-14). The supplier's Dates (S-PR3, #6514) and the Maker's seat plan (#6520, on main) each
 * drew a kind-17 Counter at the same path. The seat plan's is the approved drawing (`lib/the-counter-is-one-drawing.test.ts`)
 * and a counter "never keeps a value of its own" — so this wrapper holds the form's number and draws THAT Counter;
 * there is one pill in the app, not two.
 */
export function FormCounter({
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
  useEffect(
    () => () => {
      if (wait.current) clearTimeout(wait.current);
    },
    [],
  );
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
  return (
    <>
      <input ref={field} type="hidden" name={name} value={n} />
      <Counter
        value={n}
        label={label}
        data={data}
        onLess={() => step(-1)}
        onMore={() => step(1)}
        lessDisabled={n <= min}
        moreDisabled={n >= max}
      />
    </>
  );
}
