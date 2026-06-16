/**
 * Homepage · / — HERO → "tap to learn more" → "what you get".
 *
 * The hero is the admin-uploaded scroll-scrub video (HeroVideoScrub) when one
 * is published, falling back to the default keynote hero otherwise — see
 * lib/hero-video.ts + _sections.tsx Hero().
 *
 * COMPOSITION (the top Nav is NOT here — it's the ONE persistent site-wide
 * nav mounted in the root layout via SiteChrome, so it survives navigations;
 * see _components/marketing/site-chrome.tsx):
 *   1. Hero           — full-screen scroll-scrub video → end-of-scroll CTA
 *   2. PostHeroReveal — gates the content below: at the hero end the page LOCKS
 *                       (the collapsed content makes the hero end the page
 *                       bottom), a "Tap to learn more ↓" pill fades in, and a
 *                       tap expands + scrolls into:
 *                         • WhatYouGet — the "A Place for Each" narrative
 *                           (how Setnayan helps you · free-first · price-free)
 *                         • SiteFooter
 *
 * 2026-06-14 (owner): after the hero, answer "how does this help me?" in depth —
 * you create + run the whole wedding free, add paid services only if you want
 * more. "What you get" was pulled from the top nav (this page IS it now).
 * Earlier hero-only directive (PromoBar + ProblemSection + … + Footer removed)
 * is superseded for everything BELOW the hero; those section components still
 * live in _sections.tsx for other pages.
 *
 * KEPT INTENTIONALLY (invisible, no visual footprint): GEO/SERP metadata + the
 * WebSite + SoftwareApplication JSON-LD graph, so AI answer engines + search
 * cards keep their extractable surface. force-dynamic stays because Hero()
 * reads the published hero-video row (createAdminClient) + resolves frame URLs
 * per request.
 */

import { Hero } from '@/app/_components/marketing/_sections';
import { PostHeroReveal } from '@/app/_components/marketing/PostHeroReveal';
import { WhatYouGet } from '@/app/_components/marketing/WhatYouGet';
import { OurStoryTeaser } from '@/app/_components/marketing/OurStory';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';

// GEO Phase G2 (2026-05-28) — brand-first title + value-prop description.
// Carried forward from prior page.tsx so AI answer engines + SERP cards
// keep extracting the same brand + price + 0% commission signals. Pricing
const HOME_TITLE = 'Setnayan · Filipino wedding planning + verified vendors';
const HOME_DESCRIPTION =
  'Filipino-first wedding planning. Free to start. Verified vendor marketplace. 0% commission. Plan your whole wedding in one place.';

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

// Per-request rendering: Hero() reads the published hero-video row via
// createAdminClient and resolves frame URLs (presigned per render) — so the
// page must render per request, not at build time. force-dynamic also keeps
// the CI build from hitting the createAdminClient "missing service key" throw.
// Trade-off accepted: the homepage loses static CDN caching. (Was force-static.)
export const dynamic = 'force-dynamic';

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// Homepage JSON-LD graph — RESTORED 2026-06-13. The v2.1 marketing port
// (e0a739b8) dropped the WebSite + SoftwareApplication graph this file's header
// (lines 40-42) still claims to emit; only the layout-level basic Organization
// survived. Consequences: the homepage stopped naming any product to AI answer
// engines (so they describe Setnayan as a generic "guest list + marketplace"
// tool), and the site-wide `${SITE_URL}/#website` node that /about references via
// `isPartOf` was left dangling (defined nowhere). This restores both: the
// canonical WebSite node + a SoftwareApplication whose featureList enumerates the
// differentiated capture/media layer (Papic, Panood, Setnayan AI, Pakanta,
// Animated Monogram) so ChatGPT / Perplexity / Claude / Gemini ground on the moat.
// Facts only — no SKU prices (those drift; /pricing is the source of truth); the
// free couple baseline is expressed as a single ₱0 Offer.
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: `${SITE_URL}/`,
  name: 'Setnayan',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
};

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  name: 'Setnayan',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web, iOS, Android, macOS, Windows',
  inLanguage: 'en-PH',
  publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
  description:
    "The Philippines-first wedding platform. Couples plan free, then add the moments that set the day apart — Papic guest photo-and-video capture with QR-tagged galleries and personal reels, Panood livestream on the event page, the Setnayan AI planner, a custom Pakanta song, and an Animated Monogram. 0% commission on verified vendor bookings.",
  featureList: [
    // 2026-06-13 reprice scrub (Pricing.md § 00.D): RSVP is a paid SKU —
    // the "Free" prefix stays only on tools the ₱0 tier actually includes.
    'Guest list & RSVP management (guest list free with every account)',
    'Seating chart editor (free)',
    'Budget tracker with payment-deadline calendar export (free)',
    'Pakulay mood board (free)',
    'Personal event website with branded QR invitations',
    'Papic — guests’ phones become a coordinated photo-and-video crew, with QR-tagged galleries and per-guest personal highlight reels',
    'Panood — day-of livestream embedded on the event website',
    'Setnayan AI — assisted planner that drafts timelines and matches verified vendors',
    'Pakanta — a custom Filipino-style wedding song produced for the couple',
    'Animated Monogram — a bespoke monogram + animation across invites, website, and signage',
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

export default function HomePage() {
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
      <main className="bg-[var(--m-paper)] text-[var(--m-ink)]">
        <Hero />
        <PostHeroReveal>
          <WhatYouGet />
          <OurStoryTeaser />
          <SiteFooter />
        </PostHeroReveal>
      </main>
    </>
  );
}
