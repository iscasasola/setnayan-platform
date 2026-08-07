/**
 * CSAM known-hash matching — pure-logic tests.
 *
 * The load-bearing assertion in this file is not the hash arithmetic. It is
 * that NO STATUS OTHER THAN 'no_match' EVER READS AS AFFIRMATIVE. A stub that
 * looks like protection and isn't is the failure mode this whole feature is
 * built to avoid, and the way it would actually happen is somebody adding a
 * status (or writing `!== 'match'`) and quietly turning "nobody checked" into
 * "checked and fine". So the predicate is tested exhaustively over the whole
 * union, and the union itself is pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DHASH_HEIGHT,
  DHASH_WIDTH,
  dHashFromGrayscale,
  describeHashCheckStatus,
  hammingDistanceHex,
  hashCheckBlocksMedia,
  hashCheckProviderId,
  hashCheckReachedProvider,
  isAffirmativeHashCheck,
  knownHashHeadline,
  resolveKnownHashProvider,
  tallyHashCheckRows,
  type KnownHashStatus,
} from './known-hash-match';

/** The complete status union, pinned. A new member fails the length check
 *  below, which forces whoever adds it to decide — in this file — whether it
 *  is affirmative. That is the whole point. */
const ALL_STATUSES: KnownHashStatus[] = [
  'not_enrolled',
  'no_match',
  'match',
  'unavailable',
  'unsupported',
];

// ── The safety invariant ───────────────────────────────────────────────────

test('the status union has exactly the five known members', () => {
  assert.equal(ALL_STATUSES.length, 5);
  assert.equal(new Set(ALL_STATUSES).size, 5);
});

test('ONLY no_match is affirmative — an absent check is never a pass', () => {
  for (const status of ALL_STATUSES) {
    assert.equal(
      isAffirmativeHashCheck(status),
      status === 'no_match',
      `${status} must ${status === 'no_match' ? '' : 'NOT '}read as affirmative`,
    );
  }
});

test('not_enrolled, unavailable and unsupported are all non-affirmative', () => {
  // Spelled out separately from the loop above: these three are the values that
  // mean "nothing examined this object", and they are what every row carries
  // today. If any of them ever flips to affirmative, media that nobody checked
  // starts reporting as cleared.
  assert.equal(isAffirmativeHashCheck('not_enrolled'), false);
  assert.equal(isAffirmativeHashCheck('unavailable'), false);
  assert.equal(isAffirmativeHashCheck('unsupported'), false);
});

test('only a positive match blocks — an outage never blocks and never passes', () => {
  for (const status of ALL_STATUSES) {
    assert.equal(hashCheckBlocksMedia(status), status === 'match');
  }
  // The two predicates are not complements: 'unavailable' is neither.
  assert.equal(hashCheckBlocksMedia('unavailable'), false);
  assert.equal(isAffirmativeHashCheck('unavailable'), false);
});

// ── provider coherence (mirrors the table's CHECK constraint) ──────────────

test('only no_match / match / unavailable assert that a provider was reached', () => {
  // `unsupported` must NOT be in this set: the media had no hashable still, so
  // nothing was ever sent anywhere.
  for (const status of ALL_STATUSES) {
    assert.equal(
      hashCheckReachedProvider(status),
      status === 'no_match' || status === 'match' || status === 'unavailable',
      `${status} reached-provider classification is wrong`,
    );
  }
  assert.equal(hashCheckReachedProvider('unsupported'), false);
  assert.equal(hashCheckReachedProvider('not_enrolled'), false);
});

test('provider_id is null for statuses where nothing ran, and required where it did', () => {
  // Nothing ran → null, even when a provider happens to be configured.
  assert.equal(hashCheckProviderId('not_enrolled', null), null);
  assert.equal(hashCheckProviderId('not_enrolled', 'photodna'), null);
  assert.equal(hashCheckProviderId('unsupported', null), null);
  assert.equal(hashCheckProviderId('unsupported', 'photodna'), null);
  // A provider ran → its id is carried through.
  assert.equal(hashCheckProviderId('no_match', 'photodna'), 'photodna');
  assert.equal(hashCheckProviderId('match', 'photodna'), 'photodna');
  assert.equal(hashCheckProviderId('unavailable', 'photodna'), 'photodna');
});

test('an incoherent pair yields undefined — the row is declined, not rejected by Postgres', () => {
  // THE BUG THIS TEST EXISTS FOR: before the fix, an `unsupported` result with
  // no provider enrolled produced (status='unsupported', provider_id=NULL) —
  // which the old CHECK rejected — so the row silently failed to write and the
  // unchecked object left NO RECORD AT ALL. That is the one outcome this
  // feature cannot afford: an unchecked upload that is also uncounted.
  assert.equal(hashCheckProviderId('unsupported', null), null, 'must be writable now');
  // The genuinely incoherent direction still declines.
  assert.equal(hashCheckProviderId('no_match', null), undefined);
  assert.equal(hashCheckProviderId('match', null), undefined);
  assert.equal(hashCheckProviderId('unavailable', null), undefined);
  assert.equal(hashCheckProviderId('no_match', ''), undefined, 'empty id is not an id');
});

test('no status description claims the media is clean', () => {
  for (const status of ALL_STATUSES) {
    const text = describeHashCheckStatus(status).toLowerCase();
    assert.ok(!text.includes('clean'), `${status} description must not say "clean"`);
    assert.ok(!text.includes('safe'), `${status} description must not say "safe"`);
    assert.ok(text.length > 0);
  }
  assert.match(describeHashCheckStatus('not_enrolled'), /not checked/i);
});

test('no provider is wired — resolveKnownHashProvider returns null', () => {
  // If this ever fails, somebody wired an adapter. That is the enrolment
  // milestone, and it should be a deliberate, reviewed change to this test too.
  assert.equal(resolveKnownHashProvider(), null);
});

// ── The console headline ───────────────────────────────────────────────────

test('headline states NOT ENROLLED whether or not the hook is on', () => {
  const hookOn = knownHashHeadline({ enrolled: false, hookEnabled: true });
  const hookOff = knownHashHeadline({ enrolled: false, hookEnabled: false });
  assert.match(hookOn, /NOT ENROLLED/);
  assert.match(hookOff, /NOT ENROLLED/);
  // Turning the recording hook on must not read as turning protection on.
  assert.match(hookOn, /No known-hash matching is happening/i);
});

test('headline flags enrolled-but-hook-off as NOT being checked', () => {
  const text = knownHashHeadline({ enrolled: true, hookEnabled: false });
  assert.match(text, /NOT being checked/i);
});

test('headline only claims checking when enrolled AND the hook is on', () => {
  const text = knownHashHeadline({ enrolled: true, hookEnabled: true });
  assert.match(text, /are checked against the provider/i);
});

// ── The tally ──────────────────────────────────────────────────────────────

test('tally counts every non-affirmative status as unchecked', () => {
  const { counts, uncheckedCount } = tallyHashCheckRows([
    { status: 'not_enrolled' },
    { status: 'not_enrolled' },
    { status: 'unavailable' },
    { status: 'unsupported' },
    { status: 'no_match' },
    { status: 'match' },
  ]);
  assert.equal(counts.not_enrolled, 2);
  assert.equal(counts.unavailable, 1);
  assert.equal(counts.unsupported, 1);
  assert.equal(counts.no_match, 1);
  assert.equal(counts.match, 1);
  // Everything except the single no_match: 2 + 1 + 1 + 1 (match) = 5.
  assert.equal(uncheckedCount, 5);
});

test('tally ignores unknown/absent statuses rather than counting them as cleared', () => {
  const { counts, uncheckedCount } = tallyHashCheckRows([
    { status: 'clean' }, // not a member — must not become a pass
    { status: null },
    {},
    { status: 'no_match' },
  ]);
  assert.equal(uncheckedCount, 0);
  assert.equal(counts.no_match, 1);
  assert.equal(
    Object.values(counts).reduce((a, b) => a + b, 0),
    1,
    'unknown statuses must not land in any bucket',
  );
});

test('an empty tally is all zeros (the caller distinguishes empty from unreadable)', () => {
  const { counts, uncheckedCount } = tallyHashCheckRows([]);
  assert.equal(uncheckedCount, 0);
  for (const status of ALL_STATUSES) assert.equal(counts[status], 0);
});

// ── dHash ──────────────────────────────────────────────────────────────────

/** Build a width×height grid from a row-generator. */
function grid(fn: (col: number, row: number) => number, w = DHASH_WIDTH, h = DHASH_HEIGHT) {
  const out = new Uint8Array(w * h);
  for (let r = 0; r < h; r += 1) for (let c = 0; c < w; c += 1) out[r * w + c] = fn(c, r);
  return out;
}

test('dHash of a flat image is all zeros (no pixel is brighter than its neighbour)', () => {
  const hash = dHashFromGrayscale(grid(() => 128));
  assert.equal(hash, '0'.repeat(16));
});

test('dHash of a left-to-right dark ramp is all zeros; the reverse is all ones', () => {
  // Ascending left→right: every pixel is DARKER than its right neighbour → 0s.
  assert.equal(dHashFromGrayscale(grid((c) => c * 10)), '0'.repeat(16));
  // Descending left→right: every pixel is BRIGHTER than its right neighbour → 1s.
  assert.equal(dHashFromGrayscale(grid((c) => 200 - c * 10)), 'f'.repeat(16));
});

test('dHash is 64 bits / 16 lowercase hex chars at the 9x8 defaults', () => {
  const hash = dHashFromGrayscale(grid((c, r) => (c * 31 + r * 17) % 256));
  assert.equal(hash.length, 16);
  assert.match(hash, /^[0-9a-f]{16}$/);
});

test('dHash is stable and distinguishes different images', () => {
  const a = grid((c, r) => (c * 31 + r * 17) % 256);
  const b = grid((c, r) => (c * 13 + r * 61) % 256);
  assert.equal(dHashFromGrayscale(a), dHashFromGrayscale(a), 'deterministic');
  assert.notEqual(dHashFromGrayscale(a), dHashFromGrayscale(b));
});

test('dHash compares strictly — equal neighbours produce 0, not 1', () => {
  // Pairs of equal pixels: 9 columns → cols 0..7 compared with 1..8.
  // Row of [5,5,9,9,5,5,9,9,5] → >? f,f,f,f,f,f,f,f pattern check.
  const row = [5, 5, 9, 9, 5, 5, 9, 9, 5];
  const hash = dHashFromGrayscale(grid((c) => row[c]!));
  // comparisons: 5>5=0, 5>9=0, 9>9=0, 9>5=1, 5>5=0, 5>9=0, 9>9=0, 9>5=1
  // → 00010001 = 0x11, repeated for all 8 identical rows.
  assert.equal(hash, '11'.repeat(8));
});

test('dHash rejects a malformed grid rather than hashing garbage', () => {
  assert.throws(() => dHashFromGrayscale(new Uint8Array(10)), /expected 72 samples/);
  assert.throws(() => dHashFromGrayscale(new Uint8Array(4), 1, 4), /bad grid/);
  // (w-1)*h must be hex-aligned, else two grids could render to one string.
  assert.throws(() => dHashFromGrayscale(new Uint8Array(3 * 1), 3, 1), /not hex-aligned/);
});

// ── Hamming distance ───────────────────────────────────────────────────────

test('hamming distance is 0 for identical hashes and counts differing bits', () => {
  assert.equal(hammingDistanceHex('0000000000000000', '0000000000000000'), 0);
  assert.equal(hammingDistanceHex('ffffffffffffffff', '0000000000000000'), 64);
  assert.equal(hammingDistanceHex('0', '1'), 1);
  assert.equal(hammingDistanceHex('0', 'f'), 4);
  assert.equal(hammingDistanceHex('00', '81'), 2); // 0^8 = 1 bit, 0^1 = 1 bit
  assert.equal(hammingDistanceHex('0f', 'f0'), 8); // every bit differs
});

test('hamming distance returns null — never 0 — for unusable input', () => {
  // A misleading 0 would read as "identical", i.e. a match.
  assert.equal(hammingDistanceHex('abc', 'abcd'), null);
  assert.equal(hammingDistanceHex('', ''), null);
  assert.equal(hammingDistanceHex('zz', 'ab'), null);
});
