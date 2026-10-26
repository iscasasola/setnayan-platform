/**
 * THE CARD CHECK FAILS CLOSED (corpus prototypes/service_card_checks_2026-10-26/ PLAN §6 step 2: "a context read
 * failure refuses, never passes"). Every part the checks read can come back unread — the word list, the service
 * words, the add-ons, a photo's answer — and each one, unread, keeps Create shut and makes the save refuse. "We could
 * not check" is never "there was nothing to find".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCardChecks, type CardCheckInput, type PhotoAnswer, type ServiceWords } from './service-card-checks';
import { refusalSentence } from './service-card-check-copy';

const SIX = ['guaranteed', '#1', 'best in', 'lowest price', 'official', '100%'];
const SERVICES: ServiceWords = { words: { catering: ['catering'] }, label: { catering: 'Catering' }, family: { catering: 'feast' } };
const OK = (): PhotoAnswer => ({ status: 'ok' });
const CTX = { claimWords: SIX, services: SERVICES };
function input(over: Partial<CardCheckInput> = {}): CardCheckInput {
  return { category: 'catering', title: 'Buffet catering', inclusionLabels: ['Rice'], addonLabels: [], cover: 'r2://media/a/c.webp', showcase: [], ...over };
}

test('fail-closed: an unread word list blocks with "couldn’t finish the check" — never passes', () => {
  const r = evaluateCardChecks(input({ title: 'Guaranteed' }), { claimWords: null, services: SERVICES }, OK);
  assert.deepEqual(r.problems, [{ code: 'unavailable', row: 'status', checks: ['words'] }]);
});

test('fail-closed: unread service words block', () => {
  const r = evaluateCardChecks(input(), { claimWords: SIX, services: null }, OK);
  assert.deepEqual(r.problems, [{ code: 'unavailable', row: 'status', checks: ['service'] }]);
});

test('fail-closed: unread add-ons block (never read as "no add-ons")', () => {
  const r = evaluateCardChecks(input({ addonLabels: null }), CTX, OK);
  assert.deepEqual(r.problems, [{ code: 'unavailable', row: 'status', checks: ['words'] }]);
});

test('fail-closed: a photo the check could not reach blocks', () => {
  const r = evaluateCardChecks(input(), CTX, () => ({ status: 'unavailable' }));
  assert.equal(r.blocked, true);
});

test('the save refuses an unchecked card in words that say nothing was saved', () => {
  const r = evaluateCardChecks(input(), { claimWords: null, services: null }, OK);
  assert.match(refusalSentence(r.problems) ?? '', /nothing was saved/);
});
