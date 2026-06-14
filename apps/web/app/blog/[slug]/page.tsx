import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ArrowRight, Newspaper } from 'lucide-react';
import { Logo } from '@/app/_components/logo';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import {
  ALL_BLOG_ARTICLES,
  findBlogArticle,
  relatedBlogArticles,
  blogMetaDescription,
  blogPlainText,
  blogCategoryLabel,
  readingMinutes,
  type BlogBlock,
} from '@/lib/blog';

// Per-article Journal pages (iteration 0038 first slice, SEO/GEO 2026-06-13).
// Same soft-404-proof shape as /help/[slug]: the article set is a fixed in-code
// constant, so every slug is pre-rendered and anything else 404s at the routing
// layer (dynamicParams=false). No DB, no loading boundary that would commit a
// 200 before notFound() runs.
export const dynamicParams = false;
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Deterministic date formatting from the ISO 'YYYY-MM-DD' parts — avoids any
// server-vs-build timezone drift a `new Date()` render could introduce.
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams(): Array<{ slug: string }> {
  return ALL_BLOG_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = findBlogArticle(slug);
  if (!article) notFound();
  const description = blogMetaDescription(article);
  const canonicalUrl = `${SITE_URL}/blog/${article.slug}`;
  return {
    title: article.title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title: `${article.title} · Setnayan Journal`,
      description,
      siteName: 'Setnayan',
      locale: 'en_PH',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      authors: [article.author],
    },
    twitter: {
      card: 'summary',
      title: article.title,
      description,
    },
    other: { 'article:section': blogCategoryLabel(article.category) },
  };
}

function Block({ block }: { block: BlogBlock }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-10 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
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
    case 'cta':
      return (
        <div className="mt-7 rounded-2xl border border-ink/10 bg-white/60 p-5 sm:p-6">
          <p className="text-base leading-relaxed text-ink/80">{block.text}</p>
          <Link
            href={block.href}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta underline-offset-4 hover:underline"
          >
            {block.label}
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      );
    default:
      return null;
  }
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = findBlogArticle(slug);
  if (!article) notFound();
  const categoryLabel = blogCategoryLabel(article.category);
  const related = relatedBlogArticles(slug);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Journal',
        item: `${SITE_URL}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: categoryLabel,
        item: `${SITE_URL}/blog?category=${article.category}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: article.title,
        item: `${SITE_URL}/blog/${article.slug}`,
      },
    ],
  };

  const blogPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.excerpt,
    articleBody: blogPlainText(article.blocks),
    articleSection: categoryLabel,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    inLanguage: 'en-PH',
    url: `${SITE_URL}/blog/${article.slug}`,
    mainEntityOfPage: `${SITE_URL}/blog/${article.slug}`,
    author: { '@type': 'Organization', name: article.author, url: SITE_URL },
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
  };

  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }}
      />

      <header className="border-b border-ink/5">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center text-ink">
            <Logo height={32} withWordmark title="Setnayan · Journal" />
          </Link>
          <Link
            href="/blog"
            className="hidden text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline sm:inline"
          >
            All articles
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink/50">
          <Link href="/" className="hover:text-ink hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/blog" className="hover:text-ink hover:underline">
            Journal
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/blog?category=${article.category}`}
            className="hover:text-ink hover:underline"
          >
            {categoryLabel}
          </Link>
        </nav>

        <p className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
          <Newspaper aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {categoryLabel}
        </p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-4 text-sm text-ink/50">
          {article.author} &middot; {formatDate(article.publishedAt)} &middot;{' '}
          {readingMinutes(article.blocks)} min read
        </p>

        <div className="mt-2">
          {article.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>

        {related.length > 0 ? (
          <section className="mt-14 border-t border-ink/10 pt-8">
            <h2 className="text-lg font-semibold text-ink">Keep reading</h2>
            <ul className="mt-4 space-y-3">
              {related.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/blog/${a.slug}`}
                    className="group block"
                  >
                    <span className="text-sm font-medium text-ink/80 underline-offset-4 group-hover:text-terracotta group-hover:underline">
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink/50">
                      {blogCategoryLabel(a.category)} &middot; {readingMinutes(a.blocks)} min read
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
            All articles
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            Start planning free →
          </Link>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
