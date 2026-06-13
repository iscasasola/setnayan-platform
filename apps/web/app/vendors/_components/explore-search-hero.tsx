import Link from 'next/link';

import { TaxonomySearch, type TaxonomyOption } from './taxonomy-search';

/**
 * ExploreSearchHero — search-first landing hero for the public /vendors
 * (top-nav "Explore") surface.
 *
 * WHY (owner directive 2026-06-13, "simple, modern, clean, strategic"): the
 * 6-page public IA locked "Explore" → /vendors as THE discovery surface. The
 * page used to OPEN as a category-browse marketplace (a pinned search bar +
 * 12 icon tiles + folder grids). The reframe leads with ONE clean universal
 * search box so a visitor can search anything — verified vendors AND
 * Setnayan's own services (Papic, livestream, save-the-dates …) all resolve
 * through the same field — instead of having to navigate a taxonomy first.
 *
 * SCOPE: this is a UX reframe, not a new index. The search field is the same
 * `TaxonomySearch` autocomplete used elsewhere (its option list already spans
 * the 192 canonicals INCLUDING the `setnayan_*` first-party services), and the
 * results land in the existing vendor-grid render path. The rich category
 * browse (IconTileFolderStrip + folder grids) still renders directly below the
 * hero as the "or browse everything" breadth — pre-launch, that catalog is
 * where recruiting/coming-soon inventory is surfaced.
 *
 * Two interaction paths (both inherited from TaxonomySearch verbatim):
 *   1. Pick a suggestion → router-push to /vendors?category=<canonical>.
 *   2. Type free text + Enter → the wrapping <form method="get" action="/vendors">
 *      submits `q=<text>` (ilike business_name). Mirrors FocusedModeSearchForm.
 *
 * THEME: Clean Editorial `--m-*` marketing tokens (paper / ink / slate /
 * champagne-gold accent) so the hero reads as a premium-calm marketing band,
 * consistent with the homepage + /features + /for-vendors surfaces. The
 * `m-surface` wrapper swaps the font family to the marketing sans stack.
 */

export type ExploreChip = {
  /** Visible chip label. */
  label: string;
  /** Destination — typically `/vendors?category=<canonical>`. */
  href: string;
};

export function ExploreSearchHero({
  taxonomyOptions,
  scopedFolder,
  preserve,
  chips,
}: {
  taxonomyOptions: ReadonlyArray<TaxonomyOption>;
  /**
   * When the catalog is scoped to a single folder (`?folder=…`, e.g. from a
   * dashboard planning [Search] deep-link), keep that scope on free-text
   * submit via a hidden input so the search stays inside the folder context.
   * Null on the universal Explore landing.
   */
  scopedFolder: string | null;
  /** Filter values preserved verbatim when a suggestion is selected. */
  preserve: {
    city: string;
    sort: string;
    verifiedOnly: boolean;
    matchEvent: boolean;
    eventType: string | null;
    folder: string | null;
  };
  /** A few suggested quick-search chips rendered under the field. */
  chips: ReadonlyArray<ExploreChip>;
}) {
  return (
    <section
      // Full-bleed within the parent section's px gutter (-mx cancels the
      // px-4/6/8 padding, then re-pads), matching the marketplace's
      // edge-to-edge feel. A soft paper band with a hairline bottom border
      // separates the hero from the browse catalog beneath it.
      className="m-surface -mx-4 mb-6 border-b border-[color:var(--m-line)] px-4 pb-9 pt-6 sm:-mx-6 sm:px-6 sm:pb-12 sm:pt-10 lg:-mx-8 lg:px-8"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="m-eyebrow">Explore</p>
        <h1 className="m-display-tight mt-4 text-[length:clamp(1.9rem,5vw,3.25rem)] text-[color:var(--m-ink)]">
          Everything for your day, in one search.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[color:var(--m-slate)] sm:text-base">
          Search verified Filipino vendors and Setnayan&rsquo;s own services
          &mdash; photo, video, livestream, save-the-dates, and more &mdash; all
          from one place.
        </p>

        <form method="get" action="/vendors" className="mt-7 w-full max-w-2xl">
          <label className="block text-left">
            <span className="sr-only">Search vendors and services</span>
            <TaxonomySearch
              variant="hero"
              initialQuery=""
              options={taxonomyOptions}
              preserve={{ ...preserve, from: null }}
            />
          </label>
          {scopedFolder ? (
            <input type="hidden" name="folder" value={scopedFolder} />
          ) : null}
        </form>

        {chips.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--m-slate-3)]">
              Popular
            </span>
            {chips.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                className="inline-flex items-center rounded-full border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3.5 py-1.5 text-[13px] font-medium text-[color:var(--m-slate)] transition-colors hover:border-[color:var(--m-orange)] hover:text-[color:var(--m-ink)]"
              >
                {chip.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
