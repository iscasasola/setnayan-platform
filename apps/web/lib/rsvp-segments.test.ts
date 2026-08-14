/**
 * The shape-honest RSVP bar's arithmetic.
 *
 * The assertion that matters most is that the widths sum to EXACTLY 100. The
 * bar is a wide, thin element, so a one-point drift is not a rounding nicety —
 * it renders as a visible hairline gap or a clipped final segment, which reads
 * as a broken widget on the couple's home page.
 *
 * The second-most important is that a state with people in it can never render
 * at zero width. A legend that says "1 declined" beside a bar with no declined
 * segment is worse than not drawing the bar at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apportion, rsvpSegments, rsvpSummary } from './rsvp-segments';
import type { GuestStats } from './guests';

function stats(p: Partial<GuestStats>): GuestStats {
  const attending = p.attending ?? 0;
  const pending = p.pending ?? 0;
  const declined = p.declined ?? 0;
  const maybe = p.maybe ?? 0;
  return {
    attending,
    pending,
    declined,
    maybe,
    total: p.total ?? attending + pending + declined + maybe,
  } as GuestStats;
}

const sum = (ns: readonly number[]) => ns.reduce((a, b) => a + b, 0);

test('apportion: the parts always total exactly 100', () => {
  const cases: number[][] = [
    [1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [2, 1],
    [7, 3],
    [1, 99],
    [99, 1],
    [1, 2, 3, 4],
    [33, 33, 33],
    [17, 41, 5, 3],
    [1000, 1, 1, 1],
    [5],
  ];
  for (const c of cases) {
    assert.equal(sum(apportion(c)), 100, `did not total 100 for ${JSON.stringify(c)}`);
  }
});

test('apportion: a state with people in it never renders at zero width', () => {
  // 1 pending among 999 attending is 0.1% — a naive floor would drop it to 0
  // and the legend would claim a segment the reader cannot see.
  const out = apportion([999, 1]);
  assert.ok((out[1] ?? 0) >= 1, `tiny segment collapsed to ${out[1]}`);
  assert.equal(sum(out), 100);

  const three = apportion([500, 1, 1]);
  assert.ok(
    (three[1] ?? 0) >= 1 && (three[2] ?? 0) >= 1,
    `collapsed: ${JSON.stringify(three)}`,
  );
  assert.equal(sum(three), 100);
});

test('apportion: empty states stay at zero and contribute nothing', () => {
  const out = apportion([5, 0, 5, 0]);
  assert.equal(out[1], 0);
  assert.equal(out[3], 0);
  assert.equal(sum(out), 100);
});

test('apportion: an all-zero input yields all zeroes, not NaN', () => {
  const out = apportion([0, 0, 0]);
  assert.deepEqual(out, [0, 0, 0]);
});

test('apportion: junk counts are treated as zero rather than poisoning the total', () => {
  const out = apportion([10, Number.NaN, 10, -4, Number.POSITIVE_INFINITY]);
  assert.equal(sum(out), 100);
  assert.equal(out[1], 0);
  assert.equal(out[3], 0);
  assert.equal(out[4], 0);
});

test('nobody invited yet renders no bar at all', () => {
  assert.deepEqual(rsvpSegments(stats({})), []);
});

test('the four real states render in a fixed, meaningful order', () => {
  const segs = rsvpSegments(stats({ attending: 10, maybe: 5, pending: 8, declined: 2 }));
  assert.deepEqual(
    segs.map((s) => s.key),
    ['attending', 'maybe', 'pending', 'declined'],
  );
  assert.equal(sum(segs.map((s) => s.pct)), 100);
});

test('states nobody is in are dropped entirely', () => {
  const segs = rsvpSegments(stats({ attending: 12, pending: 3 }));
  assert.deepEqual(
    segs.map((s) => s.key),
    ['attending', 'pending'],
  );
  assert.equal(sum(segs.map((s) => s.pct)), 100);
});

test('"no reply yet" carries the reserved amber urgency hue, not gold', () => {
  const segs = rsvpSegments(stats({ attending: 5, pending: 5 }));
  const pending = segs.find((s) => s.key === 'pending');
  assert.ok(pending);
  assert.equal(pending.color, 'var(--sn-warning)');
  // The council reserved a NON-GOLD urgency hue precisely so it survives the
  // wine→gold palette turn. If any segment starts using a gold token this
  // assertion is the thing that says so.
  for (const s of segs) {
    assert.ok(!/gold/i.test(s.color), `${s.key} reached for a gold token: ${s.color}`);
  }
});

test('a guest whose status is outside the four shows up as unaccounted, not silently rescaled', () => {
  // 10 invited, only 6 classified. The bar must still describe all 10.
  const segs = rsvpSegments(stats({ attending: 4, pending: 2, total: 10 }));
  const unaccounted = segs.find((s) => s.key === 'unaccounted');
  assert.ok(unaccounted, 'the 4 unclassified guests vanished from the bar');
  assert.equal(unaccounted.count, 4);
  assert.equal(sum(segs.map((s) => s.pct)), 100);
});

test('a consistent list produces no unaccounted segment', () => {
  const segs = rsvpSegments(stats({ attending: 4, pending: 2, total: 6 }));
  assert.equal(
    segs.find((s) => s.key === 'unaccounted'),
    undefined,
  );
});

test('counts are reported verbatim — the bar rounds, the legend does not', () => {
  const segs = rsvpSegments(stats({ attending: 999, pending: 1 }));
  assert.equal(segs.find((s) => s.key === 'attending')?.count, 999);
  assert.equal(segs.find((s) => s.key === 'pending')?.count, 1);
});

test('the summary leads with what the host still has to chase', () => {
  assert.equal(
    rsvpSummary(stats({ attending: 18, pending: 4, total: 22 })),
    '18 attending · 4 still to reply',
  );
  // Everyone has answered — there is nothing to chase, so say the whole number.
  assert.equal(
    rsvpSummary(stats({ attending: 20, declined: 2, total: 22 })),
    '20 attending of 22 invited',
  );
  assert.equal(rsvpSummary(stats({})), 'No one invited yet');
});
