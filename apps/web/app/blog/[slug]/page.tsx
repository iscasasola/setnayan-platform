import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ChevronLeft, ArrowRight, ArrowUpRight, Download } from 'lucide-react';
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
import { fetchBlogArticleFromDB } from '@/lib/blog-db';
import { createAdminClient } from '@/lib/supabase/admin';

// DB-first: admin-published DB articles override static ones with the same
// slug. dynamicParams removed so DB-only slugs render on first request (ISR).
export const revalidate = 60;

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

async function resolveArticle(slug: string) {
  const supabase = createAdminClient();
  const dbArticle = await fetchBlogArticleFromDB(supabase, slug);
  return dbArticle ?? findBlogArticle(slug) ?? null;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) notFound();
  const description = blogMetaDescription(article);
  const canonicalUrl = `${SITE_URL}/blog/${article.slug}`;
  const imageUrl = `${SITE_URL}${article.cover}`;
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
      images: [{ url: imageUrl, width: 1820, height: 1024, alt: article.coverAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description,
      images: [imageUrl],
    },
    other: { 'article:section': blogCategoryLabel(article.category) },
  };
}

function Block({ block, lead }: { block: BlogBlock; lead?: boolean }) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 className="mt-12 font-display text-2xl font-medium leading-tight tracking-tight text-ink sm:text-[28px]">
          {block.text}
        </h2>
      );
    case 'p':
      return (
        <p
          className={
            lead
              ? 'mt-6 text-lg leading-relaxed text-ink sm:text-xl [&::first-letter]:float-left [&::first-letter]:mr-3 [&::first-letter]:mt-1.5 [&::first-letter]:font-display [&::first-letter]:text-6xl [&::first-letter]:font-medium [&::first-letter]:leading-[0.72] [&::first-letter]:text-mulberry'
              : 'mt-6 text-base leading-relaxed text-ink/75 sm:text-lg'
          }
        >
          {block.text}
        </p>
      );
    case 'ul':
      return (
        <ul className="mt-6 space-y-2.5 pl-5">
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
    case 'quote':
      return (
        <blockquote className="my-11 border-l-2 border-terracotta pl-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Worth keeping
          </p>
          <p className="mt-2.5 font-display text-2xl font-medium leading-snug text-ink sm:text-[28px]">
            {block.text}
          </p>
        </blockquote>
      );
    case 'image':
      return (
        <figure className="my-10">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-ink/5">
            <Image
              src={block.src}
              alt={block.alt}
              fill
              sizes="(max-width: 768px) 100vw, 680px"
              className="object-cover"
            />
          </div>
          {block.caption ? (
            <figcaption className="mt-3 text-center text-[13px] text-ink/55">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case 'cta':
      return (
        <div className="my-8 rounded-2xl border border-terracotta/25 bg-accent-soft p-5 sm:p-6">
          <p className="text-base leading-relaxed text-ink/80">{block.text}</p>
          <Link
            href={block.href}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-mulberry underline-offset-4 hover:underline"
          >
            {block.label}
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      );
    case 'download':
      return (
        <div className="my-8 rounded-2xl border border-mulberry/20 bg-accent-soft p-5 sm:p-6">
          <p className="text-base leading-relaxed text-ink/80">{block.text}</p>
          <a
            href={block.href}
            download
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
          >
            <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {block.label}
          </a>
        </div>
      );
    default:
      return null;
  }
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await resolveArticle(slug);
  if (!article) notFound();
  const categoryLabel = blogCategoryLabel(article.category);
  const related = relatedBlogArticles(slug);

  // First paragraph block gets the editorial drop-cap.
  const firstParagraphIndex = article.blocks.findIndex((b) => b.type === 'p');

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
    image: `${SITE_URL}${article.cover}`,
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
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
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

      {/* ===== Immersive cover header ===== */}
      <div className="relative h-[64vh] min-h-[460px] max-h-[660px] overflow-hidden">
        <Image
          src={article.cover}
          alt={article.coverAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-3xl px-5 pb-10 sm:px-6 sm:pb-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E6D4A6]">
            {categoryLabel} · the Filipino wedding edit
          </p>
          <h1 className="mt-3 max-w-[20ch] font-display text-3xl font-medium leading-[1.05] tracking-tight text-white sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-4 text-sm text-white/80">
            {article.author} &middot; {formatDate(article.publishedAt)} &middot;{' '}
            {readingMinutes(article.blocks)} min read
          </p>
        </div>
      </div>

      <article className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-ink/50">
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

        <div>
          {article.blocks.map((block, i) => (
            <Block key={i} block={block} lead={i === firstParagraphIndex} />
          ))}
        </div>

        {related.length > 0 ? (
          <section className="mt-16 border-t border-ink/10 pt-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
              Keep reading
            </p>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
              More from the edit
            </h2>
            <div className="mt-6 grid gap-x-6 gap-y-8 sm:grid-cols-3">
              {related.map((a) => (
                <Link key={a.slug} href={`/blog/${a.slug}`} className="group flex flex-col">
                  <div className="relative aspect-[5/4] overflow-hidden rounded-xl bg-ink/5">
                    <Image
                      src={a.cover}
                      alt={a.coverAlt}
                      fill
                      sizes="(max-width: 640px) 100vw, 240px"
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <span className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                    {blogCategoryLabel(a.category)}
                  </span>
                  <span className="mt-1 font-display text-lg font-medium leading-snug text-ink group-hover:text-terracotta-700">
                    {a.title}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-14 rounded-3xl border border-terracotta/25 bg-accent-soft p-8 text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink">
            Ready to start your own plan?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-base text-ink/65">
            Guest list, budget, schedule, seat plan, and mood board — free with
            every Setnayan account.
          </p>
          <Link
            href="/signup"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-mulberry px-6 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
          >
            Start planning · free
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm font-medium text-ink/70 underline-offset-4 hover:text-terracotta hover:underline"
          >
            <ChevronLeft aria-hidden className="mr-1 h-4 w-4" strokeWidth={1.75} />
            All articles
          </Link>
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}
