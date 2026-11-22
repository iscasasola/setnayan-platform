import test from 'node:test';
import assert from 'node:assert/strict';
import { piecesAskSentLine } from './pieces-ask-words';

// 🔒 Owner Q2, 20 Nov ("No, keep the ruling — remove the picker"): a couple's piece ask carries no number and they never
// see the stock — the line names who says how many, and carries no number of its own.
test('the piece-ask line names the shop and never a number', () => {
  const line = piecesAskSentLine('Ask Rentals');
  assert.equal(line, 'Ask sent. Ask Rentals will tell you how many they can give.');
  assert.doesNotMatch(line, /\d/);
});
