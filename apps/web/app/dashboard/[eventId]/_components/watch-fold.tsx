'use client';

/**
 * 👁 THE WATCH, DRAWN ONCE (tablet/desktop lane 4, owner-approved D4 "Redo event-day/after Home", 2026-11-13).
 *
 * The Watch used to be drawn TWICE — a phone `<details className="lg:hidden">` and a laptop
 * `<div className="hidden lg:block">` carrying the same rows — because forcing one `<details>` open with CSS leaves a
 * summary that is focusable and does nothing (a dead control). This is the one element instead: a real disclosure at
 * every width.
 *
 *   · below 701 (the phone) it is exactly the phone's fold: shut unless a row is a `guard`;
 *   · from 701 (the couple dashboard's `tab:` line) it OPENS on arrival, because the screen has the room — and its
 *     summary still folds it, so it is never a dead control.
 *
 * Only the first state is the server's; the wide open happens after hydration, so a phone never paints open-then-shut.
 */
import { useEffect, useRef, type ReactNode } from 'react';

/** The couple dashboard's `tab:` line (tailwind `screens.tab`). */
export const WATCH_WIDE_QUERY = '(min-width: 701px)';

export function WatchFold({ guard, summary, children }: { guard: boolean; summary: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open && window.matchMedia(WATCH_WIDE_QUERY).matches) el.open = true;
  }, []);
  return (
    <details ref={ref} open={guard} data-watch-fold="">
      <summary className="sn-eye cursor-pointer list-none [&::-webkit-details-marker]:hidden">{summary}</summary>
      {children}
    </details>
  );
}
