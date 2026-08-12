import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLOSED_SHOP_SLUG_ENTITY_TYPE,
  RETIRED_SLUG_HOLD_MONTHS,
  closedShopSlugHeldUntil,
} from './closed-shop-slug';
import { SLUG_FORWARDING_MONTHS } from './slug-forwarding-window';
import { SLUG_CONFLICT_MESSAGE } from './slug-availability';

test('a shop closing today releases its address two years later', () => {
  // Fixed instant, not `new Date()` — a test that recomputes the same
  // arithmetic as the code and compares the two agrees with itself no matter
  // what either one says.
  //
  // ⚠ WAS ONE YEAR (owner-locked 2026-08-10). Owner 2026-08-12: "make it 2
  // years", aligning a retired address with the forwarding window.
  const closed = new Date('2026-08-10T00:00:00.000Z');
  assert.equal(closedShopSlugHeldUntil(closed), '2028-08-10T00:00:00.000Z');
});

test('the hold lands on the SAME CALENDAR DATE, leap years included', () => {
  // Day-count arithmetic drifts through a leap year — 730 days from 1 Mar 2027
  // is 28 Feb 2029, a day early, silently. Month arithmetic keeps "two years"
  // meaning the same date, which is what a person reads it as.
  const closed = new Date('2027-03-01T00:00:00.000Z');
  assert.equal(closedShopSlugHeldUntil(closed), '2029-03-01T00:00:00.000Z');
});

test('a date that does not exist in the target month rolls FORWARD, never back', () => {
  // 29 Feb 2028 + 24 months: February 2030 has no 29th. Rolling forward to
  // 1 Mar holds the address a day LONGER; rolling back would release it a day
  // EARLY, and every one of these numbers exists to stop an early release.
  const closed = new Date('2028-02-29T00:00:00.000Z');
  assert.equal(closedShopSlugHeldUntil(closed), '2030-03-01T00:00:00.000Z');
});

test('the hold is DERIVED from the forwarding window — one number, not two', () => {
  // Two constants for "how long is an address unavailable" is how a correction
  // at one site becomes a contradiction at the other.
  assert.equal(RETIRED_SLUG_HOLD_MONTHS, SLUG_FORWARDING_MONTHS);
  assert.equal(RETIRED_SLUG_HOLD_MONTHS, 24);
});

test('a closed address is refused for its own reason, not the rename one', () => {
  // A closed shop's address sends nobody anywhere. Reusing the forwarding
  // wording would tell whoever tried to take it something plainly untrue, and
  // would hide the only fact that matters to them — that the word frees up.
  const retired = SLUG_CONFLICT_MESSAGE.retired_shop;
  assert.ok(retired?.trim());
  assert.notEqual(retired, SLUG_CONFLICT_MESSAGE.forwarding);
  assert.match(retired, /closed/i);
  assert.match(retired, /year/i, 'the message must say when it frees up');
  assert.doesNotMatch(
    retired,
    /sends visitors|redirect/i,
    'a closed shop forwards nobody anywhere — do not claim it does',
  );
});

test('every conflict reason has a message a person can act on', () => {
  for (const [reason, message] of Object.entries(SLUG_CONFLICT_MESSAGE)) {
    assert.ok(message.trim().length > 10, `${reason} has no usable message`);
  }
});

test('the availability check refuses a held address before it explains it away', () => {
  // 🔑 ORDER MATTERS AND IS EASY TO LOSE. Both rows live in the same ledger, and
  // the forwarding probe matches on old_slug alone — so if it ran first, a
  // closed shop's address would be refused with wording about redirects that do
  // not exist. Same answer, wrong reason, and the reason is the whole message.
  const src = readFileSync(join(process.cwd(), 'lib/slug-availability.ts'), 'utf8');
  const retiredAt = src.indexOf("return 'retired_shop'");
  const forwardingAt = src.indexOf("return 'forwarding'");
  assert.ok(retiredAt > 0 && forwardingAt > 0);
  assert.ok(
    retiredAt < forwardingAt,
    'the forwarding probe now runs first and will claim a closed address redirects somewhere',
  );
});

test('the check fails closed — an unreadable ledger never means "free"', () => {
  const src = readFileSync(join(process.cwd(), 'lib/slug-availability.ts'), 'utf8');
  const block = src.slice(
    src.indexOf('const retired = await admin'),
    src.indexOf("return 'retired_shop'"),
  );
  assert.match(
    block,
    /retired\.error\) return 'unverified'/,
    'a failed read must not fall through to handing out a held address',
  );
});

test('erasure holds the address BEFORE the scrub takes it away', () => {
  // The scrub sets business_slug to NULL. Read it after that and there is
  // nothing left to hold — the address would be free the same minute. This is
  // an ordering bug that no amount of correct code downstream can fix.
  const purge = readFileSync(join(process.cwd(), 'lib/erasure/purge.ts'), 'utf8');
  const hold = purge.indexOf("'vendor-slug-hold'");
  const scrub = purge.indexOf("'vendor-profile-anonymize'");
  assert.ok(hold > 0 && scrub > 0);
  assert.ok(hold < scrub, 'the slug is read after the scrub has already nulled it');
});

test('erasure removes the seat through the one door that may empty a shop', () => {
  const purge = readFileSync(join(process.cwd(), 'lib/erasure/purge.ts'), 'utf8');
  assert.match(
    purge,
    /rpc\('erase_vendor_seats', \{\s*p_user_id: targetUserId,?\s*\}\)/,
    'the seat delete must go through the erasure function, or the last-admin guard refuses it',
  );
  // And it must run BEFORE the generic loop, whose plain delete is the one that
  // was being refused for every real person.
  assert.ok(
    purge.indexOf("erase_vendor_seats") < purge.indexOf('for (const { table, column } of SUBJECT_ROW_DELETES)'),
    'the generic delete runs first and is refused before the exemption is used',
  );
});

test('the entity type is its own word, not a reused one', () => {
  assert.equal(CLOSED_SHOP_SLUG_ENTITY_TYPE, 'vendor_closed');
  assert.notEqual(CLOSED_SHOP_SLUG_ENTITY_TYPE, 'vendor');
});
