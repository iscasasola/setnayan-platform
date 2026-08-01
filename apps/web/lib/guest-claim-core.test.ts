/**
 * Unit suite for the guest-list name matcher and — the reason this file now
 * exists — the SELF-JOIN HARDENING gate `seedBindAllowed`.
 *
 * The matcher answers two different questions with one score, and until
 * 2026-08-01 both used the same 0.86 threshold:
 *
 *   1. "Same person? Then don't mint a duplicate row."  → classifyClaimMatch,
 *      fuzzy on purpose; a wrong answer costs the couple a reconcile.
 *   2. "May this browser BECOME that person?"           → seedBindAllowed,
 *      which must be exact; a wrong answer hands an anonymous poster-QR
 *      scanner another guest's session, seat and host-assigned role.
 *
 * The load-bearing assertions here are the NEAR-MISS ones: names that
 * classifyClaimMatch calls `confident` and seedBindAllowed must still refuse.
 * Those are the exact inputs that used to complete an identity transfer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIDENT_MATCH,
  classifyClaimMatch,
  nameSimilarity,
  normalizeName,
  seedBindAllowed,
  type SeedCandidate,
} from './guest-claim-core';

const seed = (name: string, guestId = name): SeedCandidate => ({
  guestId,
  name,
  email: null,
});

// ── normalizeName ───────────────────────────────────────────────────────────

test('normalizeName folds case, diacritics, punctuation and whitespace', () => {
  assert.equal(normalizeName('  José   Dela-Cruz  '), 'jose dela cruz');
  assert.equal(normalizeName('MARIA SANTOS'), 'maria santos');
  assert.equal(normalizeName('Santos, Maria'), 'santos maria');
});

test('normalizeName keeps non-Latin scripts rather than erasing them', () => {
  assert.equal(normalizeName('上海'), '上海');
  assert.notEqual(normalizeName('Москва'), '');
});

test('normalizeName reduces a punctuation/emoji-only name to empty', () => {
  assert.equal(normalizeName('!!! ***'), '');
});

// ── classifyClaimMatch (regression cover for the shipped matcher) ───────────

test('classifyClaimMatch: exact name is confident', () => {
  const r = classifyClaimMatch('Maria Santos', [seed('Maria Santos'), seed('Juan Cruz')]);
  assert.equal(r.kind, 'confident');
  if (r.kind === 'confident') assert.equal(r.candidate.guestId, 'Maria Santos');
});

test('classifyClaimMatch: reversed token order is confident', () => {
  const r = classifyClaimMatch('Santos, Maria', [seed('Maria Santos')]);
  assert.equal(r.kind, 'confident');
});

test('classifyClaimMatch: two identical names collide as ambiguous', () => {
  const r = classifyClaimMatch('Maria Santos', [
    seed('Maria Santos', 'g1'),
    seed('Maria Santos', 'g2'),
  ]);
  assert.equal(r.kind, 'ambiguous');
});

test('classifyClaimMatch: a stranger with no near name is none', () => {
  const r = classifyClaimMatch('Bartholomew Kuma', [seed('Maria Santos'), seed('Juan Cruz')]);
  assert.equal(r.kind, 'none');
});

test('classifyClaimMatch: empty roster is none', () => {
  assert.equal(classifyClaimMatch('Maria Santos', []).kind, 'none');
});

// ── THE GAP: names the fuzzy matcher trusts and the bind gate must not ──────

/**
 * Each of these scores at/above CONFIDENT_MATCH against "Maria Santos", so
 * before the gate each one completed a seed bind: on the accountless path that
 * is `setGuestSession({ guest_id: <Maria>, qr_token: <Maria's> })` — the same
 * credential her private personal invitation link mints.
 */
const NEAR_MISSES = [
  'Marla Santos', // one substitution
  'Maria Santoz', // one substitution
  'Mario Santos', // one substitution — a DIFFERENT, plausibly real person
  'Maria Santo', // one deletion
  'Maria Santoss', // one insertion
];

for (const probe of NEAR_MISSES) {
  test(`near-miss "${probe}" is confident to the matcher but refused by the bind gate`, () => {
    // Precondition: this really is in the fuzzy band — the test is worthless if
    // the matcher already rejected it for an unrelated reason.
    assert.ok(
      nameSimilarity(probe, 'Maria Santos') >= CONFIDENT_MATCH,
      `${probe} should score >= ${CONFIDENT_MATCH}`,
    );
    const r = classifyClaimMatch(probe, [seed('Maria Santos')]);
    assert.equal(r.kind, 'confident');

    // The gate refuses it. The joiner is still admitted by the caller — as
    // their OWN self_added_unlisted row, with the couple notified.
    assert.equal(seedBindAllowed(probe, 'Maria Santos'), false);
  });
}

// ── seedBindAllowed: what it DOES allow (the legitimate flow) ───────────────

test('seedBindAllowed: the guest typing their own name exactly', () => {
  assert.equal(seedBindAllowed('Maria Santos', 'Maria Santos'), true);
});

test('seedBindAllowed: case, diacritics, punctuation and spacing are not fuzz', () => {
  assert.equal(seedBindAllowed('  maria   santos ', 'Maria Santos'), true);
  assert.equal(seedBindAllowed('JOSÉ DELA-CRUZ', 'Jose Dela Cruz'), true);
  assert.equal(seedBindAllowed('Ma. Cristina Reyes', 'Ma Cristina Reyes'), true);
});

test('seedBindAllowed: token order is exact set equality, not fuzz', () => {
  assert.equal(seedBindAllowed('Santos, Maria', 'Maria Santos'), true);
  assert.equal(seedBindAllowed('Dela Cruz, Juan Miguel', 'Juan Miguel Dela Cruz'), true);
});

// ── seedBindAllowed: what it refuses ────────────────────────────────────────

test('seedBindAllowed: a missing middle name is not the same identity', () => {
  assert.equal(seedBindAllowed('Maria Santos', 'Maria Cristina Santos'), false);
});

test('seedBindAllowed: a shared surname does not bind', () => {
  assert.equal(seedBindAllowed('Ana Santos', 'Maria Santos'), false);
});

test('seedBindAllowed: an unrelated name does not bind', () => {
  assert.equal(seedBindAllowed('Bartholomew Kuma', 'Maria Santos'), false);
});

test('seedBindAllowed: an empty or punctuation-only name never binds', () => {
  assert.equal(seedBindAllowed('', 'Maria Santos'), false);
  assert.equal(seedBindAllowed('   ', 'Maria Santos'), false);
  assert.equal(seedBindAllowed('!!!', 'Maria Santos'), false);
  // Both sides blank must not collapse into "equal".
  assert.equal(seedBindAllowed('!!!', '***'), false);
});

test('seedBindAllowed: a name past MAX_NAME_LENGTH cannot be padded into a match', () => {
  // normalizeName truncates at 120 chars; a 200-char probe whose first 120
  // chars equal the seed would otherwise "match" a seed that is itself short.
  assert.equal(seedBindAllowed('Maria Santos' + 'x'.repeat(200), 'Maria Santos'), false);
});
