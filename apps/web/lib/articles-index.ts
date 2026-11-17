/**
 * articles-index.ts — how a Discover article is found by Google and by AI answer engines (Build 3 of the
 * Find · Build · Book drawing, owner-approved 17 Nov; specs `prototypes/find_build_onboarding_2026-11-17_fable.html`,
 * "New code — Build 3"; DECISION_LOG 2026-11-17 "DISCOVER ARTICLES ARE FOUND ON GOOGLE AND BY AI ANSWER ENGINES").
 *
 *   · every public article is indexable from the moment it posts (Q8) — `articleRobots`
 *   · a removed or reported-and-hidden one turns noindex AND leaves `sitemap-articles.xml` — `isHiddenByModeration`
 *   · `sitemap-articles.xml` — `articlesSitemapUrls`
 *   · `llms.txt` lists the articles — `llmsArticlesSection`
 *   · structured data: a member's post is a DiscussionForumPosting, a Setnayan Journal post is an Article —
 *     `articleStructuredData`
 *
 * PURE and clock-free, so the sitemap, llms.txt, the article page and the guard all agree by construction. The reads
 * live in `articles-index.server.ts`.
 *
 * 🔑 THE STORE IS `creator_chapters` (ruled 17 Nov: "the article store — one source"). Build 2 (#7919) adds the
 * article's own slug, its tags, `is_journal`, the posting name and replies, and the `/articles/{slug}` route. Until
 * that lands this module addresses every post at the page that EXISTS (`/u/{slug}/c/{id}`) — never a door to a
 * route that does not exist yet. `articleHref` is the ONE place the address is decided, so the switch is one line.
 *
 * 🔒 lib/articles-are-findable.test.ts
 */

/** One public article, as every search-engine surface sees it. */
export type IndexedArticle = {
  /** `creator_chapters.public_id` (S89C-…). */
  publicId: string;
  title: string;
  /** The author's public slug (`users.slug`) — the shipped address needs it. */
  authorSlug: string;
  /** The name the post is shown under. */
  authorName: string;
  /** A Setnayan Journal post (Build 2's import) — an Article, authored by the Journal. */
  isJournal: boolean;
  /** ISO timestamps. */
  publishedAt: string | null;
  updatedAt: string | null;
  /** A short plain-text line for llms.txt (first paragraph, trimmed). */
  summary: string | null;
};

/** One reply, for a member post's structured data (Build 2's replies table; empty until it lands). */
export type IndexedReply = {
  authorName: string;
  /** A shop replies as the shop (ruled 17 Nov) — an Organization, not a Person. */
  asShop: boolean;
  text: string;
  postedAt: string | null;
};

/**
 * The article's address. ONE place, so the sitemap, llms.txt, the canonical tag and the Discover row never disagree.
 * Today that is the chapter page that ships. Build 2 (#7919) adds `/articles/{slug}` (ruled 17 Nov) TOGETHER WITH its
 * route — the branch belongs in that PR, because an `/articles/…` link before the route exists lands on the event
 * page route (`/[slug]/…`), which the screens map rightly reports as a door.
 */
export function articleHref(a: Pick<IndexedArticle, 'authorSlug' | 'publicId'>): string {
  return `/u/${encodeURIComponent(a.authorSlug)}/c/${encodeURIComponent(a.publicId)}`;
}

/* ── A removed or hidden post ─────────────────────────────────────────────────────────────────────── */

/**
 * The note `resolveReport` writes when an admin presses Hide on a reported article (app/admin/user-reports/actions.ts
 * imports it — a 'use server' file may export only async functions, so the words live here). With the 17 Nov ruling
 * a hidden article leaves Google and AI answers too, so the note says so.
 */
export const CHAPTER_HIDE_NOTE =
  'Hidden by Setnayan moderator: off the Storytellers shelf, Discover, the sitemap and search engines (stays on the creator’s own page).';

/**
 * Every note a chapter Hide has ever written — the shipped wording before 17 Nov included, so a post hidden before
 * this change stays hidden. Matching is on the exact note, never a substring: an Escalate or a Dismiss on the same
 * post writes a different note and leaves it up.
 */
export const CHAPTER_HIDE_NOTES: readonly string[] = [
  CHAPTER_HIDE_NOTE,
  'Removed from the Real Stories Storytellers shelf by Setnayan moderator (stays on the creator’s own page).',
];

/** A `user_reports` row, as far as the hidden test needs it. */
export type ChapterReportRow = { target_id: string; status: string; action_taken: string | null };

/** The public ids an admin has hidden. Only an ACTIONED report with a Hide note counts — an open report is not a verdict. */
export function hiddenChapterIds(reports: readonly ChapterReportRow[]): Set<string> {
  const out = new Set<string>();
  for (const r of reports) {
    if (r.status === 'actioned' && r.action_taken != null && CHAPTER_HIDE_NOTES.includes(r.action_taken)) {
      out.add(r.target_id);
    }
  }
  return out;
}

/**
 * The robots line of an article page. Public = indexed and followed (ruled 17 Nov, Q8: "from the moment it posts").
 * Hidden by a moderator = noindex. (A removed post — unpublished, private profile, deleted — has no page at all: it
 * 404s, and its metadata is already noindex.)
 */
export function articleRobots(hidden: boolean): { index: boolean; follow: boolean } {
  return hidden ? { index: false, follow: false } : { index: true, follow: true };
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
export function articlesSitemapUrls(articles: readonly IndexedArticle[], baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  return articles
    .map((a) => {
      const when = a.updatedAt ?? a.publishedAt;
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

/**
 * The `## Articles` section, or '' when there is nothing public to list (a failed read passes [] too: say less,
 * never something untrue). Each line names who wrote it — "Setnayan Journal" or "a member's post" — so an answer
 * engine never quotes a member's opinion as Setnayan's.
 */
export function llmsArticlesSection(articles: readonly IndexedArticle[], baseUrl: string): string {
  if (articles.length === 0) return '';
  const base = baseUrl.replace(/\/$/, '');
  const lines = articles.slice(0, LLMS_ARTICLES_MAX).map((a) => {
    const who = a.isJournal ? 'Setnayan Journal' : `a member’s post by ${oneLine(a.authorName)}`;
    const summary = a.summary ? ` — ${oneLine(a.summary).slice(0, 160)}` : '';
    return `- [${oneLine(a.title)}](${base}${articleHref(a)}): ${who}${summary}`;
  });
  return `## Articles\n\nPosts on Setnayan's Discover. Setnayan Journal posts are Setnayan's own; every other post is a member's own words, not Setnayan's.\n\n${lines.join('\n')}\n\n`;
}

/** The first paragraph of a body, trimmed to a line — the llms.txt summary. Pure. */
export function articleSummary(body: string | null): string | null {
  const first = (body ?? '').split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
  if (!first) return null;
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
}

/* ── Structured data ──────────────────────────────────────────────────────────────────────────────── */

/**
 * The JSON-LD for one article page (drawn 17 Nov, "Search-engine files"): a member's post is a
 * DiscussionForumPosting — the type Google reads for forum results — with its replies as Comments; a Setnayan
 * Journal post is an Article authored by the Journal. A reply from a shop is an Organization (a shop always replies
 * as the shop, ruled 17 Nov).
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
  if (a.isJournal) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      url,
      mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'Setnayan Journal' },
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
    author: { '@type': 'Person', name: a.authorName, url: `${baseUrl.replace(/\/$/, '')}/u/${encodeURIComponent(a.authorSlug)}` },
    ...dates,
    ...(a.summary ? { text: a.summary } : {}),
    commentCount: replies.length,
    ...(replies.length > 0
      ? {
          comment: replies.map((r) => ({
            '@type': 'Comment',
            author: { '@type': r.asShop ? 'Organization' : 'Person', name: r.authorName },
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
