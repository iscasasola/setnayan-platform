'use client';

import { useState, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { STUDIO_DONE_BUTTON } from '@/lib/studio-skin';

/**
 * ↪ OPEN ANOTHER EDITOR IN PLACE (owner rule, 2026-09-28: *no "Edit in X ↗"* — the same
 * field right there; studio round 3, 2026-10-08: *Prints "Set up E-Gifts" opens the
 * E-Gifts editor in place with "✓ Done · back to Prints"*).
 *
 * A button that opens the OTHER item's own editor (handed in as `children` — the very
 * node that item draws, never a copy) inside the row it was asked from, and one
 * ✓ Done that folds it back. Nothing is written by opening or closing it; the editor
 * inside saves exactly as it does at home.
 */
export function OpenInPlace({
  open: label,
  back,
  data,
  children,
}: {
  /** The button's word — "Set up E-Gifts". */
  open: string;
  /** Where ✓ Done returns — "Prints" → "✓ Done · back to Prints". */
  back: string;
  /** Names the opened editor for tests and the check card (`data-open-in-place="gifts"`). */
  data: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      /* BUTTON-RULE — icon + word, grey (it opens, nothing is committed). */
      <button
        type="button"
        data-open-in-place-door={data}
        onClick={() => setShown(true)}
        className="sn-press inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-ink ring-1 ring-inset ring-ink/15"
      >
        <Plus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
        {label}
      </button>
    );
  }
  return (
    <div data-open-in-place={data} className="flex flex-col gap-3 pt-1">
      {children}
      <div className="flex justify-end">
        <button type="button" data-open-in-place-done={data} onClick={() => setShown(false)} className={STUDIO_DONE_BUTTON}>
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.4} />
          Done · back to {back}
        </button>
      </div>
    </div>
  );
}
