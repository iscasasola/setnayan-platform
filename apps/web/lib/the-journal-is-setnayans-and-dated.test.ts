/**
 * the-journal-is-setnayans-and-dated.test.ts — two rules from the PR #7919 ship review, held where they bite.
 *
 *   1. 📅 A PUBLIC ARTICLE IS ONE WHOSE DATE HAS ARRIVED. The Journal import writes 13 posts as published with
 *      a future `published_at`. Every article read goes through ONE helper, `onlyPublicArticles`, and the RLS
 *      policy carries the same `published_at <= now()`, so no read path can serve a post early.
 *   2. 📰 THE JOURNAL IS SETNAYAN'S, NOT ITS OWNER'S. The import owns its rows under the one internal account,
 *      whose public profile is on. Every read that treats chapters as a PERSON's work (their profile, their
 *      chapter page, the share card, their counts, their creator desk, the admin candidate list, the creator
 *      analytics, the supplier's offer-able creators) filters `is_journal = false`.
 *
 * SABOTAGE (run 2026-11-20; each turned this file red): dropping `.lte('published_at', …)` from the helper ·
 * writing `.from('creator_chapters').select(…).eq('status','published')` in articles.server.ts without the
 * helper · deleting the `is_journal` filter from fetchPublishedChaptersResult · deleting `published_at <= now()`
 * from the policy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { onlyPublicArticles } from '@/lib/public-articles';
import { stripComments } from '@/lib/strip-comments';

const WEB = path.resolve(__dirname, '..');
const ROOT = path.resolve(WEB, '../..');
const code = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

test('1 · the helper applies all four clauses, the date included', () => {
  const calls: string[] = [];
  const q = {
    eq(c: string, v: unknown) { calls.push(`eq ${c} ${String(v)}`); return q; },
    is(c: string, v: unknown) { calls.push(`is ${c} ${String(v)}`); return q; },
    not(c: string, o: string, v: unknown) { calls.push(`not ${c} ${o} ${String(v)}`); return q; },
    lte(c: string, v: unknown) { calls.push(`lte ${c} ${String(v)}`); return q; },
  };
  const now = new Date('2026-11-20T00:00:00.000Z');
  assert.equal(onlyPublicArticles(q, now), q);
  assert.deepEqual(calls.sort(), [
    'eq status published',
    'is removed_at null',
    'lte published_at 2026-11-20T00:00:00.000Z',
    'not slug is null',
  ]);
});

test('1 · every creator_chapters read in articles.server.ts goes through the helper', () => {
  const src = code('lib/articles.server.ts');
  const reads = src.match(/from\('creator_chapters'\)/g) ?? [];
  const wrapped = src.match(/onlyPublicArticles\(supabase\.from\('creator_chapters'\)/g) ?? [];
  console.log(`articles.server.ts: ${reads.length} creator_chapters reads, ${wrapped.length} through onlyPublicArticles`);
  assert.ok(reads.length >= 5, `expected the five article reads, found ${reads.length}`);
  assert.equal(wrapped.length, reads.length, 'a creator_chapters read in articles.server.ts skips onlyPublicArticles');
  assert.doesNotMatch(src, /\.eq\('status', 'published'\)/, 'articles.server.ts restates the rule instead of using the helper');
});

test('1 · the RLS policies hold the same date rule', () => {
  const dir = path.join(ROOT, 'supabase/migrations');
  const file = fs.readdirSync(dir).find((f) => f.endsWith('_articles_on_the_chapter_store.sql'));
  assert.ok(file, 'the articles migration is missing');
  const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/--.*$/gm, '');
  const policy = sql.slice(sql.indexOf('CREATE POLICY public_can_read_published_article'));
  assert.match(policy.slice(0, policy.indexOf(');')), /published_at <= now\(\)/);
  const dated = sql.match(/c\.published_at <= now\(\)/g) ?? [];
  assert.equal(dated.length, 2, 'the reply read and the reply insert both require a live, dated article');
});

const PERSONAL_READS: [string, RegExp][] = [
  ['lib/creator-public.ts', /fetchPublishedChaptersResult[\s\S]*?\.eq\('is_journal', false\)[\s\S]*?fetchPublishedChapterByPublicId/],
  ['lib/creator-public.ts', /fetchPublishedChapterByPublicId\([\s\S]*?\.eq\('is_journal', false\)[\s\S]*?fetchPublishedChapterForShare/],
  ['lib/creator-public.ts', /fetchPublishedChapterForShare\([\s\S]*?\.eq\('is_journal', false\)/],
  ['app/(hub)/dashboard/page.tsx', /select\('event_id, status'\)\s*\.eq\('user_id', user\.id\)\s*\.eq\('is_journal', false\)/],
  ['app/_components/frontdoor/command-data.ts', /\{ count: 'exact', head: true \}\)\s*\.eq\('user_id', user\.id\)\s*\.eq\('is_journal', false\)/],
  ['app/_components/frontdoor/rail-data.ts', /\{ count: 'exact', head: true \}\)\s*\.eq\('user_id', user\.id\)\s*\.eq\('is_journal', false\)/],
  ['app/dashboard/(account)/creator/page.tsx', /\.eq\('user_id', userId\)\s*\.eq\('is_journal', false\)/],
  ['lib/storytellers.ts', /loadStorytellerCandidatesForAdmin[\s\S]*?\.eq\('is_journal', false\)/],
  ['lib/creator-offers.ts', /fetchEligibleCreators[\s\S]*?select\('user_id'\)\s*\.eq\('status', 'published'\)\s*\.eq\('is_journal', false\)/],
  ['lib/creator-analytics.ts', /select\('user_id'\)\s*\.eq\('status', 'published'\)\s*\.eq\('is_journal', false\)/],
];

for (const [rel, re] of PERSONAL_READS) {
  test(`2 · ${rel} keeps the Journal out of a person's chapters (${re.source.slice(0, 40)}…)`, () => {
    assert.match(code(rel), re);
  });
}
