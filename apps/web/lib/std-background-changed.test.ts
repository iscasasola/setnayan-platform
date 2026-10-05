import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stdBackgroundChanged } from './std-background-changed';

// A venue-only studio save re-posts the SAME background — the drafted
// "Same as theme" must survive it. Sabotage: make stdBackgroundChanged return
// true always → the first assertion fails.
test('an untouched background is not a change, whatever the key order', () => {
  const live = { kind: 'plain', value: '#e8d9bd', legibility: 'auto' };
  assert.equal(stdBackgroundChanged(live, { legibility: 'auto', value: '#e8d9bd', kind: 'plain' }), false);
  assert.equal(stdBackgroundChanged(null, null), false);
  assert.equal(stdBackgroundChanged(undefined, null), false);
});

test('a real pick is a change', () => {
  const live = { kind: 'plain', value: '#e8d9bd', legibility: 'auto' };
  assert.equal(stdBackgroundChanged(live, { kind: 'plain', value: '#112233', legibility: 'auto' }), true);
  assert.equal(stdBackgroundChanged(live, { follow: 'theme', legibility: 'auto' }), true);
  assert.equal(stdBackgroundChanged(null, live), true);
});
