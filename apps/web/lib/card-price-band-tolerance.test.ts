/**
 * The card price tolerance — OFF until the owner sets it, and a failed read is
 * never "off" (owner 2026-10-26: "admin-set tolerance in platform settings, OFF
 * until set — no guessed number").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTolerance,
  percentToTolerance,
  readCardPriceBandTolerance,
  toleranceToPercent,
} from './card-price-band-tolerance';

function client(result: { data: unknown; error: unknown } | 'throw') {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (result === 'throw') throw new Error('network');
            return result;
          },
        }),
      }),
    }),
  };
}

test('NULL is OFF — there is no default number', () => {
  assert.deepEqual(parseTolerance(null), { ok: true, tolerance: null });
});

test('a stored fraction is read as itself (numeric comes back as a string)', () => {
  assert.deepEqual(parseTolerance('0.300'), { ok: true, tolerance: 0.3 });
  assert.deepEqual(parseTolerance(0), { ok: true, tolerance: 0 });
});

test('out of range or garbage is a FAILED read, not off', () => {
  assert.deepEqual(parseTolerance(1.5), { ok: false });
  assert.deepEqual(parseTolerance('abc'), { ok: false });
});

test('a refused or thrown read is { ok: false } — the check holds, it does not pass', async () => {
  assert.deepEqual(await readCardPriceBandTolerance(client({ data: null, error: { message: 'denied' } })), { ok: false });
  assert.deepEqual(await readCardPriceBandTolerance(client({ data: null, error: null })), { ok: false });
  assert.deepEqual(await readCardPriceBandTolerance(client('throw')), { ok: false });
  assert.deepEqual(
    await readCardPriceBandTolerance(client({ data: { card_price_band_tolerance: null }, error: null })),
    { ok: true, tolerance: null },
  );
});

test('the settings box: percent in, fraction stored, blank = off', () => {
  assert.deepEqual(percentToTolerance('30'), { ok: true, value: 0.3 });
  assert.deepEqual(percentToTolerance(' '), { ok: true, value: null });
  assert.deepEqual(percentToTolerance('12.5'), { ok: true, value: 0.125 });
  assert.deepEqual(percentToTolerance('101'), { ok: false });
  assert.deepEqual(percentToTolerance('x'), { ok: false });
  assert.equal(toleranceToPercent(null), '');
  assert.equal(toleranceToPercent(0.125), '12.5');
});
