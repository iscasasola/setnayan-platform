/**
 * Guard — THE COUPLE CAN PAY THE DEPOSIT, AND IS TOLD HOW (S19, 2026-09-18).
 *
 * Owner, live on the booking run: "there is no mode to pay the vendor the
 * deposit… the payment modes of the vendor must show. and an easier way to pay
 * of course."
 *
 * Part 1 EXECUTES the decisions in `lib/deposit-pay-step.ts`. Part 2 pins where
 * they are mounted, because a correct decision nobody renders is the defect this
 * session was opened for: `VendorDirectPay` existed, and the deposit step did not
 * show it.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  depositNeedsAction,
  depositStepHref,
  depositStepOf,
  isCoupleVisible,
  noPayMethodsSentence,
  payoutReadinessOf,
  DEPOSIT_ANCHOR_ID,
  type PayoutMethodFacts,
} from './deposit-pay-step';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));

const DEPOSIT_CARD =
  '../app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/deposit-reservation.tsx';
const WORKSPACE = '../app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx';
const VENDORS_PAGE = '../app/dashboard/[eventId]/vendors/page.tsx';
const BUILD_LOCKED = '../app/dashboard/[eventId]/vendors/_components/build-locked.tsx';
const SERVER_READS = './vendor-payment-methods.server.ts';
const CLIENT_PAGE = '../app/vendor-dashboard/clients/[eventId]/page.tsx';
const FEED = '../app/vendor-dashboard/_components/overview-sections.tsx';
const OVERVIEW = '../app/vendor-dashboard/page.tsx';

// ─── Part 1 · the decisions, executed ──────────────────────────────────────

const T = '2026-09-18T00:00:00Z';

test('the deposit is ONE state, and a refused read is never "due"', () => {
  const cases: Array<[Parameters<typeof depositStepOf>[0], string]> = [
    [null, 'unknown'],
    [{ deposit_recorded_at: null, deposit_acknowledged_at: null }, 'due'],
    [{ deposit_recorded_at: T, deposit_acknowledged_at: null }, 'sent'],
    [{ deposit_recorded_at: T, deposit_acknowledged_at: null, deposit_declined_at: T }, 'refused'],
    [{ deposit_recorded_at: T, deposit_acknowledged_at: T }, 'confirmed'],
    // an acknowledgement outranks a stale refusal
    [{ deposit_recorded_at: T, deposit_acknowledged_at: T, deposit_declined_at: T }, 'confirmed'],
  ];
  for (const [row, want] of cases) assert.equal(depositStepOf(row), want, JSON.stringify(row));
  assert.equal(cases.length, 6, 'ran every case');

  assert.equal(depositNeedsAction('due'), true);
  assert.equal(depositNeedsAction('refused'), true);
  for (const s of ['sent', 'confirmed', 'unknown'] as const) {
    assert.equal(depositNeedsAction(s), false, `${s} must not ask the couple to pay`);
  }
});

test('the call to action lands on the deposit card, on the Payments tab', () => {
  assert.equal(
    depositStepHref('E1', 'V1'),
    `/dashboard/E1/vendors/V1/workspace?tab=payments#${DEPOSIT_ANCHOR_ID}`,
  );
  // …and the card actually carries that id.
  assert.match(read(DEPOSIT_CARD), /id=\{DEPOSIT_ANCHOR_ID\}/, 'the #deposit anchor lands nowhere');
});

const m = (o: Partial<PayoutMethodFacts>): PayoutMethodFacts => ({
  method_type: 'bank',
  is_shown: true,
  moderation_status: 'approved',
  ...o,
});

test('"can a couple see it" — the same rule as the couple’s own fetch', () => {
  assert.equal(isCoupleVisible(m({}), false), true);
  assert.equal(isCoupleVisible(m({ is_shown: false }), true), false);
  assert.equal(isCoupleVisible(m({ moderation_status: 'pending_review' }), true), false);
  assert.equal(isCoupleVisible(m({ moderation_status: 'held' }), true), false);
  assert.equal(isCoupleVisible(m({ method_type: 'link' }), false), false, 'a link needs Pro');
  assert.equal(isCoupleVisible(m({ method_type: 'link' }), true), true);
  assert.equal(isCoupleVisible(m({ method_type: 'qr' }), false), true);
});

test('the supplier’s readiness — and silence when the read failed', () => {
  assert.equal(payoutReadinessOf(null, true), 'unreadable');
  assert.equal(payoutReadinessOf([], true), 'none');
  assert.equal(payoutReadinessOf([m({})], false), 'ready');
  assert.equal(payoutReadinessOf([m({ moderation_status: 'pending_review' })], false), 'in_review');
  assert.equal(payoutReadinessOf([m({ is_shown: false })], true), 'none');
  assert.equal(payoutReadinessOf([m({ moderation_status: 'held' })], true), 'none');
  // A payment link on a lapsed plan: the supplier added one, and NO couple sees it.
  assert.equal(payoutReadinessOf([m({ method_type: 'link' })], false), 'none');
  // One visible method is enough, whatever else is pending.
  assert.equal(
    payoutReadinessOf([m({ moderation_status: 'pending_review' }), m({ method_type: 'qr' })], false),
    'ready',
  );
});

test('the couple is told in a sentence — and "could not load" never reads as "has none"', () => {
  assert.equal(noPayMethodsSentence('listed', 2, 'Saysay'), null, 'methods exist — the sheet speaks');
  const none = noPayMethodsSentence('listed', 0, 'Saysay');
  const offPlatform = noPayMethodsSentence('off_platform', 0, 'Saysay');
  const unreadable = noPayMethodsSentence('unreadable', 0, 'Saysay');
  assert.match(none ?? '', /hasn’t added a way to pay them/);
  assert.match(offPlatform ?? '', /isn’t on Setnayan/);
  assert.match(unreadable ?? '', /couldn’t load/);
  assert.equal(new Set([none, offPlatform, unreadable]).size, 3, 'two outcomes share one sentence');
  assert.doesNotMatch(unreadable ?? '', /hasn’t added/, 'a failed read claims they have none');
  // Unreadable wins even with a stale non-zero count: it is never "listed".
  assert.match(noPayMethodsSentence('unreadable', 3, 'Saysay') ?? '', /couldn’t load/);
});

// ─── Part 2 · where it is mounted ──────────────────────────────────────────

test('the deposit card shows the supplier’s methods FIRST, then "Record payment"', () => {
  const card = read(DEPOSIT_CARD);
  /* ✏️ RE-ANCHORED 2026-09-20 ON THE MOUNT, NOT ITS ONE-LINE SPELLING. This
     read the whole tag as a single literal, so adding a prop — `amountPhp`,
     which is what lets the supplier's own QR carry the figure — reformatted
     the JSX onto four lines and the guard reported "the deposit step does not
     mount the pay sheet". It was mounted the entire time. What is asserted
     (pay comes before record) is unchanged, and the props are checked on their
     own below so widening the anchor loses nothing. */
  const pay = card.indexOf('<VendorDirectPay');
  const sentence = card.indexOf('{noMethods}');
  /* ✏️ EVOLVED 2026-09-20 (owner: "better to say amount to pay … not just for
     the downpayment but also for the next payments"). The button's words
     changed; what is asserted — pay first, then record — did not. */
  const record = card.indexOf("{declined ? 'Send it again' : 'Record payment'}");
  assert.ok(pay > 0, 'the deposit step does not mount the pay sheet');
  assert.ok(sentence > 0, 'the no-methods sentence is not rendered');
  assert.ok(record > 0, 'the Record deposit button is gone');
  assert.ok(pay < record && sentence < record, 'paying no longer comes before recording');
  // The pay step renders only while a deposit is owed, and the owed rule is the
  // record/refusal/ack one — not a second invention.
  assert.match(card, /const owed = \(!recorded \|\| declined\) && !acked;/);
  /* ✏️ EVOLVED 2026-09-20: the one pay sheet also serves the NEXT installment
     (Amount to pay), so its gate is `payDue` — built from `owed`, not a second
     invention. ✏️ EVOLVED again the same day ("nothing due now" is its own
     state): a not-due-yet installment adds no CTA of its own — it only opens
     the SAME pay sheet if the couple chooses to pay early. */
  assert.match(
    card,
    /const payDue = \(owed && firstPaymentOffered\) \|\| later !== null \|\| \(notDueYet !== null && earlyOpen\);/,
  );
  assert.match(card, /\{payDue \? \(/, 'the pay step is not gated on what is owed');
  // Exactly one pay sheet in the card.
  assert.equal(card.split('<VendorDirectPay').length - 1, 1);
  // …and it is still handed the supplier's methods. Asserted separately, so
  // the anchor above can be about ORDER and this can be about WIRING.
  assert.match(card, /methods=\{payMethods\}/, 'the pay sheet is no longer given the methods');
  assert.match(card, /vendorName=\{vendorName\}/, 'the pay sheet is no longer told whose it is');
  /* 🔑 AND THE FIGURE THE SUPPLIER ASKED FOR. Without it the sheet cannot mint
     a code carrying the amount, and falls back to saying it must be typed —
     which is honest, but is not what the owner asked for on 2026-09-20. */
  assert.match(card, /amountPhp=\{minimumPhp\}/, 'the pay sheet is not told the figure asked for');
});

test('the workspace hands the card the methods AND the read’s outcome', () => {
  const page = read(WORKSPACE);
  assert.match(page, /readPublishedMethodsForCouple\(/, 'the workspace reads without an outcome');
  assert.match(page, /payMethods=\{directPayMethods\}/);
  assert.match(page, /payMethodsState=\{directPayState\}/);
});

test('every failed read in the couple’s fetch is "unreadable", never an empty list', () => {
  const src = read(SERVER_READS);
  for (const e of ['evError', 'vpError', 'rowsError']) {
    assert.match(src, new RegExp(`if \\(${e}\\) return unreadable;`), `${e} collapses to []`);
  }
  // One visibility rule, shared with the supplier’s nudge — no private copy.
  assert.doesNotMatch(src, /method_type !== 'link'/, 'a second copy of the link/Pro rule');
  assert.ok(
    (src.match(/isCoupleVisible\(/g) ?? []).length >= 2,
    'the couple fetch and the proposal fetch must both use the shared rule',
  );
});

test('after Lock, the couple has a next step on the Vendors page', () => {
  const locked = read(BUILD_LOCKED);
  assert.match(
    locked,
    /<DepositLine\s+step=\{depositStepByVendorId\?\.get\(r\.vendorId\)\}\s+href=\{depositStepHref\(eventId, r\.vendorId\)\}/,
    'the locked row no longer carries the deposit step',
  );
  assert.match(locked, /'Pay your deposit'/);
  const page = read(VENDORS_PAGE);
  assert.match(page, /depositStepByVendorId=\{depositStepByVendorId\}/, 'the page never passes it');
  assert.match(page, /filter\(\(v\) => v\.status === 'contracted'\)/, 'the deposit ask widened past contracted');
});

test('the tile says what it measures — build picks NOT yet locked', () => {
  const locked = read(BUILD_LOCKED);
  assert.match(locked, /<LockTile k="Still to lock" v=\{pesoFromPhp\(money\.inBuildPhp\)/);
  assert.doesNotMatch(locked, /k="In build"/, '"In build ₱0" beside a locked supplier is back');
});

test('the mobile team chip says the same thing as the tile — "to lock", never "in build"', () => {
  // AREA-COUPLE 2026-09-19: the tile was renamed, the chip under the thumb still
  // read "1 locked · 0 in build" right after a lock. Both the visible text and
  // the screen-reader summary are counted.
  const chip = read('../app/dashboard/[eventId]/vendors/_components/team-summary-chip.tsx');
  const toLock = chip.match(/\{inBuildCount\} to lock/g) ?? [];
  console.log(`chip "to lock" occurrences: ${toLock.length}`);
  assert.equal(toLock.length, 2, 'visible text + aria summary');
  assert.doesNotMatch(chip, /in build/i, 'the chip says "in build" again');
});

test('the supplier is asked at the moment it matters — on the ask, and on a booked client', () => {
  const client = read(CLIENT_PAGE);
  const feed = read(FEED);
  // The client page: once inside LockRequestAnswer, once for a booked client.
  assert.equal(
    (client.match(/<PayoutMethodNudge readiness=\{payoutReadiness\} context="lock" \/>/g) ?? []).length,
    1,
  );
  assert.equal(
    (client.match(/<PayoutMethodNudge readiness=\{payoutReadiness\} context="client" \/>/g) ?? []).length,
    1,
  );
  assert.match(client, /payoutReadiness=\{payoutReadiness\}/, 'LockRequestAnswer never receives it');
  // The Overview feed's booking-ask card.
  const body = feed.slice(feed.indexOf('function LockRequestBody('));
  assert.ok(feed.indexOf('function LockRequestBody(') > 0);
  assert.match(
    body.slice(0, body.indexOf('Agree to this booking')),
    /<PayoutMethodNudge readiness=\{payoutReadiness\} context="lock" \/>/,
    'the nudge is not on the ask card, above Agree',
  );
  assert.match(read(OVERVIEW), /payoutReadiness=\{payoutReadiness\}/, 'the overview never passes it');
});
