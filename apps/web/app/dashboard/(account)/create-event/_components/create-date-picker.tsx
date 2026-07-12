'use client';

import { useState } from 'react';

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
export function CreateDatePicker() {
  const [mode, setMode] = useState<'specific' | 'window'>('specific');
  const [count, setCount] = useState(1); // candidate rows, 1..4
  // Client-computed (this form only renders after a type is clicked, so there's
  // no SSR of this subtree → no hydration mismatch on `min`).
  const today = new Date().toISOString().slice(0, 10);

  const tab =
    'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40';

  return (
    <div className="space-y-3">
      <input type="hidden" name="date_mode" value={mode} />

      <div role="radiogroup" aria-label="How do you want to set the date?" className="flex gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'specific'}
          onClick={() => setMode('specific')}
          className={`${tab} ${mode === 'specific' ? 'bg-ink text-white' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
        >
          Specific date(s)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'window'}
          onClick={() => setMode('window')}
          className={`${tab} ${mode === 'window' ? 'bg-ink text-white' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'}`}
        >
          A range
        </button>
      </div>

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
    </div>
  );
}
