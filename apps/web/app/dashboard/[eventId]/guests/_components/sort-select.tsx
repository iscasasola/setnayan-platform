'use client';

/**
 * sort-select.tsx — INSTANT guest sort (Living Roster search consolidation ·
 * owner sign-off 2026-07-13).
 *
 * Replaces the Toolbar's native <form method="get"> + Apply submit button,
 * which did a FULL PAGE RELOAD and carried the other filters via 7 hidden
 * inputs. Sort was the ONLY non-instant control on a surface where the filter
 * pills and search already filter live. This mirrors `live-search.tsx`: on
 * change it merge-writes ?sort= via `router.replace`, reading the latest
 * searchParams INSIDE the handler so a concurrent filter click mid-interaction
 * is never clobbered. ?sort=group still drives server-side group bucketing
 * (page.tsx buildGroupSortKey) — the value still lands in the URL.
 */

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SortSelect({
  value,
  options,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <select
      value={value}
      onChange={(e) => {
        // Read latest params inside the handler (same contract as LiveSearch's
        // pushNextUrl) so a filter click that landed mid-interaction survives.
        const params = new URLSearchParams(searchParams.toString());
        params.set('sort', e.target.value);
        const qs = params.toString();
        startTransition(() => {
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        });
      }}
      aria-label="Sort guests"
      className="input-field appearance-none bg-cream pr-8 sm:w-56"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          Sort: {o.label}
        </option>
      ))}
    </select>
  );
}
