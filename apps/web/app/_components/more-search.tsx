'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

/**
 * MoreSearch — a client filter for the "More" overflow landings (vendor + admin).
 *
 * The landing renderers are SERVER components (their icons are Lucide refs that
 * can't cross the Server→Client boundary), so rather than re-render the cards on
 * the client we filter the already-rendered DOM: the renderer tags its root with
 * `data-more-root`, each card `<li>` with `data-more-card data-more-label="…"`,
 * each section with `data-more-section`, and a `data-more-empty` no-results note.
 * This component just toggles `hidden` on those nodes as you type — no card
 * markup, no icon-ref plumbing. Scoped via `closest('[data-more-root]')` so it
 * only ever touches its own landing's nodes.
 */
export function MoreSearch({ placeholder = 'Search' }: { placeholder?: string }) {
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current?.closest('[data-more-root]');
    if (!root) return;
    const query = q.trim().toLowerCase();
    let anyVisible = false;
    root.querySelectorAll<HTMLElement>('[data-more-card]').forEach((card) => {
      const label = (card.dataset.moreLabel ?? '').toLowerCase();
      const match = query === '' || label.includes(query);
      card.hidden = !match;
      if (match) anyVisible = true;
    });
    root.querySelectorAll<HTMLElement>('[data-more-section]').forEach((section) => {
      section.hidden = section.querySelectorAll('[data-more-card]:not([hidden])').length === 0;
    });
    const empty = root.querySelector<HTMLElement>('[data-more-empty]');
    if (empty) empty.hidden = anyVisible || query === '';
  }, [q]);

  return (
    <div ref={ref} className="relative mb-5">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
        strokeWidth={1.75}
        style={{ color: 'var(--m-slate-2)' }}
      />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-full border bg-[var(--m-paper)] py-3 pl-10 pr-4 text-base outline-none focus:border-[var(--m-mulberry)]"
        style={{ borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
      />
    </div>
  );
}
