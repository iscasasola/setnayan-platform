import Link from 'next/link';
import type { Metadata } from 'next';
import { ALL_REAL_WEDDINGS } from '@/lib/real-weddings';
import { loadPublishedShowcases } from '@/lib/showcase-db';
import {
  loadFeaturedChapters,
  loadChapterCutsForEvents,
  loadChapterSearchMeta,
  type ChapterCut,
} from '@/lib/storytellers';
import { RealStoriesGallery, type GalleryItem } from './_components/gallery';
import {
  StoriesSearch,
  type EditorialSearchItem,
  type ChapterSearchItem,
} from './_components/stories-search';
import { STORIES_SEARCH_MIN_POOL } from '@/lib/stories-search-config';
import { sampleStoriesAreShowing } from '@/lib/sample-stories';
import { publishedBlogArticles } from '@/lib/blog';
import { AppRailShell } from '@/app/_components/frontdoor/app-rail-shell';

/*
  🔴 force-dynamic IS LOAD-BEARING. This page mounts the shared shell, which
  reads the session. It carried `revalidate = 3600` — ISR, not force-static, so
  Trap 1 (the silent empty-cookie-jar) does not apply here — but a session read
  would de-opt it at request time anyway, which is the same cost paid
  accidentally instead of on purpose. Declared, so it is a decision.
  ⚠ A LAYOUT CANNOT SET THIS: `dynamic` resolves nested-most-wins and the
  children traversal completes before a parent layout's component is created.
  It is one edit per page and missing one is invisible.
*/
export const dynamic = 'force-dynamic';

// /realstories — THE single public stories hub. ONE SHELF, THREE VOICES
// (owner decision 2026-08-13, "option B" — this block described TWO named
// shelves until that day, and a third rail underneath).
//
// Everything a person can read here shares one shelf, and the CARD says which
// kind it is:
//
//   · EDITORIALS — "a wall of living front pages": each published editorial is
//     a newspaper cover with its Chronicle nameplate, organised by the dedup
//     cascade (Cover → Most loved → Just published → Archive). Consent-gated
//     (loadPublishedShowcases), linking to each person's canonical editorial
//     at /[slug]. Until a real one qualifies the page falls back to curated,
//     clearly-labelled SAMPLES.
//   · STORYTELLERS' CHAPTERS — ONLY owner-featured (deny-by-default: publish ≠
//     listed), in their byline-forward tile grammar, linking to the canonical
//     /u/[slug]/c/[id] page (noindex; the hub keeps the SEO equity). Zero
//     featured chapters ⇒ nothing renders, no empty heading.
//   · THE JOURNAL — published articles in the Journal's own photo-led card.
//
// 🔒 THE COUNCIL LOCK OF 2026-07-16 IS INTACT AND IS NOW GUARDED. The lock is
// that the voices never blur into ONE grammar; it is not that they need
// separate headings. All three render through their own shipped components,
// and `stories-one-shelf.test.ts` fails if any of them is redrawn here or if
// a card stops declaring its kind.
//
// Event-type chips + the search box cover the shelf; the chips are
// editorial+chapter only, because a Journal guide has a category and not an
// event type (see the gallery).
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
  'Stories from real events — editorial features written by Setnayan, and chapters told by our storytellers. Filipino weddings, debuts, anniversaries, graduations, travels, and reunions, told in full by the people who were there.';

export const metadata: Metadata = {
  title: 'Stories · Setnayan',
  description: HUB_DESCRIPTION,
  alternates: { canonical: '/realstories' },
  keywords: [
    'real Filipino weddings',
    'Filipino debut stories',
    'Filipino anniversary celebration',
    'Philippines life milestones',
    'Setnayan stories',
    'Setnayan storytellers',
    'Filipino wedding editorial',
    'Filipino creator wedding video',
    'wedding stories Philippines',
  ],
  openGraph: {
    title: 'Stories · Setnayan',
    description: HUB_DESCRIPTION,
    url: '/realstories',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stories · Setnayan',
    description: HUB_DESCRIPTION,
  },
};

// DB-backed (consent-gated showcases) → ISR. Degrades to samples gracefully.

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
      : new Map<string, ChapterCut>();
  // Cross-rail (chapter → editorial): "Read the editorial" chips for chapter
  // tiles whose event has a consented published editorial — composed from the
  // showcases already loaded above (the shelf modules stay route-agnostic).
  const editorialHrefByEvent = new Map<string, string>(
    showcases.filter((s) => !s.isSample).map((s) => [s.eventId, s.href]),
  );
  // Fall back to the in-code curated samples only when the DB path is empty.
  /*
    🚨 THIS LINE USED TO READ `showcases.length === 0`, AND IT HID NINE
    FINISHED PAGES.

    Prod holds ONE curated sample event in the database. That made
    `showcases.length` equal 1, so the page concluded it had stories and
    switched the entire in-code sample set off — while `sitemap-weddings.xml`
    went on handing all nine of their URLs to Google. Measured live
    2026-08-15: nine complete, well-written sample stories, reachable by URL,
    linked from nowhere on the site.

    🔑 A ROW IS NOT A STORY. The database's own sample is a published row and
    is NOT a real story; counting rows conflated the two. The rule is about
    REAL stories, so the count filters `isSample` first.

    The threshold is the owner's (2026-08-15): samples retire when five real
    stories are public. It lives in `lib/sample-stories.ts` because the sitemap
    must answer the same question — splitting it across two files is what
    produced the orphans above.
  */
  const realStories = showcases.filter((s) => !s.isSample);
  const showingSamples = sampleStoriesAreShowing(realStories.length);
  // Truth-in-UI: the "published with their consent" header copy is only honest
  // once a REAL consented couple is on the page. The DB path now also includes
  // the curated SAMPLE event (badged "Sample"), so when EVERY DB card is a
  // sample we keep the samples framing in the header (the per-card "Sample"
  // badge already disambiguates each card either way).
  const hasRealStory = realStories.length > 0;

  const dbItems: GalleryItem[] = showcases.map((s) => ({
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
      // milestone pill).
      //
      // ⚠ THE OLD REASON FOR THE `?? 'Wedding'` BELOW DIED ON 2026-08-15 and
      // this comment used to carry it: "every consented editorial in this
      // loader is an events.event_type = 'wedding' row". That was true only
      // while `showcase-db.ts` carried five `.eq('event_type','wedding')`
      // filters, and those were removed the same day — the owner ruled that
      // every kind of celebration gets an editorial, not just weddings. The
      // loader now returns debuts, graduations and reunions too.
      eventType: null,
      witnessQuote: null,
      witnessAttribution: null,
      services: null,
      editionNumber: null,
      // Credited vendors' canonical categories → the service facet axis.
      serviceCategories: s.serviceCategories,
      // Cross-rail chip — the storyteller's cut of this same event, if any.
      storytellerCutHref: chapterCutByEvent.get(s.eventId)?.href ?? null,
      storytellerCutHasVideo: chapterCutByEvent.get(s.eventId)?.hasVideo ?? false,
  }));
  const sampleItems: GalleryItem[] = ALL_REAL_WEDDINGS.map((w) => ({
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
  }));
  /*
    BOTH SHELVES WHILE THE SAMPLES ARE SHOWING.

    This used to be an either/or — the database path OR the curated set,
    never both — and that is what let one seeded row hide the whole sample
    library. Below the threshold the page shows what it actually has: every
    real story published so far AND the samples, so the first four real ones
    appear beside them instead of replacing them, and the fifth retires the
    samples on its own.
  */
  const items: GalleryItem[] = showingSamples
    ? [...dbItems, ...sampleItems]
    : dbItems;

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
    // Milestone facet: samples carry their own eventType and keep it.
    //
    // 🛑 THIS USED TO READ `it.eventType ?? 'Wedding'`, and on 2026-08-15 that
    // fallback turned into a LIE. It was written when `showcase-db.ts` refused
    // every non-wedding celebration in five places; those refusals were removed
    // the same day (owner: "each event they create will have an editorial not
    // just wedding"), so the first debut or graduation editorial to publish
    // would have been filed under Wedding — in the one control on this page
    // whose entire job is to say what KIND of celebration a story is.
    //
    // Null is the honest value while the loader does not read the column: an
    // unknown kind sits under "All" and joins no milestone, rather than
    // claiming the wrong one. ⏭ THE REAL REMEDY is for `loadPublishedShowcases`
    // to SELECT `events.event_type` and carry it on `PublishedShowcase` — it is
    // already in scope in every one of that loader's queries. Until then this
    // facet is incomplete, which is a smaller wrong than being confident and
    // incorrect. Harmless today either way: the facet UI is behind
    // STORIES_SEARCH_MIN_POOL and does not mount.
    eventType: it.eventType,
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
    name: 'Stories · Setnayan',
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
      { '@type': 'ListItem', position: 2, name: 'Stories', item: `${SITE_URL}/realstories` },
    ],
  };

  return (
    /*
      The shared shell — this page keeps its own <main> and <h1>; the doorway
      variant yields both. See `front-door-shell.tsx` for why `app` would be
      wrong here (no hamburger below 1024, and a wordmark pointing at a route
      that redirects a stranger to /login).
    */
    <AppRailShell variant="doorway">
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/*
        ─── THE COLUMN IS THE SHELL'S, NOT THIS PAGE'S ────────────────────────
        Owner, 2026-08-16, on a screenshot of Home beside this page: *"why is
        it on home, you fill the main body corner to corner while other pages
        are not?"*

        He was right, and it is the SAME complaint as 2026-08-14 ("ours look
        too big as compared to the proper sizing"), one page over. That one was
        fixed at the source: `.fd-col` was uncapped from 1064 to 1600 so the
        feed's cards stopped rendering 254px against YouTube's ~390. Home got
        the wide column. This page kept the `max-w-5xl` (1024px) it was written
        with back when it had no rail beside it — so inside a 1600px shell it
        painted a 1024px strip with ~280px of dead cream on each side, and Home
        → Stories read as two different products one rail-click apart.

        🔑 A PAGE THAT WEARS A SHARED SHELL MUST NOT RE-CAP THE SHELL'S COLUMN.
        `.fd-col` already caps at 1600 and centres; `.fd-main` already pays the
        gutter (24px, 16px below 1024). A second `mx-auto max-w-*` on top is
        not "safe extra" — it is a narrower answer to a question the shell has
        already answered, and it wins. The marketplace hit this exact wall and
        went further still (`bleed`), on the owner's word, in PR #655.

        ⚠ THE READING WIDTH IS NOT DELETED, IT MOVED DOWN A LEVEL. The intro
        below keeps `max-w-2xl` and the CTA keeps `max-w-xl`, because a
        1552px-wide line of prose is unreadable. What widens is the SHELF —
        which is the only thing on this page that wanted the room.
      */}
      <main className="w-full py-12 sm:py-16">
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
          /* ONE SHELF — owner decision 2026-08-13 ("option B"), taken on the
             drawn comparison in
             `prototypes/stories_page_one_shelf_or_two_2026-08-13.html`.

             The editorials, the storytellers' chapters and the Journal now
             share this one shelf, and each CARD says which kind it is. The
             two headed sections that used to follow — "From Our Storytellers"
             and "From our articles · practical guides" — are gone, not
             hidden.

             🔒 The council lock is intact: the three voices still render in
             their own grammars (Chronicle / byline / Journal card). What
             merged is the headings. `stories-one-shelf.test.ts` enforces it.

             ⚠ Articles are capped at 6 here, not 3. The old rail took 3
             because it was a footnote under the real content; on one shelf
             they ARE much of the content — 33 published against one sample
             story — and three would leave the shelf looking emptier than the
             archive actually is. */
          <RealStoriesGallery
            items={items}
            chapters={featuredChapters}
            articles={publishedBlogArticles().slice(0, 6)}
            editorialHrefByEvent={editorialHrefByEvent}
          />
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
    </AppRailShell>
  );
}
