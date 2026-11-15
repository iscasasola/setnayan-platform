'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { EventChoice } from './article-composer';

/**
 * The top of the topic list (prototype screen 1): Search topics… · Event ▾ ·
 * Newest ▾ (Newest · Most replies). Each choice is this page's own query string,
 * so a filtered list is a link that can be opened again.
 */
const PILL =
  'h-11 appearance-none rounded-full border border-ink/15 bg-ink/[0.03] pl-4 pr-8 text-sm font-medium text-ink focus:border-terracotta/50 focus:outline-none';

export function ArticlesFilters({
  q,
  eventType,
  sort,
  events,
}: {
  q: string;
  eventType: string;
  sort: 'newest' | 'replies';
  events: readonly EventChoice[];
}) {
  const router = useRouter();
  const go = (next: { q?: string; event?: string; sort?: string }) => {
    const p = new URLSearchParams();
    const nq = next.q ?? q;
    const ne = next.event ?? eventType;
    const ns = next.sort ?? sort;
    if (nq.trim()) p.set('q', nq.trim());
    if (ne) p.set('event', ne);
    if (ns !== 'newest') p.set('sort', ns);
    const s = p.toString();
    router.replace(s ? `/articles?${s}` : '/articles', { scroll: false });
  };
  return (
    <div className="space-y-2">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: String(new FormData(e.currentTarget).get('q') ?? '') });
        }}
        className="relative"
      >
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/60" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          enterKeyHint="search"
          placeholder="Search topics…"
          aria-label="Search topics"
          className="h-11 w-full rounded-full border border-ink/15 bg-ink/[0.03] pl-9 pr-4 text-[15px] text-ink placeholder:text-ink/55 focus:border-terracotta/50 focus:outline-none"
        />
      </form>
      <div className="flex gap-2">
        <span className="relative">
          <select aria-label="Event" value={eventType} onChange={(e) => go({ event: e.target.value })} className={PILL}>
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.key} value={ev.key}>
                {ev.label}
              </option>
            ))}
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/70">▾</span>
        </span>
        <span className="relative">
          <select aria-label="Sort" value={sort} onChange={(e) => go({ sort: e.target.value })} className={PILL}>
            <option value="newest">Newest</option>
            <option value="replies">Most replies</option>
          </select>
          <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/70">▾</span>
        </span>
      </div>
    </div>
  );
}
