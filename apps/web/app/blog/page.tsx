import Link from 'next/link';
import { Newspaper, ArrowRight } from 'lucide-react';
import { Nav } from '@/app/_components/marketing/site-nav';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import {
  ALL_BLOG_ARTICLES,
  blogCategoriesInUse,
  blogCategoryLabel,
  readingMinutes,
  type BlogArticle,
  type BlogCategoryKey,
} from '@/lib/blog';

// Setnayan Journal index (iteration 0038 first slice, SEO/GEO 2026-06-13).
// Public, no auth. revalidate=3600 mirrors the other marketing routes so Google
// gets a fresh-but-cached crawl target without origin pressure.
export const revalidate = 3600;

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

export const metadata = {
  title: 'Setnayan Journal — Filipino wedding planning guides',
  description:
    'Planning timelines, supplier cost guides, and Filipino wedding customs explained — practical, no-nonsense advice for couples planning a wedding in the Philippines.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/blog`,
    title: 'Setnayan Journal',
    description:
      'Filipino wedding planning guides — timelines, supplier costs, and customs explained.',
    siteName: 'Setnayan',
    locale: 'en_PH',
  },
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function isCategoryKey(value: string | undefined): value is BlogCategoryKey {
  return (
    value === 'planning' ||
    value === 'vendors' ||
    value === 'culture' ||
    value === 'real-weddings' ||
    value === 'news'
  );
}

function ArticleCard({ article }: { article: BlogArticle }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-ink/10 bg-white/50 p-5 transition hover:border-terracotta/40 hover:bg-white sm:p-6"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        {blogCategoryLabel(article.category)}
      </span>
      <h3 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-ink group-hover:underline">
        {article.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/65">
        {article.excerpt}
      </p>
      <p className="mt-4 text-xs text-ink/45">
        {formatDate(article.publishedAt)} &middot; {readingMinutes(article.blocks)} min read
      </p>
    </Link>
  );
}

type Props = {
  searchParams: Promise<{ category?: string }>;
};

export default async function BlogIndexPage({ searchParams }: Props) {
  const search = await searchParams;
  const activeCategory: BlogCategoryKey | undefined = isCategoryKey(
    search.category,
  )
    ? search.category
    : undefined;

  const categories = blogCategoriesInUse();

  const visible = activeCategory
    ? ALL_BLOG_ARTICLES.filter((a) => a.category === activeCategory)
    : ALL_BLOG_ARTICLES;

  // Hero only on the unfiltered view: the pinned featured article, else newest.
  const featured = activeCategory
    ? undefined
    : ALL_BLOG_ARTICLES.find((a) => a.featured) ?? ALL_BLOG_ARTICLES[0];
  const gridArticles = featured
    ? visible.filter((a) => a.slug !== featured.slug)
    : visible;

  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Setnayan Journal',
    description:
      'Filipino wedding planning guides — timelines, supplier cost guides, and customs explained.',
    url: `${SITE_URL}/blog`,
    inLanguage: 'en-PH',
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
    blogPost: ALL_BLOG_ARTICLES.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      url: `${SITE_URL}/blog/${a.slug}`,
      datePublished: a.publishedAt,
      dateModified: a.updatedAt ?? a.publishedAt,
    })),
  };

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
    ],
  };

  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <Nav />

      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl space-y-3">
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            <Newspaper aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Setnayan Journal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Wedding planning, the Filipino way
          </h1>
          <p className="text-base text-ink/65">
            Practical guides for couples planning a wedding in the Philippines —
            timelines, supplier costs, and the customs that make a Filipino
            wedding ours.
          </p>
        </div>

        {/* Category filter — only categories with articles render as chips. */}
        <nav aria-label="Filter by category" className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/blog"
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              activeCategory
                ? 'border-ink/15 text-ink/65 hover:border-ink/30 hover:text-ink'
                : 'border-terracotta bg-terracotta text-cream'
            }`}
          >
            All
          </Link>
          {categories.map((c) => {
            const isActive = activeCategory === c.key;
            return (
              <Link
                key={c.key}
                href={`/blog?category=${c.key}`}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? 'border-terracotta bg-terracotta text-cream'
                    : 'border-ink/15 text-ink/65 hover:border-ink/30 hover:text-ink'
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </nav>

        {/* Featured hero (unfiltered view only). */}
        {featured ? (
          <Link
            href={`/blog/${featured.slug}`}
            className="group mt-10 block rounded-3xl border border-ink/10 bg-white/60 p-6 transition hover:border-terracotta/40 hover:bg-white sm:p-9"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
              Featured &middot; {blogCategoryLabel(featured.category)}
            </span>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-ink group-hover:underline sm:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink/70">
              {featured.excerpt}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta">
              Read the guide
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
          </Link>
        ) : null}

        {/* Article grid. */}
        {gridArticles.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gridArticles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        ) : (
          <p className="mt-10 text-sm text-ink/55">
            No articles in this category yet — check back soon.
          </p>
        )}

        {/* Conversion footer — sells the free workspace, no quoted SKU price. */}
        <div className="mt-16 rounded-3xl border border-ink/10 bg-white/60 p-7 text-center sm:p-10">
          <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Ready to start your own plan?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-base text-ink/65">
            Guest list, budget, schedule, seat plan, and mood board — free with
            every Setnayan account, plus a preview of your vendor matches.
          </p>
          <Link
            href="/signup"
            className="button-primary mt-5 inline-flex h-11 items-center px-6 text-sm"
          >
            Start planning · free
          </Link>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
