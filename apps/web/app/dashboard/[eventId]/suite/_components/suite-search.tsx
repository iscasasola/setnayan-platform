'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/** The "no tag picked" option of the filter menu. */
const ALL_TAGS = '__all__';

/**
 * SuiteSearch — the Suite's find-a-service box. A client shell around the
 * server-rendered browse view: when the query is empty it shows `children`
 * (the normal Recommended / Yours / Add / Free sections); when the couple types
 * (or taps a tag chip) it hides them and shows a flat, deduped list of matching
 * service rows instead. Each `item.node` is a server-rendered StudioAppRow — so
 * live prices, ownership pills, and tags come through unchanged; this component
 * only decides which ones to show. Matching is case-insensitive AND across
 * space-separated terms over label + blurb + tags (`item.text`).
 */

export type SuiteSearchItem = {
  key: string;
  /** Lowercased haystack: label + blurb + tags. */
  text: string;
  tags: readonly string[];
  /** The server-rendered row (StudioAppRow <li>), key already set. */
  node: ReactNode;
};

export function SuiteSearch({
  items,
  children,
}: {
  items: readonly SuiteSearchItem[];
  children: ReactNode;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  // The most common tags across the browsable services → quick-filter chips.
  const filterTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) for (const t of it.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([t]) => t);
  }, [items]);

  const results = useMemo(() => {
    if (!query) return null;
    const terms = query.split(/\s+/).filter(Boolean);
    const seen = new Set<string>();
    const out: SuiteSearchItem[] = [];
    for (const it of items) {
      if (seen.has(it.key)) continue; // a service can sit in several browse sections
      if (terms.every((t) => it.text.includes(t))) {
        seen.add(it.key);
        out.push(it);
      }
    }
    return out;
  }, [query, items]);

  return (
    <div className="space-y-6">
      <div className="sn-reveal space-y-2.5">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
            strokeWidth={2}
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search — try “photos”, “video”, “free”…"
            aria-label="Search more services"
            className="w-full rounded-full border border-ink/12 bg-cream/70 py-2.5 pl-10 pr-10 text-sm text-ink shadow-sm placeholder:text-ink/40 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
          {q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink/40 hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {/* ONE dropdown, never a pill row (owner rule 2026-09-28: any set of
            choices is one dropdown). Picking a tag runs the same search the
            pills did; "All services" clears it. */}
        {filterTags.length > 0 ? (
          <PickMenu
            label="Show"
            dataAttr="data-suite-tag-menu"
            value={filterTags.find((t) => t.toLowerCase() === query) ?? (query ? null : ALL_TAGS)}
            options={[
              { key: ALL_TAGS, label: 'All services' },
              ...filterTags.map((t) => ({ key: t, label: t })),
            ]}
            onPick={(key) => setQ(key === ALL_TAGS ? '' : key)}
          />
        ) : null}
      </div>

      {results === null ? (
        children
      ) : results.length > 0 ? (
        <section aria-label="Search results" className="space-y-3">
          <p className="sn-eye">
            {results.length} {results.length === 1 ? 'service' : 'services'}
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {results.map((r) => r.node)}
          </ul>
        </section>
      ) : (
        <div className="sn-tile p-6 text-center text-sm text-ink/55">
          No services match <span className="font-medium text-ink">“{q}”</span>. Try a
          different word, or a tag above.
        </div>
      )}
    </div>
  );
}
