/**
 * 📌 L5 · COUPLE NUMBERS — EVERY NUMBER FROM ONE READER (walkthrough 27 Nov, C1 · C2 · C4 · C6 · C7 · C8 · C9 · C10).
 *
 * Two halves per reader:
 *   · the RIGHT COUNT on fixture data shaped like the event the walkthrough measured (947e7bab…: 12 booked rows,
 *     photographer + videographer in one category; testnayan4: one contracted band);
 *   · a SOURCE GUARD that every screen showing the number calls the reader — so a second copy cannot grow back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

import { bookedCategoryTally, bookedSupplierCount, isBookedStatus } from './booked-tally';
import { resolveBenchRing, ringBuildCount } from './explore-in-plan';
import { tileForCategory } from './shortlist-taxonomy';
import { BOOKED_EVENT_VENDOR_STATUSES } from './vendor-funnel';
import { buildCounts, buildLineKey, buildLinesOf, buildMoneyOf, buildViewOf, type BuildLineInputVendor } from './suppliers-build';
import { planningCountOf } from './event-board';
import { pickNextPayment, pickDuePayments } from './budget-page-view';
import type { MoneyLine } from './budget-truth';
import { planHeldWithoutOrder } from './event-plans';
import { customerLaneOf } from './vendor-customer-pipeline';
import { askLine } from './booking-ask-words';
import { hubReachOf } from '../app/dashboard/[eventId]/_components/home-control-faces';
import { inPlanningWeddingNames, inPlanningWeddingOf } from '../app/dashboard/(account)/create-event/wedding-guard';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
/** Strip comments (the one stripper), so a guard never passes on a note that merely names the reader. */
const code = (rel: string) => stripComments(read(rel));

/* ── the fixture: event 947e7bab, as read out of prod on 27 Nov (names kept, money illustrative) ── */
const EVENT_947E = [
  { vendor_id: 'hain', status: 'deposit_paid', category: 'catering', name: 'Hain Catering', php: 250_000 },
  { vendor_id: 'habi', status: 'deposit_paid', category: 'photographer', name: 'Habi Photo Co.', php: 120_000 },
  { vendor_id: 'alon', status: 'contracted', category: 'videographer', name: 'Alon Films', php: 95_000 },
  { vendor_id: 'bulaklak', status: 'contracted', category: 'florist', name: 'Bulaklak & Co.', php: 60_000 },
  { vendor_id: 'matamis', status: 'contracted', category: 'cake_maker', name: 'Matamis Bakeshop', php: 15_000 },
  { vendor_id: 'kuya', status: 'contracted', category: 'host_emcee', name: 'Kuya Mike Events', php: 20_000 },
  { vendor_id: 'indak', status: 'contracted', category: 'band_dj', name: 'DJ Indak', php: 35_000 },
  { vendor_id: 'araw', status: 'deposit_paid', category: 'planner_coordinator', name: 'Araw Planners', php: 80_000 },
  { vendor_id: 'buhok', status: 'contracted', category: 'hair_stylist', name: 'Buhok Bridal Hair', php: 25_000 },
  { vendor_id: 'ilaw', status: 'contracted', category: 'lights_and_sound', name: 'Ilaw Productions', php: 50_000 },
  { vendor_id: 'kuha', status: 'contracted', category: 'photobooth', name: 'Kuha Booth', php: 30_000 },
  { vendor_id: 'barkada', status: 'contracted', category: 'mobile_bar', name: 'Barkada Bar', php: 30_000 },
] as const;
const TOTAL_947E = EVENT_947E.reduce((s, r) => s + r.php, 0);

// ── C2 · ONE BOOKED READER ────────────────────────────────────────────────────

test('C2 · booked = BOOKED_EVENT_VENDOR_STATUSES, no other set', () => {
  for (const s of BOOKED_EVENT_VENDOR_STATUSES) assert.equal(isBookedStatus(s), true, s);
  for (const s of ['considering', 'shortlisted', null, undefined, 'paid']) assert.equal(isBookedStatus(s), false, String(s));
});

test('C2 · event 947e: 12 booked suppliers in 11 categories — two facts, each counted once', () => {
  assert.equal(bookedSupplierCount(EVENT_947E), 12, 'Budget lists 12 booked suppliers; the reader must agree');
  assert.deepEqual(bookedCategoryTally(EVENT_947E), { listed: 11, booked: 11 }, 'photo + video are ONE category');
  // A supplier is counted once however many rows name them.
  assert.equal(bookedSupplierCount([...EVENT_947E, { vendor_id: 'habi', status: 'contracted' }]), 12);
});

test('C2/C7 · Home counts the SAME categories Find lists and Build counts (resolveBenchRing listedOnly)', () => {
  const fixtures: Array<{ rows: Array<{ vendor_id: string; status: string; category: string }>; excluded: string[] }> = [
    { rows: [...EVENT_947E], excluded: [] },
    // testnayan4: one contracted band. Home said "0 of 25 booked" while Find listed 1 category.
    { rows: [{ vendor_id: 'saysay', status: 'contracted', category: 'band_dj' }], excluded: [] },
    // A shortlisted florist in a removed category is not listed; a booking always is, removed or not.
    {
      rows: [
        { vendor_id: 'a', status: 'considering', category: 'florist' },
        { vendor_id: 'b', status: 'contracted', category: 'catering' },
        { vendor_id: 'c', status: 'considering', category: 'cake_maker' },
      ],
      excluded: ['florist', 'catering'],
    },
  ];
  for (const f of fixtures) {
    const byTile = new Map<string, { vendorCount: number; lockedCount: number }>();
    for (const r of f.rows) {
      const tile = tileForCategory(r.category as never)!;
      const t = byTile.get(tile) ?? { vendorCount: 0, lockedCount: 0 };
      t.vendorCount += 1;
      if (isBookedStatus(r.status)) t.lockedCount += 1;
      byTile.set(tile, t);
    }
    // Find also draws empty tiles; they never list (no supplier, no booking).
    const tiles = [...byTile.entries(), ['venue', { vendorCount: 0, lockedCount: 0 }] as const].map(([tile, t]) => ({
      tile,
      planned: true,
      vendorCount: t.vendorCount,
      lockedCount: t.lockedCount,
    }));
    const ring = resolveBenchRing({ tiles, excludedTiles: f.excluded, listedOnly: true });
    const tally = bookedCategoryTally(f.rows, f.excluded);
    assert.equal(tally.listed, ring.inPlan.size, `listed categories disagree with Find for ${JSON.stringify(f.rows)}`);
    assert.equal(tally.booked, tiles.filter((t) => ring.inPlan.has(t.tile) && t.lockedCount > 0).length);
    assert.equal(ringBuildCount(tiles, ring.inPlan).total, tally.listed, 'Build N/M counts the same rows');
  }
  assert.deepEqual(bookedCategoryTally([{ vendor_id: 'saysay', status: 'contracted', category: 'band_dj' }]), { listed: 1, booked: 1 });
});

test('C2/C7 · source guard: Home reads the one booked reader, not the plan ladder', () => {
  const home = code('lib/home-control.server.ts');
  assert.match(home, /bookedCategoryTally\(/, 'Home suppliers must count through bookedCategoryTally');
  assert.doesNotMatch(home, /countUnlockedCategories/, 'Home must not count the plan ladder again (the "of 25")');
  assert.match(home, /from\('event_category_decisions'\)[\s\S]{0,120}'excluded'/, "Home must read Find's own removed categories");
  const tally = code('lib/booked-tally.ts');
  assert.match(tally, /BOOKED_EVENT_VENDOR_STATUSES/, 'the booked set comes from vendor-funnel, never a local copy');
  assert.doesNotMatch(tally, /'contracted'|'deposit_paid'/, 'no hand-typed booked statuses in the reader');
});

// ── C1 · THE BUILD LIST KEEPS EVERY BOOKED SUPPLIER ──────────────────────────

const v = (vendorId: string, name: string, status: 'locked' | 'considering', planGroupId = 'photo_video'): BuildLineInputVendor => ({
  vendorId,
  name,
  status,
  planGroupId,
});

test('C1 · two bookings in one category are two lines, and the rows add up to the header', () => {
  const price = new Map<string, number>(EVENT_947E.map((r) => [r.vendor_id, r.php]));
  const tiles = new Map<string, BuildLineInputVendor[]>();
  for (const r of EVENT_947E) {
    const tile = tileForCategory(r.category as never)!;
    tiles.set(tile, [...(tiles.get(tile) ?? []), v(r.vendor_id, r.name, 'locked', tile)]);
  }
  const lines = buildLinesOf({
    tiles: [...tiles.entries()].map(([tile, vendors]) => ({ tile, label: tile, vendors })),
    priceOf: (id) => price.get(id) ?? null,
    inBuild: new Set(),
    blocked: new Map(),
  });
  const booked = lines.filter((l) => l.booked);
  assert.equal(booked.length, 12, 'every booked supplier is a line');
  assert.ok(booked.some((l) => l.booked!.name === 'Alon Films'), 'Alon Films is on the list');
  const rowsSum = booked.reduce((s, l) => s + (l.booked!.pricePhp ?? 0), 0);
  // The header: `buildMoneyOf` over every locked row (centavos), the Build body's own figure.
  const money = buildMoneyOf(
    [{ groupId: 'all', picks: EVENT_947E.map((r) => ({ vendor_id: r.vendor_id, raw_status: r.status, rolled_cost_php: r.php })), buildPickVendorIds: [] }] as never,
    TOTAL_947E * 100,
    null,
  );
  const view = buildViewOf({ lines, money, dateFit: null, dateLabel: null, saved: [], buildsMeasured: true, freeByBuildId: {} });
  assert.equal(rowsSum, view.money.bookedPhp, 'the rows sum to the header (₱810,000 vs ₱715,000 was the defect)');
  // Counted per category: photo + video is one category, both booked.
  assert.deepEqual(buildCounts(lines), { filled: 11, total: 11, toBook: 0 });
  // Keys are unique (React) and the first line in a category keeps the category's own handle.
  const keys = lines.map((l, i) => buildLineKey(l, i, lines));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('photo_video') && keys.includes('photo_video:alon'));
  // Compare draws one row per category, never a duplicate "Photo & Video".
  assert.equal(view.cards[0]!.rows.length, 11);
});

test('C1 · source guard: the Build rows are keyed per line, not per category', () => {
  const body = code('app/dashboard/[eventId]/vendors/_components/build-body.tsx');
  assert.match(body, /key=\{buildLineKey\(line,/);
  assert.match(body, /data-build-line=\{lineKey\}/);
  assert.doesNotMatch(body, /key=\{line\.tile\}/);
});

// ── C6 · "N PLANNING" AND THE HUB'S REACH ────────────────────────────────────

test('C6 · an invitation is not an event you are planning', () => {
  const board = [{ member_type: 'couple' }, { member_type: 'coordinator' }, { member_type: 'guest' }] as const;
  assert.equal(planningCountOf(board as never), 2);
  for (const rel of ['app/(hub)/dashboard/page.tsx', 'lib/home-profile.server.ts']) {
    assert.match(code(rel), /planning: planningCountOf\(/, `${rel} must count "planning" through planningCountOf`);
  }
  assert.doesNotMatch(code('app/(hub)/dashboard/page.tsx'), /planning: live\.length/);
});

test('C6 · the Hub says "live" only when it is Public', () => {
  const url = 'https://setnayan.com/ana-and-ben';
  assert.equal(hubReachOf({ visibility: 'public', publicUrl: url }).unit, 'live');
  assert.equal(hubReachOf({ visibility: 'unlisted', publicUrl: url }).unit, 'unlisted');
  assert.doesNotMatch(hubReachOf({ visibility: 'unlisted', publicUrl: url }).detail, /live/);
  assert.equal(hubReachOf({ visibility: 'private', publicUrl: null }).sm, 'not shared yet');
  assert.notEqual(hubReachOf({ visibility: 'private', publicUrl: null }).unit, 'live');
  const faces = code('app/dashboard/[eventId]/_components/home-control-faces.ts');
  assert.doesNotMatch(faces, /unit: 'live',\s*sm: h\.publicUrl/, 'the tile face reads hubReachOf, not a bare "live"');
  assert.match(code('app/dashboard/[eventId]/_components/home-control-row.tsx'), /hubReachOf\(h\)/);
  assert.doesNotMatch(code('app/dashboard/[eventId]/_components/home-control-row.tsx'), /\} is live<\/b>/);
  assert.match(code('lib/home-control.server.ts'), /visibility,/);
});

// ── C8 · EVERY IN-PLANNING WEDDING IS NAMED ──────────────────────────────────

test('C8 · two weddings in planning: both named, the soonest first', () => {
  const w = inPlanningWeddingOf([
    { event_id: 'b', display_name: 'Cara & Dan', event_date: null },
    { event_id: 'a', display_name: 'Ana & Ben', event_date: '2027-02-14' },
  ])!;
  assert.equal(w.eventId, 'a');
  assert.equal(inPlanningWeddingNames(w), 'Ana & Ben and Cara & Dan');
  assert.equal(inPlanningWeddingNames(inPlanningWeddingOf([{ event_id: 'a', display_name: 'Ana & Ben', event_date: null }])!), 'Ana & Ben');
  assert.equal(inPlanningWeddingOf([]), null);
});

// ── C9 · OVERDUE READS AS OVERDUE ────────────────────────────────────────────

const line = (over: Partial<MoneyLine>): MoneyLine =>
  ({ kind: 'committed', stillOwedPhp: 10_000, dueDate: '2026-09-15', vendorName: 'Seda', label: 'Balance', vendorId: 'sv', source: 'line_item', sourceRef: 'x', dueState: 'upcoming', ...over }) as MoneyLine;

test('C9 · a payment 73 days past due is "overdue", never a plain "Next"', () => {
  assert.equal(pickNextPayment([line({ dueState: 'overdue', daysUntilDue: -73 } as never)])!.overdue, true);
  assert.equal(pickNextPayment([line({ dueState: 'upcoming' })])!.overdue, false);
  assert.equal(pickDuePayments([line({ dueState: 'overdue' })])[0]!.overdue, true);
  const summary = code('app/dashboard/[eventId]/budget/_components/budget-summary.tsx');
  assert.match(summary, /overdue: next\.overdue/, 'the Budget summary hands the overdue flag to BudgetFigures');
});

// ── C10 · A PLAN HELD WITH NO ORDER IS LISTED ────────────────────────────────

test('C10 · Event Ultra granted with no order row is listed; a bought one is not listed twice', () => {
  const ultra = { key: 'ultra' as const, name: 'Event Ultra' };
  assert.deepEqual(planHeldWithoutOrder(ultra, []), ultra);
  assert.equal(planHeldWithoutOrder(ultra, [{ service_key: 'EVENT_ULTRA', status: 'paid' }]), null);
  assert.deepEqual(planHeldWithoutOrder(ultra, [{ service_key: 'EVENT_ULTRA', status: 'cancelled' }]), ultra);
  assert.equal(planHeldWithoutOrder({ key: 'free' as const, name: 'Free' }, []), null);
  assert.equal(planHeldWithoutOrder(null, []), null, 'an unread plan is never guessed');
  const page = code('app/dashboard/[eventId]/orders/page.tsx');
  assert.match(page, /Promise\.all\(\[fetchOrdersForEvent\(supabase, eventId\), readEventPlanHeld\(eventId\)\]\)/);
  assert.match(page, /planHeldWithoutOrder\(planHeld, orders\)/);
});

// ── C4 · THE SUPPLIER'S ROW CARRIES THE ENDED ASK ────────────────────────────

test('C4 · an expired booking ask reaches the supplier row in the couple\'s words, turned', () => {
  const row = customerLaneOf(
    {
      eventId: 'e1',
      thread: { threadId: 't1', inquiryStatus: 'accepted', createdAt: '2026-08-01T00:00:00Z', lastActivityAt: '2026-08-01T00:00:00Z' },
      booking: { eventVendorId: 'ev1', status: 'considering', lock_request_state: 'expired', requestedAt: null, expiresAt: null },
      eventName: 'Ana & Marco',
      descriptor: 'A couple',
      eventDate: null,
      place: null,
    },
    true,
    Date.parse('2026-08-20T00:00:00Z'),
  )!;
  assert.deepEqual(row.askEnded, { state: 'expired', line: askLine('expired', 'supplier') });
  const open = customerLaneOf(
    {
      eventId: 'e1',
      thread: null,
      booking: { eventVendorId: 'ev1', status: 'considering', lock_request_state: 'pending', requestedAt: null, expiresAt: null },
      eventName: 'Ana & Marco',
      descriptor: 'A couple',
      eventDate: null,
      place: null,
    },
    true,
  )!;
  assert.equal(open.askEnded, null, 'an open ask has not ended');
});
