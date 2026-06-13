'use client';

import { useEffect, useState } from 'react';

import type { WeddingFolder } from '@/lib/taxonomy';

export type FolderTab = {
  folder: WeddingFolder;
  /** Short label rendered in the chip. */
  label: string;
  /** Lowercase slug used as the section anchor (e.g. `#ceremony`). */
  slug: string;
  /** Number of categories (or venue facets) under this folder. */
  count: number;
};

type Props = {
  tabs: ReadonlyArray<FolderTab>;
  /** Combined count across all folders — drives the "All" chip badge. */
  totalCount: number;
  /**
   * When the catalog is scoped to a single folder via `?folder=…` (per PR
   * #310 / Task #47 2026-05-22), the other 11 sections are NOT rendered
   * in the DOM. Hash-only navigation breaks because `#photo-video` etc.
   * point at elements that don't exist. When `scopedFolder` is set:
   *   1. tab clicks navigate via full URL (`/explore?folder=<slug>#<slug>`)
   *      preserving sibling URL params (?match=1, ?venue=0, ?demo=1, ?city=…)
   *   2. the active chip is fixed to the scoped folder (IntersectionObserver
   *      is skipped — only one section exists, the observer is moot)
   *   3. clicking "All" navigates to `/explore` (clears the scope) while
   *      preserving sibling params
   *
   * When `scopedFolder` is null (unscoped /vendors browse), behavior is
   * unchanged — hash nav scrolls within the single-page catalog and the
   * IntersectionObserver tracks active section on scroll.
   */
  scopedFolder?: WeddingFolder | null;
};

/**
 * Catalog-mode folder nav. Renders the 12 PH-grounded wedding folders as a
 * sticky horizontally-scrollable chip strip. Active state is driven by
 * IntersectionObserver against the section headings so the chip auto-
 * highlights as the user scrolls.
 *
 * Hash navigation in unscoped catalog mode — keeps the catalog SSR-friendly
 * and lets browsers handle scroll-restoration on back/forward. CSS
 * `scroll-behavior: smooth` on `<html>` gives the smooth-scroll animation.
 *
 * Full-URL navigation in scoped catalog mode (when `?folder=…` is set) —
 * required because sibling folder sections aren't in the DOM; hash nav
 * would silently fail. See `scopedFolder` prop docs above.
 */
export function FolderTabs({ tabs, totalCount, scopedFolder = null }: Props) {
  // Default the active chip to the scoped folder when in scoped mode;
  // otherwise start on 'all' and let IntersectionObserver take over.
  const initialActive = scopedFolder
    ? (tabs.find((t) => t.folder === scopedFolder)?.slug ?? 'all')
    : 'all';
  const [activeSlug, setActiveSlug] = useState<string>(initialActive);
  // Captured on mount in the browser so we can preserve sibling URL
  // params when navigating between folders in scoped mode. SSR returns
  // an empty string — first paint links omit sibling params, then the
  // useEffect rebuilds them client-side. Acceptable because hydration
  // happens before any click.
  const [siblingParams, setSiblingParams] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('folder'); // tab hrefs set folder per-tab
    const rest = params.toString();
    setSiblingParams(rest);
  }, []);

  useEffect(() => {
    // Scoped mode: only one section exists. Pin the active chip to the
    // scoped folder; skip IntersectionObserver entirely.
    if (scopedFolder !== null) {
      const slug =
        tabs.find((t) => t.folder === scopedFolder)?.slug ?? 'all';
      setActiveSlug(slug);
      return;
    }
    // Unscoped mode: track active section on scroll.
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
  }, [tabs, scopedFolder]);

  /**
   * Build the href for a tab. In unscoped mode this is hash-only
   * (`#<slug>`), preserving the original behavior. In scoped mode this is
   * a full URL with `?folder=<slug>` (or no `?folder=` for the All tab,
   * which clears the scope), preserving any sibling URL params present
   * on the current page so the user doesn't lose `?match=1`, `?venue=0`,
   * `?demo=1`, `?city=…`, etc. when switching folders.
   */
  const hrefFor = (slug: string): string => {
    if (scopedFolder === null) {
      return `#${slug}`;
    }
    const suffix = siblingParams ? `&${siblingParams}` : '';
    if (slug === 'all') {
      // Clear the scope. Keep sibling params (drop only ?folder).
      return siblingParams
        ? `/explore?${siblingParams}#all`
        : '/explore#all';
    }
    return `/explore?folder=${slug}${suffix}#${slug}`;
  };

  return (
    <nav
      aria-label="Wedding folders"
      className="sticky top-0 z-20 -mx-4 mt-6 overflow-x-auto border-b border-ink/10 bg-cream/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <ul className="flex min-w-max items-center gap-2 sm:gap-2.5">
        <li>
          <a
            href={hrefFor('all')}
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
                href={hrefFor(tab.slug)}
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
