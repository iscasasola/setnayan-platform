import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteHeader } from '@/app/_components/site-header';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import {
  ALL_REAL_WEDDINGS,
  weddingTitle,
  type RealWedding,
} from '@/lib/real-weddings';

// /weddings — public Real Weddings showcase index (iteration 0046, first
// slice). Until consent-gated real editorials begin (Dec 2026 → couples' own
// Phase 4 event pages), the page is seeded with explicitly-labelled SAMPLE
// showcases so the surface is live, demonstrates the format, and gives SEO a
// real page to index. Fully static (in-code constants, no data source).

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Real weddings · Setnayan',
  description:
    'Real Filipino weddings, told by the couples who lived them — browse by ceremony type, venue, and theme. Preview a sample showcase now; real couple editorials begin December 2026 with explicit consent per RA 10173.',
  alternates: { canonical: '/weddings' },
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
    url: '/weddings',
  },
};

export const dynamic = 'force-static';
export const revalidate = false;

function ShowcaseCard({ wedding }: { wedding: RealWedding }) {
  return (
    <Link
      href={`/weddings/${wedding.slug}`}
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
      {/* palette strip */}
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

export default function WeddingsIndexPage() {
  // Samples are PLACEHOLDERS — shown only until a real wedding is uploaded.
  // (Owner: "this is our sample until a real wedding is uploaded.") The moment a
  // real (non-sample) wedding enters the source — a non-sample in-code entry
  // now, or the DB-driven Phase-4 published-editorials browse later (0046
  // deferred) — the samples drop out automatically.
  const realWeddings = ALL_REAL_WEDDINGS.filter((w) => !w.isSample);
  const showingSamples = realWeddings.length === 0;
  const weddings = showingSamples ? ALL_REAL_WEDDINGS : realWeddings;
  const featured = weddings.find((w) => w.featured) ?? weddings[0];

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Real weddings · Setnayan',
    url: `${SITE_URL}/weddings`,
    inLanguage: 'en-PH',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: weddings.map((w, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/weddings/${w.slug}`,
        name: weddingTitle(w),
      })),
    },
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
        item: `${SITE_URL}/weddings`,
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
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

        {featured ? (
          <Link
            href={`/weddings/${featured.slug}`}
            className="group mt-10 block overflow-hidden rounded-3xl border border-ink/10 bg-white/60 transition hover:border-terracotta/40 hover:bg-white"
          >
            {/* palette banner stands in for a hero image on the sample */}
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

        {weddings.length > 1 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {weddings
              .filter((w) => w.slug !== featured?.slug)
              .map((w) => (
                <ShowcaseCard key={w.slug} wedding={w} />
              ))}
          </div>
        ) : null}

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
              href="/vendors"
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
