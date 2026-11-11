/**
 * /explore — the supplier marketplace page.
 *
 * ─── 2026-11-12: THE PAGE IS NOW A THIN DOOR ONTO ONE SHARED VIEW ─────────
 * Owner, verbatim: *"find suppliers needs to be also inside discover already. they do not need to have their own
 * page"* (DECISION_LOG 2026-11-12 "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED").
 *
 * Everything this file used to hold — the data pipeline (who may be shown: `FINDABLE_SHOP_GATE`, `LIVE_SHOP_GATE`,
 * the demo / fraud / inquirable gates, `fetchMarketplaceServiceCards`, lenses, ranking, `parseFilters`, pagination,
 * off-season, save state, event choices) and its rendering — MOVED, unchanged, to
 * `./_lib/marketplace-view.tsx`, so Discover (`/`) can render the SAME supplier view from the SAME pipeline. There
 * is ONE definition of who may be shown; a second copy is how a hidden shop reaches the front page
 * (`front-door-results.tsx`'s own header). Every guard that read this file for the pipeline now reads that one.
 *
 * What stays HERE is what is about this ADDRESS: its metadata. A page file may only export what Next allows, which is
 * also why the view cannot simply be imported from here.
 */
import { BRAND_OG_IMAGES, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';
import { MarketplaceView, type MarketplaceSearchParams } from './_lib/marketplace-view';

// GEO Phase G4 (2026-05-28) — enriched marketplace metadata. Adds canonical
// URL, keywords (AI-engine match hint), and a richer description that
// surfaces the verified-vendor + 0% commission positioning. The per-vendor
// LocalBusiness JSON-LD lives on /v/[slug] (same sprint, sister PR) — this
// page is a category landing page so the metadata-only treatment is
// proportional to the surface's role in the funnel.
/*
  ⚠ `dynamic` IS DECLARED ONCE, ON `app/(shell)/layout.tsx`, NOT HERE.
  The shared shell reads the session, so every route in this group must be
  dynamic — and a layout's `dynamic` DOES cover its children (measured: with
  the pages declaring nothing, `force-dynamic` on the group layout alone moved
  them from `○ Static` to `ƒ Dynamic` in the build table). This file used to
  carry its own copy, along with a docblock asserting a layout could not do
  this. That assertion was false. Twenty copies of one rule is twenty places
  for it to disagree with itself — do not re-add it here.
*/

export const metadata = {
  title: 'Filipino wedding suppliers marketplace',
  description:
    'Browse verified Filipino wedding suppliers on Setnayan. Photographers, caterers, planners, florists, hair and makeup, music, decor, and more. Free to discover. 0% commission on bookings.',
  alternates: { canonical: '/explore' },
  keywords: [
    'Filipino wedding suppliers',
    'Philippines wedding photographers',
    'Manila wedding caterers',
    'Cebu wedding planners',
    'verified wedding suppliers Philippines',
    'wedding marketplace Philippines',
    'Setnayan suppliers',
  ],
  openGraph: {
    images: BRAND_OG_IMAGES,
    title: 'Filipino wedding suppliers · Setnayan marketplace',
    description:
      'Browse verified Filipino wedding suppliers. Free to discover. 0% commission on bookings.',
    url: '/explore',
    siteName: 'Setnayan',
    locale: 'en_PH',
    type: 'website',
  },
  // SEO/GEO Bucket 6 (CLAUDE.md 2026-05-29 SEO/GEO Sprint row) · twitter
  // card so social shares render the 1200×630 /brand/og-card.webp instead of a
  // 144×144 thumbnail. ⚠ The card must be NAMED here: a page's own `twitter` /
  // `openGraph` object replaces the layout's whole object (shallow merge), so
  // "layout-level" left this page with no picture at all until 2026-10-23.
  twitter: {
    images: BRAND_TWITTER_IMAGES,
    card: 'summary_large_image',
    title: 'Filipino wedding suppliers · Setnayan marketplace',
    description:
      'Browse verified Filipino wedding suppliers. Free to discover. 0% commission on bookings.',
  },
};

export default async function VendorsMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  return <MarketplaceView raw={await searchParams} surface="explore" />;
}
