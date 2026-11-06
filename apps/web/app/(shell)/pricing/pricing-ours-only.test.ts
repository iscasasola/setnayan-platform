/**
 * pricing-ours-only.test.ts — /pricing is OURS ONLY and quality-led; /pricing/plan is the questionnaire.
 *
 * Owner 2026-10-25, verbatim: "Yes, build this pricing page and the questionnaire into the app." Earlier the same day:
 * "I was told never to compare so i do not look cheap" · "Just focus on our free and prices and do not compare" ·
 * "no saying free. let us promote premium quality … why it is the best place to build your events" · "the paid parts
 * look like event hub does not have a free version". Prototype `prototypes/pricing_ours_only_2026-10-25/` (index.html
 * revision 5 + quiz.html). Replaces `pricing-free-plus-addons.test.ts` (the comparison version).
 *
 * Every check reads the COMMENT-STRIPPED source (or renders the client pieces / walks the pure quiz), never a docblock:
 *   1. No comparison — no "elsewhere", no saving, no "Paid elsewhere", no other company's name or figure.
 *   2. No giveaway pitch — no visible "free", no "₱0"; the included things say "Included".
 *   3. Every peso is read from the catalogue — not one "₱<digit>" typed on the page, its pieces or the quiz.
 *   4. The five parts, in order, and nothing below them (no add-ons grid, no estimator, no old free list).
 *   5. The included group is there (the eleven, six shown, "See all included ↓"), and Event Hub Pro's line says the
 *      included design stays.
 *   6. The questionnaire: a paid question with no price is not asked; included answers say "Included"; "about 9 hours"
 *      only on a yes to the guest list; "Start your event" goes to /start.
 *
 * SABOTAGES (each run red, then restored — see the PR):
 *   · "Elsewhere, about" typed into a Why tip                                  → 1 RED
 *   · the included figure "Included" → "Free"                                  → 2 RED
 *   · Live Watch's figure typed as "₱2,500"                                    → 3 RED
 *   · a <section id="addons"> put back under the close                         → 4 RED
 *   · Event Hub Pro's line loses "the included design stays yours"             → 5 RED
 *   · the quiz shows "about 9 hours" without the guest-list yes                → 6 RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { questionsFor, resultFor, stepsFor, type PlanPrices, type PlanState } from './plan/_plan-steps';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
/** Comment-stripped, import lines dropped (a module path like `papic-free-credit-promise` is not copy). */
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8')).replace(/^import .*$/gm, '');
const FILES = ['page.tsx', '_pricing-pickers.tsx', '_pricing-reads.ts', 'plan/page.tsx', 'plan/_plan-quiz.tsx', 'plan/_plan-steps.ts'] as const;
const SRC = Object.fromEntries(FILES.map((f) => [f, read(f)])) as Record<(typeof FILES)[number], string>;
const page = SRC['page.tsx'];

/** The other companies the deleted comparison quoted (its sources, 2026-10-25) and the figures it typed. */
const COMPETITORS = ['ceremo', 'paperless', 'zola', 'socialtables', 'social tables', 'eventlive', 'invitecount'];
const THEIR_FIGURES = ['2,499 elsewhere', '5,489', '2,460', '2,990', '2,690'];

test('1 · no comparison — no "elsewhere", no saving, no other company', () => {
  for (const [f, src] of Object.entries(SRC)) {
    assert.doesNotMatch(src, /elsewhere/i, `${f} compares again ("elsewhere")`);
    assert.doesNotMatch(src, /\bsav(?:e|es|ed|ing|ings)\b(?!-the-Date)/i, `${f} pitches a saving`);
    assert.doesNotMatch(src, /other event sites|other websites|instead of several tools/i, `${f} points at other companies`);
    assert.doesNotMatch(src, /pricing-elsewhere|ELSEWHERE/, `${f} reads the deleted comparison module`);
    for (const name of COMPETITORS) assert.doesNotMatch(src, new RegExp(name, 'i'), `${f} names a competitor (${name})`);
    for (const fig of THEIR_FIGURES) assert.ok(!src.includes(fig), `${f} carries a competitor figure (${fig})`);
  }
});

test('2 · no giveaway pitch — no visible "free", no "₱0"; included things say "Included"', () => {
  for (const [f, src] of Object.entries(SRC)) {
    // Identifiers like PAPIC_FREE_CREDIT_CONDITION have no word boundary before FREE, so they never match.
    assert.doesNotMatch(src, /\bfree\b/i, `${f} says "free" — the owner's rule is "Included"`);
    assert.doesNotMatch(src, /₱0\b|₱\{?\s*0\s*\}?(?![\d,])|peso\(0\)/, `${f} shows ₱0`);
  }
  assert.match(SRC['_pricing-pickers.tsx'], /figure="Included"/, 'the included rows no longer say "Included"');
  assert.match(SRC['plan/_plan-quiz.tsx'], /q\.php != null \? peso\(q\.php\) : 'Included'/, 'an included answer no longer says "Included"');
  assert.match(SRC['plan/_plan-quiz.tsx'], /r\.total > 0 \? peso\(r\.total\) : 'Included'/, 'a nothing-paid total would read ₱0');
});

test('3 · every peso is read from the catalogue — none is typed', () => {
  for (const [f, src] of Object.entries(SRC)) {
    const typed = src.match(/₱\s?[0-9][0-9,]*/g) ?? [];
    assert.deepEqual(typed, [], `${f} types a peso figure: ${typed.join(', ')}`);
  }
  const reads = SRC['_pricing-reads.ts'];
  assert.match(reads, /fetchV2CustomerCatalog\(\)/, 'the customer catalogue is no longer read');
  assert.match(reads, /\.from\('platform_retail_catalog_v2'\)/, 'the parts + AI bands read is gone');
  assert.match(reads, /\.in\('service_code', \[\.\.\.HUB_PART_SKUS, \.\.\.aiCodes\]\)/);
  for (const code of ['COUPLE_WEBSITE_PRO', 'LIVE_STUDIO', 'PATIKTOK_COMPILER', 'PAPIC_ADDON_THANK_YOU', 'PAKANTA']) {
    assert.ok(reads.includes(`'${code}'`), `${code} is no longer read from its row`);
  }
  // The pages take their prices from that one read — never a second, hand-made source.
  assert.match(page, /readOurPrices\(\)/);
  assert.match(SRC['plan/page.tsx'], /readOurPrices\(\)/);
  // A missing row draws no figure: each paid row is behind its price.
  for (const guard of ['prices.pro ?', 'prices.liveWatch ?', 'prices.patiktok ?', 'prices.thankYou ?', 'prices.musicMaker ?', 'aiFrom != null ?', 'papicFrom ?']) {
    assert.ok(page.includes(`{${guard}`), `a paid row is drawn without its price (${guard})`);
  }
});

test('4 · the five parts, in order, and nothing else', () => {
  const ids = [...page.matchAll(/<section\s+(?:id="([a-z]+)"|className=[^>]*data-pricing-hero)/g)].map((m) => m[1] ?? 'hero');
  assert.deepEqual(ids, ['hero', 'why', 'together', 'prices', 'close']);
  assert.match(page, /The best place to build your event\./);
  assert.match(page, /Crafted for every event\./);
  assert.match(page, /Where your people come together\./);
  assert.match(page, /Make it even more yours\./);
  assert.match(page, /Paid once, for this event and everyone on it\./);
  assert.match(page, /href="\/features"[^>]*>\s*See everything Setnayan does →/);
  assert.match(page, /href="\/pricing\/plan"[^>]*data-tour="pricing-quiz"[^>]*>\s*See what Setnayan does for you →/);
  assert.equal((page.match(/href="\/start"/g) ?? []).length, 2, 'the hero and the close each start an event at /start');
  for (const shot of ['event-hub-0', '3d-plan-0', 'papic-0']) assert.ok(page.includes(`/feature-shots/${shot}.jpg`), `the ${shot} picture is gone`);
  assert.doesNotMatch(page, /id="(?:addons|free|plans|add)"|PapicEstimator|ADDON_GROUPS|FREE_COLUMNS|Everything you get/);
  // The three tour stops are drawn.
  for (const t of ['pricing-why', 'pricing-prices', 'pricing-quiz']) assert.ok(page.includes(`data-tour="${t}"`), `tour stop ${t} is not drawn`);
  assert.match(page, /<GuestSpotlight tourKey="pricing_page_v1"/);
});

test('5 · the included group is there, and Event Hub Pro keeps the included design', async () => {
  const names = [...page.matchAll(/name: '([^']+)',/g)].map((m) => m[1]);
  assert.deepEqual(names.slice(0, 11), [
    'The Event Hub',
    'Guest list & RSVPs',
    'Seat plan with 3D',
    'Budget & schedule',
    'Suppliers',
    'Door check-in by QR',
    'Guest tickets',
    'Printables',
    'Livestream, one camera',
    'Memories',
    'Papic credits, first event',
  ]);
  assert.match(page, /<IncludedGroup rows=\{included\} \/>/);
  assert.match(page, /the included design stays yours either way/);
  assert.match(page, /while you set up your event<\/b>/);

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { IncludedGroup, HubProWays } = await import('./_pricing-pickers');
  const rows = Array.from({ length: 11 }, (_, i) => ({ name: `R${i}`, tip: 't', what: 'w' }));
  const html = renderToStaticMarkup(React.createElement(IncludedGroup, { rows }));
  assert.match(html, /Included with every event/);
  assert.equal((html.match(/data-included-row=""/g) ?? []).length, 11);
  assert.equal((html.match(/class="hidden lg:grid/g) ?? []).length, 5, 'the last five should wait for "See all included"');
  assert.match(html, /See all included ↓/);
  const hub = renderToStaticMarkup(
    React.createElement(HubProWays, {
      everythingLabel: 'Everything · E',
      partsLabel: 'Just the parts you need · from P',
      parts: React.createElement('p', null, 'PARTS'),
    }),
  );
  assert.match(hub, /Everything/);
  assert.doesNotMatch(hub, />PARTS</, 'the parts show before they are picked');
});

const PRICES: PlanPrices = {
  pro: { regular: 5, signup: 3 },
  partsFrom: 1,
  papicFrom: 7,
  liveWatch: 25,
  patiktok: { php: 15, perDay: true },
  ai: { A: { regular: 24, signup: 14 }, D: { regular: 2, signup: null } },
};
const fmt = (n: number) => n.toLocaleString('en-PH');
const state = (answers: PlanState['answers'], over: Partial<PlanState> = {}): PlanState => ({ type: 'A', count: 150, setup: true, answers, ...over });

test('6 · the questionnaire asks only what it can price, and claims only what is sourced', () => {
  // Every paid price unread → no paid question is asked.
  const none: PlanPrices = { pro: null, partsFrom: null, papicFrom: null, liveWatch: null, patiktok: null, ai: {} };
  const asked = questionsFor(state({ live: true }), none, fmt).map((q) => q.k);
  assert.deepEqual(asked, ['guests', 'seating', 'hub', 'checkin', 'prints', 'papic', 'live', 'together']);
  // Live Watch is a follow-up: asked only after a yes to "watch from home".
  const qs = questionsFor(state({}), PRICES, fmt);
  assert.ok(!stepsFor(state({ live: false }), qs).includes('livewatch'));
  assert.ok(stepsFor(state({ live: true }), qs).includes('livewatch'));
  assert.deepEqual(stepsFor(state({}), qs).slice(0, 2), ['type', 'count']);
  // A band with no row → no Setnayan AI question for that event type.
  assert.ok(!questionsFor(state({}, { type: 'B' }), PRICES, fmt).some((q) => q.k === 'ai'));

  // The result: set-up prices while the switch is on, regular when off.
  const all = state({ guests: true, prints: true, pro: true, ai: true });
  let r = resultFor(all, questionsFor(all, PRICES, fmt), PRICES);
  assert.equal(r.total, 3 + 14);
  assert.equal(r.includedCount, 2);
  assert.equal(r.showSetupSwitch, true);
  const off = { ...all, setup: false };
  r = resultFor(off, questionsFor(off, PRICES, fmt), PRICES);
  assert.equal(r.total, 5 + 24);
  // Money kept: 75 households × 89 + 150 place cards × 10 + 15 tables × 20 + one sign 1,100 (lib/old-way-costs.ts).
  assert.equal(r.money.total, 75 * 89 + 150 * 10 + 15 * 20 + 1100);
  // About 9 hours — only on a yes to the guest list.
  assert.equal(r.hoursBack, 9);
  const noList = state({ prints: true });
  assert.equal(resultFor(noList, questionsFor(noList, PRICES, fmt), PRICES).hoursBack, null);

  const quiz = SRC['plan/_plan-quiz.tsx'];
  assert.match(quiz, /r\.hoursBack != null \?/, 'the hours line no longer waits for the guest-list yes');
  assert.match(quiz, /href="\/start"[^>]*>\s*Start your event/);
  assert.match(quiz, /Your event, built with Setnayan\./);
  assert.match(quiz, /included with every event/);
  assert.match(quiz, /What Setnayan does for you/);
  assert.match(quiz, /min=\{10\}\s+max=\{500\}/, 'the guest slider is 10–500');
});
