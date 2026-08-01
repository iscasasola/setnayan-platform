/**
 * Unit suite for the manual payment-channel kill switch + cap meter
 * (2026-08-01).
 *
 * These guard money-facing behaviour: which rails a couple is offered, what
 * the server accepts, and when the owner is warned that a personal account is
 * about to stop accepting transfers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  openChannels,
  resolveChannel,
  capUsage,
  capMessage,
  isPayChannel,
} from './payment-channels';

const BOTH = {
  gcash_enabled: true,
  bdo_enabled: true,
  gcash_number: '09178807163',
  bdo_account_number: '006540027965',
};

test('both rails open when enabled and configured', () => {
  assert.deepEqual(openChannels(BOTH), ['gcash', 'bdo']);
});

test('switching GCash off removes it — the whole point of the switch', () => {
  assert.deepEqual(openChannels({ ...BOTH, gcash_enabled: false }), ['bdo']);
});

test('an enabled channel with NO account number is not open', () => {
  // Otherwise checkout renders a payment panel with nothing to pay to.
  assert.deepEqual(openChannels({ ...BOTH, gcash_number: '   ' }), ['bdo']);
  assert.deepEqual(openChannels({ ...BOTH, bdo_account_number: null }), ['gcash']);
});

test('a pre-migration database (flags undefined) behaves as before', () => {
  // Failing this direction would empty checkout of payment options, which is
  // worse than showing one option too many.
  assert.deepEqual(
    openChannels({ gcash_number: '0917', bdo_account_number: '0065' }),
    ['gcash', 'bdo'],
  );
});

test('resolveChannel honours a valid request', () => {
  assert.equal(resolveChannel('bdo', BOTH), 'bdo');
  assert.equal(resolveChannel('gcash', BOTH), 'gcash');
});

test('resolveChannel REFUSES a disabled channel and falls to an open one', () => {
  // The server runs this too, so a client posting 'gcash' after the owner
  // switched it off does not get its way.
  assert.equal(resolveChannel('gcash', { ...BOTH, gcash_enabled: false }), 'bdo');
});

test('resolveChannel ignores junk input', () => {
  for (const junk of [null, undefined, '', 'paypal', 42, {}]) {
    assert.equal(resolveChannel(junk, BOTH), 'gcash', `junk: ${String(junk)}`);
  }
});

test('everything off returns null — we do NOT force a capped rail back on', () => {
  const closed = { ...BOTH, gcash_enabled: false, bdo_enabled: false };
  assert.deepEqual(openChannels(closed), []);
  assert.equal(resolveChannel('gcash', closed), null);
});

test('cap bands escalate before the cliff, not after it', () => {
  const cap = 500_000;
  assert.equal(capUsage(100_000, cap)!.band, 'ok');
  assert.equal(capUsage(374_999, cap)!.band, 'ok');
  assert.equal(capUsage(375_000, cap)!.band, 'warn', '75%');
  assert.equal(capUsage(450_000, cap)!.band, 'critical', '90%');
  assert.equal(capUsage(500_000, cap)!.band, 'over', '100%');
  assert.equal(capUsage(650_000, cap)!.band, 'over');
});

test('being over cap is not clamped — 130% must read as 130%', () => {
  assert.equal(Math.round(capUsage(650_000, 500_000)!.pct), 130);
});

test('no cap configured returns null, never a reassuring 0%', () => {
  // "Unknown" must not render as "fine".
  assert.equal(capUsage(100_000, null), null);
  assert.equal(capUsage(100_000, undefined), null);
  assert.equal(capUsage(100_000, 0), null);
  assert.equal(capUsage(100_000, -5), null);
});

test('a nonsense received figure degrades to zero rather than NaN', () => {
  assert.equal(capUsage(Number.NaN, 500_000)!.receivedPhp, 0);
  assert.equal(capUsage(-100, 500_000)!.receivedPhp, 0);
});

test('every cap message says the figure is Setnayan-orders-only', () => {
  // The cap counts the owner's PERSONAL transfers too, which we cannot see.
  // If any band ever implies our number is the whole truth, it will be
  // trusted right up until a payment bounces.
  for (const received of [100_000, 400_000, 460_000, 600_000]) {
    const msg = capMessage(capUsage(received, 500_000)!, 'GCash');
    assert.match(msg, /Setnayan orders/, `band message: ${msg}`);
  }
});

test('isPayChannel is strict', () => {
  assert.equal(isPayChannel('gcash'), true);
  assert.equal(isPayChannel('bdo'), true);
  assert.equal(isPayChannel('GCASH'), false);
  assert.equal(isPayChannel(null), false);
});
