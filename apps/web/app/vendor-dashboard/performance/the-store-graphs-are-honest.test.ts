/**
 * 🔒 THE STORE'S NEW GRAPHS ARE HONEST AND WIRED (owner 23 Nov 2026 — Supplier Store drawing v10; DECISION_LOG 5a8c6bf3
 * "every graph reads a real table" · 022681cf "every graph is free"):
 *   1 · they sit at the END of the one carousel, in the drawing's order, each marked New; "Albums opened" is not built;
 *   2 · a refused read is "Couldn’t load." with no picture and no advice — never a zero, never the Example;
 *       nothing yet is the faded Example; a real zero where zero is the answer ("no inquiry slipped") is a real card;
 *   3 · each fact is read by its ONE reader, through an HONEST single read (null on refusal), never the bundles'
 *       empty shapes; booked value reuses the section's own series; the section reads them only after the
 *       Verified lock, and hands them to the carousel's one card builder.
 * Rendered for 2, source-read (comments stripped) for 1 and 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import { CARD_ORDER, FIXED_WINDOW } from './_components/analytics-cards';
import { STORE_FIXED_WINDOW, STORE_GRAPH_KEYS, type StoreGraphs } from '@/lib/vendor-store-graphs';

(globalThis as unknown as { React: unknown }).React = React;
{
  /* The Heat picture's tree imports a plain stylesheet — nothing to node; the same stub
     byline-renders-as-a-door.test.ts uses. So the cards are imported DYNAMICALLY, after it. */
  const Mod = require('node:module');
  Mod._extensions['.css'] = (m: { exports: unknown }) => {
    m.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
  };
}
const cards = () => import('./_components/store-graphs').then((m) => m.storeGraphSpecs);

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const NONE: StoreGraphs = {
  followers: null,
  saved: null,
  photos: null,
  whenask: null,
  missed: null,
  value: null,
  owed: null,
  lead: null,
  types: null,
  revmonth: null,
  substars: null,
  replied: null,
};

const NOTHING_YET: StoreGraphs = {
  followers: { values: Array(30).fill(0), labels: Array(30).fill('1 Nov'), total: 0 },
  saved: { values: Array(30).fill(0), labels: Array(30).fill('1 Nov'), total: 0 },
  photos: { top: [], total: 0, urls: {} },
  whenask: [],
  missed: { declined: 0, unansweredOverSla: 0, selfReportedNoResponse: 0, waitlisted: 0 },
  value: Array.from({ length: 12 }, (_, i) => ({ key: `m${i}`, label: 'Nov', php: 0 })),
  owed: { receivedPhp: 0, toComePhp: 0, overdue: 0, unresolved: 0, bookings: 0 },
  lead: { bookedWithDateCount: 0, avgLeadDays: null, medianLeadDays: null },
  types: { kinds: [], total: 0, atLeast: false },
  revmonth: Array.from({ length: 12 }, (_, i) => ({ key: `m${i}`, label: 'Nov', count: 0 })),
  substars: { n: 0, avg: { communication: 0, quality: 0, value: 0, on_time: 0 } },
  replied: { replied: 0, total: 0 },
};

test('1 · the twelve sit at the end of the one carousel, in the drawing’s order, marked New; no Albums card', async () => {
  const storeGraphSpecs = await cards();
  assert.deepEqual(CARD_ORDER.slice(-STORE_GRAPH_KEYS.length), [...STORE_GRAPH_KEYS], 'the new graphs are not the carousel’s last cards');
  assert.ok(!(CARD_ORDER as readonly string[]).includes('albums'), 'Albums opened has no reader (vendor_album_opens is the shop’s own opens)');
  for (const [k, w] of Object.entries(STORE_FIXED_WINDOW)) assert.equal(FIXED_WINDOW[k as keyof typeof FIXED_WINDOW], w, `${k} lost its fixed window`);
  const specs = storeGraphSpecs(NOTHING_YET, '30');
  assert.deepEqual(Object.keys(specs).sort(), [...STORE_GRAPH_KEYS].sort());
  for (const k of STORE_GRAPH_KEYS) {
    assert.equal(specs[k].tag, 'new', `${k} is not marked New`);
    assert.equal(specs[k].rec, null, `${k} carries advice no rule in buildGrowthRecs gave`);
    assert.ok(specs[k].door.href.startsWith('/vendor-dashboard/'), `${k}'s door goes nowhere real`);
  }
});

test('2 · refused = Couldn’t load (never a zero, never the Example); nothing yet = Example; a real zero is real', async () => {
  const storeGraphSpecs = await cards();
  for (const win of ['30', '12'] as const) {
    const refused = storeGraphSpecs(NONE, win);
    for (const k of STORE_GRAPH_KEYS) {
      assert.equal(refused[k].state, 'unread', `${k} (${win}) drew something for a refused read`);
      assert.equal(refused[k].line, 'Couldn’t load.', `${k} (${win}) says something other than Couldn’t load`);
    }
    const empty = storeGraphSpecs(NOTHING_YET, win);
    for (const k of STORE_GRAPH_KEYS) {
      if (k === 'missed') continue;
      assert.equal(empty[k].state, 'empty', `${k} (${win}) with nothing yet is not the faded Example`);
      assert.doesNotMatch(String(empty[k].line), /\b0\b|₱0/, `${k} (${win}) says a zero where it has nothing yet`);
    }
    assert.equal(empty.missed.state, 'ok', 'no inquiry slipped is a real answer, not an Example');
    assert.match(String(empty.missed.line), /^No inquiry slipped/);
  }
});

test('3 · one reader per fact, read honestly; value reuses the section’s series; read after the Verified lock', () => {
  const server = read('lib/vendor-store-graphs.server.ts');
  for (const fn of ['fetchInquiryHeatmap', 'fetchInquiryMissed', 'fetchLeadTime', 'fetchReviewMonthly', 'fetchReviewCoverage', 'readVendorCompletedEventTypes', 'readVendorPaydayInstallments', 'moneyPicture', 'eventsByKind'])
    assert.match(server, new RegExp(`\\b${fn}\\(`), `the store graphs do not use ${fn}`);
  // Never the bundles, which fold a refused RPC into an empty shape a graph would draw as zero.
  assert.doesNotMatch(server, /fetchVendor(Inquiry|Conversion|Reputation)Analytics|fetchVendorCompletedEvents\(/);
  // No RPC or money table is read here a second way.
  assert.doesNotMatch(server, /\.rpc\(|from\('event_vendor_payments'\)|from\('event_vendors'\)/, 'a second reader of a fact that has one');
  assert.match(server, /if \(!read\.complete\) return null;/, 'a payday read that stopped short became a smaller total');
  // The honest single reads return null on refusal.
  for (const [file, fns] of [
    ['lib/vendor-inquiry-analytics.ts', ['fetchInquiryMissed', 'fetchInquiryHeatmap']],
    ['lib/vendor-conversion-analytics.ts', ['fetchLeadTime']],
    ['lib/vendor-reputation-analytics.ts', ['fetchReviewCoverage', 'fetchReviewMonthly']],
  ] as const) {
    const src = read(file);
    for (const fn of fns) {
      const body = src.slice(src.indexOf(`export async function ${fn}(`), src.indexOf('\n}\n', src.indexOf(`export async function ${fn}(`)));
      assert.match(body, /if \(error \|\| !Array\.isArray\(data\)\) \{[\s\S]*?return null;/, `${fn} does not say a refusal`);
    }
  }
  const section = read('app/vendor-dashboard/performance/_components/one-analytics-section.tsx');
  assert.ok(section.indexOf('const storeGraphsRead = readStoreGraphs(') > section.indexOf("canUse('analytics'"), 'an unverified shop runs the store graph reads');
  assert.match(section, /const storeGraphs = withBookedValue\(await storeGraphsRead, bookingSeries\);/, 'booked value is not the section’s own series');
  assert.match(section, /store=\{storeGraphs\}/);
  const carousel = read('app/vendor-dashboard/performance/_components/analytics-carousel.tsx');
  assert.match(carousel, /\.\.\.\(props\.store \? storeGraphSpecs\(props\.store\['30'\], '30'\) : \{\}\)/);
  assert.match(carousel, /\.\.\.\(props\.store \? storeGraphSpecs\(props\.store\['12'\], '12'\) : \{\}\)/);
});
