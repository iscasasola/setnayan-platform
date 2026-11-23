/**
 * articles-are-findable.test.ts — Build 3 of the Find · Build · Book drawing (owner-approved 17 Nov; specs
 * `prototypes/find_build_onboarding_2026-11-17_fable.html`, "New code — Build 3"; DECISION_LOG 2026-11-17
 * "DISCOVER ARTICLES ARE FOUND ON GOOGLE AND BY AI ANSWER ENGINES"). Rulings of 18 Nov on #7935: "hidden" uses
 * Build 2's `creator_chapters.removed_at` (no new column); Discover's Articles "See all" opens Build 2's feed.
 *
 *   1 · one address for every list (`articleHref` → Build 2's `/articles/{slug}`), never spelled by hand
 *   2 · a removed or hidden post: an admin Hide sets `removed_at`, and every list's read filters it
 *   3 · sitemap-articles.xml — honest lastmod, escaped, listed in the index
 *   4 · llms.txt — an Articles section only when there is one; Journal, shop and member named; its words live only in
 *       the one search-and-AI source, lib/llms-txt.ts (#8041)
 *   5 · structured data — DiscussionForumPosting / Article, replies as Comments, `</script>` cannot escape
 *   6 · Build 2's reads are the only reads; a refused read lists nothing
 *   7 · the article page is indexable, canonical to its one address, with its structured data
 *   8 · Discover's Articles part draws the posts, each a door to its article, and See all opens the feed
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';

import { stripComments } from './strip-comments';
import {
  articleHref,
  articleStructuredData,
  isJournalArticle,
  jsonLdText,
  articlesSitemapUrls,
  type IndexedArticle,
} from './articles-index';
// The llms.txt WORDS for articles live in the one search-and-AI source (#8041), never in articles-index.ts.
import { LLMS_ARTICLES_MAX, llmsArticlesSection } from './llms-txt';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BASE = 'https://www.setnayan.com';
// The shelves are compiled with the classic JSX runtime under tsx (same as discover-in-six-parts.test.ts).
(globalThis as unknown as { React: unknown }).React = React;

const member: IndexedArticle = {
  slug: 'garden-or-church-in-tagaytay',
  title: 'Garden or church in Tagaytay for 150 guests?',
  byline: { kind: 'person', name: 'tagaytaybride' },
  publishedAt: '2026-11-17T02:00:00.000Z',
  updatedAt: '2026-11-17T03:00:00.000Z',
  summary: 'We’re torn between two and the dates are close.',
};
const journal: IndexedArticle = {
  ...member,
  slug: 'the-money-dance',
  title: 'The money dance: where it came from and how it works',
  byline: { kind: 'journal', name: 'Setnayan Journal' },
};
const shop: IndexedArticle = { ...member, slug: 'april-weekends', title: 'April weekends', byline: { kind: 'shop', name: 'Taal Vista Hotel' } };

/** The body of one exported function in a source file — enough to pin a filter to the read it belongs to. */
function fnBody(source: string, name: string): string {
  const at = source.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `${name} is gone`);
  const rest = source.slice(at + 1);
  const next = rest.search(/\n(?:export |async function |function |const |type )/);
  return source.slice(at, next < 0 ? undefined : at + 1 + next);
}

test('1 · one address: Build 2’s /articles/{slug}, never spelled by hand', () => {
  assert.equal(articleHref(member), '/articles/garden-or-church-in-tagaytay');
  assert.equal(articleHref(journal), '/articles/the-money-dance');
  assert.match(src('lib/articles-index.ts'), /from '@\/lib\/journal-move'/, 'the address must come from Build 2’s one builder');
  for (const rel of [
    'lib/articles-index.ts',
    'app/sitemap-articles.xml/route.ts',
    'app/_components/frontdoor/discover-six-parts-data.ts',
  ]) {
    assert.doesNotMatch(src(rel), /`\/articles\/|'\/articles\/|"\/articles\/|`\/u\/\$\{[^}]+\}\/c\//, `${rel} spells an article address itself`);
  }
});

test('2 · a hidden post is a removed post: Hide sets removed_at, and every list’s read filters it', () => {
  const action = src('app/admin/user-reports/actions.ts');
  assert.match(action, /from\('creator_chapters'\)\s*\.update\(\{[^}]*removed_at:/, 'an admin Hide must take the article down');
  assert.match(action, /revalidatePath\('\/sitemap-articles\.xml'\)/, 'a Hide must refresh the sitemap at once');
  assert.match(action, /revalidatePath\('\/llms\.txt'\)/, 'a Hide must refresh llms.txt at once');

  // Main (#7919's ship review) moved the four "public now" clauses into ONE definition, `onlyPublicArticles`
  // (lib/public-articles.ts), which every read in articles.server.ts uses. So: each read goes through it, and it
  // still holds the removed and draft clauses — the same two facts this test pinned inline before.
  const ruleSrc = src('lib/public-articles.ts');
  const ruleAt = ruleSrc.indexOf('export function onlyPublicArticles');
  assert.ok(ruleAt >= 0, 'onlyPublicArticles is gone');
  const rule = ruleSrc.slice(ruleAt);
  assert.match(rule, /\.is\('removed_at', null\)/, 'onlyPublicArticles lets a removed post through');
  assert.match(rule, /\.eq\('status', 'published'\)/, 'onlyPublicArticles lets a draft through');
  const reads = src('lib/articles.server.ts');
  for (const fn of ['listArticles', 'listPublicArticleAddresses', 'articleBySlug']) {
    const body = fnBody(reads, fn);
    assert.match(body, /onlyPublicArticles\(\s*supabase\s*\.from\('creator_chapters'\)/, `${fn} lists a removed post or a draft — it skips onlyPublicArticles`);
  }
  for (const rel of ['lib/articles-index.ts', 'lib/articles-index.server.ts', 'app/admin/user-reports/actions.ts']) {
    assert.doesNotMatch(src(rel), /CHAPTER_HIDE_NOTE|hiddenChapterIds/, `${rel} keeps a second “hidden” test beside removed_at`);
  }
});

test('3 · sitemap-articles.xml: every article, honest lastmod, escaped, and in the index', () => {
  const xml = articlesSitemapUrls([member, { ...journal, updatedAt: null, publishedAt: null }], `${BASE}/`);
  assert.match(xml, /<loc>https:\/\/www\.setnayan\.com\/articles\/garden-or-church-in-tagaytay<\/loc>\s*<lastmod>2026-11-17T03:00:00\.000Z<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/www\.setnayan\.com\/articles\/the-money-dance<\/loc>\s*<changefreq>/, 'no date = no invented lastmod');
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
  assert.equal(articlesSitemapUrls([], BASE), '');
  assert.match(articlesSitemapUrls([{ slug: 'a&b', updatedAt: null }], BASE), /a&amp;b/);

  assert.match(src('app/sitemap.xml/route.ts'), /slug:\s*'sitemap-articles\.xml'/, 'the index does not list sitemap-articles.xml');
  const route = src('app/sitemap-articles.xml/route.ts');
  assert.match(route, /readPublicArticleAddresses\(\)/);
  assert.match(route, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n\$\{articlesSitemapUrls\(items, baseUrl\)\}/);
});

test('4 · llms.txt: an Articles section only when there is one; each line says whose words they are', () => {
  assert.equal(llmsArticlesSection([], BASE), '', 'nothing public (or a refused read) = no section');
  const out = llmsArticlesSection([journal, shop, { ...member, title: 'Two\nlines [x]' }], BASE);
  assert.match(out, /^## Articles\n/);
  assert.match(out, /- \[The money dance[^\]]*\]\(https:\/\/www\.setnayan\.com\/articles\/the-money-dance\): Setnayan Journal/);
  assert.match(out, /- \[April weekends\]\(https:\/\/www\.setnayan\.com\/articles\/april-weekends\): a supplier’s post by Taal Vista Hotel/);
  assert.match(out, /- \[Two lines x\]\(https:\/\/www\.setnayan\.com\/articles\/garden-or-church-in-tagaytay\): a member’s post by tagaytaybride/);
  const many = llmsArticlesSection(Array.from({ length: LLMS_ARTICLES_MAX + 7 }, () => member), BASE);
  assert.equal((many.match(/^- \[/gm) ?? []).length, LLMS_ARTICLES_MAX);

  assert.match(src('lib/llms-txt.ts'), /\$\{llmsArticlesSection\(input\.articles \?\? \[\], ORIGIN\)\}/);
  // ONE SOURCE (controller, 22 Nov: "make #8041 the one source … never a second copy"): the section's words are in
  // lib/llms-txt.ts only. SABOTAGE: move the section (or its intro line) back into articles-index.ts → RED.
  const index = src('lib/articles-index.ts');
  assert.doesNotMatch(index, /## Articles|own words|a member’s post by|a supplier’s post by|llmsArticlesSection/, 'articles-index.ts carries llms.txt words again — they belong in lib/llms-txt.ts');
  assert.match(src('lib/llms-txt.ts'), /export function llmsArticlesSection\(/);
  assert.match(src('app/llms.txt/route.ts'), /articles:\s*articles\.items/);
});

test('5 · structured data: a member or shop post is a DiscussionForumPosting, a Journal post an Article', () => {
  const dfp = articleStructuredData(member, BASE, [
    { byline: { kind: 'shop', name: 'Taal Vista Hotel' }, text: 'April weekends go first here.', postedAt: null },
  ]);
  assert.equal(dfp['@type'], 'DiscussionForumPosting');
  assert.equal(dfp.url, 'https://www.setnayan.com/articles/garden-or-church-in-tagaytay');
  assert.deepEqual(dfp.author, { '@type': 'Person', name: 'tagaytaybride' });
  assert.equal(dfp.commentCount, 1);
  const c = (dfp.comment as Record<string, unknown>[])[0]!;
  assert.equal((c.author as Record<string, unknown>)['@type'], 'Organization', 'a shop replies as the shop');
  assert.equal(articleStructuredData(member, BASE).comment, undefined);
  assert.deepEqual(articleStructuredData(shop, BASE).author, { '@type': 'Organization', name: 'Taal Vista Hotel' }, 'a shop posts as the shop');

  assert.ok(isJournalArticle(journal) && !isJournalArticle(shop));
  const art = articleStructuredData(journal, BASE);
  assert.equal(art['@type'], 'Article');
  assert.deepEqual(art.author, { '@type': 'Organization', name: 'Setnayan Journal' });

  const text = jsonLdText(articleStructuredData({ ...member, title: '</script><script>alert(1)</script>' }, BASE));
  assert.doesNotMatch(text, /<\/script>/i, 'a title can end the JSON-LD script tag');
});

test('6 · Build 2’s reads are the only reads — and a refused read lists nothing', () => {
  const shaper = src('lib/articles-index.server.ts');
  assert.doesNotMatch(shaper, /from\('creator_chapters'\)|createAdminClient/, 'a second read of the article store');
  assert.match(fnBody(shaper, 'readPublicArticles'), /await listArticles\(\);\s*if \(!res\.ok\) return \{ ok: false, items: \[\] \};/);
  assert.match(fnBody(shaper, 'readPublicArticleAddresses'), /await listPublicArticleAddresses\(\);\s*return res\.ok \? \{ ok: true, items: res\.data \} : \{ ok: false, items: \[\] \};/);
  for (const rel of ['app/llms.txt/route.ts', 'app/_components/frontdoor/discover-six-parts-data.ts']) {
    assert.match(src(rel), /readPublicArticles\(/, `${rel} lists articles with its own read`);
  }
  for (const rel of ['app/sitemap-articles.xml/route.ts', 'app/llms.txt/route.ts', 'app/_components/frontdoor/discover-six-parts-data.ts']) {
    assert.doesNotMatch(src(rel), /from\('creator_chapters'\)/, `${rel} reads the chapter store itself`);
  }
  for (const rel of ['lib/articles-index.ts', 'lib/articles-index.server.ts', 'app/sitemap-articles.xml/route.ts']) {
    assert.doesNotMatch(readFileSync(join(WEB, rel), 'utf8'), /^['"]use server['"]/m, `${rel} declares a server action`);
  }
});

test('7 · the article page is indexable, canonical to its one address, with its structured data', () => {
  const page = src('app/(shell)/articles/[slug]/page.tsx');
  assert.doesNotMatch(page, /robots:\s*\{\s*index:\s*false/, 'an article page turned noindex');
  assert.match(page, /alternates:\s*\{\s*canonical:\s*articleHref\(res\.data\.slug\)\s*\}/);
  assert.match(page, /type="application\/ld\+json"[\s\S]{0,200}jsonLdText\(\s*articleStructuredData\(/);
  assert.match(page, /a\.replies\.ok \? a\.replies\.data\.map\(/, 'the replies never reach the structured data');
  assert.match(page, /if \(res\.ok && !res\.data\) notFound\(\);/, 'a removed post must 404, not render');
});

test('8 · Discover’s Articles part draws the posts, each a door to its article; See all opens the feed', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const m = await import('@/app/_components/frontdoor/discover-six-parts');
  const html = renderToStaticMarkup(
    React.createElement(m.ArticlesShelf, {
      shelf: {
        status: 'ok',
        items: [
          { key: 'a', title: 'Garden or church?', href: articleHref(member), by: 'tagaytaybride', isJournal: false, postedAt: member.publishedAt, line: 'Torn.' },
          { key: 'b', title: 'Best months', href: articleHref(journal), by: 'Setnayan Journal', isJournal: true, postedAt: null, line: null },
        ],
      },
    }),
  );
  assert.equal((html.match(/data-discover-article=""/g) ?? []).length, 2);
  assert.match(html, /href="\/articles\/garden-or-church-in-tagaytay"/);
  assert.match(html, /href="\/articles\/the-money-dance"/);
  assert.match(html, /tagaytaybride · 17 Nov/);
  assert.match(html, /<b class="fd-art-jby">Setnayan Journal<\/b>/);
  assert.doesNotMatch(html, /coming soon|data-coming-soon/i, 'the placeholder came back');
  assert.match(html, /<a(?=[^>]*data-discover-see-all="")(?=[^>]*href="\/articles")[^>]*>See all/, 'See all must open Build 2’s feed');

  const empty = renderToStaticMarkup(React.createElement(m.ArticlesShelf, { shelf: { status: 'ok', items: [] } }));
  assert.doesNotMatch(empty, /data-discover-see-all/, 'See all on an empty part');
  assert.match(src('app/_components/frontdoor/front-door.tsx'), /<ArticlesShelf shelf=\{articleShelf\} \/>/);
});
