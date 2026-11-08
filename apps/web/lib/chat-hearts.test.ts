/**
 * ♥ MESSAGE HEARTS — the pure model (THE ONE BUILD, v111 "tap = heart"; B1 step 7). Sabotage (2026-11-08): count the
 * chip from 1 ("♥ 1") → red; let a tap on a link heart the bubble → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHeart, heartChip, heartsFrom, tapMeansHeart } from './chat-hearts';

test('only hearted rows count, one per person per message', () => {
  const m = heartsFrom([
    { message_id: 'a', user_id: 'u1', hearted: true },
    { message_id: 'a', user_id: 'u2', hearted: true },
    { message_id: 'a', user_id: 'u3', hearted: false },
    { message_id: 'b', user_id: 'u1', hearted: true },
  ]);
  assert.equal(m.get('a')?.size, 2);
  assert.equal(m.get('b')?.size, 1);
});

test('a toggle is applied to a NEW map and un-heart removes the person; an empty message drops out', () => {
  const before = heartsFrom([{ message_id: 'a', user_id: 'u1', hearted: true }]);
  const on = applyHeart(before, { message_id: 'a', user_id: 'u2', hearted: true });
  assert.equal(on.get('a')?.size, 2);
  assert.equal(before.get('a')?.size, 1, 'the input map was mutated');
  const off = applyHeart(applyHeart(on, { message_id: 'a', user_id: 'u2', hearted: false }), {
    message_id: 'a',
    user_id: 'u1',
    hearted: false,
  });
  assert.equal(off.has('a'), false);
});

test('the chip: nothing at 0, ♥ at 1, ♥ N from 2', () => {
  assert.equal(heartChip(0), null);
  assert.equal(heartChip(1), '♥');
  assert.equal(heartChip(2), '♥ 2');
  assert.equal(heartChip(7), '♥ 7');
});

test('a tap on a link, button, field or player inside a bubble is never a heart', () => {
  const at = (hit: boolean) => ({ closest: () => (hit ? {} : null) });
  assert.equal(tapMeansHeart(at(false)), true);
  assert.equal(tapMeansHeart(at(true)), false);
  assert.equal(tapMeansHeart(null), false);
});
