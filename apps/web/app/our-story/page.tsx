/**
 * /our-story — the "Living Memories" brand manifesto page.
 *
 * Owner 2026-06-14: "I want to share this idea with the world … embrace this new
 * concept of memories." The umbrella story over Papic / Panood / Kwento /
 * Editorial — memory-keeping evolved from paper albums → digital albums →
 * LIVING memories. The page body lives in OurStoryManifesto so the homepage can
 * route into it (OurStoryTeaser) without duplicating copy.
 *
 * Server component, statically generated (no per-request data). The nav "Our
 * story" link now points here (was /about — the company/brand page; this is the
 * product-philosophy page).
 */

import { OurStoryManifesto } from '@/app/_components/marketing/OurStory';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';

export const dynamic = 'force-static';
export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '');

const PAGE_TITLE = 'A new way to remember · Setnayan';
const PAGE_DESCRIPTION =
  'Your wedding was never still. We used to keep weddings in albums — paper, then digital. Setnayan keeps them alive: the moments you missed, the people who couldn’t come, and the stories your guests tell, in one living page you keep forever.';
const OG_IMAGE = `${SITE_URL}/api/og/manifesto`;

export const metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/our-story' },
  keywords: [
    'a new way to remember',
    'living wedding memories',
    'Filipino wedding memories',
    'wedding livestream Philippines',
    'guest photo capture wedding',
    'Setnayan',
    "Set na 'yan",
  ],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/our-story',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Setnayan — a new way to remember' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Our story', item: `${SITE_URL}/our-story` },
  ],
};

const aboutPageJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  '@id': `${SITE_URL}/our-story#aboutpage`,
  url: `${SITE_URL}/our-story`,
  name: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  inLanguage: 'en-PH',
  isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
  about: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
};

export default function OurStoryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      <main className="bg-[var(--m-paper)] text-[var(--m-ink)]">
        <OurStoryManifesto />
        <SiteFooter />
      </main>
    </>
  );
}
