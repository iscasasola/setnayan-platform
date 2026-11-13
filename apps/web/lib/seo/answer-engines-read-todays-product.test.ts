/**
 * answer-engines-read-todays-product.test.ts — what search engines and AI read about Setnayan is today's product
 * (Build 6 Lane K, owner 10 Nov 2026: *"add to build 6 the database created to help our page be more visible to
 * searches on search engines and AI. update them all as well"*).
 *
 * Six properties, each watched failing once (the SABOTAGE line above each test names how):
 *   1. /llms.txt names no retired plan, product or untrue claim (`STALE_CLAIMS`) — fee on AND off.
 *   2. /llms.txt answers every saved question AI gets wrong, in the same words as `aiAnswers` (one list).
 *   3. /llms.txt lists every live feature page, and the supplier plans are Lane J's table, cell for cell.
 *   4. No saved answer types a peso figure — the only figures are the live booking-fee schedule's.
 *   5. Every public route the audit knows is in a sitemap (or is exempted here with its reason).
 *   6. The homepage's and /features' structured data carry no retired name, and the /features FAQPage carries the
 *      saved answers — the same list the page renders.
 *
 * Run: cd apps/web && npx tsx --test lib/seo/answer-engines-read-todays-product.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderLlmsTxt, llmsFeaturePages } from '../llms-txt';
import { INPUT_FOR_GUARDS } from '../llms-txt-guard-input';
import { BOOKING_FEE } from '../booking-fee';
import { stripComments } from '../strip-comments';
import { FEATURE_PAGES, featurePaths } from '../feature-pages';
import { STALE_CLAIMS, findStaleClaims } from './stale-claims';
import { aiAnswers, aiAnswerQuestions, featuresFaqAnswers, parseAiAnswerRationale, aiAnswerRationale, lastAskedById, recheckDue } from './ai-answers';
import { KNOWN_PUBLIC_ROUTES, MUST_BE_IN_SITEMAP } from './health-checks';
import { planTable, TABLE_TIERS, tableTierName } from '@/app/for-suppliers/_components/plan-table-data';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '../..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function withFee<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  if (value === undefined) delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  else process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
    else process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = prev;
  }
}
const renderOn = () => withFee('true', () => renderLlmsTxt({ ...INPUT_FOR_GUARDS, bookingFee: BOOKING_FEE }));
const renderOff = () => withFee(undefined, () => renderLlmsTxt(INPUT_FOR_GUARDS));

/* ── 1 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

// SABOTAGE: put "the 4-in-1 Event Hub" or "AI Proposal Builder (Pro+)" back into lib/llms-txt.ts → RED.
test('llms.txt names no retired plan, product or untrue claim — fee on and off', () => {
  for (const [where, body] of [['fee on', renderOn()], ['fee off', renderOff()]] as const) {
    assert.deepEqual(findStaleClaims(body), [], `llms.txt (${where}) still says something retired or untrue`);
  }
});

test('the stale-claims list is live — every entry still catches the words it was written for', () => {
  const samples = [
    'Ultra was called Enterprise',
    'the Custom plan',
    'buy the Pro Event Hub',
    'the 4-in-1 Event Hub',
    'your token wallet',
    'the guest gallery',
    'AI Proposal Builder',
    'a read API',
    'buy Setnayan AI on its own',
    '**Does Setnayan take a commission?** No.',
  ];
  for (const c of STALE_CLAIMS) {
    assert.ok(samples.some((t) => c.pattern.test(t)), `no sample trips ${c.pattern} — a pattern that catches nothing is decoration`);
  }
});

/* ── 2 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

// SABOTAGE: drop the "Questions AI assistants get wrong" section from renderLlmsTxt → RED.
test('llms.txt prints every saved question with our true answer, word for word', () => {
  const body = renderOn();
  for (const a of withFee('true', () => aiAnswers({ bookingFee: BOOKING_FEE }))) {
    assert.ok(body.includes(`- **${a.question}** ${a.answer}`), `llms.txt does not answer "${a.question}" in the saved words`);
  }
  assert.deepEqual(aiAnswerQuestions(), aiAnswers({ bookingFee: null }).map((a) => a.question));
});

test('the commission answer says who pays what — the live rate when read, no rate (never the default) when not', () => {
  const live = { ...BOOKING_FEE, rate: 0.04 };
  const on = withFee('true', () => aiAnswers({ bookingFee: live }).find((a) => a.id === 'commission')!.answer);
  assert.match(on, /Couples pay no commission/);
  assert.match(on, /4% of the first/);
  const unread = withFee('true', () => aiAnswers({ bookingFee: null }).find((a) => a.id === 'commission')!.answer);
  assert.ok(!/%/.test(unread), 'an unread schedule printed a rate');
  assert.match(unread, /For Suppliers page/);
  const off = withFee(undefined, () => aiAnswers({ bookingFee: live }).find((a) => a.id === 'commission')!.answer);
  assert.match(off, /no booking fee while it is switched off/);
});

/* ── 3 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

// SABOTAGE: filter one more feature out of llmsFeaturePages → RED.
test('llms.txt lists every live feature page (bar the ones unlisted until proven)', () => {
  const body = renderOn();
  const listed = llmsFeaturePages();
  assert.ok(listed.length >= FEATURE_PAGES.length - 2, 'more than the unlisted few are missing from llms.txt');
  for (const f of listed) assert.ok(body.includes(`https://www.setnayan.com${f.path}`), `llms.txt does not link ${f.path}`);
});

// SABOTAGE: hand-type a cell in the llms.txt supplier table, or drop a planTable group → RED.
test('the supplier plans in llms.txt are Lane J’s plan table, cell for cell, under Free · Verified · Supplier Plus · Supplier Pro · Supplier Ultra', () => {
  const body = renderOn();
  assert.ok(body.includes(`| | ${TABLE_TIERS.map(tableTierName).join(' | ')} |`), 'the plan header is not Free · Verified · Supplier Plus · Supplier Pro · Supplier Ultra');
  assert.equal(TABLE_TIERS.map(tableTierName).join(' · '), 'Free · Verified · Supplier Plus · Supplier Pro · Supplier Ultra');
  const groups = planTable({ paywallOn: false, prices: { monthly: {}, annual: {}, bySku: {} } });
  for (const g of groups) {
    for (const r of g.rows) {
      assert.ok(body.includes(`| ${g.title} · ${r.label} |`), `llms.txt lost the plan row "${g.title} · ${r.label}"`);
    }
  }
});

/* ── 4 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

// SABOTAGE: type "₱2,990" into any answer in lib/seo/ai-answers.ts → RED.
test('no saved answer types a peso figure — prices are read, never written', () => {
  for (const a of withFee('true', () => aiAnswers({ bookingFee: null }))) {
    assert.ok(!/₱\s?\d/.test(a.answer), `"${a.question}" types a peso figure: ${a.answer}`);
  }
});

test('every answer names its evidence and a public route', () => {
  for (const a of aiAnswers({ bookingFee: null })) {
    assert.ok(a.evidence.length > 10, `${a.id} has no evidence`);
    assert.ok(KNOWN_PUBLIC_ROUTES.has(a.route), `${a.id} points at ${a.route}, which is not a known public route`);
  }
  const ids = aiAnswers({ bookingFee: null }).map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'two answers share an id — the monthly log could not tell them apart');
});

test('the monthly log round-trips: rationale → id, newest per question, due after the window', () => {
  assert.deepEqual(parseAiAnswerRationale(aiAnswerRationale('commission', 'wrong')), { id: 'commission', verdict: 'wrong' });
  assert.equal(parseAiAnswerRationale('some other suggestion'), null);
  const last = lastAskedById([
    { rationale: aiAnswerRationale('app', 'right'), created_at: '2026-10-01T00:00:00Z' },
    { rationale: aiAnswerRationale('app', 'wrong'), created_at: '2026-11-01T00:00:00Z' },
    { rationale: null, created_at: '2026-11-09T00:00:00Z' },
  ]);
  assert.equal(last.get('app'), '2026-11-01T00:00:00Z');
  const now = Date.parse('2026-11-10T00:00:00Z');
  assert.equal(recheckDue('2026-11-01T00:00:00Z', now), false);
  assert.equal(recheckDue('2026-09-01T00:00:00Z', now), true);
  assert.equal(recheckDue(null, now), true);
});

/* ── 5 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Public routes deliberately in no sitemap — each with its reason. */
const NOT_IN_A_SITEMAP: Record<string, string> = {
  '/explore/compare': "the visitor's own shortlist side by side — nothing on it a search engine could index",
  '/weddings': '308s to /realstories (next.config.ts) — a sitemap never lists a redirect',
};

// SABOTAGE: delete '/for-coordinators' from app/sitemap-static.xml/route.ts → RED.
test('every public route the audit knows is listed in a sitemap', () => {
  const statics = new Set([...code('app/sitemap-static.xml/route.ts').matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]!));
  const features = new Set(FEATURE_PAGES.flatMap((f) => [featurePaths(f.slug).en, featurePaths(f.slug).tl]));
  // Child sitemaps that list their own hub (each route file names it).
  const hubs: Record<string, string> = {
    '/help': 'app/sitemap-help.xml/route.ts',
    '/blog': 'app/sitemap-blog.xml/route.ts',
    '/realstories': 'app/sitemap-weddings.xml/route.ts',
    '/suppliers': 'app/sitemap-suppliers.xml/route.ts',
    '/v/': 'app/sitemap-vendors.xml/route.ts',
  };
  const missing: string[] = [];
  for (const r of KNOWN_PUBLIC_ROUTES) {
    if (statics.has(r) || features.has(r) || NOT_IN_A_SITEMAP[r]) continue;
    const hub = hubs[r];
    if (hub && (r === '/v/' || code(hub).includes(`'${r}'`) || code(hub).includes(`${r}\``))) continue;
    missing.push(r);
  }
  assert.deepEqual(missing, [], 'a public route is in no sitemap — list it, or exempt it here with the reason');
  for (const p of MUST_BE_IN_SITEMAP) assert.ok(statics.has(p), `${p} must be in the static sitemap (the daily audit checks the served one)`);
  for (const r of Object.keys(NOT_IN_A_SITEMAP)) assert.ok(KNOWN_PUBLIC_ROUTES.has(r), `${r} is exempted but is not public — drop the row`);
});

/* ── 6 ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

// SABOTAGE: put "Event Hub Pro’s Logo & QR part" back in the homepage featureList → RED.
test('the homepage structured data names no retired product', () => {
  const src = code('app/page.tsx');
  const start = src.indexOf('const softwareAppJsonLd');
  const end = src.indexOf('export default');
  assert.ok(start >= 0 && end > start, 'the homepage JSON-LD moved — re-point this guard');
  const block = src.slice(start, end);
  assert.deepEqual(findStaleClaims(block), [], 'the homepage JSON-LD still says something retired');
  assert.ok(!/Logo & QR part|Setnayan AI[^']*paid add-on/.test(block), 'the homepage JSON-LD still sells a part or Setnayan AI on its own');
});

// SABOTAGE: build the FAQPage from WHY_FAQ[locale] again (dropping the saved answers) → RED.
test('the /features FAQ and its FAQPage carry the saved answers from the one list', () => {
  const body = code('app/features/_PageBody.tsx');
  assert.match(body, /mainEntity:\s*whyFaqItems\(locale\)/, 'the FAQPage is not built from whyFaqItems — page and rich result can disagree');
  const why = code('app/features/_sections/_WhySetnayan.tsx');
  assert.match(why, /const faq = whyFaqItems\(locale\)/, 'the FAQ section does not render whyFaqItems');
  assert.match(why, /featuresFaqAnswers\(\)/, 'the English FAQ no longer adds the saved answers');
  const faq = featuresFaqAnswers();
  assert.ok(faq.length >= 8, 'the /features FAQ lost saved answers');
  for (const a of faq) assert.ok(!/₱\s?\d/.test(a.a), `a /features FAQ answer types a price: ${a.q}`);
});
