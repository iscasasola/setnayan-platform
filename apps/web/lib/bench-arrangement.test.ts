/**
 * A COUPLE'S OWN ORDER SURVIVES THE SORT — AND NOTHING ELSE DOES.
 *
 * Owner 2026-09-09: a dragged card is pinned where it was put, the sort orders
 * everything unpinned, a supplier arriving later lands in its normal computed
 * position and never jumps to the front, and the arrangement is PER CATEGORY.
 *
 * ⚠ Each test is written so the obvious wrong implementation fails it:
 *  • "save the whole visible order" fails `a new supplier lands where the lens
 *    puts it`.
 *  • "drop pins that point past the end" fails `a pin outside the rail is
 *    clamped, never discarded`.
 *  • "let the later pin win the slot" fails `two pins wanting one slot both
 *    survive`.
 *  • "only re-pin the card that moved" fails `a displaced pin is re-pinned to
 *    where it actually shows`.
 *  • "write on every arrow press" fails `a nudge at the end of the rail is not
 *    a move`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyBenchArrangement,
  arrangementNote,
  hasVisibleArrangement,
  keyboardMoveTarget,
  pinMap,
  pinsAfterMove,
  type BenchPin,
} from '@/lib/bench-arrangement';

const idOf = (s: string): string => s;
const lay = (sorted: string[], pins: BenchPin[]): string[] =>
  applyBenchArrangement(sorted, pins, idOf);

// ── pins beat sort ─────────────────────────────────────────────────────────

test('a pinned card holds its slot and the lens orders the rest around it', () => {
  const sorted = ['a', 'b', 'c', 'd'];
  assert.deepEqual(lay(sorted, [{ vendorId: 'd', position: 0 }]), ['d', 'a', 'b', 'c']);
  assert.deepEqual(lay(sorted, [{ vendorId: 'a', position: 3 }]), ['b', 'c', 'd', 'a']);
});

test('with nothing pinned the lens is untouched', () => {
  const sorted = ['a', 'b', 'c'];
  assert.deepEqual(lay(sorted, []), sorted);
  // …and the array is a copy, so a caller cannot mutate the lens's answer.
  const out = lay(sorted, []);
  out.reverse();
  assert.deepEqual(sorted, ['a', 'b', 'c']);
});

test('a new supplier lands where the LENS puts it, never at the front or the back', () => {
  // The couple pinned 'd' first. A supplier 'z' then arrives and the lens ranks
  // it second. It must appear second among the unpinned — not appended, and not
  // jumped to the front.
  const pins = [{ vendorId: 'd', position: 0 }];
  // The lens now ranks the newcomer 'z' second overall.
  assert.deepEqual(lay(['a', 'z', 'b', 'c', 'd'], pins), ['d', 'a', 'z', 'b', 'c']);
  // Saving the whole visible order instead of sparse pins could not do this:
  // 'z' was not in that saved order at all.
});

test('every card that went in comes out, exactly once', () => {
  const sorted = ['a', 'b', 'c', 'd', 'e'];
  const out = lay(sorted, [
    { vendorId: 'e', position: 0 },
    { vendorId: 'a', position: 4 },
  ]);
  assert.equal(out.length, sorted.length);
  assert.deepEqual([...out].sort(), [...sorted].sort());
  assert.deepEqual(out, ['e', 'b', 'c', 'd', 'a']);
});

// ── the cases that are the normal case ─────────────────────────────────────

test('a pin outside the rail is clamped, never discarded', () => {
  // Pinned 6th, then two suppliers were removed. "As far right as there is
  // room" is the honest reading; dropping the pin loses the couple's decision.
  const out = lay(['a', 'b', 'c'], [{ vendorId: 'a', position: 5 }]);
  assert.deepEqual(out, ['b', 'c', 'a']);
});

test('two pins wanting one slot both survive, lower position first', () => {
  const out = lay(
    ['a', 'b', 'c', 'd'],
    [
      { vendorId: 'c', position: 1 },
      { vendorId: 'd', position: 1 },
    ],
  );
  // 'c' asked first (equal position, but it is placed by ascending want and
  // then array order), 'd' takes the next free slot rather than evicting it.
  assert.equal(out.length, 4);
  assert.deepEqual([...out].sort(), ['a', 'b', 'c', 'd']);
  assert.ok(out.indexOf('c') < out.indexOf('d'), 'the later pin must not evict the earlier one');
  assert.equal(out[1], 'c');
  assert.equal(out[2], 'd');
});

test('two pins clamped onto the same last slot both still appear', () => {
  const out = lay(['a', 'b'], [
    { vendorId: 'a', position: 9 },
    { vendorId: 'b', position: 9 },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual([...out].sort(), ['a', 'b']);
});

test('when two pins both point past the end, the one that asked to be furthest right IS', () => {
  // ⚠ THE EQUAL-POSITION TEST ABOVE CANNOT PROVE THIS. With both pins wanting
  // the same slot the comparator returns 0 whichever way round it is written,
  // so reversing it changes nothing and the guard is decoration. This fixture
  // gives them DISTINCT positions that both clamp onto the last slot, which is
  // the only case where the placement order is observable at all.
  //
  // 'b' asked for slot 7, 'a' for slot 9, and the rail holds four cards. 'a'
  // asked to be further right, so 'a' takes the last slot and 'b' settles just
  // before it.
  const out = lay(['a', 'b', 'c', 'd'], [
    { vendorId: 'b', position: 7 },
    { vendorId: 'a', position: 9 },
  ]);
  assert.deepEqual(out, ['c', 'd', 'b', 'a']);
});

test('a pin for a supplier who is gone changes nothing', () => {
  assert.deepEqual(lay(['a', 'b'], [{ vendorId: 'ghost', position: 0 }]), ['a', 'b']);
});

test('malformed pins are ignored, not thrown', () => {
  const m = pinMap([
    { vendorId: 'a', position: 0 },
    { vendorId: '', position: 1 },
    { vendorId: 'b', position: -1 },
    { vendorId: 'c', position: 1.5 },
    { vendorId: 'a', position: 7 },
  ] as BenchPin[]);
  assert.deepEqual([...m.entries()], [['a', 0]]);
});

// ── what gets written after a move ─────────────────────────────────────────

test('a move pins the card where it was dropped', () => {
  const out = pinsAfterMove({
    displayed: ['a', 'b', 'c', 'd'],
    pinned: [],
    moved: 'd',
    toIndex: 0,
  });
  assert.deepEqual(out, [{ vendorId: 'd', position: 0 }]);
});

test('a displaced pin is re-pinned to where it actually shows', () => {
  // 'd' was pinned at 0. The couple now drags 'a' to 0, pushing 'd' to 1. If
  // only the moved card were re-pinned, 'd' would still claim slot 0 and the
  // next render would swap them back — the rail moving on its own.
  const out = pinsAfterMove({
    displayed: ['d', 'a', 'b', 'c'],
    pinned: ['d'],
    moved: 'a',
    toIndex: 0,
  });
  assert.deepEqual(out, [
    { vendorId: 'a', position: 0 },
    { vendorId: 'd', position: 1 },
  ]);
});

test('an untouched card is never pinned by someone else moving', () => {
  const out = pinsAfterMove({
    displayed: ['a', 'b', 'c'],
    pinned: [],
    moved: 'c',
    toIndex: 1,
  });
  assert.deepEqual(out.map((p) => p.vendorId), ['c']);
  // 'b' moved on screen, but the couple never dragged it — it stays the lens's.
});

test('the written set round-trips: applying it reproduces what the couple saw', () => {
  const sorted = ['a', 'b', 'c', 'd'];
  const displayed = lay(sorted, []);
  const pins = pinsAfterMove({ displayed, pinned: [], moved: 'd', toIndex: 1 });
  assert.deepEqual(lay(sorted, pins), ['a', 'd', 'b', 'c']);
});

test('two moves in a row round-trip', () => {
  const sorted = ['a', 'b', 'c', 'd'];
  let pins = pinsAfterMove({ displayed: sorted, pinned: [], moved: 'd', toIndex: 0 });
  let shown = lay(sorted, pins);
  assert.deepEqual(shown, ['d', 'a', 'b', 'c']);
  pins = pinsAfterMove({
    displayed: shown,
    pinned: pins.map((p) => p.vendorId),
    moved: 'c',
    toIndex: 1,
  });
  shown = lay(sorted, pins);
  assert.deepEqual(shown, ['d', 'c', 'a', 'b']);
});

test('moving a card that is not on the rail writes nothing', () => {
  assert.deepEqual(
    pinsAfterMove({ displayed: ['a', 'b'], pinned: [], moved: 'ghost', toIndex: 0 }),
    [],
  );
});

test('a drop index past the end lands on the last slot', () => {
  const out = pinsAfterMove({ displayed: ['a', 'b', 'c'], pinned: [], moved: 'a', toIndex: 99 });
  assert.deepEqual(out, [{ vendorId: 'a', position: 2 }]);
});

// ── the keyboard route ─────────────────────────────────────────────────────

test('a nudge at the end of the rail is not a move', () => {
  assert.equal(keyboardMoveTarget(['a', 'b', 'c'], 'a', 'left'), null);
  assert.equal(keyboardMoveTarget(['a', 'b', 'c'], 'c', 'right'), null);
  assert.equal(keyboardMoveTarget(['a', 'b', 'c'], 'a', 'right'), 1);
  assert.equal(keyboardMoveTarget(['a', 'b', 'c'], 'c', 'left'), 1);
  assert.equal(keyboardMoveTarget(['a', 'b'], 'ghost', 'left'), null);
});

test('the keyboard and the drag reach the same order', () => {
  const sorted = ['a', 'b', 'c'];
  const to = keyboardMoveTarget(sorted, 'c', 'left');
  assert.equal(to, 1);
  const pins = pinsAfterMove({ displayed: sorted, pinned: [], moved: 'c', toIndex: to as number });
  assert.deepEqual(lay(sorted, pins), ['a', 'c', 'b']);
});

// ── what the couple is offered ─────────────────────────────────────────────

test('Reset is offered only for an arrangement the couple can actually see', () => {
  assert.equal(hasVisibleArrangement([{ vendorId: 'a', position: 0 }], ['a', 'b']), true);
  assert.equal(hasVisibleArrangement([{ vendorId: 'gone', position: 0 }], ['a', 'b']), false);
  assert.equal(hasVisibleArrangement([], ['a', 'b']), false);
});

test('the note names the lens Reset would give the rail back to', () => {
  assert.equal(
    arrangementNote('Lowest price'),
    'You arranged this category. Reset puts it back to ‘Lowest price’.',
  );
  assert.match(arrangementNote('Best matches'), /this category/);
});

// ── THE RULES THAT LIVE OUTSIDE THIS MODULE ─────────────────────────────────
//
// Everything above proves the ARITHMETIC. None of it can see whether the bench
// actually applies it, or whether Reset stays inside one category — and both are
// the kind of mistake that type-checks, passes every test above, and is only
// visible to a couple who lost work.

test('the bench applies the arrangement to the SORTED rail, and the sink stays last', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { stripComments } = await import('@/lib/strip-comments');

  const WEB = join(import.meta.dirname, '..');
  const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
  const src = stripComments(readFileSync(join(WEB, BENCH), 'utf8'));
  assert.ok(src.length > 60_000, `the bench read as ${src.length} chars — the scan is not reading it`);

  // lens → the couple's own hand → sink. Composing the other way round lets the
  // sort overwrite the order the couple set by hand, which is the whole feature
  // silently not working.
  assert.match(
    src,
    /applyBenchArrangement\(\s*sortWithReasons\(/,
    'the arrangement is no longer applied to the sorted rail',
  );
  assert.match(
    src,
    /partitionByBuildFit\(\s*arrangedRail,/,
    'the date sink no longer runs over the arranged rail',
  );
  // The drop index is measured against what is ON SCREEN. Measuring it against
  // the unsorted list would drop cards in the wrong slot for every lens but one.
  assert.match(src, /const railOrder = rail\.fits\.map/, 'the drop index lost its reference order');
});

test('Reset reaches ONE category, and a save replaces rather than merges', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { stripComments } = await import('@/lib/strip-comments');

  const WEB = join(import.meta.dirname, '..');
  const ACTION = 'app/dashboard/[eventId]/vendors/_actions/bench-arrangement.ts';
  const src = stripComments(readFileSync(join(WEB, ACTION), 'utf8'));
  assert.ok(src.length > 2_000, `the action read as ${src.length} chars`);

  // Owner: "per category." A delete that forgets the tile filter wipes every
  // arrangement on the bench — a couple tidying their florists would silently
  // lose the caterers they arranged three weeks ago.
  const deletes = src.match(/\.delete\(\)[\s\S]{0,200}?;/g) ?? [];
  assert.equal(deletes.length, 2, 'expected exactly two scoped deletes (save + reset)');
  for (const d of deletes) {
    assert.match(d, /\.eq\('event_id'/, 'a delete is not scoped to the event');
    assert.match(d, /\.eq\('tile'/, 'a delete is not scoped to ONE category');
  }
  // The save must clear that category before inserting, or a pin the couple has
  // just moved off is left behind and the next read puts a card where they
  // never dropped it.
  const saveBody = src.slice(src.indexOf('export async function saveBenchArrangement'));
  assert.ok(
    saveBody.indexOf('.delete()') < saveBody.indexOf('.insert('),
    'the save inserts without clearing the category first — that is a merge, not a replacement',
  );
});
