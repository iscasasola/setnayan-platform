import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasteSubmit } from './live-studio-encoder-key-paste';

test('a blank field submits nothing', () => {
  assert.equal(pasteSubmit(''), null);
  assert.equal(pasteSubmit('   '), null);
  assert.equal(pasteSubmit('\t\n'), null);
});

test('trims the key before sending it', () => {
  const result = pasteSubmit('  my-secret-stream-key  ');
  assert.equal(result?.send, 'my-secret-stream-key');
});

test('the field is always cleared on submit — the key never survives past it', () => {
  const result = pasteSubmit('my-secret-stream-key');
  assert.equal(result?.nextFieldValue, '');
});

test('the cleared value is never the submitted key, for any non-blank input', () => {
  for (const input of ['a', 'super-secret-123', '   padded-key   ', 'x'.repeat(64)]) {
    const result = pasteSubmit(input);
    assert.ok(result, `expected a result for ${JSON.stringify(input)}`);
    assert.notEqual(result.nextFieldValue, result.send);
    assert.equal(result.nextFieldValue.length, 0);
  }
});
