/**
 * THE ARRANGEMENT — the shape a host saves, and what each reader is shown.
 *
 * `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 3, DONE WHEN: save → reload returns the
 * arrangement exactly; a taken-back photo drops out of every saved page; these tests fail when
 * the one-photo-one-moment check or the visibility filter is removed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PHOTO_H,
  PHOTO_W,
  THE_DAY_MOMENT,
  boxOf,
  dropNamesThatAreLabels,
  newArrangementId,
  overlaps,
  readStoredArrangement,
  resolveArrangement,
  resolveArrangementForViewer,
  sanitizeArrangementForSave,
  storedFromResolved,
  type PoolItem,
  type RunOfShowMoment,
  type StoredArrangement,
} from './story-arrangement';
import { STRANGER } from './who-can-see-your-story';

const P = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const at = (hh: number, mm: number) => Date.UTC(2026, 7, 20, hh - 8, mm); // Manila wall clock

const RUN_OF_SHOW: RunOfShowMoment[] = [
  { id: 'ros:S89B-MARCH00001', label: 'The march', startMs: at(14, 38) },
  { id: 'ros:S89B-VOWS000001', label: 'The vows', startMs: at(15, 4) },
  { id: 'ros:S89B-TABLE00001', label: 'The long table', startMs: at(18, 40) },
];

const item = (n: number, t: number | null, media: PoolItem['media'] = 'photo'): PoolItem => ({
  ref: P(n),
  media,
  capturedAtMs: t,
  stillKey: `papic/${n}.jpg`,
  playKey: media === 'snippet' ? `papic/${n}.mp4` : null,
});

// The prototype's eight stamps, in spirit: one before the day starts, the rest across it.
const POOL: PoolItem[] = [
  item(1, at(14, 0)),
  item(2, at(14, 40)),
  item(3, at(15, 12), 'snippet'),
  item(4, at(17, 5)),
  item(5, at(19, 20)),
  item(6, at(20, 0)),
];

const HOST = { isHost: true, belongsToEvent: true };
const GUEST = { isHost: false, belongsToEvent: true };

/** A hand arrangement using every field the step says to keep. */
function handDoc(): StoredArrangement {
  return {
    shape: 1,
    mode: 'hand',
    handTouched: true,
    moments: [
      {
        id: 'ros:S89B-VOWS000001',
        name: 'Their vows',
        objects: [
          { id: 'photo:a1', kind: 'photo', ref: P(2), x: 20, y: 16, w: PHOTO_W, h: PHOTO_H },
          {
            id: 'words:a2',
            kind: 'words',
            text: 'She came down the path\nand the rain stopped.',
            x: 190,
            y: 40,
            size: 23,
            color: 'terracotta',
            backing: true,
            turn: -15,
            w: 260,
            h: 64,
          },
          { id: 'photo:a3', kind: 'photo', ref: P(5), x: 336, y: 300, w: PHOTO_W, h: PHOTO_H },
        ],
      },
      { id: 'ros:S89B-MARCH00001', objects: [] },
      {
        id: 'own:k2m9x0',
        name: 'After the rain',
        objects: [
          { id: 'photo:b1', kind: 'photo', ref: P(3), x: 178, y: 144, w: PHOTO_W, h: PHOTO_H },
          {
            id: 'words:b2',
            kind: 'words',
            text: 'Everybody danced.',
            x: 20,
            y: 400,
            size: 19,
            color: 'gold',
            backing: false,
            turn: 375,
          },
        ],
      },
    ],
    sets: [{ name: 'The entourage', refs: [P(2), P(5)] }],
  };
}

/* ── save → reload returns the arrangement exactly ───────────────────────── */

test('a saved arrangement reads back EXACTLY — through the save, the database and the read', () => {
  const sent = handDoc();
  const saved = sanitizeArrangementForSave(sent);
  assert.ok(saved.ok, 'a well-formed arrangement must be accepted');
  assert.deepEqual(saved.doc, sent, 'the save changed something the host set');

  // What the database hands back is JSON; the read repairs nothing on a clean document.
  const reread = readStoredArrangement(JSON.parse(JSON.stringify(saved.doc)));
  assert.deepEqual(reread, sent);

  // And what the editor shows, taken back into a document, is what was saved.
  const shown = resolveArrangement({ stored: reread, runOfShow: RUN_OF_SHOW, pool: POOL });
  assert.equal(shown.mode, 'hand');
  assert.deepEqual(
    shown.moments.map((m) => m.id),
    sent.moments.map((m) => m.id),
    'the host\'s own order must survive',
  );
  const roundTrip = dropNamesThatAreLabels(storedFromResolved(shown), RUN_OF_SHOW);
  assert.deepEqual(roundTrip, sent);
});

test('every look on words is kept — colour, backing, size, turn — even a turn past a full circle', () => {
  const saved = sanitizeArrangementForSave(handDoc());
  assert.ok(saved.ok);
  const words = saved.doc.moments[2]!.objects[1]!;
  assert.equal(words.kind, 'words');
  if (words.kind !== 'words') return;
  assert.equal(words.color, 'gold');
  assert.equal(words.backing, false);
  assert.equal(words.size, 19);
  assert.equal(words.turn, 375, 'folding 375° into 15° would not read back exactly');
});

/* ── ONE PHOTOGRAPH, ONE PLACE ───────────────────────────────────────────── */

test('a save that puts one photo in TWO moments is refused', () => {
  const doc = handDoc();
  doc.moments[1]!.objects.push({ id: 'photo:dup', kind: 'photo', ref: P(2), x: 20, y: 16, w: 146, h: 100 });
  const res = sanitizeArrangementForSave(doc);
  assert.equal(res.ok, false, 'a photo in two moments was ACCEPTED');
  if (!res.ok) assert.equal(res.problem, 'photo_in_two_places');
});

test('a save that puts one photo TWICE on one page is refused — a double tap is the same fault', () => {
  const doc = handDoc();
  doc.moments[0]!.objects.push({ id: 'photo:dup', kind: 'photo', ref: P(2), x: 178, y: 16, w: 146, h: 100 });
  const res = sanitizeArrangementForSave(doc);
  assert.equal(res.ok, false, 'a photo twice on one page was ACCEPTED');
  if (!res.ok) assert.equal(res.problem, 'photo_in_two_places');
});

test('the check reads the capture id, not how it is written — upper case is the same photo', () => {
  const doc = handDoc();
  doc.moments[1]!.objects.push({
    id: 'photo:dup',
    kind: 'photo',
    ref: P(2).toUpperCase(),
    x: 20,
    y: 16,
    w: 146,
    h: 100,
  });
  const res = sanitizeArrangementForSave(doc);
  assert.equal(res.ok, false);
});

test('a STORED document that holds one photo twice (written by hand) shows it ONCE', () => {
  const doc = handDoc() as unknown as { moments: Array<{ objects: unknown[] }> };
  doc.moments[1]!.objects.push({ id: 'photo:dup', kind: 'photo', ref: P(2), x: 20, y: 16, w: 146, h: 100 });
  const stored = readStoredArrangement(doc);
  assert.ok(stored, 'a repairable document must still be read');
  const shown = resolveArrangement({ stored, runOfShow: RUN_OF_SHOW, pool: POOL });
  const onPages = shown.moments.flatMap((m) => m.objects).filter((o) => o.kind === 'photo' && o.ref === P(2));
  assert.equal(onPages.length, 1, `P2 is on ${onPages.length} pages`);
});

test('…and so does the resolver on its own, for a caller that never went through the read', () => {
  // The read's repair and the resolver's check are two fences; each must hold without the other.
  const doc = handDoc();
  doc.moments[1]!.objects.push({ id: 'photo:dup', kind: 'photo', ref: P(2), x: 20, y: 16, w: 146, h: 100 });
  const shown = resolveArrangement({ stored: doc, runOfShow: RUN_OF_SHOW, pool: POOL });
  const onPages = shown.moments.flatMap((m) => m.objects).filter((o) => o.kind === 'photo' && o.ref === P(2));
  assert.equal(onPages.length, 1, `P2 is on ${onPages.length} pages`);
});

test('photos on pages + photos in the tray ALWAYS equals the pool — nothing twice, nothing lost', () => {
  for (const stored of [handDoc(), null, { ...handDoc(), mode: 'auto' as const }]) {
    const shown = resolveArrangement({ stored, runOfShow: RUN_OF_SHOW, pool: POOL });
    const onPages = shown.moments.flatMap((m) => m.objects).filter((o) => o.kind === 'photo');
    const refs = [...onPages.map((o) => (o.kind === 'photo' ? o.ref : '')), ...shown.unplaced.map((p) => p.ref)];
    assert.equal(refs.length, POOL.length, `mode ${shown.mode}: ${refs.length} ≠ ${POOL.length}`);
    assert.equal(new Set(refs).size, POOL.length, `mode ${shown.mode}: a photo appears twice`);
  }
});

/* ── ONLY WHAT THIS VIEWER MAY SEE ───────────────────────────────────────── */

test('a TAKEN-BACK photo drops out of every saved page, the tray and every set', () => {
  // The pool is what the store builds through the consent veto; P2 and P5 are withdrawn.
  const pool = POOL.filter((p) => p.ref !== P(2) && p.ref !== P(5));
  const shown = resolveArrangement({ stored: handDoc(), runOfShow: RUN_OF_SHOW, pool });
  const everywhere = JSON.stringify(shown);
  assert.equal(everywhere.includes(P(2)), false, 'a taken-back photo is still in the arrangement');
  assert.equal(everywhere.includes(P(5)), false, 'a taken-back photo is still in the arrangement');
  // The page it was on keeps everything else.
  const vows = shown.moments.find((m) => m.id === 'ros:S89B-VOWS000001')!;
  assert.deepEqual(vows.objects.map((o) => o.id), ['words:a2']);
});

test('…and in Automatic too — a withdrawn photo is never dealt onto a page', () => {
  const pool = POOL.filter((p) => p.ref !== P(4));
  const shown = resolveArrangement({ stored: null, runOfShow: RUN_OF_SHOW, pool });
  assert.equal(JSON.stringify(shown).includes(P(4)), false);
});

test('…and the host\'s next save lets go of it, rather than carrying it invisibly forever', () => {
  const pool = POOL.filter((p) => p.ref !== P(2));
  const shown = resolveArrangement({ stored: handDoc(), runOfShow: RUN_OF_SHOW, pool });
  assert.equal(JSON.stringify(storedFromResolved(shown)).includes(P(2)), false);
});

test('S3 — before publish, a stranger is given NO moments at all, not pages with the photos off', () => {
  for (const status of ['draft', 'event', 'taken_back'] as const) {
    const shown = resolveArrangementForViewer({
      stored: handDoc(),
      runOfShow: RUN_OF_SHOW,
      pool: POOL,
      status,
      viewer: STRANGER,
    });
    assert.equal(shown.withheld, true, `status ${status}: a stranger was admitted`);
    assert.equal(shown.moments.length, 0, `status ${status}: ${shown.moments.length} moments reached a stranger`);
    assert.equal(shown.unplaced.length, 0);
    assert.equal(JSON.stringify(shown).includes('rain stopped'), false);
  }
});

test('S3 — the people of the day see it at "event"; everyone at "published"; the host always', () => {
  const cases = [
    { status: 'event' as const, viewer: GUEST },
    { status: 'published' as const, viewer: STRANGER },
    { status: 'draft' as const, viewer: HOST },
    { status: 'taken_back' as const, viewer: HOST },
  ];
  for (const { status, viewer } of cases) {
    const shown = resolveArrangementForViewer({ stored: handDoc(), runOfShow: RUN_OF_SHOW, pool: POOL, status, viewer });
    assert.equal(shown.withheld, false, `status ${status} refused a reader it admits`);
    assert.equal(shown.moments.length, 3);
  }
});

test('an empty caption box reaches the host (they are typing) but never a reader', () => {
  const doc = handDoc();
  doc.moments[2]!.objects.push({
    id: 'words:empty',
    kind: 'words',
    text: '   ',
    x: 20,
    y: 500,
    size: 19,
    color: 'ink',
    backing: true,
    turn: 0,
  });
  const args = { stored: doc, runOfShow: RUN_OF_SHOW, pool: POOL, status: 'published' as const };
  const host = resolveArrangementForViewer({ ...args, viewer: HOST });
  const reader = resolveArrangementForViewer({ ...args, viewer: STRANGER });
  const has = (r: typeof host) => r.moments.some((m) => m.objects.some((o) => o.id === 'words:empty'));
  assert.equal(has(host), true);
  assert.equal(has(reader), false);
});

/* ── AUTOMATIC IS DERIVED, NOT STORED ────────────────────────────────────── */

test('Automatic is not stored — photo objects are left out of an Automatic save', () => {
  const saved = sanitizeArrangementForSave({ ...handDoc(), mode: 'auto' });
  assert.ok(saved.ok);
  const photos = saved.doc.moments.flatMap((m) => m.objects).filter((o) => o.kind === 'photo');
  assert.equal(photos.length, 0, 'Automatic stored photo positions');
  // Words are the host's, in either mode.
  assert.equal(saved.doc.moments.flatMap((m) => m.objects).filter((o) => o.kind === 'words').length, 2);
});

test('Automatic sorts every capture into the run-of-show moment that had ALREADY STARTED', () => {
  const shown = resolveArrangement({ stored: null, runOfShow: RUN_OF_SHOW, pool: POOL });
  assert.equal(shown.mode, 'auto');
  const home = (n: number) =>
    shown.moments.find((m) => m.objects.some((o) => o.kind === 'photo' && o.ref === P(n)))?.id;
  assert.equal(home(1), 'ros:S89B-MARCH00001', 'a photo from before the first moment goes to the first');
  assert.equal(home(2), 'ros:S89B-MARCH00001');
  assert.equal(home(3), 'ros:S89B-VOWS000001', 'a snippet is sorted like a photo');
  assert.equal(home(4), 'ros:S89B-VOWS000001', '5:05 is still the vows — the last moment that had started');
  assert.equal(home(5), 'ros:S89B-TABLE00001');
  assert.equal(home(6), 'ros:S89B-TABLE00001');
  assert.equal(shown.unplaced.length, 0);
});

test('Automatic is re-derived on every read — a photo that arrives later sorts itself', () => {
  const later = [...POOL, item(7, at(15, 30))];
  const shown = resolveArrangement({ stored: null, runOfShow: RUN_OF_SHOW, pool: later });
  const vows = shown.moments.find((m) => m.id === 'ros:S89B-VOWS000001')!;
  assert.ok(vows.objects.some((o) => o.kind === 'photo' && o.ref === P(7)));
});

test('back to Automatic brings back a run-of-show moment the host REMOVED by hand', () => {
  const doc = handDoc();
  doc.moments = doc.moments.filter((m) => m.id !== 'ros:S89B-MARCH00001');
  const inHand = resolveArrangement({ stored: doc, runOfShow: RUN_OF_SHOW, pool: POOL });
  assert.equal(inHand.moments.some((m) => m.id === 'ros:S89B-MARCH00001'), false, 'I choose keeps the removal');

  const auto = resolveArrangement({ stored: { ...doc, mode: 'auto' }, runOfShow: RUN_OF_SHOW, pool: POOL });
  assert.deepEqual(
    auto.moments.map((m) => m.id),
    ['ros:S89B-MARCH00001', 'ros:S89B-VOWS000001', 'ros:S89B-TABLE00001', 'own:k2m9x0'],
    'Automatic lists the run of show in time order, then the host\'s own moments',
  );
  // The host's own moment keeps its words and gets no photos; the rename survives.
  const own = auto.moments.find((m) => m.id === 'own:k2m9x0')!;
  assert.deepEqual(own.objects.map((o) => o.kind), ['words']);
  assert.equal(auto.moments.find((m) => m.id === 'ros:S89B-VOWS000001')!.name, 'Their vows');
});

test('Automatic never deals a photo on top of the host\'s words (10a M-R3-17)', () => {
  const doc: StoredArrangement = {
    shape: 1,
    mode: 'auto',
    handTouched: false,
    moments: [
      {
        id: 'ros:S89B-MARCH00001',
        objects: [
          { id: 'words:t', kind: 'words', text: 'The march', x: 20, y: 16, size: 30, color: 'ink', backing: false, turn: 0, w: 300, h: 60 },
        ],
      },
    ],
    sets: [],
  };
  const shown = resolveArrangement({ stored: doc, runOfShow: RUN_OF_SHOW, pool: POOL });
  const march = shown.moments.find((m) => m.id === 'ros:S89B-MARCH00001')!;
  const words = march.objects.find((o) => o.kind === 'words')!;
  for (const o of march.objects) {
    if (o.kind === 'photo') assert.equal(overlaps(boxOf(o), boxOf(words)), false, `${o.ref} sits on the words`);
  }
});

test('without a run of show there is nothing to sort by — the story opens in I choose, on one page', () => {
  const shown = resolveArrangement({ stored: null, runOfShow: [], pool: POOL });
  assert.equal(shown.mode, 'hand');
  assert.equal(shown.hasRunOfShow, false);
  assert.deepEqual(shown.moments.map((m) => [m.id, m.name]), [[THE_DAY_MOMENT.id, THE_DAY_MOMENT.name]]);
  assert.equal(shown.unplaced.length, POOL.length, 'every photo starts in the tray');
  // And a stored Automatic with no run of show to derive from reads as I choose.
  const stored = resolveArrangement({ stored: { ...handDoc(), mode: 'auto' }, runOfShow: [], pool: POOL });
  assert.equal(stored.mode, 'hand');
});

/* ── NAMES ───────────────────────────────────────────────────────────────── */

test('a run-of-show moment follows its block\'s label unless the host renamed it', () => {
  const shown = resolveArrangement({ stored: handDoc(), runOfShow: RUN_OF_SHOW, pool: POOL });
  assert.equal(shown.moments.find((m) => m.id === 'ros:S89B-MARCH00001')!.name, 'The march');
  assert.equal(shown.moments.find((m) => m.id === 'ros:S89B-VOWS000001')!.name, 'Their vows');
});

test('a block made PRIVATE later keeps its page but never lends it the hidden label', () => {
  const publicOnly = RUN_OF_SHOW.filter((b) => b.id !== 'ros:S89B-MARCH00001');
  const shown = resolveArrangement({ stored: handDoc(), runOfShow: publicOnly, pool: POOL });
  const march = shown.moments.find((m) => m.id === 'ros:S89B-MARCH00001')!;
  assert.equal(march.name, null);
  assert.equal(march.startMs, null);
});

test('a "rename" that is only the block\'s label is not stored as one', () => {
  const doc = handDoc();
  doc.moments[1]!.name = 'The march';
  assert.equal(dropNamesThatAreLabels(doc, RUN_OF_SHOW).moments[1]!.name, undefined);
});

/* ── IDS ─────────────────────────────────────────────────────────────────── */

test('a repeated moment or object id is refused — the reload collision of 10a R8 / F11', () => {
  const twoMoments = handDoc();
  twoMoments.moments.push({ id: 'own:k2m9x0', name: 'Again', objects: [] });
  const a = sanitizeArrangementForSave(twoMoments);
  assert.ok(!a.ok && a.problem === 'duplicate_moment');

  const twoObjects = handDoc();
  twoObjects.moments[1]!.objects.push({ ...twoObjects.moments[2]!.objects[1]! });
  const b = sanitizeArrangementForSave(twoObjects);
  assert.ok(!b.ok && b.problem === 'duplicate_object');
});

test('new ids do not repeat', () => {
  const ids = new Set(Array.from({ length: 2_000 }, () => newArrangementId('own')));
  assert.equal(ids.size, 2_000);
  for (const id of ids) assert.match(id, /^own:[a-z0-9]{9}$/);
});

test('a story needs a moment; a malformed id or capture id is refused, not stored', () => {
  assert.equal(sanitizeArrangementForSave({ ...handDoc(), moments: [] }).ok, false);
  const badRef = handDoc();
  (badRef.moments[0]!.objects[0] as { ref: string }).ref = 'javascript:alert(1)';
  assert.equal(sanitizeArrangementForSave(badRef).ok, false);
  const badMoment = handDoc();
  badMoment.moments[0]!.id = 'ros:../../x';
  assert.equal(sanitizeArrangementForSave(badMoment).ok, false);
});

test('positions are kept inside the 660 sheet', () => {
  const doc = handDoc();
  const photo = doc.moments[0]!.objects[0] as { x: number; y: number };
  photo.x = 9_999;
  photo.y = -40;
  const saved = sanitizeArrangementForSave(doc);
  assert.ok(saved.ok);
  const kept = saved.doc.moments[0]!.objects[0]!;
  assert.equal(kept.x, 660 - PHOTO_W);
  assert.equal(kept.y, 0);
});

test('an unreadable stored document reads as a story nobody arranged — never a thrown page', () => {
  for (const raw of [null, 'x', 42, [], { moments: 'no' }, { moments: [] }]) {
    assert.equal(readStoredArrangement(raw), null);
  }
});
