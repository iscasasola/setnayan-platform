/**
 * card-checks-are-honest — each automatic card check passes, flags, and FAILS CLOSED.
 *
 * ⚖ Owner 2026-10-26 (DECISION_LOG "APPROVED — SERVICE CARD CHECKS AS DRAWN"). The shape follows
 * `app/vendor-dashboard/reads-are-honest.test.ts` turned the other way round: there, a failed read must not render as
 * an empty list; here, a failed read must not render as a CLEAN CARD. A check that could not read its rule holds the
 * card with `check_unavailable` — it never lets it through.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  containsWholePhrase,
  findClaimWords,
  findServiceMismatch,
  isWordsOnly,
  priceIsFarBelowBand,
  primaryReason,
  runCardChecks,
  scoreFor,
  type CardCheckContext,
  type CardCheckInput,
} from './service-card-checks';

const SIX = ['guaranteed', '#1', 'best in', 'lowest price', 'official', '100%'];

const words = {
  byService: new Map<string, string[]>([
    ['catering', ['catering', 'buffet']],
    ['barong_tagalog', ['barong', 'barong tagalog', 'embroidery']],
    ['hair_makeup', ['hair & makeup', 'makeup', 'airbrush']],
  ]),
  labelOf: new Map([
    ['catering', 'Catering'],
    ['barong_tagalog', 'Barong Tagalog'],
    ['hair_makeup', 'Hair & Makeup'],
  ]),
};

function input(over: Partial<CardCheckInput> = {}): CardCheckInput {
  return {
    vendorProfileId: 'v1',
    category: 'hair_makeup',
    categoryLabel: 'Hair & Makeup',
    title: 'Bridal Hair & Makeup',
    inclusionLabels: ['Trial session'],
    addonLabels: [],
    startingPricePhp: 8500,
    pricingBasis: 'fixed',
    ...over,
  };
}

function clean(over: Partial<CardCheckContext> = {}): CardCheckContext {
  return {
    photoMatches: [],
    tolerance: 0.3,
    band: { lowPhp: 5000, medianPhp: 9000, highPhp: 15000, sampleN: 12, region: 'ncr', bucket: '__all__' },
    serviceWords: { ...words, ownKeys: new Set(['hair_makeup']) },
    claimWords: { words: SIX, allowed: new Set() },
    ...over,
  };
}

// ── PASS ──────────────────────────────────────────────────────────────────────

test('a clean card passes — no reasons, not held, score 0', () => {
  const r = runCardChecks(input(), clean());
  assert.deepEqual(r, { reasons: [], score: 0, held: false });
});

// ── words ─────────────────────────────────────────────────────────────────────

test('words: whole-word, any case, symbols included — and never inside another word', () => {
  assert.equal(containsWholePhrase('Guaranteed #1 Wedding Catering', '#1'), true);
  assert.equal(containsWholePhrase('Package #10', '#1'), false);
  assert.equal(containsWholePhrase('100% satisfaction', '100%'), true);
  assert.equal(containsWholePhrase('1100% fun', '100%'), false);
  assert.equal(containsWholePhrase('BEST  IN Tagaytay', 'best in'), true);
  assert.equal(containsWholePhrase('bestinclass', 'best in'), false);
  assert.equal(containsWholePhrase('Officially licensed', 'official'), false);
});

test('words: title, inclusion lines and add-on names are all read', () => {
  assert.deepEqual(findClaimWords(['Plain title', null], SIX, new Set()), []);
  assert.deepEqual(findClaimWords(['Plain', 'Guaranteed on time'], SIX, new Set()), ['guaranteed']);
  const r = runCardChecks(input({ addonLabels: ['Official photo booth'] }), clean());
  assert.deepEqual(r.reasons, [{ code: 'words', hits: ['official'] }]);
  assert.equal(r.held, true);
  assert.equal(r.score, 40);
});

test('words: a shop allowance lets that word through for that shop only', () => {
  const r = runCardChecks(input({ title: 'Official Same-Day Edit' }), clean({ claimWords: { words: SIX, allowed: new Set(['official']) } }));
  assert.equal(r.held, false);
});

// ── price ─────────────────────────────────────────────────────────────────────

test('price: held only BELOW the band by more than the tolerance — never above', () => {
  assert.equal(priceIsFarBelowBand(3400, 5000, 0.3), true); // < 3,500
  assert.equal(priceIsFarBelowBand(3500, 5000, 0.3), false);
  assert.equal(priceIsFarBelowBand(99_999, 5000, 0.3), false); // far ABOVE: not a check (ruling)
  const r = runCardChecks(input({ startingPricePhp: 999 }), clean());
  assert.equal(r.reasons[0]?.code, 'price');
  assert.equal(r.score, 70);
});

test('price: OFF until the owner sets a tolerance — no guessed number', () => {
  const r = runCardChecks(input({ startingPricePhp: 1 }), clean({ tolerance: 'off', band: 'none' }));
  assert.equal(r.held, false);
});

test('price: no band (thin market) = no check', () => {
  const r = runCardChecks(input({ startingPricePhp: 1 }), clean({ band: 'none' }));
  assert.equal(r.held, false);
});

// ── service ───────────────────────────────────────────────────────────────────

test('service: another service’s words AND none of its own → "filed under X, reads like Y"', () => {
  const r = runCardChecks(
    input({ category: 'barong_tagalog', categoryLabel: 'Barong Tagalog', title: 'Wedding Catering', inclusionLabels: ['Buffet for 100'] }),
    clean({ serviceWords: { ...words, ownKeys: new Set(['barong_tagalog']) } }),
  );
  const s = r.reasons.find((x) => x.code === 'service');
  assert.ok(s && s.code === 'service');
  assert.equal(s.matched, 'catering');
  assert.equal(s.matchedLabel, 'Catering');
  assert.deepEqual(s.words, ['catering', 'buffet']);
});

test('service: its own words anywhere → a pass, even with a foreign word beside them', () => {
  assert.equal(
    findServiceMismatch(['Barong with buffet styling'], new Set(['barong_tagalog']), ['Barong Tagalog'], words),
    null,
  );
});

test('service: no telling words at all ("Package A") → a pass', () => {
  assert.equal(findServiceMismatch(['Package A'], new Set(['barong_tagalog']), ['Barong Tagalog'], words), null);
});

test('service: the card’s whole family counts as its own', () => {
  assert.equal(findServiceMismatch(['Buffet'], new Set(['barong_tagalog', 'catering']), [], words), null);
});

// ── photo ─────────────────────────────────────────────────────────────────────

test('photo: an open repost-watch match on this card’s photos holds it — highest score', () => {
  const r = runCardChecks(
    input({ title: 'Guaranteed bridal look' }),
    clean({ photoMatches: [{ imageFlagPublicId: 'S89N-AAAA', hamming: 4, which: 'cover' }] }),
  );
  assert.deepEqual(r.reasons.map((x) => x.code), ['photo', 'words']);
  assert.equal(r.score, 90);
  assert.equal(primaryReason(r.reasons), 'photo');
});

// ── FAIL-CLOSED ───────────────────────────────────────────────────────────────

for (const part of ['photoMatches', 'tolerance', 'band', 'serviceWords', 'claimWords'] as const) {
  test(`fail-closed: an unread ${part} HOLDS the card ("check didn't finish"), never passes it`, () => {
    const r = runCardChecks(input(), clean({ [part]: null } as Partial<CardCheckContext>));
    assert.equal(r.held, true, `${part} unread let a card through`);
    const u = r.reasons.find((x) => x.code === 'check_unavailable');
    assert.ok(u && u.code === 'check_unavailable');
    assert.equal(u.checks.length, 1);
  });
}

test('fail-closed: unread add-ons HOLD the card — never read as "no add-ons"', () => {
  const r = runCardChecks(input({ addonLabels: null }), clean());
  assert.deepEqual(r.reasons, [{ code: 'check_unavailable', checks: ['words'] }]);
});

test('the band is not asked for when the price check is off — its absence is not a failure then', () => {
  const r = runCardChecks(input(), clean({ tolerance: 'off', band: null }));
  assert.equal(r.held, false);
});

// ── bulk approve ──────────────────────────────────────────────────────────────

test('bulk approve is for words-only rows', () => {
  assert.equal(isWordsOnly([{ code: 'words' }]), true);
  assert.equal(isWordsOnly([{ code: 'words' }, { code: 'price' }]), false);
  assert.equal(isWordsOnly([]), false);
  assert.equal(scoreFor([]), 0);
});
