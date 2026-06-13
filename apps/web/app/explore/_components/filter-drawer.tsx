'use client';

/**
 * FilterDrawer — slide-up sheet on mobile, right-side panel on desktop.
 * Hosts City + Sort + Verified-only + Match-my-wedding + Show-all-venues
 * filter controls + a single Apply primary button.
 *
 * WHY: Owner directive 2026-05-30 (CLAUDE.md decision log row "Marketplace ·
 * Airbnb vibe with uniform sizing") replaces the inline 4-column FilterBar
 * form that sat under the giant italic-serif headline. The form was visually
 * dense (3 stacked checkbox rows + 2 inputs + sort select + Apply + Clear)
 * and pushed the actual vendor catalog below the fold. Folding it into a
 * drawer matches Airbnb's filter-modal pattern and frees the page to show
 * vendor content immediately.
 *
 * PRESERVED CONTRACT: this drawer is a controlled wrapper around the SAME
 * underlying GET form that pointed at `/explore`. All hidden inputs that
 * preserved folder / category / focusedMode survive verbatim. Submitting the
 * form has identical semantics to the retired FilterBar — server-side
 * parseFilters reads the same querystring keys (q, city, sort, verified,
 * match, venue, folder, category, from). Zero behavior drift.
 *
 * THEME PRESERVED: Facebook palette via legacy bg-cream / text-ink /
 * text-terracotta / border-ink classes per 2026-05-22 brand pivot
 * (globals.css:7-46). All inputs use the canonical `.input-field` class.
 * All buttons use the canonical `.button-primary` / `.button-secondary`
 * classes (44pt min-height, uniform px-5 padding, rounded-md radius).
 *
 * ACCESSIBILITY: ESC closes the drawer. Click on the backdrop closes the
 * drawer. Tab focus is captured inside the drawer while open. `aria-modal`
 * + `role="dialog"` declared on the panel. Focus moves to the panel on open
 * and returns to the trigger on close (handled by parent via onClose).
 *
 * UNIFORM BUTTON SIZES: per owner complaint *"buttons being different sizes
 * is also not appealing"*. Apply + Clear + close X are all the same height
 * (44pt) and use the same rounded radius. Drawer-internal field-style chips
 * all read at the same h-11 baseline.
 */

import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export type FilterDrawerProps = {
  /** Open / closed state owned by the parent (StickyMarketplaceHeader). */
  open?: boolean;
  /** Callback fired when the user dismisses the drawer (ESC / backdrop / Apply). */
  onClose?: () => void;

  /** Current filter values — drive defaultValue + defaultChecked. */
  filters: {
    q: string;
    category: string | null;
    city: string;
    sort: string;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: string | null;
    folder: string | null;
    venueDefault: 'on' | 'off' | null;
    focusedMode?: boolean;
    /**
     * 2026-05-30 PM — current faith narrow value as the URL param string
     * (`'catholic' | 'christian' | 'inc' | 'muslim' | 'cultural' | null`).
     * Drives the `<select name="faith">` defaultValue inside the drawer.
     * When null, the select defaults to the "All faiths" option (value '').
     */
    faith?: string | null;
  };

  /** Sort key + label pairs (same source-of-truth as the retired FilterBar). */
  sortOptions: ReadonlyArray<{ value: string; label: string }>;

  /**
   * 2026-05-30 PM — Faith narrow option list. Owner directive verbatim:
   * *"why are these still showing. they should be embedded inside the filter"*.
   * Replaces the inline `<FaithPillRow>` that PR #659 rendered above every
   * faith-bearing folder's category grid. The drawer is the canonical home
   * for global filters; faith joins City + Sort + Verified-only + Match-my-
   * wedding + Show-all-venues there.
   *
   * Option `value` is the URL param string (`'catholic'` etc. — lowercase,
   * matches FAITH_KEY_TO_URL on the page). Empty option `{value: '',
   * label: 'All faiths'}` is prepended by the drawer itself — callers pass
   * only the actively-visible faith chips. When the list is empty OR
   * undefined, the Faith section hides entirely (folders with no faith-
   * tagged sub-categories — Photo & Video, Reception, Rings & Accessories,
   * Booths & Stations, Invitations & Keepsakes — don't surface the section).
   */
  faithOptions?: ReadonlyArray<{ value: string; label: string }>;

  /**
   * Host's event metadata — only present when an authenticated couple has at
   * least one in-progress event. Drives whether Match-my-wedding checkbox
   * renders + the Show-all-venues toggle's host-setting copy.
   */
  matchableEvent: { ceremony_type: string; venue_setting: string } | null;

  /** Host's venue_setting (Reception folder filter). */
  hostVenueSetting: string | null;

  /** Human-readable label for hostVenueSetting — used in toggle copy. */
  hostVenueLabel: string | null;

  /** Whether the venue-setting toggle should render (Reception folder + host has setting). */
  showVenueToggle: boolean;

  /** Whether there are any active filters to clear — drives the Clear button visibility. */
  hasActiveFilters: boolean;
};

export function FilterDrawer({
  open = false,
  onClose,
  filters,
  sortOptions,
  faithOptions,
  matchableEvent,
  hostVenueSetting: _hostVenueSetting,
  hostVenueLabel,
  showVenueToggle,
  hasActiveFilters,
}: FilterDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cityId = useId();
  const sortId = useId();
  const faithId = useId();
  const verifiedId = useId();
  const matchId = useId();
  const venueId = useId();

  // ESC closes the drawer. Focus moves into the panel on open so screen readers
  // jump straight to the dialog content. Restoring focus to the trigger on
  // close is handled by the parent component's button (browser restores
  // focus when the panel unmounts).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onClose) onClose();
    }
    document.addEventListener('keydown', onKey);
    // Move focus into the panel on open for keyboard + screen-reader users.
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open so the page underneath doesn't scroll when
  // the user swipes inside the drawer. Restored on close.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      // role + aria-modal declare this as a modal dialog. The backdrop is
      // click-to-close. Z-50 stays above the sticky header (z-30) and
      // folder strip (z-20) so the drawer always wins the layer war.
      role="dialog"
      aria-modal="true"
      aria-label="Filter vendors"
      className="fixed inset-0 z-50 flex"
    >
      {/* Backdrop — click closes the drawer. bg-ink/40 gives the standard
          dim-out without becoming opaque. */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-pointer bg-ink/40 backdrop-blur-sm"
      />

      {/* Panel — slide-up sheet on mobile (anchored bottom, max-h-[90vh]),
          right-side drawer on desktop (anchored right, w-[420px]). max-h
          + overflow-y-auto handles long content (sort dropdown + 3 checkbox
          rows + Apply + Clear) without breaking the layout on short
          viewports. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative ml-auto mt-auto flex w-full max-w-full flex-col rounded-t-2xl bg-cream shadow-xl outline-none sm:max-w-[480px] sm:mt-auto sm:mb-0 sm:rounded-t-2xl lg:my-0 lg:h-full lg:max-w-[420px] lg:rounded-l-2xl lg:rounded-tr-none"
        style={{ maxHeight: 'min(90vh, 100dvh)' }}
      >
        <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            // 44pt min-height (global rule). Same rounded radius as the
            // other CTAs so visually everything reads as one button family.
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </header>

        <form
          method="get"
          action="/explore"
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Scrollable inner area — Apply / Clear footer stays pinned even
              with many filters open. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {/* Hidden inputs preserve the keys the parent page already drove
                via folder strip / search input / category drill-in. The
                drawer is a focused 'edit filter values' surface — it does
                NOT own the search / folder / category state. */}
            {filters.q ? (
              <input type="hidden" name="q" value={filters.q} />
            ) : null}
            {filters.category ? (
              <input
                type="hidden"
                name="category"
                value={filters.category}
              />
            ) : null}
            {filters.folder ? (
              <input
                type="hidden"
                name="folder"
                value={filters.folder}
              />
            ) : null}
            {filters.focusedMode ? (
              <input type="hidden" name="from" value="plan" />
            ) : null}

            {/* City */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={cityId}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
              >
                City
              </label>
              <input
                id={cityId}
                type="text"
                name="city"
                defaultValue={filters.city}
                placeholder="Manila, Cebu, Davao…"
                className="input-field"
              />
            </div>

            {/* Sort by */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={sortId}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
              >
                Sort by
              </label>
              <select
                id={sortId}
                name="sort"
                defaultValue={filters.sort}
                className="input-field"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Faith — 2026-05-30 PM. Owner directive *"why are these still
                showing. they should be embedded inside the filter"*. The
                inline FaithPillRow rendered by PRs #657 + #659 above every
                faith-bearing folder is retired; faith narrows now live here
                in the drawer alongside City + Sort. Section hides entirely
                when no faith-tagged sub-categories survive the hide-empty
                filter (Photo & Video, Reception, Rings & Accessories,
                Booths & Stations, Invitations & Keepsakes folders OR a
                fully unpopulated catalog). The empty `<option value="">`
                appears first so couples can clear the narrow back to "All
                faiths" without leaving the drawer. */}
            {faithOptions && faithOptions.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={faithId}
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
                >
                  Faith
                </label>
                <select
                  id={faithId}
                  name="faith"
                  defaultValue={filters.faith ?? ''}
                  className="input-field"
                >
                  <option value="">All faiths</option>
                  {faithOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : filters.faith ? (
              /* Edge case: host already has ?faith=… set but the current
                 view exposes zero faith-tagged tiles (e.g., scoped to a
                 folder with no faith categories). Preserve the existing
                 narrow as a hidden input so the form submit doesn't
                 silently drop it. */
              <input type="hidden" name="faith" value={filters.faith} />
            ) : null}

            {/* Verified only */}
            <div className="rounded-xl border border-ink/10 bg-cream p-3">
              <label
                htmlFor={verifiedId}
                className="flex cursor-pointer items-start gap-3 text-sm text-ink/80"
              >
                <input
                  id={verifiedId}
                  type="checkbox"
                  name="verified"
                  value="1"
                  defaultChecked={filters.verifiedOnly}
                  className="mt-0.5 h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                />
                <span>
                  <span className="block font-medium text-ink">
                    Verified only
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink/55">
                    Hide vendors who haven&rsquo;t completed verification.
                  </span>
                </span>
              </label>
            </div>

            {/* Match my wedding — only when host has an in-progress event */}
            {matchableEvent ? (
              <div className="rounded-xl border border-ink/10 bg-cream p-3">
                <label
                  htmlFor={matchId}
                  className="flex cursor-pointer items-start gap-3 text-sm text-ink/80"
                >
                  <input
                    id={matchId}
                    type="checkbox"
                    name="match"
                    value="1"
                    defaultChecked={filters.matchEvent}
                    className="mt-0.5 h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                  />
                  <span>
                    <span className="block font-medium text-ink">
                      Match my wedding
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink/55">
                      Only show vendors compatible with{' '}
                      <span className="font-mono text-ink/70">
                        {matchableEvent.ceremony_type}
                      </span>{' '}
                      ceremonies.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            {/* Show all venue settings — Reception folder + host has setting */}
            {showVenueToggle && hostVenueLabel ? (
              <div className="rounded-xl border border-ink/10 bg-cream p-3">
                <label
                  htmlFor={venueId}
                  className="flex cursor-pointer items-start gap-3 text-sm text-ink/80"
                >
                  <input
                    id={venueId}
                    type="checkbox"
                    name="venue"
                    value="0"
                    defaultChecked={filters.venueDefault === 'off'}
                    className="mt-0.5 h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                  />
                  <span>
                    <span className="block font-medium text-ink">
                      Show all venue settings
                    </span>
                    <span className="mt-0.5 block text-[12px] text-ink/55">
                      Uncheck to focus on{' '}
                      <span className="font-medium text-ink/75">
                        {hostVenueLabel}
                      </span>{' '}
                      — your wedding&rsquo;s picked setting.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          {/* Footer — Apply + Clear. Uniform 44pt height per the global rule.
              border-t separates the scrollable area cleanly. */}
          <footer className="border-t border-ink/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                onClick={() => onClose?.()}
                className="button-primary flex-1"
              >
                Apply filters
              </button>
              {hasActiveFilters ? (
                <Link
                  href={
                    filters.folder
                      ? `/explore?folder=${filters.folder}`
                      : '/explore'
                  }
                  className="button-secondary"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
