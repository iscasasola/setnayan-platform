/**
 * Wax-seal recipe invariants (node:test via tsx — `pnpm test:unit`).
 *
 * Covers the PURE modules only (lib/wax-seal/types). paint.ts needs a DOM canvas
 * and is validated in-browser. The contract these lock down: the renderer is
 * deterministic (same seed → same stream), and the sanitizer never lets an
 * untrusted recipe through unclamped.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAX_SEAL_V,
  defaultConfigFromSeed,
  fallbackSeedFromPublicId,
  mulberry32,
  resolveWaxColor,
  sanitizeWaxSealConfig,
} from './types';

test('mulberry32 is deterministic — same seed, same stream', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = [a(), a(), a(), a()];
  const seqB = [b(), b(), b(), b()];
  assert.deepEqual(seqA, seqB);
  // different seed → different stream
  const c = mulberry32(12346);
  assert.notEqual(c(), seqA[0]);
  // in range [0,1)
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test('fallbackSeedFromPublicId is a stable uint32', () => {
  const s1 = fallbackSeedFromPublicId('S89E-ABCDEFGHJK');
  const s2 = fallbackSeedFromPublicId('S89E-ABCDEFGHJK');
  assert.equal(s1, s2);
  assert.ok(Number.isInteger(s1) && s1 >= 0 && s1 <= 0xffffffff);
  assert.notEqual(s1, fallbackSeedFromPublicId('S89E-ZZZZZZZZZZ'));
  // null/undefined → a stable default, not NaN
  assert.ok(Number.isInteger(fallbackSeedFromPublicId(null)));
});

test('sanitizeWaxSealConfig rejects non-objects and missing seed', () => {
  assert.equal(sanitizeWaxSealConfig(null), null);
  assert.equal(sanitizeWaxSealConfig('nope'), null);
  assert.equal(sanitizeWaxSealConfig({}), null); // no seed
  assert.equal(sanitizeWaxSealConfig({ seed: 'x' }), null); // bad seed
});

test('sanitizeWaxSealConfig clamps + whitelists an untrusted recipe', () => {
  const c = sanitizeWaxSealConfig({
    v: 99,
    seed: 4242,
    wax: { color: 'red', finish: 'shiny' }, // bad hex, bad enum
    pour: { amount: 5, irregularity: -3, bubbles: 2 }, // out of 0..1
    press: { crispness: 9, depth: -1, offset: [7, -7, 3], skew: 50 },
    mark: { source: 'hacker' },
    isDefault: 'yes',
  });
  assert.ok(c);
  assert.equal(c.seed, 4242);
  assert.equal(c.wax.color, null); // 'red' rejected → inherit
  assert.equal(c.wax.finish, 'matte'); // bad enum → default
  assert.equal(c.pour.amount, 1);
  assert.equal(c.pour.irregularity, 0);
  assert.equal(c.pour.bubbles, 1);
  assert.equal(c.press.crispness, 1);
  assert.equal(c.press.depth, 0);
  assert.deepEqual(c.press.offset, [1, -1]); // clamped to -1..1, length 2
  assert.equal(c.press.skew, 1);
  assert.equal(c.mark.source, 'letters'); // bad enum → default
  assert.equal(c.isDefault, undefined); // only `true` is honored
});

test('sanitizeWaxSealConfig keeps a valid hex + enums', () => {
  const c = sanitizeWaxSealConfig({
    seed: 1,
    wax: { color: '#A1B2C3', finish: 'glossy' },
    mark: { source: 'uploaded' },
    isDefault: true,
  });
  assert.ok(c);
  assert.equal(c.wax.color, '#A1B2C3');
  assert.equal(c.wax.finish, 'glossy');
  assert.equal(c.mark.source, 'uploaded');
  assert.equal(c.isDefault, true);
  assert.equal(c.v, WAX_SEAL_V);
});

test('resolveWaxColor prefers a valid override, else the fallback', () => {
  const base = { seed: 1, wax: { color: null, finish: 'matte' as const }, pour: { amount: 0.6, irregularity: 0.3, bubbles: 0 }, press: { crispness: 0.7, depth: 0.7, offset: [0, 0] as [number, number], skew: 0 }, mark: { source: 'letters' as const }, v: 1 };
  assert.equal(resolveWaxColor(base, '#112233'), '#112233'); // null → fallback
  assert.equal(resolveWaxColor({ ...base, wax: { color: '#ddeeff', finish: 'matte' } }, '#112233'), '#ddeeff');
  assert.equal(resolveWaxColor({ ...base, wax: { color: 'bad', finish: 'matte' } }, '#112233'), '#112233');
  assert.equal(resolveWaxColor(null, '#112233'), '#112233');
});

test('defaultConfigFromSeed is deterministic + always crisp', () => {
  const a = defaultConfigFromSeed(777);
  const b = defaultConfigFromSeed(777);
  assert.deepEqual(a, b);
  assert.equal(a.isDefault, true);
  assert.ok(a.press.crispness >= 0.34 && a.press.crispness <= 0.74); // the "crisp" band
  assert.equal(a.wax.color, null);
  assert.notDeepEqual(defaultConfigFromSeed(778), a);
});
