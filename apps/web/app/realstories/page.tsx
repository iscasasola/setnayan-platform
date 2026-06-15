import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import {
  ALL_REAL_WEDDINGS,
  weddingTitle,
  type RealWedding,
} from '@/lib/real-weddings';
import { loadPublishedShowcases, type ShowcaseEntry } from '@/lib/showcase-db';

// /realstories — public Real Weddings showcase index (iteration 0046).
//
// Real, consent-gated editorials (loadPublishedShowcases — couples who opted in,
// past the T+30d grace window) take priority and link to each couple's own
// canonical editorial at /[slug] (0002 Phase 4 — never duplicated here). Until
// any real wedding qualifies (first = the founder's Dec 2026 wedding), the page
// falls back to the curated, clearly-labelled SAMPLE (lib/real-weddings.ts) so
// the surface is live and gives SEO a real page. DB-backed → ISR, not static.

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

// Sample card (RealWedding) — links to its editorial preview at /realstories/[slug].
function SampleCard({ wedding }: { wedding: RealWedding }) {
  return (
    <Link
      href={`/realstories/${wedding.slug}`}
      className="group flex flex-col rounded-2xl border border-ink/10 bg-white/50 p-5 transition hover:border-terracotta/40 hover:bg-white sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          {wedding.ceremonyType} &middot; {wedding.venueSetting}
        </span>
        {wedding.isSample ? (
          <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/50">
            Sample
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-ink group-hover:underline">
        {wedding.coupleNames}
      </h3>
      <p className="mt-0.5 text-sm text-ink/55">
        {wedding.city} &middot; {wedding.eventDateLabel}
      </p>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/65">
        {wedding.excerpt}
      </p>
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {wedding.palette.map((hex) => (
          <span
            key={hex}
            className="h-4 w-4 rounded-full ring-1 ring-ink/10"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </Link>
  );
}

// Featured real showcase — the admin-pinned hero slot (PR D · Real Stories
// featuring). Mirrors the sample featured-hero treatment, but links to the
// couple's own canonical /[slug] editorial and carries no "Sample" label
// (it's a real, consented wedding).
function RealHero({ entry }: { entry: ShowcaseEntry }) {
  const meta = [entry.city, entry.dateLabel].filter(Boolean).join(' · ');
  return (
    <Link
      href={entry.href}
      className="group mt-10 block overflow-hidden rounded-3xl border border-ink/10 bg-white/60 transition hover:border-terracotta/40 hover:bg-white"
    >
      {entry.monogramColor ? (
        <div
          className="h-24 w-full sm:h-32"
          style={{ backgroundColor: entry.monogramColor }}
          aria-hidden
        />
      ) : null}
      <div className="p-6 sm:p-9">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Featured · Real wedding
        </span>
        <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-ink group-hover:underline sm:text-3xl">
          {entry.coupleNames}
          {entry.city ? <> &middot; {entry.city}</> : null}
        </h2>
        {meta ? <p className="mt-2 text-base text-ink/65">{meta}</p> : null}
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta">
          Read the story →
        </span>
      </div>
    </Link>
  );
}

// Real wedding card (ShowcaseEntry) — links to the couple's canonical /[slug].
function RealCard({ entry }: { entry: ShowcaseEntry }) {
  const meta = [entry.city, entry.dateLabel].filter(Boolean).join(' · ');
  return (
    <Link
      href={entry.href}
      className="group flex flex-col rounded-2xl border border-ink/10 bg-white/50 p-5 transition hover:border-terracotta/40 hover:bg-white sm:p-6"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        Real wedding
      </span>
      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-ink group-hover:underline">
        {entry.coupleNames}
      </h3>
      {meta ? <p className="mt-0.5 text-sm text-ink/55">{meta}</p> : null}
      {entry.monogramColor ? (
        <div
          className="mt-4 h-4 w-12 rounded-full ring-1 ring-ink/10"
          style={{ backgroundColor: entry.monogramColor }}
          aria-hidden
        />
      ) : null}
      <span className="mt-4 inline-flex flex-1 items-end text-sm font-semibold text-terracotta">
        Read the story →
      </span>
    </Link>
  );
}

export default async function WeddingsIndexPage() {
  // Real consent-gated showcases take priority; the sample is the fallback shown
  // ONLY until a real wedding is uploaded (owner-locked behaviour).
  const showcases = await loadPublishedShowcases();
  const showingSamples = showcases.length === 0;
  const samples = ALL_REAL_WEDDINGS;
  const featured = samples.find((w) => w.featured) ?? samples[0];

  // Admin-featured hero (PR D · Real Stories featuring). loadPublishedShowcases
  // returns featured-first, so the leading entry — only when it's actually
  // pinned — fills the hero slot; otherwise every showcase renders in the grid.
  const realHero = showcases[0]?.featured ? showcases[0] : null;
  const realRest = realHero ? showcases.slice(1) : showcases;

  const itemListElements = showingSamples
    ? samples.map((w, i) => ({
        '@type': 'ListItem' as const,
        position: i + 1,
        url: `${SITE_URL}/realstories/${w.slug}`,
        name: weddingTitle(w),
      }))
    : showcases.map((s, i) => ({
        '@type': 'ListItem' as const,
        position: i + 1,
        url: `${SITE_URL}${s.href}`,
        name: s.city ? `${s.coupleNames} · ${s.city}` : s.coupleNames,
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
            Real weddings
          </p>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Real Filipino weddings, told by the couples who lived them.
          </h1>
          <p className="text-base text-ink/65">
            {showingSamples ? (
              <>
                Real couple editorials begin December 2026 — published from each
                couple&rsquo;s own wedding page, with their consent. Here&rsquo;s a
                sample to show how a wedding looks once it&rsquo;s told on Setnayan.
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

        {showingSamples ? (
          <>
            {featured ? (
              <Link
                href={`/realstories/${featured.slug}`}
                className="group mt-10 block overflow-hidden rounded-3xl border border-ink/10 bg-white/60 transition hover:border-terracotta/40 hover:bg-white"
              >
                <div className="flex h-24 w-full sm:h-32" aria-hidden>
                  {featured.palette.map((hex) => (
                    <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
                  ))}
                </div>
                <div className="p-6 sm:p-9">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                      Featured &middot; {featured.ceremonyType} &middot; {featured.venueSetting}
                    </span>
                    {featured.isSample ? (
                      <span className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/50">
                        Sample showcase
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-ink group-hover:underline sm:text-3xl">
                    {featured.coupleNames} &middot; {featured.city}
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">
                    {featured.excerpt}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta">
                    Read the showcase →
                  </span>
                </div>
              </Link>
            ) : null}

            {samples.length > 1 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {samples
                  .filter((w) => w.slug !== featured?.slug)
                  .map((w) => (
                    <SampleCard key={w.slug} wedding={w} />
                  ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {/* Admin-featured hero (PR D · Real Stories featuring): showcases
                are returned featured-first, so the leading entry — when it's
                pinned — fills the hero slot, mirroring the sample treatment.
                The remaining entries fall to the grid below. With no featured
                pick, every showcase renders as an even grid. */}
            {realHero ? <RealHero entry={realHero} /> : null}
            {realRest.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {realRest.map((s) => (
                  <RealCard key={s.href} entry={s} />
                ))}
              </div>
            ) : null}
          </>
        )}

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
