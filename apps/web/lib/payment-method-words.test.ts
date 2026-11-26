/**
 * A7-33 (final check 25 Nov): a stored method code never reaches a person as a code. The payment history both ends
 * read (`lib/payment-history.ts`) shows "Bank transfer", never "bank_transfer"; a typed word stays as typed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { methodWords } from './payment-history';

test('a method code reads as words; a typed method stays as typed; nothing typed is null', () => {
  assert.equal(methodWords('bank_transfer'), 'Bank transfer');
  assert.equal(methodWords('GCash'), 'GCash');
  assert.equal(methodWords('  BDO deposit '), 'BDO deposit');
  assert.equal(methodWords(''), null);
  assert.equal(methodWords(null), null);
});
