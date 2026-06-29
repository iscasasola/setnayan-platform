/**
 * Homepage · / — the ELN-style reskin (owner-approved 2026-06-29).
 *
 * REPLACES the prior Hero → PostHeroReveal → FeaturesNarrative composition with
 * the cinematic no-scroll gate + 5-pillar dock + interactive pillar widgets +
 * Real Stories + kinetic ticker + the four nav overlays, ported faithfully from
 * the prototype `03_Strategy/Home_ELN_Reskin_2026-06-28.html`. The design
 * intentionally overrides the warm-Alabaster + Instrument-Serif locks FOR THE
 * HOMEPAGE ONLY — everything is scoped under `.home-reskin` / `.home-reskin-ov`
 * so no other surface changes.
 *
 * The persistent SiteChrome top-nav is suppressed on `/` (see site-chrome.tsx)
 * because the reskin renders its own floating glass nav.
 *
 * PRESERVED (no visual footprint):
 *   • GEO/SERP metadata + the WebSite + SoftwareApplication JSON-LD graph, so AI
 *     answer engines + search cards keep their extractable surface.
 *   • The cron-free admin morning-digest flush via after() — it piggybacks on
 *     the homepage's guaranteed public traffic.
 *   • force-dynamic — getHomePricingData() reads the live catalog per request.
 *
 * PRICING IS CATALOG-DRIVEN, NOT HARDCODED: getHomePricingData() resolves every
 * displayed price from platform_retail_catalog_v2 (lib/v2-catalog.ts) so admin
 * price edits propagate without a redeploy. See _components/home/pricing-data.ts.
 */

import { after } from 'next/server';
import './_components/home/home-reskin.css';
import { HomeReskin } from './_components/home/HomeReskin';
import { getHomePricingData } from './_components/home/pricing-data';
import { fetchPublishedBackgroundVideos } from '@/lib/background-videos';
import { runAdminDigestFlush } from '@/lib/admin/digest-flush';
import { ANY_OAUTH_ENABLED } from './_components/oauth-button-row';
import { getClientShell } from '@/lib/request-platform';

// GEO Phase G2 (2026-05-28) — brand-first title + value-prop description.
// Carried forward so AI answer engines + SERP cards keep extracting the same
// brand + price + 0% commission signals.
const HOME_TITLE = 'Setnayan · Plan your Filipino wedding free — keep it forever';
const HOME_DESCRIPTION =
  'Plan your whole Filipino wedding free — then keep every photo, video, and memory in one place, for life. Verified vendor marketplace, 0% commission.';

export const metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: '/' },
  keywords: [
    'Filipino wedding planning',
    'Philippines wedding vendors',
    'wedding marketplace Manila',
    'Filipino wedding app',
    'Setnayan',
    'verified Filipino vendors',
    "Set na 'yan",
    'Filipino wedding software',
  ],
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

// Per-request rendering: getHomePricingData() reads the live catalog via
// createAdminClient. force-dynamic keeps the CI build from hitting the
// "missing service key" throw and keeps prices fresh without a redeploy.
export const dynamic = 'force-dynamic';

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// Homepage JSON-LD graph — the canonical WebSite node + a SoftwareApplication
// whose featureList enumerates the differentiated capture/media layer so
// ChatGPT / Perplexity / Claude / Gemini ground on the moat. Facts only — no SKU
// prices (those drift; /pricing is the source of truth); the free couple
// baseline is expressed as a single ₱0 Offer.
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: 'Setnayan',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  // Sitelinks search box — lets Google surface a search field for the brand
  // SERP, pointed at the vendor-discovery surface.
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/explore?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  url: `${SITE_URL}/`,
  name: 'Setnayan',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web, iOS, Android, macOS, Windows',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
  description:
    "The Philippines-first wedding platform. Couples plan free, then add optional paid upgrades that set the day apart — Papic guest photo-and-video capture with QR-tagged galleries and personal reels, Panood livestream on the event page, the Setnayan AI planner, a custom Pakanta song, and an Animated Monogram, each priced individually in PHP. 0% commission on verified vendor bookings.",
  featureList: [
    // 2026-06-13 reprice scrub (Pricing.md § 00.D): RSVP is a paid SKU —
    // the "Free" prefix stays only on tools the ₱0 tier actually includes.
    'Guest list & RSVP management (guest list free with every account)',
    'Seating chart editor (free)',
    'Budget tracker with payment-deadline calendar export (free)',
    'Pakulay mood board (free)',
    'Personal event website with branded QR invitations',
    'Papic — guests’ phones become a coordinated photo-and-video crew, with QR-tagged galleries and per-guest personal highlight reels (paid add-on)',
    'Panood — day-of livestream embedded on the event website (paid add-on)',
    'Setnayan AI — assisted planner that drafts timelines and matches verified vendors (paid add-on)',
    'Pakanta — a custom Filipino-style wedding song produced for the couple (paid add-on)',
    'Animated Monogram — a bespoke monogram + animation across invites, website, and signage (paid add-on)',
    'Verified Filipino wedding vendor marketplace with 0% commission on every booking',
  ],
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'PHP',
    description:
      'Free baseline planning tools for couples; premium services priced individually in PHP.',
  },
};

export default async function HomePage() {
  // Catalog-driven pricing for the Prices overlay (no hardcoded numbers).
  const pricing = await getHomePricingData();

  // OAuth visibility for the Sign-in overlay — same shell gating as /login:
  // shown on web + the rebuilt desktop app (system-browser loopback OAuth),
  // hidden on the mobile/older-native shell where Google refuses OAuth in an
  // embedded WebView. Desktop renders the loopback variant; web the
  // server-action row. Resolved here (server) and threaded down because the
  // overlay is a client component that can't read headers()/cookies().
  const shell = await getClientShell();
  const showOAuth = ANY_OAUTH_ENABLED && shell !== 'mobile';
  const oauth = { show: showOAuth, desktop: showOAuth && shell === 'desktop' };

  // Admin-uploaded homepage background videos (/admin/background-videos):
  // slot 0 = the main cinematic hero backdrop; slots 1-5 = the five pillar
  // dock "icon" videos, in PILLAR_HEROES order (Ala Ala · Likhaan · Planuhan ·
  // Surian · Tiangge). Each is null until its slot is published → the dock
  // tile / hero scene falls back to its gradient. See lib/background-videos.ts.
  const bg = await fetchPublishedBackgroundVideos();
  const bgVideos = {
    main: bg.main?.url ?? null,
    pillars: [1, 2, 3, 4, 5].map((slot) => bg.pillars.find((p) => p.slot === slot)?.url ?? null),
  };

  // Admin morning-digest flush — cron-free, piggybacks on the homepage's
  // guaranteed public traffic so the digest reaches an admin who isn't in the
  // console even on a quiet day. Throttled + single-claim + gated OFF by
  // default internally; uses the service-role client (no cookies → safe in
  // after()). See lib/admin/digest-flush.ts.
  after(() => runAdminDigestFlush().catch(() => {}));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <HomeReskin pricing={pricing} bgVideos={bgVideos} oauth={oauth} />
    </>
  );
}
