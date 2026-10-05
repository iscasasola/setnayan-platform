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
 *   · PHONE — the closed find area (bench · Picks · Payments · Plans) was
 *     342 KB of the page's 365 KB of markup: drawn, shipped and hydrated on a
 *     phone that shows none of it until a "Your planning" row is tapped.
 *
 *   (1) EXECUTED: the first paint on a phone has the team and NOT the closed
 *       find area; a deep link (`initialFindOpen`) still paints it at once;
 *   (2) the find area mounts in the SAME render that opens it (so the
 *       next-frame scroll in `goToSection` lands on a laid-out element), stays
 *       mounted, and mounts straight away on a computer;
 *   (3) the page's independent reads are STARTED together, right after the
 *       gates, and none of them is awaited on its own line any more.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));

async function paint(initialFindOpen: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ServicesTakeover } = await import('./_components/services-takeover');
  return renderToStaticMarkup(
    React.createElement(ServicesTakeover, {
      eventId: 'e1',
      initialFindOpen,
      teamSlot: React.createElement('b', { 'data-team-probe': '' }, 'Kuya Mike Events'),
      shortlistSlot: React.createElement('i', { 'data-bench-probe': '' }),
      buildSlot: React.createElement('i', { 'data-picks-probe': '' }),
      budgetSlot: React.createElement('i', { 'data-payments-probe': '' }),
      compareSlot: React.createElement('i', { 'data-plans-probe': '' }),
    }),
  );
}

test('(1) a phone’s first paint is the team — the closed find area is not drawn', async () => {
  const closed = await paint(false);
  assert.match(closed, /data-team-probe=""/, 'the team is missing from the first paint');
  assert.match(closed, /id="team-find-area"/, 'the find area’s anchor must stay, so every door can still open it');
  // Payments and Plans are collapsed sections either way, so the bench and
  // Picks — open by default — are what a closed area must not draw.
  for (const probe of ['bench', 'picks']) {
    assert.doesNotMatch(
      closed,
      new RegExp(`data-${probe}-probe`),
      `the closed find area still draws ${probe} on a phone that shows none of it`,
    );
  }
});

test('(1) a deep link into the find area paints it in the FIRST render', async () => {
  const open = await paint(true);
  for (const probe of ['bench', 'picks']) {
    assert.match(open, new RegExp(`data-${probe}-probe=""`), `a deep link lost ${probe} from the first paint`);
  }
});

test('(2) opening renders it in the same commit, it stays, and a computer mounts it at once', () => {
  const src = code('_components', 'services-takeover.tsx');
  assert.match(src, /const findRendered = findOpen \|\| findMounted;/, 'opening must render the area in the same commit');
  assert.match(src, /\{findRendered \? \(/, 'the area is not gated on findRendered');
  assert.match(src, /const \[findMounted, setFindMounted\] = useState\(initialFindOpen\)/, 'a deep link must mount it in the first render');
  assert.match(src, /if \(findOpen\) setFindMounted\(true\);/, 'once opened it must stay mounted');
  assert.match(src, /matchMedia\('\(min-width: 1024px\)'\)/, 'a computer, where it is always on screen, must mount it');
  assert.doesNotMatch(src, /setFindMounted\(false\)/, 'the area is unmounted again — its state would be lost');
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
