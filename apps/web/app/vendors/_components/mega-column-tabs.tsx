'use client';

import { useEffect, useState } from 'react';

import type { MegaMenuColumn } from '@/lib/taxonomy';

export type MegaColumnTab = {
  column: MegaMenuColumn;
  /** Short label rendered in the chip. */
  label: string;
  /** Lowercase slug used as the section anchor (e.g. `#capture`). */
  slug: string;
  /** Number of categories under this column (rendered as the chip count). */
  count: number;
};

type Props = {
  tabs: ReadonlyArray<MegaColumnTab>;
  /** Combined count across all columns — drives the "All" chip badge. */
  totalCount: number;
};

/**
 * Catalog-mode column nav. Replaces the legacy 6-group `CategoryFilterChips`
 * which was tied to the 28-enum `VendorCategory` taxonomy. The new chips
 * mirror the 5 mega-columns from `TAXONOMY_MAP` and scroll-anchor to
 * `#<slug>` sections rendered by the vendors page.
 *
 * Active state is driven by IntersectionObserver against the section headings
 * so the chip auto-highlights as the user scrolls. Clicking a chip uses the
 * browser's native hash navigation (smooth-scroll comes from the CSS
 * `scroll-behavior: smooth` on `<html>`). No router state — we want this to
 * survive view-transition and keep the catalog SSR-friendly.
 */
export function MegaColumnTabs({ tabs, totalCount }: Props) {
  const [activeSlug, setActiveSlug] = useState<string>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targets = tabs
      .map((t) => document.getElementById(t.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Choose the topmost section that's currently in the viewport.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (top) {
          setActiveSlug(top.target.id);
        }
      },
      {
        // Bias toward the top third of the viewport so the chip updates
        // when a heading crosses the upper edge, not when it enters bottom.
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav
      aria-label="Vendor category columns"
      className="sticky top-0 z-20 -mx-4 mt-6 overflow-x-auto border-b border-ink/10 bg-cream/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <ul className="flex min-w-max items-center gap-2 sm:gap-2.5">
        <li>
          <a
            href="#all"
            aria-current={activeSlug === 'all' ? 'true' : undefined}
            className={
              activeSlug === 'all'
                ? 'inline-flex items-center gap-2 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-cream'
                : 'inline-flex items-center gap-2 rounded-full border border-ink/20 bg-cream px-4 py-1.5 text-sm text-ink/70 hover:bg-ink/5'
            }
          >
            All
            <span className="font-mono text-[10px] opacity-70">{totalCount}</span>
          </a>
        </li>
        {tabs.map((tab) => {
          const active = activeSlug === tab.slug;
          return (
            <li key={tab.slug}>
              <a
                href={`#${tab.slug}`}
                aria-current={active ? 'true' : undefined}
                className={
                  active
                    ? 'inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-1.5 text-sm font-medium text-cream'
                    : 'inline-flex items-center gap-2 rounded-full border border-ink/20 bg-cream px-4 py-1.5 text-sm text-ink/70 hover:bg-ink/5'
                }
              >
                {tab.label}
                <span className="font-mono text-[10px] opacity-70">{tab.count}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
