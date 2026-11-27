/**
 * articles-sweep.test.ts — sweep b2 is back (2026-11-24): Articles → Facebook teasers, read from the live article row.
 *
 * Supersedes the 2026-11-16 pause (DECISION_LOG "THE BLOG AND REAL STORIES ARE RETIRED"), which only held while the
 * teasers had nowhere to link: on 2026-11-17 the Journal moved into Discover's Articles (DECISION_LOG "THE JOURNAL
 * MOVES INTO DISCOVER'S ARTICLES — ONE SOURCE"), so each teaser links /articles/{slug} and never /blog.
 *
 * Holds: the link is an /articles address (renamed slugs land on the new one) · an article already teased under its
 * old OR new slug is never reposted · nothing is composed with a switch off · one teaser waits at a time · only
 * published, public Journal articles are read · a failed read composes nothing.
 *
 * SABOTAGE (run 2026-11-24): linking `/blog/` in composeArticleTeaser turns test 1 red; dropping the old-slug lookup
 * in slugsOfArticle turns test 2 red; removing the switch check turns test 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { allowServerOnly, fakeAdmin, type Answer, type Call } from './lane-s.fixture';

allowServerOnly();

type Article = { slug: string; title: string; body: string | null };
type World = {
  settings?: { autopublish_enabled: boolean; facebook_enabled: boolean };
  existing?: Array<{ source_ref: string; status: string }>;
  articles?: Article[];
  existingError?: Answer['error'];
  articlesError?: Answer['error'];
};

const ON = { autopublish_enabled: true, facebook_enabled: true };
const NOW = new Date('2026-11-24T04:00:00Z');

async function sweep(w: World) {
  const { sweepJournalArticles } = await import('./articles-sweep');
  const { admin, calls } = fakeAdmin((c: Call) => {
    if (c.table === 'social_posts' && c.action === 'select')
      return { data: w.existing ?? [], error: w.existingError ?? null };
    if (c.table === 'creator_chapters' && c.action === 'select')
      return { data: w.articles ?? [], error: w.articlesError ?? null };
    return {};
  });
  await sweepJournalArticles(admin as never, NOW, w.settings ?? ON);
  return calls;
}

const posts = (calls: Call[]) =>
  calls
    .filter((c) => c.table === 'social_posts' && c.action === 'insert')
    .map((c) => c.payload as { source_type: string; source_ref: string; title: string; body: string; link_url: string });

const traditions: Article = {
  slug: 'filipino-wedding-traditions-explained',
  title: 'Filipino wedding traditions, explained',
  body: 'The cord, the veil, the coins.\n\nMore below.',
};

test('1 · the teaser links the article at /articles/{slug} — never /blog', async () => {
  const out = posts(await sweep({ articles: [traditions] }));
  assert.equal(out.length, 1);
  assert.equal(out[0]!.link_url, 'https://www.setnayan.com/articles/filipino-wedding-traditions-explained');
  assert.doesNotMatch(out[0]!.link_url, /\/blog/);
  assert.equal(out[0]!.title, 'Articles · Filipino wedding traditions, explained');
  assert.equal(out[0]!.source_type, 'announcement');
  assert.equal(out[0]!.source_ref, 'journal:filipino-wedding-traditions-explained');
  assert.equal(out[0]!.body, 'The cord, the veil, the coins.\n\n#Setnayan #SetNaYan', 'the live row is the body');
});

test('1b · the live article row is the teaser; a renamed post links its new slug', async () => {
  const { composeArticleTeaser } = await import('./articles-sweep');
  const t = composeArticleTeaser({
    slug: 'holiday-season-vendor-booking-crunch',
    title: 'The holiday booking crunch',
    body: 'Book early.\n\nWhy.',
  });
  assert.ok(t);
  assert.equal(t.link_url, 'https://www.setnayan.com/articles/holiday-season-supplier-booking-crunch');
  assert.equal(t.source_ref, 'journal:holiday-season-supplier-booking-crunch');
  assert.equal(t.body, 'Book early.\n\n#Setnayan #SetNaYan');
  assert.equal(composeArticleTeaser({ slug: 'x', title: 'Nothing to say', body: null }), null);
});

test('1c · S16 · a fix to the live article reaches its teaser — no code hook overrides it', async () => {
  const { composeArticleTeaser } = await import('./articles-sweep');
  const before = composeArticleTeaser({ ...traditions, body: 'Old opening line.' });
  const after = composeArticleTeaser({ ...traditions, body: 'Fixed opening line.' });
  assert.equal(before?.body, 'Old opening line.\n\n#Setnayan #SetNaYan');
  assert.equal(after?.body, 'Fixed opening line.\n\n#Setnayan #SetNaYan');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(path.join(__dirname, 'articles-sweep.ts'), 'utf8');
  assert.doesNotMatch(src, /from '@\/lib\/(blog-batches|social\/journal-hooks)/, 'the sweep must not read hooks from code');
  assert.equal(fs.existsSync(path.join(__dirname, 'journal-hooks.ts')), false);
});

test('2 · an article already teased — under its new OR its old slug — is never reposted', async () => {
  const renamed: Article = { slug: 'free-event-hub-how-it-helps', title: 'A free Event Hub', body: 'Why it helps.' };
  // Posted before the rename, under the OLD slug.
  let out = posts(
    await sweep({ articles: [renamed], existing: [{ source_ref: 'journal:free-wedding-website-how-it-helps', status: 'published' }] }),
  );
  assert.deepEqual(out, [], 'the old-slug row must block the renamed article');
  // Posted under the current slug — even a pulled or failed row blocks it.
  for (const status of ['published', 'pulled', 'failed']) {
    out = posts(await sweep({ articles: [traditions], existing: [{ source_ref: `journal:${traditions.slug}`, status }] }));
    assert.deepEqual(out, [], `a ${status} row must block a repost`);
  }
  // The next un-teased article is the one composed.
  out = posts(
    await sweep({
      articles: [traditions, renamed],
      existing: [{ source_ref: `journal:${traditions.slug}`, status: 'published' }],
    }),
  );
  assert.deepEqual(out.map((p) => p.source_ref), ['journal:free-event-hub-how-it-helps']);
});

test('3 · nothing is composed when a switch is off', async () => {
  for (const settings of [
    { autopublish_enabled: false, facebook_enabled: true },
    { autopublish_enabled: true, facebook_enabled: false },
  ]) {
    const calls = await sweep({ settings, articles: [traditions] });
    assert.deepEqual(posts(calls), []);
    assert.deepEqual(calls, [], 'a switched-off sweep reads nothing either');
  }
});

test('4 · one teaser at a time — never the backlog at once', async () => {
  const backlog: Article[] = Array.from({ length: 12 }, (_, i) => ({
    slug: `article-${i}`,
    title: `Article ${i}`,
    body: `Teaser ${i}.`,
  }));
  assert.equal(posts(await sweep({ articles: backlog })).length, 1, 'a backlog drips one per sweep');
  for (const status of ['scheduled', 'publishing']) {
    const out = posts(await sweep({ articles: backlog, existing: [{ source_ref: 'journal:older', status }] }));
    assert.deepEqual(out, [], `a ${status} teaser is already waiting for its slot`);
  }
});

test('5 · only published, public Journal articles are read', async () => {
  const calls = await sweep({ articles: [] });
  const read = calls.find((c) => c.table === 'creator_chapters' && c.action === 'select');
  assert.ok(read, 'the sweep reads the article store');
  const has = (op: string, col: string, val?: unknown) =>
    read.filters.some(([o, c, v]) => o === op && c === col && (val === undefined || v === val));
  assert.ok(has('eq', 'status', 'published'), 'a draft must not be teased');
  assert.ok(has('is', 'removed_at', null), 'a taken-down article must not be teased');
  assert.ok(has('not', 'slug'), 'an article with no address must not be teased');
  assert.ok(has('lte', 'published_at', NOW.toISOString()), 'a future-dated article must wait for its day');
  assert.ok(has('eq', 'is_journal', true), "only Setnayan's own Journal goes on Setnayan's page");
  assert.ok(has('is', 'posted_as_vendor_id', null), 'a shop-bylined post is not ours to tease');
});

test('6 · a failed read composes nothing', async () => {
  const err = { code: '500', message: 'boom' };
  assert.deepEqual(posts(await sweep({ articles: [traditions], existingError: err })), []);
  assert.deepEqual(posts(await sweep({ articles: [traditions], articlesError: err })), []);
});
