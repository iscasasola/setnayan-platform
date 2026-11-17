/**
 * articles-are-findable.test.ts — Build 3 of the Find · Build · Book drawing (owner-approved 17 Nov; specs
 * `prototypes/find_build_onboarding_2026-11-17_fable.html`, "New code — Build 3"; DECISION_LOG 2026-11-17
 * "DISCOVER ARTICLES ARE FOUND ON GOOGLE AND BY AI ANSWER ENGINES").
 *
 *   1 · one address for every list (`articleHref`) — the shipped chapter page; no door to `/articles` before its route
 *   2 · a hidden post: only an ACTIONED Hide counts; old and new Hide notes both count; it turns noindex
 *   3 · sitemap-articles.xml — honest lastmod, escaped, listed in the index
 *   4 · llms.txt — an Articles section only when there is one, Journal vs member named
 *   5 · structured data — DiscussionForumPosting / Article, replies as Comments, `</script>` cannot escape
 *   6 · ONE read behind Discover, the sitemap and llms.txt, failing closed on the hidden read
 *   7 · the article page is indexable (the old blanket noindex is gone) and carries its structured data
 *   8 · Discover's Articles part draws real rows, each a door to the article
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';

import { stripComments } from './strip-comments';
import {
  CHAPTER_HIDE_NOTE,
  CHAPTER_HIDE_NOTES,
  LLMS_ARTICLES_MAX,
  articleHref,
  articleRobots,
  articleStructuredData,
  articleSummary,
  hiddenChapterIds,
  jsonLdText,
  llmsArticlesSection,
  articlesSitemapUrls,
  type IndexedArticle,
} from './articles-index';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const BASE = 'https://www.setnayan.com';
// The shelves are compiled with the classic JSX runtime under tsx (same as discover-in-six-parts.test.ts).
(globalThis as unknown as { React: unknown }).React = React;

const member: IndexedArticle = {
  publicId: 'S89C-ABCDEFGHJK',
  title: 'Garden or church in Tagaytay for 150 guests?',
  authorSlug: 'tagaytaybride',
  authorName: 'tagaytaybride',
  isJournal: false,
  publishedAt: '2026-11-17T02:00:00.000Z',
  updatedAt: '2026-11-17T03:00:00.000Z',
  summary: 'We’re torn between two and the dates are close.',
};
const journal: IndexedArticle = {
  ...member,
  publicId: 'S89C-JOURNAL001',
  title: 'The money dance: where it came from and how it works',
  isJournal: true,
};

test('1 · one address: the shipped chapter page — and no /articles door before Build 2 ships its route', () => {
  assert.equal(articleHref(member), '/u/tagaytaybride/c/S89C-ABCDEFGHJK');
  assert.equal(articleHref(journal), '/u/tagaytaybride/c/S89C-JOURNAL001');
  assert.doesNotMatch(src('lib/articles-index.ts'), /\/articles\//, 'a door to /articles before the route exists (it lands on /[slug]/…)');
  for (const rel of [
    'app/sitemap-articles.xml/route.ts',
    'app/_components/frontdoor/discover-six-parts-data.ts',
    'app/u/[userSlug]/c/[chapterId]/page.tsx',
  ]) {
    assert.doesNotMatch(src(rel), /`\/articles\/|'\/articles\/|`\/u\/\$\{[^}]+\}\/c\//, `${rel} spells an article address itself`);
  }
});

test('2 · hidden = an ACTIONED report with a Hide note; open, escalated and dismissed stay up', () => {
  const ids = hiddenChapterIds([
    { target_id: 'A', status: 'actioned', action_taken: CHAPTER_HIDE_NOTE },
    { target_id: 'B', status: 'actioned', action_taken: CHAPTER_HIDE_NOTES[1]! },
    { target_id: 'C', status: 'open', action_taken: null },
    { target_id: 'D', status: 'actioned', action_taken: 'Escalated to owner / legal review.' },
    { target_id: 'E', status: 'dismissed', action_taken: CHAPTER_HIDE_NOTE },
  ]);
  assert.deepEqual([...ids].sort(), ['A', 'B'], 'the old note (posts hidden before 17 Nov) must still count');
  assert.deepEqual(articleRobots(false), { index: true, follow: true });
  assert.equal(articleRobots(true).index, false);

  const action = src('app/admin/user-reports/actions.ts');
  assert.match(action, /\?\s*CHAPTER_HIDE_NOTE\b/, 'a chapter Hide must write the note the hidden test reads');
  assert.doesNotMatch(action, /Removed from the Real Stories Storytellers shelf/, 'the Hide note is re-typed in the action');
  assert.match(action, /revalidatePath\('\/sitemap-articles\.xml'\)/, 'a Hide must refresh the sitemap at once');
});

test('3 · sitemap-articles.xml: every article, honest lastmod, escaped, and in the index', () => {
  const xml = articlesSitemapUrls([member, { ...journal, updatedAt: null, publishedAt: null }], `${BASE}/`);
  assert.match(xml, /<loc>https:\/\/www\.setnayan\.com\/u\/tagaytaybride\/c\/S89C-ABCDEFGHJK<\/loc>\s*<lastmod>2026-11-17T03:00:00\.000Z<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/www\.setnayan\.com\/u\/tagaytaybride\/c\/S89C-JOURNAL001<\/loc>\s*<changefreq>/, 'no date = no invented lastmod');
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
  assert.equal(articlesSitemapUrls([], BASE), '');
  assert.match(articlesSitemapUrls([{ ...member, title: 'x', authorSlug: 'a&b' }], BASE), /a%26b/);

  assert.match(src('app/sitemap.xml/route.ts'), /slug:\s*'sitemap-articles\.xml'/, 'the index does not list sitemap-articles.xml');
  const route = src('app/sitemap-articles.xml/route.ts');
  assert.match(route, /readPublicArticles\(\)/);
  assert.match(route, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n\$\{articlesSitemapUrls\(items, baseUrl\)\}/);
});

test('4 · llms.txt: an Articles section only when there is one; each line says whose words they are', () => {
  assert.equal(llmsArticlesSection([], BASE), '', 'nothing public (or a refused read) = no section');
  const out = llmsArticlesSection([journal, { ...member, title: 'Two\nlines [x]' }], BASE);
  assert.match(out, /^## Articles\n/);
  assert.match(out, /- \[The money dance[^\]]*\]\(https:\/\/www\.setnayan\.com\/u\/tagaytaybride\/c\/S89C-JOURNAL001\): Setnayan Journal/);
  assert.match(out, /- \[Two lines x\]\(https:\/\/www\.setnayan\.com\/u\/tagaytaybride\/c\/S89C-ABCDEFGHJK\): a member’s post by tagaytaybride/);
  const many = llmsArticlesSection(Array.from({ length: LLMS_ARTICLES_MAX + 7 }, () => member), BASE);
  assert.equal((many.match(/^- \[/gm) ?? []).length, LLMS_ARTICLES_MAX);

  assert.match(src('lib/llms-txt.ts'), /\$\{llmsArticlesSection\(input\.articles \?\? \[\], ORIGIN\)\}/);
  assert.match(src('app/llms.txt/route.ts'), /articles:\s*articles\.items/);
});

test('5 · structured data: a member post is a DiscussionForumPosting, a Journal post an Article', () => {
  const dfp = articleStructuredData(member, BASE, [
    { authorName: 'Taal Vista Hotel', asShop: true, text: 'April weekends go first here.', postedAt: null },
  ]);
  assert.equal(dfp['@type'], 'DiscussionForumPosting');
  assert.deepEqual((dfp.author as Record<string, unknown>)['@type'], 'Person');
  assert.equal(dfp.commentCount, 1);
  const c = (dfp.comment as Record<string, unknown>[])[0]!;
  assert.equal((c.author as Record<string, unknown>)['@type'], 'Organization', 'a shop replies as the shop');
  assert.equal(articleStructuredData(member, BASE).comment, undefined);

  const art = articleStructuredData(journal, BASE);
  assert.equal(art['@type'], 'Article');
  assert.deepEqual(art.author, { '@type': 'Organization', name: 'Setnayan Journal' });

  const text = jsonLdText(articleStructuredData({ ...member, title: '</script><script>alert(1)</script>' }, BASE));
  assert.doesNotMatch(text, /<\/script>/i, 'a title can end the JSON-LD script tag');
  assert.equal(articleSummary('First para\nstill first.\n\nSecond.'), 'First para still first.');
  assert.equal(articleSummary('   '), null);
});

test('6 · ONE read behind Discover, the sitemap and llms.txt — and it fails CLOSED on the hidden read', () => {
  for (const rel of ['app/sitemap-articles.xml/route.ts', 'app/llms.txt/route.ts', 'app/_components/frontdoor/discover-six-parts-data.ts']) {
    assert.match(src(rel), /readPublicArticles\(/, `${rel} lists articles with its own read`);
    assert.doesNotMatch(src(rel), /from\('creator_chapters'\)/, `${rel} reads the chapter store itself`);
  }
  const read = src('lib/articles-index.server.ts');
  assert.match(read, /\.eq\('status', 'published'\)/, 'a draft or a day-only chapter could be listed');
  assert.match(read, /chaptersRes\.error \|\| hidden === null/, 'an unreadable takedown must list nothing');
  assert.match(read, /!hidden\.has\(c\.public_id\)/, 'a hidden post is still listed');
  assert.match(read, /o\.public_profile_enabled !== true \|\| o\.deleted_at \|\| !o\.slug/, 'the author gate is not the page’s');
  assert.match(read, /return true;\s*\}\s*return hiddenChapterIds/, 'a refused hidden check must keep the page out of the index');
  for (const rel of ['lib/articles-index.ts', 'lib/articles-index.server.ts', 'app/sitemap-articles.xml/route.ts']) {
    assert.doesNotMatch(readFileSync(join(WEB, rel), 'utf8'), /^['"]use server['"]/m, `${rel} declares a server action`);
  }
});

test('7 · the article page is indexable unless hidden, canonical to its one address, with its structured data', () => {
  const page = src('app/u/[userSlug]/c/[chapterId]/page.tsx');
  assert.doesNotMatch(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/, 'the blanket noindex came back');
  assert.match(page, /robots:\s*articleRobots\(hidden\)/);
  assert.match(page, /const hidden = await articleIsHidden\(/);
  assert.match(page, /alternates:\s*\{\s*canonical\s*\}/);
  assert.match(page, /type="application\/ld\+json"[\s\S]{0,200}jsonLdText\(articleStructuredData\(/);
});

test('8 · Discover’s Articles part draws the posts, each a door to its article', async () => {
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
  assert.match(html, /href="\/u\/tagaytaybride\/c\/S89C-ABCDEFGHJK"/);
  assert.match(html, /href="\/u\/tagaytaybride\/c\/S89C-JOURNAL001"/);
  assert.match(html, /tagaytaybride · 17 Nov/);
  assert.match(html, /<b class="fd-art-jby">Setnayan Journal<\/b>/);
  assert.doesNotMatch(html, /coming soon|data-coming-soon/i, 'the placeholder came back');
  assert.doesNotMatch(html, /data-discover-see-all/, 'a See-all door to a feed that does not exist yet');
  assert.match(src('app/_components/frontdoor/front-door.tsx'), /<ArticlesShelf shelf=\{articleShelf\} \/>/);
});
