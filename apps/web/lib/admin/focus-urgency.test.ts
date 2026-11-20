/**
 * focus-urgency.test.ts — admin Focus by urgency (Today v3 part 4, owner 19 Nov 2026 "this applies to admin and
 * supplier's today"). SABOTAGE (each seen red once): `due-soon` given no level → 1 red · the red check dropped from
 * `splitFocusPutOffs` → 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { focusLevel, orderFocusRows, splitFocusPutOffs } from './focus-urgency';

test('1 · a level only from the queue clock, always with a word', () => {
  assert.deepEqual(focusLevel('overdue'), { level: 'red', word: 'Overdue' });
  assert.deepEqual(focusLevel('due-soon'), { level: 'amber', word: 'Soon' });
  for (const s of ['ok', 'clear', 'unknown'] as const) assert.equal(focusLevel(s), null);
});

test('2 · one list: red, then amber, then the rest, stable', () => {
  const r = (key: string, l: 'red' | 'amber' | null) => ({ key, level: l ? focusLevel(l === 'red' ? 'overdue' : 'due-soon') : null });
  assert.deepEqual(orderFocusRows([r('a', null), r('b', 'amber'), r('c', 'red'), r('d', null), r('e', 'red')]).map((x) => x.key), ['c', 'e', 'b', 'a', 'd']);
});

test('3 · put off for this admin — never a red one; unread holds nothing off', () => {
  const rows = [{ key: 'p:1', level: focusLevel('overdue') }, { key: 'p:2', level: null }];
  const s = splitFocusPutOffs(rows, new Set(['p:1', 'p:2']));
  assert.deepEqual(s.now.map((x) => x.key), ['p:1'], 'an overdue item was hidden');
  assert.deepEqual(s.tomorrow.map((x) => x.key), ['p:2']);
  assert.equal(splitFocusPutOffs(rows, null).tomorrow.length, 0);
});
