/**
 * the-roster-pages.test.ts — a supplier with a thousand customers can still
 * manage all of them AND still reach the rest of the page.
 *
 * Owner, 2026-09-19, on My Customers as Saysay: "if they have 50 customers/100
 * customers, can we do it in pages? so if they have 1000 inquiries, they can
 * still manage all and still be able to see the lower parts of the page?"
 *
 * Three layers, because each one alone can pass while the screen is wrong:
 *   1. EXECUTE `rosterView` with 1,000 customers — the chips count everyone,
 *      one page of 20 comes out, waiting first, search before paging.
 *   2. RENDER `CustomersRoster` with that output — the markup draws 20 rows,
 *      the chips and the heading carry the whole-list totals, the pager says
 *      "41–60 of 1,000".
 *   3. SOURCE-GUARD `page.tsx` and the other supplier lists — the render is
 *      handed the SLICE, and every long list mounts the one shared pager on a
 *      param no other list on the hub uses. (1 and 2 cannot see the page file;
 *      a page that went back to `rows={everyone}` would leave them green.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import {
  CUSTOMER_LANES,
  groupByLane,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { rosterView } from './roster-view';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');

// ── fixtures ──────────────────────────────────────────────────────────────

function customer(i: number, lane: CustomerLane): PipelineCustomer {
  return {
    eventId: `e${i}`,
    lane,
    waitingKind: lane === 'waiting' ? 'inquiry' : null,
    waitingSince: lane === 'waiting' ? new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString() : null,
    expiresAt: null,
    quietDays: lane === 'holding' ? 20 : null,
    title: `Couple ${String(i).padStart(4, '0')}`,
    identityRevealed: true,
    eventDate: null,
    place: null,
    threadId: `t${i}`,
    eventVendorId: null,
  };
}

/** 1,000 customers: 37 waiting, 63 holding, 500 talking, 300 booked, 100 finished. */
const MIX: Record<CustomerLane, number> = { waiting: 37, holding: 63, talking: 500, booked: 300, finished: 100 };
function thousand(): PipelineCustomer[] {
  const out: PipelineCustomer[] = [];
  let i = 0;
  // Shuffled across lanes so the ORDER comes from groupByLane, not the fixture.
  const pool: CustomerLane[] = [];
  for (const lane of CUSTOMER_LANES) for (let n = 0; n < MIX[lane]; n++) pool.push(lane);
  for (let k = pool.length - 1; k > 0; k--) {
    const j = (k * 7919) % (k + 1);
    [pool[k], pool[j]] = [pool[j]!, pool[k]!];
  }
  for (const lane of pool) out.push(customer(i++, lane));
  return out;
}

const derived = thousand();
const lanes = groupByLane(derived);

// ── 1 · EXECUTE THE DECISION ──────────────────────────────────────────────

test('the fixture really is a thousand customers across every lane', () => {
  assert.equal(derived.length, 1000);
  for (const lane of CUSTOMER_LANES) assert.equal(lanes[lane].length, MIX[lane]);
});

test('lane counts are the WHOLE-LIST totals while only one page of 20 comes out', () => {
  let decorated = 0;
  for (const raw of [undefined, '1', '3', '50']) {
    const v = rosterView(lanes, {
      lane: undefined,
      q: undefined,
      page: raw,
      decorate: (r) => {
        decorated += 1;
        return r;
      },
    });
    assert.deepEqual(v.laneCounts, MIX, `counts drifted on page ${raw}`);
    assert.equal(v.paged.items.length, 20, `page ${raw} did not render exactly 20 rows`);
    assert.equal(v.paged.total, 1000);
  }
  assert.equal(decorated, 80, 'decorate ran on more than the rows on screen');
});

test('the counts stay totals under a lane chip AND inside a search', () => {
  const v = rosterView(lanes, { lane: 'booked', q: 'Couple 09', page: '1', decorate: (r) => r });
  assert.deepEqual(v.laneCounts, MIX, 'a chip or a search shrank the chip counts');
  assert.equal(v.activeLane, 'booked');
  assert.ok(v.paged.items.length > 0, 'the fixture has no booked "Couple 09…" — this check would be vacuous');
  assert.ok(v.paged.items.every((r) => r.lane === 'booked'));
  // Every word of the needle appears in the name ("09" matches "Couple 0109" too).
  assert.ok(v.paged.items.every((r) => r.title.toLowerCase().includes('couple') && r.title.includes('09')));
});

test('page 1 opens on who is waiting; paging slices AFTER the lane order', () => {
  const p1 = rosterView(lanes, { lane: undefined, q: undefined, page: '1', decorate: (r) => r });
  assert.ok(p1.paged.items.every((r) => r.lane === 'waiting'), 'page 1 is not all waiting');
  assert.deepEqual(
    p1.paged.items.map((r) => r.eventId),
    lanes.waiting.slice(0, 20).map((r) => r.eventId),
    'page 1 is not the first 20 of the waiting order',
  );
  const p2 = rosterView(lanes, { lane: undefined, q: undefined, page: '2', decorate: (r) => r });
  assert.deepEqual(
    p2.paged.items.map((r) => r.lane),
    [...Array(17).fill('waiting'), 'holding', 'holding', 'holding'],
    'page 2 is not the tail of waiting followed by holding',
  );
});

test('an out-of-range page clamps to the last page', () => {
  const v = rosterView(lanes, { lane: undefined, q: undefined, page: '9999', decorate: (r) => r });
  assert.equal(v.paged.page, 50);
  assert.equal(v.paged.items.length, 20);
  assert.ok(v.paged.items.every((r) => r.lane === 'finished'));
});

test('search filters by name BEFORE paging', () => {
  const needle = derived[987]!.title; // somewhere deep in the list
  const v = rosterView(lanes, { lane: undefined, q: needle.toUpperCase(), page: '1', decorate: (r) => r });
  assert.equal(v.paged.total, 1);
  assert.equal(v.paged.items[0]!.title, needle);
});

// ── 2 · RENDER IT ─────────────────────────────────────────────────────────

async function renderPage(raw: string, lane?: string) {
  (globalThis as { React?: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersRoster } = await import('./_components/customers-roster');
  const v = rosterView(lanes, {
    lane,
    q: undefined,
    page: raw,
    decorate: (r) => ({ ...r, note: null }),
  });
  return renderToStaticMarkup(
    React.createElement(CustomersRoster, {
      rows: v.paged.items,
      paged: v.paged,
      query: '',
      incomplete: false,
      pagerKeepParams: lane ? `lane=${lane}` : '',
      searchKeepParams: '',
      activeLane: v.activeLane,
      counts: v.laneCounts,
      nowMs: Date.UTC(2026, 8, 20),
      keepParams: '',
      holdingPerDate: new Map(),
    }),
  );
}

test('the render draws 20 rows, whole-list chip counts, and "41–60 of 1,000"', async () => {
  const html = await renderPage('3');
  const rows = (html.match(/<li\b/g) ?? []).length;
  assert.equal(rows, 20, `the roster drew ${rows} rows`);
  assert.match(html, /Everyone <span class="font-mono">1000<\/span>/);
  for (const lane of CUSTOMER_LANES) {
    assert.ok(
      html.includes(`<span class="font-mono">${MIX[lane]}</span>`),
      `the ${lane} chip does not show its total ${MIX[lane]}`,
    );
  }
  assert.ok(html.includes('37 waiting on you'), 'the heading is not the whole-list waiting count');
  assert.ok(html.includes('41–60 of 1,000'), 'the pager range is missing');
  assert.ok(html.includes('href="?page=4#customers"'), 'Next does not go to page 4');
  assert.ok(html.includes('href="?page=2#customers"'), 'Prev does not go to page 2');
});

test('the pager keeps the lane chip; page 1 drops the param', async () => {
  const html = await renderPage('2', 'talking');
  assert.ok(html.includes('href="?lane=talking#customers"'), 'Prev to page 1 lost the lane');
  assert.ok(html.includes('href="?lane=talking&amp;page=3#customers"'), 'Next lost the lane');
  assert.ok(html.includes('21–40 of 500'));
});

// ── 3 · SOURCE GUARDS ─────────────────────────────────────────────────────

const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const pageSrc = read('customers/page.tsx');
const rosterSrc = read('customers/_components/customers-roster.tsx');

test('anti-vacuity: the stripped sources still hold their code', () => {
  assert.ok(pageSrc.includes('CustomersPipeline') && pageSrc.length > 5_000);
  assert.ok(rosterSrc.includes('export function CustomersRoster') && rosterSrc.length > 2_000);
});

test('the page hands the roster the SLICE and the WHOLE-LIST counts', () => {
  assert.match(pageSrc, /const lanes = groupByLane\(derived\)/, 'lanes are not grouped from every customer');
  assert.match(pageSrc, /rosterView\(lanes,/, 'the page no longer composes the roster through rosterView');
  assert.match(pageSrc, /const laneCounts = roster\.laneCounts/, 'the chip counts do not come from rosterView');
  assert.match(pageSrc, /const rosterPage = roster\.paged/, 'the page is not rosterView’s page');
  assert.match(pageSrc, /rows=\{rosterPage\.items\}/, 'the roster is not rendered from the page slice');
  assert.match(pageSrc, /counts=\{laneCounts\}/, 'the chips are not handed the whole-list counts');
  assert.match(pageSrc, /page:\s*search\.page/, 'the ?page= param no longer reaches the roster');
  assert.match(pageSrc, /q:\s*search\.q/, 'the ?q= search no longer reaches the roster');
});

test('the roster maps its rows once and mounts the shared pager on ?page=', () => {
  assert.equal((rosterSrc.match(/\brows\.map\(/g) ?? []).length, 1, 'the roster renders its rows in a second place');
  assert.equal((rosterSrc.match(/<ListPager\b/g) ?? []).length, 1, 'the roster pager is missing');
  assert.match(rosterSrc, /param="page"/);
  assert.match(rosterSrc, /name="q"/, 'the name search box is gone');
});

/**
 * Every long supplier list on the hub, the one shared pager it must mount, and
 * the variable it must render — the SLICE, never the whole list.
 */
const LISTS: { file: string; pagers: number; renders: RegExp[]; mustNot: RegExp[] }[] = [
  { file: 'customers/_components/customers-roster.tsx', pagers: 1, renders: [/\brows\.map\(/], mustNot: [] },
  {
    file: 'bookings/surface.tsx',
    pagers: 1,
    renders: [/\bpageRows\.map\(/, /const bookingsPage = paginate\(visible,/],
    mustNot: [/\bvisible\.map\(/],
  },
  {
    file: 'messages/surface.tsx',
    pagers: 2,
    renders: [/const activeThreads = activePage\.items/, /const archivedThreads = archivedPage\.items/],
    mustNot: [/\bthreads\.map\(renderRow\)/],
  },
  {
    file: 'clients/surface.tsx',
    pagers: 3,
    renders: [/\bbookedPage\.items\.map\(/, /\bacceptedPage\.items\.map\(/, /const externals = externalsPage\.items/],
    mustNot: [/\[\.\.\.bookedByEvent\.entries\(\)\]\.map\(/, /\baccepted\.map\(/],
  },
  {
    file: 'proposals/surface.tsx',
    pagers: 1,
    renders: [/\.range\(proposalWindow\.start, proposalWindow\.end\)/],
    mustNot: [/\.limit\(50\)/],
  },
];

test('every long supplier list mounts the shared pager and renders only its page', () => {
  for (const l of LISTS) {
    const src = read(l.file);
    const mounts = (src.match(/<ListPager\b/g) ?? []).length;
    assert.equal(mounts, l.pagers, `${l.file}: ${mounts} pagers, expected ${l.pagers}`);
    for (const r of l.renders) assert.match(src, r, `${l.file} no longer renders the page slice (${r})`);
    for (const r of l.mustNot) assert.doesNotMatch(src, r, `${l.file} renders the WHOLE list again (${r})`);
  }
});

test('no two lists on the hub page through the same param', () => {
  const params: string[] = [];
  for (const l of LISTS) {
    for (const m of read(l.file).matchAll(/<ListPager\b[\s\S]*?param="([a-z]+)"/g)) params.push(m[1]!);
  }
  assert.equal(params.length, 8, `found ${params.length} pager params: ${params.join(',')}`);
  assert.equal(new Set(params).size, params.length, `two lists share a page param: ${params.join(',')}`);
});
