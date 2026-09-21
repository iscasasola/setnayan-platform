'use client';

/**
 * link-picker.tsx — "Same as" with a search box.
 *
 * ⚖ Owner 2026-09-21: *"this should only show accounts that are not yet
 * linked. there should be a search bar also."* The page hands in only guests
 * no account has claimed (`unlinkedCandidates`); this lets the couple find one
 * by typing instead of scrolling a 79-name dropdown. The pick lands in the same
 * `target_guest_id` field the Link form always posted, so the server path is
 * unchanged.
 */
import { useId, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { candidateName, searchCandidates, type LinkCandidate } from '@/lib/unlisted-guests';

export function LinkPicker({ candidates }: { candidates: LinkCandidate[] }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<LinkCandidate | null>(null);
  const listId = useId();
  const matches = useMemo(() => searchCandidates(candidates, q), [candidates, q]);

  if (picked) {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <input type="hidden" name="target_guest_id" value={picked.guest_id} />
        <span className="truncate rounded-lg border border-ink/15 bg-cream px-3 py-1.5 text-sm font-medium text-ink">
          {candidateName(picked)}
        </span>
        <button
          type="button"
          onClick={() => setPicked(null)}
          aria-label="Choose someone else"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink/45 hover:bg-ink/5 hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="relative block min-w-0 flex-1">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your list…"
        aria-label="Search your list for the same person"
        aria-controls={listId}
        className="input-field h-9 w-full py-1 pr-9 text-sm"
      />
      <Search aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
      {/* Required, so Link cannot post with nobody picked. */}
      <input type="text" name="target_guest_id" required value="" onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden />
      {q.trim() ? (
        <ul id={listId} className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-ink/10 bg-white p-1 shadow-sm">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink/50">Nobody by that name who is not already linked.</li>
          ) : (
            matches.map((c) => (
              <li key={c.guest_id}>
                <button
                  type="button"
                  onClick={() => setPicked(c)}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
                >
                  {candidateName(c)}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </span>
  );
}
