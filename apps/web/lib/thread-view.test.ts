/**
 * thread-view.test.ts — the view is a URL fact, and the plain thread URL is the chat.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { THREAD_KINDS, legacyThreadView, parseThreadView, withThreadView } from '@/lib/thread-view';

test('only the named kinds parse; anything else is the chat', () => {
  assert.equal(parseThreadView('decisions'), 'decisions');
  assert.equal(parseThreadView('files'), 'files');
  // 19 Nov 2026 — the chips: Decisions · Forms · Money · Dates · Files.
  assert.deepEqual([...THREAD_KINDS], ['decisions', 'forms', 'money', 'dates', 'files']);
  for (const k of THREAD_KINDS) assert.equal(parseThreadView(k), k);
  for (const junk of [undefined, null, '', 'all', 'DECISIONS', 'admin', 42, {}]) {
    assert.equal(parseThreadView(junk), 'all', `parsed ${String(junk)}`);
  }
  // Next hands a repeated param over as an array.
  assert.equal(parseThreadView(['files', 'decisions']), 'files');
});

test('"all" is the ABSENCE of the param — one screen, one address', () => {
  assert.equal(withThreadView('/v/messages/t1?view=decisions', 'all'), '/v/messages/t1');
  assert.equal(withThreadView('/v/messages/t1', 'all'), '/v/messages/t1');
});

test('setting a view keeps every other query param and the fragment', () => {
  assert.equal(withThreadView('/v/messages/t1', 'decisions'), '/v/messages/t1?view=decisions');
  assert.equal(
    withThreadView('/v/messages/t1?notice=sent&view=files#end', 'decisions'),
    '/v/messages/t1?notice=sent&view=decisions#end',
  );
});

test('a view survives the round trip it exists for', () => {
  for (const v of ['all', ...THREAD_KINDS] as const) {
    const url = withThreadView('/dashboard/e1/messages/t1', v);
    const q = new URLSearchParams(url.split('?')[1] ?? '').get('view');
    assert.equal(parseThreadView(q), v);
  }
});

test('a chat without the chips reads a chip-only kind as the chat — its two old links mean what they always did', () => {
  assert.equal(legacyThreadView('decisions'), 'decisions');
  assert.equal(legacyThreadView('files'), 'files');
  for (const v of ['all', 'forms', 'money', 'dates'] as const) assert.equal(legacyThreadView(v), 'all');
});
