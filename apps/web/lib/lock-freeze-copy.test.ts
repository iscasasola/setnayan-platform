/**
 * THE LOCK STEP MAY NOT CLAIM A BOOKING THAT DOES NOT EXIST.
 *
 * 🔴 WHAT THIS PINS. Pressing "🔒 Lock this deal" under PR-H only ASKS: the
 * booking row stays `considering` on a 48-hour fuse and the supplier's yes is
 * what books it. The card nonetheless stamped `locked_at` and rendered the one
 * hardcoded sentence "🔒 Deal locked — price frozen." for BOTH people —
 * including the supplier, above their own unanswered request.
 *
 * Every assertion below is a sentence somebody reads, not an implementation
 * detail: the booked words appear ONLY for a real booking, the two sides are
 * told different things while a request is out, and the unknown case degrades
 * to something that is true everywhere rather than to the lie.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lockFreezeLine } from '@/lib/lock-freeze-copy';
import type { LockRequestState } from '@/lib/lock-request-state';

const BOOKED_WORDS = /deal locked/i;
const ROLES = ['couple', 'vendor'] as const;
const ALL_STATES: LockRequestState[] = [
  'none',
  'requested',
  'declined',
  'cancelled',
  'expired',
  'locked',
];

test('only a REAL booking may say "Deal locked"', () => {
  for (const viewerRole of ROLES) {
    for (const state of ALL_STATES) {
      const line = lockFreezeLine({ state, viewerRole });
      if (state === 'locked') {
        assert.match(line.text, BOOKED_WORDS, `${viewerRole}/${state} should say it`);
        assert.equal(line.tone, 'booked');
      } else {
        assert.doesNotMatch(
          line.text,
          BOOKED_WORDS,
          `${viewerRole}/${state} claims a booking that does not exist`,
        );
        assert.notEqual(line.tone, 'booked');
      }
    }
  }
});

test('an ASK says nothing is booked yet, to BOTH people, in their own words', () => {
  const couple = lockFreezeLine({
    state: 'requested',
    viewerRole: 'couple',
    counterpartyLabel: 'Villa Catering',
  });
  const vendor = lockFreezeLine({
    state: 'requested',
    viewerRole: 'vendor',
    counterpartyLabel: 'Maria & Jose',
  });

  assert.equal(couple.tone, 'waiting');
  assert.equal(vendor.tone, 'waiting');
  // The two sides must NOT read the same sentence — that is what made one of
  // them wrong before.
  assert.notEqual(couple.text, vendor.text);
  assert.match(couple.text, /nothing is booked/i);
  assert.match(couple.text, /Villa Catering/);
  assert.match(vendor.text, /has asked you/i);
  assert.match(vendor.text, /Maria & Jose/);
  // Both still say the price is frozen — that part was always true.
  assert.match(couple.text, /frozen/i);
  assert.match(vendor.text, /frozen/i);
});

test('an ask still running shows the supplier how long they have', () => {
  const now = new Date('2026-09-10T00:00:00Z');
  const line = lockFreezeLine({
    state: 'requested',
    viewerRole: 'vendor',
    expiresAt: '2026-09-10T05:00:00Z',
    now,
  });
  assert.match(line.text, /5 hours left to answer/i);
});

test('no deadline read ⇒ no countdown invented', () => {
  const line = lockFreezeLine({ state: 'requested', viewerRole: 'couple', expiresAt: null });
  assert.doesNotMatch(line.text, /left to answer/i);
});

test('UNKNOWN degrades to a sentence that is true everywhere, never to the lie', () => {
  // A mount site that forgets the prop, an off-platform supplier with no
  // booking row, the handshake flag off — all land here.
  for (const viewerRole of ROLES) {
    for (const state of [undefined, null] as const) {
      const line = lockFreezeLine({ state, viewerRole });
      assert.equal(line.tone, 'frozen');
      assert.doesNotMatch(line.text, BOOKED_WORDS);
      assert.match(line.text, /frozen/i);
    }
  }
});

test('a closed ask says so, and tells the couple they can move on', () => {
  const declined = lockFreezeLine({ state: 'declined', viewerRole: 'couple' });
  assert.equal(declined.tone, 'closed');
  assert.match(declined.text, /pick someone else/i);

  const expired = lockFreezeLine({ state: 'expired', viewerRole: 'couple' });
  assert.equal(expired.tone, 'closed');
  assert.match(expired.text, /ask again/i);

  const cancelled = lockFreezeLine({ state: 'cancelled', viewerRole: 'vendor' });
  assert.equal(cancelled.tone, 'closed');
  assert.match(cancelled.text, /nothing is booked/i);
});

test('with no label, each side still gets a readable noun', () => {
  assert.match(
    lockFreezeLine({ state: 'requested', viewerRole: 'couple' }).text,
    /the supplier/i,
  );
  assert.match(lockFreezeLine({ state: 'requested', viewerRole: 'vendor' }).text, /the couple/i);
});
