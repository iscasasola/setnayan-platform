import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import { Logo } from '@/app/_components/logo';
import {
  ALL_HELP_ARTICLES,
  findHelpArticle,
  relatedHelpArticles,
  helpMetaDescription,
} from '@/lib/help';

// Per-article help pages (SEO/GEO, 2026-06-13). Each of the 61 help articles
// gets its own indexable URL at /help/[slug] with Article + single-question
// FAQPage JSON-LD, so each high-intent informational Q can rank on its own
// (the /help hub still ships the full multi-question FAQPage). The article set
// is a fixed in-code constant, so we pre-render all slugs and 404 anything
// else at the routing layer (dynamicParams=false) — no DB, no soft-404, no
// loading boundary that would commit a 200 before notFound() runs.
export const dynamicParams = false;
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams(): Array<{ slug: string }> {
  return ALL_HELP_ARTICLES.map(({ article }) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const found = findHelpArticle(slug);
  if (!found) notFound();
  const { article, topic } = found;
  const description = helpMetaDescription(article.body);
  const canonicalUrl = `${SITE_URL}/help/${article.slug}`;
  return {
    title: article.title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title: `${article.title} · Setnayan Help`,
      description,
      siteName: 'Setnayan',
      locale: 'en_PH',
    },
    twitter: {
      card: 'summary',
      title: article.title,
      description,
    },
    other: { 'article:section': topic.label },
  };
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const found = findHelpArticle(slug);
  if (!found) notFound();
  const { article, topic } = found;
  const related = relatedHelpArticles(slug);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Help & support',
        item: `${SITE_URL}/help`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: topic.label,
        item: `${SITE_URL}/help#${topic.key}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: article.title,
        item: `${SITE_URL}/help/${article.slug}`,
      },
    ],
  };

  // Single-question FAQPage — the question IS the page. AI answer engines
  // extract the Q/A pair verbatim; a dedicated URL per question makes the
  // citation point at the exact answer rather than the 61-question hub.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: article.title,
        acceptedAnswer: { '@type': 'Answer', text: article.body },
      },
    ],
  };

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    articleBody: article.body,
    articleSection: topic.label,
    inLanguage: 'en-PH',
    url: `${SITE_URL}/help/${article.slug}`,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}/#website` },
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  };

  return (
    <main className="min-h-dvh bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <Logo height={32} withWordmark title="Setnayan · Help" />
          </Link>
          <Link
            href="/help"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            All help topics
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink/50">
          <Link href="/" className="hover:text-ink hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/help" className="hover:text-ink hover:underline">
            Help
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/help#${topic.key}`}
            className="hover:text-ink hover:underline"
          >
            {topic.label}
          </Link>
        </nav>

        <p className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          <HelpCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {topic.label}
        </p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-ink/75 sm:text-lg">
          {article.body}
        </p>

        {related.length > 0 ? (
          <section className="mt-12 border-t border-ink/10 pt-8">
            <h2 className="text-lg font-semibold text-ink">
              More in {topic.label}
            </h2>
            <ul className="mt-4 space-y-2">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="text-sm font-medium text-ink/75 underline-offset-4 hover:text-terracotta hover:underline"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="/help"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
            All help topics
          </Link>
          <Link
            href="/help#contact"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            Still stuck? Contact support →
          </Link>
        </div>
      </article>
    </main>
  );
}
