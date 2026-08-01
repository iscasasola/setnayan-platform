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
  channelHeadroom,
  headroomMessage,
  inSameCalendarMonth,
  monthStartISO,
  isPayChannel,
} from './payment-channels';

const NOW = new Date('2026-08-15T10:00:00+08:00');
/** Defaults: ₱500k cap, no override, no inflow. */
const base = {
  capPhp: 500_000,
  availablePhp: null,
  availableAsOf: null,
  inflowSinceAsOfPhp: 0,
  inflowThisMonthPhp: 0,
  now: NOW,
};

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

// ── headroom: cap mode (no owner override) ─────────────────────────────────

test('cap mode deducts THIS MONTH\'s Setnayan inflow from the ceiling', () => {
  const h = channelHeadroom({ ...base, inflowThisMonthPhp: 120_000 })!;
  assert.equal(h.source, 'cap');
  assert.equal(h.startingPhp, 500_000);
  assert.equal(h.remainingPhp, 380_000);
});

test('cap bands escalate before the cliff, not after it', () => {
  const at = (n: number) =>
    channelHeadroom({ ...base, inflowThisMonthPhp: n })!.band;
  assert.equal(at(100_000), 'ok');
  assert.equal(at(374_999), 'ok');
  assert.equal(at(375_000), 'warn', '75%');
  assert.equal(at(450_000), 'critical', '90%');
  assert.equal(at(500_000), 'over', '100%');
});

test('no cap and no override returns null, never a reassuring 0%', () => {
  assert.equal(channelHeadroom({ ...base, capPhp: null }), null);
  assert.equal(channelHeadroom({ ...base, capPhp: 0 }), null);
});

// ── headroom: owner-balance mode ───────────────────────────────────────────

test('an owner balance entered THIS month overrides the cap', () => {
  const h = channelHeadroom({
    ...base,
    availablePhp: 90_000,
    availableAsOf: '2026-08-10T09:00:00+08:00',
    inflowSinceAsOfPhp: 15_000,
    inflowThisMonthPhp: 410_000, // must be IGNORED in this mode
  })!;
  assert.equal(h.source, 'owner_balance');
  assert.equal(h.startingPhp, 90_000);
  assert.equal(h.deductedPhp, 15_000, 'only inflow AFTER the reading');
  assert.equal(h.remainingPhp, 75_000);
});

test('inflow BEFORE the reading is not double-counted', () => {
  // The owner's own GCash number already includes it. Deducting month-start
  // inflow here would subtract the same orders twice and close the rail early.
  const h = channelHeadroom({
    ...base,
    availablePhp: 200_000,
    availableAsOf: '2026-08-14T09:00:00+08:00',
    inflowSinceAsOfPhp: 0,
    inflowThisMonthPhp: 300_000,
  })!;
  assert.equal(h.remainingPhp, 200_000);
});

test('LAST month\'s balance is ignored — the monthly reset, derived not scheduled', () => {
  const h = channelHeadroom({
    ...base,
    availablePhp: 12_000,
    availableAsOf: '2026-07-28T09:00:00+08:00', // previous month
    inflowSinceAsOfPhp: 5_000,
    inflowThisMonthPhp: 40_000,
  })!;
  assert.equal(h.source, 'cap', 'stale override must not carry into a new month');
  assert.equal(h.startingPhp, 500_000);
  assert.equal(h.remainingPhp, 460_000);
});

test('same month of a DIFFERENT year is still stale', () => {
  const h = channelHeadroom({
    ...base,
    availablePhp: 1_000,
    availableAsOf: '2025-08-10T09:00:00+08:00',
  })!;
  assert.equal(h.source, 'cap');
});

test('a zero balance is honoured — the wallet really can be full', () => {
  const h = channelHeadroom({
    ...base,
    availablePhp: 0,
    availableAsOf: '2026-08-10T09:00:00+08:00',
  })!;
  assert.equal(h.source, 'owner_balance');
  assert.equal(h.remainingPhp, 0);
  assert.equal(h.band, 'over', 'no room left must read as over, not as 0% used');
});

test('an unparseable timestamp falls back to the cap rather than throwing', () => {
  const h = channelHeadroom({
    ...base,
    availablePhp: 50_000,
    availableAsOf: 'not-a-date',
    inflowThisMonthPhp: 100_000,
  })!;
  assert.equal(h.source, 'cap');
  assert.equal(h.remainingPhp, 400_000);
});

test('remaining can go negative — being over is worth seeing plainly', () => {
  const h = channelHeadroom({
    ...base,
    availablePhp: 10_000,
    availableAsOf: '2026-08-10T09:00:00+08:00',
    inflowSinceAsOfPhp: 25_000,
  })!;
  assert.equal(h.remainingPhp, -15_000);
  assert.equal(h.band, 'over');
});

// ── copy ───────────────────────────────────────────────────────────────────

test('CAP-mode copy always warns the figure is optimistic', () => {
  for (const inflow of [50_000, 400_000, 460_000, 600_000]) {
    const msg = headroomMessage(
      channelHeadroom({ ...base, inflowThisMonthPhp: inflow })!,
      'GCash',
    );
    assert.match(msg, /personal transfers/i, msg);
    assert.match(msg, /LOWER/, msg);
  }
});

test('owner-balance copy does NOT claim the cap caveat', () => {
  const msg = headroomMessage(
    channelHeadroom({
      ...base,
      availablePhp: 80_000,
      availableAsOf: '2026-08-10T09:00:00+08:00',
      inflowSinceAsOfPhp: 5_000,
    })!,
    'GCash',
  );
  assert.doesNotMatch(msg, /LOWER/);
  assert.match(msg, /since you last checked/i);
});

// ── month helpers ──────────────────────────────────────────────────────────

test('monthStartISO pins the 1st, zero-padded', () => {
  assert.equal(monthStartISO(new Date('2026-08-15T23:00:00Z')), '2026-08-01');
  assert.equal(monthStartISO(new Date('2026-01-05T00:00:00Z')), '2026-01-01');
  assert.equal(monthStartISO(new Date('2026-12-31T00:00:00Z')), '2026-12-01');
});

test('inSameCalendarMonth is year-aware', () => {
  assert.equal(inSameCalendarMonth(new Date('2026-08-01'), new Date('2026-08-31')), true);
  assert.equal(inSameCalendarMonth(new Date('2026-07-31'), new Date('2026-08-01')), false);
  assert.equal(inSameCalendarMonth(new Date('2025-08-15'), new Date('2026-08-15')), false);
});
