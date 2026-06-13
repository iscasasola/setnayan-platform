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
 * THEME: Clean Editorial palette via legacy `bg-cream` / `text-ink` /
 * `text-terracotta` / `border-ink/N` classes per the 2026-05-30 unification
 * (globals.css :root + html.dark). Matches the app shell visual language
 * used across dashboard / admin / vendor-dashboard. In light mode terracotta
 * = Royal Champagne Gold #C5A059. In dark mode terracotta = brighter
 * champagne #E0CCA0. Supersedes the 2026-05-22 Facebook palette
 * preservation lock on this component.
 *
 * UNIFORMITY: every interactive element on the header is exactly 44px tall
 * (matches global `button { min-height: 44px }` rule at globals.css:97-99)
 * and uses the same `rounded-full` radius for visual cohesion. The applied-
 * filter count badge is a small ink/terracotta pill that surfaces only when
 * filters are active so the default state stays clean.
 *
 * COMPOSITION: drops in directly under the page container (responsive
 * px-4/px-6/px-8 gutter, full-bleed since 2026-05-30 per owner directive
 * "let it maximize the full width" — the prior max-w-6xl cap retired so
 * the marketplace matches the homepage edge-to-edge feel). Owns its own
 * bg-cream/95 + backdrop-blur so anything underneath scrolls cleanly
 * behind it. The IconTileFolderStrip lives in a separate component
 * directly below — that strip is a sibling sticky bar that pins under
 * this one on scroll.
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
    /**
     * 2026-05-30 PM — current faith narrow URL param (`'catholic' |
     * 'christian' | 'inc' | 'muslim' | 'cultural' | null`). Drives the
     * applied-filter count badge on the Filters button so couples can see
     * at a glance whether a faith narrow is active. The actual edit UI
     * lives in FilterDrawer (the inline FaithPillRow that PRs #657 + #659
     * shipped is retired per owner directive *"why are these still
     * showing. they should be embedded inside the filter"*).
     */
    faith?: string | null;
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
  // 2026-05-30 PM — count the faith narrow (now lives in FilterDrawer per
  // owner directive *"they should be embedded inside the filter"*). Any
  // non-empty string (the URL param value: 'catholic'/'christian'/'inc'/
  // 'muslim'/'cultural') counts as one applied filter on the badge.
  if (filters.faith && filters.faith.length > 0) n += 1;
  // 2026-05-30 — count an active contextual narrow (Faith, Style, etc.)
  // so the applied-filter badge stays honest. The "All" option uses
  // value=null and is never active, so we count any option active where
  // value !== null. Today contextualPill is dead infrastructure (PR #659
  // moved Ceremony's pill inline before this PR moved it into the drawer)
  // but the API is kept for future per-folder narrow axes that don't fit
  // the global drawer pattern.
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
        // 2026-05-30 mobile pattern lock — owner directive *"on mobile mode.
        // searching on market place should show the search bar at the bottom
        // and any choices when clicking on mobile mode should show as a pop
        // up crawling up."* On mobile (< sm) the search bar pins to the
        // BOTTOM of the viewport via `fixed bottom-0 left-0 right-0` — thumb
        // zone for one-handed use, matches Shopee / Lazada / mobile Airbnb.
        // On desktop (≥ sm) the bar stays pinned to the TOP via
        // `sm:sticky sm:top-0` (sm: responsive override of position). Border
        // flips sides too: `border-t` on mobile (content sits above the bar
        // → top border separates them) → `sm:border-t-0 sm:border-b` on
        // desktop (content sits below the bar). Inline `paddingBottom`
        // honours `env(safe-area-inset-bottom)` so iOS notch users get the
        // bar lifted clear of the home indicator. -mx-N negatives still
        // matter for the desktop sticky variant so the bar breaks out of the
        // page's px-N container (page-level max-w-6xl cap retired 2026-05-30
        // per PR #655 — only the px-4/px-6/px-8 gutter remains); on mobile
        // `fixed left-0 right-0` already covers viewport-wide.
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur sm:sticky sm:bottom-auto sm:top-0 sm:border-b sm:border-t-0 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
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
          {/* 2026-06-14 search-first reframe — the search input now lives in a
              plain GET form so typing free text + Enter actually submits a
              multi-field `q` search (previously the bar had no surrounding form,
              so free-text Enter was a no-op and only autocomplete category-jumps
              worked). Hidden inputs carry the filters the header knows so a
              free-text search keeps the host's city/sort/match/etc. context.
              The active `category` is intentionally NOT preserved — a fresh
              free-text query reads as "search across everything," and the
              header prop contract doesn't carry category anyway. The Filters
              button stays a sibling (type=button) so it never submits. */}
          <form method="get" action="/explore" className="min-w-0 flex-1">
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
            {filters.city ? (
              <input type="hidden" name="city" value={filters.city} />
            ) : null}
            {filters.sort && filters.sort !== 'most_reviews' ? (
              <input type="hidden" name="sort" value={filters.sort} />
            ) : null}
            {filters.verifiedOnly ? (
              <input type="hidden" name="verified" value="1" />
            ) : null}
            {filters.matchEvent ? (
              <input type="hidden" name="match" value="1" />
            ) : null}
            {filters.eventType ? (
              <input type="hidden" name="event_type" value={filters.eventType} />
            ) : null}
            {filters.folder ? (
              <input type="hidden" name="folder" value={filters.folder} />
            ) : null}
            {filters.venueDefault === 'off' ? (
              <input type="hidden" name="venue" value="0" />
            ) : null}
            {filters.faith ? (
              <input type="hidden" name="faith" value={filters.faith} />
            ) : null}
          </form>
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
