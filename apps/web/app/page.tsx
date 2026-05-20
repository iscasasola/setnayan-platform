import type { ComponentType } from 'react';
import nextDynamic from 'next/dynamic';
import { SiteHeader } from '@/app/_components/site-header';
import { AnnouncementBar } from '@/app/page-sections/_AnnouncementBar';
import { BrowseStrip } from '@/app/page-sections/_BrowseStrip';
import { Hero } from '@/app/page-sections/_Hero';
import { RealNumbers } from '@/app/page-sections/_RealNumbers';
import { Chaos } from '@/app/page-sections/_Chaos';
import { TwoSides } from '@/app/page-sections/_TwoSides';
import { MariaJuan } from '@/app/page-sections/_MariaJuan';
import { InAppServices } from '@/app/page-sections/_InAppServices';
import { TransparentPricing } from '@/app/page-sections/_TransparentPricing';
import { ReadinessBoard } from '@/app/page-sections/_ReadinessBoard';
import { CoverageMap } from '@/app/page-sections/_CoverageMap';
import {
  ConversionModule,
  SiteFooter,
} from '@/app/page-sections/_DualCTAFooter';
import { AvailableEverywhere } from '@/app/page-sections/_AvailableEverywhere';
import { DynamicStickyMobileCTA } from '@/app/page-sections/_StickyMobileCTAClient';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchWidgetsForPage } from '@/lib/site-widgets';

// Section 8 (`_VendorCompat`) is the only below-the-fold section that ships
// real client-side state — a tabbed module with `useState`. Loading its JS
// chunk eagerly with the rest of the route bumps First Load JS for every
// visitor even though the section sits ~6 viewport-heights down on mobile.
// Lazy-import it with `next/dynamic({ ssr: true })` so the SSR HTML still
// contains the section (preserving SEO + above-the-fold layout stability)
// while its hydration JS lands in its own chunk that loads in parallel
// with the rest of the page.
const VendorCompat = nextDynamic(
  () => import('@/app/page-sections/_VendorCompat'),
  {
    // Placeholder height matches the rendered section's intrinsic min so
    // we don't introduce CLS during the brief hydration window.
    loading: () => <div aria-hidden className="min-h-[640px]" />,
  },
);

// Public-marketing-site homepage — iteration 0015 § Section-by-section spec
// (locked 2026-05-15) wired to the `site_widgets` registry (iteration 0015
// § Widget architecture) so admins can toggle on/off + drag-drop reorder
// individual sections via /admin/website (iteration 0023 § 3.10).
//
// The fourteen sections (in seed display_order) — admin-editable via the
// Website editor; per-widget config remains code-locked in V1:
//    1  Announcement bar              (special-cased above SiteHeader)
//    2  Browse strip
//    3  Hero (three-question framing)
//    4  Real numbers (count-gated)
//    5  The chaos we're fixing
//    6  Built for both sides of the celebration
//    7  Maria & Juan: see how it works
//    8  In-app services (apparatus catalog)
//    9  Vendor compatibility & verification
//   10  Transparent pricing
//   11  Event-type readiness board
//   12  PH coverage map
//   13  Dual CTA conversion module
//   14  Available everywhere you plan (platforms · per_tile-gated)
//
// Chrome that stays outside the widget loop: SiteHeader (top), SiteFooter
// (bottom), DynamicStickyMobileCTA (mobile sticky). The announcement bar
// is treated as a regular widget but pinned above SiteHeader when enabled
// — moving it elsewhere in the editor changes its on/off state only, not
// its visual position, because a banner mid-page reads as broken UX.
//
// Cross-cutting standards baseline:
//   - Mobile-first single-column layouts; multi-column at md/lg.
//   - Sticky thumb-zone primary CTA on mobile (auto-hides over the
//     conversion block).
//   - WCAG 2.2 AA — visible focus rings, 44-48px primary tap targets,
//     24px floor on secondary, 4.5:1 / 3:1 contrast.
//   - Taglish-tolerant voice copy where the spec specifies.
//   - Language switcher placeholder in footer with self-names
//     (English · Tagalog · Sugbuanon).
//
// TODO(design-direction): swap placeholder visuals — chaos collage, hero
//   photographic background, coverage SVG basemap, readiness tile covers,
//   dashboard preview — for Filipino-luxe photography and final
//   illustration per owner's art direction. Skeleton-phase only.

const HOME_TITLE = 'Wedding Suppliers & Supplies Philippines';
const HOME_DESCRIPTION =
  "Setnayan is the only Filipino-built platform with real operating tools for both sides — from your guest list to your same-day highlight reel. Built in the Philippines.";

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
  },
  twitter: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

// Marketing home is rendered at build time and served straight from the CDN
// edge — no per-request SSR, no auth roundtrip, no serverless cold start.
// TTFB drops from ~300 ms (Singapore edge bouncing to US-East compute) to
// ~30 ms (edge cache hit). The signed-in → /dashboard redirect that used
// to live in this file moved to middleware.ts so that this page stays
// statically pre-rendered for the 95%+ of visitors who arrive logged out.
//
// `site_widgets` is fetched via the stateless service-role client (no
// cookies, no headers — neither would survive `force-static`). Admin edits
// land via /api/v1/admin/site-widgets/* which already call
// `revalidatePath('/')`, so the static HTML refreshes on the next request
// after a toggle / reorder. `revalidate = false` means the cache is
// otherwise indefinite — the on-demand invalidation is the sole trigger.
export const dynamic = 'force-static';
export const revalidate = false;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

const HOMEPAGE_JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Setnayan',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon-512.svg`,
      description:
        'Filipino-first wedding and life-events platform. Verified Philippine wedding suppliers and supplies with transparent PHP pricing.',
      areaServed: { '@type': 'Country', name: 'Philippines' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: 'Setnayan',
      inLanguage: 'en-PH',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/vendors?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_URL}/`,
        },
      ],
    },
  ],
};

// Widget-id → React component. The renderer iterates `site_widgets` in
// display_order, skips rows whose `is_enabled` is false, and renders the
// matched component. Keys MUST stay in sync with the seed in
// supabase/migrations/20260515010000_site_widgets.sql + the drift-fix
// migration 20260521100000_iteration_0015_site_widgets_home_drift_fix.sql.
// Unknown ids (rows added in the DB without a matching component) render
// as null so a partially-applied migration can't break the page.
const COMPONENT_BY_WIDGET_ID: Record<string, ComponentType> = {
  home_announcement_bar: AnnouncementBar,
  home_browse_strip: BrowseStrip,
  home_hero: Hero,
  home_real_numbers: RealNumbers,
  home_chaos: Chaos,
  home_two_sides: TwoSides,
  home_maria_juan: MariaJuan,
  home_in_app_services: InAppServices,
  home_vendor_compat: VendorCompat,
  home_transparent_pricing: TransparentPricing,
  home_readiness_board: ReadinessBoard,
  home_coverage_map: CoverageMap,
  home_dual_cta_footer: ConversionModule,
  home_platforms: AvailableEverywhere,
};

// Last-resort widget order used when the `site_widgets` fetch fails — most
// commonly during `next build` runs without `SUPABASE_SERVICE_ROLE_KEY`
// (the CI `production build` job uses placeholder env vars per ci.yml; same
// shape can hit preview deploys with un-provisioned secrets). Keeping the
// fallback identical to the seed means a failed fetch produces the exact
// same HTML as a healthy fetch — the public site stays up; only the
// admin's toggle / reorder ability is temporarily inert until the next
// successful render with a working DB. Order matches the seed in
// 20260521100000_iteration_0015_site_widgets_home_drift_fix.sql.
const FALLBACK_HOME_WIDGET_IDS: ReadonlyArray<string> = [
  'home_announcement_bar',
  'home_browse_strip',
  'home_hero',
  'home_real_numbers',
  'home_chaos',
  'home_two_sides',
  'home_maria_juan',
  'home_in_app_services',
  'home_vendor_compat',
  'home_transparent_pricing',
  'home_readiness_board',
  'home_coverage_map',
  'home_dual_cta_footer',
  'home_platforms',
];

type RenderWidget = { widget_id: string };

async function loadHomeWidgets(): Promise<ReadonlyArray<RenderWidget>> {
  try {
    const supabase = createAdminClient();
    const rows = await fetchWidgetsForPage(supabase, 'home');
    return rows.filter((w) => w.is_enabled);
  } catch (err) {
    // Two scenarios land here:
    //   1. Build-time render with missing env vars (CI's production-build
    //      job, preview deploys without secrets, local `next build` without
    //      `.env.production.local`). `createAdminClient` throws.
    //   2. Runtime regen after admin edit with a flaky network / DB blip.
    // Either way the public homepage must stay up — fall back to the
    // hardcoded seed order so SSR HTML is identical to the healthy path.
    console.warn(
      '[home] site_widgets fetch failed; rendering hardcoded fallback:',
      err instanceof Error ? err.message : err,
    );
    return FALLBACK_HOME_WIDGET_IDS.map((widget_id) => ({ widget_id }));
  }
}

export default async function HomePage() {
  // Signed-in viewers are redirected to /dashboard by middleware.ts
  // before this component runs, so this body only renders for anonymous
  // visitors. Keep it free of `cookies()`, `headers()`, or any other
  // dynamic API — adding one would silently revert this route to
  // per-request SSR and undo the TTFB win.
  const enabled = await loadHomeWidgets();

  // Announcement strip pins above SiteHeader when enabled regardless of
  // its DB display_order — a banner that drifts mid-page reads as broken
  // UX. The editor can still toggle it on/off; reordering it within the
  // page is a no-op for layout.
  const hasAnnouncement = enabled.some(
    (w) => w.widget_id === 'home_announcement_bar',
  );
  const bodyWidgets = enabled.filter(
    (w) => w.widget_id !== 'home_announcement_bar',
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOMEPAGE_JSONLD) }}
      />
      <main className="min-h-dvh">
        {hasAnnouncement ? <AnnouncementBar /> : null}

        <SiteHeader />

        {bodyWidgets.map((w) => {
          const Component = COMPONENT_BY_WIDGET_ID[w.widget_id];
          if (!Component) return null;
          return <Component key={w.widget_id} />;
        })}

        <SiteFooter />
      </main>

      {/* Cross-cutting: sticky thumb-zone CTA (mobile only).
          Loaded via a thin client wrapper that calls `next/dynamic({
          ssr: false })` — the widget is `lg:hidden`, so desktop visitors
          (lighthouse + most SEO crawlers) never need its JS, and even
          mobile users only need it after hydration. */}
      <DynamicStickyMobileCTA />
    </>
  );
}
