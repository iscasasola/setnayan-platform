/**
 * YOUR RUN OF DAY — the role-scoped lens, held down.
 *
 * The whole feature is "the same shipped ranking functions with a narrower
 * input", so these tests exist to prove the narrowing is right and that it
 * stays a LENS: every block is returned, marked, never removed.
 *
 * Two protect the person rather than the property:
 *
 *   · NOTHING IS EVER DROPPED. Locked rule D2 in `vendor-timeline.ts` — a
 *     booked vendor keeps full-timeline visibility. A host told nothing about a
 *     moment is worse off than one told it is not his.
 *   · A role with NO CLAIM says so, rather than falling back to "everything is
 *     primary". Pretending a role owns moments it does not is how a focused view
 *     becomes noise again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  categoriesForSpecializationSet,
  roleRunOfDay,
  type RunBlock,
} from './role-run-of-day';

function block(over: Partial<RunBlock> & { block_id: string }): RunBlock {
  return {
    label: `Block ${over.block_id}`,
    block_type: 'program',
    start_at: '2026-12-12T10:00:00Z',
    ...over,
  };
}

// ── the vocabulary bridge ───────────────────────────────────────────────────

test('the couple-side category maps to the role that covers its tile', () => {
  assert.deepEqual(
    categoriesForSpecializationSet('stage_script', ['host_emcee', 'band_dj', 'florist']),
    ['host_emcee'],
  );
  assert.deepEqual(
    categoriesForSpecializationSet('song_desk', ['host_emcee', 'band_dj', 'florist']),
    ['band_dj'],
  );
  assert.deepEqual(
    categoriesForSpecializationSet('floor_command', ['planner_coordinator', 'band_dj']),
    ['planner_coordinator'],
  );
});

test('a coarse category that spans several tiles still matches when one is covered', () => {
  // band_dj → ['live_band','dj'], both inside the music set.
  assert.deepEqual(categoriesForSpecializationSet('song_desk', ['band_dj']), ['band_dj']);
});

test('unknown, exempt and malformed categories are skipped, never thrown on', () => {
  assert.doesNotThrow(() =>
    categoriesForSpecializationSet('stage_script', ['not_a_category', 'misc', '', 'host_emcee']),
  );
  assert.deepEqual(
    categoriesForSpecializationSet('stage_script', ['not_a_category', 'misc', 'host_emcee']),
    ['host_emcee'],
  );
  assert.deepEqual(categoriesForSpecializationSet('stage_script', null), []);
  assert.deepEqual(
    categoriesForSpecializationSet('stage_script', [42 as unknown as string, 'host_emcee']),
    ['host_emcee'],
  );
});

// ── the lens ────────────────────────────────────────────────────────────────

const TIMELINE: RunBlock[] = [
  block({ block_id: 'prep', block_type: 'pre_ceremony', start_at: '2026-12-12T08:00:00Z', label: 'Getting ready' }),
  block({ block_id: 'cocktails', block_type: 'cocktails', start_at: '2026-12-12T17:00:00Z', label: 'Cocktails' }),
  block({ block_id: 'program', block_type: 'program', start_at: '2026-12-12T18:15:00Z', label: 'Grand Entrance' }),
  block({ block_id: 'dinner', block_type: 'dinner', start_at: '2026-12-12T18:45:00Z', label: 'Dinner' }),
];

test('🔴 EVERY block is returned, whatever the role — a lens, never a gate', () => {
  for (const set of ['stage_script', 'song_desk', 'floor_command'] as const) {
    const run = roleRunOfDay({ blocks: TIMELINE, set, bookedCategories: ['host_emcee'] });
    assert.equal(run.entries.length, TIMELINE.length, `${set} dropped a block`);
  }
});

test('two roles see the SAME night differently — the point of the feature', () => {
  const emcee = roleRunOfDay({
    blocks: TIMELINE,
    set: 'stage_script',
    bookedCategories: ['host_emcee', 'makeup_artist'],
  });
  const stylist = roleRunOfDay({
    blocks: TIMELINE,
    // A stylist has no specialization set, so the closest real comparison is
    // the makeup/hair trade seen through a role that DOES cover it.
    set: 'stage_script',
    bookedCategories: ['makeup_artist'],
  });
  // The emcee's night and the hair-and-makeup night are not the same shape.
  assert.notDeepEqual(
    emcee.entries.map((e) => e.relevance),
    stylist.entries.map((e) => e.relevance),
  );
});

test('the prep block is the stylist trade’s, not the emcee’s', () => {
  // makeup_artist is `primary` on pre_ceremony in the shipped relevance map.
  const viaMakeup = roleRunOfDay({
    blocks: TIMELINE,
    set: 'stage_script',
    bookedCategories: ['makeup_artist'],
  });
  assert.equal(
    viaMakeup.entries.find((e) => e.blockId === 'prep')?.relevance,
    'context',
    'makeup_artist is not covered by the script role, so it cannot claim prep',
  );
});

test('🔴 a role with NO claim marks everything context and says empty — never "all primary"', () => {
  const run = roleRunOfDay({
    blocks: TIMELINE,
    set: 'song_desk',
    bookedCategories: ['florist'], // no music category booked
  });
  assert.equal(run.empty, true);
  assert.equal(run.yoursCount, 0);
  assert.ok(run.entries.every((e) => e.relevance === 'context'));
  assert.equal(run.entries.length, TIMELINE.length, 'still shows the whole night');
  assert.equal(run.callTime, null, 'and claims no call time it cannot justify');
});

test('yoursCount counts primary AND supporting, not just primary', () => {
  const run = roleRunOfDay({
    blocks: TIMELINE,
    set: 'song_desk',
    bookedCategories: ['band_dj'],
  });
  const marked = run.entries.filter((e) => e.yours).length;
  assert.equal(run.yoursCount, marked);
  assert.ok(run.yoursCount > 0, 'a booked band works some of this night');
});

test('entries come back in clock order, with untimed blocks last and stable', () => {
  const run = roleRunOfDay({
    blocks: [
      block({ block_id: 'z', start_at: null }),
      block({ block_id: 'late', start_at: '2026-12-12T20:00:00Z' }),
      block({ block_id: 'early', start_at: '2026-12-12T09:00:00Z' }),
      block({ block_id: 'a', start_at: null }),
    ],
    set: 'stage_script',
    bookedCategories: ['host_emcee'],
  });
  assert.deepEqual(run.entries.map((e) => e.blockId), ['early', 'late', 'a', 'z']);
});

test('an empty timeline is empty, not a throw', () => {
  const run = roleRunOfDay({ blocks: [], set: 'stage_script', bookedCategories: ['host_emcee'] });
  assert.deepEqual(run.entries, []);
  assert.equal(run.yoursCount, 0);
  assert.equal(run.callTime, null);
});

test('the call time is the ROLE’s, derived by the shipped helper', () => {
  // A stylist trade has a real load-in; the emcee does not.
  const hair = roleRunOfDay({
    blocks: TIMELINE,
    set: 'stage_script',
    bookedCategories: ['hair_stylist'],
  });
  // hair_stylist is not covered by the script role → no claim, no call time.
  assert.equal(hair.callTime, null);

  const band = roleRunOfDay({ blocks: TIMELINE, set: 'song_desk', bookedCategories: ['band_dj'] });
  assert.ok(band.callTime, 'a band has a known setup lead and a primary slot');
  assert.equal(band.callTime?.category, 'band_dj');
  assert.ok(
    new Date(band.callTime!.call_time) < new Date(band.callTime!.anchor_start_at),
    'call time is BEFORE the moment it is derived from',
  );
});
