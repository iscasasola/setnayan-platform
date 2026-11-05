/**
 * 🚪 BOOKINGS CLOSED — every door asks the switch BEFORE it books (owner 2026-11-02: *"for now, they cannot add
 * bookings"*). The database half is `tests/db/bookings-closed-switch.db.test.ts`.
 *
 * The property: inside each door's own function, `areBookingsOpen()` is consulted before the call that books
 * (or, for the fee, before the call that makes the money row). Reading the function — never the file — so a
 * gate left in a sibling function cannot vouch for a door that lost its own. Each gate only ever REFUSES, so
 * with the switch open every door runs exactly the code it ran before.
 *
 * Also held: the pure reading of the switch opens only on an explicit TRUE (NULL, the launch default, is closed).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { bookingsOpenFromSetting } from './bookings-open';

const WEB = join(__dirname, '..');

type Door = { n: string; file: string; fn: string; books: string };

/** The eight doors of the supplier gate audit (section B), each with the call that books / bills. */
const DOORS: ReadonlyArray<Door> = [
  { n: '1 · lock a package', file: 'app/dashboard/[eventId]/vendors/packages/actions.ts', fn: 'lockPackage', books: 'isMarketplaceVendorBookable(' },
  { n: '2 · lock a service', file: 'app/dashboard/[eventId]/vendors/actions.ts', fn: 'finalizeVendor', books: 'isMarketplaceVendorBookable(' },
  { n: '3 · the wizard', file: 'app/dashboard/[eventId]/wizard-actions.ts', fn: 'completeVendorPickFromMarketplace', books: 'isMarketplaceVendorBookable(' },
  { n: '4 · chat Book', file: 'lib/chat-lock-booking.server.ts', fn: 'bookVendorAtChatLock', books: 'isMarketplaceVendorBookable(' },
  { n: '5 · reuse a booking', file: 'lib/reusable-bookings.server.ts', fn: 'createReuseRequest', books: 'isMarketplaceVendorBookable(' },
  { n: '6 · the supplier’s yes', file: 'app/vendor-dashboard/clients/[eventId]/actions.ts', fn: 'vendorAgreeToLock', books: "rpc('vendor_agree_to_lock'" },
  { n: '7a · issue a Locked QR', file: 'app/vendor-dashboard/invite/actions.ts', fn: 'issueLockedQr', books: ".from('vendor_locked_qr_tokens')" },
  { n: '7b · claim a Locked QR', file: 'app/vendor/lock/[token]/actions.ts', fn: 'claimLockedQr', books: "rpc('vendor_claim_locked_qr'" },
  // 8 · a payment acknowledgement books nothing new the trigger would allow, but it is a fee door: the one
  // place a fee is made refuses while closed, and so does the render-time sweep that re-makes missed fees.
  { n: '8 · the fee (every door)', file: 'lib/booking-fee-mint.server.ts', fn: 'mintBookingFeeForBooking', books: 'collectBookingFeeAtLock(' },
];

/** The body of one top-level function: from its declaration to the next top-level declaration. */
function functionBody(source: string, fn: string): string | null {
  const start = source.search(new RegExp(`\\n(export )?async function ${fn}\\(`));
  if (start < 0) return null;
  const rest = source.slice(start + 1);
  const next = rest.slice(1).search(/\n(export )?(async )?function |\nexport (const|type) /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

for (const door of DOORS) {
  test(`door ${door.n}: ${door.fn} asks areBookingsOpen() before it books`, () => {
    const source = stripComments(readFileSync(join(WEB, door.file), 'utf8'));
    const body = functionBody(source, door.fn);
    assert.ok(body, `${door.fn} not found in ${door.file} — the door moved; point this guard at it`);
    const books = body.indexOf(door.books);
    assert.ok(books >= 0, `${door.fn} no longer calls ${door.books} — re-anchor this door on what it books with now`);
    // The switch itself, or its injected seam (`deps.bookingsOpen()`, door 4) whose default is `areBookingsOpen`.
    const gate = body.search(/areBookingsOpen\(|deps\.bookingsOpen\(\)/);
    assert.ok(gate >= 0, `${door.fn} (${door.file}) never asks areBookingsOpen() — it would book while bookings are closed`);
    if (body.includes('deps.bookingsOpen()')) {
      assert.match(source, /deps: \{ bookingsOpen: \(\) => Promise<boolean> \} = \{ bookingsOpen: areBookingsOpen \}/, 'the seam must default to the one switch');
    }
    assert.ok(gate < books, `${door.fn} asks areBookingsOpen() only AFTER ${door.books} — the booking happens first`);
  });
}

test('door 8: the four booking doors of the fee close with bookings (the catch-up sweep mints through catch_up)', async () => {
  const source = stripComments(readFileSync(join(WEB, 'lib/booking-fee-mint.server.ts'), 'utf8'));
  const set = source.slice(source.indexOf('CLOSES_WITH_BOOKINGS'), source.indexOf(']);', source.indexOf('CLOSES_WITH_BOOKINGS')));
  for (const door of ['supplier_yes', 'locked_qr_claim', 'deposit_acknowledged', 'catch_up']) {
    assert.ok(set.includes(`'${door}'`), `the ${door} fee door must make nothing while bookings are closed`);
  }
  const body = functionBody(source, 'mintBookingFeeForBooking') ?? '';
  assert.match(body, /CLOSES_WITH_BOOKINGS\.has\(args\.door\)/, 'the mint must ask the set with its own door');
  const sweep = functionBody(source, 'maybeCatchUpHandshakesWithoutFee') ?? '';
  // The sweep's door is an expression (a claim the couple approved re-mints through `claim_approved`, which is
  // deliberately NOT in the set; every other row goes through `catch_up`). Ask for `catch_up` inside the door's
  // value, not for one spelling of it.
  assert.match(sweep, /door:[^,}]*'catch_up'/, 'the sweep mints through the catch_up door, which closes with bookings');
});

test('the switch opens only on an explicit TRUE — NULL (the launch default), FALSE and junk are closed', () => {
  assert.equal(bookingsOpenFromSetting(true), true);
  for (const v of [null, undefined, false, 'true', 1, 0, {}]) {
    assert.equal(bookingsOpenFromSetting(v), false, `${JSON.stringify(v)} must read as closed`);
  }
});

test('the shop page swaps the package Book button for “Bookings open soon” while closed', () => {
  const source = stripComments(readFileSync(join(WEB, 'app/v/[slug]/page.tsx'), 'utf8'));
  const section = source.slice(source.indexOf('function VendorPackagesSection('));
  const closedBranch = section.indexOf('if (!bookingsOpen)');
  const modal = section.indexOf('<LockPackageModal');
  assert.ok(closedBranch >= 0 && modal >= 0, 'VendorPackagesSection must branch on bookingsOpen and still draw the modal when open');
  assert.ok(closedBranch < modal, 'the closed branch must be decided before the Book button is drawn');
  assert.ok(section.indexOf('BOOKINGS_OPEN_SOON') > closedBranch, 'the closed branch says “Bookings open soon”');
  assert.ok(source.includes('bookingsOpen={bookingsOpen}'), 'the page must hand the real switch to the section');
});
