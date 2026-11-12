/**
 * robots-lets-gemini-read.test.ts — "Be findable by AI" (owner, 2026-11-02;
 * DECISION_LOG row "BE FINDABLE BY AI: LET GEMINI READ OUR PUBLIC PAGES").
 *
 * Holds three things, each of which fails red if broken:
 *
 *  1. Google-Extended may read the PUBLIC pages (Gemini can find and recommend
 *     us) — and is still kept out of the signed-in surfaces, exactly like `*`.
 *  2. The six pure training / resale scrapers stay blocked from everything.
 *     The answer-engine allow list is unchanged.
 *  3. robots.txt points at a sitemap that EXISTS: `Sitemap:` names
 *     /sitemap.xml, a route handler serves it, and every child sitemap that
 *     index lists has a route handler of its own. (A robots.txt naming a 404 —
 *     or an index naming a dropped child, as `sitemap-venues.xml` once was —
 *     tells every crawler the site map is broken, silently.)
 *
 * Reads robots() and the sitemap index's GET() as they run — not their source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import robots from './robots';
import { GET as sitemapIndex } from './sitemap.xml/route';

const APP = dirname(fileURLToPath(import.meta.url));

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };
const list = (v: string | string[] | undefined) => ([] as string[]).concat(v ?? []);

function rules(): Rule[] {
  const r = robots();
  return (Array.isArray(r.rules) ? r.rules : [r.rules]) as Rule[];
}
function ruleFor(ua: string): Rule | undefined {
  return rules().find((x) => list(x.userAgent).includes(ua));
}

const TRAINING_SCRAPERS = ['GPTBot', 'Applebot-Extended', 'Amazonbot', 'cohere-ai', 'Bytespider', 'Diffbot'];
const ANSWER_ENGINES = ['ChatGPT-User', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot'];
const PRIVATE = ['/dashboard', '/vendor-dashboard', '/admin', '/api', '/receipts', '/papic/me'];

test('Google-Extended may read the public pages, and nothing signed-in', () => {
  const g = ruleFor('Google-Extended');
  assert.ok(g, 'robots.ts has no rule for Google-Extended — Gemini would fall back to `*`; keep the choice explicit');
  const allow = list(g.allow);
  const disallow = list(g.disallow);
  assert.ok(!disallow.includes('/'), 'Google-Extended is blocked from the whole site again — the 2026-11-02 ruling lets Gemini read public pages');
  // 🔄 2026-11-12: '/explore' left — it forwards (308) to Discover `/`, which is here (Find suppliers moved inside Discover).
  for (const p of ['/', '/for-suppliers', '/creators', '/help', '/realstories', '/tl/']) {
    assert.ok(allow.includes(p), `Google-Extended is not allowed ${p}`);
  }
  for (const p of PRIVATE) {
    assert.ok(disallow.includes(p), `Google-Extended may read ${p} — signed-in surfaces stay closed to every bot`);
  }
  // Same rule Googlebot gets through `*` — no wider, no narrower.
  const star = ruleFor('*');
  assert.ok(star, 'robots.ts lost its `*` rule');
  assert.deepEqual([...allow].sort(), [...list(star.allow)].sort(), 'Google-Extended allow list drifted from `*`');
  assert.deepEqual([...disallow].sort(), [...list(star.disallow)].sort(), 'Google-Extended disallow list drifted from `*`');
});

test('the six training scrapers stay blocked from everything', () => {
  for (const ua of TRAINING_SCRAPERS) {
    const r = ruleFor(ua);
    assert.ok(r, `${ua} has no rule — it would fall back to \`*\` and read the site`);
    assert.deepEqual(list(r.disallow), ['/'], `${ua} must be disallowed '/'`);
    assert.deepEqual(list(r.allow), [], `${ua} must have no allow entries`);
  }
});

test('the answer-engine allow list is unchanged', () => {
  for (const ua of ANSWER_ENGINES) {
    const r = ruleFor(ua);
    assert.ok(r, `${ua} has no rule`);
    assert.ok(list(r.allow).includes('/'), `${ua} must be allowed the site root`);
    assert.ok(!list(r.disallow).includes('/'), `${ua} is blocked from the whole site`);
  }
  const named = rules().flatMap((r) => list(r.userAgent));
  assert.deepEqual(
    [...named].sort(),
    ['*', ...ANSWER_ENGINES, 'Google-Extended', ...TRAINING_SCRAPERS].sort(),
    'robots.ts names a different set of user agents — update this guard and the playbook §8 together',
  );
});

test('robots.txt points at a sitemap index that exists, and every child it lists exists', async () => {
  const sitemap = robots().sitemap;
  const urls = list(sitemap as string | string[] | undefined);
  assert.equal(urls.length, 1, 'robots.txt should name exactly one sitemap (the index)');
  const path = new URL(urls[0]!).pathname;
  assert.equal(path, '/sitemap.xml', `robots.txt names ${path}, not the sitemap index`);
  assert.ok(existsSync(join(APP, 'sitemap.xml/route.ts')), 'app/sitemap.xml/route.ts is gone — robots.txt names a 404');
  // The Next.js `app/sitemap.ts` convention collides with the hand-written index at the same URL.
  assert.ok(!existsSync(join(APP, 'sitemap.ts')), 'app/sitemap.ts is back — it collides with app/sitemap.xml/route.ts');

  const res = await sitemapIndex();
  assert.equal(res.status, 200);
  const xml = await res.text();
  assert.match(xml, /<sitemapindex /, '/sitemap.xml is not a sitemap index');
  const children = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname.replace(/^\//, ''));
  assert.ok(children.length >= 5, `the index lists only ${children.length} children — did its shape change?`);
  const missing = children.filter((c) => !existsSync(join(APP, c, 'route.ts')));
  assert.deepEqual(missing, [], 'the sitemap index lists children with no route handler (each is a 404 to crawlers):\n  ' + missing.join('\n  '));

  // And the reverse: every sitemap-*.xml route in app/ is in the index (one left out is never crawled).
  const folders = readdirSync(APP).filter((n) => /^sitemap-.+\.xml$/.test(n) && existsSync(join(APP, n, 'route.ts')));
  const unlisted = folders.filter((f) => !children.includes(f));
  assert.deepEqual(unlisted, [], 'these sitemap routes exist but the index does not list them:\n  ' + unlisted.join('\n  '));
});
