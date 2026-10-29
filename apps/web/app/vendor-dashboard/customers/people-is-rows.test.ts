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

test('1 · rows are hairlines that OPEN — the shared fold head, its terracotta ▾, no tile, no box (v13 · look call 8)', async () => {
  // 🔁 v13 (owner "Approved.", 2026-10-29: "One row per event; opened = the fixed lines + For your service"): a row is
  // no longer a door to the chat — it is the shared `SupplierOpenRow` (the `Fold`), opening in place on a phone and in
  // the right column from 701. Still a hairline row, still no box.
  const html = await render(FIXTURE);
  const rows = html.match(/<div [^>]*data-customer-row="[a-z]+"[^>]*>/g) ?? [];
  assert.equal(rows.length, 3, `expected 3 rows, found ${rows.length}`);
  for (const r of rows) {
    assert.match(r, /border-t border-ink\/10/, `a row is not a hairline: ${r}`);
    assert.doesNotMatch(r, /rounded|sn-tile|shadow|bg-white|border-ink\/1[5-9]|(?:^|[\s"])border(?:[\s"]|$)|border-[blrxy]\b/, `a row is drawn as a box: ${r}`);
  }
  assert.doesNotMatch(html, /sn-tile/, 'the list sits in a tile again');
  assert.equal((html.match(/data-fold-head=""/g) ?? []).length, 3, 'a row is not the shared fold head');
  // The ▾: one per row, the accent, never grey.
  const arrows = html.match(/<svg[^>]*lucide-chevron-down[^>]*>/g) ?? [];
  assert.equal(arrows.length, 3, 'a row lost its ▾');
  for (const a of arrows) assert.match(a, /text-sn-accent/, `a row ▾ is not terracotta: ${a}`);
});

test('1b · the stage is the shared Badge — soft fill, no border (look call 7)', async () => {
  const html = await render(FIXTURE);
  const badges = html.match(/<span data-badge="[a-z]+"[^>]*>[^<]*<\/span>/g) ?? [];
  // v13: each row draws its stage once, at the right of its head (the fold's `aside` — hidden while the head pins slim).
  assert.equal(badges.length, 3, `expected 3 rows × 1 badge, found ${badges.length}`);
  for (const b of badges) assert.doesNotMatch(b, /border/, `a stage badge has a border: ${b}`);
  assert.match(html, />Asked</);
  assert.match(html, />Quoted</, 'a talking row with a quote out does not say Quoted');
  assert.match(html, />Booked</);
  assert.doesNotMatch(ROSTER, /border:\s*`1px solid/, 'the roster hand-draws a bordered pill again');
});

test('1c · the row opens; its door says its next step and goes where the step is taken', async () => {
  const html = await render(FIXTURE);
  assert.doesNotMatch(html, /data-row-next/, 'the next-step pill is back inside the row');
  // Opened, each row's ONE door names its next step (its accessible name) — the chat, where a booking ask is answered.
  // 2026-10-28 · a row is the EVENT — "<first name>'s <Kind> (<Mon D>)" (lib/event-chat-title.ts), the customer under it.
  assert.match(html, /aria-label="Ana(&#x27;|')s [A-Za-z]+ \([^)]*\) — Reply"/);
  assert.match(html, /aria-label="Katrina(&#x27;|')s [A-Za-z]+ \([^)]*\) — See the quote"/);
  assert.match(html, /aria-label="Jun(&#x27;|')s Wedding \(Oct 4\) — See the day"/);
  // No button nested in a head: the head is one button, the door lives in the opened body.
  for (const head of html.match(/<button[^>]*data-fold-head=""[\s\S]*?<\/button>/g) ?? []) {
    assert.doesNotMatch(head.slice(1), /<button\b|<a\b/, 'a control is nested inside a row head');
  }
});

test('1d · the doors filter in place — no Filter ▾ eyebrow, no Show ▾, no ⋯, no in-list search form', async () => {
  // 2026-10-28: Asking · Talking · Booked · Done are the pinned row's doors (`customers-pin.tsx`); the roster draws
  // no "Waiting first · Filter ▾" eyebrow unless a caller hands it a Filter — and the Customers page hands none.
  const html = await render(FIXTURE);
  assert.doesNotMatch(html, /data-customers-eyebrow/, 'the roster still draws the Filter eyebrow with no Filter');
  assert.doesNotMatch(PAGE, /<CustomersPick\b|filter=\{/, 'the page hands the roster a Filter ▾ again — the doors filter in place');
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
  // The ONE row (owner 2026-10-22): "Search customers" in the field seat, ＋ Add the main verb's round — no band.
  const at = PAGE.indexOf('<SupplierThumbRow\n        name="people"');
  const thumb = PAGE.slice(at, PAGE.indexOf('\n      />', PAGE.indexOf('action={{', at)));
  assert.ok(at > -1 && thumb.length > 50, 'People has no thumb row');
  assert.match(thumb, /field=\{\{\s*node: \(\s*<SearchBox\b[\s\S]*placeholder="Search customers"/, 'the thumb row lost the search box');
  assert.match(thumb, /action=\{\{\s*node: \(\s*<OutsideClientAdd\b/, 'the thumb row lost Add');
  assert.ok(thumb.indexOf('<SearchBox') < thumb.indexOf('<OutsideClientAdd'), 'Add comes before the search box');
  assert.match(ADD, /<ActionButton tone="brand" main icon=\{Plus\} label=\{label\}/, 'Add is not the brand main button');
  assert.match(ADD, /label = 'Add',/, 'People’s Add lost its word');
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
  // S-PR3: Dates has no accordion fold — its tools are its own folds (Block days · Waitlist · Capacity).
  // S-PR4: the Bookings queue is a fold under Money (it alone carries "Add to prep schedule").
  // 2026-10-28: Messages is no longer a fold — the event list IS the messages (people-chats-not-a-fold.test.ts).
  assert.deepEqual([...all].sort(), ['bookings', 'contracts', 'proposals']);
  assert.match(PAGE, /const sections = CUSTOMER_SECTIONS\.filter\(\(s\) => folds\.includes\(s\.key\)\)/, 'a fold is drawn outside its segment');
  // The ids the landings name are drawn only under their segment.
  // S-PR4: Money is the last branch of the segment switch (its rows wear `#payday`); `#bookings` is drawn only on Money.
  assert.match(PAGE, /<CustomersDates search=\{search\} \/>[\s\S]{0,120}\) : \(\s*<div id="payday"[^>]*>\s*<CustomersMoney /, 'Payday is not Money’s');
  assert.match(PAGE, /\{seg === 'money' \? <span id="bookings"/, 'Bookings is not Money’s');
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
  assert.match(hub, /seg === 'dates' \? \([\s\S]{0,240}<CustomersDay\b[\s\S]{0,120}<CustomersDates\b/, 'Dates (the month, or one day) is not drawn only on Dates');
});

test('3c · one pinned row on every view: People draws it with the four counts; Dates and Money with the view ▾ and ⚙ only', () => {
  const people = body(PAGE, 'CustomersPipeline');
  assert.match(people, /<CustomersPin\s+seg="people"[\s\S]{0,120}doors=\{doors\}[\s\S]{0,40}panels=\{panels\}/, 'People does not draw the counts row');
  const hub = body(PAGE, 'VendorCustomersHub');
  assert.match(
    hub,
    /\{seg === 'people' \|\| \(seg === 'dates' && search\.day\) \? null : \(\s*<CustomersPin\s+seg=\{seg\}\s+hrefs=\{CUSTOMER_SEGMENT_HREFS\}\s+gear=/,
    'Dates / Money lost their pinned row (or draw counts they never read)',
  );
});

test('3d · the view is ONE dropdown (People ▾ · Dates · Money), 44 px — never a pill row', async () => {
  const PIN = code('_components', 'customers-pin.tsx');
  assert.match(PIN, /<PickMenu\b[\s\S]{0,200}options=\{CUSTOMER_SEGMENTS\.map/, 'the views are not one PickMenu');
  assert.doesNotMatch(PIN, /<PillTrack\b|<PillLink\b/, 'the views are a pill row again');
  assert.match(PIN, /min-h-11/, 'a door is under 44 px');
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
  // 2026-10-28: the row's badge is their one-time code's state (Linked / Code sent / Not linked); "booked outside" is
  // said in the row's line, and "Outside" is the badge only when the codes could not be read.
  assert.match(MORE, /<Badge tone=\{badge\.tone\} data="customer-stage">\{badge\.word\}<\/Badge>/, 'an outside client lost its stage badge');
  assert.match(MORE, /· booked outside`/, 'an outside client is not said to be booked outside');
  assert.match(MORE, /<ListPager paged=\{paged\} param="copage"/, 'the outside clients are not paged');
});

test('1f · the title owns the width — two lines before it cuts at every width, WHO first on the line under it', async () => {
  // Controller review 2026-10-29 (owner: "maximize the screen"; house rule "names never cut"). v13: the head is the
  // shared fold's, its title wraps to two lines (`wrap`), and the stage is the head's one badge at the right.
  const html = await render([FIXTURE[2]!]);
  const head = /<button[^>]*data-fold-head=""[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
  assert.ok(head, 'the row head is gone');
  assert.match(head, /<span class="line-clamp-2 block leading-snug">/, 'the row title cuts on one line');
  assert.match(head, /data-fold-sub="">Jun &amp; Liza Cruz/, 'the line under the title does not start with the couple');
});
