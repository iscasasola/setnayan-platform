/**
 * articles-index.ts — how a Discover article is found by Google and by AI answer engines (Build 3 of the
 * Find · Build · Book drawing, owner-approved 17 Nov; specs `prototypes/find_build_onboarding_2026-11-17_fable.html`,
 * "New code — Build 3"; DECISION_LOG 2026-11-17 "DISCOVER ARTICLES ARE FOUND ON GOOGLE AND BY AI ANSWER ENGINES").
 *
 *   · every public article is indexable from the moment it posts (Q8) — the article page sets no noindex
 *   · a removed or hidden post: an admin Hide sets `creator_chapters.removed_at` (Build 2, #7919; ruled 18 Nov on
 *     #7935: "hidden" IS `removed_at`, no new column). Every public read filters it, so the post 404s and leaves
 *     `sitemap-articles.xml`, llms.txt and Discover together. There is no second "hidden" test here.
 *   · `sitemap-articles.xml` — `articlesSitemapUrls`
 *   · `llms.txt` lists the articles — `llmsArticlesSection`
 *   · structured data: a member's (or a shop's) post is a DiscussionForumPosting, a Setnayan Journal post an
 *     Article — `articleStructuredData`
 *
 * PURE and clock-free, so the sitemap, llms.txt, the article page and the guard all agree by construction. The reads
 * are Build 2's (`lib/articles.server.ts`); `articles-index.server.ts` only shapes them.
 *
 * 🔑 ONE ADDRESS: `articleHref` from `lib/journal-move.ts` (Build 2) — `/articles/{slug}`. Nothing here spells it.
 *
 * 🔒 lib/articles-are-findable.test.ts
 */
import { articleHref as articleAddress, JOURNAL_BYLINE } from '@/lib/journal-move';
import type { Byline } from '@/lib/article-byline';

/** One public article, as every search-engine surface sees it. */
export type IndexedArticle = {
  /** `creator_chapters.slug` — the article's address. */
  slug: string;
  title: string;
  /** Who it speaks for — the one byline rule (`bylineFor`, Build 2). */
  byline: Byline;
  /** ISO timestamps. */
  publishedAt: string | null;
  updatedAt: string | null;
  /** A short plain-text line (Build 2's excerpt). */
  summary: string | null;
};

/** One reply, for a post's structured data. */
export type IndexedReply = {
  byline: Byline;
  text: string;
  postedAt: string | null;
};

/** The article's address — Build 2's one builder, so the sitemap, llms.txt, the canonical and Discover agree. */
export function articleHref(a: Pick<IndexedArticle, 'slug'>): string {
  return articleAddress(a.slug);
}

/** A Setnayan Journal post (Build 2's import) — an Article, authored by the Journal. */
export function isJournalArticle(a: Pick<IndexedArticle, 'byline'>): boolean {
  return a.byline.kind === 'journal';
}

/* ── sitemap-articles.xml ─────────────────────────────────────────────────────────────────────────── */

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * The `<url>` rows (the route wraps them in the sitemaps.org `<urlset>`, as every section sitemap does). Honest
 * per-row lastmod — the article's own updated_at, else published_at; never a build-time Date(), which Google reads
 * as freshness fraud. A row without either is listed without a lastmod rather than with an invented one.
 */
export function articlesSitemapUrls(
  articles: readonly { slug: string; updatedAt: string | null; publishedAt?: string | null }[],
  baseUrl: string,
): string {
  const base = baseUrl.replace(/\/$/, '');
  return articles
    .map((a) => {
      const when = a.updatedAt ?? a.publishedAt ?? null;
      const lastmod = when ? `\n    <lastmod>${new Date(when).toISOString()}</lastmod>` : '';
      return `  <url>\n    <loc>${xmlEscape(base + articleHref(a))}</loc>${lastmod}\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
    })
    .join('\n');
}

/* ── llms.txt · Articles ──────────────────────────────────────────────────────────────────────────── */

/** How many articles llms.txt names, newest first. The sitemap carries every one; this file stays readable. */
export const LLMS_ARTICLES_MAX = 50;

/** One line of markdown never breaks: no newlines, no stray brackets in a link label. */
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim();
}

/** Whose words these are, for an answer engine — never a member's opinion quoted as Setnayan's. */
function whoseWords(b: Byline): string {
  if (b.kind === 'journal') return JOURNAL_BYLINE;
  if (b.kind === 'shop') return `a supplier’s post by ${oneLine(b.name)}`;
  return `a member’s post by ${oneLine(b.name)}`;
}

/**
 * The `## Articles` section, or '' when there is nothing public to list (a failed read passes [] too: say less,
 * never something untrue). Each line names who wrote it.
 */
export function llmsArticlesSection(articles: readonly IndexedArticle[], baseUrl: string): string {
  if (articles.length === 0) return '';
  const base = baseUrl.replace(/\/$/, '');
  const lines = articles.slice(0, LLMS_ARTICLES_MAX).map((a) => {
    const summary = a.summary ? ` — ${oneLine(a.summary).slice(0, 160)}` : '';
    return `- [${oneLine(a.title)}](${base}${articleHref(a)}): ${whoseWords(a.byline)}${summary}`;
  });
  return `## Articles\n\nPosts on Setnayan's Discover. Setnayan Journal posts are Setnayan's own; every other post is its author's own words, not Setnayan's.\n\n${lines.join('\n')}\n\n`;
}

/* ── Structured data ──────────────────────────────────────────────────────────────────────────────── */

/** A person posts as a Person; a shop always as the shop (ruled 17 Nov) — an Organization. */
function agent(b: Byline): Record<string, unknown> {
  return { '@type': b.kind === 'person' ? 'Person' : 'Organization', name: b.name };
}

/**
 * The JSON-LD for one article page (drawn 17 Nov, "Search-engine files"): a member's or a shop's post is a
 * DiscussionForumPosting — the type Google reads for forum results — with its replies as Comments; a Setnayan
 * Journal post is an Article authored by the Journal.
 */
export function articleStructuredData(
  a: IndexedArticle,
  baseUrl: string,
  replies: readonly IndexedReply[] = [],
): Record<string, unknown> {
  const url = `${baseUrl.replace(/\/$/, '')}${articleHref(a)}`;
  const dates = {
    ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
    ...(a.updatedAt ? { dateModified: a.updatedAt } : {}),
  };
  if (isJournalArticle(a)) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      url,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: JOURNAL_BYLINE },
      publisher: { '@type': 'Organization', name: 'Setnayan' },
      ...dates,
    };
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: a.title,
    url,
    mainEntityOfPage: url,
    author: agent(a.byline),
    ...dates,
    ...(a.summary ? { text: a.summary } : {}),
    commentCount: replies.length,
    ...(replies.length > 0
      ? {
          comment: replies.map((r) => ({
            '@type': 'Comment',
            author: agent(r.byline),
            text: r.text,
            ...(r.postedAt ? { datePublished: r.postedAt } : {}),
          })),
        }
      : {}),
  };
}

/**
 * JSON for a `<script type="application/ld+json">`. A post's title is the writer's own text, so `<` is escaped:
 * a title holding `</script>` must not end the script tag.
 */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
