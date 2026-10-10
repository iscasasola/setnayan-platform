/**
 * suppliers-opens-fast.test.ts — the Suppliers tab does not make a phone wait
 * for things it is not showing, or for reads that could have run together.
 *
 * Owner, live on maria-and-jose at 375 px (2026-10-05): Suppliers sat on
 * "Opening your suppliers" for ~6 s. Measured on prod the same day:
 *
 *   · SERVER — the page's payload took 1.3–2.2 s (Guests ~0.9 s, Home ~1.0 s).
 *     After its gates it waited on ~25 database trips one after another,
 *     most of which need nothing from each other.
 *   · PHONE — everything the phone was NOT showing was drawn, shipped and
 *     hydrated anyway (342 KB of the page's 365 KB of markup).
 *
 * Re-pointed 2026-10-08 at the one-screen shell (Find · Build · Booked, one
 * body — corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1). The rule is the
 * same one, restated for three bodies:
 *
 *   (1) EXECUTED: the first paint draws ONE body — the one asked for — with
 *       the pinned line and control above it; the other two are not drawn;
 *   (2) a body is drawn in the SAME commit that opens it (so a caller that
 *       scrolls to a row of it finds a laid-out element), then stays mounted
 *       — hidden, never unmounted — so its state survives and nothing is
 *       drawn twice;
 *   (3) the page's independent reads are STARTED together, right after the
 *       gates, and none of them is awaited on its own line any more.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { BudgetBuildTab } from '@/lib/budget-build';

(globalThis as unknown as { React: unknown }).React = React;

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));

const PROBES = ['team', 'bench', 'picks', 'payments', 'plans'] as const;

async function paint(initialTab?: BudgetBuildTab, tally = { filled: 2, total: 5, knownPhp: 1_056_000, unpriced: 0 }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ServicesTakeover } = await import('./_components/services-takeover');
  return renderToStaticMarkup(
    React.createElement(ServicesTakeover, {
      eventId: 'e1',
      ...(initialTab ? { initialTab } : {}),
      tally,
      bookedCount: 2,
      factsSlot: React.createElement('b', { 'data-facts-probe': '' }, 'Fri, Dec 18, 2026'),
      teamSlot: React.createElement('b', { 'data-team-probe': '' }, 'Kuya Mike Events'),
      shortlistSlot: React.createElement('i', { 'data-bench-probe': '' }),
      buildSlot: React.createElement('i', { 'data-picks-probe': '' }),
      budgetSlot: React.createElement('i', { 'data-payments-probe': '' }),
      compareSlot: React.createElement('i', { 'data-plans-probe': '' }),
    }),
  );
}

/** Which probes a paint drew. */
const drew = (html: string) => PROBES.filter((p) => new RegExp(`data-${p}-probe=""`).test(html));

test('(1) the first paint is ONE body — Find — under the pinned line and control', async () => {
  const html = await paint();
  assert.deepEqual(drew(html), ['bench'], 'the first paint draws a body nobody is looking at');
  assert.match(html, /data-suppliers-mode="find"/);
  assert.equal((html.match(/data-suppliers-body="/g) ?? []).length, 1, 'more than one body in the first paint');
  // The pinned block: the page's date · place line, then the three segments, in order.
  const stick = html.slice(html.indexOf('data-suppliers-stick'), html.indexOf('data-suppliers-body='));
  assert.match(stick, /data-facts-probe=""/, 'the date · place line is missing from the pinned block');
  const segments = [...stick.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*data-seg="([a-z]+)"[^>]*>/g)].map((m) => `${m[2]}:${m[1]}`);
  assert.deepEqual(segments, ['find:true', 'build:false', 'booked:false']);
  // The landing rule reaches the paint as CSS, not as escaped text.
  assert.ok(html.includes('[id^="slfold-"]'), 'the landing CSS was escaped on its way out — the selector would match nothing');
  // The words and their counts — "Find · Build 2/5 · Booked 2" — read from the markup.
  const words = stick.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(words, /Find Build 2 \/ 5 Booked 2/);
  assert.doesNotMatch(words, /vendor|Picks|Shortlist/i);
});

test('(1) a count of nothing is not drawn — never "Build 0/0" or "Booked 0"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ServicesTakeover } = await import('./_components/services-takeover');
  const html = renderToStaticMarkup(
    React.createElement(ServicesTakeover, { eventId: 'e1', tally: { filled: 0, total: 0, knownPhp: 0, unpriced: 0 }, bookedCount: 0 }),
  );
  assert.doesNotMatch(html, /data-seg-count=/);
  const words = html.slice(html.indexOf('data-suppliers-stick'), html.indexOf('data-suppliers-body=')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.match(words, /Find Build Booked/);
});

test('(1) a deep link paints ITS body in the first render, and only that one', async () => {
  // `?tab=build` — the finished-event summary and the lock door land on the picks.
  const build = await paint('build');
  assert.deepEqual(drew(build), ['picks', 'plans']);
  assert.match(build, /data-suppliers-mode="build"/);
  // `?tab=compare` is the saved builds, inside Build.
  assert.deepEqual(drew(await paint('compare')), ['picks', 'plans']);
  // `?tab=budget` — the payments, under the team's rows.
  const booked = await paint('budget');
  assert.deepEqual(drew(booked), ['team', 'payments']);
  assert.ok(booked.indexOf('data-team-probe') < booked.indexOf('data-payments-probe'), 'the team comes before the payments');
  // `?tab=shortlist&open=<tile>` — a checklist deep link — is the bench.
  assert.deepEqual(drew(await paint('shortlist')), ['bench']);
});

test('(2) a body is drawn in the commit that opens it, and stays — hidden, never unmounted', () => {
  const src = code('_components', 'services-takeover.tsx');
  assert.match(src, /const drawn = \(m: SuppliersMode\) => m === mode \|\| seen\.has\(m\);/, 'a body is not drawn in the commit that opens it');
  for (const m of ['find', 'build', 'booked']) {
    assert.match(
      src,
      new RegExp(`\\{drawn\\('${m}'\\) \\? \\(\\s*<div data-suppliers-body="${m}" hidden=\\{mode !== '${m}'\\}>`),
      `the ${m} body is not gated on drawn(), or is unmounted instead of hidden`,
    );
  }
  // Opening commits NOW: the Build body's "open this category" doorway scrolls
  // to a bench row straight after asking for Find over the bus.
  const goTo = src.slice(src.indexOf('const goToSection'), src.indexOf('}, []);', src.indexOf('const goToSection')));
  assert.match(goTo, /flushSync\(\(\) => \{\s*setMode\(nextMode\);\s*setSeen\(\(s\) => \(s\.has\(nextMode\) \? s : new Set\(s\)\.add\(nextMode\)\)\);/);
  // Once seen, kept: nothing ever takes a mode back out of the set.
  assert.doesNotMatch(src, /\.delete\(|setSeen\(new Set\(\)\)|setSeen\(\(\) => new Set/, 'a body is unmounted again — its state would be lost');
  assert.match(src, /useState<ReadonlySet<SuppliersMode>>\(\(\) => new Set\(\[firstMode\]\)\)/, 'the first paint must draw only the first body');
});

test('(3) the page starts its independent reads together, after the gates', () => {
  const page = code('page.tsx');
  const body = page.slice(page.indexOf('export default async function VendorsPage('));
  const start = body.indexOf('const paywallRead = startRead(');
  assert.ok(start > -1, 'the started-reads block is gone');
  for (const gate of ['isDelegateWithoutArea(', 'await sweepRipeReviewRequests(', 'if (!vendorsRead.measured)']) {
    const at = body.indexOf(gate);
    assert.ok(at > -1 && at < start, `the reads must start AFTER the gate \`${gate}\``);
  }
  const block = body.slice(start, body.indexOf('let pendingLockProposals'));
  assert.ok(block.length > 0, 'the started-reads block lost its end anchor');
  for (const read of [
    'resolveSetnayanAiPaywallEnabled()',
    'isStoreShellRequest()',
    'getTaxonomy()',
    'fetchPlanGroupScope(supabase)',
    ".from('event_build_picks')",
    ".from('event_bench_arrangement')",
    'resolveAllocationInputs(supabase, eventId)',
    'resolveLivePax(supabase, eventId)',
    'getEventPreferences(supabase, eventId)',
    'readUnreadChatCountsByThread(supabase, user.id)',
    ".from('budget_builds')",
    ".from('event_category_decisions')",
    'readDepositSteps()',
    'readReviewStatus()',
    'readCoveredTiles()',
    'readExcludedTiles()',
  ]) {
    assert.ok(block.includes(read), `${read} is no longer started with the others`);
  }
  // …and nothing awaits one of them on its own line again.
  for (const serial of [
    /await resolveSetnayanAiPaywallEnabled\(/,
    /await isStoreShellRequest\(/,
    /await getTaxonomy\(/,
    /await fetchPlanGroupScope\(/,
    /await resolveAllocationInputs\(/,
    /await resolveLivePax\(/,
    /await getEventPreferences\(/,
    /await readUnreadChatCountsByThread\(/,
    /await fetchActiveCategoryMarketPool\(/,
    /await supabase\s*\.from\('(event_build_picks|event_bench_arrangement|budget_builds)'\)/,
    /= await \(async \(\): Promise<Map<string, (DepositStep|VendorReviewStatus)>> =>/,
  ]) {
    assert.doesNotMatch(body, serial, `a read is awaited on its own line again: ${serial}`);
  }
  // The market pool starts the moment its one input exists.
  assert.match(body, /const marketPoolRead = startRead\(\s*fetchActiveCategoryMarketPool\(vendorRows/);
});
