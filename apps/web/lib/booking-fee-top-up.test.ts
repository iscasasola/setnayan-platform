/**
 * 💸 BOOKING-FEE TOP-UP — SIX RULES (owner, DECISION_LOG 2026-11-12) — the app half, executed.
 *
 *   1 · DUE on the event day ("Due today"), gated only from the DAY AFTER.
 *   2 · may be settled EARLY — "Settle early" before the event day.
 *   4 · HELD before the event day: no page gate, no carry-over onto a new booking until overdue.
 *   5 · NO email — the sweep that emails a due bill emails ONLY orders read as ordinary fees (fail closed).
 *   6 · a quote that drops shows no credit — nothing in the app reads the credit row.
 *
 * Rule 3 (a free first booking stays free) and the SQL half of 1 + 4 are pinned against the replayed database in
 * tests/db/a-top-up-is-held-until-the-event-day.db.test.ts. The TS gate here and the SQL gate there must agree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TOP_UP_WORDS,
  feeOrdersToEmail,
  overdueTopUps,
  topUpIsHeld,
  topUpOwedPhp,
  topUpPayLabel,
  topUpStage,
  wordsOnlyTopUpPhp,
} from './booking-fee-top-up';
import { eventAccessUnlocked, feeLockCopy } from './event-access-stage';
import { feeDueCopy, type DueFeeBill } from './booking-fee-disclosure';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const EVENT_DAY = '2027-03-14';
const BEFORE = '2026-11-12';
const DAY_AFTER = '2027-03-15';
// A due day as the database stamps it: noon Manila on the event day = 04:00Z the same date.
const DUE_AT = `${EVENT_DAY}T04:00:00+00:00`;

const topUpCharge = (status = 'pending') =>
  ({ kind: 'charge', status, amountPhp: 1000, dueAt: DUE_AT, orderId: 'O-1', chargeKind: 'amendment_delta' }) as const;

/* ── RULE 1 + 4 · the stage and the gate ────────────────────────────────────────────────────────────────────────── */

test('rule 1 · held before the event day, due today ON it, overdue from the day after', () => {
  assert.equal(topUpStage(EVENT_DAY, BEFORE), 'held');
  assert.equal(topUpStage(EVENT_DAY, '2027-03-13'), 'held');
  assert.equal(topUpStage(EVENT_DAY, EVENT_DAY), 'due_today');
  assert.equal(topUpStage(DUE_AT, EVENT_DAY), 'due_today', 'a stamped timestamp reads as its own day');
  assert.equal(topUpStage(EVENT_DAY, DAY_AFTER), 'overdue');
  assert.equal(topUpStage(null, BEFORE), 'overdue', 'an unknown due day is never guessed as held');
});

test('rule 4 · a held top-up does NOT gate the event — through the event day itself', () => {
  // SABOTAGE: drop the `top_up_held` arm from eventAccessUnlocked → RED.
  for (const today of [BEFORE, EVENT_DAY]) {
    const d = eventAccessUnlocked({ charge: topUpCharge(), enforced: true, feeMinting: true, todayPh: today });
    assert.equal(d.unlocked, true, `a top-up gated the event on ${today}`);
    assert.equal(d.reason, 'top_up_held');
  }
});

test('rule 1 · from the DAY AFTER, the unsettled top-up gates — and says "Settle ₱X booking fee to open this"', () => {
  const d = eventAccessUnlocked({ charge: topUpCharge(), enforced: true, feeMinting: true, todayPh: DAY_AFTER });
  assert.equal(d.unlocked, false);
  assert.equal(d.reason, 'fee_due');
  assert.equal(d.owed?.topUp, true);
  const copy = feeLockCopy({ stage: 'booked_fee_due', owed: d.owed, withheld: [], reason: d.reason });
  assert.equal(copy.headline, TOP_UP_WORDS.pageGated(1000));
  assert.match(copy.headline, /^Settle ₱1,000\.00 booking fee to open this$/);
});

test('rule 4 · the held rule is the top-up ONLY — an unpaid primary fee gates at once, as shipped', () => {
  const primary = { kind: 'charge', status: 'pending', amountPhp: 5000, dueAt: DUE_AT, orderId: 'O-2' } as const;
  const d = eventAccessUnlocked({ charge: primary, enforced: true, feeMinting: true, todayPh: BEFORE });
  assert.equal(d.unlocked, false);
  assert.equal(d.owed?.topUp, undefined, 'an ordinary bill is not a top-up');
  assert.equal(topUpIsHeld({ kind: 'primary', status: 'pending', dueAt: DUE_AT }, BEFORE), false);
});

test('rule 4 · a settled or voided top-up holds nothing — the TS twin of booking_fee_top_up_is_held', () => {
  assert.equal(topUpIsHeld({ kind: 'amendment_delta', status: 'pending', dueAt: DUE_AT }, BEFORE), true);
  assert.equal(topUpIsHeld({ kind: 'amendment_delta', status: 'failed', dueAt: DUE_AT }, EVENT_DAY), true);
  assert.equal(topUpIsHeld({ kind: 'amendment_delta', status: 'paid', dueAt: DUE_AT }, BEFORE), false);
  assert.equal(topUpIsHeld({ kind: 'amendment_delta', status: 'expired', dueAt: DUE_AT }, BEFORE), false);
  assert.equal(topUpIsHeld({ kind: 'amendment_delta', status: 'pending', dueAt: null }, BEFORE), false);
  assert.equal(topUpIsHeld({ kind: 'amendment_delta', status: 'pending', dueAt: DUE_AT }, DAY_AFTER), false);
  // The SQL twin compares the same three things.
  const sql = read('../../supabase/migrations/20271340632149_a_top_up_is_held_until_the_event_day.sql');
  assert.match(sql, /p_kind = 'amendment_delta'\s+AND p_status IN \('pending', 'failed'\)\s+AND p_expires_at IS NOT NULL/);
  assert.match(sql, /\(p_expires_at AT TIME ZONE 'Asia\/Manila'\)::date >= \(NOW\(\) AT TIME ZONE 'Asia\/Manila'\)::date/);
});

/* ── RULE 4 · the carry-over ────────────────────────────────────────────────────────────────────────────────────── */

test('rule 4 · only an OVERDUE top-up carries over onto a new booking — held ones and ordinary bills never do', () => {
  const bills = [
    { orderId: 'held', amountPhp: 500, dueOn: EVENT_DAY, topUp: true },
    { orderId: 'old', amountPhp: 750, dueOn: '2026-11-01', topUp: true },
    { orderId: 'older', amountPhp: 250, dueOn: '2026-10-01', topUp: true },
    { orderId: 'primary', amountPhp: 5000, dueOn: '2026-10-01' },
  ];
  const owed = overdueTopUps(bills, BEFORE);
  assert.deepEqual(owed.map((b) => b.orderId), ['older', 'old'], 'oldest-due first, held and primary dropped');
  assert.equal(topUpOwedPhp(owed), 1000);
  assert.equal(TOP_UP_WORDS.settleToAccept(1000), 'Settle ₱1,000.00 to accept');
  assert.deepEqual(overdueTopUps([{ orderId: 'h', amountPhp: 500, dueOn: EVENT_DAY, topUp: true }], EVENT_DAY), []);
});

test('rule 4 · the yes is refused server-side while a top-up is overdue (a hidden button is not a gate)', () => {
  const actions = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const agree = actions.slice(actions.indexOf('export async function vendorAgreeToLock'));
  const refuse = agree.indexOf('lock_agree=top_up_owed');
  assert.ok(refuse > 0, 'vendorAgreeToLock lost the carry-over refusal');
  assert.ok(refuse < agree.indexOf("rpc('vendor_agree_to_lock'"), 'the carry-over must refuse BEFORE the RPC books');
  assert.match(agree.slice(0, refuse), /overdueTopUps\(bills, /);
  const panel = read('app/vendor-dashboard/clients/[eventId]/_components/booking-ask-panel.tsx');
  assert.match(panel, /<TopUpCarryOver owed=\{carryOver\}/);
});

/* ── RULE 1 + 2 · the bill's words ──────────────────────────────────────────────────────────────────────────────── */

const bill: DueFeeBill = { orderId: 'O-1', amountPhp: 1300, eventId: 'e', coupleName: 'Ana & Miguel', dueOn: EVENT_DAY, topUp: true };

test('rule 2 · before the event day the bill says the fee grows, held until the day, and the door reads "Settle early"', () => {
  const c = feeDueCopy(bill, BEFORE, true);
  assert.equal(c.headline, 'Booking fee grows by ₱1,300.00 · held until Mar 14, 2027 for Ana & Miguel');
  assert.equal(c.payLabel, 'Settle early');
  assert.notEqual(c.tone, 'overdue');
  assert.equal(topUpPayLabel(EVENT_DAY, BEFORE), 'Settle early');
});

test('rule 1 · on the event day the bill says "Due today"; the day after it is overdue', () => {
  assert.match(feeDueCopy(bill, EVENT_DAY, true).headline, /Due today — ₱1,300\.00/);
  assert.equal(topUpPayLabel(EVENT_DAY, EVENT_DAY), 'Settle');
  const after = feeDueCopy(bill, DAY_AFTER, true);
  assert.equal(after.tone, 'overdue');
  assert.match(after.headline, /overdue — ₱1,300\.00/);
});

test('an ordinary bill keeps the shipped words (a top-up flag changes nothing else)', () => {
  const plain = feeDueCopy({ ...bill, topUp: false }, BEFORE, true);
  assert.match(plain.headline, /^Booking fee due by Mar 14, 2027/);
  assert.equal(plain.payLabel, undefined);
});

/* ── RULE 5 · no email ──────────────────────────────────────────────────────────────────────────────────────────── */

const ORDERS = [
  { order_id: 'O-primary', chargeId: 'C-primary' },
  { order_id: 'O-topup', chargeId: 'C-topup' },
  { order_id: 'O-unread', chargeId: 'C-unread' },
  { order_id: 'O-nokey', chargeId: null },
];

test('rule 5 · FAIL CLOSED — a failed charge read emails nobody', () => {
  // SABOTAGE: `if (charges === null) return orders` (the old "no filter") → RED.
  assert.deepEqual(feeOrdersToEmail(ORDERS, null), []);
});

test('rule 5 · FAIL CLOSED — an empty charge read emails nobody', () => {
  // The old deny-list read an empty set as "nothing to drop" and emailed every due order, top-ups included.
  assert.deepEqual(feeOrdersToEmail(ORDERS, []), []);
});

test('rule 5 · only an order whose charge was READ as an ordinary fee is emailed — never a top-up, never an unread one', () => {
  const told = feeOrdersToEmail(ORDERS, [
    { charge_id: 'C-primary', kind: 'primary' },
    { charge_id: 'C-topup', kind: 'amendment_delta' },
    { charge_id: 'C-stranger', kind: 'primary' },
  ]).map((o) => o.order_id);
  assert.deepEqual(told, ['O-primary']);
});

test('rule 5 · the emailing fee sweep notifies only what feeOrdersToEmail allows, and skips the run on a failed read', () => {
  // SABOTAGE: notify `dueOrders` instead of `toTell`, or drop the `charges === null` return → RED.
  const src = read('lib/vendor-booking-fees.server.ts');
  const sweep = src.slice(src.indexOf('export async function maybeSweepVendorBookingFeeNotifications'));
  assert.match(sweep, /const charges = await readFeeChargeKinds\(admin, dueOrders\);\s*if \(charges === null\) return;/);
  assert.match(sweep, /const toTell = feeOrdersToEmail\(/);
  assert.match(sweep, /for \(const o of toTell\) \{/);
  assert.doesNotMatch(sweep.slice(sweep.indexOf('const toTell')), /for \(const o of dueOrders\)/);
  const reader = src.slice(src.indexOf('async function readFeeChargeKinds'));
  assert.match(reader, /if \(error\) \{[^}]*return null;/, 'a refused read must be null, never an empty list');
});

/* ── WORDS ONLY · a new inquiry, never a booked client ──────────────────────────────────────────────────────────── */

const OVERDUE_TOP_UP = { amount_charged_centavos: 13000, expires_at: DUE_AT };

test('words only · an UNBOOKED inquiry is narrowed while the shop has an overdue top-up on another event', () => {
  assert.equal(wordsOnlyTopUpPhp({ booked: false, charges: [OVERDUE_TOP_UP], todayPh: DAY_AFTER }), 130);
});

test('words only · a BOOKED client is never narrowed — the couple who owes the top-up included', () => {
  // SABOTAGE: drop the `booked !== false` arm → RED.
  assert.equal(wordsOnlyTopUpPhp({ booked: true, charges: [OVERDUE_TOP_UP], todayPh: DAY_AFTER }), null);
});

test('words only · a failed read narrows nothing — never read as "unbooked" or "owes"', () => {
  assert.equal(wordsOnlyTopUpPhp({ booked: null, charges: [OVERDUE_TOP_UP], todayPh: DAY_AFTER }), null);
  assert.equal(wordsOnlyTopUpPhp({ booked: false, charges: null, todayPh: DAY_AFTER }), null);
});

test('words only · a held or due-today top-up narrows nothing', () => {
  assert.equal(wordsOnlyTopUpPhp({ booked: false, charges: [OVERDUE_TOP_UP], todayPh: BEFORE }), null);
  assert.equal(wordsOnlyTopUpPhp({ booked: false, charges: [OVERDUE_TOP_UP], todayPh: EVENT_DAY }), null);
});

test('words only · the read asks the SHOP-wide top-ups and this thread\'s booking — and both callers use it', () => {
  // SABOTAGE: scope the top-up read back to `.eq('event_id', eventId)` (the booked event that owes it) → RED.
  const src = read('lib/booking-fee-top-up.server.ts');
  const fn = src.slice(src.indexOf('export async function readWordsOnlyTopUp'), src.indexOf('export async function readOverdueTopUpEventIds'));
  const chargesRead = fn.slice(fn.indexOf(".from('booking_fee_charges')"));
  assert.doesNotMatch(chargesRead.slice(0, chargesRead.indexOf(']);')), /\.eq\('event_id'/);
  assert.match(fn, /\.from\('event_vendors'\)[\s\S]*?\.in\('status', CONFIRMED_VENDOR_STATUSES/);
  assert.match(fn, /booked: bookedRes\.error \? null : /);
  assert.match(read('lib/chat-send.ts'), /await readWordsOnlyTopUp\(/);
  assert.match(read('app/vendor-dashboard/messages/[threadId]/page.tsx'), /readWordsOnlyTopUp\(profile\.vendor_profile_id, thread\.event_id, /);
});

/* ── RULE 6 · no credit shown ───────────────────────────────────────────────────────────────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('rule 6 · a dropped quote shows no credit — no app or lib file reads the booking-fee credit row', () => {
  // The re-derive records an audit `amendment_credit` row (no money moves). Owner: paid amounts never change and
  // no credit is SHOWN — so nothing outside SQL may read it.
  const hits = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]
    .filter((f) => /amendment_credit/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(WEB, f));
  assert.deepEqual(hits, [], `a booking-fee credit reached a screen: ${hits.join(', ')}`);
});

/* ── Unlisted and uncounted: the PUBLIC page leaves the event out ───────────────────────────────────────────────── */

test('the public shop page leaves out the review, page photos, hero and featured story of an unlisted event', () => {
  // SABOTAGE: drop any one of the four uses of `unlistedEvents` / `unlistedPageRefs` on the page → RED.
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /const unlistedEvents = await readOverdueTopUpEventIds\(vendor\.vendor_profile_id, /);
  assert.match(page, /fetchReviewsForVendorWithCouple\(admin, vendor\.vendor_profile_id, \{ limit, offset: 0, excludeEventIds: \[\.\.\.unlistedEvents\] \}\)/);
  assert.match(page, /if \(pinnedOutsideWindow\?\.event_id && unlistedEvents\.has\(pinnedOutsideWindow\.event_id\)\) pinnedOutsideWindow = null;/);
  assert.match(page, /resolvePortfolioPhotos\(\(vendor\.portfolio_r2_keys \?\? \[\]\)\.filter\(\(k: string\) => !unlistedPageRefs\.has\(k\)\)\)/);
  assert.match(page, /unlistedPageRefs\.has\(microsite\.heroPhotoKey\)/);
  assert.match(page, /\.filter\(\(id\) => !unlistedEvents\.has\(id\)\)/);
  const sheet = read('lib/supplier-sheet-read.ts');
  assert.match(sheet, /excludeEventIds: \[\.\.\.unlisted\]/);
});

test('the review list keeps a review whose celebration was deleted (NULL event) when it excludes events', () => {
  // `event_id NOT IN (…)` alone is NULL for a NULL event_id and would silently drop every orphaned review.
  const reviews = read('lib/reviews.ts');
  assert.match(reviews, /q\.or\(`event_id\.is\.null,event_id\.not\.in\.\(\$\{skip\.join\(','\)\}\)`\)/);
});
