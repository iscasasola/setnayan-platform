import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import {
  WEDDING_FOLDER_SLUG,
  WEDDING_FOLDER_SHORT_LABEL,
  type WeddingFolder,
} from '@/lib/taxonomy';
import type {
  CrossCategoryRecommendation,
  PlanGroupId,
} from '@/lib/wedding-plan-groups';

/**
 * MarketplaceTeaseStrip — top-of-Home discovery surface (2026-05-29).
 *
 * WHY: Owner directive verbatim · "the connection of vendors and customer
 * IS the marketplace · without the marketplace or the vendor
 * recommendation, we will not connect them properly." Closes the gap
 * where the customer event-home had no above-the-fold discovery
 * surface — the only marketplace entry points were buried inside each
 * of the 12 PlanningGroups cards (one [Search vendors] CTA per card)
 * + the new Vendors bottom-nav tab (PR #639) which actually points at
 * the event-scoped picks list `/dashboard/[eventId]/vendors`, NOT the
 * root discovery marketplace at `/explore`. This strip is the
 * canonical discovery entry point on Home.
 *
 * RENDER ORDER: Sits ABOVE the PlanningGroups section. The visual
 * order on event-home becomes:
 *   ConciergeBanner → MarketplaceTeaseStrip → PlanningGroups (12 cards)
 *   → YourPlanSection → NavGrid → MoneyInFlight → UpcomingSchedules
 *   → ActivityFeed.
 *
 * THREE SURFACES IN ONE CARD:
 *   1. Hero · "Browse the Setnayan marketplace" editorial title +
 *      primary CTA to `/explore` (no folder scope = full 12-folder
 *      catalog mode per CLAUDE.md 2026-05-20 row "Marketplace taxonomy
 *      remap").
 *   2. Quick-browse · 6 highest-discovery folder chips (Photo & Video ·
 *      Catering · Decor & Sound · Music · Booths · Attire) each deep-
 *      linked to `/explore?folder=<slug>#<slug>` per the canonical
 *      pattern from CLAUDE.md 2026-05-22 PR #310 folder scope.
 *   3. Also worth a look · top 3 cross-category recommendations
 *      flattened from the host's existing picks (only renders when
 *      `crossCategoryRecommendations` Map has entries). Showcases the
 *      "vendor recommendation" half of the owner directive. Dedupes by
 *      vendor_id so a vendor covering 3 categories doesn't appear 3x.
 *
 * WHY KEEP PER-CARD RecommendedVendorRow: This strip is the ABOVE-the-
 * grid announcement. The existing per-card RecommendedVendorRow inside
 * PlanningGroups (CLAUDE.md 2026-05-22 owner directive) stays — that's
 * the IN-CARD recommendation surface for Consider · Lock too actions.
 * This strip is the DISCOVERY surface; the per-card row is the ACTION
 * surface. Both layers coexist.
 *
 * VISUAL · uses chrome's terracotta token (remaps to Royal Champagne Gold
 * #C5A059 per CLAUDE.md 2026-05-30 Clean Editorial unification) for accent
 * details, and bg-mulberry for the primary "Browse all vendors" CTA per
 * Clean Editorial role split (gold for accents/eyebrows/borders/active
 * states · mulberry for primary action buttons). Editorial italic title
 * (font-display) for warmth. m-eyebrow + font-mono uppercase tracking for
 * section labels matching planning-groups.tsx convention. Card surface
 * uses gradient cream→terracotta-50/30 (alabaster → light champagne wash)
 * for visual distinction without overwhelming dashboard density.
 *
 * Server Component · no client state · all interactivity via Link.
 * Tap targets 44px minimum on the primary CTA per mobile usability
 * lock.
 */

/**
 * Top 6 discovery folders ordered by attach-rate × emotional pull.
 * Photo + Catering anchor at #1-2 (every wedding needs them, high
 * vendor density). Decor + Music + Attire round out the look-and-feel
 * triad. Booths surfaces because it's the Setnayan signature folder
 * (30 sub-types · CLAUDE.md 2026-05-19 PR #423 V1.1.6 launch).
 *
 * NOT in the strip but reachable via the [Browse all vendors] primary
 * CTA: Ceremony, Reception (the two venue folders), Planning · Hair &
 * Makeup · Rings · Invitations. These are higher-intent searches
 * couples do via the full marketplace catalog, not a chip.
 */
const FEATURED_FOLDERS: ReadonlyArray<WeddingFolder> = [
  'documentary',
  'feast',
  'design',
  'program',
  'booths',
  'look',
];

type Props = {
  /** Used in the primary CTA + the "return to event" context. Pass eventId
   *  so future iterations can append return URLs to the marketplace browse
   *  flow without re-wiring this component. */
  eventId: string;
  /** Full Map<PlanGroupId, CrossCategoryRecommendation[]> from event-home
   *  page.tsx. This component flattens to top 3 deduped vendors and
   *  surfaces them as the "Also worth a look" tease. Empty Map → tease
   *  block doesn't render. */
  crossCategoryRecommendations: ReadonlyMap<
    PlanGroupId,
    CrossCategoryRecommendation[]
  >;
};

export function MarketplaceTeaseStrip({
  eventId: _eventId,
  crossCategoryRecommendations,
}: Props) {
  // Flatten Map<groupId, recs[]> to a single Top-3 list. Dedupe by
  // vendor_id — a vendor that covers 3 distinct categories shouldn't
  // appear in the strip 3 times. First occurrence wins (preserves Map
  // iteration order which matches PLAN_GROUPS render order).
  const seenVendors = new Set<string>();
  const flatRecs: CrossCategoryRecommendation[] = [];
  for (const recs of crossCategoryRecommendations.values()) {
    for (const rec of recs) {
      if (seenVendors.has(rec.vendor_id)) continue;
      seenVendors.add(rec.vendor_id);
      flatRecs.push(rec);
      if (flatRecs.length === 3) break;
    }
    if (flatRecs.length === 3) break;
  }

  return (
    <section
      aria-labelledby="marketplace-tease-heading"
      className="rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/40 p-5 sm:p-6"
    >
      {/* HERO ROW · editorial title + primary CTA */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="m-eyebrow font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta-700">
            Discover vendors
          </p>
          <h2
            id="marketplace-tease-heading"
            className="mt-1 font-display text-2xl italic text-ink sm:text-3xl"
          >
            Browse the Setnayan marketplace
          </h2>
          <p className="mt-2 max-w-xl text-sm text-ink/80">
            Verified Filipino wedding vendors curated for your ceremony,
            venue, and palette. Zero commission. Real names, real reviews.
          </p>
        </div>
        {/* HEIGHT · `h-11` (44px EXACT) replaces `min-h-[44px] py-2.5` per
         *  CLAUDE.md 2026-05-30 owner directive on event-home screenshot:
         *  "search vendors and browse all vendors still have different
         *  height". Switching from min-h floor + padding-driven height to
         *  fixed h-11 forces the button to render at exactly 44px in every
         *  browser (the min-h + py-2.5 + text-sm content could grow past
         *  44px in some text-rendering contexts). Matches Search vendors
         *  CTA in PlanCardCTAs which already uses h-11 exact. */}
        <Link
          href="/explore"
          className="inline-flex h-11 items-center gap-1.5 rounded-full bg-mulberry px-4 text-sm font-medium text-cream shadow-sm transition-colors hover:bg-mulberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-mulberry/40"
        >
          Browse all vendors
          <ArrowUpRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>

      {/* QUICK BROWSE · 6 folder chips */}
      <div className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/75">
          Quick browse
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {FEATURED_FOLDERS.map((folder) => {
            const slug = WEDDING_FOLDER_SLUG[folder];
            return (
              <li key={folder}>
                {/* HEIGHT · `h-11` (44px EXACT) matches the Browse all
                 *  vendors CTA above. Same parity-fix from min-h floor
                 *  to fixed height — owner screenshot showed visible
                 *  height drift between marketplace-tease pills and the
                 *  Search vendors CTA below. */}
                <Link
                  href={`/explore?folder=${slug}#${slug}`}
                  className="inline-flex h-11 items-center rounded-full border border-ink/15 bg-cream/80 px-3 text-sm text-ink transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
                >
                  {WEDDING_FOLDER_SHORT_LABEL[folder]}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ALSO WORTH A LOOK · cross-category recommendations tease.
          Only renders when host has picks producing cross-cat recs. */}
      {flatRecs.length > 0 ? (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700/90">
            <Sparkles aria-hidden className="h-3 w-3" />
            Also worth a look · vendors you already picked do more
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {flatRecs.map((rec) => (
              <li
                key={rec.vendor_id}
                className="flex items-start gap-2 rounded-lg bg-cream/70 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {rec.vendor_name}
                  </p>
                  <p className="truncate text-xs text-ink/75">
                    {rec.source_group_label}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
