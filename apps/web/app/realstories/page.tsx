import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import { ALL_REAL_WEDDINGS } from '@/lib/real-weddings';
import { loadPublishedShowcases } from '@/lib/showcase-db';
import { RealStoriesGallery, type GalleryItem } from './_components/gallery';

// /realstories — Real Stories index (iteration 0046).
//
// "A wall of living front pages": every published editorial is a newspaper
// cover with its Chronicle nameplate, organised by the dedup cascade (Cover
// → Most loved → Just published → Archive). Event type filter chips let
// visitors browse by milestone (Wedding, Debut, Anniversary, Graduation,
// Reunion, …). A search bar covers the full haystack.
//
// Covers ALL Filipino life milestones, not just weddings. The data model is
// unchanged (events table), but `eventType` is surfaced as the primary
// browsing axis on this page.
//
// Real, consent-gated editorials (loadPublishedShowcases) take priority and
// link to each person's canonical editorial at /[slug] (0002 Phase 4). Until
// any real editorial qualifies (first = the founder's Dec 2026 wedding), the
// page falls back to curated, clearly-labelled SAMPLES. DB-backed → ISR.

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Real stories · Setnayan',
  description:
    'Real Filipino weddings, debuts, anniversaries, graduations, and reunions — every major life milestone told in full, by the people who were there. Sample showcases now live; real editorials begin December 2026 with explicit consent per RA 10173.',
  alternates: { canonical: '/realstories' },
  keywords: [
    'real Filipino weddings',
    'Filipino debut stories',
    'Filipino anniversary celebration',
    'Philippines life milestones',
    'Setnayan real stories',
    'Filipino wedding editorial',
    'wedding stories Philippines',
  ],
  openGraph: {
    title: 'Real stories · Setnayan',
    description:
      'Real Filipino life milestones — weddings, debuts, anniversaries, and more — told in full by the people who were there. Sample showcases now live; real editorials begin December 2026.',
    url: '/realstories',
  },
};

// DB-backed (consent-gated showcases) → ISR. Degrades to samples gracefully.
export const revalidate = 3600;

export default async function RealStoriesIndexPage() {
  const showcases = await loadPublishedShowcases();
  const showingSamples = showcases.length === 0;

  const items: GalleryItem[] = showingSamples
    ? ALL_REAL_WEDDINGS.map((w) => ({
        href: `/realstories/${w.slug}`,
        coupleNames: w.coupleNames,
        metaLine: [w.eventType, w.city].filter(Boolean).join(' · '),
        ceremonyType: w.ceremonyType,
        venueSetting: w.venueSetting,
        theme: w.theme,
        city: w.city,
        palette: [...w.palette],
        heroImageUrl: w.heroImageUrl ?? null,
        heroVideoUrl: w.heroVideoUrl ?? null,
        featureRank: w.featureRank ?? null,
        publishedSort: w.publishedAt,
        isSample: true,
        searchText:
          `${w.coupleNames} ${w.city} ${w.eventType} ${w.ceremonyType} ${w.venueSetting} ${w.theme} ${w.excerpt}`.toLowerCase(),
        eventType: w.eventType,
        witnessQuote: w.witnessQuote ?? null,
        witnessAttribution: w.witnessAttribution ?? null,
        services: w.services ?? null,
        editionNumber: w.editionNumber ?? null,
      }))
    : showcases.map((s) => ({
        href: s.href,
        coupleNames: s.coupleNames,
        metaLine: [s.city, s.dateLabel].filter(Boolean).join(' · ') || 'Real story',
        city: s.city,
        palette: s.monogramColor ? [s.monogramColor] : ['#6B4E3D'],
        heroImageUrl: s.heroImageUrl,
        heroVideoUrl: s.heroVideoUrl,
        featureRank: s.featureRank,
        publishedSort: s.eventDate ?? '',
        isSample: false,
        searchText: `${s.coupleNames} ${s.city ?? ''} ${s.dateLabel ?? ''}`.toLowerCase(),
        eventType: null,
        witnessQuote: null,
        witnessAttribution: null,
        services: null,
        editionNumber: null,
      }));

  const itemListElements = items.map((it, i) => ({
    '@type': 'ListItem' as const,
    position: i + 1,
    url: it.href.startsWith('http') ? it.href : `${SITE_URL}${it.href}`,
    name: it.city ? `${it.coupleNames} · ${it.city}` : it.coupleNames,
  }));

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Real stories · Setnayan',
    url: `${SITE_URL}/realstories`,
    inLanguage: 'en-PH',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
    mainEntity: { '@type': 'ItemList', itemListElement: itemListElements },
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Real stories', item: `${SITE_URL}/realstories` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Real stories
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            The front-page story of their life.
          </h1>
          <p className="text-base text-ink/65">
            {showingSamples ? (
              <>
                Every wedding, debut, anniversary, graduation, and reunion — told
                in full, by the people who were there. Real editorials begin
                December 2026. Here&rsquo;s a set of samples to show how each
                story looks when it&rsquo;s told on Setnayan.
              </>
            ) : (
              <>
                Real Filipino lives, published from each person&rsquo;s own
                Setnayan page with their consent — the day as it actually
                unfolded, written by the people who witnessed it.
              </>
            )}
          </p>
        </div>

        <RealStoriesGallery items={items} />

        <div className="mt-16 rounded-3xl border border-ink/10 bg-white/60 p-7 text-center sm:p-10">
          <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Your story could be the next one here.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-base text-ink/65">
            Plan your event on Setnayan, and your page becomes your story —
            published when you&rsquo;re ready, with your photos, your team, and
            the day as it actually unfolded.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="button-primary inline-flex h-11 items-center justify-center px-6 text-sm font-semibold"
            >
              Start planning · free
            </Link>
            <Link
              href="/explore"
              className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 px-6 text-sm font-medium text-ink hover:bg-ink/5"
            >
              Browse vendors
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
