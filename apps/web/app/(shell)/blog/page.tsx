import Link from 'next/link';
import Image from 'next/image';
import { Newspaper, ArrowRight, ArrowUpRight } from 'lucide-react';
import {
  publishedBlogArticles,
  BLOG_NUGGETS,
  blogCategoriesInUse,
  blogCategoryLabel,
  findBlogArticle,
  type BlogArticle,
  type BlogCategoryKey,
} from '@/lib/blog';
// Eyebrow / metaLine / StoryCard moved to ./_components/story-card (2026-08-08)
// so /realstories' "From our articles" rail renders a real article card instead
// of a copy of one. Pure move — this page's markup is unchanged.
import { StoryCard, Eyebrow, metaLine } from '@/app/blog/_components/story-card';
import { actionButtonClass } from '@/components/action-button';

// Setnayan Articles index — magazine redesign (iteration 0038, 2026-06-15).
// Photo-led editorial: a full-bleed cover for the featured guide, a "Nuggets"
// band of shareable wisdom, and a varied grid of story cards. Keeps the
// SEO/GEO machinery from the 2026-06-13 first slice intact (Blog + Breadcrumb
// JSON-LD, category filter via ?category). Public, no auth.
//
// 2026-11-12 — this page.tsx moved into app/(shell)/ (owner: "these are on old
// shells"), so it wears the front-door bar + rail like every other public page.
// Its `revalidate = 3600` is gone with it: the shell layout reads the session
// and sets force-dynamic once for the whole group, and a per-page ISR directive
// under it is the /privacy mistake the layout's own comment records. The
// story cards stay in app/blog/_components/, beside /blog/[slug].

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');

export const metadata = {
  title: 'Setnayan Articles — Filipino event planning guides',
  description:
    'Planning timelines, supplier cost guides, and Filipino customs explained — practical, no-nonsense advice for anyone planning an event in the Philippines.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/blog`,
    title: 'Setnayan Articles',
    description:
      'Filipino event planning guides — timelines, supplier costs, and customs explained.',
    siteName: 'Setnayan',
    locale: 'en_PH',
    images: [{ url: `${SITE_URL}/blog/hero.webp`, width: 1820, height: 1024 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Setnayan Articles — Filipino event planning guides',
    description:
      'Filipino event planning guides — timelines, supplier costs, and customs explained.',
    images: [`${SITE_URL}/blog/hero.webp`],
  },
};

function isCategoryKey(value: string | undefined): value is BlogCategoryKey {
  return (
    value === 'planning' ||
    value === 'vendors' ||
    value === 'culture' ||
    value === 'news'
  );
}

// Wide, horizontal "lead" story — image left, words right. Anchors each view.
function LeadCard({ article }: { article: BlogArticle }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group grid overflow-hidden rounded-3xl transition hover:bg-white sm:grid-cols-2"
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
        <p className="mt-4 text-xs text-ink/70">{metaLine(article)}</p>
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

  // Public list = only articles whose publishedAt has arrived; future-dated
  // drip articles stay hidden from the index until their day.
  const all = publishedBlogArticles();
  const visible = activeCategory
    ? all.filter((a) => a.category === activeCategory)
    : all;

  // Cover hero only on the unfiltered view: the pinned featured article, else newest.
  const featured = activeCategory
    ? undefined
    : all.find((a) => a.featured) ?? all[0];
  const remaining = featured
    ? visible.filter((a) => a.slug !== featured.slug)
    : visible;
  const lead = remaining[0];
  const rest = remaining.slice(1);

  const blogJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Setnayan Articles',
    description:
      'Filipino event planning guides — timelines, supplier cost guides, and customs explained.',
    url: `${SITE_URL}/blog`,
    inLanguage: 'en-PH',
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization` },
    blogPost: all.map((a) => ({
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
        name: 'Articles',
        item: `${SITE_URL}/blog`,
      },
    ],
  };

  return (
    <main className="flex min-h-dvh flex-col bg-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />


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
            <p className="inline-flex items-center gap-1.5 text-[color:var(--sn-gold-300)] text-xs font-bold uppercase tracking-[0.1em]">
              <Newspaper aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Setnayan Articles · the Filipino event edit
            </p>
            <h1 className="mt-4 max-w-[15ch] font-display text-4xl font-medium leading-[1.02] tracking-tight text-white sm:text-6xl">
              Event planning, the Filipino way.
            </h1>
            <div className="mt-6 max-w-xl">
              <p className="text-[color:var(--sn-gold-300)] text-xs font-bold uppercase tracking-[0.1em]">
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
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
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
                    className="group flex min-h-[164px] flex-col rounded-2xl bg-cream/[0.04] p-5 transition hover:bg-cream/[0.07]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-8 w-8 place-items-center rounded-full border border-terracotta/45 font-display text-sm font-medium text-terracotta">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-cream/45 text-xs font-bold uppercase tracking-[0.1em]">
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
            <Eyebrow>Setnayan Articles</Eyebrow>
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
            className={actionButtonClass(activeCategory ? 'neutral' : 'brand', { filled: !activeCategory, extra: '!h-11' })}
            aria-current={activeCategory ? undefined : 'page'}
          >
            All
          </Link>
          {categories.map((c) => {
            const isActive = activeCategory === c.key;
            return (
              <Link
                key={c.key}
                href={`/blog?category=${c.key}`}
                className={actionButtonClass(isActive ? 'brand' : 'neutral', { filled: isActive, extra: '!h-11' })}
                aria-current={isActive ? 'page' : undefined}
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

        {/* The way to /realstories (owner 2026-10-23). Real events are the
            post-event editorials, and their one home is Stories; this card is
            how a reader of the guides gets there. */}
        <section className="mt-16">
          <Eyebrow>Stories</Eyebrow>
          <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
            Real events, told in full
          </h2>
          <p className="mt-2 text-[15px] text-ink/65">
            Weddings, debuts, reunions and more — from the people who were there.
          </p>
          <Link
            href="/realstories"
            className="group mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-terracotta"
          >
            See the stories
            <ArrowRight aria-hidden className="h-4 w-4 transition group-hover:translate-x-0.5" strokeWidth={1.75} />
          </Link>
        </section>

        {/* Conversion footer — sells the free workspace, no quoted SKU price. */}
        <div className="mt-12 rounded-3xl bg-accent-soft p-8 text-center sm:p-12">
          <h2 className="font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
            Ready to start your own plan?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-ink/65">
            Guest list, budget, schedule, seat plan, and mood board — free with
            every Setnayan account, plus a preview of your supplier matches.
          </p>
          <Link
            href="/signup"
            className={actionButtonClass('brand', { main: true, extra: 'mt-6 !h-11' })}
          >
            Start planning · free
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>

    </main>
  );
}
