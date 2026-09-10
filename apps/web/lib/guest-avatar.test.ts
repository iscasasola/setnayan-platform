import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGuestAvatar, validateGuestAvatar, canonicalGuestAvatar } from './guest-avatar';
import { defaultHeritageConfig } from './heritage-config';
import { resolveChibiConfig, CHIBI_CONFIG_KEYS } from './chibi-config';

const CHIBI = resolveChibiConfig('c', null);

test('no style key → chibi, unchanged; heritage → heritage; never a chibi default for a heritage row', () => {
  assert.deepEqual(resolveGuestAvatar(CHIBI, 'c', true), { style: 'chibi', config: CHIBI });
  const h = defaultHeritageConfig('h');
  assert.deepEqual(resolveGuestAvatar(h, 'h', true), { style: 'heritage', config: h });
  // THE regression this exists to prevent: a heritage row must never be fed
  // to the chibi resolver, which would happily hash-roll a chibi from it.
  const r = resolveGuestAvatar({ style: 'heritage', hairStyle: 3 }, 'h', true);
  assert.equal(r?.style, 'heritage');
});

test('the chibi fallback rule is CALLED, not re-implemented: flag off / null → null', () => {
  assert.equal(resolveGuestAvatar(CHIBI, 'c', false), null);
  assert.equal(resolveGuestAvatar(defaultHeritageConfig('h'), 'h', false), null);
  assert.equal(resolveGuestAvatar(null, 'c', true), null);
  assert.equal(resolveGuestAvatar(undefined, 'c', true), null);
});

test('the write gate validates by style, strictly', () => {
  assert.deepEqual(validateGuestAvatar(CHIBI), []);
  assert.deepEqual(validateGuestAvatar(defaultHeritageConfig('h')), []);
  assert.ok(validateGuestAvatar({ ...CHIBI, style: 'chibi' }).some((e) => e.includes('unknown key')), 'a chibi with a stray style key is rejected as a chibi');
  assert.ok(validateGuestAvatar({ style: 'heritage' }).length > 0);
});

test('canonical copies keep only the style\'s keys', () => {
  const c = canonicalGuestAvatar({ ...CHIBI, smuggled: 1 });
  assert.deepEqual(Object.keys(c), [...CHIBI_CONFIG_KEYS]);
  const h = canonicalGuestAvatar({ ...defaultHeritageConfig('h'), smuggled: 1 });
  assert.ok(!('smuggled' in h) && h.style === 'heritage');
});
