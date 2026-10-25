/**
 * help-and-features-share-one-search.test.ts — ONE SEARCH FOR "HOW DOES SETNAYAN WORK".
 *
 * Owner, 25 Oct 2026, right after Discover search was narrowed to suppliers · people · events:
 * *"also the HELP and Features where we can mazimize the app to be searchable"*. /help had a client box over help
 * topics only; /features had no search at all.
 *
 * Held here, each at the grain it can be held:
 *   1. BOTH PAGES MOUNT THE ONE SEARCH — the field and the in-place results, once each, from the one module; and /help
 *      no longer carries its old, narrower box (no two search boxes on one page). The field IS the bottom thumb row,
 *      signed in and signed out (owner 2026-10-25, on the in-page box: "Should the search be consistent with the
 *      search bar we have?" → yes), and the shell draws no top-bar box on these two pages;
 *   2. ITS RESULTS ARE ALL THREE KINDS — help answers, feature pages and guides, from the real corpora (executed);
 *      a help answer is never listed twice (searchReads' own help hits are dropped for the in-place answer), the
 *      /help role tile narrows the help answers, and the iPhone app's answers are its own;
 *   3. HONEST STATES (rendered) — no match says "Nothing matched" with a way to ask us; a failed story read says so,
 *      and the results are marked for the shared search pin;
 *   4. GOOGLE — a `?q=` address is `noindex`, and every sitemap speaks the sitemaps.org namespace.
 *
 * Seen to fail once: (1) `<HowSearchResults` deleted from the features hub → red; (2) `featurePageHits` dropped from
 * `composeHowSearch` → red; (3) the in-page form moved out of `<noscript>` → red; (4) `/help` dropped from
 * `DOORWAY_PAGE_SEARCH_PATHS` → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The results module imports the signed-in row, whose ThumbRow carries a CSS module (a CSS module is its class
     names here) — the same harness `discover-search-stays-on-page.test.ts` uses. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    // The row calls useRouter(); a static render has no app router to mount.
    if (request === 'next/navigation') {
      const real = load.call(this, request, ...rest) as Record<string, unknown>;
      return { ...real, useRouter: () => ({ push() {}, replace() {}, prefetch() {}, refresh() {} }) };
    }
    return load.call(this, request, ...rest);
  };
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}

import { composeHowSearch, helpAnswerHits } from '@/lib/how-search-core';
import { searchInCodeReads } from '@/lib/site-search-core';
import { ALL_HELP_ARTICLES, HELP_NOT_IN_THE_APP, HELP_TOPICS } from '@/lib/help';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGES = {
  help: 'app/(shell)/help/page.tsx',
  features: 'app/(shell)/features/(hub)/page.tsx',
} as const;

test('1 · /help and /features both mount the one search — field and results, once each', () => {
  for (const [name, rel] of Object.entries(PAGES)) {
    const src = code(rel);
    assert.match(src, /from '@\/app\/_components\/how-search\/how-search'/, `${name}: not the one search module`);
    assert.equal(src.match(/<HowSearchField\b/g)?.length ?? 0, 1, `${name}: the search field is not mounted exactly once`);
    assert.equal(src.match(/<HowSearchResults\b/g)?.length ?? 0, 1, `${name}: the results are not drawn exactly once`);
    assert.match(src, /runHowSearch\(q\b/, `${name}: the results are not this search's`);
  }
  // No second, narrower box on /help — "one place for everything".
  assert.doesNotMatch(code(PAGES.help), /HelpSearch|help-search/, '/help still carries the old help-only box');
  assert.ok(!existsSync(join(WEB, 'app/help/_components/help-search.tsx')), 'the old help-only box is back');
});

test('1 · ONE SEARCH BAR, AT THE BOTTOM, ON BOTH PAGES — signed in AND signed out (owner 2026-10-25: "This one")', async () => {
  // The field is the bottom thumb row for everyone: no signed-in branch, no visible in-page form.
  const field = code('app/_components/how-search/how-search.tsx');
  assert.doesNotMatch(field, /signedIn/, 'the search still forks on who is looking');
  const fn = field.slice(field.indexOf('export function HowSearchField('), field.indexOf('export function HowSearchResults('));
  assert.match(fn, /return \(\s*<>\s*<HowSearchRow\b/, 'the bottom row is not what the field draws');
  const noscript = fn.slice(fn.indexOf('<noscript>'), fn.indexOf('</noscript>'));
  assert.equal((fn.match(/<form\b/g) ?? []).length, 1, 'premise: one fallback form');
  assert.match(noscript, /<form\b/, 'the in-page form is visible — it may only be the <noscript> fallback');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HowSearchField } = await import('@/app/_components/how-search/how-search');
  const html = renderToStaticMarkup(React.createElement(HowSearchField, { q: 'seating', action: '/help', keep: { role: 'guest' } }));
  assert.doesNotMatch(html.replace(/<noscript>[\s\S]*?<\/noscript>/g, ''), /<input|<form/, 'a search field draws outside the bottom row');
  // The row: the shared ThumbRow, docked at the screen's foot with the safe-area room — these pages have no account bar.
  const row = code('app/_components/how-search/how-search-row.tsx');
  assert.match(row, /<ThumbDock noBar>\s*<ThumbRow\b/, 'not the shared bottom row, docked without a bar');
  const css = readFileSync(join(WEB, 'components/thumb-row.module.css'), 'utf8');
  assert.match(css, /\.dockNoBar \{ bottom: var\(--sn-ride-h, var\(--sn-bottomdock-h, env\(safe-area-inset-bottom, 0px\)\)\); \}/, 'no-bar docking floats');
  assert.match(code('components/thumb-dock.tsx'), /noBar \? `\$\{styles\.dock\} \$\{styles\.dockNoBar\}`/);
  // Neither page decides the search by session any more.
  for (const [name, rel] of Object.entries(PAGES)) {
    assert.doesNotMatch(code(rel).match(/<HowSearchField[^>]*>/)?.[0] ?? '', /signedIn/, `${name}: the search forks on who is looking`);
  }
  // The shell's top-bar box is not drawn on these two pages — its own per-path switch, not a CSS hide.
  const { DOORWAY_PAGE_SEARCH_PATHS } = await import('@/app/_components/frontdoor/shell-page-search');
  assert.deepEqual([...DOORWAY_PAGE_SEARCH_PATHS].sort(), ['/features', '/help']);
  assert.match(code('app/_components/frontdoor/app-rail-shell.tsx'), /pageSearchPaths=\{variant === 'doorway' \? DOORWAY_PAGE_SEARCH_PATHS : undefined\}/);
  const shell = code('app/_components/frontdoor/front-door-shell.tsx');
  assert.match(shell, /search: searchProp,/, 'the shell reads the prop under one name and decides `search` once');
  assert.match(shell, /const search = pageSearchPaths\?\.includes\(pathname \?\? ''\) \? false : searchProp;/);
  assert.equal((shell.match(/search === false \? null/g) ?? []).length, 2, 'a top-bar box (desktop or phone row) ignores the switch');
  assert.equal((shell.match(/\bsearchProp\b/g) ?? []).length, 2, 'the unswitched prop is read ONLY where `search` is decided — a top-bar box reading it would ignore /help and /features');
});

test('2 · its results are help answers, feature pages and guides — from the real corpora', () => {
  for (const q of ['seating', 'budget']) {
    const hits = composeHowSearch({ query: q, storeShell: false, reads: searchInCodeReads(q), limit: 100 });
    const kinds = new Set(hits.map((h) => h.kind));
    for (const k of ['help', 'features', 'guide'] as const) assert.ok(kinds.has(k), `"${q}" found no ${k} row`);
    // A help answer is listed once — as the in-place answer, never also as a guide row.
    assert.equal(hits.filter((h) => h.kind === 'guide' && h.href.startsWith('/help/')).length, 0, `"${q}": a help answer listed twice`);
    for (const h of hits.filter((x) => x.kind === 'help')) assert.ok(h.answer && h.answer.length > 0, `${h.href}: no answer to open in place`);
    // One address, one row (a duplicate slug in the help corpus drew a duplicate React key on "papic").
    for (const qq of [q, 'papic']) {
      const hrefs = composeHowSearch({ query: qq, storeShell: false, reads: searchInCodeReads(qq), limit: 100 }).map((h) => `${h.kind}:${h.href}`);
      assert.equal(new Set(hrefs).size, hrefs.length, `"${qq}": one address listed twice`);
    }
    // One order: the shared ranker's (score, then title).
    for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1]!.score >= hits[i]!.score, `"${q}": not ranked by score`);
  }
  assert.deepEqual(composeHowSearch({ query: ' ', storeShell: false, reads: [] }), [], 'an empty box lists something');
});

test('2 · every help answer has its own address, and "refund" finds the refund answer', () => {
  const slugs = ALL_HELP_ARTICLES.map((e) => e.article.slug);
  const twice = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  assert.deepEqual(twice, [], `help slugs used twice — /help/<slug> can open only one: ${twice.join(', ')}`);
  for (const q of ['refund', 'refunds', 'can I get a refund']) {
    const hits = composeHowSearch({ query: q, storeShell: false, reads: searchInCodeReads(q) });
    assert.equal(hits[0]?.href, '/help/refunds', `"${q}" does not lead with the refund answer`);
  }
  // The answer says the live policy, not an invented one (app/(shell)/refunds/page.tsx).
  const refund = ALL_HELP_ARTICLES.find((e) => e.article.slug === 'refunds')!.article;
  assert.match(refund.body, /^No — what you buy from Setnayan is not refunded\./);
  assert.match(refund.body, /Papic credits to your event worth what you paid/);
  assert.match(refund.appBody ?? '', /goes to Apple, under Apple’s own terms/); // the policy's iPhone-app line
  assert.match(code('lib/help.ts'), /within \$\{REFUND_REPORT_WINDOW_DAYS\} days of payment/, 'the report window is typed, not the rule constant');
});

test('2 · the /help role tile narrows the help answers; the iPhone app answers in its own words', () => {
  const all = helpAnswerHits('photos', { storeShell: false });
  const guest = helpAnswerHits('photos', { storeShell: false, role: 'guest' });
  const guestTopics = new Set(HELP_TOPICS.filter((t) => t.roles.includes('guest')).flatMap((t) => t.articles.map((a) => `/help/${a.slug}`)));
  assert.ok(guest.length > 0 && guest.length <= all.length, 'premise: guests have photo answers');
  for (const h of guest) assert.ok(guestTopics.has(h.href), `${h.href}: outside the guest topics`);
  for (const h of helpAnswerHits('the', { storeShell: true }).concat(helpAnswerHits('papic', { storeShell: true }))) {
    assert.notEqual(h.answer, HELP_NOT_IN_THE_APP, `${h.href}: the app offered an answer about a part it does not include`);
  }
});

test('3 · honest states — no match asks us, a failed story read says so, results are marked for the pin', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HowSearchResults } = await import('@/app/_components/how-search/how-search');
  const none = renderToStaticMarkup(
    React.createElement(HowSearchResults, { q: 'zzqx', hits: [], storiesFailed: false, clearHref: '/help', askHref: '#contact' }),
  );
  assert.match(none, /Nothing matched “zzqx”/);
  assert.match(none, /href="#contact"[^>]*>Ask us</);
  assert.match(none, /data-search-none=""/);
  assert.doesNotMatch(none, /Stories didn/, 'a clean read printed a failure');
  const broke = renderToStaticMarkup(
    React.createElement(HowSearchResults, { q: 'zzqx', hits: [], storiesFailed: true, clearHref: '/help', askHref: '#contact' }),
  );
  assert.match(broke, /Stories didn.{1,10}t load just now/, 'a failed story read was rendered as plain "nothing matched"');
  // …and a refusal REACHES that flag: both story loaders swallow a refusal into [] (right for a shelf), so the search
  // reads their `…Result` twins, whose `ok` says whether they answered.
  const io = code('lib/site-search.ts');
  assert.match(io, /!showcases\.value\.ok/, 'a refused showcase read is not seen by the search');
  assert.match(io, /!chapters\.value\.ok/, 'a refused chapter read is not seen by the search');
  assert.match(code('lib/how-search.ts'), /storiesFailed/, 'the flag does not travel to the page');
  const hits = composeHowSearch({ query: 'seating', storeShell: false, reads: searchInCodeReads('seating') });
  const some = renderToStaticMarkup(
    React.createElement(HowSearchResults, { q: 'seating', hits, storiesFailed: false, clearHref: '/features', askHref: '/help#contact' }),
  );
  assert.match(some, /data-search-results=""/, 'the results are not marked for the shared search pin');
  assert.match(some, /<details/, 'a help answer does not open in place');
  for (const k of ['help', 'features', 'guide']) assert.match(some, new RegExp(`data-how-kind="${k}"`), `no ${k} row drawn`);
  assert.match(some, /class="fd-kindtag">Features</, 'a feature row does not wear the kind tag');
});

test('4 · a search address is noindex; every sitemap speaks the sitemaps.org namespace', () => {
  for (const [name, rel] of Object.entries(PAGES)) {
    const src = code(rel);
    assert.match(src, /export async function generateMetadata\(\{ searchParams \}/, `${name}: metadata cannot see ?q=`);
    assert.match(src, /q\?\.trim\(\) \? \{ \.\.\.\w+, robots: \{ index: false, follow: true \} \}/, `${name}: a ?q= page is indexable`);
  }
  const dirs = readdirSync(join(WEB, 'app')).filter((d) => /^sitemap.*\.xml$/.test(d));
  assert.ok(dirs.length >= 8, `premise: ${dirs.length} sitemap routes`);
  for (const d of dirs) {
    const src = readFileSync(join(WEB, 'app', d, 'route.ts'), 'utf8');
    assert.match(src, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/, `${d}: not the sitemaps.org namespace`);
    assert.doesNotMatch(src, /schemas\/sitemap-0\.9/, `${d}: the misspelled namespace Google rejects`);
  }
});
