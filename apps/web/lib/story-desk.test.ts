/**
 * THE DESK's rules, exercised without a database (08 step 1.2).
 *
 * Everything here is a property the host can feel: what they may accept, what
 * the meter reads, and what a decision writes. The two that matter most are
 * MONOTONICITY (the desk can only ever refuse more than the raw row does) and
 * the fact that a host decision can never spell itself `'user_deleted'`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureHeldBack,
  deskCounts,
  deskIsClear,
  isWaitingOnTheHost,
  matchesFilter,
  partiallyHeldBackSet,
  percentDecided,
  setHoldSentence,
  sortByArrival,
  statusForDatabase,
  statusFromDatabase,
  supplierHeldBack,
  wordsHeldBack,
  DESK_WRITE_TARGET,
  type DeskItem,
} from './story-desk';

const SAFE = {
  exists: true,
  hiddenAt: null,
  consentToPublic: true,
  moderationState: 'clean',
  taggedGuestOptedOut: false,
};

function item(over: Partial<DeskItem> = {}): DeskItem {
  return {
    source: 'kwento',
    id: 'i1',
    status: 'pending',
    arrivedAt: '2026-02-14T10:00:00.000Z',
    landsIn: 'What they said',
    lane: 'guest',
    title: 'A wish',
    body: 'words',
    authorKind: 'guest',
    byline: null,
    flag: 'f',
    editable: true,
    heldBack: null,
    set: null,
    ...over,
  };
}

test('a clean, consented, untagged capture is the ONLY thing that may be accepted', () => {
  assert.equal(captureHeldBack(SAFE), null);

  // Every single deviation refuses. Enumerated, not spot-checked: a capture
  // gate that permits one unmeant combination publishes a face somebody asked
  // us not to show.
  assert.equal(captureHeldBack({ ...SAFE, exists: false }), 'nothing_to_show');
  assert.equal(captureHeldBack({ ...SAFE, hiddenAt: '2026-02-14T11:00:00Z' }), 'withdrawn');
  assert.equal(captureHeldBack({ ...SAFE, consentToPublic: false }), 'withdrawn');
  assert.equal(captureHeldBack({ ...SAFE, moderationState: 'unscreened' }), 'unscreened');
  assert.equal(captureHeldBack({ ...SAFE, moderationState: 'nsfw_blocked' }), 'blocked');
  assert.equal(captureHeldBack({ ...SAFE, moderationState: 'consent_withheld' }), 'blocked');
  assert.equal(captureHeldBack({ ...SAFE, moderationState: 'faceblock_withheld' }), 'blocked');
  assert.equal(captureHeldBack({ ...SAFE, taggedGuestOptedOut: true }), 'guest_opted_out');
});

test('the veto is the FINAL word — a perfectly clean capture still cannot pass it', () => {
  // This is the whole ruling: "a capture's veto BEATS the host's curation".
  // If screening ever short-circuits ahead of it, a screened-clean photo of a
  // guest who opted out becomes acceptable.
  assert.equal(captureHeldBack({ ...SAFE, taggedGuestOptedOut: true }), 'guest_opted_out');
  assert.notEqual(captureHeldBack({ ...SAFE, taggedGuestOptedOut: true }), null);
});

test('MONOTONE: nothing the desk permits is wider than the raw row', () => {
  /*
    Exhaustive over every combination of the five inputs (2^4 × 5 states = 80).
    The property: `captureHeldBack` returns null ONLY for the one fully-safe
    shape. Any future edit that permits a second shape fails here by count.
  */
  const states = ['clean', 'unscreened', 'nsfw_blocked', 'consent_withheld', 'faceblock_withheld'];
  let permitted = 0;
  for (const exists of [true, false])
    for (const hidden of [null, '2026-01-01T00:00:00Z'])
      for (const consent of [true, false])
        for (const vetoed of [true, false])
          for (const ms of states) {
            const r = captureHeldBack({
              exists,
              hiddenAt: hidden,
              consentToPublic: consent,
              moderationState: ms,
              taggedGuestOptedOut: vetoed,
            });
            if (r === null) permitted += 1;
          }
  assert.equal(
    permitted,
    1,
    `captureHeldBack permits ${permitted} of 80 shapes — it must permit exactly ONE ` +
      '(exists · not hidden · consented · clean · not vetoed). Anything else is a widening.',
  );
});

test('a flagged wish is NOT held back — the database permits approving it', () => {
  // Narrowing this would refuse something `approved_needs_screen` allows, which
  // leaves a card the host can never clear and a desk that never reaches 100%.
  assert.equal(wordsHeldBack({ moderationState: 'flagged', userDeletedAt: null }), null);
  assert.equal(wordsHeldBack({ moderationState: 'clean', userDeletedAt: null }), null);
  assert.equal(wordsHeldBack({ moderationState: 'unscreened', userDeletedAt: null }), 'unscreened');
  assert.equal(wordsHeldBack({ moderationState: 'blocked', userDeletedAt: null }), 'blocked');
  assert.equal(wordsHeldBack({ moderationState: 'clean', userDeletedAt: '2026-01-01' }), 'withdrawn');
});

test('a supplier frame is held until the screen settles on clean — stricter than the words', () => {
  assert.equal(supplierHeldBack({ moderationState: 'clean' }), null);
  assert.equal(supplierHeldBack({ moderationState: 'unscreened' }), 'unscreened');
  for (const s of ['nsfw_blocked', 'consent_withheld', 'faceblock_withheld']) {
    assert.equal(supplierHeldBack({ moderationState: s }), 'blocked', `${s} must be held back`);
  }
});

test('a host decision can NEVER spell itself user_deleted', () => {
  // 'user_deleted' is the GUEST taking their own words back. A host who could
  // write it would record a withdrawal the guest never made.
  const written = (['pending', 'accepted', 'rejected'] as const).map(statusForDatabase);
  assert.deepEqual(written, ['pending', 'approved', 'rejected']);
  assert.ok(!written.includes('user_deleted' as never));
});

test('the two text tables spell acceptance "approved", and the desk word never reaches the database', () => {
  assert.equal(statusForDatabase('accepted'), 'approved');
  assert.notEqual(statusForDatabase('accepted'), 'accepted');
  assert.equal(statusFromDatabase('approved'), 'accepted');
  assert.equal(statusFromDatabase('rejected'), 'rejected');
  assert.equal(statusFromDatabase('pending'), 'pending');
  // A guest's own withdrawal is not a host decision — it reads as undecided,
  // and `wordsHeldBack` is what actually withholds the row.
  assert.equal(statusFromDatabase('user_deleted'), 'pending');
  assert.equal(statusFromDatabase(null), 'pending');
});

test('the letters table is written on its OWN reviewed column, not Kwento’s', () => {
  // Naming a column PostgREST cannot find makes it refuse the WHOLE update, and
  // that arrives as an absence rather than an error — the decision would look
  // taken and be lost.
  assert.equal(DESK_WRITE_TARGET.kwento.reviewedAtColumn, 'reviewed_by_couple_at');
  assert.equal(DESK_WRITE_TARGET.letter.reviewedAtColumn, 'reviewed_at');
  assert.notEqual(
    DESK_WRITE_TARGET.letter.reviewedAtColumn,
    DESK_WRITE_TARGET.kwento.reviewedAtColumn,
  );
  // The two new columns are granted on `status` ALONE, so nothing else may be
  // named in the patch at all.
  assert.equal(DESK_WRITE_TARGET.challenge.reviewedAtColumn, null);
  assert.equal(DESK_WRITE_TARGET.supplier.reviewedAtColumn, null);
  // Each source writes its own table and its own key.
  const tables = Object.values(DESK_WRITE_TARGET).map((t) => t.table);
  assert.equal(new Set(tables).size, 4, 'two sources share a table — a decision would hit the wrong row');
});

test('a held-back item is NOT "still waiting on you", so the desk can always be cleared', () => {
  /*
    🔑 THE BUG THIS EXISTS TO PREVENT: `Publish` is disabled until the desk is
    clear. If a held-back item counted as waiting, ANY event with one opted-out
    guest could never publish at all — a permanent, unexplainable block.
  */
  const held = item({ id: 'h', heldBack: 'guest_opted_out' });
  assert.equal(isWaitingOnTheHost(held), false);
  assert.equal(deskIsClear([held]), true);
  assert.equal(percentDecided([held]), 100);

  const open = item({ id: 'o' });
  assert.equal(isWaitingOnTheHost(open), true);
  assert.equal(deskIsClear([open]), false);
});

test('the meter counts decisions, and an empty desk is finished rather than unstarted', () => {
  assert.equal(percentDecided([]), 100);
  assert.equal(percentDecided([item(), item({ id: 'b' })]), 0);
  assert.equal(percentDecided([item({ status: 'accepted' }), item({ id: 'b' })]), 50);
  assert.equal(
    percentDecided([item({ status: 'accepted' }), item({ id: 'b', status: 'rejected' })]),
    100,
    'a rejection is a decision — it must move the meter exactly as an acceptance does',
  );
  // Held-back items sit outside the fraction entirely.
  assert.equal(
    percentDecided([item({ status: 'accepted' }), item({ id: 'h', heldBack: 'blocked' })]),
    100,
  );
});

test('the filters split the queue the way the card badges do', () => {
  const rows = [
    item({ id: 'a', lane: 'guest' }),
    item({ id: 'b', lane: 'supplier', source: 'supplier' }),
    item({ id: 'c', lane: 'guest', status: 'accepted' }),
    item({ id: 'd', lane: 'guest', heldBack: 'guest_opted_out' }),
  ];
  assert.equal(rows.filter((r) => matchesFilter(r, 'all')).length, 4);
  assert.equal(rows.filter((r) => matchesFilter(r, 'guest')).length, 3);
  assert.equal(rows.filter((r) => matchesFilter(r, 'supplier')).length, 1);
  // "Still waiting on you" = pending AND decidable: 'a' and 'b' only.
  assert.deepEqual(
    rows.filter((r) => matchesFilter(r, 'open')).map((r) => r.id),
    ['a', 'b'],
  );
  const counts = deskCounts(rows);
  assert.deepEqual(counts, { all: 4, guest: 3, supplier: 1, open: 2, heldBack: 1 });
});

test('a set’s acceptable count EXCLUDES what is held back — the sentence promises it', () => {
  const twelve = [
    ...Array.from({ length: 11 }, () => ({ ...SAFE })),
    { ...SAFE, taggedGuestOptedOut: true },
  ];
  const split = partiallyHeldBackSet(twelve);
  assert.deepEqual(split, { acceptable: 11, heldBack: 1 });
  const sentence = setHoldSentence(split.acceptable, split.heldBack);
  assert.match(sentence, /One of the 12 shows a guest who opted out of photos/);
  assert.match(sentence, /not counted above/);
  // The design's own wording, and the arithmetic behind it must agree.
  assert.equal(split.acceptable + split.heldBack, 12);
});

test('the queue sorts newest-first and never reshuffles between two renders', () => {
  const rows = [
    item({ id: 'old', arrivedAt: '2026-02-14T09:00:00.000Z' }),
    item({ id: 'new', arrivedAt: '2026-02-14T11:00:00.000Z' }),
    item({ id: 'mid', arrivedAt: '2026-02-14T10:00:00.000Z' }),
  ];
  assert.deepEqual(sortByArrival(rows).map((r) => r.id), ['new', 'mid', 'old']);
  // Deterministic on a tie — a queue that reorders loses the host's place.
  const tied = [
    item({ id: 'b', source: 'letter', arrivedAt: 'T' }),
    item({ id: 'a', source: 'kwento', arrivedAt: 'T' }),
  ];
  assert.deepEqual(sortByArrival(tied).map((r) => r.id), sortByArrival([...tied].reverse()).map((r) => r.id));
});
