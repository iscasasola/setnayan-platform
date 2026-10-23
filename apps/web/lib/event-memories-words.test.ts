/**
 * GUARD — an event's Memories says its count and where the cameras are, in the prototype's words; a window it
 * cannot read says nothing rather than a guess.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoriesCameraWords, memoriesCountWords, memoriesUnreadable } from './event-memories-words';

test('the count reads "N photos", one is singular, thousands carry their comma', () => {
  assert.equal(memoriesCountWords(0), '0 photos');
  assert.equal(memoriesCountWords(1), '1 photo');
  assert.equal(memoriesCountWords(1284), '1,284 photos');
});

test('before · during · after the capture window', () => {
  const start = Date.parse('2026-12-12T00:00:00+08:00');
  const end = Date.parse('2026-12-13T12:00:00+08:00');
  const w = { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
  assert.equal(memoriesCameraWords({ ...w, now: start - 51 * 86_400_000 }), 'opens in 51 days');
  assert.equal(memoriesCameraWords({ ...w, now: start - 3_600_000 }), 'opens tomorrow');
  assert.equal(memoriesCameraWords({ ...w, now: start + 60_000 }), 'cameras open now');
  assert.equal(memoriesCameraWords({ ...w, now: end }), 'cameras closed');
  assert.equal(memoriesCameraWords({ startIso: null, endIso: w.endIso, now: start }), null);
  assert.equal(memoriesCameraWords({ startIso: 'not a date', endIso: w.endIso, now: start }), null);
});

test('an empty page is "nothing yet" only over a count of zero', () => {
  assert.equal(memoriesUnreadable(0, 0), false);
  assert.equal(memoriesUnreadable(0, null), true, 'a refused count is not an empty gallery');
  assert.equal(memoriesUnreadable(0, 12), true, 'twelve counted, none read — the photo read was refused');
  assert.equal(memoriesUnreadable(5, null), false);
  assert.equal(memoriesUnreadable(5, 1284), false);
});
