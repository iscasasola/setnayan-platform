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
 *   2. Type free text + Enter → the wrapping <form method="get" action="/explore">
 *      submits `q=<text>` (ilike business_name). Mirrors FocusedModeSearchForm.
 *
 * THEME: Clean Editorial `--m-*` marketing tokens (paper / ink / slate /
 * champagne-gold accent) so the hero reads as a premium-calm marketing band,
 * consistent with the homepage + /features + /vendors surfaces. The
 * `m-surface` wrapper swaps the font family to the marketing sans stack.
 */

export type ExploreChip = {
  /** Visible chip label. */
  label: string;
  /** Destination — typically `/explore?category=<canonical>`. */
  href: string;
};

/**
 * A chip's href → the value of one of its query params.
 *
 * The chips were built server-side as full hrefs (`/explore?category=live_band`)
 * and the dropdowns need the VALUE, not the link. Reading it back out beats
 * changing every producer of `ExploreChip`: one parser here cannot disagree with
 * itself, whereas a second field on the type would have to be kept in step by
 * every caller that builds a chip.
 *
 * Returns '' when the param is absent, which renders as the "Any …" option — a
 * chip that stops carrying its own filter simply stops being selectable, rather
 * than submitting a broken value.
 */
function chipParam(href: string, param: string): string {
  const q = href.indexOf('?');
  if (q < 0) return '';
  return new URLSearchParams(href.slice(q + 1)).get(param) ?? '';
}

export function ExploreSearchHero({
  taxonomyOptions,
  scopedFolder,
  preserve,
  chips,
  occasionChips = [],
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
  /**
   * Occasion chips — one per kind of celebration, linking to
   * `/explore?event_type=<key>`.
   *
   * 🔴 WHY THIS ROW EXISTS AT ALL. Owner 2026-08-15: *"they can also search by
   * type of event."* The `?event_type=` filter has shipped since Iteration
   * 0041 and nothing on any public surface could set it — the drawer that
   * would be its natural home does not even RENDER on this landing, because
   * the landing is catalog mode and the drawer belongs to the vendor grid. So
   * without this row an anonymous visitor standing on /explore has no way to
   * ask for their kind of celebration at all.
   *
   * Kept as a separate row from `chips` rather than merged into it: those are
   * SERVICES ("Photographers", "Caterers") and these are OCCASIONS. One
   * undifferentiated row would read as one list where "Debut" and "Florists"
   * answer the same question, and they do not.
   *
   * Empty array renders nothing.
   */
  occasionChips?: ReadonlyArray<ExploreChip>;
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

        <form method="get" action="/explore" className="mt-7 w-full max-w-2xl">
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

        {/* ── TWO DROPDOWNS, NOT TWO WALLS OF CHIPS ────────────────────────
            Owner 2026-09-08, looking at 4 service chips over 16 occasion
            chips: *"if they want to search a category or per ocassion. they
            can pick from a drop down. but we don't need to show as many
            buttons up front. we want it simple and clean and easy to search.
            not bombarded with a lot of choices."*

            Both filters SURVIVE — `?category=` and `?event_type=` are the same
            query params the chips linked to, and every existing deep link into
            them still resolves. What changes is that a visitor is asked one
            question (what are you looking for?) instead of being shown twenty
            answers before they have been asked anything.

            🔑 THE OCCASION ROW EXISTED FOR A REASON WORTH KEEPING. Its own note
            said `?event_type=` had shipped since Iteration 0041 with NOTHING on
            any public surface able to set it — the filter drawer does not render
            on this landing. Deleting the row outright would have re-orphaned the
            filter. A `<select>` is the smaller surface that keeps it reachable.

            Native `<select>` inside the same GET form, deliberately: it submits
            without JavaScript, it is keyboard- and screen-reader-native, and on
            a phone it opens the platform picker instead of a 20-target tap area.
            They stay SEPARATE controls because services and occasions answer
            different questions — one merged list would read as though "Debut"
            and "Florists" were alternatives. */}
        {chips.length > 0 || occasionChips.length > 0 ? (
          <form
            method="get"
            action="/explore"
            className="mt-5 flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-center"
          >
            {scopedFolder ? (
              <input type="hidden" name="folder" value={scopedFolder} />
            ) : null}
            {chips.length > 0 ? (
              <label className="flex-1">
                <span className="sr-only">Filter by category</span>
                <select
                  name="category"
                  defaultValue=""
                  className="w-full rounded-full border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-4 py-2 text-[13px] font-medium text-[color:var(--m-slate)]"
                >
                  <option value="">Any category</option>
                  {chips.map((chip) => (
                    <option key={chip.href} value={chipParam(chip.href, 'category')}>
                      {chip.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {occasionChips.length > 0 ? (
              <label className="flex-1">
                <span className="sr-only">Filter by occasion</span>
                <select
                  name="event_type"
                  defaultValue=""
                  className="w-full rounded-full border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-4 py-2 text-[13px] font-medium text-[color:var(--m-slate)]"
                >
                  <option value="">Any occasion</option>
                  {occasionChips.map((chip) => (
                    <option key={chip.href} value={chipParam(chip.href, 'event_type')}>
                      {chip.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="submit"
              className="rounded-full border border-[color:var(--m-ink)] bg-[color:var(--m-ink)] px-5 py-2 text-[13px] font-medium text-[color:var(--m-paper)]"
            >
              Show
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-[13px] text-[color:var(--m-slate)]">
          Not sure where to start?{' '}
          <Link
            href="/tour"
            className="font-medium text-[color:var(--m-mulberry)] underline decoration-[color:var(--m-mulberry)]/30 underline-offset-2 transition-colors hover:decoration-[color:var(--m-mulberry)]"
          >
            Walk through a real wedding →
          </Link>
        </p>
      </div>
    </section>
  );
}
