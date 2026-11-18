'use client';

import Link from 'next/link';

import { chipClass } from '@/app/_components/chips';

/**
 * The People filters as soft chips (owner-approved 2026-11-14, `admin_accounts_insights_2026-11-14_fable.html` ›
 * "After · 390"): Everyone · Couples · Suppliers · Internal · On hold · Blocked — the SAME `?filter=` values the old
 * dropdown posted, so every address that worked still works. A chip is a link: picking one keeps the search.
 */
const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'customer', label: 'Couples' },
  { key: 'vendor', label: 'Suppliers' },
  { key: 'internal', label: 'Internal' },
  { key: 'suspended', label: 'On hold' },
  { key: 'blacklisted', label: 'Blocked' },
] as const;

export function PeopleFilterChips({ filter, q }: { filter: string; q: string }) {
  return (
    <nav aria-label="Show" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
      {FILTERS.map((f) => {
        const params = new URLSearchParams({ tab: 'users' });
        if (f.key !== 'all') params.set('filter', f.key);
        if (q) params.set('q', q);
        const on = f.key === filter;
        return (
          <Link
            key={f.key}
            href={`/admin/accounts?${params.toString()}`}
            aria-current={on ? 'page' : undefined}
            className={`${chipClass(on)} min-h-11`}
            scroll={false}
          >
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}
