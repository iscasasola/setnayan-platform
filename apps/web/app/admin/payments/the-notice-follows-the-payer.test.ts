/**
 * the-notice-follows-the-payer.test.ts — an admin's approval tells the RIGHT
 * person, in their own words, and points them somewhere they can actually open.
 *
 * ── The defect (owner, live production, 2026-09-20) ─────────────────────────
 * The first real booking fee Setnayan ever collected: order `S89O-DW67KBQADN`,
 * reference `SN9B7485DD`, ₱837.50, paid by the SUPPLIER Saysay
 * (`9f1d8c74-…`) against a booking for the couple's event `cc47d373-…`.
 * Approving it emitted two notifications and two matching emails:
 *
 *   payment_matched  "Payment of ₱838 matched · order SN9B7485DD"
 *   order_paid       "Order SN9B7485DD marked paid"
 *
 * and BOTH carried `related_url = /dashboard/cc47d373-…/orders/7d1a014d-…`.
 *
 * 🔑 TWO FAULTS, ONE ROW. The amount was rounded to a figure that exists
 * nowhere — not in `payments.amount_php`, not in the order, not in the bank
 * message. And the destination was the COUPLE's planning dashboard, handed to
 * a supplier, because six copies of one expression asked the order for an
 * `event_id` and read its presence as "the payer owns this celebration". On a
 * booking fee it means only *the fee is FOR this event*.
 *
 * ⚠ IT WAS A DEAD END, NOT A LEAK, AND THAT DISTINCTION IS PINNED BELOW.
 * `app/dashboard/[eventId]/layout.tsx` demands an `event_members` row of
 * `member_type = 'couple'` or an accepted, non-removed `event_moderators` row
 * and `notFound()`s otherwise — BEFORE it reads one field of the event. A
 * supplier holds neither, so they were sent to a 404 with somebody else's
 * celebration in the URL. `the-event-dashboard-is-shut-to-non-members` fails
 * if that gate ever weakens, so this file can never quietly become the only
 * thing standing between a shop and a couple's data.
 *
 * ── What this suite pins ────────────────────────────────────────────────────
 *  1. PER PAYER TYPE, the destination — EXECUTED through the shared resolver,
 *     not grepped: a supplier's fee notice goes to their own fee page, a
 *     couple's order notice keeps today's route, and neither borrows the
 *     other's.
 *  2. PER PAYER TYPE, the wording — the `order_paid` body no longer promises a
 *     supplier that Setnayan will "start work right away" on the fee they owe
 *     us.
 *  3. THE AMOUNT KEEPS ITS CENTAVOS in the notification title AND therefore in
 *     the email subject, because `lib/notification-emit.ts` composes the
 *     subject FROM the title — asserted as a chain, so breaking either half
 *     goes red.
 *  4. THE EMIT SITES ARE COUNTED. Six notice sites exist in
 *     `app/admin/payments/actions.ts` and every one is the single adapter;
 *     a seventh added later cannot hand-roll a URL without failing here.
 *  6. EVERY DESTINATION IS A ROUTE THAT EXISTS — see the last test for why
 *     this file now has to say so itself.
 *  5. ONE RULE, TWO SURFACES — the notice link and the `/pay` back control
 *     render the SAME `orderLane`. A second lane rule is what let the page get
 *     fixed while the notification stayed wrong.
 *
 * Every source scan runs through `stripComments` from `lib/strip-comments.ts`,
 * so the quotations in this file's own docblock — and the long notes in
 * `actions.ts` that quote the old broken expression verbatim — can never
 * satisfy or trip an assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isBookingFeeOrder,
  isCoupleOnlyRoute,
  orderLane,
  orderNoticeLink,
  orderNoticeLinkForRow,
  orderPaidBody,
  orderPaidBodyForRow,
  payBackLink,
} from '@/lib/pay-back-link';
import { bookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import { formatPhp } from '@/lib/orders';
import { stripComments } from '@/lib/strip-comments';

// test:unit runs from apps/web, so cwd IS the web root.
const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const ACTIONS = stripComments(read('app/admin/payments/actions.ts'));
const EMIT = stripComments(read('lib/notification-emit.ts'));
const LAYOUT = stripComments(read('app/dashboard/[eventId]/layout.tsx'));

/** The live row, field for field (orders, production, 2026-09-20). */
const SUPPLIER = '9f1d8c74-1c7f-4735-9daa-83a65076b388';
const COUPLE = 'b19e1830-76b5-438e-a7d5-9c327376f2c9';
const EVENT = 'cc47d373-04ba-43cc-b8c9-b45813c182e8';
const SHOP = 'd266c234-3aca-46c3-b1c8-6a5c78e3f310';
const ORDER = '7d1a014d-54ec-4e66-b882-03a085f5f7ca';
/** ₱837.50 — the charge whose centavos went missing. */
const CHARGE_PHP = 837.5;

/**
 * The supplier's booking fee, exactly as the row reads: a shop is the payer,
 * AND the order carries the couple's event. Answering yes to both is what made
 * the old rule pick the wrong one.
 */
const FEE = {
  orderId: ORDER,
  isBookingFee: true,
  eventId: EVENT,
  vendorProfileId: SHOP,
  ownerUserId: SUPPLIER,
  recipientUserId: SUPPLIER,
} as const;

/** A couple's own purchase on their own celebration — the untouched case. */
const COUPLE_ORDER = {
  orderId: ORDER,
  isBookingFee: false,
  eventId: EVENT,
  vendorProfileId: null,
  ownerUserId: COUPLE,
  recipientUserId: COUPLE,
} as const;

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE DESTINATION, PER PAYER TYPE
// ───────────────────────────────────────────────────────────────────────────

test("a supplier's booking-fee notice goes to that fee, never the couple", () => {
  const href = orderNoticeLink(FEE);
  assert.equal(href, `/vendor-dashboard/booking-fees/${ORDER}`);
  // The exact regression, named two ways: not the route shape, and not the id.
  assert.equal(
    isCoupleOnlyRoute(href!),
    false,
    'the supplier is pointed at a route only that event’s couple can open',
  );
  assert.doesNotMatch(href!, new RegExp(EVENT));
});

test("a couple's own order notice keeps the route it always had", () => {
  assert.equal(
    orderNoticeLink(COUPLE_ORDER),
    `/dashboard/${EVENT}/orders/${ORDER}`,
    'the couple lost the deep link this change was not supposed to touch',
  );
});

test('a shop bill with no celebration behind it lands in the shop', () => {
  assert.equal(
    orderNoticeLink({ ...FEE, isBookingFee: false, eventId: null }),
    '/vendor-dashboard',
  );
});

test('an order with nothing attached links nowhere rather than somewhere wrong', () => {
  assert.equal(
    orderNoticeLink({
      orderId: ORDER,
      isBookingFee: false,
      eventId: null,
      vendorProfileId: null,
      ownerUserId: COUPLE,
      recipientUserId: COUPLE,
    }),
    null,
    'a notice would rather link to a 404 than admit it has nowhere to send the reader',
  );
});

test('the RECIPIENT decides, not the order — a couple reading a fee notice is not sent to the shop', () => {
  // The same fee order, addressed to the couple (they can reach it through
  // their event; they cannot reach the shop's lane at all).
  assert.equal(
    orderNoticeLink({ ...FEE, recipientUserId: COUPLE }),
    `/dashboard/${EVENT}/orders/${ORDER}`,
  );
  // And an unknown recipient is never handed a shop lane on a guess.
  assert.equal(
    orderNoticeLink({ ...FEE, recipientUserId: null }),
    `/dashboard/${EVENT}/orders/${ORDER}`,
  );
});

test('the booking fee is recognised from the fee lane’s own service_key', () => {
  assert.equal(isBookingFeeOrder(bookingFeeLockServiceKey('charge-1')), true);
  assert.equal(isBookingFeeOrder('papic_addon_thank_you'), false);
  assert.equal(isBookingFeeOrder(null), false);
  // …and a real key routes the whole way through, so the flag is not merely
  // parseable but actually consulted by the destination.
  assert.equal(
    orderNoticeLink({
      ...FEE,
      isBookingFee: isBookingFeeOrder(bookingFeeLockServiceKey('charge-1')),
    }),
    `/vendor-dashboard/booking-fees/${ORDER}`,
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE WORDING, PER PAYER TYPE
// ───────────────────────────────────────────────────────────────────────────

test("a supplier settling their fee is not told Setnayan will start work", () => {
  const body = orderPaidBody(FEE);
  assert.doesNotMatch(
    body,
    /start work/i,
    'the supplier is promised work that Setnayan does not do on a fee they owe us',
  );
  assert.doesNotMatch(body, /celebration|wedding/i);
  assert.match(body, /booking fee/i);
});

test('a couple keeps the words they always had', () => {
  assert.match(orderPaidBody(COUPLE_ORDER), /start work right away/i);
});

test('every couple-only noun in the paid notice is lane-gated, not global', () => {
  // The shape that matters: the two lanes must not produce the same sentence,
  // or the resolver is being called and discarded.
  assert.notEqual(orderPaidBody(FEE), orderPaidBody(COUPLE_ORDER));
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · THE AMOUNT, IN THE TITLE AND THEREFORE IN THE SUBJECT
// ───────────────────────────────────────────────────────────────────────────

test('the shared formatter keeps the centavos it is given', () => {
  assert.equal(formatPhp(CHARGE_PHP), '₱837.50');
  assert.notEqual(formatPhp(CHARGE_PHP), '₱838');
  // A whole-peso amount must NOT grow a decorative ".00" — the fix was about
  // never losing a real centavo, not about restyling every figure.
  assert.equal(formatPhp(2499), '₱2,499');
});

test('the notification titles on this path are built by that formatter', () => {
  // Each money-naming title in the file must interpolate formatPhp rather than
  // any private spelling of a peso.
  const titles = ACTIONS.match(/title:[^\n]*\n?[^\n]*/g) ?? [];
  const moneyTitles = titles.filter((t) => t.includes('₱') || t.includes('formatPhp'));
  assert.ok(moneyTitles.length >= 2, `expected money-naming titles, saw ${moneyTitles.length}`);
  for (const t of moneyTitles) {
    assert.match(t, /formatPhp\(/, `a title names money without the shared formatter: ${t}`);
  }
  // And no surface here re-implements one.
  assert.doesNotMatch(
    ACTIONS,
    /maximumFractionDigits:\s*0[\s\S]{0,80}?style:\s*'currency'|style:\s*'currency'[\s\S]{0,80}?maximumFractionDigits:\s*0/,
    'a peso formatter that rounds to the whole peso has reappeared on the money path',
  );
});

test('the EMAIL SUBJECT is the title, so one fix reaches both', () => {
  // The chain that makes claim 3 true end to end. If emit ever composes its
  // own subject, the centavo fix stops reaching the inbox silently.
  assert.match(
    EMIT,
    /subject:\s*title\b/,
    'the email subject no longer comes from the notification title',
  );
  assert.match(
    EMIT,
    /\$\{appUrl\}\$\{relatedUrl\}/,
    'the email link no longer comes from relatedUrl — the destination fix would stop reaching the inbox',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · THE EMIT SITES ARE COUNTED
// ───────────────────────────────────────────────────────────────────────────

test('every relatedUrl in the admin payments actions goes through the adapter', () => {
  const sites = ACTIONS.match(/relatedUrl:\s*[^\n]+/g) ?? [];
  assert.equal(
    sites.length,
    6,
    `expected the 6 known emit sites, saw ${sites.length} — a new notice must ` +
      `route through noticeLinkFor(), and this count is the thing that says so`,
  );
  for (const site of sites) {
    assert.match(
      site,
      /noticeLinkFor\(/,
      `an emit site builds its own URL instead of asking the resolver: ${site}`,
    );
  }
  // The hand-rolled expression, in any of its spellings, is gone from the
  // executable source — comments quoting it are stripped above.
  assert.doesNotMatch(
    ACTIONS,
    /`\/dashboard\/\$\{[^}]*event_id[^}]*\}/,
    'the event-first URL has grown back in executable code',
  );
});

test('the row→lane mapping is EXECUTED, and it reads every load-bearing column', () => {
  // 🔴 THIS TEST EXISTS BECAUSE ITS FIRST VERSION WAS USELESS. The mapping used
  // to live inside `actions.ts`, which a test cannot import, so the guard did
  // the only thing it could: assert the string `vendorProfileId:` appeared.
  // A sabotage run replaced `vendorProfileId: order?.vendor_profile_id ?? null`
  // with `vendorProfileId: null` — which sends every supplier back to the
  // couple's dashboard, i.e. reinstates the production defect in full — and the
  // suite STAYED GREEN. The key was still there; only its value had changed.
  //
  // 🔑 A GUARD THAT CHECKS A KEY CANNOT SEE WHAT THE KEY IS ASSIGNED. The
  // mapping moved into the pure `lib/pay-back-link.ts` so it can be run. Below
  // it IS run, against the live row's own shape.
  const row = {
    event_id: EVENT,
    vendor_profile_id: SHOP,
    user_id: SUPPLIER,
    service_key: bookingFeeLockServiceKey('charge-1'),
  };
  assert.equal(
    orderNoticeLinkForRow(row, ORDER, SUPPLIER),
    `/vendor-dashboard/booking-fees/${ORDER}`,
    'the row form no longer routes the supplier to their own fee',
  );
  assert.equal(
    orderPaidBodyForRow(row, ORDER, SUPPLIER).includes('start work'),
    false,
    'the row form no longer lane-gates the wording',
  );

  // Each column is load-bearing: drop it from the ROW and the destination must
  // change. This is what proves the mapping reads it, rather than merely
  // mentioning it.
  for (const column of ['vendor_profile_id', 'user_id', 'service_key'] as const) {
    const without = { ...row, [column]: null };
    assert.notEqual(
      orderNoticeLinkForRow(without, ORDER, SUPPLIER),
      `/vendor-dashboard/booking-fees/${ORDER}`,
      `\`${column}\` is not actually consulted — the mapping ignores it`,
    );
  }
  // And the recipient is read, not assumed from the row.
  assert.equal(
    orderNoticeLinkForRow(row, ORDER, COUPLE),
    `/dashboard/${EVENT}/orders/${ORDER}`,
    'the recipient is ignored — the row alone decides, which is the old bug',
  );

  // `actions.ts` must hold NO mapping of its own, or a second copy can drift
  // away from the one this test executes.
  assert.doesNotMatch(
    ACTIONS,
    /orderNoticeLink\(\{|orderPaidBody\(\{/,
    'actions.ts hand-builds the lane inputs again — a copy no test can execute',
  );
  assert.match(
    ACTIONS,
    /orderNoticeLinkForRow as noticeLinkFor/,
    'the adapter is no longer the shared row form',
  );
});

test('every order read that feeds a notice carries the columns the lane needs', () => {
  // A select that omits `vendor_profile_id` leaves the resolver correct and its
  // INPUT wrong — the worst shape available, because the code still compiles,
  // still calls the right function, and still returns the couple's route.
  //
  // ⚠ THIS WALKS FROM THE EMIT SITE TO ITS OWN DECLARATION rather than scanning
  // every `.select()` in the file. A file-wide scan convicted an innocent read:
  // `handlePaymentProof` has its own local `order` selecting `event_id` alone,
  // which feeds a signed image URL and no notice at all. A guard that fires on
  // code it was not written for teaches the next person to widen it.
  const sites = [...ACTIONS.matchAll(/noticeLinkFor\(\s*(\w+)\s*,\s*([^,]+),\s*([^)]+)\)/g)];
  assert.equal(sites.length, 6, `expected 6 adapter calls, saw ${sites.length}`);

  for (const site of sites) {
    // ⚠ `string | undefined`, not `string`. Destructuring a RegExp match under
    // `noUncheckedIndexedAccess` widens every group, and CI's typecheck is where
    // that surfaced — so the groups are read and CHECKED, never asserted away
    // with a `!` that would hide a regex that stopped capturing.
    const rowName = site[1];
    const recipientArg = site[3];
    const at = site.index!;
    assert.ok(
      rowName && recipientArg,
      `the emit-site pattern stopped capturing its arguments: ${site[0]}`,
    );

    // The recipient is a PERSON's id, never an order field standing in for one.
    assert.match(
      recipientArg,
      /\.user_id\b/,
      `an emit site guesses its recipient instead of naming one: ${site[0]}`,
    );

    // The nearest declaration of this row that precedes the call.
    let decl = -1;
    for (const d of ACTIONS.matchAll(new RegExp(`const \\{\\s*data:\\s*${rowName}\\b`, 'g'))) {
      if (d.index! < at) decl = d.index!;
      else break;
    }
    assert.notEqual(decl, -1, `no read declares \`${rowName}\` before it is handed to the adapter`);

    const selAt = ACTIONS.indexOf('.select(', decl);
    assert.notEqual(selAt, -1, `the read behind \`${rowName}\` selects nothing`);
    const open = ACTIONS.indexOf("'", selAt);
    const columns = ACTIONS.slice(open + 1, ACTIONS.indexOf("'", open + 1));

    for (const column of ['event_id', 'user_id', 'vendor_profile_id', 'service_key']) {
      assert.ok(
        new RegExp(`\\b${column}\\b`).test(columns),
        `the read behind \`${rowName}\` omits ${column}, so the lane falls back ` +
          `to guessing — columns were: ${columns}`,
      );
    }
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · ONE RULE, TWO SURFACES
// ───────────────────────────────────────────────────────────────────────────

test('the notice link and the /pay back control render the same lane', () => {
  // Not "they agree today" — they are the same decision, asked of the same
  // function. Proven by driving both from one lane across every payer shape.
  const shapes = [FEE, COUPLE_ORDER, { ...FEE, eventId: null }, { ...FEE, recipientUserId: COUPLE }];
  for (const shape of shapes) {
    const lane = orderLane({ ...shape, viewerUserId: shape.recipientUserId });
    const back = payBackLink({ ...shape, viewerUserId: shape.recipientUserId });
    const notice = orderNoticeLink(shape);
    if (lane.kind === 'vendor-booking-fee') {
      assert.match(back.href, /^\/vendor-dashboard\/booking-fees\//);
      assert.match(notice!, /^\/vendor-dashboard\/booking-fees\//);
    }
    if (lane.kind === 'event') {
      assert.match(back.href, /^\/dashboard\//);
      assert.match(notice!, /^\/dashboard\//);
    }
    // The invariant that actually matters: a shop lane and a couple lane are
    // never handed to the same reader for the same order.
    assert.equal(
      isCoupleOnlyRoute(back.href),
      notice ? isCoupleOnlyRoute(notice) : false,
      `the two surfaces disagree about who this reader is: ${JSON.stringify(shape)}`,
    );
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · EVERY DESTINATION IS A ROUTE THAT EXISTS
// ───────────────────────────────────────────────────────────────────────────

/** Directories under `apps/web/<dir>` whose names start with `prefix`. */
function subdirs(dir: string, prefix: string): string[] {
  return readdirSync(join(WEB, dir), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(prefix))
    .map((e) => e.name);
}

/**
 * Does the App Router actually serve this path?
 *
 * Three ways a segment can be satisfied, and missing any one of them makes a
 * perfectly good route look absent:
 *   · the literal directory;
 *   · a `[param]` directory, which a concrete id fills;
 *   · a `(group)` directory, which is TRANSPARENT to the URL — `/dashboard` is
 *     served by `app/dashboard/(launcher)/page.tsx`, so the group is re-entered
 *     for the SAME segment rather than consuming it.
 */
function servesRoute(dir: string, segments: readonly string[]): boolean {
  if (segments.length === 0) {
    return (
      existsSync(join(WEB, dir, 'page.tsx')) ||
      subdirs(dir, '(').some((g) => servesRoute(join(dir, g), segments))
    );
  }
  const [head, ...rest] = segments;
  if (existsSync(join(WEB, dir, head!)) && servesRoute(join(dir, head!), rest)) return true;
  if (subdirs(dir, '[').some((d) => servesRoute(join(dir, d), rest))) return true;
  return subdirs(dir, '(').some((g) => servesRoute(join(dir, g), segments));
}

test('every link the resolver can produce lands on a real page', () => {
  // 🔑 THIS TEST EXISTS BECAUSE THIS PR CREATED THE GAP IT CLOSES.
  // `apps/web/scripts/lint-email-links.mjs` is a blocking CI guard: it finds
  // every `relatedUrl` assigned a STRING LITERAL and refuses any with no
  // `page.tsx` behind it — a notification is also an email, and a dead link in
  // an inbox outlives the tray badge.
  //
  // Moving the six literals into a function was the right change AND it made
  // that guard blind to this file: it reports 99 links repo-wide and not one of
  // them is the payment desk's any more. So the coverage returns here, where the
  // destinations are enumerated from the resolver itself rather than from
  // whatever spelling happens to sit in the source.
  //
  // ⚠ The guard was ALSO tripped by this file's own docblock — it matched the
  // words `relatedUrl:` followed by a backtick and read the prose after it as a
  // route. That is why claim 4 above no longer writes the key with its colon.
  const destinations = new Set<string>();
  for (const recipient of [SUPPLIER, COUPLE, null]) {
    for (const shape of [
      FEE,
      COUPLE_ORDER,
      { ...FEE, isBookingFee: false },
      { ...FEE, eventId: null },
      { ...FEE, vendorProfileId: null },
      { ...COUPLE_ORDER, eventId: null },
    ]) {
      const href = orderNoticeLink({ ...shape, recipientUserId: recipient });
      if (href) destinations.add(href);
      // The `/pay` back control renders the same lane, so its routes belong to
      // the same enumeration — one rule, one list of destinations.
      destinations.add(payBackLink({ ...shape, viewerUserId: recipient }).href);
    }
  }
  assert.ok(destinations.size >= 4, `expected several destinations, saw ${destinations.size}`);

  for (const href of destinations) {
    assert.ok(
      servesRoute('app', href.split('/').filter(Boolean)),
      `the resolver can emit ${href}, and no page.tsx serves it — that is a dead ` +
        `link in somebody's inbox`,
    );
  }

  // The check has teeth: a route that does NOT exist must be rejected, or the
  // loop above passes for every string it is ever handed.
  assert.equal(servesRoute('app', ['vendor-dashboard', 'booking-fees']), true);
  assert.equal(
    servesRoute('app', ['vendor-dashboard', 'booking-fees', 'x', 'y', 'z']),
    false,
    'the route check accepts anything — it proves nothing about the destinations',
  );

  // ⚠ AND ONE HONEST LIMIT, BECAUSE A GUARD THAT OVERSTATES ITSELF IS WORSE
  // THAN A NARROW ONE. `app/[slug]` is the public celebration vanity route, so
  // ANY single-segment path resolves — `/no-such-route-exists-here` included,
  // in the real app as much as in this function. The strength here is therefore
  // in the multi-segment destinations, which is where all three of the routes
  // this PR introduces live.
  assert.equal(servesRoute('app', ['literally-anything']), true);
});

// ───────────────────────────────────────────────────────────────────────────
// 7 · DEAD END, NOT A LEAK — pinned independently of everything above
// ───────────────────────────────────────────────────────────────────────────

test('the event dashboard is still shut to non-members, before it reads anything', () => {
  // This is WHY the production defect was a 404 and not a disclosure. It must
  // keep being true on its own: the guard above is about not sending people to
  // a dead end, never about being the thing that protects the couple.
  assert.match(LAYOUT, /from\('event_members'\)/);
  assert.match(LAYOUT, /from\('event_moderators'\)/);
  assert.match(LAYOUT, /notFound\(\)/);

  // 🔴 THE CONDITION IS PARSED, NOT MERELY FOUND. A sabotage run wrapped the
  // membership test in `if (false && (…))` — the gate disabled outright, every
  // non-member admitted — and an earlier version of this test stayed GREEN,
  // because `member_type !== 'couple'` was still present in the source and
  // `notFound()` still textually preceded the event read. A `match` cannot tell
  // a live condition from a dead one.
  const gateAt = LAYOUT.indexOf("member_type !== 'couple'");
  assert.notEqual(gateAt, -1, 'the layout no longer tests member_type at all');
  const ifAt = LAYOUT.lastIndexOf('if (', gateAt);
  assert.notEqual(ifAt, -1, 'the member_type test is not inside an if at all');
  const condition = LAYOUT.slice(ifAt + 'if ('.length, LAYOUT.indexOf(') {', gateAt));
  assert.equal(
    condition.replace(/\s+/g, ' ').trim(),
    "!membership || membership.member_type !== 'couple'",
    'the membership gate’s condition changed — read it before trusting it; a ' +
      'constant operand (`false &&`, `true ||`) disables the gate while leaving ' +
      'every string this test used to look for exactly where it was',
  );

  // The moderator fallback is the ONLY other way through, and it refuses.
  assert.match(
    LAYOUT,
    /if \(!moderator\) \{\s*notFound\(\);/,
    'the moderator fallback no longer refuses a non-moderator',
  );

  // And the refusal precedes the event read, so a non-member never reaches the
  // query that would return the couple's celebration.
  const gate = LAYOUT.indexOf('notFound()');
  const eventRead = LAYOUT.indexOf("from('events')");
  assert.ok(gate > 0 && eventRead > 0, 'the layout no longer has both halves to order');
  assert.ok(
    gate < eventRead,
    'the event is read BEFORE membership is refused — a dead end would become a leak',
  );
});
