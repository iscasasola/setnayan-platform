'use client';

/**
 * guests-search.tsx — the SINGLE, always-visible guest search on desktop
 * (Living Roster search consolidation · owner sign-off 2026-07-13).
 *
 * Before this, search rendered TWICE on desktop: once behind the CaptureBar's
 * [Add | Find] toggle and once in the Toolbar — two instances of the same
 * `live-search.tsx` component. That toggle is now retired and the Toolbar is
 * gone; search lives here, at the head of the SummaryFacetBar query row, so a
 * host who lands on the page (CaptureBar defaults to Add) still SEES a search
 * box without toggling anything.
 *
 * This wraps `live-search.tsx` VERBATIM (its debounced ?q= writer / clear-on-
 * empty is the search contract) inside a `role="search"` landmark + a visible
 * ⌘K hint, and hosts the ⌘K/Ctrl-K global shortcut (moved out of the retired
 * CaptureBar Find mode) that focuses the field.
 */

import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { LiveSearch } from './live-search';

export function GuestsSearch({ initialValue }: { initialValue: string }) {
  // LiveSearch owns its own <input>, so reach it through the landmark wrapper
  // rather than an id we don't control (same pattern the old CaptureBar used).
  const rootRef = useRef<HTMLDivElement>(null);

  const focusInput = () =>
    requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
    );

  // ⌘K / Ctrl-K focuses the always-visible search (works in any state now —
  // there is no mode to switch into first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusInput();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={rootRef}
      role="search"
      aria-label="Search guests"
      className="flex w-full items-center gap-2 sm:flex-1"
    >
      <Search className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} aria-hidden />
      <LiveSearch
        initialValue={initialValue}
        placeholder="Search names, roles, groups, RSVP…"
      />
      <span className="hidden shrink-0 rounded-md border border-ink/10 px-1.5 py-0.5 font-mono text-[11px] text-ink/45 sm:inline">
        ⌘K
      </span>
    </div>
  );
}
