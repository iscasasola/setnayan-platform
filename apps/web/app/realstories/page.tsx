import Link from 'next/link';
import type { Metadata } from 'next';
import { ALL_REAL_WEDDINGS } from '@/lib/real-weddings';
import { loadPublishedShowcases } from '@/lib/showcase-db';
import {
  loadFeaturedChapters,
  loadChapterCutsForEvents,
  loadChapterSearchMeta,
} from '@/lib/storytellers';
import { RealStoriesGallery, type GalleryItem } from './_components/gallery';
import { StorytellersShelf } from './_components/storytellers-shelf';
import {
  StoriesSearch,
  type EditorialSearchItem,
  type ChapterSearchItem,
} from './_components/stories-search';
import { STORIES_SEARCH_MIN_POOL } from '@/lib/stories-search-config';

// /realstories — THE single public stories hub (iteration 0046 + Storytellers
// PR-D, council verdict 2026-07-16): two named, visually distinct shelves on
// one page.
//
// 1 · EDITORIAL SHELF — "a wall of living front pages": every published
// editorial is a newspaper cover with its Chronicle nameplate, organised by
// the dedup cascade (Cover → Most loved → Just published → Archive). Event
// type filter chips let visitors browse by milestone; a search bar covers the
// full haystack. Real, consent-gated editorials (loadPublishedShowcases) take
// priority and link to each person's canonical editorial at /[slug] (0002
// Phase 4). Until any real editorial qualifies (first = the founder's Dec 2026
// wedding), the page falls back to curated, clearly-labelled SAMPLES.
//
// 2 · STORYTELLERS SHELF — "From Our Storytellers" (#storytellers): ONLY
// owner-featured creator chapters (deny-by-default — publish ≠ listed), in
// their own byline-forward tile grammar, linking to each chapter's canonical
// /u/[slug]/c/[id] page (which stays noindex; the hub keeps the SEO equity).
// ZERO featured chapters ⇒ the shelf renders NOTHING — this page today is
// byte-identical to its pre-PR-D self until the owner's first Feature click.
//
// Cross-rails ride the creator_chapters.event_id join: editorial cards gain a
// "Watch the storyteller's cut" chip; chapter tiles gain "Read the editorial".
// DB-backed → ISR.

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// Hub identity reworded ONCE for both voices (Storytellers verdict §3, owner
// decision #2 signed 2026-07-16): editorial features written by Setnayan AND
// chapters told by our storytellers. Chapter detail pages stay noindex — only
// the hub's identity widens; all creator SEO equity concentrates here.
const HUB_DESCRIPTION =
  'Real stories from real events — editorial features written by Setnayan, and chapters told by our storytellers. Filipino weddings, debuts, anniversaries, graduations, travels, and reunions, told in full by the people who were there.';

export const metadata: Metadata = {
  title: 'Real stories · Setnayan',
  description: HUB_DESCRIPTION,
  alternates: { canonical: '/realstories' },
  keywords: [
    'real Filipino weddings',
    'Filipino debut stories',
    'Filipino anniversary celebration',
    'Philippines life milestones',
    'Setnayan real stories',
    'Setnayan storytellers',
    'Filipino wedding editorial',
    'Filipino creator wedding video',
    'wedding stories Philippines',
  ],
  openGraph: {
    title: 'Real stories · Setnayan',
    description: HUB_DESCRIPTION,
    url: '/realstories',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Real stories · Setnayan',
    description: HUB_DESCRIPTION,
  },
};

// DB-backed (consent-gated showcases) → ISR. Degrades to samples gracefully.
export const revalidate = 3600;

// Load both shelves deep enough that the search display gate
// (STORIES_SEARCH_MIN_POOL) is actually reachable — two shelves capped at the
// default 24 could never sum past ~48. Harmless below the gate (there are a
// handful of items today), and it lets the editorial cascade show more editions.
const LOAD_LIMIT = 60;

export default async function RealStoriesIndexPage() {
  // Both shelves load in parallel; each degrades independently ([] on any
  // failure / pre-migration DB), so neither voice can break the other.
  const [showcases, featuredChapters] = await Promise.all([
    loadPublishedShowcases(LOAD_LIMIT),
    loadFeaturedChapters(LOAD_LIMIT),
  ]);
  // Cross-rail (editorial → chapter): "Watch the storyteller's cut" chips for
  // editorial cards whose event has a linked PUBLISHED chapter. A join over
  // creator_chapters.event_id — skipped gracefully when there's nothing to join.
  const chapterCutByEvent =
    showcases.length > 0
      ? await loadChapterCutsForEvents(showcases.map((s) => s.eventId))
      : new Map<string, string>();
  // Cross-rail (chapter → editorial): "Read the editorial" chips for chapter
  // tiles whose event has a consented published editorial — composed from the
  // showcases already loaded above (the shelf modules stay route-agnostic).
  const editorialHrefByEvent = new Map<string, string>(
    showcases.filter((s) => !s.isSample).map((s) => [s.eventId, s.href]),
  );
  // Fall back to the in-code curated samples only when the DB path is empty.
  const showingSamples = showcases.length === 0;
  // Truth-in-UI: the "published with their consent" header copy is only honest
  // once a REAL consented couple is on the page. The DB path now also includes
  // the curated SAMPLE event (badged "Sample"), so when EVERY DB card is a
  // sample we keep the samples framing in the header (the per-card "Sample"
  // badge already disambiguates each card either way).
  const hasRealStory = showcases.some((s) => !s.isSample);

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
        // Samples credit no marketplace vendors → no service facet values.
        serviceCategories: [],
      }))
    : showcases.map((s) => ({
        href: s.href,
        coupleNames: s.coupleNames,
        // Style-Twin Discovery — credited vendors tap through to /v/[slug].
        vendors: s.vendors,
        metaLine: [s.city, s.dateLabel].filter(Boolean).join(' · ') || 'Real story',
        city: s.city,
        palette: s.monogramColor ? [s.monogramColor] : ['#6B4E3D'],
        heroImageUrl: s.heroImageUrl,
        heroVideoUrl: s.heroVideoUrl,
        featureRank: s.featureRank,
        publishedSort: s.eventDate ?? '',
        // The DB path now includes the curated SAMPLE event (Maria & Jose),
        // which keeps its honest "Sample" badge — so carry the loader's flag
        // through instead of hardcoding false. Real consented editorials are
        // always isSample=false.
        isSample: s.isSample,
        searchText:
          `${s.coupleNames} ${s.city ?? ''} ${s.dateLabel ?? ''} ${s.serviceCategories.join(' ')}`.toLowerCase(),
        // Kept null so the below-gate Chronicle tile is byte-identical (no new
        // milestone pill). The Wedding milestone the search facet needs is
        // supplied only on the search items below (every consented editorial in
        // this loader is an events.event_type = 'wedding' row).
        eventType: null,
        witnessQuote: null,
        witnessAttribution: null,
        services: null,
        editionNumber: null,
        // Credited vendors' canonical categories → the service facet axis.
        serviceCategories: s.serviceCategories,
        // Cross-rail chip — the storyteller's cut of this same event, if any.
        storytellerCutHref: chapterCutByEvent.get(s.eventId) ?? null,
      }));

  // ── Stories SEARCH display gate (P4+ · volume-gated) ─────────────────────
  // The place/service/kind facet UI mounts ONLY when the already-public
  // featured+curated pool (editorials on the page + featured chapters) crosses
  // STORIES_SEARCH_MIN_POOL. Below it, the hub keeps its shelf layout — a search
  // box over a dozen items reads as a dead platform. Today: a handful of items
  // ⇒ gate closed ⇒ this whole block is inert and the render below is unchanged.
  const searchMode = items.length + featuredChapters.length >= STORIES_SEARCH_MIN_POOL;

  // Facet metadata (city + credited-vendor categories) for the featured
  // chapters — resolved ONLY in search mode, so the default render runs none of
  // these extra queries. Read-only over the same already-public pool.
  const chapterMeta = searchMode
    ? await loadChapterSearchMeta(
        featuredChapters.map((c) => ({ publicId: c.publicId, eventId: c.eventId })),
      )
    : null;

  const editorialSearchItems: EditorialSearchItem[] = items.map((it) => ({
    ...it,
    // Milestone facet: samples already carry their own eventType; real
    // consented editorials are all weddings (this loader's event_type filter),
    // so fall back to 'Wedding' when the tile-level pill was left off above.
    eventType: it.eventType ?? 'Wedding',
    serviceCategories: it.serviceCategories ?? [],
  }));
  const chapterSearchItems: ChapterSearchItem[] = featuredChapters.map((c) => {
    const meta = chapterMeta?.get(c.publicId);
    return {
      ...c,
      city: meta?.city ?? null,
      serviceCategories: meta?.serviceCategories ?? [],
      editorialHref: c.eventId ? editorialHrefByEvent.get(c.eventId) ?? null : null,
    };
  });

  const itemListElements = items.map((it, i) => ({
    '@type': 'ListItem' as const,
    position: i + 1,
    url: it.href.startsWith('http') ? it.href : `${SITE_URL}${it.href}`,
    name: it.city ? `${it.coupleNames} · ${it.city}` : it.coupleNames,
  }));

  // JSON-LD covers both voices (verdict §3): the CollectionPage description is
  // the reworded hub identity. The ItemList stays editorial-only on purpose —
  // chapter detail pages are noindex, so they never enter the structured list.
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Real stories · Setnayan',
    description: HUB_DESCRIPTION,
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
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            The front-page story of their life.
          </h1>
          <p className="text-base text-ink/65">
            {!hasRealStory ? (
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

        {searchMode ? (
          /* At volume — one faceted browser over BOTH shelves (place · service
             · milestone). Editorial results keep the Chronicle tile; chapter
             results keep the byline tile — spanning facets, distinct voices. */
          <StoriesSearch
            editorials={editorialSearchItems}
            chapters={chapterSearchItems}
          />
        ) : (
          <>
            <RealStoriesGallery items={items} />

            {/* "From Our Storytellers" — renders NOTHING (not even a heading)
                with zero featured chapters; the editorial cascade above is
                untouched. */}
            <StorytellersShelf
              items={featuredChapters}
              editorialHrefByEvent={editorialHrefByEvent}
            />
          </>
        )}

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
    </>
  );
}
