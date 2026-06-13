'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sanitizeSeatLookupQuery, type SeatMatch } from '@/lib/seat-lookup';
import { useDayOfLiveTick } from '@/lib/use-day-of-live-refresh';

// Client search box for the FREE seat finder (seat-finding PR 1). Debounced
// calls to /api/seat-lookup/[slug]; the same sanitize (min length 2) runs
// client-side so we never fire a request the RPC would just reject. Pure-CSS
// chrome (no icon deps) so it can't break the public build on an icon name.
//
// Day-of live propagation (PR 5): when `eventDate` is the wedding day, the last
// successful lookup re-fires silently on a quiet cadence + tab-focus, so a guest
// who looked up their seat once sees a live reseat without re-typing. Pull-only,
// no notification — see useDayOfLiveTick.

export function NameSearch({
  slug,
  eventDate,
}: {
  slug: string;
  eventDate?: string | null;
}) {
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<SeatMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Last query we actually sent — what the day-of tick re-fires.
  const lastQueryRef = useRef<string | null>(null);

  const runSearch = useCallback(
    async (clean: string, { quiet = false }: { quiet?: boolean } = {}) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (!quiet) setLoading(true);
      try {
        const res = await fetch(
          `/api/seat-lookup/${encodeURIComponent(slug)}?q=${encodeURIComponent(clean)}`,
          { signal: ctrl.signal },
        );
        const json = (await res.json()) as { matches?: SeatMatch[] };
        setMatches(json.matches ?? []);
      } catch (err) {
        // A quiet day-of refresh that fails leaves the existing result alone.
        if ((err as Error).name !== 'AbortError' && !quiet) setMatches([]);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    const clean = sanitizeSeatLookupQuery(q);
    if (!clean) {
      abortRef.current?.abort();
      lastQueryRef.current = null;
      setMatches(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      lastQueryRef.current = clean;
      void runSearch(clean);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, runSearch]);

  // Day-of: silently re-run the last lookup so the shown table stays current.
  useDayOfLiveTick(eventDate, () => {
    const clean = lastQueryRef.current;
    if (clean) void runSearch(clean, { quiet: true });
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setTouched(true);
          }}
          placeholder="Your name"
          aria-label="Your name"
          className="w-full rounded-xl border border-ink/15 bg-white py-3 pl-4 pr-10 text-base text-ink shadow-sm outline-none placeholder:text-ink/35 focus:border-terracotta focus:ring-2 focus:ring-terracotta/20"
        />
        {loading ? (
          <span
            aria-hidden
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ink/20 border-t-terracotta"
          />
        ) : null}
      </div>

      {matches !== null ? (
        matches.length > 0 ? (
          <ul className="space-y-2" aria-live="polite">
            {matches.map((m, i) => (
              <li
                key={`${m.display_name}-${m.table_label}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-4 py-3 shadow-sm"
              >
                <span className="text-sm text-ink/80">{m.display_name}</span>
                <span className="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
                  {m.table_label}
                </span>
              </li>
            ))}
          </ul>
        ) : touched && !loading ? (
          <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-center text-sm text-ink/55">
            No match yet. Try your name as the couple would have listed it, or ask
            a host to check the seating signs at the venue.
          </p>
        ) : null
      ) : null}
    </div>
  );
}
