'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { keepByTokens } from '@/lib/admin-map/rank-by-sentence';

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

    /**
     * A SENTENCE, not just a substring.
     *
     * 🪤 THIS WAS THE 2026 BUG REPEATING. The test was `hay.includes(query)` —
     * the whole typed string, in order — so "papic prices" and every sentence
     * hid EVERY card and showed the empty note, on the one device the owner
     * actually reports from. Its laptop twin had the identical bug.
     *
     * The rule itself lives in `keepByTokens` rather than here, so the parity
     * guard can run the laptop's ranking and this filter over the SAME input and
     * compare the sets. A rule written inline in an effect is a rule no test can
     * reach — which is exactly how the laptop and the phone drifted apart twice.
     */
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-more-card]'));
    const hays = cards.map((c) => (c.dataset.moreHay ?? c.dataset.moreLabel ?? '').toLowerCase());
    const keep = keepByTokens(hays, query);

    let anyVisible = false;
    cards.forEach((card, i) => {
      // The haystack falls back to the label so a card from a grid that has not
      // adopted `data-more-hay` still filters exactly as it did before, rather
      // than silently matching nothing.
      const match = query === '' || keep[i] === true;
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
