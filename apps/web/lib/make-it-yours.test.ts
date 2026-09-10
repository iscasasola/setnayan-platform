/**
 * "MAKE IT YOURS" — the photo half's moves (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 4).
 *
 * DONE WHEN, the half a unit test can hold: (photos on pages + tray) is ALWAYS the photo count;
 * a photograph is never in two places however the add is repeated; Automatic is read-only and
 * re-derives; the editor never produces a document step 3's save would refuse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clampPosition,
  moveObject,
  placePhoto,
  placedRefs,
  putAllBack,
  removeObject,
  settle,
  toAutomatic,
  toHand,
  type MakeItYoursWorld,
} from './make-it-yours';
import {
  PHOTO_H,
  PHOTO_W,
  SHEET_WIDTH,
  boxOf,
  overlaps,
  resolveArrangement,
  sanitizeArrangementForSave,
  storedFromResolved,
  type PoolItem,
  type ResolvedArrangement,
  type RunOfShowMoment,
  type StoredArrangement,
} from './story-arrangement';

const P = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (hh: number, mm: number) => Date.UTC(2026, 7, 20, hh - 8, mm); // Manila wall clock

const RUN_OF_SHOW: RunOfShowMoment[] = [
  { id: 'ros:S89B-MARCH00001', label: 'The march', startMs: at(14, 38) },
  { id: 'ros:S89B-VOWS000001', label: 'The vows', startMs: at(15, 4) },
  { id: 'ros:S89B-TABLE00001', label: 'The long table', startMs: at(18, 40) },
];
const TIMES = [at(14, 38), at(15, 4), at(17, 12), at(18, 40), at(19, 12), at(20, 5), at(21, 20), at(21, 47)];
const POOL: PoolItem[] = TIMES.map((t, i) => ({
  ref: P(i + 1),
  media: i === 1 || i === 4 ? 'snippet' : 'photo',
  capturedAtMs: t,
  stillKey: null,
  playKey: null,
}));
const WORLD: MakeItYoursWorld = { runOfShow: RUN_OF_SHOW, pool: POOL };

/** A story nobody has arranged, as the editor opens it. */
const opened = (world: MakeItYoursWorld = WORLD): ResolvedArrangement =>
  resolveArrangement({ stored: null, runOfShow: world.runOfShow, pool: world.pool });

/** THE INVARIANT the step's DONE WHEN names, checked from the state alone. */
function assertWhole(state: ResolvedArrangement, world: MakeItYoursWorld = WORLD, where = '') {
  const onPages = placedRefs(state);
  assert.equal(new Set(onPages).size, onPages.length, `a photo is in two places ${where}`);
  assert.equal(
    onPages.length + state.unplaced.length,
    world.pool.length,
    `pages + tray ≠ photo count ${where}`,
  );
  for (const m of state.moments) {
    for (const o of m.objects) {
      assert.ok(o.x >= 0 && o.x + (o.kind === 'photo' ? o.w : 0) <= SHEET_WIDTH, `off the sheet ${where}`);
      assert.ok(o.y >= 0, `above the sheet ${where}`);
    }
  }
  // …and whatever the editor shows, step 3's save would accept.
  const saved = sanitizeArrangementForSave(storedFromResolved(state));
  assert.ok(saved.ok, `the save would refuse this ${where}: ${saved.ok ? '' : saved.problem}`);
}

test('the editor opens in Automatic, with every photo sorted and an empty tray', () => {
  const s0 = opened();
  assert.equal(s0.mode, 'auto');
  assert.equal(s0.unplaced.length, 0);
  assertWhole(s0);
});

test('AUTOMATIC IS READ-ONLY — every move is refused, and says so', () => {
  const s0 = opened();
  const march = s0.moments[0]!.id;
  const photo = s0.moments[0]!.objects[0]!;
  for (const move of [
    placePhoto(s0, WORLD, march, P(1)),
    removeObject(s0, WORLD, march, photo.id),
    putAllBack(s0, WORLD, march),
    moveObject(s0, WORLD, march, photo.id, { x: 300, y: 10 }),
  ]) {
    assert.equal(move.ok, false);
    assert.equal(move.ok ? null : move.refusal, 'automatic');
    assert.equal(move.state, s0, 'a refused move changes nothing');
  }
});

test('I CHOOSE starts from what Automatic made — nothing moves', () => {
  const s0 = opened();
  const s1 = toHand(s0, WORLD);
  assert.equal(s1.mode, 'hand');
  assert.equal(s1.handTouched, false, 'switching is not hand work');
  assert.deepEqual(
    s1.moments.map((m) => m.objects.map((o) => [o.kind === 'photo' ? o.ref : o.id, o.x, o.y])),
    s0.moments.map((m) => m.objects.map((o) => [o.kind === 'photo' ? o.ref : o.id, o.x, o.y])),
  );
  assertWhole(s1);
});

test('× sends a photo back to the tray; a tap puts it on this page, in the first free slot', () => {
  const s1 = toHand(opened(), WORLD);
  const table = s1.moments[2]!;
  const photo = table.objects[0]!;
  const r = removeObject(s1, WORLD, table.id, photo.id);
  assert.ok(r.ok);
  assert.equal(r.state.unplaced.length, 1);
  assert.equal(r.state.handTouched, true);
  assertWhole(r.state);

  const ref = r.state.unplaced[0]!.ref;
  const vows = r.state.moments[1]!.id;
  const a = placePhoto(r.state, WORLD, vows, ref);
  assert.ok(a.ok);
  assert.equal(a.state.unplaced.length, 0);
  const landed = a.state.moments[1]!.objects.find((o) => o.kind === 'photo' && o.ref === ref)!;
  const others = a.state.moments[1]!.objects.filter((o) => o !== landed);
  assert.ok(!others.some((o) => overlaps(boxOf(landed), boxOf(o))), 'landed on something');
  assertWhole(a.state);
});

test('ONE PHOTOGRAPH, ONE PLACE — a second Enter, a held key or a double tap adds it once', () => {
  let st = putAllBack(toHand(opened(), WORLD), WORLD, RUN_OF_SHOW[0]!.id).state;
  const ref = st.unplaced[0]!.ref;
  const first = placePhoto(st, WORLD, RUN_OF_SHOW[0]!.id, ref);
  assert.ok(first.ok);
  st = first.state;
  for (const target of [RUN_OF_SHOW[0]!.id, RUN_OF_SHOW[1]!.id]) {
    const again = placePhoto(st, WORLD, target, ref);
    assert.equal(again.ok, false);
    assert.equal(again.ok ? null : again.refusal, 'already_placed');
  }
  assert.equal(placedRefs(st).filter((r) => r === ref).length, 1);
  assertWhole(st);
});

test('a photo is never dealt onto the host’s words', () => {
  const stored: StoredArrangement = {
    shape: 1,
    mode: 'hand',
    handTouched: true,
    moments: [
      {
        id: RUN_OF_SHOW[0]!.id,
        objects: [
          { id: 'words:a', kind: 'words', text: 'She came down the path', x: 20, y: 16, size: 19, color: 'ink', backing: false, turn: 0, w: 300, h: 60 },
        ],
      },
    ],
    sets: [],
  };
  const st = resolveArrangement({ stored, runOfShow: RUN_OF_SHOW, pool: POOL });
  const r = placePhoto(st, WORLD, RUN_OF_SHOW[0]!.id, P(1));
  assert.ok(r.ok);
  const objs = r.state.moments.find((m) => m.id === RUN_OF_SHOW[0]!.id)!.objects;
  const words = objs.find((o) => o.kind === 'words')!;
  const photo = objs.find((o) => o.kind === 'photo')!;
  assert.ok(!overlaps(boxOf(photo), boxOf(words)));
  // …and Put all back leaves the words where they are.
  const back = putAllBack(r.state, WORLD, RUN_OF_SHOW[0]!.id);
  assert.ok(back.ok);
  const left = back.state.moments.find((m) => m.id === RUN_OF_SHOW[0]!.id)!.objects;
  assert.deepEqual(left.map((o) => o.id), ['words:a']);
  assertWhole(back.state);
});

test('a drag lands inside the sheet and comes to the front; an arrow nudges in place', () => {
  const st = toHand(opened(), WORLD);
  const table = st.moments[2]!;
  const [first, second] = table.objects;
  const dragged = moveObject(st, WORLD, table.id, first!.id, { x: 9_999, y: -40 });
  assert.ok(dragged.ok);
  const after = dragged.state.moments[2]!.objects;
  assert.equal(after[after.length - 1]!.id, first!.id, 'what you just moved comes to the front');
  assert.equal(after[after.length - 1]!.x, SHEET_WIDTH - PHOTO_W);
  assert.equal(after[after.length - 1]!.y, 0);

  const nudged = moveObject(st, WORLD, table.id, first!.id, { x: first!.x + 8, y: first!.y }, { toFront: false });
  assert.ok(nudged.ok);
  assert.deepEqual(nudged.state.moments[2]!.objects.map((o) => o.id), table.objects.map((o) => o.id));
  assert.equal(nudged.state.moments[2]!.objects[0]!.x, first!.x + 8);
  assert.ok(second);
  assertWhole(nudged.state);
});

test('the sheet grows downward: a photo may go below the first screen of it', () => {
  assert.deepEqual(clampPosition(40, 900, PHOTO_W), { x: 40, y: 900 });
  assert.deepEqual(clampPosition(-5, -5, PHOTO_W), { x: 0, y: 0 });
  assert.ok(PHOTO_H > 0);
});

test('BACK TO AUTOMATIC re-sorts, and says whether there was hand work to lose', () => {
  const s1 = toHand(opened(), WORLD);
  const clean = toAutomatic(s1, WORLD);
  assert.equal(clean.lostHandWork, false, 'nothing of theirs to lose — no Undo to offer');

  const worked = removeObject(s1, WORLD, s1.moments[0]!.id, s1.moments[0]!.objects[0]!.id).state;
  const back = toAutomatic(worked, WORLD);
  assert.equal(back.lostHandWork, true);
  assert.equal(back.state.mode, 'auto');
  assert.equal(back.state.unplaced.length, 0, 'every photo is sorted again');
  assertWhole(back.state);
});

test('Automatic without a run of show is refused, not silently empty (10a M-R3-16)', () => {
  const noSchedule: MakeItYoursWorld = { runOfShow: [], pool: POOL };
  const st = opened(noSchedule);
  assert.equal(st.mode, 'hand', 'with nothing to sort BY, the page opens in I choose');
  const r = toAutomatic(st, noSchedule);
  assert.equal(r.refused, true);
  assert.equal(r.state, st);
});

test('settle is idempotent — reading back what was saved changes nothing', () => {
  const st = toHand(opened(), WORLD);
  const once = settle(st, WORLD);
  assert.deepEqual(settle(once, WORLD), once);
});

test('A MONKEY: 2,000 random moves, and after every one the photo count is whole', () => {
  // A small LCG so a failure is replayable — the prototype's own chaos seed.
  let seed = 20260910;
  const rnd = (n: number) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return Math.floor((seed / 4294967296) * n);
  };
  let st = opened();
  for (let i = 0; i < 2_000; i += 1) {
    const m = st.moments[rnd(st.moments.length)]!;
    const objs = m.objects;
    const pick = objs[rnd(Math.max(1, objs.length))];
    switch (rnd(8)) {
      case 0:
        st = toHand(st, WORLD);
        break;
      case 1:
        if (rnd(4) === 0) st = toAutomatic(st, WORLD).state;
        break;
      case 2:
      case 3: {
        const ref = POOL[rnd(POOL.length)]!.ref; // placed or not — a repeat must be refused
        st = placePhoto(st, WORLD, m.id, ref).state;
        break;
      }
      case 4:
        if (pick) st = removeObject(st, WORLD, m.id, pick.id).state;
        break;
      case 5:
        st = putAllBack(st, WORLD, m.id).state;
        break;
      default:
        if (pick) {
          st = moveObject(st, WORLD, m.id, pick.id, { x: rnd(900) - 100, y: rnd(1200) - 100 }, { toFront: rnd(2) === 0 }).state;
        }
    }
    assertWhole(st, WORLD, `after move ${i}`);
  }
});
