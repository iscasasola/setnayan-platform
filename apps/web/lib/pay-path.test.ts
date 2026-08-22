import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payPath } from './pay-path';

test('a reference becomes a payment address', () => {
  assert.equal(payPath('SUB-7QK3M2'), '/pay/SUB-7QK3M2');
});

test('anything that could break a URL is encoded, not pasted', () => {
  assert.equal(payPath('A/B?c=1'), '/pay/A%2FB%3Fc%3D1');
  assert.equal(payPath('  SN12AB34  '), '/pay/SN12AB34');
});
