/**
 * articles-follow-the-rulings.test.ts — the 17 Nov article rulings, held where a person would meet them.
 *
 *   1. Text and links only: an outside link is PLAIN TEXT (never an anchor, never a card); a setnayan.com link
 *      is ours; only an article or a shop/page address may carry a card; /signup, files and queries do not.
 *   2. One byline rule: a shop-linked post shows the shop (the Supplier mark), a Journal post "Setnayan
 *      Journal", anyone else their posting name — never the account.
 *   3. Tags and posting names are stored the way the database checks them.
 *   4. The pages say what the drawing says: the Google line on the feed, the article and the Write sheet; the
 *      Write sheet posts through the shipped createChapter (no new server action); the article reuses the
 *      shipped Report for the post AND each reply; a read failure renders as a failure, never as empty.
 *
 * SABOTAGE (run 2026-11-17; each turned this file red): making an outside link an <a> in article-bits ·
 * letting `cardTarget` accept `/signup` · putting the shop check after the Journal check in `bylineFor` ·
 * deleting the error branch of the feed · deleting PUBLIC_POSTS_ARE_FINDABLE from the Write sheet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  cardTarget,
  classifyLink,
  findPostLinks,
  normalizePostingName,
  normalizeTags,
  segmentParagraph,
} from '@/lib/article-links';
import { bylineFor, UNNAMED_MEMBER } from '@/lib/article-byline';
import { JOURNAL_BYLINE } from '@/lib/journal-move';
import { stripComments } from '@/lib/strip-comments';

const APP = path.resolve(__dirname, '../app');
const read = (rel: string) => fs.readFileSync(path.join(APP, rel), 'utf8');
const code = (src: string) => stripComments(src);

test('1 · a setnayan.com link is ours; every other domain is an outside link', () => {
  assert.deepEqual(classifyLink('setnayan.com/taal-vista-hotel'), { kind: 'setnayan', text: 'setnayan.com/taal-vista-hotel', path: '/taal-vista-hotel' });
  assert.equal(classifyLink('https://www.setnayan.com/articles/x.')?.kind, 'setnayan', 'trailing punctuation is not part of a link');
  assert.equal(classifyLink('pagasa.dost.gov.ph/climate/climate-of-the-philippines')?.kind, 'outside');
  assert.equal(classifyLink('setnayan.com.evil.example/x')?.kind, 'outside', 'a lookalike host is not ours');
  assert.equal(classifyLink('just words'), null);
  const links = findPostLinks('See setnayan.com/taal-vista-hotel and pagasa.dost.gov.ph/x, and setnayan.com/taal-vista-hotel again.');
  assert.deepEqual(links.map((l) => l.kind), ['setnayan', 'outside'], 'each link once, in order');
});

test('1b · only an article or a page address carries a card', () => {
  assert.deepEqual(cardTarget('/articles/best-months-to-get-married-philippines'), { kind: 'article', slug: 'best-months-to-get-married-philippines' });
  assert.deepEqual(cardTarget('/taal-vista-hotel'), { kind: 'page', word: 'taal-vista-hotel' });
  assert.deepEqual(cardTarget('/v/taal-vista-hotel'), { kind: 'page', word: 'taal-vista-hotel' });
  for (const p of ['/signup/start', '/features/papic', '/dashboard/x/guests', '/?browse=1']) {
    assert.equal(cardTarget(p), null, `${p} is our page but not a card`);
  }
  assert.equal(cardTarget('/blog/setnayan-wedding-checklist.pdf'), null, 'a file is never a card');
  assert.equal(cardTarget('/'), null);
});

test('1c · an outside link renders as words, never as an anchor', () => {
  const segs = segmentParagraph('Read setnayan.com/articles/x then pagasa.dost.gov.ph/y.');
  assert.deepEqual(segs.map((s) => s.kind), ['text', 'setnayan', 'text', 'outside', 'text']);
  const bits = code(read('(shell)/articles/_components/article-bits.tsx'));
  const outsideBranch = bits.slice(bits.indexOf(") : seg.kind === 'setnayan' ?"), bits.indexOf('</p>', bits.indexOf(") : seg.kind === 'setnayan' ?")));
  const afterElse = outsideBranch.slice(outsideBranch.indexOf(') : ('));
  assert.doesNotMatch(afterElse, /<Link|<a\b|href=/, 'the outside branch must not link anywhere');
});

test('2 · one byline rule: shop first, then the Journal, then the chosen name — never the account', () => {
  const names = { shops: new Map([['shop-1', 'Taal Vista Hotel']]), people: new Map<string, string | null>([['u-1', 'tagaytaybride'], ['u-2', null]]) };
  assert.deepEqual(bylineFor({ is_journal: false, posted_as_vendor_id: 'shop-1', user_id: 'u-1' }, names), { kind: 'shop', name: 'Taal Vista Hotel' });
  assert.deepEqual(bylineFor({ is_journal: true, posted_as_vendor_id: 'shop-1', user_id: 'u-1' }, names), { kind: 'shop', name: 'Taal Vista Hotel' });
  assert.deepEqual(bylineFor({ is_journal: true, posted_as_vendor_id: null, user_id: 'u-1' }, names), { kind: 'journal', name: JOURNAL_BYLINE });
  assert.deepEqual(bylineFor({ is_journal: false, posted_as_vendor_id: null, user_id: 'u-1' }, names), { kind: 'person', name: 'tagaytaybride' });
  assert.deepEqual(bylineFor({ is_journal: false, posted_as_vendor_id: null, user_id: 'u-2' }, names), { kind: 'person', name: UNNAMED_MEMBER });
});

test('3 · tags and posting names are stored the way the database checks them', () => {
  assert.deepEqual(normalizeTags('Venues, Tagaytay ,venues, budget, extra'), ['venues', 'tagaytay', 'budget']);
  assert.deepEqual(normalizeTags(['  ', 'x'.repeat(31), 'when to marry']), ['when to marry']);
  assert.equal(normalizePostingName(' Pia.Plans '), 'pia.plans');
  for (const bad of ['ab', 'a b', '_lead', 'x'.repeat(31), 'emoji😀']) assert.equal(normalizePostingName(bad), null, bad);
});

test('4 · the pages say what the drawing says, and refuse honestly', () => {
  const feed = code(read('(shell)/articles/_components/feed-view.tsx'));
  const article = code(read('(shell)/articles/_components/article-view.tsx'));
  const sheet = code(read('(shell)/articles/_components/write-sheet.tsx'));
  for (const [name, src] of [['feed', feed], ['article', article], ['write sheet', sheet]] as const) {
    // Rendered, not merely imported — an import line alone would keep this green with the words gone.
    assert.match(src, /\{PUBLIC_POSTS_ARE_FINDABLE\}/, `${name} lost "Public posts can appear on Google and in AI answers"`);
  }
  assert.match(feed, /!res\.ok \?/, 'the feed must render a refused read as a refusal');
  assert.match(feed, /We couldn’t load the articles/);
  assert.match(article, /We couldn’t load this article/);
  assert.match(article, /We couldn’t load the replies/);
  assert.match(sheet, /action=\{createChapter\}/, 'the Write sheet posts through the shipped action');
  assert.match(sheet, /name="surface" value="articles"/);
  assert.doesNotMatch(sheet, /embed_url|teaser|type="file"/, 'text and links only — no video, no upload');
  assert.match(article, /ReportPageButton targetType="chapter"/, 'the post reuses the shipped Report');
  assert.match(article, /ReportPageButton targetType="chapter_reply"/, 'so does every reply');
  const reply = code(read('(shell)/articles/_components/reply-box.tsx'));
  assert.doesNotMatch(reply, /'use server'|from '@\/app\/.*actions'/, 'a reply is an RLS-guarded insert, not a new action');
  assert.doesNotMatch(reply, /posted_as_vendor_id:|removed_at:/, 'the browser never sends the fields the database decides');
});
