/**
 * 👥🧾 The TS mirror of the claimed per-guest follow (migration 20271343652941) and the one line the couple reads.
 * The DB test (`tests/db/a-claimed-per-guest-price-follows-the-guest-list.db.test.ts`) holds SQL and this equal.
 *
 * Run (from apps/web): tsx --test lib/claimed-per-guest-follow.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followClaimedPerGuest, followFromRows, guestFollowLine, perGuestTotal, type ClaimedPerGuestFacts } from './claimed-per-guest-follow';

const base: ClaimedPerGuestFacts = {
  agreedTotalPhp: 162000,
  agreedGuests: 120,
  billedNow: 120,
  totalNowPhp: 162000,
  count: 120,
  locked: false,
  paidPhp: 0,
  changesPhp: 0,
};

test('👥 a per-head total follows guests — the rate is the booking’s own total ÷ guests agreed', () => {
  assert.deepEqual(followClaimedPerGuest({ ...base, count: 130 }), { billed: 130, totalPhp: 175500 });
  // Back down, never under the guests agreed — exactly the total agreed again.
  assert.deepEqual(followClaimedPerGuest({ ...base, billedNow: 130, totalNowPhp: 175500, count: 90 }), { billed: 120, totalPhp: 162000 });
  // Sideways is no move.
  assert.equal(followClaimedPerGuest({ ...base, count: 100 }), null);
});

test('🔒 a locked total holds when guests leave, and still rises when they come', () => {
  const locked = { ...base, locked: true, billedNow: 130, totalNowPhp: 175500 };
  assert.equal(followClaimedPerGuest({ ...locked, count: 90 }), null);
  assert.deepEqual(followClaimedPerGuest({ ...locked, count: 140 }), { billed: 140, totalPhp: 189000 });
});

test('💸 paid stays — a drop goes only as far as whole guests fit over what is paid, or not at all', () => {
  const at130 = { ...base, billedNow: 130, totalNowPhp: 175500, count: 90 };
  assert.deepEqual(followClaimedPerGuest({ ...at130, paidPhp: 170000 }), { billed: 126, totalPhp: 170100 });
  // Accepted change lines count toward the agreed total now.
  assert.deepEqual(followClaimedPerGuest({ ...at130, paidPhp: 170000, changesPhp: 8100 }), { billed: 120, totalPhp: 162000 });
  // Paid more than the total it bills now → nothing unsettled to take it from.
  assert.equal(followClaimedPerGuest({ ...at130, paidPhp: 180000 }), null);
});

test('🧮 the total is to the centavo, and returns to the total agreed exactly', () => {
  assert.equal(perGuestTotal(100000, 120, 121), 100833.33);
  assert.equal(perGuestTotal(100000, 120, 120), 100000);
});

test('🗣 the one line says why — and never a made-up count', () => {
  assert.equal(guestFollowLine({ agreedGuests: 120, billedGuests: 130 }), 'Follows your guest list · 130 guests counted, 120 agreed');
  assert.equal(guestFollowLine({ agreedGuests: 1200, billedGuests: 1200 }), 'Follows your guest list · never below the 1,200 guests agreed');
  assert.equal(guestFollowLine(null), null);
  assert.equal(guestFollowLine({ agreedGuests: 0, billedGuests: 0 }), null);
});

test('📖 a follow row is trusted only while it describes the booking', () => {
  assert.deepEqual(followFromRows(120, { agreed_guests: 120, billed_guests: 130 }), { agreedGuests: 120, billedGuests: 130 });
  assert.deepEqual(followFromRows(120, null), { agreedGuests: 120, billedGuests: 120 }, 'never followed → bills the guests agreed');
  assert.deepEqual(followFromRows(150, { agreed_guests: 120, billed_guests: 130 }), { agreedGuests: 150, billedGuests: 150 }, 're-agreed since');
  assert.equal(followFromRows(null, { agreed_guests: 120, billed_guests: 130 }), null);
});
