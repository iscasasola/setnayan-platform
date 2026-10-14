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
  const forecasts = o.forecast
    ? { 'ev-rc': bookingFeeForecast({ kind: 'billable', ordinal: 6, ordinalIsFrozen: false, schedule: BOOKING_FEE }, 85_000) }
    : {};
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  const html = renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, {
      view, outcome: o.outcome ?? null, feeForecasts: forecasts, cards: o.desk ?? [], askStatus: '', deskIncomplete: false, actions,
    }),
  );
  return { html, view };
}
const cardOf = (html: string) => html.slice(html.indexOf('data-today-next'), html.indexOf('data-today-numbers'));

/* ═══ 1 · LIVE's NINE RULES ═══════════════════════════════════════════════ */

// SABOTAGE: move `if (input.fee)` above `if (input.answer)` in pickSupplierNext → RED.
test('1 · the Next order is LIVE’s nine rules — an overdue fee never jumps ahead of a couple’s ask', async () => {
  const { SUPPLIER_NEXT_ORDER } = await import('@/lib/supplier-today');
  assert.deepEqual([...SUPPLIER_NEXT_ORDER], ['run_day', 'answer', 'unread', 'setup', 'findable', 'tomorrow', 'fee', 'payday', 'clear']);
  const { view, html } = await draw({ desk: [INQUIRY], feeBills: [bill('cruz', 'Cruz wedding', '2026-10-10')] });
  assert.equal(view.next.kind, 'answer', 'an overdue fee took the card from a couple’s ask');
  assert.match(text(cardOf(html)), /Reply to Ana & Miguel/);
  // …and the fee is still on the page, with its Pay, under Also waiting.
  assert.match(html, /data-fee-bill-today=""/);
  // With nothing else waiting, the fee IS the card.
  const alone = await draw({ feeBills: [bill('cruz', 'Cruz wedding', '2026-10-10')], earnings: null });
  assert.equal(alone.view.next.kind, 'fee');
});

/* ═══ 2 · THE ASK, ANSWERED ON THE CARD ═══════════════════════════════════ */

// SABOTAGE: drop `<BookingFeeNotice disclosure={feeForecast} />` from LockRequestBody → RED (no fee above Agree).
// SABOTAGE: `askOnCard` set to null in the assembly → RED (the card links away again).
test('2 · a booking ask is answered ON the card — fee above Agree, the shipped form, Turn it down, Chat, the initials', async () => {
  const { html, view } = await draw({ desk: [ASK], forecast: true });
  assert.equal(view.askOnCard?.id, 'lockreq-ev-rc');
  const card = cardOf(html);
  const t = text(card);
  assert.match(card, /data-next-who=""[^>]*>RC</, 'the couple’s initials are not on the card');
  assert.match(t, /Agree to this booking/);
  const fee = card.indexOf('data-testid="booking-fee-notice"') >= 0 ? card.indexOf('data-testid="booking-fee-notice"') : card.search(/Booking fee ₱/);
  const agree = card.search(/<form[^>]*>[\s\S]*?name="vendor_id" value="ev-rc"/);
  assert.ok(fee > 0, `the booking fee is not named on the card: ${t.slice(0, 400)}`);
  assert.ok(agree > fee, 'the fee is named AFTER Agree — a fee named after the press is a receipt');
  assert.match(card.slice(agree), /class="ab ab-brand ab-main[^"]*"[\s\S]*?Agree to this booking/, 'Agree is not the card’s terracotta answer');
  assert.match(card, /data-fold="answer-no"[\s\S]*Turn it down[\s\S]*name="reason"/, 'Turn it down lost its reason');
  assert.match(card, /href="\/vendor-dashboard\/messages\/t-rc"[^>]*>|<a[^>]*href="\/vendor-dashboard\/messages\/t-rc"/, 'no Chat to the couple');
  // The ask is not drawn a second time under Also waiting.
  assert.doesNotMatch(html, /data-today-ask="lock_request"/);
  // The answer the card posts is the shipped one, mounted by the page.
  assert.match(code('app/vendor-dashboard/page.tsx'), /agreeLock: vendorAgreeToLock,/);
  assert.match(code('app/vendor-dashboard/_components/supplier-today-screen.tsx'), /<LockRequestBody\s+onCard\s+card=\{view\.askOnCard\}\s+agreeLock=\{actions\.agreeLock\}/);
});

// SABOTAGE: `if (names.length > 0)` → `if (false)` → RED.
test('2b · before Agree: a hall already booked that day, and an unapproved shop, are said on the card', async () => {
  const halls = { pools: [{ id: 'A', name: 'Hall A' }, { id: 'B', name: 'Hall B' }, { id: 'C', name: 'Hall C' }], outside: [{ blockId: 'o', date: '2026-12-12', clientName: 'Rotary', poolId: 'C' }], complete: true };
  const { html } = await draw({ desk: [ASK], schedules: halls, askDayHolds: { 'ev-rc': ['A'] } });
  const t = text(cardOf(html));
  assert.match(t, /Hall A and Hall C are booked that day/, `the taken halls are not said: ${t.slice(0, 300)}`);
  assert.match(cardOf(html), /data-badge="no"[^>]*>Taken</);
  // One schedule: there is no hall to name.
  assert.doesNotMatch(text(cardOf((await draw({ desk: [ASK], askDayHolds: { 'ev-rc': ['main'] } })).html)), /booked that day/);
  // Not approved: a yes is refused until the documents are in.
  assert.match(text(cardOf((await draw({ desk: [ASK], verified: false })).html)), /Not verified yet.*Send your documents first/);
});

/* ═══ 3 · EVERY ANSWER UNDER "ALSO WAITING" ═══════════════════════════════ */

// SABOTAGE: DeleteRequestBody's Agree to remove it `tone="danger"` → `tone="brand"` → RED.
test('3 · every Also-waiting kind keeps its answer — and the doors go somewhere', async () => {
  const { html } = await draw({ desk: [INQUIRY, MOVE, REMOVE, DONE, REVIEW, QUOTE, CONTRACT, LAPSED, DISPUTE] });
  const rowOf = (kind: string) => {
    const at = html.indexOf(`data-today-ask="${kind}"`);
    assert.ok(at > 0, `${kind}: no row`);
    const nextAt = html.indexOf('data-today-ask="', at + 20);
    return html.slice(at, nextAt > 0 ? nextAt : undefined);
  };
  // The date change is the Next card whenever one waits (live `nextAnswerOf`): Move to <date> · Unlock my service.
  const card = cardOf(html);
  assert.match(text(card), /Move to Sun 25 Oct/);
  assert.match(text(card), /Unlock my service/);
  // Cancel request — the delete look on the destructive answer, and Keep it for now.
  const del = rowOf('delete_request');
  assert.match(text(del), /Cancel request.*Dizon debut/);
  assert.match(del, /class="ab ab-danger ab-main[^"]*"[\s\S]*?Agree to remove it/, 'Agree to remove it lost its danger look');
  assert.match(del, /Keep it for now/);
  assert.match(text(rowOf('mark_complete')), /Mark it done.*Reyes debut[\s\S]*I delivered this service/);
  assert.match(text(rowOf('review')), /Reply to a review.*Cruz · 5 ★[\s\S]*Post reply/);
  assert.match(rowOf('quote_draft'), /href="\/vendor-dashboard\/customers\?seg=money&amp;open=proposals#customer-tools"/);
  assert.match(text(rowOf('quote_draft')), /Finish quote draft.*Rolando & Carmen · ₱45,000/);
  assert.match(rowOf('contract_draft'), /href="\/vendor-dashboard\/customers\?seg=money&amp;open=contracts#customer-tools"/);
  assert.match(text(rowOf('lock_request_lapsed')), /Ask lapsed.*Dela Peña/);
  assert.match(rowOf('lock_request_lapsed'), /data-badge="quiet"[^>]*>Lapsed</);
  assert.match(rowOf('dispute'), /href="\/vendor-dashboard\/messages\/t-pz"/);
  assert.match(text(rowOf('dispute')), /Dispute open.*Setnayan is looking/);
  // One "Also waiting", no second "Nothing to answer" heading — the closed lines are rows of the same list.
  assert.equal((text(html).match(/Also waiting/g) ?? []).length, 1);
  assert.doesNotMatch(text(html), /Nothing to answer/);
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
  assert.match(t, /Booking fee · Lim & Tan wedding ₱4,250\.00 · due Tue 20 Oct · Setnayan introduced this couple to you on Oct 12, 2026/);
  assert.match(t, /Booking fee · Cruz wedding ₱4,250\.00 · overdue since Sat 10 Oct/);
  // The lock: once, the gate's own sentence.
  assert.equal((html.match(/data-fee-lock-line=""/g) ?? []).length, 1);
  assert.match(t, /this event’s details and day-of tools stay locked until the fee is settled/);
  // Enforced → said for a bill that is only due.
  assert.match(text((await draw({ desk: [INQUIRY], feeBills: [bills[0]!] })).html), /stay locked until the fee is settled/);
  // Not enforced → said only once a bill is overdue.
  assert.doesNotMatch((await draw({ desk: [INQUIRY], feeBills: [bills[0]!], feeEnforced: false })).html, /data-fee-lock-line/);
  assert.match((await draw({ desk: [INQUIRY], feeBills: bills, feeEnforced: false })).html, /data-fee-lock-line/);
  // The fee as the Next card says the lock BEFORE Pay when its own words do not.
  const card = cardOf((await draw({ feeBills: [bills[0]!], earnings: null })).html);
  assert.match(text(card), /stay locked until the fee is settled/);
  assert.match(card, new RegExp(`href="${vendorBookingFeePayPath(bills[0]!.orderId).replace(/[?/.]/g, '\\$&')}"`));
});

/* ═══ 5 · AFTER AGREE, THE FEE HELD ═══════════════════════════════════════ */

// SABOTAGE: drop `door: lockAnswer.door ?? null` from the page's outcome → RED (page anchor).
test('5 · after Agree with the news held: the shipped sentence and "Pay the booking fee", right under the card', async () => {
  const { lockAgreeNotice } = await import('@/lib/lock-answer-notice');
  const said = lockAgreeNotice('ok', { feeHeld: true })!;
  assert.equal(said.text, 'You said yes. Pay the booking fee and we’ll tell the couple their booking is confirmed.');
  const { html } = await draw({ desk: [INQUIRY], outcome: { text: said.text, tone: 'ok', door: said.door ?? null } });
  const at = html.indexOf('role="status" data-supplier-outcome="ok"');
  assert.ok(at > html.indexOf('data-today-next') && at < html.indexOf('data-today-numbers'), 'the status line is not under the card');
  const line = html.slice(at, html.indexOf('data-today-numbers'));
  assert.match(text(line), /You said yes\. Pay the booking fee and we’ll tell the couple/);
  assert.match(line, /href="\/vendor-dashboard\/booking-fees"[\s\S]*Pay the booking fee/);
  assert.match(code('app/vendor-dashboard/page.tsx'), /door: lockAnswer\.door \?\? null,/);
  assert.match(code('app/vendor-dashboard/page.tsx'), /feeHeld: lockAgreeFeeHeld\(search\.fee\)/);
});

/* ═══ 6 · THE EVENT DAY ═══════════════════════════════════════════════════ */

// SABOTAGE: `dayLocked` forced false → RED (a locked day shows its day-of numbers).
test('6 · the event day: Run the day · Chat, waiting · next moment · checked in, Also today — and nothing of the day while it is locked', async () => {
  const day = [up('cruz', 'Jun & Liza Cruz', TODAY, 'main', 0), ...UPCOMING];
  const facts = { startedAt: '12:00', next: { time: '3:30', label: 'Reception' }, line: '12:00 Ceremony · 3:30 Reception', checkedIn: 118 };
  const { html, view } = await draw({ desk: [INQUIRY], upcoming: day, dayFacts: facts, earnings: null });
  assert.equal(view.next.kind, 'run_day');
  const card = cardOf(html);
  assert.match(card, /data-next-day=""/);
  assert.match(text(card), /Today · live since 12:00 Jun & Liza Cruz Makati · 150 guests/);
  assert.match(text(card), /Run the day.*Chat/);
  const nums = text(html.slice(html.indexOf('data-today-numbers'), html.indexOf('data-today-coming-up')));
  assert.match(nums, /waiting on you.*3:30 next moment.*118 checked in/);
  assert.match(text(html), /Also today Schedule 12:00 Ceremony · 3:30 Reception Event Hub/);
  // Today's event is on the card, not again under Coming up.
  assert.doesNotMatch(text(html.slice(html.indexOf('data-today-coming-up'))), /Jun & Liza Cruz/);
  // 🔒 An unpaid fee on today's event keeps the day locked: no day numbers, no Also today — the bill says why.
  const locked = await draw({ desk: [INQUIRY], upcoming: day, dayFacts: facts, earnings: null, feeBills: [bill('cruz', 'Jun & Liza Cruz', '2026-10-16')] });
  assert.doesNotMatch(locked.html, /next moment|checked in|data-today-also-today/);
  assert.match(locked.html, /data-fee-bill-today=""/);
  // The page skips the money read on an event day and reads the day instead — the screen does not grow.
  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /eventToday \? Promise\.resolve\(null\) : fetchVendorEarningsSummary\(/);
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

test('9 · a new shop’s card is "N of 6" — the six steps, the approval not one of them', async () => {
  const { buildFirstStepsRail } = await import('@/lib/vendor-first-steps');
  const rail = buildFirstStepsRail({ verified: false, profileDone: 4, profileTotal: 6, serviceCount: 0, docsStatus: 'none', docsIn: 0, docsTotal: 4, submitMissing: [], customerCount: 0 });
  const { html } = await draw({ firstSteps: rail, verified: false, findable: false, upcoming: [], earnings: null, views: null });
  const card = text(cardOf(html));
  assert.match(card, /1 of 6 Your next step Your details/);
  assert.match(card, /Fill them in/);
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
  assert.match(server, /vendor_calendar_blocks\(block_id, block_source, blocked_at, blocked_until, client_name\)/, 'the outside bookings left the one schedules read');
  // Views only once couples can see the shop.
  assert.match(page, /shopRow\?\.verified \? readTodayViews\(/);
});
