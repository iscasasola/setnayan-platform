import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ChevronLeft, ArrowRight, ArrowUpRight, Download } from 'lucide-react';
import { Logo } from '@/app/_components/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchApprovedSpotlightsForSlug } from '@/lib/journal-spotlights';
import { JournalPartnerCredit } from './_components/journal-partner-credit';
import { ShopLink } from './_components/shop-link';
import {
  ALL_BLOG_ARTICLES,
  findBlogArticle,
  relatedBlogArticles,
  blogMetaDescription,
  blogPlainText,
  blogCategoryLabel,
  readingMinutes,
  isValidShopHref,
  articleHasShopLinks,
  AFFILIATE_DISCLOSURE,
  type BlogBlock,
} from '@/lib/blog';
import {
  fetchPublishedChapterForShare,
  type PublicChapter,
} from '@/lib/creator-public';
import { EMBED_PROVIDER_LABEL } from '@/lib/creator-chapters';
import { ChapterEmbedFrame } from '@/app/dashboard/(account)/creator/_components/chapter-embed-frame';

// Per-article Journal pages — magazine reader (iteration 0038, 2026-06-15).
// Immersive cover header, drop-cap lead, gold pull-quotes ("nuggets"), inline
// figures, and photo "keep reading" cards. Same soft-404-proof shape as the
// first slice: the article set is a fixed in-code constant, every slug is
// pre-rendered, anything else 404s (dynamicParams=false). No loading boundary
// that would commit a 200 before notFound() runs.
//
// ⚠ "No DB" WAS TRUE AND NO LONGER IS. Two reads now hang off this page, and
// BOTH are fail-soft by construction: approved Journal Spotlights (Wave 5) and
// embedded storyteller chapters (§ 3.4). Neither may ever break the article —
// a database problem costs the page its credits or its embed, never its prose.
// The article set itself is still an in-code constant, so the route stays on
// hourly ISR rather than going dynamic.
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
  const imageUrl = `${SITE_URL}${article.cover}`;
  return {
    title: article.title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title: `${article.title} · Setnayan Articles`,
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

/** A storyteller chapter that passed EVERY public gate — see ResolvedChapters. */
type ResolvedChapter = {
  chapter: PublicChapter;
  ownerName: string;
  ownerSlug: string;
};

/**
 * Chapters resolved ONCE in the page body, keyed by the public_id the BLOCK
 * asked for. The Block switch is then a pure synchronous lookup: making it
 * async would serialise one database read per block inside the render and
 * scatter the failure handling across N call sites.
 *
 * A publicId missing from this map means "did not pass the public gate, or the
 * read failed" — and both render nothing, which is the honest answer either
 * way. The two are told apart in the LOGS, not on the page (see
 * lib/creator-public.ts).
 */
type ResolvedChapters = ReadonlyMap<string, ResolvedChapter>;

function Block({
  block,
  lead,
  chapters,
  slug,
}: {
  block: BlogBlock;
  lead?: boolean;
  chapters: ResolvedChapters;
  slug: string;
}) {
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
    // Affiliate / shopping recommendation. A MALFORMED HREF EARNS NOTHING AND
    // LOOKS EXACTLY LIKE A WORKING ONE, so a bad one renders as prose with no
    // button rather than as a dead link the reader taps and blames us for.
    // isValidShopHref also rejects our OWN domains — marking an internal link
    // rel="sponsored nofollow" would tell Google to distrust our own linking.
    case 'shop': {
      if (!isValidShopHref(block.href)) {
        return (
          <p className="mt-6 text-base leading-relaxed text-ink/75 sm:text-lg">
            {block.text}
          </p>
        );
      }
      return (
        <div className="my-8 rounded-2xl border border-mulberry/20 bg-accent-soft p-5 sm:p-6">
          <p className="text-base leading-relaxed text-ink/80">{block.text}</p>
          <ShopLink
            href={block.href}
            label={block.label}
            merchant={block.merchant}
            slug={slug}
          />
          <p className="mt-3 text-xs text-ink/50">
            Takes you to {block.merchant}. We may earn a commission.
          </p>
        </div>
      );
    }
    // A storyteller's chapter, woven into the prose where the article cites it
    // (FABLE Public Marketplace § 3.4). Gold is the FRAME here, never a button.
    //
    // THE VANISHING IS THE FEATURE: a missing entry means the chapter was
    // unpublished, the storyteller's profile went dark, the id is wrong, or the
    // read failed — and all four render NOTHING. The paragraphs either side
    // close up and the article stays readable. No empty shell, no "chapter
    // unavailable", no skeleton: this is a marketing page, and an error box
    // about somebody else's video would be worse than silence.
    //
    // STALENESS, STATED: this route is dynamicParams=false + revalidate=3600,
    // so a chapter unpublished right now can linger up to an hour — and if the
    // database is unreachable at a revalidate tick, the degraded (absent)
    // render is CACHED for that hour with nothing visible to blame. Accepted
    // per § 3.4 item 4; the resolver's console.error is where it shows up.
    case 'chapter': {
      const resolved = chapters.get(block.publicId);
      if (!resolved) return null;
      // Typed nullable on PublicChapter even though the resolver only returns
      // rows that carry one. A real check, not a `!` assertion — the assertion
      // would be a lie the day the resolver is refactored.
      const src = resolved.chapter.embed_url;
      if (!src) return null;
      // embed_provider is nullable in the schema; never print "plays on
      // undefined" on a public page — drop the clause instead.
      const provider = resolved.chapter.embed_provider;
      const initial = resolved.ownerName.trim().charAt(0).toUpperCase() || '·';
      return (
        <div className="my-10 rounded-2xl border-[1.5px] border-terracotta bg-white/60 p-3 sm:p-4">
          <ChapterEmbedFrame src={src} title={resolved.chapter.title} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-display text-sm font-semibold text-ink"
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-ink">
                Chapter: {resolved.chapter.title}
              </p>
              {/* The storyteller's name is a door to their own page. No
                  restructuring needed here and that is worth stating: this
                  byline is a plain sibling, NOT inside the block's "Open"
                  anchor, so wrapping it creates no nested link. The two
                  destinations are deliberately different — "Open" goes to this
                  chapter, the name goes to everything they have written. */}
              <p className="mt-0.5 text-xs text-ink/60">
                <Link
                  href={`/u/${resolved.ownerSlug}`}
                  className="font-medium text-ink/75 underline-offset-2 transition-colors hover:text-ink hover:underline"
                >
                  {resolved.ownerName}
                </Link>
                {provider ? ` · plays on ${EMBED_PROVIDER_LABEL[provider]}` : null}
              </p>
            </div>
            <Link
              href={`/u/${resolved.ownerSlug}/c/${resolved.chapter.public_id}`}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-link underline-offset-4 hover:underline"
            >
              Open
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
          {block.note ? (
            <p className="mt-3 text-[13px] leading-relaxed text-ink/60">
              {block.note}
            </p>
          ) : null}
        </div>
      );
    }
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

  // Approved Journal Spotlights (Wave 5) crediting vendors in this article.
  // Cookie-free admin client keeps the route on hourly ISR (not forced dynamic);
  // the helper filters to admin_approved_at IS NOT NULL so only published credits
  // surface. Fail-soft — a DB hiccup must never break the article render.
  let spotlights: Awaited<ReturnType<typeof fetchApprovedSpotlightsForSlug>> = [];
  try {
    spotlights = await fetchApprovedSpotlightsForSlug(createAdminClient(), slug);
  } catch (err) {
    console.error('[blog/[slug]] spotlight fetch failed', err);
  }

  // Embedded storyteller chapters (§ 3.4). Resolved ONCE here, in parallel and
  // deduped, so an article citing the same chapter twice does one read and the
  // Block switch stays a pure synchronous lookup.
  //
  // The resolver re-applies the FULL public gate (chapter published + carries
  // an embed, owner's profile public + non-deleted + slugged), so an unresolved
  // id simply never enters the map.
  //
  // allSettled, not all: a throw is only possible from something shared (an
  // admin client with missing env), but if that ever stops being true, one bad
  // id must not blank every other chapter in the article. A rejection is logged
  // and that ONE block disappears. Nothing here may rethrow — a database
  // problem may cost the article its embed, never the article itself.
  //
  // Keyed by the id the BLOCK asked for, not the one the row came back with, so
  // the lookup in Block can never miss on a round-trip difference.
  const chapters = new Map<string, ResolvedChapter>();
  const chapterIds = [
    ...new Set(
      article.blocks
        .filter((b): b is Extract<BlogBlock, { type: 'chapter' }> => b.type === 'chapter')
        .map((b) => b.publicId),
    ),
  ];
  if (chapterIds.length > 0) {
    const settled = await Promise.allSettled(
      chapterIds.map((id) => fetchPublishedChapterForShare(id)),
    );
    settled.forEach((outcome, i) => {
      // `chapterIds[i]` is `string | undefined` under noUncheckedIndexedAccess
      // even though allSettled preserves the input order — read it once and
      // check it, rather than asserting a pairing the type system can't see.
      const requestedId = chapterIds[i];
      if (!requestedId) return;
      if (outcome.status === 'rejected') {
        console.error(
          '[blog/[slug]] chapter resolve threw',
          requestedId,
          outcome.reason,
        );
        return;
      }
      if (outcome.value) chapters.set(requestedId, outcome.value);
    });
  }

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
        name: 'Articles',
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
            <Logo height={32} withWordmark title="Setnayan · Articles" />
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
            Articles
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/blog?category=${article.category}`}
            className="hover:text-ink hover:underline"
          >
            {categoryLabel}
          </Link>
        </nav>

        {/* Affiliate disclosure. Derived from the BLOCKS, never hand-added, so
            an editor cannot ship a shopping link without it — and cannot leave
            a stale one behind after removing the last link. It sits ABOVE the
            prose on purpose: a disclosure a reader meets after they have
            already clicked is not a disclosure. */}
        {articleHasShopLinks(article.blocks) ? (
          <p className="mb-8 rounded-xl border border-ink/10 bg-ink/[0.03] px-4 py-3 text-sm leading-relaxed text-ink/60">
            {AFFILIATE_DISCLOSURE}
          </p>
        ) : null}

        <div>
          {article.blocks.map((block, i) => (
            <Block
              key={i}
              block={block}
              lead={i === firstParagraphIndex}
              chapters={chapters}
              slug={article.slug}
            />
          ))}
        </div>

        {/* Featured-partner / sponsored vendor credits (Journal Spotlights,
            Wave 5). Renders nothing when there are no approved credits. */}
        <JournalPartnerCredit spotlights={spotlights} />

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

    </main>
  );
}
