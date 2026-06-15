import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { EditorialContent } from '@/app/[slug]/_components/editorial/editorial-content';
import { SAMPLE_EDITORIAL_EVENT_ID } from '@/app/[slug]/_components/editorial/data';
import {
  ALL_REAL_WEDDINGS,
  findRealWedding,
  weddingMetaDescription,
  weddingTitle,
  type RealWedding,
} from '@/lib/real-weddings';
import { ShareButtons } from '@/app/realstories/_components/share-buttons';

// Front-page editorial layout for a SAMPLE with no editorial fixture — built
// from the curated RealWedding fields (hero, quote, story, palette, team) so
// every sample reads as a real cover story, not a bare fallback card.
function SampleEditorial({ wedding }: { wedding: RealWedding }) {
  return (
    <article className="pb-4">
      {/* Hero */}
      <header className="relative mx-auto mt-4 w-full max-w-5xl overflow-hidden rounded-3xl px-0 sm:mt-6">
        <div
          className="relative flex min-h-[340px] flex-col justify-end sm:min-h-[460px]"
          style={{ backgroundColor: wedding.palette[0] ?? '#6B4E3D' }}
        >
          {wedding.heroVideoUrl ? (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={wedding.heroVideoUrl}
              poster={wedding.heroImageUrl ?? undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
          ) : wedding.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wedding.heroImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex" aria-hidden>
              {wedding.palette.map((hex) => (
                <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
              ))}
            </div>
          )}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: '70%',
              background:
                'linear-gradient(to top, rgba(18,14,10,0.75), rgba(18,14,10,0.3) 55%, rgba(18,14,10,0))',
            }}
            aria-hidden
          />
          <div className="relative p-6 text-white sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/85">
              {wedding.ceremonyType} &middot; {wedding.venueSetting} &middot; {wedding.city}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
              {wedding.coupleNames}
            </h1>
            <p className="mt-2 text-sm text-white/85 sm:text-base">
              {wedding.theme} &middot; {wedding.eventDateLabel} &middot; {wedding.guestCount}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        {/* Pull quote */}
        <blockquote className="mt-10 border-l-2 border-terracotta/60 pl-5 font-display text-xl leading-snug text-ink/85 sm:text-2xl">
          &ldquo;{wedding.heroQuote}&rdquo;
        </blockquote>

        {/* Story */}
        <div className="mt-8 space-y-5">
          {wedding.story.map((block, i) => {
            if (block.type === 'h2') {
              return (
                <h2
                  key={i}
                  className="pt-3 text-lg font-semibold tracking-tight text-ink sm:text-xl"
                >
                  {block.text}
                </h2>
              );
            }
            if (block.type === 'ul') {
              return (
                <ul key={i} className="ml-1 space-y-2">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-2.5 text-base leading-relaxed text-ink/70">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-terracotta/70" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-base leading-relaxed text-ink/75">
                {block.text}
              </p>
            );
          })}
        </div>

        {/* Palette */}
        <div className="mt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">The palette</p>
          <div className="mt-3 flex gap-2">
            {wedding.palette.map((hex) => (
              <span
                key={hex}
                className="h-9 w-9 rounded-full ring-1 ring-ink/10"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="mt-10 rounded-2xl border border-ink/10 bg-white/50 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">The team</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {wedding.team.map((credit) => (
              <Link
                key={credit.role}
                href={credit.href}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-sm text-ink/70 transition hover:border-terracotta/40 hover:text-terracotta"
              >
                {credit.role}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink/60">{wedding.setnayanNote}</p>
        </div>

        <Link
          href="/realstories"
          className="mt-10 inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
        >
          <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
          All real weddings
        </Link>
      </div>
    </article>
  );
}

// /realstories/[slug] — Real Weddings showcase detail (iteration 0046).
//
// The showcase IS the editorial: each entry renders through the SAME
// `EditorialContent` component as a real wedding's post-event editorial page,
// fed a curated SAMPLE fixture via the `loadEditorialData` sentinel in
// editorial/data.ts. So when the editorial format changes, this sample follows
// automatically — there is no parallel layout to drift. SSG + soft-404-proof
// (fixed slug set, dynamicParams=false). When real consent-gated editorials
// ship (0002/0046 Phase 4, Dec 2026) they render through the identical
// component from live event data at /[slug].
export const dynamicParams = false;
export const revalidate = false;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

// slug → editorial fixture id. The sentinel(s) live in editorial/data.ts (the
// single source); add one row here per curated sample. Real editorials never
// pass through this map — they render from their own event row at /[slug].
const SAMPLE_EDITORIALS: Record<string, string> = {
  'maria-and-juan-tagaytay-garden-wedding': SAMPLE_EDITORIAL_EVENT_ID,
};

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams(): Array<{ slug: string }> {
  return ALL_REAL_WEDDINGS.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const wedding = findRealWedding(slug);
  if (!wedding) notFound();
  const description = weddingMetaDescription(wedding);
  const canonicalUrl = `${SITE_URL}/realstories/${wedding.slug}`;
  const title = weddingTitle(wedding);
  // Per-editorial OG share card (1200×630) — the couple + palette + venue,
  // rendered on the fly so a Facebook/Pinterest share shows the actual story
  // and deep-links here, instead of a bare link. See
  // app/api/og/realstory/[slug]/route.ts + lib/social/realstory-card.tsx.
  const ogImage = `${SITE_URL}/api/og/realstory/${wedding.slug}`;
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title: `${title} · Setnayan`,
      description,
      siteName: 'Setnayan',
      locale: 'en_PH',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function WeddingShowcasePage({ params }: Props) {
  const { slug } = await params;
  const wedding = findRealWedding(slug);
  if (!wedding) notFound();
  const title = weddingTitle(wedding);
  const editorialEventId = SAMPLE_EDITORIALS[wedding.slug] ?? null;
  const canonicalUrl = `${SITE_URL}/realstories/${wedding.slug}`;
  const ogImage = `${SITE_URL}/api/og/realstory/${wedding.slug}`;
  const shareTitle = `${wedding.coupleNames} — a Setnayan Real Story`;

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
      {
        '@type': 'ListItem',
        position: 3,
        name: wedding.coupleNames,
        item: `${SITE_URL}/realstories/${wedding.slug}`,
      },
    ],
  };
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: wedding.excerpt,
    datePublished: wedding.publishedAt,
    dateModified: wedding.updatedAt ?? wedding.publishedAt,
    inLanguage: 'en-PH',
    url: `${SITE_URL}/realstories/${wedding.slug}`,
    mainEntityOfPage: `${SITE_URL}/realstories/${wedding.slug}`,
    author: { '@type': 'Organization', name: 'Setnayan Editorial', url: SITE_URL },
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
    locationCreated: { '@type': 'Place', name: `${wedding.city}, Philippines` },
  };

  return (
    <main className="bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Slim showcase bar — back nav + share + honest sample label. */}
      <div className="border-b border-ink/10 bg-cream">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/realstories"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
            Real weddings
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <ShareButtons url={canonicalUrl} title={shareTitle} image={ogImage} />
            {wedding.isSample ? (
              <span className="rounded-full border border-ink/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/55">
                Sample showcase
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {wedding.isSample ? (
        <p className="mx-auto w-full max-w-5xl px-4 pt-4 text-center text-xs leading-relaxed text-ink/55 sm:px-6 lg:px-8">
          A sample of how a wedding is told on Setnayan once it becomes an
          editorial. Real couple editorials — their own story, photos, and team —
          begin December 2026, published with the couple&rsquo;s consent.
        </p>
      ) : null}

      {editorialEventId ? (
        // The real editorial recap, fed the sample fixture. Same component as a
        // live wedding's /[slug] editorial → the sample always tracks it.
        <EditorialContent eventId={editorialEventId} />
      ) : (
        <SampleEditorial wedding={wedding} />
      )}
    </main>
  );
}
