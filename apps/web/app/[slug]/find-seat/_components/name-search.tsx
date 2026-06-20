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
              <MatchCard key={`${m.display_name}-${m.table_label}-${i}`} match={m} />
            ))}
          </ul>
        ) : touched && !loading ? (
          <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-center text-base text-ink/80">
            No match yet. Try your name as the couple would have listed it, or ask
            a host to check the seating signs at the venue.
          </p>
        ) : null
      ) : null}
    </div>
  );
}

/**
 * One search result — the guest's name + table label, plus (PR 6) an optional
 * "Watch the walk to your table" disclosure when the couple/coordinator has
 * published a first-person zone-walkthrough clip for this table's zone. The
 * video is lazy: the <video> mounts (and the bytes start loading) only after
 * the guest taps Watch. Pure inline-SVG glyph — no icon dep, so the public
 * build never breaks on an icon name.
 */
function MatchCard({ match }: { match: SeatMatch }) {
  const [open, setOpen] = useState(false);
  const video = match.walk_video_url ?? null;

  return (
    <li className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
      {/* The table label is the WHOLE point of the finder — render it as the
          largest, most unmistakable element on screen (Guest Legibility Floor:
          a job-to-be-done leads on legibility, not subtlety). */}
      <div className="px-4 py-5 text-center">
        <p className="text-base text-ink/80">{match.display_name}</p>
        <p className="mt-3 text-sm font-medium text-ink/60">Your table</p>
        <p className="mt-0.5 text-4xl font-bold leading-tight text-success-700">
          {match.table_label}
        </p>
      </div>

      {video ? (
        <div className="border-t border-ink/10 px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-md bg-terracotta/10 px-3 py-1.5 text-sm font-medium text-terracotta-700 transition-colors hover:bg-terracotta/15"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
            {open ? 'Hide the walk' : 'Watch the walk to your table'}
          </button>
          {match.walk_zone_label ? (
            <span className="ml-2 text-xs text-ink/50">{match.walk_zone_label}</span>
          ) : null}
          {open ? (
            <video
              controls
              playsInline
              preload="metadata"
              src={video}
              className="mt-3 aspect-[9/16] w-full max-w-xs rounded-lg border border-ink/10 bg-black object-contain"
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
