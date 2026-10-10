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
  const { peopleRowView, NO_FACTS } = await import('./people-row');
  // RE-AIMED 2026-10-10 (S-PR2): a row carried a `note` and the roster worded it; a row now carries its `view`
  // (pill · one line · where it goes), worded by `peopleRowView` on the page's one clock — the same two-step the
  // page does (pick the page of rows, THEN word only those twenty).
  const v = rosterView(lanes, { lane, q: undefined, page: raw, decorate: (r) => r });
  const rows = v.paged.items.map((r) => ({
    ...r,
    outside: null,
    eventType: null,
    askedAbout: [],
    view: peopleRowView(r, NO_FACTS, Date.UTC(2026, 8, 20)),
  }));
  const html = renderToStaticMarkup(
    React.createElement(CustomersRoster, {
      rows,
      paged: { ...v.paged, items: rows },
      query: '',
      incomplete: false,
      pagerKeepParams: lane ? `lane=${lane}` : '',
      clearSearchHref: '?#customers',
      counts: v.laneCounts,
      holdingPerDate: new Map(),
    }),
  );
  return { html, counts: v.laneCounts };
}

test('the render draws 20 rows, the whole-list counts line, and "41–60 of 1,000"', async () => {
  const { html, counts } = await renderPage('3');
  const rows = (html.match(/<li\b/g) ?? []).length;
  assert.equal(rows, 20, `the roster drew ${rows} rows`);
  /*
    RE-AIMED 2026-10-10 (S-PR2). The roster used to print a counts LINE under the search box ("37 waiting on you
    · 63 holding · …") and this asserted its text. The line is gone with the redraw (plan § 2 "Customers": the
    waiting count is on the People segment; every lane's count is in Filter ▾). The promise is the same — the
    counts are of EVERYONE, never of the page on screen — so it is held on the numbers themselves, and on the two
    places the page prints them.
  */
  assert.deepEqual(
    counts,
    { waiting: 37, holding: 63, talking: 500, booked: 300, finished: 100 },
    'the lane counts are not the whole-list count of every lane',
  );
  assert.match(pageSrc, /<CustomersSegments active=\{seg\} waiting=\{laneCounts\.waiting\} \/>/, 'the People segment is not handed the whole-list waiting count');
  assert.match(pageSrc, /label: `\$\{LANE_FILTER_LABEL\[l\]\} · \$\{formatCount\(laneCounts\[l\]\)\}`,/, 'Filter ▾ no longer carries every lane’s whole-list count');
  {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { CustomersSegments } = await import('./_components/customers-segments');
    const seg = renderToStaticMarkup(React.createElement(CustomersSegments, { active: 'people', waiting: counts.waiting }));
    assert.match(seg, /People<span[^>]*data-customers-waiting=""[^>]*>37<\/span>/, 'the People segment does not say how many are waiting');
    assert.match(seg, /href="\/vendor-dashboard\/customers\?seg=dates"[\s\S]*href="\/vendor-dashboard\/customers\?seg=money"/);
  }
  assert.ok(html.includes('41–60 of 1,000'), 'the pager range is missing');
  assert.ok(html.includes('href="?page=4#customers"'), 'Next does not go to page 4');
  assert.ok(html.includes('href="?page=2#customers"'), 'Prev does not go to page 2');
  // (Was: "every row carries its one next-step button" — the per-row dark pill, `data-row-next`. The redraw's row
  //  IS the tap, and what it says is its stage pill. So: every row is one row, with one pill.)
  assert.equal((html.match(/data-people-row="/g) ?? []).length, 20, 'a row is missing');
  assert.equal((html.match(/data-today-pill="/g) ?? []).length, 20, 'a row lost its stage pill');
});

test('the pager keeps the Filter lane; page 1 drops the param', async () => {
  const { html } = await renderPage('2', 'talking');
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
  // RE-AIMED 2026-10-10 (S-PR2): the search box left the roster for the frosted thumb row (the tools live in the
  // lower third). It is still the SAME `?q=` the server filters by, and still drops `page` so a search starts
  // on its first page — held on the thumb row, and on the page that mounts it with the query it read.
  const thumb = read('customers/_components/people-thumb.tsx');
  assert.match(thumb, /type="search"/, 'the name search box is gone');
  assert.match(thumb, /if \(next\) q\.set\('q', next\);\s*else q\.delete\('q'\);\s*q\.delete\('page'\);/, 'the search no longer writes ?q= and resets the page');
  assert.match(pageSrc, /<PeopleThumb\s+query=\{search\.q \?\? ''\}/, 'the thumb row is not mounted with the query the server read');
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
  // (`clients/surface.tsx` — three pagers: Booked · In conversation · Outside — stood here. Retired 2026-10-10,
  //  supplier redesign S-PR2: those three lists are Customers › People's ONE list on its one pager, the first
  //  entry above. Outside clients are pushed into the same `lanes` before `rosterView` pages them — held below.)
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

test('an outside client is paged by the SAME pager — pushed into the lanes before the page is cut', () => {
  // S-PR2: the outside clients no longer have a list (and a pager) of their own. They must join `lanes` BEFORE
  // `rosterView(lanes, …)` slices a page, or a shop with thirty of them would get them all on every page.
  const push = pageSrc.indexOf('lanes[lane].push(');
  const cut = pageSrc.indexOf('rosterView(lanes,');
  assert.ok(push > 0 && cut > push, 'outside clients are added after the page is cut (or not at all)');
  assert.match(pageSrc.slice(push - 600, push), /if \(k\.source !== 'external_client'\) continue;/);
});

test('no two lists on the hub page through the same param', () => {
  const params: string[] = [];
  for (const l of LISTS) {
    for (const m of read(l.file).matchAll(/<ListPager\b[\s\S]*?param="([a-z]+)"/g)) params.push(m[1]!);
  }
  // 8 → 5 on 2026-10-10: the retired Clients list's three (`cbpage` · `cipage` · `copage`) left with it.
  assert.equal(params.length, 5, `found ${params.length} pager params: ${params.join(',')}`);
  assert.equal(new Set(params).size, params.length, `two lists share a page param: ${params.join(',')}`);
});
