/**
 * people-is-rows.test.ts — Customers › People in the approved look, and Customers as three segments (S-PR2).
 *
 * Record: corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3 + § 6 S-PR2 · prototype frame 03 ·
 * DECISION_LOG 2026-10-12 "APPROVE ALL" look calls 3 (44 px), 7 (status chips: no border), 8 (lists = hairline rows +
 * terracotta arrow) · control templates round 2, kind 30 (search box in the thumb row ≥ 60 %).
 *
 * Each claim is held where a sabotage of it shows: the roster is RENDERED (react-dom/server, no session) for the look,
 * and the page source is read (comments stripped — `lib/strip-comments.ts`) for what only the page decides.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets `"jsx": "preserve"`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import type { RosterRow } from './_components/customers-roster';
import { CUSTOMER_SEGMENTS, customersSegmentOf, foldsOf } from './segments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (...rel: string[]) => stripComments(readFileSync(join(HERE, ...rel), 'utf8'));
const PAGE = code('page.tsx');
const ROSTER = code('_components', 'customers-roster.tsx');
const MORE = code('_components', 'people-more.tsx');
const ADD = code('_components', 'outside-client-add.tsx');
const BOX = code('..', '..', '_components', 'search-box.tsx');

/** One People function's body — from its name to the next top-level function. */
function body(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at > 0, `${name} is gone — the scan is blind`);
  const next = src.indexOf('\nfunction ', at + 10);
  const nextAsync = src.indexOf('\nasync function ', at + 10);
  const ends = [next, nextAsync, src.indexOf('\nexport default', at + 10)].filter((n) => n > 0);
  return src.slice(at, Math.min(...ends));
}

const NOW = Date.UTC(2026, 9, 2, 2);
const row = (over: Partial<RosterRow>): RosterRow => ({
  eventId: 'e1',
  lane: 'booked' as const,
  waitingKind: null,
  waitingSince: null,
  expiresAt: null,
  quietDays: null,
  title: 'Jun & Liza Cruz',
  identityRevealed: true,
  eventDate: '2026-10-04',
  place: 'Makati',
  threadId: 't1',
  eventVendorId: 'ev1',
  note: { text: 'Balance due', tone: 'quiet' as const },
  kind: 'Wedding',
  quoted: false,
  returning: false,
  ...over,
});

async function render(rows: RosterRow[], extra: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersRoster } = await import('./_components/customers-roster');
  return renderToStaticMarkup(
    React.createElement(CustomersRoster, {
      rows,
      paged: { items: rows, page: 1, pageCount: 1, total: rows.length, start: 1, end: rows.length } as never,
      query: '',
      incomplete: false,
      pagerKeepParams: '',
      counts: { waiting: 1, holding: 0, talking: 1, booked: rows.length - 2, finished: 0 },
      nowMs: NOW,
      holdingPerDate: new Map(),
      ...extra,
    } as never),
  );
}

const FIXTURE = [
  row({ eventId: 'a', lane: 'waiting', waitingKind: 'inquiry', waitingSince: new Date(NOW - 2 * 3_600_000).toISOString(), title: 'Ana & Miguel', note: null }),
  row({ eventId: 'k', lane: 'talking', title: 'Katrina Ocampo', quoted: true, note: null }),
  row({ eventId: 'j' }),
];

// ── 1 · THE LOOK ──────────────────────────────────────────────────────────

test('1 · rows are hairlines with a terracotta arrow — no tile, no box around a row (look call 8)', async () => {
  const html = await render(FIXTURE);
  const rows = html.match(/<a [^>]*data-customer-row="[a-z]+"[^>]*>/g) ?? [];
  assert.equal(rows.length, 3, `expected 3 row doors, found ${rows.length}`);
  for (const r of rows) {
    assert.match(r, /border-t border-ink\/10/, `a row is not a hairline: ${r}`);
    assert.doesNotMatch(r, /rounded|sn-tile|shadow|bg-white|border-ink\/1[5-9]|(?:^|[\s"])border(?:[\s"]|$)|border-[blrxy]\b/, `a row is drawn as a box: ${r}`);
  }
  assert.doesNotMatch(html, /sn-tile/, 'the list sits in a tile again');
  // The arrow: one per row door, the accent, never grey.
  const arrows = html.match(/<svg[^>]*lucide-chevron-right[^>]*>/g) ?? [];
  assert.equal(arrows.length, 3, 'a row lost its arrow');
  for (const a of arrows) assert.match(a, /text-sn-accent/, `a row arrow is not terracotta: ${a}`);
});

test('1b · the stage is the shared Badge — soft fill, no border (look call 7)', async () => {
  const html = await render(FIXTURE);
  const badges = html.match(/<span data-badge="[a-z]+"[^>]*>[^<]*<\/span>/g) ?? [];
  assert.equal(badges.length, 3, `expected 3 badges, found ${badges.length}`);
  for (const b of badges) assert.doesNotMatch(b, /border/, `a stage badge has a border: ${b}`);
  assert.match(html, />Asked</);
  assert.match(html, />Quoted</, 'a talking row with a quote out does not say Quoted');
  assert.match(html, />Booked</);
  assert.doesNotMatch(ROSTER, /border:\s*`1px solid/, 'the roster hand-draws a bordered pill again');
});

test('1c · the row is the one tap: no button inside it, and it names its next step', async () => {
  const html = await render(FIXTURE);
  assert.doesNotMatch(html, /<button\b/, 'a button is drawn inside the roster rows');
  assert.doesNotMatch(html, /data-row-next/, 'the next-step pill is back inside the row');
  assert.match(html, /aria-label="Ana &amp; Miguel — Reply"/);
  assert.match(html, /aria-label="Katrina Ocampo — See the quote"/);
  assert.match(html, /aria-label="Jun &amp; Liza Cruz — See the day"/);
});

test('1d · one dropdown (Filter, in the "Waiting first" eyebrow) — Show ▾, ⋯ and the in-list search form are gone', async () => {
  const html = await render(FIXTURE, { filter: React.createElement('i', { 'data-filter-slot': '' }) });
  const eyebrow = html.slice(html.indexOf('data-customers-eyebrow'), html.indexOf('</div>', html.indexOf('data-customers-eyebrow')));
  assert.match(eyebrow, /Waiting first/);
  assert.match(eyebrow, /data-filter-slot/, 'Filter ▾ is not in the eyebrow');
  assert.doesNotMatch(html, /role="search"|data-customers-more|data-customers-show/, 'a second control is back in the roster');
  assert.doesNotMatch(ROSTER, /\bshowPick\b|ROSTER_SHOW|MoreHorizontal/, 'Show ▾ or the ⋯ menu is back in the roster');
  assert.doesNotMatch(PAGE, /ROSTER_SHOW|label="Show"/, 'the page hands the roster a Show ▾ again');
});

test('1e · a search marks the matching letters and says how many it found of everyone (kind 30)', async () => {
  const html = await render([FIXTURE[0]!], { query: 'ana', otherMatches: 0, otherTotal: 2, counts: { waiting: 1, holding: 0, talking: 1, booked: 1, finished: 0 } });
  assert.match(html, /<mark data-search-hit="" class="[^"]*text-sn-accent[^"]*">Ana<\/mark>/, 'the matching letters are not terracotta');
  assert.match(html, /1 of 5 customers/, 'the found line does not count against everyone (3 Setnayan + 2 outside)');
});

// ── 2 · THE THUMB ROW ─────────────────────────────────────────────────────

test('2 · People’s thumb row = the shared Search box (≥ 60 %) + Add (brand) — and nothing searches inside the list', () => {
  const thumb = PAGE.slice(PAGE.indexOf('<SupplierThumbRow name="people"'), PAGE.indexOf('</SupplierThumbRow>'));
  assert.ok(thumb.length > 50, 'People has no thumb row');
  assert.match(thumb, /<SearchBox\b[\s\S]*placeholder="Search a customer"/, 'the thumb row lost the search box');
  assert.match(thumb, /<OutsideClientAdd\b/, 'the thumb row lost Add');
  assert.match(thumb, /^<SupplierThumbRow name="people" label="Customer tools">\s*<SearchBox\b/, 'the search box is not the row’s first control (≥ 60 %, Add beside it)');
  assert.ok(thumb.indexOf('<SearchBox') < thumb.indexOf('<OutsideClientAdd'), 'Add comes before the search box');
  assert.match(ADD, /<ActionButton tone="brand" main icon=\{Plus\} label="Add"/, 'Add is not the brand main button');
  // The box is ONE shared piece: a field in the thumb row (rule 3b keeps it ≥ 60 %), a GET form with no script.
  assert.match(BOX, /role="search"[\s\S]{0,40}method="get"/, 'the search box stopped working without script');
  assert.match(BOX, /data-fit-field=""/, 'the search box is not the thumb row’s field — rule 3b would not keep it ≥ 60 %');
  assert.match(BOX, /\{value \? \(\s*<button[\s\S]{0,80}aria-label="Clear the search"/, 'the ✕ does not come with the first letter');
});

// ── 3 · THE SEGMENTS ──────────────────────────────────────────────────────

test('3 · three segments, one address each; every old landing opens the segment that draws it', () => {
  assert.deepEqual([...CUSTOMER_SEGMENTS], ['people', 'dates', 'money']);
  const cases: Array<[Record<string, string>, string]> = [
    [{}, 'people'],
    [{ seg: 'dates' }, 'dates'],
    [{ seg: 'nonsense' }, 'people'],
    [{ tab: 'calendar' }, 'dates'],
    [{ tab: 'clients' }, 'people'],
    [{ tab: 'messages' }, 'people'],
    [{ tab: 'bookings' }, 'money'],
    [{ tab: 'payday' }, 'money'],
    [{ tab: 'proposals' }, 'money'],
    [{ tab: 'contracts' }, 'money'],
    [{ open: 'availability' }, 'dates'],
    [{ open: 'messages' }, 'people'],
    [{ open: 'clients' }, 'people'],
    [{ seg: 'money', open: 'messages' }, 'money'],
  ];
  for (const [sp, want] of cases) assert.equal(customersSegmentOf(sp), want, `${JSON.stringify(sp)} opens ${customersSegmentOf(sp)}`);
  // Each fold sits under exactly one segment, and every fold the hub draws has one.
  const all = CUSTOMER_SEGMENTS.flatMap((s) => foldsOf(s));
  assert.deepEqual([...all].sort(), ['availability', 'contracts', 'messages', 'proposals']);
  assert.match(PAGE, /const sections = CUSTOMER_SECTIONS\.filter\(\(s\) => folds\.includes\(s\.key\)\)/, 'a fold is drawn outside its segment');
  // The ids the landings name are drawn only under their segment.
  assert.match(PAGE, /seg === 'money' \? \([\s\S]{0,200}id="bookings"[\s\S]{0,200}id="payday"/, 'Bookings / Payday are not Money’s');
});

test('3b · each segment reads only what it draws (owner: "the fewest requests")', () => {
  const people = body(PAGE, 'CustomersPipeline');
  const dates = body(PAGE, 'CustomersDates');
  for (const r of ['fetchVendorDayStates', 'fetchVendorWaitlist', 'fetchVendorServices', 'fetchVendorTeam', 'VendorQrSection']) {
    assert.ok(!people.includes(`${r}(`) && !people.includes(`<${r}`), `People reads ${r} — the month's data, drawn by Dates`);
  }
  for (const r of ['customerLaneOf', 'readVendorPaydayInstallments', "from('vendor_client_notes')"]) {
    assert.ok(!dates.includes(r), `Dates reads ${r} — the roster's data, drawn by People`);
  }
  const hub = body(PAGE, 'VendorCustomersHub');
  assert.match(hub, /seg === 'people' \? \([\s\S]{0,120}<CustomersPipeline\b/, 'People is not drawn only on People');
  assert.match(hub, /seg === 'dates' \? \(\s*<CustomersDates\b/, 'Dates is not drawn only on Dates');
});

test('3c · "People 3" — the count is the waiting count People has just measured, and only People draws a number', () => {
  assert.match(PAGE, /<CustomersSegments seg="people" waiting=\{laneCounts\.waiting\} \/>/);
  assert.match(PAGE, /\{seg === 'people' \? null : <CustomersSegments seg=\{seg\} \/>\}/, 'Dates / Money draw a count they never read');
});

// ── 4 · HONEST MONEY ──────────────────────────────────────────────────────

test('4 · an unread payday says "couldn’t load" on a booked row — never "No plan yet", never a figure', () => {
  const fn = body(PAGE, 'moneyNote');
  const unread = fn.indexOf("if (unread) return { text: 'couldn’t load'");
  assert.ok(unread > 0, 'an unread payday no longer says so on the row');
  assert.ok(unread < fn.indexOf("'No plan yet'"), 'a row can say "No plan yet" before asking whether payday was read');
  assert.match(PAGE, /note: moneyNote\(r, moneyByEvent\.get\(r\.eventId\) \?\? null, paydayIncomplete\)/, 'the rows are not told whether payday was read');
});

// ── 5 · OUTSIDE CLIENTS ───────────────────────────────────────────────────

test('5 · an outside client opens in place and its Remove asks once, posts the shipped action, and comes back to People', () => {
  assert.match(MORE, /<Fold\b[\s\S]{0,400}data="outside-client"/, 'an outside client does not open in place');
  const remove = MORE.slice(MORE.indexOf('<ConfirmForm'), MORE.indexOf('</ConfirmForm>'));
  assert.ok(remove.length > 0, 'Remove no longer asks first');
  assert.match(remove, /action=\{removeBlock\}/);
  assert.match(remove, /name="return_to" value="people"/);
  assert.match(remove, /<SupplierSubmit tone="danger"/, 'Remove is not the delete look');
  assert.match(MORE, /<Badge tone="quiet" data="customer-stage">Outside<\/Badge>/, 'an outside client is not marked Outside');
  assert.match(MORE, /<ListPager paged=\{paged\} param="copage"/, 'the outside clients are not paged');
});
