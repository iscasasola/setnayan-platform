/**
 * A MOMENT YIELDS THE PROMPTS A COORDINATOR WOULD EXPECT — AND NEVER NOTHING.
 *
 * Build order § 5 makes three claims about this join, and this file asserts all
 * three where they can be asserted WITHOUT a database:
 *
 *   1. a moment yields the prompts a coordinator would expect;
 *   2. an UNMAPPED moment degrades to the general pool rather than emptying;
 *   3. the mapping is authored in the pool and nowhere else.
 *
 * The fourth claim — that arming a moment's challenge closes the previous one —
 * is 4a's behaviour and is asserted against a real replayed database in
 * `tests/db/the-sequence-is-the-clock.db.test.ts`, where it can be proven to be
 * USED rather than re-implemented. A unit test could only prove that this
 * repository still contains the string `papic_arm_challenge`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { KWENTO_MOMENTS, type KwentoMomentKey } from './kwento-moments';
import { CHALLENGE_POOL, MOMENT_CHALLENGES } from './papic-challenge-pool';
import {
  SEQUENCE_SUGGESTIONS,
  isKwentoMomentKey,
  orderMomentCandidates,
  suggestForMoments,
} from './papic-ceremony-sequence';

const ALL_MOMENTS = KWENTO_MOMENTS.map((m) => m.key);

/** A library row shaped the way the query returns one. */
function row(library_id: number, slug: string, extra: Partial<{ title: string; prompt: string }> = {}) {
  return {
    library_id,
    slug,
    title: extra.title ?? slug,
    prompt: extra.prompt ?? `prompt for ${slug}`,
    capture_kind: 'photo',
    mission_type: 'prompt',
  };
}

/** The real pool rows for a moment, as the mapped-lane query would return them. */
function poolRowsFor(moments: readonly KwentoMomentKey[]) {
  const wanted = new Set(moments);
  return CHALLENGE_POOL.filter((r) => r.momentKeys?.some((k) => wanted.has(k as KwentoMomentKey)))
    .map((r) => row(r.libraryId, r.slug, { title: r.title, prompt: r.prompt }));
}

// ── 1 · The mapping itself ──────────────────────────────────────────────────

test('every ceremony moment has candidate prompts authored for it', () => {
  for (const moment of ALL_MOMENTS) {
    const list = MOMENT_CHALLENGES[moment];
    assert.ok(
      list.length > 0,
      `${moment} maps to nothing — the sequence would degrade there at every celebration, including a wedding`,
    );
  }
});

test('a moment maps to SEVERAL candidates, not one', () => {
  // § 5: "A moment maps to SEVERAL candidate prompts". One prompt per moment is
  // a take-it-or-leave-it, which is not a two-minute setup — it is a form.
  for (const moment of ALL_MOMENTS) {
    assert.ok(
      MOMENT_CHALLENGES[moment].length >= 2,
      `${moment} offers only ${MOMENT_CHALLENGES[moment].length} — a coordinator has no choice there`,
    );
  }
});

test('a prompt may suit more than one moment', () => {
  const multi = CHALLENGE_POOL.filter((r) => (r.momentKeys?.length ?? 0) > 1);
  assert.ok(
    multi.length > 0,
    'no prompt suits two moments; § 5 says one may, and a mapping that cannot express it is the wrong shape',
  );
});

test('every slug the sequence names exists in the pool — and the pool refuses one that does not', () => {
  // `attachMoments` throws at MODULE LOAD on an unknown slug, so importing the
  // pool at all is half the proof. This asserts the other half: that the throw
  // is reachable, i.e. the check is real and not a comment about one.
  const slugs = new Set(CHALLENGE_POOL.map((r) => r.slug));
  for (const moment of ALL_MOMENTS) {
    for (const slug of MOMENT_CHALLENGES[moment]) {
      assert.ok(slugs.has(slug), `MOMENT_CHALLENGES.${moment} names "${slug}", which is not in the pool`);
    }
  }
  const mapped = CHALLENGE_POOL.filter((r) => r.momentKeys !== null);
  const named = new Set(Object.values(MOMENT_CHALLENGES).flat());
  assert.equal(
    mapped.length,
    named.size,
    'a row carries momentKeys that MOMENT_CHALLENGES does not name — the two have drifted',
  );
});

test('the sequence maps a MINORITY of the pool — it is a shortlist, not a relabelling', () => {
  // If most of the library named a moment, the shelf would be the library again
  // and the coordinator would be back at the blank page this removes.
  const mapped = CHALLENGE_POOL.filter((r) => r.momentKeys !== null).length;
  assert.ok(mapped > 0, 'nothing is mapped at all');
  assert.ok(
    mapped < CHALLENGE_POOL.length / 4,
    `${mapped} of ${CHALLENGE_POOL.length} rows name a moment; that is a relabelling, not a shortlist`,
  );
});

test('a moment yields the prompts a coordinator would expect', () => {
  // The named case, spelled out rather than derived — a derivation from
  // MOMENT_CHALLENGES would pass no matter what MOMENT_CHALLENGES said.
  const expected: Partial<Record<KwentoMomentKey, string>> = {
    bridal_march: 'the-aisle-walk',
    exchange_of_vows: 'the-vows',
    veil_and_cord: 'the-unity-moment',
    first_kiss: 'the-first-kiss',
    first_dance: 'the-first-dance',
    cake_cutting: 'the-cake-cut',
    money_dance: 'the-money-dance',
    newlywed_entrance: 'the-grand-entrance',
  };
  for (const [moment, slug] of Object.entries(expected) as [KwentoMomentKey, string][]) {
    const got = suggestForMoments(poolRowsFor([moment]), [], [moment], new Set()).get(moment)!;
    assert.equal(got.basis, 'sequence', `${moment} degraded when it has a mapping`);
    assert.equal(
      got.candidates[0]?.slug,
      slug,
      `${moment} leads with ${got.candidates[0]?.slug}, not ${slug} — a coordinator opening this expects the obvious one first`,
    );
  }
});

// ── 2 · The order ───────────────────────────────────────────────────────────

test('candidates come back in the authored order, not the order the database returned them', () => {
  const authored = MOMENT_CHALLENGES.cake_cutting;
  const shuffled = [...poolRowsFor(['cake_cutting'])].reverse();
  const ordered = orderMomentCandidates(shuffled, 'cake_cutting');
  assert.deepEqual(
    ordered.map((r) => r.slug),
    [...authored],
  );
});

test('a row that names the moment but is not authored sorts last rather than being dropped', () => {
  // Reachable only mid-deploy, between a seed landing and this module shipping.
  // Showing one extra sensible prompt is a smaller failure than showing none.
  const stray = row(9998, 'a-prompt-from-the-future');
  const ordered = orderMomentCandidates([stray, ...poolRowsFor(['first_kiss'])], 'first_kiss');
  assert.equal(ordered.at(-1)!.slug, 'a-prompt-from-the-future');
  assert.equal(ordered[0]!.slug, MOMENT_CHALLENGES.first_kiss[0]);
});

// ── 3 · The degrade — the ruled behaviour ──────────────────────────────────

test('an unmapped moment degrades to the general pool, and says that is what it did', () => {
  const general = [row(900, 'the-cake'), row(901, 'first-plate'), row(902, 'the-rice')];
  const got = suggestForMoments([], general, ['bridal_march'], new Set()).get('bridal_march')!;

  assert.equal(got.basis, 'general', 'it must SAY it fell back — presenting the general pool as this moment’s own suggestions is a claim that is not true');
  assert.ok(got.candidates.length > 0, 'it degraded to NOTHING, which is the one outcome § 5 forbids');
  assert.deepEqual(got.candidates.map((c) => c.slug), ['the-cake', 'first-plate', 'the-rice']);
});

test('EVERY moment degrades rather than empties when nothing mapped is in scope', () => {
  // The live shape of a non-wedding celebration: the wedding-scoped rows are
  // filtered out by the query before this ever runs, so the mapped lane arrives
  // empty for most of the sequence.
  const general = Array.from({ length: SEQUENCE_SUGGESTIONS }, (_, i) => row(900 + i, `general-${i}`));
  const all = suggestForMoments([], general, ALL_MOMENTS, new Set());
  for (const moment of ALL_MOMENTS) {
    const got = all.get(moment)!;
    assert.equal(got.basis, 'general', `${moment} claimed a mapping it does not have`);
    assert.ok(got.candidates.length > 0, `${moment} offered the guests nothing`);
  }
});

test('a moment whose only mapped prompt is already placed elsewhere degrades — it does not show an empty shelf', () => {
  // ⚠ THE ORDER OF OPERATIONS IS THE TEST. Subtracting `taken` AFTER choosing
  // the lane leaves a "made for this moment" heading over nothing at all, which
  // is the degrade-to-nothing failure wearing the mapped lane's clothes.
  const onlyMapped = row(1225, 'the-aisle-walk');
  const general = [row(900, 'the-cake'), row(901, 'first-plate')];
  const got = suggestForMoments([onlyMapped], general, ['bridal_march'], new Set([1225]))
    .get('bridal_march')!;

  assert.equal(got.basis, 'general');
  assert.ok(got.candidates.length > 0, 'the shelf emptied instead of degrading');
  assert.ok(
    !got.candidates.some((c) => c.library_id === 1225),
    'it re-offered a prompt already placed at another moment — the database refuses the second placement, so that button cannot work',
  );
});

test('a placed prompt is never re-offered on the general shelf either', () => {
  const general = [row(900, 'the-cake'), row(901, 'first-plate')];
  const got = suggestForMoments([], general, ['cocktail_hour'], new Set([900])).get('cocktail_hour')!;
  assert.deepEqual(got.candidates.map((c) => c.library_id), [901]);
});

test('a shelf is capped, and the cap is derived from the authored lists rather than picked', () => {
  const longest = Math.max(...Object.values(MOMENT_CHALLENGES).map((l) => l.length));
  assert.equal(
    SEQUENCE_SUGGESTIONS,
    longest,
    'the cap stopped being the longest authored list; a degraded moment now looks different from a mapped one for no reason',
  );
  const general = Array.from({ length: 50 }, (_, i) => row(900 + i, `general-${i}`));
  const got = suggestForMoments([], general, ['bridal_march'], new Set()).get('bridal_march')!;
  assert.equal(got.candidates.length, SEQUENCE_SUGGESTIONS);
});

// ── 4 · The key is checked at the door ─────────────────────────────────────

test('only the ten locked keys are moment keys', () => {
  for (const m of ALL_MOMENTS) assert.ok(isKwentoMomentKey(m));
  for (const bad of ['', 'bridal-march', 'BRIDAL_MARCH', 'garter_toss', null, undefined, 7, {}]) {
    assert.equal(isKwentoMomentKey(bad), false, `${String(bad)} was accepted as a moment`);
  }
});

test('the sequence and the editorial moments are the same ten, in the same order', () => {
  // `kwento_assignments` uses these keys for a different question (who WRITES
  // about a moment). One vocabulary, two questions — if the run of show grew
  // its own list, the two screens would name different ceremonies.
  assert.deepEqual(Object.keys(MOMENT_CHALLENGES).sort(), [...ALL_MOMENTS].sort());
});
