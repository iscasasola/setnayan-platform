import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Newspaper, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Nav } from '@/app/_components/marketing/site-nav';
import { SiteFooter } from '@/app/features/_sections/_SiteFooter';
import {
  ALL_BLOG_ARTICLES,
  BLOG_NUGGETS,
  blogCategoriesInUse,
  blogCategoryLabel,
  findBlogArticle,
  readingMinutes,
  type BlogArticle,
  type BlogCategoryKey,
} from '@/lib/blog';

// Setnayan Journal index — magazine redesign (iteration 0038, 2026-06-15).
// Photo-led editorial: a full-bleed cover for the featured guide, a "Nuggets"
// band of shareable wisdom, and a varied grid of story cards. Keeps the
// SEO/GEO machinery from the 2026-06-13 first slice intact (static render,
// Blog + Breadcrumb JSON-LD, category filter via ?category). Public, no auth.
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
    images: [{ url: `${SITE_URL}/blog/hero.webp`, width: 1820, height: 1024 }],
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
      {children}
    </span>
  );
}

function metaLine(article: BlogArticle): string {
  return `${formatDate(article.publishedAt)} · ${readingMinutes(article.blocks)} min read`;
}

// Wide, horizontal "lead" story — image left, words right. Anchors each view.
function LeadCard({ article }: { article: BlogArticle }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group grid overflow-hidden rounded-3xl border border-ink/10 bg-white/50 transition hover:border-terracotta/40 hover:bg-white sm:grid-cols-2"
    >
      <div className="relative aspect-[16/11] overflow-hidden sm:aspect-auto">
        <Image
          src={article.cover}
          alt={article.coverAlt}
          fill
          sizes="(max-width: 640px) 100vw, 560px"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-col justify-center p-6 sm:p-9">
        <Eyebrow>{blogCategoryLabel(article.category)}</Eyebrow>
        <h3 className="mt-3 font-display text-2xl font-medium leading-[1.12] tracking-tight text-ink sm:text-[30px]">
          {article.title}
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/65">
          {article.excerpt}
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta">
          Read the guide
          <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={1.75} />
        </span>
        <p className="mt-4 text-xs text-ink/45">{metaLine(article)}</p>
      </div>
    </Link>
  );
}

// Photo-led story card for the grid.
function StoryCard({ article }: { article: BlogArticle }) {
  return (
    <Link href={`/blog/${article.slug}`} className="group flex flex-col">
      <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-ink/5">
        <Image
          src={article.cover}
          alt={article.coverAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <div className="mt-4 flex flex-1 flex-col">
        <Eyebrow>{blogCategoryLabel(article.category)}</Eyebrow>
        <h3 className="mt-2 font-display text-xl font-medium leading-[1.16] tracking-tight text-ink group-hover:text-terracotta-700">
          {article.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/65">
          {article.excerpt}
        </p>
        <p className="mt-3 text-xs text-ink/45">{metaLine(article)}</p>
      </div>
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

  // Cover hero only on the unfiltered view: the pinned featured article, else newest.
  const featured = activeCategory
    ? undefined
    : ALL_BLOG_ARTICLES.find((a) => a.featured) ?? ALL_BLOG_ARTICLES[0];
  const remaining = featured
    ? visible.filter((a) => a.slug !== featured.slug)
    : visible;
  const lead = remaining[0];
  const rest = remaining.slice(1);

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
      image: `${SITE_URL}${a.cover}`,
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

      {/* ===== Cover (unfiltered only) ===== */}
      {featured ? (
        <Link
          href={`/blog/${featured.slug}`}
          className="group relative block h-[78vh] min-h-[540px] max-h-[760px] overflow-hidden"
        >
          <Image
            src={featured.cover}
            alt={featured.coverAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover transition duration-700 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10 sm:bg-gradient-to-r sm:from-black/80 sm:via-black/45 sm:to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-5 pb-12 sm:px-8 sm:pb-16">
            <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.24em] text-[#E6D4A6]">
              <Newspaper aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Setnayan Journal · the Filipino wedding edit
            </p>
            <h1 className="mt-4 max-w-[15ch] font-display text-4xl font-medium leading-[1.02] tracking-tight text-white sm:text-6xl">
              Wedding planning, the Filipino way.
            </h1>
            <div className="mt-6 max-w-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#E6D4A6]">
                Featured · {blogCategoryLabel(featured.category)}
              </p>
              <p className="mt-2 font-display text-xl font-medium leading-snug text-white sm:text-2xl">
                {featured.title}
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/80">
                {featured.excerpt}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 text-sm font-semibold text-ink transition group-hover:bg-white">
                Read the guide
                <ArrowRight aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={2} />
              </span>
            </div>
          </div>
        </Link>
      ) : null}

      {/* ===== Nuggets band (unfiltered only) ===== */}
      {!activeCategory ? (
        <section className="bg-ink text-cream">
          <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta">
              Nuggets
            </p>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-cream sm:text-4xl">
              Little things worth keeping
            </h2>
            <p className="mt-2 max-w-[46ch] text-[15px] text-cream/60">
              Bite-size wisdom from our guides — quick to read, easy to remember,
              and made to pass along.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BLOG_NUGGETS.map((n, i) => {
                const source = findBlogArticle(n.sourceSlug);
                return (
                  <Link
                    key={i}
                    href={`/blog/${n.sourceSlug}`}
                    className="group flex min-h-[164px] flex-col rounded-2xl border border-cream/10 bg-cream/[0.04] p-5 transition hover:border-terracotta/50 hover:bg-cream/[0.07]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-8 w-8 place-items-center rounded-full border border-terracotta/45 font-display text-sm font-medium text-terracotta">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/45">
                        {blogCategoryLabel(n.category)}
                      </span>
                    </div>
                    <p className="mt-3 font-display text-[18px] font-normal leading-snug text-cream/95">
                      {n.text}
                    </p>
                    {source ? (
                      <span className="mt-auto pt-3 text-xs text-cream/45 group-hover:text-terracotta">
                        From “{source.title}”
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* ===== The Edit ===== */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:px-8 sm:py-16">
        {activeCategory ? (
          <div className="max-w-2xl space-y-3">
            <Eyebrow>Setnayan Journal</Eyebrow>
            <h1 className="font-display text-4xl font-medium tracking-tight text-ink">
              {blogCategoryLabel(activeCategory)}
            </h1>
          </div>
        ) : (
          <div>
            <Eyebrow>The edit</Eyebrow>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
              Stories &amp; guides
            </h2>
          </div>
        )}

        {/* Category filter — only categories with articles render as chips. */}
        <nav aria-label="Filter by category" className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/blog"
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              activeCategory
                ? 'border-ink/15 text-ink/65 hover:border-ink/40 hover:text-ink'
                : 'border-terracotta bg-terracotta text-[#3a2c10]'
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
                    ? 'border-terracotta bg-terracotta text-[#3a2c10]'
                    : 'border-ink/15 text-ink/65 hover:border-ink/40 hover:text-ink'
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </nav>

        {lead ? (
          <div className="mt-9">
            <LeadCard article={lead} />
          </div>
        ) : (
          <p className="mt-10 text-sm text-ink/55">
            No articles in this category yet — check back soon.
          </p>
        )}

        {rest.length > 0 ? (
          <div className="mt-7 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <StoryCard key={article.slug} article={article} />
            ))}
          </div>
        ) : null}

        {/* Conversion footer — sells the free workspace, no quoted SKU price. */}
        <div className="mt-16 rounded-3xl border border-terracotta/25 bg-accent-soft p-8 text-center sm:p-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
            Ready to start your own plan?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink/65">
            Guest list, budget, schedule, seat plan, and mood board — free with
            every Setnayan account, plus a preview of your vendor matches.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-mulberry px-6 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
          >
            Start planning · free
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
