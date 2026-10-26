/**
 * The checks before Create — each passes, flags, and FAILS CLOSED (owner 2026-10-26, DECISION_LOG "SERVICE CARD
 * CHECKS — FIX BEFORE CREATE"; prototype prototypes/service_card_checks_2026-10-26/ PLAN §2).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  containsWholePhrase,
  evaluateCardChecks,
  findClaimWords,
  findServiceMismatch,
  ownServiceKeys,
  problemsFor,
  readCardCheckInput,
  type CardCheckContext,
  type CardCheckInput,
  type PhotoAnswer,
  type ServiceWords,
} from './service-card-checks';

const SIX = ['guaranteed', '#1', 'best in', 'lowest price', 'official', '100%'];

const SERVICES: ServiceWords = {
  words: {
    catering: ['catering', 'buffet'],
    food_cart: ['food cart'],
    church_wedding: ['church wedding', 'church'],
    reception_venue: ['reception venue', 'venue'],
    hair_makeup: ['hair & makeup', 'makeup'],
  },
  label: {
    catering: 'Catering',
    food_cart: 'Food cart',
    church_wedding: 'Church wedding',
    reception_venue: 'Reception venue',
    hair_makeup: 'Hair & Makeup',
  },
  family: { catering: 'feast', food_cart: 'feast', church_wedding: 'venue', reception_venue: 'venue', hair_makeup: 'look' },
};

const CTX: CardCheckContext = { claimWords: SIX, services: SERVICES };
const OK = (): PhotoAnswer => ({ status: 'ok' });

function input(over: Partial<CardCheckInput> = {}): CardCheckInput {
  return {
    category: 'catering',
    title: 'Buffet catering · Tita Nena’s',
    inclusionLabels: ['5 dishes', 'Rice'],
    addonLabels: [],
    cover: 'r2://media/a/cover.webp',
    showcase: [],
    ...over,
  };
}

// ── pass ──────────────────────────────────────────────────────────────────────

test('a clean card has nothing to fix — Create is open', () => {
  assert.deepEqual(evaluateCardChecks(input(), CTX, OK), { problems: [], count: 0, blocked: false });
});

test('there is no price check of any kind (owner: "remove the price integrity issue")', () => {
  // A ₱1 card and a ₱10,000,000 card are the same to the checks — the input has no price at all.
  assert.equal('startingPricePhp' in input(), false);
});

// ── 1 · words ─────────────────────────────────────────────────────────────────

test('words: whole word, any case, symbols too — never inside another word', () => {
  assert.equal(containsWholePhrase('Guaranteed #1 Buffet', '#1'), true);
  assert.equal(containsWholePhrase('Package #10', '#1'), false);
  assert.equal(containsWholePhrase('100% sure', '100%'), true);
  assert.equal(containsWholePhrase('1100% fun', '100%'), false);
  assert.equal(containsWholePhrase('BEST  IN Tagaytay', 'best in'), true);
  assert.equal(containsWholePhrase('bestinclass', 'best in'), false);
  assert.equal(containsWholePhrase('Officially licensed', 'official'), false);
  assert.equal(containsWholePhrase('the official one', 'official'), true);
  assert.deepEqual(findClaimWords('Guaranteed #1 Buffet', SIX), ['guaranteed', '#1']);
});

test('words: shown under the row they are on — name, what’s included, add-ons', () => {
  const r = evaluateCardChecks(
    input({ title: 'Guaranteed #1 Buffet', inclusionLabels: ['Lowest price in town'], addonLabels: ['Official photo booth'] }),
    CTX,
    OK,
  );
  assert.deepEqual(problemsFor(r, 'name'), [{ code: 'words', row: 'name', hits: ['guaranteed', '#1'] }]);
  assert.deepEqual(problemsFor(r, 'included'), [{ code: 'words', row: 'included', hits: ['lowest price'] }]);
  assert.deepEqual(problemsFor(r, 'addons'), [{ code: 'words', row: 'addons', hits: ['official'] }]);
  assert.equal(r.count, 3);
  assert.equal(r.blocked, true);
});

// ── 2 · service ───────────────────────────────────────────────────────────────

test('service: another service’s words and none of its own → "reads like"', () => {
  const r = evaluateCardChecks(input({ category: 'church_wedding', title: 'Catering for 200 guests', inclusionLabels: [] }), CTX, OK);
  assert.deepEqual(r.problems, [
    { code: 'service', row: 'offer', filedLabel: 'Church wedding', matched: 'catering', matchedLabel: 'Catering', words: ['catering'] },
  ]);
});

test('service: its own words anywhere → a pass, even beside a foreign word', () => {
  assert.equal(findServiceMismatch(['Church wedding with buffet'], 'church_wedding', SERVICES), null);
});

test('service: no telling words ("Package A") → a pass', () => {
  assert.equal(findServiceMismatch(['Package A'], 'church_wedding', SERVICES), null);
});

test('service: a key the taxonomy does not know is never judged (no own words to stand on)', () => {
  const r = evaluateCardChecks(input({ category: 'mystery_kind', title: 'Buffet catering' }), CTX, OK);
  assert.equal(r.problems.length, 0);
});

test('service: the card’s whole family (its tier-1 folder) counts as its own', () => {
  assert.deepEqual([...ownServiceKeys('food_cart', SERVICES)].sort(), ['catering', 'food_cart']);
  assert.equal(findServiceMismatch(['Buffet cart'], 'food_cart', SERVICES), null);
});

// ── 3 · photo ─────────────────────────────────────────────────────────────────

test('photo: on another shop’s card blocks; on the shop’s own card blocks and names it; ok passes', () => {
  const answers: Record<string, PhotoAnswer> = {
    'r2://media/a/cover.webp': { status: 'other_card', flagId: 7, reported: false },
    'r2://media/a/s1.webp': { status: 'own_card', serviceId: 'svc-1', title: 'Buffet catering · Tita Nena’s' },
    'r2://media/a/s2.webp': { status: 'ok' },
  };
  const r = evaluateCardChecks(input({ showcase: ['r2://media/a/s1.webp', 'r2://media/a/s2.webp'] }), CTX, (ref) => answers[ref]);
  assert.deepEqual(
    r.problems.map((p) => (p.code === 'photo' ? [p.which, p.answer.status] : p.code)),
    [['cover', 'other_card'], ['showcase', 'own_card']],
  );
});

test('photo: a report does not unblock (PLAN §3 — report, but keep blocking)', () => {
  const r = evaluateCardChecks(input(), CTX, () => ({ status: 'other_card', flagId: 7, reported: true }));
  assert.equal(r.blocked, true);
});

test('photo: no answer yet means "checking" — it blocks', () => {
  const r = evaluateCardChecks(input(), CTX, () => undefined);
  assert.equal(r.problems[0]?.code, 'photo');
  assert.equal(r.blocked, true);
});

// ── the form reader ───────────────────────────────────────────────────────────

test('the form reader reads the save’s own field names', () => {
  const fd = new FormData();
  fd.set('category', 'catering');
  fd.set('title', ' Guaranteed buffet ');
  fd.append('inclusion_label', 'Rice');
  fd.append('inclusion_label', ' ');
  fd.set('addons_present', '1');
  fd.append('addon_label', 'Official booth');
  fd.set('primary_photo_r2_key', 'r2://c');
  fd.append('showcase_photo_r2_keys', 'r2://s1');
  assert.deepEqual(readCardCheckInput(fd), {
    category: 'catering',
    title: 'Guaranteed buffet',
    inclusionLabels: ['Rice'],
    addonLabels: ['Official booth'],
    cover: 'r2://c',
    showcase: ['r2://s1'],
  });
});
