'use client';

/**
 * StickyMarketplaceHeader — Airbnb-style sticky search bar that replaces the
 * old marketplace chrome (giant italic-serif "Browse Filipino wedding vendors."
 * headline + long descriptive paragraph + formal "SEARCH ANY OF 192
 * CATEGORIES" labeled form + separate City input + plain-text Match-my-wedding
 * checkbox + large standalone Apply filters button).
 *
 * WHY: Owner directive 2026-05-30 (CLAUDE.md decision log row "Marketplace ·
 * Airbnb vibe with uniform sizing") — *"marketplace is doesnt feel user
 * friendly. we want it to be easy to navigate and direct. the buttons being
 * different sizes is also not appealing... vibe of shopee/zalora/airbnb"* +
 * *"make sure it still follow the theme and understand how the overall look
 * of the app works and keep it that way"*.
 *
 * 2026-05-30 contextual pill addendum — owner directive *"maybe we can have
 * a filtering to create the subcategory. main category is okay. same row as
 * the search?"* + *"fix it now. and only show categories with vendors."* The
 * header now optionally hosts a per-folder contextual narrow inline with
 * search. Today the only wired axis is Ceremony.Faith
 * (Catholic / Christian / INC / Muslim / Cultural); the prop shape supports
 * future folder-specific axes (Reception.Style, Photo.Editing, etc.) without
 * rewriting the header. The pill row stacks below the search+filters row so
 * the search affordance stays at the top of the viewport. Page-level builds
 * the href list (so we don't duplicate buildHref logic in a client comp);
 * header just renders.
 *
 * AIRBNB PATTERN: single rounded pill-shaped search row at the top with the
 * search input + filter trigger button + applied-count badge. The pill stays
 * pinned to the viewport top so the search affordance never scrolls away.
 * Long marketing copy retired — couples landing on /vendors want to filter
 * fast, not read a paragraph.
 *
 * THEME PRESERVED: Facebook palette via legacy `bg-cream` / `text-ink` /
 * `text-terracotta` / `border-ink/N` classes per the 2026-05-22 brand pivot
 * (globals.css:7-46). Matches the app shell visual language used across
 * dashboard / admin / vendor-dashboard. In light mode terracotta = Facebook
 * blue #1877F2. In dark mode terracotta = brighter blue #2D88FF.
 *
 * UNIFORMITY: every interactive element on the header is exactly 44px tall
 * (matches global `button { min-height: 44px }` rule at globals.css:97-99)
 * and uses the same `rounded-full` radius for visual cohesion. The applied-
 * filter count badge is a small ink/terracotta pill that surfaces only when
 * filters are active so the default state stays clean.
 *
 * COMPOSITION: drops in directly under the page max-w-6xl container. Owns
 * its own bg-cream/95 + backdrop-blur so anything underneath scrolls
 * cleanly behind it. The IconTileFolderStrip lives in a separate component
 * directly below — that strip is a sibling sticky bar that pins under this
 * one on scroll.
 */

import { useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';

import { TaxonomySearch, type TaxonomyOption } from './taxonomy-search';
import { FilterDrawer, type FilterDrawerProps } from './filter-drawer';

/**
 * One chip in the contextual pill row. `href` is pre-built by the page —
 * always preserves sibling URL params (folder, match, venue, q, page, sort,
 * verified, from) so toggling a faith never blows away the host's other
 * filter state. `active` triggers the filled-pill styling; only one option
 * should be active at a time. "All" is rendered as an option with
 * value=null so couples can clear the narrow.
 */
export type ContextualPillOption = {
  value: string | null;
  label: string;
  href: string;
  active: boolean;
};

export type StickyMarketplaceHeaderProps = {
  /** The full 192-item autocomplete dataset for the search input. */
  taxonomyOptions: ReadonlyArray<TaxonomyOption>;
  /**
   * Current filter values — drives the search input's initial query + the
   * applied-filter count badge + the drawer's initial state.
   */
  filters: {
    q: string;
    city: string;
    sort: string;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: string | null;
    folder: string | null;
    venueDefault: 'on' | 'off' | null;
  };
  /** Drawer config passed through to FilterDrawer. */
  drawer: FilterDrawerProps;
  /**
   * 2026-05-30 — contextual per-folder narrow inline with search. Today
   * only used by Ceremony (Faith axis). When omitted, the pill row hides
   * entirely; when present, renders a chip row stacked below the search
   * row with the supplied label + options. `label` becomes the eyebrow
   * caption ("FAITH" / "VENUE STYLE" / etc.). The mobile pattern is
   * horizontal-scroll-snap — same as the IconTileFolderStrip pattern.
   */
  contextualPill?: {
    label: string;
    options: ReadonlyArray<ContextualPillOption>;
  };
};

/**
 * Count how many filters are currently "applied" — used to badge the Filters
 * button so couples can see at a glance how narrow their current view is.
 * Search query (`q`) is excluded because the search input itself surfaces
 * that. Folder is excluded because the IconTileFolderStrip surfaces that.
 */
function countAppliedFilters(
  filters: StickyMarketplaceHeaderProps['filters'],
  contextualPill?: StickyMarketplaceHeaderProps['contextualPill'],
) {
  let n = 0;
  if (filters.city.trim().length > 0) n += 1;
  if (filters.verifiedOnly) n += 1;
  if (filters.matchEvent) n += 1;
  if (filters.sort !== 'most_reviews' && filters.sort !== '') n += 1;
  if (filters.venueDefault === 'off') n += 1;
  // 2026-05-30 — count an active contextual narrow (Faith, Style, etc.)
  // so the applied-filter badge stays honest. The "All" option uses
  // value=null and is never active, so we count any option active where
  // value !== null.
  if (contextualPill) {
    const activeNarrow = contextualPill.options.find(
      (o) => o.active && o.value !== null,
    );
    if (activeNarrow) n += 1;
  }
  return n;
}

export function StickyMarketplaceHeader({
  taxonomyOptions,
  filters,
  drawer,
  contextualPill,
}: StickyMarketplaceHeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const appliedCount = countAppliedFilters(filters, contextualPill);

  return (
    <>
      <div
        // sticky top-0 keeps the search bar pinned. -mx-N negatives let the
        // bar break out of the page's max-w-6xl + px-N container so it spans
        // edge-to-edge on mobile (matches Airbnb's full-bleed sticky search).
        // border-b + backdrop-blur give the bar a soft glassy feel without
        // fighting content underneath.
        className="sticky top-0 z-30 -mx-4 border-b border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {/* Eyebrow + applied-count chip. Reads as 'MARKETPLACE · 192
            categories · 2 filters applied'. Concise replacement for the
            retired italic-serif headline + paragraph. */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Marketplace
          </p>
          {appliedCount > 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              {appliedCount} filter{appliedCount === 1 ? '' : 's'} applied
            </span>
          ) : null}
        </div>

        {/* Search pill + Filters button row. The search input owns its own
            rounded-full pill via TaxonomySearch's existing styling; the
            Filters button is a matching 44pt rounded-full pill so the two
            read as a single search affordance — Airbnb pattern. gap-2 keeps
            them visually paired. */}
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <TaxonomySearch
              initialQuery={filters.q}
              options={taxonomyOptions}
              preserve={{
                city: filters.city,
                sort: filters.sort,
                verifiedOnly: filters.verifiedOnly,
                matchEvent: filters.matchEvent,
                eventType: filters.eventType,
                folder: filters.folder,
                from: null,
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={
              appliedCount > 0
                ? `Open filters (${appliedCount} applied)`
                : 'Open filters'
            }
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-4 text-sm font-medium text-ink hover:border-terracotta/40 hover:text-terracotta"
          >
            <SlidersHorizontal
              className="h-4 w-4"
              strokeWidth={2}
              aria-hidden
            />
            <span className="hidden sm:inline">Filters</span>
            {appliedCount > 0 ? (
              <span
                aria-hidden
                className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-terracotta px-1.5 font-mono text-[10px] text-cream"
              >
                {appliedCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* 2026-05-30 — Contextual sub-category pill row. Today only the
            Ceremony folder ships an axis (Faith); other folders pass
            contextualPill=undefined → row hides. Stacks below the search
            row so the search affordance stays at the top of the viewport
            (most-used surface). Horizontal-scroll-snap on mobile mirrors
            the IconTileFolderStrip pattern so the row never wraps to two
            lines on narrow viewports. */}
        {contextualPill ? (
          <div className="mt-3 flex items-center gap-3">
            <p className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55 sm:block">
              {contextualPill.label}
            </p>
            <div
              role="group"
              aria-label={`Narrow by ${contextualPill.label.toLowerCase()}`}
              className="flex min-w-0 flex-1 snap-x snap-mandatory items-center gap-1.5 overflow-x-auto"
            >
              {contextualPill.options.map((option) => (
                <Link
                  key={option.value ?? '__all__'}
                  href={option.href}
                  aria-current={option.active ? 'true' : undefined}
                  className={
                    option.active
                      ? 'inline-flex h-9 shrink-0 snap-start items-center rounded-full bg-terracotta px-3 text-xs font-medium text-cream'
                      : 'inline-flex h-9 shrink-0 snap-start items-center rounded-full border border-ink/15 bg-cream px-3 text-xs font-medium text-ink hover:border-terracotta/40 hover:text-terracotta'
                  }
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <FilterDrawer
        {...drawer}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}
