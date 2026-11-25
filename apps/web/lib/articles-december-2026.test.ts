/**
 * articles-december-2026.test.ts — the 14 December feature articles follow the article rulings and ship exactly
 * as approved (owner 2026-11-24: "supplier posts to december appoved").
 *
 *   1. The committed migration is exactly what the source generates (so the approved text is what ships).
 *   2. The 17 Nov article rulings (`articles-follow-the-rulings.test.ts`): text and links only, every link is ours
 *      and none is /signup, tags stored the way the database checks them, and the Journal byline.
 *   3. The house words and money rule: no typed peso figure, no "vendor", "website", "down payment" or Pabuya.
 *   4. The approved calendar: titles ≤ 60, 400–700 words, Tue · Thu · Sat in December, suppliers first.
 *   5. Facebook: one teaser per article, through the Articles sweep only — this migration composes no social post.
 *
 * SABOTAGE (run 2026-11-24; each turned this file red): one word changed in the committed migration (1) · a typed
 * "₱5,000" in a paragraph (3) · a /signup link (2) · the first article moved to a Wednesday (4) · an INSERT INTO
 * social_posts in the generator (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DECEMBER_2026_ARTICLES,
  DECEMBER_ARTICLES_MIGRATION,
  decemberArticlesSql,
} from '@/lib/articles-december-2026';
import { cardTarget, findPostLinks, normalizeTags } from '@/lib/article-links';
import { bylineFor } from '@/lib/article-byline';
import { ARTICLE_TAGS_MAX, JOURNAL_BYLINE, JOURNAL_SLUGS, journalBodyFromBlocks } from '@/lib/journal-move';
import { CHAPTER_BODY_MAX, splitChapterParagraphs } from '@/lib/creator-chapters';

const APP = path.resolve(__dirname, '../app');
const MIGRATION = path.resolve(__dirname, '../../../supabase/migrations', DECEMBER_ARTICLES_MIGRATION);
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const body = (a: (typeof DECEMBER_2026_ARTICLES)[number]) => journalBodyFromBlocks(a.blocks);

test('1 · the committed migration is exactly what the approved source generates', () => {
  assert.ok(fs.existsSync(MIGRATION), `${DECEMBER_ARTICLES_MIGRATION} is missing`);
  assert.equal(
    fs.readFileSync(MIGRATION, 'utf8'),
    decemberArticlesSql(),
    'Regenerate: (cd apps/web && npx tsx scripts/gen-december-articles.ts --write). Once applied in production, ' +
      'a change is a NEW UPDATE migration instead.',
  );
});

test('2 · the article rulings: text and links only, every link ours, tags as the database checks them', () => {
  for (const a of DECEMBER_2026_ARTICLES) {
    const text = body(a);
    for (const b of a.blocks) {
      assert.ok(['p', 'h2', 'ul', 'cta'].includes(b.type), `${a.slug}: a ${b.type} block is not text and links`);
    }
    const links = findPostLinks(text);
    assert.ok(links.length >= 1, `${a.slug}: one link to the live page`);
    for (const l of links) {
      assert.equal(l.kind, 'setnayan', `${a.slug}: ${l.text} is an outside link`);
      if (l.kind !== 'setnayan') continue;
      assert.doesNotMatch(l.path, /^\/signup|\?|\.pdf$/, `${a.slug}: ${l.path} is not a page a reader can open`);
      // A one-word path could be read as a shop's page; ours are app routes, so they stay plain links.
      const first = l.path.split('/').filter(Boolean)[0] ?? '';
      assert.ok(fs.existsSync(path.join(APP, first)), `${a.slug}: ${l.path} is not one of our pages`);
      assert.notEqual(cardTarget(l.path)?.kind, 'article', `${a.slug}: links the live page, not another article`);
    }
    assert.deepEqual(normalizeTags([...a.tags]), [...a.tags], `${a.slug}: tags are stored normalized`);
    assert.ok(a.tags.length >= 1 && a.tags.length <= ARTICLE_TAGS_MAX, `${a.slug}: 1–${ARTICLE_TAGS_MAX} tags`);
    assert.ok(text.length <= CHAPTER_BODY_MAX, `${a.slug}: body fits a chapter`);
    assert.ok(splitChapterParagraphs(text).length > 5, `${a.slug}: reads back as paragraphs`);
  }
  // Every post is a Journal post with no shop: the byline is the Journal's, never a shop or a person.
  assert.deepEqual(bylineFor({ is_journal: true, posted_as_vendor_id: null, user_id: 'internal' }, { shops: new Map(), people: new Map() }), {
    kind: 'journal',
    name: JOURNAL_BYLINE,
  });
  const sql = decemberArticlesSql();
  assert.match(sql, /\(user_id, kind, is_journal, slug,[^)]*\)\s+SELECT v_owner, 'wedding', TRUE,/, 'inserted as Journal posts');
  assert.doesNotMatch(sql, /posted_as_vendor_id/, 'no shop byline');
});

test('3 · house words and the money rule: no typed peso, no vendor, website, down payment or Pabuya', () => {
  for (const a of DECEMBER_2026_ARTICLES) {
    const text = `${a.title}\n${body(a)}`;
    assert.doesNotMatch(text, /₱\s?\d|\bPHP\s?\d|\bP\d{2,}/, `${a.slug}: a typed peso figure`);
    assert.doesNotMatch(text, /\bvendors?\b/i, `${a.slug}: says "vendor"`);
    assert.doesNotMatch(text, /\bwebsite\b/i, `${a.slug}: says "website" (it is the Event Hub)`);
    assert.doesNotMatch(text, /down ?payment/i, `${a.slug}: says "down payment"`);
    assert.doesNotMatch(text, /pabuya|setnayan\.ph|free for life/i, `${a.slug}: a retired word or claim`);
    assert.doesNotMatch(a.slug, /vendor|website/, `${a.slug}: slug words`);
  }
});

test('4 · the approved calendar: titles, length, dates and order', () => {
  const slugs = DECEMBER_2026_ARTICLES.map((a) => a.slug);
  assert.equal(DECEMBER_2026_ARTICLES.length, 14, 'the 14 approved drafts');
  assert.equal(new Set(slugs).size, slugs.length, 'slugs are unique');
  for (const s of slugs) assert.ok(!JOURNAL_SLUGS.has(s), `${s} would collide with an imported Journal post`);

  // The approved Batch 1 order (owner, 24 Nov): the supplier features lead; Find sits among them because suppliers
  // read it as "how couples find you".
  assert.deepEqual(slugs, [
    'quotes-payment-plans-and-dates-in-one-chat',
    'you-pay-only-for-the-clients-we-bring',
    'one-service-card-that-answers-for-you',
    'badges-you-earn-never-buy',
    'find-build-and-compare-your-supplier-team',
    'bring-your-favorite-suppliers-with-you',
    'a-gift-you-hand-your-couple',
    'your-qr-on-every-table-tarp-and-calling-card',
    'a-shop-page-that-works-while-you-work',
    'every-guest-phone-becomes-your-camera',
    'walk-your-reception-before-the-day',
    'family-abroad-can-watch-from-your-event-hub',
    'one-theme-for-your-event-hub-and-every-print',
    'a-planner-that-watches-your-plan',
  ]);
  assert.equal(DECEMBER_2026_ARTICLES[0]?.audience, 'suppliers', 'a supplier article opens the month');

  let prev = '';
  for (const a of DECEMBER_2026_ARTICLES) {
    assert.ok(a.title.length <= 60, `${a.slug}: title is ${a.title.length} characters`);
    const n = words(body(a));
    assert.ok(n >= 400 && n <= 700, `${a.slug}: ${n} words`);
    assert.match(a.publishedAt, /^2026-12-\d\d$/, `${a.slug}: dated in December 2026`);
    const day = new Date(`${a.publishedAt}T12:00:00+08:00`).getUTCDay();
    assert.ok([2, 4, 6].includes(day), `${a.slug}: ${a.publishedAt} is not a Tue, Thu or Sat`);
    assert.ok(a.publishedAt > prev, `${a.slug}: dates run in order`);
    prev = a.publishedAt;
  }
});

test('5 · Facebook: the articles reach the page only through the Articles sweep, once each', () => {
  const sql = decemberArticlesSql();
  assert.doesNotMatch(sql, /social_posts|social_evergreen_items/, 'this migration composes no social post');
  assert.match(sql, /ON CONFLICT \(slug\) WHERE slug IS NOT NULL DO NOTHING/, 're-runnable without a second row');
});
