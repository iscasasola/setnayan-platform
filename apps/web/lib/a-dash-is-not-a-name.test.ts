/**
 * a-dash-is-not-a-name.test.ts — a name part with no letter and no digit is never drawn (walk 13 Nov 2026, F-W3-22 /
 * F-W3-31: "Hi Someone —! 💌", "Someone —" in the chat).
 *
 * SABOTAGE: remove the no-letter/no-digit line from `isPlaceholderNameWord` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlaceholderNameWord, realNameParts } from '@/lib/seat-placeholder-words';
import { guestDisplayName } from '@/lib/guests';

test('a lone dash or dot is a stand-in, a real name is not', () => {
  for (const v of ['—', '-', '–', '.', ' — ']) assert.ok(isPlaceholderNameWord('last', v), `"${v}" read as a name`);
  for (const v of ['Reyes', 'dela Cruz', "O'Neil", 'Ñ', '3rd']) assert.ok(!isPlaceholderNameWord('last', v), `"${v}" dropped`);
  assert.deepEqual(realNameParts('Ana', '—'), { first: 'Ana', last: '' });
});

test('the compact name falls back cleanly', () => {
  assert.equal(guestDisplayName({ display_name: null, first_name: 'Ana', last_name: '—' }), 'Ana');
  assert.equal(guestDisplayName({ display_name: null, first_name: 'Ana', last_name: 'Reyes' }), 'Ana Reyes');
});
