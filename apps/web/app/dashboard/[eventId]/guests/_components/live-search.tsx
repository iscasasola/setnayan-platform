'use client';

// Live-search input · client island.
//
// Owner directive 2026-05-23: typing into the guests search input
// should filter live (no Enter / no Apply). Clearing the field should
// reset the filter immediately. Prior behavior was a form-submit
// pattern that required Enter for both apply + clear.
//
// Approach:
// - Self-managed value via React state (controlled input).
// - 250ms debounce on URL updates via `router.replace()` so we don't
//   thrash history on every keystroke + we don't fire a server
//   round-trip on every character. Cleared input fires immediately
//   (no debounce) so the reset feels snappy.
// - `useTransition` so the navigation doesn't block input updates —
//   the host keeps typing while the previous query's filter renders.
// - URL is the source of truth: `initialValue` (from server-side
//   `?q=`) seeds the state on mount; subsequent edits write back to
//   the URL.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const DEBOUNCE_MS = 250;

export function LiveSearch({
  initialValue,
  placeholder,
}: {
  initialValue: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when the URL changes via something OTHER than this
  // input (e.g., the host clicks a sidebar filter that strips ?q from
  // the URL). Without this, the input would show a stale query after
  // an external param change.
  useEffect(() => {
    setValue(initialValue);
    // initialValue is derived from URL params upstream so this effect
    // re-runs on any URL change that affects q.
  }, [initialValue]);

  const pushNextUrl = useCallback(
    (next: string) => {
      // Read latest searchParams INSIDE the callback so concurrent URL
      // changes (e.g., a sidebar VIEW click happened mid-debounce) don't
      // clobber other filters.
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!next.trim()) {
          // Clear-to-empty fires immediately so the reset feels snappy
          // — no waiting for the debounce window to expire.
          pushNextUrl('');
          return;
        }
        timerRef.current = setTimeout(() => pushNextUrl(next), DEBOUNCE_MS);
      }}
      placeholder={placeholder}
      aria-label="Search guests"
      className="input-field flex-1"
    />
  );
}
