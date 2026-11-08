/**
 * 🧾 THE SIMPLER TODAY KEEPS EVERY DOOR (owner APPROVE 2026-10-14 — corpus DECISION_LOG ✅ "THE SIMPLER SUPPLIER
 * DASHBOARD"; prototype `Setnayan/prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, SCREENS.today;
 * checklist `controller-2026-10-12/SUPPLIER_NEEDS_CHECKLIST_2026-10-14.md` § A 9.x / 12.x and § B F2–F14).
 *
 * The redraw could lose a door without anything turning red — so each one is asserted on REAL MARKUP, drawn by the
 * ONE assembly (`assembleSupplierToday`) and the ONE drawing (`SupplierTodayScreen`) the page and the dev lab share:
 *
 *   1 · the Next card keeps LIVE's nine rules — an overdue fee never jumps ahead of a couple's ask
 *   2 · a booking ask is answered ON the card: the fee named ABOVE Agree, Agree posts the shipped form, Turn it down
 *       keeps its reason; the couple's initials; a hall already booked that day and an unapproved shop said before
 *   3 · every Also-waiting kind keeps its answer — Move / Unlock my service, Agree to remove it in the DANGER look /
 *       Keep it for now, I delivered this service, Post reply — and the doors (quote, contract, dispute) go somewhere
 *   4 · every unpaid booking fee has its Pay, the "introduced" line, and the lock said once — for EVERY unsettled
 *       bill while the lock is enforced (D2 X1), only an overdue one while it is not
 *   5 · after Agree with the couple's news held for the fee: the shipped sentence + "Pay the booking fee", under the card
 *   6 · the event day: Run the day · Chat, waiting · next moment · checked in, Also today — and NONE of the day's
 *       numbers while an unpaid fee keeps the day locked
 *   7 · Coming up carries the bookings from outside ("from outside") and, with more than one schedule, its name
 *   8 · the Shop row: Checking · Live · Not yet, "details N of M", and How is business
 *   9 · the setup card is "N of 6"
 *  10 · the read census — the page must not grow (three shop-row reads are one; earnings skipped on an event day)
 *
 * SABOTAGE (each seen red before this shipped — the PR body lists the runs).
 *
 * 🔁 RE-AIMED 2026-11-08 (THE ONE BUILD, v103 + owner v112 *"Jump"*; A2 §3 table): the Next card is retired and every
 * Today row jumps, so each door is asserted WHERE IT LIVES NOW — the booking ask's fee-before-Agree on the client's
 * booking-ask panel; "Pay the booking fee" on the bill row; the event day on today's photo card (its chips) and the
 * Also-today rows; "every kind keeps its answer" becomes "every kind keeps a PAGE". Tests 7 and 8 are unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { UpcomingEventRow, WhatsNewCard } from '@/lib/vendor-overview';
import type { DueFeeBill } from '@/lib/booking-fee-disclosure';
import type { SupplierTodayInput } from '@/lib/supplier-today-view';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&rsquo;/g, '’').replace(/\s+/g, ' ');
const TODAY = '2026-10-14';
const NOW = Date.parse('2026-10-14T02:00:00Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const ahead = (h: number) => new Date(NOW + h * 3_600_000).toISOString();
const noop = async () => {};

const INQUIRY: WhatsNewCard = {
  kind: 'inquiry', id: 'inq-am', threadId: 't-am', title: 'New inquiry — New customer', descriptor: 'Ana & Miguel',
  eventDate: '2026-12-12', place: null, category: null, paxAtInquiry: 150, messageExcerpt: 'Are you free on Dec 12?', createdAt: ago(2),
};
const ASK: WhatsNewCard = {
  kind: 'lock_request', id: 'lockreq-ev-rc', eventId: 'rc', eventVendorId: 'ev-rc', coupleName: 'Rolando & Carmen',
  eventDate: '2026-12-12', requestedAt: ago(20), expiresAt: ahead(28), threadId: 't-rc',
};
const MOVE: WhatsNewCard = {
  kind: 'date_change', id: 'dc', eventId: 'cruz', eventVendorId: 'ev-cruz', coupleName: 'Cruz', fromDate: '2026-10-18',
  fromPrecision: 'day', proposedDate: '2026-10-25', proposedPrecision: 'day', askedAt: ago(30), dueAt: ahead(46),
};
const REMOVE: WhatsNewCard = { kind: 'delete_request', id: 'del', eventId: 'dz', eventVendorId: 'ev-dz', eventDate: '2026-12-12', requestedAt: ago(40), coupleName: 'Dizon debut' };
const DONE: WhatsNewCard = { kind: 'mark_complete', id: 'done', eventVendorId: 'ev-rd', eventId: 'rd', eventName: 'Reyes debut', eventDate: '2026-10-10', createdAt: ago(50) };
const REVIEW: WhatsNewCard = { kind: 'review', id: 'rev', reviewId: 'r1', coupleName: 'Cruz', quote: 'Lovely.', rating: 5, createdAt: ago(60) };
const QUOTE: WhatsNewCard = { kind: 'quote_draft', id: 'q', proposalId: 'p', publicId: null, eventId: 'rc2', title: 'Rolando & Carmen', totalCentavos: 4_500_000, createdAt: ago(70) };
const CONTRACT: WhatsNewCard = { kind: 'contract_draft', id: 'k', contractId: 'k1', eventId: 'lt', title: 'Lim & Tan', createdAt: ago(80) };
const LAPSED: WhatsNewCard = { kind: 'lock_request_lapsed', id: 'lap', eventId: 'dp', eventVendorId: 'ev-dp', coupleName: 'Dela Peña', eventDate: '2026-11-07', requestedAt: ago(200), expiresAt: ago(150) };
const DISPUTE: WhatsNewCard = { kind: 'dispute', id: 'disp', eventId: 'pz', eventName: 'Perez', label: null, createdAt: ago(140), threadHref: '/vendor-dashboard/messages/t-pz' };

const since = (c: WhatsNewCard) =>
  new Date(
    'lastMessageAt' in c ? c.lastMessageAt
    : 'requestedAt' in c ? c.requestedAt
    : 'askedAt' in c ? c.askedAt
    : 'recordedAt' in c ? c.recordedAt
    : 'proposedAt' in c ? c.proposedAt
    : c.createdAt,
  );

const up = (id: string, name: string, date: string, poolId: string, inDays: number): UpcomingEventRow => ({
  id: `up-${id}`, eventId: id, eventName: name, date, place: 'Makati', category: null, inDays,
  href: `/vendor-dashboard/clients/${id}?tab=details`, threadHref: `/vendor-dashboard/messages/t-${id}`, opensCard: true, guests: 150, poolId,
});
const UPCOMING = [up('reyes', 'Reyes debut', '2026-10-17', 'main', 3), up('cruz', 'Cruz wedding', '2026-10-18', 'main', 4)];
const bill = (id: string, name: string, dueOn: string, introducedOn: string | null = '2026-10-12'): DueFeeBill => ({
  orderId: `S89O-${id.toUpperCase().padEnd(10, '0')}`, amountPhp: 4250, eventId: id, coupleName: name, dueOn, introducedOn,
});

type Opt = Partial<SupplierTodayInput> & {
  desk?: WhatsNewCard[];
  forecast?: boolean;
  outcome?: { text: string; tone: 'ok' | 'note' | 'bad'; door?: { label: string; href: string } | null } | null;
};

async function draw(o: Opt = {}): Promise<{ html: string; view: import('@/lib/supplier-today-view').SupplierTodayView }> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const { splitDesk } = await import('@/lib/vendor-desk-disposition');
  const { bookingFeeForecast } = await import('@/lib/booking-fee-disclosure');
  const { BOOKING_FEE } = await import('@/lib/booking-fee');
  const { answer, news } = splitDesk(o.desk ?? []);
  const view = assembleSupplierToday({
    needsAnswer: answer,
    closed: news,
    deskIncomplete: false,
    upcoming: UPCOMING,
    schedules: { pools: [{ id: 'main', name: 'Main team' }], outside: [], complete: true },
    firstSteps: null,
    verified: true,
    findable: true,
    findability: null,
    feeBills: [],
    feeEnforced: true,
    earnings: { confirmedPhp: 0, expectedPhp: 186_000, paydayMeasured: true },
    credit: null,
    payoutReadiness: 'ready',
    payoutHref: '/vendor-dashboard/shop?open=payments#shop-folds',
    shop: { name: 'Lumina Studio', categoryWord: 'Photo & video', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 312,
    inquiries28: 14,
    dayFacts: null,
    todayIso: TODAY,
    now: NOW,
    since,
    ...o,
  });
  const html = renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, { view, outcome: o.outcome ?? null, shopName: 'Lumina Studio', todayIso: TODAY, now: NOW }),
  );
  return { html, view };
}
/** The Needs-you list, as drawn. */
const needsOf = (html: string) => html.slice(html.indexOf('data-today-needs='), html.indexOf('data-today-coming-up'));
/** A Needs-you row's href by its key. */
const hrefOf = (html: string, key: string) => (needsOf(html).match(new RegExp(`<a[^>]*data-today-need="${key}"[^>]*>`))?.[0].match(/href="([^"]+)"/)?.[1] ?? '').replace(/&amp;/g, '&');

/* ═══ 1 · LIVE's NINE RULES — NOW THE ROW ORDER ══════════════════════════ */

// SABOTAGE: move `if (input.fee)` above `if (input.answer)` in pickSupplierNext → RED (the order constant).
test('1 · the order is LIVE’s nine rules — a couple’s ask comes before a fee, and the fee is still on the page', async () => {
  const { SUPPLIER_NEXT_ORDER } = await import('@/lib/supplier-today');
  assert.deepEqual([...SUPPLIER_NEXT_ORDER], ['run_day', 'answer', 'unread', 'setup', 'findable', 'tomorrow', 'fee', 'payday', 'clear']);
  const { html } = await draw({ desk: [INQUIRY], feeBills: [bill('cruz', 'Cruz wedding', '2026-10-10')] });
  const needs = needsOf(html);
  const ask = needs.indexOf('data-today-need="inq-am"');
  const fee = needs.indexOf('data-fee-bill-today=""');
  assert.ok(ask > 0 && fee > ask, 'an overdue fee is drawn ahead of a couple’s ask');
});

/* ═══ 2 · THE ASK — ITS ROW JUMPS TO THE CLIENT, WHERE THE FEE IS NAMED BEFORE AGREE ═══════════════════ */

// SABOTAGE: drop `<BookingFeeNotice disclosure={feeForecast} />` from booking-ask-panel.tsx → RED (no fee above Agree).
test('2 · a booking ask jumps to the client’s Details — and there the fee is named BEFORE Agree, the shipped form, Turn it down', async () => {
  const { html } = await draw({ desk: [ASK] });
  assert.equal(hrefOf(html, 'lockreq-ev-rc'), '/vendor-dashboard/clients/rc?tab=details', 'the ask does not open the client');
  assert.doesNotMatch(needsOf(html), /<form/, 'the ask is answered on Today again');
  const panel = code('app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel.tsx');
  const fee = panel.indexOf('<BookingFeeNotice disclosure={feeForecast} />');
  const agree = panel.indexOf('<form action={agreeLock}>');
  assert.ok(fee > 0 && agree > fee, 'on the client page the fee is not named before Agree — a fee named after the press is a receipt');
  assert.match(panel, /label="Turn it down"/);
});

// SABOTAGE: `if (names.length > 0)` → `if (false)` → RED.
test('2b · before the tap: a hall already booked that day, and an unapproved shop, are said on the ask’s row', async () => {
  const halls = { pools: [{ id: 'A', name: 'Hall A' }, { id: 'B', name: 'Hall B' }, { id: 'C', name: 'Hall C' }], outside: [{ blockId: 'o', date: '2026-12-12', clientName: 'Rotary', poolId: 'C' }], complete: true };
  const row = (h: string) => text(needsOf(h).slice(needsOf(h).indexOf('data-today-need="lockreq-ev-rc"'), needsOf(h).indexOf('</a>', needsOf(h).indexOf('data-today-need="lockreq-ev-rc"'))));
  const { html } = await draw({ desk: [ASK], schedules: halls, askDayHolds: { 'ev-rc': ['A'] } });
  assert.match(row(html), /Hall A and Hall C are booked that day/, `the taken halls are not said: ${row(html)}`);
  assert.match(needsOf(html), /data-badge="no"[^>]*>Taken</);
  const two = { ...halls, pools: halls.pools.map((p) => ({ ...p, cap: 2 })) };
  assert.doesNotMatch(row((await draw({ desk: [ASK], schedules: two, askDayHolds: { 'ev-rc': ['A'] } })).html), /booked that day|full that day/);
  assert.match(row((await draw({ desk: [ASK], schedules: two, askDayHolds: { 'ev-rc': ['A', 'A'] } })).html), /Hall A is full that day/);
  assert.doesNotMatch(row((await draw({ desk: [ASK], askDayHolds: { 'ev-rc': ['main'] } })).html), /booked that day/);
  assert.match(row((await draw({ desk: [ASK], verified: false })).html), /Not verified yet/);
});

/* ═══ 3 · EVERY KIND KEEPS A PAGE ═════════════════════════════════════════ */

test('3 · every kind keeps a page — each row jumps to where its answer is given', async () => {
  const { html } = await draw({ desk: [INQUIRY, MOVE, REMOVE, DONE, REVIEW, QUOTE, CONTRACT, LAPSED, DISPUTE] });
  const want: Record<string, string> = {
    [INQUIRY.id]: '/vendor-dashboard/messages/t-am',
    dc: '/vendor-dashboard/clients/cruz?tab=details',
    del: '/vendor-dashboard/clients/dz?tab=details',
    done: '/vendor-dashboard/clients/rd?tab=details',
    rev: '/vendor-dashboard/website#reply_r1',
    q: '/vendor-dashboard/customers?seg=money&open=proposals#customer-tools',
    k: '/vendor-dashboard/customers?seg=money&open=contracts#customer-tools',
    lap: '/vendor-dashboard/clients/dp?tab=details',
    disp: '/vendor-dashboard/messages/t-pz',
  };
  for (const [key, href] of Object.entries(want)) assert.equal(hrefOf(html, key), href, `${key}: the row goes to ${hrefOf(html, key) || 'nowhere'}`);
  const t = text(needsOf(html));
  assert.match(t, /Cancel request.*Dizon debut/);
  assert.match(t, /Ask lapsed.*Dela Peña/);
  assert.match(needsOf(html), /data-badge="quiet"[^>]*>Lapsed</);
  assert.match(t, /Dispute open.*Setnayan is looking/);
  assert.equal((text(html).match(/Needs you today/g) ?? []).length, 1, 'the closed lines grew a heading of their own');
});

/* ═══ 4 · THE FEE ROWS AND THE LOCK ═══════════════════════════════════════ */

// SABOTAGE: `if (enforced) return feeEnforcementSentence(...)` removed from feeLockLine → RED (a due bill hides the lock).
test('4 · every unpaid fee has its Pay and its introduced line; the lock is said once, for every bill while enforced', async () => {
  const { vendorBookingFeePayPath } = await import('@/lib/vendor-booking-fees');
  const bills = [bill('lt', 'Lim & Tan wedding', '2026-10-20'), bill('cruz', 'Cruz wedding', '2026-10-10', null)];
  const { html } = await draw({ desk: [INQUIRY], feeBills: bills });
  const rows = html.split('data-fee-bill-today=""').slice(1);
  assert.equal(rows.length, 2, 'not every unpaid fee is a row');
  for (const b of bills) assert.ok(html.includes(`href="${vendorBookingFeePayPath(b.orderId)}"`), `${b.coupleName}: no Pay`);
  const t = text(html);
  assert.match(t, /Booking fee · Lim & Tan wedding i Setnayan introduced this couple to you on Oct 12, 2026\. ₱4,250\.00 · due Tue 20 Oct/);
  assert.match(rows[0]!, /role="tooltip"[^>]*>[\s\S]*?data-fee-introduced=""/, 'the introduced line is not in the title’s ⓘ');
  assert.match(t, /Booking fee · Cruz wedding ₱4,250\.00 · overdue since Sat 10 Oct/);
  assert.equal((html.match(/data-fee-lock-line=""/g) ?? []).length, 1);
  assert.match(t, /this event’s details and day-of tools stay locked until the fee is settled/);
  assert.match(html, /data-fee-lock-line=""[^>]*>[\s\S]*?Locked until the fee is paid[\s\S]*?role="tooltip"/, 'the lock sentence is not behind its ⓘ');
  assert.match(text((await draw({ desk: [INQUIRY], feeBills: [bills[0]!] })).html), /stay locked until the fee is settled/);
  assert.doesNotMatch((await draw({ desk: [INQUIRY], feeBills: [bills[0]!], feeEnforced: false })).html, /data-fee-lock-line/);
  assert.match((await draw({ desk: [INQUIRY], feeBills: bills, feeEnforced: false })).html, /data-fee-lock-line/);
  // With nothing else waiting the lone fee is still a row with its Pay (the Next card that showed it is retired).
  const alone = (await draw({ feeBills: [bills[0]!], earnings: null })).html;
  assert.match(alone, new RegExp(`href="${vendorBookingFeePayPath(bills[0]!.orderId).replace(/[?/.]/g, '\\$&')}"`));
});

/* ═══ 5 · AFTER AGREE, THE FEE HELD ═══════════════════════════════════════ */

// SABOTAGE: drop `door: lockAnswer.door ?? null` from the page's outcome → RED (page anchor).
test('5 · after Agree with the news held: the shipped sentence and "Pay the booking fee", right above Needs you today', async () => {
  const { lockAgreeNotice } = await import('@/lib/lock-answer-notice');
  const said = lockAgreeNotice('ok', { feeHeld: true })!;
  assert.equal(said.text, 'You said yes. Pay the booking fee and we’ll tell the couple their booking is confirmed.');
  const { html } = await draw({ desk: [INQUIRY], outcome: { text: said.text, tone: 'ok', door: said.door ?? null } });
  const at = html.indexOf('role="status" data-supplier-outcome="ok"');
  assert.ok(at > 0 && at < html.indexOf('data-today-needs='), 'the status line is not above Needs you today');
  const line = html.slice(at, html.indexOf('data-today-needs='));
  assert.match(text(line), /You said yes\. Pay the booking fee and we’ll tell the couple/);
  assert.match(line, /href="\/vendor-dashboard\/booking-fees"[\s\S]*Pay the booking fee/);
  assert.match(code('app/vendor-dashboard/page.tsx'), /door: lockAnswer\.door \?\? null,/);
  assert.match(code('app/vendor-dashboard/page.tsx'), /feeHeld: lockAgreeFeeHeld\(search\.fee\)/);
});

/* ═══ 6 · THE EVENT DAY ═══════════════════════════════════════════════════ */

// SABOTAGE: `dayLocked` forced false → RED (a locked day shows its day-of rows).
test('6 · the event day: the photo card says Today with next moment · checked in, Also today — and nothing of the day while it is locked', async () => {
  const day = [up('cruz', 'Jun & Liza Cruz', TODAY, 'main', 0), ...UPCOMING];
  const facts = { startedAt: '12:00', next: { time: '3:30', label: 'Reception' }, line: '12:00 Ceremony · 3:30 Reception', checkedIn: 118 };
  const { html } = await draw({ desk: [INQUIRY], upcoming: day, dayFacts: facts, earnings: null });
  assert.match(text(html), /Also today Schedule 12:00 Ceremony · 3:30 Reception Event Hub/);
  assert.doesNotMatch(text(html.slice(html.indexOf('data-today-coming-up'))), /Jun & Liza Cruz/, 'today’s event is under Coming up too');
  // The photo card: Today, and the day's own two as chips (owner Q8) — assembled by the same picker the page uses.
  const { assembleNextEvents, nextEventDay } = await import('@/lib/supplier-today-next-events');
  const card = assembleNextEvents(nextEventDay(day, TODAY), { cruz: { dayNext: '3:30 Reception', checkedIn: 118 } }, TODAY)!.cards[0]!;
  assert.equal(card.when, 'Today');
  assert.deepEqual(card.chips.map((c) => c.word), ['Next 3:30 Reception', '118 checked in']);
  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /dayNext: dayFacts\.next \? `\$\{dayFacts\.next\.time\} \$\{dayFacts\.next\.label\}` : null, checkedIn: dayFacts\.checkedIn/, 'the page does not hand the day’s two to the photo card');
  // 🔒 An unpaid fee on today's event keeps the day locked: no Also today — the bill says why.
  const locked = await draw({ desk: [INQUIRY], upcoming: day, dayFacts: facts, earnings: null, feeBills: [bill('cruz', 'Jun & Liza Cruz', '2026-10-16')] });
  assert.doesNotMatch(locked.html, /data-today-also-today/);
  assert.match(locked.html, /data-fee-bill-today=""/);
  // The money read now runs every day (the Money stat is always on Today, A4); the day is read only on the day.
  assert.match(page, /fetchVendorEarningsSummary\(supabase, vendorProfileId\)\.catch\(\(\) => null\),/);
  assert.match(page, /eventToday \? readEventDayFacts\(/);
});

/* ═══ 7 · COMING UP ═══════════════════════════════════════════════════════ */

// SABOTAGE: drop `...schedules.outside.map(` from the Coming-up list → RED.
test('7 · Coming up carries the bookings from outside, and the schedule’s name when there is more than one', async () => {
  const pools = { pools: [{ id: 'main', name: 'Main team' }, { id: 'second', name: 'Second team' }], outside: [{ blockId: 'o1', date: '2026-10-15', clientName: 'Tan corporate', poolId: 'second' }], complete: true };
  const { html, view } = await draw({ schedules: pools });
  const coming = text(html.slice(html.indexOf('data-today-coming-up'), html.indexOf('data-today-shop')));
  assert.match(coming, /Thu 15 Oct · Tan corporate Second team · from outside/);
  assert.match(coming, /Sat 17 Oct · Reyes debut Main team · Makati/);
  assert.match(html, /data-today-row="coming-up-outside"[^>]*href="\/vendor-dashboard\/customers\?seg=dates&amp;day=2026-10-15"|href="\/vendor-dashboard\/customers\?seg=dates&amp;day=2026-10-15"[^>]*data-today-row="coming-up-outside"/);
  assert.equal(view.numbers.thisWeek, '3', 'an outside booking this week is not counted');
  // One schedule: no name to say.
  assert.doesNotMatch(text((await draw()).html), /Main team/);
});

/* ═══ 8 · THE SHOP ROW ═════════════════════════════════════════════════════ */

test('8 · the Shop row says Checking · Live · Not yet, what is left of the details, and how business is doing', async () => {
  const shopOf = async (o: Opt) => text((await draw(o)).html.split('data-today-shop')[1] ?? '');
  assert.match(await shopOf({}), /Lumina Studio Photo & video · couples can find you Live How is business 312 looked · 14 asked/);
  assert.match(await shopOf({ findable: false }), /not shown yet Not yet/);
  assert.match(
    await shopOf({ verified: false, findable: false, views: null, shop: { name: 'San Agustin Parish', categoryWord: 'Church', details: { done: 4, total: 6, complete: false }, awardWord: null, milestoneWord: null } }),
    /San Agustin Parish Church · send your documents to go live · details 4 of 6 Checking How is business Couples see your shop once you are live/,
  );
  // A views read that did not come back prints no number at all — never 0.
  assert.doesNotMatch(await shopOf({ views: null }), /\b0 looked/);
});

/* ═══ 9 · SETUP ════════════════════════════════════════════════════════════ */

// ⚠ The setup Next card ("N of 7") is retired with the Next card (v103): a new shop's six steps are the top of Today.
test('9 · a new shop: the six steps on top, no cover row, and no "finish setting up" row repeating them', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { buildFirstStepsRail } = await import('@/lib/vendor-first-steps');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const rail = buildFirstStepsRail({ verified: false, profileDone: 4, profileTotal: 6, serviceCount: 0, docsStatus: 'none', docsIn: 0, docsTotal: 4, submitMissing: [], customerCount: 0 });
  const base = { needsAnswer: [], closed: [], deskIncomplete: false, upcoming: [], schedules: { pools: [], outside: [], complete: true }, firstSteps: rail, verified: false, findable: false, findability: null, feeBills: [], feeEnforced: true, earnings: null, credit: null, payoutReadiness: 'unreadable' as const, payoutHref: '/x', shop: { name: 'S', categoryWord: null, details: { done: 4, total: 6, complete: false }, awardWord: null, milestoneWord: null }, views: null, inquiries28: null, dayFacts: null, todayIso: TODAY, now: NOW, since };
  const drawn = assembleSupplierToday({ ...base, setupDrawn: true });
  assert.ok(!drawn.needs.some((n) => n.key === 'door-setup'), 'the six steps are on top AND a row repeats them');
  assert.ok(assembleSupplierToday({ ...base, setupDrawn: false }).needs.some((n) => n.key === 'door-setup'), 'with no steps drawn, setup lost its door');
  const html = renderToStaticMarkup(React.createElement(SupplierTodayScreen, { view: drawn, outcome: null, shopName: 'S', todayIso: TODAY, now: NOW, setup: React.createElement('div', { 'data-setup-stub': '' }) }));
  assert.ok(html.indexOf('data-setup-stub') >= 0 && html.indexOf('data-setup-stub') < html.indexOf('data-today-needs='), 'the six steps are not the top of Today');
  assert.doesNotMatch(html, /data-today-cover|data-today-stats/, 'a new shop draws the cover row (as shipped it has none)');
});

/* ═══ 10 · THE READ CENSUS ════════════════════════════════════════════════ */

// SABOTAGE: put back a `.select('subscription_credit_php, tier_expires_at')` read on the page → RED.
test('10 · the page does not grow: one shop-row read for three, the schedules in one, no read of its own', () => {
  const page = code('app/vendor-dashboard/page.tsx');
  assert.doesNotMatch(page, /\.from\(/, 'the page reads a table itself again — reads live in their modules, counted');
  assert.doesNotMatch(page, /fetchVendorBusinessStartDate|subscription_credit_php/, 'a single-column shop-row read is back');
  assert.match(page, /fetchVendorFirstStepsState\(supabase, profile, \{\s*verified: shopRow \? shopRow\.verified : undefined,/, 'first steps reads verification_state again');
  const server = code('lib/supplier-today.server.ts');
  assert.equal((server.match(/\.from\('vendor_profiles'\)/g) ?? []).length, 1);
  assert.equal((server.match(/\.from\('vendor_schedule_pools'\)/g) ?? []).length, 1);
  // The blocks stay embedded in the one schedules read — now with the repeat columns (walk W2), still no read of their own.
  assert.match(server, /vendor_calendar_blocks\(block_id, block_source, blocked_at, blocked_until, client_name, \$\{NOT_AVAILABLE_COLUMNS\}\)/, 'the outside bookings left the one schedules read');
  assert.equal((server.match(/\.from\('vendor_calendar_blocks'\)/g) ?? []).length, 0, 'the blocks grew a read of their own');
  // Views only once couples can see the shop.
  assert.match(page, /shopRow\?\.verified \? readTodayViews\(/);
  // 📸 THE ONE BUILD A3: the next event day's facts are ONE batched round — one schedule read and one Hub-setup read for
  // every event (`.in('event_id', …)`), never a read per card.
  const next = server.slice(server.indexOf('export async function readNextEventFacts('));
  assert.equal((next.match(/\.from\('event_schedule_blocks'\)/g) ?? []).length, 1);
  assert.equal((next.match(/\.from\('vendor_dayof_configs'\)/g) ?? []).length, 1);
  assert.equal((next.match(/\.in\('event_id', ids\)/g) ?? []).length, 2, 'a next-event read is per event');
  // The renewal date (A9) is NOT on the table read — a session may not SELECT it there; it is its own read off the
  // shop's self view, started beside the shop row.
  assert.doesNotMatch(server, /\.from\('vendor_profiles'\)[\s\S]{0,400}next_renewal_due_at/, 'the renewal date is on the table read — Postgres refuses the whole row for a session');
  assert.match(server, /\.from\('vendor_profiles_self'\)\s*\.select\('next_renewal_due_at'\)/);
  assert.match(page, /const renewalP = readTodayRenewal\(supabase, vendorProfileId\);/);
});
