/**
 * "MAKE IT YOURS" — the words-and-moments half's moves (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`
 * step 6).
 *
 * The half a unit test can hold: new words land BELOW everything and never on a photo; a look
 * stays inside its range; a TURNED caption stays on the sheet by its turned box; a moment is
 * added, named, removed (its photos back in the tray, never lost) and reordered without ever
 * being listed twice; a set is one chip per name and places only what is still free. After every
 * move — including 3,000 random ones — (photos on pages + tray) is the photo count and step 3's
 * save would accept what the editor shows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addMoment,
  addWords,
  clampWords,
  editWords,
  forgetSet,
  isWords,
  moveMoment,
  moveObject,
  nameSet,
  placePhoto,
  placeSet,
  placedRefs,
  putAllBack,
  refsOn,
  removeMoment,
  removeObject,
  renameMoment,
  reorderMoments,
  setFree,
  settle,
  snapTurn,
  styleWords,
  toAutomatic,
  toHand,
  type MakeItYoursWorld,
} from './make-it-yours';
import { ARRANGEMENT_POOL_CAP } from './story-arrangement-store';
import {
  MOMENTS_MAX,
  NEW_MOMENT_NAME,
  OBJECTS_PER_MOMENT_MAX,
  PHOTO_H,
  SHEET_WIDTH,
  WORD_SIZE,
  boxOf,
  overlaps,
  resolveArrangement,
  sanitizeArrangementForSave,
  storedFromResolved,
  turnedBox,
  wordsMaxWidth,
  type PoolItem,
  type ResolvedArrangement,
  type RunOfShowMoment,
  type StoredWords,
} from './story-arrangement';

const P = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (hh: number, mm: number) => Date.UTC(2026, 7, 20, hh - 8, mm);

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

const opened = (world: MakeItYoursWorld = WORLD): ResolvedArrangement =>
  resolveArrangement({ stored: null, runOfShow: world.runOfShow, pool: world.pool });
const hand = () => toHand(opened(), WORLD);

function assertWhole(state: ResolvedArrangement, where = '') {
  const onPages = placedRefs(state);
  assert.equal(new Set(onPages).size, onPages.length, `a photo is in two places ${where}`);
  assert.equal(onPages.length + state.unplaced.length, POOL.length, `pages + tray ≠ photo count ${where}`);
  const ids = state.moments.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, `a moment is listed twice ${where}`);
  assert.ok(state.moments.length >= 1, `no page left to put things on ${where}`);
  for (const m of state.moments) {
    for (const o of m.objects) {
      const b = boxOf(o);
      assert.ok(o.x >= 0 && o.y >= 0, `off the sheet ${where}`);
      if (isWords(o)) {
        assert.ok(b.x >= -0.5 && b.x + b.w <= SHEET_WIDTH + 0.5 || b.w > SHEET_WIDTH, `turned words off the side ${where}`);
        assert.ok(b.y >= -0.5, `turned words above the sheet ${where}`);
      }
    }
  }
  const saved = sanitizeArrangementForSave(storedFromResolved(state));
  assert.ok(saved.ok, `the save would refuse this ${where}: ${saved.ok ? '' : saved.problem}`);
}

const words = (st: ResolvedArrangement, momentId: string, id: string) =>
  st.moments.find((m) => m.id === momentId)!.objects.find((o) => o.id === id) as StoredWords;

/* ── WORDS ─────────────────────────────────────────────────────────────── */

test('+ Words is an EMPTY box, BELOW everything on the page, never on a photo (10a RL-12)', () => {
  const st = hand();
  const table = st.moments[2]!; // The long table holds five photos — two rows of them
  const r = addWords(st, WORLD, table.id);
  assert.ok(r.ok);
  const w = words(r.state, table.id, r.id);
  assert.equal(w.text, '', 'a placeholder is not a caption (10a critic-7)');
  const photos = r.state.moments[2]!.objects.filter((o) => o.kind === 'photo');
  const lowest = Math.max(...photos.map((p) => p.y + p.h));
  assert.ok(w.y >= lowest, `landed at ${w.y}, above the lowest photo's edge ${lowest}`);
  for (const p of photos) assert.ok(!overlaps(boxOf(w), boxOf(p)), 'landed on a photo');
  assertWhole(r.state);
});

test('words are refused in Automatic, like every other change', () => {
  const s0 = opened();
  const march = s0.moments[0]!.id;
  const r = addWords(s0, WORLD, march);
  assert.equal(r.ok, false);
  assert.equal(r.ok ? null : r.refusal, 'automatic');
  assert.equal(r.state, s0);
  assert.equal(addMoment(s0, WORLD).ok, false);
  assert.equal(nameSet(s0, WORLD, march, 'The entourage').ok, false);
});

test('typing keeps the host’s line breaks and reads back exactly', () => {
  const st = hand();
  const vows = st.moments[1]!.id;
  const a = addWords(st, WORLD, vows);
  assert.ok(a.ok);
  const e = editWords(a.state, WORLD, vows, a.id, 'She came down the path\nand the rain stopped.', { w: 310, h: 64 });
  assert.ok(e.ok);
  const w = words(e.state, vows, a.id);
  assert.equal(w.text, 'She came down the path\nand the rain stopped.');
  assert.equal(w.w, 310);
  assert.equal(w.h, 64);
  assert.deepEqual(settle(e.state, WORLD), e.state, 'a reload changes nothing');
  assertWhole(e.state);
});

test('a look stays inside its range — size 12…64, the four colours, a real turn', () => {
  const st = hand();
  const vows = st.moments[1]!.id;
  const a = addWords(st, WORLD, vows);
  assert.ok(a.ok);
  const big = styleWords(a.state, WORLD, vows, a.id, { size: 500 });
  assert.ok(big.ok);
  assert.equal(words(big.state, vows, a.id).size, WORD_SIZE.max);
  const small = styleWords(a.state, WORLD, vows, a.id, { size: 1 });
  assert.ok(small.ok);
  assert.equal(words(small.state, vows, a.id).size, WORD_SIZE.min);
  const odd = styleWords(a.state, WORLD, vows, a.id, { color: 'purple' as never });
  assert.ok(odd.ok);
  assert.equal(words(odd.state, vows, a.id).color, 'ink', 'a colour the toolbar does not offer is not kept');
  const gold = styleWords(a.state, WORLD, vows, a.id, { color: 'gold', backing: true, turn: -15 });
  assert.ok(gold.ok);
  const g = words(gold.state, vows, a.id);
  assert.deepEqual([g.color, g.backing, g.turn], ['gold', true, -15]);
  assertWhole(gold.state);
});

test('the round handle snaps straight within 5°, and only within 5°', () => {
  assert.equal(snapTurn(4), 0);
  assert.equal(snapTurn(-4), 0);
  assert.equal(snapTurn(356), 0);
  assert.equal(snapTurn(364), 0);
  assert.equal(snapTurn(6), 6);
  assert.equal(snapTurn(-20), -20);
});

test('a TURNED caption stays on the sheet by its TURNED box (10a r3 chaos-r3-08)', () => {
  // A wide caption turned 30°, pushed hard into each corner.
  const base = { text: 'A long caption for the vows', turn: 30, w: 380, h: 60 };
  const tr = clampWords({ ...base, x: 9_999, y: -500 });
  const tb = turnedBox({ x: tr.x, y: tr.y, w: 380, h: 60 }, 30);
  assert.ok(tb.x + tb.w <= SHEET_WIDTH + 0.5, `right corner off the sheet: ${tb.x + tb.w}`);
  assert.ok(tb.y >= -0.5, `top corner above the sheet: ${tb.y}`);
  const tl = clampWords({ ...base, x: -9_999, y: -9_999 });
  const tb2 = turnedBox({ x: tl.x, y: tl.y, w: 380, h: 60 }, 30);
  assert.ok(tb2.x >= -0.5 && tb2.y >= -0.5, `left/top corner off: ${tb2.x},${tb2.y}`);
  // An unturned box keeps the plain rule — no wider than the sheet allows.
  assert.deepEqual(clampWords({ text: 'x', turn: 0, w: 200, h: 40, x: 9_999, y: 5 }), { x: SHEET_WIDTH - 200, y: 5 });
  // …and a stored x never leaves the store's own range, so it reads back exactly.
  const narrowTurned = clampWords({ text: 'x', turn: 90, w: 400, h: 40, x: -9_999, y: 0 });
  assert.ok(narrowTurned.x >= 0);
});

test('turning a caption near the top re-clamps it — the turn moves it, never out', () => {
  const st = hand();
  const vows = st.moments[1]!.id;
  const a = addWords(st, WORLD, vows);
  assert.ok(a.ok);
  const typed = editWords(a.state, WORLD, vows, a.id, 'Turned near the top', { w: 300, h: 40 });
  assert.ok(typed.ok);
  const top = moveObject(typed.state, WORLD, vows, a.id, { x: 200, y: 0 });
  assert.ok(top.ok);
  const turned = styleWords(top.state, WORLD, vows, a.id, { turn: 45 });
  assert.ok(turned.ok);
  const w = words(turned.state, vows, a.id);
  assert.ok(boxOf(w).y >= -0.5, `its turned corner is above the sheet at ${boxOf(w).y}`);
  assertWhole(turned.state);
});

test('words never grow wider than the sheet, at any size', () => {
  assert.equal(wordsMaxWidth(WORD_SIZE.default), 400);
  assert.equal(wordsMaxWidth(WORD_SIZE.max), SHEET_WIDTH);
  for (let s = WORD_SIZE.min; s <= WORD_SIZE.max; s += 1) assert.ok(wordsMaxWidth(s) <= SHEET_WIDTH);
});

test('taking words off is a removal like a photo — it goes, and Undo is the editor’s snapshot', () => {
  const st = hand();
  const vows = st.moments[1]!.id;
  const a = addWords(st, WORLD, vows);
  assert.ok(a.ok);
  const typed = editWords(a.state, WORLD, vows, a.id, 'Keep me');
  assert.ok(typed.ok);
  const r = removeObject(typed.state, WORLD, vows, a.id);
  assert.ok(r.ok);
  assert.equal(r.state.moments[1]!.objects.some((o) => o.id === a.id), false);
  assert.equal(r.state.handTouched, false, 'words are not photos — Automatic would not re-sort them');
  assertWhole(r.state);
});

/* ── MOMENTS ───────────────────────────────────────────────────────────── */

test('+ New adds a moment of the host’s own at the end, with a random id (10a F11)', () => {
  const st = hand();
  const a = addMoment(st, WORLD);
  const b = a.ok ? addMoment(a.state, WORLD) : a;
  assert.ok(a.ok && b.ok);
  assert.notEqual(a.id, b.id);
  assert.match(a.id, /^own:/);
  const last = b.state.moments[b.state.moments.length - 1]!;
  assert.equal(last.id, b.id);
  assert.equal(last.name, NEW_MOMENT_NAME);
  assert.equal(last.source, 'host');
  assertWhole(b.state);
});

test('✎ an empty name is not a name — the moment keeps the one it had', () => {
  const st = hand();
  const vows = st.moments[1]!.id;
  const r = renameMoment(st, WORLD, vows, '   ');
  assert.equal(r.ok, false);
  assert.equal(r.ok ? null : r.refusal, 'no_name');
  const n = renameMoment(st, WORLD, vows, '  The promises  ');
  assert.ok(n.ok);
  assert.equal(n.state.moments[1]!.name, 'The promises');
  const long = renameMoment(st, WORLD, vows, 'x'.repeat(200));
  assert.ok(long.ok);
  assert.equal(long.state.moments[1]!.name!.length, 60);
  assertWhole(n.state);
});

test('row × takes the moment away and its photos back to the tray — never with it', () => {
  const st = hand();
  const table = st.moments[2]!;
  const n = refsOn(table).length;
  assert.ok(n > 0);
  const a = addWords(st, WORLD, table.id);
  assert.ok(a.ok);
  const r = removeMoment(a.state, WORLD, table.id);
  assert.ok(r.ok);
  assert.equal(r.state.moments.some((m) => m.id === table.id), false);
  assert.equal(r.state.unplaced.length, n, 'every photo on the removed page is back in the tray');
  assert.equal(r.state.handTouched, true);
  assertWhole(r.state);
  // Back to Automatic, the run of show's moment is there again (10a critic-2 · M-R3-16).
  const auto = toAutomatic(r.state, WORLD);
  assert.ok(auto.state.moments.some((m) => m.id === table.id));
  assert.equal(auto.state.unplaced.length, 0);
});

test('the last moment stays — a story needs one page to put things on', () => {
  let st = hand();
  while (st.moments.length > 1) {
    const r = removeMoment(st, WORLD, st.moments[0]!.id);
    assert.ok(r.ok);
    st = r.state;
  }
  const last = removeMoment(st, WORLD, st.moments[0]!.id);
  assert.equal(last.ok, false);
  assert.equal(last.ok ? null : last.refusal, 'last_moment');
  assertWhole(st);
});

test('a reorder lists every moment EXACTLY ONCE, whatever the list handed back (10a r3 chaos-r3-10)', () => {
  const st = hand();
  const [a, b, c] = st.moments.map((m) => m.id);
  // A stale list: one id twice, one unknown, one missing.
  const r = reorderMoments(st, WORLD, [c!, a!, c!, 'own:gone']);
  assert.ok(r.ok);
  assert.deepEqual(r.state.moments.map((m) => m.id), [c, a, b]);
  assert.equal(r.state.handTouched, true);
  assertWhole(r.state);
  assert.equal(reorderMoments(st, WORLD, [a!, b!, c!]).ok, false, 'no change is not a change');
});

test('Alt+Arrow moves one place, and stops at the ends', () => {
  const st = hand();
  const [a, b, c] = st.moments.map((m) => m.id);
  const down = moveMoment(st, WORLD, a!, 1);
  assert.ok(down.ok);
  assert.deepEqual(down.state.moments.map((m) => m.id), [b, a, c]);
  assert.equal(moveMoment(st, WORLD, a!, -1).ok, false);
  assert.equal(moveMoment(st, WORLD, c!, 1).ok, false);
});

/* ── NAMED SETS ────────────────────────────────────────────────────────── */

test('a set needs two photos on the page, and one chip per name', () => {
  const st = hand();
  const march = st.moments[0]!; // one photo only
  const table = st.moments[2]!;
  const one = nameSet(st, WORLD, march.id, 'Alone');
  assert.equal(one.ok, false);
  assert.equal(one.ok ? null : one.refusal, 'too_few');
  const a = nameSet(st, WORLD, table.id, 'The entourage');
  assert.ok(a.ok);
  const vowsRefs = refsOn(st.moments[1]!);
  const b = nameSet(a.state, WORLD, st.moments[1]!.id, 'The entourage');
  assert.equal(b.ok, vowsRefs.length >= 2);
  const again = nameSet(a.state, WORLD, table.id, 'The entourage');
  assert.ok(again.ok);
  assert.equal(again.state.sets.filter((s) => s.name === 'The entourage').length, 1, 'one chip per name');
  assert.equal(nameSet(st, WORLD, table.id, '  ').ok, false);
  assertWhole(again.state);
});

test('a chip says what is still free, places only that, and × forgets the name — never the photos', () => {
  let st = hand();
  const table = st.moments[2]!;
  const named = nameSet(st, WORLD, table.id, 'The long table');
  assert.ok(named.ok);
  st = named.state;
  const set = st.sets[0]!;
  assert.deepEqual(setFree(st, set), { free: [], total: set.refs.length }, 'all placed');
  assert.equal(placeSet(st, WORLD, st.moments[0]!.id, set.name).ok, false, 'nothing free to place');

  // Take two off: the chip now has two free, and places exactly those two on another page.
  const two = st.moments[2]!.objects.slice(0, 2);
  for (const o of two) st = removeObject(st, WORLD, table.id, o.id).state;
  assert.equal(setFree(st, st.sets[0]!).free.length, 2);
  const placed = placeSet(st, WORLD, st.moments[0]!.id, set.name);
  assert.ok(placed.ok);
  assert.equal(refsOn(placed.state.moments[0]!).length, refsOn(st.moments[0]!).length + 2);
  assertWhole(placed.state);

  const before = placedRefs(placed.state);
  const forgot = forgetSet(placed.state, WORLD, set.name);
  assert.ok(forgot.ok);
  assert.equal(forgot.state.sets.length, 0);
  assert.deepEqual(placedRefs(forgot.state), before, 'the photos stay put');
  assertWhole(forgot.state);
});

/* ── THE SAVE'S CEILINGS ──────────────────────────────────────────────── */

test('the editor never makes a story its own save would refuse — found by the monkey', () => {
  // ⓵ Moments: + New stops at the save's ceiling instead of making a story that cannot save.
  let st = hand();
  while (st.moments.length < MOMENTS_MAX) {
    const a = addMoment(st, WORLD);
    assert.ok(a.ok);
    st = a.state;
  }
  const over = addMoment(st, WORLD);
  assert.equal(over.ok, false);
  assert.equal(over.ok ? null : over.refusal, 'full');
  assertWhole(st);

  // ⓶ A busy moment: more photos in one moment than the old 400 ceiling, sorted there by
  //    Automatic — "I choose" must still save.
  assert.ok(OBJECTS_PER_MOMENT_MAX > ARRANGEMENT_POOL_CAP, 'a page must hold every capture the pool can hold');
  const many: PoolItem[] = Array.from({ length: 450 }, (_, i) => ({
    ref: P(1_000 + i),
    media: 'photo',
    capturedAtMs: at(19, 0) + i * 1_000,
    stillKey: null,
    playKey: null,
  }));
  const busy: MakeItYoursWorld = { runOfShow: RUN_OF_SHOW, pool: many };
  const chosen = toHand(opened(busy), busy);
  assert.equal(refsOn(chosen.moments[2]).length, 450);
  const saved = sanitizeArrangementForSave(storedFromResolved(chosen));
  assert.ok(saved.ok, `I choose on a busy moment would never save: ${saved.ok ? '' : saved.problem}`);
});

/* ── THE MONKEY ────────────────────────────────────────────────────────── */

test('A MONKEY: 3,000 random moves from every control, and the story is whole after each', () => {
  let seed = 777;
  const rnd = (n: number) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return Math.floor((seed / 4294967296) * n);
  };
  let st = opened();
  for (let i = 0; i < 3_000; i += 1) {
    const m = st.moments[rnd(st.moments.length)]!;
    const pick = m.objects[rnd(Math.max(1, m.objects.length))];
    const wordsHere = m.objects.filter(isWords);
    const w = wordsHere[rnd(Math.max(1, wordsHere.length))];
    switch (rnd(16)) {
      case 0:
        st = toHand(st, WORLD);
        break;
      case 1:
        if (rnd(5) === 0) st = toAutomatic(st, WORLD).state;
        break;
      case 2:
        st = placePhoto(st, WORLD, m.id, POOL[rnd(POOL.length)]!.ref).state;
        break;
      case 3:
        if (pick) st = removeObject(st, WORLD, m.id, pick.id).state;
        break;
      case 4:
        st = putAllBack(st, WORLD, m.id).state;
        break;
      case 5:
        if (pick) st = moveObject(st, WORLD, m.id, pick.id, { x: rnd(900) - 100, y: rnd(1200) - 100 }).state;
        break;
      case 6:
        st = addWords(st, WORLD, m.id).state;
        break;
      case 7:
        if (w) st = editWords(st, WORLD, m.id, w.id, rnd(3) ? 'Words\nwith a break' : '', { w: 40 + rnd(620), h: 20 + rnd(200) }).state;
        break;
      case 8:
        if (w) st = styleWords(st, WORLD, m.id, w.id, { size: rnd(80), turn: rnd(720) - 360, backing: rnd(2) === 0, color: (['ink', 'terracotta', 'blue', 'gold'] as const)[rnd(4)] }).state;
        break;
      case 9:
        st = addMoment(st, WORLD).state;
        break;
      case 10:
        st = renameMoment(st, WORLD, m.id, rnd(4) ? `Moment ${i}` : '').state;
        break;
      case 11:
        if (rnd(3) === 0) st = removeMoment(st, WORLD, m.id).state;
        break;
      case 12: {
        const ids = st.moments.map((x) => x.id);
        const shuffled = ids.map((id) => [rnd(1000), id] as const).sort((a, b) => a[0] - b[0]).map(([, id]) => id);
        if (rnd(3) === 0) shuffled.push(shuffled[0]!); // a stale list with a repeat
        st = reorderMoments(st, WORLD, shuffled).state;
        break;
      }
      case 13:
        st = moveMoment(st, WORLD, m.id, rnd(2) ? 1 : -1).state;
        break;
      case 14:
        st = nameSet(st, WORLD, m.id, `Set ${rnd(3)}`).state;
        break;
      default: {
        const set = st.sets[rnd(Math.max(1, st.sets.length))];
        if (set) st = rnd(2) ? placeSet(st, WORLD, m.id, set.name).state : forgetSet(st, WORLD, set.name).state;
      }
    }
    assertWhole(st, `after move ${i}`);
  }
  assert.ok(PHOTO_H > 0);
});
