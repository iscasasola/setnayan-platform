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
import { readdirSync, readFileSync, statSync } from 'node:fs';
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
  waivedFeeCopy,
  feeDueCopy,
  feeDueStage,
  feePesos,
  freeBookingsLeftAfter,
  totalDuePhp,
  type DueFeeBill,
  type WaivedFeeCharge,
} from '@/lib/booking-fee-disclosure';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

/** Every non-test source under app/ and lib/, comments stripped. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}
const SOURCES: ReadonlyMap<string, string> = new Map(
  ['app', 'lib'].flatMap((d) =>
    sourceFiles(join(WEB, d)).map(
      (f) => [f.slice(WEB.length + 1), stripComments(readFileSync(f, 'utf8'))] as const,
    ),
  ),
);

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
  // ⚠ ANCHORED PER FUNCTION, NOT COUNTED FILE-WIDE. A whole-file count of
  // `return FEE_BILLS_UNREADABLE` cannot say WHICH read is honest — it stayed
  // green at 1 while a second fetch was added, and would stay green if the two
  // swapped which one had it.
  for (const fn of ['fetchDueFeeBills', 'fetchWaivedFeeCharges']) {
    const body = server.slice(server.indexOf(`export async function ${fn}(`));
    const scoped = body.slice(0, body.indexOf('\n}') + 2);
    assert.ok(scoped.length > 100, `${fn} was not found`);
    assert.equal(
      count(scoped, /return FEE_BILLS_UNREADABLE;/),
      1,
      `${fn} no longer distinguishes a refused read from an empty one`,
    );
  }
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
    { kind: 'billable', ordinal: 6, ordinalIsFrozen: true, schedule: BOOKING_FEE },
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

/**
 * 🔑 OWNER, 2026-09-20: *"still tell them that there should be a booking fee.
 * but this will be considered free. or something like this."*
 *
 * A free booking that says only "Free" teaches the supplier there is no fee,
 * and the sixth arrives as a surprise charge — the very defect this lane
 * exists to remove, deferred by five bookings. So a waived booking must NAME
 * the amount and then say it is waived, and why.
 *
 * SABOTAGE: drop the amount from the free headline ("Booking fee — waived.")
 * → RED on the amount assertion. SABOTAGE: return the old bare
 * "Free — booking 3 of your first 5" → RED on BOTH the amount and the bare-Free
 * scan below.
 */
test('a waived booking names the amount it would have cost, and why it is free', () => {
  const free = bookingFeeForecast(
    { kind: 'free', ordinal: 3, ordinalIsFrozen: true, schedule: BOOKING_FEE },
    10_170,
  );
  assert.ok(free, 'silence on a free booking is the old defect');
  // The amount is the SAME number the charge records (prod's waived row carries
  // computed_fee_centavos 50850 against a ₱10,170 booking).
  assert.equal(bookingFeePhp(10_170, BOOKING_FEE), 508.5);
  assert.match(free.headline, /₱508\.50/, 'the waived line did not name the amount');
  assert.match(free.headline, /waived/i, 'the waived line did not say it was waived');
  assert.match(free.detail, /booking 3 of your first 5/, 'the reason is missing the position');
  assert.match(free.detail, /which are free/, 'the reason is missing WHY it is waived');
  assert.match(free.detail, /2 more free bookings/);

  // The last free one says so, and the next is payable.
  const last = bookingFeeForecast(
    { kind: 'free', ordinal: FREE_BOOKING_LIMIT, ordinalIsFrozen: true, schedule: BOOKING_FEE },
    10_170,
  )!;
  assert.match(last.detail, /last of them/);

  // 🔑 SAME LINE SHAPE once the free five are used up — the first payable fee
  // is the same sentence with a different verdict, not a new kind of news.
  const payable = bookingFeeForecast(
    { kind: 'billable', ordinal: 6, ordinalIsFrozen: true, schedule: BOOKING_FEE },
    10_170,
  )!;
  for (const line of [free.headline, payable.headline]) {
    assert.match(line, /^Booking fee ₱508\.50/, `"${line}" broke the shared line shape`);
  }
  assert.match(payable.headline, /payable/i);

  // A projection is worded as one — before the booking is agreed there is no
  // ledger row, so "this is booking 3" would be stating a fact we do not have.
  const projected = bookingFeeForecast(
    { kind: 'free', ordinal: 3, ordinalIsFrozen: false, schedule: BOOKING_FEE },
    10_170,
  )!;
  assert.match(projected.detail, /would be booking 3/);

  // No amount ⇒ no number, and still no bare "Free".
  const noTotal = bookingFeeForecast(
    { kind: 'free', ordinal: 2, ordinalIsFrozen: false, schedule: BOOKING_FEE },
    null,
  )!;
  assert.match(noTotal.headline, /waived/i);
  assert.doesNotMatch(noTotal.headline, /₱/, 'it printed a figure it could not compute');

  // An imported client is free forever and says so; only a dark fee system is silent.
  assert.match(bookingFeeForecast({ kind: 'not_sourced' }, 50_000)!.headline, /No Setnayan booking fee/);
  assert.equal(bookingFeeForecast({ kind: 'silent' }, 50_000), null);
});

/**
 * The same rule for a charge that ALREADY EXISTS. These had NO supplier surface
 * at all: a waived charge mints no `orders` row and every fee surface read
 * orders, so a shop's free bookings appeared nowhere.
 *
 * SABOTAGE: drop `computedPhp` from the headline → RED. SABOTAGE: make the
 * null-amount branch print `feePesos(0)` → RED on the ₱0 scan.
 */
test('a waived CHARGE names its recorded amount, and never degrades to ₱0', () => {
  const charge: WaivedFeeCharge = {
    chargeId: '44f2b06b-f583-4a23-a81f-b21310e3c843',
    eventId: '2d4f1144-7816-4367-9c99-6ff0f9a6de10',
    coupleName: 'Rosa & Ben',
    computedPhp: 508.5, // prod: computed_fee_centavos 50850, amount_charged 0
    ordinal: 1,
    waivedOn: '2026-09-19',
  };
  const copy = waivedFeeCopy(charge);
  assert.match(copy.headline, /₱508\.50/);
  assert.match(copy.headline, /waived/i);
  assert.match(copy.headline, /Rosa & Ben/);
  assert.match(copy.detail, /booking 1 of your first 5/);
  assert.match(copy.detail, /which are free/);

  // An unreadable computed amount prints NO number — never ₱0, which would say
  // the fee was nothing rather than that it was waived.
  const unread = waivedFeeCopy({ ...charge, computedPhp: null });
  assert.match(unread.headline, /could not read the amount/);
  assert.doesNotMatch(`${unread.headline} ${unread.detail}`, /₱/);

  // The position is only claimed when the ledger gave one.
  const noOrdinal = waivedFeeCopy({ ...charge, ordinal: null });
  assert.doesNotMatch(noOrdinal.detail, /booking \d+ of/);
  assert.match(noOrdinal.detail, /inside your first 5/);
});

/**
 * THE BARE "Free" SCAN — across every producer and every mount.
 *
 * SABOTAGE: add `headline: 'Free'` to any arm → RED.
 */
test('nothing anywhere renders a bare "Free" with no amount', () => {
  const produced = [
    bookingFeeForecast({ kind: 'free', ordinal: 1, ordinalIsFrozen: true, schedule: BOOKING_FEE }, 10_170),
    bookingFeeForecast({ kind: 'free', ordinal: 5, ordinalIsFrozen: false, schedule: BOOKING_FEE }, 200),
    bookingFeeForecast({ kind: 'free', ordinal: 2, ordinalIsFrozen: true, schedule: BOOKING_FEE }, null),
    waivedFeeCopy({
      chargeId: 'c', eventId: null, coupleName: null,
      computedPhp: 508.5, ordinal: 2, waivedOn: null,
    }),
  ];
  for (const d of produced) {
    assert.ok(d);
    assert.doesNotMatch(
      d.headline,
      /^Free\b|^\s*Free\s*$/,
      `"${d.headline}" is a bare Free — owner 2026-09-20: name the fee, then say it is waived`,
    );
    assert.match(
      d.headline,
      /Booking fee/,
      `"${d.headline}" does not name the booking fee at all`,
    );
  }

  // And the FREE arm must be able to compute a figure at all: the standing has
  // to carry the schedule. Without it the copy can only say "Free".
  const server = read('lib/booking-fee-disclosure.server.ts');
  assert.match(
    server,
    /kind: 'free', ordinal, ordinalIsFrozen, schedule/,
    'the free standing lost its schedule — the waived amount becomes uncomputable',
  );
});

/**
 * The position must be the REAL ordinal the RPC stamped, read off
 * `booking_fee_ledger.booking_ordinal` — not a count derived on this side
 * (owner's instruction, 2026-09-20).
 *
 * SABOTAGE: delete the `.eq('event_id', ...)` ledger-row read so every standing
 * falls through to the count → RED (nothing is ever frozen).
 */
test('the free-5 position comes off the ledger, not a local count', () => {
  const server = read('lib/booking-fee-disclosure.server.ts');
  const standing = server.slice(
    server.indexOf('export async function resolveBookingFeeStanding'),
    server.indexOf('export async function feeBaseTotalPhp'),
  );
  // ⚠ ANCHOR ON WHAT DISTINGUISHES THE TWO READS, NOT ON THE TABLE.
  // This assertion first used `indexOf("from('booking_fee_ledger')")` — and BOTH
  // blocks read that table, so the first match was whichever came first and the
  // comparison was vacuous. Reordering the two blocks kept it GREEN. The real
  // ordinal is the one that SELECTS `booking_ordinal` for this event; the
  // projection is the one that asks for a COUNT.
  const ledgerRow = standing.indexOf("select('booking_ordinal')");
  const countFallback = standing.indexOf("count: 'exact'");
  assert.ok(ledgerRow > 0, 'the real ordinal is no longer selected at all');
  assert.ok(countFallback > 0, 'the projection fallback vanished');
  assert.ok(
    ledgerRow < countFallback,
    'the derived count is consulted BEFORE the real ordinal — the position would be a guess',
  );
  assert.equal(count(standing, /ordinalIsFrozen = true;/), 1, 'nothing marks the real ordinal as real');

  // The waived list takes its ordinal by JOIN, never by counting.
  assert.match(
    server,
    /ledger:booking_fee_ledger!inner\(booking_ordinal\)/,
    'the waived charges stopped joining the ledger for the ordinal',
  );
});

/**
 * A waived charge is shown wherever a supplier reads their fees.
 *
 * SABOTAGE: delete <WaivedFeeRows> from the fee hub → RED, named.
 */
test('every waived charge surface really mounts it', () => {
  const WAIVED_MOUNTS = [
    'app/vendor-dashboard/booking-fees/page.tsx',
    'app/vendor-dashboard/clients/[eventId]/page.tsx',
    'app/vendor-dashboard/earnings/surface.tsx',
  ];
  for (const file of WAIVED_MOUNTS) {
    const src = read(file);
    assert.equal(
      count(src, /<WaivedFeeRows\b/),
      1,
      `${file} must show the waived fee exactly once — a free booking priced at nothing is the old defect`,
    );
    assert.ok(
      /fetchWaivedFeeCharges\(/.test(src),
      `${file} mounts the rows without reading any waived charge`,
    );
  }
  // The client page shows only ITS OWN couple's waived charge.
  assert.match(
    read('app/vendor-dashboard/clients/[eventId]/page.tsx'),
    /clientWaivedRead\.filter\(\(c\) => c\.eventId === eventId\)/,
    'the client page would show another couple’s waived fee',
  );
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

  // FEE-HONEST, one layer down: the two reads that dress the notification (the
  // due date and the couple's name) fail to `null`, and the sentence still
  // sends one fact shorter. A bare `return null` there is the
  // `result-dropped-silently` shape — the reason must be recorded.
  // SABOTAGE: replace either logQueryError with a bare `return null` → RED.
  for (const fn of ['readChargeDueDate', 'readEventDisplayName']) {
    const body = lock.slice(lock.indexOf(`async function ${fn}(`));
    const scoped = body.slice(0, body.indexOf('\n}') + 2);
    assert.ok(scoped.length > 50, `${fn} was not found in the charge path`);
    assert.match(
      scoped,
      new RegExp(`logQueryError\\('booking-fee-lock\\.${fn}'`),
      `${fn} swallows a refused read — the notification loses a fact and says why to nobody`,
    );
  }
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

/**
 * ⏱ CROSS-LANE TRIPWIRE — the overdue sentence has an expiry date it cannot see.
 *
 * `feeDueCopy` tells an overdue supplier *"your booking is not affected"*, and
 * the test above proves that is TRUE TODAY by checking that
 * `vendor-room-access-rule.ts` never reads the fee. But a parallel lane
 * (`claude/fee-unlocks-the-event`) is building enforcement in NEW modules —
 * `lib/event-access-stage.ts` and `lib/vendor-event-fee-access.server.ts`,
 * behind `NEXT_PUBLIC_FEE_UNLOCKS_EVENT`, default OFF — which the access-rule
 * check cannot see. When that flag flips, my sentence becomes a LIE and nothing
 * above would go red: the two lanes would be two voices on one subject, each
 * passing its own suite.
 *
 * 🔑 That is the exact failure this repo keeps re-learning (MEMORY: "two
 * mechanisms that disagree about one fact each pass their own suite"), so the
 * tripwire is armed NOW, while it costs nothing: today the flag name appears
 * nowhere and this passes trivially. The moment enforcement lands, it fails and
 * names what has to change.
 *
 * SABOTAGE: add the flag name to any non-test source → RED (verified).
 */
const FEE_ENFORCEMENT_FLAG = 'NEXT_PUBLIC_FEE_UNLOCKS_EVENT';

test('if fee enforcement lands, the overdue copy must stop saying "not affected"', () => {
  // ANCHOR: a walker that found nothing would pass this vacuously.
  assert.ok(SOURCES.size > 500, `only ${SOURCES.size} sources walked — the walker is broken`);

  const enforcers = [...SOURCES]
    .filter(([f, src]) => src.includes(FEE_ENFORCEMENT_FLAG) && f !== 'lib/booking-fee-disclosure.ts')
    .map(([f]) => f);
  if (enforcers.length === 0) return; // enforcement has not landed — nothing to reconcile.

  assert.ok(
    SOURCES.get('lib/booking-fee-disclosure.ts')?.includes(FEE_ENFORCEMENT_FLAG),
    `${FEE_ENFORCEMENT_FLAG} is now live in ${enforcers.join(', ')}, so an overdue booking CAN ` +
      'lose access — but feeDueCopy still tells the supplier "your booking is not affected". ' +
      'Make that sentence read the same flag, so the promise and the enforcement cannot disagree.',
  );
});
