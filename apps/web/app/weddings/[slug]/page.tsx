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
} from '@/lib/real-weddings';

// /weddings/[slug] — Real Weddings showcase detail (iteration 0046).
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
  const canonicalUrl = `${SITE_URL}/weddings/${wedding.slug}`;
  const title = weddingTitle(wedding);
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
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function WeddingShowcasePage({ params }: Props) {
  const { slug } = await params;
  const wedding = findRealWedding(slug);
  if (!wedding) notFound();
  const title = weddingTitle(wedding);
  const editorialEventId = SAMPLE_EDITORIALS[wedding.slug] ?? null;

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
      {
        '@type': 'ListItem',
        position: 3,
        name: wedding.coupleNames,
        item: `${SITE_URL}/weddings/${wedding.slug}`,
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
    url: `${SITE_URL}/weddings/${wedding.slug}`,
    mainEntityOfPage: `${SITE_URL}/weddings/${wedding.slug}`,
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

      {/* Slim showcase bar — back nav + honest sample label, above the editorial. */}
      <div className="border-b border-ink/10 bg-cream">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/weddings"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
            Real weddings
          </Link>
          {wedding.isSample ? (
            <span className="rounded-full border border-ink/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/55">
              Sample showcase
            </span>
          ) : null}
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
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            {wedding.coupleNames}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink/65">{wedding.excerpt}</p>
          <Link
            href="/weddings"
            className="mt-6 inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
            All real weddings
          </Link>
        </div>
      )}
    </main>
  );
}
