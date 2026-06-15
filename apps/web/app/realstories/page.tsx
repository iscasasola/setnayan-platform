import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import { ALL_REAL_WEDDINGS } from '@/lib/real-weddings';
import { loadPublishedShowcases } from '@/lib/showcase-db';
import { RealStoriesGallery, type GalleryItem } from './_components/gallery';

// /realstories — public Real Weddings showcase index (iteration 0046).
//
// A "wall of living front pages": every published editorial is a magazine
// cover, organised by a dedup cascade (Cover → Most loved → Just published →
// Archive, no repeats) with search, and a 5-second hero clip plays live on a
// ping-pong loop where a couple chose one. See _components/gallery.tsx.
//
// Real, consent-gated editorials (loadPublishedShowcases — couples who opted in,
// past the T+30d grace window) take priority and link to each couple's own
// canonical editorial at /[slug] (0002 Phase 4 — never duplicated here). Until
// any real wedding qualifies (first = the founder's Dec 2026 wedding), the page
// falls back to curated, clearly-labelled SAMPLES (lib/real-weddings.ts) so the
// surface is live and gives SEO a real page. DB-backed → ISR, not static.

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Real weddings · Setnayan',
  description:
    'Real Filipino weddings, told by the couples who lived them — browse by ceremony type, venue, and theme. Preview a sample showcase now; real couple editorials begin December 2026 with explicit consent per RA 10173.',
  alternates: { canonical: '/realstories' },
  keywords: [
    'real Filipino weddings',
    'Philippines wedding inspiration',
    'Setnayan real weddings',
    'Filipino wedding photos',
    'wedding editorial Philippines',
    'Filipino wedding stories',
  ],
  openGraph: {
    title: 'Real weddings · Setnayan',
    description:
      'Real Filipino weddings, told by the couples who lived them. Preview a sample showcase now; real editorials begin December 2026.',
    url: '/realstories',
  },
};

// DB-backed (consent-gated showcases) → ISR. Best-effort loader degrades to the
// sample, so the page always renders even without DB access.
export const revalidate = 3600;

export default async function WeddingsIndexPage() {
  // Real consent-gated showcases take priority; the samples are the fallback
  // shown ONLY until a real wedding is uploaded (owner-locked behaviour).
  const showcases = await loadPublishedShowcases();
  const showingSamples = showcases.length === 0;

  const items: GalleryItem[] = showingSamples
    ? ALL_REAL_WEDDINGS.map((w) => ({
        href: `/realstories/${w.slug}`,
        coupleNames: w.coupleNames,
        metaLine: [w.ceremonyType, w.city].filter(Boolean).join(' · '),
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
          `${w.coupleNames} ${w.city} ${w.ceremonyType} ${w.venueSetting} ${w.theme} ${w.excerpt}`.toLowerCase(),
      }))
    : showcases.map((s) => ({
        href: s.href,
        coupleNames: s.coupleNames,
        metaLine: [s.city, s.dateLabel].filter(Boolean).join(' · ') || 'Real wedding',
        city: s.city,
        palette: s.monogramColor ? [s.monogramColor] : ['#6B4E3D'],
        heroImageUrl: s.heroImageUrl,
        heroVideoUrl: s.heroVideoUrl,
        featureRank: s.featureRank,
        publishedSort: s.eventDate ?? '',
        isSample: false,
        searchText: `${s.coupleNames} ${s.city ?? ''} ${s.dateLabel ?? ''}`.toLowerCase(),
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
    name: 'Real weddings · Setnayan',
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
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Real weddings',
        item: `${SITE_URL}/realstories`,
      },
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
            Real Filipino weddings, told by the couples who lived them.
          </h1>
          <p className="text-base text-ink/65">
            {showingSamples ? (
              <>
                Real couple editorials begin December 2026 — published from each
                couple&rsquo;s own wedding page, with their consent. Here&rsquo;s a
                set of samples to show how a wedding looks once it&rsquo;s told on
                Setnayan.
              </>
            ) : (
              <>
                Real Filipino weddings, published from each couple&rsquo;s own
                wedding page with their consent — their story, their photos, their
                vendor team, and the day as it actually unfolded.
              </>
            )}
          </p>
        </div>

        <RealStoriesGallery items={items} />

        <div className="mt-16 rounded-3xl border border-ink/10 bg-white/60 p-7 text-center sm:p-10">
          <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Your wedding could be the next one here.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-base text-ink/65">
            Plan it on Setnayan, and your wedding page becomes your story —
            published when you&rsquo;re ready, with your photos, your team, and the
            day as it actually unfolded.
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
