/**
 * THE WAY OUT OF /pay BELONGS TO WHOEVER IS PAYING.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🚨 Owner, 2026-09-20, paying his own ₱837.50 Setnayan booking fee as the
 * SUPPLIER Saysay: the back control read *"Back to your celebration"* and
 * pointed at `/dashboard/cc47d373-…`, Ana & Miguel's planning dashboard.
 * *"what is this? it is not working properly."*
 *
 * 🔑 THE CAUSE WAS A FACT READ AS A DIFFERENT FACT. The old rule asked the
 * order for an `event_id` and treated its presence as "the payer owns this
 * celebration". On a booking fee it means *the fee is FOR this event* — the
 * same row also carries `vendor_profile_id`, and its `user_id` is the supplier.
 *
 * ⚠ AND IT WAS A DEAD END, NOT A LEAK. `/dashboard/[eventId]/layout.tsx`
 * demands an `event_members` row of `member_type = 'couple'` or an accepted
 * moderator row and `notFound()`s otherwise; the supplier holds neither.
 * `the-event-dashboard-is-shut-to-non-members` below pins that the LAYOUT is
 * still the thing that refuses, so this guard cannot quietly become the only
 * protection.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { isCoupleOnlyRoute, payBackLink } from './pay-back-link';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** The live row, field for field (orders, prod, 2026-09-20). */
const SUPPLIER = '9f1d8c74-1c7f-4735-9daa-83a65076b388';
const COUPLE = 'b19e1830-76b5-438e-a7d5-9c327376f2c9';
const EVENT = 'cc47d373-04ba-43cc-b8c9-b45813c182e8';
const SHOP = 'd266c234-3aca-46c3-b1c8-6a5c78e3f310';
const ORDER = '7d1a014d-54ec-4e66-b882-03a085f5f7ca';

const BOOKING_FEE = {
  orderId: ORDER,
  isBookingFee: true,
  eventId: EVENT,
  vendorProfileId: SHOP,
  ownerUserId: SUPPLIER,
} as const;

test('the supplier paying their own booking fee goes back to that fee', () => {
  const back = payBackLink({ ...BOOKING_FEE, viewerUserId: SUPPLIER });
  assert.equal(back.href, `/vendor-dashboard/booking-fees/${ORDER}`);
  assert.match(back.label, /booking fee/i);
  assert.equal(
    isCoupleOnlyRoute(back.href),
    false,
    'the supplier is still pointed at a route only the couple can open',
  );
  // The exact regression, named: never the couple's dashboard.
  assert.doesNotMatch(back.href, new RegExp(EVENT));
  assert.doesNotMatch(back.label, /celebration/i);
});

test("a shop's eventless bill goes back to the shop", () => {
  const back = payBackLink({
    orderId: ORDER,
    isBookingFee: false,
    eventId: null,
    vendorProfileId: SHOP,
    ownerUserId: SUPPLIER,
    viewerUserId: SUPPLIER,
  });
  assert.equal(back.href, '/vendor-dashboard');
  assert.equal(isCoupleOnlyRoute(back.href), false);
});

test("a shop's event-scoped purchase still goes to the shop, not the couple", () => {
  // A Papic Challenge sponsorship: the shop pays, the event is whose it is for.
  const back = payBackLink({
    orderId: ORDER,
    isBookingFee: false,
    eventId: EVENT,
    vendorProfileId: SHOP,
    ownerUserId: SUPPLIER,
    viewerUserId: SUPPLIER,
  });
  assert.equal(back.href, '/vendor-dashboard');
  assert.equal(isCoupleOnlyRoute(back.href), false);
});

test("a couple paying their own order goes back to their celebration, as before", () => {
  const back = payBackLink({
    orderId: ORDER,
    isBookingFee: false,
    eventId: EVENT,
    vendorProfileId: null,
    ownerUserId: COUPLE,
    viewerUserId: COUPLE,
  });
  assert.equal(back.href, `/dashboard/${EVENT}`);
  assert.match(back.label, /celebration/i);
});

test('a couple who opens the supplier fee through their event is not sent to the shop', () => {
  // RLS admits an order to its event's members, so this page IS reachable by
  // the couple. Their way out must be a page that exists for THEM.
  const back = payBackLink({ ...BOOKING_FEE, viewerUserId: COUPLE });
  assert.equal(back.href, `/dashboard/${EVENT}`);
  assert.notEqual(back.href, '/vendor-dashboard');
});

test('an order with nothing attached still has a way out', () => {
  const back = payBackLink({
    orderId: ORDER,
    isBookingFee: false,
    eventId: null,
    vendorProfileId: null,
    ownerUserId: SUPPLIER,
    viewerUserId: SUPPLIER,
  });
  assert.equal(back.href, '/dashboard');
  assert.equal(isCoupleOnlyRoute(back.href), false);
});

test('a signed-out or unknown viewer is never handed a shop lane', () => {
  // `viewerUserId` null is "we do not know", which is not "they are the buyer".
  const back = payBackLink({ ...BOOKING_FEE, viewerUserId: null });
  assert.equal(back.href, `/dashboard/${EVENT}`);
});

test('isCoupleOnlyRoute convicts an event dashboard and nothing else', () => {
  assert.equal(isCoupleOnlyRoute(`/dashboard/${EVENT}`), true);
  assert.equal(isCoupleOnlyRoute(`/dashboard/${EVENT}/budget`), true);
  // ⚠ The account pages live under the same prefix and a supplier CAN open
  // every one of them. A prefix test would convict all four.
  for (const ok of ['/dashboard', '/dashboard/creator', '/dashboard/people', '/vendor-dashboard']) {
    assert.equal(isCoupleOnlyRoute(ok), false, `${ok} was wrongly called couple-only`);
  }
});

test('the payment page hands the resolver who is looking', () => {
  const src = stripComments(read('app/pay/[reference]/page.tsx'));
  const at = src.indexOf('fetchPayableByReference(');
  assert.notEqual(at, -1, 'the payment page no longer resolves a payable at all');
  // ⚠ SLICED TO THE CALL'S OWN CLOSING `);`, NOT A FIXED NUMBER OF CHARACTERS.
  // `stripComments` blanks a comment to SPACES of the same length, so a window
  // measured in characters grows and shrinks with the prose inside the call —
  // which is exactly the kind of guard that goes red for a reason nobody can
  // see. The argument list ends where the call does.
  const end = src.indexOf(');', at);
  assert.notEqual(end, -1, 'the call to fetchPayableByReference is unterminated');
  assert.match(
    src.slice(at, end),
    /\buser\.id\b/,
    'the page no longer tells the resolver who the viewer is, so the way out cannot follow them',
  );
});

test('the old event-first rule has not grown back', () => {
  const src = stripComments(read('lib/payable-by-reference.ts'));
  assert.match(src, /payBackLink\(/, 'the payable no longer uses the shared rule');
  assert.doesNotMatch(
    src,
    /Back to your celebration/,
    'payable-by-reference spells the celebration label again — the rule belongs in pay-back-link.ts',
  );
});

test('the event dashboard is still shut to non-members, independently of this', () => {
  // A wording fix must never become the only thing standing between a supplier
  // and a couple's planning pages.
  const layout = stripComments(read('app/dashboard/[eventId]/layout.tsx'));
  assert.match(layout, /from\('event_members'\)/);
  assert.match(layout, /member_type !== 'couple'/);
  assert.match(layout, /notFound\(\)/);
});
