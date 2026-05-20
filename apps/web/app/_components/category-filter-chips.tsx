'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  serviceGroupOf,
  type ServiceGroupKey,
  type VendorCategory,
} from '@/lib/vendors';

/**
 * Marketplace category filter rendered as **6 phase chips → sub-category pills**.
 *
 * The native `<select>` + `<optgroup>` we had before is structurally grouped
 * but visually flat — native browsers paint optgroup labels as faint italic
 * headers that most couples miss. This swaps that for an obviously-grouped
 * chip UI:
 *
 *   [ All ] [ Reception ] [ Ceremony ] [ Couple & attire ] [ Media ] [ Logistics ] [ Other ]
 *               ↓ expanded
 *   [ Venue ] [ Catering ] [ Cake maker ] [ Mobile bar ] [ Reception decor ]
 *
 * URL state is unchanged — selecting a sub-category still sets `?category=<key>`,
 * so the existing server-side filter in vendors/page.tsx works untouched.
 *
 * Behaviour:
 * - Phase chips are toggles for the sub-category row (client-side only).
 * - When a category IS already in the URL, the parent phase chip starts
 *   expanded so the user can see and change their selection.
 * - "All" chip clears the category filter via a Link to the URL without it.
 * - Sub-category pills are Links, not buttons — full SSR navigation,
 *   no client-side fetch, no hydration mismatch risk.
 */
export type CategoryFilterChipsContext = {
  q: string;
  city: string;
  sort: string;
  verifiedOnly?: boolean;
  matchEvent?: boolean;
};

type Props = {
  currentCategory: VendorCategory | null;
  context: CategoryFilterChipsContext;
};

function buildHref(category: VendorCategory | null, context: CategoryFilterChipsContext): string {
  const params = new URLSearchParams();
  if (context.q) params.set('q', context.q);
  if (context.city) params.set('city', context.city);
  if (context.sort && context.sort !== 'most_reviews') params.set('sort', context.sort);
  if (category) params.set('category', category);
  if (context.verifiedOnly) params.set('verified', '1');
  if (context.matchEvent) params.set('match', '1');
  const qs = params.toString();
  return qs ? `/vendors?${qs}` : '/vendors';
}

export function CategoryFilterChips({ currentCategory, context }: Props) {
  const startExpanded: ServiceGroupKey | null = currentCategory
    ? serviceGroupOf(currentCategory)
    : null;
  const [expanded, setExpanded] = useState<ServiceGroupKey | null>(startExpanded);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* "All" chip — clears the category filter. */}
        <Link
          href={buildHref(null, context)}
          aria-pressed={currentCategory === null}
          className={
            currentCategory === null
              ? 'inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream'
              : 'inline-flex items-center rounded-full border border-ink/20 bg-cream px-4 py-1.5 text-sm text-ink/70 hover:bg-ink/5'
          }
        >
          All
        </Link>
        {SERVICE_GROUPS.map((g) => {
          const isExpanded = expanded === g.key;
          const isActive = currentCategory !== null && serviceGroupOf(currentCategory) === g.key;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setExpanded(isExpanded ? null : g.key)}
              aria-expanded={isExpanded}
              aria-pressed={isActive}
              className={
                (isActive
                  ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                  : isExpanded
                    ? 'border-ink/30 bg-ink/5 text-ink'
                    : 'border-ink/20 bg-cream text-ink/70 hover:bg-ink/5') +
                ' inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition'
              }
            >
              {g.label}
              <ChevronDown
                aria-hidden
                className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>

      {/* Sub-category pill row — only shown for the currently-expanded phase. */}
      {expanded ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-ink/10 bg-cream/60 p-3">
          {SERVICE_GROUPS.find((g) => g.key === expanded)?.members.map((cat) => {
            const isActive = currentCategory === cat;
            return (
              <Link
                key={cat}
                href={buildHref(isActive ? null : cat, context)}
                aria-pressed={isActive}
                className={
                  isActive
                    ? 'inline-flex items-center rounded-full bg-terracotta px-3 py-1 text-xs font-medium text-cream'
                    : 'inline-flex items-center rounded-full bg-ink/[0.04] px-3 py-1 text-xs text-ink/75 hover:bg-ink/10'
                }
              >
                {VENDOR_CATEGORY_LABEL[cat]}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
