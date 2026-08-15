/**
 * PR-H slice B · the pure cores that decide WHAT A COUPLE IS TOLD.
 *
 * Every test here drives BOTH flag states in one process — which is the whole
 * reason these modules take the flag as a parameter — and the flag-OFF half is
 * not padding: it is the assertion that today's production is byte-identical,
 * and it is the half that would catch a "small" simplification that quietly
 * turned the handshake on for everyone.
 *
 * Each test names the mutation that must turn it red. A test that names no
 * mutation has not been shown to be able to fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planChatLockBooking } from './chat-lock-booking';
import { resolveBenchCardActions, type BenchCardVendor } from './bench-card-actions';
import { timelineStatusOf } from './vendors-plan-budget';
import { waitingOnSupplier } from './explore-info-copy';
import { lockRequestStateOf } from './lock-request-state';

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE CHAT LOCK — the third path, the easiest to walk past.
// ───────────────────────────────────────────────────────────────────────────

const chat = (over: Partial<Parameters<typeof planChatLockBooking>[0]> = {}) =>
  planChatLockBooking({
    marketplaceVendorId: 'vp1',
    verified: true,
    currentStatus: 'considering',
    ...over,
  });

test('chat lock · flag OFF is byte-identical to production today', () => {
  assert.equal(chat(), 'book');
  assert.equal(chat({ currentStatus: 'deposit_paid' }), 'refresh_fee_only');
  assert.equal(chat({ marketplaceVendorId: null }), 'skip_no_link');
  assert.equal(chat({ verified: false }), 'blocked_not_verified');
  // A stale marker must not reach into the flag-off world at all.
  assert.equal(chat({ lockRequestState: 'pending' }), 'book');
  // MUTATION: drop the `if (!args.handshakeEnabled) return 'book'` line ⇒ the
  // last two assertions flip to 'request'/'already_requested' and this reddens.
});

test('chat lock · flag ON asks instead of booking', () => {
  assert.equal(chat({ handshakeEnabled: true }), 'request');
});

test('chat lock · a CONFIRMED status outranks any marker, in both worlds', () => {
  // The Locked-QR shape: promoted to deposit_paid without touching a lock_*
  // column, so it can carry a stale 'pending' forever. Reading the marker first
  // would re-open a paid booking as an unanswered question.
  assert.equal(
    chat({ handshakeEnabled: true, currentStatus: 'deposit_paid', lockRequestState: 'pending' }),
    'refresh_fee_only',
  );
  // MUTATION: move the `lockRequestState === 'pending'` check above the
  // CONFIRMED_LOCK_STATUSES check ⇒ 'already_requested', red.
});

test('chat lock · a second press on an outstanding ask is a no-op, not an error', () => {
  assert.equal(
    chat({ handshakeEnabled: true, lockRequestState: 'pending' }),
    'already_requested',
  );
  // Why this matters: the one-pending-request-per-group unique index REJECTS the
  // second write. Without this branch the couple meets a raw 23505 for pressing
  // the button the screen offered them.
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE BENCH CARD — Lock must not be offered on a question already asked.
// ───────────────────────────────────────────────────────────────────────────

const card = (over: Partial<BenchCardVendor> = {}): BenchCardVendor => ({
  status: 'considering',
  marketplaceVendorId: 'vp1',
  threadId: null,
  inquiryStatus: null,
  planGroupId: 'photography',
  priceBasisPhp: 50_000,
  ...over,
});

test('bench card · an outstanding ask replaces Lock with Withdraw', () => {
  const a = resolveBenchCardActions({
    enabled: true,
    vendor: card({ lockRequestState: 'requested' }),
    inBuild: false,
  });
  assert.equal(a.lockGroupId, null, 'Lock must not be offered on a question already asked');
  assert.equal(a.build, null, 'the category is no longer open for a build pick either');
  assert.deepEqual(a.withdraw, { kind: 'withdraw' });
  // 🔑 AND THE INQUIRY LEG SURVIVES. A couple waiting on an answer is exactly
  // who most needs to send a message; withholding it would be the opposite of
  // the fix. This assertion is the one most likely to be broken by a later
  // "simplification" that early-returns NO_ACTIONS on an ask.
  assert.deepEqual(a.inquiry, { kind: 'inquire' });
});

test('bench card · every other state is untouched', () => {
  const before = resolveBenchCardActions({ enabled: true, vendor: card(), inBuild: false });
  assert.equal(before.lockGroupId, 'photography');
  assert.equal(before.withdraw, null);
  for (const s of ['none', 'declined', 'cancelled', 'expired'] as const) {
    const a = resolveBenchCardActions({
      enabled: true,
      vendor: card({ lockRequestState: s }),
      inBuild: false,
    });
    assert.equal(a.lockGroupId, 'photography', `${s} must still offer Lock — it is askable again`);
    assert.equal(a.withdraw, null, `${s} has nothing to withdraw`);
  }
  // MUTATION: change `=== 'requested'` to `!= null` ⇒ four of these redden.
  // That is the realistic slip: "any marker means waiting" is wrong, because a
  // declined or expired ask is precisely a category the couple may re-open.
});

test('bench card · flag OFF offers nothing at all, ask or no ask', () => {
  const a = resolveBenchCardActions({
    enabled: false,
    vendor: card({ lockRequestState: 'requested' }),
    inBuild: false,
  });
  assert.equal(a.withdraw, null);
  assert.equal(a.lockGroupId, null);
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · THE PLANNING CLOCK — an ask must silence it, not accelerate it.
// ───────────────────────────────────────────────────────────────────────────

test("the clock · 'awaiting' is neither open nor settled", () => {
  // 30 days out on a category whose lead time makes it overdue: the couple has
  // done the only thing the countdown was pressing them to do.
  assert.equal(timelineStatusOf('photography', 30, 'awaiting'), 'awaiting');
  assert.equal(timelineStatusOf('photography', 30, 'considering'), 'overdue');
  assert.equal(timelineStatusOf('photography', 30, 'finalized'), 'locked');
  // And with NO event date at all — checked before the date branch on purpose,
  // so an undated event still stops nagging about a category it has asked about.
  assert.equal(timelineStatusOf('photography', null, 'awaiting'), 'awaiting');
  assert.equal(timelineStatusOf('photography', null, 'considering'), 'upcoming');
  // MUTATION: move the `state === 'awaiting'` check below the
  // `daysUntilWedding === null` branch ⇒ the fourth assertion reads 'upcoming'.
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · THE COPY — the number shown is the number enforced.
// ───────────────────────────────────────────────────────────────────────────

test('the waiting line rounds UP and never types a hardcoded 7', () => {
  const now = new Date('2026-08-16T00:00:00Z');
  assert.match(waitingOnSupplier('2026-08-23T00:00:00Z', now), /7 days left/);
  // 30 hours left is the couple's second-to-last day. Rounding DOWN would say
  // "1 day left" and read as the last one.
  assert.match(waitingOnSupplier('2026-08-17T06:00:00Z', now), /2 days left/);
  assert.match(waitingOnSupplier('2026-08-16T06:00:00Z', now), /1 day left/);
  assert.match(waitingOnSupplier('2026-08-15T00:00:00Z', now), /time to answer is up/);
  // No deadline read back ⇒ say nothing numeric rather than guess seven.
  assert.doesNotMatch(waitingOnSupplier(null, now), /\d/);
  assert.doesNotMatch(waitingOnSupplier('not-a-date', now), /\d/);
  // MUTATION: swap Math.ceil for Math.floor ⇒ the 30-hour case says "1 day".
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · THE SHARED DERIVATION still refuses to be re-derived.
// ───────────────────────────────────────────────────────────────────────────

test('a withdrawn ask reads as cancelled, and the category is askable again', () => {
  assert.equal(
    lockRequestStateOf({ status: 'considering', lock_request_state: 'cancelled' }, true),
    'cancelled',
  );
  // The bench proves the consequence: cancelled offers Lock, requested does not.
  assert.equal(
    resolveBenchCardActions({
      enabled: true,
      vendor: card({ lockRequestState: 'cancelled' }),
      inBuild: false,
    }).lockGroupId,
    'photography',
  );
});
