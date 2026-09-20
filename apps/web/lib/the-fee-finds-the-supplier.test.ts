/**
 * the-fee-finds-the-supplier.test.ts — the supplier is TOLD, and the bill is
 * REACHABLE.
 *
 * ── The defect, measured on production 2026-09-20 ──────────────────────────
 * The owner drove a real booking end to end as the supplier Saysay. Everything
 * on the money path worked:
 *   · `booking_fee_charges` S89F-HMS91HGPAK, pending, 83,750 centavos;
 *   · `orders` 7d1a014d-54ec-4e66-b882-03a085f5f7ca, ₱837.50, `submitted`;
 *   · a `payments` row in the admin queue;
 *   · an in-app notification + email, via `order_quoted`.
 * And the owner still said two things:
 *   · *"i never saw the payment screen to pay us."*
 *   · *"as a vendor i do not know i have to pay."*
 *
 * Because `VENDOR_BOOKING_FEES_PATH` was linked from ONE supplier surface
 * (`/vendor-dashboard/subscription`), and NOTHING in the product mentioned the
 * fee before the charge appeared. A correct bill nobody can find and nobody was
 * warned about is indistinguishable from a surprise charge.
 *
 * ── What this file holds ───────────────────────────────────────────────────
 *   1. THE PURE DECISION — which surface shows which bill, and the fact that a
 *      supplier with no pending fee sees nothing anywhere.
 *   2. THE MOUNTS — one per entry in `BOOKING_FEE_BILL_SURFACES`, counted, so
 *      deleting a mount fails rather than silently going back to one doorway.
 *   3. THE DISCLOSURE — all four places name the fee, and every number they
 *      print comes from `bookingFeePhp`, never a re-typed rate.
 *   4. BOTH ENDS — no couple surface may render the supplier's fee.
 *   5. NO ROUNDING — a ₱837.50 bill never reads "₱838" anywhere.
 *   6. OVERDUE IS HONEST — the copy promises no consequence, because the code
 *      implements none.
 *
 * 🛡 Mutation-checked: every rule below was broken on purpose and confirmed RED
 * before being trusted. The sabotages are listed beside each test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { bookingFeePhp, BOOKING_FEE } from '@/lib/booking-fee';
import { FREE_BOOKING_LIMIT } from '@/lib/booking-fee-lock';
import {
  BOOKING_FEE_BILL_SURFACES,
  billsForSurface,
  bookingFeeForecast,
  bookingFeeJoinDisclosure,
  bookingFeeNoticeCopy,
  feeDueCopy,
  feeDueStage,
  feePesos,
  freeBookingsLeftAfter,
  totalDuePhp,
  type DueFeeBill,
} from '@/lib/booking-fee-disclosure';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

/** The owner's own bill, to the centavo. */
const OWNERS_BILL: DueFeeBill = {
  orderId: '7d1a014d-54ec-4e66-b882-03a085f5f7ca',
  amountPhp: 837.5,
  eventId: 'cc47d373-04ba-43cc-b8c9-b45813c182e8',
  coupleName: 'Ana & Miguel',
  dueOn: '2026-09-27',
};

/* ═══ 1 · THE PURE DECISION ═════════════════════════════════════════════════ */

// SABOTAGE: `if (surface !== 'client') return list;` → `return list;`
// (the client page then shows every couple's fee). RED.
test('a bill reaches every supplier surface, and a client page shows only its own', () => {
  const other: DueFeeBill = { ...OWNERS_BILL, orderId: 'o2', eventId: 'other-event' };
  const bills = [OWNERS_BILL, other];

  assert.equal(billsForSurface(bills, 'today').length, 2);
  assert.equal(billsForSurface(bills, 'earnings').length, 2);

  const onThisClient = billsForSurface(bills, 'client', { eventId: OWNERS_BILL.eventId });
  assert.deepEqual(
    onThisClient.map((b) => b.orderId),
    [OWNERS_BILL.orderId],
    'one couple’s fee appeared on another couple’s page',
  );

  // A bill with no event belongs to no couple — guessing which would be worse
  // than not showing it.
  const orphan: DueFeeBill = { ...OWNERS_BILL, orderId: 'o3', eventId: null };
  assert.equal(billsForSurface([orphan], 'client', { eventId: 'any' }).length, 0);
  assert.equal(billsForSurface([orphan], 'client', {}).length, 0);
  assert.equal(billsForSurface([orphan], 'today').length, 1, 'the hub must still show it');
});

// SABOTAGE: drop the `amountPhp > 0` filter → a settled ₱0 row renders a bill. RED.
test('a supplier with no pending fee sees none of it, on every surface', () => {
  for (const surface of BOOKING_FEE_BILL_SURFACES) {
    assert.deepEqual(
      billsForSurface([], surface, { eventId: OWNERS_BILL.eventId }),
      [],
      `${surface} rendered something from an empty list`,
    );
  }
  // A ₱0 row is not a bill. Nothing is owed, so nothing is said.
  const zero: DueFeeBill = { ...OWNERS_BILL, amountPhp: 0 };
  for (const surface of BOOKING_FEE_BILL_SURFACES) {
    assert.deepEqual(billsForSurface([zero], surface, { eventId: zero.eventId }), []);
  }
  assert.equal(totalDuePhp([]), 0);
  assert.equal(totalDuePhp([OWNERS_BILL, { ...OWNERS_BILL, orderId: 'o2' }]), 1675);
});

/* ═══ 2 · THE MOUNTS ════════════════════════════════════════════════════════ */

/**
 * One mount per surface, anchored on the FILE and counted — a file-level match
 * cannot say which component holds it, and a count of 1 that becomes 0 is the
 * whole failure this guard exists to catch.
 */
const BILL_MOUNTS: Record<(typeof BOOKING_FEE_BILL_SURFACES)[number], { file: string; surfaceArg: RegExp }> = {
  today: {
    file: 'app/vendor-dashboard/page.tsx',
    surfaceArg: /billsForSurface\(feeBillsRead, 'today'\)/,
  },
  earnings: {
    file: 'app/vendor-dashboard/earnings/surface.tsx',
    surfaceArg: /billsForSurface\(feeBillsRead, 'earnings'\)/,
  },
  client: {
    file: 'app/vendor-dashboard/clients/[eventId]/page.tsx',
    surfaceArg: /billsForSurface\(clientFeeBillsRead, 'client', \{ eventId \}\)/,
  },
};

// SABOTAGE: delete `<BookingFeeBills` from the Today page → RED with the file
// named. SABOTAGE: change the client page's surface arg to 'today' → RED.
test('every surface in BOOKING_FEE_BILL_SURFACES really mounts the bill', () => {
  assert.ok(
    BOOKING_FEE_BILL_SURFACES.length >= 3,
    'the surface roster shrank — a fee that reaches fewer places is the original defect',
  );
  for (const surface of BOOKING_FEE_BILL_SURFACES) {
    const mount = BILL_MOUNTS[surface];
    assert.ok(mount, `${surface} is in the roster with no mount recorded`);
    const src = read(mount.file);
    assert.equal(
      count(src, /<BookingFeeBills\b/),
      1,
      `${mount.file} must mount <BookingFeeBills> exactly once (it is the ${surface} surface)`,
    );
    assert.equal(
      count(src, mount.surfaceArg),
      1,
      `${mount.file} must ask billsForSurface for '${surface}' — ${mount.surfaceArg.source}`,
    );
    // The door, not just the sentence. A row without a pay link reproduces the
    // original defect with better wording.
    assert.match(
      read('app/_components/booking-fee-notice.tsx'),
      /vendorBookingFeePayPath\(bill\.orderId\)/,
      'the bill row lost its Pay now link',
    );
  }
});

// SABOTAGE: return `[]` instead of FEE_BILLS_UNREADABLE on a refused read → RED.
test('an unreadable fee read is not an empty one', () => {
  const server = read('lib/booking-fee-disclosure.server.ts');
  assert.equal(count(server, /return FEE_BILLS_UNREADABLE;/), 1);
  for (const file of Object.values(BILL_MOUNTS).map((m) => m.file)) {
    assert.ok(
      /FEE_BILLS_UNREADABLE/.test(read(file)),
      `${file} does not distinguish "you owe nothing" from "we could not check"`,
    );
  }
});

/* ═══ 3 · THE DISCLOSURE — FOUR PLACES, ONE QUOTER ══════════════════════════ */

/**
 * The four places the owner named, each with the anchor that proves the fee is
 * spoken there. Three are Agree buttons and one is the quote composer; the
 * fourth disclosure (sign-up) is its own entry.
 */
const DISCLOSURE_MOUNTS: Array<[string, string, RegExp]> = [
  ['sign-up', 'app/open-shop/_components/open-shop-wizard.tsx', /open-shop-fee-disclosure/],
  ['quote builder', 'app/_components/proposal-maker.tsx', /<BookingFeeNotice disclosure=\{feeCopy\}/],
  ['quote shortcut', 'app/vendor-dashboard/messages/[threadId]/_components/send-proposal-card.tsx', /<BookingFeeNotice disclosure=\{feeCopy\}/],
  ['Agree · chat card', 'app/_components/lock-answer-forms.tsx', /<BookingFeeNotice disclosure=\{feeForecast\}/],
  ['Agree · Today feed', 'app/vendor-dashboard/_components/overview-sections.tsx', /<BookingFeeNotice disclosure=\{feeForecast\}/],
  ['Agree · client page', 'app/vendor-dashboard/clients/[eventId]/page.tsx', /<BookingFeeNotice disclosure=\{feeForecast\}/],
];

// SABOTAGE: remove <BookingFeeNotice> from lock-answer-forms.tsx → RED, named.
test('the fee is named before the supplier commits — all four places', () => {
  for (const [what, file, anchor] of DISCLOSURE_MOUNTS) {
    assert.equal(
      count(read(file), anchor),
      1,
      `${what} (${file}) no longer names the booking fee — the supplier learns it from the bill`,
    );
  }
});

// SABOTAGE: put the notice BELOW the <form action={agreeLock}> → RED.
// A fee named after the press is a receipt, not a disclosure.
test('every Agree button names the fee ABOVE itself, not after', () => {
  const agreeSurfaces: Array<[string, RegExp]> = [
    ['app/_components/lock-answer-forms.tsx', /action=\{agreeLock\}/],
    ['app/vendor-dashboard/_components/overview-sections.tsx', /action=\{agreeLock\}/],
    ['app/vendor-dashboard/clients/[eventId]/page.tsx', /action=\{vendorAgreeToLock\}/],
  ];
  for (const [file, formRe] of agreeSurfaces) {
    const src = read(file);
    const notice = src.indexOf('<BookingFeeNotice');
    const form = src.search(new RegExp(formRe.source));
    assert.ok(notice >= 0 && form >= 0, `${file}: missing the notice or the agree form`);
    assert.ok(
      notice < form,
      `${file}: the fee is disclosed AFTER the Agree button — that is a receipt, not a disclosure`,
    );
  }
});

// SABOTAGE: hard-code '5%' into bookingFeeForecast instead of the summary → RED.
test('every printed fee comes from bookingFeePhp — no surface types a rate', () => {
  const disclosure = read('lib/booking-fee-disclosure.ts');
  assert.match(disclosure, /bookingFeePhp\(total, standing\.schedule\)/);
  assert.match(disclosure, /bookingFeeScheduleSummary\(standing\.schedule\)/);

  // The composers price off the SAME pure function, never a local estimate.
  for (const file of [
    'app/_components/proposal-maker.tsx',
    'app/vendor-dashboard/messages/[threadId]/_components/send-proposal-card.tsx',
  ]) {
    assert.equal(count(read(file), /bookingFeeForecast\(/), 1, `${file} must use the one quoter`);
  }

  // And the sentence agrees with the arithmetic on the owner's real booking.
  const billable = bookingFeeForecast(
    { kind: 'billable', ordinal: 6, schedule: BOOKING_FEE },
    16_750,
  );
  assert.ok(billable);
  assert.equal(bookingFeePhp(16_750, BOOKING_FEE), 837.5);
  assert.match(billable.headline, /₱837\.50/);
  assert.match(billable.headline, /5\.0%/);
});

// SABOTAGE: return `null` for the 'unreadable' arm → RED. A failed read that
// renders nothing is read as "there is no fee".
test('an uncomputable fee says so — it never guesses a rate', () => {
  const unreadable = bookingFeeForecast({ kind: 'unreadable' }, null);
  assert.ok(unreadable, 'a failed read rendered nothing, which reads as "no fee"');
  assert.match(unreadable.detail, /have not checked/);
  assert.doesNotMatch(
    `${unreadable.headline} ${unreadable.detail}`,
    /\d\s*%|₱\s*\d/,
    'the unreadable copy printed a number it did not measure',
  );

  // Same rule at sign-up: no schedule ⇒ no rate on screen, but still a warning.
  const noSchedule = bookingFeeJoinDisclosure(null);
  assert.match(noSchedule.detail, new RegExp(`first ${FREE_BOOKING_LIMIT} of those are free`));
  assert.doesNotMatch(noSchedule.detail, /%/, 'sign-up printed a rate it could not load');
  assert.match(bookingFeeJoinDisclosure(BOOKING_FEE).detail, /5% of the first/);
});

// SABOTAGE: make the free arm return null → RED.
test('a free booking SAYS it is free, and counts what is left', () => {
  const free = bookingFeeForecast({ kind: 'free', ordinal: 3 }, 16_750);
  assert.ok(free, 'silence on a free booking is the old defect');
  assert.match(free.headline, new RegExp(`booking 3 of your first ${FREE_BOOKING_LIMIT}`));
  assert.match(free.detail, /2 more free bookings/);
  assert.equal(freeBookingsLeftAfter(FREE_BOOKING_LIMIT), 0);
  assert.match(
    bookingFeeForecast({ kind: 'free', ordinal: FREE_BOOKING_LIMIT }, 1)!.detail,
    /last of your free bookings/,
  );
  // An imported client is free forever and says so.
  assert.match(bookingFeeForecast({ kind: 'not_sourced' }, 50_000)!.headline, /No Setnayan booking fee/);
  // Only a dark fee system is silent.
  assert.equal(bookingFeeForecast({ kind: 'silent' }, 50_000), null);
});

/* ═══ 4 · BOTH ENDS ═════════════════════════════════════════════════════════ */

// SABOTAGE: import BookingFeeNotice into a app/dashboard/** page → RED.
test('the couple is never shown the supplier’s fee', () => {
  const coupleSurfaces = [
    'app/dashboard/[eventId]/vendors/page.tsx',
    'app/dashboard/[eventId]/budget/page.tsx',
  ];
  for (const file of coupleSurfaces) {
    const src = read(file);
    assert.doesNotMatch(
      src,
      /BookingFeeNotice|BookingFeeBills|booking-fee-disclosure/,
      `${file} is a COUPLE surface and must never render the supplier's booking fee`,
    );
  }
  // The shared chat stream carries the forecast, so it must arrive as a PROP
  // the supplier's page passes — never resolved inside, where the couple's
  // render of the same component would pick it up.
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.doesNotMatch(
    stream,
    /booking-fee-disclosure\.server/,
    'the shared chat stream resolved the fee itself — the couple renders this file too',
  );
  assert.equal(count(stream, /feeForecast = null,/), 1, 'the couple’s render must default to silence');
});

/* ═══ 5 · NO ROUNDING ═══════════════════════════════════════════════════════ */

// SABOTAGE: set feePesos to maximumFractionDigits 0 → RED on every assertion.
test('a ₱837.50 bill never reads ₱838 — anywhere', () => {
  assert.equal(feePesos(837.5), '₱837.50');
  assert.match(feeDueCopy(OWNERS_BILL, '2026-09-20').headline, /₱837\.50/);
  assert.match(bookingFeeNoticeCopy(OWNERS_BILL).title, /₱837\.50/);
  assert.match(bookingFeeNoticeCopy(OWNERS_BILL).body, /Sep 27, 2026/);
  // The rounding formatter is GONE, not merely unused.
  assert.doesNotMatch(
    read('lib/vendor-booking-fees.ts'),
    /maximumFractionDigits: 0/,
    'the peso-rounding formatter came back',
  );
  assert.equal(
    count(read('lib/vendor-booking-fees.server.ts'), /bookingFeeNoticeCopy\(/),
    1,
    'the notification sweep stopped using the centavo-accurate copy',
  );
});

// SABOTAGE: delete the emitNotification call from collectBookingFeeAtLock → RED.
test('the bill notifies at the moment it opens, not on the next dashboard visit', () => {
  const lock = read('lib/booking-fee-lock.server.ts');
  assert.equal(count(lock, /emitNotification\(\{/), 1, 'the charge path stopped notifying');
  assert.match(lock, /type: 'order_quoted'/, "the type must stay on EMAIL_ENABLED_TYPES");
  assert.match(lock, /relatedUrl: vendorBookingFeePayPath\(orderId\)/, 'the deep link is the idempotency key');
  // …and the type really is on the allowlist, so the email actually sends.
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('EMAIL_ENABLED_TYPES'), emit.indexOf('MARKETING_GATED_EMAIL_TYPES'));
  assert.ok(/'order_quoted'/.test(allow), 'order_quoted fell off the email allowlist');
});

/* ═══ 6 · OVERDUE IS HONEST ═════════════════════════════════════════════════ */

// SABOTAGE: `if (days < 0) return 'overdue'` → `'due'` → RED.
test('the due date escalates by day, compared as strings', () => {
  assert.equal(feeDueStage('2026-09-27', '2026-09-20'), 'due');
  assert.equal(feeDueStage('2026-09-27', '2026-09-25'), 'soon');
  assert.equal(feeDueStage('2026-09-27', '2026-09-27'), 'last_day');
  assert.equal(feeDueStage('2026-09-27', '2026-09-28'), 'overdue');
  assert.equal(feeDueStage(null, '2026-09-28'), 'due', 'an unknown due date is not overdue');
  assert.equal(feeDueStage('nonsense', '2026-09-28'), 'due');
});

/**
 * 🔑 MEASURED, NOT ASSUMED (2026-09-20): `booking_fee_charges.expires_at` is
 * written and read by NOTHING — `cron.job` is empty on production, no TS reads
 * the column, the only writer of `status='expired'` is the amendment re-derive,
 * and room access comes from `lock_request_state = 'agreed'`
 * (`lib/vendor-room-access-rule.ts`), which never consults the fee.
 *
 * ⇒ When the date passes, NOTHING HAPPENS. So the copy may raise its voice and
 *   may not invent a consequence.
 *
 * SABOTAGE: add "your booking will be cancelled" to the overdue detail → RED.
 */
test('the overdue warning promises no consequence the code does not implement', () => {
  const overdue = feeDueCopy(OWNERS_BILL, '2026-10-05');
  assert.equal(overdue.tone, 'overdue');
  assert.match(overdue.headline, /overdue/i);
  assert.match(overdue.detail, /booking is not affected/);
  for (const invented of [
    /cancel/i,
    /suspend/i,
    /remove(d)? from/i,
    /lose access/i,
    /hidden from/i,
    /unpublish/i,
    /delisted/i,
  ]) {
    assert.doesNotMatch(
      overdue.detail,
      invented,
      `the overdue copy threatens ${invented} — no code implements it (cron.job is empty; access reads lock_request_state)`,
    );
  }
  // And the access rule really does ignore the fee, which is what makes the
  // sentence above true. If enforcement ever ships, this line fails first.
  const access = read('lib/vendor-room-access-rule.ts');
  assert.doesNotMatch(
    access,
    /booking_fee|bookingFee/,
    'access now consults the fee — the overdue copy must be rewritten to say so',
  );
});
