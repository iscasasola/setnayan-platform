'use client';

import { useState } from 'react';

import { PillButton, PillTrack } from '@/app/_components/pill-track';
import { EVENT_DATE_FLOOR_MESSAGE, eventDateMinFor, isBeforeFirstEventDay } from '@/lib/event-date-floor';

/**
 * Timing picker for the non-wedding inline create form — the platform's model,
 * NOT a single locked date (owner 2026-07-12: "we used to give them up to 4
 * dates or a range"):
 *   - Specific: up to 4 candidate dates  → name="date_candidate" (repeated)
 *   - A range:  from..to                 → name="date_window_start" / "..._end"
 * plus a hidden name="date_mode". The server action (createWeddingEvent →
 * resolveCreateCapture) reads these; events.event_date stays NULL — the locked
 * single date is chosen later (date-as-output). All optional.
 */
export function CreateDatePicker({ dateExempt = false }: { dateExempt?: boolean } = {}) {
  const [mode, setMode] = useState<'specific' | 'window'>('specific');
  const [count, setCount] = useState(1); // candidate rows, 1..4
  // Client-computed (this form only renders after a type is clicked, so there's
  // no SSR of this subtree → no hydration mismatch on `min`).
  // 💍 No event before December 19, 2026 (owner 2026-11-01, lib/event-date-floor.ts): the
  // picker starts there for a normal account, and a day typed before it is answered HERE,
  // beside the date (iPhone Safari lets a typed day past `min`). The server refuses it too.
  const today = eventDateMinFor(new Date().toISOString().slice(0, 10), dateExempt);
  const [tooEarly, setTooEarly] = useState(false);
  const onDate = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.target as HTMLInputElement;
    if (el.type !== 'date') return;
    const inputs = Array.from(e.currentTarget.querySelectorAll<HTMLInputElement>('input[type="date"]'));
    setTooEarly(!dateExempt && inputs.some((i) => isBeforeFirstEventDay(i.value)));
  };

  const tab = 'px-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40';

  return (
    <div className="space-y-3" onChange={onDate} data-create-date-picker="">
      <input type="hidden" name="date_mode" value={mode} />

      {/* The app's ONE pill selector (owner 2026-10-08). Still a radio group. */}
      <PillTrack role="radiogroup" aria-label="How do you want to set the date?">
        <PillButton on={mode === 'specific'} role="radio" aria-checked={mode === 'specific'} onClick={() => setMode('specific')} className={tab}>
          Specific date(s)
        </PillButton>
        <PillButton on={mode === 'window'} role="radio" aria-checked={mode === 'window'} onClick={() => setMode('window')} className={tab}>
          A range
        </PillButton>
      </PillTrack>

      {mode === 'specific' ? (
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <input
              // Index key is fine — the list only grows and rows aren't reordered.
              key={i}
              aria-label={i === 0 ? 'Date' : `Option ${i + 1}`}
              className="input-field"
              min={today}
              name="date_candidate"
              type="date"
            />
          ))}
          {count < 4 ? (
            <button
              type="button"
              onClick={() => setCount((c) => Math.min(4, c + 1))}
              className="text-sm font-medium text-terracotta hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
            >
              + Add another option
            </button>
          ) : (
            <p className="text-xs text-ink/40">Up to 4 options.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink/60" htmlFor="date_window_start">
              From
            </label>
            <input
              className="input-field"
              id="date_window_start"
              min={today}
              name="date_window_start"
              type="date"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-ink/60" htmlFor="date_window_end">
              To
            </label>
            <input
              className="input-field"
              id="date_window_end"
              min={today}
              name="date_window_end"
              type="date"
            />
          </div>
        </div>
      )}
      {tooEarly ? (
        <p role="alert" data-event-date-floor="" className="text-xs text-danger-700">
          {EVENT_DATE_FLOOR_MESSAGE}
        </p>
      ) : null}
    </div>
  );
}
