import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ArrowRight, Heart } from 'lucide-react';
import { SiteHeader } from '@/app/_components/site-header';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import {
  ALL_REAL_WEDDINGS,
  findRealWedding,
  relatedRealWeddings,
  weddingMetaDescription,
  weddingPlainText,
  weddingTitle,
  type RealWeddingBlock,
} from '@/lib/real-weddings';

// /weddings/[slug] — per-showcase page (iteration 0046, first slice). Same
// soft-404-proof SSG shape as /blog/[slug]: fixed in-code set, every slug
// pre-rendered, anything else 404s at the routing layer.
export const dynamicParams = false;
export const revalidate = false;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

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

function Block({ block }: { block: RealWeddingBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-9 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {block.text}
        </h2>
      );
    case 'p':
      return (
        <p className="mt-5 text-base leading-relaxed text-ink/75 sm:text-lg">
          {block.text}
        </p>
      );
    case 'ul':
      return (
        <ul className="mt-5 space-y-2.5 pl-5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="list-disc text-base leading-relaxed text-ink/75 marker:text-terracotta sm:text-lg"
            >
              {item}
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

export default async function WeddingShowcasePage({ params }: Props) {
  const { slug } = await params;
  const wedding = findRealWedding(slug);
  if (!wedding) notFound();
  const title = weddingTitle(wedding);
  const related = relatedRealWeddings(slug);

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Ceremony', value: wedding.ceremonyType },
    { label: 'Setting', value: wedding.venueSetting },
    { label: 'Where', value: `${wedding.city} · ${wedding.eventDateLabel}` },
    { label: 'Theme', value: wedding.theme },
    { label: 'Guests', value: wedding.guestCount },
  ];

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
    articleBody: weddingPlainText(wedding),
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
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main className="bg-cream">
        {/* palette banner stands in for a hero image on the sample */}
        <div className="flex h-28 w-full sm:h-40" aria-hidden>
          {wedding.palette.map((hex) => (
            <span key={hex} className="flex-1" style={{ backgroundColor: hex }} />
          ))}
        </div>

        <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink/50">
            <Link href="/" className="hover:text-ink hover:underline">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/weddings" className="hover:text-ink hover:underline">
              Real weddings
            </Link>
          </nav>

          {wedding.isSample ? (
            <p className="mb-5 rounded-lg border border-ink/10 bg-white/60 px-4 py-2.5 text-sm text-ink/60">
              <span className="font-medium text-ink/75">Sample showcase.</span> An
              illustration of how a wedding appears on Setnayan. Real couple
              editorials — with their own photos and team — begin December 2026.
            </p>
          ) : null}

          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            <Heart aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {wedding.ceremonyType} &middot; {wedding.venueSetting}
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            {wedding.coupleNames}
          </h1>
          <p className="mt-2 text-base text-ink/60">
            {wedding.venueName} &middot; {wedding.city} &middot; {wedding.eventDateLabel}
          </p>

          <blockquote className="mt-6 border-l-2 border-terracotta/50 pl-4 text-lg italic text-ink/75">
            &ldquo;{wedding.heroQuote}&rdquo;
          </blockquote>

          {/* at-a-glance facts */}
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-ink/10 bg-white/50 p-5 sm:grid-cols-3 sm:p-6">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                  {f.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-ink/80">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-2">
            {wedding.story.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>

          {/* The team */}
          <section className="mt-12 border-t border-ink/10 pt-8">
            <h2 className="text-lg font-semibold text-ink">The team behind the day</h2>
            <p className="mt-1 text-sm text-ink/55">
              On a real showcase, each role links to the vendor&rsquo;s Setnayan
              profile. Explore the kind of team behind a day like this:
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {wedding.team.map((credit) => (
                <li key={credit.role}>
                  <Link
                    href={credit.href}
                    className="inline-flex items-center rounded-full border border-ink/15 px-3 py-1.5 text-sm text-ink/75 transition hover:border-terracotta/40 hover:text-ink"
                  >
                    {credit.role}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* How Setnayan helped */}
          <section className="mt-10 rounded-2xl border border-ink/10 bg-white/60 p-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink">How Setnayan helped</h2>
            <p className="mt-2 text-base leading-relaxed text-ink/75">
              {wedding.setnayanNote}
            </p>
            <Link
              href="/signup"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta underline-offset-4 hover:underline"
            >
              Start planning your own — free
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </section>

          {related.length > 0 ? (
            <section className="mt-12 border-t border-ink/10 pt-8">
              <h2 className="text-lg font-semibold text-ink">More real weddings</h2>
              <ul className="mt-4 space-y-2">
                {related.map((w) => (
                  <li key={w.slug}>
                    <Link
                      href={`/weddings/${w.slug}`}
                      className="text-sm font-medium text-ink/75 underline-offset-4 hover:text-terracotta hover:underline"
                    >
                      {w.coupleNames} &middot; {w.city}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-12">
            <Link
              href="/weddings"
              className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
            >
              <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
              All real weddings
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
