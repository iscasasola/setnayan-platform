/**
 * THE HELP PAGES BUILT AHEAD STAY A FIXED SET (help split, 2026-11-14).
 *
 * /help/[slug] used to pre-render every answer. The split made room for about 250 more, written by eight sessions;
 * pre-rendering them all would take the build past STATIC_PAGE_CEILING (apps/web/scripts/check-build-budget.mjs) —
 * measured on the H2 branch: 329 pre-rendered pages against a ceiling of 300 after only 39 new answers. So only the
 * answers that existed before the split are built ahead, and the rest render on their first visit. This test holds
 * the three halves of that:
 *   1. what is built ahead is exactly topics-existing.ts — a slot answer never quietly joins the build;
 *   2. every answer still resolves (findHelpArticle), so a slot answer is served, not 404'd;
 *   3. an unknown slug still 404s before anything streams: notFound() in generateMetadata, and no loading boundary
 *      above the route that could commit a 200 first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HELP_ARTICLES, HELP_PRERENDER_SLUGS, findHelpArticle } from '@/lib/help';
import { TOPICS_EXISTING } from '@/lib/help/topics-existing';

const WEB = join(__dirname, '..');

test('the help pages built ahead are exactly the answers in topics-existing.ts', () => {
  const existing = TOPICS_EXISTING.flatMap((t) => t.articles.map((a) => a.slug));
  assert.deepEqual([...HELP_PRERENDER_SLUGS], existing);
  assert.ok(existing.length >= 100, `only ${existing.length} — has topics-existing.ts moved? re-point this test`);
});

test('every help answer resolves, so one that is not built ahead is still served', () => {
  for (const { article } of ALL_HELP_ARTICLES) {
    assert.equal(findHelpArticle(article.slug)?.article.slug, article.slug, `${article.slug} does not resolve`);
  }
});

test('an unknown help slug 404s before anything streams', () => {
  const page = readFileSync(join(WEB, 'app/help/[slug]/page.tsx'), 'utf8');
  assert.match(page, /return HELP_PRERENDER_SLUGS\.map\(\(slug\) => \(\{ slug \}\)\);/, 'generateStaticParams no longer reads HELP_PRERENDER_SLUGS');
  assert.match(
    page,
    /export async function generateMetadata[\s\S]*?if \(!found\) notFound\(\);/,
    'generateMetadata no longer 404s an unknown slug before the page streams',
  );
  for (const dir of ['app', 'app/help', 'app/help/[slug]']) {
    assert.equal(existsSync(join(WEB, dir, 'loading.tsx')), false, `${dir}/loading.tsx would commit a 200 before notFound()`);
  }
});
