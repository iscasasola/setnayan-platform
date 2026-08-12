/**
 * lib/alaala-wall.test.ts — the five lenses must be FIVE ANSWERS.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * Alaala's five lenses are owner-approved (2026-07-15) and, until 2026-08-13,
 * three of them returned the same thing: a list of events. `PhotosTab` answered
 * Recent, Owned AND Attended with one card per event and a photo count, and
 * People / With me answered with prose because neither is an album. Five words,
 * two answers, one of them the board's job.
 *
 * The regression is not a crash. A lens that quietly returns the same rows as
 * its neighbour renders perfectly and reads as finished, so the only thing that
 * can catch it is an assertion that the selections DIFFER on data where they
 * must. That is what these tests are.
 *
 * ── AND THE OTHER HALF: "NOTHING HERE" MUST BE TRUE ────────────────────────
 * A refused query and an empty table are the same value out of PostgREST.
 * `lensCounts` must answer `null` — NOT MEASURED — when a read failed, because
 * a "0" over a rejected read is a lie about somebody's memories, and it is the
 * exact shape that filed an unmeasured admin queue under "N queues are clear"
 * on 2026-08-05.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALAALA_LENSES,
  EMPTY_WALL,
  lensCounts,
  lensIsWall,
  orderWall,
  selectLens,
  type AlaalaLensKey,
  type AlaalaWall,
  type WallItem,
} from './alaala-wall';

function frame(over: Partial<WallItem> & { key: string }): WallItem {
  return {
    url: `https://example.test/${over.key}`,
    isClip: false,
    capturedAt: '2026-08-01T00:00:00Z',
    eventId: 'e1',
    eventName: 'A wedding',
    role: 'couple',
    withMe: false,
    ...over,
  };
}

/**
 * An account with a life: two own celebrations and one they attended, and they
 * are tagged in some of it. Every lens has a genuinely different answer here.
 */
const LIVED: AlaalaWall = {
  items: orderWall([
    frame({ key: 'papic_photos:a', eventId: 'own1', capturedAt: '2026-08-10T10:00:00Z' }),
    frame({ key: 'papic_photos:b', eventId: 'own1', capturedAt: '2026-08-09T10:00:00Z', withMe: true }),
    frame({ key: 'papic_photos:c', eventId: 'own2', capturedAt: '2026-07-01T10:00:00Z', isClip: true }),
    frame({ key: 'papic_photos:d', eventId: 'att1', role: 'guest', capturedAt: '2026-06-01T10:00:00Z', withMe: true }),
  ]),
  faces: [
    { key: 'person:1', displayName: 'Lola Ising', inMemoriam: true, eventCount: 3 },
    { key: 'person:2', displayName: 'Tita Baby', inMemoriam: false, eventCount: 1 },
  ],
  unreadable: false,
  facesMeasured: true,
};

test('the five lenses are the owner-approved five, in the tile order', () => {
  assert.deepEqual(
    ALAALA_LENSES.map((l) => l.key),
    ['recent', 'owned', 'attended', 'people', 'with_me'],
  );
});

test('no two frame-lenses return the same set on an account with a life', () => {
  const frameLenses: AlaalaLensKey[] = ['recent', 'owned', 'attended', 'with_me'];
  const sets = frameLenses.map((lens) => ({
    lens,
    keys: selectLens(LIVED, lens)
      .map((i) => i.key)
      .sort()
      .join('|'),
  }));
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      assert.notEqual(
        sets[i]!.keys,
        sets[j]!.keys,
        `"${sets[i]!.lens}" and "${sets[j]!.lens}" answered with the SAME frames. ` +
          `Five lenses that give one answer is what made Alaala a second list of events.`,
      );
    }
  }
});

test('People is not a wall — it answers with faces, and selectLens gives it no frames', () => {
  assert.equal(lensIsWall('people'), false);
  assert.deepEqual(selectLens(LIVED, 'people'), []);
  // …and it is the ONE lens whose unit is a person, not a frame.
  assert.equal(lensCounts(LIVED).people, LIVED.faces.length);
  assert.notEqual(lensCounts(LIVED).people, lensCounts(LIVED).recent);
});

test('Owned and Attended partition Recent — a frame is never in both, none is lost', () => {
  const owned = selectLens(LIVED, 'owned').map((i) => i.key);
  const attended = selectLens(LIVED, 'attended').map((i) => i.key);
  const recent = selectLens(LIVED, 'recent').map((i) => i.key);
  assert.deepEqual(
    owned.filter((k) => attended.includes(k)),
    [],
    'a frame cannot be both hosted and attended',
  );
  assert.deepEqual([...owned, ...attended].sort(), [...recent].sort());
});

test('With me holds only frames the viewer is tagged in, and crosses events', () => {
  const withMe = selectLens(LIVED, 'with_me');
  assert.ok(withMe.length > 0);
  assert.ok(
    withMe.every((i) => i.withMe),
    'With me must never include a frame the viewer is not in',
  );
  // The whole reason it lives at the account level: it spans events, so it can
  // never be a section inside one of them.
  assert.ok(
    new Set(withMe.map((i) => i.eventId)).size > 1,
    'With me is every photo of you across six years — it belongs to no single event',
  );
});

test('an attended frame is a tagged frame by construction', () => {
  // getGuestLiveGallery is the ONLY attended read, and it returns exclusively
  // the viewer's tagged, clean photos. If an attended frame ever arrives with
  // withMe false, the read widened and the "With me" lens has quietly gone
  // narrower than the truth.
  for (const item of selectLens(LIVED, 'attended')) {
    assert.equal(item.withMe, true);
  }
});

test('the wall is newest first, deduped, and an undated frame sorts LAST', () => {
  const ordered = orderWall([
    frame({ key: 'x', capturedAt: null }),
    frame({ key: 'y', capturedAt: '2026-01-01T00:00:00Z' }),
    frame({ key: 'z', capturedAt: '2026-05-01T00:00:00Z' }),
    frame({ key: 'y', capturedAt: '2026-01-01T00:00:00Z' }),
    frame({ key: 'w', capturedAt: 'not-a-date' }),
  ]);
  assert.deepEqual(
    ordered.map((i) => i.key),
    ['z', 'y', 'x', 'w'],
  );
});

test('a REFUSED read counts as null, never as zero', () => {
  const refused: AlaalaWall = { ...EMPTY_WALL, unreadable: true };
  const counts = lensCounts(refused);
  for (const lens of ['recent', 'owned', 'attended', 'with_me'] as AlaalaLensKey[]) {
    assert.equal(
      counts[lens],
      null,
      `"${lens}" reported a number from a read that failed. An empty table and a ` +
        `rejected query are the same value; only one of them means "nothing yet".`,
    );
  }
});

test('faces that were never measured count null; measured-and-empty counts 0', () => {
  assert.equal(lensCounts({ ...EMPTY_WALL, facesMeasured: false }).people, null);
  assert.equal(lensCounts({ ...EMPTY_WALL, facesMeasured: true }).people, 0);
});

test('a readable, genuinely empty account reports 0 — not null', () => {
  const counts = lensCounts({ ...EMPTY_WALL, facesMeasured: true });
  assert.equal(counts.recent, 0);
  assert.equal(counts.owned, 0);
});
